const fs = require('fs');
const path = require('path');

const storeTs = fs.readFileSync(path.resolve(__dirname, '..', 'NativeBazar', 'src', 'data', 'store.ts'), 'utf8');

function inspectStore(name) {
  const regex = new RegExp(`export const ${name}Store = \\{([\\s\\S]*?)\\n\\};`);
  const match = storeTs.match(regex);
  if (match) {
    console.log(`\n=== ${name}Store ===`);
    const lines = match[1].split('\n').slice(0, 15).join('\n');
    console.log(lines);
  }
}

['Demand', 'Advisory', 'Expense', 'Negotiation'].forEach(inspectStore);

