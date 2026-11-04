const Database = require('better-sqlite3');
const fs = require('fs');

const sqlite = new Database('nativebazar.db', { readonly: true });
const json = JSON.parse(fs.readFileSync('server_data/db.json', 'utf8'));

console.log('=== USER DETAILS ===');
const uSqliteFar = sqlite.prepare("SELECT * FROM users WHERE id = 'far-shibganj-1'").get();
const uJsonRafiq = json.users.find(u => u.id === 'user-farmer-rafiq');

console.log('SQLite far-shibganj-1:', uSqliteFar);
console.log('\nJSON user-farmer-rafiq:', uJsonRafiq);

console.log('\n=== PRODUCTS / CROPS LINKED ===');
const pSqliteFar = sqlite.prepare("SELECT * FROM products WHERE seller_id = 'far-shibganj-1'").all();
const pJsonCropsRafiq = json.crops.filter(c => c.farmerId === 'user-farmer-rafiq');
const pJsonCropsFar = json.crops.filter(c => c.farmerId === 'far-shibganj-1');

console.log('SQLite products for far-shibganj-1:', pSqliteFar);
console.log('JSON crops for user-farmer-rafiq:', pJsonCropsRafiq.map(c => ({ id: c.id, cropName: c.cropName, variety: c.variety, price: c.expectedPricePerKg, location: `${c.district}, ${c.upazila}` })));
console.log('JSON crops for far-shibganj-1:', pJsonCropsFar);

console.log('\n=== ORDERS LINKED ===');
const oSqliteFar = sqlite.prepare("SELECT * FROM orders WHERE buyer_id = 'far-shibganj-1' OR seller_id = 'far-shibganj-1'").all();
const oJsonRafiq = json.orders.filter(o => o.customerId === 'user-farmer-rafiq' || o.sellerId === 'user-farmer-rafiq');
const oJsonFar = json.orders.filter(o => o.customerId === 'far-shibganj-1' || o.sellerId === 'far-shibganj-1');

console.log('SQLite orders for far-shibganj-1:', oSqliteFar);
console.log('JSON orders for user-farmer-rafiq:', oJsonRafiq);
console.log('JSON orders for far-shibganj-1:', oJsonFar);

console.log('\n=== MESSAGES & CONNECTIONS LINKED ===');
const mJsonRafiq = (json.messages || []).filter(m => m.senderId === 'user-farmer-rafiq' || m.receiverId === 'user-farmer-rafiq');
const mJsonFar = (json.messages || []).filter(m => m.senderId === 'far-shibganj-1' || m.receiverId === 'far-shibganj-1');
console.log('JSON messages for user-farmer-rafiq:', mJsonRafiq.length);
console.log('JSON messages for far-shibganj-1:', mJsonFar.length);

const cJsonRafiq = (json.connections || []).filter(c => c.userId === 'user-farmer-rafiq' || c.connectedUserId === 'user-farmer-rafiq');
const cJsonFar = (json.connections || []).filter(c => c.userId === 'far-shibganj-1' || c.connectedUserId === 'far-shibganj-1');
console.log('JSON connections for user-farmer-rafiq:', cJsonRafiq);
console.log('JSON connections for far-shibganj-1:', cJsonFar);

