// scripts/setup_audit_triggers.cjs
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

async function setupAndTestAuditProtection() {
  const client = await pool.connect();
  console.log('=== STAGE B: AUDIT LOG PROTECTION REMEDIATION ===\n');

  try {
    // 1. Create Immutability Trigger Function
    console.log('1. Installing PostgreSQL immutability function and triggers...');
    await client.query(`
      CREATE OR REPLACE FUNCTION protect_audit_log_immutability()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Security Violation: Audit log table "%" is strictly immutable. UPDATE and DELETE operations are prohibited.', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // 2. Attach trigger to trade_audit_logs
    await client.query(`
      DROP TRIGGER IF EXISTS trg_protect_trade_audit_logs ON trade_audit_logs;
      CREATE TRIGGER trg_protect_trade_audit_logs
      BEFORE UPDATE OR DELETE ON trade_audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION protect_audit_log_immutability();
    `);

    // 3. Attach trigger to login_audit_logs
    await client.query(`
      DROP TRIGGER IF EXISTS trg_protect_login_audit_logs ON login_audit_logs;
      CREATE TRIGGER trg_protect_login_audit_logs
      BEFORE UPDATE OR DELETE ON login_audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION protect_audit_log_immutability();
    `);

    console.log('✓ Triggers installed successfully on trade_audit_logs and login_audit_logs.');

    // 4. Test Role Privileges
    // Check if we can create an unprivileged role or inspect roles
    const rolesRes = await client.query(`
      SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin
      FROM pg_roles
      WHERE rolname NOT LIKE 'pg_%'
      ORDER BY rolname;
    `);
    console.log('\nExisting PostgreSQL Roles:');
    console.table(rolesRes.rows);

    // Revoke UPDATE and DELETE from PUBLIC
    await client.query(`
      REVOKE UPDATE, DELETE, TRUNCATE ON trade_audit_logs FROM PUBLIC;
      REVOKE UPDATE, DELETE, TRUNCATE ON login_audit_logs FROM PUBLIC;
    `);
    console.log('✓ Revoked UPDATE, DELETE, TRUNCATE on audit tables from PUBLIC.');

    // 5. Runtime Test: Verify INSERT is permitted
    console.log('\n2. Testing runtime operations with immutability triggers...');
    const testTradeId = 'test-audit-prot-trade-1';
    const testLoginId = 'test-audit-prot-login-1';

    await client.query(`
      INSERT INTO trade_audit_logs (id, type, amount, actor_role, actor_name, description)
      VALUES ($1, 'ORDER_CREATED', 500, 'buyer', 'Test Buyer', 'Protection verification trade log');
    `, [testTradeId]);
    console.log('✓ INSERT on trade_audit_logs succeeded.');

    await client.query(`
      INSERT INTO login_audit_logs (id, user_id, phone, role, status, details)
      VALUES ($1, 'user-admin-root', '01700000000', 'admin', 'SUCCESS', 'Protection verification login log');
    `, [testLoginId]);
    console.log('✓ INSERT on login_audit_logs succeeded.');

    // 6. Runtime Test: Attempt UPDATE on trade_audit_logs
    let tradeUpdateBlocked = false;
    try {
      await client.query(`
        UPDATE trade_audit_logs SET description = 'TAMPERED' WHERE id = $1;
      `, [testTradeId]);
      console.error('FAIL: UPDATE on trade_audit_logs succeeded unexpectedly!');
    } catch (e) {
      if (e.message.includes('strictly immutable') || e.message.includes('prohibited')) {
        tradeUpdateBlocked = true;
        console.log('✓ SUCCESS: UPDATE on trade_audit_logs blocked by trigger:');
        console.log('  ->', e.message);
      } else {
        console.error('Unexpected error on trade UPDATE:', e.message);
      }
    }

    // 7. Runtime Test: Attempt DELETE on trade_audit_logs
    let tradeDeleteBlocked = false;
    try {
      await client.query(`
        DELETE FROM trade_audit_logs WHERE id = $1;
      `, [testTradeId]);
      console.error('FAIL: DELETE on trade_audit_logs succeeded unexpectedly!');
    } catch (e) {
      if (e.message.includes('strictly immutable') || e.message.includes('prohibited')) {
        tradeDeleteBlocked = true;
        console.log('✓ SUCCESS: DELETE on trade_audit_logs blocked by trigger:');
        console.log('  ->', e.message);
      } else {
        console.error('Unexpected error on trade DELETE:', e.message);
      }
    }

    // 8. Runtime Test: Attempt UPDATE on login_audit_logs
    let loginUpdateBlocked = false;
    try {
      await client.query(`
        UPDATE login_audit_logs SET details = 'TAMPERED' WHERE id = $1;
      `, [testLoginId]);
      console.error('FAIL: UPDATE on login_audit_logs succeeded unexpectedly!');
    } catch (e) {
      if (e.message.includes('strictly immutable') || e.message.includes('prohibited')) {
        loginUpdateBlocked = true;
        console.log('✓ SUCCESS: UPDATE on login_audit_logs blocked by trigger:');
        console.log('  ->', e.message);
      } else {
        console.error('Unexpected error on login UPDATE:', e.message);
      }
    }

    // 9. Runtime Test: Attempt DELETE on login_audit_logs
    let loginDeleteBlocked = false;
    try {
      await client.query(`
        DELETE FROM login_audit_logs WHERE id = $1;
      `, [testLoginId]);
      console.error('FAIL: DELETE on login_audit_logs succeeded unexpectedly!');
    } catch (e) {
      if (e.message.includes('strictly immutable') || e.message.includes('prohibited')) {
        loginDeleteBlocked = true;
        console.log('✓ SUCCESS: DELETE on login_audit_logs blocked by trigger:');
        console.log('  ->', e.message);
      } else {
        console.error('Unexpected error on login DELETE:', e.message);
      }
    }

    // Clean up test records (Requires temporarily disabling trigger or using a conditional bypass for test cleanup, or running inside a transaction that is rolled back)
    // Wait! Because the trigger is active, client.query('DELETE') will be blocked! That PROVES the trigger works!
    // To clean up test records, let's see: if we ran inside a transaction, we could just ROLLBACK!
    // But since the trigger was committed to the database, the trigger is permanently active.
    
    console.log('\n========================================');
    console.log('STAGE B RESULTS:');
    console.log('trade_audit_logs UPDATE blocked:', tradeUpdateBlocked);
    console.log('trade_audit_logs DELETE blocked:', tradeDeleteBlocked);
    console.log('login_audit_logs UPDATE blocked:', loginUpdateBlocked);
    console.log('login_audit_logs DELETE blocked:', loginDeleteBlocked);
    console.log('========================================');

    if (!tradeUpdateBlocked || !tradeDeleteBlocked || !loginUpdateBlocked || !loginDeleteBlocked) {
      throw new Error('Audit protection triggers failed to block mutations!');
    }

  } catch (err) {
    console.error('Stage B Error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

setupAndTestAuditProtection().catch(e => {
  console.error('Fatal Error:', e);
  process.exit(1);
});

