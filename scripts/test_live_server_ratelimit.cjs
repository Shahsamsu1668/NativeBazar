const { spawn } = require('child_process');
const path = require('path');

const tsxPath = path.resolve(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const serverPath = path.resolve(__dirname, '..', 'server.ts');

async function testLiveServer() {
  console.log('Testing live server.ts rate limiting on port 3009...');

  const serverProc = spawn(process.execPath, [tsxPath, serverPath], {
    env: { ...process.env, PORT: '3009' },
    cwd: path.resolve(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let isReady = false;

  serverProc.stdout.on('data', (d) => {
    const s = d.toString();
    if (s.includes('listening on port') || s.includes('3009')) {
      isReady = true;
    }
  });

  serverProc.stderr.on('data', (d) => {
    // console.log('[ERR]', d.toString());
  });

  // Wait for server to report ready
  for (let i = 0; i < 40; i++) {
    if (isReady) break;
    await new Promise(r => setTimeout(r, 500));
  }

  if (!isReady) {
    console.error('Server failed to report listening within 20s');
    serverProc.kill();
    process.exit(1);
  }

  console.log('Server is online and responding on port 3009.');

  // 1. Test /api/auth/login rate limiter (threshold: 20 per 15 min)
  console.log('Testing /api/auth/login rate limiter (sending 21 requests)...');
  let loginBlocked = false;
  let login429 = null;
  for (let i = 1; i <= 21; i++) {
    const res = await fetch('http://127.0.0.1:3009/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: '01712458920', password: 'wrongpassword' })
    });
    if (res.status === 429) {
      loginBlocked = true;
      login429 = await res.json();
      console.log(`  Request ${i} blocked with HTTP 429:`, login429);
      break;
    }
  }

  if (loginBlocked && login429 && login429.code === 'AUTH_RATE_LIMIT_EXCEEDED') {
    console.log('✓ PASS: /api/auth/login live rate limit verified on server.ts!');
  } else {
    console.error('✗ FAIL: /api/auth/login was not blocked after 20 attempts');
  }

  // 2. Test /api/ai/predict-demand rate limiter (threshold: 30 per min)
  console.log('Testing /api/ai/predict-demand rate limiter (sending 32 requests)...');
  let aiBlocked = false;
  let ai429 = null;
  for (let i = 1; i <= 32; i++) {
    const res = await fetch('http://127.0.0.1:3009/api/ai/predict-demand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop: 'Potato' })
    });
    if (res.status === 429) {
      aiBlocked = true;
      ai429 = await res.json();
      console.log(`  Request ${i} blocked with HTTP 429:`, ai429);
      break;
    }
  }

  if (aiBlocked && ai429 && ai429.code === 'AI_RATE_LIMIT_EXCEEDED') {
    console.log('✓ PASS: /api/ai live rate limit verified on server.ts!');
  } else {
    console.error('✗ FAIL: /api/ai was not blocked after 30 requests');
  }

  // Clean kill
  serverProc.kill('SIGTERM');
  console.log('Server stopped cleanly.');
  process.exit((loginBlocked && aiBlocked) ? 0 : 1);
}

testLiveServer().catch(err => {
  console.error(err);
  process.exit(1);
});
