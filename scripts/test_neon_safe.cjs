const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Try loading .env.local from inner repo and root
const innerEnvLocal = path.resolve(__dirname, '..', 'NativeBazar', '.env.local');
const rootEnvLocal = path.resolve(__dirname, '..', '.env.local');

dotenv.config({ path: innerEnvLocal });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: rootEnvLocal });
}

if (!process.env.DATABASE_URL) {
  console.log('STATUS: FAILED');
  console.log('REASON: DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function checkNeon() {
  let client;
  try {
    client = await pool.connect();
    // Safe read-only test
    const pingRes = await client.query('SELECT 1 as ok, NOW() as current_time, current_database() as db_name, version() as version;');
    console.log('STATUS: SUCCESS');
    console.log('DATABASE_PING: OK');
    console.log('DATABASE_NAME:', pingRes.rows[0].db_name);
    console.log('TIMESTAMP:', pingRes.rows[0].current_time);

    // Query existing public tables
    const tablesRes = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log('PUBLIC_TABLES_COUNT:', tableNames.length);
    console.log('PUBLIC_TABLES:', JSON.stringify(tableNames));

    // For each table, get row count safely
    const tableStats = {};
    for (const t of tableNames) {
      // Safe parameterized query for table row count (table name validated against information_schema)
      const countRes = await client.query(`SELECT COUNT(*)::int as count FROM "${t}"`);
      tableStats[t] = countRes.rows[0].count;
    }
    console.log('TABLE_ROW_COUNTS:', JSON.stringify(tableStats, null, 2));

  } catch (err) {
    console.log('STATUS: FAILED');
    console.log('ERROR_MESSAGE:', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

checkNeon();

