import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { pool } from '../src/server/neonDb.js';
import { app } from '../server.js';
import http from 'http';

async function testApi() {
  console.log('=== NativeBazar Phase 1: End-to-End API Auth Tests ===\n');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(4005, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:4005';
  console.log(`Test server running on ${baseUrl}`);

  try {
    // 1. Test Register
    console.log('\n--- 1. Testing POST /api/auth/register ---');
    const regPhone = `0178${Date.now().toString().slice(-7)}`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'farmer',
        name: 'New Phase1 Farmer',
        phone: regPhone,
        password: 'Password123!',
        district: 'Bogura',
        upazila: 'Sherpur',
      }),
    });

    const regData = await regRes.json();
    console.log('Register response status:', regRes.status, 'success:', regData.success);
    if (regRes.status !== 201 || !regData.success) {
      throw new Error(`Register failed: ${JSON.stringify(regData)}`);
    }

    const setCookieHeader = regRes.headers.get('set-cookie');
    console.log('Register set-cookie header present:', !!setCookieHeader);
    if (!setCookieHeader || !setCookieHeader.includes('nb_session=')) {
      throw new Error('Expected nb_session cookie in registration response!');
    }
    const sessionCookie = setCookieHeader.split(';')[0]; // nb_session=<token>

    // Verify hash in Neon is bcrypt
    const neonCheck = await pool.query('SELECT password_hash, password_algo FROM users WHERE id = $1', [regData.user.id]);
    console.log('Neon password algo:', neonCheck.rows[0].password_algo, 'starts with $2:', neonCheck.rows[0].password_hash.startsWith('$2'));
    if (!neonCheck.rows[0].password_hash.startsWith('$2')) {
      throw new Error('Registration did not save bcrypt hash in Neon!');
    }
    console.log('✓ Registration passed with bcrypt hash and session cookie.');

    // 2. Test /api/auth/me with Cookie
    console.log('\n--- 2. Testing GET /api/auth/me with valid session cookie ---');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    const meData = await meRes.json();
    console.log('Me response status:', meRes.status, 'User:', meData.user?.name);
    if (meRes.status !== 200 || !meData.success || meData.user?.id !== regData.user.id) {
      throw new Error(`GET /api/auth/me failed: ${JSON.stringify(meData)}`);
    }
    console.log('✓ GET /api/auth/me validated session cookie correctly.');

    // 3. Test /api/auth/me without Cookie (Unauthorized)
    console.log('\n--- 3. Testing GET /api/auth/me without session (must reject 401) ---');
    const meNoAuth = await fetch(`${baseUrl}/api/auth/me`);
    console.log('Me without auth status:', meNoAuth.status);
    if (meNoAuth.status !== 401) {
      throw new Error(`Expected 401 for unauthorized /api/auth/me, got ${meNoAuth.status}`);
    }
    console.log('✓ Unauthorized access properly blocked with 401.');

    // 4. Test Login with Existing User (Legacy rehash test)
    console.log('\n--- 4. Testing POST /api/auth/login ---');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: regPhone,
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    console.log('Login response status:', loginRes.status, 'success:', loginData.success);
    if (loginRes.status !== 200 || !loginData.success) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }
    const loginSetCookie = loginRes.headers.get('set-cookie');
    if (!loginSetCookie || !loginSetCookie.includes('nb_session=')) {
      throw new Error('Expected nb_session cookie in login response!');
    }
    const loginSessionCookie = loginSetCookie.split(';')[0];
    console.log('✓ Login verified and new session cookie issued.');

    // 5. Test Logout & Session Revocation
    console.log('\n--- 5. Testing POST /api/auth/logout ---');
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: loginSessionCookie },
    });
    const logoutData = await logoutRes.json();
    console.log('Logout response status:', logoutRes.status, 'success:', logoutData.success);
    if (logoutRes.status !== 200 || !logoutData.success) {
      throw new Error(`Logout failed: ${JSON.stringify(logoutData)}`);
    }

    // 6. Verify revoked session cannot access /api/auth/me
    console.log('\n--- 6. Verifying revoked session cannot access /api/auth/me ---');
    const postLogoutMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: loginSessionCookie },
    });
    console.log('Me with revoked session status:', postLogoutMe.status);
    if (postLogoutMe.status !== 401) {
      throw new Error(`Expected 401 after logout, got ${postLogoutMe.status}`);
    }
    console.log('✓ Revoked session properly rejected with 401.');

    // Clean up test registered user
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [regData.user.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [regData.user.id]);

    console.log('\n======================================================');
    console.log('All End-to-End API Auth Tests PASSED successfully!');
    console.log('======================================================');
  } finally {
    server.close();
    await pool.end();
    process.exit(0);
  }
}

testApi().catch((err) => {
  console.error('API test failed:', err);
  pool.end().finally(() => process.exit(1));
});
