const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const r = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('orders', 'order_items') 
    ORDER BY table_name, ordinal_position
  `);
  console.log('NEON COLUMNS:');
  for (const row of r.rows) {
    console.log(`${row.table_name}.${row.column_name} (${row.data_type})`);
  }
  await pool.end();
}
check().catch(console.error);

