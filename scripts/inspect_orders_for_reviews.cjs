const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function inspectOrders() {
  const res = await pool.query(`
    SELECT o.id, o.buyer_id, o.seller_id, o.delivery_status, o.total_bdt, 
           (SELECT count(*)::int FROM order_items oi WHERE oi.order_id = o.id) as item_count,
           (SELECT count(*)::int FROM reviews r WHERE r.order_id = o.id) as review_count
    FROM orders o
    ORDER BY o.created_at DESC
    LIMIT 10;
  `);
  console.log('--- RECENT ORDERS IN NEON ---');
  console.table(res.rows);

  const delivered = res.rows.filter(r => r.delivery_status === 'Delivered');
  console.log('Delivered orders count:', delivered.length);
  if (delivered.length > 0) {
    console.log('Sample delivered order:', delivered[0]);
  }

  await pool.end();
}

inspectOrders().catch(console.error);

