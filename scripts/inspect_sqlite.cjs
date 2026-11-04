const Database = require('better-sqlite3');
const path = require('path');

const sqlitePaths = [
  path.resolve(__dirname, '..', 'NativeBazar', 'nativebazar.db'),
  path.resolve(__dirname, '..', 'nativebazar.db')
];

for (const p of sqlitePaths) {
  try {
    const db = new Database(p, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    console.log(`SQLite: ${p}`);
    console.log(`Tables:`, tables.map(t => t.name));
    for (const t of tables) {
      const count = db.prepare(`SELECT count(*) as count FROM "${t.name}"`).get();
      console.log(`  - ${t.name}: ${count.count} rows`);
    }
  } catch (e) {
    console.log(`SQLite not accessible at ${p}: ${e.message}`);
  }
}

