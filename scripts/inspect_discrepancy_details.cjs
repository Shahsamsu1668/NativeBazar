const fs = require('fs');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
const pool = new Pool({ connectionString: env.TEST_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const sqliteDb = new Database('nativebazar.db', { readonly: true });

async function inspectDiscrepancies() {
  console.log('=== PRODUCT & ORDER DISCREPANCY AUDIT ===\n');

  // Products
  const sqliteProds = sqliteDb.prepare('SELECT id, seller_id, crop_name, available_kg FROM products').all();
  const neonProds = (await pool.query('SELECT id, seller_id, crop_name, available_qty FROM products')).rows;
  const neonProdIds = new Set(neonProds.map(p => p.id));

  console.log('--- PRODUCTS IN SQLITE BUT NOT IN NEON ---');
  const missingProds = sqliteProds.filter(p => !neonProdIds.has(p.id));
  console.table(missingProds);

  // Check sellers of missing products
  for (const mp of missingProds) {
    const userInSqlite = sqliteDb.prepare('SELECT id, name, role FROM users WHERE id = ?').get(mp.seller_id);
    const userInNeon = (await pool.query('SELECT id, name, role FROM users WHERE id = $1', [mp.seller_id])).rows[0];
    console.log(`Product ${mp.id} (${mp.crop_name}) Seller: ${mp.seller_id} -> SQLite:`, userInSqlite?.name, `-> Neon:`, userInNeon?.name || 'NOT FOUND');
  }

  // Orders
  const sqliteOrders = sqliteDb.prepare('SELECT id, buyer_id, seller_id, total_bdt, delivery_status FROM orders').all();
  const neonOrders = (await pool.query('SELECT id, buyer_id, seller_id, total_bdt, delivery_status FROM orders')).rows;
  const neonOrderIds = new Set(neonOrders.map(o => o.id));

  console.log('\n--- ORDERS IN SQLITE BUT NOT IN NEON ---');
  const missingOrders = sqliteOrders.filter(o => !neonOrderIds.has(o.id));
  console.table(missingOrders);

  for (const mo of missingOrders) {
    console.log(`Missing order: ${mo.id}, Buyer: ${mo.buyer_id}, Seller: ${mo.seller_id}, Total: ${mo.total_bdt}, Status: ${mo.delivery_status}`);
    const items = sqliteDb.prepare('SELECT * FROM order_items WHERE order_id = ?').all(mo.id);
    console.log(`  Items in SQLite (${items.length}):`, items);
  }

  await pool.end();
}

inspectDiscrepancies().catch(console.error);

