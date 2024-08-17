const axios = require("axios");
require('dotenv').config()
const rooms = {};
var games = {};
let countdownTime = {}; // ตั้งค่าเวลาเริ่มต้นเป็น 0 วินาที
let countdownInterval = {}; // เก็บข้อมูล interval ของเวลานับถอยหลัง
let log = {}


module.exports = function (io) {
  io.on("connection", (socket) => {
    // Admin join event
    socket.on("admin-join", async (data) => {
      const { code } = data;
      socket.join(code);
    });

    socket.on('get-room-game-req', () =>{
      socket.emit('get-room-game-res' ,{
        rooms , games
      })
    })

    // User join event
    socket.on("user-join", async (data) => {
      const { code, name, organization } = data;

      try {
        const result = await axios.get(
          `${process.env.SELF_URL}rooms/code/${code}`
        );
        const room = result.data;

        if (room.status === "waiting") {
          if (!rooms[code]) {
            rooms[code] = {
              users: [],
            };
          }

          const userExists = rooms[code].users.some(
            (user) => user.name === name && user.organization === organization
          );

          if (userExists) {
            console.log("User already in the room");
            socket.emit("join-failure", {
              message: "You are already in the room",
            });
            return;
          }

          rooms[code].users.push({ socketId: socket.id, name, organization });

          socket.emit("join-success", rooms[code].users);
          io.to(code).emit("room-update", {
            message: `${name} has joined the room`,
            users: rooms[code].users,
          });

          socket.join(code);
        } else {
          socket.emit("join-failure", {
            message: "Room is not available for joining",
          });
        }
      } catch (error) {
        console.error("Error fetching room:", error);
        socket.emit("error", { message: "Failed to fetch room" });
      }
    });

    // Request room waiting list
    socket.on("room-waiting-list", (code) => {
      if (rooms[code]) {
        socket.emit("room-waiting-list-response", rooms[code].users);
      } else {
        socket.emit("room-waiting-list-response", []);
      }
    });

    // Start game event
    socket.on("start-game", (data) => {
      const code = data.code;
      const open = data.open;
      socket.join(code);
      try {
        games[code] = JSON.parse(JSON.stringify(rooms[code]));
        // Add the status property to each user in the users array
        games[code].users = games[code].users.map((user) => ({
          ...user,
          status: "active", // Or any other value you want to set
          accept: false,
        }));
        games[code].status = "auto-increment";
        games[code].open = open;
        games[code].now = open;
        games[code].increment = 100;
        games[code].round = 1;
        games[code].btn = "จับเวลา"
        countdownTime[code] = 0;
        countdownInterval[code] = null
        rooms[code] = undefined
        io.to(code).emit("redirect-game", { code });
      } catch (e) {
        socket.emit("start-error", e);
      }
    });

    socket.on("join-game", (data) => {
      const { role, name, organization, code } = data;
      console.log(games[code]);
      // Ensure the room exists
      if (!games[code]) {
        socket.emit("error", { message: "Room not found" });
      } else {
        try {
          socket.emit("test-socket", games[code]);
        } catch (e) {
          console.error("Error emitting test-socket:", e);
        }
      }

      // Joining the room
      socket.join(code);

      // Setting up the 'next-round-req' event listener
      socket.on("next-round-req", (data) => {
     
        const { increment ,code} = data;
        if (countdownTime[code] !== 0) {
          return
        }
        games[code].btn = "จับเวลา"
        games[code].increment += increment;
        games[code].now = games[code].increment * games[code].open * 0.01;
        games[code].round += 1;
   
        io.to(code).emit("next-round-res", {
          now: games[code].now,
          round: games[code].round,
        }); // Emit to all clients in the room
        io.to(code).emit("test-socket", games[code]);
      });

      //แก้ไข
      socket.on("edit-user-prop", (data) => {
        const { name, organization, newProps, code } = data;
        const game = games[code];
    
        if (game) {
            // Find the user based on both name and organization
            const user = game.users.find(
                (u) => u.name === name && u.organization === organization
            );
            if (user) {
                Object.assign(user, newProps);
    
                // Check if the user has accepted and log the event
                if (newProps.accept === true) {
                    const message = `${user.name} | ${user.organization} กดยอมรับเมื่อ เวลาเหลือ ${countdownTime[code]}`;
                    console.log(message);
                    log[code].push(message);  // Push log message
                }
    
                io.to(code).emit("test-socket", games[code]);
            } else {
                socket.emit("error", { message: "User not found" });
            }
        } else {
            socket.emit("error", { message: "Game not found" });
        }
    });
    
      socket.on('redirect-all-req', (url) => {
        io.to(code).emit("redirect-all-res",url);
      })
      // ฟังก์ชันการเริ่มต้นเวลานับถอยหลังพร้อมรับค่าเวลาเป็นวินาที
      socket.on('startCountdown', (data) => {
        const { initialTime, code } = data;
        if (!log[code]) {
          log[code]=[]
        }
      
        if (countdownInterval[code]) return; // ถ้ามี interval ที่กำลังทำงานอยู่ ไม่ต้องเริ่มใหม่
        
        const startMsg = `รอบที่ ${games[code].round} ราคา ${Math.round(games[code].now)}`
        log[code].push(startMsg);

        io.to(code).emit("btn-open");

        countdownTime[code] = initialTime;
        countdownInterval[code] = setInterval(() => {
            if (countdownTime[code] <= 0) {
                clearInterval(countdownInterval[code]); 
                countdownInterval[code] = null;
                  games[code].btn = "รอบถัดไป"
                // Update users' status based on their accept value
                games[code].users.forEach(user => {
                    if (!user.accept) {
                        user.status = 'unactive';
                        const message = `${user.name} | ${user.organization} ยอมแพ้เมื่อรอบที่  ${games[code].round}`;
                        console.log(message);
                        log[code].push(message);  // Push log message
                    }
                    // Reset accept value for all users
                    user.accept = false;
                });
                io.to(code).emit("test-socket", games[code]);
                io.to(code).emit("btn-close");
                io.to(code).emit("log-recorded" , log[code]);
                console.log("Update", games[code].users);
            } else {
                countdownTime[code]--;
                io.emit('updateCountdown', countdownTime[code]);
            }
        }, 1000);
    });
    

      // ฟังก์ชันการรีเซ็ตเวลานับถอยหลัง
      socket.on('resetCountdown', () => {
        clearInterval(countdownInterval); // หยุด interval ที่กำลังทำงานอยู่
        countdownInterval = null; // ตั้งค่า interval เป็น null
        countdownTime = 0; // รีเซ็ตเวลาเป็น 0 วินาที
        io.emit('updateCountdown', countdownTime); // ส่งค่าเวลาปัจจุบันที่ถูกรีเซ็ตไปยังไคลเอนต์
      });


      socket.on("time-end", (code) => {



        games[code].users.forEach(user => {
          if (!user.accept) {
            user.status = 'unactive';
          }
        });

        console.log("test", games[code].users)

      })
    });

    // Handle client disconnect
    socket.on("disconnect", () => {
      console.log("Client disconnected");

      for (const [roomCode, room] of Object.entries(rooms)) {
        const userIndex = room.users.findIndex(
          (user) => user.socketId === socket.id
        );
        if (userIndex !== -1) {
          room.users.splice(userIndex, 1);
          io.to(roomCode).emit("room-update", {
            message: "A user has left the room",
            users: room.users,
          });
          break;
        }
      }
    });
  });
};
