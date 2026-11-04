const Database = require('better-sqlite3');
const pg = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', 'NativeBazar', '.env.local') });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
}

function maskPhone(p) {
  if (!p || typeof p !== 'string') return p;
  if (p.length <= 5) return '***';
  return p.slice(0, 5) + '***' + p.slice(-3);
}

async function runValidation() {
  console.log('=== VALIDATION REPORT GENERATOR ===\n');

  // 1. SQLite Data
  const sqliteDb = new Database(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
  const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));

  // A. Crops vs Products
  const sqliteProducts = sqliteDb.prepare('SELECT * FROM products').all();
  console.log(`SQLite Products Count: ${sqliteProducts.length}`);
  const productsBySellerRole = {};
  for (const p of sqliteProducts) {
    productsBySellerRole[p.seller_role] = (productsBySellerRole[p.seller_role] || 0) + 1;
  }
  console.log('SQLite Products by seller_role:', productsBySellerRole);

  const jsonCrops = jsonDb.crops || [];
  const jsonSuppliers = jsonDb.supplierProducts || [];
  console.log(`JSON crops count: ${jsonCrops.length}`);
  console.log(`JSON supplierProducts count: ${jsonSuppliers.length}`);

  // Compare IDs between jsonCrops and sqliteProducts
  const sqliteProdIds = new Set(sqliteProducts.map(p => p.id));
  const jsonCropIds = new Set(jsonCrops.map(c => c.id));
  const jsonSupplierIds = new Set(jsonSuppliers.map(s => s.id));

  const cropIdsInSqlite = jsonCrops.filter(c => sqliteProdIds.has(c.id)).length;
  console.log(`JSON crop IDs found in SQLite products: ${cropIdsInSqlite} / ${jsonCrops.length}`);
  const supplierIdsInSqlite = jsonSuppliers.filter(s => sqliteProdIds.has(s.id)).length;
  console.log(`JSON supplier product IDs found in SQLite products: ${supplierIdsInSqlite} / ${jsonSuppliers.length}`);

  // List the 10 products in SQLite that are NOT in JSON crops
  const nonCropProducts = sqliteProducts.filter(p => !jsonCropIds.has(p.id));
  console.log(`SQLite products not in JSON crops (${nonCropProducts.length}):`);
  for (const p of nonCropProducts) {
    console.log(`  - ID: ${p.id}, seller_role: ${p.seller_role}, target_role: ${p.target_role}, crop_name: ${p.crop_name}, seller: ${p.seller_name}`);
  }

  // B. Orders & Order Items
  const sqliteOrders = sqliteDb.prepare('SELECT * FROM orders').all();
  const sqliteOrderItems = sqliteDb.prepare('SELECT * FROM order_items').all();
  const jsonOrders = jsonDb.orders || [];
  console.log(`\nSQLite Orders: ${sqliteOrders.length}, SQLite Order Items: ${sqliteOrderItems.length}`);
  console.log(`JSON Orders: ${jsonOrders.length}`);

  for (const so of sqliteOrders) {
    const items = sqliteOrderItems.filter(it => it.order_id === so.id);
    const jo = jsonOrders.find(j => j.id === so.id);
    console.log(`Order ${so.id}: ${items.length} items in SQLite order_items, found in JSON: ${!!jo}, JSON items: ${jo?.items?.length || 0}`);
  }

  // C. Audit logs comparison
  const sqliteAudit = sqliteDb.prepare('SELECT * FROM audit_logs').all();
  console.log(`\nSQLite Trade Audit Logs: ${sqliteAudit.length}`);
  for (const a of sqliteAudit) {
    const orderExists = sqliteOrders.some(o => o.id === a.order_id);
    console.log(`  - Audit log ${a.id}: order_id: ${a.order_id} (Exists: ${orderExists}), type: ${a.type}, amount: ${a.amount}, role: ${a.actor_role}`);
  }

  // D. Users investigation
  console.log('\n=== USER IDENTITY INVESTIGATION ===');
  const sqliteUsers = sqliteDb.prepare('SELECT * FROM users').all();
  const jsonUsers = jsonDb.users || [];

  // Dependent records for far-shibganj-1 and user-farmer-rafiq
  const prodsForFarShibganj = sqliteProducts.filter(p => p.seller_id === 'far-shibganj-1');
  const prodsForUserRafiq = sqliteProducts.filter(p => p.seller_id === 'user-farmer-rafiq');
  const cropsForFarShibganj = jsonCrops.filter(c => c.farmerId === 'far-shibganj-1');
  const cropsForUserRafiq = jsonCrops.filter(c => c.farmerId === 'user-farmer-rafiq');
  const ordersBuyerFar = sqliteOrders.filter(o => o.buyer_id === 'far-shibganj-1');
  const ordersSellerFar = sqliteOrders.filter(o => o.seller_id === 'far-shibganj-1');
  const ordersBuyerRafiq = sqliteOrders.filter(o => o.buyer_id === 'user-farmer-rafiq');
  const ordersSellerRafiq = sqliteOrders.filter(o => o.seller_id === 'user-farmer-rafiq');
  const msgsFar = (jsonDb.messages || []).filter(m => m.senderId === 'far-shibganj-1' || m.recipientId === 'far-shibganj-1');
  const msgsRafiq = (jsonDb.messages || []).filter(m => m.senderId === 'user-farmer-rafiq' || m.recipientId === 'user-farmer-rafiq');
  const connsFar = (jsonDb.connections || []).filter(c => c.requesterId === 'far-shibganj-1' || c.recipientId === 'far-shibganj-1');
  const connsRafiq = (jsonDb.connections || []).filter(c => c.requesterId === 'user-farmer-rafiq' || c.recipientId === 'user-farmer-rafiq');
  const notifsFar = (jsonDb.notifications || []).filter(n => n.userId === 'far-shibganj-1');
  const notifsRafiq = (jsonDb.notifications || []).filter(n => n.userId === 'user-farmer-rafiq');

  console.log(`References to 'far-shibganj-1':`);
  console.log(`  - Products: ${prodsForFarShibganj.map(p => p.id).join(', ')}`);
  console.log(`  - Crops: ${cropsForFarShibganj.length}`);
  console.log(`  - Orders (buyer): ${ordersBuyerFar.length}, (seller): ${ordersSellerFar.length}`);
  console.log(`  - Messages: ${msgsFar.length}`);
  console.log(`  - Connections: ${connsFar.length}`);
  console.log(`  - Notifications: ${notifsFar.length}`);

  console.log(`References to 'user-farmer-rafiq':`);
  console.log(`  - Products: ${prodsForUserRafiq.map(p => p.id).join(', ')}`);
  console.log(`  - Crops: ${cropsForUserRafiq.map(c => c.id).join(', ')}`);
  console.log(`  - Orders (buyer): ${ordersBuyerRafiq.length}, (seller): ${ordersSellerRafiq.length}`);
  console.log(`  - Messages: ${msgsRafiq.map(m => m.id).join(', ')}`);
  console.log(`  - Connections: ${connsRafiq.map(c => c.id).join(', ')}`);
  console.log(`  - Notifications: ${notifsRafiq.map(n => n.id).join(', ')}`);

  // Duplicate users by phone
  const phoneMap = new Map();
  for (const u of sqliteUsers) {
    if (!phoneMap.has(u.phone)) phoneMap.set(u.phone, []);
    phoneMap.get(u.phone).push({ source: 'sqlite', id: u.id, name: u.name, role: u.role });
  }
  for (const u of jsonUsers) {
    if (!phoneMap.has(u.phone)) phoneMap.set(u.phone, []);
    const existing = phoneMap.get(u.phone).find(x => x.id === u.id && x.source === 'json');
    if (!existing) phoneMap.get(u.phone).push({ source: 'json', id: u.id, name: u.name, role: u.role });
  }

  // Check Neon
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    const neonUsersRes = await client.query('SELECT id, name, phone, role FROM users');
    console.log(`Neon Users Count: ${neonUsersRes.rows.length}`);
    for (const nu of neonUsersRes.rows) {
      if (!phoneMap.has(nu.phone)) phoneMap.set(nu.phone, []);
      phoneMap.get(nu.phone).push({ source: 'neon', id: nu.id, name: nu.name, role: nu.role });
    }

    const neonLogsRes = await client.query('SELECT count(*)::int as count FROM login_audit_logs');
    console.log(`Neon login_audit_logs count: ${neonLogsRes.rows[0].count}`);
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n--- Duplicate Phone Investigations across all sources ---');
  let dupCount = 0;
  for (const [phone, entries] of phoneMap.entries()) {
    const uniqueIds = new Set(entries.map(e => e.id));
    if (uniqueIds.size > 1 || entries.length > 3) {
      dupCount++;
      console.log(`Phone: ${maskPhone(phone)} has differing IDs / multiple entries:`);
      for (const e of entries) {
        console.log(`   Source: ${e.source}, ID: ${e.id}, Role: ${e.role}, Name: ${e.name}`);
      }
    }
  }
  if (dupCount === 0) console.log('No phone has multiple IDs!');
}

runValidation().catch(e => console.error(e));

