const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkUser() {
  const res = await pool.query("SELECT id, name, role, phone FROM users WHERE id IN ('usr-consumer-sumayya', 'w-karwan-syndicate', 'user-wholesaler-sumaiya', 'user-farmer-rafiq', 'usr-retailer-jafor')");
  console.table(res.rows);
  await pool.end();
}
checkUser();

