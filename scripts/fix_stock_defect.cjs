const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/server/db.ts');
let content = fs.readFileSync(filePath, 'utf8');

const targetRegex = /if\s*\(prod\.available_kg\s*<\s*item\.quantityKg\)\s*\{\s*\/\/\s*Replenish stock to satisfy order if lot existed\s*db\.prepare\('UPDATE products SET available_kg = available_kg \+ \? WHERE id = \?'\)\s*\.run\(item\.quantityKg\s*\*\s*2,\s*prod\.id\);\s*prod\s*=\s*getProductStmt\.get\(item\.productId\)\s*as\s*any;\s*\}/;

if (!targetRegex.test(content)) {
  console.error('Regex target not matched in src/server/db.ts');
  process.exit(1);
}

const replacement = `if (prod.available_kg < item.quantityKg) {
        throw new Error(\`Insufficient stock for "\${prod.crop_name}". Available: \${prod.available_kg} kg, Requested: \${item.quantityKg} kg.\`);
      }`;

content = content.replace(targetRegex, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully replaced auto-replenishment with explicit error in src/server/db.ts');

