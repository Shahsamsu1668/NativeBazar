const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9222;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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

async function debug() {
  const chromeProcess = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + path.resolve(__dirname, '../server_data/chrome_debug_profile'),
    'http://localhost:5178/NativeBazar/'
  ], { stdio: 'ignore' });

  await sleep(2000);
  const targets = await fetchJson(`http://localhost:${DEBUG_PORT}/json/list`);
  const page = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const curId = id++;
    const handler = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id === curId) {
        ws.removeEventListener('message', handler);
        res(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Console.messageAdded' || msg.method === 'Runtime.consoleAPICalled') {
      console.log('[Console]', JSON.stringify(msg.params));
    }
    if (msg.method === 'Network.responseReceived') {
      console.log('[Network]', msg.params.response.status, msg.params.response.url);
    }
  });

  await send('Page.enable');
  await send('Network.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  await send('Page.navigate', { url: 'http://localhost:5178/NativeBazar/' });

  await sleep(4000);

  const evalRes = await send('Runtime.evaluate', {
    expression: '({ bodyHtml: document.body.innerHTML, scripts: Array.from(document.querySelectorAll("script")).map(s => s.src), title: document.title })',
    returnByValue: true
  });

  console.log('DOM Evaluation Result:');
  console.log('Title:', evalRes.result?.value?.title);
  console.log('Scripts:', evalRes.result?.value?.scripts);
  console.log('Body HTML Length:', evalRes.result?.value?.bodyHtml?.length);
  console.log('Body HTML Preview:', evalRes.result?.value?.bodyHtml?.slice(0, 300));

  ws.close();
  chromeProcess.kill();
}

debug().catch(console.error);

