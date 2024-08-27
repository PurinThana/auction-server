const express = require('express');
const router = express.Router();
const { createRoom, getAllRooms, getRoomById, updateRoom, deleteRoom, getRoomByNumber } = require('../controllers/roomsController');
const { createRoomUser, getAllRoomUsers, getRoomUserById, updateRoomUser, deleteRoomUser, createRoomUserByNumber, getAllRoomUsersById } = require('../controllers/roomUserController');
const { createLog, getLog } = require('../controllers/logsController');

// Routes for rooms
router.post('/rooms', createRoom);
router.get('/rooms', getAllRooms);
router.get('/rooms/:id', getRoomById);
router.get('/rooms/room_number/:room_number', getRoomByNumber); // ใช้จอยห้อง
router.put('/rooms/:id', updateRoom);
router.delete('/rooms/:id', deleteRoom);

// Routes for room_user
router.post('/room_users', createRoomUser);
router.post('/room_users/number', createRoomUserByNumber);
router.get('/room_users', getAllRoomUsers); // If needed, add pagination or filtering later
router.get('/room_users/:room_id', getAllRoomUsersById); // Gets all users for a specific room
router.get('/room_users/:room_id/:name/:organization', getRoomUserById); // Gets specific user details in a room
router.put('/room_users/:room_id/:name/:organization', updateRoomUser);
router.delete('/room_users/:room_id/:name/:organization', deleteRoomUser);



//
router.post('/logs',createLog);
router.get('/logs/:room_number',getLog);



module.exports = router;
