// scripts/test_audit_protection.cjs
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../server_data/test_branch.env')));
const testUrl = env.TEST_DATABASE_URL;

if (!testUrl || !testUrl.includes('ep-snowy-mode')) {
  console.error('SAFETY STOP: Wrong endpoint!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: testUrl,
  ssl: { rejectUnauthorized: false }
});

async function runAuditProtectionTests() {
  const client = await pool.connect();
  console.log('\n========================================');
  console.log('TEST 5: AUDIT PROTECTION & IMMUTABILITY');
  console.log('========================================');

  const results = {};

  try {
    // 1. Current user and role privileges
    const userRes = await client.query('SELECT current_user, session_user;');
    const currentUser = userRes.rows[0].current_user;
    console.log(`Connecting PostgreSQL User: ${currentUser}`);

    const privRes = await client.query(`
      SELECT grantee, table_name, privilege_type
      FROM information_schema.table_privileges
      WHERE table_name IN ('trade_audit_logs', 'login_audit_logs') AND grantee = $1
      ORDER BY table_name, privilege_type;
    `, [currentUser]);
    console.log('Table Privileges for current user:');
    console.table(privRes.rows);

    // 2. Check Triggers or Rules on trade_audit_logs and login_audit_logs
    const triggerRes = await client.query(`
      SELECT event_object_table, trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table IN ('trade_audit_logs', 'login_audit_logs');
    `);
    console.log('Database Triggers on audit tables:');
    console.table(triggerRes.rows);

    const ruleRes = await client.query(`
      SELECT tablename, rulename, definition
      FROM pg_rules
      WHERE tablename IN ('trade_audit_logs', 'login_audit_logs');
    `);
    console.log('Database Rules on audit tables:');
    console.table(ruleRes.rows);

    const colRes = await client.query(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name IN ('trade_audit_logs', 'login_audit_logs')
      ORDER BY table_name, ordinal_position;
    `);
    console.log('Columns in audit tables:');
    console.table(colRes.rows);

    // 3. Runtime test inside a transaction: Can the connecting user UPDATE or DELETE?
    await client.query('BEGIN');

    // Test INSERT on trade_audit_logs
    const testAuditId = 'test-trade-audit-temp-1';
    await client.query(`
      INSERT INTO trade_audit_logs (id, type, amount, actor_role, actor_name, description)
      VALUES ($1, 'ORDER_CREATED', 100, 'buyer', 'Test Buyer', 'Append-only test');
    `, [testAuditId]);
    console.log('✓ Successfully inserted disposable trade_audit_logs entry.');

    // Test UPDATE
    let updateBlocked = false;
    await client.query('SAVEPOINT sp_update');
    try {
      await client.query(`
        UPDATE trade_audit_logs SET description = 'TAMPERED DESCRIPTION' WHERE id = $1;
      `, [testAuditId]);
      console.log('WARNING: UPDATE SUCCEEDED! Table is NOT database-level append-only for current role!');
      updateBlocked = false;
    } catch (e) {
      console.log('✓ UPDATE blocked by database:', e.message);
      updateBlocked = true;
      await client.query('ROLLBACK TO SAVEPOINT sp_update');
    }

    // Test DELETE
    let deleteBlocked = false;
    await client.query('SAVEPOINT sp_delete');
    try {
      await client.query(`
        DELETE FROM trade_audit_logs WHERE id = $1;
      `, [testAuditId]);
      console.log('WARNING: DELETE SUCCEEDED! Table is NOT database-level append-only for current role!');
      deleteBlocked = false;
    } catch (e) {
      console.log('✓ DELETE blocked by database:', e.message);
      deleteBlocked = true;
      await client.query('ROLLBACK TO SAVEPOINT sp_delete');
    }

    // Rollback disposable test
    await client.query('ROLLBACK');
    console.log('✓ Rolled back transaction (0 residual records).');

    results.currentUser = currentUser;
    results.updateBlocked = updateBlocked;
    results.deleteBlocked = deleteBlocked;
    results.hasTriggers = triggerRes.rows.length > 0;
    results.hasRules = ruleRes.rows.length > 0;

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Audit test error:', err);
  } finally {
    client.release();
    await pool.end();
  }

  return results;
}

runAuditProtectionTests().then(console.log).catch(console.error);
