const pool = require("../db");

const gameLogController = {
  async createLog(req, res) {
    const { gameId, userId, action } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO game_logs (game_id, user_id, action) VALUES ($1, $2, $3) RETURNING *",
        [gameId, userId, action]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  // เพิ่มเติมฟังก์ชันอื่นๆ เช่น getLog, updateLog, deleteLog
};

module.exports = gameLogController;
