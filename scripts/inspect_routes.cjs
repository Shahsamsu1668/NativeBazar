const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const lines = content.split('\n');

const routeMatches = [];
lines.forEach((line, idx) => {
  const m = line.match(/app\.(get|post|put|delete|patch)\((['"][^'"]+['"])/);
  if (m) {
    routeMatches.push({ line: idx + 1, method: m[1].toUpperCase(), route: m[2] });
  }
});

console.log(JSON.stringify(routeMatches, null, 2));

