const http = require('http');

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

async function testEval() {
  const targets = await fetchJson('http://localhost:9222/json/list');
  const page = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);

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

  const res1 = await send('Runtime.evaluate', { expression: 'document.title' });
  console.log('Title raw:', res1);

  const res2 = await send('Runtime.evaluate', { expression: 'document.getElementById("root").innerHTML.length' });
  console.log('Root HTML length raw:', res2);

  const res3 = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0, 300)' });
  console.log('Visible text preview:', res3);

  ws.close();
}

testEval().catch(console.error);

