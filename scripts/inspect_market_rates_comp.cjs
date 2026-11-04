const fs = require('fs');
const content = fs.readFileSync('src/components/MarketRatesView.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
lines.forEach((line, i) => {
  if (/fetch|api|rates|prices|intelligence/i.test(line)) {
    if (/import|const|function|useEffect/i.test(line)) {
      console.log(`L${i+1}: ${line.trim().slice(0, 100)}`);
    }
  }
});

