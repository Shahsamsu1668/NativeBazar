const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function inspectSchemas() {
  const tables = ['wholesaler_offers', 'market_prices', 'messages', 'connections', 'notifications'];
  const res = await pool.query(`
    SELECT table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position;
  `, [tables]);
  console.table(res.rows);
  await pool.end();
}
inspectSchemas();

