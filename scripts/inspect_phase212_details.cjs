const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'NativeBazar', 'src');
const typesTs = fs.readFileSync(path.join(srcDir, 'types.ts'), 'utf8');

// 1. Inspect Expense types
const expenseTypeMatch = typesTs.match(/(?:interface|type)\s+ExpenseLedgerEntry[\s\S]*?\}/);
console.log('=== ExpenseLedgerEntry in types.ts ===');
console.log(expenseTypeMatch ? expenseTypeMatch[0] : 'not found');

// 2. Inspect Negotiation types
const negTypeMatch = typesTs.match(/(?:interface|type)\s+NegotiationOffer[\s\S]*?\}/);
console.log('\n=== NegotiationOffer in types.ts ===');
console.log(negTypeMatch ? negTypeMatch[0] : 'not found');

// 3. Inspect Review types
const reviewTypeMatch = typesTs.match(/(?:interface|type)\s+ProductReview[\s\S]*?\}/);
console.log('\n=== ProductReview in types.ts ===');
console.log(reviewTypeMatch ? reviewTypeMatch[0] : 'not found');

// 4. Inspect CallLog types
const callTypeMatch = typesTs.match(/(?:interface|type)\s+CallRecord[\s\S]*?\}/);
console.log('\n=== CallRecord in types.ts ===');
console.log(callTypeMatch ? callTypeMatch[0] : 'not found');

// 5. Inspect supplierProducts in db.json
const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));
console.log('\n=== supplierProducts in db.json ===');
console.log(JSON.stringify(jsonDb.supplierProducts, null, 2));

