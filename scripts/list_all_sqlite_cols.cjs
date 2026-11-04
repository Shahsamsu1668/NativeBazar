const Database = require('better-sqlite3');
const sqlite = new Database('nativebazar.db', { readonly: true });
const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
for (const t of tables) {
  const cols = sqlite.prepare(`PRAGMA table_info('${t.name}')`).all().map(c => c.name);
  console.log(`${t.name}:`, cols);
}

