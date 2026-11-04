const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pg = require('pg');
const Database = require('better-sqlite3');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const connStr = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!connStr || !connStr.includes('ep-raspy-hat-b3y04kgr')) {
  console.error('SAFETY STOP: DATABASE_URL is not the verified Neon production main endpoint (ep-raspy-hat-b3y04kgr)!');
  process.exit(1);
}

const sqliteDb = new Database(path.resolve(__dirname, '..', 'nativebazar.db'), { readonly: true });
const jsonDb = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'server_data', 'db.json'), 'utf8'));

const pool = new pg.Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false }
});

const CANONICAL_AUTH_DIGEST_SQL = `
  SELECT 
    'users' AS table_name,
    count(*)::text AS row_count,
    encode(sha256(COALESCE(string_agg(encode(sha256(to_jsonb(u)::text::bytea), 'hex'), '' ORDER BY u.id), '')::bytea), 'hex') AS sha256_canonical_sorted_row_digest
  FROM public.users u
  UNION ALL
  SELECT 
    'sessions' AS table_name,
    count(*)::text AS row_count,
    encode(sha256(COALESCE(string_agg(encode(sha256(to_jsonb(s)::text::bytea), 'hex'), '' ORDER BY s.id), '')::bytea), 'hex') AS sha256_canonical_sorted_row_digest
  FROM public.sessions s
  UNION ALL
  SELECT 
    'login_audit_logs' AS table_name,
    count(*)::text AS row_count,
    encode(sha256(COALESCE(string_agg(encode(sha256(to_jsonb(l)::text::bytea), 'hex'), '' ORDER BY l.id), '')::bytea), 'hex') AS sha256_canonical_sorted_row_digest
  FROM public.login_audit_logs l;
`;

const EXPECTED_USERS_HASH = 'b13d6c604d7a30b441f8ed0a9845a71460f959182199af6bb450083c73d01f3e';
const EXPECTED_SESSIONS_HASH = 'bb711f92b73a4e9971e41b8ca185271fa05843552c6e3457006f07d7c9fc27f4';
const EXPECTED_AUDIT_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

