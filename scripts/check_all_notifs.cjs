const fs = require('fs');
const path = require('path');

const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));
for (const n of jsonDb.notifications) {
  console.log(`ID: ${n.id}, has message: ${!!n.message}, has body: ${!!n.body}, text: ${n.message || n.body}`);
}

