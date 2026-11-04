const path = require('path');
const fs = require('fs');

const innerDbPath = path.resolve(__dirname, '..', 'NativeBazar', 'server', 'db.ts');
const content = fs.readFileSync(innerDbPath, 'utf8');
const dataDirMatch = content.match(/DATA_DIR\s*=\s*([^;]+);/);
const dbFileMatch = content.match(/DB_FILE\s*=\\s*([^;]+);/);
console.log('db.ts DATA_DIR line:', dataDirMatch ? dataDirMatch[0] : 'none');

const simulatedDir = path.resolve(__dirname, '..', 'NativeBazar', 'server', '..', '..', 'server_data');
const simulatedDb = path.join(simulatedDir, 'db.json');
console.log('Resolved target DB_FILE:', simulatedDb);
console.log('Target db.json exists:', fs.existsSync(simulatedDb));
const stats = fs.statSync(simulatedDb);
console.log('Target db.json size:', stats.size);

