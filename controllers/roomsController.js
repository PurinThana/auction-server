const  pool  = require('../db'); // หรือการเชื่อมต่อฐานข้อมูลของคุณ


async function generateUniqueRoomNumber() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let room_number;

  while (true) {
    room_number = Array.from({ length: 6 }, () => characters[Math.floor(Math.random() * characters.length)]).join('');

    // Check if room_number already exists in the database
    const result = await pool.query('SELECT room_number FROM rooms WHERE room_number = $1', [room_number]);

    if (result.rows.length === 0) {
      break; // room_number is unique, break out of the loop
    }
  }

  return room_number;
}


// Create room
async function createRoom(req, res) {
  const { room_name , description} = req.body;

  if (!room_name) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    // Generate a unique room number
    const room_number = await generateUniqueRoomNumber();

    // Insert the new room into the database
    const result = await pool.query(
      `INSERT INTO rooms (room_number, room_name ,description)
      VALUES ($1, $2 ,$3) RETURNING room_number, id`,
      [room_number, room_name ,description]
    );

    // Return the created room's ID and room number
    res.status(201).json({ id: result.rows[0].id, room_number: result.rows[0].room_number, message: 'Room created successfully' });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Internal server error',message:error });
  }
}

// Read all rooms
async function getAllRooms(req, res) {
  const { page = 1, limit = 10 } = req.query; // Default to page 1 and limit 10 if not provided
  const offset = (page - 1) * limit;

  try {
    // Fetch the paginated data
    const result = await pool.query(
      'SELECT * FROM rooms LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    // Fetch the total count of rows
    const countResult = await pool.query('SELECT COUNT(*) FROM rooms');
    const totalRows = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(totalRows / limit);

    // Return the paginated data along with metadata
    res.status(200).json({
      data: result.rows,
      currentPage: page,
      totalPages,
      totalRows,
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Read a room by id
async function getRoomById(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getRoomByNumber(req, res) {
  const { room_number } = req.params;

  try {
    const result = await pool.query('SELECT * FROM rooms WHERE room_number = $1', [room_number]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update room
async function updateRoom(req, res) {
  const { id } = req.params;
  const { room_number, opening_price, current_price, final_price, round, status, winner, log } = req.body;

  try {
    const result = await pool.query(
      `UPDATE rooms
      SET room_number = $1, opening_price = $2, current_price = $3, final_price = $4, round = $5, status = $6, winner = $7, log = $8
      WHERE id = $9`,
      [room_number, opening_price, current_price, final_price, round, status, winner, log, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.status(200).json({ message: 'Room updated successfully' });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete room
async function deleteRoom(req, res) {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM rooms WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getRoomByNumber,
};
