const { spawn } = require('child_process');
const path = require('path');

const tsxPath = path.resolve(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs');
const serverPath = path.resolve(__dirname, '..', 'server.ts');

async function testProductsRateLimit() {
  console.log('Testing live /api/products rate limiting on port 3012...');

  const serverProc = spawn(process.execPath, [tsxPath, serverPath], {
    env: { ...process.env, PORT: '3012' },
    cwd: path.resolve(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let isReady = false;

  serverProc.stdout.on('data', (d) => {
    const s = d.toString();
    console.log('[STDOUT]', s.trim());
    if (s.includes('listening on port') || s.includes('3012')) {
      isReady = true;
    }
  });

  serverProc.stderr.on('data', (d) => {
    console.log('[STDERR]', d.toString().trim());
  });

  for (let i = 0; i < 50; i++) {
    if (isReady) break;
    await new Promise(r => setTimeout(r, 500));
  }

  if (!isReady) {
    console.error('Server failed to start');
    serverProc.kill();
    process.exit(1);
  }

  console.log('Sending 121 requests to /api/products...');
  let blocked = false;
  let blockedData = null;
  for (let i = 1; i <= 122; i++) {
    const res = await fetch('http://127.0.0.1:3012/api/products');
    if (res.status === 429) {
      blocked = true;
      blockedData = await res.json();
      console.log(`  Request ${i} blocked with HTTP 429:`, blockedData);
      break;
    }
  }

  serverProc.kill('SIGTERM');

  if (blocked && blockedData && blockedData.code === 'PRODUCT_RATE_LIMIT_EXCEEDED') {
    console.log('✓ PASS: /api/products live rate limit verified on server.ts!');
    process.exit(0);
  } else {
    console.error('✗ FAIL: /api/products rate limit not enforced');
    process.exit(1);
  }
}

testProductsRateLimit().catch(e => { console.error(e); process.exit(1); });
