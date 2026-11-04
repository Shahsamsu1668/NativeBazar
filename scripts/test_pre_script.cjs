const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9236;
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
  const profileDir = path.resolve(__dirname, '../server_data/cp_eval_pre');
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
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && callbacks.has(m.id)) {
      const cb = callbacks.get(m.id);
      callbacks.delete(m.id);
      if (m.error) cb.reject(m.error); else cb.resolve(m.result);
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

  // Register pre-script to log all errors and module loads
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__LOGS = [];
      window.addEventListener('error', e => {
        window.__LOGS.push({ type: 'error', message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, error: e.error ? e.error.stack : null });
      });
      window.addEventListener('unhandledrejection', e => {
        window.__LOGS.push({ type: 'unhandledrejection', reason: e.reason ? (e.reason.stack || e.reason.message || String(e.reason)) : 'unknown' });
      });
      console.log('Pre-script installed successfully');
    `
  });

  console.log('Navigating to', BASE_URL);
  await send('Page.navigate', { url: BASE_URL });

  await sleep(4000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `({
      logs: window.__LOGS,
      title: document.title,
      rootInner: document.getElementById('root')?.innerHTML,
      bodyText: document.body.innerText
    })`,
    returnByValue: true
  });

  console.log('RESULT:\n', JSON.stringify(evalRes.result?.value, null, 2));

  ws.close();
  try { chrome.kill(); } catch { }
}

run().catch(console.error);

