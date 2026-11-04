const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9235;

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
  const profileDir = path.resolve(__dirname, '../server_data/cp_debug');
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
    if (m.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', m.params.type, m.params.args.map(a => a.value || a.description).join(' '));
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

  await send('Page.navigate', { url: 'http://localhost:5178/NativeBazar/' });
  await sleep(3500);

  const res = await send('Runtime.evaluate', {
    expression: `import('/NativeBazar/src/main.tsx').then(() => {
      const root = document.getElementById('root');
      return { success: true, rootHtmlLen: root ? root.innerHTML.length : -1 };
    }).catch(err => {
      return { err: err.message, stack: err.stack };
    })`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('IMPORT EVALUATION RESULT:\n', JSON.stringify(res.result?.value, null, 2));

  await sleep(2000);
  const finalCheck = await send('Runtime.evaluate', {
    expression: `({
      rootHtmlLen: document.getElementById('root') ? document.getElementById('root').innerHTML.length : -1,
      innerTextLen: document.body.innerText.length,
      buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText)
    })`,
    returnByValue: true
  });
  console.log('FINAL CHECK:\n', JSON.stringify(finalCheck.result?.value, null, 2));

  ws.close();
  try { chrome.kill(); } catch { }
}

run().catch(console.error);

