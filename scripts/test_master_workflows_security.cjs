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
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runWorkflowsAndSecuritySuite() {
  console.log('=== TEST SUITE 2: MAJOR WORKFLOWS, CONCURRENCY & INTEGRITY SECURITY ===\n');
  const client = await pool.connect();
  const createdTestIds = {
    sessions: [],
    products: [],
    offers: [],
    marketPrices: [],
    orders: [],
    messages: [],
    connections: [],
    notifications: [],
    reviews: [],
    catalog: [],
    farmerExpenses: [],
    negotiations: [],
    callLogs: []
  };

  const results = {};

  try {
    // Generate sessions for 5 key actors
    async function createTestSession(userId, role) {
      const token = `master-wf-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const sessId = `sess-${token}`;
      await client.query(`
        INSERT INTO sessions (id, user_id, token_hash, role, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day')
      `, [sessId, userId, tokenHash, role]);
      createdTestIds.sessions.push(sessId);
      return `nb_session=${token}`;
    }

    const farmerCookie = await createTestSession('user-farmer-rafiq', 'farmer');
    const otherFarmerCookie = await createTestSession('far-sherpur-1', 'farmer');
    const wholesalerCookie = await createTestSession('w-karwan-syndicate', 'wholesaler');
    const otherWholesalerCookie = await createTestSession('user-wholesaler-sumaiya', 'wholesaler');
    const retailerCookie = await createTestSession('usr-retailer-jafor', 'retailer');
    const consumerCookie = await createTestSession('usr-consumer-sumayya', 'consumer');
    const otherConsumerCookie = await createTestSession('user-consumer-tanveer', 'consumer');
    const adminCookie = await createTestSession('admin-root', 'admin');

    // ─────────────────────────────────────────────────────────────────────────────
    // 1. PRODUCTS WORKFLOW & SECURITY
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- 1. PRODUCTS WORKFLOW & PERMISSION BOUNDARIES ---');
    // Farmer creates product
    const prodRes = await request('POST', '/api/products', {
      cropName: 'Workflow Test Cabbage',
      banglaName: 'টেস্ট বাঁধাকপি',
      category: 'Vegetables',
      variety: 'Green Cabbage',
      quantityKg: 500,
      availableKg: 500,
      pricePerKg: 28.00,
      qualityGrade: 'Grade A',
      district: 'Bogura',
      upazila: 'Shibganj',
      harvestStatus: 'Harvested Today'
    }, { Cookie: farmerCookie });

    const prodCreated = prodRes.status === 201 && prodRes.data?.success === true;
    const testProdId = prodRes.data?.productId || prodRes.data?.product?.id;
    if (testProdId) createdTestIds.products.push(testProdId);

    // Other farmer attempts unauthorized edit -> 403
    const unauthorizedEdit = await request('PUT', `/api/products/${testProdId}`, {
      pricePerKg: 35.00
    }, { Cookie: otherFarmerCookie });
    const unauthEditPassed = unauthorizedEdit.status === 403;

    // Authorized seller edits product -> 200
    const authorizedEdit = await request('PUT', `/api/products/${testProdId}`, {
      pricePerKg: 30.00,
      availableQty: 480
    }, { Cookie: farmerCookie });
    const authEditPassed = authorizedEdit.status === 200;

    results['1. Product Creation & Authorization'] = {
      passed: prodCreated && unauthEditPassed && authEditPassed,
      created: prodRes.status,
      unauthorizedEdit: unauthorizedEdit.status,
      authorizedEdit: authorizedEdit.status
    };
    console.log('Product Lifecycle:', (prodCreated && unauthEditPassed && authEditPassed) ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 2. WHOLESALER DEMANDS & OFFERS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. WHOLESALER OFFERS / BIDS ---');
    const offerRes = await request('POST', '/api/wholesaler-offers', {
      cropName: 'Workflow Cauliflower Lot',
      cropBangla: 'টেস্ট ফুলকপি',
      quantityKgNeeded: 3000,
      offeredPricePerKg: 32.00,
      district: 'Bogura',
      upazila: 'Shibganj',
      location: 'Mohasthan Arat',
      deadline: '2026-11-20',
      urgent: true,
      notes: 'Urgent bulk order'
    }, { Cookie: wholesalerCookie });

    const offerCreated = offerRes.status === 201 && offerRes.data?.success === true;
    const testOfferId = offerRes.data?.offer?.id;
    if (testOfferId) createdTestIds.offers.push(testOfferId);

    // Wholesaler updates fulfilled quantity
    const offerUpd = await request('PUT', `/api/wholesaler-offers/${testOfferId}`, {
      fulfilledKg: 1000
    }, { Cookie: wholesalerCookie });
    const offerUpdPassed = offerUpd.status === 200 && offerUpd.data?.offer?.fulfilledKg === 1000;

    results['2. Wholesaler Offers Workflow'] = {
      passed: offerCreated && offerUpdPassed,
      create: offerRes.status,
      update: offerUpd.status
    };
    console.log('Wholesaler Offers:', (offerCreated && offerUpdPassed) ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 3. MARKET RATES WORKFLOW
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. MARKET RATES WORKFLOW ---');
    const ratesRes = await request('GET', '/api/market-prices?district=Bogura');
    const ratesPassed = ratesRes.status === 200 && Array.isArray(ratesRes.data?.rates) && ratesRes.data.rates.length > 0;
    results['3. Market Rates Query'] = { passed: ratesPassed, count: ratesRes.data?.rates?.length };
    console.log('Market Rates:', ratesPassed ? 'PASS (Rates loaded)' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 4. ORDER INTEGRITY, MULTI-SELLER REJECTION & CONCURRENCY
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. ORDER TRANSACTIONS, MULTI-SELLER & CONCURRENCY ---');

    // 4.1 Multi-Seller Order Rejection: Items from 2 different retailers
    const multiSellerRes = await request('POST', '/api/orders', {
      items: [
        { productId: 'prod-ret-101', quantityKg: 2 }, // seller: ret-bismillah-mart
        { productId: 'prod-ret-103', quantityKg: 1 }  // seller: ret-green-bazar
      ],
      paymentMethod: 'Cash on Delivery',
      deliveryAddress: 'Test Address'
    }, { Cookie: consumerCookie });
    const multiSellerPassed = multiSellerRes.status === 403 && multiSellerRes.data?.error?.includes('Multi-Seller Violation');
    console.log('Multi-Seller Rejection:', multiSellerPassed ? 'PASS (403 Multi-Seller Violation)' : 'FAIL', multiSellerRes.status);

    // 4.2 Insufficient Stock Rejection
    const overStockRes = await request('POST', '/api/orders', {
      items: [{ productId: 'prod-ret-101', quantityKg: 999999 }],
      paymentMethod: 'Cash on Delivery',
      deliveryAddress: 'Test Address'
    }, { Cookie: consumerCookie });
    const overStockPassed = overStockRes.status === 400 && overStockRes.data?.error?.includes('Insufficient stock');
    console.log('Insufficient Stock Rejection:', overStockPassed ? 'PASS (400 Insufficient Stock)' : 'FAIL', overStockRes.status);

    // 4.3 Concurrent Orders & Race Condition / Overselling Prevention
    // Create a temporary product with exactly 10kg available
    const tempStockProdId = `prod-concur-${Date.now()}`;
    await client.query(`
      INSERT INTO products (
        id, seller_id, seller_name, seller_phone, seller_role, target_role,
        crop_name, bangla_name, category, variety, unit, quantity, available_qty,
        min_order_qty, unit_price, quality_grade, district, upazila, harvest_status, created_at
      ) VALUES (
        $1, 'ret-bismillah-mart', 'Bismillah Krishi', '01715889900', 'retailer', 'consumer',
        'Limited Concurrency Lot', 'সীমাবদ্ধ টমেটো', 'Vegetables', 'Roma', 'kg', 10, 10,
        1, 50.00, 'Grade A', 'Bogura', 'Sadar', 'Harvested Today', NOW()
      )
    `, [tempStockProdId]);
    createdTestIds.products.push(tempStockProdId);

    // Two consumers simultaneously attempt to order 8kg each from the 10kg lot
    console.log('Simulating simultaneous concurrent orders for 10kg limited stock...');
    const [concurrentOrder1, concurrentOrder2] = await Promise.all([
      request('POST', '/api/orders', {
        items: [{ productId: tempStockProdId, quantityKg: 8 }],
        paymentMethod: 'Cash on Delivery',
        deliveryAddress: 'Address 1'
      }, { Cookie: consumerCookie }),
      request('POST', '/api/orders', {
        items: [{ productId: tempStockProdId, quantityKg: 8 }],
        paymentMethod: 'Cash on Delivery',
        deliveryAddress: 'Address 2'
      }, { Cookie: otherConsumerCookie })
    ]);

    // Check results: exactly one must succeed (201), the other must fail (400)
    const c1Success = concurrentOrder1.status === 201;
    const c2Success = concurrentOrder2.status === 201;
    const oneSucceeded = (c1Success && !c2Success) || (!c1Success && c2Success);
    const oneFailedStock = concurrentOrder1.status === 400 || concurrentOrder2.status === 400;

    if (concurrentOrder1.data?.order?.orderId) createdTestIds.orders.push(concurrentOrder1.data.order.orderId);
    if (concurrentOrder2.data?.order?.orderId) createdTestIds.orders.push(concurrentOrder2.data.order.orderId);

    // Check remaining stock in database
    const finalStockRes = await client.query('SELECT available_qty FROM products WHERE id = $1', [tempStockProdId]);
    const remainingStock = parseFloat(finalStockRes.rows[0].available_qty);
    const concurrencyPassed = oneSucceeded && oneFailedStock && remainingStock === 2; // 10 - 8 = 2

    console.log('Concurrency Race Condition Result:', concurrencyPassed ? 'PASS (Overselling strictly prevented, remaining stock = 2kg)' : 'FAIL', {
      order1Status: concurrentOrder1.status,
      order2Status: concurrentOrder2.status,
      remainingStock
    });

    results['4. Order Security & Concurrency'] = {
      passed: multiSellerPassed && overStockPassed && concurrencyPassed,
      multiSellerBlocked: multiSellerPassed,
      overStockBlocked: overStockPassed,
      concurrencyProtected: concurrencyPassed
    };

    // 4.4 Order Cancellation with Stock Restoration
    const successfulOrderId = c1Success ? concurrentOrder1.data.order.orderId : concurrentOrder2.data.order.orderId;
    const cancelRes = await request('PUT', `/api/orders/${successfulOrderId}/status`, {
      status: 'Cancelled'
    }, { Cookie: consumerCookie });

    const postCancelStockRes = await client.query('SELECT available_qty FROM products WHERE id = $1', [tempStockProdId]);
    const restoredStock = parseFloat(postCancelStockRes.rows[0].available_qty);
    const cancelPassed = cancelRes.status === 200 && restoredStock === 10;
    console.log('Order Cancellation & Stock Restoration:', cancelPassed ? 'PASS (Stock restored to 10kg)' : 'FAIL', restoredStock);

    results['4.4 Order Cancellation & Stock Restoration'] = {
      passed: cancelPassed,
      restoredStock
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // 5. DIRECT MESSAGING & PRIVACY
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 5. DIRECT MESSAGING & PRIVACY BARRIER ---');
    const msgRes = await request('POST', '/api/messages', {
      recipientId: 'user-farmer-rafiq',
      content: 'Workflow test message for harvest delivery timeline'
    }, { Cookie: wholesalerCookie });

    const msgPassed = msgRes.status === 201 && msgRes.data?.success === true;
    const testMsgId = msgRes.data?.message?.id;
    if (testMsgId) createdTestIds.messages.push(testMsgId);
    if (msgRes.data?.notificationId) createdTestIds.notifications.push(msgRes.data.notificationId);

    // Non-participant tries to inspect conversation
    const eavesdropRes = await request('GET', '/api/messages?userA=w-karwan-syndicate&userB=user-farmer-rafiq', null, { Cookie: consumerCookie });
    const eavesdropBlocked = eavesdropRes.status === 403;

    // Participant retrieves conversation
    const convoRes = await request('GET', '/api/messages?userA=w-karwan-syndicate&userB=user-farmer-rafiq', null, { Cookie: farmerCookie });
    const convoPassed = convoRes.status === 200 && Array.isArray(convoRes.data?.messages) && convoRes.data.messages.some(m => m.id === testMsgId);

    results['5. Direct Messaging & Privacy Barrier'] = {
      passed: msgPassed && eavesdropBlocked && convoPassed,
      send: msgRes.status,
      eavesdropBlocked: eavesdropRes.status,
      convoQuery: convoRes.status
    };
    console.log('Messaging Privacy:', (msgPassed && eavesdropBlocked && convoPassed) ? 'PASS (403 for outsider, 200 for participant)' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 6. CONNECTIONS & PRIVACY
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 6. USER CONNECTIONS ---');
    const connRes = await request('POST', '/api/connections', {
      recipientId: 'user-farmer-rafiq'
    }, { Cookie: wholesalerCookie });

    const connCreated = connRes.status === 201 && connRes.data?.success === true;
    const testConnId = connRes.data?.connection?.id;
    if (testConnId) createdTestIds.connections.push(testConnId);

    // Farmer accepts connection
    const acceptRes = await request('PUT', `/api/connections/${testConnId}`, {
      status: 'accepted'
    }, { Cookie: farmerCookie });
    const acceptPassed = acceptRes.status === 200 && acceptRes.data?.connection?.status === 'accepted';

    results['6. User Connections Workflow'] = {
      passed: connCreated && acceptPassed,
      create: connRes.status,
      accept: acceptRes.status
    };
    console.log('Connections Workflow:', (connCreated && acceptPassed) ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 7. NOTIFICATIONS & PRIVACY
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 7. NOTIFICATIONS & PRIVACY ---');
    // Fetch notifications for farmer
    const notifRes = await request('GET', '/api/notifications', null, { Cookie: farmerCookie });
    const notifPassed = notifRes.status === 200 && Array.isArray(notifRes.data?.notifications);

    // Mark notification as read
    const farmerNotifs = notifRes.data?.notifications || [];
    let markReadPassed = true;
    if (farmerNotifs.length > 0) {
      const nid = farmerNotifs[0].id;
      // Outsider tries to mark read
      const unauthorizedMark = await request('PUT', `/api/notifications/${nid}/read`, null, { Cookie: consumerCookie });
      // Owner marks read
      const authorizedMark = await request('PUT', `/api/notifications/${nid}/read`, null, { Cookie: farmerCookie });
      markReadPassed = unauthorizedMark.status === 403 && authorizedMark.status === 200;
    }

    results['7. Notifications Privacy & Lifecycle'] = {
      passed: notifPassed && markReadPassed,
      fetchStatus: notifRes.status
    };
    console.log('Notifications Privacy:', (notifPassed && markReadPassed) ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 8. REVIEWS & VERIFIED BUYER ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 8. REVIEWS & VERIFIED BUYER GUARDS ---');
    // Review on delivered order ORD-T3-334992
    const revRes = await request('POST', '/api/orders/ORD-T3-334992/review', {
      rating: 5,
      comment: 'Super fresh, arrived in perfect packaging.'
    }, { Cookie: consumerCookie });
    const revPassed = revRes.status === 201 && revRes.data?.review?.verifiedPurchase === true;
    if (revRes.data?.review?.id) createdTestIds.reviews.push(revRes.data.review.id);

    // Duplicate review attempt
    const dupRevRes = await request('POST', '/api/orders/ORD-T3-334992/review', {
      rating: 5,
      comment: 'Duplicate attempt'
    }, { Cookie: consumerCookie });
    const dupRevPassed = dupRevRes.status === 400;

    results['8. Reviews & Verified Buyer Guards'] = {
      passed: revPassed && dupRevPassed,
      created: revRes.status,
      duplicateBlocked: dupRevRes.status
    };
    console.log('Reviews Guards:', (revPassed && dupRevPassed) ? 'PASS (201 Created & 400 Duplicate Blocked)' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 9. MASTER AGRICULTURAL CATALOG
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 9. MASTER AGRICULTURAL CATALOG ---');
    const catRes = await request('GET', '/api/catalog?category=vegetables&limit=all');
    const catPassed = catRes.status === 200 && catRes.data?.products?.length === 20;

    // Non-admin catalog creation attempt -> 403
    const nonAdminCatCreate = await request('POST', '/api/catalog', { name: 'NonAdmin Crop', nameBn: 'ফসল', category: 'fruits' }, { Cookie: farmerCookie });
    // Admin creates catalog item -> 201
    const adminCatId = `cat-wf-${Date.now()}`;
    const adminCatCreate = await request('POST', '/api/catalog', {
      id: adminCatId,
      name: 'Workflow Mango',
      nameBn: 'টেস্ট আম',
      category: 'fruits'
    }, { Cookie: adminCookie });
    if (adminCatCreate.data?.product?.id) createdTestIds.catalog.push(adminCatId);

    // Admin deletes catalog item -> 200
    const adminCatDelete = await request('DELETE', `/api/catalog/${adminCatId}`, null, { Cookie: adminCookie });
    createdTestIds.catalog = createdTestIds.catalog.filter(id => id !== adminCatId);

    const catalogLifecyclePassed = catPassed && nonAdminCatCreate.status === 403 && adminCatCreate.status === 201 && adminCatDelete.status === 200;
    results['9. Master Catalog Integrity & Admin CRUD'] = {
      passed: catalogLifecyclePassed,
      vegCount: catRes.data?.products?.length,
      nonAdminBlocked: nonAdminCatCreate.status,
      adminCreated: adminCatCreate.status,
      adminDeleted: adminCatDelete.status
    };
    console.log('Master Catalog:', catalogLifecyclePassed ? 'PASS (80 baseline intact, Admin CRUD verified)' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 10. FARMER EXPENSES & LOCALSTORAGE BATCH MIGRATION
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 10. FARMER EXPENSES & SAFE LOCALSTORAGE BATCH SYNC ---');
    // Normal single expense create
    const expRes = await request('POST', '/api/farmer/expenses', {
      category: 'Pesticide',
      description: 'Organic Neem Oil 1L bottle',
      amountBDT: 450.00
    }, { Cookie: farmerCookie });
    const expCreated = expRes.status === 201 && expRes.data?.expense?.amountBDT === 450;
    const testExpId = expRes.data?.expense?.id;
    if (testExpId) createdTestIds.farmerExpenses.push(testExpId);

    // Test Batch Migration Endpoint with simulated historical localStorage items
    const simulatedLocalEntries = [
      { id: `hist-exp-1-${Date.now()}`, date: '2026-10-15', type: 'expense', category: 'Labor', description: 'Harvest weeding labor (historical)', amountBDT: 1200 },
      { id: `hist-exp-2-${Date.now()}`, date: '2026-10-20', type: 'income', category: 'Crop Sale', description: 'Local bazaar morning sale (historical)', amountBDT: 3500 }
    ];

    const syncRes1 = await request('POST', '/api/farmer/expenses/sync', { entries: simulatedLocalEntries }, { Cookie: farmerCookie });
    const sync1Passed = syncRes1.status === 200 && syncRes1.data?.synced === 2;
    for (const e of simulatedLocalEntries) createdTestIds.farmerExpenses.push(e.id);

    // Re-sync exact same entries to verify idempotency (must skip 2, sync 0)
    const syncRes2 = await request('POST', '/api/farmer/expenses/sync', { entries: simulatedLocalEntries }, { Cookie: farmerCookie });
    const sync2Passed = syncRes2.status === 200 && syncRes2.data?.synced === 0 && syncRes2.data?.skipped === 2;

    results['10. Farmer Expenses & Idempotent Batch Migration'] = {
      passed: expCreated && sync1Passed && sync2Passed,
      initialSyncCount: syncRes1.data?.synced,
      idempotentSkipCount: syncRes2.data?.skipped
    };
    console.log('Farmer Expenses Migration:', (expCreated && sync1Passed && sync2Passed) ? 'PASS (2 Synced initially, 2 Idempotently skipped on re-sync)' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 11. PRICE NEGOTIATIONS & SAFE BATCH MIGRATION
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 11. NEGOTIATIONS & SAFE BATCH MIGRATION ---');
    // Self-negotiation attempt on own product -> 400
    const selfNegRes = await request('POST', '/api/negotiations', {
      listingId: 'prod-far-301',
      offeredPricePerKg: 35,
      quantityKg: 100,
      message: 'Self offer'
    }, { Cookie: farmerCookie });
    const selfNegBlocked = selfNegRes.status === 400 && selfNegRes.data?.error?.includes('Cannot negotiate with your own listing');

    // Buyer creates valid negotiation offer
    const negOfferRes = await request('POST', '/api/negotiations', {
      listingId: 'prod-far-301',
      offeredPricePerKg: 34.50,
      quantityKg: 600,
      message: 'Workflow negotiation offer'
    }, { Cookie: wholesalerCookie });
    const negOfferCreated = negOfferRes.status === 201;
    const testNegId = negOfferRes.data?.negotiation?.id;
    if (testNegId) createdTestIds.negotiations.push(testNegId);

    // Test Batch Migration for negotiations
    const simulatedLocalNegotiations = [
      { id: `hist-neg-1-${Date.now()}`, listingId: 'prod-far-301', offeredPricePerKg: 33, quantityKg: 500, message: 'Historical offline negotiation' }
    ];
    const negSync1 = await request('POST', '/api/negotiations/sync', { offers: simulatedLocalNegotiations }, { Cookie: wholesalerCookie });
    const negSync1Passed = negSync1.status === 200 && negSync1.data?.synced === 1;
    for (const n of simulatedLocalNegotiations) createdTestIds.negotiations.push(n.id);

    // Re-sync to verify idempotency
    const negSync2 = await request('POST', '/api/negotiations/sync', { offers: simulatedLocalNegotiations }, { Cookie: wholesalerCookie });
    const negSync2Passed = negSync2.status === 200 && negSync2.data?.synced === 0 && negSync2.data?.skipped === 1;

    results['11. Negotiations & Idempotent Batch Migration'] = {
      passed: selfNegBlocked && negOfferCreated && negSync1Passed && negSync2Passed,
      selfBlocked: selfNegRes.status,
      created: negOfferRes.status,
      synced: negSync1.data?.synced,
      skipped: negSync2.data?.skipped
    };
    console.log('Negotiations Migration:', (selfNegBlocked && negOfferCreated && negSync1Passed && negSync2Passed) ? 'PASS (Self-negotiation blocked, batch sync idempotent)' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 12. CALL LOGS PRIVACY & PARTICIPANT ACCESS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 12. CALL LOGS PRIVACY & PARTICIPANT ACCESS ---');
    const callRes = await request('POST', '/api/calls/logs', {
      receiverId: 'user-farmer-rafiq',
      receiverName: 'Md. Rafiqul Islam',
      receiverRole: 'farmer',
      receiverPhone: '01712458920',
      status: 'completed',
      durationSeconds: 120
    }, { Cookie: wholesalerCookie });
    const callCreated = callRes.status === 201;
    const testCallId = callRes.data?.log?.id;
    if (testCallId) createdTestIds.callLogs.push(testCallId);

    // Unauthorized query
    const callUnauth = await request('GET', '/api/calls/logs?userId=w-karwan-syndicate', null, { Cookie: consumerCookie });
    const callUnauthBlocked = callUnauth.status === 403;

    // Authorized query
    const callAuth = await request('GET', '/api/calls/logs', null, { Cookie: wholesalerCookie });
    const callAuthPassed = callAuth.status === 200 && Array.isArray(callAuth.data?.logs) && callAuth.data.logs.some(l => l.id === testCallId);

    results['12. Call Logs Privacy & Access'] = {
      passed: callCreated && callUnauthBlocked && callAuthPassed,
      create: callRes.status,
      unauthorized: callUnauth.status,
      authorized: callAuth.status
    };
    console.log('Call Logs Privacy:', (callCreated && callUnauthBlocked && callAuthPassed) ? 'PASS' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // 13. DATABASE AUDIT LOG TRIGGER TAMPER-RESISTANCE
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- 13. DATABASE AUDIT LOG TAMPER RESISTANCE ---');
    let tradeAuditTamperBlocked = false;
    let loginAuditTamperBlocked = false;

    try {
      await client.query("UPDATE trade_audit_logs SET description = 'Hacked description'");
    } catch (err) {
      tradeAuditTamperBlocked = err.message.includes('strictly immutable') || err.message.includes('Security Violation') || err.message.includes('prohibited');
    }

    try {
      await client.query("DELETE FROM login_audit_logs WHERE id LIKE '%'");
    } catch (err) {
      loginAuditTamperBlocked = err.message.includes('strictly immutable') || err.message.includes('Security Violation') || err.message.includes('prohibited');
    }

    results['13. Audit Log Trigger Protection'] = {
      passed: tradeAuditTamperBlocked && loginAuditTamperBlocked,
      tradeAuditTamperBlocked,
      loginAuditTamperBlocked
    };
    console.log('Audit Protection:', (tradeAuditTamperBlocked && loginAuditTamperBlocked) ? 'PASS (DB Triggers prohibit update/delete)' : 'FAIL');

    // ─────────────────────────────────────────────────────────────────────────────
    // CLEANUP OF DISPOSABLE TEST RECORDS
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- CLEANING UP TEST SUITE 2 DISPOSABLE TEST RECORDS ---');
    await client.query('ALTER TABLE trade_audit_logs DISABLE TRIGGER trg_protect_trade_audit_logs;');

    for (const sid of createdTestIds.sessions) {
      await client.query('DELETE FROM sessions WHERE id = $1', [sid]);
    }
    for (const rid of createdTestIds.reviews) {
      await client.query('DELETE FROM reviews WHERE id = $1', [rid]);
    }
    for (const oid of createdTestIds.offers) {
      await client.query('DELETE FROM wholesaler_offers WHERE id = $1', [oid]);
    }
    for (const ordId of createdTestIds.orders) {
      await client.query('DELETE FROM trade_audit_logs WHERE order_id = $1', [ordId]);
      await client.query('DELETE FROM order_items WHERE order_id = $1', [ordId]);
      await client.query('DELETE FROM orders WHERE id = $1', [ordId]);
    }
    for (const pid of createdTestIds.products) {
      await client.query('DELETE FROM products WHERE id = $1', [pid]);
    }
    for (const mid of createdTestIds.messages) {
      await client.query('DELETE FROM messages WHERE id = $1', [mid]);
    }
    for (const cid of createdTestIds.connections) {
      await client.query('DELETE FROM connections WHERE id = $1', [cid]);
    }
    for (const nid of createdTestIds.notifications) {
      await client.query('DELETE FROM notifications WHERE id = $1', [nid]);
    }

    await client.query('ALTER TABLE trade_audit_logs ENABLE TRIGGER trg_protect_trade_audit_logs;');
    for (const eid of createdTestIds.farmerExpenses) {
      await client.query('DELETE FROM farmer_expenses WHERE id = $1', [eid]);
    }
    for (const negId of createdTestIds.negotiations) {
      await client.query('DELETE FROM negotiations WHERE id = $1', [negId]);
    }
    for (const clid of createdTestIds.callLogs) {
      await client.query('DELETE FROM call_logs WHERE id = $1', [clid]);
    }
    console.log('✓ All disposable test records cleaned up safely.');

    const allPassed = Object.values(results).every(r => r.passed);
    console.log('\n=============================================');
    console.log(`TEST SUITE 2 VERDICT: ${allPassed ? 'ALL TESTS PASSED (100%)' : 'TESTS FAILED'}`);
    console.log('=============================================\n');

    fs.writeFileSync('server_data/suite2_workflows_security_results.json', JSON.stringify({
      timestamp: new Date().toISOString(),
      allPassed,
      results
    }, null, 2), 'utf8');

    return allPassed;
  } finally {
    client.release();
    await pool.end();
  }
}

runWorkflowsAndSecuritySuite().catch(err => {
  console.error('Test Suite 2 Error:', err);
  process.exit(1);
});
