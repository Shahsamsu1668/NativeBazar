import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { pool } from '../src/server/neonDb.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  validateToken,
  revokeSessionByToken,
  computeLegacyDJB2Hash,
} from '../src/server/auth.js';

async function runTests() {
  console.log('=== NativeBazar Phase 1: Authentication Migration Tests ===\n');

  // Test 1: Neon Database Connection
  console.log('Test 1: Testing Neon Cloud PostgreSQL connection & tables...');
  const tableRes = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('users', 'sessions', 'login_audit_logs')
    ORDER BY table_name
  `);
  const tables = tableRes.rows.map(r => r.table_name);
  console.log('Found tables in Neon:', tables);
  if (!tables.includes('users') || !tables.includes('sessions') || !tables.includes('login_audit_logs')) {
    throw new Error('Missing expected Neon tables!');
  }
  console.log('✓ Test 1 Passed: Neon PostgreSQL tables exist.\n');

  // Test 2: Bcrypt Hashing for New Registration
  console.log('Test 2: Verifying bcrypt hashing for new registrations...');
  const testPassword = 'SecurePassword2026!';
  const bcryptHash = await hashPassword(testPassword);
  console.log('Generated hash prefix:', bcryptHash.substring(0, 7)); // e.g. $2a$10$ or $2b$10$
  if (!bcryptHash.startsWith('$2')) {
    throw new Error('Hash is not a valid bcrypt hash!');
  }
  const checkBcrypt = await verifyPassword(testPassword, bcryptHash);
  if (!checkBcrypt.valid || checkBcrypt.needsRehash) {
    throw new Error('Bcrypt verification failed or improperly flagged for rehash!');
  }
  const checkWrongPwd = await verifyPassword('WrongPassword!', bcryptHash);
  if (checkWrongPwd.valid) {
    throw new Error('Wrong password was accepted!');
  }
  console.log('✓ Test 2 Passed: Bcrypt hashing and verification working correctly.\n');

  // Test 3: Legacy Hash Migration & Transparent Rehash
  console.log('Test 3: Testing legacy hash detection and transparent rehash...');
  const legacyPassword = 'farmer_pass_123';
  const legacyHash = computeLegacyDJB2Hash(legacyPassword);
  console.log('Simulated legacy DJB2 hash:', legacyHash);

  const legacyVerify = await verifyPassword(legacyPassword, legacyHash);
  if (!legacyVerify.valid) {
    throw new Error('Legacy password verification failed!');
  }
  if (!legacyVerify.needsRehash) {
    throw new Error('Legacy password was not flagged for rehash!');
  }
  console.log('Legacy hash verified successfully with needsRehash: true.');

  // Simulate upgrade to bcrypt
  const upgradedHash = await hashPassword(legacyPassword);
  const upgradedVerify = await verifyPassword(legacyPassword, upgradedHash);
  if (!upgradedVerify.valid || upgradedVerify.needsRehash) {
    throw new Error('Upgraded bcrypt hash failed verification or reflagged for rehash!');
  }
  console.log('✓ Test 3 Passed: Transparent password rehash logic verified.\n');

  // Test 4: Server-Side Revocable Session Management
  console.log('Test 4: Testing server session creation, validation, and revocation...');
  const mockReq = {
    headers: { 'user-agent': 'TestRunner/1.0' },
    socket: { remoteAddress: '127.0.0.1' },
  } as any;

  // Insert a test user into Neon for session validation
  const testUserId = `usr-test-${Date.now()}`;
  await pool.query(`
    INSERT INTO users (id, role, name, phone, password_hash, district)
    VALUES ($1, 'farmer', 'Test Farmer', $2, $3, 'Bogura')
  `, [testUserId, `01799${Date.now().toString().slice(-6)}`, bcryptHash]);

  const { rawToken, expiresAt } = await createSession(testUserId, 'farmer', mockReq);
  console.log('Created session with rawToken length:', rawToken.length, 'Expires:', expiresAt.toISOString());

  // Validate session token
  const validated = await validateToken(rawToken);
  if (!validated) {
    throw new Error('Session token validation returned null!');
  }
  if (validated.user.id !== testUserId || validated.user.role !== 'farmer') {
    throw new Error(`Session user mismatch: expected ${testUserId}, got ${validated.user.id}`);
  }
  console.log('Validated session for user:', validated.user.name, `(${validated.user.id})`);

  // Revoke session token
  await revokeSessionByToken(rawToken);
  const postRevoke = await validateToken(rawToken);
  if (postRevoke !== null) {
    throw new Error('Revoked session token was still accepted!');
  }
  console.log('Session successfully revoked; subsequent validation rejected.');

  // Clean up test user & session
  await pool.query('DELETE FROM sessions WHERE user_id = $1', [testUserId]);
  await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  console.log('✓ Test 4 Passed: Session lifecycle (create, validate, revoke) verified.\n');

  console.log('=====================================================');
  console.log('All Phase 1 Authentication tests PASSED successfully!');
  console.log('=====================================================');

  await pool.end();
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  pool.end().finally(() => process.exit(1));
});

