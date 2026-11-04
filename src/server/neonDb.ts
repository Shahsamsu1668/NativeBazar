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
