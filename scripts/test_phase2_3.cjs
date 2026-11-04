// scripts/test_phase2_3.cjs
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const Database = require('better-sqlite3');

const env = dotenv.parse(fs.readFileSync(path.resolve(__dirname, '../server_data/test_branch.env')));
const testUrl = env.TEST_DATABASE_URL;

if (!testUrl || !testUrl.includes('ep-snowy-mode')) {
  console.error('SAFETY STOP: Wrong endpoint!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: testUrl,
  ssl: { rejectUnauthorized: false }
});

const sqliteDb = new Database(path.resolve(__dirname, '../nativebazar.db'), { readonly: true });
const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../server_data/db.json'), 'utf8'));

async function test1_schemaCompleteness(client) {
  console.log('\n========================================');
  console.log('TEST 1: SCHEMA AND MIGRATION COMPLETENESS');
  console.log('========================================');
  
  const expectedTables = [
    'users', 'sessions', 'login_audit_logs', 'products', 'orders', 'order_items',
    'wholesaler_offers', 'market_prices', 'trade_audit_logs', 'messages', 'connections',
    'notifications', 'reviews', 'catalog', 'call_logs', 'farmer_expenses', 'negotiations'
  ];

  const objRes = await client.query(`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_type, table_name;
  `);

  console.log('All Objects in dev-migration-test:');
  console.table(objRes.rows);

  const foundTables = new Set(objRes.rows.filter(r => r.table_type === 'BASE TABLE').map(r => r.table_name));
  const foundViews = new Set(objRes.rows.filter(r => r.table_type === 'VIEW').map(r => r.table_name));

  const tableCounts = {};
  for (const t of expectedTables) {
    if (foundTables.has(t)) {
      const cntRes = await client.query(`SELECT count(*)::int as count FROM "${t}"`);
      tableCounts[t] = { exists: true, count: cntRes.rows[0].count };
    } else {
      tableCounts[t] = { exists: false, count: null };
    }
  }

  const cropsViewExists = foundViews.has('crops');
  let cropsCount = null;
  if (cropsViewExists) {
    const cv = await client.query('SELECT count(*)::int as count FROM crops');
    cropsCount = cv.rows[0].count;
  }

  console.log('Row counts for all 17 expected tables:');
  console.table(tableCounts);
  console.log(`Crops compatibility view exists: ${cropsViewExists}, count: ${cropsCount}`);

  return { expectedTables, tableCounts, cropsViewExists, cropsCount };
}

