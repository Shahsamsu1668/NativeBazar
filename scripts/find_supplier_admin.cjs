const pg = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, ssl: { rejectUnauthorized: false } });
pool.query("SELECT id, phone, role, name FROM users WHERE role IN ('supplier', 'admin')").then(r => {
  console.log('Suppliers & Admins in Neon main:', r.rows);
  pool.end();
}).catch(console.error);

