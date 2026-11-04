const fs = require('fs');
fs.copyFileSync('scripts/test_browser_e2e_robust.cjs', 'scripts/test_browser_e2e.cjs');
console.log('Synchronized scripts/test_browser_e2e.cjs');

