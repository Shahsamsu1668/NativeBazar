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
  console.log('=== PHASE 3.2 COMPREHENSIVE RUNTIME TEST SUITE ===\n');

  const client = await pool.connect();
  const createdTestIds = {
    sessions: [],
    offers: [],
    marketPrices: [],
    messages: [],
    connections: [],
    notifications: []
  };

  const results = {};

  try {
    // 0. Initial Hashes and Pre-test Counts
    const sqlitePreHash = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
    const jsonPreHash = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');

    const preCounts = {
      offers: parseInt((await client.query('SELECT count(*)::int as c FROM wholesaler_offers')).rows[0].c),
      prices: parseInt((await client.query('SELECT count(*)::int as c FROM market_prices')).rows[0].c),
      messages: parseInt((await client.query('SELECT count(*)::int as c FROM messages')).rows[0].c),
      connections: parseInt((await client.query('SELECT count(*)::int as c FROM connections')).rows[0].c),
      notifications: parseInt((await client.query('SELECT count(*)::int as c FROM notifications')).rows[0].c),
    };
    console.log('Pre-test row counts on dev-migration-test:', preCounts);

    // Helper to generate sessions
    async function createTestSession(userId, role) {
      const token = `phase32-sess-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const sessId = `sess-${token}`;
      await client.query(`
        INSERT INTO sessions (id, user_id, token_hash, role, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day')
      `, [sessId, userId, tokenHash, role]);
      createdTestIds.sessions.push(sessId);
      return `nb_session=${token}`;
    }

    console.log('\nCreating isolated test sessions...');
    const wholesaler1Cookie = await createTestSession('user-wholesaler-sumaiya', 'wholesaler');
    const wholesaler2Cookie = await createTestSession('w-karwan-syndicate', 'wholesaler');
    const farmerCookie = await createTestSession('user-farmer-rafiq', 'farmer');
    const retailerCookie = await createTestSession('usr-retailer-jafor', 'retailer');
    const adminCookie = await createTestSession('admin-root', 'admin');
    console.log('✓ All test sessions active.');

    // ── TEST 1: Wholesaler Demand / Offer Creation & Retrieval
    console.log('\n--- Test 1: Wholesaler Offer Creation & Retrieval ---');
    const offerPayload = {
      cropName: 'P32 Test Premium Tomatoes',
      cropBangla: 'টেস্ট প্রিমিয়াম টমেটো',
      quantityKgNeeded: 2500,
      offeredPricePerKg: 42.5,
      district: 'Bogura',
      upazila: 'Shibganj',
      location: 'Mahasthangarh Arat',
      deadline: 'Within 5 days',
      urgent: true,
      notes: 'High demand for Karwan corridor'
    };

    const createOfferRes = await request('POST', '/api/wholesaler-offers', offerPayload, { Cookie: wholesaler1Cookie });
    const offerId = createOfferRes.data?.offerId;
    if (offerId) createdTestIds.offers.push(offerId);

    const getOffersRes = await request('GET', `/api/wholesaler-offers?district=Bogura&crop=Tomatoes`);
    const createdOffer = (getOffersRes.data?.offers || []).find(o => o.id === offerId);

    const t1Passed = createOfferRes.status === 201 &&
                     Boolean(offerId) &&
                     Boolean(createdOffer) &&
                     createdOffer.wholesalerId === 'user-wholesaler-sumaiya' &&
                     createdOffer.quantityKgNeeded === 2500 &&
                     createdOffer.offeredPricePerKg === 42.5;

    results['Test 1: Wholesaler Offer Creation & Retrieval'] = {
      passed: t1Passed,
      status: createOfferRes.status,
      offerId,
      derivedWholesaler: createdOffer?.wholesalerId,
      urgent: createdOffer?.urgent
    };
    console.log('Test 1 Passed:', t1Passed);

    // ── TEST 2: Unauthorized Offer Modification & Deletion Rejection
    console.log('\n--- Test 2: Unauthorized Wholesaler Offer Modification Rejection ---');
    // Wholesaler 2 attempts to edit Wholesaler 1's offer
    const rogueEditRes = await request('PUT', `/api/wholesaler-offers/${offerId}`, {
      offeredPricePerKg: 10
    }, { Cookie: wholesaler2Cookie });

    // Wholesaler 2 attempts to delete Wholesaler 1's offer
    const rogueDeleteRes = await request('DELETE', `/api/wholesaler-offers/${offerId}`, null, { Cookie: wholesaler2Cookie });

    // Authorized Wholesaler 1 edits own offer
    const legitEditRes = await request('PUT', `/api/wholesaler-offers/${offerId}`, {
      offeredPricePerKg: 45
    }, { Cookie: wholesaler1Cookie });

    const t2Passed = rogueEditRes.status === 403 &&
                     rogueDeleteRes.status === 403 &&
                     legitEditRes.status === 200 &&
                     legitEditRes.data?.offer?.offeredPricePerKg === 45;

    results['Test 2: Unauthorized Offer Modification Rejection'] = {
      passed: t2Passed,
      rogueEditStatus: rogueEditRes.status,
      rogueDeleteStatus: rogueDeleteRes.status,
      legitEditStatus: legitEditRes.status,
      updatedPrice: legitEditRes.data?.offer?.offeredPricePerKg
    };
    console.log('Test 2 Passed:', t2Passed);

    // ── TEST 3: Market Rates Retrieval & Admin Authorized Updates
    console.log('\n--- Test 3: Market Rates Retrieval & Admin Authorization ---');
    const ratesRes = await request('GET', '/api/market-prices?district=Bogura');
    const ratesAliasRes = await request('GET', '/api/market-rates?district=Bogura');
    const intelRes = await request('GET', '/api/farmer/intelligence?district=Bogura');

    // Non-admin attempts to create market rate
    const unauthorizedRateCreate = await request('POST', '/api/market-prices', {
      district: 'Bogura',
      marketName: 'Rogue Market',
      cropName: 'Rogue Crop',
      banglaName: 'রোগ ক্রপ',
      wholesalePrice: 100,
      retailPrice: 120
    }, { Cookie: farmerCookie });

    // Admin creates market rate
    const adminRateCreate = await request('POST', '/api/market-prices', {
      district: 'Bogura',
      upazila: 'Sadar',
      marketName: 'Fateh Ali Bazar',
      cropName: 'P32 Special Maize',
      banglaName: 'স্পেশাল ভুট্টা',
      category: 'Grains',
      wholesalePrice: 28,
      wholesaleDhaka: 32,
      retailPrice: 35,
      unit: 'kg',
      change24h: 1.5,
      trend: 'rising'
    }, { Cookie: adminCookie });

    const newRateId = adminRateCreate.data?.rate?.id;
    if (newRateId) createdTestIds.marketPrices.push(newRateId);

    // Admin updates market rate
    const adminRateUpdate = await request('PUT', `/api/market-prices/${newRateId}`, {
      wholesalePrice: 30,
      retailPrice: 38
    }, { Cookie: adminCookie });

    const t3Passed = ratesRes.status === 200 &&
                     ratesAliasRes.status === 200 &&
                     intelRes.status === 200 &&
                     intelRes.data?.marketRates?.length > 0 &&
                     unauthorizedRateCreate.status === 403 &&
                     adminRateCreate.status === 201 &&
                     adminRateUpdate.status === 200 &&
                     adminRateUpdate.data?.rate?.wholesalePrice === 30;

    results['Test 3: Market Rates Retrieval & Admin Authorization'] = {
      passed: t3Passed,
      ratesCount: ratesRes.data?.rates?.length,
      unauthorizedStatus: unauthorizedRateCreate.status,
      adminCreateStatus: adminRateCreate.status,
      adminUpdateStatus: adminRateUpdate.status,
      updatedWholesale: adminRateUpdate.data?.rate?.wholesalePrice
    };
    console.log('Test 3 Passed:', t3Passed);

    // ── TEST 4: Direct Messaging - Identity Derivation & Forged Sender Rejection
    console.log('\n--- Test 4: Direct Messaging Identity Derivation ---');
    // Wholesaler 1 sends message to Farmer, with spoofed senderId
    const msgPayload = {
      senderId: 'admin-root', // Attempted forgery
      senderName: 'Fake Admin',
      recipientId: 'user-farmer-rafiq',
      content: 'Hello Rafiq, we need 500kg of grade-A potatoes.'
    };

    const sendMsgRes = await request('POST', '/api/messages', msgPayload, { Cookie: wholesaler1Cookie });
    const sentMsg = sendMsgRes.data?.message;
    if (sentMsg?.id) createdTestIds.messages.push(sentMsg.id);
    if (sendMsgRes.data?.notificationId) createdTestIds.notifications.push(sendMsgRes.data.notificationId);

    // Test nonexistent recipient
    const badRecipRes = await request('POST', '/api/messages', {
      recipientId: 'nonexistent-user-id-999',
      content: 'Hello anyone?'
    }, { Cookie: wholesaler1Cookie });

    // Test empty content
    const emptyContentRes = await request('POST', '/api/messages', {
      recipientId: 'user-farmer-rafiq',
      content: '   '
    }, { Cookie: wholesaler1Cookie });

    const t4Passed = sendMsgRes.status === 201 &&
                     sentMsg.senderId === 'user-wholesaler-sumaiya' && // Forgery overridden
                     sentMsg.recipientId === 'user-farmer-rafiq' &&
                     badRecipRes.status === 404 &&
                     emptyContentRes.status === 400;

    results['Test 4: Direct Messaging Identity Derivation'] = {
      passed: t4Passed,
      status: sendMsgRes.status,
      derivedSender: sentMsg?.senderId,
      badRecipStatus: badRecipRes.status,
      emptyContentStatus: emptyContentRes.status
    };
    console.log('Test 4 Passed:', t4Passed);

    // ── TEST 5: Direct Messaging - Privacy Boundary & Read State
    console.log('\n--- Test 5: Messaging Privacy & Read State ---');
    // Authorized query: Wholesaler 1 queries conversation with Farmer
    const legitConvo = await request('GET', `/api/messages?userA=user-wholesaler-sumaiya&userB=user-farmer-rafiq`, null, { Cookie: wholesaler1Cookie });

    // Unauthorized query: Retailer queries conversation between Wholesaler 1 and Farmer
    const eavesdropConvo = await request('GET', `/api/messages?userA=user-wholesaler-sumaiya&userB=user-farmer-rafiq`, null, { Cookie: retailerCookie });

    // Farmer marks messages from Wholesaler 1 as read
    const markReadRes = await request('PUT', '/api/messages/read', {
      senderId: 'user-wholesaler-sumaiya'
    }, { Cookie: farmerCookie });

    // Verify in Neon that the message is now read = true
    const checkReadRes = await client.query('SELECT read FROM messages WHERE id = $1', [sentMsg.id]);
    const isNowRead = checkReadRes.rows[0]?.read === true;

    const t5Passed = legitConvo.status === 200 &&
                     legitConvo.data?.messages?.some(m => m.id === sentMsg.id) &&
                     eavesdropConvo.status === 403 &&
                     markReadRes.status === 200 &&
                     isNowRead;

    results['Test 5: Messaging Privacy & Read State'] = {
      passed: t5Passed,
      legitConvoStatus: legitConvo.status,
      eavesdropStatus: eavesdropConvo.status,
      markReadStatus: markReadRes.status,
      dbReadStatus: isNowRead
    };
    console.log('Test 5 Passed:', t5Passed);

    // ── TEST 6: User Connections - Creation & Self/Nonexistent Rejection
    console.log('\n--- Test 6: Connection Request Creation & Validations ---');
    // Self-connection attempt
    const selfConnRes = await request('POST', '/api/connections', {
      recipientId: 'user-wholesaler-sumaiya'
    }, { Cookie: wholesaler1Cookie });

    // Nonexistent recipient attempt
    const badConnRes = await request('POST', '/api/connections', {
      recipientId: 'nonexistent-user-999'
    }, { Cookie: wholesaler1Cookie });

    // Legitimate connection request to Retailer (usr-retailer-jafor)
    const legitConnRes = await request('POST', '/api/connections', {
      recipientId: 'usr-retailer-jafor'
    }, { Cookie: wholesaler1Cookie });

    const newConnId = legitConnRes.data?.connection?.id;
    if (newConnId && legitConnRes.status === 201) {
      createdTestIds.connections.push(newConnId);
    }

    const t6Passed = selfConnRes.status === 400 &&
                     badConnRes.status === 404 &&
                     legitConnRes.status === 201 &&
                     legitConnRes.data?.connection?.status === 'pending' &&
                     legitConnRes.data?.connection?.requesterId === 'user-wholesaler-sumaiya' &&
                     legitConnRes.data?.connection?.recipientId === 'usr-retailer-jafor';

    results['Test 6: Connection Request Creation & Validations'] = {
      passed: t6Passed,
      selfConnStatus: selfConnRes.status,
      badConnStatus: badConnRes.status,
      legitConnStatus: legitConnRes.status,
      connStatus: legitConnRes.data?.connection?.status
    };
    console.log('Test 6 Passed:', t6Passed);

    // ── TEST 7: Duplicate Connection Prevention
    console.log('\n--- Test 7: Duplicate Connection Prevention ---');
    const dupConnRes = await request('POST', '/api/connections', {
      recipientId: 'usr-retailer-jafor'
    }, { Cookie: wholesaler1Cookie });

    const t7Passed = dupConnRes.status === 400 && dupConnRes.data?.error?.includes('already');

    results['Test 7: Duplicate Connection Prevention'] = {
      passed: t7Passed,
      status: dupConnRes.status,
      errorMsg: dupConnRes.data?.error
    };
    console.log('Test 7 Passed:', t7Passed);

    // ── TEST 8: Connection State Transition Authorization
    console.log('\n--- Test 8: Connection State Transition Authorization ---');
    // Requester (Wholesaler 1) tries to accept own request -> should fail with 403
    const requesterAccept = await request('PUT', `/api/connections/${newConnId}`, {
      status: 'accepted'
    }, { Cookie: wholesaler1Cookie });

    // Third-party (Farmer) tries to accept -> should fail with 403
    const thirdPartyAccept = await request('PUT', `/api/connections/${newConnId}`, {
      status: 'accepted'
    }, { Cookie: farmerCookie });

    // Authorized recipient (Retailer jafor) accepts connection
    const legitAccept = await request('PUT', `/api/connections/${newConnId}`, {
      status: 'accepted'
    }, { Cookie: retailerCookie });

    const t8Passed = requesterAccept.status === 403 &&
                     thirdPartyAccept.status === 403 &&
                     legitAccept.status === 200 &&
                     legitAccept.data?.connection?.status === 'accepted';

    results['Test 8: Connection State Transition Authorization'] = {
      passed: t8Passed,
      requesterStatus: requesterAccept.status,
      thirdPartyStatus: thirdPartyAccept.status,
      legitAcceptStatus: legitAccept.status,
      newStatus: legitAccept.data?.connection?.status
    };
    console.log('Test 8 Passed:', t8Passed);

    // ── TEST 9: Connection Deletion Authorization
    console.log('\n--- Test 9: Connection Deletion Authorization ---');
    // Third-party (Farmer) tries to delete connection between Wholesaler 1 and Retailer
    const rogueDeleteConn = await request('DELETE', `/api/connections/${newConnId}`, null, { Cookie: farmerCookie });

    const t9Passed = rogueDeleteConn.status === 403;

    results['Test 9: Connection Deletion Authorization'] = {
      passed: t9Passed,
      rogueDeleteStatus: rogueDeleteConn.status
    };
    console.log('Test 9 Passed:', t9Passed);

    // ── TEST 10: Automatic Notification Generation
    console.log('\n--- Test 10: Automatic Notification Generation ---');
    // Check notifications generated for Farmer (from Test 4 message)
    const farmerNotifsRes = await request('GET', '/api/notifications', null, { Cookie: farmerCookie });
    const farmerNotifs = farmerNotifsRes.data?.notifications || [];
    const msgNotif = farmerNotifs.find(n => n.type === 'message' && n.message.includes('grade-A potatoes'));

    // Check notifications generated for Retailer (from Test 6 connection request)
    const retailerNotifsRes = await request('GET', '/api/notifications', null, { Cookie: retailerCookie });
    const retailerNotifs = retailerNotifsRes.data?.notifications || [];
    const connNotif = retailerNotifs.find(n => n.type === 'connection' && n.message.includes('wants to connect'));

    // Check notifications generated for Wholesaler 1 (from Test 8 connection accepted)
    const wholesalerNotifsRes = await request('GET', '/api/notifications', null, { Cookie: wholesaler1Cookie });
    const wholesalerNotifs = wholesalerNotifsRes.data?.notifications || [];
    const connAcceptedNotif = wholesalerNotifs.find(n => n.type === 'connection' && n.title.includes('Accepted'));

    if (msgNotif) createdTestIds.notifications.push(msgNotif.id);
    if (connNotif) createdTestIds.notifications.push(connNotif.id);
    if (connAcceptedNotif) createdTestIds.notifications.push(connAcceptedNotif.id);

    const t10Passed = Boolean(msgNotif) &&
                      Boolean(connNotif) &&
                      Boolean(connAcceptedNotif);

    results['Test 10: Automatic Notification Generation'] = {
      passed: t10Passed,
      hasMsgNotif: Boolean(msgNotif),
      hasConnNotif: Boolean(connNotif),
      hasConnAcceptedNotif: Boolean(connAcceptedNotif)
    };
    console.log('Test 10 Passed:', t10Passed);

    // ── TEST 11: Notification Isolation & Read Synchronization
    console.log('\n--- Test 11: Notification Isolation & Read Synchronization ---');
    // Retailer attempts to read farmer's notification
    const rogueNotifRead = await request('PUT', `/api/notifications/${msgNotif.id}/read`, null, { Cookie: retailerCookie });

    // Farmer marks single notification read
    const legitNotifRead = await request('PUT', `/api/notifications/${msgNotif.id}/read`, null, { Cookie: farmerCookie });

    // Farmer marks all notifications read
    const readAllNotifs = await request('PUT', '/api/notifications/read-all', null, { Cookie: farmerCookie });

    const farmerNotifsAfter = (await request('GET', '/api/notifications', null, { Cookie: farmerCookie })).data?.notifications || [];
    const allRead = farmerNotifsAfter.every(n => n.read === true);

    const t11Passed = rogueNotifRead.status === 403 &&
                      legitNotifRead.status === 200 &&
                      readAllNotifs.status === 200 &&
                      allRead;

    results['Test 11: Notification Isolation & Read Synchronization'] = {
      passed: t11Passed,
      rogueReadStatus: rogueNotifRead.status,
      legitReadStatus: legitNotifRead.status,
      readAllStatus: readAllNotifs.status,
      allMarkedRead: allRead
    };
    console.log('Test 11 Passed:', t11Passed);

    // ── TEST 12: Historical Record Preservation
    console.log('\n--- Test 12: Historical Record Preservation ---');
    const postCounts = {
      offers: parseInt((await client.query('SELECT count(*)::int as c FROM wholesaler_offers')).rows[0].c),
      prices: parseInt((await client.query('SELECT count(*)::int as c FROM market_prices')).rows[0].c),
      messages: parseInt((await client.query('SELECT count(*)::int as c FROM messages')).rows[0].c),
      connections: parseInt((await client.query('SELECT count(*)::int as c FROM connections')).rows[0].c),
      notifications: parseInt((await client.query('SELECT count(*)::int as c FROM notifications')).rows[0].c),
    };

    const t12Passed = postCounts.offers >= preCounts.offers &&
                      postCounts.prices >= preCounts.prices &&
                      postCounts.messages >= preCounts.messages &&
                      postCounts.connections >= preCounts.connections &&
                      postCounts.notifications >= preCounts.notifications;

    results['Test 12: Historical Record Preservation'] = {
      passed: t12Passed,
      preCounts,
      postCounts
    };
    console.log('Test 12 Passed:', t12Passed);

    // ── TEST 13: Source DB Immutability
    console.log('\n--- Test 13: Source DB Immutability ---');
    const sqlitePostHash = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
    const jsonPostHash = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');

    const t13Passed = (sqlitePreHash === sqlitePostHash) && (jsonPreHash === jsonPostHash);

    results['Test 13: Source DB Immutability'] = {
      passed: t13Passed,
      sqliteHashMatches: sqlitePreHash === sqlitePostHash,
      jsonHashMatches: jsonPreHash === jsonPostHash,
      sqliteHash: sqlitePostHash,
      jsonHash: jsonPostHash
    };
    console.log('Test 13 Passed:', t13Passed);

    // ── TEST 14: Products & Orders Regression Check
    console.log('\n--- Test 14: Products & Orders Regression Check ---');
    const prodRes = await request('GET', '/api/products?targetRole=consumer');
    const orderRes = await request('GET', '/api/orders', null, { Cookie: farmerCookie });

    const t14Passed = prodRes.status === 200 &&
                      Array.isArray(prodRes.data?.products) &&
                      orderRes.status === 200 &&
                      Array.isArray(orderRes.data?.orders);

    results['Test 14: Products & Orders Regression Check'] = {
      passed: t14Passed,
      prodStatus: prodRes.status,
      prodCount: prodRes.data?.products?.length,
      orderStatus: orderRes.status,
      orderCount: orderRes.data?.orders?.length
    };
    console.log('Test 14 Passed:', t14Passed);

    // ── CLEANUP OF DISPOSABLE TEST RECORDS
    console.log('\n--- Cleaning up disposable test records on dev-migration-test ---');
    for (const sid of createdTestIds.sessions) {
      await client.query('DELETE FROM sessions WHERE id = $1', [sid]);
    }
    for (const oid of createdTestIds.offers) {
      await client.query('DELETE FROM wholesaler_offers WHERE id = $1', [oid]);
    }
    for (const mpid of createdTestIds.marketPrices) {
      await client.query('DELETE FROM market_prices WHERE id = $1', [mpid]);
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
    console.log('✓ Disposable test records cleaned up safely.');

    // Final Counts check
    const finalCounts = {
      offers: parseInt((await client.query('SELECT count(*)::int as c FROM wholesaler_offers')).rows[0].c),
      prices: parseInt((await client.query('SELECT count(*)::int as c FROM market_prices')).rows[0].c),
      messages: parseInt((await client.query('SELECT count(*)::int as c FROM messages')).rows[0].c),
      connections: parseInt((await client.query('SELECT count(*)::int as c FROM connections')).rows[0].c),
      notifications: parseInt((await client.query('SELECT count(*)::int as c FROM notifications')).rows[0].c),
    };
    console.log('Final clean row counts on dev-migration-test:', finalCounts);

    const allPassed = Object.values(results).every(r => r.passed);
    console.log('\n=============================================');
    console.log(`ALL 14 TESTS PASSED: ${allPassed ? 'YES — 100% SUCCESS' : 'NO — FAILURE DETECTED'}`);
    console.log('=============================================\n');

    fs.writeFileSync('server_data/phase3_2_test_results.json', JSON.stringify({
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