async function test2_dataIntegrity(client) {
  console.log('\n========================================');
  console.log('TEST 2: DATA INTEGRITY & VALUE VERIFICATION');
  console.log('========================================');

  // 1. Primary-key uniqueness across all populated tables
  const pkChecks = {};
  const populatedTables = ['users', 'sessions', 'products', 'orders', 'order_items', 'wholesaler_offers', 'market_prices', 'trade_audit_logs', 'messages', 'connections', 'notifications', 'catalog'];
  for (const t of populatedTables) {
    const res = await client.query(`
      SELECT count(*) as total, count(DISTINCT id) as distinct_pks 
      FROM "${t}"
    `);
    const total = parseInt(res.rows[0].total);
    const distinct = parseInt(res.rows[0].distinct_pks);
    pkChecks[t] = { total, distinct, isUnique: total === distinct };
  }
  console.log('Primary Key Uniqueness:');
  console.table(pkChecks);

  // 2. Foreign-key validity (Check orphaned records on existing tables)
  const fkChecks = {};
  // orders -> users (buyer_id)
  const orphanBuyerOrders = (await client.query(`
    SELECT count(*)::int as c FROM orders WHERE buyer_id IS NOT NULL AND buyer_id NOT IN (SELECT id FROM users)
  `)).rows[0].c;
  fkChecks['orders.buyer_id -> users.id'] = { orphanCount: orphanBuyerOrders, valid: orphanBuyerOrders === 0 };

  // orders -> users (seller_id)
  const orphanSellerOrders = (await client.query(`
    SELECT count(*)::int as c FROM orders WHERE seller_id IS NOT NULL AND seller_id NOT IN (SELECT id FROM users)
  `)).rows[0].c;
  fkChecks['orders.seller_id -> users.id'] = { orphanCount: orphanSellerOrders, valid: orphanSellerOrders === 0 };

  // order_items -> orders (order_id)
  const orphanOrderItems = (await client.query(`
    SELECT count(*)::int as c FROM order_items WHERE order_id NOT IN (SELECT id FROM orders)
  `)).rows[0].c;
  fkChecks['order_items.order_id -> orders.id'] = { orphanCount: orphanOrderItems, valid: orphanOrderItems === 0 };

  // order_items -> products (product_id)
  const orphanProdItems = (await client.query(`
    SELECT count(*)::int as c FROM order_items WHERE product_id NOT IN (SELECT id FROM products)
  `)).rows[0].c;
  fkChecks['order_items.product_id -> products.id'] = { orphanCount: orphanProdItems, valid: orphanProdItems === 0 };

  // products -> users (seller_id)
  const orphanProdSellers = (await client.query(`
    SELECT count(*)::int as c FROM products WHERE seller_id IS NOT NULL AND seller_id NOT IN (SELECT id FROM users)
  `)).rows[0].c;
  fkChecks['products.seller_id -> users.id'] = { orphanCount: orphanProdSellers, valid: orphanProdSellers === 0 };

  // messages -> users (sender_id, recipient_id)
  const orphanMsgSenders = (await client.query(`
    SELECT count(*)::int as c FROM messages WHERE sender_id IS NOT NULL AND sender_id NOT IN (SELECT id FROM users)
  `)).rows[0].c;
  const orphanMsgRecipients = (await client.query(`
    SELECT count(*)::int as c FROM messages WHERE recipient_id IS NOT NULL AND recipient_id NOT IN (SELECT id FROM users)
  `)).rows[0].c;
  fkChecks['messages.sender_id -> users.id'] = { orphanCount: orphanMsgSenders, valid: orphanMsgSenders === 0 };
  fkChecks['messages.recipient_id -> users.id'] = { orphanCount: orphanMsgRecipients, valid: orphanMsgRecipients === 0 };

  // notifications -> users (user_id)
  const orphanNotifUsers = (await client.query(`
    SELECT count(*)::int as c FROM notifications WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)
  `)).rows[0].c;
  fkChecks['notifications.user_id -> users.id'] = { orphanCount: orphanNotifUsers, valid: orphanNotifUsers === 0 };

  console.log('Foreign Key Relationship Integrity:');
  console.table(fkChecks);

  // 3. Historical guest orders and orphan preservation
  const guestOrdersRes = await client.query(`
    SELECT id, order_type, buyer_id, buyer_name, buyer_phone, total_bdt, tracking_code 
    FROM orders 
    WHERE buyer_id IS NULL;
  `);
  console.log(`Historical Guest Orders Preserved (buyer_id IS NULL): ${guestOrdersRes.rows.length}`);
  console.table(guestOrdersRes.rows);

  // 4. User ID mapping: far-shibganj-1 -> user-farmer-rafiq
  const mappedFarmerProducts = await client.query(`
    SELECT id, crop_name, seller_id, seller_name, seller_role 
    FROM products 
    WHERE seller_id = 'user-farmer-rafiq';
  `);
  console.log(`Products owned by mapped user-farmer-rafiq: ${mappedFarmerProducts.rows.length}`);
  console.table(mappedFarmerProducts.rows.slice(0, 5));

  // 5. Meghna products quarantine check
  const meghnaProducts = await client.query(`
    SELECT id, crop_name, seller_id, seller_name, harvest_status, category, unit, quantity
    FROM products 
    WHERE id LIKE 'sup-meghna%';
  `);
  console.log('Quarantined Meghna Products:');
  console.table(meghnaProducts.rows);

  // 6. Direct Value Comparison: Compare SQLite products with Neon products
  const sampleSqlite = sqliteDb.prepare('SELECT id, crop_name, quantity_kg, price_per_kg, district FROM products LIMIT 5').all();
  const sampleNeon = (await client.query(`
    SELECT id, crop_name, quantity, unit_price, district 
    FROM products 
    WHERE id IN (${sampleSqlite.map(s => `'${s.id}'`).join(',')})
    ORDER BY id;
  `)).rows;

  console.log('Field-by-Field Value Comparison (Sample Products):');
  sampleSqlite.forEach(s => {
    const n = sampleNeon.find(r => r.id === s.id);
    console.log(`ID: ${s.id}`);
    console.log(`  SQLite: crop_name="${s.crop_name}", qty=${s.quantity_kg}, price=${s.price_per_kg}, district="${s.district}"`);
    console.log(`  Neon:   crop_name="${n?.crop_name}", qty=${n?.quantity}, price=${n?.unit_price}, district="${n?.district}"`);
    const match = n && s.crop_name === n.crop_name && parseFloat(s.quantity_kg) === parseFloat(n.quantity) && parseFloat(s.price_per_kg) === parseFloat(n.unit_price);
    console.log(`  MATCH: ${match}`);
  });

  return { pkChecks, fkChecks, guestOrdersCount: guestOrdersRes.rows.length, meghnaCount: meghnaProducts.rows.length };
}

