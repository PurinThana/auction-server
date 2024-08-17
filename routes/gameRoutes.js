const express = require("express");
const gameController = require("../controllers/gameController");

const router = express.Router();

router.post("/", gameController.createGame);
// เพิ่มเติม routes อื่นๆ เช่น getGame, updateGame, deleteGame

module.exports = router;
