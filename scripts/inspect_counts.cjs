const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const tables = ['wholesaler_offers', 'market_prices', 'messages', 'connections', 'notifications', 'products', 'orders', 'users'];
  for (const t of tables) {
    const res = await pool.query('SELECT COUNT(*) FROM ' + t);
    console.log(`${t}: ${res.rows[0].count}`);
  }
  await pool.end();
}
check();

