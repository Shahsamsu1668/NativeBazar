const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', 'NativeBazar', '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkNeonRafiq() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, name, phone, email FROM users WHERE phone = '01712458920'");
    console.log('Neon user for 01712458920:', res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

checkNeonRafiq();

