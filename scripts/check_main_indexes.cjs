const pg = require('pg');
const dotenv = require('dotenv');

const envPath = process.argv[2] || '.env.local';
dotenv.config({ path: envPath });

async function checkIndexes() {
  const conn = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname;
    `);
    console.log(`Indexes in ${envPath} (${res.rows.length}):`);
    res.rows.forEach(r => console.log(' ', r.tablename, '->', r.indexname));
  } finally {
    client.release();
    await pool.end();
  }
}
checkIndexes().catch(console.error);

