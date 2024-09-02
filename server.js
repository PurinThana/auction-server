const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const http = require("http");
const { Server } = require("socket.io");
const socketManager2 = require("./socketManager2");
const roomRoutes = require("./routes/roomRoutes");

const app = express();
const server = http.createServer(app);

// Middleware to count and log requests and responses
const requestCounter = {
  count: 0
};

const countRequestsMiddleware = (req, res, next) => {
  requestCounter.count += 1;
  console.log(`Request number: ${requestCounter.count}`);

  res.on('finish', () => {
    console.log(`Response number: ${requestCounter.count}`);
  });

  next();
};

app.use(countRequestsMiddleware); // Use the middleware
app.use(cors({
  origin: '*'  // หรือกำหนดที่มาที่ต้องการอนุญาต
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Use routes
app.use("/api", roomRoutes);

// Initialize Socket.io with the server and configure CORS
const io = new Server(server, {
  cors: {
    origin: "*", // Specify your frontend origin here
    methods: ["GET", "POST", "PUT"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

// Use socketManager to handle socket events
socketManager2(io);

const PORT = process.env.PORT || 3001; // Use environment variable PORT for Heroku
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
