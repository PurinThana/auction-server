const  pool  = require('../db'); // หรือการเชื่อมต่อฐานข้อมูลของคุณ


async function getUsersByRoomNumber(req, res) {
    const { room_number } = req.params;
  
    try {
      const result = await pool.query('SELECT * FROM participants WHERE room_number = $1', [room_number]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'USERS not found' });
      }
      res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching users:', error); 
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  module.exports = {
    getUsersByRoomNumber
  };
  