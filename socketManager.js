"use client";
const axios = require("axios");
require('dotenv').config();
const rooms = {};
const pool = require('./db'); // Your database connection module
const { createLogs2 } = require("./controllers/logsController");
var auctions = {}
let countdownTime = {}; // ตั้งค่าเวลาเริ่มต้นเป็น 0 วินาที
let countdownInterval = {}; // เก็บข้อมูล interval ของเวลานับถอยหลัง

function updateUser(acutions, roomNumber, name, organization, updateFields) {
  const users = acutions[roomNumber].users;

  for (let user of users) {
    if (user.name === name && user.organization === organization) {
      for (let key in updateFields) {
        if (user.hasOwnProperty(key)) {
          user[key] = updateFields[key];
        }
      }
      return true; // Return true if user is updated successfully
    }
  }

  return false; // Return false if user is not found
}



module.exports = function (io) {
  io.on("connection", (socket) => {
    
    // Handle joining a room
    socket.on('join-room', async (data) => {
      const { room_number, user } = data;
      console.log(data)
      try {
        // Check if the room exists, if not, initialize it
        if (!rooms[room_number]) {
          const result = await pool.query('SELECT * FROM rooms WHERE room_number = $1', [room_number]);

          // Initialize the room in memory if found
          rooms[room_number] = result.rows[0];
          rooms[room_number].users = [];
        }

        if (user.name === "admin") {
          socket.join(room_number);
          io.to(room_number).emit('update-room', rooms[room_number]);
          return;
        }

        // Check if a user with the same name and organization already exists in the room
        const existingUser = rooms[room_number].users.find(
          (u) => u.name === user.name && u.organization === user.organization
        );

        if (existingUser) {
          io.to(socket.id).emit('error', 'Name and organization already taken');
          return;
        }

        // Add the user to the room
        rooms[room_number].users.push({
          socketId: socket.id,
          name: user.name,
          organization: user.organization,
          accepted: false,
          status: 'active', 
        });

        socket.join(room_number);

        // Notify other users in the room
        io.to(room_number).emit('update-room', rooms[room_number]);

      } catch (error) {
        console.error('Error joining room:', error);
        io.to(socket.id).emit('error', 'Failed to join room');
      }
    });

    socket.on("start-auction", async (data) => {
      const { room_number, opening_price } = data; 
    
      const updateRoomQuery = `
        UPDATE public.rooms
        SET opening_price = $1, current_price = $2, status = $3 , round = $4
        WHERE room_number = $5 RETURNING id;`;
    
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
    
        // Update room
        const result = await client.query(updateRoomQuery, [opening_price, opening_price, "ongoing",1, room_number]);
        const roomId = result.rows[0].id;
    
        // Get users from the room
        const users = rooms[room_number].users;
    
        // Insert users into room_user table one by one
        for (const user of users) {
          const insertUserQuery = `
            INSERT INTO public.room_user (room_id, name, organization, accepted, status)
            VALUES ($1, $2, $3, $4, $5);`;
    
          await client.query(insertUserQuery, [roomId, user.name, user.organization, user.accepted, user.status]);
        }
    
        await client.query('COMMIT');
        
        // Notify other users in the room
        io.to(room_number).emit('auction-started', {
          room_number,
          message: 'Auction has started!',
        });
    
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error starting auction:', error);
        io.to(socket.id).emit('error', 'Failed to start auction');
      } finally {
        client.release();
      }
    });
    
    socket.on("join-auction" , async(data) => {
      const { room_number, user } = data;
      
      try {
        // Check if the room exists, if not, initialize it
        if (!auctions[room_number]) {
          const result = await pool.query('SELECT * FROM rooms WHERE room_number = $1', [room_number]);

          // Initialize the room in memory if found
          auctions[room_number] = result.rows[0];
          auctions[room_number].actionBtn = "จับเวลา"

          const userResult  = await pool.query('SELECT * FROM room_user WHERE room_id = $1',[result.rows[0].id])
          auctions[room_number].users = userResult.rows;
          auctions[room_number].mode = "จับเวลา"
          auctions[room_number].bidTime = 300
          auctions[room_number].bidMin = 3000
          auctions[room_number].highest = {
            name : "no-one",
            organization : "no-one"
          }
          auctions[room_number].log = []
          auctions[room_number].log.push({
            message : `เริ่มการประมูลห้อง ${auctions[room_number].room_name} รอบที่ ${auctions[room_number].round} ราคาเปิด ${auctions[room_number].opening_price}`
          })
         
        }
      
     
        if (user.name === "admin") {
          socket.join(room_number);
          io.to(room_number).emit('update-auction', auctions[room_number]);
          return;
        }
       

        socket.join(room_number);

        // Notify other users in the room
        io.to(room_number).emit('update-auction', auctions[room_number]);

      } catch (error) {
        console.error('Error joining auction:', error);
        io.to(socket.id).emit('error', 'Failed to join auction');
      }
    })

     // ฟังก์ชันการเริ่มต้นเวลานับถอยหลังพร้อมรับค่าเวลาเป็นวินาที
     socket.on('startCountdown', async (data) => {
      const { initialTime, room_number } = data;
    
      // Check if there's already an active countdown for this room
      if (countdownInterval[room_number]) return; 
    
      // Notify users in the room that the countdown has started
      io.to(room_number).emit("btn-open");
    
      // Initialize countdown time and interval
      countdownTime[room_number] = initialTime;
      countdownInterval[room_number] = setInterval(async () => {
        if (countdownTime[room_number] <= 0) {
          // Stop the interval and reset
          clearInterval(countdownInterval[room_number]); 
          countdownInterval[room_number] = null;
    
          // Update the auction status
          auctions[room_number].actionBtn = "รอบถัดไป";
    
          // Update users' status and handle database updates
          for (const user of auctions[room_number].users) {
            if (!user.accepted && user.status === "active") {
              user.status = 'unactive2';
              auctions[room_number].log.push({ 
                name: user.name,
                organization: user.organization,
                message: `ยอมแพ้ในรอบที่ ${auctions[room_number].round}`
              });
    
              // Prepare and execute the database update query
              const query = `
                UPDATE room_user
                SET status = $1,
                    accepted = $2
                WHERE name = $3 AND organization = $4
              `;
              try {
                await pool.query(query, ['unactive', false, user.name, user.organization]);
              } catch (err) {
                console.error('Error updating user status:', err.stack);
              }
            } else if(!user.accepted && user.status === "unactive2") {
              user.status = 'unactive';
     
            }
            // Reset accept value for all users
            user.accepted = false; 
          }
          
    
          // Notify users of the updated auction status and close the countdown
          io.to(room_number).emit('update-auction', auctions[room_number]);
          io.to(room_number).emit("btn-close");
          
        } else {
          // Decrement the countdown time and notify users
          countdownTime[room_number]--; 
          io.to(room_number).emit('updateCountdown', countdownTime[room_number]);
        }
      }, 1000);
    });
    


    socket.on("next-round" ,async (data) => {
        const {room_number ,increment} = data
  
        try{
       
          auctions[room_number].round += 1
          auctions[room_number].actionBtn = "จับเวลา"
          auctions[room_number].current_price = 
          parseFloat(auctions[room_number].current_price) + 
          parseFloat(auctions[room_number].opening_price) * (increment / 100);
          
          let up = Math.round(((parseFloat(auctions[room_number].current_price)/parseFloat(auctions[room_number].opening_price)) - 1) *100)

          auctions[room_number].log.push({
            message:`รอบที่ ${auctions[room_number].round} ราคาปัจจุบัน ${auctions[room_number].current_price} เพิ่มขึ้น ${up} %`
          })
          const query = `
          UPDATE rooms
          SET current_price = $1,
              round = $2
          WHERE room_number = $3
        `;
          const result = await pool.query(query,[auctions[room_number].current_price ,auctions[room_number].round , room_number ])

          io.to(room_number).emit('update-auction', auctions[room_number]);
        }catch (error) {
          console.error('Error', error);
          io.to(socket.id).emit('error', 'Failed');
        }
    })

    socket.on('accept-price' , (data) => {
      const {room_number , name , organization , update} = data
      try {
        updateUser(auctions,room_number,name,organization,update) 

        auctions[room_number].log.push({
          name,
          organization,
          message:`ยอมรับราคาเมื่อเวลาเหลือ ${countdownTime[room_number]}`
        })
       
        io.to(room_number).emit('update-auction', auctions[room_number]);
      } catch (error) {
        console.error('Error', error);
        io.to(socket.id).emit('error', 'Failed');
      }
    })

    socket.on('bid-price', (data) => {
      const { name, organization, bid, room_number } = data;
      console.log(auctions[room_number].bidTime)
      try {
       
    
        auctions[room_number].current_price = bid;
        auctions[room_number].highest = {
          name,
          organization
        };
        auctions[room_number].log.push({
          name,
          organization,
          message : `ได้เสนอราคาใหม่เป็นจำนวนเงิน ${bid} บาท เมื่อเวลาเหลือ ${countdownTime[room_number]}`
        })
        
        io.to(room_number).emit('update-auction', auctions[room_number]);
    
        // Clear the previous countdown if it exists
        if (countdownInterval[room_number]) {
          clearInterval(countdownInterval[room_number]);
        }
    
        // Reset countdown time
        countdownTime[room_number] = auctions[room_number].bidTime;
    
        // Start a new countdown
        countdownInterval[room_number] = setInterval(() => {
          if (countdownTime[room_number] <= 0) {
            clearInterval(countdownInterval[room_number]); 
            countdownInterval[room_number] = null;
            auctions[room_number].log.push({
              name,
              organization,
              message : `เวลาได้หมดลงราคาสูงสุดคือ ${bid} บาท`
            })
            io.to(room_number).emit('auction-ended', auctions[room_number]);
            
          } else {
            countdownTime[room_number]--;
            
            io.to(room_number).emit('updateCountdown', countdownTime[room_number]);
          }
        }, 1000);
    
      } catch (error) {
        console.error('Error', error);
        io.to(socket.id).emit('error', 'Failed');
      }
    });
    
    socket.on('update-user' , (data) => {
      const {room_number , name , organization , update} = data
      try { 
        updateUser(auctions,room_number,name,organization,update) 

       
        io.to(room_number).emit('update-auction', auctions[room_number]);
      } catch (error) {
        console.error('Error', error);
        io.to(socket.id).emit('error', 'Failed');
      }  
    })

    socket.on("change-mode" ,(data)=>{
      const {room_number , mode} = data
      try {
        auctions[room_number].mode = mode
        auctions[room_number].log.push({
          
          message : `ได้เปลี่ยนรูปแบบเป็น ${mode}`
        })
        io.to(room_number).emit('update-auction', auctions[room_number]);
        const kickedPlayer = auctions[room_number].users.filter((u)=> u.status !== 'bid')
        io.to(room_number).emit('kick-player',kickedPlayer);
      } catch (error) { 
        console.error('Error', error); 
        io.to(socket.id).emit('error', 'Failed');
      }  
    })
    socket.on("change-bidTime" ,(data)=>{ 
      const {room_number , bidTime} = data
      try {
        auctions[room_number].bidTime = bidTime
        io.to(room_number).emit('update-auction', auctions[room_number]);
      } catch (error) {
        console.error('Error', error);
        io.to(socket.id).emit('error', 'Failed');
      }
    })

    socket.on("change-bidMin" ,(data)=>{ 
      const {room_number , bidMin} = data
      try { 
        auctions[room_number].bidMin = bidMin
        io.to(room_number).emit('update-auction', auctions[room_number]);
      } catch (error) {
        console.error('Error', error);
        io.to(socket.id).emit('error', 'Failed');
      }
    })

    socket.on("finish", async (data) => {
      const { room_number, winner } = data;
      const updateRoomQuery = `
        UPDATE rooms
        SET final_price = $1,
            winner = $2,
            status = $3
        WHERE room_number = $4
      `;
    
      try {
        // Start a transaction
        await pool.query('BEGIN');
    
        // Update the room's status
        await pool.query(updateRoomQuery, [auctions[room_number].current_price, winner, "done", room_number]);
    
        // Insert logs associated with this room
        await createLogs2(room_number, auctions[room_number].log);
    
        // Commit the transaction
        await pool.query('COMMIT');
    
        // Emit finish response
        io.to(room_number).emit('finish-res');
      } catch (error) {
        // Rollback the transaction in case of an error
        await pool.query('ROLLBACK');
    
        console.error('Error handling finish event:', error);
      }
    });
    // Handle user disconnecting
    socket.on('disconnect', async () => {
      try {
        // Find the room and remove the user
        for (const [room_number, room] of Object.entries(rooms)) {
          const userIndex = room.users.findIndex(user => user.socketId === socket.id);

          if (userIndex !== -1) {
            const disconnectedUser = room.users[userIndex];

            // Remove user from the room
            room.users.splice(userIndex, 1);

            // Notify other users that a user has left
            io.to(room_number).emit('user-left', {
              room_number,
              user: disconnectedUser,
            });

            // Notify other users in the room of the updated state
            io.to(room_number).emit('update-room', rooms[room_number]);

            console.log(`User ${socket.id} removed from room ${room_number}`);
            break;
          }
        }
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    }); 
  });
};
