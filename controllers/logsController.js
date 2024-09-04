const  pool  = require('../db'); // หรือการเชื่อมต่อฐานข้อมูลของคุณ

async function createLog(req, res) {
    const { room_number , name , organization , message} = req.body;
  
    if (!room_number) {
      return res.status(400).json({ error: 'Invalid input' });
    }
  
    try {
   
      // Insert the new log into the database
      await pool.query(
        `INSERT INTO log (room_number, name ,organization ,message)
        VALUES ($1, $2 ,$3 ,$4) `,
        [room_number, name ,organization , message]
      );
  
      // Return 201
      res.send(201)
    } catch (error) {
      console.error('Error creating log:', error);
      res.status(500).json({ error: 'Internal server error',message:error });
    }
  }
  async function createLogs(req, res) {
    const logs = req.body;
  
    if (!Array.isArray(logs) || logs.length === 0) {
      return res.status(400).json({ error: 'Invalid input: logs must be a non-empty array' });
    }
  
    try {
      // Start a transaction
      await pool.query('BEGIN');
  
      for (const log of logs) {
        const { room_number, name, organization, message } = log;
  
        if (!room_number) {
          return res.status(400).json({ error: 'Invalid input: each log must have a room_number' });
        }
  
        // Insert each log into the database
        await pool.query(
          `INSERT INTO log (room_number, name, organization, message)
          VALUES ($1, $2, $3, $4)`,
          [room_number, name, organization, message]
        );
      }
  
      // Commit the transaction
      await pool.query('COMMIT');
  
      // Return 201 status
      res.sendStatus(201);
    } catch (error) {
      // Rollback the transaction in case of an error
      await pool.query('ROLLBACK');
  
      console.error('Error creating logs:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }

  async function getLog(req, res) {
    const { room_number } = req.params;
  
    try {
      const result = await pool.query(
        `SELECT * FROM logs WHERE room_number = $1 ORDER BY created_at ASC`,
        [room_number]
      );
  
      // Send the logs back in the response
      res.json(result.rows);
    } catch (error) {
      console.error('Error getting logs:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }

  async function getLogByUser(req, res) {
    const { room_number, name, organization } = req.params;
  
    // Check if any parameter is missing
    if (!room_number || !name || !organization) {
      return res.status(400).json({ error: 'Bad request', message: 'Missing required parameters' });
    }
  
    try {
      const result = await pool.query(
        `SELECT * FROM logs WHERE room_number = $1 AND name = $2 AND organization = $3`,
        [room_number, name, organization]
      );
  
      if (result.rows.length === 0) {
        // Send a 204 No Content status if no logs are found
        return res.status(204).json({ message: 'No logs found for the specified user' });
      }
  
      // Send the logs back in the response
      res.json(result.rows);
    } catch (error) {
      console.error('Error getting logs:', error);
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
  
  
  async function createLogs2(room_number, logs) {
    if (!Array.isArray(logs) || logs.length === 0) {
      return;
    }
  
    try {
      for (const log of logs) {
        const { name, organization, message ,time } = log;
  
        // Insert each log into the database
        await pool.query(
          `INSERT INTO logs (room_number, name, organization, message ,time)
          VALUES ($1, $2, $3, $4 ,$5)`,
          [room_number, name, organization, message,time]
        );
      }
    } catch (error) {
      console.error('Error creating logs:', error);
      throw error; // Re-throw the error to ensure rollback in the calling function
    }
  }

  module.exports ={
    createLog,
    createLogs2,
    getLog
    ,getLogByUser
  }