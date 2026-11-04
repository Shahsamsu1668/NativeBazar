const Database = require('better-sqlite3');
const pg = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', 'NativeBazar', '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
}

async function analyzeAll() {
  console.log('=== 1. SQLITE SCHEMA & STATS ===');
  const sqliteDb = new Database(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
  const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  for (const t of tables) {
    const cols = sqliteDb.prepare(`PRAGMA table_info("${t.name}")`).all();
    const count = sqliteDb.prepare(`SELECT count(*) as count FROM "${t.name}"`).get();
    const sample = sqliteDb.prepare(`SELECT * FROM "${t.name}" LIMIT 1`).get();
    console.log(`\nTable: ${t.name} (Rows: ${count.count})`);
    console.log('Columns:', cols.map(c => `${c.name} (${c.type}${c.pk ? ' PK' : ''}${c.notnull ? ' NOT NULL' : ''})`).join(', '));
    if (sample) console.log('Sample keys:', Object.keys(sample).join(', '));
  }

  console.log('\n=== 2. JSON DB SCHEMA & STATS ===');
  const jsonPath = path.resolve(__dirname, '..', 'server_data', 'db.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  for (const k of Object.keys(jsonData)) {
    if (Array.isArray(jsonData[k])) {
      console.log(`\nCollection: ${k} (Items: ${jsonData[k].length})`);
      if (jsonData[k].length > 0) {
        console.log('Sample keys:', Object.keys(jsonData[k][0]).join(', '));
        console.log('Sample item:', JSON.stringify(jsonData[k][0]).slice(0, 180) + '...');
      }
    }
  }

  console.log('\n=== 3. NEON POSTGRESQL SCHEMA & STATS ===');
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    const neonTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    for (const row of neonTables.rows) {
      const tName = row.table_name;
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tName]);
      const countRes = await client.query(`SELECT count(*)::int as count FROM "${tName}"`);
      console.log(`\nNeon Table: ${tName} (Rows: ${countRes.rows[0].count})`);
      console.log('Columns:', colRes.rows.map(c => `${c.column_name} (${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'})`).join(', '));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeAll().catch(e => console.error('Error:', e));

