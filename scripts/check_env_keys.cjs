const fs = require('fs');
const path = require('path');

function checkEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, keys: [] };
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const keys = content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && line.includes('='))
    .map(line => line.split('=')[0].trim());
  return { exists: true, keys };
}

const files = [
  'NativeBazar/.env.local',
  'NativeBazar/.env',
  '.env.local',
  '.env'
];

const results = {};
for (const f of files) {
  results[f] = checkEnv(path.resolve(__dirname, '..', f));
}

console.log(JSON.stringify(results, null, 2));

