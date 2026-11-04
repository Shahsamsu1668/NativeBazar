const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const sqliteDb = new Database(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));

const sqliteProdCols = sqliteDb.prepare('PRAGMA table_info("products")').all().map(c => c.name);
const jsonCropSample = jsonDb.crops[0];
const jsonCropKeys = Object.keys(jsonCropSample);

console.log('JSON crop keys:', jsonCropKeys);
console.log('SQLite products columns:', sqliteProdCols);

// Check field mapping
console.log('\nField Mappings:');
for (const k of jsonCropKeys) {
  // Convert camelCase to snake_case
  const snake = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  const match = sqliteProdCols.includes(snake) ? snake : (sqliteProdCols.includes(k) ? k : 'MISSING');
  console.log(`  ${k} -> ${match}`);
}

