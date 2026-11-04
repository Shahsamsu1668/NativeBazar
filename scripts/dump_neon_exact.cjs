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

async function dumpNeonSchema() {
  const client = await pool.connect();
  try {
    const cols = await client.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);
    console.log(JSON.stringify(cols.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}

dumpNeonSchema().catch(e => console.error(e));

