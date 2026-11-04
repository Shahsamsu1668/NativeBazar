const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9224;
const BASE_URL = 'http://localhost:5178/NativeBazar/';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function testImport() {
  const profileDir = path.resolve(__dirname, '../server_data/chrome_test_profile');
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { }
  }

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let versionInfo = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      versionInfo = await fetchJson(`http://localhost:${DEBUG_PORT}/json/version`);
      if (versionInfo) break;
    } catch { }
  }

  const targets = await fetchJson(`http://localhost:${DEBUG_PORT}/json/list`);
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', handler);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: BASE_URL });
  await sleep(3000);

  // Now dynamically import main.tsx and catch error
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        console.log('Testing dynamic import...');
        const mod = await import('/NativeBazar/src/main.tsx');
        return { success: true, mod: Object.keys(mod) };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Dynamic import result:', JSON.stringify(res, null, 2));

  await sleep(1000);

  const rootCheck = await send('Runtime.evaluate', {
    expression: `({
      rootHtml: document.getElementById('root')?.innerHTML,
      innerText: document.body.innerText
    })`,
    returnByValue: true
  });
  console.log('Root check after import:', rootCheck.result?.value);

  ws.close();
  try { chrome.kill(); } catch { }
}

testImport().catch(console.error);

