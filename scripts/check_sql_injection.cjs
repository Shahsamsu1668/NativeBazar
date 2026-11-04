const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');

const findings = [];
lines.forEach((line, idx) => {
  if (line.includes('pool.query(') && line.includes('${')) {
    findings.push({ line: idx + 1, text: line.trim() });
  }
});

console.log('Template literal interpolations in pool.query:');
console.log(findings);

