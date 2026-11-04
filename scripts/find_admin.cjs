const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkUsers() {
  const res = await pool.query("SELECT id, role, phone, name FROM users WHERE role = 'admin' OR id LIKE '%admin%'");
  console.table(res.rows);

  const roles = await pool.query("SELECT DISTINCT role FROM users");
  console.log('Distinct roles:', roles.rows.map(r => r.role));

  await pool.end();
}
checkUsers();

