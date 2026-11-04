// scripts/validate_test_branch.cjs
// Read-only validation script for Stage D on dev-migration-test branch.
// Never prints database credentials or secrets.

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load isolated test branch connection
dotenv.config({ path: path.resolve(__dirname, '..', 'server_data', 'test_branch.env') });
const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString || !connectionString.includes('ep-snowy-mode')) {
  console.error('SAFETY STOP: No test branch TEST_DATABASE_URL or wrong endpoint.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function runValidation() {
  const client = await pool.connect();
  const results = {
    checks: [],
    allPassed: true,
  };

  function addCheck(name, passed, details) {
    results.checks.push({ name, passed, details });
    if (!passed) results.allPassed = false;
    const mark = passed ? '✓' : '✗';
    console.log(`${mark} [${name}]: ${details}`);
  }

  try {
    console.log('=== STAGE D: VALIDATION ON ISOLATED TEST BRANCH (dev-migration-test) ===\n');

    // 1. Verify Endpoint Identity
    const hostRes = await client.query('SELECT inet_server_addr(), current_database(), current_user;');
    const currentDb = hostRes.rows[0].current_database;
    addCheck('Database Identity', currentDb === 'neondb', `Connected to database: ${currentDb}`);

    // 2. Table Row Counts
    console.log('\n--- 1. Table Row Counts ---');
    const expectedCounts = {
      users: 42,
      sessions: 26,
      products: 28,
      orders: 10,
      order_items: 10,
      wholesaler_offers: 6,
      market_prices: 7,
      trade_audit_logs: 9,
      login_audit_logs: 24,
      messages: 11,
      connections: 4,
      notifications: 16,
      catalog: 80,
    };

    for (const [table, expected] of Object.entries(expectedCounts)) {
      const res = await client.query(`SELECT count(*)::int AS count FROM ${table};`);
      const actual = res.rows[0].count;
      const passed = actual === expected;
      addCheck(
        `Row count: ${table}`,
        passed,
        `Expected ${expected}, Found ${actual}`
      );
    }

    // 3. Quarantined Meghna Products Validation
    console.log('\n--- 2. Quarantined Meghna Supplier Products ---');
    const meghnaRes = await client.query(`
      SELECT id, crop_name, category, seller_id, seller_name, harvest_status, unit
      FROM products
      WHERE id IN ('sup-meghna-potash', 'sup-meghna-tricho', 'sup-meghna-seed');
    `);
    const meghnaPassed = meghnaRes.rows.length === 3 &&
      meghnaRes.rows.every(r => r.seller_id === null && r.harvest_status === 'Archived');
    addCheck(
      'Quarantined Meghna Products Check',
      meghnaPassed,
      `3 legacy products quarantined with seller_id = NULL and harvest_status = 'Archived'. Found: ${meghnaRes.rows.length}`
    );

    // 4. Unit-Aware Inventory Field Validation
    console.log('\n--- 3. Unit-Aware Inventory Fields ---');
    const unitCheck = await client.query(`
      SELECT id, crop_name, category, unit, quantity, available_qty, quantity_kg
      FROM products
      WHERE unit != 'kg' OR category IN ('seeds', 'fertilizer', 'machinery')
      LIMIT 3;
    `);
    const unitRows = unitCheck.rows;
    const unitAwarePassed = unitRows.length > 0 && unitRows.every(r => r.unit && r.quantity !== null);
    addCheck(
      'Unit-Aware Inventory Verification',
      unitAwarePassed,
      `Non-kg products preserve discrete unit packages (e.g. ${unitRows[0]?.crop_name}: unit='${unitRows[0]?.unit}', quantity=${unitRows[0]?.quantity}, quantity_kg=${unitRows[0]?.quantity_kg})`
    );

    // 5. Crops Backward Compatibility View Validation
    console.log('\n--- 4. Crops Compatibility View ---');
    const cropsRes = await client.query(`
      SELECT "farmerId", "farmerName", "cropName", "expectedPricePerKg", "status", district
      FROM crops
      LIMIT 3;
    `);
    const viewPassed = cropsRes.rows.length === 3 &&
      cropsRes.rows[0].farmerId !== undefined &&
      cropsRes.rows[0].cropName !== undefined &&
      cropsRes.rows[0].expectedPricePerKg !== undefined;
    addCheck(
      'Crops View CamelCase Aliases',
      viewPassed,
      `View query returned ${cropsRes.rows.length} rows with camelCase columns: farmerId='${cropsRes.rows[0]?.farmerId}', cropName='${cropsRes.rows[0]?.cropName}', price='${cropsRes.rows[0]?.expectedPricePerKg}'`
    );

    // 6. Orders and Order Items Integrity
    console.log('\n--- 5. Orders and Order Items Foreign Keys ---');
    const ordersRes = await client.query(`
      SELECT o.id, o.tracking_code, o.buyer_id, o.buyer_name, o.seller_id, o.seller_name, o.total_bdt,
             count(oi.id)::int as item_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id, o.tracking_code, o.buyer_id, o.buyer_name, o.seller_id, o.seller_name, o.total_bdt
      ORDER BY o.id;
    `);
    const allOrdersHaveItems = ordersRes.rows.length === 10 && ordersRes.rows.every(r => r.item_count === 1);
    addCheck(
      'Orders and Order Items Relationship',
      allOrdersHaveItems,
      `All 10 orders correctly join to their respective order_items.`
    );

    // 7. Single-Seller Order Constraint Verification
    console.log('\n--- 6. Single-Seller Order Validation (Rule Check) ---');
    // Check if any existing order spans multiple sellers
    const multiSellerCheck = await client.query(`
      SELECT oi.order_id, count(DISTINCT p.seller_id)::int as distinct_sellers
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      GROUP BY oi.order_id
      HAVING count(DISTINCT p.seller_id) > 1;
    `);
    const singleSellerCompliant = multiSellerCheck.rows.length === 0;
    addCheck(
      'Historical Orders Single-Seller Compliance',
      singleSellerCompliant,
      `All 10 orders strictly contain items from a single seller (0 multi-seller orders found).`
    );

    // 8. Rollback Verification Test
    console.log('\n--- 7. Atomic Rollback Verification Test ---');
    let rollbackSuccess = false;
    try {
      await client.query('BEGIN');
      // Insert a dummy test product
      await client.query(`
        INSERT INTO products (
          id, seller_name, seller_role, target_role, crop_name, bangla_name,
          category, unit, quantity, available_qty, unit_price, district
        ) VALUES (
          'test-rollback-prod-999', 'Rollback Seller', 'farmer', 'consumer', 'Rollback Tomato', 'রোলব্যাক টমেটো',
          'vegetables', 'kg', 10, 10, 100, 'Dhaka'
        );
      `);
      // Verify row exists inside transaction
      const insideTx = await client.query("SELECT count(*)::int as c FROM products WHERE id = 'test-rollback-prod-999'");
      if (insideTx.rows[0].c !== 1) throw new Error('Transaction insert check failed');
      // Deliberately trigger rollback
      await client.query('ROLLBACK');

      // Verify row does NOT exist after rollback
      const outsideTx = await client.query("SELECT count(*)::int as c FROM products WHERE id = 'test-rollback-prod-999'");
      rollbackSuccess = (outsideTx.rows[0].c === 0);
    } catch (e) {
      await client.query('ROLLBACK');
      rollbackSuccess = false;
    }
    addCheck(
      'Transaction Rollback Safety',
      rollbackSuccess,
      'Deliberately rolled-back transaction left no residual artifacts in products table.'
    );

    console.log('\n======================================================');
    console.log(`FINAL STAGE D RESULT: ${results.allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
    console.log('======================================================\n');

  } catch (err) {
    console.error('Validation error:', err);
    results.allPassed = false;
  } finally {
    client.release();
    await pool.end();
  }

  process.exit(results.allPassed ? 0 : 1);
}

runValidation();
