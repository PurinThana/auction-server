const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

router.post("/", userController.createUser);
router.post("/login" , userController.login)
// เพิ่มเติม routes อื่นๆ เช่น getUser, updateUser, deleteUser

module.exports = router;
 