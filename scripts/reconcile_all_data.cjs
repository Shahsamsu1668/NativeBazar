const fs = require('fs');
const Database = require('better-sqlite3');
const { Pool } = require('pg');
const dotenv = require('dotenv');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
if (!env.TEST_DATABASE_URL || !env.TEST_DATABASE_URL.includes('ep-snowy-mode')) {
  console.error('SAFETY STOP: Not on ep-snowy-mode!');
  process.exit(1);
}

const sqlite = new Database('nativebazar.db', { readonly: true });
const jsonDb = JSON.parse(fs.readFileSync('server_data/db.json', 'utf8'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function reconcile() {
  console.log('=== DEEP DATA RECONCILIATION AUDIT ===\n');

  // 1. Users
  const sqliteUsers = sqlite.prepare('SELECT id, role, phone, name, password_hash, district, upazila FROM users').all();
  const jsonUsers = (jsonDb.users || []).map(u => ({ id: u.id, role: u.role, phone: u.phone, name: u.name, district: u.district, upazila: u.upazila }));
  const neonUsers = (await pool.query('SELECT id, role, phone, name, password_algo, district, upazila, created_at FROM users ORDER BY created_at ASC')).rows;

  console.log(`USERS: SQLite=${sqliteUsers.length}, JSON=${jsonUsers.length}, Neon=${neonUsers.length}`);

  // 2. Products
  const sqliteProducts = sqlite.prepare('SELECT id, crop_name, seller_id, seller_role, quantity_kg, available_kg, price_per_kg, harvest_status FROM products').all();
  const jsonCrops = (jsonDb.crops || []).map(c => ({ id: c.id, crop_name: c.cropName, seller_id: c.farmerId, price_per_kg: c.expectedPricePerKg, quantity_kg: c.quantityKg }));
  const jsonSupplierProducts = (jsonDb.supplierProducts || []).map(p => ({ id: p.id, crop_name: p.name, seller_id: p.supplierId, price_per_kg: p.price, quantity_kg: p.minOrderKg }));
  const neonProducts = (await pool.query('SELECT id, crop_name, seller_id, seller_role, quantity_kg, available_kg, price_per_kg, harvest_status FROM products ORDER BY id ASC')).rows;

  console.log(`PRODUCTS: SQLite=${sqliteProducts.length}, JSON Crops=${jsonCrops.length}, JSON SupplierProds=${jsonSupplierProducts.length}, Neon=${neonProducts.length}`);

  // 3. Orders & Order Items
  const sqliteOrders = sqlite.prepare('SELECT id, buyer_id, buyer_role, seller_id, total_bdt, delivery_status FROM orders').all();
  const sqliteOrderItems = sqlite.prepare('SELECT id, order_id, product_id, quantity_kg, unit_price, subtotal FROM order_items').all();
  const jsonOrders = (jsonDb.orders || []).map(o => ({ id: o.id, buyer_id: o.customerId, status: o.status, total: o.totalAmount, items: o.items }));
  const neonOrders = (await pool.query('SELECT id, buyer_id, buyer_role, seller_id, total_bdt, delivery_status, created_at FROM orders ORDER BY id ASC')).rows;
  const neonOrderItems = (await pool.query('SELECT id, order_id, product_id, quantity_kg, unit_price, subtotal FROM order_items ORDER BY id ASC')).rows;

  console.log(`ORDERS: SQLite=${sqliteOrders.length}, JSON=${jsonOrders.length}, Neon=${neonOrders.length}`);
  console.log(`ORDER ITEMS: SQLite=${sqliteOrderItems.length}, Neon=${neonOrderItems.length}`);

  // 4. Wholesaler Offers
  const sqliteOffers = sqlite.prepare('SELECT id, wholesaler_id, crop_name, offered_price_per_kg, quantity_kg_needed FROM wholesaler_offers').all();
  const neonOffers = (await pool.query('SELECT id, wholesaler_id, crop_name, offered_price_per_kg, quantity_kg_needed FROM wholesaler_offers ORDER BY id ASC')).rows;
  console.log(`WHOLESALER OFFERS: SQLite=${sqliteOffers.length}, Neon=${neonOffers.length}`);

  // 5. Market Prices
  const sqlitePrices = sqlite.prepare('SELECT id, district, market_name, crop_name, wholesale_price, retail_price FROM market_prices').all();
  const neonPrices = (await pool.query('SELECT id, district, market_name, crop_name, wholesale_price, retail_price FROM market_prices ORDER BY id ASC')).rows;
  console.log(`MARKET PRICES: SQLite=${sqlitePrices.length}, Neon=${neonPrices.length}`);

  // 6. Catalog
  const jsonCatalog = jsonDb.catalog || [];
  const neonCatalog = (await pool.query('SELECT id, name, name_bn, category FROM catalog ORDER BY id ASC')).rows;
  console.log(`CATALOG: JSON=${jsonCatalog.length}, Neon=${neonCatalog.length}`);

  // 7. Messages
  const jsonMessages = jsonDb.messages || [];
  const neonMessages = (await pool.query('SELECT id, sender_id, recipient_id, content, created_at FROM messages ORDER BY id ASC')).rows;
  console.log(`MESSAGES: JSON=${jsonMessages.length}, Neon=${neonMessages.length}`);

  // 8. Connections
  const jsonConnections = jsonDb.connections || [];
  const neonConnections = (await pool.query('SELECT id, requester_id, recipient_id, status FROM connections ORDER BY id ASC')).rows;
  console.log(`CONNECTIONS: JSON=${jsonConnections.length}, Neon=${neonConnections.length}`);

  // 9. Notifications
  const jsonNotifications = jsonDb.notifications || [];
  const neonNotifications = (await pool.query('SELECT id, user_id, title, read FROM notifications ORDER BY id ASC')).rows;
  console.log(`NOTIFICATIONS: JSON=${jsonNotifications.length}, Neon=${neonNotifications.length}`);

  // 10. Audit logs
  const sqliteAudit = sqlite.prepare('SELECT count(*) as c FROM audit_logs').get().c;
  const neonTradeAudit = (await pool.query('SELECT count(*)::int as c FROM trade_audit_logs')).rows[0].c;
  const neonLoginAudit = (await pool.query('SELECT count(*)::int as c FROM login_audit_logs')).rows[0].c;
  console.log(`AUDIT LOGS: SQLiteAudit=${sqliteAudit}, NeonTradeAudit=${neonTradeAudit}, NeonLoginAudit=${neonLoginAudit}`);

  // ID set comparisons
  const sqliteUserIds = new Set(sqliteUsers.map(u => u.id));
  const jsonUserIds = new Set(jsonUsers.map(u => u.id));
  const neonUserIds = new Set(neonUsers.map(u => u.id));

  const extraNeonUsers = neonUsers.filter(u => !sqliteUserIds.has(u.id) && !jsonUserIds.has(u.id));
  const missingFromNeonUsers = sqliteUsers.filter(u => !neonUserIds.has(u.id));

  const sqliteProdIds = new Set(sqliteProducts.map(p => p.id));
  const neonProdIds = new Set(neonProducts.map(p => p.id));
  const extraNeonProds = neonProducts.filter(p => !sqliteProdIds.has(p.id));
  const missingFromNeonProds = sqliteProducts.filter(p => !neonProdIds.has(p.id));

  const sqliteOrderIds = new Set(sqliteOrders.map(o => o.id));
  const neonOrderIds = new Set(neonOrders.map(o => o.id));
  const extraNeonOrders = neonOrders.filter(o => !sqliteOrderIds.has(o.id));
  const missingFromNeonOrders = sqliteOrders.filter(o => !neonOrderIds.has(o.id));

  const sqliteItemIds = new Set(sqliteOrderItems.map(i => i.id));
  const neonItemIds = new Set(neonOrderItems.map(i => i.id));
  const extraNeonItems = neonOrderItems.filter(i => !sqliteItemIds.has(i.id));
  const missingFromNeonItems = sqliteOrderItems.filter(i => !neonItemIds.has(i.id));

  // Orders vs Order Items check in Neon
  const neonOrderItemsByOrder = {};
  for (const item of neonOrderItems) {
    if (!neonOrderItemsByOrder[item.order_id]) neonOrderItemsByOrder[item.order_id] = [];
    neonOrderItemsByOrder[item.order_id].push(item);
  }
  const ordersWithoutItems = neonOrders.filter(o => !neonOrderItemsByOrder[o.id] || neonOrderItemsByOrder[o.id].length === 0);
  const itemsWithoutOrder = neonOrderItems.filter(i => !neonOrderIds.has(i.order_id));

  // Seller integrity in Neon products
  const productsWithNullSeller = neonProducts.filter(p => p.seller_id === null || p.seller_id === undefined);
  const productsWithForeignSeller = neonProducts.filter(p => p.seller_id && !neonUserIds.has(p.seller_id));

  const analysis = {
    counts: {
      users: { sqlite: sqliteUsers.length, json: jsonUsers.length, neon: neonUsers.length },
      products: { sqlite: sqliteProducts.length, jsonCrops: jsonCrops.length, jsonSupplier: jsonSupplierProducts.length, neon: neonProducts.length },
      orders: { sqlite: sqliteOrders.length, json: jsonOrders.length, neon: neonOrders.length },
      orderItems: { sqlite: sqliteOrderItems.length, neon: neonOrderItems.length },
      offers: { sqlite: sqliteOffers.length, neon: neonOffers.length },
      rates: { sqlite: sqlitePrices.length, neon: neonPrices.length },
      catalog: { json: jsonCatalog.length, neon: neonCatalog.length },
      messages: { json: jsonMessages.length, neon: neonMessages.length },
      connections: { json: jsonConnections.length, neon: neonConnections.length },
      notifications: { json: jsonNotifications.length, neon: neonNotifications.length },
      audit: { sqlite: sqliteAudit, trade: neonTradeAudit, login: neonLoginAudit }
    },
    users: {
      extraInNeon: extraNeonUsers,
      missingFromNeon: missingFromNeonUsers,
      sqliteNotInJson: sqliteUsers.filter(u => !jsonUserIds.has(u.id)),
      jsonNotInSqlite: jsonUsers.filter(u => !sqliteUserIds.has(u.id))
    },
    products: {
      extraInNeon: extraNeonProds,
      missingFromNeon: missingFromNeonProds,
      withNullSeller: productsWithNullSeller,
      withForeignSeller: productsWithForeignSeller
    },
    orders: {
      extraInNeon: extraNeonOrders,
      missingFromNeon: missingFromNeonOrders,
      ordersWithoutItems,
      itemsWithoutOrder
    },
    orderItems: {
      extraInNeon: extraNeonItems,
      missingFromNeon: missingFromNeonItems
    }
  };

  fs.writeFileSync('server_data/reconciliation_analysis.json', JSON.stringify(analysis, null, 2), 'utf8');
  console.log('\n--- DETAILED RECONCILIATION FINDINGS ---');
  console.log('1. USERS:');
  console.log('   Extra in Neon (not in SQLite/JSON):', extraNeonUsers.map(u => `${u.id} (${u.role}: ${u.phone})`));
  console.log('   Missing from Neon (in SQLite):', missingFromNeonUsers.map(u => u.id));
  console.log('   SQLite users NOT in JSON:', sqliteUsers.filter(u => !jsonUserIds.has(u.id)).map(u => `${u.id} (${u.phone})`));
  console.log('   JSON users NOT in SQLite:', jsonUsers.filter(u => !sqliteUserIds.has(u.id)).map(u => `${u.id} (${u.phone})`));

  console.log('\n2. PRODUCTS:');
  console.log('   Extra in Neon (not in SQLite):', extraNeonProds.map(p => `${p.id} (${p.crop_name}, seller: ${p.seller_id}, status: ${p.harvest_status})`));
  console.log('   Missing from Neon (in SQLite):', missingFromNeonProds.map(p => p.id));
  console.log('   Products with NULL Seller in Neon:', productsWithNullSeller.map(p => `${p.id} (${p.crop_name}, status: ${p.harvest_status})`));
  console.log('   Products with Orphaned Seller in Neon:', productsWithForeignSeller.map(p => `${p.id} (seller: ${p.seller_id})`));

  console.log('\n3. ORDERS & ITEMS:');
  console.log('   Extra Orders in Neon:', extraNeonOrders.map(o => `${o.id} (buyer: ${o.buyer_id}, total: ${o.total_bdt})`));
  console.log('   Missing Orders from Neon:', missingFromNeonOrders.map(o => o.id));
  console.log('   Orders without Order Items in Neon:', ordersWithoutItems.map(o => o.id));
  console.log('   Items without Orders in Neon:', itemsWithoutOrder.map(i => i.id));
  console.log('   Extra Order Items in Neon:', extraNeonItems.map(i => `${i.id} (order: ${i.order_id}, prod: ${i.product_id})`));

  await pool.end();
}

reconcile().catch(console.error);
