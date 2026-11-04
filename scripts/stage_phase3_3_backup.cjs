const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const backupDir = 'server_data/backups/phase3_3_pre_cutover';
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const filesToBackup = [
  'server.ts',
  'src/services/apiService.ts',
  'src/data/store.ts',
  'src/components/FarmerDashboard.tsx',
  'src/components/ContactsView.tsx'
];

const manifest = [];

filesToBackup.forEach(relPath => {
  const src = path.resolve(relPath);
  const target = path.join(backupDir, path.basename(relPath));
  const content = fs.readFileSync(src);
  fs.writeFileSync(target, content);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  manifest.push({
    relPath,
    target,
    size: content.length,
    hash
  });
  console.log(`Backed up ${relPath} -> ${target} (${hash})`);
});

fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log('Phase 3.3 Backup Manifest written successfully.');

