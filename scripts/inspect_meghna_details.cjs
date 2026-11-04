const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. mockData.ts
const mockData = fs.readFileSync(path.join(rootDir, 'NativeBazar', 'src', 'data', 'mockData.ts'), 'utf8');
const mockMatches = mockData.split('\n').filter(l => /meghna/i.test(l));
console.log('--- mockData.ts matches ---');
console.log(mockMatches.join('\n'));

// 2. store.ts
const store = fs.readFileSync(path.join(rootDir, 'NativeBazar', 'src', 'data', 'store.ts'), 'utf8');
const storeMatches = store.split('\n').filter(l => /meghna/i.test(l));
console.log('\n--- store.ts matches ---');
console.log(storeMatches.join('\n'));

// 3. SupplierDashboard.tsx
const supDash = fs.readFileSync(path.join(rootDir, 'NativeBazar', 'src', 'components', 'SupplierDashboard.tsx'), 'utf8');
const dashMatches = supDash.split('\n').filter(l => /meghna/i.test(l));
console.log('\n--- SupplierDashboard.tsx matches ---');
console.log(dashMatches.join('\n'));

// 4. server/db.ts
const serverDb = fs.readFileSync(path.join(rootDir, 'NativeBazar', 'server', 'db.ts'), 'utf8');
const sdbMatches = serverDb.split('\n').filter(l => /meghna/i.test(l));
console.log('\n--- server/db.ts matches ---');
console.log(sdbMatches.join('\n'));

