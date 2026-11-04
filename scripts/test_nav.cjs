const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9225;
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

async function testWithPageLoad() {
  const profileDir = path.resolve(__dirname, '../server_data/chrome_nav_profile');
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { }
  }

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--user-data-dir=${profileDir}`
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
  const callbacks = new Map();
  let loadFired = false;

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
    if (msg.method === 'Page.loadEventFired') {
      console.log('✓ Page.loadEventFired received!');
      loadFired = true;
    }
    if (msg.method === 'Console.messageAdded') {
      console.log('[Console Message]', msg.params.message);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[Console API]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[Exception]', msg.params.exceptionDetails);
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    callbacks.set(curId, { resolve, reject });
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  console.log('Sending Page.navigate to', BASE_URL);
  await send('Page.navigate', { url: BASE_URL });

  // Wait for loadEventFired or max 6 seconds
  for (let i = 0; i < 15 && !loadFired; i++) {
    await sleep(400);
  }

  // Wait an additional 2 seconds for React hydration
  await sleep(3000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `({
      url: window.location.href,
      title: document.title,
      rootHtmlLen: document.getElementById('root')?.innerHTML.length,
      bodyTextLen: document.body.innerText.length,
      bodyTextSnippet: document.body.innerText.substring(0, 200)
    })`,
    returnByValue: true
  });

  console.log('Final Page Evaluation:', evalRes.result?.value);

  ws.close();
  try { chrome.kill(); } catch { }
}

testWithPageLoad().catch(console.error);

