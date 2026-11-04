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

async function createTestSession(client, userId, role) {
  const token = `audit-sess-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const sessId = `sess-${token}`;
  await client.query(`
    INSERT INTO sessions (id, user_id, token_hash, role, expires_at)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 day')
  `, [sessId, userId, tokenHash, role]);
  return { sessId, cookie: `nb_session=${token}` };
}

async function runAudit() {
  console.log('=== STARTING INDEPENDENT AUDIT VERIFICATION RUNNER ===\n');
  const auditReport = {
    timestamp: new Date().toISOString(),
    environment: {},
    backendTrace: {},
    messagingRealtime: {},
    connectionsNotifications: {},
    regressionIntegrity: {}
  };

  const client = await pool.connect();
  const createdIds = {
    sessions: [],
    offers: [],
    marketPrices: [],
    messages: [],
    connections: [],
    notifications: []
  };

  try {
    // 1. Initial State & Counts
    const preCounts = {
      users: parseInt((await client.query('SELECT count(*)::int as c FROM users')).rows[0].c),
      products: parseInt((await client.query('SELECT count(*)::int as c FROM products')).rows[0].c),
      orders: parseInt((await client.query('SELECT count(*)::int as c FROM orders')).rows[0].c),
      order_items: parseInt((await client.query('SELECT count(*)::int as c FROM order_items')).rows[0].c),
      offers: parseInt((await client.query('SELECT count(*)::int as c FROM wholesaler_offers')).rows[0].c),
      prices: parseInt((await client.query('SELECT count(*)::int as c FROM market_prices')).rows[0].c),
      messages: parseInt((await client.query('SELECT count(*)::int as c FROM messages')).rows[0].c),
      connections: parseInt((await client.query('SELECT count(*)::int as c FROM connections')).rows[0].c),
      notifications: parseInt((await client.query('SELECT count(*)::int as c FROM notifications')).rows[0].c),
    };
    console.log('Baseline counts on dev-migration-test:', preCounts);
    auditReport.regressionIntegrity.baselineCounts = preCounts;

    // Hashes
    const sqliteHash = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
    const jsonHash = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');
    auditReport.environment.sqliteHash = sqliteHash;
    auditReport.environment.jsonHash = jsonHash;

    // Setup actors
    const w1 = await createTestSession(client, 'user-wholesaler-sumaiya', 'wholesaler');
    const w2 = await createTestSession(client, 'w-karwan-syndicate', 'wholesaler');
    const farmer = await createTestSession(client, 'user-farmer-rafiq', 'farmer');
    const retailer = await createTestSession(client, 'usr-retailer-jafor', 'retailer');
    const admin = await createTestSession(client, 'admin-root', 'admin');

    createdIds.sessions.push(w1.sessId, w2.sessId, farmer.sessId, retailer.sessId, admin.sessId);

    // ──────────────────────────────────────────────────────────────────────────
    // PART A: REALTIME SSE & SIMULTANEOUS MULTI-CLIENT TEST
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Auditing Realtime SSE & Simultaneous Multi-Client Delivery ---');

    function connectSSE(userId) {
      return new Promise((resolve, reject) => {
        const events = [];
        const req = http.request(`http://localhost:5178/api/realtime?userId=${encodeURIComponent(userId)}`, {
          method: 'GET',
          headers: { 'Accept': 'text/event-stream' }
        }, (res) => {
          let buffer = '';
          res.on('data', chunk => {
            buffer += chunk.toString();
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); // keep remainder
            lines.forEach(block => {
              if (block.trim()) {
                const lines = block.split('\n');
                let event = 'message';
                let data = '';
                lines.forEach(l => {
                  if (l.startsWith('event: ')) event = l.replace('event: ', '').trim();
                  if (l.startsWith('data: ')) data = l.replace('data: ', '').trim();
                });
                events.push({ event, data: JSON.parse(data || '{}') });
              }
            });
          });
          resolve({ req, res, events });
        });
        req.on('error', reject);
        req.end();
      });
    }

    const farmerSSE1 = await connectSSE('user-farmer-rafiq');
    const farmerSSE2 = await connectSSE('user-farmer-rafiq'); // simultaneous second client (e.g. tablet + phone)
    const wholesalerSSE = await connectSSE('user-wholesaler-sumaiya');

    // Give SSE connections 300ms to register
    await new Promise(r => setTimeout(r, 300));

    // Post message from Wholesaler to Farmer
    const auditMsgRes = await request('POST', '/api/messages', {
      recipientId: 'user-farmer-rafiq',
      content: 'AUDIT_TEST_SIMULTANEOUS_SSE_MESSAGE'
    }, { Cookie: w1.cookie });

    const auditMsgId = auditMsgRes.data?.message?.id;
    if (auditMsgId) createdIds.messages.push(auditMsgId);
    if (auditMsgRes.data?.notificationId) createdIds.notifications.push(auditMsgRes.data.notificationId);

    // Wait 500ms for SSE event dispatch
    await new Promise(r => setTimeout(r, 500));

    // Close SSE streams
    farmerSSE1.req.destroy();
    farmerSSE2.req.destroy();
    wholesalerSSE.req.destroy();

    const farmer1Received = farmerSSE1.events.some(e => e.event === 'new_message' && e.data?.message?.id === auditMsgId);
    const farmer2Received = farmerSSE2.events.some(e => e.event === 'new_message' && e.data?.message?.id === auditMsgId);
    const wholesalerSentReceived = wholesalerSSE.events.some(e => e.event === 'message_sent' && e.data?.message?.id === auditMsgId);

    console.log('Farmer Client 1 received SSE:', farmer1Received);
    console.log('Farmer Client 2 (simultaneous) received SSE:', farmer2Received);
    console.log('Wholesaler sender received message_sent SSE:', wholesalerSentReceived);

    auditReport.messagingRealtime.sseMultiClientTest = {
      farmerClient1Received: farmer1Received,
      farmerClient2Received: farmer2Received,
      wholesalerSenderReceived: wholesalerSentReceived,
      passed: farmer1Received && farmer2Received && wholesalerSentReceived
    };

    // ──────────────────────────────────────────────────────────────────────────
    // PART B: CONNECTIONS & PERMISSIONS AUDIT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Auditing Connections & Permissions ---');

    // 1. Connection request
    const connCreateRes = await request('POST', '/api/connections', {
      recipientId: 'usr-retailer-jafor'
    }, { Cookie: w1.cookie });

    const testConnId = connCreateRes.data?.connection?.id;
    if (testConnId) createdIds.connections.push(testConnId);

    // 2. Self connection rejection
    const selfConnRes = await request('POST', '/api/connections', {
      recipientId: 'user-wholesaler-sumaiya'
    }, { Cookie: w1.cookie });

    // 3. Duplicate connection rejection
    const dupConnRes = await request('POST', '/api/connections', {
      recipientId: 'usr-retailer-jafor'
    }, { Cookie: w1.cookie });

    // 4. Unauthorized status update (requester trying to accept)
    const unauthorizedAccept = await request('PUT', `/api/connections/${testConnId}`, {
      status: 'accepted'
    }, { Cookie: w1.cookie });

    // 5. Authorized status update (recipient accepts)
    const authorizedAccept = await request('PUT', `/api/connections/${testConnId}`, {
      status: 'accepted'
    }, { Cookie: retailer.cookie });

    // 6. Unauthorized deletion (third party)
    const unauthorizedDelete = await request('DELETE', `/api/connections/${testConnId}`, null, { Cookie: farmer.cookie });

    auditReport.connectionsNotifications.connectionsAudit = {
      creationStatus: connCreateRes.status,
      selfConnRejection: selfConnRes.status === 400,
      dupConnRejection: dupConnRes.status === 400,
      unauthorizedAcceptRejection: unauthorizedAccept.status === 403,
      authorizedAcceptStatus: authorizedAccept.status === 200,
      unauthorizedDeleteRejection: unauthorizedDelete.status === 403,
      passed: connCreateRes.status === 201 &&
              selfConnRes.status === 400 &&
              dupConnRes.status === 400 &&
              unauthorizedAccept.status === 403 &&
              authorizedAccept.status === 200 &&
              unauthorizedDelete.status === 403
    };
    console.log('Connections Audit Passed:', auditReport.connectionsNotifications.connectionsAudit.passed);

    // ──────────────────────────────────────────────────────────────────────────
    // PART C: NOTIFICATIONS & PRIVACY AUDIT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Auditing Notifications & Privacy ---');

    // Fetch retailer's notifications
    const retailerNotifsRes = await request('GET', '/api/notifications', null, { Cookie: retailer.cookie });
    const retailerNotifs = retailerNotifsRes.data?.notifications || [];
    const connReqNotif = retailerNotifs.find(n => n.type === 'connection' && n.message.includes('wants to connect'));
    if (connReqNotif) createdIds.notifications.push(connReqNotif.id);

    // Fetch wholesaler's notifications
    const wholesalerNotifsRes = await request('GET', '/api/notifications', null, { Cookie: w1.cookie });
    const wholesalerNotifs = wholesalerNotifsRes.data?.notifications || [];
    const connAcceptedNotif = wholesalerNotifs.find(n => n.type === 'connection' && n.title.includes('Accepted'));
    if (connAcceptedNotif) createdIds.notifications.push(connAcceptedNotif.id);

    // Rogue user (farmer) attempts to mark retailer's notification as read
    const rogueRead = await request('PUT', `/api/notifications/${connReqNotif?.id}/read`, null, { Cookie: farmer.cookie });

    // Authorized user (retailer) marks notification read
    const legitRead = await request('PUT', `/api/notifications/${connReqNotif?.id}/read`, null, { Cookie: retailer.cookie });

    auditReport.connectionsNotifications.notificationsAudit = {
      connReqNotifGenerated: Boolean(connReqNotif),
      connAcceptedNotifGenerated: Boolean(connAcceptedNotif),
      rogueMarkReadBlocked: rogueRead.status === 403,
      legitMarkReadSucceeded: legitRead.status === 200,
      passed: Boolean(connReqNotif) && Boolean(connAcceptedNotif) && rogueRead.status === 403 && legitRead.status === 200
    };
    console.log('Notifications Audit Passed:', auditReport.connectionsNotifications.notificationsAudit.passed);

    // ──────────────────────────────────────────────────────────────────────────
    // PART D: PHASE 3.1 REGRESSION AUDIT (PRODUCTS & ORDERS)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Auditing Phase 3.1 Products & Orders Regression ---');

    const prodCheck = await request('GET', '/api/products?targetRole=consumer');
    const orderCheck = await request('GET', '/api/orders', null, { Cookie: farmer.cookie });
    const adminMetrics = await request('GET', '/api/admin/metrics', null, { Cookie: admin.cookie });

    auditReport.regressionIntegrity.phase31Regression = {
      productsStatus: prodCheck.status,
      productsCount: prodCheck.data?.products?.length,
      ordersStatus: orderCheck.status,
      ordersCount: orderCheck.data?.orders?.length,
      adminMetricsStatus: adminMetrics.status,
      passed: prodCheck.status === 200 &&
              Array.isArray(prodCheck.data?.products) &&
              orderCheck.status === 200 &&
              Array.isArray(orderCheck.data?.orders) &&
              adminMetrics.status === 200
    };
    console.log('Phase 3.1 Regression Audit Passed:', auditReport.regressionIntegrity.phase31Regression.passed);

    // ──────────────────────────────────────────────────────────────────────────
    // PART E: DISPOSABLE CLEANUP & RECORD PRESERVATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Cleaning up disposable audit records ---');
    for (const sid of createdIds.sessions) {
      await client.query('DELETE FROM sessions WHERE id = $1', [sid]);
    }
    for (const mid of createdIds.messages) {
      await client.query('DELETE FROM messages WHERE id = $1', [mid]);
    }
    for (const cid of createdIds.connections) {
      await client.query('DELETE FROM connections WHERE id = $1', [cid]);
    }
    for (const nid of createdIds.notifications) {
      await client.query('DELETE FROM notifications WHERE id = $1', [nid]);
    }

    const postCounts = {
      users: parseInt((await client.query('SELECT count(*)::int as c FROM users')).rows[0].c),
      products: parseInt((await client.query('SELECT count(*)::int as c FROM products')).rows[0].c),
      orders: parseInt((await client.query('SELECT count(*)::int as c FROM orders')).rows[0].c),
      order_items: parseInt((await client.query('SELECT count(*)::int as c FROM order_items')).rows[0].c),
      offers: parseInt((await client.query('SELECT count(*)::int as c FROM wholesaler_offers')).rows[0].c),
      prices: parseInt((await client.query('SELECT count(*)::int as c FROM market_prices')).rows[0].c),
      messages: parseInt((await client.query('SELECT count(*)::int as c FROM messages')).rows[0].c),
      connections: parseInt((await client.query('SELECT count(*)::int as c FROM connections')).rows[0].c),
      notifications: parseInt((await client.query('SELECT count(*)::int as c FROM notifications')).rows[0].c),
    };
    console.log('Post-cleanup counts on dev-migration-test:', postCounts);
    auditReport.regressionIntegrity.postCounts = postCounts;

    // Check count matching
    const countsMatch = Object.keys(preCounts).every(k => preCounts[k] === postCounts[k]);
    auditReport.regressionIntegrity.countsMatch = countsMatch;
    console.log('All baseline row counts perfectly preserved:', countsMatch);

    // Check source database immutability
    const sqlitePostHash = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
    const jsonPostHash = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');
    auditReport.environment.sqliteImmutability = sqliteHash === sqlitePostHash;
    auditReport.environment.jsonImmutability = jsonHash === jsonPostHash;
    console.log('Source DBs completely immutable:', sqliteHash === sqlitePostHash && jsonHash === jsonPostHash);

    fs.writeFileSync('server_data/independent_audit_results.json', JSON.stringify(auditReport, null, 2), 'utf8');

  } finally {
    client.release();
    await pool.end();
  }
}

runAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});

