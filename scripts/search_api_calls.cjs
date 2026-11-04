const fs = require('fs');

function checkFile(filePath, regex) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (regex.test(line)) {
      console.log(`${filePath}:${i+1}: ${line.trim().slice(0, 120)}`);
    }
  });
}

console.log('--- Checking fetch or api calls ---');
['src/components/ContactsView.tsx', 'src/components/Header.tsx', 'src/components/WholesalerDashboard.tsx', 'src/components/MarketRatesView.tsx', 'src/data/store.ts', 'src/services/apiService.ts'].forEach(f => {
  checkFile(f, /fetch\(|api\.|\/api\//);
});

