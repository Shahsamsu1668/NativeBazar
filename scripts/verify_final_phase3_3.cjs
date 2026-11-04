const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function verifyFinal() {
  console.log('=== FINAL PHASE 3.3 DATABASE & INTEGRITY AUDIT ===');
  const counts = {};
  for (const t of ['catalog', 'reviews', 'call_logs', 'farmer_expenses', 'negotiations']) {
    const res = await pool.query(`SELECT count(*)::int as c FROM "${t}"`);
    counts[t] = res.rows[0].c;
  }
  console.log('Neon dev-migration-test final row counts:');
  console.table(counts);

  const sqliteHash = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
  const jsonHash = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');

  const baselineSqlite = '789498e18bae18062dc0a74dcad47ca5436019ee634fe209f9e72b28385e19c9';
  const baselineJson = '1ab54a39e6961360165e43b116b16e56b230f2c36bafc9156403d116f2cd7a7a';

  console.log('\nIntegrity Check:');
  console.log('SQLite SHA-256 matches baseline:', sqliteHash === baselineSqlite, `(${sqliteHash})`);
  console.log('JSON DB SHA-256 matches baseline:', jsonHash === baselineJson, `(${jsonHash})`);

  const ok = counts.catalog === 80 &&
             counts.reviews === 0 &&
             counts.call_logs === 0 &&
             counts.farmer_expenses === 0 &&
             counts.negotiations === 0 &&
             sqliteHash === baselineSqlite &&
             jsonHash === baselineJson;

  console.log('\nFINAL AUDIT VERDICT:', ok ? 'ALL CHECKS PASSED' : 'CHECK FAILED');
  await pool.end();
}

verifyFinal().catch(console.error);

