const fs = require('fs');
const path = require('path');

const storeTs = fs.readFileSync(path.resolve(__dirname, '..', 'NativeBazar', 'src', 'data', 'store.ts'), 'utf8');

const storeMatches = storeTs.match(/export const \w+Store = \{/g);
console.log('Stores found in src/data/store.ts:');
console.log(storeMatches ? storeMatches.join('\n') : 'none');

