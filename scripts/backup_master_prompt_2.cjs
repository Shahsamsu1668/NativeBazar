const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
if (!env.TEST_DATABASE_URL || !env.TEST_DATABASE_URL.includes('ep-snowy-mode')) {
  console.error('SAFETY VIOLATION: Not on ep-snowy-mode branch!');
  process.exit(1);
}

const backupDir = 'server_data/backups/master_prompt_2_pre_audit';
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const filesToBackup = [
  'server.ts',
  'src/services/apiService.ts',
  'src/services/api.ts',
  'src/data/store.ts',
  'src/server/db.ts',
  'src/components/FarmerDashboard.tsx',
  'src/components/AuthPage.tsx',
  'src/App.tsx'
];

const manifest = {
  timestamp: new Date().toISOString(),
  targetBranch: 'dev-migration-test',
  activeEndpoint: 'ep-snowy-mode-b389h4uk.ap-southeast-1.aws.neon.tech',
  sqliteBaseline: '789498e18bae18062dc0a74dcad47ca5436019ee634fe209f9e72b28385e19c9',
  jsonBaseline: '1ab54a39e6961360165e43b116b16e56b230f2c36bafc9156403d116f2cd7a7a',
  files: {}
};

for (const file of filesToBackup) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const dest = path.join(backupDir, path.basename(file) + '.bak');
    fs.writeFileSync(dest, content);
    manifest.files[file] = { hash, backupPath: dest };
    console.log(`Backed up ${file} -> ${dest} (${hash.slice(0, 16)}...)`);
  }
}

// Check current SQLite and JSON hashes
const currentSqlite = crypto.createHash('sha256').update(fs.readFileSync('nativebazar.db')).digest('hex');
const currentJson = crypto.createHash('sha256').update(fs.readFileSync('server_data/db.json')).digest('hex');

manifest.currentSqliteHash = currentSqlite;
manifest.currentJsonHash = currentJson;
manifest.sqliteMatches = currentSqlite === manifest.sqliteBaseline;
manifest.jsonMatches = currentJson === manifest.jsonBaseline;

fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log('\n--- SAFETY CHECK ---');
console.log('Active Endpoint:', env.TEST_DATABASE_URL.split('@')[1].split('/')[0]);
console.log('SQLite Hash Valid:', manifest.sqliteMatches);
console.log('JSON DB Hash Valid:', manifest.jsonMatches);
console.log('Backup Manifest Written to:', path.join(backupDir, 'manifest.json'));

