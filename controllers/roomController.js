const pool = require("../db");

const roomController = {
  async createRoom(req, res) {
    const { roomName, status } = req.body;

    // Function to generate a random 6-digit code
    function generateCode() {
      return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Function to check if the code is unique
    async function isCodeUnique(code) {
      const result = await pool.query("SELECT 1 FROM rooms WHERE code = $1", [
        code,
      ]);
      return result.rowCount === 0;
    }

    try {
      let code;
      let unique = false;

      // Generate a unique code
      do {
        code = generateCode();
        unique = await isCodeUnique(code);
      } while (!unique);

      // Insert the new room record
      const result = await pool.query(
        "INSERT INTO rooms (room_name, status, code) VALUES ($1, $2, $3) RETURNING *",
        [roomName, status || "waiting", code]
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async getRooms(req,res) {
    try {
      const result = await pool.query("SELECT * FROM rooms ");



      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      res.status(200).json(result.rows);
    }catch(error){
      res.status(500).json({ error: error.message });
    }
  },
  async getRoomByCode(req, res) {
    const { code } = req.params;

    try {
      // Query to find the room by code
      const result = await pool.query("SELECT * FROM rooms WHERE code = $1", [
        code,
      ]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      res.status(200).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  async getRoomById(req, res) {
    const { id } = req.params;

    try {
      // Query to find the room by ID
      const result = await pool.query("SELECT * FROM rooms WHERE id = $1", [
        id,
      ]);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Room not found" });
      }

      res.status(200).json(result.rows[0]);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async updateRoomByCode(req, res) {
    const { code } = req.params;
    const { open, final, winner, log, room_name, status } = req.body;

    // Build the SET clause dynamically
    let updateFields = [];
    let values = [];
    let valueIndex = 1;

    if (open !== undefined) {
      updateFields.push(`open = $${valueIndex++}`);
      values.push(open);
    }
    if (final !== undefined) {
      updateFields.push(`final = $${valueIndex++}`);
      values.push(final);
    }
    if (winner !== undefined) {
      updateFields.push(`winner = $${valueIndex++}`);
      values.push(winner);
    }
    if (log !== undefined) {
      updateFields.push(`log = $${valueIndex++}`);
      values.push(log);
    }
    if (room_name !== undefined) {
      updateFields.push(`room_name = $${valueIndex++}`);
      values.push(room_name);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${valueIndex++}`);
      values.push(status);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    try {
      // Update the room
      const query = `
            UPDATE rooms
            SET ${updateFields.join(', ')}
            WHERE code = $${valueIndex}
        `;
      values.push(code);

      const result = await pool.query(query, values);

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      res.status(200).json({ message: 'Room updated successfully' });
    } catch (error) {
      console.error('Error updating room:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async addUsersToRoom(req, res) {
    const { id, users } = req.body; // รับข้อมูลจาก body ของ request

    if (!id || !Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    // สร้างการเชื่อมต่อกับฐานข้อมูล
    const client = await pool.connect();

    try {
      await client.query('BEGIN'); // เริ่มต้น transaction

      // สร้างคำสั่ง SQL สำหรับการเพิ่มข้อมูล
      const insertPromises = users.map(user => {
        const { name, organization } = user;
        return client.query(
          'INSERT INTO room_user (room_id, name, organization) VALUES ($1, $2, $3)',
          [id, name, organization]
        );
      });

      // รอให้การเพิ่มข้อมูลทั้งหมดเสร็จสิ้น
      await Promise.all(insertPromises);

      await client.query('COMMIT'); // ยืนยันการเปลี่ยนแปลง
      res.status(200).json({ message: 'Users added successfully' });
    } catch (error) {
      await client.query('ROLLBACK'); // ยกเลิกการเปลี่ยนแปลงหากเกิดข้อผิดพลาด
      console.error('Error adding users:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release(); // ปล่อยการเชื่อมต่อ
    }
  },

  // เพิ่มเติมฟังก์ชันอื่นๆ เช่น getRoom, updateRoom, deleteRoom
};

module.exports = roomController;
