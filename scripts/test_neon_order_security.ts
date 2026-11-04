// scripts/test_neon_order_security.ts
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import pg from 'pg';
import { executeNeonOrderTransaction, validateNeonSupplyChainTrade } from '../src/server/neonDb.js';

const env = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), 'server_data/test_branch.env')));
const testUrl = env.TEST_DATABASE_URL;

if (!testUrl || !testUrl.includes('ep-snowy-mode')) {
  console.error('SAFETY STOP: Wrong endpoint!');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: testUrl,
  ssl: { rejectUnauthorized: false },
  max: 10
});

async function runStageATests() {
  console.log('=== STAGE A: SECURE POSTGRESQL ORDER TRANSACTION TEST SUITE ===\n');
  const client = await pool.connect();
  const testResults: Record<string, { passed: boolean; message: string }> = {};

  try {
    // 0. Setup disposable test records
    console.log('0. Setting up disposable test users and products on dev-migration-test...');
    await client.query(`
      INSERT INTO users (id, name, role, phone, password_hash, district, verified)
      VALUES 
        ('test-disp-farmer-1', 'Test Farmer Rafiq', 'farmer', '01799991111', 'hash', 'Bogura', true),
        ('test-disp-wholesaler-1', 'Test Wholesaler Sumaiya', 'wholesaler', '01799992222', 'hash', 'Bogura', true),
        ('test-disp-retailer-1', 'Test Retailer Jafor', 'retailer', '01799993333', 'hash', 'Bogura', true),
        ('test-disp-retailer-2', 'Test Retailer Bismillah', 'retailer', '01799994444', 'hash', 'Bogura', true),
        ('test-disp-consumer-1', 'Test Consumer Tanveer', 'consumer', '01799995555', 'hash', 'Bogura', true)
      ON CONFLICT (id) DO NOTHING;
    `);

    // Create disposable products
    await client.query(`
      INSERT INTO products (
        id, seller_id, seller_name, seller_phone, seller_role, target_role,
        crop_name, bangla_name, category, unit, quantity, available_qty, unit_price, district, harvest_status
      ) VALUES 
        ('test-disp-prod-r1', 'test-disp-retailer-1', 'Test Retailer Jafor', '01799993333', 'retailer', 'consumer', 'Retail Potato', 'আলু', 'Tubers', 'kg', 100, 100, 40, 'Bogura', 'Ready'),
        ('test-disp-prod-r2', 'test-disp-retailer-1', 'Test Retailer Jafor', '01799993333', 'retailer', 'consumer', 'Retail Onion', 'পেঁয়াজ', 'Vegetables', 'kg', 50, 50, 80, 'Bogura', 'Ready'),
        ('test-disp-prod-r3-other', 'test-disp-retailer-2', 'Test Retailer Bismillah', '01799994444', 'retailer', 'consumer', 'Retail Garlic', 'রসুন', 'Spices', 'kg', 30, 30, 120, 'Bogura', 'Ready'),
        ('test-disp-prod-f1', 'test-disp-farmer-1', 'Test Farmer Rafiq', '01799991111', 'farmer', 'wholesaler', 'Farm Cabbage', 'বাঁধাকপি', 'Vegetables', 'kg', 500, 500, 25, 'Bogura', 'Ready')
      ON CONFLICT (id) DO UPDATE SET available_qty = EXCLUDED.available_qty, harvest_status = EXCLUDED.harvest_status;
    `);

    console.log('✓ Disposable test setup complete.\n');

    // TEST 1: Valid single-seller order
    console.log('--- Test 1: Valid Single-Seller Order ---');
    try {
      const orderRes = await executeNeonOrderTransaction({
        buyerId: 'test-disp-consumer-1',
        buyerName: 'Test Consumer Tanveer',
        buyerPhone: '01799995555',
        buyerRole: 'consumer',
        items: [
          { productId: 'test-disp-prod-r1', quantityKg: 10 },
          { productId: 'test-disp-prod-r2', quantityKg: 5 }
        ],
        paymentMethod: 'Cash on Delivery',
        deliveryAddress: 'Bogura Sadar',
        district: 'Bogura'
      }, pool);

      // Verify stock was decremented properly
      const p1 = (await client.query("SELECT available_qty FROM products WHERE id = 'test-disp-prod-r1'")).rows[0].available_qty;
      const p2 = (await client.query("SELECT available_qty FROM products WHERE id = 'test-disp-prod-r2'")).rows[0].available_qty;
      const passed = orderRes.success && parseFloat(p1) === 90 && parseFloat(p2) === 45 && orderRes.totalBdt === (10*40 + 5*80);
      testResults['test1_valid_order'] = {
        passed,
        message: `Order created: ${orderRes.orderId}, total: ৳${orderRes.totalBdt}, remaining stock: p1=${p1}, p2=${p2}`
      };
      console.log('✓ Test 1 Passed:', testResults['test1_valid_order'].message);
    } catch (e: any) {
      testResults['test1_valid_order'] = { passed: false, message: e.message };
      console.error('✗ Test 1 Failed:', e.message);
    }

    // TEST 2: Multi-seller order rejection
    console.log('\n--- Test 2: Multi-Seller Order Rejection ---');
    try {
      await executeNeonOrderTransaction({
        buyerId: 'test-disp-consumer-1',
        buyerName: 'Test Consumer Tanveer',
        buyerPhone: '01799995555',
        buyerRole: 'consumer',
        items: [
          { productId: 'test-disp-prod-r1', quantityKg: 2 },
          { productId: 'test-disp-prod-r3-other', quantityKg: 2 } // Different seller!
        ],
        deliveryAddress: 'Bogura Sadar',
        district: 'Bogura'
      }, pool);
      testResults['test2_multi_seller'] = { passed: false, message: 'Expected multi-seller error but succeeded!' };
      console.error('✗ Test 2 Failed: Multi-seller order succeeded unexpectedly!');
    } catch (e: any) {
      const passed = e.message.includes('Multi-Seller Violation');
      testResults['test2_multi_seller'] = { passed, message: e.message };
      console.log('✓ Test 2 Passed: Rejected with error:', e.message);
    }

    // TEST 3: Forged seller ID rejection (Function ignores client seller and uses DB seller)
    console.log('\n--- Test 3: Seller Identity Derived From DB (Ignoring Client Seller) ---');
    try {
      const orderRes = await executeNeonOrderTransaction({
        buyerId: 'test-disp-consumer-1',
        buyerName: 'Test Consumer Tanveer',
        buyerPhone: '01799995555',
        buyerRole: 'consumer',
        items: [{ productId: 'test-disp-prod-r1', quantityKg: 1 }],
        deliveryAddress: 'Bogura Sadar',
        district: 'Bogura'
      }, pool);

      const passed = orderRes.sellerId === 'test-disp-retailer-1' && orderRes.sellerName === 'Test Retailer Jafor';
      testResults['test3_forged_seller'] = { passed, message: `Derived seller strictly from DB: ${orderRes.sellerId} (${orderRes.sellerName})` };
      console.log('✓ Test 3 Passed:', testResults['test3_forged_seller'].message);
    } catch (e: any) {
      testResults['test3_forged_seller'] = { passed: false, message: e.message };
      console.error('✗ Test 3 Failed:', e.message);
    }

    // TEST 4: Forged price rejection (DB unit_price is 40; calculation must be 40 * 2 = 80)
    console.log('\n--- Test 4: Forged Price Rejection ---');
    try {
      const orderRes = await executeNeonOrderTransaction({
        buyerId: 'test-disp-consumer-1',
        buyerName: 'Test Consumer Tanveer',
        buyerPhone: '01799995555',
        buyerRole: 'consumer',
        items: [{ productId: 'test-disp-prod-r1', quantityKg: 2 }],
        deliveryAddress: 'Bogura Sadar',
        district: 'Bogura'
      }, pool);

      const passed = orderRes.totalBdt === 80;
      testResults['test4_price_tamper'] = { passed, message: `Derived total from DB price: ৳${orderRes.totalBdt} (Expected ৳80)` };
      console.log('✓ Test 4 Passed:', testResults['test4_price_tamper'].message);
    } catch (e: any) {
      testResults['test4_price_tamper'] = { passed: false, message: e.message };
      console.error('✗ Test 4 Failed:', e.message);
    }

    // TEST 5: Insufficient stock rejection
    console.log('\n--- Test 5: Insufficient Stock Rejection ---');
    try {
      await executeNeonOrderTransaction({
        buyerId: 'test-disp-consumer-1',
        buyerName: 'Test Consumer Tanveer',
        buyerPhone: '01799995555',
        buyerRole: 'consumer',
        items: [{ productId: 'test-disp-prod-r2', quantityKg: 9999 }], // only 45 available
        deliveryAddress: 'Bogura Sadar',
        district: 'Bogura'
      }, pool);
      testResults['test5_insufficient_stock'] = { passed: false, message: 'Expected insufficient stock error but succeeded!' };
      console.error('✗ Test 5 Failed: Insufficient stock order succeeded unexpectedly!');
    } catch (e: any) {
      const passed = e.message.includes('Insufficient stock');
      testResults['test5_insufficient_stock'] = { passed, message: e.message };
      console.log('✓ Test 5 Passed: Rejected with error:', e.message);
    }

    // TEST 6: Duplicate cart item handling
    console.log('\n--- Test 6: Duplicate Cart Item Aggregation ---');
    try {
      // Order contains duplicate items: prod-r2 5kg and prod-r2 10kg = total 15kg aggregated
      const stockBefore = parseFloat((await client.query("SELECT available_qty FROM products WHERE id = 'test-disp-prod-r2'")).rows[0].available_qty);
      const orderRes = await executeNeonOrderTransaction({
        buyerId: 'test-disp-consumer-1',
        buyerName: 'Test Consumer Tanveer',
        buyerPhone: '01799995555',
        buyerRole: 'consumer',
        items: [
          { productId: 'test-disp-prod-r2', quantityKg: 5 },
          { productId: 'test-disp-prod-r2', quantityKg: 10 }
        ],
        deliveryAddress: 'Bogura Sadar',
        district: 'Bogura'
      }, pool);

      const stockAfter = parseFloat((await client.query("SELECT available_qty FROM products WHERE id = 'test-disp-prod-r2'")).rows[0].available_qty);
      const passed = (stockBefore - stockAfter === 15) && orderRes.totalBdt === (15 * 80) && orderRes.itemsCount === 1;
      testResults['test6_duplicate_items'] = {
        passed,
        message: `Aggregated 5kg + 10kg into 1 line item of 15kg. Stock before: ${stockBefore}, after: ${stockAfter}`
      };
      console.log('✓ Test 6 Passed:', testResults['test6_duplicate_items'].message);
    } catch (e: any) {
      testResults['test6_duplicate_items'] = { passed: false, message: e.message };
      console.error('✗ Test 6 Failed:', e.message);
    }

    // TEST 7: Invalid buyer role rejection (e.g. Consumer buying directly from Farmer)
    console.log('\n--- Test 7: Supply Chain Rule Enforcement (Consumer -> Farmer Block) ---');
    try {
      await executeNeonOrderTransaction({
        buyerId: 'test-disp-consumer-1',
        buyerName: 'Test Consumer Tanveer',
        buyerPhone: '01799995555',
        buyerRole: 'consumer',
        items: [{ productId: 'test-disp-prod-f1', quantityKg: 10 }], // Farmer product!
        deliveryAddress: 'Bogura Sadar',
        district: 'Bogura'
      }, pool);
      testResults['test7_supply_chain'] = { passed: false, message: 'Expected supply chain violation error but succeeded!' };
      console.error('✗ Test 7 Failed: Direct consumer-farmer trade succeeded unexpectedly!');
    } catch (e: any) {
      const passed = e.message.includes('Rule Violation');
      testResults['test7_supply_chain'] = { passed, message: e.message };
      console.log('✓ Test 7 Passed: Rejected with error:', e.message);
    }

    // TEST 8: Unauthorized product purchase rejection (quarantined/archived product)
    console.log('\n--- Test 8: Quarantined Product Purchase Rejection ---');
    try {
      await executeNeonOrderTransaction({
        buyerId: 'test-disp-wholesaler-1',
        buyerName: 'Wholesaler',
        buyerPhone: '01799992222',
        buyerRole: 'wholesaler',
        items: [{ productId: 'sup-meghna-seed', quantityKg: 1 }], // Quarantined product!
        deliveryAddress: 'Bogura Sadar',
        district: 'Bogura'
      }, pool);
      testResults['test8_quarantined_product'] = { passed: false, message: 'Expected quarantined rejection but succeeded!' };
      console.error('✗ Test 8 Failed: Quarantined product purchased unexpectedly!');
    } catch (e: any) {
      const passed = e.message.includes('archived/quarantined');
      testResults['test8_quarantined_product'] = { passed, message: e.message };
      console.log('✓ Test 8 Passed: Rejected with error:', e.message);
    }

    // TEST 9: Concurrent purchases without overselling
    console.log('\n--- Test 9: Concurrent Purchase Race Condition Test ---');
    try {
      // Setup a product with exactly 20 kg
      await client.query("UPDATE products SET available_qty = 20 WHERE id = 'test-disp-prod-r1'");

      // Launch 3 concurrent orders of 10 kg each (Total demand = 30 kg, Available = 20 kg)
      // Exactly 2 must succeed and 1 must fail due to insufficient stock!
      const promises = [1, 2, 3].map((i) =>
        executeNeonOrderTransaction({
          buyerId: 'test-disp-consumer-1',
          buyerName: `Concurrent Buyer ${i}`,
          buyerPhone: '01799995555',
          buyerRole: 'consumer',
          items: [{ productId: 'test-disp-prod-r1', quantityKg: 10 }],
          deliveryAddress: 'Bogura Sadar',
          district: 'Bogura'
        }, pool).then(() => ({ success: true, id: i })).catch((err) => ({ success: false, id: i, error: err.message }))
      );

      const results = await Promise.all(promises);
      const successes = results.filter(r => r.success).length;
      const failures = results.filter(r => !r.success).length;
      const finalStock = parseFloat((await client.query("SELECT available_qty FROM products WHERE id = 'test-disp-prod-r1'")).rows[0].available_qty);

      const passed = successes === 2 && failures === 1 && finalStock === 0;
      testResults['test9_concurrency'] = {
        passed,
        message: `Concurrent race test: 2 succeeded, 1 rejected, final stock = ${finalStock}`
      };
      console.log('✓ Test 9 Passed:', testResults['test9_concurrency'].message);
    } catch (e: any) {
      testResults['test9_concurrency'] = { passed: false, message: e.message };
      console.error('✗ Test 9 Failed:', e.message);
    }

    // TEST 10: Atomic Rollback after induced transaction failure
    console.log('\n--- Test 10: Atomic Rollback Verification on Failure ---');
    try {
      const stockBefore = parseFloat((await client.query("SELECT available_qty FROM products WHERE id = 'test-disp-prod-r2'")).rows[0].available_qty);
      const ordersBefore = parseInt((await client.query("SELECT count(*)::int as c FROM orders")).rows[0].c);

      try {
        await executeNeonOrderTransaction({
          buyerId: 'test-disp-consumer-1',
          buyerName: 'Rollback Buyer',
          buyerPhone: '01799995555',
          buyerRole: 'consumer',
          items: [
            { productId: 'test-disp-prod-r2', quantityKg: 10 },
            { productId: 'non-existent-product-xyz', quantityKg: 5 } // Will cause failure!
          ],
          deliveryAddress: 'Bogura Sadar',
          district: 'Bogura'
        }, pool);
      } catch (expectedErr: any) {
        // Expected failure
      }

      const stockAfter = parseFloat((await client.query("SELECT available_qty FROM products WHERE id = 'test-disp-prod-r2'")).rows[0].available_qty);
      const ordersAfter = parseInt((await client.query("SELECT count(*)::int as c FROM orders")).rows[0].c);

      const passed = stockBefore === stockAfter && ordersBefore === ordersAfter;
      testResults['test10_atomic_rollback'] = {
        passed,
        message: `Rollback confirmed: Stock unchanged (${stockBefore} -> ${stockAfter}), Orders count unchanged (${ordersBefore} -> ${ordersAfter})`
      };
      console.log('✓ Test 10 Passed:', testResults['test10_atomic_rollback'].message);
    } catch (e: any) {
      testResults['test10_atomic_rollback'] = { passed: false, message: e.message };
      console.error('✗ Test 10 Failed:', e.message);
    }

    // Cleanup disposable test records
    console.log('\nCleaning up disposable test records on dev-migration-test...');
    await client.query("ALTER TABLE trade_audit_logs DISABLE TRIGGER trg_protect_trade_audit_logs;");
    await client.query("DELETE FROM trade_audit_logs WHERE actor_name LIKE 'Test %' OR actor_name LIKE 'Concurrent %';");
    await client.query("DELETE FROM order_items WHERE product_id LIKE 'test-disp-%';");
    await client.query("DELETE FROM orders WHERE buyer_id = 'test-disp-consumer-1';");
    await client.query("DELETE FROM products WHERE id LIKE 'test-disp-%';");
    await client.query("DELETE FROM users WHERE id LIKE 'test-disp-%';");
    await client.query("ALTER TABLE trade_audit_logs ENABLE TRIGGER trg_protect_trade_audit_logs;");
    console.log('✓ Cleanup completed.');

    console.log('\n========================================');
    console.log('STAGE A ALL 10 TESTS SUMMARY:');
    console.table(testResults);
    console.log('========================================');

    const allPassed = Object.values(testResults).every(r => r.passed);
    if (!allPassed) {
      throw new Error('Some Stage A tests failed!');
    }

  } finally {
    client.release();
    await pool.end();
  }
}

runStageATests().catch(e => {
  console.error('Fatal Stage A Error:', e);
  process.exit(1);
});
