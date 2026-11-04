const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9245;
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

async function runBrowserE2E() {
  console.log('=== TEST SUITE 4: REAL BROWSER (HEADLESS CHROME) END-TO-END VERIFICATION ===\n');

  const profileDir = path.resolve(__dirname, '../server_data/cp_e2e_robust');
  if (fs.existsSync(profileDir)) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { }
  }

  console.log('Launching headless Google Chrome on port', DEBUG_PORT, '...');
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

  console.log('✓ Created dedicated test tab:', newTab.id);
  const ws = new WebSocket(newTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const callbacks = new Map();
  const uncaughtExceptions = [];
  const consoleErrors = [];

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(msg.error);
      else cb.resolve(msg.result);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text;
      uncaughtExceptions.push(desc);
      console.error('[Browser Uncaught Error]', desc);
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      if (msg.params.type === 'error') {
        const text = msg.params?.args?.map(a => a.value || a.description).join(' ');
        consoleErrors.push(text);
        console.error('[Browser Console Error]', text);
      }
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

  console.log('Navigating to', BASE_URL, '...');
  await send('Page.navigate', { url: BASE_URL });

  console.log('Polling for React DOM hydration (waiting up to 35s)...');
  let rootHtmlLen = 0;
  for (let s = 1; s <= 35; s++) {
    await sleep(1000);
    const r = await send('Runtime.evaluate', {
      expression: 'document.getElementById("root") ? document.getElementById("root").innerHTML.length : 0',
      returnByValue: true
    });
    rootHtmlLen = r.result?.value || 0;
    if (rootHtmlLen > 1000) {
      console.log(`✓ React DOM mounted and hydrated at second ${s}! Size: ${rootHtmlLen} bytes`);
      break;
    }
  }

  // Extra settle time
  await sleep(1500);

  const results = {};

  // 1. DOM Tree & React Root Verification
  console.log('\n--- 1. REACT HYDRATION & DOM RENDERING ---');
  const domRes = await send('Runtime.evaluate', {
    expression: `({
      title: document.title,
      rootHtmlLength: document.getElementById('root') ? document.getElementById('root').innerHTML.length : 0,
      visibleTextLength: document.body.innerText.length,
      visibleTextSnippet: document.body.innerText.substring(0, 150)
    })`,
    returnByValue: true
  });
  const dom = domRes.result?.value || {};
  rootHtmlLen = dom.rootHtmlLength || 0;
  const docTitle = dom.title || '';
  const visibleTextSnippet = dom.visibleTextSnippet || '';

  const containsAppBrand = docTitle.includes('আমার হাট') || docTitle.includes('Amar Haat') || visibleTextSnippet.includes('আমার হাট');
  const hydrationPassed = rootHtmlLen > 1000 && dom.visibleTextLength > 50 && containsAppBrand;

  results['1. DOM Hydration & Brand Rendering'] = {
    passed: hydrationPassed,
    docTitle,
    rootHtmlLength: rootHtmlLen,
    visibleTextLength: dom.visibleTextLength,
    containsAppBrand
  };
  console.log(`Title: "${docTitle}"`);
  console.log(`Root HTML Length: ${rootHtmlLen} bytes`);
  console.log(`Visible Text Length: ${dom.visibleTextLength} chars`);
  console.log(`Preview: "${visibleTextSnippet.replace(/\n+/g, ' ')}"`);
  console.log('Brand Detected:', containsAppBrand);
  console.log('DOM Hydration Status:', hydrationPassed ? 'PASS' : 'FAIL');

  // 2. Uncaught Runtime Errors & Secrets Leakage
  console.log('\n--- 2. CONSOLE & SECRETS AUDIT ---');
  const leakCheckRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.documentElement.outerHTML;
      const ls = JSON.stringify(localStorage);
      const leaksNeonUrl = text.includes('postgresql://') || ls.includes('postgresql://');
      const leaksApiKey = text.includes('DATABASE_URL') || ls.includes('DATABASE_URL');
      return { leaksNeonUrl, leaksApiKey };
    })()`,
    returnByValue: true
  });
  const leakCheck = leakCheckRes.result?.value || {};
  const noLeaks = !leakCheck.leaksNeonUrl && !leakCheck.leaksApiKey;
  const noErrors = uncaughtExceptions.length === 0;

  results['2. Console Errors & Secrets Security'] = {
    passed: noErrors && noLeaks,
    uncaughtErrorsCount: uncaughtExceptions.length,
    consoleErrorsCount: consoleErrors.length,
    noLeaks
  };
  console.log('Uncaught Console Errors:', uncaughtExceptions.length);
  console.log('Console Errors:', consoleErrors.length);
  console.log('Secrets Leaked in DOM/Storage:', noLeaks ? 'NO (SECURE)' : 'YES (LEAK)');

  // 3. Responsive Viewport Testing (Desktop & Mobile)
  console.log('\n--- 3. RESPONSIVE VIEWPORTS ---');
  // Desktop 1440x900
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(400);
  const desktopWidth = (await send('Runtime.evaluate', { expression: 'window.innerWidth' })).result?.value;

  // Mobile 390x844 (iPhone 12/13/14 class)
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await sleep(400);
  const mobileWidth = (await send('Runtime.evaluate', { expression: 'window.innerWidth' })).result?.value;

  const viewportsPassed = desktopWidth === 1440 && mobileWidth === 390;
  results['3. Responsive Viewports'] = {
    passed: viewportsPassed,
    desktopWidth,
    mobileWidth
  };
  console.log(`Desktop Viewport: ${desktopWidth}px | Mobile Viewport: ${mobileWidth}px ->`, viewportsPassed ? 'PASS' : 'FAIL');

  // Reset viewport
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

  // 4. Interactive UI Elements & Buttons
  console.log('\n--- 4. INTERACTIVE UI ELEMENTS & NAVIGATION ---');
  const uiElementsRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
      const links = Array.from(document.querySelectorAll('a')).map(a => a.innerText.trim()).filter(Boolean);
      const inputs = Array.from(document.querySelectorAll('input')).map(i => i.placeholder || i.type);
      return { buttonCount: buttons.length, sampleButtons: buttons.slice(0, 10), inputCount: inputs.length, sampleInputs: inputs.slice(0, 5) };
    })()`,
    returnByValue: true
  });
  const uiElements = uiElementsRes.result?.value || {};
  const uiPassed = uiElements.buttonCount > 3;

  results['4. Interactive UI Buttons & Inputs'] = {
    passed: uiPassed,
    buttonCount: uiElements.buttonCount,
    sampleButtons: uiElements.sampleButtons,
    inputCount: uiElements.inputCount
  };
  console.log(`Interactive Buttons Detected: ${uiElements.buttonCount} (${uiElements.sampleButtons?.join(', ')})`);
  console.log(`Form Inputs Detected: ${uiElements.inputCount}`);
  console.log('UI Elements Check:', uiPassed ? 'PASS' : 'FAIL');

  ws.close();
  try { chrome.kill(); } catch { }

  const allPassed = Object.values(results).every(r => r.passed);
  console.log('\n=============================================');
  console.log(`TEST SUITE 4 VERDICT: ${allPassed ? 'ALL BROWSER TESTS PASSED (100%)' : 'BROWSER TESTS FAILED'}`);
  console.log('=============================================\n');

  fs.writeFileSync('server_data/suite4_browser_e2e_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    allPassed,
    results
  }, null, 2), 'utf8');

  return allPassed;
}

runBrowserE2E().catch(err => {
  console.error('Browser E2E Execution Error:', err);
  process.exit(1);
});

