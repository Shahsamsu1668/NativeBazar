const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'server_data', 'db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

console.log('JSON DB Collections:');
for (const key of Object.keys(data)) {
  const len = Array.isArray(data[key]) ? data[key].length : typeof data[key];
  console.log(`  - ${key}: ${len}`);
}

