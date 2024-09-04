const express = require('express');
const router = express.Router();
const { createRoom, getAllRooms, getRoomById, updateRoom, deleteRoom, getRoomByNumber } = require('../controllers/roomsController');

const { createLog, getLog, getLogByUser } = require('../controllers/logsController');
const { getUsersByRoomNumber } = require('../controllers/usersController');

// Routes for rooms
router.post('/rooms', createRoom);
router.get('/rooms', getAllRooms);
router.get('/rooms/:id', getRoomById);
router.get('/rooms/room_number/:room_number', getRoomByNumber); // ใช้จอยห้อง
router.put('/rooms/:id', updateRoom);
router.delete('/rooms/:id', deleteRoom);


router.get('/users/:room_number',getUsersByRoomNumber)

//
router.post('/logs',createLog);
router.get('/logs/:room_number',getLog);
router.get('/logs/:room_number/:name/:organization',getLogByUser);


module.exports = router;
