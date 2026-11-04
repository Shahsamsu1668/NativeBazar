const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.match(/app\.(get|post|put|delete|patch|use)\s*\(\s*['"`]\/api\/(auth|ai|products)/)) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});

