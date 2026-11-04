const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9237;
const BASE_URL = 'http://localhost:5178/NativeBazar/';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function requestHttp(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { resolve(d); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const profileDir = path.resolve(__dirname, '../server_data/cp_net_idle');
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { }
  }

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(1500);

  const newTab = await requestHttp({
    host: 'localhost',
    port: DEBUG_PORT,
    path: '/json/new?about:blank',
    method: 'PUT'
  });

  const ws = new WebSocket(newTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const callbacks = new Map();
  const pendingRequests = new Map();
  let completedCount = 0;

  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && callbacks.has(m.id)) {
      const cb = callbacks.get(m.id);
      callbacks.delete(m.id);
      if (m.error) cb.reject(m.error); else cb.resolve(m.result);
    }
    if (m.method === 'Network.requestWillBeSent') {
      pendingRequests.set(m.params.requestId, m.params.request.url);
    }
    if (m.method === 'Network.responseReceived') {
      completedCount++;
    }
    if (m.method === 'Network.loadingFinished') {
      pendingRequests.delete(m.params.requestId);
    }
    if (m.method === 'Network.loadingFailed') {
      pendingRequests.delete(m.params.requestId);
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    callbacks.set(curId, { resolve, reject });
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  console.log('Navigating to', BASE_URL);
  await send('Page.navigate', { url: BASE_URL });

  console.log('Polling for React hydration (waiting up to 25s)...');
  let rootHtmlLen = 0;
  for (let s = 1; s <= 25; s++) {
    await sleep(1000);
    const r = await send('Runtime.evaluate', {
      expression: 'document.getElementById("root") ? document.getElementById("root").innerHTML.length : 0',
      returnByValue: true
    });
    rootHtmlLen = r.result?.value || 0;
    if (pendingRequests.size < 15) console.log('PENDING:', Array.from(pendingRequests.values())); console.log(`[Second ${s}] Pending reqs: ${pendingRequests.size}, Completed: ${completedCount}, Root HTML size: ${rootHtmlLen} bytes`);
    if (rootHtmlLen > 1000) {
      console.log(`✓ SUCCESS! React mounted and hydrated at second ${s}!`);
      break;
    }
  }

  const evalRes = await send('Runtime.evaluate', {
    expression: `({
      rootHtml: document.getElementById('root')?.innerHTML.length,
      bodyTextLen: document.body.innerText.length,
      snippet: document.body.innerText.substring(0, 150)
    })`,
    returnByValue: true
  });
  console.log('\nFinal DOM Check:\n', JSON.stringify(evalRes.result?.value, null, 2));

  ws.close();
  try { chrome.kill(); } catch { }
}

run().catch(console.error);
