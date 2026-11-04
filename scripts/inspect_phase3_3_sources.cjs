const fs = require('fs');
const Database = require('better-sqlite3');

console.log('=== CHECKING SQLITE (nativebazar.db) ===');
const sqlite = new Database('nativebazar.db');
const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('SQLite tables:', tables.map(t => t.name));

['reviews', 'catalog', 'call_logs', 'farmer_expenses', 'negotiations'].forEach(t => {
  if (tables.some(tbl => tbl.name === t)) {
    const count = sqlite.prepare(`SELECT count(*) as c FROM "${t}"`).get().c;
    console.log(`SQLite ${t}: ${count} rows`);
  } else {
    console.log(`SQLite ${t}: TABLE DOES NOT EXIST`);
  }
});
sqlite.close();

console.log('\n=== CHECKING JSON (server_data/db.json) ===');
const jsonDb = JSON.parse(fs.readFileSync('server_data/db.json', 'utf8'));
console.log('JSON DB keys:', Object.keys(jsonDb));

['reviews', 'catalog', 'callLogs', 'call_logs', 'farmerExpenses', 'farmer_expenses', 'negotiations'].forEach(k => {
  if (jsonDb[k]) {
    console.log(`JSON ${k}: ${Array.isArray(jsonDb[k]) ? jsonDb[k].length : typeof jsonDb[k]}`);
  } else {
    console.log(`JSON ${k}: NOT PRESENT`);
  }
});

