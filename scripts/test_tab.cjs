const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9230;
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

async function testTab() {
  const profileDir = path.resolve(__dirname, '../server_data/chrome_profile_clean');
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { }
  }

  console.log('Spawning Chrome...');
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${profileDir}`
  ], { stdio: 'ignore' });

  let version = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      version = await requestHttp({ host: 'localhost', port: DEBUG_PORT, path: '/json/version', method: 'GET' });
      if (version) break;
    } catch { }
  }
  console.log('Chrome started:', version['Browser']);

  // Create new page tab
  const newTab = await requestHttp({
    host: 'localhost',
    port: DEBUG_PORT,
    path: `/json/new?${encodeURIComponent(BASE_URL)}`,
    method: 'PUT'
  });

  console.log('Created dedicated page tab:', newTab.id, newTab.url);
  console.log('Connecting to WebSocket:', newTab.webSocketDebuggerUrl);

  const ws = new WebSocket(newTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const callbacks = new Map();
  let loadFired = false;
  const consoleMessages = [];
  const uncaughtErrors = [];

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
    if (msg.method === 'Page.loadEventFired') {
      console.log('✓ Page.loadEventFired');
      loadFired = true;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || a.description).join(' ');
      consoleMessages.push({ type: msg.params.type, text });
      if (msg.params.type === 'error') {
        console.error('[Browser Console Error]', text);
      }
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      uncaughtErrors.push(desc);
      console.error('[Browser Exception]', desc);
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

  console.log('Waiting for load and hydration...');
  for (let i = 0; i < 20 && !loadFired; i++) {
    await sleep(300);
  }
  await sleep(4000);

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.getElementById('root');
      const rootHtml = root ? root.innerHTML : '';
      const bodyText = document.body.innerText || '';
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
      return {
        url: window.location.href,
        title: document.title,
        rootHtmlLength: rootHtml.length,
        bodyTextLength: bodyText.length,
        bodyTextSnippet: bodyText.substring(0, 300),
        buttonCount: buttons.length,
        buttons: buttons.slice(0, 10)
      };
    })()`,
    returnByValue: true
  });

  console.log('\n--- TAB EVALUATION RESULT ---');
  console.log(JSON.stringify(evalRes.result?.value, null, 2));
  console.log('Uncaught errors:', uncaughtErrors.length);

  ws.close();
  try { chrome.kill(); } catch { }
}

testTab().catch(console.error);

