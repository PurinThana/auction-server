const pool = require("../db");

const gameController = {
  async createGame(req, res) {
    const { roomId, description, startTime, endTime } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO games (room_id, description, start_time, end_time) VALUES ($1, $2, $3, $4) RETURNING *",
        [roomId, description, startTime, endTime]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // เพิ่มเติมฟังก์ชันอื่นๆ เช่น getGame, updateGame, deleteGame
};

module.exports = gameController;
