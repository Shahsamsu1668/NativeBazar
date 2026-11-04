const fs = require('fs');
const path = require('path');

const mockData = fs.readFileSync(path.resolve(__dirname, '..', 'NativeBazar', 'src', 'data', 'mockData.ts'), 'utf8');
const lines = mockData.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (/meghna/i.test(lines[i])) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
    console.log(lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 10)).join('\n'));
    console.log('--------------------------------------------------');
  }
}

