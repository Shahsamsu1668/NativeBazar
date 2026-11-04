const fs = require('fs');
const content = fs.readFileSync('src/components/WholesalerDashboard.tsx', 'utf8');
const lines = content.split('\n');
console.log('Total lines:', lines.length);
lines.forEach((line, i) => {
  if (/procurement|demand|offer|bid|rate/i.test(line)) {
    if (/function|const|let|useState|useEffect|fetch|api/i.test(line)) {
      console.log(`L${i+1}: ${line.trim().slice(0, 100)}`);
    }
  }
});

