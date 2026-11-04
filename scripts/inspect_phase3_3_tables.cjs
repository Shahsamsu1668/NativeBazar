const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function inspectNeonTables() {
  const allTablesRes = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  console.log('--- ALL PUBLIC TABLES IN NEON DEV-MIGRATION-TEST ---');
  const tableNames = allTablesRes.rows.map(r => r.table_name);
  console.log(tableNames);

  const targetKeywords = ['review', 'catalog', 'call', 'expense', 'negotiat'];
  const matchedTables = tableNames.filter(t => targetKeywords.some(k => t.toLowerCase().includes(k)));

  console.log('\n--- MATCHED TARGET TABLES ---', matchedTables);

  for (const t of matchedTables) {
    const countRes = await pool.query(`SELECT count(*)::int as c FROM "${t}"`);
    console.log(`\nTable: ${t} (Count: ${countRes.rows[0].c})`);
    const colsRes = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position;
    `, [t]);
    console.table(colsRes.rows);
  }

  await pool.end();
}

inspectNeonTables().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});

