const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkProdsAndOrders() {
  const prods = await pool.query('SELECT id, crop_name, seller_id, available_qty, harvest_status FROM products ORDER BY id');
  console.log('--- ALL NEON PRODUCTS (Count:', prods.rows.length, ') ---');
  console.table(prods.rows);

  const orders = await pool.query('SELECT id, buyer_id, seller_id, total_bdt, delivery_status FROM orders ORDER BY id');
  console.log('--- ALL NEON ORDERS (Count:', orders.rows.length, ') ---');
  console.table(orders.rows);

  await pool.end();
}

checkProdsAndOrders().catch(console.error);

