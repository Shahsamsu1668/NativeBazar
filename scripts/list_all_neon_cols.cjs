const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  const r = await pool.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  const tables = {};
  for (const row of r.rows) {
    if (!tables[row.table_name]) tables[row.table_name] = [];
    tables[row.table_name].push(row.column_name);
  }
  for (const [t, cols] of Object.entries(tables)) {
    console.log(`${t}:`, cols);
  }
  await pool.end();
}
check().catch(console.error);

