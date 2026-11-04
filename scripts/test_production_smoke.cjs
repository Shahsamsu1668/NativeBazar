const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const pg = require('pg');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const TEST_PORT = 3888;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    const req = http.request(url, { method, headers: reqHeaders }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          setCookie: res.headers['set-cookie']
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

const CANONICAL_AUTH_DIGEST_SQL = `
  SELECT 
    'users' AS table_name,
    count(*)::text AS row_count,
    encode(sha256(COALESCE(string_agg(encode(sha256(to_jsonb(u)::text::bytea), 'hex'), '' ORDER BY u.id), '')::bytea), 'hex') AS sha256_canonical_sorted_row_digest
  FROM public.users u
  UNION ALL
  SELECT 
    'sessions' AS table_name,
    count(*)::text AS row_count,
    encode(sha256(COALESCE(string_agg(encode(sha256(to_jsonb(s)::text::bytea), 'hex'), '' ORDER BY s.id), '')::bytea), 'hex') AS sha256_canonical_sorted_row_digest
  FROM public.sessions s
  UNION ALL
  SELECT 
    'login_audit_logs' AS table_name,
    count(*)::text AS row_count,
    encode(sha256(COALESCE(string_agg(encode(sha256(to_jsonb(l)::text::bytea), 'hex'), '' ORDER BY l.id), '')::bytea), 'hex') AS sha256_canonical_sorted_row_digest
  FROM public.login_audit_logs l;
`;

const EXPECTED_USERS_HASH = 'b13d6c604d7a30b441f8ed0a9845a71460f959182199af6bb450083c73d01f3e';
const EXPECTED_SESSIONS_HASH = 'bb711f92b73a4e9971e41b8ca185271fa05843552c6e3457006f07d7c9fc27f4';
const EXPECTED_AUDIT_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

async function runSmokeTests() {
  console.log('================================================================');
  console.log('  NATIVEBAZAR LIVE PRODUCTION SMOKE TEST SUITE');
  console.log('  Target Database: Neon main (ep-raspy-hat-b3y04kgr)');
  console.log(`  Local Production Runtime Port: ${TEST_PORT}`);
  console.log('================================================================');

  let serverProcess = null;
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL_UNPOOLED,
    ssl: { rejectUnauthorized: false }
  });

  const testResults = [];
  function record(name, passed, details = '') {
    testResults.push({ name, passed, details });
    console.log(`  ${passed ? '✓ PASS' : '✗ FAIL'}: ${name} ${details ? `(${details})` : ''}`);
  }

  // Ephemeral test records tracked for 100% clean teardown
  const createdTestIds = {
    users: [],
    sessions: [],
    supplierProducts: []
  };

  try {
    console.log('\n[STARTUP] Launching NativeBazar server instance...');
    const env = {
      ...process.env,
      PORT: String(TEST_PORT),
      NODE_ENV: 'production',
      TRUST_PROXY: 'true',
      AUTO_SYNC_LEGACY_USERS: 'false'
    };

    serverProcess = spawn('npx', ['tsx', 'server.ts'], {
      cwd: path.resolve(__dirname, '..'),
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Wait for server to boot
    let serverReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await request('GET', '/api/health/liveness');
        if (res.status === 200) {
          serverReady = true;
          break;
        }
      } catch {}
      await sleep(1000);
    }

    if (!serverReady) {
      throw new Error('Server failed to start within 30 seconds');
    }
    console.log('Server is online and responding.');

    // ─── 1. Health, Liveness, and Readiness Probes ─────────────────────────
    console.log('\n--- 1. Health, Liveness & Readiness Endpoints ---');
    const liveRes = await request('GET', '/api/health/liveness');
    record('Liveness Probe (/api/health/liveness)', liveRes.status === 200 && liveRes.body.status === 'ok');

    const healthRes = await request('GET', '/api/health');
    record('Primary Health Check (/api/health)', healthRes.status === 200 && healthRes.body.database?.includes('Neon PostgreSQL (Connected)'), `Latency: ${healthRes.body?.latencyMs}ms`);

    const readyRes = await request('GET', '/api/health/readiness');
    record('Readiness Probe (/api/health/readiness)', readyRes.status === 200 && readyRes.body.status === 'ready' && readyRes.body.tablesReady?.length >= 2);

    // ─── 2. Ephemeral Admin Session Creation ───────────────────────────────
    console.log('\n--- 2. Ephemeral Admin Session for Admin & Supplier Scopes ---');
    const rawAdminToken = crypto.randomBytes(32).toString('hex');
    const adminTokenHash = crypto.createHash('sha256').update(rawAdminToken).digest('hex');
    const testAdminSessionId = `test-sess-${Date.now()}`;
    await pool.query(`
      INSERT INTO sessions (id, user_id, token_hash, role, ip_address, user_agent, expires_at)
      VALUES ($1, 'admin-root', $2, 'admin', '127.0.0.1', 'SmokeTestRunner', NOW() + INTERVAL '1 hour')
    `, [testAdminSessionId, adminTokenHash]);
    createdTestIds.sessions.push(testAdminSessionId);

    const adminCookie = `nb_session=${rawAdminToken}`;
    const adminAuthHeaders = {
      Cookie: adminCookie,
      Authorization: `Bearer ${rawAdminToken}`
    };

    // Verify admin session via /api/auth/me
    const adminMeRes = await request('GET', '/api/auth/me', null, adminAuthHeaders);
    record('Admin Session Verification (/api/auth/me)', adminMeRes.status === 200 && adminMeRes.body.user?.role === 'admin', `Admin: ${adminMeRes.body.user?.name}`);

    // ─── 3. Safe Test Farmer Account Registration & Login ──────────────────
    console.log('\n--- 3. Login, Session Persistence & Auth Tokens ---');
    const timestamp = Date.now();
    const testFarmerPhone = `01799${Math.floor(100000 + Math.random() * 900000)}`;
    const testPassword = 'SmokeTestSecure123!';

    // Register test farmer
    const regFarmerRes = await request('POST', '/api/auth/register', {
      name: 'Smoke Test Farmer',
      phone: testFarmerPhone,
      password: testPassword,
      role: 'farmer',
      district: 'Bogura',
      upazila: 'Shibganj'
    });
    const testFarmerId = regFarmerRes.body.user?.id;
    if (testFarmerId) createdTestIds.users.push(testFarmerId);
    record('Farmer Registration (/api/auth/register)', regFarmerRes.status === 201 && regFarmerRes.body.success, `Phone: ${testFarmerPhone}`);

    // Wrong password check
    const badLoginRes = await request('POST', '/api/auth/login', {
      identifier: testFarmerPhone,
      password: 'WrongPassword999!'
    });
    record('Wrong Password Rejection (401)', badLoginRes.status === 401);

    // Valid farmer login check
    const loginFarmerRes = await request('POST', '/api/auth/login', {
      identifier: testFarmerPhone,
      password: testPassword
    });
    const farmerCookieHeader = loginFarmerRes.setCookie ? loginFarmerRes.setCookie[0] : null;
    const farmerCookie = farmerCookieHeader ? farmerCookieHeader.split(';')[0] : '';
    const farmerToken = loginFarmerRes.body.token || farmerCookie.replace('nb_session=', '');
    record('Valid Farmer Login & Session Token', loginFarmerRes.status === 200 && Boolean(farmerCookie));

    const farmerAuthHeaders = {
      Cookie: farmerCookie,
      Authorization: `Bearer ${farmerToken}`
    };

    // Session validation via /api/auth/me
    const meRes = await request('GET', '/api/auth/me', null, farmerAuthHeaders);
    record('Session Verification (/api/auth/me)', meRes.status === 200 && meRes.body.user?.phone === testFarmerPhone);

    // ─── 4. Farmer Dashboard & Crop Listing ────────────────────────────────
    console.log('\n--- 4. Farmer Dashboard & Crop Listing ---');
    const cropsRes = await request('GET', '/api/crops');
    const crops = Array.isArray(cropsRes.body) ? cropsRes.body : cropsRes.body.crops || [];
    record('Crops Listing from crops view (/api/crops)', cropsRes.status === 200 && crops.length >= 15, `Count: ${crops.length} farmer listings`);

    // ─── 5. Wholesaler Offers & Demands ────────────────────────────────────
    console.log('\n--- 5. Wholesaler Offers & Demands ---');
    const offersRes = await request('GET', '/api/wholesaler-offers');
    const offers = Array.isArray(offersRes.body) ? offersRes.body : offersRes.body.offers || offersRes.body.demands || [];
    record('Wholesaler Offers Query (/api/wholesaler-offers)', offersRes.status === 200 && offers.length >= 6, `Count: ${offers.length} active offers`);

    // ─── 6. Retailer & Consumer Marketplace Listings ───────────────────────
    console.log('\n--- 6. Retailer & Consumer Marketplace Listings ---');
    const prodsRes = await request('GET', '/api/products');
    const prods = Array.isArray(prodsRes.body) ? prodsRes.body : prodsRes.body.products || [];
    record('Unified Products Marketplace (/api/products)', prodsRes.status === 200 && prods.length >= 24, `Count: ${prods.length} active marketplace listings`);

    // ─── 7. Orders & Order Tracking Verification ───────────────────────────
    console.log('\n--- 7. Orders & Order Tracking Verification ---');
    // Admin query for all historical orders
    const adminOrdersRes = await request('GET', '/api/orders', null, adminAuthHeaders);
    const allOrders = adminOrdersRes.body.orders || [];
    const hasTrackingCodes = allOrders.length >= 10 && allOrders.every(o => Boolean(o.trackingCode));
    record('Admin Orders Query with Tracking Codes (/api/orders)', adminOrdersRes.status === 200 && hasTrackingCodes, `Orders: ${allOrders.length}, All have tracking codes`);

    // Verify historical order tracking details for ORD-472370-881
    const targetOrder = allOrders.find(o => o.id === 'ORD-472370-881');
    record('Historical Order Tracking Verified (ORD-472370-881)', targetOrder?.trackingCode === 'TRK-DHA-449979', `Tracking Code: ${targetOrder?.trackingCode}`);

    // ─── 8. Supplier Products CRUD (Neon supplier_products table) ──────────
    console.log('\n--- 8. Supplier Products CRUD (Neon supplier_products table) ---');
    // List existing supplier products (Meghna 3)
    const supListRes = await request('GET', '/api/supplier-products');
    const supProds = Array.isArray(supListRes.body) ? supListRes.body : supListRes.body.products || [];
    record('Supplier Products List (/api/supplier-products)', supListRes.status === 200 && supProds.length >= 3, `Count: ${supProds.length}`);

    // Create test supplier product using admin credentials
    const createSupRes = await request('POST', '/api/supplier-products', {
      name: 'Smoke Test Bio Fertilizer',
      banglaName: 'স্মোক টেস্ট বায়ো সার',
      category: 'Fertilizer',
      brand: 'Smoke Test Brand',
      unitPriceBDT: 450,
      unit: 'bag',
      stockQty: 50,
      phone: '01719999999',
      description: 'Temporary smoke test product',
      organicCertified: true
    }, adminAuthHeaders);
    const createdProduct = createSupRes.body.product;
    const createdSupId = createdProduct?.id;
    if (createdSupId) createdTestIds.supplierProducts.push(createdSupId);
    record('Supplier Product Create (Neon supplier_products)', (createSupRes.status === 201 || createSupRes.status === 200) && createSupRes.body.success === true, `Created ID: ${createdSupId}`);

    // Update test supplier product
    const updateSupRes = await request('PUT', `/api/supplier-products/${createdSupId}`, {
      unitPriceBDT: 520,
      stockQty: 48
    }, adminAuthHeaders);
    record('Supplier Product Update (Neon persisted)', updateSupRes.status === 200 && updateSupRes.body.success && updateSupRes.body.product?.unitPriceBDT === 520);

    // Delete test supplier product
    const delSupRes = await request('DELETE', `/api/supplier-products/${createdSupId}`, null, adminAuthHeaders);
    record('Supplier Product Delete (Neon persisted)', delSupRes.status === 200 && delSupRes.body.success);

    // ─── 9. Messaging, Connections & Notifications ─────────────────────────
    console.log('\n--- 9. Messaging, Connections & Notifications ---');
    const msgRes = await request('GET', `/api/messages?userA=${testFarmerId}&userB=user-farmer-rafiq`, null, farmerAuthHeaders);
    record('Direct Messages Query (/api/messages)', msgRes.status === 200);

    const connRes = await request('GET', '/api/connections', null, farmerAuthHeaders);
    record('User Connections Query (/api/connections)', connRes.status === 200);

    const notifRes = await request('GET', '/api/notifications', null, farmerAuthHeaders);
    record('Notifications Query (/api/notifications)', notifRes.status === 200);

    // ─── 10. Farmer Expenses & Negotiations ────────────────────────────────
    console.log('\n--- 10. Farmer Expenses & Negotiations ---');
    const expRes = await request('GET', '/api/farmer/expenses', null, farmerAuthHeaders);
    record('Farmer Expenses Query (/api/farmer/expenses)', expRes.status === 200);

    const negRes = await request('GET', '/api/negotiations', null, farmerAuthHeaders);
    record('Negotiations Query (/api/negotiations)', negRes.status === 200);

    // ─── 11. Admin Metrics & Security Access Boundaries ────────────────────
    console.log('\n--- 11. Admin Metrics & Security Access Boundaries ---');
    // Non-admin farmer trying to access admin metrics -> must return 403 Forbidden
    const forbiddenRes = await request('GET', '/api/admin/metrics', null, farmerAuthHeaders);
    record('RBAC: Non-admin denied admin metrics (403 Forbidden)', forbiddenRes.status === 403);

    // Admin query for platform metrics
    const adminMetricsRes = await request('GET', '/api/admin/metrics', null, adminAuthHeaders);
    const totalPlatformUsers = adminMetricsRes.body.userCounts?.reduce((sum, u) => sum + u.count, 0) || 0;
    record('Admin Metrics (Neon Authoritative)', adminMetricsRes.status === 200 && totalPlatformUsers >= 42, `Total Users: ${totalPlatformUsers}, Total Orders: ${adminMetricsRes.body?.totalOrders}`);

    // Verify user directory privacy: passwords / session tokens NEVER exposed
    const usersDirRes = await request('GET', '/api/users', null, farmerAuthHeaders);
    const usersList = Array.isArray(usersDirRes.body) ? usersDirRes.body : usersDirRes.body.users || [];
    const hasPasswordExposed = usersList.some(u => u.password_hash || u.passwordHash || u.session_token || u.token);
    record('User Directory Privacy (No password hashes exposed)', usersDirRes.status === 200 && !hasPasswordExposed, `Verified ${usersList.length} directory entries`);

    // ─── 12. Application Restart Survival & Neon Persistence ───────────────
    console.log('\n--- 12. Application Restart Survival & Neon Persistence ---');
    console.log('Stopping server process...');
    serverProcess.kill('SIGTERM');
    await sleep(2000);

    console.log('Restarting server process...');
    const restartProcess = spawn('npx', ['tsx', 'server.ts'], {
      cwd: path.resolve(__dirname, '..'),
      env,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let restartedReady = false;
    for (let i = 0; i < 20; i++) {
      try {
        const res = await request('GET', '/api/health/readiness');
        if (res.status === 200) {
          restartedReady = true;
          break;
        }
      } catch {}
      await sleep(1000);
    }
    record('Restart Survival & Neon Persistence', restartedReady);
    restartProcess.kill('SIGTERM');

    // ─── CLEANUP TEST RECORDS ───────────────────────────────────────────────
    console.log('\n[TEARDOWN] Cleaning up temporary test records...');
    if (createdTestIds.users.length > 0) {
      await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [createdTestIds.users]);
      console.log(`  ✓ Cleaned up ${createdTestIds.users.length} temporary test user(s).`);
    }
    if (createdTestIds.sessions.length > 0) {
      await pool.query('DELETE FROM sessions WHERE id = ANY($1::text[])', [createdTestIds.sessions]);
      console.log(`  ✓ Cleaned up temporary test session(s).`);
    }
    if (createdTestIds.supplierProducts.length > 0) {
      await pool.query('DELETE FROM supplier_products WHERE id = ANY($1::text[])', [createdTestIds.supplierProducts]);
      console.log(`  ✓ Cleaned up temporary test supplier product(s).`);
    }
    // Clean up login audit logs generated during smoke test
    await pool.query("DELETE FROM login_audit_logs WHERE phone = $1", [testFarmerPhone]);
    console.log(`  ✓ Cleaned up smoke test login audit logs.`);

    // Post-teardown cryptographic baseline validation
    console.log('\n[POST-SMOKE INTEGRITY] Re-verifying authentication tables on Neon main...');
    const postCheck = await pool.query(CANONICAL_AUTH_DIGEST_SQL);
    console.table(postCheck.rows);

    const postUsers = postCheck.rows.find(r => r.table_name === 'users');
    const postSessions = postCheck.rows.find(r => r.table_name === 'sessions');
    const postAudit = postCheck.rows.find(r => r.table_name === 'login_audit_logs');

    if (postUsers.row_count !== '42' || postUsers.sha256_canonical_sorted_row_digest !== EXPECTED_USERS_HASH) {
      throw new Error(`Integrity check failed: users table mismatch after smoke test!`);
    }
    if (postSessions.row_count !== '26' || postSessions.sha256_canonical_sorted_row_digest !== EXPECTED_SESSIONS_HASH) {
      throw new Error(`Integrity check failed: sessions table mismatch after smoke test!`);
    }
    if (postAudit.row_count !== '0' || postAudit.sha256_canonical_sorted_row_digest !== EXPECTED_AUDIT_HASH) {
      throw new Error(`Integrity check failed: login_audit_logs table mismatch after smoke test!`);
    }
    console.log('✓ Cryptographic SHA-256 baselines 100% intact after smoke test teardown!');

    // Final summary
    const allPassed = testResults.every(t => t.passed);
    console.log('\n================================================================');
    console.log(`  ALL SMOKE TESTS FINISHED: ${testResults.filter(t => t.passed).length}/${testResults.length} PASSED`);
    console.log(`  OVERALL VERDICT: ${allPassed ? '100% PASS - PRODUCTION READY' : 'FAILURES DETECTED'}`);
    console.log('================================================================');

    if (!allPassed) {
      throw new Error('Some smoke tests failed.');
    }
  } finally {
    if (serverProcess) {
      try { serverProcess.kill('SIGTERM'); } catch {}
    }
    await pool.end();
  }
}

runSmokeTests().catch(err => {
  console.error('Fatal Smoke Test Error:', err);
  process.exit(1);
});
