const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function createTestSession(client, userId, role) {
  const token = `audit-restart-${role}-${Date.now()}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const sessId = `sess-${token}`;
  await client.query(`
    INSERT INTO sessions (id, user_id, token_hash, role, expires_at)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day')
  `, [sessId, userId, tokenHash, role]);
  return { sessId, cookie: `nb_session=${token}` };
}

function request(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(`http://localhost:5178${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie || '',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const action = process.argv[2];

async function main() {
  const client = await pool.connect();
  try {
    if (action === 'send') {
      const w = await createTestSession(client, 'user-wholesaler-sumaiya', 'wholesaler');
      const res = await request('POST', '/api/messages', {
        recipientId: 'user-farmer-rafiq',
        content: 'RESTART_PERSISTENCE_TEST_MSG'
      }, w.cookie);
      console.log(JSON.stringify({
        status: res.status,
        msgId: res.data?.message?.id,
        notifId: res.data?.notificationId,
        wSessId: w.sessId
      }));
    } else if (action === 'verify') {
      const msgId = process.argv[3];
      const f = await createTestSession(client, 'user-farmer-rafiq', 'farmer');
      const res = await request('GET', '/api/messages?userA=user-wholesaler-sumaiya&userB=user-farmer-rafiq', null, f.cookie);
      const found = res.data?.messages?.some(m => m.id === msgId);
      console.log(JSON.stringify({
        status: res.status,
        found,
        fSessId: f.sessId
      }));
    } else if (action === 'cleanup') {
      const msgId = process.argv[3];
      const notifId = process.argv[4];
      const s1 = process.argv[5];
      const s2 = process.argv[6];
      if (msgId) await client.query('DELETE FROM messages WHERE id = $1', [msgId]);
      if (notifId) await client.query('DELETE FROM notifications WHERE id = $1', [notifId]);
      if (s1) await client.query('DELETE FROM sessions WHERE id = $1', [s1]);
      if (s2) await client.query('DELETE FROM sessions WHERE id = $1', [s2]);
      console.log('Cleanup finished');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main();

