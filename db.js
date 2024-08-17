const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DB_CONNECTION_STRING,
});

async function checkConnection() {
  try {
    const client = await pool.connect();
    console.log("Database connected successfully");
    client.release();
  } catch (err) {
    console.error("Database connection error:", err);
  }
}

checkConnection();
module.exports = pool;
