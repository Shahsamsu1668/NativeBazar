const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9231;
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

async function inspectTab() {
  const profileDir = path.resolve(__dirname, '../server_data/chrome_profile_inspect');
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { }
  }

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  await sleep(1500);

  const newTab = await requestHttp({
    host: 'localhost',
    port: DEBUG_PORT,
    path: `/json/new?${encodeURIComponent(BASE_URL)}`,
    method: 'PUT'
  });

  const ws = new WebSocket(newTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const callbacks = new Map();
  const networkLogs = [];

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
    if (msg.method === 'Network.requestWillBeSent') {
      networkLogs.push(`REQ: ${msg.params.request.method} ${msg.params.request.url}`);
    }
    if (msg.method === 'Network.responseReceived') {
      networkLogs.push(`RES: ${msg.params.response.status} ${msg.params.response.url}`);
    }
    if (msg.method === 'Network.loadingFailed') {
      networkLogs.push(`FAIL: ${msg.params.errorText} ${msg.params.canceled} ${msg.params.type}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      networkLogs.push(`CONSOLE [${msg.params.type}]: ${msg.params.args.map(a => a.value || a.description).join(' ')}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      networkLogs.push(`EXCEPTION: ${JSON.stringify(msg.params.exceptionDetails)}`);
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

  // Trigger explicit navigate now that listeners are attached
  await send('Page.navigate', { url: BASE_URL });

  await sleep(4000);

  const outerHtmlRes = await send('Runtime.evaluate', {
    expression: 'document.documentElement.outerHTML',
    returnByValue: true
  });

  console.log('--- NETWORK & CONSOLE LOGS ---');
  console.log(networkLogs.join('\n'));

  console.log('\n--- OUTER HTML (first 500 chars) ---');
  console.log((outerHtmlRes.result?.value || '').substring(0, 500));

  ws.close();
  try { chrome.kill(); } catch { }
}

inspectTab().catch(console.error);

