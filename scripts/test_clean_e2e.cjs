const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9232;
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

async function runCleanE2E() {
  const profileDir = path.resolve(__dirname, '../server_data/chrome_profile_e2e_clean');
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

  // Create clean blank tab
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
  let loadFired = false;
  const uncaughtErrors = [];
  const consoleErrors = [];

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
    if (msg.method === 'Page.loadEventFired') {
      loadFired = true;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      if (msg.params.type === 'error') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        consoleErrors.push(text);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      uncaughtErrors.push(desc);
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

  console.log('Navigating to', BASE_URL);
  await send('Page.navigate', { url: BASE_URL });

  // Wait for loadEventFired
  for (let i = 0; i < 30 && !loadFired; i++) {
    await sleep(200);
  }
  console.log('Page loaded, now waiting for React components to mount...');

  // Poll for document.getElementById('root').innerHTML.length > 0 or 8 seconds max
  let rootHtmlLen = 0;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const r = await send('Runtime.evaluate', {
      expression: 'document.getElementById("root") ? document.getElementById("root").innerHTML.length : 0',
      returnByValue: true
    });
    rootHtmlLen = r.result?.value || 0;
    if (rootHtmlLen > 50) {
      console.log(`React mounted at iteration ${i}! Root HTML length: ${rootHtmlLen} bytes`);
      break;
    }
  }

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.getElementById('root');
      const rootHtml = root ? root.innerHTML : '';
      const bodyText = document.body.innerText || '';
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
      const inputs = Array.from(document.querySelectorAll('input')).map(i => i.placeholder || i.type);
      return {
        url: window.location.href,
        title: document.title,
        rootHtmlLength: rootHtml.length,
        bodyTextLength: bodyText.length,
        bodyTextSnippet: bodyText.substring(0, 300),
        buttonCount: buttons.length,
        buttons: buttons.slice(0, 10),
        inputCount: inputs.length
      };
    })()`,
    returnByValue: true
  });

  console.log('\n--- EVALUATION SUMMARY ---');
  console.log(JSON.stringify(evalRes.result?.value, null, 2));
  console.log('Uncaught errors:', uncaughtErrors);
  console.log('Console errors:', consoleErrors);

  ws.close();
  try { chrome.kill(); } catch { }
}

runCleanE2E().catch(console.error);

