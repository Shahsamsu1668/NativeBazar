const fs = require('fs');
const content = fs.readFileSync('src/types.ts', 'utf8');
const lines = content.split('\n');

function inspectType(typeName) {
  console.log(`=== TYPE: ${typeName} ===`);
  let recording = false;
  let braces = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes(`interface ${typeName}`) || l.includes(`type ${typeName}`)) {
      recording = true;
    }
    if (recording) {
      console.log(l);
      if (l.includes('{')) braces++;
      if (l.includes('}')) {
        braces--;
        if (braces <= 0) break;
      }
    }
  }
}

['Review', 'ExpenseLedgerEntry', 'NegotiationOffer', 'CallLog', 'CatalogProduct'].forEach(inspectType);

