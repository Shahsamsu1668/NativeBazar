const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('----------------------------------------------------');
console.log('             AMAR HAAT DATABASE INSPECTOR           ');
console.log('----------------------------------------------------');

const dbPath = path.resolve(__dirname, 'nativebazar.db');
console.log('Database Path:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.log('Database file not found at:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

console.log('\n--- SQLite Tables & Counts ---');
for (const t of tables) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
  console.log(`• ${t.name.padEnd(20)} : ${count} records`);
}

console.log('\n--- Sample Users Table (first 5) ---');
const users = db.prepare('SELECT id, role, name, phone, district, created_at FROM users LIMIT 5').all();
console.table(users);

console.log('\n--- Sample Products Table (first 5) ---');
const products = db.prepare('SELECT id, crop_name, bangla_name, seller_name, seller_role, quantity_kg, price_per_kg FROM products LIMIT 5').all();
console.table(products);

console.log('\n--- Sample Orders Table (first 5) ---');
const orders = db.prepare('SELECT id, buyer_name, seller_name, total_bdt, delivery_status, created_at FROM orders LIMIT 5').all();
console.table(orders);

const jsonPath = path.resolve(__dirname, 'server_data', 'db.json');
if (fs.existsSync(jsonPath)) {
  const jsonContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log('\n--- JSON Database Collections (server_data/db.json) ---');
  console.log(`• users               : ${jsonContent.users?.length || 0}`);
  console.log(`• crops               : ${jsonContent.crops?.length || 0}`);
  console.log(`• orders              : ${jsonContent.orders?.length || 0}`);
  console.log(`• messages            : ${jsonContent.messages?.length || 0}`);
  console.log(`• connections         : ${jsonContent.connections?.length || 0}`);
  console.log(`• notifications       : ${jsonContent.notifications?.length || 0}`);
}
console.log('----------------------------------------------------');

