const  pool  = require('../db'); // หรือการเชื่อมต่อฐานข้อมูลของคุณ

// Create room user
async function createRoomUser(req, res) {
  const { room_id, name, organization, accepted, status } = req.body;

  if (!room_id || !name || !organization || accepted === undefined || status === undefined) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  try {
    await pool.query(
      `INSERT INTO room_user (room_id, name, organization, accepted, status)
      VALUES ($1, $2, $3, $4, $5)`,
      [room_id, name, organization, accepted, status]
    );
    res.status(201).json({ message: 'Room user added successfully' });
  } catch (error) {
    console.error('Error creating room user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function createRoomUserByNumber(req, res) {
  const { room_number, name, organization, accepted, status } = req.body;

  if (!room_number || !name || !organization || accepted === undefined || status === undefined) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN'); // Start a transaction

    // Find the room_id using room_number
    const result = await client.query(
      'SELECT id FROM rooms WHERE room_number = $1',
      [room_number]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room_id = result.rows[0].id;

    // Insert the new room user
    await client.query(
      `INSERT INTO room_user (room_id, name, organization, accepted, status)
      VALUES ($1, $2, $3, $4, $5)`,
      [room_id, name, organization, accepted, status]
    );

    await client.query('COMMIT'); // Commit the transaction
    res.status(201).json({ message: 'Room user added successfully' });
  } catch (error) {
    await client.query('ROLLBACK'); // Rollback the transaction in case of error
    console.error('Error creating room user:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release(); // Release the connection back to the pool
  }
}


// Read all room users
async function getAllRoomUsers(req, res) {
  try {
    const result = await pool.query('SELECT * FROM room_user');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching room users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
// Read all room users By id
async function getAllRoomUsersById(req, res) {
  const { room_id } = req.params; // Retrieve room_id from request parameters

  if (!room_id) {
    return res.status(400).json({ error: 'Room ID is required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM room_user WHERE room_id = $1',
      [room_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No users found for the given room ID' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching room users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Read room user by room_id, name, and organization
async function getRoomUserById(req, res) {
  const { room_id, name, organization } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM room_user WHERE room_id = $1 AND name = $2 AND organization = $3',
      [room_id, name, organization]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room user not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching room user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Update room user
async function updateRoomUser(req, res) {
  const { room_id, name, organization } = req.params;
  const { accepted, status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE room_user
      SET accepted = $1, status = $2
      WHERE room_id = $3 AND name = $4 AND organization = $5`,
      [accepted, status, room_id, name, organization]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Room user not found' });
    }

    res.status(200).json({ message: 'Room user updated successfully' });
  } catch (error) {
    console.error('Error updating room user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete room user
async function deleteRoomUser(req, res) {
  const { room_id, name, organization } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM room_user WHERE room_id = $1 AND name = $2 AND organization = $3',
      [room_id, name, organization]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Room user not found' });
    }

    res.status(200).json({ message: 'Room user deleted successfully' });
  } catch (error) {
    console.error('Error deleting room user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  createRoomUser,
  getAllRoomUsers,
  getRoomUserById,
  updateRoomUser,
  deleteRoomUser,
  createRoomUserByNumber,
  getAllRoomUsersById,
};
