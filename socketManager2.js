"use client";

require('dotenv').config();

const pool = require('./db'); // Your database connection module



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


let i = 1

module.exports = function (io) {
  io.on('connection', (socket) => {
    // console.log('A user connected:', socket.id);

    // เมื่อผู้ใช้เข้าร่วมห้องประมูล
    socket.on('join-room', async (data) => {
      const { room_number, name, role, organization } = data;
      console.log(data);

      try {
        // Check if the room exists
        const res = await pool.query('SELECT * FROM rooms WHERE room_number = $1', [room_number]);
        const room = res.rows[0];
        console.log(room)
        if (room.auction_started) {
          socket.emit('join-error', 'การประมูลเริ่มไปแล้ว');
          return
        }
        if (room) {
          socket.join(room_number);


          if (role === 'admin') {
            // Refetch participants after insertion
            const participantsRes = await pool.query('SELECT * FROM participants WHERE room_number = $1', [room_number]);
            const users = participantsRes.rows;

            // Notify the user and other participants
            socket.emit('updated-room', { room, users });
            return
          }
          // Check if the user already exists in the room
          const existingUser = await pool.query(
            'SELECT * FROM participants WHERE room_number = $1 AND name = $2 AND organization = $3',
            [room_number, name, organization]
          );

          if (existingUser.rows.length > 0) {
            await pool.query('UPDATE participants SET socket_id = $1 WHERE name = $2 AND organization = $3 AND room_number = $4', [socket.id, name, organization, room_number]);
            const participantsRes = await pool.query('SELECT * FROM participants WHERE room_number = $1', [room_number]);
            const users = participantsRes.rows;

            io.to(room_number).emit('updated-room', { room, users });
            // socket.emit('join-error', 'กรุณาเปิดแค่ 1 Browser');
            return;
          }

          // Insert the new user into the database
          await pool.query(
            'INSERT INTO participants (room_number, name, socket_id, role, organization) VALUES ($1, $2, $3, $4, $5)',
            [room_number, name, socket.id, role, organization]
          );

          // Refetch participants after insertion
          const participantsRes = await pool.query('SELECT * FROM participants WHERE room_number = $1', [room_number]);
          const users = participantsRes.rows;

          // Notify the user and other participants
          io.to(room_number).emit('updated-room', { room, users });
          console.log(`${role} ${name} from ${organization} joined room ${room_number}`);
        } else {
          socket.emit('join-error', 'Room does not exist.');
        }
      } catch (err) {
        console.error('Error joining room:', err);
        socket.emit('join-error', 'An error occurred while joining the room.');
      }
    });



    // เมื่อผู้ใช้หรือ admin เข้าร่วมการประมูลที่เริ่มขึ้นแล้ว
    socket.on('join-auction', async (roomNumber, name, organization, role) => {
      try {
        const res = await pool.query('SELECT * FROM rooms WHERE room_number = $1', [roomNumber]);
        const room = res.rows[0];

        if (room && room.auction_started) {
          socket.join(roomNumber);

          const participantsRes = await pool.query('SELECT * FROM participants WHERE room_number = $1', [roomNumber]);
          const participants = participantsRes.rows;

          if (role === 'user') {
            const userStatus = await pool.query('SELECT * FROM participants WHERE name = $1 AND organization = $2', [name, organization]);

            if (userStatus.rows.length === 0) {
              socket.emit('join-error', 'ท่านไม่ได้มีชื่ออยู่ในห้องประมูลนี้.');
              return
            } else {
              socket.emit('updated-auction', { room, users: participants, status: userStatus.rows[0] });
              return
            }
          }


          socket.emit('updated-auction', { room, users: participants });
        } else {
          socket.emit('join-error', 'Auction has not started or room does not exist.');
        }
      } catch (err) {
        console.error(err);
      }
    });

    //start Timer
    socket.on('start-timer', async (room_number, time) => {
      try {
        // Update the room with the provided time and return the updated row
        const result = await pool.query(
          `UPDATE rooms
     SET time = $1,
         action_btn = 'รอบถัดไป'
     WHERE room_number = $2
     RETURNING *`,
          [time, room_number]
        );


        // Check if the room was updated successfully
        if (result.rows.length > 0) {
          const updatedRoom = result.rows[0];
          console.log(updatedRoom)
          // Emit the updated room information to the specific room
          // io.to(room_number).emit('updated-auction', updatedRoom);

          // Emit that the timer has started with the specified time
          io.to(room_number).emit('timer-started', time, 'รอบถัดไป');
        } else {
          // Handle case where no room was found or updated
          socket.emit("action-error", {
            message: "Room not found or update failed"
          });
        }
      } catch (error) {
        console.error(error);
        socket.emit("action-error", {
          error: error.message,
          message: "An error occurred while starting the timer"
        });
      }
    });

    socket.on('time-out', async (room_number) => {
      const client = await pool.connect(); // Get a client from the pool

      try {
        await client.query('BEGIN'); // Start the transaction

        // Fetch current participants' status
        const participantsRes = await client.query(
          `SELECT name, organization, status, accepted
       FROM participants
       WHERE room_number = $1`,
          [room_number]
        );
        const participants = participantsRes.rows;

        // Update participants based on current status and accepted state
        const updatePromises = participants.map(participant => {
          let newStatus;

          if (participant.status === 'active') {
            newStatus = participant.accepted ? 'active' : 'semi-inactive';
          } else if (participant.status === 'semi-inactive') {
            newStatus = participant.accepted ? 'semi-inactive' : 'inactive';
          } else {
            // No change for 'inactive' or unknown statuses
            return Promise.resolve(); // No update needed
          }

          // Update participant status
          return client.query(
            `UPDATE participants
         SET accepted = $1, status = $2
         WHERE room_number = $3 AND name = $4 AND organization = $5`,
            [false, newStatus, room_number, participant.name, participant.organization]
          );
        });

        await Promise.all(updatePromises); // Execute all update queries

        // Commit the transaction
        await client.query('COMMIT');

        // Fetch updated participants
        const updatedParticipantsRes = await client.query(
          `SELECT name, organization, status, accepted
       FROM participants
       WHERE room_number = $1`,
          [room_number]
        );
        const updatedParticipants = updatedParticipantsRes.rows;

        // Emit time-out event with updated participants
        io.to(room_number).emit('time-outed', {
          message: 'เวลาได้หมดลงแล้ว',
          users: updatedParticipants
        });

      } catch (error) {
        await client.query('ROLLBACK'); // Rollback the transaction on error
        console.error(error);
        socket.emit("action-error", {
          error: error.message,
          message: "An error occurred during the time-out action"
        });
      } finally {
        client.release(); // Release the client back to the pool
      }
    });



    socket.on('next-round', async (data) => {
      const { room_number, increment } = data;
      const client = await pool.connect(); // Get a connection from the pool
      try {
        await client.query('BEGIN'); // Start the transaction

        const cal = await client.query('SELECT opening_price, current_price FROM rooms WHERE room_number = $1', [room_number]);
        const { current_price, opening_price } = cal.rows[0];

        // Convert values to numbers to avoid issues with string inputs
        const openingPriceNum = parseFloat(opening_price);
        const currentPriceNum = parseFloat(current_price);
        const incrementNum = parseFloat(increment);

        const newCurrent_price = openingPriceNum + (((currentPriceNum / openingPriceNum) - 1) + (incrementNum / 100)) * openingPriceNum;

        const result = await client.query(
          `UPDATE rooms
   SET current_price = $1,
       action_btn = 'จับเวลา',
       round = round + 1
   WHERE room_number = $2
   RETURNING *;`,
          [newCurrent_price, room_number]
        );


        await client.query('COMMIT'); // Commit the transaction
        const participantsRes = await pool.query('SELECT * FROM participants WHERE room_number = $1', [room_number]);
        const users = participantsRes.rows;
        io.to(room_number).emit('next-rounded', result.rows[0], users);

      } catch (error) {
        await client.query('ROLLBACK'); // Rollback the transaction in case of an error
        console.error(error);
        socket.emit("action-error", {
          error: error.message,
          message: "An error occurred during the next round action"
        });
      } finally {
        client.release(); // Release the client back to the pool
      }
    });

    socket.on('accept-price', async (data) => {
      const { name, organization, room_number } = data;

      const client = await pool.connect(); // Get a client from the pool

      try {
        await client.query('BEGIN'); // Start the transaction

        // Update the participant's accepted status
        const updateRes = await client.query(
          `UPDATE participants
       SET accepted = TRUE
       WHERE room_number = $1 AND name = $2 AND organization = $3
       RETURNING *`,
          [room_number, name, organization]
        );

        if (updateRes.rowCount === 0) {
          throw new Error("Participant not found or already accepted");
        }

        // Fetch updated list of participants


        await client.query('COMMIT'); // Commit the transaction
        const participantsRes = await pool.query('SELECT * FROM participants WHERE room_number = $1', [room_number]);
        const users = participantsRes.rows;
        io.to(room_number).emit('price-accepted', users); // Emit the updated list of users

      } catch (error) {
        await client.query('ROLLBACK'); // Rollback the transaction on error
        console.error(error);
        socket.emit("action-error", {
          error: error.message,
          message: "An error occurred during the accept price action"
        });
      } finally {
        client.release(); // Release the client back to the pool
      }
    });




    // เมื่อผู้ใช้หลุดการเชื่อมต่อแล้วกลับมาใหม่
    socket.on('reconnect', async (roomNumber, name) => {
      try {
        const res = await pool.query('SELECT * FROM participants WHERE room_number = $1 AND name = $2', [roomNumber, name]);
        const participant = res.rows[0];

        if (participant) {
          socket.join(roomNumber);
          await pool.query('UPDATE participants SET socket_id = $1 WHERE name = $2 AND room_number = $3', [socket.id, name, roomNumber]);
          socket.emit('reconnected', roomNumber);
          console.log(`User ${name} reconnected to room ${roomNumber}`);
        } else {
          socket.emit('reconnect_error', 'Unable to reconnect to room.');
        }
      } catch (err) {
        console.error(err);
      }
    });

    // เมื่อผู้ดูแลระบบเริ่มประมูล
    socket.on('start-auction', async (data) => {
      const { room_number, opening_price } = data;

      const client = await pool.connect(); // Get a client from the pool
      try {
        await client.query('BEGIN'); // Begin the transaction

        // Check if the auction has already started
        const res = await client.query('SELECT auction_started FROM rooms WHERE room_number = $1', [room_number]);
        const room = res.rows[0];

        if (room && !room.auction_started) {
          // Update the room with auction details
          await client.query(
            `UPDATE rooms 
   SET auction_started = TRUE, 
       opening_price = $1, 
       current_price = $2, 
       round = $3, 
       "mode" = 'increment', 
       "action_btn" = 'จับเวลา', 
       time = 0 
   WHERE room_number = $4`,
            [opening_price, opening_price, 1, room_number]
          );

          // Update participants status
          await client.query(
            'UPDATE participants SET auction_started = TRUE, accepted = FALSE, "status" = \'active\' WHERE room_number = $1',
            [room_number]
          );

          await client.query('COMMIT'); // Commit the transaction

          // Notify all participants in the room that the auction has started
          io.to(room_number).emit('auction-started');
          console.log(`Auction started in room ${room_number}`);
        } else {
          throw new Error('Room does not exist or auction has already started.');
        }
      } catch (err) {
        await client.query('ROLLBACK'); // Rollback the transaction in case of an error
        console.error('Error starting auction:', err);
        socket.emit('start_error', 'An error occurred while starting the auction.');
      } finally {
        client.release(); // Release the client back to the pool
      }
    });

    socket.on('cut-timer', async (data) => {
      const { room_number, timer } = data
      try {
        // Update the room with the provided time and return the updated row
        await pool.query(
          `UPDATE rooms
     SET time = $1
     WHERE room_number = $2`,
          [timer, room_number]
        );

        io.to(room_number).emit('timer-cutted', timer)
      } catch (error) {
        console.error('Error cutting timer:', error);
        socket.emit('error', 'An error occurred while cutting the timer.');
      }
    })

    socket.on('change-mode', async (data) => {
      const { room_number, users, mode, min_bid } = data;
      const client = await pool.connect();

      try {
        // เริ่มต้น Transaction
        await client.query('BEGIN');

        // อัปเดตโหมดห้อง
        await client.query(
          `UPDATE rooms
            SET mode = $1 , min_bid = $2
            WHERE room_number = $3`,
          [mode, min_bid, room_number]
        );

        const query = `
            UPDATE participants
            SET status = 'bidding'
            WHERE name = $1 AND organization = $2 AND room_number = $3
        `;

        // อัปเดตสถานะผู้ใช้
        for (const user of users) {
          await client.query(query, [user.name, user.organization, room_number]);
        }

        // ทำการ Commit Transaction ถ้าทุกอย่างเรียบร้อย
        await client.query('COMMIT');


        io.to(room_number).emit("mode-changed", users)
      } catch (err) {
        console.log("Error", err);

        // ทำการ Rollback Transaction ถ้ามีข้อผิดพลาดเกิดขึ้น
        await client.query('ROLLBACK');

        socket.emit('change-mode-error', {
          message: "An error occurred while changing to bidding mode.",
          error: err
        });
      } finally {
        // ปล่อย client กลับสู่ pool
        client.release();
      }
    });

    socket.on('change-minBid', async (data) => {
      const { room_number, min_bid } = data
      const client = await pool.connect();
      try {
        // เริ่มต้น Transaction
        await client.query('BEGIN');

        // อัปเดตโหมดห้อง
        const result = await client.query(
          `UPDATE rooms
   SET min_bid = $1 
   WHERE room_number = $2 
   RETURNING min_bid`,
          [min_bid, room_number]
        );

        // Access the updated min_bid value from the result
        const updatedMinBid = result.rows[0].min_bid;



        // ทำการ Commit Transaction ถ้าทุกอย่างเรียบร้อย
        await client.query('COMMIT');


        io.to(room_number).emit("minBid-changed", updatedMinBid)
      } catch (err) {
        console.log("Error", err);

        // ทำการ Rollback Transaction ถ้ามีข้อผิดพลาดเกิดขึ้น
        await client.query('ROLLBACK');

        socket.emit('error', {
          message: "An error occurred during change min bid.",
          error: err
        });
      } finally {
        // ปล่อย client กลับสู่ pool
        client.release();
      }
    })

    socket.on('change-biddingTime', async (data) => {
      const { room_number, bidding_time } = data
      const client = await pool.connect();
      try {
        // เริ่มต้น Transaction
        await client.query('BEGIN');

        // อัปเดตโหมดห้อง
        const result = await client.query(
          `UPDATE rooms
   SET bidding_time = $1
   WHERE room_number = $2 
   RETURNING min_bid`,
          [bidding_time, room_number]
        );

        // Access the updated min_bid value from the result
        const updatedbidding_time = result.rows[0].bidding_time;



        // ทำการ Commit Transaction ถ้าทุกอย่างเรียบร้อย
        await client.query('COMMIT');


        io.to(room_number).emit("biddingTimg-changed", updatedbidding_time)
      } catch (err) {
        console.log("Error", err);

        // ทำการ Rollback Transaction ถ้ามีข้อผิดพลาดเกิดขึ้น
        await client.query('ROLLBACK');

        socket.emit('error', {
          message: "An error occurred during change bidding time.",
          error: err
        });
      } finally {
        // ปล่อย client กลับสู่ pool
        client.release();
      }
    })

    socket.on('bid', async (data) => {
      const { name, organization, room_number, bid, time } = data;
      const client = await pool.connect();  // Connect to the database

      try {
        await client.query('BEGIN');  // Begin the transaction

        // Update the room with the new bid information
        const result = await client.query(
          `UPDATE rooms
       SET current_price = $1,
           time = $2,
           high_name = $3,
           high_organization = $4
       WHERE room_number = $5 
       RETURNING *`,
          [bid, time, name, organization, room_number]
        );

        const updatedRoom = result.rows[0];  // Get the updated room details

        await client.query('COMMIT');  // Commit the transaction

        socket.emit('bid-success', updatedRoom);  // Notify the bidder of success
        io.to(room_number).emit("bidded", updatedRoom);  // Broadcast the update to all clients in the room

      } catch (err) {
        console.log("Error", err);

        await client.query('ROLLBACK');  // Roll back the transaction on error

        // Notify the bidder of the error
        socket.emit('bid-error', {
          message: "เกิดข้อผิดพลาด",
          error: err
        });

      } finally {
        client.release();  // Release the client back to the pool
      }
    });


    // เมื่อผู้ใช้หรือ admin ออกจากห้อง
    socket.on('disconnect', async () => {
      try {
        const res = await pool.query(
          'SELECT * FROM participants WHERE socket_id = $1 AND auction_started = $2',
          [socket.id, false]
        );
        const participant = res.rows[0];

        if (participant) {
          const { room_number, name, role, organization } = participant;
          await pool.query('DELETE FROM participants WHERE socket_id = $1', [socket.id]);

          // Notify others in the room that a user has left
          io.to(room_number).emit('user-left', { name, organization });

          console.log(`${role} ${name} from ${organization} left room ${room_number}`);
        }
      } catch (err) {
        console.error('Error on disconnect:', err);
        socket.emit('error', 'An error occurred while disconnecting.');
      }
    });
  });

};
