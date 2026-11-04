const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const sqliteDb = new Database(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));

const u1 = sqliteDb.prepare("SELECT * FROM users WHERE id = 'far-shibganj-1'").get();
const u2 = jsonDb.users.find(u => u.id === 'user-farmer-rafiq');
const u3 = sqliteDb.prepare("SELECT * FROM users WHERE phone = '01712458920'").get();

console.log('far-shibganj-1 in SQLite:', u1);
console.log('user-farmer-rafiq in JSON:', u2);
console.log('Phone 01712458920 in SQLite:', u3);

