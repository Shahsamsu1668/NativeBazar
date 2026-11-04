const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const sqliteDb = new Database(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));

console.log('=== CHECKING RELATIONSHIPS & CONFLICTS ===');

// 1. Users
const sqliteUserIds = new Set(sqliteDb.prepare('SELECT id FROM users').all().map(u => u.id));
const jsonUserIds = new Set(jsonDb.users.map(u => u.id));
console.log('SQLite Users Count:', sqliteUserIds.size);
console.log('JSON Users Count:', jsonUserIds.size);
const missingInJson = [...sqliteUserIds].filter(id => !jsonUserIds.has(id));
const missingInSqlite = [...jsonUserIds].filter(id => !sqliteUserIds.has(id));
console.log('Users in SQLite missing in JSON:', missingInJson);
console.log('Users in JSON missing in SQLite:', missingInSqlite);

// 2. Orders & Order Items
const orders = sqliteDb.prepare('SELECT id, buyer_id, seller_id FROM orders').all();
console.log('\nOrders count:', orders.length);
for (const o of orders) {
  const buyerExists = sqliteUserIds.has(o.buyer_id);
  const sellerExists = sqliteUserIds.has(o.seller_id);
  if (!buyerExists) console.log(`Order ${o.id}: buyer ${o.buyer_id} NOT found in users`);
  if (!sellerExists) console.log(`Order ${o.id}: seller ${o.seller_id} NOT found in users`);
}

const items = sqliteDb.prepare('SELECT id, order_id, product_id FROM order_items').all();
const productIds = new Set(sqliteDb.prepare('SELECT id FROM products').all().map(p => p.id));
console.log('\nOrder items count:', items.length);
console.log('Products count:', productIds.size);
for (const it of items) {
  const prodExists = productIds.has(it.product_id);
  if (!prodExists) console.log(`Order item ${it.id}: product ${it.product_id} NOT found in products`);
}

// 3. Messages relationships
console.log('\nMessages count:', jsonDb.messages.length);
for (const m of jsonDb.messages) {
  const senderExists = sqliteUserIds.has(m.senderId);
  const recExists = sqliteUserIds.has(m.recipientId);
  if (!senderExists) console.log(`Message ${m.id}: sender ${m.senderId} not in users`);
  if (!recExists) console.log(`Message ${m.id}: recipient ${m.recipientId} not in users`);
}

// 4. Notifications relationships
console.log('\nNotifications count:', jsonDb.notifications.length);
for (const n of jsonDb.notifications) {
  const userExists = sqliteUserIds.has(n.userId);
  if (!userExists) console.log(`Notification ${n.id}: user ${n.userId} not in users`);
}

// 5. Connections relationships
console.log('\nConnections count:', jsonDb.connections.length);
for (const c of jsonDb.connections) {
  const reqExists = sqliteUserIds.has(c.requesterId);
  const recExists = sqliteUserIds.has(c.recipientId);
  if (!reqExists) console.log(`Connection ${c.id}: requester ${c.requesterId} not in users`);
  if (!recExists) console.log(`Connection ${c.id}: recipient ${c.recipientId} not in users`);
}

