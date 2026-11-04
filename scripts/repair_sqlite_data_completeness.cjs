const fs = require('fs');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const env = dotenv.parse(fs.readFileSync('server_data/test_branch.env'));
if (!env.TEST_DATABASE_URL || !env.TEST_DATABASE_URL.includes('ep-snowy-mode')) {
  console.error('SAFETY STOP: Wrong endpoint! Must be ep-snowy-mode.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: env.TEST_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sqliteDb = new Database('nativebazar.db', { readonly: true });

async function repairCompleteness() {
  console.log('=== SAFELY RESTORING HISTORICAL SQLITE DATA TO NEON DEV-MIGRATION-TEST ===\n');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const neonUserIds = new Set((await client.query('SELECT id FROM users')).rows.map(r => r.id));

    // 1. Re-sync SQLite Products
    const sqliteProducts = sqliteDb.prepare('SELECT * FROM products').all();
    console.log(`Checking ${sqliteProducts.length} SQLite products...`);
    let prodRestored = 0;

    for (const p of sqliteProducts) {
      let sellerId = p.seller_id === 'far-shibganj-1' ? 'user-farmer-rafiq' : p.seller_id;
      if (!neonUserIds.has(sellerId)) {
        sellerId = null; // Prevent FK violation
      }

      const res = await client.query(`
        INSERT INTO products (
          id, seller_id, seller_name, seller_phone, seller_role, target_role,
          crop_name, bangla_name, category, variety, unit, quantity, available_qty,
          min_order_qty, unit_price, market_price, quality_grade, district, upazila,
          location_details, harvest_status, available_date, organic_certified, image_url,
          description, farmer_origin, wholesaler_arat, procurement_date, safety_note, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'kg', $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, COALESCE($29::timestamptz, NOW())
        ) ON CONFLICT (id) DO NOTHING
        RETURNING id;
      `, [
        p.id, sellerId, p.seller_name, p.seller_phone, p.seller_role, p.target_role,
        p.crop_name, p.bangla_name, p.category, p.variety, p.quantity_kg, p.available_kg,
        p.min_order_kg || 1, p.price_per_kg, p.market_price_per_kg, p.quality_grade,
        p.district, p.upazila, p.location_details, p.harvest_status, p.available_date,
        Boolean(p.organic_certified), p.image_url, p.description, p.farmer_origin,
        p.wholesaler_arat, p.procurement_date, p.safety_note, p.created_at
      ]);

      if (res.rows.length > 0) prodRestored++;
    }
    console.log(`Restored/Inserted ${prodRestored} products into Neon.`);

    // 2. Re-sync SQLite Orders
    const sqliteOrders = sqliteDb.prepare('SELECT * FROM orders').all();
    console.log(`Checking ${sqliteOrders.length} SQLite orders...`);
    let ordersRestored = 0;

    for (const o of sqliteOrders) {
      let buyerId = neonUserIds.has(o.buyer_id) ? o.buyer_id : null;
      let sellerId = o.seller_id === 'far-shibganj-1' ? 'user-farmer-rafiq' : o.seller_id;
      if (!neonUserIds.has(sellerId)) sellerId = null;

      const res = await client.query(`
        INSERT INTO orders (
          id, order_type, buyer_id, buyer_name, buyer_phone, buyer_email, buyer_role,
          seller_id, seller_name, seller_phone, seller_role, total_bdt, payment_method,
          payment_status, delivery_status, delivery_address, district, tracking_code, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
          COALESCE($20::timestamptz, NOW()), COALESCE($21::timestamptz, NOW())
        ) ON CONFLICT (id) DO NOTHING
        RETURNING id;
      `, [
        o.id, o.order_type, buyerId, o.buyer_name, o.buyer_phone, o.buyer_email, o.buyer_role,
        sellerId, o.seller_name, o.seller_phone, o.seller_role, o.total_bdt, o.payment_method,
        o.payment_status || 'Pending', o.delivery_status || 'Confirmed', o.delivery_address,
        o.district, o.tracking_code, o.notes, o.created_at, o.updated_at
      ]);

      if (res.rows.length > 0) ordersRestored++;
    }
    console.log(`Restored/Inserted ${ordersRestored} orders into Neon.`);

    // 3. Re-sync SQLite Order Items
    const sqliteItems = sqliteDb.prepare('SELECT * FROM order_items').all();
    let itemsRestored = 0;
    for (const it of sqliteItems) {
      // Check if product exists in products
      const pCheck = await client.query('SELECT id FROM products WHERE id = $1', [it.product_id]);
      const prodId = pCheck.rows.length > 0 ? it.product_id : null;

      const res = await client.query(`
        INSERT INTO order_items (id, order_id, product_id, crop_name, bangla_name, quantity_kg, unit_price, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
        RETURNING id;
      `, [it.id, it.order_id, prodId, it.crop_name, it.bangla_name, it.quantity_kg, it.unit_price, it.subtotal]);

      if (res.rows.length > 0) itemsRestored++;
    }
    console.log(`Restored/Inserted ${itemsRestored} order items into Neon.`);

    await client.query('COMMIT');
    console.log('\n✓ Transaction committed successfully.');

    // Check final counts
    const finalProds = (await client.query('SELECT count(*)::int as c FROM products')).rows[0].c;
    const finalOrders = (await client.query('SELECT count(*)::int as c FROM orders')).rows[0].c;
    const finalItems = (await client.query('SELECT count(*)::int as c FROM order_items')).rows[0].c;
    console.log(`Final Neon Counts: Products=${finalProds} (Expected: 28 = 25 SQLite + 3 Quarantined), Orders=${finalOrders} (Expected: 10), OrderItems=${finalItems} (Expected: 10)`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error repairing completeness:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

repairCompleteness().catch(console.error);

