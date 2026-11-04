const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const Database = require('better-sqlite3');

const rootDir = path.resolve(__dirname, '..');
const backupDir = path.join(rootDir, 'server_data', 'backups', 'phase2_2_verified_backups');
fs.mkdirSync(backupDir, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// 1. Source files
const sqliteSrc = path.join(rootDir, 'nativebazar.db');
const jsonSrc = path.join(rootDir, 'server_data', 'db.json');

// 2. Backup destination files
const sqliteBackup = path.join(backupDir, `nativebazar_source_${timestamp}.db`);
const jsonBackup = path.join(backupDir, `db_json_source_${timestamp}.json`);

fs.copyFileSync(sqliteSrc, sqliteBackup);
fs.copyFileSync(jsonSrc, jsonBackup);

function getFileMeta(filePath) {
  const buf = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  const size = fs.statSync(filePath).size;
  return { path: filePath, size, sha256: hash };
}

const meta = {
  sqliteOriginal: getFileMeta(sqliteSrc),
  sqliteBackup: getFileMeta(sqliteBackup),
  jsonOriginal: getFileMeta(jsonSrc),
  jsonBackup: getFileMeta(jsonBackup),
};

console.log('=== STAGE B: BACKUP & SOURCE VERIFICATION ===');
console.log('SQLite Original Size:', meta.sqliteOriginal.size, 'bytes');
console.log('SQLite Original SHA256:', meta.sqliteOriginal.sha256);
console.log('SQLite Backup Size:', meta.sqliteBackup.size, 'bytes');
console.log('SQLite Backup SHA256:', meta.sqliteBackup.sha256);
console.log('SQLite Match:', meta.sqliteOriginal.sha256 === meta.sqliteBackup.sha256);

console.log('\nJSON Original Size:', meta.jsonOriginal.size, 'bytes');
console.log('JSON Original SHA256:', meta.jsonOriginal.sha256);
console.log('JSON Backup Size:', meta.jsonBackup.size, 'bytes');
console.log('JSON Backup SHA256:', meta.jsonBackup.sha256);
console.log('JSON Match:', meta.jsonOriginal.sha256 === meta.jsonBackup.sha256);

// Record source row counts
const sqliteDb = new Database(sqliteSrc, { readonly: true });
const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('\n--- SQLite Source Table Row Counts ---');
const sqliteCounts = {};
for (const t of tables) {
  const c = sqliteDb.prepare(`SELECT count(*) as count FROM "${t.name}"`).get();
  sqliteCounts[t.name] = c.count;
  console.log(`  ${t.name}: ${c.count}`);
}

const jsonData = JSON.parse(fs.readFileSync(jsonSrc, 'utf8'));
console.log('\n--- JSON DB Source Collection Counts ---');
const jsonCounts = {};
for (const k of Object.keys(jsonData)) {
  if (Array.isArray(jsonData[k])) {
    jsonCounts[k] = jsonData[k].length;
    console.log(`  ${k}: ${jsonData[k].length}`);
  }
}

// Write manifest
const manifest = {
  timestamp,
  meta,
  sqliteCounts,
  jsonCounts
};
fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log('\nBackup Manifest written to:', path.join(backupDir, 'manifest.json'));