async function executeProductionMigration() {
  const client = await pool.connect();
  console.log('================================================================');
  console.log('  NATIVEBAZAR PRODUCTION RELEASE: NEON MAIN EXECUTION');
  console.log('  Target: Neon branch main (ep-raspy-hat-b3y04kgr)');
  console.log('================================================================');

  try {
    // ─── STEP 0: PRE-MIGRATION AUTHENTICATION BASELINE CHECK ────────────────
    console.log('\n[PREFLIGHT] Checking pre-migration authentication tables on Neon main...');
    const preCheck = await client.query(CANONICAL_AUTH_DIGEST_SQL);
    console.table(preCheck.rows);

    const uRow = preCheck.rows.find(r => r.table_name === 'users');
    const sRow = preCheck.rows.find(r => r.table_name === 'sessions');
    const aRow = preCheck.rows.find(r => r.table_name === 'login_audit_logs');

    if (uRow.row_count !== '42' || uRow.sha256_canonical_sorted_row_digest !== EXPECTED_USERS_HASH) {
      throw new Error(`Preflight failed: users table hash or count mismatch!`);
    }
    if (sRow.row_count !== '26' || sRow.sha256_canonical_sorted_row_digest !== EXPECTED_SESSIONS_HASH) {
      throw new Error(`Preflight failed: sessions table hash or count mismatch!`);
    }
    if (aRow.row_count !== '0' || aRow.sha256_canonical_sorted_row_digest !== EXPECTED_AUDIT_HASH) {
      throw new Error(`Preflight failed: login_audit_logs table hash or count mismatch!`);
    }
    console.log('✓ Preflight authentication baseline verified 100% invariant.');

    // ─── STEP 1: TRANSACTION START & LOCK TIMEOUT ──────────────────────────
    console.log('\n[PHASE 2 & 3] Beginning single production transaction with lock_timeout = 5s...');
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s';");

    // ─── STEP 2: CREATE BUSINESS SCHEMA ─────────────────────────────────────
    console.log('\n[PHASE 2] Creating production business tables and views...');

    // 1. Products (unit-aware with stored generated columns)
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        seller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        seller_name TEXT NOT NULL,
        seller_phone TEXT,
        seller_role TEXT NOT NULL CHECK (seller_role IN ('farmer', 'wholesaler', 'retailer')),
        target_role TEXT NOT NULL CHECK (target_role IN ('farmer', 'wholesaler', 'retailer', 'consumer')),
        crop_name TEXT NOT NULL,
        bangla_name TEXT NOT NULL,
        category TEXT NOT NULL,
        variety TEXT,
        unit TEXT NOT NULL DEFAULT 'kg',
        quantity NUMERIC(12, 2) NOT NULL CHECK (quantity >= 0),
        available_qty NUMERIC(12, 2) NOT NULL CHECK (available_qty >= 0),
        min_order_qty NUMERIC(12, 2) DEFAULT 1 CHECK (min_order_qty > 0),
        unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price > 0),
        market_price NUMERIC(12, 2),
        quantity_kg NUMERIC(12, 2) GENERATED ALWAYS AS (CASE WHEN unit = 'kg' THEN quantity ELSE NULL END) STORED,
        available_kg NUMERIC(12, 2) GENERATED ALWAYS AS (CASE WHEN unit = 'kg' THEN available_qty ELSE NULL END) STORED,
        price_per_kg NUMERIC(12, 2) GENERATED ALWAYS AS (CASE WHEN unit = 'kg' THEN unit_price ELSE NULL END) STORED,
        quality_grade TEXT DEFAULT 'A',
        district TEXT NOT NULL,
        upazila TEXT,
        location_details TEXT,
        harvest_status TEXT DEFAULT 'Ready',
        available_date TEXT,
        organic_certified BOOLEAN DEFAULT FALSE,
        image_url TEXT,
        description TEXT,
        farmer_origin TEXT,
        wholesaler_arat TEXT,
        procurement_date TEXT,
        safety_note TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
      CREATE INDEX IF NOT EXISTS idx_products_target_role ON products(target_role);
      CREATE INDEX IF NOT EXISTS idx_products_seller_role ON products(seller_role);
      CREATE INDEX IF NOT EXISTS idx_products_district ON products(district);
    `);

    // 2. Crops Compatibility View (19 columns, 15 camelCase aliases)
    await client.query(`
      CREATE OR REPLACE VIEW crops AS
      SELECT
        id,
        seller_id AS "farmerId",
        seller_name AS "farmerName",
        seller_phone AS "farmerPhone",
        district,
        upazila,
        crop_name AS "cropName",
        bangla_name AS "cropBangla",
        variety,
        quantity_kg AS "quantityKg",
        available_kg AS "availableKg",
        available_date AS "availableDate",
        price_per_kg AS "expectedPricePerKg",
        market_price AS "marketBenchmarkPrice",
        harvest_status AS "status",
        image_url AS "imageUrl",
        quality_grade AS "qualityGrade",
        organic_certified AS "organicCertified",
        created_at AS "createdAt"
      FROM products
      WHERE seller_role = 'farmer';
    `);

    // 3. Orders
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_type TEXT NOT NULL CHECK (order_type IN ('farmer_to_wholesaler', 'wholesaler_to_retailer', 'retailer_to_consumer')),
        buyer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        buyer_name TEXT NOT NULL,
        buyer_phone TEXT NOT NULL,
        buyer_email TEXT,
        buyer_role TEXT NOT NULL CHECK (buyer_role IN ('wholesaler', 'retailer', 'consumer')),
        seller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        seller_name TEXT NOT NULL,
        seller_phone TEXT,
        seller_role TEXT NOT NULL CHECK (seller_role IN ('farmer', 'wholesaler', 'retailer')),
        total_bdt NUMERIC(14, 2) NOT NULL CHECK (total_bdt >= 0),
        payment_method TEXT NOT NULL,
        payment_status TEXT DEFAULT 'Pending',
        delivery_status TEXT DEFAULT 'Confirmed',
        delivery_address TEXT NOT NULL,
        district TEXT NOT NULL,
        upazila TEXT,
        tracking_code TEXT UNIQUE NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
      CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_code);
    `);

    // 4. Order Items (product_id ON DELETE RESTRICT)
    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT REFERENCES products(id) ON DELETE RESTRICT,
        crop_name TEXT NOT NULL,
        bangla_name TEXT NOT NULL,
        quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
        unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price > 0),
        subtotal NUMERIC(14, 2) NOT NULL CHECK (subtotal > 0),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    `);

    // 5. Wholesaler Offers
    await client.query(`
      CREATE TABLE IF NOT EXISTS wholesaler_offers (
        id TEXT PRIMARY KEY,
        wholesaler_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        wholesaler_name TEXT NOT NULL,
        wholesaler_phone TEXT NOT NULL,
        business_name TEXT NOT NULL,
        crop_name TEXT NOT NULL,
        crop_bangla TEXT NOT NULL,
        quantity_kg_needed NUMERIC(12, 2) NOT NULL CHECK (quantity_kg_needed > 0),
        fulfilled_kg NUMERIC(12, 2) DEFAULT 0,
        offered_price_per_kg NUMERIC(12, 2) NOT NULL CHECK (offered_price_per_kg > 0),
        district TEXT NOT NULL,
        upazila TEXT,
        location TEXT NOT NULL,
        deadline TEXT NOT NULL,
        urgent BOOLEAN DEFAULT FALSE,
        verified BOOLEAN DEFAULT TRUE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wholesaler_offers_wholesaler ON wholesaler_offers(wholesaler_id);
    `);

    // 6. Market Prices
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_prices (
        id TEXT PRIMARY KEY,
        district TEXT NOT NULL,
        upazila TEXT,
        market_name TEXT NOT NULL,
        market_name_bn TEXT NOT NULL,
        crop_name TEXT NOT NULL,
        bangla_name TEXT NOT NULL,
        category TEXT NOT NULL,
        wholesale_price NUMERIC(12, 2) NOT NULL,
        wholesale_dhaka NUMERIC(12, 2) NOT NULL,
        retail_price NUMERIC(12, 2) NOT NULL,
        unit TEXT DEFAULT 'kg',
        change_24h NUMERIC(6, 2) DEFAULT 0,
        trend TEXT DEFAULT 'stable',
        source TEXT NOT NULL,
        last_updated TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_market_prices_district ON market_prices(district);
    `);

    // 7. Trade Audit Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS trade_audit_logs (
        id TEXT PRIMARY KEY,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        type TEXT NOT NULL,
        amount NUMERIC(14, 2),
        actor_role TEXT,
        actor_name TEXT,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_trade_audit_order ON trade_audit_logs(order_id);
    `);

    // 8. Messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        sender_name TEXT NOT NULL,
        sender_role TEXT NOT NULL,
        recipient_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        recipient_name TEXT NOT NULL,
        recipient_role TEXT NOT NULL,
        content TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        reply_to_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
        message_type TEXT DEFAULT 'text',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, recipient_id);
    `);

    // 9. Connections
    await client.query(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        requester_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        requester_name TEXT NOT NULL,
        requester_role TEXT NOT NULL,
        requester_phone TEXT,
        requester_district TEXT,
        recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        recipient_name TEXT NOT NULL,
        recipient_role TEXT NOT NULL,
        recipient_phone TEXT,
        recipient_district TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 10. Notifications
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        action_url TEXT,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
    `);

    // 11. Reviews (reviews.product_id ON DELETE SET NULL)
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        user_name TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment TEXT NOT NULL,
        verified_purchase BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 12. Catalog
    await client.query(`
      CREATE TABLE IF NOT EXISTS catalog (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        name_bn TEXT NOT NULL,
        category TEXT NOT NULL,
        category_label_en TEXT,
        category_label_bn TEXT,
        unit TEXT DEFAULT 'kg',
        unit_bn TEXT DEFAULT 'কেজি',
        keywords JSONB DEFAULT '[]',
        image_url TEXT,
        dam_benchmark_price NUMERIC(12, 2),
        description_bn TEXT,
        description_en TEXT
      );
    `);

    // 13. Call Logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        caller_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        caller_name TEXT NOT NULL,
        caller_role TEXT NOT NULL,
        receiver_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        receiver_name TEXT NOT NULL,
        receiver_role TEXT NOT NULL,
        receiver_phone TEXT NOT NULL,
        status TEXT NOT NULL,
        duration_seconds INTEGER DEFAULT 0,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 14. Farmer Expenses (farmer_id ON DELETE RESTRICT)
    await client.query(`
      CREATE TABLE IF NOT EXISTS farmer_expenses (
        id TEXT PRIMARY KEY,
        farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        date DATE NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        description_bn TEXT,
        amount_bdt NUMERIC(12, 2) NOT NULL CHECK (amount_bdt >= 0),
        crop_related TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_expenses_farmer ON farmer_expenses(farmer_id, date);
    `);

    // 15. Negotiations
    await client.query(`
      CREATE TABLE IF NOT EXISTS negotiations (
        id TEXT PRIMARY KEY,
        listing_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        demand_id TEXT REFERENCES wholesaler_offers(id) ON DELETE SET NULL,
        buyer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        buyer_name TEXT NOT NULL,
        buyer_phone TEXT NOT NULL,
        offered_price_per_kg NUMERIC(12, 2) NOT NULL CHECK (offered_price_per_kg > 0),
        quantity_kg NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
        message TEXT NOT NULL,
        status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Countered', 'Rejected')),
        counter_price NUMERIC(12, 2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_negotiations_listing ON negotiations(listing_id);
    `);

    // 16. Supplier Products (Dedicated table preserving 3-tier produce supply chain rules)
    await client.query(`
      CREATE TABLE IF NOT EXISTS supplier_products (
        id TEXT PRIMARY KEY,
        supplier_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        supplier_name TEXT NOT NULL,
        shop_name TEXT,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        bangla_name TEXT NOT NULL,
        brand TEXT,
        unit_price_bdt NUMERIC(12, 2) NOT NULL CHECK (unit_price_bdt > 0),
        unit TEXT NOT NULL DEFAULT 'kg',
        in_stock BOOLEAN DEFAULT TRUE,
        stock_qty NUMERIC(12, 2) DEFAULT 0 CHECK (stock_qty >= 0),
        phone TEXT,
        suitable_crops JSONB DEFAULT '[]'::jsonb,
        description TEXT,
        organic_certified BOOLEAN DEFAULT FALSE,
        certification_number TEXT,
        delivery_radius_km NUMERIC(8, 2) DEFAULT 10,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier ON supplier_products(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_supplier_products_category ON supplier_products(category);
    `);

    console.log('✓ All 16 production business tables, crops view, and indexes created successfully.');

    // ─── STEP 3: HISTORICAL DATA MIGRATION ──────────────────────────────────
    console.log('\n[PHASE 3] Migrating historical data from SQLite and JSON...');

    const existingNeonUserIds = new Set((await client.query('SELECT id FROM users')).rows.map(r => r.id));
    console.log(`  Existing Neon users: ${existingNeonUserIds.size}`);

    // 1. Products (25 SQLite produce products)
    const sqliteProducts = sqliteDb.prepare('SELECT * FROM products').all();
    for (const p of sqliteProducts) {
      // Remap far-shibganj-1 -> user-farmer-rafiq
      let sellerId = p.seller_id === 'far-shibganj-1' ? 'user-farmer-rafiq' : p.seller_id;
      if (!existingNeonUserIds.has(sellerId)) sellerId = null;

      await client.query(`
        INSERT INTO products (
          id, seller_id, seller_name, seller_phone, seller_role, target_role,
          crop_name, bangla_name, category, variety, unit, quantity, available_qty,
          min_order_qty, unit_price, market_price, quality_grade, district, upazila,
          location_details, harvest_status, available_date, organic_certified, image_url,
          description, farmer_origin, wholesaler_arat, procurement_date, safety_note, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'kg', $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, COALESCE($29::timestamptz, NOW())
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        p.id, sellerId, p.seller_name, p.seller_phone, p.seller_role, p.target_role,
        p.crop_name, p.bangla_name, p.category, p.variety, p.quantity_kg, p.available_kg,
        p.min_order_kg || 1, p.price_per_kg, p.market_price_per_kg, p.quality_grade,
        p.district, p.upazila, p.location_details, p.harvest_status, p.available_date,
        Boolean(p.organic_certified), p.image_url, p.description, p.farmer_origin,
        p.wholesaler_arat, p.procurement_date, p.safety_note, p.created_at
      ]);
    }
    console.log(`  ✓ Migrated ${sqliteProducts.length} SQLite products.`);

    // 2. Historical Supplier Products (3 Meghna products into dedicated supplier_products table)
    const supplierProducts = jsonDb.supplierProducts || [];
    for (const sp of supplierProducts) {
      const suitableCropsJson = JSON.stringify(Array.isArray(sp.suitableCrops) ? sp.suitableCrops : [sp.suitableCrops || 'All crops']);
      await client.query(`
        INSERT INTO supplier_products (
          id, supplier_id, supplier_name, shop_name, category, name, bangla_name,
          brand, unit_price_bdt, unit, in_stock, stock_qty, phone, suitable_crops,
          description, organic_certified, certification_number, delivery_radius_km,
          created_at, updated_at
        ) VALUES (
          $1, NULL, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17,
          COALESCE($18::timestamptz, NOW()), COALESCE($18::timestamptz, NOW())
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        sp.id, sp.supplierName || 'Meghna Agro Depot', sp.shopName || 'যমুনা ও মেঘনা সার বিতান',
        sp.category, sp.name, sp.banglaName || sp.name, sp.brand || null,
        sp.unitPriceBDT, sp.unit || 'kg', sp.inStock !== undefined ? Boolean(sp.inStock) : true,
        sp.stockQty || 0, sp.phone || '01715889900', suitableCropsJson,
        sp.description || '', Boolean(sp.organicCertified), sp.certificationNumber || null,
        sp.deliveryRadiusKm || 10, sp.createdAt
      ]);
    }
    console.log(`  ✓ Migrated ${supplierProducts.length} historical supplier products into dedicated supplier_products table.`);

    // 3. Orders & Order Items (10 orders, 10 items)
    const sqliteOrders = sqliteDb.prepare('SELECT * FROM orders').all();
    for (const o of sqliteOrders) {
      let buyerId = existingNeonUserIds.has(o.buyer_id) ? o.buyer_id : null;
      let sellerId = o.seller_id === 'far-shibganj-1' ? 'user-farmer-rafiq' : o.seller_id;
      if (!existingNeonUserIds.has(sellerId)) sellerId = null;

      await client.query(`
        INSERT INTO orders (
          id, order_type, buyer_id, buyer_name, buyer_phone, buyer_email, buyer_role,
          seller_id, seller_name, seller_phone, seller_role, total_bdt, payment_method,
          payment_status, delivery_status, delivery_address, district, tracking_code, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
          COALESCE($20::timestamptz, NOW()), COALESCE($21::timestamptz, NOW())
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        o.id, o.order_type, buyerId, o.buyer_name, o.buyer_phone, o.buyer_email, o.buyer_role,
        sellerId, o.seller_name, o.seller_phone, o.seller_role, o.total_bdt, o.payment_method,
        o.payment_status || 'Pending', o.delivery_status || 'Confirmed', o.delivery_address,
        o.district, o.tracking_code, o.notes, o.created_at, o.updated_at
      ]);
    }
    console.log(`  ✓ Migrated ${sqliteOrders.length} orders.`);

    const sqliteOrderItems = sqliteDb.prepare('SELECT * FROM order_items').all();
    for (const it of sqliteOrderItems) {
      await client.query(`
        INSERT INTO order_items (id, order_id, product_id, crop_name, bangla_name, quantity_kg, unit_price, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING;
      `, [
        it.id, it.order_id, it.product_id, it.crop_name, it.bangla_name, it.quantity_kg, it.unit_price, it.subtotal
      ]);
    }
    console.log(`  ✓ Migrated ${sqliteOrderItems.length} order items.`);

    // 4. Wholesaler Offers (6 rows)
    const sqliteOffers = sqliteDb.prepare('SELECT * FROM wholesaler_offers').all();
    for (const off of sqliteOffers) {
      const wid = existingNeonUserIds.has(off.wholesaler_id) ? off.wholesaler_id : null;
      await client.query(`
        INSERT INTO wholesaler_offers (
          id, wholesaler_id, wholesaler_name, wholesaler_phone, business_name, crop_name,
          crop_bangla, quantity_kg_needed, fulfilled_kg, offered_price_per_kg, district,
          upazila, location, deadline, urgent, verified, notes, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          COALESCE($18::timestamptz, NOW())
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        off.id, wid, off.wholesaler_name, off.wholesaler_phone, off.business_name,
        off.crop_name, off.crop_bangla, off.quantity_kg_needed, off.fulfilled_kg || 0,
        off.offered_price_per_kg, off.district, off.upazila, off.location, off.deadline,
        Boolean(off.urgent), Boolean(off.verified), off.notes, off.created_at
      ]);
    }
    console.log(`  ✓ Migrated ${sqliteOffers.length} wholesaler offers.`);

    // 5. Market Prices (7 rows)
    const sqlitePrices = sqliteDb.prepare('SELECT * FROM market_prices').all();
    for (const mp of sqlitePrices) {
      await client.query(`
        INSERT INTO market_prices (
          id, district, upazila, market_name, market_name_bn, crop_name, bangla_name,
          category, wholesale_price, wholesale_dhaka, retail_price, unit, change_24h,
          trend, source, last_updated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          COALESCE($16::timestamptz, NOW())
        ) ON CONFLICT (id) DO NOTHING;
      `, [
        mp.id, mp.district, mp.upazila, mp.market_name, mp.market_name_bn, mp.crop_name,
        mp.bangla_name, mp.category, mp.wholesale_price, mp.wholesale_dhaka, mp.retail_price,
        mp.unit || 'kg', mp.change_24h || 0, mp.trend || 'stable', mp.source, mp.last_updated
      ]);
    }
    console.log(`  ✓ Migrated ${sqlitePrices.length} market prices.`);

    // 6. Trade Audit Logs (9 rows from SQLite audit_logs)
    const sqliteAudit = sqliteDb.prepare('SELECT * FROM audit_logs').all();
    const existingOrderIds = new Set(sqliteOrders.map(o => o.id));
    for (const a of sqliteAudit) {
      const orderId = existingOrderIds.has(a.order_id) ? a.order_id : null;
      const desc = a.order_id && !orderId
        ? `[Historical Order: ${a.order_id}] ${a.description || ''}`
        : (a.description || 'Trade transaction logged');
      await client.query(`
        INSERT INTO trade_audit_logs (id, order_id, type, amount, actor_role, actor_name, description, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
        ON CONFLICT (id) DO NOTHING;
      `, [a.id, orderId, a.type, a.amount, a.actor_role, a.actor_name, desc, a.created_at]);
    }
    console.log(`  ✓ Migrated ${sqliteAudit.length} trade audit logs.`);

    // 7. Direct Messages (7 rows)
    const jsonMessages = jsonDb.messages || [];
    for (const m of jsonMessages) {
      let sId = m.senderId === 'far-shibganj-1' ? 'user-farmer-rafiq' : m.senderId;
      let rId = m.recipientId === 'far-shibganj-1' ? 'user-farmer-rafiq' : m.recipientId;
      if (!existingNeonUserIds.has(sId)) sId = null;
      if (!existingNeonUserIds.has(rId)) rId = null;

      await client.query(`
        INSERT INTO messages (id, sender_id, sender_name, sender_role, recipient_id, recipient_name, recipient_role, content, read, message_type, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11::timestamptz, NOW()))
        ON CONFLICT (id) DO NOTHING;
      `, [
        m.id, sId, m.senderName, m.senderRole, rId, m.recipientName, m.recipientRole,
        m.content, Boolean(m.read), m.messageType || 'text', m.createdAt
      ]);
    }
    console.log(`  ✓ Migrated ${jsonMessages.length} direct messages.`);

    // 8. Connections (4 rows)
    const jsonConns = jsonDb.connections || [];
    for (const c of jsonConns) {
      let reqId = c.requesterId === 'far-shibganj-1' ? 'user-farmer-rafiq' : c.requesterId;
      let recId = c.recipientId === 'far-shibganj-1' ? 'user-farmer-rafiq' : c.recipientId;
      if (!existingNeonUserIds.has(reqId)) reqId = null;
      if (!existingNeonUserIds.has(recId)) recId = null;

      await client.query(`
        INSERT INTO connections (id, requester_id, requester_name, requester_role, requester_phone, requester_district, recipient_id, recipient_name, recipient_role, recipient_phone, recipient_district, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW()))
        ON CONFLICT (id) DO NOTHING;
      `, [
        c.id, reqId, c.requesterName, c.requesterRole, c.requesterPhone, c.requesterDistrict,
        recId, c.recipientName, c.recipientRole, c.recipientPhone, c.recipientDistrict,
        c.status || 'pending', c.createdAt
      ]);
    }
    console.log(`  ✓ Migrated ${jsonConns.length} user connections.`);

    // 9. Notifications (12 rows)
    const jsonNotifs = jsonDb.notifications || [];
    for (const n of jsonNotifs) {
      let uId = n.userId === 'far-shibganj-1' ? 'user-farmer-rafiq' : n.userId;
      if (!existingNeonUserIds.has(uId)) uId = null;

      await client.query(`
        INSERT INTO notifications (id, user_id, title, message, type, action_url, read, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
        ON CONFLICT (id) DO NOTHING;
      `, [
        n.id, uId, n.title || 'Notification', n.message || n.body || '', n.type || 'info', n.actionUrl || n.link || null, Boolean(n.read), n.createdAt
      ]);
    }
    console.log(`  ✓ Migrated ${jsonNotifs.length} notifications.`);

    // 10. Master Catalog (80 rows)
    const jsonCatalog = jsonDb.catalog || [];
    for (const cat of jsonCatalog) {
      await client.query(`
        INSERT INTO catalog (id, name, name_bn, category, category_label_en, category_label_bn, unit, unit_bn, keywords, image_url, dam_benchmark_price, description_bn, description_en)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO NOTHING;
      `, [
        cat.id, cat.name, cat.nameBn, cat.category, cat.categoryLabelEn, cat.categoryLabelBn,
        cat.unit || 'kg', cat.unitBn || 'কেজি', JSON.stringify(cat.keywords || []),
        cat.imageUrl, cat.damBenchmarkPrice || null, cat.descriptionBn, cat.descriptionEn
      ]);
    }
    console.log(`  ✓ Migrated ${jsonCatalog.length} catalog items.`);

    // ─── COMMIT TRANSACTION ────────────────────────────────────────────────
    await client.query('COMMIT');
    console.log('\n================================================================');
    console.log('  PRODUCTION TRANSACTION COMMITTED SUCCESSFULLY TO NEON MAIN!');
    console.log('================================================================');

    // ─── STEP 4: PHASE 4 POST-MIGRATION VERIFICATION ────────────────────────
    console.log('\n[PHASE 4] Running comprehensive post-migration verification...');

    // A. Authentication Integrity Baselines
    console.log('\n--- AUTHENTICATION INTEGRITY (SHA-256 BASELINE) ---');
    const postCheck = await client.query(CANONICAL_AUTH_DIGEST_SQL);
    console.table(postCheck.rows);

    const postUsers = postCheck.rows.find(r => r.table_name === 'users');
    const postSessions = postCheck.rows.find(r => r.table_name === 'sessions');
    const postAudit = postCheck.rows.find(r => r.table_name === 'login_audit_logs');

    if (postUsers.row_count !== '42' || postUsers.sha256_canonical_sorted_row_digest !== EXPECTED_USERS_HASH) {
      throw new Error(`Integrity check failed: users table hash or count mismatch!`);
    }
    if (postSessions.row_count !== '26' || postSessions.sha256_canonical_sorted_row_digest !== EXPECTED_SESSIONS_HASH) {
      throw new Error(`Integrity check failed: sessions table hash or count mismatch!`);
    }
    if (postAudit.row_count !== '0' || postAudit.sha256_canonical_sorted_row_digest !== EXPECTED_AUDIT_HASH) {
      throw new Error(`Integrity check failed: login_audit_logs table hash or count mismatch!`);
    }
    console.log('✓ All 3 authentication tables match exact pre-migration SHA-256 baselines 100%!');

    // B. Historical Business Row Counts
    console.log('\n--- HISTORICAL BUSINESS TABLES ROW COUNTS ---');
    const businessTables = [
      { name: 'products', expected: 25 },
      { name: 'supplier_products', expected: 3 },
      { name: 'orders', expected: 10 },
      { name: 'order_items', expected: 10 },
      { name: 'wholesaler_offers', expected: 6 },
      { name: 'market_prices', expected: 7 },
      { name: 'trade_audit_logs', expected: 9 },
      { name: 'messages', expected: 7 },
      { name: 'connections', expected: 4 },
      { name: 'notifications', expected: 12 },
      { name: 'catalog', expected: 80 }
    ];

    for (const bt of businessTables) {
      const cnt = (await client.query(`SELECT COUNT(*)::int AS count FROM ${bt.name}`)).rows[0].count;
      console.log(`  Table '${bt.name}': ${cnt} rows (expected: ${bt.expected})`);
      if (cnt !== bt.expected) {
        throw new Error(`Business count mismatch for table ${bt.name}: expected ${bt.expected}, got ${cnt}`);
      }
    }
    console.log('✓ All historical business tables match source record counts 100%!');

    // C. Crops View Check
    const cropsCount = (await client.query('SELECT COUNT(*)::int AS count FROM crops')).rows[0].count;
    console.log(`\nCrops view: ${cropsCount} farmer crop listings exposed (expected: 15 farmer products)`);
    if (cropsCount !== 15) {
      throw new Error(`Crops view returned ${cropsCount} rows, expected 15.`);
    }
    console.log('✓ Crops compatibility view exposes exactly 15 farmer listings with all 19 camelCase columns.');

    // D. Foreign Key Anti-Join Check
    console.log('\n--- FOREIGN KEY INTEGRITY (ANTI-JOINS) ---');
    const antiJoins = [
      { name: 'products.seller_id', query: 'SELECT count(*)::int as c FROM products WHERE seller_id IS NOT NULL AND seller_id NOT IN (SELECT id FROM users)' },
      { name: 'orders.buyer_id', query: 'SELECT count(*)::int as c FROM orders WHERE buyer_id IS NOT NULL AND buyer_id NOT IN (SELECT id FROM users)' },
      { name: 'orders.seller_id', query: 'SELECT count(*)::int as c FROM orders WHERE seller_id IS NOT NULL AND seller_id NOT IN (SELECT id FROM users)' },
      { name: 'order_items.order_id', query: 'SELECT count(*)::int as c FROM order_items WHERE order_id NOT IN (SELECT id FROM orders)' },
      { name: 'order_items.product_id', query: 'SELECT count(*)::int as c FROM order_items WHERE product_id IS NOT NULL AND product_id NOT IN (SELECT id FROM products)' },
      { name: 'wholesaler_offers.wholesaler_id', query: 'SELECT count(*)::int as c FROM wholesaler_offers WHERE wholesaler_id IS NOT NULL AND wholesaler_id NOT IN (SELECT id FROM users)' },
      { name: 'trade_audit_logs.order_id', query: 'SELECT count(*)::int as c FROM trade_audit_logs WHERE order_id IS NOT NULL AND order_id NOT IN (SELECT id FROM orders)' },
      { name: 'messages.sender_id', query: 'SELECT count(*)::int as c FROM messages WHERE sender_id IS NOT NULL AND sender_id NOT IN (SELECT id FROM users)' },
      { name: 'messages.recipient_id', query: 'SELECT count(*)::int as c FROM messages WHERE recipient_id IS NOT NULL AND recipient_id NOT IN (SELECT id FROM users)' },
      { name: 'connections.requester_id', query: 'SELECT count(*)::int as c FROM connections WHERE requester_id IS NOT NULL AND requester_id NOT IN (SELECT id FROM users)' },
      { name: 'connections.recipient_id', query: 'SELECT count(*)::int as c FROM connections WHERE recipient_id IS NOT NULL AND recipient_id NOT IN (SELECT id FROM users)' },
      { name: 'notifications.user_id', query: 'SELECT count(*)::int as c FROM notifications WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)' }
    ];

    for (const aj of antiJoins) {
      const res = await client.query(aj.query);
      const brokenCount = res.rows[0].c;
      if (brokenCount !== 0) {
        throw new Error(`Anti-join failure on ${aj.name}: ${brokenCount} broken references found!`);
      }
      console.log(`  ✓ ${aj.name}: 0 broken references`);
    }
    console.log('✓ Zero broken foreign-key references found across all tables.');

    // E. Index Verification
    const idxRes = await client.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      ORDER BY tablename, indexname;
    `);
    console.log(`\n--- INDEX VERIFICATION ---`);
    console.log(`Total active indexes on Neon main: ${idxRes.rows.length} (expected: 45)`);
    if (idxRes.rows.length !== 45) {
      throw new Error(`Index count mismatch: expected 45 indexes, found ${idxRes.rows.length}`);
    }
    console.log('✓ All 45 indexes verified active on Neon main.');

  } catch (err) {
    console.error('\n✗ FATAL ERROR DURING EXECUTION:', err.message);
    try { await client.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

executeProductionMigration().catch(err => {
  console.error('Production migration failed:', err);
  process.exit(1);
});
