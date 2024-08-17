const express = require("express");
const roomController = require("../controllers/roomController");

const router = express.Router();

router.post("/", roomController.createRoom);
router.post("/add-user", roomController.addUsersToRoom);
router.get("/code/:code", roomController.getRoomByCode);
router.get("/id/:id", roomController.getRoomById);
router.get("/", roomController.getRooms);
router.put("/code/:code",roomController.updateRoomByCode)
// เพิ่มเติม routes อื่นๆ เช่น getRoom, updateRoom, deleteRoom

module.exports = router;
