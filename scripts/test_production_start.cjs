const { spawn } = require('child_process');
const http = require('http');

console.log('=== TESTING PRODUCTION START COMMAND (npm start / tsx server.ts) ===\n');

const testPort = 3099;
const serverProcess = spawn('npx', ['tsx', 'server.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(testPort),
  },
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverReady = false;
let outputLogs = '';

serverProcess.stdout.on('data', (data) => {
  const str = data.toString();
  outputLogs += str;
  // console.log('[SERVER STDOUT]:', str.trim());
  if (str.includes('ready') || str.includes('Running at') || str.includes('listening') || str.includes('http://') || str.includes('started')) {
    serverReady = true;
  }
});

serverProcess.stderr.on('data', (data) => {
  const str = data.toString();
  outputLogs += str;
  // Ignore harmless ssl warnings
  if (!str.includes('SECURITY WARNING') && !str.includes('ExperimentalWarning')) {
    console.error('[SERVER STDERR]:', str.trim());
  }
});

async function runTest() {
  console.log(`[1] Spawning server on port ${testPort} with NODE_ENV=production...`);
  
  // Wait up to 12 seconds for server boot
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${testPort}/api/health`, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error('Health check request timed out'));
        });
      });

      if (res.statusCode === 200) {
        console.log('✓ Health check endpoint responded with HTTP 200:');
        console.log('  Response body:', res.body);
        console.log('\n[PASS] Server successfully started and responded in production mode via tsx server.ts!');
        serverProcess.kill('SIGTERM');
        process.exit(0);
      }
    } catch (e) {
      // Server not ready yet, continue polling
    }
  }

  console.error('[FAIL] Server failed to respond to /api/health within 12 seconds.');
  console.error('Captured logs:\n', outputLogs);
  serverProcess.kill('SIGKILL');
  process.exit(1);
}

runTest();
