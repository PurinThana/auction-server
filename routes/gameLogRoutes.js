const express = require("express");
const gameLogController = require("../controllers/gameLogController");

const router = express.Router();

router.post("/", gameLogController.createLog);
// เพิ่มเติม routes อื่นๆ เช่น getLog, updateLog, deleteLog

module.exports = router;
