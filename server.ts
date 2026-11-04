import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { GoogleGenAI } from '@google/genai';
import {
  db,
  validateSupplyChainTrade,
  executeOrderTransaction,
  cancelOrderAndRestoreStock,
} from './src/server/db.js';
import { db as jsonDb } from './server/db.js';
import {
  pool,
  initNeonDatabase,
  syncLegacyUsersToNeon,
  executeNeonOrderTransaction,
} from './src/server/neonDb.js';
import {
  hashPassword,
  hashPasswordSync,
  verifyPassword,
  createSession,
  revokeSessionByToken,
  validateToken,
  requireAuth,
  optionalAuth,
  extractToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  type AuthenticatedRequest,
} from './src/server/auth.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

// ─── PERSISTENCE & BI-DIRECTIONAL DATABASE SYNCHRONIZATION ──────────────────
// Ensures all users, crops, and records persist across SQLite and jsonDb seamlessly
function syncDatabaseStores() {
  try {
    // 1. Sync users: SQLite -> jsonDb
    const sqliteUsers = db.prepare('SELECT * FROM users').all() as any[];
    for (const u of sqliteUsers) {
      const existsInJson = jsonDb.getUserById(u.id) || jsonDb.findUserByIdentifier(u.phone);
      if (!existsInJson) {
        let primaryCropsArr: string[] | undefined;
        try {
          if (u.primary_crops) primaryCropsArr = JSON.parse(u.primary_crops);
        } catch {
          primaryCropsArr = u.primary_crops ? [u.primary_crops] : undefined;
        }
        jsonDb.addUser({
          id: u.id,
          role: u.role,
          name: u.name,
          nameBn: u.name_bn || undefined,
          phone: u.phone,
          email: u.email || undefined,
          passwordHash: u.password_hash,
          district: u.district || 'Bogura',
          upazila: u.upazila || undefined,
          verified: Boolean(u.verified),
          createdAt: u.created_at || new Date().toISOString(),
          lastLoginAt: u.last_login_at || undefined,
          farmSizeAcres: u.farm_size_acres || undefined,
          primaryCrops: primaryCropsArr,
          businessName: u.business_name || undefined,
          businessType: u.business_type || undefined,
          shopName: u.shop_name || undefined,
          licenseNumber: u.license_number || undefined,
        });
      }
    }

    // 2. Sync users: jsonDb -> SQLite
    const jsonUsers = jsonDb.getUsers();
    for (const ju of jsonUsers) {
      const existsInSqlite = db.prepare('SELECT id FROM users WHERE id = ? OR phone = ?').get(ju.id, ju.phone);
      if (!existsInSqlite && ju.phone && ju.passwordHash) {
        try {
          db.prepare(`
            INSERT INTO users (
              id, role, name, name_bn, phone, email, password_hash, district, upazila,
              verified, farm_size_acres, primary_crops, business_name, business_type,
              shop_name, license_number, created_at, last_login_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            ju.id,
            ju.role,
            ju.name,
            ju.nameBn || null,
            ju.phone,
            ju.email || null,
            ju.passwordHash,
            ju.district || 'Bogura',
            ju.upazila || null,
            ju.verified ? 1 : 0,
            ju.farmSizeAcres || null,
            ju.primaryCrops ? JSON.stringify(ju.primaryCrops) : null,
            ju.businessName || null,
            ju.businessType || null,
            ju.shopName || null,
            ju.licenseNumber || null,
            ju.createdAt || new Date().toISOString(),
            ju.lastLoginAt || null
          );
        } catch {
          // Ignore duplicates
        }
      }
    }

    // 3. Sync crops: jsonDb.crops -> SQLite products
    const jsonCrops = jsonDb.getCrops();
    for (const c of jsonCrops) {
      const existsInSqlite = db.prepare('SELECT id FROM products WHERE id = ?').get(c.id);
      if (!existsInSqlite) {
        try {
          db.prepare(`
            INSERT INTO products (
              id, seller_id, seller_name, seller_phone, seller_role, target_role,
              crop_name, bangla_name, category, variety, quantity_kg, available_kg,
              min_order_kg, price_per_kg, market_price_per_kg, quality_grade, district,
              upazila, harvest_status, available_date, organic_certified, image_url,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            c.id,
            c.farmerId,
            c.farmerName,
            c.farmerPhone || '',
            'farmer',
            'wholesaler',
            c.cropName,
            c.cropBangla || c.cropName,
            'Vegetables',
            c.variety || 'Standard',
            c.quantityKg,
            c.quantityKg,
            1,
            c.expectedPricePerKg,
            c.marketBenchmarkPrice || c.expectedPricePerKg,
            c.qualityGrade || 'A',
            c.district || 'Bogura',
            c.upazila || 'Shibganj',
            c.status || 'Ready to Harvest',
            c.availableDate || 'In Stock',
            c.organicCertified ? 1 : 0,
            c.imageUrl || '',
            c.createdAt || new Date().toISOString()
          );
        } catch {
          // ignore
        }
      }
    }

    // 4. Sync farmer crops: SQLite products -> jsonDb crops
    const sqliteFarmerProducts = db.prepare("SELECT * FROM products WHERE seller_role = 'farmer'").all() as any[];
    for (const p of sqliteFarmerProducts) {
      const existsInJson = jsonDb.getCropById(p.id);
      if (!existsInJson) {
        try {
          (jsonDb as any).cache.crops.push({
            id: p.id,
            farmerId: p.seller_id,
            farmerName: p.seller_name,
            farmerPhone: p.seller_phone || '',
            district: p.district || 'Bogura',
            upazila: p.upazila || 'Shibganj',
            cropName: p.crop_name,
            cropBangla: p.bangla_name,
            variety: p.variety || 'Standard',
            quantityKg: p.quantity_kg,
            availableDate: p.available_date || 'In Stock',
            expectedPricePerKg: p.price_per_kg,
            marketBenchmarkPrice: p.market_price_per_kg || p.price_per_kg + 4,
            status: p.harvest_status || 'Ready to Harvest',
            imageUrl: p.image_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
            qualityGrade: p.quality_grade || 'A',
            organicCertified: Boolean(p.organic_certified),
            createdAt: p.created_at || new Date().toISOString(),
          });
          jsonDb.save();
        } catch {
          // ignore
        }
      }
    }

    // 5. Sync orders: SQLite -> jsonDb
    const sqliteOrders = db.prepare("SELECT * FROM orders").all() as any[];
    for (const so of sqliteOrders) {
      const existsInJson = jsonDb.getOrderById(so.id);
      if (!existsInJson) {
        try {
          const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(so.id) as any[];
          (jsonDb as any).cache.orders.push({
            id: so.id,
            orderType: so.order_type || 'b2b_trade',
            customerId: so.buyer_id,
            customerName: so.buyer_name,
            phone: so.buyer_phone,
            items: items.map(it => ({
              itemId: it.product_id,
              itemName: it.crop_name,
              itemBangla: it.bangla_name,
              unitPrice: it.unit_price,
              unit: 'kg',
              quantity: it.quantity_kg,
              subtotal: it.subtotal,
            })),
            totalBDT: so.total_bdt,
            paymentMethod: so.payment_method || 'Cash on Delivery',
            deliveryAddress: so.delivery_address,
            district: so.district || 'Bogura',
            upazila: 'Bogura Sadar',
            status: so.delivery_status || 'Confirmed',
            trackingCode: so.tracking_code,
            orderDate: so.created_at,
            sellerId: so.seller_id,
            sellerName: so.seller_name,
            sellerRole: so.seller_role,
          });
          jsonDb.save();
        } catch {
          // ignore
        }
      }
    }

    // 6. Startup Telemetry Logging
    const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
    const prodCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as any).c;
    const orderCount = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as any).c;
    const priceCount = (db.prepare('SELECT COUNT(*) as c FROM market_prices').get() as any).c;
    const offerCount = (db.prepare('SELECT COUNT(*) as c FROM wholesaler_offers').get() as any).c;
    console.log(`[DB Auto-Init] SQLite (nativebazar.db) ready: ${userCount} users, ${prodCount} products, ${orderCount} orders, ${offerCount} offers, ${priceCount} market rates`);
    console.log(`[DB Auto-Init] JSON DB (db.json) ready: ${jsonDb.getUsers().length} users, ${jsonDb.getCrops().length} crops, ${jsonDb.getSupplierProducts().length} supplier products, ${jsonDb.getOrders().length} orders`);
  } catch (err) {
    console.warn('[DB Sync] Warning during database synchronization:', err);
  }
}

// Initial synchronization on load (development prototype stores only)
if (process.env.NODE_ENV !== 'production') {
  syncDatabaseStores();
}

// Initialize Neon Cloud PostgreSQL
try {
  await initNeonDatabase();

  // Seed the administrator into Neon PostgreSQL if it does not exist yet.
  // Password and security PIN are stored only as bcrypt hashes.
  const seedAdminUser = process.env.ADMIN_USER;
  const seedAdminPassword = process.env.ADMIN_PASSWORD;
  const seedAdminPin = process.env.ADMIN_PIN;
  if (seedAdminUser && seedAdminPassword && seedAdminPin) {
    const existingAdmin = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' AND (phone = $1 OR email = $1) LIMIT 1",
      [seedAdminUser]
    );
    if (existingAdmin.rows.length === 0) {
      const adminPwHash = await hashPassword(seedAdminPassword);
      const adminPinHash = await hashPassword(seedAdminPin);
      await pool.query(
        `INSERT INTO users (id, role, name, name_bn, phone, email, password_hash, password_algo, district, upazila, verified, two_factor_enabled, security_pin, created_at)
         VALUES ('admin-root', 'admin', 'Central Platform Administrator', 'কেন্দ্রীয় প্ল্যাটফর্ম প্রশাসক', $1, 'admin@nativebazar.gov.bd', $2, 'bcrypt', 'Bogura', 'Bogura Sadar', true, true, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET role = 'admin', phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash,
           password_algo = 'bcrypt', two_factor_enabled = true, security_pin = EXCLUDED.security_pin`,
        [seedAdminUser, adminPwHash, adminPinHash]
      );
      console.log('[Neon] Administrator account seeded.');
    } else {
      // Repair admin records created by older builds (e.g. placeholder password hash
      // or missing PIN) so the configured credentials always work.
      const adminRow = await pool.query(
        'SELECT id, password_hash, security_pin FROM users WHERE id = $1',
        [existingAdmin.rows[0].id]
      );
      const row = adminRow.rows[0];
      let pwOk = false;
      let pinOk = false;
      try { pwOk = (await verifyPassword(seedAdminPassword, row.password_hash)).valid; } catch { pwOk = false; }
      try { pinOk = !!row.security_pin && (await verifyPassword(seedAdminPin, row.security_pin)).valid; } catch { pinOk = false; }
      if (!pwOk || !pinOk) {
        const adminPwHash = await hashPassword(seedAdminPassword);
        const adminPinHash = await hashPassword(seedAdminPin);
        await pool.query(
          "UPDATE users SET password_hash = $1, password_algo = 'bcrypt', security_pin = $2, two_factor_enabled = true WHERE id = $3",
          [adminPwHash, adminPinHash, row.id]
        );
        console.log('[Neon] Administrator credentials re-synced from environment.');
      }
    }
  } else {
    console.warn('[Neon] ADMIN_USER / ADMIN_PASSWORD / ADMIN_PIN not set; admin seeding skipped.');
  }

  // Safe gate: Never automatically sync or overwrite legacy SQLite users in production.
  // Production user records in Neon PostgreSQL are the authoritative source of truth.
  // Legacy user sync is only executed in development when explicitly requested via env var.
  if (process.env.AUTO_SYNC_LEGACY_USERS === 'true' && process.env.NODE_ENV !== 'production') {
    const sqliteUsers = db.prepare('SELECT * FROM users').all() as any[];
    await syncLegacyUsersToNeon(sqliteUsers);
    console.log('[Neon] Development legacy users sync completed.');
  } else {
    console.log('[Neon] PostgreSQL connection verified and schema tables ready.');
  }
} catch (neonErr: any) {
  console.warn('[Neon] Database initialization notice:', neonErr?.message || neonErr);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// ─── REVERSE PROXY & CLIENT IP RESOLUTION ─────────────────────────────────────
// In production (Render / Cloudflare edge proxies), trust the 1st hop reverse proxy
// so req.ip correctly resolves to the real client IP rather than the edge proxy IP.
// This prevents cross-client rate-limit collisions and securely ignores spoofed prefixes.
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ─── SAFE COMPARISON HELPER (CONSTANT TIME) ──────────────────────────────────
function safeCompare(a?: string, b?: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ─── GLOBAL CORS & PREFLIGHT HANDLING (STRICT ALLOWLIST) ───────────────────────
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/([a-zA-Z0-9-]+\.)?nativebazar\.gov\.bd$/,
  /^https?:\/\/([a-zA-Z0-9-]+\.)?nativebazar\.com$/,
  /^https?:\/\/([a-zA-Z0-9-]+\.)?github\.io$/,
];

function isOriginAllowed(origin?: string): boolean {
  if (!origin) return false;
  if (process.env.APP_URL && origin === process.env.APP_URL) return true;
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) return true;
  return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (isOriginAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
    }
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Admin-Token');
  res.header('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin)) {
      return res.status(403).json({ error: 'CORS origin not allowed' });
    }
    return res.status(200).end();
  }
  next();
});

// Explicit OPTIONS preflight handler
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    if (isOriginAllowed(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Admin-Token');
      return res.sendStatus(200);
    }
    return res.status(403).json({ error: 'CORS origin not allowed' });
  }
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Admin-Token');
  res.sendStatus(200);
});

// Serve database_viewer.html directly from Express
app.get(['/database_viewer.html', '/database-viewer', '/admin/db/viewer'], (_req, res) => {
  const viewerPath = path.resolve(__dirname, 'database_viewer.html');
  if (fs.existsSync(viewerPath)) {
    res.sendFile(viewerPath);
  } else {
    res.status(404).send('database_viewer.html not found. Run "npm run db:view" to generate it.');
  }
});

app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

// ─── EXPRESS RATE LIMITING MIDDLEWARES ─────────────────────────────────────────

// Strict limiter for authentication endpoints (prevents brute-force credential stuffing)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 20, // Max 20 authentication attempts per IP per 15 minutes
  standardHeaders: true, // Return standard RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  validate: { trustProxy: false },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many authentication attempts. Please try again after 15 minutes.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    });
  },
});

// AI endpoints limiter (protects Gemini API quota and prevents denial-of-wallet)
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // Max 30 AI queries per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'AI query rate limit reached. Please wait a moment before trying again.',
      code: 'AI_RATE_LIMIT_EXCEEDED',
    });
  },
});

// Product endpoints limiter (protects inventory queries, mutations, and scraping)
export const productsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 120, // Max 120 product requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many product requests. Please slow down.',
      code: 'PRODUCT_RATE_LIMIT_EXCEEDED',
    });
  },
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/products', productsLimiter);

// Initialize Google GenAI client if API key is present
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Timeout wrapper helper to guarantee responses never hang
function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Resilient Gemini runner with automatic model fallback
async function callGemini(contents: any, config?: any, timeoutMs = 15000) {
  if (!ai) throw new Error('AI client not initialized');
  const candidateModels = ['gemini-2.5-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const p = ai.models.generateContent({
        model,
        contents,
        config,
      });
      const response = await withTimeout(p, timeoutMs);
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      console.warn(`[Gemini] Model ${model} attempt failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('All candidate AI models were unreachable');
}

// ─── ADMIN AUTHORIZATION ENFORCER (SERVER-SIDE VALIDATED) ───────────────────
async function requireAdmin(req: any, res: any): Promise<boolean> {
  if (req.method === 'OPTIONS') {
    return true;
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Administrator authentication required.' });
    return false;
  }

  const sessionData = await validateToken(token);
  if (!sessionData || !sessionData.user) {
    const { maxAge: _unused, ...clearOptions } = SESSION_COOKIE_OPTIONS;
    res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
    res.status(401).json({ success: false, error: 'SESSION_EXPIRED', message: 'Admin session is invalid, expired, or revoked.' });
    return false;
  }

  if (sessionData.user.role !== 'admin') {
    res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied. Administrator privileges required.' });
    return false;
  }

  req.user = sessionData.user;
  req.sessionId = sessionData.sessionId;
  return true;
}

// ─── HEALTH, READINESS & LIVENESS PROBES ─────────────────────────────────────

// Liveness Probe (Instant response, verifies event loop, zero DB I/O)
app.get('/api/health/liveness', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Primary Health Check (Verifies active Neon Cloud PostgreSQL connectivity)
app.get('/api/health', async (_req, res) => {
  const start = Date.now();
  try {
    await pool.query('SELECT 1');
    const latencyMs = Date.now() - start;
    return res.json({
      status: 'ok',
      service: 'NativeBazar Backend (Neon Cloud PostgreSQL)',
      database: 'Neon PostgreSQL (Connected)',
      latencyMs,
      aiEnabled: !!ai,
      roles: ['Farmer', 'Wholesaler', 'Retailer', 'Consumer', 'Supplier', 'Admin'],
      pilotDistrict: 'Bogura, Bangladesh',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    return res.status(503).json({
      status: 'unhealthy',
      service: 'NativeBazar Backend',
      database: 'Neon PostgreSQL (Disconnected)',
      error: err.message || 'Database connection error',
      latencyMs,
      timestamp: new Date().toISOString(),
    });
  }
});

// Readiness Probe (Verifies PostgreSQL connectivity AND core schema availability)
app.get('/api/health/readiness', async (_req, res) => {
  const start = Date.now();
  try {
    const tableRes = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'sessions', 'products', 'orders', 'order_items')
    `);
    const tablesReady = tableRes.rows.map((r: any) => r.table_name);
    const hasCoreAuth = tablesReady.includes('users') && tablesReady.includes('sessions');

    if (!hasCoreAuth) {
      return res.status(503).json({
        status: 'not_ready',
        database: 'connected',
        error: 'Essential authentication tables missing in Neon PostgreSQL',
        tablesReady,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      status: 'ready',
      database: 'connected',
      tablesReady,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err.message || 'Readiness probe failed',
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  }
});

// ─── AUTHENTICATION ENDPOINTS (NO DEMO ACCOUNTS) ─────────────────────────────

