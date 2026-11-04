const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9223;
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

async function debugBrowser() {
  const profileDir = path.resolve(__dirname, '../server_data/chrome_debug_profile');
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

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Log.entryAdded') {
      console.log('[Chrome Log]', msg.params.entry);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[Console API]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[Exception]', msg.params.exceptionDetails);
    }
    if (msg.method === 'Network.responseReceived') {
      const resp = msg.params.response;
      if (resp.status >= 400) {
        console.log('[Network Error HTTP', resp.status, ']', resp.url);
      }
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');

  console.log('Navigating to', BASE_URL);
  await send('Page.navigate', { url: BASE_URL });

  await sleep(5000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `({
      url: window.location.href,
      htmlLength: document.documentElement.outerHTML.length,
      rootLength: document.getElementById('root') ? document.getElementById('root').innerHTML.length : null,
      scripts: Array.from(document.querySelectorAll('script')).map(s => s.src)
    })`,
    returnByValue: true
  });
  console.log('Eval result:', evalRes.result?.value);

  ws.close();
  try { chrome.kill(); } catch { }
}

debugBrowser().catch(console.error);

