const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkFarmerProducts() {
  const res = await pool.query("SELECT id, seller_id, seller_name, crop_name, unit_price, available_qty FROM products WHERE seller_id = 'user-farmer-rafiq'");
  console.table(res.rows);
  await pool.end();
}
checkFarmerProducts();

