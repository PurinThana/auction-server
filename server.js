const express = require("express");
const cors = require("cors"); // Import cors
const bodyParser = require("body-parser"); // Import body-parser
const http = require("http"); // Import http for creating server
const { Server } = require("socket.io"); // Import Server from socket.io
const socketManager = require("./socketManager"); // Import socketManager

const userRoutes = require("./routes/userRoutes");
const roomRoutes = require("./routes/roomRoutes");
const gameRoutes = require("./routes/gameRoutes");
const gameLogRoutes = require("./routes/gameLogRoutes");

const app = express();
const server = http.createServer(app); // Create an HTTP server with Express

app.use(cors());

// Use body-parser middleware
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Use routes
app.use("/users", userRoutes);
app.use("/rooms", roomRoutes);
app.use("/games", gameRoutes);
app.use("/gamelogs", gameLogRoutes);

// Initialize Socket.io with the server and configure CORS
const io = new Server(server, {
  cors: {
    origin: "*", // You can replace '*' with your specific origin(s) to restrict access
    methods: ["GET", "POST"], // HTTP methods you want to allow
    allowedHeaders: ["my-custom-header"], // Custom headers you want to allow
    credentials: true, // Set to true if you need to allow cookies with cross-origin requests
  },
});

// Use socketManager to handle socket events
socketManager(io);

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
