const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const socketManager = require("./socketManager");
const roomRoutes = require("./routes/roomRoutes");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Use routes
app.use("/api", roomRoutes);

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
