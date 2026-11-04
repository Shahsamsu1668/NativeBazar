const Database = require('better-sqlite3');
const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', 'NativeBazar', '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
}

async function checkS1() {
  const sqliteDb = new Database(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
  const sqUser = sqliteDb.prepare("SELECT * FROM users WHERE id = 's-1' OR phone = '01715889900'").get();
  console.log('User s-1 in SQLite:', sqUser);

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT * FROM users WHERE id = 's-1' OR phone = '01715889900'");
    console.log('User s-1 in Neon:', res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

checkS1().catch(e => console.error(e));

