const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../server_data/test_branch.env')));
const testUrl = env.TEST_DATABASE_URL;

if (!testUrl || !testUrl.includes('ep-snowy-mode')) {
  console.error('SAFETY STOP: Wrong endpoint! Must be ep-snowy-mode.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: testUrl,
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = 'http://localhost:5178';

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
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

async function runTestSuite() {
  console.log('=== PHASE 3.3 COMPREHENSIVE RUNTIME TEST SUITE ===\n');

  const client = await pool.connect();
  const createdTestIds = {
    sessions: [],
    reviews: [],
    catalog: [],
    callLogs: [],
    farmerExpenses: [],
    negotiations: [],
    notifications: []
  };

  const results = {};

  try {
    // 0. Initial Hashes and Baseline Counts
    const sqlitePreHash = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
    const jsonPreHash = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');

    const preCounts = {
      catalog: parseInt((await client.query('SELECT count(*)::int as c FROM catalog')).rows[0].c),
      reviews: parseInt((await client.query('SELECT count(*)::int as c FROM reviews')).rows[0].c),
      callLogs: parseInt((await client.query('SELECT count(*)::int as c FROM call_logs')).rows[0].c),
      farmerExpenses: parseInt((await client.query('SELECT count(*)::int as c FROM farmer_expenses')).rows[0].c),
      negotiations: parseInt((await client.query('SELECT count(*)::int as c FROM negotiations')).rows[0].c),
    };
    console.log('Baseline row counts on dev-migration-test:', preCounts);

    // Helper to generate sessions
    async function createTestSession(userId, role) {
      const token = `p33-sess-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const sessId = `sess-${token}`;
      await client.query(`
        INSERT INTO sessions (id, user_id, token_hash, role, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day')
      `, [sessId, userId, tokenHash, role]);
      createdTestIds.sessions.push(sessId);
      return `nb_session=${token}`;
    }

    console.log('\nCreating isolated test sessions for actors...');
    const farmerCookie = await createTestSession('user-farmer-rafiq', 'farmer');
    const wholesalerCookie = await createTestSession('user-wholesaler-sumaiya', 'wholesaler');
    const karwanCookie = await createTestSession('w-karwan-syndicate', 'wholesaler');
    const consumerCookie = await createTestSession('usr-consumer-sumayya', 'consumer');
    const otherConsumerCookie = await createTestSession('user-consumer-tanveer', 'consumer');
    const retailerCookie = await createTestSession('usr-retailer-jafor', 'retailer');
    const adminCookie = await createTestSession('admin-root', 'admin');
    console.log('✓ All 7 test sessions active.');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 1: REVIEWS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- DOMAIN 1: REVIEWS TESTING ---');

    // Test 1: Non-delivered order review attempt (HTTP 400 rejection)
    console.log('\n[Test 1] Review attempt on non-delivered order (ORD-T1-889012, Confirmed)...');
    const t1Res = await request('POST', '/api/orders/ORD-T1-889012/review', {
      rating: 5,
      comment: 'Premature review attempt'
    }, { Cookie: karwanCookie });
    const t1Passed = t1Res.status === 400 && t1Res.data?.error?.includes('verified buyers with completed deliveries');
    results['Test 1: Non-delivered Order Review Rejection'] = { passed: t1Passed, status: t1Res.status, msg: t1Res.data?.error };
    console.log('Result:', t1Passed ? 'PASS (400 Rejected properly)' : 'FAIL', t1Res.status, t1Res.data);

    // Test 2: Unauthorized buyer review attempt on delivered order ORD-T3-334992 (buyer is usr-consumer-sumayya)
    console.log('\n[Test 2] Unauthorized user review attempt on someone else\'s delivered order...');
    const t2Res = await request('POST', '/api/orders/ORD-T3-334992/review', {
      rating: 5,
      comment: 'Impostor review attempt'
    }, { Cookie: otherConsumerCookie });
    const t2Passed = t2Res.status === 403 && t2Res.data?.error?.includes('Only the customer who placed this order');
    results['Test 2: Unauthorized Buyer Review Rejection'] = { passed: t2Passed, status: t2Res.status, msg: t2Res.data?.error };
    console.log('Result:', t2Passed ? 'PASS (403 Forbidden)' : 'FAIL', t2Res.status, t2Res.data);

    // Test 3: Invalid star rating (< 1 or > 5)
    console.log('\n[Test 3] Invalid star rating rejection (rating: 6)...');
    const t3Res = await request('POST', '/api/orders/ORD-T3-334992/review', {
      rating: 6,
      comment: 'Invalid rating'
    }, { Cookie: consumerCookie });
    const t3Passed = t3Res.status === 400 && t3Res.data?.error?.includes('Valid star rating between 1 and 5');
    results['Test 3: Invalid Star Rating Rejection'] = { passed: t3Passed, status: t3Res.status, msg: t3Res.data?.error };
    console.log('Result:', t3Passed ? 'PASS (400 Rejected)' : 'FAIL', t3Res.status, t3Res.data);

    // Test 4: Authorized buyer verified review on delivered order ORD-T3-334992
    console.log('\n[Test 4] Authorized buyer verified review submission on delivered order...');
    const t4Res = await request('POST', '/api/orders/ORD-T3-334992/review', {
      rating: 5,
      comment: 'Exceptional quality organic potatoes, delivered fresh on time!'
    }, { Cookie: consumerCookie });
    const t4Passed = t4Res.status === 201 && t4Res.data?.success === true && t4Res.data?.review?.verifiedPurchase === true;
    if (t4Res.data?.review?.id) createdTestIds.reviews.push(t4Res.data.review.id);
    results['Test 4: Authorized Verified Order Review Creation'] = {
      passed: t4Passed,
      status: t4Res.status,
      reviewId: t4Res.data?.review?.id,
      verifiedPurchase: t4Res.data?.review?.verifiedPurchase
    };
    console.log('Result:', t4Passed ? 'PASS (201 Created)' : 'FAIL', t4Res.status, t4Res.data?.review);

    // Test 5: Duplicate review attempt on same delivered order
    console.log('\n[Test 5] Duplicate review attempt on already reviewed order...');
    const t5Res = await request('POST', '/api/orders/ORD-T3-334992/review', {
      rating: 4,
      comment: 'Trying to review again'
    }, { Cookie: consumerCookie });
    const t5Passed = t5Res.status === 400 && t5Res.data?.error?.includes('Order has already been reviewed');
    results['Test 5: Duplicate Order Review Rejection'] = { passed: t5Passed, status: t5Res.status, msg: t5Res.data?.error };
    console.log('Result:', t5Passed ? 'PASS (400 Duplicate Blocked)' : 'FAIL', t5Res.status, t5Res.data);

    // Test 6: Direct product review submission
    console.log('\n[Test 6] Direct product review submission via POST /api/reviews...');
    const t6Res = await request('POST', '/api/reviews', {
      productId: 'prod-far-301',
      rating: 4,
      comment: 'Good firmness and color for wholesale crates.'
    }, { Cookie: wholesalerCookie });
    const t6Passed = t6Res.status === 201 && t6Res.data?.success === true && t6Res.data?.review?.verifiedPurchase === false;
    if (t6Res.data?.review?.id) createdTestIds.reviews.push(t6Res.data.review.id);
    results['Test 6: Direct Product Review Creation'] = {
      passed: t6Passed,
      status: t6Res.status,
      reviewId: t6Res.data?.review?.id
    };
    console.log('Result:', t6Passed ? 'PASS (201 Created)' : 'FAIL', t6Res.status, t6Res.data?.review);

    // Test 7: Duplicate direct product review attempt
    console.log('\n[Test 7] Duplicate direct product review on same product by same user...');
    const t7Res = await request('POST', '/api/reviews', {
      productId: 'prod-far-301',
      rating: 5,
      comment: 'Second review attempt on same product'
    }, { Cookie: wholesalerCookie });
    const t7Passed = t7Res.status === 400 && t7Res.data?.error?.includes('already reviewed this product');
    results['Test 7: Duplicate Direct Product Review Rejection'] = { passed: t7Passed, status: t7Res.status, msg: t7Res.data?.error };
    console.log('Result:', t7Passed ? 'PASS (400 Duplicate Blocked)' : 'FAIL', t7Res.status, t7Res.data);

    // Test 8: Query reviews by productId & orderId
    console.log('\n[Test 8] Query reviews by productId & orderId via GET /api/reviews...');
    const t8aRes = await request('GET', '/api/reviews?productId=prod-far-301');
    const t8bRes = await request('GET', '/api/reviews?orderId=ORD-T3-334992');
    const t8Passed = t8aRes.status === 200 && Array.isArray(t8aRes.data?.reviews) && t8aRes.data.reviews.length >= 1 &&
                     t8bRes.status === 200 && Array.isArray(t8bRes.data?.reviews) && t8bRes.data.reviews.length === 1;
    results['Test 8: Query Reviews by Product & Order ID'] = {
      passed: t8Passed,
      byProductCount: t8aRes.data?.reviews?.length,
      byOrderCount: t8bRes.data?.reviews?.length
    };
    console.log('Result:', t8Passed ? 'PASS (200 Query Success)' : 'FAIL', { prodReviews: t8aRes.data?.reviews?.length, orderReviews: t8bRes.data?.reviews?.length });

    // Test 9: Review deletion authorization check (unauthorized vs author)
    console.log('\n[Test 9] Review deletion authorization check...');
    const reviewToDeleteId = t6Res.data?.review?.id;
    // Unauthorized delete attempt by consumer
    const t9aRes = await request('DELETE', `/api/reviews/${reviewToDeleteId}`, null, { Cookie: consumerCookie });
    // Authorized delete attempt by wholesaler (author)
    const t9bRes = await request('DELETE', `/api/reviews/${reviewToDeleteId}`, null, { Cookie: wholesalerCookie });
    const t9Passed = t9aRes.status === 403 && t9bRes.status === 200;
    // Remove from createdTestIds.reviews since it was deleted
    createdTestIds.reviews = createdTestIds.reviews.filter(id => id !== reviewToDeleteId);
    results['Test 9: Review Deletion Authorization Check'] = {
      passed: t9Passed,
      unauthorizedStatus: t9aRes.status,
      authorizedStatus: t9bRes.status
    };
    console.log('Result:', t9Passed ? 'PASS (403 for unauthorized, 200 for author)' : 'FAIL', t9aRes.status, t9bRes.status);

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 2: MASTER AGRICULTURAL CATALOG
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- DOMAIN 2: CATALOG TESTING ---');

    // Test 10: Master catalog baseline read
    console.log('\n[Test 10] Master agricultural catalog baseline check...');
    const t10Res = await request('GET', '/api/catalog?limit=all');
    const t10Passed = t10Res.status === 200 && t10Res.data?.success === true && t10Res.data?.total === 80 && t10Res.data?.products?.length === 80;
    results['Test 10: Master Catalog Baseline Integrity (80 items)'] = {
      passed: t10Passed,
      status: t10Res.status,
      itemCount: t10Res.data?.total
    };
    console.log('Result:', t10Passed ? 'PASS (80 master crops verified in Neon)' : 'FAIL', t10Res.status, 'Total:', t10Res.data?.total);

    // Test 11: Catalog pagination, category filtering, and search
    console.log('\n[Test 11] Catalog pagination, category filtering, and search...');
    const t11Paginated = await request('GET', '/api/catalog?page=1&limit=10');
    const t11Category = await request('GET', '/api/catalog?category=vegetables&limit=all');
    const t11Search = await request('GET', '/api/catalog?query=Tomato');
    const t11Passed = t11Paginated.status === 200 && t11Paginated.data?.products?.length === 10 && t11Paginated.data?.totalPages === 8 &&
                      t11Category.status === 200 && t11Category.data?.products?.length === 20 &&
                      t11Search.status === 200 && t11Search.data?.products?.length > 0;
    results['Test 11: Catalog Pagination, Filtering & Search'] = {
      passed: t11Passed,
      paginatedCount: t11Paginated.data?.products?.length,
      vegCount: t11Category.data?.products?.length,
      searchCount: t11Search.data?.products?.length
    };
    console.log('Result:', t11Passed ? 'PASS (Pagination, Category, and Search functional)' : 'FAIL', {
      pageCount: t11Paginated.data?.products?.length,
      vegCount: t11Category.data?.products?.length,
      searchCount: t11Search.data?.products?.length
    });

    // Test 12: GET /api/catalog/:id
    console.log('\n[Test 12] GET /api/catalog/:id item retrieval...');
    const sampleCropId = t10Res.data.products[0].id;
    const t12Res = await request('GET', `/api/catalog/${sampleCropId}`);
    const t12Passed = t12Res.status === 200 && t12Res.data?.success === true && t12Res.data?.product?.id === sampleCropId;
    results['Test 12: Catalog Single Item Retrieval'] = { passed: t12Passed, status: t12Res.status, id: sampleCropId };
    console.log('Result:', t12Passed ? 'PASS (Single item retrieved)' : 'FAIL', t12Res.status, t12Res.data?.product?.name);

    // Test 13: Non-admin catalog creation attempt (HTTP 403)
    console.log('\n[Test 13] Non-admin catalog creation attempt (HTTP 403)...');
    const t13Res = await request('POST', '/api/catalog', {
      name: 'Unauthorized Crop',
      nameBn: 'অননুমোদিত ফসল',
      category: 'Vegetables'
    }, { Cookie: farmerCookie });
    const t13Passed = t13Res.status === 403 && t13Res.data?.error?.includes('Admin access required');
    results['Test 13: Non-Admin Catalog Creation Rejection'] = { passed: t13Passed, status: t13Res.status, msg: t13Res.data?.error };
    console.log('Result:', t13Passed ? 'PASS (403 Forbidden)' : 'FAIL', t13Res.status, t13Res.data);

    // Test 14: Admin catalog CRUD lifecycle
    console.log('\n[Test 14] Admin catalog CRUD lifecycle (Create, Update, Delete)...');
    const customCropId = `cat-test-${Date.now()}`;
    const t14aRes = await request('POST', '/api/catalog', {
      id: customCropId,
      name: 'P33 Test Dragon Fruit',
      nameBn: 'টেস্ট ড্রাগন ফল',
      category: 'Fruits',
      categoryLabelEn: 'Fruits',
      categoryLabelBn: 'ফলমূল',
      unit: 'kg',
      unitBn: 'কেজি',
      damBenchmarkPrice: 220.00,
      descriptionEn: 'High quality dragon fruit for retail.',
      descriptionBn: 'উচ্চমানের ড্রাগন ফল।'
    }, { Cookie: adminCookie });
    if (t14aRes.data?.product?.id) createdTestIds.catalog.push(customCropId);

    const t14bRes = await request('PUT', `/api/catalog/${customCropId}`, {
      damBenchmarkPrice: 240.00,
      descriptionEn: 'Updated description for dragon fruit.'
    }, { Cookie: adminCookie });

    const t14cRes = await request('DELETE', `/api/catalog/${customCropId}`, null, { Cookie: adminCookie });
    createdTestIds.catalog = createdTestIds.catalog.filter(id => id !== customCropId);

    const t14Passed = t14aRes.status === 201 && t14bRes.status === 200 &&
                      t14bRes.data?.product?.damBenchmarkPrice === 240 && t14cRes.status === 200;
    results['Test 14: Admin Catalog CRUD Lifecycle'] = {
      passed: t14Passed,
      createStatus: t14aRes.status,
      updateStatus: t14bRes.status,
      deleteStatus: t14cRes.status
    };
    console.log('Result:', t14Passed ? 'PASS (Create 201, Update 200, Delete 200)' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 3: CALL LOGS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- DOMAIN 3: CALL LOGS TESTING ---');

    // Test 15: Create call log via POST /api/calls/logs with session-derived caller
    console.log('\n[Test 15] User initiates call log via POST /api/calls/logs...');
    const t15Res = await request('POST', '/api/calls/logs', {
      receiverId: 'user-farmer-rafiq',
      receiverName: 'Md. Rafiqul Islam',
      receiverRole: 'farmer',
      receiverPhone: '01712458920',
      status: 'completed',
      durationSeconds: 145
    }, { Cookie: wholesalerCookie });
    const t15Passed = t15Res.status === 201 && t15Res.data?.success === true &&
                      t15Res.data?.log?.callerId === 'user-wholesaler-sumaiya' &&
                      t15Res.data?.log?.callerRole === 'wholesaler' &&
                      t15Res.data?.log?.durationSeconds === 145;
    if (t15Res.data?.log?.id) createdTestIds.callLogs.push(t15Res.data.log.id);
    results['Test 15: Secure Call Log Creation'] = {
      passed: t15Passed,
      status: t15Res.status,
      callerId: t15Res.data?.log?.callerId,
      logId: t15Res.data?.log?.id
    };
    console.log('Result:', t15Passed ? 'PASS (201 Created with derived caller)' : 'FAIL', t15Res.status, t15Res.data?.log);

    // Test 16: Non-participant call log privacy check
    console.log('\n[Test 16] Non-participant attempts to query another user\'s call logs...');
    const t16Res = await request('GET', '/api/calls/logs?userId=user-wholesaler-sumaiya', null, { Cookie: consumerCookie });
    const t16Passed = t16Res.status === 403 && t16Res.data?.error?.includes('You cannot view another user\'s call logs');
    results['Test 16: Call Log Privacy Check (HTTP 403)'] = { passed: t16Passed, status: t16Res.status, msg: t16Res.data?.error };
    console.log('Result:', t16Passed ? 'PASS (403 Privacy Protected)' : 'FAIL', t16Res.status, t16Res.data);

    // Test 17: Participant call log retrieval
    console.log('\n[Test 17] Participant retrieves own call logs via GET /api/calls/logs...');
    const t17CallerRes = await request('GET', '/api/calls/logs', null, { Cookie: wholesalerCookie });
    const t17ReceiverRes = await request('GET', '/api/calls/logs', null, { Cookie: farmerCookie });
    const t17Passed = t17CallerRes.status === 200 && t17CallerRes.data?.logs?.length >= 1 &&
                      t17ReceiverRes.status === 200 && t17ReceiverRes.data?.logs?.length >= 1;
    results['Test 17: Participant Call Log Retrieval'] = {
      passed: t17Passed,
      callerLogsCount: t17CallerRes.data?.logs?.length,
      receiverLogsCount: t17ReceiverRes.data?.logs?.length
    };
    console.log('Result:', t17Passed ? 'PASS (Both caller and receiver see their shared call log)' : 'FAIL');

    // Test 18: Admin call log retrieval for any user
    console.log('\n[Test 18] Admin queries call logs for a user via GET /api/calls/logs?userId=...');
    const t18Res = await request('GET', '/api/calls/logs?userId=user-wholesaler-sumaiya', null, { Cookie: adminCookie });
    const t18Passed = t18Res.status === 200 && t18Res.data?.logs?.length >= 1;
    results['Test 18: Admin Call Log Inspection'] = { passed: t18Passed, status: t18Res.status, logsCount: t18Res.data?.logs?.length };
    console.log('Result:', t18Passed ? 'PASS (Admin can inspect logs)' : 'FAIL', t18Res.status, 'Logs:', t18Res.data?.logs?.length);

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 4: FARMER EXPENSES
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- DOMAIN 4: FARMER EXPENSES TESTING ---');

    // Test 19: Non-farmer expense logging attempt (HTTP 403)
    console.log('\n[Test 19] Non-farmer attempts to log farm expenses (HTTP 403)...');
    const t19Res = await request('POST', '/api/farmer/expenses', {
      category: 'Fertilizer',
      description: 'DAP Fertilizer 50kg bag',
      amountBDT: 1350
    }, { Cookie: consumerCookie });
    const t19Passed = t19Res.status === 403 && t19Res.data?.error?.includes('Only farmers and administrators');
    results['Test 19: Non-Farmer Expense Logging Rejection'] = { passed: t19Passed, status: t19Res.status, msg: t19Res.data?.error };
    console.log('Result:', t19Passed ? 'PASS (403 Forbidden)' : 'FAIL', t19Res.status, t19Res.data);

    // Test 20: Farmer logs invalid expense (negative amount)
    console.log('\n[Test 20] Farmer attempts invalid expense with negative amount...');
    const t20Res = await request('POST', '/api/farmer/expenses', {
      category: 'Fertilizer',
      description: 'Invalid negative test',
      amountBDT: -500
    }, { Cookie: farmerCookie });
    const t20Passed = t20Res.status === 400 && t20Res.data?.error?.includes('positive amount are required');
    results['Test 20: Invalid Expense Validation Rejection'] = { passed: t20Passed, status: t20Res.status, msg: t20Res.data?.error };
    console.log('Result:', t20Passed ? 'PASS (400 Validation Block)' : 'FAIL', t20Res.status, t20Res.data);

    // Test 21: Farmer logs valid expense and income
    console.log('\n[Test 21] Farmer logs valid expense and income records...');
    const t21aRes = await request('POST', '/api/farmer/expenses', {
      date: '2026-11-02',
      type: 'expense',
      category: 'Fertilizer',
      description: 'DAP Fertilizer 50kg for Tomato field',
      descriptionBn: 'টমেটো ক্ষেতের জন্য ৫০ কেজি ডিএপি সার',
      amountBDT: 1350.00,
      cropRelated: 'Tomato'
    }, { Cookie: farmerCookie });
    if (t21aRes.data?.expense?.id) createdTestIds.farmerExpenses.push(t21aRes.data.expense.id);

    const t21bRes = await request('POST', '/api/farmer/expenses', {
      date: '2026-11-02',
      type: 'income',
      category: 'Harvest Sale',
      description: 'Wholesale batch harvest sale 100kg',
      descriptionBn: 'পাইকারি ফসল বিক্রি ১০০ কেজি',
      amountBDT: 3800.00,
      cropRelated: 'Tomato'
    }, { Cookie: farmerCookie });
    if (t21bRes.data?.expense?.id) createdTestIds.farmerExpenses.push(t21bRes.data.expense.id);

    const t21Passed = t21aRes.status === 201 && t21aRes.data?.expense?.farmerId === 'user-farmer-rafiq' &&
                      t21bRes.status === 201 && t21bRes.data?.expense?.type === 'income';
    results['Test 21: Farmer Expense and Income Creation'] = {
      passed: t21Passed,
      expenseId: t21aRes.data?.expense?.id,
      incomeId: t21bRes.data?.expense?.id
    };
    console.log('Result:', t21Passed ? 'PASS (201 Expense & Income Logged)' : 'FAIL');

    // Test 22: Farmer expense ledger inspection and privacy isolation
    console.log('\n[Test 22] Farmer expense ledger inspection & privacy isolation...');
    // Unauthorized inspection by retailer
    const t22aRes = await request('GET', '/api/farmer/expenses?farmerId=user-farmer-rafiq', null, { Cookie: retailerCookie });
    // Authorized inspection by farmer
    const t22bRes = await request('GET', '/api/farmer/expenses', null, { Cookie: farmerCookie });
    const t22Passed = t22aRes.status === 403 && t22bRes.status === 200 &&
                      t22bRes.data?.totalExpenses === 1350 &&
                      t22bRes.data?.totalIncome === 3800 &&
                      t22bRes.data?.netProfit === 2450;
    results['Test 22: Farmer Expense Ledger Privacy & Aggregations'] = {
      passed: t22Passed,
      privacyBlocked: t22aRes.status === 403,
      totalExpenses: t22bRes.data?.totalExpenses,
      totalIncome: t22bRes.data?.totalIncome,
      netProfit: t22bRes.data?.netProfit
    };
    console.log('Result:', t22Passed ? 'PASS (403 for unauthorized, 200 with profit calculation for owner)' : 'FAIL', {
      expenses: t22bRes.data?.totalExpenses,
      income: t22bRes.data?.totalIncome,
      netProfit: t22bRes.data?.netProfit
    });

    // Test 23: Farmer updates and deletes expense
    console.log('\n[Test 23] Farmer updates and deletes expense...');
    const expenseToEditId = t21aRes.data?.expense?.id;
    const t23aRes = await request('PUT', `/api/farmer/expenses/${expenseToEditId}`, {
      amountBDT: 1400.00,
      description: 'DAP Fertilizer 50kg bag (Updated Price)'
    }, { Cookie: farmerCookie });

    const t23bRes = await request('DELETE', `/api/farmer/expenses/${expenseToEditId}`, null, { Cookie: farmerCookie });
    createdTestIds.farmerExpenses = createdTestIds.farmerExpenses.filter(id => id !== expenseToEditId);

    const t23Passed = t23aRes.status === 200 && t23aRes.data?.expense?.amountBDT === 1400 && t23bRes.status === 200;
    results['Test 23: Farmer Expense Update & Deletion'] = {
      passed: t23Passed,
      updateStatus: t23aRes.status,
      deleteStatus: t23bRes.status
    };
    console.log('Result:', t23Passed ? 'PASS (Updated to 1400, deleted cleanly)' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 5: NEGOTIATIONS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- DOMAIN 5: NEGOTIATIONS TESTING ---');

    // Test 24: Seller self-negotiation attempt on own product (prod-far-301 belongs to user-farmer-rafiq)
    console.log('\n[Test 24] Farmer attempts to negotiate on own product listing (prod-far-301)...');
    const t24Res = await request('POST', '/api/negotiations', {
      listingId: 'prod-far-301',
      offeredPricePerKg: 35.00,
      quantityKg: 500,
      message: 'Self negotiation attempt'
    }, { Cookie: farmerCookie });
    const t24Passed = t24Res.status === 400 && t24Res.data?.error?.includes('Cannot negotiate with your own listing');
    results['Test 24: Seller Self-Negotiation Rejection'] = { passed: t24Passed, status: t24Res.status, msg: t24Res.data?.error };
    console.log('Result:', t24Passed ? 'PASS (400 Self-Negotiation Blocked)' : 'FAIL', t24Res.status, t24Res.data);

    // Test 25: Buyer initiates negotiation offer via POST /api/negotiations
    console.log('\n[Test 25] Buyer (Wholesaler Sumaiya) initiates negotiation offer on prod-far-301...');
    const t25Res = await request('POST', '/api/negotiations', {
      listingId: 'prod-far-301',
      offeredPricePerKg: 34.00,
      quantityKg: 1000,
      message: 'Can take 1,000 kg immediately if priced at ৳34/kg.'
    }, { Cookie: wholesalerCookie });

    const t25Passed = t25Res.status === 201 && t25Res.data?.success === true &&
                      t25Res.data?.negotiation?.buyerId === 'user-wholesaler-sumaiya' &&
                      t25Res.data?.negotiation?.offeredPricePerKg === 34 &&
                      t25Res.data?.negotiation?.status === 'Pending';
    const negId = t25Res.data?.negotiation?.id;
    if (negId) createdTestIds.negotiations.push(negId);

    // Check seller notification was created in Neon
    const notifCheck = await client.query(`
      SELECT * FROM notifications 
      WHERE user_id = 'user-farmer-rafiq' AND type = 'negotiation'
      ORDER BY created_at DESC LIMIT 1
    `);
    const notifCreated = notifCheck.rows.length > 0 && notifCheck.rows[0].title === 'Price Negotiation Offer';
    if (notifCreated) createdTestIds.notifications.push(notifCheck.rows[0].id);

    results['Test 25: Buyer Negotiation Offer Creation & Seller Notification'] = {
      passed: t25Passed && notifCreated,
      status: t25Res.status,
      negId,
      notificationSent: notifCreated
    };
    console.log('Result:', (t25Passed && notifCreated) ? 'PASS (201 Created & Seller Notified in Neon)' : 'FAIL', {
      negId,
      notifTitle: notifCheck.rows[0]?.title
    });

    // Test 26: Negotiation participant privacy check
    console.log('\n[Test 26] Non-participant queries listing negotiations (should be filtered)...');
    const t26Res = await request('GET', '/api/negotiations?listingId=prod-far-301', null, { Cookie: consumerCookie });
    const t26Passed = t26Res.status === 200 && Array.isArray(t26Res.data?.negotiations) &&
                      !t26Res.data.negotiations.some(n => n.id === negId);
    results['Test 26: Negotiation Participant Privacy Isolation'] = {
      passed: t26Passed,
      status: t26Res.status,
      nonParticipantExposed: !t26Passed
    };
    console.log('Result:', t26Passed ? 'PASS (Non-participant cannot see negotiation details)' : 'FAIL');

    // Test 27: Seller counters negotiation offer via PUT /api/negotiations/:id
    console.log('\n[Test 27] Seller (Farmer Rafiq) counters offer at ৳36/kg...');
    const t27Res = await request('PUT', `/api/negotiations/${negId}`, {
      status: 'Countered',
      counterPrice: 36.00
    }, { Cookie: farmerCookie });
    const t27Passed = t27Res.status === 200 && t27Res.data?.success === true &&
                      t27Res.data?.negotiation?.status === 'Countered' &&
                      t27Res.data?.negotiation?.counterPrice === 36;
    results['Test 27: Seller Counter-Offer Transition'] = {
      passed: t27Passed,
      status: t27Res.status,
      newStatus: t27Res.data?.negotiation?.status,
      counterPrice: t27Res.data?.negotiation?.counterPrice
    };
    console.log('Result:', t27Passed ? 'PASS (Status Countered, counterPrice: 36)' : 'FAIL', t27Res.data?.negotiation);

    // Test 28: Buyer accepts counter-offer via PUT /api/negotiations/:id
    console.log('\n[Test 28] Buyer (Wholesaler Sumaiya) accepts seller counter-offer...');
    const t28Res = await request('PUT', `/api/negotiations/${negId}`, {
      status: 'Accepted'
    }, { Cookie: wholesalerCookie });
    const t28Passed = t28Res.status === 200 && t28Res.data?.success === true &&
                      t28Res.data?.negotiation?.status === 'Accepted';
    results['Test 28: Buyer Accept Counter-Offer Transition'] = {
      passed: t28Passed,
      status: t28Res.status,
      finalStatus: t28Res.data?.negotiation?.status
    };
    console.log('Result:', t28Passed ? 'PASS (Status Accepted)' : 'FAIL', t28Res.data?.negotiation);

    // Test 29: Unauthorized user negotiation modification attempt
    console.log('\n[Test 29] Unauthorized user attempts to modify negotiation...');
    const t29Res = await request('PUT', `/api/negotiations/${negId}`, {
      status: 'Rejected'
    }, { Cookie: retailerCookie });
    const t29Passed = t29Res.status === 403 && t29Res.data?.error?.includes('You are not a participant');
    results['Test 29: Unauthorized Negotiation Modification Rejection'] = { passed: t29Passed, status: t29Res.status, msg: t29Res.data?.error };
    console.log('Result:', t29Passed ? 'PASS (403 Forbidden)' : 'FAIL', t29Res.status, t29Res.data);

    // ─────────────────────────────────────────────────────────────────────────────
    // DOMAIN 6: REGRESSION CHECK OF PREVIOUS DOMAINS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- DOMAIN 6: REGRESSION CHECK OF PREVIOUS DOMAINS ---');
    const [pRes, oRes, wRes, mRes, msgRes, connRes, notifRes] = await Promise.all([
      request('GET', '/api/products'),
      request('GET', '/api/orders', null, { Cookie: farmerCookie }),
      request('GET', '/api/wholesaler-offers'),
      request('GET', '/api/market-prices'),
      request('GET', '/api/messages?userA=user-wholesaler-sumaiya&userB=user-farmer-rafiq', null, { Cookie: wholesalerCookie }),
      request('GET', '/api/connections', null, { Cookie: farmerCookie }),
      request('GET', '/api/notifications', null, { Cookie: farmerCookie }),
    ]);

    const regressionPassed = pRes.status === 200 && Array.isArray(pRes.data?.products) &&
                             oRes.status === 200 && Array.isArray(oRes.data?.orders) &&
                             wRes.status === 200 && Array.isArray(wRes.data?.offers) &&
                             mRes.status === 200 && Array.isArray(mRes.data?.rates) &&
                             msgRes.status === 200 && Array.isArray(msgRes.data?.messages) &&
                             connRes.status === 200 && Array.isArray(connRes.data?.connections) &&
                             notifRes.status === 200 && Array.isArray(notifRes.data?.notifications);

    results['Test 30: Previous Domains Regression Check'] = {
      passed: regressionPassed,
      products: pRes.status,
      orders: oRes.status,
      wholesalerOffers: wRes.status,
      marketPrices: mRes.status,
      messages: msgRes.status,
      connections: connRes.status,
      notifications: notifRes.status
    };
    console.log('Result:', regressionPassed ? 'PASS (All 7 existing endpoints responding 200 OK)' : 'FAIL', {
      products: pRes.status,
      orders: oRes.status,
      wholesalerOffers: wRes.status,
      marketPrices: mRes.status,
      messages: msgRes.status,
      connections: connRes.status,
      notifications: notifRes.status
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // CLEANUP OF DISPOSABLE TEST RECORDS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- CLEANING UP DISPOSABLE TEST RECORDS ON dev-migration-test ---');
    for (const sid of createdTestIds.sessions) {
      await client.query('DELETE FROM sessions WHERE id = $1', [sid]);
    }
    for (const rid of createdTestIds.reviews) {
      await client.query('DELETE FROM reviews WHERE id = $1', [rid]);
    }
    for (const cid of createdTestIds.catalog) {
      await client.query('DELETE FROM catalog WHERE id = $1', [cid]);
    }
    for (const lid of createdTestIds.callLogs) {
      await client.query('DELETE FROM call_logs WHERE id = $1', [lid]);
    }
    for (const eid of createdTestIds.farmerExpenses) {
      await client.query('DELETE FROM farmer_expenses WHERE id = $1', [eid]);
    }
    for (const nid of createdTestIds.negotiations) {
      await client.query('DELETE FROM negotiations WHERE id = $1', [nid]);
    }
    for (const notifId of createdTestIds.notifications) {
      await client.query('DELETE FROM notifications WHERE id = $1', [notifId]);
    }
    console.log('✓ Disposable test records purged safely.');

    // Final Counts check
    const finalCounts = {
      catalog: parseInt((await client.query('SELECT count(*)::int as c FROM catalog')).rows[0].c),
      reviews: parseInt((await client.query('SELECT count(*)::int as c FROM reviews')).rows[0].c),
      callLogs: parseInt((await client.query('SELECT count(*)::int as c FROM call_logs')).rows[0].c),
      farmerExpenses: parseInt((await client.query('SELECT count(*)::int as c FROM farmer_expenses')).rows[0].c),
      negotiations: parseInt((await client.query('SELECT count(*)::int as c FROM negotiations')).rows[0].c),
    };
    console.log('Final row counts on dev-migration-test:', finalCounts);

    const countsMatch = finalCounts.catalog === preCounts.catalog &&
                        finalCounts.reviews === preCounts.reviews &&
                        finalCounts.callLogs === preCounts.callLogs &&
                        finalCounts.farmerExpenses === preCounts.farmerExpenses &&
                        finalCounts.negotiations === preCounts.negotiations;

    results['Test 31: Database State Restoration & Clean Row Counts'] = {
      passed: countsMatch,
      preCounts,
      finalCounts
    };
    console.log('Result:', countsMatch ? 'PASS (Exact row count match: catalog=80, others=0)' : 'FAIL');

    // Immutability Check
    const sqlitePostHash = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
    const jsonPostHash = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');
    const immutabilityPassed = sqlitePostHash === sqlitePreHash && jsonPostHash === jsonPreHash;

    results['Test 32: SQLite & JSON Database Immutability Check'] = {
      passed: immutabilityPassed,
      sqliteHash: sqlitePostHash,
      jsonHash: jsonPostHash
    };
    console.log('Result:', immutabilityPassed ? 'PASS (Source files 100% immutable)' : 'FAIL');

    const allPassed = Object.values(results).every(r => r.passed);
    console.log('\n=============================================');
    console.log(`ALL TESTS PASSED: ${allPassed ? 'YES — 100% SUCCESS' : 'NO — FAILURE DETECTED'}`);
    console.log('=============================================\n');

    fs.writeFileSync('server_data/phase3_3_test_results.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      allPassed,
      results,
      preCounts,
      finalCounts
    }, null, 2), 'utf8');

  } finally {
    client.release();
    await pool.end();
  }
}

runTestSuite().catch(err => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
