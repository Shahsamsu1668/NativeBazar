const fs = require('fs');
const path = require('path');

const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));
const n = jsonDb.notifications.find(x => x.id === 'notif-test-1793343506045');
console.log('Failing notification record in db.json:', n);

