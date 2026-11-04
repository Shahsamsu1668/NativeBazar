const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkCategories() {
  const res = await pool.query("SELECT DISTINCT category, category_label_en, count(*)::int as count FROM catalog GROUP BY category, category_label_en");
  console.table(res.rows);
  await pool.end();
}
checkCategories();

