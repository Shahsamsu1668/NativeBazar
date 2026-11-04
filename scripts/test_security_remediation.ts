import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { pool } from '../src/server/neonDb.js';

const baseUrl = 'http://127.0.0.1:3000';

function parseCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return '';
  return setCookie.split(';')[0];
}

async function runSecurityRemediationTests() {
  console.log('=================================================================');
  console.log('   NativeBazar Phase 1 Security Remediation Verification Suite   ');
  console.log('=================================================================\n');

  let passedTests = 0;
  let totalTests = 10;

  // Wait a short moment to ensure server has bound
  await new Promise((r) => setTimeout(r, 1000));

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Unauthenticated Admin Route Access Blocked
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Scenario 1: Testing unauthenticated admin access is blocked (401)...');
  const unauthMetrics = await fetch(`${baseUrl}/api/admin/metrics`);
  const unauthDbTables = await fetch(`${baseUrl}/api/admin/db/tables`);
  const unauthDbStats = await fetch(`${baseUrl}/api/admin/db/stats`);

  if (unauthMetrics.status === 401 && unauthDbTables.status === 401 && unauthDbStats.status === 401) {
    console.log('✓ Scenario 1 Passed: /api/admin/* endpoints strictly require authentication (401).');
    passedTests++;
  } else {
    throw new Error(`Scenario 1 Failed: Got status metrics=${unauthMetrics.status}, tables=${unauthDbTables.status}, stats=${unauthDbStats.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Hardcoded Admin Token Shortcuts Blocked
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nScenario 2: Testing hardcoded admin token shortcuts are completely blocked...');
  const hardcodedTokens = ['admin', 'admin-root', 'NativeBazarSJS', '01700000000', 'nb_admin_token_test123'];
  let allBlocked = true;

  for (const token of hardcodedTokens) {
    const bearerRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const cookieRes = await fetch(`${baseUrl}/api/admin/metrics`, {
      headers: { Cookie: `nb_session=${token}` },
    });
    const queryRes = await fetch(`${baseUrl}/api/admin/metrics?token=${token}`);

    if (bearerRes.status !== 401 || cookieRes.status !== 401 || queryRes.status !== 401) {
      console.error(`Token ${token} was not rejected! status: bearer=${bearerRes.status}, cookie=${cookieRes.status}, query=${queryRes.status}`);
      allBlocked = false;
    }
  }

  if (allBlocked) {
    console.log('✓ Scenario 2 Passed: All hardcoded tokens (admin, admin-root, NativeBazarSJS, etc.) blocked (401).');
    passedTests++;
  } else {
    throw new Error('Scenario 2 Failed: One or more hardcoded tokens granted access.');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Legitimate Server Admin Authentication & Session
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nScenario 3: Testing authentic administrator login & verified server session...');
  const adminLoginRes = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin@nativebazar.gov.bd',
      password: 'Password123!', // will fail if not registered or legacy hash
    }),
  });

  // Let's ensure admin-root in Neon or SQLite can authenticate with standard password
  // Admin credentials in NativeBazar: admin@nativebazar.gov.bd / 12345678
  const actualAdminLogin = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin@nativebazar.gov.bd',
      password: 'Password123!',
    }),
  });

  let adminCookie = parseCookie(actualAdminLogin);
  if (!adminCookie) {
    // Try the default seed admin password '12345678'
    const seedAdminLogin = await fetch(`${baseUrl}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@nativebazar.gov.bd',
        password: '12345678',
      }),
    });
    adminCookie = parseCookie(seedAdminLogin);
  }

  if (!adminCookie) {
    throw new Error('Scenario 3 Failed: Could not authenticate legitimate administrator.');
  }

  const adminAuthMetrics = await fetch(`${baseUrl}/api/admin/metrics`, {
    headers: { Cookie: adminCookie },
  });
  const adminMetricsData = await adminAuthMetrics.json();

  if (adminAuthMetrics.status === 200 && Array.isArray(adminMetricsData.userCounts)) {
    console.log('✓ Scenario 3 Passed: Authentic administrator logged in and accessed protected metrics (200).');
    passedTests++;
  } else {
    throw new Error(`Scenario 3 Failed: Admin metrics returned ${adminAuthMetrics.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Session Revocation on Logout
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nScenario 4: Testing session revocation and rejection of revoked tokens...');
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({}),
  });
  const logoutData = await logoutRes.json();

  // Now attempt to access metrics with the revoked admin cookie
  const postLogoutMetrics = await fetch(`${baseUrl}/api/admin/metrics`, {
    headers: { Cookie: adminCookie },
  });

  if (logoutRes.status === 200 && logoutData.success && postLogoutMetrics.status === 401) {
    console.log('✓ Scenario 4 Passed: Logout successfully revoked session in Neon; subsequent access blocked (401).');
    passedTests++;
  } else {
    throw new Error(`Scenario 4 Failed: Post-logout status was ${postLogoutMetrics.status}`);
  }

  // Re-login admin for any subsequent admin checks
  const relogAdmin = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin@nativebazar.gov.bd',
      password: '12345678',
    }),
  });
  adminCookie = parseCookie(relogAdmin);

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: Public Marketplace Browsing Remains Accessible
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nScenario 5: Testing public marketplace listings remain open for guests...');
  const pProducts = await fetch(`${baseUrl}/api/products`);
  const pCrops = await fetch(`${baseUrl}/api/crops`);
  const pSupplier = await fetch(`${baseUrl}/api/supplier-products`);
  const pOffers = await fetch(`${baseUrl}/api/wholesaler-offers`);
  const pCatalog = await fetch(`${baseUrl}/api/catalog`);
  const pReviews = await fetch(`${baseUrl}/api/reviews`);

  if (
    pProducts.status === 200 &&
    pCrops.status === 200 &&
    pSupplier.status === 200 &&
    pOffers.status === 200 &&
    pCatalog.status === 200 &&
    pReviews.status === 200
  ) {
    console.log('✓ Scenario 5 Passed: Public catalog and listings accessible without auth (200).');
    passedTests++;
  } else {
    throw new Error('Scenario 5 Failed: One or more public endpoints returned non-200');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 6: Product Creation, Ownership & Unauthorized Deletion Blocked
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nScenario 6: Testing product modification/deletion ownership enforcement...');
  // Register Farmer A
  const phoneA = `0171${Date.now().toString().slice(-7)}`;
  const regARes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'farmer',
      name: 'Farmer Alice',
      phone: phoneA,
      password: 'Password123!',
      district: 'Bogura',
    }),
  });
  const cookieA = parseCookie(regARes);
  const userA = (await regARes.json()).user;

  // Register Farmer B
  const phoneB = `0172${Date.now().toString().slice(-7)}`;
  const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'farmer',
      name: 'Farmer Bob',
      phone: phoneB,
      password: 'Password123!',
      district: 'Bogura',
    }),
  });
  const cookieB = parseCookie(regBRes);
  const userB = (await regBRes.json()).user;

  // Farmer A creates a product
  const createProdRes = await fetch(`${baseUrl}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieA,
    },
    body: JSON.stringify({
      cropName: 'Bogura Premium Potato',
      category: 'Vegetables',
      quantityKg: 500,
      pricePerKg: 35,
    }),
  });
  const prodData = await createProdRes.json();
  const prodId = prodData.productId;

  // Farmer B attempts to modify Farmer A's product
  const modAttempt = await fetch(`${baseUrl}/api/products/${prodId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieB,
    },
    body: JSON.stringify({ pricePerKg: 10 }),
  });

  // Farmer B attempts to delete Farmer A's product
  const delAttempt = await fetch(`${baseUrl}/api/products/${prodId}`, {
    method: 'DELETE',
    headers: { Cookie: cookieB },
  });

  // Farmer A successfully modifies their own product
  const ownMod = await fetch(`${baseUrl}/api/products/${prodId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieA,
    },
    body: JSON.stringify({ pricePerKg: 38 }),
  });

  if (createProdRes.status === 201 && modAttempt.status === 403 && delAttempt.status === 403 && ownMod.status === 200) {
    console.log('✓ Scenario 6 Passed: Product ownership verified; unauthorized modification/deletion blocked (403).');
    passedTests++;
  } else {
    throw new Error(`Scenario 6 Failed: create=${createProdRes.status}, mod=${modAttempt.status}, del=${delAttempt.status}, ownMod=${ownMod.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 7: Cross-User Order Inspection & Modification Blocked
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nScenario 7: Testing cross-user order privacy and status protection...');
  // Register Wholesaler W to legitimately buy from Farmer A
  const phoneW = `0174${Date.now().toString().slice(-7)}`;
  const regWRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'wholesaler',
      name: 'Wholesaler William',
      phone: phoneW,
      password: 'Password123!',
      district: 'Bogura',
    }),
  });
  const cookieW = parseCookie(regWRes);

  const orderRes = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieW,
    },
    body: JSON.stringify({
      orderType: 'b2b_wholesale',
      sellerId: userA.id,
      sellerName: userA.name,
      items: [{ productId: prodId, cropName: 'Bogura Premium Potato', quantityKg: 10, unitPrice: 38, subtotal: 380 }],
      totalBDT: 380,
      paymentMethod: 'cash_on_delivery',
      deliveryAddress: 'Shibganj, Bogura',
      district: 'Bogura',
    }),
  });
  const orderData = await orderRes.json();
  const orderId = orderData.order?.id || orderData.orderId;

  // Register a third party Consumer User C
  const phoneC = `0173${Date.now().toString().slice(-7)}`;
  const regCRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'consumer',
      name: 'Consumer Charlie',
      phone: phoneC,
      password: 'Password123!',
      district: 'Dhaka',
    }),
  });
  const cookieC = parseCookie(regCRes);

  // User C fetches orders: should NOT see the order between Farmer A and Wholesaler W
  const cOrdersRes = await fetch(`${baseUrl}/api/orders`, {
    headers: { Cookie: cookieC },
  });
  const cOrdersData = await cOrdersRes.json();
  const sawOrder = cOrdersData.orders && cOrdersData.orders.some((o: any) => o.id === orderId);

  // User C attempts to change status of order between A and W
  const statusAttempt = await fetch(`${baseUrl}/api/orders/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieC,
    },
    body: JSON.stringify({ status: 'Cancelled' }),
  });

  if (!sawOrder && statusAttempt.status === 403) {
    console.log('✓ Scenario 7 Passed: Order history filtered to participants; unauthorized status update blocked (403).');
    passedTests++;
  } else {
    throw new Error(`Scenario 7 Failed: sawOrder=${sawOrder}, statusAttempt=${statusAttempt.status}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 8: Cross-User Message Inspection & Impersonation Blocked
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nScenario 8: Testing cross-user message inspection and impersonation prevention...');
  // User A sends message to User B
  const sendMsgRes = await fetch(`${baseUrl}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieA,
    },
    body: JSON.stringify({
      recipientId: userB.id,
      recipientName: userB.name,
      content: 'Confidential trade proposal between Alice and Bob',
    }),
  });

  // User C attempts to view messages between User A and User B
  const viewOtherMsgRes = await fetch(`${baseUrl}/api/messages?userA=${userA.id}&userB=${userB.id}`, {
    headers: { Cookie: cookieC },
  });

  // User C attempts to impersonate User A as sender
  const spoofMsgRes = await fetch(`${baseUrl}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieC,
    },
    body: JSON.stringify({
      senderId: userA.id, // trying to spoof Alice
      recipientId: userB.id,
      content: 'Spoofed message from Charlie claiming to be Alice',
    }),
  });
  const spoofMsgData = await spoofMsgRes.json();

  const spoofBoundToRealUser = spoofMsgData.message && spoofMsgData.message.senderId !== userA.id;

  if (viewOtherMsgRes.status === 403 && spoofBoundToRealUser) {
    console.log('✓ Scenario 8 Passed: Cross-user message snooping blocked (403); sender identity bound to server session.');
    passedTests++;
  } else {
    throw new Error(`Scenario 8 Failed: viewOtherMsg=${viewOtherMsgRes.status}, spoofBound=${spoofBoundToRealUser}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 9: Cross-User Profile & Notification Snooping Blocked
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nScenario 9: Testing user profile and notification boundary enforcement...');
  // User C attempts to tamper with User A's profile
  const tamperProfileRes = await fetch(`${baseUrl}/api/users/profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieC,
    },
    body: JSON.stringify({
      id: userA.id,
      name: 'Hacked by Charlie',
    }),
  });

  // Check User A profile remains intact in Neon
  const userACheck = await pool.query('SELECT name FROM users WHERE id = $1', [userA.id]);
  const userAName = userACheck.rows[0].name;

  // User C attempts to fetch User A's notifications
  const notifSnoopRes = await fetch(`${baseUrl}/api/notifications?userId=${userA.id}`, {
    headers: { Cookie: cookieC },
  });
  const notifData = await notifSnoopRes.json();
  // Server should only return notifications for User C (empty or C's), not A's
  const hasOtherNotifs = notifData.notifications && notifData.notifications.some((n: any) => n.userId === userA.id);

  if (userAName === 'Farmer Alice' && !hasOtherNotifs) {
    console.log('✓ Scenario 9 Passed: Cross-user profile tampering and notification snooping prevented.');
    passedTests++;
  } else {
    throw new Error(`Scenario 9 Failed: userAName=${userAName}, hasOtherNotifs=${hasOtherNotifs}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SCENARIO 10: Strict CORS Enforcement & Untrusted Origin Rejection
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\nScenario 10: Testing strict CORS allowlist and rejection of untrusted origins...');
  const untrustedOptions = await fetch(`${baseUrl}/api/auth/me`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://malicious-phishing-site.com',
      'Access-Control-Request-Method': 'GET',
    },
  });

  const trustedOptions = await fetch(`${baseUrl}/api/auth/me`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'GET',
    },
  });

  const untrustedGet = await fetch(`${baseUrl}/api/products`, {
    headers: {
      Origin: 'http://malicious-phishing-site.com',
    },
  });

  const corsUntrustedBlocked = untrustedOptions.status === 403 &&
    untrustedGet.headers.get('access-control-allow-origin') === null;

  const corsTrustedAllowed = (trustedOptions.status === 200 || trustedOptions.status === 204) &&
    trustedOptions.headers.get('access-control-allow-origin') === 'http://localhost:5173' &&
    trustedOptions.headers.get('access-control-allow-credentials') === 'true';

  if (corsUntrustedBlocked && corsTrustedAllowed) {
    console.log('✓ Scenario 10 Passed: Untrusted CORS preflights blocked (403); trusted origins allowed with credentials.');
    passedTests++;
  } else {
    throw new Error(`Scenario 10 Failed: untrustedOptions=${untrustedOptions.status}, trustedOptions=${trustedOptions.status}`);
  }

  console.log('\n=================================================================');
  console.log(`Summary: ${passedTests} / ${totalTests} Security Remediation Scenarios PASSED!`);
  console.log('=================================================================\n');

  process.exit(0);
}

runSecurityRemediationTests().catch((err) => {
  console.error('\n❌ Security Remediation Test Suite Failed:', err);
  process.exit(1);
});
