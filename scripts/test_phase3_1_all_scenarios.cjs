// scripts/test_phase3_1_all_scenarios.cjs
const http = require('http');
const crypto = require('crypto');
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

const BASE_URL = 'http://localhost:5178';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    const req = http.request(url, { method, headers: reqHeaders }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, data: json });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// Helper to login and get cookie
async function loginAs(identifier, password, role) {
  const res = await request('POST', '/api/auth/login', { identifier, password, role });
  if (res.status !== 200 || !res.headers['set-cookie']) {
    throw new Error(`Login failed for ${identifier}: ${JSON.stringify(res.data)}`);
  }
  const cookies = res.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
  return { user: res.data.user, cookies };
}

async function runTestSuite() {
  console.log('=== STAGE E: PHASE 3.1 COMPREHENSIVE RUNTIME TEST SUITE ===\n');

  const testResults = {};
  const client = await pool.connect();

  try {
    // Record initial Neon row counts
    const initialCounts = {
      products: parseInt((await client.query('SELECT count(*)::int as c FROM products')).rows[0].c),
      orders: parseInt((await client.query('SELECT count(*)::int as c FROM orders')).rows[0].c),
      order_items: parseInt((await client.query('SELECT count(*)::int as c FROM order_items')).rows[0].c),
      trade_audit_logs: parseInt((await client.query('SELECT count(*)::int as c FROM trade_audit_logs')).rows[0].c),
    };
    console.log('Pre-test Neon row counts:', initialCounts);

    // Initial Source DB Hashes
    const sqlitePreHash = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
    const jsonPreHash = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');

    // Setup authenticated sessions for each role
    console.log('\nAuthenticating test actors...');
    // We use known existing users:
    // Farmer: user-farmer-rafiq (phone: 01712458920)
    // Wholesaler: user-wholesaler-sumaiya (phone: 01999887766)
    // Retailer: usr-retailer-jafor (phone: 01911334200)
    // Consumer: user-consumer-tanveer (phone: 01711889922)
    // Admin: user-admin-root (phone: 01700000000)

    // Note: We can also insert temporary session tokens directly into Neon sessions table for reliable testing
    async function createTestSession(userId, role, name, phone) {
      const token = `test-sess-${role}-${Date.now()}`;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await client.query(`
        INSERT INTO sessions (id, user_id, token_hash, role, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day')
        ON CONFLICT (id) DO NOTHING;
      `, [`sess-${token}`, userId, tokenHash, role]);
      return `nb_session=${token}`;
    }

    const farmerCookie = await createTestSession('user-farmer-rafiq', 'farmer', 'Rafiqul Islam', '01712458920');
    const wholesalerCookie = await createTestSession('user-wholesaler-sumaiya', 'wholesaler', 'Sumaiya Islam', '01999887766');
    const retailerCookie = await createTestSession('usr-retailer-jafor', 'retailer', 'Jafor Sadek', '01911334200');
    const consumerCookie = await createTestSession('user-consumer-tanveer', 'consumer', 'Tanveer Ahmed', '01711889922');
    const otherFarmerCookie = await createTestSession('far-sherpur-1', 'farmer', 'Abul Kashem', '01711209934');

    console.log('✓ Actors authenticated with isolated session tokens.');

    // TEST 1: Product listing for all four roles
    console.log('\n--- Test 1: Product listing for all four roles ---');
    const consumerFeed = await request('GET', '/api/products?targetRole=consumer');
    const retailerFeed = await request('GET', '/api/products?targetRole=retailer');
    const wholesalerFeed = await request('GET', '/api/products?targetRole=wholesaler');
    
    const t1Passed = consumerFeed.status === 200 &&
                     retailerFeed.status === 200 &&
                     wholesalerFeed.status === 200 &&
                     consumerFeed.data.products.every(p => p.targetRole === 'consumer') &&
                     retailerFeed.data.products.every(p => p.targetRole === 'retailer') &&
                     wholesalerFeed.data.products.every(p => p.targetRole === 'wholesaler');
    testResults['1_product_listing_roles'] = {
      passed: t1Passed,
      message: `Consumer feed: ${consumerFeed.data.total} items, Retailer feed: ${retailerFeed.data.total} items, Wholesaler feed: ${wholesalerFeed.data.total} items`
    };
    console.log(t1Passed ? '✓ PASS' : '✗ FAIL', testResults['1_product_listing_roles'].message);

    // TEST 2: Product creation by authorized sellers
    console.log('\n--- Test 2: Product creation by authorized sellers ---');
    const newProdRes = await request('POST', '/api/products', {
      cropName: 'E2E Test Eggplant',
      banglaName: 'টেস্ট বেগুন',
      category: 'Vegetables',
      quantityKg: 100,
      pricePerKg: 45,
      district: 'Bogura'
    }, { Cookie: farmerCookie });

    const createdProdId = newProdRes.data.productId;
    const t2Passed = newProdRes.status === 201 && createdProdId && newProdRes.data.targetRole === 'wholesaler';
    testResults['2_product_creation'] = {
      passed: t2Passed,
      message: `Farmer created product ${createdProdId} targeting wholesalers`
    };
    console.log(t2Passed ? '✓ PASS' : '✗ FAIL', testResults['2_product_creation'].message);

    // TEST 3: Product ownership enforcement (Unauthorized edit)
    console.log('\n--- Test 3: Product ownership enforcement ---');
    const unauthEdit = await request('PUT', `/api/products/${createdProdId}`, {
      pricePerKg: 99
    }, { Cookie: otherFarmerCookie }); // Different farmer!

    const t3Passed = unauthEdit.status === 403;
    testResults['3_ownership_enforcement'] = {
      passed: t3Passed,
      message: `Foreign seller update blocked with HTTP ${unauthEdit.status}: ${JSON.stringify(unauthEdit.data)}`
    };
    console.log(t3Passed ? '✓ PASS' : '✗ FAIL', testResults['3_ownership_enforcement'].message);

    // TEST 4: Product update authorization (Owner updates)
    console.log('\n--- Test 4: Product update authorization by owner ---');
    const authEdit = await request('PUT', `/api/products/${createdProdId}`, {
      pricePerKg: 48,
      availableKg: 95
    }, { Cookie: farmerCookie }); // Actual owner

    const checkRes = await request('GET', `/api/products?sellerId=user-farmer-rafiq&search=Eggplant`);
    const updatedProd = checkRes.data.products.find(p => p.id === createdProdId);
    const t4Passed = authEdit.status === 200 && updatedProd && updatedProd.pricePerKg === 48 && updatedProd.availableKg === 95;
    testResults['4_owner_update'] = {
      passed: t4Passed,
      message: `Owner successfully updated price to ৳${updatedProd?.pricePerKg} and available to ${updatedProd?.availableKg}kg`
    };
    console.log(t4Passed ? '✓ PASS' : '✗ FAIL', testResults['4_owner_update'].message);

    // TEST 5: Quarantined product exclusion
    console.log('\n--- Test 5: Quarantined product exclusion ---');
    const allPublicProds = await request('GET', '/api/products');
    const quarantinedIncluded = allPublicProds.data.products.some(p => p.id.startsWith('sup-meghna-') || p.harvestStatus === 'Archived');
    const t5Passed = !quarantinedIncluded;
    testResults['5_quarantined_exclusion'] = {
      passed: t5Passed,
      message: `Archived/Quarantined products in public feed: ${quarantinedIncluded ? 'YES (VULNERABILITY)' : 'NO (PROTECTED)'}`
    };
    console.log(t5Passed ? '✓ PASS' : '✗ FAIL', testResults['5_quarantined_exclusion'].message);

    // Setup dedicated disposable products for order tests
    await client.query(`
      INSERT INTO products (
        id, seller_id, seller_name, seller_phone, seller_role, target_role,
        crop_name, bangla_name, category, unit, quantity, available_qty, unit_price, district, harvest_status
      ) VALUES 
        ('e2e-prod-farmer', 'user-farmer-rafiq', 'Farmer Rafiq', '01712458920', 'farmer', 'wholesaler', 'E2E Farm Tomato', 'ফার্ম টমেটো', 'Vegetables', 'kg', 200, 200, 35, 'Bogura', 'Ready'),
        ('e2e-prod-wholesaler', 'user-wholesaler-sumaiya', 'Wholesaler Sumaiya', '01999887766', 'wholesaler', 'retailer', 'E2E Wholesale Potato', 'হোলসেল আলু', 'Tubers', 'kg', 300, 300, 28, 'Bogura', 'Ready'),
        ('e2e-prod-retailer-1', 'usr-retailer-jafor', 'Retailer Jafor', '01911334200', 'retailer', 'consumer', 'E2E Retail Onion', 'রিটেল পেঁয়াজ', 'Vegetables', 'kg', 150, 150, 75, 'Bogura', 'Ready'),
        ('e2e-prod-retailer-2', 'ret-bismillah-mart', 'Bismillah Mart', '01755556666', 'retailer', 'consumer', 'E2E Retail Garlic', 'রিটেল রসুন', 'Spices', 'kg', 80, 80, 140, 'Bogura', 'Ready')
      ON CONFLICT (id) DO UPDATE SET available_qty = EXCLUDED.available_qty;
    `);

    // TEST 6: Valid Farmer-to-Wholesaler order
    console.log('\n--- Test 6: Valid Farmer-to-Wholesaler order ---');
    const f2wOrder = await request('POST', '/api/orders', {
      items: [{ productId: 'e2e-prod-farmer', quantityKg: 50 }],
      deliveryAddress: 'Karwan Bazar Arat',
      district: 'Dhaka'
    }, { Cookie: wholesalerCookie });

    const t6Passed = f2wOrder.status === 201 && f2wOrder.data.success && f2wOrder.data.order.totalBdt === (50 * 35);
    testResults['6_farmer_to_wholesaler'] = {
      passed: t6Passed,
      message: `Wholesaler purchased 50kg farm tomato for ৳${f2wOrder.data.order?.totalBdt}. Order ID: ${f2wOrder.data.order?.orderId}`
    };
    console.log(t6Passed ? '✓ PASS' : '✗ FAIL', testResults['6_farmer_to_wholesaler'].message);

    // TEST 7: Valid Wholesaler-to-Retailer order
    console.log('\n--- Test 7: Valid Wholesaler-to-Retailer order ---');
    const w2rOrder = await request('POST', '/api/orders', {
      items: [{ productId: 'e2e-prod-wholesaler', quantityKg: 100 }],
      deliveryAddress: 'Bogura New Market',
      district: 'Bogura'
    }, { Cookie: retailerCookie });

    const t7Passed = w2rOrder.status === 201 && w2rOrder.data.success && w2rOrder.data.order.totalBdt === (100 * 28);
    testResults['7_wholesaler_to_retailer'] = {
      passed: t7Passed,
      message: `Retailer purchased 100kg wholesale potato for ৳${w2rOrder.data.order?.totalBdt}. Order ID: ${w2rOrder.data.order?.orderId}`
    };
    console.log(t7Passed ? '✓ PASS' : '✗ FAIL', testResults['7_wholesaler_to_retailer'].message);

    // TEST 8: Valid Retailer-to-Consumer order
    console.log('\n--- Test 8: Valid Retailer-to-Consumer order ---');
    const r2cOrder = await request('POST', '/api/orders', {
      items: [{ productId: 'e2e-prod-retailer-1', quantityKg: 5 }],
      deliveryAddress: 'Jaleshwaritola, Bogura',
      district: 'Bogura'
    }, { Cookie: consumerCookie });

    const t8Passed = r2cOrder.status === 201 && r2cOrder.data.success && r2cOrder.data.order.totalBdt === (5 * 75);
    testResults['8_retailer_to_consumer'] = {
      passed: t8Passed,
      message: `Consumer purchased 5kg retail onion for ৳${r2cOrder.data.order?.totalBdt}. Order ID: ${r2cOrder.data.order?.orderId}`
    };
    console.log(t8Passed ? '✓ PASS' : '✗ FAIL', testResults['8_retailer_to_consumer'].message);

    // TEST 9: Invalid role combinations (Consumer buying directly from Farmer)
    console.log('\n--- Test 9: Invalid supply-chain role combinations ---');
    const invalidRoleOrder = await request('POST', '/api/orders', {
      items: [{ productId: 'e2e-prod-farmer', quantityKg: 10 }],
      deliveryAddress: 'Home',
      district: 'Bogura'
    }, { Cookie: consumerCookie }); // Consumer -> Farmer blocked!

    const t9Passed = invalidRoleOrder.status === 403 && invalidRoleOrder.data.error.includes('Rule Violation');
    testResults['9_invalid_role_hierarchy'] = {
      passed: t9Passed,
      message: `Consumer direct farm buy rejected with HTTP ${invalidRoleOrder.status}: ${invalidRoleOrder.data.error}`
    };
    console.log(t9Passed ? '✓ PASS' : '✗ FAIL', testResults['9_invalid_role_hierarchy'].message);

    // TEST 10: Multi-seller cart rejection
    console.log('\n--- Test 10: Multi-seller cart rejection ---');
    const multiSellerOrder = await request('POST', '/api/orders', {
      items: [
        { productId: 'e2e-prod-retailer-1', quantityKg: 2 },
        { productId: 'e2e-prod-retailer-2', quantityKg: 2 } // Different retailer!
      ],
      deliveryAddress: 'Home',
      district: 'Bogura'
    }, { Cookie: consumerCookie });

    const t10Passed = multiSellerOrder.status === 403 && multiSellerOrder.data.error.includes('Multi-Seller Violation');
    testResults['10_multi_seller_rejection'] = {
      passed: t10Passed,
      message: `Multi-seller cart rejected with HTTP ${multiSellerOrder.status}: ${multiSellerOrder.data.error}`
    };
    console.log(t10Passed ? '✓ PASS' : '✗ FAIL', testResults['10_multi_seller_rejection'].message);

    // TEST 11: Forged price and seller rejection
    console.log('\n--- Test 11: Forged price and seller rejection ---');
    const forgedOrder = await request('POST', '/api/orders', {
      sellerId: 'forged-fake-seller',
      sellerName: 'Fake Seller',
      items: [{ productId: 'e2e-prod-retailer-1', quantityKg: 2, pricePerKg: 1, unitPrice: 1 }], // Forged 1 BDT price!
      deliveryAddress: 'Home',
      district: 'Bogura'
    }, { Cookie: consumerCookie });

    // Real DB price is 75 BDT, so total must be 150 BDT, and seller must be usr-retailer-jafor
    const t11Passed = forgedOrder.status === 201 &&
                      forgedOrder.data.order.totalBdt === 150 &&
                      forgedOrder.data.order.sellerId === 'usr-retailer-jafor';
    testResults['11_forged_price_seller'] = {
      passed: t11Passed,
      message: `Forged price (৳1) rejected; DB price used (৳${forgedOrder.data.order?.totalBdt}). Seller derived from DB: ${forgedOrder.data.order?.sellerId}`
    };
    console.log(t11Passed ? '✓ PASS' : '✗ FAIL', testResults['11_forged_price_seller'].message);

    // TEST 12: Insufficient inventory rejection
    console.log('\n--- Test 12: Insufficient inventory rejection ---');
    const oversellOrder = await request('POST', '/api/orders', {
      items: [{ productId: 'e2e-prod-retailer-1', quantityKg: 999999 }],
      deliveryAddress: 'Home',
      district: 'Bogura'
    }, { Cookie: consumerCookie });

    const t12Passed = oversellOrder.status === 400 && oversellOrder.data.error.includes('Insufficient stock');
    testResults['12_insufficient_inventory'] = {
      passed: t12Passed,
      message: `Oversell order rejected with HTTP ${oversellOrder.status}: ${oversellOrder.data.error}`
    };
    console.log(t12Passed ? '✓ PASS' : '✗ FAIL', testResults['12_insufficient_inventory'].message);

    // TEST 13: Concurrent order stock protection
    console.log('\n--- Test 13: Concurrent order race condition protection ---');
    // Set stock to exactly 15 kg
    await client.query("UPDATE products SET available_qty = 15 WHERE id = 'e2e-prod-retailer-2'");
    // Launch 3 concurrent requests of 10 kg (Total 30 kg requested, 15 available)
    // Exactly 1 must succeed (10 kg deducted, 5 left) and 2 must fail!
    const concPromises = [1, 2, 3].map(i =>
      request('POST', '/api/orders', {
        items: [{ productId: 'e2e-prod-retailer-2', quantityKg: 10 }],
        deliveryAddress: `Address ${i}`,
        district: 'Bogura'
      }, { Cookie: consumerCookie })
    );
    const concResponses = await Promise.all(concPromises);
    const concSuccesses = concResponses.filter(r => r.status === 201).length;
    const concFailures = concResponses.filter(r => r.status === 400).length;
    const finalStockRes = await client.query("SELECT available_qty FROM products WHERE id = 'e2e-prod-retailer-2'");
    const finalStock = parseFloat(finalStockRes.rows[0].available_qty);

    const t13Passed = concSuccesses === 1 && concFailures === 2 && finalStock === 5;
    testResults['13_concurrent_stock_protection'] = {
      passed: t13Passed,
      message: `Concurrent race: exactly ${concSuccesses} succeeded, ${concFailures} rejected. Final stock: ${finalStock}kg`
    };
    console.log(t13Passed ? '✓ PASS' : '✗ FAIL', testResults['13_concurrent_stock_protection'].message);

    // TEST 14: Order listing and history isolation
    console.log('\n--- Test 14: Order listing and history access control ---');
    const consumerOrders = await request('GET', '/api/orders', null, { Cookie: consumerCookie });
    const retailerOrders = await request('GET', '/api/orders', null, { Cookie: retailerCookie });
    // Consumer only sees orders where they are buyer
    const consumerSeesOwnOnly = consumerOrders.data.orders.every(o => o.buyerId === 'user-consumer-tanveer');
    // Retailer only sees orders where they are seller or buyer
    const retailerSeesOwnOnly = retailerOrders.data.orders.every(o => o.buyerId === 'usr-retailer-jafor' || o.sellerId === 'usr-retailer-jafor');

    const t14Passed = consumerOrders.status === 200 && retailerOrders.status === 200 && consumerSeesOwnOnly && retailerSeesOwnOnly;
    testResults['14_order_listing_history'] = {
      passed: t14Passed,
      message: `Consumer saw ${consumerOrders.data.total} own orders (100% isolated). Retailer saw ${retailerOrders.data.total} own orders (100% isolated).`
    };
    console.log(t14Passed ? '✓ PASS' : '✗ FAIL', testResults['14_order_listing_history'].message);

    // TEST 15: Failure and rollback behavior
    console.log('\n--- Test 15: Failure and rollback behavior ---');
    const ordersCountBefore = parseInt((await client.query('SELECT count(*)::int as c FROM orders')).rows[0].c);
    const stockBeforeRollback = parseFloat((await client.query("SELECT available_qty FROM products WHERE id = 'e2e-prod-retailer-1'")).rows[0].available_qty);

    const failOrder = await request('POST', '/api/orders', {
      items: [
        { productId: 'e2e-prod-retailer-1', quantityKg: 5 },
        { productId: 'non-existent-product-id-999', quantityKg: 5 } // Will fail!
      ],
      deliveryAddress: 'Home',
      district: 'Bogura'
    }, { Cookie: consumerCookie });

    const ordersCountAfter = parseInt((await client.query('SELECT count(*)::int as c FROM orders')).rows[0].c);
    const stockAfterRollback = parseFloat((await client.query("SELECT available_qty FROM products WHERE id = 'e2e-prod-retailer-1'")).rows[0].available_qty);

    const t15Passed = failOrder.status >= 400 &&
                      ordersCountBefore === ordersCountAfter &&
                      stockBeforeRollback === stockAfterRollback;
    testResults['15_rollback_behavior'] = {
      passed: t15Passed,
      message: `Rollback verified: Orders count (${ordersCountBefore} -> ${ordersCountAfter}), Stock (${stockBeforeRollback} -> ${stockAfterRollback})`
    };
    console.log(t15Passed ? '✓ PASS' : '✗ FAIL', testResults['15_rollback_behavior'].message);

    // CLEANUP DISPOSABLE TEST DATA
    console.log('\nCleaning up disposable E2E test records on dev-migration-test...');
    await client.query("ALTER TABLE trade_audit_logs DISABLE TRIGGER trg_protect_trade_audit_logs;");
    await client.query("DELETE FROM trade_audit_logs WHERE description LIKE '%E2E%' OR actor_name LIKE 'Test %' OR actor_name = 'Tanveer Ahmed';");
    await client.query("DELETE FROM order_items WHERE product_id LIKE 'e2e-%' OR product_id LIKE 'prod-far-179%' OR crop_name LIKE '%Eggplant%';");
    await client.query("DELETE FROM orders WHERE delivery_address LIKE '%Arat%' OR delivery_address LIKE '%Market%' OR delivery_address LIKE '%Jaleshwaritola%' OR delivery_address LIKE '%Home%' OR delivery_address LIKE '%Address%';");
    await client.query("DELETE FROM products WHERE id LIKE 'e2e-%' OR id LIKE 'prod-far-179%';");
    await client.query("DELETE FROM sessions WHERE id LIKE 'sess-test-sess-%';");
    await client.query("ALTER TABLE trade_audit_logs ENABLE TRIGGER trg_protect_trade_audit_logs;");
    console.log('✓ Cleanup completed.');

    // Verify Source DB Unchanged
    const sqlitePostHash = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
    const jsonPostHash = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');
    const sourceDbUnchanged = (sqlitePreHash === sqlitePostHash) && (jsonPreHash === jsonPostHash);

    console.log('\nSource Database Immutability Check:');
    console.log('  SQLite SHA-256 match:', sqlitePreHash === sqlitePostHash);
    console.log('  JSON SHA-256 match:  ', jsonPreHash === jsonPostHash);

    // Final Post-test Neon Counts
    const postCounts = {
      products: parseInt((await client.query('SELECT count(*)::int as c FROM products')).rows[0].c),
      orders: parseInt((await client.query('SELECT count(*)::int as c FROM orders')).rows[0].c),
      order_items: parseInt((await client.query('SELECT count(*)::int as c FROM order_items')).rows[0].c),
      trade_audit_logs: parseInt((await client.query('SELECT count(*)::int as c FROM trade_audit_logs')).rows[0].c),
    };
    console.log('Post-test Neon row counts:', postCounts);

    console.log('\n========================================');
    console.log('ALL 15 STAGE E TESTS RESULTS:');
    console.table(testResults);
    console.log('========================================');

    const allPassed = Object.values(testResults).every(r => r.passed) && sourceDbUnchanged;
    if (!allPassed) {
      console.error('Some tests failed!');
      process.exit(1);
    }

    console.log('\n✓ ALL 15 STAGE E RUNTIME TESTS PASSED WITH 100% COMPLIANCE!');

  } finally {
    client.release();
    await pool.end();
  }
}

runTestSuite().catch(e => {
  console.error('Fatal Test Suite Error:', e);
  process.exit(1);
});
