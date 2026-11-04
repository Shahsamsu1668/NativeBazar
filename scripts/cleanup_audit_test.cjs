const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function cleanup() {
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE trade_audit_logs DISABLE TRIGGER trg_protect_trade_audit_logs;');
    await client.query("DELETE FROM trade_audit_logs WHERE id LIKE 'test-audit-prot%'");
    await client.query('ALTER TABLE trade_audit_logs ENABLE TRIGGER trg_protect_trade_audit_logs;');

    await client.query('ALTER TABLE login_audit_logs DISABLE TRIGGER trg_protect_login_audit_logs;');
    await client.query("DELETE FROM login_audit_logs WHERE id LIKE 'test-audit-prot%'");
    await client.query('ALTER TABLE login_audit_logs ENABLE TRIGGER trg_protect_login_audit_logs;');

    const tCount = (await client.query('SELECT count(*)::int as c FROM trade_audit_logs')).rows[0].c;
    const lCount = (await client.query('SELECT count(*)::int as c FROM login_audit_logs')).rows[0].c;
    console.log('Cleaned up disposable rows. Current counts -> trade_audit_logs:', tCount, 'login_audit_logs:', lCount);
  } finally {
    client.release();
    await pool.end();
  }
}
cleanup();

