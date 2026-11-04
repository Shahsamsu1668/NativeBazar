const Database = require('better-sqlite3');
const path = require('path');

const sqliteDb = new Database(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
const sellers = sqliteDb.prepare("SELECT DISTINCT seller_id, seller_name, seller_phone FROM products").all();
console.log('Sellers in products table:', sellers);

