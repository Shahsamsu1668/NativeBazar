const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const pg = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', 'server_data', 'test_branch.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

const sqlitePath = path.resolve(__dirname, '..', 'nativebazar.db');
const jsonPath = path.resolve(__dirname, '..', 'server_data', 'db.json');
const testDbUrl = process.env.TEST_DATABASE_URL;

const sqlite = new Database(sqlitePath, { readonly: true });
const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const pool = new pg.Pool({
  connectionString: testDbUrl,
  ssl: { rejectUnauthorized: false }
});

async function runInvestigation() {
  console.log('=== DEEP HISTORICAL & IDENTITY INVESTIGATION ===\n');

  // 1. SQLITE PRODUCTS
  const sqliteProducts = sqlite.prepare('SELECT id, seller_id, seller_name, seller_role, crop_name, bangla_name, price_per_kg, quantity_kg, district, upazila, harvest_status FROM products').all();
  console.log(`SQLite Products Count: ${sqliteProducts.length}`);

  // 2. JSON PRODUCTS (crops + supplierProducts)
  const jsonCrops = json.crops || [];
  const jsonSuppliers = json.supplierProducts || [];
  console.log(`JSON Crops Count: ${jsonCrops.length}, Supplier Products Count: ${jsonSuppliers.length}, Total: ${jsonCrops.length + jsonSuppliers.length}`);

  // 3. NEON PRODUCTS
  const neonProductsRes = await pool.query('SELECT id, seller_id, seller_name, seller_role, crop_name, bangla_name, unit_price, quantity, district, upazila, harvest_status FROM products ORDER BY id');
  const neonProducts = neonProductsRes.rows;
  console.log(`Neon Products Count: ${neonProducts.length}`);

  // 4. SQLITE ORDERS
  const sqliteOrders = sqlite.prepare('SELECT id, buyer_id, buyer_name, seller_id, seller_name, seller_role, total_bdt, delivery_status, created_at FROM orders ORDER BY id').all();
  console.log(`\nSQLite Orders Count: ${sqliteOrders.length}`);

  // 5. JSON ORDERS
  const jsonOrders = json.orders || [];
  console.log(`JSON Orders Count: ${jsonOrders.length}`);

  // 6. NEON ORDERS
  const neonOrdersRes = await pool.query('SELECT id, buyer_id, buyer_name, seller_id, seller_name, seller_role, total_bdt, delivery_status, created_at FROM orders ORDER BY id');
  const neonOrders = neonOrdersRes.rows;
  console.log(`Neon Orders Count: ${neonOrders.length}`);

  // 7. USER COMPARISON: far-shibganj-1 vs user-farmer-rafiq
  console.log('\n--- USER IDENTITY COMPARISON ---');
  const sqliteFar1 = sqlite.prepare("SELECT * FROM users WHERE id = 'far-shibganj-1'").get();
  const sqliteRafiq = sqlite.prepare("SELECT * FROM users WHERE id = 'user-farmer-rafiq'").get();
  const jsonFar1 = (json.users || []).find(u => u.id === 'far-shibganj-1');
  const jsonRafiq = (json.users || []).find(u => u.id === 'user-farmer-rafiq');
  
  const neonFar1Res = await pool.query("SELECT * FROM users WHERE id = 'far-shibganj-1'");
  const neonRafiqRes = await pool.query("SELECT * FROM users WHERE id = 'user-farmer-rafiq'");

  console.log('SQLite far-shibganj-1:', sqliteFar1);
  console.log('SQLite user-farmer-rafiq:', sqliteRafiq);
  console.log('JSON far-shibganj-1:', jsonFar1);
  console.log('JSON user-farmer-rafiq:', jsonRafiq);
  console.log('Neon far-shibganj-1:', neonFar1Res.rows[0]);
  console.log('Neon user-farmer-rafiq:', neonRafiqRes.rows[0]);

  // 8. ORDERS LINKED TO far-shibganj-1 vs user-farmer-rafiq
  console.log('\n--- ORDERS LINKED TO THESE USERS ---');
  const sqliteOrdersFar1 = sqlite.prepare("SELECT id, buyer_id, buyer_name, seller_id, seller_name, total_bdt, created_at FROM orders WHERE buyer_id = 'far-shibganj-1' OR seller_id = 'far-shibganj-1'").all();
  const sqliteOrdersRafiq = sqlite.prepare("SELECT id, buyer_id, buyer_name, seller_id, seller_name, total_bdt, created_at FROM orders WHERE buyer_id = 'user-farmer-rafiq' OR seller_id = 'user-farmer-rafiq'").all();
  console.log('SQLite orders with far-shibganj-1:', sqliteOrdersFar1);
  console.log('SQLite orders with user-farmer-rafiq:', sqliteOrdersRafiq);

  const neonOrdersFar1 = await pool.query("SELECT id, buyer_id, buyer_name, seller_id, seller_name, total_bdt, created_at FROM orders WHERE buyer_id = 'far-shibganj-1' OR seller_id = 'far-shibganj-1'");
  const neonOrdersRafiq = await pool.query("SELECT id, buyer_id, buyer_name, seller_id, seller_name, total_bdt, created_at FROM orders WHERE buyer_id = 'user-farmer-rafiq' OR seller_id = 'user-farmer-rafiq'");
  console.log('Neon orders with far-shibganj-1:', neonOrdersFar1.rows);
  console.log('Neon orders with user-farmer-rafiq:', neonOrdersRafiq.rows);

  // 9. PRODUCTS LINKED TO far-shibganj-1 vs user-farmer-rafiq
  console.log('\n--- PRODUCTS LINKED TO THESE USERS ---');
  const sqliteProdsFar1 = sqlite.prepare("SELECT id, crop_name, seller_id, seller_name, price_per_kg FROM products WHERE seller_id = 'far-shibganj-1'").all();
  const sqliteProdsRafiq = sqlite.prepare("SELECT id, crop_name, seller_id, seller_name, price_per_kg FROM products WHERE seller_id = 'user-farmer-rafiq'").all();
  console.log('SQLite products with far-shibganj-1:', sqliteProdsFar1);
  console.log('SQLite products with user-farmer-rafiq:', sqliteProdsRafiq);

  const jsonCropsFar1 = (json.crops || []).filter(c => c.farmerId === 'far-shibganj-1');
  const jsonCropsRafiq = (json.crops || []).filter(c => c.farmerId === 'user-farmer-rafiq');
  console.log('JSON crops with far-shibganj-1:', jsonCropsFar1.map(c => ({ id: c.id, cropName: c.cropName, farmerName: c.farmerName })));
  console.log('JSON crops with user-farmer-rafiq:', jsonCropsRafiq.map(c => ({ id: c.id, cropName: c.cropName, farmerName: c.farmerName })));

  const neonProdsFar1 = await pool.query("SELECT id, crop_name, seller_id, seller_name, unit_price FROM products WHERE seller_id = 'far-shibganj-1'");
  const neonProdsRafiq = await pool.query("SELECT id, crop_name, seller_id, seller_name, unit_price FROM products WHERE seller_id = 'user-farmer-rafiq'");
  console.log('Neon products with far-shibganj-1:', neonProdsFar1.rows);
  console.log('Neon products with user-farmer-rafiq:', neonProdsRafiq.rows);

  // 10. INVESTIGATE "18 products and 7 orders" AUDIT ORIGIN
  console.log('\n--- INVESTIGATING 18 PRODUCTS & 7 ORDERS DISCREPANCY ---');
  // How many products are seller_role = 'farmer' in SQLite?
  const farmerProdsSqlite = sqlite.prepare("SELECT COUNT(*) as c FROM products WHERE seller_role = 'farmer'").get().c;
  const nonFarmerProdsSqlite = sqlite.prepare("SELECT COUNT(*) as c FROM products WHERE seller_role != 'farmer'").get().c;
  console.log(`SQLite products: ${farmerProdsSqlite} farmer, ${nonFarmerProdsSqlite} non-farmer (total: ${farmerProdsSqlite + nonFarmerProdsSqlite})`);

  // How many orders by order_type or status in SQLite?
  const ordersByType = sqlite.prepare("SELECT order_type, delivery_status, COUNT(*) as c FROM orders GROUP BY order_type, delivery_status").all();
  console.log('SQLite orders by type/status:', ordersByType);

  // All 10 orders in SQLite details:
  console.log('\n--- ALL 10 SQLITE ORDERS ---');
  sqliteOrders.forEach(o => {
    console.log(`  ${o.id}: buyer=${o.buyer_id} (${o.buyer_name}), seller=${o.seller_id} (${o.seller_name}), role=${o.seller_role}, total=${o.total_bdt}, status=${o.delivery_status}, date=${o.created_at}`);
  });

  console.log('\n--- ALL 11 NEON ORDERS ---');
  neonOrders.forEach(o => {
    console.log(`  ${o.id}: buyer=${o.buyer_id} (${o.buyer_name}), seller=${o.seller_id} (${o.seller_name}), role=${o.seller_role}, total=${o.total_bdt}, status=${o.delivery_status}, date=${o.created_at}`);
  });

  // Save full investigation data to JSON for reference
  fs.writeFileSync('server_data/master_prompt_4_investigation.json', JSON.stringify({
    sqliteProducts,
    neonProducts,
    sqliteOrders,
    neonOrders,
    sqliteFar1,
    sqliteRafiq,
    jsonFar1,
    jsonRafiq,
    neonFar1: neonFar1Res.rows[0] || null,
    neonRafiq: neonRafiqRes.rows[0] || null,
    sqliteOrdersFar1,
    sqliteOrdersRafiq,
    neonOrdersFar1: neonOrdersFar1.rows,
    neonOrdersRafiq: neonOrdersRafiq.rows,
  }, null, 2));

  await pool.end();
  console.log('\nInvestigation completed and saved to server_data/master_prompt_4_investigation.json');
}

runInvestigation().catch(e => {
  console.error(e);
  process.exit(1);
});

