import { getAllDistrictsMarketPrices } from './marketData.js';
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Prefer isolated test branch in non-production environments
if (process.env.NODE_ENV !== 'production' && fs.existsSync(path.resolve(process.cwd(), 'server_data/test_branch.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), 'server_data/test_branch.env'), override: true });
}
dotenv.config({ path: '.env.local' });
dotenv.config();

const { Pool } = pg;

const activeConnectionString = (process.env.NODE_ENV === 'production'
  ? (process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED)
  : (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL)) || process.env.DATABASE_URL;

export const pool = new Pool({
  connectionString: activeConnectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Neon PostgreSQL client:', err);
});

export async function initNeonDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. Users table in Neon PostgreSQL
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          name TEXT NOT NULL,
          name_bn TEXT,
          phone TEXT UNIQUE NOT NULL,
          email TEXT,
          password_hash TEXT NOT NULL,
          password_algo TEXT DEFAULT 'bcrypt',
          district TEXT NOT NULL,
          upazila TEXT,
          verified BOOLEAN DEFAULT TRUE,
          farm_size_acres NUMERIC,
          primary_crops JSONB,
          business_name TEXT,
          business_type TEXT,
          shop_name TEXT,
          license_number TEXT,
          trade_address TEXT,
          delivery_address TEXT,
          two_factor_enabled BOOLEAN DEFAULT FALSE,
          security_pin TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_login_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);
    } catch (err: any) {
      console.warn('[Neon] users table init warning:', err.message);
    }

    // 2. Server-side revocable sessions table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          role TEXT NOT NULL,
          ip_address TEXT,
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      `);
    } catch (err: any) {
      console.warn('[Neon] sessions table init warning:', err.message);
    }

    // 3. Security and Login Audit Logs table
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS login_audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          phone TEXT,
          role TEXT,
          status TEXT NOT NULL,
          ip_address TEXT,
          device TEXT,
          details TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON login_audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON login_audit_logs(created_at);
      `);
    } catch (err: any) {
      console.warn('[Neon] audit logs table init warning:', err.message);
    }

    // 4. Direct Messages table in Neon PostgreSQL (STRICT PERSISTENCE)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          sender_name TEXT,
          sender_role TEXT,
          recipient_id TEXT NOT NULL,
          recipient_name TEXT,
          recipient_role TEXT,
          content TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          reply_to_id TEXT,
          message_type TEXT DEFAULT 'text',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
        CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id);
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
      `);
    } catch (err: any) {
      console.warn('[Neon] messages table init warning:', err.message);
    }

    // 5. Notifications table in Neon PostgreSQL (STRICT PERSISTENCE)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          type TEXT DEFAULT 'info',
          action_url TEXT,
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
      `);
    } catch (err: any) {
      console.warn('[Neon] notifications table init warning:', err.message);
    }

    // 6. User Connections table in Neon PostgreSQL
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS connections (
          id TEXT PRIMARY KEY,
          requester_id TEXT NOT NULL,
          requester_name TEXT,
          requester_role TEXT,
          recipient_id TEXT NOT NULL,
          recipient_name TEXT,
          recipient_role TEXT,
          status TEXT DEFAULT 'pending',
          message TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_id);
        CREATE INDEX IF NOT EXISTS idx_connections_recipient ON connections(recipient_id);
      `);
    } catch (err: any) {
      console.warn('[Neon] connections table init warning:', err.message);
    }

    // 7. Orders & Order Items tables in Neon PostgreSQL with order_status column
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          order_type TEXT NOT NULL,
          buyer_id TEXT,
          buyer_name TEXT NOT NULL,
          buyer_phone TEXT NOT NULL,
          buyer_email TEXT,
          buyer_role TEXT NOT NULL,
          seller_id TEXT NOT NULL,
          seller_name TEXT NOT NULL,
          seller_phone TEXT,
          seller_role TEXT NOT NULL,
          total_bdt NUMERIC NOT NULL,
          payment_method TEXT NOT NULL,
          payment_status TEXT DEFAULT 'Pending',
          delivery_status TEXT DEFAULT 'pending',
          order_status TEXT DEFAULT 'pending',
          delivery_address TEXT NOT NULL,
          district TEXT NOT NULL,
          tracking_code TEXT NOT NULL,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'pending';
        CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
        CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
        CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
      `);
    } catch (err: any) {
      console.warn('[Neon] orders table init warning:', err.message);
    }

    // 8. Official Department of Agricultural Marketing (DAM) market_prices table
    try {
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
          wholesale_price NUMERIC NOT NULL,
          wholesale_dhaka NUMERIC NOT NULL,
          retail_price NUMERIC NOT NULL,
          min_wholesale NUMERIC,
          max_wholesale NUMERIC,
          min_retail NUMERIC,
          max_retail NUMERIC,
          unit TEXT DEFAULT 'kg',
          change_24h NUMERIC DEFAULT 0,
          trend TEXT DEFAULT 'stable',
          source TEXT DEFAULT 'Department of Agricultural Marketing (DAM)',
          last_updated TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_market_prices_district ON market_prices(district);
        ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS min_wholesale NUMERIC;
        ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS max_wholesale NUMERIC;
        ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS min_retail NUMERIC;
        ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS max_retail NUMERIC;
      `);

      // Verify all 64 districts are populated with 20+ commodities each in Neon
      const countRes = await client.query('SELECT COUNT(*) as cnt FROM market_prices');
      const cnt = parseInt(countRes.rows[0]?.cnt || '0', 10);
      if (cnt < 1200) {
        const allPrices = getAllDistrictsMarketPrices();
        console.log(`[Neon] Seeding ${allPrices.length} market prices across all 64 districts...`);
        const chunkSize = 100;
        for (let i = 0; i < allPrices.length; i += chunkSize) {
          const chunk = allPrices.slice(i, i + chunkSize);
          const valueClauses: string[] = [];
          const values: any[] = [];
          let paramIdx = 1;

          for (const r of chunk) {
            valueClauses.push(`(${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, ${paramIdx++}, NOW())`);
            values.push(
              r.id, r.district, r.upazila, r.market_name, r.market_name_bn,
              r.crop_name, r.bangla_name, r.category, r.wholesale_price, r.wholesale_dhaka,
              r.retail_price, r.min_wholesale, r.max_wholesale, r.min_retail, r.max_retail,
              r.unit, r.change_24h, r.trend, r.source
            );
          }

          await client.query(`
            INSERT INTO market_prices (
              id, district, upazila, market_name, market_name_bn,
              crop_name, bangla_name, category, wholesale_price, wholesale_dhaka,
              retail_price, min_wholesale, max_wholesale, min_retail, max_retail,
              unit, change_24h, trend, source, last_updated
            ) VALUES ${valueClauses.join(', ')}
            ON CONFLICT (id) DO UPDATE SET
              wholesale_price = EXCLUDED.wholesale_price,
              wholesale_dhaka = EXCLUDED.wholesale_dhaka,
              retail_price = EXCLUDED.retail_price,
              min_wholesale = EXCLUDED.min_wholesale,
              max_wholesale = EXCLUDED.max_wholesale,
              min_retail = EXCLUDED.min_retail,
              max_retail = EXCLUDED.max_retail,
              last_updated = NOW()
          `, values);
        }
        console.log('[Neon] Market prices seeding complete across all 64 districts.');
      }
    } catch (err: any) {
      console.warn('[Neon] market_prices table init warning:', err.message);
    }


    // 9. Products table in Neon PostgreSQL (Unified unit/quantity schema + legacy relaxation)
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          seller_id TEXT NOT NULL,
          seller_name TEXT NOT NULL,
          seller_phone TEXT,
          seller_role TEXT NOT NULL,
          target_role TEXT NOT NULL,
          crop_name TEXT NOT NULL,
          bangla_name TEXT NOT NULL,
          category TEXT NOT NULL,
          variety TEXT,
          unit TEXT DEFAULT 'kg',
          quantity NUMERIC NOT NULL DEFAULT 0,
          available_qty NUMERIC NOT NULL DEFAULT 0,
          unit_price NUMERIC NOT NULL DEFAULT 0,
          min_order_qty NUMERIC DEFAULT 1,
          market_price NUMERIC,
          quantity_kg NUMERIC DEFAULT 0,
          available_kg NUMERIC DEFAULT 0,
          price_per_kg NUMERIC DEFAULT 0,
          min_order_kg NUMERIC DEFAULT 1,
          market_price_per_kg NUMERIC,
          quality_grade TEXT DEFAULT 'A',
          district TEXT NOT NULL,
          upazila TEXT,
          location_details TEXT,
          harvest_status TEXT,
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
        -- Unified columns
        ALTER TABLE products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'kg';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS available_qty NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_qty NUMERIC DEFAULT 1;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS market_price NUMERIC;

        -- Legacy columns (safe nullable additions)
        ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity_kg NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS available_kg NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS price_per_kg NUMERIC DEFAULT 0;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS min_order_kg NUMERIC DEFAULT 1;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS market_price_per_kg NUMERIC;

        CREATE INDEX IF NOT EXISTS idx_products_target_role ON products(target_role);
        CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
        CREATE INDEX IF NOT EXISTS idx_products_seller_role ON products(seller_role);
        CREATE INDEX IF NOT EXISTS idx_products_district ON products(district);

        -- Safe column relaxation: remove GENERATED ALWAYS and drop NOT NULL constraints
        DO $MIGRATE$
        BEGIN
          -- 1. If quantity_kg is a generated column, drop the generation expression
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'quantity_kg' AND is_generated = 'ALWAYS'
          ) THEN
            BEGIN
              ALTER TABLE products ALTER COLUMN quantity_kg DROP EXPRESSION IF EXISTS;
            EXCEPTION WHEN OTHERS THEN
              ALTER TABLE products DROP COLUMN IF EXISTS quantity_kg;
              ALTER TABLE products ADD COLUMN quantity_kg NUMERIC DEFAULT 0;
            END;
          END IF;

          -- 2. If available_kg is a generated column, drop the generation expression
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'available_kg' AND is_generated = 'ALWAYS'
          ) THEN
            BEGIN
              ALTER TABLE products ALTER COLUMN available_kg DROP EXPRESSION IF EXISTS;
            EXCEPTION WHEN OTHERS THEN
              ALTER TABLE products DROP COLUMN IF EXISTS available_kg;
              ALTER TABLE products ADD COLUMN available_kg NUMERIC DEFAULT 0;
            END;
          END IF;

          -- 3. If price_per_kg is a generated column, drop the generation expression
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'price_per_kg' AND is_generated = 'ALWAYS'
          ) THEN
            BEGIN
              ALTER TABLE products ALTER COLUMN price_per_kg DROP EXPRESSION IF EXISTS;
            EXCEPTION WHEN OTHERS THEN
              ALTER TABLE products DROP COLUMN IF EXISTS price_per_kg;
              ALTER TABLE products ADD COLUMN price_per_kg NUMERIC DEFAULT 0;
            END;
          END IF;

          -- 4. Ensure old columns are nullable with DEFAULT 0 (no NOT NULL violation)
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'quantity_kg'
          ) THEN
            ALTER TABLE products ALTER COLUMN quantity_kg DROP NOT NULL;
            ALTER TABLE products ALTER COLUMN quantity_kg SET DEFAULT 0;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'available_kg'
          ) THEN
            ALTER TABLE products ALTER COLUMN available_kg DROP NOT NULL;
            ALTER TABLE products ALTER COLUMN available_kg SET DEFAULT 0;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'price_per_kg'
          ) THEN
            ALTER TABLE products ALTER COLUMN price_per_kg DROP NOT NULL;
            ALTER TABLE products ALTER COLUMN price_per_kg SET DEFAULT 0;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'min_order_kg'
          ) THEN
            ALTER TABLE products ALTER COLUMN min_order_kg DROP NOT NULL;
            ALTER TABLE products ALTER COLUMN min_order_kg SET DEFAULT 1;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'products' AND column_name = 'market_price_per_kg'
          ) THEN
            ALTER TABLE products ALTER COLUMN market_price_per_kg DROP NOT NULL;
          END IF;
        END $MIGRATE$;

        -- 5. Backfill existing products for 100% backward compatibility
        UPDATE products SET
          unit = COALESCE(unit, 'kg'),
          quantity = COALESCE(quantity, quantity_kg, 0),
          available_qty = COALESCE(available_qty, available_kg, quantity, quantity_kg, 0),
          unit_price = COALESCE(unit_price, price_per_kg, 0),
          min_order_qty = COALESCE(min_order_qty, min_order_kg, 1),
          market_price = COALESCE(market_price, market_price_per_kg, unit_price, 0)
        WHERE unit IS NULL OR quantity IS NULL OR quantity = 0 OR unit_price IS NULL OR unit_price = 0;
      `);
    } catch (err: any) {
      console.warn('[Neon] products table init warning:', err.message);
    }

    console.log('Neon PostgreSQL tables verified and active for production.');
  } finally {
    client.release();
  }
}

