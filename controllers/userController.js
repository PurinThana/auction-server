const pool = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userController = {
  async createUser(req, res) {
    const { username, email, password } = req.body;

    try {
      // Hash the password with a salt round of 10
      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await pool.query(
        "INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *",
        [username, email, hashedPassword]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  async login(req, res) {
    const { username, password } = req.body;

    try {
      // Fetch user from the database by email
      const result = await pool.query(
        "SELECT * FROM users WHERE username = $1",
        [username]
      );

      const user = result.rows[0];

      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Compare the provided password with the hashed password
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Generate a JWT token (You should set a secret key in your environment variables)
      const token = jwt.sign(
        { id: user.id, username: user.username, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Respond with the token
      res.status(200).json({ token });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // เพิ่มเติมฟังก์ชันอื่นๆ เช่น getUser, updateUser, deleteUser
};

module.exports = userController;
