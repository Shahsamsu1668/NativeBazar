const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function checkTriggers() {
  const res = await pool.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
    FROM information_schema.triggers
    WHERE event_object_table IN ('trade_audit_logs', 'login_audit_logs')
  `);
  console.log('--- AUDIT TRIGGERS IN NEON ---');
  console.table(res.rows);

  const tState = await pool.query(`
    SELECT relname, tgenabled
    FROM pg_trigger tg
    JOIN pg_class c ON tg.tgrelid = c.oid
    WHERE relname IN ('trade_audit_logs', 'login_audit_logs');
  `);
  console.table(tState.rows);

  await pool.end();
}

checkTriggers().catch(console.error);

