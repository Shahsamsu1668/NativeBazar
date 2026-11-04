const Database = require('better-sqlite3');
const sqlite = new Database('nativebazar.db', { readonly: true });
console.log('SQLITE ORDERS COLUMNS:');
console.log(sqlite.prepare("PRAGMA table_info('orders')").all().map(c => c.name));
console.log('SQLITE PRODUCTS COLUMNS:');
console.log(sqlite.prepare("PRAGMA table_info('products')").all().map(c => c.name));
console.log('SQLITE ORDER ITEMS COLUMNS:');
console.log(sqlite.prepare("PRAGMA table_info('order_items')").all().map(c => c.name));