export async function syncLegacyUsersToNeon(legacyUsers: any[] = []): Promise<number> {
  if (!Array.isArray(legacyUsers) || legacyUsers.length === 0) return 0;
  let synced = 0;

  for (const u of legacyUsers) {
    if (!u || !u.phone) continue;
    try {
      const pwdHash = u.passwordHash || u.password_hash || u.password || 'sha256_default_pwd';
      const isBcrypt = typeof pwdHash === 'string' && pwdHash.startsWith('$2');
      const algo = isBcrypt ? 'bcrypt' : 'legacy_djb2';
      const cropsJson = u.primaryCrops ? JSON.stringify(u.primaryCrops) : (u.primary_crops || null);

      await pool.query(
        `INSERT INTO users (
          id, role, name, name_bn, phone, email, password_hash, password_algo,
          district, upazila, verified, farm_size_acres, primary_crops,
          business_name, business_type, shop_name, license_number, trade_address,
          two_factor_enabled, security_pin, created_at, last_login_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
          COALESCE($21::timestamptz, NOW()), $22::timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          role = EXCLUDED.role,
          name = EXCLUDED.name,
          name_bn = COALESCE(EXCLUDED.name_bn, users.name_bn),
          email = COALESCE(EXCLUDED.email, users.email),
          district = EXCLUDED.district,
          upazila = COALESCE(EXCLUDED.upazila, users.upazila),
          verified = EXCLUDED.verified,
          business_name = COALESCE(EXCLUDED.business_name, users.business_name),
          business_type = COALESCE(EXCLUDED.business_type, users.business_type),
          shop_name = COALESCE(EXCLUDED.shop_name, users.shop_name),
          last_login_at = COALESCE(EXCLUDED.last_login_at, users.last_login_at)`,
        [
          u.id || `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          u.role || 'consumer',
          u.name || 'User',
          u.nameBn || u.name_bn || null,
          u.phone,
          u.email || null,
          pwdHash,
          algo,
          u.district || 'Bogura',
          u.upazila || null,
          u.verified !== undefined ? Boolean(u.verified) : true,
          u.farmSizeAcres || u.farm_size_acres || null,
          cropsJson,
          u.businessName || u.business_name || null,
          u.businessType || u.business_type || null,
          u.shopName || u.shop_name || null,
          u.licenseNumber || u.license_number || null,
          u.tradeAddress || u.trade_address || null,
          Boolean(u.twoFactorEnabled || u.two_factor_enabled),
          u.securityPin || u.security_pin || null,
          u.createdAt || u.created_at || new Date().toISOString(),
          u.lastLoginAt || u.last_login_at || null,
        ]
      );
      synced++;
    } catch (err: any) {
      console.warn(`Sync warning for user ${u.phone}:`, err.message);
    }
  }

  return synced;
}


// ─── STAGE A: SECURE POSTGRESQL ORDER TRANSACTION ─────────────────────────────

export interface NeonOrderParams {
  buyerId?: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  buyerRole: string;
  items: Array<{
    productId: string;
    quantityKg: number;
  }>;
  paymentMethod?: string;
  deliveryAddress: string;
  district: string;
  notes?: string;
}

export function validateNeonSupplyChainTrade(buyerRole: string, sellerRole: string): void {
  const bRole = (buyerRole || '').toLowerCase().trim();
  const sRole = (sellerRole || '').toLowerCase().trim();

  if (sRole === 'farmer') {
    if (bRole !== 'wholesaler' && bRole !== 'admin') {
      throw new Error(`Rule Violation: Farmers (কৃষক) can ONLY sell to Wholesalers (পাইকার). Attempted sale to "${buyerRole}".`);
    }
  } else if (sRole === 'wholesaler') {
    if (bRole !== 'retailer' && bRole !== 'admin') {
      throw new Error(`Rule Violation: Wholesalers (পাইকার) can ONLY sell to Retailers (খুচরা বিক্রেতা). Attempted sale to "${buyerRole}".`);
    }
  } else if (sRole === 'retailer') {
    if (bRole !== 'consumer' && bRole !== 'admin') {
      throw new Error(`Rule Violation: Retailers (খুচরা বিক্রেতা) can ONLY sell to Consumers (ভোক্তা). Attempted sale to "${buyerRole}".`);
    }
  } else if (sRole === 'consumer') {
    throw new Error(`Rule Violation: Consumers (ভোক্তা) cannot sell produce in the agricultural supply chain.`);
  } else {
    throw new Error(`Rule Violation: Unauthorized seller role "${sellerRole}".`);
  }
}

export async function executeNeonOrderTransaction(params: NeonOrderParams, clientPool: pg.Pool = pool) {
  if (!params.items || params.items.length === 0) {
    throw new Error('Order execution failed: No items specified.');
  }

  // 1. Aggregate duplicate product items before checking stock
  const aggregatedItems = new Map<string, number>();
  for (const item of params.items) {
    if (!item.productId) throw new Error('Order execution failed: Invalid product ID.');
    const qty = Number(item.quantityKg);
    if (!qty || qty <= 0) {
      throw new Error(`Order execution failed: Invalid quantity ${item.quantityKg} for product ${item.productId}.`);
    }
    const current = aggregatedItems.get(item.productId) || 0;
    aggregatedItems.set(item.productId, current + qty);
  }

  const productIds = Array.from(aggregatedItems.keys()).sort(); // Sorted to prevent deadlock on row locking

  const client = await clientPool.connect();
  try {
    await client.query('BEGIN');

    // 2. Lock and retrieve products FOR UPDATE in deterministic order
    const lockedProductsRes = await client.query(`
      SELECT id, seller_id, seller_name, seller_phone, seller_role, target_role,
             crop_name, bangla_name, unit, available_qty, unit_price, harvest_status
      FROM products
      WHERE id = ANY($1::text[])
      FOR UPDATE
    `, [productIds]);

    const lockedProductsMap = new Map<string, any>();
    for (const p of lockedProductsRes.rows) {
      lockedProductsMap.set(p.id, p);
    }

    // Verify all products exist
    for (const pid of productIds) {
      if (!lockedProductsMap.has(pid)) {
        throw new Error(`Product "${pid}" does not exist in database.`);
      }
    }

    // 3. Verify single seller and harvest status
    let verifiedSellerId: string | null = null;
    let verifiedSellerName = '';
    let verifiedSellerPhone = '';
    let verifiedSellerRole = '';

    for (const pid of productIds) {
      const prod = lockedProductsMap.get(pid);
      if (prod.harvest_status === 'Archived') {
        throw new Error(`Product "${prod.crop_name}" (${prod.id}) is archived/quarantined and cannot be purchased.`);
      }

      if (verifiedSellerId === null) {
        verifiedSellerId = prod.seller_id;
        verifiedSellerName = prod.seller_name;
        verifiedSellerPhone = prod.seller_phone || '';
        verifiedSellerRole = prod.seller_role;
      } else if (verifiedSellerId !== prod.seller_id) {
        throw new Error(`Multi-Seller Violation: Orders cannot combine products from multiple sellers. Product "${prod.crop_name}" belongs to seller "${prod.seller_name}", but order is for seller "${verifiedSellerName}".`);
      }
    }

    // 4. Validate supply chain trade rules (Buyer Role -> Seller Role)
    validateNeonSupplyChainTrade(params.buyerRole, verifiedSellerRole);

    // 5. Verify stock availability and compute totals using DB prices strictly
    let grandTotal = 0;
    const orderItemsToInsert: any[] = [];

    for (const [pid, reqQty] of aggregatedItems.entries()) {
      const prod = lockedProductsMap.get(pid);
      const avail = parseFloat(prod.available_qty);
      if (avail < reqQty) {
        throw new Error(`Insufficient stock for "${prod.crop_name}". Available: ${avail} ${prod.unit}, Requested: ${reqQty} ${prod.unit}.`);
      }

      const dbUnitPrice = parseFloat(prod.unit_price);
      const subtotal = Math.round(dbUnitPrice * reqQty * 100) / 100;
      grandTotal += subtotal;

      orderItemsToInsert.push({
        id: `oi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: prod.id,
        cropName: prod.crop_name,
        banglaName: prod.bangla_name,
        quantityKg: reqQty,
        unitPrice: dbUnitPrice,
        subtotal
      });
    }

    grandTotal = Math.round(grandTotal * 100) / 100;

    // 6. Deduct stock atomically
    for (const [pid, reqQty] of aggregatedItems.entries()) {
      await client.query(`
        UPDATE products
        SET available_qty = available_qty - $1,
            updated_at = NOW()
        WHERE id = $2
      `, [reqQty, pid]);
    }

    // 7. Insert order
    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const trackingCode = `TRK-${(params.district || 'BOG').slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    let orderType = 'retailer_to_consumer';
    if (verifiedSellerRole === 'farmer') orderType = 'farmer_to_wholesaler';
    else if (verifiedSellerRole === 'wholesaler') orderType = 'wholesaler_to_retailer';

    await client.query(`
      INSERT INTO orders (
        id, order_type, buyer_id, buyer_name, buyer_phone, buyer_email, buyer_role,
        seller_id, seller_name, seller_phone, seller_role, total_bdt, payment_method,
        payment_status, delivery_status, order_status, delivery_address, district, tracking_code, notes,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, 'pending', 'pending', $15, $16, $17, $18, NOW(), NOW()
      )
    `, [
      orderId, orderType, params.buyerId || null, params.buyerName, params.buyerPhone,
      params.buyerEmail || null, params.buyerRole, verifiedSellerId, verifiedSellerName,
      verifiedSellerPhone, verifiedSellerRole, grandTotal, params.paymentMethod || 'Cash on Delivery',
      params.paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Escrow Held',
      params.deliveryAddress, params.district, trackingCode, params.notes || null
    ]);

    // 8. Insert order items
    for (const oi of orderItemsToInsert) {
      await client.query(`
        INSERT INTO order_items (id, order_id, product_id, crop_name, bangla_name, quantity_kg, unit_price, subtotal)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        oi.id, orderId, oi.productId, oi.cropName, oi.banglaName, oi.quantityKg, oi.unitPrice, oi.subtotal
      ]);
    }

    // 9. Insert immutable trade audit log
    const auditId = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await client.query(`
      INSERT INTO trade_audit_logs (id, order_id, type, amount, actor_role, actor_name, description, created_at)
      VALUES ($1, $2, 'ORDER_CREATED', $3, $4, $5, $6, NOW())
    `, [
      auditId, orderId, grandTotal, params.buyerRole, params.buyerName,
      `${orderType} trade executed. ${orderItemsToInsert.length} line items. Total: ৳${grandTotal}. Tracking: ${trackingCode}`
    ]);

    await client.query('COMMIT');

    return {
      success: true,
      orderId,
      id: orderId,
      orderStatus: 'pending',
      status: 'pending',
      deliveryStatus: 'pending',
      trackingCode,
      totalBdt: grandTotal,
      totalBDT: grandTotal,
      buyerId: params.buyerId,
      buyerName: params.buyerName,
      sellerId: verifiedSellerId,
      sellerName: verifiedSellerName,
      itemsCount: orderItemsToInsert.length,
      items: orderItemsToInsert
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
