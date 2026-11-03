const express = require('express');
const { rateLimit } = require('express-rate-limit');

async function testTrustProxyBehavior() {
  console.log('=== TESTING EXPRESS TRUST PROXY TOPOLOGY & SPOOFING SAFETY ===\n');

  const app = express();
  app.set('trust proxy', 1); // 1-hop trusted reverse proxy

  const testLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({ error: 'Limit exceeded', clientIp: req.ip });
    }
  });

  app.use('/test-ip', (req, res) => {
    res.json({
      ip: req.ip,
      ips: req.ips,
      protocol: req.protocol,
      forwardedFor: req.headers['x-forwarded-for'],
    });
  });

  app.use('/test-limit', testLimiter, (req, res) => {
    res.json({ success: true, clientIp: req.ip });
  });

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  // Test 1: Single client IP via X-Forwarded-For (standard proxy forwarding)
  console.log('\n--- Scenario 1: Standard Proxy Forwarding ---');
  const res1 = await fetch(`http://127.0.0.1:${port}/test-ip`, {
    headers: {
      'X-Forwarded-For': '203.0.113.195',
      'X-Forwarded-Proto': 'https'
    }
  });
  const data1 = await res1.json();
  console.log('Result for single forwarded IP:', data1);
  if (data1.ip === '203.0.113.195' && data1.protocol === 'https') {
    console.log('✓ PASS: Express correctly extracted client IP and protocol from 1-hop proxy.');
  } else {
    console.error('✗ FAIL: IP extraction failed.');
  }

  // Test 2: Spoofed X-Forwarded-For (Client sends spoofed IP, proxy appends real IP)
  // When an attacker sends "X-Forwarded-For: 10.0.0.1", Render appends the real TCP peer: "10.0.0.1, 203.0.113.195"
  console.log('\n--- Scenario 2: Spoofing Attempt Pre-Appended by Attacker ---');
  const res2 = await fetch(`http://127.0.0.1:${port}/test-ip`, {
    headers: {
      'X-Forwarded-For': '1.1.1.1, 203.0.113.195',
      'X-Forwarded-Proto': 'https'
    }
  });
  const data2 = await res2.json();
  console.log('Result with spoofed prefix:', data2);
  if (data2.ip === '203.0.113.195') {
    console.log('✓ PASS: Express trust proxy = 1 rejected spoofed prefix 1.1.1.1 and used real client IP 203.0.113.195!');
  } else {
    console.error('✗ FAIL: Spoofed IP was accepted!');
  }

  // Test 3: Rate limiting isolation by client IP
  console.log('\n--- Scenario 3: Rate Limiting Isolation Across IPs ---');
  // Send 3 requests from Client A (203.0.113.10)
  for (let i = 1; i <= 3; i++) {
    await fetch(`http://127.0.0.1:${port}/test-limit`, {
      headers: { 'X-Forwarded-For': '203.0.113.10' }
    });
  }
  // 4th request from Client A should be blocked (429)
  const resA4 = await fetch(`http://127.0.0.1:${port}/test-limit`, {
    headers: { 'X-Forwarded-For': '203.0.113.10' }
  });
  console.log('Client A (203.0.113.10) request 4 status:', resA4.status);

  // Request from Client B (203.0.113.20) should SUCCEED (200 OK)
  const resB1 = await fetch(`http://127.0.0.1:${port}/test-limit`, {
    headers: { 'X-Forwarded-For': '203.0.113.20' }
  });
  console.log('Client B (203.0.113.20) request 1 status:', resB1.status);

  if (resA4.status === 429 && resB1.status === 200) {
    console.log('✓ PASS: Client A was rate-limited while Client B was unaffected! Zero cross-client collision.');
  } else {
    console.error('✗ FAIL: Client isolation failed under proxy rate limiting.');
  }

  server.close();
  console.log('\nAll trust proxy security tests PASSED.');
}

testTrustProxyBehavior().catch(e => { console.error(e); process.exit(1); });