// Register new user: Farmer, Wholesaler, Retailer, Consumer
app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      role, name, phone, password, email = '', district = 'Bogura', upazila = '',
      farmSizeAcres, primaryCrops, businessName, businessType, shopName, licenseNumber, tradeAddress,
    } = req.body;

    const allowedRoles = ['farmer', 'wholesaler', 'retailer', 'consumer'];
    const canonicalRole = (role || '').toLowerCase();
    if (!allowedRoles.includes(canonicalRole)) {
      return res.status(400).json({ error: `Invalid role. Public registration permitted only for: ${allowedRoles.join(', ')}` });
    }

    if (!name || !phone || !password) {
      return res.status(400).json({ error: 'Name, phone number, and password are required.' });
    }

    if (phone.length < 9) {
      return res.status(400).json({ error: 'Please enter a valid phone number.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if phone is already registered in Neon (with fallback to SQLite)
    let existing: any = null;
    try {
      const neonRes = await pool.query('SELECT id, role, phone FROM users WHERE phone = $1 LIMIT 1', [phone]);
      if (neonRes.rows.length > 0) existing = neonRes.rows[0];
    } catch (checkErr) {
      console.warn('[Neon] Check existing user query fallback to SQLite:', checkErr);
    }
    if (!existing) {
      existing = db.prepare('SELECT id, role, phone FROM users WHERE phone = ?').get(phone) as any;
    }
    if (existing) {
      return res.status(409).json({ error: `An account with phone number ${phone} is already registered (${existing.role}). Please log in.` });
    }

    const userId = `usr-${canonicalRole}-${Date.now()}`;
    const passwordHash = await hashPassword(password);
    const nowIso = new Date().toISOString();

    // 1. Insert into Neon Cloud PostgreSQL
    try {
      await pool.query(`
        INSERT INTO users (
          id, role, name, phone, email, password_hash, password_algo, district, upazila, verified,
          farm_size_acres, primary_crops, business_name, business_type, shop_name,
          license_number, trade_address, created_at, last_login_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'bcrypt', $7, $8, true,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17
        )
      `, [
        userId,
        canonicalRole,
        name,
        phone,
        email || null,
        passwordHash,
        district,
        upazila || null,
        farmSizeAcres ? Number(farmSizeAcres) : null,
        primaryCrops ? (Array.isArray(primaryCrops) ? JSON.stringify(primaryCrops) : primaryCrops) : null,
        businessName || null,
        businessType || null,
        shopName || null,
        licenseNumber || null,
        tradeAddress || null,
        nowIso,
        nowIso
      ]);
    } catch (neonInsertErr: any) {
      console.error('[Neon] Insert user failed:', neonInsertErr.message);
      return res.status(500).json({ error: 'Failed to create user account in cloud database.' });
    }

    // 2. Sync to local SQLite for backwards compatibility
    try {
      const insertStmt = db.prepare(`
        INSERT INTO users (
          id, role, name, phone, email, password_hash, district, upazila, verified,
          farm_size_acres, primary_crops, business_name, business_type, shop_name,
          license_number, trade_address, created_at, last_login_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, 1,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `);
      insertStmt.run(
        userId,
        canonicalRole,
        name,
        phone,
        email || null,
        passwordHash,
        district,
        upazila || null,
        farmSizeAcres ? Number(farmSizeAcres) : null,
        primaryCrops ? (Array.isArray(primaryCrops) ? JSON.stringify(primaryCrops) : primaryCrops) : null,
        businessName || null,
        businessType || null,
        shopName || null,
        licenseNumber || null,
        tradeAddress || null,
        nowIso,
        nowIso
      );
    } catch (sqliteErr) {
      console.warn('[Sync] SQLite user mirror notice:', sqliteErr);
    }

    // 3. Issue server-side session in Neon
    const { rawToken } = await createSession(userId, canonicalRole, req);
    res.cookie(SESSION_COOKIE_NAME, rawToken, SESSION_COOKIE_OPTIONS);

    const safeUser = {
      id: userId,
      role: canonicalRole,
      name,
      phone,
      email,
      district,
      upazila,
      verified: true,
      farmSizeAcres: farmSizeAcres ? Number(farmSizeAcres) : undefined,
      primaryCrops: primaryCrops || undefined,
      businessName,
      businessType,
      shopName,
      licenseNumber,
      createdAt: nowIso,
      sessionToken: rawToken,
    };

    // Ensure newly registered user is also mirrored in jsonDb
    try {
      jsonDb.addUser({
        id: userId,
        role: canonicalRole as any,
        name,
        phone,
        email: email || undefined,
        passwordHash,
        district,
        upazila: upazila || undefined,
        verified: true,
        createdAt: nowIso,
        farmSizeAcres: farmSizeAcres ? Number(farmSizeAcres) : undefined,
        primaryCrops: primaryCrops || undefined,
        businessName: businessName || undefined,
        businessType: businessType || undefined,
        shopName: shopName || undefined,
        licenseNumber: licenseNumber || undefined,
        sessionToken: rawToken,
      });
    } catch (syncErr) {
      console.warn('[Sync] jsonDb user sync warning on register:', syncErr);
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful!',
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed.' });
  }
});

// Login for registered users
app.post('/api/auth/login', async (req, res) => {
  try {
    const { identifier, password, role } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Phone/Email and password are required.' });
    }

    let user: any = null;

    // 1. Check Neon PostgreSQL
    try {
      let q = 'SELECT * FROM users WHERE (phone = $1 OR email = $2)';
      const params: any[] = [identifier, identifier];
      if (role) {
        q += ' AND role = $3';
        params.push(role);
      }
      q += ' LIMIT 1';
      const r = await pool.query(q, params);
      if (r.rows.length > 0) {
        user = r.rows[0];
      }
    } catch (err) {
      console.warn('[Neon] Login query error, falling back to SQLite:', err);
    }

    // Fallback to SQLite if not found in Neon
    if (!user) {
      let query = 'SELECT * FROM users WHERE (phone = ? OR email = ?)';
      const params: any[] = [identifier, identifier];
      if (role) {
        query += ' AND role = ?';
        params.push(role);
      }
      query += ' LIMIT 1';
      user = db.prepare(query).get(...params) as any;
    }

    if (!user) {
      return res.status(401).json({ error: 'No account found with these credentials. Please register first.' });
    }

    const { valid, needsRehash } = await verifyPassword(password, user.password_hash || user.passwordHash);
    if (!valid) {
      try {
        await pool.query(
          `INSERT INTO login_audit_logs (user_id, phone, role, status, ip_address, user_agent, details)
           VALUES ($1, $2, $3, 'FAILED', $4, $5, 'Invalid password attempt')`,
          [user.id, user.phone, user.role, req.ip || '127.0.0.1', req.headers['user-agent'] || 'Web Client']
        );
      } catch {}
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    // 2. Transparent password migration: safely upgrade legacy hash to modern bcrypt
    if (needsRehash) {
      try {
        const modernHash = await hashPassword(password);
        await pool.query(
          `UPDATE users SET password_hash = $1, password_algo = 'bcrypt' WHERE id = $2`,
          [modernHash, user.id]
        );
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(modernHash, user.id);
        jsonDb.updateUser(user.id, { passwordHash: modernHash });
        console.log(`[Auth Migration] Password hash for user ${user.phone} (${user.id}) successfully migrated to bcrypt.`);
      } catch (rehashErr) {
        console.warn('[Auth Migration] Notice: transparent rehash deferral:', rehashErr);
      }
    }

    const nowIso = new Date().toISOString();
    try {
      await pool.query('UPDATE users SET last_login_at = $1 WHERE id = $2', [nowIso, user.id]);
    } catch {}
    try {
      db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso, user.id);
    } catch {}

    // 3. Issue server-side revocable session in Neon PostgreSQL
    const { rawToken } = await createSession(user.id, user.role, req);
    res.cookie(SESSION_COOKIE_NAME, rawToken, SESSION_COOKIE_OPTIONS);

    // Audit log successful login
    try {
      await pool.query(
        `INSERT INTO login_audit_logs (user_id, phone, role, status, ip_address, user_agent, details)
         VALUES ($1, $2, $3, 'SUCCESS', $4, $5, 'Session created')`,
        [user.id, user.phone, user.role, req.ip || '127.0.0.1', req.headers['user-agent'] || 'Web Client']
      );
    } catch {}

    let primaryCropsParsed = undefined;
    try {
      if (user.primary_crops) {
        primaryCropsParsed = typeof user.primary_crops === 'string' ? JSON.parse(user.primary_crops) : user.primary_crops;
      }
    } catch {}

    const safeUser = {
      id: user.id,
      role: user.role,
      name: user.name,
      nameBn: user.name_bn || user.nameBn,
      phone: user.phone,
      email: user.email,
      district: user.district,
      upazila: user.upazila,
      verified: Boolean(user.verified),
      farmSizeAcres: user.farm_size_acres || user.farmSizeAcres,
      primaryCrops: primaryCropsParsed,
      businessName: user.business_name || user.businessName,
      businessType: user.business_type || user.businessType,
      shopName: user.shop_name || user.shopName,
      licenseNumber: user.license_number || user.licenseNumber,
      createdAt: user.created_at || user.createdAt,
      lastLoginAt: nowIso,
      sessionToken: rawToken,
    };

    // Ensure user session is updated in jsonDb
    try {
      jsonDb.updateUser(user.id, { sessionToken: rawToken, lastLoginAt: nowIso });
    } catch (syncErr) {
      console.warn('[Sync] jsonDb user sync warning on login:', syncErr);
    }

    return res.json({
      success: true,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// Admin Authorization Login (Restricted to authorized administrators only)
app.post('/api/auth/admin-login', async (req, res) => {
  try {
    const { username, password, securityPin } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    // Authenticate strictly against the administrator stored in Neon PostgreSQL.
    let adminRecord: any = null;
    const q = await pool.query(
      "SELECT * FROM users WHERE (phone = $1 OR email = $1) AND role = 'admin' LIMIT 1",
      [username]
    );
    if (q.rows.length > 0) adminRecord = q.rows[0];

    let isAuthorized = false;
    if (adminRecord) {
      const { valid } = await verifyPassword(password, adminRecord.password_hash);
      if (valid) {
        if (adminRecord.security_pin) {
          if (!securityPin) {
            return res.status(401).json({ success: false, error: 'Access Denied: Security PIN is required.' });
          }
          const pinCheck = await verifyPassword(String(securityPin), adminRecord.security_pin);
          isAuthorized = pinCheck.valid;
        } else {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(401).json({ success: false, error: 'Access Denied: Invalid administrator credentials.' });
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [adminRecord.id]);

    const adminId = adminRecord ? adminRecord.id : 'admin-root';
    const nowIso = new Date().toISOString();

    const { rawToken } = await createSession(adminId, 'admin', req);
    res.cookie(SESSION_COOKIE_NAME, rawToken, SESSION_COOKIE_OPTIONS);

    const adminUser = {
      id: adminId,
      role: 'admin',
      name: adminRecord?.name || 'Central Platform Administrator',
      phone: adminRecord?.phone || '01700000000',
      email: adminRecord?.email || 'admin@nativebazar.gov.bd',
      district: adminRecord?.district || 'Bogura',
      upazila: adminRecord?.upazila || 'Bogura Sadar',
      verified: true,
      createdAt: adminRecord?.created_at || '2026-01-01T00:00:00Z',
      lastLoginAt: nowIso,
      sessionToken: rawToken,
    };

    return res.json({
      success: true,
      user: adminUser,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Admin login failed.' });
  }
});

// ─── PRODUCT MARKETPLACE ENDPOINTS (STRICT ROLE-BASED ACCESS) ─────────────────

// Get products with role filtering
// ─── NEON POSTGRESQL PRODUCTS & SUPPLY CHAIN CATALOG ─────────────────────────
// Strict supply chain visibility:
// Consumers ONLY see Retailer products (target_role = 'consumer')
// Retailers ONLY see Wholesaler products (target_role = 'retailer')
// Wholesalers ONLY see Farmer products (target_role = 'wholesaler')
app.get('/api/products', async (req, res) => {
  try {
    const { targetRole, sellerRole, sellerId, district, category, search, minAvailable = 0 } = req.query as any;

    let query = `
      SELECT id, seller_id, seller_name, seller_phone, seller_role, target_role,
             crop_name, bangla_name, category, variety, unit, quantity, available_qty,
             quantity_kg, available_kg, min_order_qty, unit_price, price_per_kg,
             market_price, quality_grade, district, upazila, location_details,
             harvest_status, available_date, organic_certified, image_url, description,
             farmer_origin, wholesaler_arat, procurement_date, safety_note, created_at, updated_at
      FROM products
      WHERE harvest_status != 'Archived' AND available_qty > $1
    `;
    const params: any[] = [Number(minAvailable) || 0];
    let idx = 2;

    if (targetRole) {
      query += ` AND target_role = $${idx++}`;
      params.push(targetRole);
    }
    if (sellerRole) {
      query += ` AND seller_role = $${idx++}`;
      params.push(sellerRole);
    }
    if (sellerId) {
      query += ` AND seller_id = $${idx++}`;
      params.push(sellerId);
    }
    if (district && district !== 'All') {
      query += ` AND district = $${idx++}`;
      params.push(district);
    }
    if (category && category !== 'All') {
      query += ` AND category = $${idx++}`;
      params.push(category);
    }
    if (search) {
      query += ` AND (crop_name ILIKE $${idx} OR bangla_name ILIKE $${idx} OR seller_name ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    const mapped = result.rows.map((r) => ({
      id: r.id,
      sellerId: r.seller_id,
      sellerName: r.seller_name,
      sellerPhone: r.seller_phone,
      sellerRole: r.seller_role,
      targetRole: r.target_role,
      cropName: r.crop_name,
      banglaName: r.bangla_name,
      category: r.category,
      variety: r.variety,
      unit: r.unit || 'kg',
      quantity: parseFloat(r.quantity),
      availableQty: parseFloat(r.available_qty),
      quantityKg: r.quantity_kg !== null ? parseFloat(r.quantity_kg) : parseFloat(r.quantity),
      availableKg: r.available_kg !== null ? parseFloat(r.available_kg) : parseFloat(r.available_qty),
      minOrderKg: parseFloat(r.min_order_qty || 1),
      pricePerKg: parseFloat(r.unit_price),
      unitPrice: parseFloat(r.unit_price),
      marketPricePerKg: r.market_price ? parseFloat(r.market_price) : parseFloat(r.unit_price) * 1.15,
      qualityGrade: r.quality_grade,
      district: r.district,
      upazila: r.upazila,
      locationDetails: r.location_details,
      harvestStatus: r.harvest_status,
      availableDate: r.available_date,
      organicCertified: Boolean(r.organic_certified),
      imageUrl: r.image_url,
      description: r.description,
      traceability: {
        farmerOrigin: r.farmer_origin,
        wholesalerArat: r.wholesaler_arat,
        procurementDate: r.procurement_date,
        safetyNote: r.safety_note,
      },
      createdAt: r.created_at,
    }));

    return res.json({ products: mapped, total: mapped.length });
  } catch (err: any) {
    console.error('Error fetching Neon products:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch products.' });
  }
});

// Publish new product in Neon: Enforces seller role restrictions
app.post('/api/products', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const {
      cropName, banglaName, category = 'Vegetables', variety = '',
      unit = 'kg', quantityKg, quantity, pricePerKg, unitPrice, marketPricePerKg,
      qualityGrade = 'A', district = 'Bogura', upazila = '', locationDetails = '',
      harvestStatus = 'Harvested Today', availableDate = 'In Stock', organicCertified = false,
      imageUrl = '', description = '', farmerOrigin = '', wholesalerArat = '',
      procurementDate = '', safetyNote = '', minOrderKg = 1,
    } = req.body;

    const effectiveSellerId = authUser.id;
    const effectiveSellerName = authUser.name;
    const effectiveSellerPhone = authUser.phone || '';
    const effectiveSellerRole = authUser.role;

    const sRole = (effectiveSellerRole || '').toLowerCase();
    let targetRole = 'consumer';
    if (sRole === 'farmer') {
      targetRole = 'wholesaler';
    } else if (sRole === 'wholesaler') {
      targetRole = 'retailer';
    } else if (sRole === 'retailer') {
      targetRole = 'consumer';
    } else if (sRole === 'admin') {
      targetRole = 'consumer';
    } else {
      return res.status(403).json({ error: 'Only Farmers, Wholesalers, and Retailers are authorized to publish products.' });
    }

    const finalQuantity = Number(quantity || quantityKg);
    const finalPrice = Number(unitPrice || pricePerKg);

    if (!cropName || !finalPrice || !finalQuantity || finalQuantity <= 0 || finalPrice <= 0) {
      return res.status(400).json({ error: 'Valid crop name, quantity, and unit price are required.' });
    }

    const prodId = `prod-${sRole.slice(0, 3)}-${Date.now()}`;
    const finalMarketPrice = marketPricePerKg ? Number(marketPricePerKg) : finalPrice * 1.15;

    await pool.query(`
      INSERT INTO products (
        id, seller_id, seller_name, seller_phone, seller_role, target_role,
        crop_name, bangla_name, category, variety, unit, quantity, available_qty,
        min_order_qty, unit_price, market_price, quality_grade, district,
        upazila, location_details, harvest_status, available_date, organic_certified,
        image_url, description, farmer_origin, wholesaler_arat, procurement_date,
        safety_note, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
        $24, $25, $26, $27, $28, $29, NOW(), NOW()
      )
    `, [
      prodId, effectiveSellerId, effectiveSellerName, effectiveSellerPhone, sRole, targetRole,
      cropName, banglaName || cropName, category, variety || '', unit || 'kg', finalQuantity, finalQuantity,
      Number(minOrderKg) || 1, finalPrice, finalMarketPrice, qualityGrade, district,
      upazila || '', locationDetails || '', harvestStatus, availableDate, Boolean(organicCertified),
      imageUrl || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
      description || '', farmerOrigin || (sRole === 'farmer' ? effectiveSellerName : ''),
      wholesalerArat || (sRole === 'wholesaler' ? effectiveSellerName : ''),
      procurementDate || '', safetyNote || ''
    ]);

    return res.status(201).json({
      success: true,
      productId: prodId,
      targetRole,
      message: `Product successfully published for ${targetRole}s!`,
    });
  } catch (err: any) {
    console.error('Error creating product in Neon:', err);
    return res.status(500).json({ error: err.message || 'Failed to publish product.' });
  }
});

// Update product in Neon
app.put('/api/products/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { pricePerKg, unitPrice, quantityKg, quantity, availableKg, availableQty, qualityGrade, harvestStatus, description, imageUrl } = req.body;

    const existingRes = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    const existing = existingRes.rows[0];

    if (existing.seller_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own products.' });
    }

    const newPrice = unitPrice !== undefined ? Number(unitPrice) : (pricePerKg !== undefined ? Number(pricePerKg) : null);
    const newQty = quantity !== undefined ? Number(quantity) : (quantityKg !== undefined ? Number(quantityKg) : null);
    const newAvail = availableQty !== undefined ? Number(availableQty) : (availableKg !== undefined ? Number(availableKg) : null);

    await pool.query(`
      UPDATE products
      SET unit_price = COALESCE($1, unit_price),
          quantity = COALESCE($2, quantity),
          available_qty = COALESCE($3, available_qty),
          quality_grade = COALESCE($4, quality_grade),
          harvest_status = COALESCE($5, harvest_status),
          description = COALESCE($6, description),
          image_url = COALESCE($7, image_url),
          updated_at = NOW()
      WHERE id = $8
    `, [
      newPrice, newQty, newAvail, qualityGrade || null, harvestStatus || null,
      description || null, imageUrl || null, id
    ]);

    return res.json({ success: true, message: 'Product updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete product in Neon
app.delete('/api/products/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const existingRes = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    const existing = existingRes.rows[0];

    if (existing.seller_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own products.' });
    }

    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return res.json({ success: true, message: 'Product removed.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── NEON SECURE ORDER & SUPPLY CHAIN EXECUTION ──────────────────────────────
// Create order: calls executeNeonOrderTransaction with full locking and atomicity
app.post('/api/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const {
      items, paymentMethod = 'Cash on Delivery',
      deliveryAddress, district = 'Bogura', notes,
    } = req.body;

    const effectiveBuyerId = authUser.id;
    const effectiveBuyerName = authUser.name;
    const effectiveBuyerPhone = authUser.phone || req.body.buyerPhone || '';
    const effectiveBuyerEmail = authUser.email || req.body.buyerEmail || '';
    const effectiveBuyerRole = authUser.role;

    if (!effectiveBuyerName || !effectiveBuyerPhone || !deliveryAddress) {
      return res.status(400).json({ error: 'Name, phone number, and delivery address are required.' });
    }

    if (!items || !items.length) {
      return res.status(400).json({ error: 'No items in cart to order.' });
    }

    const result = await executeNeonOrderTransaction({
      buyerId: effectiveBuyerId,
      buyerName: effectiveBuyerName,
      buyerPhone: effectiveBuyerPhone,
      buyerEmail: effectiveBuyerEmail,
      buyerRole: effectiveBuyerRole,
      items: items.map((it: any) => ({
        productId: it.productId,
        quantityKg: Number(it.quantityKg || it.quantity || 1),
      })),
      paymentMethod,
      deliveryAddress,
      district,
      notes,
    }, pool);

    // Real-time notification & SSE to Farmer (order receiver)
    if (result.sellerId) {
      try {
        await createNeonNotification(
          result.sellerId,
          `নতুন ক্রয়াদেশ / New Order Request`,
          `${effectiveBuyerName} (${effectiveBuyerRole === 'wholesaler' ? 'পাইকার' : effectiveBuyerRole}) আপনার ফসলের জন্য ৳${result.totalBdt} টাকার নতুন অর্ডার দিয়েছেন। এক্সেপ্ট করতে ক্লিক করুন।`,
          'order',
          `/orders`
        );
      } catch (notifErr) {
        console.warn('[Orders] Realtime notification warning:', notifErr);
      }
      sendSSE(result.sellerId, 'order_created', { orderId: result.orderId, order: result });
    }
    if (effectiveBuyerId) {
      sendSSE(effectiveBuyerId, 'order_created', { orderId: result.orderId, order: result });
    }

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully! Awaiting farmer acceptance.',
      order: result,
    });
  } catch (err: any) {
    console.error('Order creation error in Neon:', err.message);
    if (err.message.includes('Rule Violation') || err.message.includes('Multi-Seller Violation')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message.includes('Insufficient stock') || err.message.includes('Invalid')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Order execution failed.' });
  }
});

// Get orders: filtered by user or role from Neon PostgreSQL
app.get('/api/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (authUser.role === 'admin') {
      const { userId, role, sellerId, buyerId, customerId } = req.query as any;
      const targetBuyer = buyerId || customerId;
      if (targetBuyer) {
        query += ` AND buyer_id = $${idx++}`;
        params.push(targetBuyer);
      } else if (sellerId) {
        query += ` AND seller_id = $${idx++}`;
        params.push(sellerId);
      } else if (userId) {
        query += ` AND (buyer_id = $${idx} OR seller_id = $${idx})`;
        params.push(userId);
        idx++;
      }
      if (role) {
        query += ` AND (buyer_role = $${idx} OR seller_role = $${idx})`;
        params.push(role);
        idx++;
      }
    } else {
      // Non-admins strictly access only orders where they are buyer or seller
      query += ` AND (buyer_id = $${idx} OR seller_id = $${idx})`;
      params.push(authUser.id);
      idx++;
    }

    query += ' ORDER BY created_at DESC';

    const orderRes = await pool.query(query, params);
    const orderRows = orderRes.rows;

    if (orderRows.length === 0) {
      return res.json({ success: true, orders: [], total: 0 });
    }

    const orderIds = orderRows.map((o) => o.id);
    const itemsRes = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ANY($1::text[]) ORDER BY id',
      [orderIds]
    );

    const itemsByOrderId = new Map<string, any[]>();
    for (const it of itemsRes.rows) {
      if (!itemsByOrderId.has(it.order_id)) {
        itemsByOrderId.set(it.order_id, []);
      }
      itemsByOrderId.get(it.order_id)!.push({
        id: it.id,
        productId: it.product_id,
        cropName: it.crop_name,
        banglaName: it.bangla_name,
        quantityKg: parseFloat(it.quantity_kg),
        unitPrice: parseFloat(it.unit_price),
        subtotal: parseFloat(it.subtotal),
      });
    }

    const fullOrders = orderRows.map((o) => {
      const canonicalStatus = (o.order_status || o.delivery_status || 'pending').toLowerCase();
      return {
        id: o.id,
        orderType: o.order_type,
        buyerId: o.buyer_id,
        buyerName: o.buyer_name,
        buyerPhone: o.buyer_phone,
        buyerEmail: o.buyer_email,
        buyerRole: o.buyer_role,
        sellerId: o.seller_id,
        sellerName: o.seller_name,
        sellerPhone: o.seller_phone,
        sellerRole: o.seller_role,
        totalBDT: parseFloat(o.total_bdt),
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        deliveryStatus: canonicalStatus,
        orderStatus: canonicalStatus,
        status: canonicalStatus,
        deliveryAddress: o.delivery_address,
        district: o.district,
        trackingCode: o.tracking_code,
        notes: o.notes,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        items: itemsByOrderId.get(o.id) || [],
      };
    });

    return res.json({ success: true, orders: fullOrders, total: fullOrders.length });
  } catch (err: any) {
    console.error('Error fetching Neon orders:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Update order lifecycle status in Neon PostgreSQL
// Valid states: pending, accepted, rejected, shipped, completed
app.put('/api/orders/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const authUser = req.user!;

    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Order not found.' });
    const order = orderRes.rows[0];

    const isSeller = order.seller_id === authUser.id;
    const isBuyer = order.buyer_id === authUser.id;
    const isAdmin = authUser.role === 'admin';

    if (!isSeller && !isBuyer && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: You are not authorized to update this order.' });
    }

    // Normalize lifecycle status
    const raw = String(status || '').trim().toLowerCase();
    let targetStatus = 'pending';
    if (raw === 'accepted') targetStatus = 'accepted';
    else if (raw === 'rejected' || raw === 'cancelled') targetStatus = 'rejected';
    else if (raw === 'shipped' || raw === 'dispatched' || raw === 'pending_delivery') targetStatus = 'shipped';
    else if (raw === 'completed' || raw === 'delivered' || raw === 'received') targetStatus = 'completed';
    else targetStatus = raw;

    // Handle inventory restoration if order is rejected/cancelled
    if (targetStatus === 'rejected') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const items = (await client.query('SELECT product_id, quantity_kg FROM order_items WHERE order_id = $1', [id])).rows;
        for (const item of items) {
          await client.query(
            'UPDATE products SET available_qty = available_qty + $1, updated_at = NOW() WHERE id = $2',
            [item.quantity_kg, item.product_id]
          );
        }
        await client.query(
          "UPDATE orders SET delivery_status = 'rejected', order_status = 'rejected', updated_at = NOW() WHERE id = $1",
          [id]
        );
        await client.query(`
          INSERT INTO trade_audit_logs (id, order_id, type, amount, actor_role, actor_name, description, created_at)
          VALUES ($1, $2, 'ORDER_REJECTED', $3, $4, $5, $6, NOW())
        `, [
          `aud-rej-${Date.now()}`, id, order.total_bdt, authUser.role, authUser.name,
          `Order ${id} rejected by ${authUser.name} (${authUser.role}). Stock restored.`
        ]);
        await client.query('COMMIT');
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      await pool.query(
        'UPDATE orders SET delivery_status = $1, order_status = $1, updated_at = NOW() WHERE id = $2',
        [targetStatus, id]
      );
    }

    // ─── Real-Time Notifications for Lifecycle Events ──────────────────────────
    try {
      if (targetStatus === 'accepted') {
        // Farmer accepted -> notify Wholesaler (Buyer)
        await createNeonNotification(
          order.buyer_id,
          `অর্ডার অনুমোদিত / Order Accepted`,
          `কৃষক ${order.seller_name} আপনার #${id} অর্ডারটি গ্রহণ করেছেন। মাল প্রস্তুত করা হচ্ছে।`,
          'order',
          `/orders`
        );
      } else if (targetStatus === 'rejected') {
        // Farmer rejected -> notify Wholesaler (Buyer)
        await createNeonNotification(
          order.buyer_id,
          `অর্ডার প্রত্যাখ্যাত / Order Rejected`,
          `কৃষক ${order.seller_name} আপনার #${id} অর্ডারটি গ্রহণ করেননি (প্রত্যাখ্যাত)। স্টক মুক্ত করা হয়েছে।`,
          'warning',
          `/orders`
        );
      } else if (targetStatus === 'shipped') {
        // Farmer marked as delivered -> notify Wholesaler (Buyer)
        await createNeonNotification(
          order.buyer_id,
          `ডেলিভারি পাঠানো হয়েছে / Order Shipped`,
          `কৃষক ${order.seller_name} #${id} অর্ডারের পণ্য ডেলিভারির জন্য পাঠিয়েছেন। পৌঁছালে 'ডেলিভারি গ্রহণ করেছি' ক্লিক করুন।`,
          'order',
          `/orders`
        );
      } else if (targetStatus === 'completed') {
        // Wholesaler marked as received -> notify Farmer (Seller)
        await createNeonNotification(
          order.seller_id,
          `ডেলিভারি সম্পন্ন / Order Received & Completed`,
          `পাইকার ${order.buyer_name} #${id} অর্ডারের পণ্য গ্রহণ করেছেন। লেনদেন সফলভাবে সম্পন্ন হয়েছে।`,
          'success',
          `/orders`
        );
      }
    } catch (notifErr) {
      console.warn('[Orders] Realtime notification warning:', notifErr);
    }

    // Real-time dispatch via SSE to both Buyer and Seller
    sendSSE(order.buyer_id, 'order_updated', {
      orderId: id,
      orderStatus: targetStatus,
      status: targetStatus,
      deliveryStatus: targetStatus,
      updatedBy: authUser.name,
      updatedRole: authUser.role,
    });
    sendSSE(order.seller_id, 'order_updated', {
      orderId: id,
      orderStatus: targetStatus,
      status: targetStatus,
      deliveryStatus: targetStatus,
      updatedBy: authUser.name,
      updatedRole: authUser.role,
    });

    return res.json({
      success: true,
      message: `Order status successfully updated to ${targetStatus}.`,
      orderId: id,
      orderStatus: targetStatus,
    });
  } catch (err: any) {
    console.error('[Orders] Error in PUT /api/orders/:id/status:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── WHOLESALER BIDS & FARMER INTELLIGENCE (NEON POSTGRESQL) ─────────────────────

function formatWholesalerOfferRow(r: any) {
  return {
    id: r.id,
    wholesalerId: r.wholesaler_id,
    wholesaler_id: r.wholesaler_id,
    wholesalerName: r.wholesaler_name,
    wholesaler_name: r.wholesaler_name,
    wholesalerPhone: r.wholesaler_phone,
    wholesaler_phone: r.wholesaler_phone,
    businessName: r.business_name,
    business_name: r.business_name,
    cropName: r.crop_name,
    crop_name: r.crop_name,
    cropBangla: r.crop_bangla,
    crop_bangla: r.crop_bangla,
    quantityKgNeeded: parseFloat(r.quantity_kg_needed),
    quantity_kg_needed: parseFloat(r.quantity_kg_needed),
    fulfilledKg: r.fulfilled_kg !== null ? parseFloat(r.fulfilled_kg) : 0,
    fulfilled_kg: r.fulfilled_kg !== null ? parseFloat(r.fulfilled_kg) : 0,
    offeredPricePerKg: parseFloat(r.offered_price_per_kg),
    offered_price_per_kg: parseFloat(r.offered_price_per_kg),
    district: r.district,
    upazila: r.upazila,
    location: r.location,
    deadline: r.deadline,
    urgent: Boolean(r.urgent),
    verified: Boolean(r.verified),
    notes: r.notes,
    createdAt: r.created_at,
    created_at: r.created_at,
  };
}

function formatMarketPriceRow(r: any) {
  return {
    id: r.id,
    district: r.district,
    upazila: r.upazila,
    marketName: r.market_name,
    market_name: r.market_name,
    marketNameBn: r.market_name_bn,
    market_name_bn: r.market_name_bn,
    cropName: r.crop_name,
    crop_name: r.crop_name,
    banglaName: r.bangla_name,
    bangla_name: r.bangla_name,
    category: r.category,
    wholesalePrice: parseFloat(r.wholesale_price),
    wholesale_price: parseFloat(r.wholesale_price),
    wholesaleDhaka: parseFloat(r.wholesale_dhaka),
    wholesale_dhaka: parseFloat(r.wholesale_dhaka),
    retailPrice: parseFloat(r.retail_price),
    retail_price: parseFloat(r.retail_price),
    unit: r.unit || 'kg',
    change24h: r.change_24h !== null ? parseFloat(r.change_24h) : 0,
    change_24h: r.change_24h !== null ? parseFloat(r.change_24h) : 0,
    trend: r.trend || 'stable',
    source: r.source || 'Department of Agricultural Marketing (DAM)',
    lastUpdated: r.last_updated,
    last_updated: r.last_updated,
  };
}

// Get verified wholesaler purchase offers for farmers
app.get('/api/wholesaler-offers', async (req, res) => {
  try {
    const { district, crop } = req.query as any;
    let query = 'SELECT * FROM wholesaler_offers WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (district && district !== 'All') {
      query += ` AND district = $${idx++}`;
      params.push(district);
    }
    if (crop) {
      query += ` AND (crop_name ILIKE $${idx} OR crop_bangla ILIKE $${idx})`;
      params.push(`%${crop}%`);
      idx++;
    }

    query += ' ORDER BY urgent DESC, created_at DESC';
    const result = await pool.query(query, params);
    const offers = result.rows.map(formatWholesalerOfferRow);
    return res.json({ offers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Wholesalers post procurement demands / purchase offers
app.post('/api/wholesaler-offers', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'wholesaler' && authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only wholesalers and administrators can post procurement offers.' });
    }

    const {
      cropName, cropBangla, quantityKgNeeded, offeredPricePerKg,
      district = 'Bogura', upazila = '', location, deadline, urgent = false, notes = '',
    } = req.body;

    const wholesalerId = authUser.id;
    const wholesalerName = authUser.name || 'Verified Wholesaler';
    const wholesalerPhone = authUser.phone || '';
    const businessName = req.body.businessName || (authUser as any).businessName || wholesalerName || 'Wholesale Arat';

    if (!cropName || !quantityKgNeeded || !offeredPricePerKg || !location) {
      return res.status(400).json({ error: 'Crop, quantity, offered price, and delivery location are required.' });
    }

    const qty = Number(quantityKgNeeded);
    const price = Number(offeredPricePerKg);
    if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Quantity and offered price must be positive numbers.' });
    }

    const offerId = `bid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const insertRes = await pool.query(`
      INSERT INTO wholesaler_offers (
        id, wholesaler_id, wholesaler_name, wholesaler_phone, business_name,
        crop_name, crop_bangla, quantity_kg_needed, fulfilled_kg, offered_price_per_kg,
        district, upazila, location, deadline, urgent, verified, notes, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, 0, $9,
        $10, $11, $12, $13, $14, true, $15, NOW()
      ) RETURNING *
    `, [
      offerId,
      wholesalerId,
      wholesalerName,
      wholesalerPhone,
      businessName,
      cropName,
      cropBangla || cropName,
      qty,
      price,
      district,
      upazila || null,
      location,
      deadline || 'Within 7 days',
      Boolean(urgent),
      notes || null,
    ]);

    const createdOffer = formatWholesalerOfferRow(insertRes.rows[0]);
    return res.status(201).json({
      success: true,
      offerId,
      offer: createdOffer,
      message: 'Purchase offer broadcast to farmers successfully!'
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update a wholesaler procurement offer
app.put('/api/wholesaler-offers/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const offerRes = await pool.query('SELECT * FROM wholesaler_offers WHERE id = $1', [req.params.id]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Wholesaler offer not found.' });
    }

    const offer = offerRes.rows[0];
    if (offer.wholesaler_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You cannot modify another wholesaler\'s offer.' });
    }

    const {
      quantityKgNeeded, fulfilledKg, offeredPricePerKg, district, upazila,
      location, deadline, urgent, notes, cropName, cropBangla
    } = req.body;

    const updated = await pool.query(`
      UPDATE wholesaler_offers
      SET quantity_kg_needed = COALESCE($1, quantity_kg_needed),
          fulfilled_kg = COALESCE($2, fulfilled_kg),
          offered_price_per_kg = COALESCE($3, offered_price_per_kg),
          district = COALESCE($4, district),
          upazila = COALESCE($5, upazila),
          location = COALESCE($6, location),
          deadline = COALESCE($7, deadline),
          urgent = COALESCE($8, urgent),
          notes = COALESCE($9, notes),
          crop_name = COALESCE($10, crop_name),
          crop_bangla = COALESCE($11, crop_bangla)
      WHERE id = $12
      RETURNING *
    `, [
      quantityKgNeeded !== undefined ? Number(quantityKgNeeded) : null,
      fulfilledKg !== undefined ? Number(fulfilledKg) : null,
      offeredPricePerKg !== undefined ? Number(offeredPricePerKg) : null,
      district || null,
      upazila !== undefined ? upazila : null,
      location || null,
      deadline || null,
      urgent !== undefined ? Boolean(urgent) : null,
      notes !== undefined ? notes : null,
      cropName || null,
      cropBangla || null,
      req.params.id
    ]);

    return res.json({ success: true, offer: formatWholesalerOfferRow(updated.rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete a wholesaler procurement offer
app.delete('/api/wholesaler-offers/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const offerRes = await pool.query('SELECT * FROM wholesaler_offers WHERE id = $1', [req.params.id]);
    if (offerRes.rows.length === 0) {
      return res.status(404).json({ error: 'Wholesaler offer not found.' });
    }

    const offer = offerRes.rows[0];
    if (offer.wholesaler_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You cannot delete another wholesaler\'s offer.' });
    }

    await pool.query('DELETE FROM wholesaler_offers WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Wholesaler offer deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Official Department of Agricultural Marketing (DAM) market prices
app.get(['/api/market-prices', '/api/market-rates'], async (req, res) => {
  try {
    const { district } = req.query as any;
    let query = 'SELECT * FROM market_prices';
    const params: any[] = [];

    if (district && district !== 'All') {
      query += ' WHERE district = $1';
      params.push(district);
    }
    query += ' ORDER BY crop_name ASC';

    const result = await pool.query(query, params);
    const rates = result.rows.map(formatMarketPriceRow);
    return res.json({ rates, source: 'Department of Agricultural Marketing (DAM)' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin-only: create market price
app.post('/api/market-prices', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required to update market prices.' });
    }
    const {
      district, upazila, marketName, marketNameBn, cropName, banglaName,
      category, wholesalePrice, wholesaleDhaka, retailPrice, unit = 'kg',
      change24h = 0, trend = 'stable', source = 'Department of Agricultural Marketing (DAM)'
    } = req.body;

    if (!district || !marketName || !cropName || !banglaName || !wholesalePrice || !retailPrice) {
      return res.status(400).json({ error: 'District, market name, crop names, and prices are required.' });
    }

    const priceId = `mp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ins = await pool.query(`
      INSERT INTO market_prices (
        id, district, upazila, market_name, market_name_bn, crop_name, bangla_name,
        category, wholesale_price, wholesale_dhaka, retail_price, unit, change_24h,
        trend, source, last_updated
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, NOW()
      ) RETURNING *
    `, [
      priceId, district, upazila || null, marketName, marketNameBn || marketName, cropName, banglaName,
      category || 'Vegetables', Number(wholesalePrice), Number(wholesaleDhaka || wholesalePrice),
      Number(retailPrice), unit, Number(change24h), trend, source
    ]);

    return res.status(201).json({ success: true, rate: formatMarketPriceRow(ins.rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin-only: update market price
app.put('/api/market-prices/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required to update market prices.' });
    }
    const { wholesalePrice, wholesaleDhaka, retailPrice, change24h, trend } = req.body;
    const upd = await pool.query(`
      UPDATE market_prices
      SET wholesale_price = COALESCE($1, wholesale_price),
          wholesale_dhaka = COALESCE($2, wholesale_dhaka),
          retail_price = COALESCE($3, retail_price),
          change_24h = COALESCE($4, change_24h),
          trend = COALESCE($5, trend),
          last_updated = NOW()
      WHERE id = $6
      RETURNING *
    `, [
      wholesalePrice !== undefined ? Number(wholesalePrice) : null,
      wholesaleDhaka !== undefined ? Number(wholesaleDhaka) : null,
      retailPrice !== undefined ? Number(retailPrice) : null,
      change24h !== undefined ? Number(change24h) : null,
      trend || null,
      req.params.id
    ]);

    if (upd.rows.length === 0) {
      return res.status(404).json({ error: 'Market price record not found.' });
    }
    return res.json({ success: true, rate: formatMarketPriceRow(upd.rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin-only: delete market price
app.delete('/api/market-prices/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }
    const del = await pool.query('DELETE FROM market_prices WHERE id = $1 RETURNING id', [req.params.id]);
    if (del.rows.length === 0) {
      return res.status(404).json({ error: 'Market price record not found.' });
    }
    return res.json({ success: true, message: 'Market price record deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Farmer-Only Intelligence aggregation (Weather, DAM Prices, Verified Bids, Demand)
app.get('/api/farmer/intelligence', async (req, res) => {
  try {
    const district = (req.query.district as string) || 'Bogura';

    const ratesRes = await pool.query('SELECT * FROM market_prices WHERE district = $1', [district]);
    const offersRes = await pool.query('SELECT * FROM wholesaler_offers WHERE district = $1 ORDER BY urgent DESC', [district]);

    const rates = ratesRes.rows.map(formatMarketPriceRow);
    const offers = offersRes.rows.map(formatWholesalerOfferRow);

    const highDemandCrops = [
      { name: 'Hybrid Tomatoes (হাইব্রিড টমেটো)', demandIndex: 94, trend: 'High Demand', reason: 'High arat arrivals from Karwan Bazar & Dhaka wholesale corridor' },
      { name: 'Diamond Potatoes (ডায়মন্ড আলু)', demandIndex: 88, trend: 'Stable Demand', reason: 'Cold storage intake active in Sherpur & Shibganj' },
      { name: 'Green Chili (কাঁচা মরিচ)', demandIndex: 91, trend: 'Very High Demand', reason: 'Inter-district supply shortage due to riverine rains' },
      { name: 'Winter Cauliflower (ফুলকপি)', demandIndex: 79, trend: 'Moderate Demand', reason: 'Early harvest fetching premium rates in city arats' },
    ];

    return res.json({
      district,
      marketRates: rates,
      wholesalerOffers: offers,
      highDemandCrops,
      officialSource: 'Department of Agricultural Marketing (DAM) & Bangladesh Agro Met',
      lastRefreshed: new Date().toISOString(),
      verified: true,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Metrics & System Overview (Neon PostgreSQL authoritative)
app.get('/api/admin/metrics', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;

    let userCounts: any[] = [];
    let productCounts: any[] = [];
    let totalOrders = 0;
    let totalVolumeBDT = 0;
    let recentAudit: any[] = [];

    try {
      const [uRes, pRes, oRes, aRes] = await Promise.all([
        pool.query('SELECT role, COUNT(*)::int as count FROM users GROUP BY role'),
        pool.query('SELECT target_role, COUNT(*)::int as count, COALESCE(SUM(available_qty), 0)::numeric as total_kg FROM products GROUP BY target_role'),
        pool.query('SELECT COUNT(*)::int as total_orders, COALESCE(SUM(total_bdt), 0)::numeric as total_volume FROM orders'),
        pool.query('SELECT id, order_id, type, amount, actor_role, actor_name, description, created_at FROM trade_audit_logs ORDER BY created_at DESC LIMIT 20'),
      ]);

      userCounts = uRes.rows;
      productCounts = pRes.rows.map((r: any) => ({ ...r, total_kg: parseFloat(r.total_kg) || 0 }));
      const orderRow = oRes.rows[0];
      totalOrders = orderRow?.total_orders || 0;
      totalVolumeBDT = parseFloat(orderRow?.total_volume) || 0;
      recentAudit = aRes.rows;
    } catch (neonErr: any) {
      console.warn('[Admin Metrics] Notice: querying Neon failed, falling back to local store:', neonErr.message);
      userCounts = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all() as any[];
      productCounts = db.prepare('SELECT target_role, COUNT(*) as count, SUM(available_kg) as total_kg FROM products GROUP BY target_role').all() as any[];
      const orderStats = db.prepare('SELECT COUNT(*) as total_orders, SUM(total_bdt) as total_volume FROM orders').get() as any;
      recentAudit = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20').all();
      totalOrders = orderStats?.total_orders || 0;
      totalVolumeBDT = orderStats?.total_volume || 0;
    }

    return res.json({
      userCounts,
      productCounts,
      totalOrders,
      totalVolumeBDT,
      auditLogs: recentAudit,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


// ─── AI CROP DOCTOR & MARKET PREDICTION APIS ─────────────────────────────

// 1. Crop Diagnosis Endpoint
app.post('/api/ai/diagnose-crop', async (req, res) => {
  const { cropName = 'Tomato', symptoms = '', imageBase64, imageMimeType = 'image/jpeg', language = 'bn' } = req.body;

  const fallback = {
    diseaseName: cropName.toLowerCase().includes('tomato') || cropName.toLowerCase().includes('টমেটো')
      ? 'Early Blight (Alternaria solani)'
      : cropName.toLowerCase().includes('potato') || cropName.toLowerCase().includes('আলু')
      ? 'Late Blight (Phytophthora infestans)'
      : 'Bacterial Leaf Spot',
    diseaseBanglaName: cropName.toLowerCase().includes('tomato') || cropName.toLowerCase().includes('টমেটো')
      ? 'টমেটোর আগাম ধসা রোগ'
      : cropName.toLowerCase().includes('potato') || cropName.toLowerCase().includes('আলু')
      ? 'আলুর নাবি ধসা রোগ (লেইট ব্লাইট)'
      : 'পাতার ব্যাকটেরিয়াজনিত দাগ রোগ',
    severity: 'Moderate' as const,
    isAiEstimate: true,
    symptomsSummary: symptoms || 'Dark concentric brown rings on lower leaves with yellow halo margins.',
    immediateActions: language === 'bn'
      ? ['আক্রান্ত পাতা সংগ্রহ করে পুড়িয়ে ফেলুন', 'গাছের গোড়ায় অতিরিক্ত পানি নিষ্কাশন নিশ্চিত করুন', 'বাতাস চলাচলের জন্য জমি আগাছামুক্ত রাখুন']
      : ['Collect and burn severely infected leaves', 'Ensure proper drainage at roots', 'Keep field weed-free for aeration'],
    chemicalTreatment: {
      medicine: 'Mancozeb 75 WP (Dithane M-45) or Ridomil Gold MZ',
      dose: language === 'bn' ? 'প্রতি লিটার পানিতে ২ গ্রাম হারে স্প্রে করুন' : '2 grams per liter of water',
      schedule: language === 'bn' ? '৭-১০ দিন পর পর ২ বার স্প্রে করুন' : 'Spray twice at 7-10 day intervals',
    },
    organicTreatment: language === 'bn'
      ? 'নিম তেলের দ্রবণ (প্রতি লিটারে ৫ মিলি) অথবা ট্রাইকোডার্মা জৈব ছত্রাকনাশক ব্যবহার করুন।'
      : 'Neem oil solution (5ml/L) or Trichoderma bio-fungicide soil treatment.',
    preventionTips: language === 'bn'
      ? 'পরবর্তী মৌসুমে রোগমুক্ত প্রত্যায়িত বীজ ব্যবহার করুন এবং ফসল পর্যায়ক্রম অনুসরণ করুন।'
      : 'Use certified disease-free seeds and practice crop rotation next season.',
    aiDisclaimer: language === 'bn'
      ? 'সতর্কতা: এটি এআই ভিত্তিক প্রাথমিক বিশ্লেষণ। কোনো রাসায়নিক প্রয়োগের পূর্বে অবশ্যই স্থানীয় উপ-সহকারী কৃষি কর্মকর্তা (SAAO/UAO) বা কৃষি বিশেষজ্ঞের পরামর্শ নিন।'
      : 'Advisory: This is an automated AI diagnostic estimate. Always consult your local Sub-Assistant Agriculture Officer (SAAO) or certified agronomist before taking action.',
    pesticideSafetyWarning: language === 'bn'
      ? 'কীটনাশক সতর্কতা: স্প্রে করার সময় মাস্ক ও গ্লাভস পরিধান করুন। ফসল তোলার পূর্ববর্তী নির্ধারিত নিরাপদ সময় (PHI) বজায় রাখুন।'
      : 'Pesticide Safety: Wear protective gloves and face mask. Strictly adhere to Pre-Harvest Intervals (PHI).',
    verifiedBySAAO: false,
  };

  if (!ai) {
    return res.json(fallback);
  }

  try {
    const promptText = `Expert Agronomist for Bogura Bangladesh. Diagnose this crop:
Crop: ${cropName}
Symptoms: ${symptoms}
Language: ${language === 'bn' ? 'Bengali' : 'English'}
NOTE: Do NOT claim human or SAAO verification. Do NOT return fake certainty or confidence percentages.
Return JSON with:
{
  "diseaseName": "English name",
  "diseaseBanglaName": "বাংলা নাম",
  "severity": "Moderate",
  "symptomsSummary": "short explanation",
  "immediateActions": ["action 1", "action 2"],
  "chemicalTreatment": {
    "medicine": "Mancozeb 75 WP or approved chemical",
    "dose": "2g per liter",
    "schedule": "every 7 days"
  },
  "organicTreatment": "Neem oil or bio remedy",
  "preventionTips": "crop rotation and clean seed",
  "aiDisclaimer": "AI advisory note",
  "pesticideSafetyWarning": "safety notice"
}`;

    const parts: any[] = [{ text: promptText }];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: imageMimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    const response = await callGemini(parts, {
      responseMimeType: 'application/json',
    }, 15000);

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ ...fallback, ...parsed });
  } catch (error: any) {
    console.warn('Crop diagnosis fallback activated:', error.message);
    return res.json(fallback);
  }
});

// 2. Supply-Demand & Price Prediction Endpoint
app.post('/api/ai/predict-demand', async (req, res) => {
  const { cropName = 'Tomato', quantityKg = 500, targetHarvestDate = 'in 10 days', district = 'Bogura', language = 'bn' } = req.body;

  const fallback = {
    cropName,
    district,
    expectedPriceRangeBDT: {
      min: 36,
      max: 46,
      recommendedWholesale: 41,
      retailExpected: 54,
    },
    marketTrend: 'Bullish (Demand exceeding local supply by 15%)',
    demandLevel: 'High' as const,
    boguraAratArrivalEstimate: 'Medium (approx. 45-60 metric tons daily next week)',
    buyerRecommendation: language === 'bn'
      ? `আগামী ১০ দিনে বগুড়া ও ঢাকা কারওয়ান বাজারের চাহিদা চাঙ্গা থাকবে। ফসল তোলার ৩ দিন আগে পাইকারদের সাথে দর পাকা করার পরামর্শ দেওয়া হচ্ছে।`
      : `High procurement demand anticipated across Bogura Wholesale Arat & Dhaka corridors. Recommended to pre-contract 3-5 days prior.`,
    keyRiskFactor: language === 'bn'
      ? 'বৃষ্টিপাতের সম্ভাবনা রয়েছে, ফসল দ্রুত শুকিয়ে গ্রেডিং নিশ্চিত করুন।'
      : 'Intermittent rainfall forecasted; ensure post-harvest curing and proper crate packing.',
    suggestedAction: 'List on Amar Haat forward-contracts for guaranteed ৳41/kg rate',
  };

  if (!ai) {
    return res.json(fallback);
  }

  try {
    const prompt = `Agricultural economist for Bogura Bangladesh. Predict market rate for:
Crop: ${cropName}, Qty: ${quantityKg} kg, Harvest in: ${targetHarvestDate}, District: ${district}
Return JSON:
{
  "cropName": "${cropName}",
  "district": "${district}",
  "expectedPriceRangeBDT": { "min": 35, "max": 48, "recommendedWholesale": 42, "retailExpected": 56 },
  "marketTrend": "short trend string",
  "demandLevel": "High",
  "boguraAratArrivalEstimate": "estimate string",
  "buyerRecommendation": "recommendation in ${language === 'bn' ? 'Bengali' : 'English'}",
  "keyRiskFactor": "short risk note",
  "suggestedAction": "action note"
}`;

    const response = await callGemini(prompt, {
      responseMimeType: 'application/json',
    }, 15000);

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ ...fallback, ...parsed });
  } catch (error: any) {
    console.warn('Market prediction fallback activated:', error.message);
    return res.json(fallback);
  }
});

// 3. Current User Profile
app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    let userRow: any = null;
    try {
      const q = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [authUser.id]);
      if (q.rows.length > 0) userRow = q.rows[0];
    } catch (e) {
      console.warn('[Neon] error fetching user in /api/auth/me:', e);
    }
    if (!userRow) {
      userRow = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(authUser.id) as any;
    }
    if (!userRow && authUser.role === 'admin') {
      return res.json({
        success: true,
        user: {
          id: authUser.id,
          role: 'admin',
          name: authUser.name || 'Central Platform Administrator',
          phone: authUser.phone || '01700000000',
          email: authUser.email || 'admin@nativebazar.gov.bd',
          district: 'Bogura',
          upazila: 'Bogura Sadar',
          verified: true
        }
      });
    }
    if (!userRow) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let primaryCropsParsed: any = undefined;
    try {
      if (userRow.primary_crops) {
        primaryCropsParsed = typeof userRow.primary_crops === 'string' ? JSON.parse(userRow.primary_crops) : userRow.primary_crops;
      }
    } catch {}

    const safeUser = {
      id: userRow.id,
      role: userRow.role,
      name: userRow.name,
      nameBn: userRow.name_bn || userRow.nameBn,
      phone: userRow.phone,
      email: userRow.email,
      district: userRow.district,
      upazila: userRow.upazila,
      verified: Boolean(userRow.verified),
      farmSizeAcres: userRow.farm_size_acres || userRow.farmSizeAcres,
      primaryCrops: primaryCropsParsed,
      businessName: userRow.business_name || userRow.businessName,
      businessType: userRow.business_type || userRow.businessType,
      shopName: userRow.shop_name || userRow.shopName,
      licenseNumber: userRow.license_number || userRow.licenseNumber,
      createdAt: userRow.created_at || userRow.createdAt,
      lastLoginAt: userRow.last_login_at || userRow.lastLoginAt,
    };

    return res.json({ success: true, user: safeUser });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update Profile
app.put('/api/users/profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  const authUser = req.user!;
  const targetId = authUser.role === 'admin' ? (req.body.id || authUser.id) : authUser.id;
  if (!targetId) return res.status(400).json({ success: false, error: 'User id is required' });

  const { name, nameBn, district, upazila, farmSizeAcres, primaryCrops, shopName, licenseNumber } = req.body;

  // Update in Neon PostgreSQL
  try {
    await pool.query(`
      UPDATE users SET
        name = COALESCE($1, name),
        name_bn = COALESCE($2, name_bn),
        district = COALESCE($3, district),
        upazila = COALESCE($4, upazila),
        farm_size_acres = COALESCE($5, farm_size_acres),
        primary_crops = COALESCE($6, primary_crops),
        shop_name = COALESCE($7, shop_name),
        license_number = COALESCE($8, license_number)
      WHERE id = $9
    `, [
      name ?? null,
      nameBn ?? null,
      district ?? null,
      upazila ?? null,
      farmSizeAcres !== undefined ? Number(farmSizeAcres) : null,
      primaryCrops ? (Array.isArray(primaryCrops) ? JSON.stringify(primaryCrops) : primaryCrops) : null,
      shopName ?? null,
      licenseNumber ?? null,
      targetId,
    ]);
  } catch (neonErr) {
    console.warn('[Neon] error updating profile:', neonErr);
  }

  // Update in SQLite if exists there
  try {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
    if (existing) {
      db.prepare(`
        UPDATE users SET
          name = COALESCE(?, name),
          name_bn = COALESCE(?, name_bn),
          district = COALESCE(?, district),
          upazila = COALESCE(?, upazila),
          farm_size_acres = COALESCE(?, farm_size_acres),
          primary_crops = COALESCE(?, primary_crops),
          shop_name = COALESCE(?, shop_name),
          license_number = COALESCE(?, license_number)
        WHERE id = ?
      `).run(
        name ?? null,
        nameBn ?? null,
        district ?? null,
        upazila ?? null,
        farmSizeAcres ?? null,
        primaryCrops ? JSON.stringify(primaryCrops) : null,
        shopName ?? null,
        licenseNumber ?? null,
        targetId
      );
    }
  } catch {
    // continue to jsonDb
  }

  const updated = jsonDb.updateUser(targetId, {
    name,
    nameBn,
    district,
    upazila,
    farmSizeAcres,
    primaryCrops,
    shopName,
    licenseNumber,
  });

  const finalUser = updated || (db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any);
  if (!finalUser) return res.status(404).json({ success: false, error: 'User not found' });
  const { passwordHash: _, password_hash: __, ...safeUser } = finalUser;
  return res.json({ success: true, user: safeUser });
});

// ─── USER DIRECTORY REST API (NEON POSTGRESQL AUTHORITATIVE) ────────────────
// Returns all eligible users for the cross-role communication directory.
// Authoritatively queries Neon Cloud PostgreSQL in production.
// Strips sensitive fields (passwordHash, sessionToken, securityPin, etc.) before sending.
app.get('/api/users', async (req, res) => {
  try {
    const { excludeId, viewerRole, role, district, search } = req.query;

    let neonUsers: any[] = [];
    try {
      const neonRes = await pool.query(`
        SELECT id, role, name, name_bn AS "nameBn", phone, email, district, upazila, verified,
               farm_size_acres AS "farmSizeAcres", primary_crops AS "primaryCrops",
               business_name AS "businessName", business_type AS "businessType",
               shop_name AS "shopName", license_number AS "licenseNumber",
               trade_address AS "tradeAddress", delivery_address AS "deliveryAddress",
               created_at AS "createdAt"
        FROM users
        ORDER BY created_at DESC
      `);

      neonUsers = neonRes.rows.map((u: any) => ({
        ...u,
        primaryCrops: u.primaryCrops
          ? (typeof u.primaryCrops === 'string' ? JSON.parse(u.primaryCrops) : u.primaryCrops)
          : undefined,
        verified: Boolean(u.verified),
      }));
    } catch (neonErr: any) {
      console.warn('[Directory] Notice: querying Neon users failed, falling back to local store:', neonErr.message);
    }

    const userMap = new Map<string, any>();

    // 1. Seed fallback local users if in dev/offline
    try {
      const jsonUsers = jsonDb.getUsers();
      jsonUsers.forEach((u: any) => userMap.set(u.id, u));
      const sqliteRows = db.prepare('SELECT id, role, name, name_bn as nameBn, phone, email, district, upazila, verified, farm_size_acres as farmSizeAcres, primary_crops as primaryCrops, business_name as businessName, business_type as businessType, shop_name as shopName, license_number as licenseNumber FROM users').all() as any[];
      sqliteRows.forEach((u: any) => {
        const primaryCrops = u.primaryCrops ? (typeof u.primaryCrops === 'string' ? JSON.parse(u.primaryCrops) : u.primaryCrops) : undefined;
        userMap.set(u.id, { ...userMap.get(u.id), ...u, primaryCrops });
      });
    } catch {}

    // 2. Authoritative Neon users take absolute precedence
    neonUsers.forEach((u: any) => userMap.set(u.id, { ...userMap.get(u.id), ...u }));

    const dummyIds = new Set([
      'f-1', 'f-2', 'b-1', 'b-2', 's-1', 'c-1', 'a-1', 'e-1', 'e-2', 'e-3', 'e-4',
      'admin-root',
      'guest-consumer',
      'guest-user',
      'user-farmer-rafiq',
      'user-wholesaler-sumaiya',
      'user-supplier-meghna',
      'user-expert-akram',
      'user-consumer-tanveer',
      'far-shibganj-1',
      'far-sherpur-1',
      'w-karwan-syndicate',
      'w-bogura-arat',
      'ret-bismillah-mart',
      'ret-green-bazar',
    ]);
    const dummyPhones = new Set([
      '01700000000', '01700000001', '01999887766', '01712458920', '01711209934',
      '01715889900', '01711000001', '01711889922'
    ]);
    const dummyEmails = new Set([
      'dummy.fake@nativebazar.com',
      'admin@nativebazar.com',
      'guest@nativebazar.com',
      'rafiqul.farmer@nativebazar.com',
      'i.sumayyaislam@gmail.com',
      'meghna.depot@nativebazar.com',
      'dr.akram@bari.gov.bd',
      'tanveer.consumer@gmail.com',
    ]);

    let users = Array.from(userMap.values()).filter((u: any) => {
      // Never expose admin accounts in directory
      if (u.role === 'admin') return false;
      // Filter out all demo / dummy users
      if (dummyIds.has(u.id)) return false;
      if (u.phone && dummyPhones.has(String(u.phone).replace(/\D/g, ''))) return false;
      if (u.email && dummyEmails.has(String(u.email).toLowerCase())) return false;
      if (u.isDemo || u.isMock || u.isDummy) return false;
      // Exclude the requesting user themselves
      if (excludeId && u.id === String(excludeId)) return false;
      return true;
    });

    // Enforce role-based directory visibility based on viewerRole
    if (viewerRole === 'farmer') {
      users = users.filter((u: any) => u.role === 'farmer' || u.role === 'wholesaler');
    } else if (viewerRole === 'wholesaler') {
      users = users.filter((u: any) => u.role === 'farmer' || u.role === 'wholesaler' || u.role === 'retailer');
    } else if (viewerRole === 'retailer') {
      users = users.filter((u: any) => u.role === 'wholesaler' || u.role === 'retailer' || u.role === 'consumer');
    } else if (viewerRole === 'consumer') {
      // Consumers only see retailers and consumers (farmers & wholesalers strictly hidden)
      users = users.filter((u: any) => u.role === 'retailer' || u.role === 'consumer');
    }

    // Role filter
    if (role && role !== 'all') {
      users = users.filter((u: any) => u.role === String(role));
    }

    // District filter
    if (district && district !== 'all') {
      users = users.filter(
        (u: any) => u.district && u.district.toLowerCase() === String(district).toLowerCase()
      );
    }

    // Text search (name, nameBn, phone, businessName, shopName, designation, primaryCrops)
    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim();
      users = users.filter((u: any) => {
        if (u.name && u.name.toLowerCase().includes(q)) return true;
        if (u.nameBn && String(u.nameBn).includes(q)) return true;
        if (u.phone && String(u.phone).includes(q)) return true;
        if (u.district && u.district.toLowerCase().includes(q)) return true;
        if (u.businessName && u.businessName.toLowerCase().includes(q)) return true;
        if (u.shopName && u.shopName.toLowerCase().includes(q)) return true;
        if (u.designation && u.designation.toLowerCase().includes(q)) return true;
        if (Array.isArray(u.primaryCrops)) {
          if (u.primaryCrops.some((c: string) => c.toLowerCase().includes(q))) return true;
        }
        return false;
      });
    }

    // Strictly strip sensitive and private authentication fields
    const safeUsers = users.map((u: any) => {
      const {
        passwordHash: _1,
        password_hash: _2,
        password_algo: _3,
        sessionToken: _4,
        securityPin: _5,
        security_pin: _6,
        two_factor_enabled: _7,
        twoFactorEnabled: _8,
        ...safe
      } = u;
      return {
        ...safe,
        phone: safe.phone ? `****${String(safe.phone).slice(-4)}` : '',
      };
    });

    res.json({ success: true, users: safeUsers, total: safeUsers.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── NEON CROPS REST APIS (VIEW & PRODUCTS UNIFIED) ─────────────────────────
app.get('/api/crops', async (req, res) => {
  try {
    const { farmerId, district } = req.query;
    let query = 'SELECT * FROM crops WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (farmerId) {
      query += ` AND "farmerId" = $${idx++}`;
      params.push(String(farmerId));
    }
    if (district && district !== 'All') {
      query += ` AND district = $${idx++}`;
      params.push(String(district));
    }

    query += ' ORDER BY "createdAt" DESC';
    const result = await pool.query(query, params);
    res.json({ success: true, crops: result.rows });
  } catch (err: any) {
    console.error('Error fetching Neon crops view:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/crops', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'farmer' && authUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only farmers and administrators can list crops.',
      });
    }

    const {
      farmerId: bodyFarmerId, farmerName: bodyFarmerName, farmerPhone: bodyFarmerPhone,
      district = 'Bogura', upazila = 'Shibganj', cropName, cropBangla, variety = 'Standard',
      quantityKg, availableDate = 'Ready to Harvest', expectedPricePerKg, marketBenchmarkPrice,
      imageUrl = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
      qualityGrade = 'A', organicCertified = false,
    } = req.body;

    const farmerId = authUser.role === 'admin' ? (bodyFarmerId || authUser.id) : authUser.id;
    const farmerName = authUser.role === 'admin' ? (bodyFarmerName || authUser.name) : authUser.name;
    const farmerPhone = authUser.role === 'admin' ? (bodyFarmerPhone || authUser.phone || '') : (authUser.phone || bodyFarmerPhone || '');

    if (!farmerId || !farmerName || !cropName || !quantityKg || !expectedPricePerKg) {
      return res.status(400).json({
        success: false,
        error: 'Missing required crop fields: farmerId, farmerName, cropName, quantityKg, expectedPricePerKg',
      });
    }

    const prodId = `crop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const finalMarketPrice = marketBenchmarkPrice ? Number(marketBenchmarkPrice) : Number(expectedPricePerKg) * 1.15;

    await pool.query(`
      INSERT INTO products (
        id, seller_id, seller_name, seller_phone, seller_role, target_role,
        crop_name, bangla_name, category, variety, unit, quantity, available_qty,
        min_order_qty, unit_price, market_price, quality_grade, district,
        upazila, harvest_status, available_date, organic_certified, image_url,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'farmer', 'wholesaler',
        $5, $6, 'Vegetables', $7, 'kg', $8, $8,
        1, $9, $10, $11, $12,
        $13, 'Ready to Harvest', $14, $15, $16,
        NOW(), NOW()
      )
    `, [
      prodId, farmerId, farmerName, farmerPhone,
      cropName, cropBangla || cropName, variety, Number(quantityKg),
      Number(expectedPricePerKg), finalMarketPrice, qualityGrade, district,
      upazila, availableDate, Boolean(organicCertified), imageUrl
    ]);

    const newCrop = {
      id: prodId,
      farmerId,
      farmerName,
      farmerPhone,
      district,
      upazila,
      cropName,
      cropBangla: cropBangla || cropName,
      variety,
      quantityKg: Number(quantityKg),
      availableKg: Number(quantityKg),
      availableDate,
      expectedPricePerKg: Number(expectedPricePerKg),
      marketBenchmarkPrice: finalMarketPrice,
      status: 'Ready to Harvest',
      imageUrl,
      qualityGrade,
      organicCertified: Boolean(organicCertified),
      createdAt: new Date().toISOString()
    };

    return res.status(201).json({ success: true, crop: newCrop });
  } catch (err: any) {
    console.error('Error creating crop in Neon:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/crops/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const existingRes = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (existingRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Crop listing not found' });
    const existing = existingRes.rows[0];

    if (existing.seller_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot modify another farmer\'s crops.' });
    }

    const { expectedPricePerKg, quantityKg, availableKg, qualityGrade, status, availableDate, imageUrl } = req.body;

    await pool.query(`
      UPDATE products
      SET unit_price = COALESCE($1, unit_price),
          quantity = COALESCE($2, quantity),
          available_qty = COALESCE($3, available_qty),
          quality_grade = COALESCE($4, quality_grade),
          harvest_status = COALESCE($5, harvest_status),
          available_date = COALESCE($6, available_date),
          image_url = COALESCE($7, image_url),
          updated_at = NOW()
      WHERE id = $8
    `, [
      expectedPricePerKg !== undefined ? Number(expectedPricePerKg) : null,
      quantityKg !== undefined ? Number(quantityKg) : null,
      availableKg !== undefined ? Number(availableKg) : null,
      qualityGrade || null, status || null, availableDate || null, imageUrl || null, req.params.id
    ]);

    const updatedCropRes = await pool.query('SELECT * FROM crops WHERE id = $1', [req.params.id]);
    return res.json({ success: true, crop: updatedCropRes.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/crops/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const existingRes = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (existingRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Crop listing not found' });
    const existing = existingRes.rows[0];

    if (existing.seller_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot delete another farmer\'s crops.' });
    }

    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Crop listing deleted' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SUPPLIER PRODUCTS REST APIS (NEON POSTGRESQL AUTHORITATIVE) ─────────────

function formatSupplierProductRow(r: any) {
  let suitableCrops: string[] = ['All crops'];
  try {
    if (r.suitable_crops) {
      suitableCrops = typeof r.suitable_crops === 'string' ? JSON.parse(r.suitable_crops) : r.suitable_crops;
    }
  } catch {}

  return {
    id: r.id,
    supplierId: r.supplier_id || r.supplierId || undefined,
    supplierName: r.supplier_name || r.supplierName || 'Certified Organic Depot',
    shopName: r.shop_name || r.shopName || 'অর্গানিক বায়ো এগ্রো বিতান',
    category: r.category,
    name: r.name,
    banglaName: r.bangla_name || r.banglaName || r.name,
    brand: r.brand || 'Organic Bio-Agro',
    unitPriceBDT: parseFloat(r.unit_price_bdt !== undefined ? r.unit_price_bdt : r.unitPriceBDT) || 0,
    unit: r.unit || 'kg',
    inStock: r.in_stock !== undefined ? Boolean(r.in_stock) : (r.inStock !== undefined ? Boolean(r.inStock) : true),
    distanceKm: parseFloat(r.delivery_radius_km !== undefined ? r.delivery_radius_km : r.deliveryRadiusKm) || 10,
    rating: 4.8,
    phone: r.phone || '',
    suitableCrops,
    stockQty: parseFloat(r.stock_qty !== undefined ? r.stock_qty : r.stockQty) || 100,
    description: r.description || '',
    organicCertified: Boolean(r.organic_certified !== undefined ? r.organic_certified : r.organicCertified),
    certificationNumber: r.certification_number || r.certificationNumber || undefined,
    deliveryRadiusKm: parseFloat(r.delivery_radius_km !== undefined ? r.delivery_radius_km : r.deliveryRadiusKm) || 10,
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt,
  };
}

app.get('/api/supplier-products', async (req, res) => {
  const { supplierId, category, organicOnly } = req.query;

  try {
    let query = 'SELECT * FROM supplier_products WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (supplierId) {
      query += ` AND supplier_id = $${idx++}`;
      params.push(String(supplierId));
    }
    if (category && category !== 'All' && category !== 'all') {
      query += ` AND category = $${idx++}`;
      params.push(String(category));
    }
    if (organicOnly === 'true') {
      query += ' AND organic_certified = true';
    }
    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    const products = result.rows.map(formatSupplierProductRow);
    return res.json({ success: true, products });
  } catch (neonErr: any) {
    // Graceful fallback to local JSON DB during dev / offline
    console.warn('[Supplier] Notice: Neon query failed, falling back to local store:', neonErr.message);
    const products = jsonDb.getSupplierProducts({
      supplierId: supplierId ? String(supplierId) : undefined,
      category: category ? String(category) : undefined,
      organicOnly: organicOnly === 'true',
    });
    return res.json({ success: true, products });
  }
});

app.post('/api/supplier-products', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'supplier' && authUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only suppliers and administrators can add supplier products.',
      });
    }

    const {
      shopName,
      category = 'Organic',
      name,
      banglaName,
      brand = 'Organic Bio-Agro',
      unitPriceBDT,
      unit = 'kg',
      stockQty = 100,
      phone,
      suitableCrops = ['All crops'],
      description = '',
      organicCertified = true,
      certificationNumber,
      deliveryRadiusKm = 10,
    } = req.body;

    const supplierId = authUser.role === 'admin' ? (req.body.supplierId || authUser.id) : authUser.id;
    const supplierName = authUser.role === 'admin' ? (req.body.supplierName || authUser.name) : authUser.name;
    const contactPhone = authUser.phone || phone || '';

    if (!supplierId || !name || !unitPriceBDT) {
      return res.status(400).json({
        success: false,
        error: 'Missing required supplier product fields',
      });
    }

    const prodId = `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const suitableCropsJson = JSON.stringify(Array.isArray(suitableCrops) ? suitableCrops : [suitableCrops]);

    try {
      const ins = await pool.query(`
        INSERT INTO supplier_products (
          id, supplier_id, supplier_name, shop_name, category, name, bangla_name,
          brand, unit_price_bdt, unit, in_stock, stock_qty, phone, suitable_crops,
          description, organic_certified, certification_number, delivery_radius_km,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, true, $11, $12, $13,
          $14, $15, $16, $17,
          NOW(), NOW()
        ) RETURNING *
      `, [
        prodId,
        supplierId,
        supplierName || 'Certified Organic Depot',
        shopName || 'অর্গানিক বায়ো এগ্রো বিতান',
        category,
        name,
        banglaName || name,
        brand,
        Number(unitPriceBDT),
        unit,
        Number(stockQty),
        contactPhone,
        suitableCropsJson,
        description,
        Boolean(organicCertified),
        certificationNumber || null,
        Number(deliveryRadiusKm),
      ]);

      // Mirror to jsonDb for local continuity
      try {
        jsonDb.addSupplierProduct({
          id: prodId,
          supplierId,
          supplierName: supplierName || 'Certified Organic Depot',
          shopName: shopName || 'অর্গানিক বায়ো এগ্রো বিতান',
          category,
          name,
          banglaName: banglaName || name,
          brand,
          unitPriceBDT: Number(unitPriceBDT),
          unit,
          inStock: true,
          stockQty: Number(stockQty),
          phone: contactPhone,
          suitableCrops: Array.isArray(suitableCrops) ? suitableCrops : [suitableCrops],
          description,
          organicCertified: !!organicCertified,
          certificationNumber,
          deliveryRadiusKm: Number(deliveryRadiusKm),
          createdAt: new Date().toISOString(),
        });
      } catch {}

      return res.status(201).json({ success: true, product: formatSupplierProductRow(ins.rows[0]) });
    } catch (neonErr: any) {
      console.warn('[Supplier] Notice: Neon insert failed, falling back to local JSON store:', neonErr.message);
      const created = jsonDb.addSupplierProduct({
        id: prodId,
        supplierId,
        supplierName: supplierName || 'Certified Organic Depot',
        shopName: shopName || 'অর্গানিক বায়ো এগ্রো বিতান',
        category,
        name,
        banglaName: banglaName || name,
        brand,
        unitPriceBDT: Number(unitPriceBDT),
        unit,
        inStock: true,
        stockQty: Number(stockQty),
        phone: contactPhone,
        suitableCrops: Array.isArray(suitableCrops) ? suitableCrops : [suitableCrops],
        description,
        organicCertified: !!organicCertified,
        certificationNumber,
        deliveryRadiusKm: Number(deliveryRadiusKm),
        createdAt: new Date().toISOString(),
      });
      return res.status(201).json({ success: true, product: created });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/supplier-products/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { id } = req.params;

    let existing: any = null;
    try {
      const existingRes = await pool.query('SELECT * FROM supplier_products WHERE id = $1', [id]);
      if (existingRes.rows.length > 0) existing = existingRes.rows[0];
    } catch {}

    if (!existing) {
      existing = jsonDb.getSupplierProductById(id);
    }
    if (!existing) return res.status(404).json({ success: false, error: 'Product not found' });

    const existingSupplierId = existing.supplier_id || existing.supplierId;
    if (existingSupplierId !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot modify another supplier\'s product.' });
    }

    const {
      name, banglaName, category, brand, unitPriceBDT, unit, stockQty,
      phone, description, organicCertified, inStock, certificationNumber, deliveryRadiusKm
    } = req.body;

    try {
      const upd = await pool.query(`
        UPDATE supplier_products
        SET name = COALESCE($1, name),
            bangla_name = COALESCE($2, bangla_name),
            category = COALESCE($3, category),
            brand = COALESCE($4, brand),
            unit_price_bdt = COALESCE($5, unit_price_bdt),
            unit = COALESCE($6, unit),
            stock_qty = COALESCE($7, stock_qty),
            phone = COALESCE($8, phone),
            description = COALESCE($9, description),
            organic_certified = COALESCE($10, organic_certified),
            in_stock = COALESCE($11, in_stock),
            certification_number = COALESCE($12, certification_number),
            delivery_radius_km = COALESCE($13, delivery_radius_km),
            updated_at = NOW()
        WHERE id = $14
        RETURNING *
      `, [
        name || null,
        banglaName || null,
        category || null,
        brand || null,
        unitPriceBDT !== undefined ? Number(unitPriceBDT) : null,
        unit || null,
        stockQty !== undefined ? Number(stockQty) : null,
        phone || null,
        description || null,
        organicCertified !== undefined ? Boolean(organicCertified) : null,
        inStock !== undefined ? Boolean(inStock) : null,
        certificationNumber || null,
        deliveryRadiusKm !== undefined ? Number(deliveryRadiusKm) : null,
        id
      ]);

      try { jsonDb.updateSupplierProduct(id, req.body); } catch {}
      return res.json({ success: true, product: formatSupplierProductRow(upd.rows[0]) });
    } catch (neonErr: any) {
      console.warn('[Supplier] Notice: Neon update failed, falling back to local JSON store:', neonErr.message);
      const updated = jsonDb.updateSupplierProduct(id, req.body);
      return res.json({ success: true, product: updated });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/supplier-products/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { id } = req.params;

    let existing: any = null;
    try {
      const existingRes = await pool.query('SELECT * FROM supplier_products WHERE id = $1', [id]);
      if (existingRes.rows.length > 0) existing = existingRes.rows[0];
    } catch {}

    if (!existing) existing = jsonDb.getSupplierProductById(id);
    if (!existing) return res.status(404).json({ success: false, error: 'Product not found' });

    const existingSupplierId = existing.supplier_id || existing.supplierId;
    if (existingSupplierId !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot delete another supplier\'s product.' });
    }

    try {
      await pool.query('DELETE FROM supplier_products WHERE id = $1', [id]);
    } catch {}
    try { jsonDb.deleteSupplierProduct(id); } catch {}
    return res.json({ success: true, message: 'Supplier product deleted' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── NEON ORDERS & ORDER TRACKING REST APIS ─────────────────────────────────
app.get('/api/legacy/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (authUser.role === 'admin') {
      const { customerId, sellerId } = req.query;
      if (customerId) {
        query += ` AND buyer_id = $${idx++}`;
        params.push(String(customerId));
      } else if (sellerId) {
        query += ` AND seller_id = $${idx++}`;
        params.push(String(sellerId));
      }
    } else {
      query += ` AND (buyer_id = $${idx} OR seller_id = $${idx})`;
      params.push(authUser.id);
      idx++;
    }

    query += ' ORDER BY created_at DESC';
    const orderRes = await pool.query(query, params);
    res.json({ success: true, orders: orderRes.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── REVIEWS REST APIS (NEON POSTGRESQL) ────────────────────────────────────

function formatReviewRow(r: any) {
  return {
    id: r.id,
    orderId: r.order_id,
    order_id: r.order_id,
    productId: r.product_id,
    product_id: r.product_id,
    userId: r.user_id,
    user_id: r.user_id,
    userName: r.user_name,
    user_name: r.user_name,
    rating: parseInt(r.rating, 10),
    comment: r.comment,
    verifiedPurchase: Boolean(r.verified_purchase),
    verified_purchase: Boolean(r.verified_purchase),
    createdAt: r.created_at,
    created_at: r.created_at,
  };
}

// Verified Buyer Review Submission (Allowed ONLY on Delivered Orders in Neon)
app.post('/api/orders/:id/review', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { rating, comment, productId } = req.body;
    const starRating = Number(rating);
    if (!starRating || starRating < 1 || starRating > 5) {
      return res.status(400).json({ success: false, error: 'Valid star rating between 1 and 5 is required' });
    }

    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    if (orderRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    const order = orderRes.rows[0];

    // Authorization: only the buyer or admin
    if (order.buyer_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only the customer who placed this order can submit a review.',
      });
    }

    // Verify delivery status
    if (order.delivery_status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        error: 'Reviews are reserved exclusively for verified buyers with completed deliveries.',
      });
    }

    // Duplicate check: prevent duplicate reviews for the same order
    const existingReviewRes = await pool.query('SELECT id FROM reviews WHERE order_id = $1', [req.params.id]);
    if (existingReviewRes.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Order has already been reviewed.' });
    }

    // Derive or find product_id from order_items if not provided
    let effectiveProductId = productId || null;
    if (!effectiveProductId) {
      const itemRes = await pool.query('SELECT product_id FROM order_items WHERE order_id = $1 LIMIT 1', [req.params.id]);
      if (itemRes.rows.length > 0) {
        effectiveProductId = itemRes.rows[0].product_id;
      }
    }

    const reviewId = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ins = await pool.query(`
      INSERT INTO reviews (
        id, order_id, product_id, user_id, user_name, rating, comment, verified_purchase, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, true, NOW()
      ) RETURNING *
    `, [
      reviewId,
      req.params.id,
      effectiveProductId,
      authUser.id,
      authUser.name,
      starRating,
      comment || ''
    ]);

    const formattedReview = formatReviewRow(ins.rows[0]);
    return res.status(201).json({
      success: true,
      review: formattedReview,
      message: 'Verified review submitted successfully'
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Get Reviews
app.get('/api/reviews', async (req, res) => {
  try {
    const { productId, orderId } = req.query;
    let query = 'SELECT * FROM reviews WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (productId) {
      query += ` AND product_id = $${idx++}`;
      params.push(String(productId));
    }
    if (orderId) {
      query += ` AND order_id = $${idx++}`;
      params.push(String(orderId));
    }

    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    const reviews = result.rows.map(formatReviewRow);
    return res.json({ success: true, reviews });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Submit Direct Product Review
app.post('/api/reviews', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { productId, rating, comment } = req.body;
    const starRating = Number(rating);

    if (!productId || !starRating || starRating < 1 || starRating > 5) {
      return res.status(400).json({ success: false, error: 'Product ID and rating between 1 and 5 are required.' });
    }

    const prodRes = await pool.query('SELECT id, seller_id FROM products WHERE id = $1', [productId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found.' });
    }

    // Check if user already reviewed this product
    const dupRes = await pool.query('SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2', [productId, authUser.id]);
    if (dupRes.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'You have already reviewed this product.' });
    }

    const reviewId = `rev-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ins = await pool.query(`
      INSERT INTO reviews (
        id, order_id, product_id, user_id, user_name, rating, comment, verified_purchase, created_at
      ) VALUES (
        $1, null, $2, $3, $4, $5, $6, false, NOW()
      ) RETURNING *
    `, [
      reviewId,
      productId,
      authUser.id,
      authUser.name,
      starRating,
      comment || ''
    ]);

    return res.status(201).json({ success: true, review: formatReviewRow(ins.rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete Review (Author or Admin)
app.delete('/api/reviews/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const revRes = await pool.query('SELECT * FROM reviews WHERE id = $1', [req.params.id]);
    if (revRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Review not found.' });
    }

    const rev = revRes.rows[0];
    if (rev.user_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot delete another user\'s review.' });
    }

    await pool.query('DELETE FROM reviews WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Review deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── REAL STATS REST API ────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({ success: true, stats: jsonDb.getStats() });
});

// ─── MASTER AGRICULTURAL CATALOG REST APIS (NEON POSTGRESQL) ──────────────────

function formatCatalogRow(r: any) {
  let kw: string[] = [];
  try {
    if (Array.isArray(r.keywords)) kw = r.keywords;
    else if (typeof r.keywords === 'string') kw = JSON.parse(r.keywords);
  } catch {
    kw = [];
  }

  return {
    id: r.id,
    name: r.name,
    nameBn: r.name_bn,
    name_bn: r.name_bn,
    category: r.category,
    categoryLabelEn: r.category_label_en,
    category_label_en: r.category_label_en,
    categoryLabelBn: r.category_label_bn,
    category_label_bn: r.category_label_bn,
    unit: r.unit || 'kg',
    unitBn: r.unit_bn || 'কেজি',
    unit_bn: r.unit_bn || 'কেজি',
    keywords: kw,
    imageUrl: r.image_url,
    image_url: r.image_url,
    damBenchmarkPrice: r.dam_benchmark_price !== null ? parseFloat(r.dam_benchmark_price) : null,
    dam_benchmark_price: r.dam_benchmark_price !== null ? parseFloat(r.dam_benchmark_price) : null,
    descriptionBn: r.description_bn,
    description_bn: r.description_bn,
    descriptionEn: r.description_en,
    description_en: r.description_en,
  };
}

app.get('/api/catalog', async (req, res) => {
  try {
    const { category, query, page = '1', limit = '24' } = req.query;
    let sql = 'SELECT * FROM catalog WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (category && category !== 'All' && category !== 'all') {
      sql += ` AND category = $${idx++}`;
      params.push(String(category));
    }
    if (query) {
      sql += ` AND (name ILIKE $${idx} OR name_bn ILIKE $${idx} OR description_en ILIKE $${idx} OR description_bn ILIKE $${idx})`;
      params.push(`%${query}%`);
      idx++;
    }

    sql += ' ORDER BY name ASC';
    const allResult = await pool.query(sql, params);
    const all = allResult.rows.map(formatCatalogRow);

    if (limit === 'all') {
      return res.json({ success: true, products: all, total: all.length, page: 1, totalPages: 1 });
    }

    const p = Math.max(1, parseInt(String(page), 10) || 1);
    const l = Math.max(1, parseInt(String(limit), 10) || 24);
    const total = all.length;
    const totalPages = Math.ceil(total / l) || 1;
    const start = (p - 1) * l;
    const paginated = all.slice(start, start + l);

    return res.json({
      success: true,
      products: paginated,
      total,
      page: p,
      totalPages,
      limit: l,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/catalog/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM catalog WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Catalog product not found' });
    }
    return res.json({ success: true, product: formatCatalogRow(result.rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: create catalog item
app.post('/api/catalog', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required to manage catalog.' });
    }

    const {
      name, nameBn, category, categoryLabelEn, categoryLabelBn,
      unit = 'kg', unitBn = 'কেজি', keywords = [], imageUrl,
      damBenchmarkPrice, descriptionBn, descriptionEn
    } = req.body;

    if (!name || !nameBn || !category) {
      return res.status(400).json({ success: false, error: 'Name, Bengali name, and category are required.' });
    }

    const id = req.body.id || `cat-custom-${Date.now()}`;
    const ins = await pool.query(`
      INSERT INTO catalog (
        id, name, name_bn, category, category_label_en, category_label_bn,
        unit, unit_bn, keywords, image_url, dam_benchmark_price, description_bn, description_en
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *
    `, [
      id, name, nameBn, category, categoryLabelEn || category, categoryLabelBn || category,
      unit, unitBn, JSON.stringify(keywords || []), imageUrl || null,
      damBenchmarkPrice !== undefined ? Number(damBenchmarkPrice) : null,
      descriptionBn || null, descriptionEn || null
    ]);

    return res.status(201).json({ success: true, product: formatCatalogRow(ins.rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: update catalog item
app.put('/api/catalog/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required to manage catalog.' });
    }

    const {
      name, nameBn, category, categoryLabelEn, categoryLabelBn,
      unit, unitBn, keywords, imageUrl, damBenchmarkPrice, descriptionBn, descriptionEn
    } = req.body;

    const upd = await pool.query(`
      UPDATE catalog
      SET name = COALESCE($1, name),
          name_bn = COALESCE($2, name_bn),
          category = COALESCE($3, category),
          category_label_en = COALESCE($4, category_label_en),
          category_label_bn = COALESCE($5, category_label_bn),
          unit = COALESCE($6, unit),
          unit_bn = COALESCE($7, unit_bn),
          keywords = CASE WHEN $8::jsonb IS NOT NULL THEN $8::jsonb ELSE keywords END,
          image_url = COALESCE($9, image_url),
          dam_benchmark_price = COALESCE($10, dam_benchmark_price),
          description_bn = COALESCE($11, description_bn),
          description_en = COALESCE($12, description_en)
      WHERE id = $13
      RETURNING *
    `, [
      name || null,
      nameBn || null,
      category || null,
      categoryLabelEn || null,
      categoryLabelBn || null,
      unit || null,
      unitBn || null,
      keywords ? JSON.stringify(keywords) : null,
      imageUrl || null,
      damBenchmarkPrice !== undefined ? Number(damBenchmarkPrice) : null,
      descriptionBn || null,
      descriptionEn || null,
      req.params.id
    ]);

    if (upd.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Catalog product not found.' });
    }
    return res.json({ success: true, product: formatCatalogRow(upd.rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Admin-only: delete catalog item
app.delete('/api/catalog/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required.' });
    }
    const del = await pool.query('DELETE FROM catalog WHERE id = $1 RETURNING id', [req.params.id]);
    if (del.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Catalog product not found.' });
    }
    return res.json({ success: true, message: 'Catalog item deleted.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── REAL-TIME SSE (SERVER-SENT EVENTS) ENGINE ──────────────────────────────
const sseClients = new Map<string, Set<express.Response>>();

export function sendSSE(userId: string, event: string, data: any) {
  const clients = sseClients.get(userId);
  if (clients && clients.size > 0) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach((clientRes) => {
      try {
        clientRes.write(payload);
        if (typeof (clientRes as any).flush === 'function') {
          (clientRes as any).flush();
        }
      } catch {
        // ignore closed socket errors
      }
    });
  }
}

app.get('/api/realtime', async (req: express.Request, res: express.Response) => {
  // Resolve authenticated user via token (cookie, Bearer, or query token) with query userId fallback
  let userId: string | null = null;
  const rawToken = extractToken(req);
  if (rawToken) {
    const session = await validateToken(rawToken);
    if (session) {
      const requested = req.query.userId as string;
      userId = (session.user.role === 'admin' && requested) ? requested : session.user.id;
    }
  }

  if (!userId && req.query.userId && typeof req.query.userId === 'string') {
    userId = req.query.userId.trim();
  }

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Authentication required for realtime stream' });
  }

  // Render & Reverse Proxy SSE headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disables Nginx/Render response buffering
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.flushHeaders?.();

  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId)!.add(res);

  // Send initial connected event and flush immediately
  res.write(`event: connected\ndata: ${JSON.stringify({ userId, connectedAt: new Date().toISOString() })}\n\n`);
  if (typeof (res as any).flush === 'function') {
    (res as any).flush();
  }

  // 15s keepalive ping prevents Render's reverse proxy from dropping idle connection
  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    } catch {
      clearInterval(keepAlive);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const clients = sseClients.get(userId!);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(userId!);
      }
    }
  });
});

// ─── NEON NOTIFICATIONS HELPER ──────────────────────────────────────────────
async function createNeonNotification(
  userId: string,
  title: string,
  message: string,
  type: string = 'info',
  actionUrl?: string
) {
  const notifId = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date();
  // Strictly persist notification to Neon PostgreSQL
  await pool.query(
    `INSERT INTO notifications (id, user_id, title, message, type, action_url, read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, $7)`,
    [notifId, userId, title, message, type, actionUrl || null, now]
  );

  const formatted = {
    id: notifId,
    userId,
    user_id: userId,
    title,
    message,
    type,
    actionUrl: actionUrl || null,
    action_url: actionUrl || null,
    read: false,
    createdAt: now.toISOString(),
    created_at: now.toISOString(),
  };
  try {
    sendSSE(userId, 'new_notification', { notification: formatted });
  } catch (sseErr) {
    console.warn('[SSE] Send notification error:', sseErr);
  }
  return formatted;
}

function formatMessageRow(r: any) {
  return {
    id: r.id,
    senderId: r.sender_id,
    sender_id: r.sender_id,
    senderName: r.sender_name,
    sender_name: r.sender_name,
    senderRole: r.sender_role,
    sender_role: r.sender_role,
    recipientId: r.recipient_id,
    recipient_id: r.recipient_id,
    recipientName: r.recipient_name,
    recipient_name: r.recipient_name,
    recipientRole: r.recipient_role,
    recipient_role: r.recipient_role,
    content: r.content,
    read: Boolean(r.read),
    replyToId: r.reply_to_id,
    reply_to_id: r.reply_to_id,
    messageType: r.message_type || 'text',
    message_type: r.message_type || 'text',
    createdAt: r.created_at,
    created_at: r.created_at,
  };
}

function formatConnectionRow(r: any) {
  return {
    id: r.id,
    requesterId: r.requester_id,
    requester_id: r.requester_id,
    requesterName: r.requester_name,
    requester_name: r.requester_name,
    requesterRole: r.requester_role,
    requester_role: r.requester_role,
    requesterPhone: r.requester_phone,
    requester_phone: r.requester_phone,
    requesterDistrict: r.requester_district,
    requester_district: r.requester_district,
    recipientId: r.recipient_id,
    recipient_id: r.recipient_id,
    recipientName: r.recipient_name,
    recipient_name: r.recipient_name,
    recipientRole: r.recipient_role,
    recipient_role: r.recipient_role,
    recipientPhone: r.recipient_phone,
    recipient_phone: r.recipient_phone,
    recipientDistrict: r.recipient_district,
    recipient_district: r.recipient_district,
    status: r.status,
    createdAt: r.created_at,
    created_at: r.created_at,
    updatedAt: r.updated_at,
    updated_at: r.updated_at,
  };
}

function formatNotificationRow(r: any) {
  return {
    id: r.id,
    userId: r.user_id,
    user_id: r.user_id,
    title: r.title,
    message: r.message,
    type: r.type || 'info',
    actionUrl: r.action_url,
    action_url: r.action_url,
    read: Boolean(r.read),
    createdAt: r.created_at,
    created_at: r.created_at,
  };
}

// ─── DIRECT MESSAGING REST APIS (NEON POSTGRESQL) ───────────────────────────
app.get('/api/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { userA, userB } = req.query;
    if (!userA || !userB) {
      return res.status(400).json({ success: false, error: 'userA and userB are required' });
    }
    const uA = String(userA);
    const uB = String(userB);

    // Strict privacy boundary: non-admins cannot inspect other conversations
    if (authUser.role !== 'admin' && authUser.id !== uA && authUser.id !== uB) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot view messages between other users.' });
    }

    // STRICT NEON POSTGRESQL QUERY
    const result = await pool.query(`
      SELECT * FROM messages
      WHERE (sender_id = $1 AND recipient_id = $2)
         OR (sender_id = $2 AND recipient_id = $1)
      ORDER BY created_at ASC
    `, [uA, uB]);

    const messages = result.rows.map(formatMessageRow);
    return res.json({ success: true, messages });
  } catch (err: any) {
    console.error('[Messages] Neon DB error in GET /api/messages:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/messages', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { senderId, senderName, senderRole, recipientId, content, replyToId } = req.body;

    // Strict identity derivation: prevent forged sender ID
    const effectiveSenderId = authUser.role === 'admin' ? (senderId || authUser.id) : authUser.id;
    const effectiveSenderName = authUser.role === 'admin' ? (senderName || authUser.name) : authUser.name;
    const effectiveSenderRole = authUser.role === 'admin' ? (senderRole || authUser.role) : authUser.role;

    if (!recipientId || !content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Recipient and non-empty content are required.' });
    }

    // Verify recipient existence strictly in Neon
    let recipient: any = null;
    const recipRes = await pool.query('SELECT id, name, role FROM users WHERE id = $1', [recipientId]);
    if (recipRes.rows.length > 0) {
      recipient = recipRes.rows[0];
    } else {
      const fallbackUser = jsonDb.getUserById(recipientId);
      if (fallbackUser) {
        try {
          await pool.query(
            `INSERT INTO users (id, role, name, phone, password_hash, district, verified, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
             ON CONFLICT (id) DO NOTHING`,
            [fallbackUser.id, fallbackUser.role, fallbackUser.name, fallbackUser.phone || `017${Date.now().toString().slice(-8)}`, 'placeholder_pwd', fallbackUser.district || 'Bogura']
          );
          recipient = fallbackUser;
        } catch {}
      }
    }
    if (!recipient) {
      return res.status(404).json({ success: false, error: 'Recipient user not found.' });
    }

    const messageId = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // STRICT NEON INSERT
    const ins = await pool.query(`
      INSERT INTO messages (
        id, sender_id, sender_name, sender_role,
        recipient_id, recipient_name, recipient_role,
        content, read, reply_to_id, message_type, created_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, false, $9, 'text', NOW()
      ) RETURNING *
    `, [
      messageId,
      effectiveSenderId,
      effectiveSenderName,
      effectiveSenderRole,
      recipient.id,
      recipient.name,
      recipient.role,
      content.trim(),
      replyToId || null,
    ]);
    const formattedMessage = formatMessageRow(ins.rows[0]);

    // Durable notification strictly in Neon PostgreSQL
    let notif: any = null;
    try {
      notif = await createNeonNotification(
        recipient.id,
        `নতুন বার্তা: ${effectiveSenderName}`,
        content.trim().slice(0, 100),
        'message',
        `/contacts?tab=chat&userId=${effectiveSenderId}`
      );
    } catch (notifErr) {
      console.error('[Notifications] Error creating Neon notification:', notifErr);
    }

    // Real-time dispatch via SSE
    sendSSE(recipient.id, 'new_message', { message: formattedMessage });
    sendSSE(effectiveSenderId, 'message_sent', { message: formattedMessage });

    return res.status(201).json({ success: true, message: formattedMessage, notificationId: notif?.id });
  } catch (err: any) {
    console.error('[Messages] Error in POST /api/messages:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/messages/read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { recipientId, senderId } = req.body;
    if (!senderId) {
      return res.status(400).json({ success: false, error: 'senderId is required.' });
    }

    // Non-admins can only mark messages where they are the recipient
    const effectiveRecipientId = authUser.role === 'admin' ? (recipientId || authUser.id) : authUser.id;

    try {
      await pool.query(`
        UPDATE messages
        SET read = true
        WHERE recipient_id = $1 AND sender_id = $2 AND read = false
      `, [effectiveRecipientId, String(senderId)]);
    } catch (neonErr) {
      console.warn('[Messages] Neon read update fallback to jsonDb:', neonErr);
    }
    try {
      jsonDb.markMessagesRead(effectiveRecipientId, String(senderId));
    } catch {}

    sendSSE(String(senderId), 'messages_read', { recipientId: effectiveRecipientId, senderId });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CONNECTIONS REST APIS (NEON POSTGRESQL) ────────────────────────────────
app.get('/api/connections', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const targetUserId = authUser.role === 'admin' ? (req.query.userId ? String(req.query.userId) : authUser.id) : authUser.id;

    const result = await pool.query(`
      SELECT * FROM connections
      WHERE requester_id = $1 OR recipient_id = $1
      ORDER BY created_at DESC
    `, [targetUserId]);

    const connections = result.rows.map(formatConnectionRow);
    return res.json({ success: true, connections });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/connections', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { requesterId, recipientId } = req.body;

    const effectiveRequesterId = authUser.role === 'admin' ? (requesterId || authUser.id) : authUser.id;

    if (!recipientId) {
      return res.status(400).json({ success: false, error: 'recipientId is required.' });
    }

    // Prevent self-connection
    if (effectiveRequesterId === recipientId) {
      return res.status(400).json({ success: false, error: 'Cannot connect with yourself.' });
    }

    // Verify recipient in Neon users
    const recipRes = await pool.query('SELECT id, name, role, phone, district FROM users WHERE id = $1', [recipientId]);
    if (recipRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recipient user not found.' });
    }
    const recipient = recipRes.rows[0];

    // Verify requester in Neon users
    const reqRes = await pool.query('SELECT id, name, role, phone, district FROM users WHERE id = $1', [effectiveRequesterId]);
    const requester = reqRes.rows[0] || {
      id: effectiveRequesterId,
      name: authUser.name,
      role: authUser.role,
      phone: authUser.phone || null,
      district: authUser.district || 'Bogura',
    };

    // Duplicate check: check if pending or accepted connection exists
    const existingRes = await pool.query(`
      SELECT * FROM connections
      WHERE (requester_id = $1 AND recipient_id = $2)
         OR (requester_id = $2 AND recipient_id = $1)
    `, [effectiveRequesterId, recipientId]);

    if (existingRes.rows.length > 0) {
      const activeConn = existingRes.rows.find((c: any) => c.status === 'pending' || c.status === 'accepted');
      if (activeConn) {
        return res.status(400).json({
          success: false,
          error: `Connection already ${activeConn.status}.`,
          connection: formatConnectionRow(activeConn),
        });
      }
    }

    const connId = `conn-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ins = await pool.query(`
      INSERT INTO connections (
        id, requester_id, requester_name, requester_role, requester_phone, requester_district,
        recipient_id, recipient_name, recipient_role, recipient_phone, recipient_district,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        'pending', NOW(), NOW()
      ) RETURNING *
    `, [
      connId,
      requester.id,
      requester.name,
      requester.role,
      requester.phone || null,
      requester.district || null,
      recipient.id,
      recipient.name,
      recipient.role,
      recipient.phone || null,
      recipient.district || null,
    ]);

    const formattedConn = formatConnectionRow(ins.rows[0]);

    // Send persistent notification to recipient in Neon
    await createNeonNotification(
      recipient.id,
      'New Connection Request',
      `${requester.name} (${requester.role}) wants to connect with you.`,
      'connection',
      '/contacts?tab=connections'
    );

    sendSSE(recipient.id, 'new_connection', { connection: formattedConn });
    sendSSE(effectiveRequesterId, 'connection_requested', { connection: formattedConn });

    return res.status(201).json({ success: true, connection: formattedConn });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/connections/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { status } = req.body;
    if (status !== 'accepted' && status !== 'rejected') {
      return res.status(400).json({ success: false, error: 'Status must be accepted or rejected' });
    }

    const connRes = await pool.query('SELECT * FROM connections WHERE id = $1', [req.params.id]);
    if (connRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    const existing = connRes.rows[0];
    // Authorization: only the recipient (or admin) can accept or reject
    if (existing.recipient_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only the connection recipient can accept or reject this request.' });
    }

    const upd = await pool.query(`
      UPDATE connections
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, req.params.id]);

    const formattedConn = formatConnectionRow(upd.rows[0]);

    // Send persistent notification to requester in Neon
    await createNeonNotification(
      existing.requester_id,
      `Connection ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
      `${existing.recipient_name} has ${status} your connection request.`,
      'connection',
      '/contacts?tab=connections'
    );

    sendSSE(existing.requester_id, 'connection_updated', { connection: formattedConn });
    sendSSE(existing.recipient_id, 'connection_updated', { connection: formattedConn });

    return res.json({ success: true, connection: formattedConn });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/connections/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const connRes = await pool.query('SELECT * FROM connections WHERE id = $1', [req.params.id]);
    if (connRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }

    const existing = connRes.rows[0];
    if (existing.requester_id !== authUser.id && existing.recipient_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot delete another user\'s connection.' });
    }

    await pool.query('DELETE FROM connections WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── NOTIFICATIONS REST APIS (NEON POSTGRESQL) ──────────────────────────────
app.get('/api/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const targetUserId = authUser.role === 'admin' ? (req.query.userId ? String(req.query.userId) : authUser.id) : authUser.id;

    const result = await pool.query(`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [targetUserId]);

    const notifications = result.rows.map(formatNotificationRow);
    return res.json({ success: true, notifications });
  } catch (err: any) {
    console.error('[Notifications] Error fetching notifications from Neon:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const notifRes = await pool.query('SELECT * FROM notifications WHERE id = $1', [req.params.id]);
    if (notifRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    const existing = notifRes.rows[0];
    if (existing.user_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot mark another user\'s notification as read.' });
    }

    await pool.query('UPDATE notifications SET read = true WHERE id = $1', [req.params.id]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const targetUserId = authUser.role === 'admin' ? (req.body.userId || authUser.id) : authUser.id;

    await pool.query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [targetUserId]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── AUTH LOGOUT REST API ───────────────────────────────────────────────────
app.post('/api/auth/logout', async (req, res) => {
  try {
    const rawToken = extractToken(req);
    const { userId } = req.body || {};

    if (rawToken) {
      await revokeSessionByToken(rawToken);
    }

    let user: any = userId ? jsonDb.getUserById(userId) : undefined;
    if (!user && rawToken) {
      user = jsonDb.getUsers().find((u: any) => u.sessionToken === rawToken);
    }

    if (user) {
      jsonDb.updateUser(user.id, { sessionToken: undefined });
      jsonDb.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: user.phone,
        role: user.role,
        status: 'LOGOUT',
        ip: req.ip || '127.0.0.1',
        device: (req.headers['user-agent'] as string) || 'Web Client',
        details: 'User logged out and session revoked in Neon PostgreSQL',
      });
    }

    const { maxAge: _unused, ...clearOptions } = SESSION_COOKIE_OPTIONS;
    res.clearCookie(SESSION_COOKIE_NAME, clearOptions);

    return res.json({ success: true, message: 'Logged out successfully and session revoked' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── WEBRTC CALL SIGNALING & CALL LOGS REST APIS ────────────────────────────
app.post('/api/calls/signal', (req, res) => {
  const { toUserId, fromUserId, fromUserName, fromUserRole, type, sdp, candidate, reason } = req.body;
  if (!toUserId || !type) {
    return res.status(400).json({ success: false, error: 'toUserId and signal type are required' });
  }

  sendSSE(toUserId, 'call_signal', {
    toUserId,
    fromUserId,
    fromUserName,
    fromUserRole,
    type,
    sdp,
    candidate,
    reason,
    timestamp: new Date().toISOString(),
  });

  res.json({ success: true });
});

// ─── CALL LOGS REST APIS (NEON POSTGRESQL) ──────────────────────────────────

function formatCallLogRow(r: any) {
  return {
    id: r.id,
    callerId: r.caller_id,
    caller_id: r.caller_id,
    callerName: r.caller_name,
    caller_name: r.caller_name,
    callerRole: r.caller_role,
    caller_role: r.caller_role,
    receiverId: r.receiver_id,
    receiver_id: r.receiver_id,
    receiverName: r.receiver_name,
    receiver_name: r.receiver_name,
    receiverRole: r.receiver_role,
    receiver_role: r.receiver_role,
    receiverPhone: r.receiver_phone,
    receiver_phone: r.receiver_phone,
    status: r.status,
    durationSeconds: r.duration_seconds !== null ? parseInt(r.duration_seconds, 10) : 0,
    duration_seconds: r.duration_seconds !== null ? parseInt(r.duration_seconds, 10) : 0,
    timestamp: r.timestamp,
  };
}

app.get('/api/calls/logs', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const requestedUserId = req.query.userId ? String(req.query.userId) : authUser.id;

    // Authorization check: non-admins can only see calls where they are caller or receiver
    if (authUser.role !== 'admin' && requestedUserId !== authUser.id) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot view another user\'s call logs.' });
    }

    const targetUserId = authUser.role === 'admin' ? requestedUserId : authUser.id;

    const result = await pool.query(`
      SELECT * FROM call_logs
      WHERE caller_id = $1 OR receiver_id = $1
      ORDER BY timestamp DESC
      LIMIT 100
    `, [targetUserId]);

    const logs = result.rows.map(formatCallLogRow);
    return res.json({ success: true, logs });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/calls/logs', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const {
      receiverId, receiverName, receiverRole, receiverPhone,
      status = 'completed', durationSeconds = 0
    } = req.body;

    // Caller identity derived strictly from authenticated user
    const callerId = authUser.id;
    const callerName = authUser.name;
    const callerRole = authUser.role;

    if (!receiverId || !receiverName || !receiverPhone) {
      return res.status(400).json({ success: false, error: 'Receiver ID, name, and phone are required.' });
    }

    const logId = `call-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ins = await pool.query(`
      INSERT INTO call_logs (
        id, caller_id, caller_name, caller_role,
        receiver_id, receiver_name, receiver_role, receiver_phone,
        status, duration_seconds, timestamp
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, NOW()
      ) RETURNING *
    `, [
      logId, callerId, callerName, callerRole,
      receiverId, receiverName, receiverRole || 'farmer', receiverPhone,
      status, Number(durationSeconds) || 0
    ]);

    const formattedLog = formatCallLogRow(ins.rows[0]);
    return res.status(201).json({ success: true, log: formattedLog });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── FARMER EXPENSES REST APIS (NEON POSTGRESQL) ────────────────────────────

function formatExpenseRow(r: any) {
  return {
    id: r.id,
    farmerId: r.farmer_id,
    farmer_id: r.farmer_id,
    date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).slice(0, 10),
    type: r.type,
    category: r.category,
    description: r.description,
    descriptionBn: r.description_bn,
    description_bn: r.description_bn,
    amountBDT: parseFloat(r.amount_bdt),
    amount_bdt: parseFloat(r.amount_bdt),
    cropRelated: r.crop_related,
    crop_related: r.crop_related,
    createdAt: r.created_at,
    created_at: r.created_at,
    updatedAt: r.updated_at,
    updated_at: r.updated_at,
  };
}

app.get('/api/farmer/expenses', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const requestedFarmerId = req.query.farmerId ? String(req.query.farmerId) : authUser.id;

    if (authUser.role !== 'admin' && requestedFarmerId !== authUser.id) {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot inspect another farmer\'s expense ledger.' });
    }

    const targetFarmerId = authUser.role === 'admin' ? requestedFarmerId : authUser.id;

    const result = await pool.query(`
      SELECT * FROM farmer_expenses
      WHERE farmer_id = $1
      ORDER BY date DESC, created_at DESC
    `, [targetFarmerId]);

    const expenses = result.rows.map(formatExpenseRow);
    const totalExpenses = expenses.filter(e => e.type === 'expense').reduce((s, e) => s + e.amountBDT, 0);
    const totalIncome = expenses.filter(e => e.type === 'income').reduce((s, e) => s + e.amountBDT, 0);
    const netProfit = totalIncome - totalExpenses;

    return res.json({
      success: true,
      expenses,
      totalExpenses,
      totalIncome,
      netProfit,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/farmer/expenses', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'farmer' && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only farmers and administrators can log farm expenses.' });
    }

    const {
      date = new Date().toISOString().split('T')[0],
      type = 'expense',
      category,
      description,
      descriptionBn,
      amountBDT,
      cropRelated
    } = req.body;

    const parsedAmount = Number(amountBDT);
    if (!category || !description || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Category, description, and positive amount are required.' });
    }

    const farmerId = authUser.id;
    const expenseId = `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const ins = await pool.query(`
      INSERT INTO farmer_expenses (
        id, farmer_id, date, type, category, description, description_bn,
        amount_bdt, crop_related, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, NOW(), NOW()
      ) RETURNING *
    `, [
      expenseId,
      farmerId,
      date,
      type === 'income' ? 'income' : 'expense',
      category,
      description,
      descriptionBn || null,
      parsedAmount,
      cropRelated || null
    ]);

    return res.status(201).json({ success: true, expense: formatExpenseRow(ins.rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Safe, Authenticated, Idempotent Batch Migration for Historical LocalStorage Farmer Expenses
app.post('/api/farmer/expenses/sync', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    if (authUser.role !== 'farmer' && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: Only farmers and administrators can sync farm expenses.' });
    }

    const { entries } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.json({ success: true, synced: 0, skipped: 0, total: 0, message: 'No entries to sync.' });
    }

    let synced = 0;
    let skipped = 0;

    for (const item of entries) {
      const parsedAmount = Number(item.amountBDT || item.amount_bdt);
      if (!item.category || !item.description || isNaN(parsedAmount) || parsedAmount <= 0) {
        skipped++;
        continue;
      }

      const id = item.id || `exp-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const date = item.date ? (typeof item.date === 'string' ? item.date.slice(0, 10) : new Date(item.date).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
      const type = item.type === 'income' ? 'income' : 'expense';
      const category = item.category;
      const description = item.description;
      const descriptionBn = item.descriptionBn || item.description_bn || null;
      const cropRelated = item.cropRelated || item.crop_related || null;

      // Idempotency check 1: by id
      const existingById = await pool.query('SELECT id FROM farmer_expenses WHERE id = $1', [id]);
      if (existingById.rows.length > 0) {
        skipped++;
        continue;
      }

      // Idempotency check 2: by composite key (farmer_id, date, amount_bdt, description)
      const existingByKey = await pool.query(
        'SELECT id FROM farmer_expenses WHERE farmer_id = $1 AND date = $2 AND amount_bdt = $3 AND description = $4',
        [authUser.id, date, parsedAmount, description]
      );
      if (existingByKey.rows.length > 0) {
        skipped++;
        continue;
      }

      await pool.query(`
        INSERT INTO farmer_expenses (
          id, farmer_id, date, type, category, description, description_bn,
          amount_bdt, crop_related, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
        )
      `, [id, authUser.id, date, type, category, description, descriptionBn, parsedAmount, cropRelated]);

      synced++;
    }

    return res.json({
      success: true,
      synced,
      skipped,
      total: entries.length,
      message: `Successfully synchronized ${synced} entries (${skipped} duplicates/invalid skipped).`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/farmer/expenses/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const expRes = await pool.query('SELECT * FROM farmer_expenses WHERE id = $1', [req.params.id]);
    if (expRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Expense record not found.' });
    }

    const existing = expRes.rows[0];
    if (existing.farmer_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot modify another farmer\'s ledger.' });
    }

    const { date, type, category, description, descriptionBn, amountBDT, cropRelated } = req.body;

    const upd = await pool.query(`
      UPDATE farmer_expenses
      SET date = COALESCE($1, date),
          type = COALESCE($2, type),
          category = COALESCE($3, category),
          description = COALESCE($4, description),
          description_bn = COALESCE($5, description_bn),
          amount_bdt = COALESCE($6, amount_bdt),
          crop_related = COALESCE($7, crop_related),
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [
      date || null,
      type || null,
      category || null,
      description || null,
      descriptionBn || null,
      amountBDT !== undefined ? Number(amountBDT) : null,
      cropRelated || null,
      req.params.id
    ]);

    return res.json({ success: true, expense: formatExpenseRow(upd.rows[0]) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/farmer/expenses/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const expRes = await pool.query('SELECT * FROM farmer_expenses WHERE id = $1', [req.params.id]);
    if (expRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Expense record not found.' });
    }

    const existing = expRes.rows[0];
    if (existing.farmer_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot delete another farmer\'s ledger.' });
    }

    await pool.query('DELETE FROM farmer_expenses WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Expense record deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── NEGOTIATIONS REST APIS (NEON POSTGRESQL) ───────────────────────────────

function formatNegotiationRow(r: any) {
  return {
    id: r.id,
    listingId: r.listing_id,
    listing_id: r.listing_id,
    demandId: r.demand_id,
    demand_id: r.demand_id,
    buyerId: r.buyer_id,
    buyer_id: r.buyer_id,
    buyerName: r.buyer_name,
    buyer_name: r.buyer_name,
    buyerPhone: r.buyer_phone,
    buyer_phone: r.buyer_phone,
    offeredPricePerKg: parseFloat(r.offered_price_per_kg),
    offered_price_per_kg: parseFloat(r.offered_price_per_kg),
    quantityKg: parseFloat(r.quantity_kg),
    quantity_kg: parseFloat(r.quantity_kg),
    message: r.message,
    status: r.status,
    counterPrice: r.counter_price !== null ? parseFloat(r.counter_price) : null,
    counter_price: r.counter_price !== null ? parseFloat(r.counter_price) : null,
    createdAt: r.created_at,
    created_at: r.created_at,
    updatedAt: r.updated_at,
    updated_at: r.updated_at,
    cropName: r.crop_name,
    crop_name: r.crop_name,
    banglaName: r.bangla_name,
    bangla_name: r.bangla_name,
    sellerId: r.seller_id,
    seller_id: r.seller_id,
    sellerName: r.seller_name,
    seller_name: r.seller_name,
  };
}

app.get('/api/negotiations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { listingId } = req.query;

    if (listingId) {
      // Check listing existence
      const prodRes = await pool.query('SELECT id, seller_id FROM products WHERE id = $1', [String(listingId)]);
      if (prodRes.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Product listing not found.' });
      }
      const product = prodRes.rows[0];

      // Query negotiations for this listing
      const result = await pool.query(`
        SELECT n.*, p.crop_name, p.bangla_name, p.seller_id, p.seller_name
        FROM negotiations n
        JOIN products p ON n.listing_id = p.id
        WHERE n.listing_id = $1
        ORDER BY n.created_at DESC
      `, [String(listingId)]);

      // If caller is not seller or admin, they can only view negotiations where they are the buyer
      let filtered = result.rows;
      if (product.seller_id !== authUser.id && authUser.role !== 'admin') {
        filtered = filtered.filter((r: any) => r.buyer_id === authUser.id);
      }

      return res.json({ success: true, negotiations: filtered.map(formatNegotiationRow) });
    }

    // No listingId provided: return user's active negotiations (as buyer or seller)
    const result = await pool.query(`
      SELECT n.*, p.crop_name, p.bangla_name, p.seller_id, p.seller_name
      FROM negotiations n
      JOIN products p ON n.listing_id = p.id
      WHERE n.buyer_id = $1 OR p.seller_id = $1
      ORDER BY n.created_at DESC
    `, [authUser.id]);

    return res.json({ success: true, negotiations: result.rows.map(formatNegotiationRow) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/negotiations', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { listingId, demandId, offeredPricePerKg, quantityKg, message } = req.body;

    if (!listingId || !offeredPricePerKg || !quantityKg || !message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Listing ID, offered price, quantity, and message are required.' });
    }

    const price = Number(offeredPricePerKg);
    const qty = Number(quantityKg);
    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Price and quantity must be positive numbers.' });
    }

    // Verify product exists in Neon products
    const prodRes = await pool.query('SELECT id, seller_id, crop_name, unit_price FROM products WHERE id = $1', [listingId]);
    if (prodRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Product listing not found.' });
    }
    const product = prodRes.rows[0];

    // Prevent seller from negotiating with self
    if (product.seller_id === authUser.id) {
      return res.status(400).json({ success: false, error: 'Cannot negotiate with your own listing.' });
    }

    // Buyer identity derived from authenticated session
    const buyerId = authUser.id;
    const buyerName = authUser.name;
    const buyerPhone = authUser.phone || '';

    const negId = `neg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const ins = await pool.query(`
      INSERT INTO negotiations (
        id, listing_id, demand_id, buyer_id, buyer_name, buyer_phone,
        offered_price_per_kg, quantity_kg, message, status, counter_price, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, 'Pending', null, NOW(), NOW()
      ) RETURNING *
    `, [
      negId,
      listingId,
      demandId || null,
      buyerId,
      buyerName,
      buyerPhone,
      price,
      qty,
      message.trim()
    ]);

    const formattedNeg = formatNegotiationRow({
      ...ins.rows[0],
      crop_name: product.crop_name,
      seller_id: product.seller_id
    });

    // Notify seller in Neon
    await createNeonNotification(
      product.seller_id,
      'Price Negotiation Offer',
      `${buyerName} offered ৳${price}/kg for ${qty}kg of ${product.crop_name}.`,
      'negotiation',
      `/products/${listingId}`
    );

    return res.status(201).json({ success: true, negotiation: formattedNeg });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Safe, Authenticated, Idempotent Batch Migration for Historical LocalStorage Negotiations
app.post('/api/negotiations/sync', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { offers } = req.body;
    if (!Array.isArray(offers) || offers.length === 0) {
      return res.json({ success: true, synced: 0, skipped: 0, total: 0, message: 'No offers to sync.' });
    }

    let synced = 0;
    let skipped = 0;

    for (const item of offers) {
      const listingId = item.listingId || item.listing_id;
      const price = Number(item.offeredPricePerKg || item.offered_price_per_kg);
      const qty = Number(item.quantityKg || item.quantity_kg);
      const msg = item.message || '';

      if (!listingId || isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0 || !msg.trim()) {
        skipped++;
        continue;
      }

      // Verify product exists in Neon
      const prodRes = await pool.query('SELECT id, seller_id FROM products WHERE id = $1', [listingId]);
      if (prodRes.rows.length === 0 || prodRes.rows[0].seller_id === authUser.id) {
        skipped++; // Invalid product or self-negotiation
        continue;
      }

      const id = item.id || `neg-sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Idempotency check:
      const existing = await pool.query('SELECT id FROM negotiations WHERE id = $1', [id]);
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      await pool.query(`
        INSERT INTO negotiations (
          id, listing_id, demand_id, buyer_id, buyer_name, buyer_phone,
          offered_price_per_kg, quantity_kg, message, status, counter_price, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
      `, [
        id, listingId, item.demandId || null, authUser.id, authUser.name, authUser.phone || '',
        price, qty, msg.trim(), item.status || 'Pending', item.counterPrice || null
      ]);

      synced++;
    }

    return res.json({
      success: true,
      synced,
      skipped,
      total: offers.length,
      message: `Successfully synchronized ${synced} negotiations (${skipped} duplicates/invalid skipped).`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/negotiations/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const { status, counterPrice } = req.body;

    const validStatuses = ['Accepted', 'Rejected', 'Countered'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid status (Accepted, Rejected, Countered) is required.' });
    }

    const negRes = await pool.query(`
      SELECT n.*, p.seller_id, p.crop_name
      FROM negotiations n
      JOIN products p ON n.listing_id = p.id
      WHERE n.id = $1
    `, [req.params.id]);

    if (negRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Negotiation offer not found.' });
    }
    const negotiation = negRes.rows[0];

    // Participant authorization:
    // Seller can Accept, Counter, or Reject
    // Buyer can Accept if it was Countered
    const isSeller = negotiation.seller_id === authUser.id;
    const isBuyer = negotiation.buyer_id === authUser.id;
    const isAdmin = authUser.role === 'admin';

    if (!isSeller && !isBuyer && !isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden: You are not a participant in this negotiation.' });
    }

    if (!isSeller && !isAdmin) {
      // Buyer attempting transition: only allowed if status is 'Accepted' and existing status was 'Countered'
      if (status !== 'Accepted' || negotiation.status !== 'Countered') {
        return res.status(403).json({ success: false, error: 'Forbidden: Only the seller can alter this negotiation state.' });
      }
    }

    let parsedCounterPrice = null;
    if (status === 'Countered') {
      parsedCounterPrice = Number(counterPrice);
      if (isNaN(parsedCounterPrice) || parsedCounterPrice <= 0) {
        return res.status(400).json({ success: false, error: 'Valid positive counter price is required when countering.' });
      }
    }

    const upd = await pool.query(`
      UPDATE negotiations
      SET status = $1,
          counter_price = COALESCE($2, counter_price),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, parsedCounterPrice, req.params.id]);

    const formattedNeg = formatNegotiationRow({
      ...upd.rows[0],
      crop_name: negotiation.crop_name,
      seller_id: negotiation.seller_id
    });

    // Notify the other party
    const notifyTarget = isSeller ? negotiation.buyer_id : negotiation.seller_id;
    if (notifyTarget) {
      await createNeonNotification(
        notifyTarget,
        `Negotiation ${status}`,
        `Your negotiation for ${negotiation.crop_name} was marked ${status}${parsedCounterPrice ? ` at ৳${parsedCounterPrice}/kg` : ''}.`,
        'negotiation',
        `/products/${negotiation.listing_id}`
      );
    }

    return res.json({ success: true, negotiation: formattedNeg });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── ALL 64 BANGLADESH DISTRICTS REAL WEATHER ENGINE ────────────────────────
const BANGLADESH_DISTRICT_COORDS: Record<string, { lat: number; lon: number; bn: string; aliases: string[] }> = {
  // Rajshahi Division
  Bogura: { lat: 24.8465, lon: 89.3778, bn: 'বগুড়া', aliases: ['bogura', 'bogra', 'বগুড়া', 'বগুড়া'] },
  Rajshahi: { lat: 24.3745, lon: 88.6042, bn: 'রাজশাহী', aliases: ['rajshahi', 'রাজশাহী'] },
  Joypurhat: { lat: 25.0947, lon: 89.0209, bn: 'জয়পুরহাট', aliases: ['joypurhat', 'জয়পুরহাট', 'জয়পুরহাট'] },
  Naogaon: { lat: 24.7936, lon: 88.9318, bn: 'নওগাঁ', aliases: ['naogaon', 'নওগাঁ'] },
  Natore: { lat: 24.4206, lon: 89.0003, bn: 'নাটোর', aliases: ['natore', 'নাটোর'] },
  Chapainawabganj: { lat: 24.5965, lon: 88.2775, bn: 'চাঁপাইনবাবগঞ্জ', aliases: ['chapainawabganj', 'চাঁপাইনবাবগঞ্জ'] },
  Pabna: { lat: 24.0064, lon: 89.2372, bn: 'পাবনা', aliases: ['pabna', 'পাবনা'] },
  Sirajganj: { lat: 24.4534, lon: 89.7006, bn: 'সিরাজগঞ্জ', aliases: ['sirajganj', 'সিরাজগঞ্জ'] },

  // Dhaka Division
  Dhaka: { lat: 23.8103, lon: 90.4125, bn: 'ঢাকা', aliases: ['dhaka', 'ঢাকা'] },
  Gazipur: { lat: 23.9999, lon: 90.4203, bn: 'গাজীপুর', aliases: ['gazipur', 'গাজীপুর'] },
  Narayanganj: { lat: 23.6337, lon: 90.4965, bn: 'নারায়ণগঞ্জ', aliases: ['narayanganj', 'নারায়ণগঞ্জ', 'নারায়নগঞ্জ'] },
  Tangail: { lat: 24.2513, lon: 89.9167, bn: 'টাঙ্গাইল', aliases: ['tangail', 'টাঙ্গাইল'] },
  Narsingdi: { lat: 23.9322, lon: 90.7154, bn: 'নরসিংদী', aliases: ['narsingdi', 'নরসিংদী'] },
  Faridpur: { lat: 23.6071, lon: 89.8429, bn: 'ফরিদপুর', aliases: ['faridpur', 'ফরিদপুর'] },
  Manikganj: { lat: 23.8644, lon: 90.0047, bn: 'মানিকগঞ্জ', aliases: ['manikganj', 'মানিকগঞ্জ'] },
  Munshiganj: { lat: 23.5422, lon: 90.5305, bn: 'মুন্সীগঞ্জ', aliases: ['munshiganj', 'মুন্সীগঞ্জ'] },
  Gopalganj: { lat: 23.0051, lon: 89.8266, bn: 'গোপালগঞ্জ', aliases: ['gopalganj', 'গোপালগঞ্জ'] },
  Madaripur: { lat: 23.1641, lon: 90.1897, bn: 'মাদারীপুর', aliases: ['madaripur', 'মাদারীপুর'] },
  Rajbari: { lat: 23.7574, lon: 89.6445, bn: 'রাজবাড়ী', aliases: ['rajbari', 'রাজবাড়ী', 'রাজবাড়ি'] },
  Shariatpur: { lat: 23.2423, lon: 90.3526, bn: 'শরীয়তপুর', aliases: ['shariatpur', 'শরীয়তপুর', 'শরিয়তপুর'] },
  Kishoreganj: { lat: 24.4449, lon: 90.7766, bn: 'কিশোরগঞ্জ', aliases: ['kishoreganj', 'কিশোরগঞ্জ'] },

  // Rangpur Division
  Rangpur: { lat: 25.7439, lon: 89.2752, bn: 'রংপুর', aliases: ['rangpur', 'রংপুর'] },
  Dinajpur: { lat: 25.6217, lon: 88.6355, bn: 'দিনাজপুর', aliases: ['dinajpur', 'দিনাজপুর'] },
  Kurigram: { lat: 25.8054, lon: 89.6362, bn: 'কুড়িগ্রাম', aliases: ['kurigram', 'কুড়িগ্রাম', 'কুড়িগ্রাম'] },
  Gaibandha: { lat: 25.3288, lon: 89.5430, bn: 'গাইবান্ধা', aliases: ['gaibandha', 'গাইবান্ধা'] },
  Nilphamari: { lat: 25.9318, lon: 88.8560, bn: 'নীলফামারী', aliases: ['nilphamari', 'নীলফামারী'] },
  Panchagarh: { lat: 26.3411, lon: 88.5542, bn: 'পঞ্চগড়', aliases: ['panchagarh', 'পঞ্চগড়', 'পঞ্চগড়'] },
  Thakurgaon: { lat: 26.0337, lon: 88.4617, bn: 'ঠাকুরগাঁও', aliases: ['thakurgaon', 'ঠাকুরগাঁও'] },
  Lalmonirhat: { lat: 25.9923, lon: 89.2847, bn: 'লালমনিরহাট', aliases: ['lalmonirhat', 'লালমনিরহাট'] },

  // Chittagong Division
  Chittagong: { lat: 22.3569, lon: 91.7832, bn: 'চট্টগ্রাম', aliases: ['chittagong', 'chattogram', 'ctg', 'চট্টগ্রাম'] },
  CoxsBazar: { lat: 21.4272, lon: 92.0058, bn: 'কক্সবাজার', aliases: ['coxsbazar', "cox's bazar", 'কক্সবাজার'] },
  Comilla: { lat: 23.4682, lon: 91.1788, bn: 'কুমিল্লা', aliases: ['comilla', 'cumilla', 'কুমিল্লা'] },
  Feni: { lat: 23.0159, lon: 91.3976, bn: 'ফেনী', aliases: ['feni', 'ফেনী'] },
  Brahmanbaria: { lat: 23.9571, lon: 91.1119, bn: 'ব্রাহ্মণবাড়িয়া', aliases: ['brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'ব্রাহ্মণবাড়িয়া'] },
  Noakhali: { lat: 22.8696, lon: 91.0994, bn: 'নোয়াখালী', aliases: ['noakhali', 'নোয়াখালী', 'নোয়াখালী'] },
  Chandpur: { lat: 23.2333, lon: 90.6667, bn: 'চাঁদপুর', aliases: ['chandpur', 'চাঁদপুর'] },
  Lakshmipur: { lat: 22.9425, lon: 90.8412, bn: 'লক্ষ্মীপুর', aliases: ['lakshmipur', 'লক্ষ্মীপুর'] },
  Rangamati: { lat: 22.7324, lon: 92.2985, bn: 'রাঙ্গামাটি', aliases: ['rangamati', 'রাঙ্গামাটি'] },
  Khagrachhari: { lat: 23.1193, lon: 91.9847, bn: 'খাগড়াছড়ি', aliases: ['khagrachhari', 'খাগড়াছড়ি', 'খাগড়াছড়ি'] },
  Bandarban: { lat: 22.1953, lon: 92.2184, bn: 'বান্দরবান', aliases: ['bandarban', 'বান্দরবান'] },

  // Khulna Division
  Khulna: { lat: 22.8456, lon: 89.5403, bn: 'খুলনা', aliases: ['khulna', 'খুলনা'] },
  Jashore: { lat: 23.1664, lon: 89.2081, bn: 'যশোর', aliases: ['jashore', 'jessore', 'যশোর'] },
  Satkhira: { lat: 22.7185, lon: 89.0705, bn: 'সাতক্ষীরা', aliases: ['satkhira', 'সাতক্ষীরা'] },
  Bagerhat: { lat: 22.6516, lon: 89.7859, bn: 'বাগেরহাট', aliases: ['bagerhat', 'বাগেরহাট'] },
  Kushtia: { lat: 23.9013, lon: 89.1205, bn: 'কুষ্টিয়া', aliases: ['kushtia', 'কুষ্টিয়া', 'কুষ্টিয়া'] },
  Chuadanga: { lat: 23.6402, lon: 88.8418, bn: 'চুয়াডাঙ্গা', aliases: ['chuadanga', 'চুয়াডাঙ্গা', 'চুয়াডাঙ্গা'] },
  Meherpur: { lat: 23.7622, lon: 88.6318, bn: 'মেহেরপুর', aliases: ['meherpur', 'মেহেরপুর'] },
  Jhenaidah: { lat: 23.5448, lon: 89.1539, bn: 'ঝিনাইদহ', aliases: ['jhenaidah', 'ঝিনাইদহ'] },
  Magura: { lat: 23.4873, lon: 89.4199, bn: 'মাগুরা', aliases: ['magura', 'মাগুরা'] },
  Narail: { lat: 23.1725, lon: 89.5127, bn: 'নড়াইল', aliases: ['narail', 'নড়াইল', 'নড়াইল'] },

  // Barisal Division
  Barisal: { lat: 22.7010, lon: 90.3535, bn: 'বরিশাল', aliases: ['barisal', 'barishal', 'বরিশাল'] },
  Bhola: { lat: 22.6859, lon: 90.6481, bn: 'ভোলা', aliases: ['bhola', 'ভোলা'] },
  Jhalokati: { lat: 22.6406, lon: 90.1987, bn: 'ঝালকাঠি', aliases: ['jhalokati', 'jhalakati', 'ঝালকাঠি'] },
  Pirojpur: { lat: 22.5841, lon: 89.9720, bn: 'পিরোজপুর', aliases: ['pirojpur', 'পিরোজপুর'] },
  Barguna: { lat: 22.0953, lon: 90.1121, bn: 'বরগুনা', aliases: ['barguna', 'বরগুনা'] },
  Patuakhali: { lat: 22.3596, lon: 90.3299, bn: 'পটুয়াখালী', aliases: ['patuakhali', 'পটুয়াখালী', 'পটুয়াখালী'] },

  // Sylhet Division
  Sylhet: { lat: 24.8949, lon: 91.8687, bn: 'সিলেট', aliases: ['sylhet', 'সিলেট'] },
  Moulvibazar: { lat: 24.4829, lon: 91.7774, bn: 'মৌলভীবাজার', aliases: ['moulvibazar', 'মৌলভীবাজার'] },
  Habiganj: { lat: 24.3749, lon: 91.4155, bn: 'হবিগঞ্জ', aliases: ['habiganj', 'হবিগঞ্জ'] },
  Sunamganj: { lat: 25.0658, lon: 91.3950, bn: 'সুনামগঞ্জ', aliases: ['sunamganj', 'সুনামগঞ্জ'] },

  // Mymensingh Division
  Mymensingh: { lat: 24.7471, lon: 90.4203, bn: 'ময়মনসিংহ', aliases: ['mymensingh', 'ময়মনসিংহ', 'ময়মনসিংহ'] },
  Jamalpur: { lat: 24.9375, lon: 89.9378, bn: 'জামালপুর', aliases: ['jamalpur', 'জামালপুর'] },
  Netrokona: { lat: 24.8709, lon: 90.7279, bn: 'নেত্রকোণা', aliases: ['netrokona', 'নেত্রকোণা', 'নেত্রকোনা'] },
  Sherpur: { lat: 25.0205, lon: 90.0153, bn: 'শেরপুর', aliases: ['sherpur', 'শেরপুর'] },
};

function resolveDistrictKey(districtInput: string): string | null {
  if (!districtInput || !districtInput.trim()) return null;
  const clean = districtInput.trim().toLowerCase();

  for (const [key, val] of Object.entries(BANGLADESH_DISTRICT_COORDS)) {
    if (key.toLowerCase() === clean || val.bn.toLowerCase() === clean) return key;
    if (val.aliases.some((a) => a.toLowerCase() === clean)) return key;
  }
  return null;
}

app.get('/api/weather/:district', async (req, res) => {
  const rawDistrict = req.params.district || '';
  const resolved = resolveDistrictKey(rawDistrict);

  if (!resolved) {
    return res.status(404).json({
      success: false,
      requestedDistrict: rawDistrict,
      error: 'DISTRICT_NOT_FOUND',
      message: `"${rawDistrict}" জেলার কোনো আবহাওয়া তথ্য পাওয়া যায়নি। অনুগ্রহ করে সঠিক জেলার নাম লিখুন বা নির্বাচন করুন।`,
    });
  }

  const coords = BANGLADESH_DISTRICT_COORDS[resolved];

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=Asia%2FDhaka&forecast_days=7`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
    const data = await response.json();
    return res.json({
      success: true,
      district: resolved,
      districtBn: coords.bn,
      data,
      source: 'Open-Meteo Meteorological Satellite & Ground Models (Bangladesh Zone)',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      district: resolved,
      districtBn: coords.bn,
      error: 'লাইভ আবহাওয়া সার্ভার সাময়িকভাবে অনুপলব্ধ',
    });
  }
});

// ─── CONTEXT-AWARE AI VOICE & CHAT ASSISTANT (3 STRICT INTENTS) ─────────────
// Supported intents: ANSWER (direct facts), NAVIGATE (1 single action), CLARIFY (1 question)
interface VoiceAssistantResult {
  intent: 'ANSWER' | 'NAVIGATE' | 'CLARIFY';
  reply: string;
  action?: {
    label: string;
    action: string;
    route: string;
  } | null;
  data?: any;
}

function resolveContextAwareAssistant(
  query: string,
  role = 'farmer',
  userLocation = 'Bogura',
  language = 'bn',
  userId?: string
): VoiceAssistantResult {
  const q = (query || '').toLowerCase().trim();

  // 1. LOGOUT & AUTH EXIT INTENT (Checked first to avoid confusing with navigation or questions)
  if (
    q.includes('লগআউট') ||
    q.includes('লগ আউট') ||
    q.includes('লগ-আউট') ||
    q.includes('সাইনআউট') ||
    q.includes('সাইন আউট') ||
    q.includes('সাইন-আউট') ||
    q.includes('logout') ||
    q.includes('log out') ||
    q.includes('sign out') ||
    q.includes('signout') ||
    ((q.includes('বের') || q.includes('exit')) &&
      (q.includes('অ্যাকাউন্ট') || q.includes('account') || q.includes('লগইন') || q.includes('লগিন') || q.includes('login') || q.includes('অ্যাপ') || q.includes('হব')))
  ) {
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? 'আপনার অ্যাকাউন্ট থেকে নিরাপদে লগআউট করতে নিচের বাটনে চাপ দিন।'
        : 'Click the button below to safely log out of your Amar Haat account.',
      action: {
        label: language === 'bn' ? '🚪 লগআউট করুন' : '🚪 Log Out',
        action: 'LOGOUT',
        route: '/logout',
      },
    };
  }

  // 2. CROP DOCTOR & DISEASE DIAGNOSIS (Check before add crop if disease/health is mentioned)
  const isCropHealth =
    q.includes('ডাক্তার') ||
    q.includes('রোগ') ||
    q.includes('পোকা') ||
    q.includes('ধসা') ||
    q.includes('ব্লাইট') ||
    q.includes('কীটনাশক') ||
    q.includes('চিকিৎসা') ||
    q.includes('পাতা হলুদ') ||
    q.includes('doctor') ||
    q.includes('disease') ||
    q.includes('pest') ||
    q.includes('blight');

  if (isCropHealth) {
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? 'ফসলের রোগ বা পোকার আক্রমণের সঠিক চিকিৎসা ও অনুমোদিত ওষুধের তালিকা পেতে এআই ক্রপ ডক্টরে আক্রান্ত পাতার ছবি আপলোড করুন।'
        : 'Upload leaf photos in AI Crop Doctor to receive approved remedies, disease diagnosis, and safety dosages.',
      action: {
        label: language === 'bn' ? '🩺 ফসলের ডাক্তার খুলুন' : '🩺 Open Crop Doctor',
        action: 'OPEN_DOCTOR',
        route: '/crop-doctor',
      },
    };
  }

  // 3. ADD / SELL / LIST NEW CROP INTENT
  const hasCrop = q.includes('ফসল') || q.includes('ফসলের') || q.includes('crop') || q.includes('harvest');
  const hasAddAction =
    q.includes('যোগ') ||
    q.includes('যুক্ত') ||
    q.includes('বিক্রি') ||
    q.includes('বিক্রয়') ||
    q.includes('বেচব') ||
    q.includes('তালিকাভুক্ত') ||
    q.includes('লিস্টিং') ||
    q.includes('লিস্ট') ||
    q.includes('তুলব') ||
    q.includes('তুলতে') ||
    q.includes('দিব') ||
    q.includes('দেব') ||
    q.includes('add') ||
    q.includes('sell') ||
    q.includes('list') ||
    q.includes('create') ||
    q.includes('post');

  const isAddCrop =
    !isCropHealth &&
    ((hasCrop && (hasAddAction || q.includes('নতুন') || q.includes('new'))) ||
      q.includes('নতুন ফসল') ||
      q.includes('ফসল যোগ') ||
      q.includes('ফসল বিক্রি') ||
      q.includes('add crop') ||
      q.includes('sell crop') ||
      q.includes('list crop'));

  if (isAddCrop) {
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? 'পাইকারদের কাছে ফসল সরাসরি বিক্রির জন্য তালিকাভুক্তির ফরম খুলতে নিচের বাটনে চাপ দিন।'
        : 'Click the button below to open the Add Crop listing form for wholesalers.',
      action: {
        label: language === 'bn' ? '🌾 নতুন ফসল তালিকাভুক্ত করুন' : '🌾 Add New Crop',
        action: 'OPEN_ADD_CROP',
        route: '/dashboard',
      },
    };
  }

  // 4. MARKET PRICES & BENCHMARK RATES
  const isMarketPrice =
    q.includes('বাজার দর') ||
    q.includes('বাজারদর') ||
    q.includes('বাজার রেট') ||
    q.includes('market price') ||
    q.includes('market rate') ||
    (q.includes('বাজার') && (q.includes('দর') || q.includes('দাম') || q.includes('রেট') || q.includes('দেখাও') || q.includes('কত') || q.includes('price') || q.includes('rate'))) ||
    q.includes('দর') ||
    q.includes('দাম') ||
    q.includes('রেট') ||
    q.includes('price') ||
    q.includes('rate');

  if (isMarketPrice) {
    let targetDistrict: string | null = null;
    for (const [key, val] of Object.entries(BANGLADESH_DISTRICT_COORDS)) {
      if (q.includes(key.toLowerCase()) || q.includes(val.bn)) {
        targetDistrict = key;
        break;
      }
    }

    const loc = targetDistrict || userLocation || 'Bogura';
    const locBn = BANGLADESH_DISTRICT_COORDS[loc]?.bn || loc;

    const catalog = jsonDb.getCatalog();
    const matchedCrop = catalog.find(
      (c: any) =>
        q.includes(c.name.toLowerCase()) ||
        q.includes(c.nameBn) ||
        (Array.isArray(c.keywords) && c.keywords.some((k: string) => q.includes(k.toLowerCase())))
    );

    if (matchedCrop) {
      const price = matchedCrop.damBenchmarkPrice;
      const minWholesale = Math.round(price * 0.9);
      const maxWholesale = Math.round(price * 1.1);
      const retailAvg = Math.round(price * 1.35);
      return {
        intent: 'ANSWER',
        reply: language === 'bn'
          ? `${locBn} মোকামে ${matchedCrop.nameBn} (${matchedCrop.name}) এর সরকারি ডিএএম পাইকারি দর ৳${minWholesale}-৳${maxWholesale}/${matchedCrop.unit} (খুচরা প্রায় ৳${retailAvg}/${matchedCrop.unit})। তথ্যসূত্র: কৃষি বিপণন অধিদপ্তর (DAM)।`
          : `In ${loc}, wholesale benchmark for ${matchedCrop.name} is ৳${minWholesale}-৳${maxWholesale}/${matchedCrop.unit} (Retail: ৳${retailAvg}). Source: DAM Bangladesh.`,
        action: {
          label: language === 'bn' ? '📊 আজকের বাজার দর দেখুন' : '📊 View Market Rates',
          action: 'OPEN_MARKET',
          route: '/market-rates',
        },
      };
    }

    // General market rates inquiry (e.g. "বাজার দর দেখাও", "বাজারদর কত", "show market price")
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? `${locBn} মোকামসহ সারা দেশের কৃষি বিপণন অধিদপ্তর (DAM) অনুমোদিত আজকের তাজা পাইকারি ও খুচরা বাজার দর দেখতে নিচে চাপ দিন।`
        : `Click below to view today's official wholesale and retail market rates for ${loc} and nationwide.`,
      action: {
        label: language === 'bn' ? '📊 আজকের বাজার দর দেখুন' : '📊 View Market Rates',
        action: 'OPEN_MARKET',
        route: '/market-rates',
      },
    };
  }

  // 5. FINDING WHOLESALERS & ARATS (পাইকার ও আড়তদার ডিরেক্টরি)
  if (
    q.includes('পাইকার') ||
    q.includes('পাইকারদের') ||
    q.includes('আড়ত') ||
    q.includes('আড়তদার') ||
    q.includes('আড়ত') ||
    q.includes('আড়তদার') ||
    q.includes('ক্রেতা') ||
    q.includes('wholesaler') ||
    q.includes('buyer') ||
    q.includes('arat')
  ) {
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? 'আমার হাটের নিবন্ধিত ও বিশ্বস্ত পাইকার ও আড়তদারদের তালিকা দেখতে এবং সরাসরি কল বা চ্যাট করতে নিচে চাপ দিন।'
        : 'Click below to view verified wholesale buyers and connect directly via call or chat.',
      action: {
        label: language === 'bn' ? '🤝 পাইকারদের তালিকা দেখুন' : '🤝 Find Wholesalers',
        action: 'OPEN_CONTACTS',
        route: '/contacts',
      },
    };
  }

  // 6. ORDERS & DELIVERIES (অর্ডার ও চালান ট্র্যাকিং)
  if (
    q.includes('অর্ডার') ||
    q.includes('order') ||
    q.includes('ডেলিভারি') ||
    q.includes('চালান') ||
    q.includes('ট্র্যাকিং') ||
    q.includes('লেনদেন') ||
    q.includes('অবস্থা')
  ) {
    if (userId) {
      const userOrders = jsonDb.getOrders({ customerId: userId }).concat(jsonDb.getOrders({ sellerId: userId }));
      if (userOrders.length > 0) {
        const latest = userOrders[0];
        const statusBn = latest.status === 'Delivered' ? 'সরবরাহ সম্পন্ন' : latest.status === 'Confirmed' ? 'নিশ্চিতকৃত ও প্রস্তুত' : 'প্রক্রিয়াধীন';
        return {
          intent: 'ANSWER',
          reply: language === 'bn'
            ? `আপনার সর্বশেষ অর্ডার #${latest.id} (${latest.items.map((i: any) => i.itemName).join(', ')}) বর্তমানে "${statusBn}" অবস্থায় আছে। মোট মূল্য: ৳${latest.totalBDT}। ট্র্যাকিং কোড: ${latest.trackingCode}।`
            : `Your latest order #${latest.id} is currently "${latest.status}". Total: ৳${latest.totalBDT}. Tracking: ${latest.trackingCode}.`,
          action: { label: language === 'bn' ? 'অর্ডারের বিবরণ দেখুন' : 'View Order Details', action: 'OPEN_ORDERS', route: `/orders?orderId=${latest.id}` },
        };
      }
    }
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? 'আপনার সকল পাইকারি ক্রয়-বিক্রয়ের অর্ডার ও চালানের অবস্থা দেখতে নিচের বাটনে চাপ দিন।'
        : 'Click below to view all your trade orders, delivery statuses, and tracking.',
      action: {
        label: language === 'bn' ? '📦 অর্ডার তালিকা ও ট্র্যাকিং' : '📦 View Orders',
        action: 'OPEN_ORDERS',
        route: '/orders',
      },
    };
  }

  // 7. FARM LEDGER & EXPENSES (খামার খতিয়ান ও হিসাব)
  if (
    q.includes('হিসাব') ||
    q.includes('লেজার') ||
    q.includes('খরচ') ||
    q.includes('লাভ') ||
    q.includes('খতিয়ান') ||
    q.includes('ব্যয়') ||
    q.includes('ledger') ||
    q.includes('expense') ||
    q.includes('profit')
  ) {
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? 'আপনার খামারের সকল সার, বীজ, সেচ ও পরিবহন খরচের বিপরীতে নিট লাভ-ক্ষতির হিসাব দেখতে খতিয়ানে যান।'
        : 'Review your farm inputs, transport costs, and profit-loss calculations in the Farm Ledger. Click below.',
      action: {
        label: language === 'bn' ? '📒 খামার খতিয়ান ও হিসাব' : '📒 Open Farm Ledger',
        action: 'OPEN_LEDGER',
        route: '/ledger',
      },
    };
  }

  // 8. WEATHER FORECAST (আবহাওয়া)
  if (
    q.includes('আবহাওয়া') ||
    q.includes('আবহাওয়া') ||
    q.includes('বৃষ্টি') ||
    q.includes('তাপমাত্রা') ||
    q.includes('ঝড়') ||
    q.includes('ঝড়') ||
    q.includes('weather') ||
    q.includes('rain')
  ) {
    const loc = userLocation || 'Bogura';
    const locBn = BANGLADESH_DISTRICT_COORDS[loc]?.bn || loc;
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? `${locBn} জেলার পরবর্তী ৭ দিনের আবহাওয়া পূর্বাভাস, বৃষ্টির সম্ভাবনা এবং ফসল রক্ষা সংক্রান্ত সতর্কতা দেখতে নিচে চাপ দিন।`
        : `Weather forecast, rain probability, and crop advisories for ${loc} are available. Click below.`,
      action: {
        label: language === 'bn' ? '🌦️ আবহাওয়া পূর্বাভাস দেখুন' : '🌦️ View Weather Forecast',
        action: 'OPEN_WEATHER',
        route: '/weather',
      },
    };
  }

  // 9. PROFILE & ACCOUNT (প্রোফাইল)
  if (
    q.includes('প্রোফাইল') ||
    q.includes('অ্যাকাউন্ট') ||
    q.includes('profile') ||
    q.includes('account')
  ) {
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? 'আপনার প্রোফাইল ও অ্যাকাউন্টের বিবরণ দেখতে নিচের বাটনে চাপ দিন।'
        : 'Click below to view your account details and profile.',
      action: {
        label: language === 'bn' ? '👤 প্রোফাইল দেখুন' : '👤 View Profile',
        action: 'OPEN_PROFILE',
        route: '/profile',
      },
    };
  }

  // 10. DASHBOARD (ড্যাশবোর্ড)
  if (
    q.includes('ড্যাশবোর্ড') ||
    q.includes('dashboard') ||
    q.includes('হোম') ||
    q.includes('home')
  ) {
    return {
      intent: 'NAVIGATE',
      reply: language === 'bn'
        ? 'আপনার ড্যাশবোর্ডে প্রবেশ করতে নিচের বাটনে চাপ দিন।'
        : 'Click below to go to your dashboard.',
      action: {
        label: language === 'bn' ? '🏠 ড্যাশবোর্ডে প্রবেশ করুন' : '🏠 Go to Dashboard',
        action: 'OPEN_DASHBOARD',
        route: '/dashboard',
      },
    };
  }

  // Ambiguous question (< 4 chars) -> clarify
  if (q.length < 4) {
    return {
      intent: 'CLARIFY',
      reply: language === 'bn'
        ? 'আমি আপনাকে কীভাবে সাহায্য করতে পারি? যেমন: "লগ আউট কিভাবে করব", "নতুন ফসল যোগ করব কিভাবে", বা "বাজার দর দেখাও"।'
        : 'How can I assist you? For example: "How to log out", "How to add crop", or "Show market rates".',
      action: null,
    };
  }

  // Default helpful direct answer with market rates shortcut
  return {
    intent: 'ANSWER',
    reply: language === 'bn'
      ? `আমি আমার হাটের স্মার্ট সহকারী। আপনি মুখে বলে বা লিখে যেকোনো কাজের সহায়তা নিতে পারেন — যেমন ফসল বিক্রি, বাজার দর দেখা, পাইকার খোঁজা বা লগআউট করা।`
      : `I am Amar Haat Smart Assistant. You can ask to add crops, check wholesale rates, find buyers, or log out.`,
    action: {
      label: language === 'bn' ? '📊 আজকের বাজার দর দেখুন' : '📊 View Market Rates',
      action: 'OPEN_MARKET',
      route: '/market-rates',
    },
  };
}

app.post('/api/ai/voice-assistant', async (req, res) => {
  const { query = '', role = 'farmer', userLocation = 'Bogura', language = 'bn', userId } = req.body;

  // 1. Generate factual rule-based result based on actual DB records
  const result = resolveContextAwareAssistant(query, role, userLocation, language, userId);

  // If query resolved to a direct action intent (LOGOUT, OPEN_ADD_CROP, OPEN_MARKET, etc.), return immediately!
  // This guarantees 100% accurate intent recognition without delay or LLM hallucinations.
  if (result.action && result.action.action) {
    return res.json(result);
  }

  // If Gemini AI is active and query is open-ended, enhance wording without fabricating
  if (ai && query.trim().length > 6) {
    try {
      const prompt = `System: You are Amar Haat Assistant for Bangladesh Agriculture (${userLocation}).
Role: ${role}.
Language: ${language === 'bn' ? 'Bengali' : 'English'}.
Strict Requirements:
1. Provide one of three intents: ANSWER (give facts directly), NAVIGATE (1 single action button), or CLARIFY (ask 1 concise question).
2. Never fabricate market prices, order numbers, or user records.
Context from real database: ${JSON.stringify(result)}
User question: "${query}"
Return JSON only:
{
  "intent": "${result.intent}",
  "reply": "friendly concise reply (1-2 sentences)",
  "action": ${result.action ? JSON.stringify(result.action) : 'null'}
}`;

      const aiRes = await callGemini(prompt, { responseMimeType: 'application/json' }, 8000);
      const parsed = JSON.parse(aiRes.text || '{}');
      if (parsed.reply && (parsed.intent === 'ANSWER' || parsed.intent === 'NAVIGATE' || parsed.intent === 'CLARIFY')) {
        return res.json({
          intent: parsed.intent,
          reply: parsed.reply,
          action: parsed.action || result.action || null,
        });
      }
    } catch {
      // fallback to reliable result
    }
  }

  return res.json(result);
});

// ─── ADMIN DATABASE INSPECTION ENDPOINTS ─────────────────────────────────────
// Protected: only authentic admin session tokens can access these endpoints.

/** GET /api/admin/db/all — Complete live snapshot of SQLite and JSON databases */
app.get(['/api/admin/db/all', '/api/admin/db/dump'], async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const fullData: { sqlite: Record<string, any[]>; json: Record<string, any[]> } = {
      sqlite: {},
      json: {},
    };

    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as Array<{ name: string }>;
    for (const { name } of tables) {
      try {
        fullData.sqlite[name] = db.prepare(`SELECT * FROM "${name}"`).all();
      } catch {
        fullData.sqlite[name] = [];
      }
    }

    fullData.json = {
      users: jsonDb.getUsers(),
      crops: jsonDb.getCrops(),
      orders: jsonDb.getOrders(),
      messages: (jsonDb as any).cache?.messages || [],
      connections: (jsonDb as any).cache?.connections || [],
      notifications: (jsonDb as any).cache?.notifications || [],
      callLogs: (jsonDb as any).cache?.callLogs || [],
      catalog: (jsonDb as any).cache?.catalog || [],
      supplierProducts: jsonDb.getSupplierProducts(),
    };

    res.json({ success: true, data: fullData });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/db/stats — Summary statistics from both databases */
app.get('/api/admin/db/stats', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;

    // SQLite stats
    const sqliteStats: Record<string, number> = {};
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as Array<{ name: string }>;
    for (const { name } of tables) {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`).get() as { cnt: number };
      sqliteStats[name] = row.cnt;
    }

    // JSON db stats
    const jsonStats = jsonDb.getStats();

    res.json({
      success: true,
      sqlite: {
        dbPath: 'nativebazar.db',
        tables: sqliteStats,
      },
      jsonDb: {
        dbPath: 'server_data/db.json',
        stats: jsonStats,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/db/tables — List all SQLite table names and record counts */
app.get('/api/admin/db/tables', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as Array<{ name: string }>;
    const result = tables.map(({ name }) => {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`).get() as { cnt: number };
      // Get column names
      const cols = db.prepare(`PRAGMA table_info("${name}")`).all() as Array<{ name: string; type: string }>;
      return { name, count: row.cnt, columns: cols.map(c => ({ name: c.name, type: c.type })) };
    });

    // Also include JSON DB collections
    const jsonCollections = [
      { name: 'json:users', count: jsonDb.getUsers().length },
      { name: 'json:messages', count: (jsonDb as any).cache?.messages?.length || 0 },
      { name: 'json:connections', count: (jsonDb as any).cache?.connections?.length || 0 },
      { name: 'json:notifications', count: (jsonDb as any).cache?.notifications?.length || 0 },
      { name: 'json:callLogs', count: (jsonDb as any).cache?.callLogs?.length || 0 },
      { name: 'json:orders', count: (jsonDb as any).cache?.orders?.length || 0 },
      { name: 'json:crops', count: (jsonDb as any).cache?.crops?.length || 0 },
      { name: 'json:auditLogs', count: (jsonDb as any).cache?.auditLogs?.length || 0 },
    ];

    res.json({ success: true, tables: result, jsonCollections });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/admin/db/table/:name?page=1&limit=50 — Paginated records from a table */
app.get('/api/admin/db/table/:name', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const { name } = req.params;
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit)) || 50));
    const offset = (page - 1) * limit;

    // Handle JSON DB collections
    if (name.startsWith('json:')) {
      const collection = name.replace('json:', '');
      let data: any[] = [];
      switch (collection) {
        case 'users': data = jsonDb.getUsers().map(u => ({ ...u, passwordHash: '[REDACTED]', sessionToken: u.sessionToken ? '[SET]' : null })); break;
        case 'messages': data = (jsonDb as any).cache?.messages || []; break;
        case 'connections': data = (jsonDb as any).cache?.connections || []; break;
        case 'notifications': data = (jsonDb as any).cache?.notifications || []; break;
        case 'callLogs': data = (jsonDb as any).cache?.callLogs || []; break;
        case 'orders': data = (jsonDb as any).cache?.orders || []; break;
        case 'crops': data = (jsonDb as any).cache?.crops || []; break;
        case 'auditLogs': data = (jsonDb as any).cache?.auditLogs || []; break;
        default: return res.status(404).json({ error: `JSON collection '${collection}' not found.` });
      }
      const total = data.length;
      const rows = data.slice(offset, offset + limit);
      return res.json({ success: true, table: name, total, page, limit, rows });
    }

    // SQLite table validation — whitelist only known tables
    const validTables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all()
      .map((t: any) => t.name);
    if (!validTables.includes(name)) {
      return res.status(404).json({ error: `Table '${name}' not found.` });
    }

    const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM "${name}"`).get() as { cnt: number };
    const total = totalRow.cnt;

    // Redact password hashes from user table
    let rows: any[];
    if (name === 'users') {
      rows = db.prepare(`SELECT id, role, name, name_bn, phone, email, district, upazila, verified, created_at, last_login_at FROM "${name}" LIMIT ? OFFSET ?`).all(limit, offset);
    } else {
      rows = db.prepare(`SELECT * FROM "${name}" LIMIT ? OFFSET ?`).all(limit, offset);
    }

    res.json({ success: true, table: name, total, page, limit, rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/admin/db/record/:table/:id — Direct inline editing and saving of records */
const handleAdminRecordUpdate = async (req: any, res: any) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const { table, id } = req.params;
    const rawUpdates = req.body || {};
    const updates = rawUpdates.updates && typeof rawUpdates.updates === 'object' ? { ...rawUpdates.updates } : { ...rawUpdates };
    delete updates.updates;
    delete updates.id; // Preserve primary key

    // 1. JSON collection updates (e.g. json:users, json:crops, json:messages, etc.)
    if (table.startsWith('json:')) {
      const collection = table.replace('json:', '');
      const updatedItem = jsonDb.updateGenericRecord(collection, id, updates);
      if (!updatedItem) {
        return res.status(404).json({ error: `Record with id "${id}" not found in ${collection}` });
      }

      // Bi-directional sync to SQLite if applicable
      if (collection === 'users') {
        try {
          const sqlUser = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
          if (sqlUser) {
            const allowedCols = ['name', 'name_bn', 'phone', 'email', 'district', 'upazila', 'verified', 'farm_size_acres', 'primary_crops', 'business_name', 'business_type', 'shop_name', 'license_number'];
            const setClauses: string[] = [];
            const values: any[] = [];
            for (const col of allowedCols) {
              const camel = col === 'name_bn' ? 'nameBn' : col === 'farm_size_acres' ? 'farmSizeAcres' : col === 'primary_crops' ? 'primaryCrops' : col === 'business_name' ? 'businessName' : col === 'business_type' ? 'businessType' : col === 'shop_name' ? 'shopName' : col === 'license_number' ? 'licenseNumber' : col;
              if (updates[camel] !== undefined || updates[col] !== undefined) {
                const val = updates[camel] !== undefined ? updates[camel] : updates[col];
                setClauses.push(`"${col}" = ?`);
                values.push(typeof val === 'object' ? JSON.stringify(val) : val);
              }
            }
            if (setClauses.length > 0) {
              values.push(id);
              db.prepare(`UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
            }
          }
        } catch (e) {
          console.warn('[Admin DB] Sync to SQLite users warning:', e);
        }
      } else if (collection === 'crops') {
        try {
          const sqlProd = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
          if (sqlProd) {
            const setClauses: string[] = [];
            const values: any[] = [];
            if (updates.cropName) { setClauses.push('"crop_name" = ?'); values.push(updates.cropName); }
            if (updates.cropBangla) { setClauses.push('"bangla_name" = ?'); values.push(updates.cropBangla); }
            if (updates.quantityKg !== undefined) { setClauses.push('"quantity_kg" = ?', '"available_kg" = ?'); values.push(Number(updates.quantityKg), Number(updates.quantityKg)); }
            if (updates.expectedPricePerKg !== undefined) { setClauses.push('"price_per_kg" = ?'); values.push(Number(updates.expectedPricePerKg)); }
            if (updates.status) { setClauses.push('"harvest_status" = ?'); values.push(updates.status); }
            if (updates.district) { setClauses.push('"district" = ?'); values.push(updates.district); }
            if (setClauses.length > 0) {
              values.push(id);
              db.prepare(`UPDATE products SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
            }
          }
        } catch (e) {
          console.warn('[Admin DB] Sync to SQLite products warning:', e);
        }
      }

      return res.json({ success: true, table, id, record: updatedItem });
    }

    // 2. SQLite table updates
    const validTables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all()
      .map((t: any) => t.name);
    if (!validTables.includes(table)) {
      return res.status(404).json({ error: `Table '${table}' not found.` });
    }

    // Get table columns
    const cols = (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string; type: string }>).map(c => c.name);

    const setClauses: string[] = [];
    const values: any[] = [];

    for (const key of Object.keys(updates)) {
      if (cols.includes(key) && key !== 'id') {
        setClauses.push(`"${key}" = ?`);
        let val = updates[key];
        if (typeof val === 'boolean') val = val ? 1 : 0;
        else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
        values.push(val);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid column fields provided for update.' });
    }

    values.push(id);
    const updateSql = `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE id = ?`;
    const stmt = db.prepare(updateSql);
    const result = stmt.run(...values);

    if (result.changes === 0) {
      return res.status(404).json({ error: `Record with id "${id}" not found in table "${table}".` });
    }

    const updatedRow = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);

    // 3. Bi-directional sync: If SQLite table was updated, sync directly to jsonDb (db.json)
    if (table === 'users') {
      try {
        jsonDb.updateUser(id, {
          name: updates.name,
          nameBn: updates.name_bn,
          phone: updates.phone,
          email: updates.email,
          district: updates.district,
          upazila: updates.upazila,
          verified: updates.verified !== undefined ? Boolean(updates.verified) : undefined,
          farmSizeAcres: updates.farm_size_acres !== undefined ? Number(updates.farm_size_acres) : undefined,
          primaryCrops: updates.primary_crops ? (typeof updates.primary_crops === 'string' ? JSON.parse(updates.primary_crops) : updates.primary_crops) : undefined,
          businessName: updates.business_name,
          businessType: updates.business_type,
          shopName: updates.shop_name,
          licenseNumber: updates.license_number,
        });
      } catch (uErr) {
        console.warn('[Admin DB] jsonDb user sync warning:', uErr);
      }
    } else if (table === 'products') {
      try {
        jsonDb.updateCrop(id, {
          cropName: updates.crop_name,
          cropBangla: updates.bangla_name,
          quantityKg: updates.quantity_kg !== undefined ? Number(updates.quantity_kg) : undefined,
          expectedPricePerKg: updates.price_per_kg !== undefined ? Number(updates.price_per_kg) : undefined,
          qualityGrade: updates.quality_grade,
          district: updates.district,
          upazila: updates.upazila,
          status: updates.harvest_status as any,
          availableDate: updates.available_date,
        });
      } catch (pErr) {
        console.warn('[Admin DB] jsonDb crop sync warning:', pErr);
      }
    } else if (table === 'orders') {
      try {
        if (updates.delivery_status || updates.status) {
          jsonDb.updateOrderStatus(id, updates.delivery_status || updates.status);
        }
      } catch (oErr) {
        console.warn('[Admin DB] jsonDb order sync warning:', oErr);
      }
    }

    return res.json({ success: true, table, id, record: updatedRow });
  } catch (err: any) {
    console.error('Update record error:', err);
    res.status(500).json({ error: err.message });
  }
};

app.put('/api/admin/db/record/:table/:id', handleAdminRecordUpdate);
app.put('/api/admin/db/table/:table/:id', handleAdminRecordUpdate);

/** POST /api/admin/db/record/:table — Insert a new record into SQLite or JSON storage */
const handleAdminRecordInsert = async (req: any, res: any) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const { table } = req.params;
    const body = req.body || {};
    const record = body.record && typeof body.record === 'object' ? { ...body.record } : { ...body };
    delete (record as any).updates;
    delete (record as any).record;
    const nowIso = new Date().toISOString();

    // 1. JSON collection insert
    if (table.startsWith('json:')) {
      const collection = table.replace('json:', '');
      if (!record.id) {
        record.id = `${collection.slice(0, 4)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      }
      if (!record.createdAt && !record.created_at) {
        record.createdAt = nowIso;
      }

      const inserted = jsonDb.insertGenericRecord(collection, record);

      // Bi-directional sync to SQLite if applicable
      if (collection === 'users') {
        try {
          db.prepare(`
            INSERT INTO users (
              id, role, name, name_bn, phone, email, password_hash, district, upazila,
              verified, farm_size_acres, primary_crops, business_name, business_type,
              shop_name, license_number, created_at, last_login_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            record.id,
            record.role || 'farmer',
            record.name || 'New User',
            record.nameBn || null,
            record.phone || `017${Date.now().toString().slice(-8)}`,
            record.email || null,
            record.passwordHash || hashPasswordSync('12345678'),
            record.district || 'Bogura',
            record.upazila || null,
            record.verified ? 1 : 0,
            record.farmSizeAcres || null,
            record.primaryCrops ? (typeof record.primaryCrops === 'string' ? record.primaryCrops : JSON.stringify(record.primaryCrops)) : null,
            record.businessName || null,
            record.businessType || null,
            record.shopName || null,
            record.licenseNumber || null,
            record.createdAt || nowIso,
            record.lastLoginAt || null
          );
        } catch (e) {
          console.warn('[Admin DB] Sync to SQLite users warning:', e);
        }
      } else if (collection === 'crops') {
        try {
          db.prepare(`
            INSERT INTO products (
              id, seller_id, seller_name, seller_phone, seller_role, target_role,
              crop_name, bangla_name, category, variety, quantity_kg, available_kg,
              min_order_kg, price_per_kg, market_price_per_kg, quality_grade, district,
              upazila, harvest_status, available_date, organic_certified, image_url,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            record.id,
            record.farmerId || 'user-farmer-rafiq',
            record.farmerName || 'Farmer',
            record.farmerPhone || '',
            'farmer',
            'wholesaler',
            record.cropName || 'New Crop',
            record.cropBangla || record.cropName || 'নতুন ফসল',
            'Vegetables',
            record.variety || 'Standard',
            Number(record.quantityKg) || 100,
            Number(record.quantityKg) || 100,
            1,
            Number(record.expectedPricePerKg) || 30,
            Number(record.marketBenchmarkPrice) || Number(record.expectedPricePerKg) || 35,
            record.qualityGrade || 'A',
            record.district || 'Bogura',
            record.upazila || 'Shibganj',
            record.status || 'Ready to Harvest',
            record.availableDate || 'In Stock',
            record.organicCertified ? 1 : 0,
            record.imageUrl || '',
            record.createdAt || nowIso
          );
        } catch (e) {
          console.warn('[Admin DB] Sync to SQLite products warning:', e);
        }
      }

      return res.status(201).json({ success: true, table, id: record.id, record: inserted });
    }

    // 2. SQLite table insert
    const validTables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all()
      .map((t: any) => t.name);
    if (!validTables.includes(table)) {
      return res.status(404).json({ error: `Table '${table}' not found.` });
    }

    const cols = (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string; type: string }>).map(c => c.name);

    if (!record.id) {
      if (table === 'users') {
        record.id = `usr-${record.role || 'farmer'}-${Date.now()}`;
      } else if (table === 'products') {
        record.id = `prod-${(record.seller_role || 'far').slice(0, 3)}-${Date.now()}`;
      } else if (table === 'orders') {
        record.id = `ORD-${Date.now().toString().slice(-6)}`;
      } else {
        record.id = `${table.slice(0, 4)}-${Date.now()}`;
      }
    }

    if (cols.includes('created_at') && !record.created_at) {
      record.created_at = nowIso;
    }
    if (cols.includes('updated_at') && !record.updated_at) {
      record.updated_at = nowIso;
    }
    if (cols.includes('password_hash') && !record.password_hash) {
      record.password_hash = hashPasswordSync('12345678');
    }
    if (cols.includes('available_kg') && record.quantity_kg !== undefined && record.available_kg === undefined) {
      record.available_kg = record.quantity_kg;
    }

    const insertCols: string[] = [];
    const placeholders: string[] = [];
    const values: any[] = [];

    for (const col of cols) {
      if (record[col] !== undefined) {
        insertCols.push(`"${col}"`);
        placeholders.push('?');
        let val = record[col];
        if (typeof val === 'boolean') val = val ? 1 : 0;
        else if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
        values.push(val);
      }
    }

    if (insertCols.length === 0) {
      return res.status(400).json({ error: 'No valid columns provided for insert.' });
    }

    const insertSql = `INSERT INTO "${table}" (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
    db.prepare(insertSql).run(...values);

    const insertedRow = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(record.id);

    // 3. Bi-directional sync to jsonDb
    if (table === 'users') {
      try {
        jsonDb.addUser({
          id: record.id,
          role: record.role || 'farmer',
          name: record.name,
          nameBn: record.name_bn,
          phone: record.phone,
          email: record.email,
          passwordHash: record.password_hash,
          district: record.district || 'Bogura',
          upazila: record.upazila,
          verified: Boolean(record.verified),
          createdAt: record.created_at || nowIso,
          farmSizeAcres: record.farm_size_acres ? Number(record.farm_size_acres) : undefined,
          primaryCrops: record.primary_crops ? (typeof record.primary_crops === 'string' ? JSON.parse(record.primary_crops) : record.primary_crops) : undefined,
          businessName: record.business_name,
          businessType: record.business_type,
          shopName: record.shop_name,
          licenseNumber: record.license_number,
        });
      } catch (uErr) {
        console.warn('[Admin DB] jsonDb user sync warning:', uErr);
      }
    } else if (table === 'products') {
      try {
        jsonDb.addCrop({
          id: record.id,
          farmerId: record.seller_id || 'user-farmer-rafiq',
          farmerName: record.seller_name || 'Farmer',
          farmerPhone: record.seller_phone || '',
          district: record.district || 'Bogura',
          upazila: record.upazila || 'Shibganj',
          cropName: record.crop_name || 'Crop',
          cropBangla: record.bangla_name || record.crop_name || 'ফসল',
          variety: record.variety || 'Standard',
          quantityKg: Number(record.quantity_kg) || 100,
          availableDate: record.available_date || 'In Stock',
          expectedPricePerKg: Number(record.price_per_kg) || 30,
          marketBenchmarkPrice: Number(record.market_price_per_kg) || Number(record.price_per_kg) || 35,
          status: (record.harvest_status as any) || 'Ready to Harvest',
          imageUrl: record.image_url || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
          qualityGrade: record.quality_grade || 'A',
          organicCertified: Boolean(record.organic_certified),
          createdAt: record.created_at || nowIso,
        });
      } catch (cErr) {
        console.warn('[Admin DB] jsonDb crop sync warning:', cErr);
      }
    } else if (table === 'orders') {
      try {
        jsonDb.insertGenericRecord('orders', {
          id: record.id,
          orderType: record.order_type || 'b2b_trade',
          customerId: record.buyer_id || 'user-buyer-1',
          customerName: record.buyer_name || 'Buyer',
          phone: record.buyer_phone || '',
          items: [],
          totalBDT: Number(record.total_bdt) || 0,
          paymentMethod: record.payment_method || 'Cash on Delivery',
          deliveryAddress: record.delivery_address || 'Dhaka',
          district: record.district || 'Bogura',
          upazila: 'Bogura Sadar',
          status: record.delivery_status || 'Pending',
          trackingCode: record.tracking_code || ('TRK-' + Date.now().toString().slice(-6)),
          orderDate: record.created_at || nowIso,
          sellerId: record.seller_id || '',
          sellerName: record.seller_name || '',
          sellerRole: record.seller_role || 'farmer',
        });
      } catch (oErr) {
        console.warn('[Admin DB] jsonDb order sync warning:', oErr);
      }
    }

    return res.status(201).json({ success: true, table, id: record.id, record: insertedRow });
  } catch (err: any) {
    console.error('Insert record error:', err);
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/admin/db/record/:table', handleAdminRecordInsert);
app.post('/api/admin/db/table/:table', handleAdminRecordInsert);

/** DELETE /api/admin/db/record/:table/:id — Delete a record from SQLite and JSON storage */
const handleAdminRecordDelete = async (req: any, res: any) => {
  try {
    if (!await requireAdmin(req, res)) return;

    const { table, id } = req.params;

    // 1. JSON collection delete
    if (table.startsWith('json:')) {
      const collection = table.replace('json:', '');
      const deleted = jsonDb.deleteGenericRecord(collection, id);

      // Bi-directional sync delete in SQLite
      if (collection === 'users') {
        try {
          db.prepare('DELETE FROM users WHERE id = ?').run(id);
        } catch {
          // ignore
        }
      } else if (collection === 'crops') {
        try {
          db.prepare('DELETE FROM products WHERE id = ?').run(id);
        } catch {
          // ignore
        }
      }

      return res.json({ success: true, deleted, table, id });
    }

    // 2. SQLite table delete
    const validTables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .all()
      .map((t: any) => t.name);
    if (!validTables.includes(table)) {
      return res.status(404).json({ error: `Table '${table}' not found.` });
    }

    if (table === 'orders') {
      try {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
      } catch {
        // ignore
      }
    }

    const result = db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(id);

    // 3. Bi-directional sync delete in jsonDb
    if (table === 'users') {
      jsonDb.deleteGenericRecord('users', id);
    } else if (table === 'products') {
      jsonDb.deleteGenericRecord('crops', id);
    } else if (table === 'orders') {
      jsonDb.deleteGenericRecord('orders', id);
    }

    res.json({ success: true, deleted: result.changes > 0, changes: result.changes, table, id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

app.delete('/api/admin/db/record/:table/:id', handleAdminRecordDelete);
app.delete('/api/admin/db/table/:table/:id', handleAdminRecordDelete);

app.post('/api/admin/db/records/:table', handleAdminRecordInsert);
app.patch('/api/admin/db/record/:table/:id', handleAdminRecordUpdate);
app.patch('/api/admin/db/table/:table/:id', handleAdminRecordUpdate);

app.get('/api/admin/db/record/:table/:id', async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const { table, id } = req.params;
    if (table.startsWith('json:')) {
      const collection = table.replace('json:', '');
      const item = (jsonDb as any).getGenericCollection ? jsonDb.getGenericCollection(collection).find((r: any) => r.id === id) : null;
      if (!item) return res.status(404).json({ error: `Record '${id}' not found in ${collection}` });
      return res.json({ success: true, table, id, record: item });
    }
    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: `Record '${id}' not found in ${table}` });
    return res.json({ success: true, table, id, record: row });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mount Vite in development or static in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use('/NativeBazar', express.static(path.resolve(__dirname, 'dist')));
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NativeBazar server listening on port ${PORT}`);
});

export { app };
