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
          data: json,
          setCookie: res.headers['set-cookie']
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runAuthAndSupplyChainSuite() {
  console.log('=== TEST SUITE 1: AUTHENTICATION, ROLES & STRICT SUPPLY CHAIN RULES ===\n');
  const client = await pool.connect();
  const createdTestIds = {
    users: [],
    sessions: [],
    products: [],
    orders: []
  };

  const results = {};

  try {
    // 1. User Registration
    console.log('--- 1. USER REGISTRATION TESTING ---');
    const testRegPhone = `01799${Math.floor(100000 + Math.random() * 900000)}`;
    const regPayload = {
      phone: testRegPhone,
      password: 'SecurePassword123!',
      name: 'Test Farmer Registration',
      role: 'farmer',
      district: 'Bogura',
      upazila: 'Shibganj'
    };

    const regRes = await request('POST', '/api/auth/register', regPayload);
    const regPassed = regRes.status === 201 && regRes.data?.success === true && regRes.data?.user?.phone === testRegPhone;
    if (regRes.data?.user?.id) createdTestIds.users.push(regRes.data.user.id);

    // Duplicate Phone Registration Rejection
    const dupRegRes = await request('POST', '/api/auth/register', regPayload);
    const dupPassed = (dupRegRes.status === 409 || dupRegRes.status === 400) && dupRegRes.data?.error?.includes('already registered');

    results['1.1 User Registration'] = { passed: regPassed, status: regRes.status };
    results['1.2 Duplicate Phone Rejection'] = { passed: dupPassed, status: dupRegRes.status };
    console.log('Registration:', regPassed ? 'PASS (201 Created)' : 'FAIL');
    console.log('Duplicate Prevention:', dupPassed ? 'PASS (400 Rejected)' : 'FAIL');

    // 2. Login & Credential Verification
    console.log('\n--- 2. LOGIN & CREDENTIAL VERIFICATION ---');
    // Wrong password
    const badLoginRes = await request('POST', '/api/auth/login', {
      identifier: testRegPhone,
      password: 'WrongPassword999!'
    });
    const badLoginPassed = badLoginRes.status === 401;

    // Correct password
    const goodLoginRes = await request('POST', '/api/auth/login', {
      identifier: testRegPhone,
      password: 'SecurePassword123!'
    });
    const goodLoginPassed = goodLoginRes.status === 200 && goodLoginRes.data?.user?.phone === testRegPhone;
    const cookieHeader = goodLoginRes.setCookie ? goodLoginRes.setCookie[0] : null;
    const sessionCookie = cookieHeader ? cookieHeader.split(';')[0] : '';

    results['2.1 Wrong Password Rejection'] = { passed: badLoginPassed, status: badLoginRes.status };
    results['2.2 Valid Login & Session Issuance'] = {
      passed: goodLoginPassed && Boolean(sessionCookie),
      status: goodLoginRes.status,
      hasCookie: Boolean(sessionCookie)
    };
    console.log('Wrong Password:', badLoginPassed ? 'PASS (401 Unauthorized)' : 'FAIL');
    console.log('Valid Login:', goodLoginPassed ? 'PASS (200 + Session Cookie)' : 'FAIL');

    // 3. Session Persistence & /api/auth/me
    console.log('\n--- 3. SESSION PERSISTENCE & VERIFICATION ---');
    const meRes = await request('GET', '/api/auth/me', null, { Cookie: sessionCookie });
    const mePassed = meRes.status === 200 && meRes.data?.user?.phone === testRegPhone;

    // Logout and session revocation
    const logoutRes = await request('POST', '/api/auth/logout', null, { Cookie: sessionCookie });
    const postLogoutMe = await request('GET', '/api/auth/me', null, { Cookie: sessionCookie });
    const logoutPassed = logoutRes.status === 200 && postLogoutMe.status === 401;

    results['3.1 Authenticated Session Check (/api/auth/me)'] = { passed: mePassed, status: meRes.status };
    results['3.2 Logout Session Revocation'] = { passed: logoutPassed, status: postLogoutMe.status };
    console.log('Session Me Check:', mePassed ? 'PASS (200 OK)' : 'FAIL');
    console.log('Logout Revocation:', logoutPassed ? 'PASS (401 Post-Logout)' : 'FAIL');

    // 4. Role-Specific Sessions for Core Supply Chain Testing
    console.log('\n--- 4. ROLE-SPECIFIC SESSION GENERATION ---');
    async function getSession(userId, role) {
      const token = `master-auth-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const sessId = `sess-${token}`;
      await client.query(`
        INSERT INTO sessions (id, user_id, token_hash, role, expires_at)
        VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day')
      `, [sessId, userId, tokenHash, role]);
      createdTestIds.sessions.push(sessId);
      return `nb_session=${token}`;
    }

    const farmerCookie = await getSession('user-farmer-rafiq', 'farmer');
    const wholesalerCookie = await getSession('w-karwan-syndicate', 'wholesaler');
    const retailerCookie = await getSession('usr-retailer-jafor', 'retailer');
    const consumerCookie = await getSession('usr-consumer-sumayya', 'consumer');
    const adminCookie = await getSession('admin-root', 'admin');

    // 5. Role-Based Access Control (RBAC) on Protected Endpoints
    console.log('\n--- 5. RBAC PROTECTED ENDPOINT TESTING ---');
    // Non-admin attempting admin catalog creation
    const nonAdminCat = await request('POST', '/api/catalog', { name: 'Hack', nameBn: 'হ্যাক', category: 'fruits' }, { Cookie: consumerCookie });
    // Non-farmer attempting farmer expense creation
    const nonFarmerExp = await request('POST', '/api/farmer/expenses', { category: 'Fertilizer', description: 'Test', amountBDT: 100 }, { Cookie: consumerCookie });
    // Consumer attempting to list wholesale offers
    const nonWhoOffer = await request('POST', '/api/wholesaler-offers', { cropName: 'Tomato', quantityKgNeeded: 500, offeredPricePerKg: 30 }, { Cookie: consumerCookie });

    const rbacPassed = nonAdminCat.status === 403 && nonFarmerExp.status === 403 && nonWhoOffer.status === 403;
    results['5.1 RBAC Protected API Enforcement'] = {
      passed: rbacPassed,
      adminGuard: nonAdminCat.status,
      farmerGuard: nonFarmerExp.status,
      wholesalerGuard: nonWhoOffer.status
    };
    console.log('RBAC Enforcement:', rbacPassed ? 'PASS (403 on all unauthorized actions)' : 'FAIL');

    // 6. Strict Supply Chain Rules Execution (Farmer -> Wholesaler -> Retailer -> Consumer)
    console.log('\n--- 6. SUPPLY CHAIN EXECUTION & PROHIBITED DIRECT TRADE REJECTION ---');
    // Identify products in Neon
    // Farmer product: prod-far-301 (seller: user-farmer-rafiq, role: farmer)
    // Wholesaler product: prod-who-201 (seller: w-karwan-syndicate, role: wholesaler)
    // Retailer product: prod-ret-101 (seller: ret-bismillah-mart, role: retailer)

    // CASE A: Wholesaler purchases from Farmer (VALID)
    const validTradeA = await request('POST', '/api/orders', {
      items: [{ productId: 'prod-far-301', quantityKg: 50 }],
      paymentMethod: 'Cash on Delivery',
      deliveryAddress: 'Karwan Bazar Wholesale Arat, Dhaka'
    }, { Cookie: wholesalerCookie });
    const tradeAPassed = validTradeA.status === 201 && validTradeA.data?.success === true;
    if (validTradeA.data?.order?.orderId) createdTestIds.orders.push(validTradeA.data.order.orderId);
    console.log('Trade A (Wholesaler <- Farmer):', tradeAPassed ? 'PASS (201 Trade Confirmed)' : 'FAIL', validTradeA.status, validTradeA.data?.error);

    // CASE B: Retailer purchases from Wholesaler (VALID)
    const validTradeB = await request('POST', '/api/orders', {
      items: [{ productId: 'prod-who-201', quantityKg: 25 }],
      paymentMethod: 'Cash on Delivery',
      deliveryAddress: 'Jafor Grocery Corner, Bogura Bazar'
    }, { Cookie: retailerCookie });
    const tradeBPassed = validTradeB.status === 201 && validTradeB.data?.success === true;
    if (validTradeB.data?.order?.orderId) createdTestIds.orders.push(validTradeB.data.order.orderId);
    console.log('Trade B (Retailer <- Wholesaler):', tradeBPassed ? 'PASS (201 Trade Confirmed)' : 'FAIL', validTradeB.status, validTradeB.data?.error);

    // CASE C: Consumer purchases from Retailer (VALID)
    const validTradeC = await request('POST', '/api/orders', {
      items: [{ productId: 'prod-ret-101', quantityKg: 2 }],
      paymentMethod: 'Cash on Delivery',
      deliveryAddress: 'House 42, Road 5, Jaleshwaritola, Bogura'
    }, { Cookie: consumerCookie });
    const tradeCPassed = validTradeC.status === 201 && validTradeC.data?.success === true;
    if (validTradeC.data?.order?.orderId) createdTestIds.orders.push(validTradeC.data.order.orderId);
    console.log('Trade C (Consumer <- Retailer):', tradeCPassed ? 'PASS (201 Trade Confirmed)' : 'FAIL', validTradeC.status, validTradeC.data?.error);

    // CASE D: Prohibited Direct Purchase: Consumer purchases directly from Farmer (PROHIBITED)
    const prohibitedTradeD = await request('POST', '/api/orders', {
      items: [{ productId: 'prod-far-301', quantityKg: 5 }],
      paymentMethod: 'Cash on Delivery',
      deliveryAddress: 'Direct Farm Purchase Attempt'
    }, { Cookie: consumerCookie });
    const tradeDPassed = prohibitedTradeD.status === 403 && prohibitedTradeD.data?.error?.includes('Rule Violation: Farmers');
    console.log('Trade D (Consumer <- Farmer Prohibited):', tradeDPassed ? 'PASS (403 Rule Violation Blocked)' : 'FAIL', prohibitedTradeD.status, prohibitedTradeD.data?.error);

    // CASE E: Prohibited Direct Purchase: Consumer purchases directly from Wholesaler (PROHIBITED)
    const prohibitedTradeE = await request('POST', '/api/orders', {
      items: [{ productId: 'prod-who-201', quantityKg: 10 }],
      paymentMethod: 'Cash on Delivery',
      deliveryAddress: 'Direct Arat Purchase Attempt'
    }, { Cookie: consumerCookie });
    const tradeEPassed = prohibitedTradeE.status === 403 && prohibitedTradeE.data?.error?.includes('Rule Violation: Wholesalers');
    console.log('Trade E (Consumer <- Wholesaler Prohibited):', tradeEPassed ? 'PASS (403 Rule Violation Blocked)' : 'FAIL', prohibitedTradeE.status, prohibitedTradeE.data?.error);

    // CASE F: Prohibited Backward Purchase: Wholesaler purchases from Retailer (PROHIBITED)
    const prohibitedTradeF = await request('POST', '/api/orders', {
      items: [{ productId: 'prod-ret-101', quantityKg: 5 }],
      paymentMethod: 'Cash on Delivery',
      deliveryAddress: 'Backward Purchase Attempt'
    }, { Cookie: wholesalerCookie });
    const tradeFPassed = prohibitedTradeF.status === 403 && prohibitedTradeF.data?.error?.includes('Rule Violation: Retailers');
    console.log('Trade F (Wholesaler <- Retailer Prohibited):', tradeFPassed ? 'PASS (403 Rule Violation Blocked)' : 'FAIL', prohibitedTradeF.status, prohibitedTradeF.data?.error);

    results['6.1 Valid Supply Chain Trades'] = {
      passed: tradeAPassed && tradeBPassed && tradeCPassed,
      wholesalerFromFarmer: validTradeA.status,
      retailerFromWholesaler: validTradeB.status,
      consumerFromRetailer: validTradeC.status
    };
    results['6.2 Prohibited Direct Trade Rejection'] = {
      passed: tradeDPassed && tradeEPassed && tradeFPassed,
      consumerFromFarmer: prohibitedTradeD.status,
      consumerFromWholesaler: prohibitedTradeE.status,
      wholesalerFromRetailer: prohibitedTradeF.status
    };

    // Cleanup of created test orders, users, and sessions
    console.log('\n--- CLEANING UP TEST SUITE 1 DISPOSABLE RECORDS ---');
    await client.query('ALTER TABLE trade_audit_logs DISABLE TRIGGER trg_protect_trade_audit_logs;');
    await client.query('ALTER TABLE login_audit_logs DISABLE TRIGGER trg_protect_login_audit_logs;');

    for (const oid of createdTestIds.orders) {
      // Restore stock first
      const items = (await client.query('SELECT product_id, quantity_kg FROM order_items WHERE order_id = $1', [oid])).rows;
      for (const it of items) {
        await client.query('UPDATE products SET available_qty = available_qty + $1 WHERE id = $2', [it.quantity_kg, it.product_id]);
      }
      await client.query('DELETE FROM trade_audit_logs WHERE order_id = $1', [oid]);
      await client.query('DELETE FROM order_items WHERE order_id = $1', [oid]);
      await client.query('DELETE FROM orders WHERE id = $1', [oid]);
    }
    for (const sid of createdTestIds.sessions) {
      await client.query('DELETE FROM sessions WHERE id = $1', [sid]);
    }
    for (const uid of createdTestIds.users) {
      await client.query('DELETE FROM login_audit_logs WHERE user_id = $1', [uid]);
      await client.query('DELETE FROM users WHERE id = $1', [uid]);
    }

    await client.query('ALTER TABLE trade_audit_logs ENABLE TRIGGER trg_protect_trade_audit_logs;');
    await client.query('ALTER TABLE login_audit_logs ENABLE TRIGGER trg_protect_login_audit_logs;');
    console.log('✓ All test records cleaned up cleanly.');

    const allPassed = Object.values(results).every(r => r.passed);
    console.log('\n=============================================');
    console.log(`TEST SUITE 1 VERDICT: ${allPassed ? 'ALL TESTS PASSED (100%)' : 'TESTS FAILED'}`);
    console.log('=============================================\n');

    fs.writeFileSync('server_data/suite1_auth_supply_chain_results.json', JSON.stringify({
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

runAuthAndSupplyChainSuite().catch(err => {
  console.error('Test Suite 1 Error:', err);
  process.exit(1);
});
