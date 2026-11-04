const fs = require('fs');

const files = [
  'src/services/api.ts',
  'src/services/apiService.ts',
  'src/data/store.ts',
  'src/components/WholesalerDashboard.tsx',
  'src/components/ContactsView.tsx',
  'src/components/Header.tsx',
  'src/components/MarketRatesView.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    console.log(`=== ${f} (${lines.length} lines) ===`);
    lines.forEach((line, i) => {
      if (/wholesaler-offers|market-prices|market-rates|\/api\/messages|\/api\/connections|\/api\/notifications/i.test(line)) {
        console.log(`  L${i+1}: ${line.trim()}`);
      }
    });
  }
});

