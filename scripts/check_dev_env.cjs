const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

console.log('Dependencies:', Object.keys(pkg.dependencies || {}));
console.log('DevDependencies:', Object.keys(pkg.devDependencies || {}));

try {
  require('puppeteer');
  console.log('puppeteer: available');
} catch {
  console.log('puppeteer: not installed');
}

try {
  require('playwright');
  console.log('playwright: available');
} catch {
  console.log('playwright: not installed');
}

