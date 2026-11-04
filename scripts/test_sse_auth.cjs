const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const dotenv = require('dotenv');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function createTestSession(client, userId, role) {
  const token = `audit-sse-${role}-${Date.now()}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const sessId = `sess-${token}`;
  await client.query(`
    INSERT INTO sessions (id, user_id, token_hash, role, expires_at)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day')
  `, [sessId, userId, tokenHash, role]);
  return { sessId, cookie: `nb_session=${token}` };
}

function connectSSE(cookie) {
  return new Promise((resolve, reject) => {
    const events = [];
    const req = http.request('http://localhost:5178/api/realtime', {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cookie': cookie
      }
    }, (res) => {
      let buffer = '';
      res.on('data', chunk => {
        buffer += chunk.toString();
        const lines = buffer.split('\n\n');
        buffer = lines.pop();
        lines.forEach(block => {
          if (block.trim()) {
            const lns = block.split('\n');
            let event = 'message';
            let data = '';
            lns.forEach(l => {
              if (l.startsWith('event: ')) event = l.replace('event: ', '').trim();
              if (l.startsWith('data: ')) data = l.replace('data: ', '').trim();
            });
            try {
              events.push({ event, data: JSON.parse(data) });
            } catch {
              events.push({ event, data });
            }
          }
        });
      });
      resolve({ req, res, events });
    });
    req.on('error', reject);
    req.end();
  });
}

function postMessage(cookie, recipientId, content) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ recipientId, content });
    const req = http.request('http://localhost:5178/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function testSSE() {
  const client = await pool.connect();
  try {
    const farmer = await createTestSession(client, 'user-farmer-rafiq', 'farmer');
    const wholesaler = await createTestSession(client, 'user-wholesaler-sumaiya', 'wholesaler');

    console.log('Connecting Farmer SSE Client 1 & 2...');
    const farmerSSE1 = await connectSSE(farmer.cookie);
    const farmerSSE2 = await connectSSE(farmer.cookie);
    const wholesalerSSE = await connectSSE(wholesaler.cookie);

    await new Promise(r => setTimeout(r, 400));

    console.log('Posting test message...');
    const postRes = await postMessage(wholesaler.cookie, 'user-farmer-rafiq', 'REALTIME_AUDIT_VERIFIED');
    const msgId = postRes.data?.message?.id;
    console.log('Message posted, ID:', msgId);

    await new Promise(r => setTimeout(r, 600));

    farmerSSE1.req.destroy();
    farmerSSE2.req.destroy();
    wholesalerSSE.req.destroy();

    const f1Received = farmerSSE1.events.some(e => e.event === 'new_message' && e.data?.message?.id === msgId);
    const f2Received = farmerSSE2.events.some(e => e.event === 'new_message' && e.data?.message?.id === msgId);
    const wReceived = wholesalerSSE.events.some(e => e.event === 'message_sent' && e.data?.message?.id === msgId);

    console.log('Farmer SSE 1 received:', f1Received);
    console.log('Farmer SSE 2 (simultaneous) received:', f2Received);
    console.log('Wholesaler SSE received:', wReceived);

    // Cleanup
    await client.query('DELETE FROM sessions WHERE id = $1 OR id = $2', [farmer.sessId, wholesaler.sessId]);
    if (msgId) await client.query('DELETE FROM messages WHERE id = $1', [msgId]);
    if (postRes.data?.notificationId) await client.query('DELETE FROM notifications WHERE id = $1', [postRes.data.notificationId]);

    console.log('Cleanup complete. Test result:', f1Received && f2Received && wReceived ? 'SUCCESS' : 'FAILED');
  } finally {
    client.release();
    await pool.end();
  }
}
testSSE();

