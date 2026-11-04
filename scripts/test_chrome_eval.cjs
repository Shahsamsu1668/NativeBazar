const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9228;

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

async function run() {
  const profileDir = path.resolve(__dirname, '../server_data/chrome_profile_eval');
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { }
  }

  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${profileDir}`
  ], { stdio: 'ignore' });

  await sleep(1500);

  const targets = await fetchJson(`http://localhost:${DEBUG_PORT}/json/list`);
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
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
      console.log('BROWSER_CONSOLE:', m.params.type, m.params.args.map(a => a.value || a.description).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      console.log('BROWSER_EXCEPTION:', JSON.stringify(m.params.exceptionDetails));
    }
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    callbacks.set(curId, { resolve, reject });
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'http://localhost:5178/NativeBazar/' });
  await sleep(3500);

  const evalRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const root = document.getElementById('root');
        const scriptTags = Array.from(document.querySelectorAll('script')).map(s => s.src || s.innerHTML.substring(0, 50));
        let importErr = null;
        try {
          await import('/NativeBazar/src/main.tsx');
        } catch (e) {
          importErr = { message: e.message, stack: e.stack };
        }
        return {
          scripts: scriptTags,
          importErr,
          rootLength: root ? root.innerHTML.length : -1,
          rootText: root ? root.innerText : ''
        };
      } catch (err) {
        return { error: err.message };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('EVAL RESULT:', JSON.stringify(evalRes.result?.value, null, 2));

  ws.close();
  try { chrome.kill(); } catch { }
}

run().catch(console.error);

