const fs = require('fs');
const path = require('path');

function searchFiles(dir, pattern, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchFiles(fullPath, pattern, results);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.json') || entry.name.endsWith('.js'))) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (pattern.test(content)) {
          results.push(fullPath);
        }
      } catch (e) {}
    }
  }
  return results;
}

const rootDir = path.resolve(__dirname, '..');
const matches = searchFiles(rootDir, /meghna/i);
console.log('Files referencing "meghna":');
for (const m of matches) {
  console.log(' - ' + path.relative(rootDir, m));
}

