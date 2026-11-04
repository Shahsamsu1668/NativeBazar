const http = require('http');
const crypto = require('crypto');
const pg = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

async function debugSession() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, ssl: { rejectUnauthorized: false } });
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const sessId = 'debug-sess-' + Date.now();

  await pool.query(`
    INSERT INTO sessions (id, user_id, token_hash, role, ip_address, user_agent, expires_at)
    VALUES ($1, 'admin-root', $2, 'admin', '127.0.0.1', 'Debug', NOW() + INTERVAL '1 hour')
  `, [sessId, tokenHash]);

  console.log('Inserted session with hash:', tokenHash);

  // Now query validateToken
  const q = await pool.query(`
    SELECT s.id as session_id, s.user_id, s.role as session_role,
           u.id, u.role, u.name, u.name_bn as "nameBn", u.phone, u.email,
           u.district, u.upazila, u.verified
    FROM sessions s
    LEFT JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
  `, [tokenHash]);

  console.log('Query result in pg:', q.rows);

  await pool.query('DELETE FROM sessions WHERE id = $1', [sessId]);
  await pool.end();
}

debugSession().catch(console.error);

