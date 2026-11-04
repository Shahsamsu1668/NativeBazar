const fs = require('fs');
const path = require('path');

function searchCode(dir, pattern) {
  const results = [];
  function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const full = path.join(d, f);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
        const c = fs.readFileSync(full, 'utf8');
        const lines = c.split('\n');
        lines.forEach((l, i) => {
          if (pattern.test(l)) {
            results.push(`${full}:${i+1}: ${l.trim().slice(0, 100)}`);
          }
        });
      }
    }
  }
  walk(dir);
  return results;
}

console.log('--- Farmer Expenses Search ---');
console.log(searchCode('src', /expense/i).slice(0, 25).join('\n'));

console.log('\n--- Negotiations Search ---');
console.log(searchCode('src', /negotiat/i).slice(0, 25).join('\n'));

console.log('\n--- Reviews Search in server.ts ---');
const serverLines = fs.readFileSync('server.ts', 'utf8').split('\n');
serverLines.forEach((l, i) => {
  if (/review|catalog|call.?log|expense|negotiat/i.test(l)) {
    if (/app\.(get|post|put|delete)|function|const\s+\w+\s*=/i.test(l)) {
      console.log(`server.ts:${i+1}: ${l.trim().slice(0, 100)}`);
    }
  }
});

