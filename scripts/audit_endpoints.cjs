const fs = require('fs');
const path = require('path');

const serverFile = path.resolve(__dirname, '..', 'NativeBazar', 'server.ts');
const content = fs.readFileSync(serverFile, 'utf8');

const routeRegex = /app\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
let match;
const routes = [];

while ((match = routeRegex.exec(content)) !== null) {
  const method = match[1].toUpperCase();
  const endpoint = match[2];
  const idx = match.index;
  // Look at the next 600 characters to see what DB or auth middleware is used
  const snippet = content.slice(idx, idx + 800);
  
  let dbUsed = [];
  if (snippet.includes('pool.query')) dbUsed.push('Neon (PostgreSQL)');
  if (snippet.includes('db.prepare') || snippet.includes('executeOrderTransaction')) dbUsed.push('SQLite');
  if (snippet.includes('jsonDb.') || snippet.includes('db.json')) dbUsed.push('JSON DB');
  
  let authUsed = [];
  if (snippet.includes('requireAuth')) authUsed.push('requireAuth');
  if (snippet.includes('requireAdmin')) authUsed.push('requireAdmin');
  if (snippet.includes('optionalAuth')) authUsed.push('optionalAuth');
  
  routes.push({
    method,
    endpoint,
    dbUsed: dbUsed.length > 0 ? dbUsed.join(', ') : 'None / In-Memory / AI',
    auth: authUsed.length > 0 ? authUsed.join(', ') : 'Public / None'
  });
}

console.log(JSON.stringify(routes, null, 2));

