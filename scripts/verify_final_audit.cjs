const { Pool } = require('pg');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

function getHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const SQLITE_BASELINE = '789498e18bae18062dc0a74dcad47ca5436019ee634fe209f9e72b28385e19c9';
const JSON_BASELINE = '1ab54a39e6961360165e43b116b16e56b230f2c36bafc9156403d116f2cd7a7a';

async function checkFinal() {
  console.log('=== FINAL END-TO-END IMMUTABILITY & NEON INTEGRITY AUDIT ===\n');

  const curSqliteHash = getHash('nativebazar.db');
  const curJsonHash = getHash('server_data/db.json');

  console.log('1. Source Database Immutability:');
  console.log(`   SQLite Hash: ${curSqliteHash} (${curSqliteHash === SQLITE_BASELINE ? 'MATCH' : 'MISMATCH'})`);
  console.log(`   JSON Hash:   ${curJsonHash} (${curJsonHash === JSON_BASELINE ? 'MATCH' : 'MISMATCH'})`);

  const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
  if (!env.TEST_DATABASE_URL || !env.TEST_DATABASE_URL.includes('ep-snowy-mode')) {
    console.error('SAFETY STOP: Wrong endpoint! Must be ep-snowy-mode.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: env.TEST_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const branchRes = await pool.query(`SELECT current_database(), current_user, inet_server_addr()`);
  console.log('\n2. Connected Neon Database:', branchRes.rows[0]);

  const tables = [
    'users', 'products', 'orders', 'order_items', 'wholesaler_offers',
    'market_prices', 'catalog', 'messages', 'connections', 'notifications',
    'farmer_expenses', 'negotiations', 'call_logs', 'trade_audit_logs', 'login_audit_logs'
  ];

  console.log('\n3. Neon Row Counts:');
  const counts = {};
  for (const t of tables) {
    try {
      const r = await pool.query(`SELECT count(*)::int as c FROM "${t}"`);
      counts[t] = r.rows[0].c;
      console.log(`   ${t.padEnd(20)}: ${r.rows[0].c}`);
    } catch (e) {
      counts[t] = 'N/A';
      console.log(`   ${t.padEnd(20)}: N/A (${e.message})`);
    }
  }

  // Quarantined Meghna check
  const meghnaRes = await pool.query(`SELECT id, crop_name, harvest_status, seller_id FROM products WHERE id LIKE 'sup-meghna%'`);
  console.log('\n4. Quarantined Products Verification:');
  console.log(meghnaRes.rows);

  // Trigger check
  const trigRes = await pool.query(`
    SELECT trigger_name, event_manipulation, event_object_table, action_statement
    FROM information_schema.triggers
    WHERE event_object_table IN ('trade_audit_logs', 'login_audit_logs')
  `);
  console.log('\n5. Audit Protection Triggers Active:');
  console.log(trigRes.rows.map(t => `${t.trigger_name} ON ${t.event_object_table} (${t.event_manipulation})`));

  await pool.end();

  const reportData = {
    sqliteHashMatch: curSqliteHash === SQLITE_BASELINE,
    jsonHashMatch: curJsonHash === JSON_BASELINE,
    counts,
    quarantinedProducts: meghnaRes.rows,
    triggersCount: trigRes.rows.length
  };

  fs.writeFileSync('server_data/master_prompt_2_final_audit.json', JSON.stringify(reportData, null, 2), 'utf8');
  console.log('\n✓ Audit complete! Saved to server_data/master_prompt_2_final_audit.json');
}

checkFinal().catch(console.error);