async function test3_unitAwareInventory(client) {
  console.log('\n========================================');
  console.log('TEST 3: UNIT-AWARE INVENTORY & COMPATIBILITY VIEW');
  console.log('========================================');

  // Query Bulk kg products
  const bulkKg = await client.query(`
    SELECT id, crop_name, category, unit, quantity, quantity_kg, available_qty, available_kg, unit_price, price_per_kg
    FROM products
    WHERE unit = 'kg'
    LIMIT 3;
  `);
  console.log('Bulk kg Products:');
  console.table(bulkKg.rows);

  // Query 10g seed packets
  const seedPacks = await client.query(`
    SELECT id, crop_name, category, unit, quantity, quantity_kg, available_qty, available_kg, unit_price, price_per_kg
    FROM products
    WHERE id = 'sup-meghna-seed';
  `);
  console.log('Seed Packets (10g pack / packet):');
  console.table(seedPacks.rows);

  // Query 500g fungicide packages
  const fungicidePacks = await client.query(`
    SELECT id, crop_name, category, unit, quantity, quantity_kg, available_qty, available_kg, unit_price, price_per_kg
    FROM products
    WHERE id = 'sup-meghna-tricho';
  `);
  console.log('Fungicide Packages (500g pack):');
  console.table(fungicidePacks.rows);

  // Verify that packaged non-kg products have NULL in quantity_kg and price_per_kg
  const nonKgFabricationCheck = await client.query(`
    SELECT count(*)::int as fabricated_count
    FROM products
    WHERE unit != 'kg' AND (quantity_kg IS NOT NULL OR price_per_kg IS NOT NULL);
  `);
  const fabricatedCount = nonKgFabricationCheck.rows[0].fabricated_count;
  console.log(`Packaged products with fabricated kg values: ${fabricatedCount} (Expect 0)`);

  // Test Crops Compatibility View CamelCase fields
  const cropsViewSample = await client.query(`
    SELECT "farmerId", "farmerName", "cropName", "cropBangla", "quantityKg", "availableKg", "expectedPricePerKg", "marketBenchmarkPrice", "status"
    FROM crops
    LIMIT 5;
  `);
  console.log('Crops View CamelCase output sample:');
  console.table(cropsViewSample.rows);

  return {
    bulkKgValid: bulkKg.rows.every(r => r.quantity_kg !== null && r.price_per_kg !== null),
    nonKgProtected: fabricatedCount === 0,
    cropsViewRows: cropsViewSample.rows.length
  };
}

async function run() {
  const client = await pool.connect();
  try {
    await test1_schemaCompleteness(client);
    await test2_dataIntegrity(client);
    await test3_unitAwareInventory(client);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);

