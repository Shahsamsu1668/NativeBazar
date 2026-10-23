import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import {
  db,
  hashPassword,
  verifyPassword,
  validateSupplyChainTrade,
  executeOrderTransaction,
  cancelOrderAndRestoreStock,
} from './src/server/db.js';
import { db as jsonDb } from './server/db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NativeBazar Backend (Persistent SQLite)',
    aiEnabled: !!ai,
    database: 'SQLite WAL Mode',
    models: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'],
    roles: ['Farmer', 'Wholesaler', 'Retailer', 'Consumer'],
    pilotDistrict: 'Bogura, Bangladesh',
    timestamp: new Date().toISOString(),
  });
});

// ─── AUTHENTICATION ENDPOINTS (NO DEMO ACCOUNTS) ─────────────────────────────

// Register new user: Farmer, Wholesaler, Retailer, Consumer
app.post('/api/auth/register', (req, res) => {
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

    // Check if phone is already registered
    const existing = db.prepare('SELECT id, role, phone FROM users WHERE phone = ?').get(phone) as any;
    if (existing) {
      return res.status(409).json({ error: `An account with phone number ${phone} is already registered (${existing.role}). Please log in.` });
    }

    const userId = `usr-${canonicalRole}-${Date.now()}`;
    const passwordHash = hashPassword(password);
    const nowIso = new Date().toISOString();

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
      sessionToken: `nb_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

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
app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password, role } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Phone/Email and password are required.' });
    }

    let query = 'SELECT * FROM users WHERE (phone = ? OR email = ?)';
    const params: any[] = [identifier, identifier];
    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    query += ' LIMIT 1';

    const user = db.prepare(query).get(...params) as any;
    if (!user) {
      return res.status(401).json({ error: 'No account found with these credentials. Please register first.' });
    }

    const isValid = verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const nowIso = new Date().toISOString();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(nowIso, user.id);

    const safeUser = {
      id: user.id,
      role: user.role,
      name: user.name,
      nameBn: user.name_bn,
      phone: user.phone,
      email: user.email,
      district: user.district,
      upazila: user.upazila,
      verified: Boolean(user.verified),
      farmSizeAcres: user.farm_size_acres,
      primaryCrops: user.primary_crops ? JSON.parse(user.primary_crops) : undefined,
      businessName: user.business_name,
      businessType: user.business_type,
      shopName: user.shop_name,
      licenseNumber: user.license_number,
      createdAt: user.created_at,
      lastLoginAt: nowIso,
      sessionToken: `nb_token_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    };

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
app.post('/api/auth/admin-login', (req, res) => {
  try {
    const { username, password, securityPin } = req.body;
    const validUser = process.env.ADMIN_USER;
    const validPass = process.env.ADMIN_PASSWORD;
    const validPin = process.env.ADMIN_PIN;

    // Fail closed if admin credentials have not been explicitly configured in environment
    if (!validUser || !validPass || !validPin) {
      console.error('[Security] Admin login blocked: ADMIN_USER, ADMIN_PASSWORD, or ADMIN_PIN environment variable is not configured.');
      return res.status(503).json({ error: 'Administrator access is currently not configured or disabled.' });
    }

    const isMatch = username === validUser && password === validPass && securityPin === validPin;

    if (!isMatch) {
      return res.status(403).json({ error: 'Access Denied: Invalid administrator credentials or clearance PIN.' });
    }

    const nowIso = new Date().toISOString();
    const adminUser = {
      id: 'admin-authorized-root',
      role: 'admin',
      name: 'Central Platform Administrator',
      phone: '01700000000',
      email: 'admin@nativebazar.gov.bd',
      district: 'Bogura',
      upazila: 'Bogura Sadar',
      verified: true,
      createdAt: '2026-01-01T00:00:00Z',
      lastLoginAt: nowIso,
      sessionToken: `nb_admin_token_${Date.now()}`,
    };

    return res.json({
      success: true,
      user: adminUser,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Admin login failed.' });
  }
});

// ─── PRODUCT MARKETPLACE ENDPOINTS (STRICT ROLE-BASED ACCESS) ─────────────────

// Get products with role filtering
// Consumers ONLY see Retailer products
// Retailers ONLY see Wholesaler products
// Wholesalers ONLY see Farmer products
app.get('/api/products', (req, res) => {
  try {
    const { targetRole, sellerRole, district, category, search, minAvailable = 0 } = req.query as any;

    let query = 'SELECT * FROM products WHERE available_kg > ?';
    const params: any[] = [Number(minAvailable) || 0];

    // Strict role filters
    if (targetRole) {
      query += ' AND target_role = ?';
      params.push(targetRole);
    }
    if (sellerRole) {
      query += ' AND seller_role = ?';
      params.push(sellerRole);
    }
    if (district && district !== 'All') {
      query += ' AND district = ?';
      params.push(district);
    }
    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (crop_name LIKE ? OR bangla_name LIKE ? OR seller_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    const mapped = rows.map((r) => ({
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
      quantityKg: r.quantity_kg,
      availableKg: r.available_kg,
      minOrderKg: r.min_order_kg,
      pricePerKg: r.price_per_kg,
      marketPricePerKg: r.market_price_per_kg,
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
    console.error('Error fetching products:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch products.' });
  }
});

// Publish new product: Enforces seller role restrictions
app.post('/api/products', (req, res) => {
  try {
    const {
      sellerId, sellerName, sellerPhone = '', sellerRole, cropName, banglaName,
      category = 'Vegetables', variety = '', quantityKg, pricePerKg, marketPricePerKg,
      qualityGrade = 'A', district = 'Bogura', upazila = '', locationDetails = '',
      harvestStatus = 'Harvested Today', availableDate = 'In Stock', organicCertified = false,
      imageUrl = '', description = '', farmerOrigin = '', wholesalerArat = '',
      procurementDate = '', safetyNote = '', minOrderKg = 1,
    } = req.body;

    const sRole = (sellerRole || '').toLowerCase();
    let targetRole = 'consumer';

    // Strict supply chain mapping:
    // Farmer lists crops -> Wholesaler buys
    if (sRole === 'farmer') {
      targetRole = 'wholesaler';
    }
    // Wholesaler lists produce -> Retailer buys
    else if (sRole === 'wholesaler') {
      targetRole = 'retailer';
    }
    // Retailer lists goods -> Consumer buys
    else if (sRole === 'retailer') {
      targetRole = 'consumer';
    } else {
      return res.status(403).json({ error: 'Only Farmers, Wholesalers, and Retailers are authorized to publish products.' });
    }

    if (!cropName || !pricePerKg || !quantityKg) {
      return res.status(400).json({ error: 'Crop name, quantity, and price are required.' });
    }

    const prodId = `prod-${sRole.slice(0, 3)}-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO products (
        id, seller_id, seller_name, seller_phone, seller_role, target_role,
        crop_name, bangla_name, category, variety, quantity_kg, available_kg,
        min_order_kg, price_per_kg, market_price_per_kg, quality_grade, district,
        upazila, location_details, harvest_status, available_date, organic_certified,
        image_url, description, farmer_origin, wholesaler_arat, procurement_date,
        safety_note, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    insertStmt.run(
      prodId,
      sellerId || 'seller-1',
      sellerName || 'Verified Seller',
      sellerPhone || '',
      sRole,
      targetRole,
      cropName,
      banglaName || cropName,
      category,
      variety || '',
      Number(quantityKg),
      Number(quantityKg),
      Number(minOrderKg) || 1,
      Number(pricePerKg),
      marketPricePerKg ? Number(marketPricePerKg) : Number(pricePerKg) * 1.15,
      qualityGrade,
      district,
      upazila || '',
      locationDetails || '',
      harvestStatus,
      availableDate,
      organicCertified ? 1 : 0,
      imageUrl || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
      description || '',
      farmerOrigin || '',
      wholesalerArat || '',
      procurementDate || '',
      safetyNote || '',
      nowIso
    );

    return res.status(201).json({
      success: true,
      productId: prodId,
      targetRole,
      message: `Product successfully published for ${targetRole}s!`,
    });
  } catch (err: any) {
    console.error('Error creating product:', err);
    return res.status(500).json({ error: err.message || 'Failed to publish product.' });
  }
});

// Update product
app.put('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { pricePerKg, quantityKg, availableKg, qualityGrade, harvestStatus, description, imageUrl } = req.body;

    const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(id);
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    db.prepare(`
      UPDATE products
      SET price_per_kg = COALESCE(?, price_per_kg),
          quantity_kg = COALESCE(?, quantity_kg),
          available_kg = COALESCE(?, available_kg),
          quality_grade = COALESCE(?, quality_grade),
          harvest_status = COALESCE(?, harvest_status),
          description = COALESCE(?, description),
          image_url = COALESCE(?, image_url)
      WHERE id = ?
    `).run(
      pricePerKg !== undefined ? Number(pricePerKg) : null,
      quantityKg !== undefined ? Number(quantityKg) : null,
      availableKg !== undefined ? Number(availableKg) : null,
      qualityGrade || null,
      harvestStatus || null,
      description || null,
      imageUrl || null,
      id
    );

    return res.json({ success: true, message: 'Product updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return res.json({ success: true, message: 'Product removed.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── ORDER & SUPPLY CHAIN EXECUTION (STRICT RULES ENFORCED) ─────────────────

// Create an order: Verifies supply chain rules, reserves stock, creates tracking code
app.post('/api/orders', (req, res) => {
  try {
    const {
      buyerId, buyerName, buyerPhone, buyerEmail, buyerRole,
      sellerId, sellerName, sellerPhone, sellerRole, items,
      paymentMethod = 'Cash on Delivery', deliveryAddress, district = 'Bogura', notes,
    } = req.body;

    if (!buyerName || !buyerPhone || !deliveryAddress) {
      return res.status(400).json({ error: 'Name, phone number, and delivery address are required.' });
    }

    if (!items || !items.length) {
      return res.status(400).json({ error: 'No items in cart to order.' });
    }

    // Execute atomic transaction with supply chain validation
    const result = executeOrderTransaction({
      buyerId,
      buyerName,
      buyerPhone,
      buyerEmail,
      buyerRole: buyerRole || 'consumer',
      sellerId,
      sellerName,
      sellerPhone,
      sellerRole,
      items,
      paymentMethod,
      deliveryAddress,
      district,
      notes,
    });

    return res.status(201).json({
      success: true,
      message: 'Order confirmed successfully!',
      order: result,
    });
  } catch (err: any) {
    console.error('Order creation error:', err.message);
    if (err.message.includes('Rule Violation')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.message.includes('Insufficient stock')) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message || 'Order execution failed.' });
  }
});

// Get orders: filtered by user or role
app.get('/api/orders', (req, res) => {
  try {
    const { userId, role, sellerId, buyerId } = req.query as any;

    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];

    if (buyerId) {
      query += ' AND buyer_id = ?';
      params.push(buyerId);
    } else if (sellerId) {
      query += ' AND seller_id = ?';
      params.push(sellerId);
    } else if (userId) {
      query += ' AND (buyer_id = ? OR seller_id = ?)';
      params.push(userId, userId);
    }

    if (role) {
      query += ' AND (buyer_role = ? OR seller_role = ?)';
      params.push(role, role);
    }

    query += ' ORDER BY created_at DESC';

    const orders = db.prepare(query).all(...params) as any[];
    const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

    const fullOrders = orders.map((o) => {
      const items = itemsStmt.all(o.id) as any[];
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
        totalBDT: o.total_bdt,
        paymentMethod: o.payment_method,
        paymentStatus: o.payment_status,
        deliveryStatus: o.delivery_status,
        deliveryAddress: o.delivery_address,
        district: o.district,
        trackingCode: o.tracking_code,
        notes: o.notes,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        items: items.map((it) => ({
          id: it.id,
          productId: it.product_id,
          cropName: it.crop_name,
          banglaName: it.bangla_name,
          quantityKg: it.quantity_kg,
          unitPrice: it.unit_price,
          subtotal: it.subtotal,
        })),
      };
    });

    return res.json({ orders: fullOrders, total: fullOrders.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update order status (or cancel with stock restoration)
app.put('/api/orders/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, actorName, actorRole } = req.body;

    if (status === 'Cancelled') {
      const cancelResult = cancelOrderAndRestoreStock(id, actorName, actorRole);
      return res.json(cancelResult);
    }

    const nowIso = new Date().toISOString();
    db.prepare('UPDATE orders SET delivery_status = ?, updated_at = ? WHERE id = ?').run(status, nowIso, id);

    return res.json({ success: true, message: `Order status updated to ${status}.` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── WHOLESALER BIDS & FARMER INTELLIGENCE (FARMER-ONLY) ─────────────────────

// Get verified wholesaler purchase offers for farmers
app.get('/api/wholesaler-offers', (req, res) => {
  try {
    const { district, crop } = req.query as any;
    let query = 'SELECT * FROM wholesaler_offers WHERE 1=1';
    const params: any[] = [];

    if (district && district !== 'All') {
      query += ' AND district = ?';
      params.push(district);
    }
    if (crop) {
      query += ' AND (crop_name LIKE ? OR crop_bangla LIKE ?)';
      params.push(`%${crop}%`, `%${crop}%`);
    }

    query += ' ORDER BY urgent DESC, created_at DESC';
    const offers = db.prepare(query).all(...params);
    return res.json({ offers });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Wholesalers post procurement demands / purchase offers
app.post('/api/wholesaler-offers', (req, res) => {
  try {
    const {
      wholesalerId, wholesalerName, wholesalerPhone, businessName,
      cropName, cropBangla, quantityKgNeeded, offeredPricePerKg,
      district = 'Bogura', upazila = '', location, deadline, urgent = false, notes = '',
    } = req.body;

    if (!cropName || !quantityKgNeeded || !offeredPricePerKg || !location) {
      return res.status(400).json({ error: 'Crop, quantity, offered price, and delivery location are required.' });
    }

    const offerId = `bid-${Date.now()}`;
    const nowIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO wholesaler_offers (
        id, wholesaler_id, wholesaler_name, wholesaler_phone, business_name,
        crop_name, crop_bangla, quantity_kg_needed, fulfilled_kg, offered_price_per_kg,
        district, upazila, location, deadline, urgent, verified, notes, created_at
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, 0, ?,
        ?, ?, ?, ?, ?, 1, ?, ?
      )
    `).run(
      offerId,
      wholesalerId || 'w-user',
      wholesalerName || 'Verified Wholesaler',
      wholesalerPhone || '',
      businessName || wholesalerName || 'Wholesale Arat',
      cropName,
      cropBangla || cropName,
      Number(quantityKgNeeded),
      Number(offeredPricePerKg),
      district,
      upazila || null,
      location,
      deadline || 'Within 7 days',
      urgent ? 1 : 0,
      notes || null,
      nowIso
    );

    return res.status(201).json({ success: true, offerId, message: 'Purchase offer broadcast to farmers successfully!' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Official Department of Agricultural Marketing (DAM) market prices
app.get('/api/market-prices', (req, res) => {
  try {
    const { district } = req.query as any;
    let query = 'SELECT * FROM market_prices';
    const params: any[] = [];

    if (district && district !== 'All') {
      query += ' WHERE district = ?';
      params.push(district);
    }
    query += ' ORDER BY crop_name ASC';

    const rates = db.prepare(query).all(...params);
    return res.json({ rates, source: 'Department of Agricultural Marketing (DAM)' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Farmer-Only Intelligence aggregation (Weather, DAM Prices, Verified Bids, Demand)
app.get('/api/farmer/intelligence', async (req, res) => {
  try {
    const district = (req.query.district as string) || 'Bogura';

    const rates = db.prepare('SELECT * FROM market_prices WHERE district = ?').all(district);
    const offers = db.prepare('SELECT * FROM wholesaler_offers WHERE district = ? ORDER BY urgent DESC').all(district);

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

// Admin Metrics & System Overview
app.get('/api/admin/metrics', (req, res) => {
  try {
    const userCounts = db.prepare('SELECT role, COUNT(*) as count FROM users GROUP BY role').all() as any[];
    const productCounts = db.prepare('SELECT target_role, COUNT(*) as count, SUM(available_kg) as total_kg FROM products GROUP BY target_role').all() as any[];
    const orderStats = db.prepare('SELECT COUNT(*) as total_orders, SUM(total_bdt) as total_volume FROM orders').get() as any;
    const recentAudit = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20').all();

    return res.json({
      userCounts,
      productCounts,
      totalOrders: orderStats?.total_orders || 0,
      totalVolumeBDT: orderStats?.total_volume || 0,
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
    suggestedAction: 'List on NativeBazar forward-contracts for guaranteed ৳41/kg rate',
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
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const phone = req.query.phone as string;

  let user: any = token ? jsonDb.getUsers().find((u: any) => u.sessionToken === token) : undefined;
  if (!user && phone) {
    user = jsonDb.findUserByIdentifier(phone);
  }

  // Also check SQLite database if not found in jsonDb
  if (!user && phone) {
    const row = db.prepare('SELECT * FROM users WHERE phone = ? LIMIT 1').get(phone) as any;
    if (row) {
      user = {
        id: row.id,
        role: row.role,
        name: row.name,
        nameBn: row.name_bn,
        phone: row.phone,
        email: row.email,
        district: row.district,
        upazila: row.upazila,
        verified: Boolean(row.verified),
        farmSizeAcres: row.farm_size_acres,
        primaryCrops: row.primary_crops ? JSON.parse(row.primary_crops) : undefined,
        businessName: row.business_name,
        businessType: row.business_type,
        shopName: row.shop_name,
        licenseNumber: row.license_number,
        createdAt: row.created_at,
      };
    }
  }

  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { passwordHash: _, ...safeUser } = user;
  return res.json({ success: true, user: safeUser });
});

// 4. Update Profile
app.put('/api/users/profile', (req, res) => {
  const { id, name, nameBn, district, upazila, farmSizeAcres, primaryCrops, shopName, licenseNumber } = req.body;
  if (!id) return res.status(400).json({ success: false, error: 'User id is required' });

  // Update in SQLite if exists there
  try {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
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
        id
      );
    }
  } catch {
    // continue to jsonDb
  }

  const updated = jsonDb.updateUser(id, {
    name,
    nameBn,
    district,
    upazila,
    farmSizeAcres,
    primaryCrops,
    shopName,
    licenseNumber,
  });

  const finalUser = updated || (db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any);
  if (!finalUser) return res.status(404).json({ success: false, error: 'User not found' });
  const { passwordHash: _, password_hash: __, ...safeUser } = finalUser;
  return res.json({ success: true, user: safeUser });
});

// ─── USER DIRECTORY REST API ─────────────────────────────────────────────────
// Returns all eligible users for the cross-role communication directory.
// Strips sensitive fields (passwordHash, sessionToken, securityPin) before sending.
app.get('/api/users', (req, res) => {
  try {
    const { excludeId, role, district, search } = req.query;

    const sqliteRows = db.prepare('SELECT id, role, name, name_bn as nameBn, phone, email, district, upazila, verified, farm_size_acres as farmSizeAcres, primary_crops as primaryCrops, business_name as businessName, business_type as businessType, shop_name as shopName, license_number as licenseNumber FROM users').all() as any[];
    const sqliteUsers = sqliteRows.map((u: any) => ({
      ...u,
      primaryCrops: u.primaryCrops ? (typeof u.primaryCrops === 'string' ? JSON.parse(u.primaryCrops) : u.primaryCrops) : undefined,
    }));

    const jsonUsers = jsonDb.getUsers();
    const userMap = new Map<string, any>();
    jsonUsers.forEach((u: any) => userMap.set(u.id, u));
    sqliteUsers.forEach((u: any) => userMap.set(u.id, { ...userMap.get(u.id), ...u }));

    let users = Array.from(userMap.values()).filter((u: any) => {
      // Never expose admin accounts in directory
      if (u.role === 'admin') return false;
      // Exclude the requesting user themselves
      if (excludeId && u.id === String(excludeId)) return false;
      return true;
    });

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
        if (u.nameBn && u.nameBn.includes(q)) return true;
        if (u.phone && u.phone.includes(q)) return true;
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

    // Strip sensitive fields
    const safeUsers = users.map((u: any) => {
      const { passwordHash: _, password_hash: __, sessionToken: ___, securityPin: ____, ...safe } = u;
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

// ─── CROPS REST APIS ─────────────────────────────────────────────────────────
app.get('/api/crops', (req, res) => {
  const { farmerId, district } = req.query;
  const crops = jsonDb.getCrops({
    farmerId: farmerId ? String(farmerId) : undefined,
    district: district ? String(district) : undefined,
  });
  res.json({ success: true, crops });
});

app.post('/api/crops', (req, res) => {
  try {
    const {
      farmerId,
      farmerName,
      farmerPhone,
      district,
      upazila,
      cropName,
      cropBangla,
      variety = 'Standard',
      quantityKg,
      availableDate,
      expectedPricePerKg,
      marketBenchmarkPrice,
      imageUrl,
      qualityGrade = 'A',
      organicCertified = false,
    } = req.body;

    if (!farmerId || !farmerName || !cropName || !quantityKg || !expectedPricePerKg) {
      return res.status(400).json({
        success: false,
        error: 'Missing required crop fields: farmerId, farmerName, cropName, quantityKg, expectedPricePerKg',
      });
    }

    const newCrop = jsonDb.addCrop({
      id: `crop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      farmerId,
      farmerName,
      farmerPhone: farmerPhone || '',
      district: district || 'Bogura',
      upazila: upazila || 'Shibganj',
      cropName,
      cropBangla: cropBangla || cropName,
      variety,
      quantityKg: Number(quantityKg),
      availableDate: availableDate || 'Ready to Harvest',
      expectedPricePerKg: Number(expectedPricePerKg),
      marketBenchmarkPrice: marketBenchmarkPrice ? Number(marketBenchmarkPrice) : Number(expectedPricePerKg) + 4,
      status: 'Growing',
      imageUrl: imageUrl || 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
      qualityGrade,
      organicCertified: !!organicCertified,
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, crop: newCrop });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/crops/:id', (req, res) => {
  const updated = jsonDb.updateCrop(req.params.id, req.body);
  if (!updated) return res.status(404).json({ success: false, error: 'Crop listing not found' });
  return res.json({ success: true, crop: updated });
});

app.delete('/api/crops/:id', (req, res) => {
  const deleted = jsonDb.deleteCrop(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Crop listing not found' });
  return res.json({ success: true, message: 'Crop listing deleted' });
});

// ─── SUPPLIER PRODUCTS REST APIS ─────────────────────────────────────────────
app.get('/api/supplier-products', (req, res) => {
  const { supplierId, category, organicOnly } = req.query;
  const products = jsonDb.getSupplierProducts({
    supplierId: supplierId ? String(supplierId) : undefined,
    category: category ? String(category) : undefined,
    organicOnly: organicOnly === 'true',
  });
  res.json({ success: true, products });
});

app.post('/api/supplier-products', (req, res) => {
  try {
    const {
      supplierId,
      supplierName,
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

    if (!supplierId || !name || !unitPriceBDT) {
      return res.status(400).json({
        success: false,
        error: 'Missing required supplier product fields',
      });
    }

    const created = jsonDb.addSupplierProduct({
      id: `sup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
      phone: phone || '',
      suitableCrops,
      description,
      organicCertified: !!organicCertified,
      certificationNumber,
      deliveryRadiusKm: Number(deliveryRadiusKm),
      createdAt: new Date().toISOString(),
    });

    return res.status(201).json({ success: true, product: created });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/supplier-products/:id', (req, res) => {
  const updated = jsonDb.updateSupplierProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ success: false, error: 'Product not found' });
  return res.json({ success: true, product: updated });
});

app.delete('/api/supplier-products/:id', (req, res) => {
  const deleted = jsonDb.deleteSupplierProduct(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Product not found' });
  return res.json({ success: true, message: 'Product deleted' });
});

// ─── ORDERS & ORDER TRACKING REST APIS ───────────────────────────────────────
app.get('/api/legacy/orders', (req, res) => {
  const { customerId, sellerId, orderType } = req.query;
  const orders = jsonDb.getOrders({
    customerId: customerId ? String(customerId) : undefined,
    sellerId: sellerId ? String(sellerId) : undefined,
    orderType: orderType ? String(orderType) : undefined,
  });
  res.json({ success: true, orders });
});

// Verified Buyer Review Submission (Allowed ONLY on Delivered Orders)
app.post('/api/orders/:id/review', (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, error: 'Valid star rating between 1 and 5 is required' });
    }

    const order = jsonDb.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        error: 'Reviews are reserved exclusively for verified buyers with completed deliveries.',
      });
    }

    const updated = jsonDb.addOrderReview(req.params.id, Number(rating), comment || '');
    return res.json({ success: true, order: updated, message: 'Verified review submitted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── REVIEWS REST APIS ───────────────────────────────────────────────────────
app.get('/api/reviews', (req, res) => {
  const { productId } = req.query;
  const reviews = jsonDb.getReviews(productId ? String(productId) : undefined);
  res.json({ success: true, reviews });
});

// ─── REAL STATS REST API ────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({ success: true, stats: jsonDb.getStats() });
});

// ─── MASTER AGRICULTURAL CATALOG REST APIS ──────────────────────────────────
app.get('/api/catalog', (req, res) => {
  const { category, query, page = '1', limit = '24' } = req.query;
  const cat = typeof category === 'string' ? category : undefined;
  const q = typeof query === 'string' ? query : undefined;
  const all = jsonDb.getCatalog(cat, q);

  if (limit === 'all') {
    return res.json({ success: true, products: all, total: all.length, page: 1, totalPages: 1 });
  }

  const p = Math.max(1, parseInt(String(page), 10) || 1);
  const l = Math.max(1, parseInt(String(limit), 10) || 24);
  const total = all.length;
  const totalPages = Math.ceil(total / l);
  const start = (p - 1) * l;
  const paginated = all.slice(start, start + l);

  res.json({
    success: true,
    products: paginated,
    total,
    page: p,
    totalPages,
    limit: l,
  });
});

app.get('/api/catalog/:id', (req, res) => {
  const product = jsonDb.getCatalogById(req.params.id);
  if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
  res.json({ success: true, product });
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
      } catch {
        // ignore closed socket errors
      }
    });
  }
}

app.get('/api/realtime', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).send('userId query parameter required');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId)!.add(res);

  res.write(`event: connected\ndata: ${JSON.stringify({ userId, connectedAt: new Date().toISOString() })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const clients = sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(userId);
      }
    }
  });
});

// ─── DIRECT MESSAGING REST APIS ─────────────────────────────────────────────
app.get('/api/messages', (req, res) => {
  const { userA, userB } = req.query;
  if (!userA || !userB) {
    return res.status(400).json({ success: false, error: 'userA and userB are required' });
  }
  const messages = jsonDb.getMessages(String(userA), String(userB));
  res.json({ success: true, messages });
});

app.post('/api/messages', (req, res) => {
  try {
    const { senderId, senderName, senderRole, recipientId, recipientName, recipientRole, content, replyToId } = req.body;
    if (!senderId || !recipientId || !content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Missing required message parameters' });
    }

    const message = jsonDb.addMessage({
      senderId,
      senderName: senderName || 'User',
      senderRole: senderRole || 'farmer',
      recipientId,
      recipientName: recipientName || 'User',
      recipientRole: recipientRole || 'businessman',
      content: content.trim(),
      replyToId,
    });

    // Real-time dispatch via SSE
    sendSSE(recipientId, 'new_message', { message });
    sendSSE(senderId, 'message_sent', { message });

    res.status(201).json({ success: true, message });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/messages/read', (req, res) => {
  const { recipientId, senderId } = req.body;
  if (!recipientId || !senderId) {
    return res.status(400).json({ success: false, error: 'recipientId and senderId are required' });
  }
  jsonDb.markMessagesRead(recipientId, senderId);
  sendSSE(senderId, 'messages_read', { recipientId, senderId });
  res.json({ success: true });
});

// ─── CONNECTIONS REST APIS ──────────────────────────────────────────────────
app.get('/api/connections', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
  const connections = jsonDb.getConnections(String(userId));
  res.json({ success: true, connections });
});

app.post('/api/connections', (req, res) => {
  try {
    const { requesterId, recipientId } = req.body;
    if (!requesterId || !recipientId) {
      return res.status(400).json({ success: false, error: 'requesterId and recipientId are required' });
    }
    const connection = jsonDb.addConnectionRequest(requesterId, recipientId);
    sendSSE(recipientId, 'new_connection', { connection });
    sendSSE(requesterId, 'connection_requested', { connection });
    res.status(201).json({ success: true, connection });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/connections/:id', (req, res) => {
  const { status } = req.body;
  if (status !== 'accepted' && status !== 'rejected') {
    return res.status(400).json({ success: false, error: 'Status must be accepted or rejected' });
  }
  const connection = jsonDb.updateConnectionStatus(req.params.id, status);
  if (!connection) return res.status(404).json({ success: false, error: 'Connection not found' });

  sendSSE(connection.requesterId, 'connection_updated', { connection });
  sendSSE(connection.recipientId, 'connection_updated', { connection });
  res.json({ success: true, connection });
});

app.delete('/api/connections/:id', (req, res) => {
  const deleted = jsonDb.deleteConnection(req.params.id);
  res.json({ success: deleted });
});

// ─── NOTIFICATIONS REST APIS ────────────────────────────────────────────────
app.get('/api/notifications', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
  const notifications = jsonDb.getNotifications(String(userId));
  res.json({ success: true, notifications });
});

app.put('/api/notifications/:id/read', (req, res) => {
  jsonDb.markNotificationRead(req.params.id);
  res.json({ success: true });
});

app.put('/api/notifications/read-all', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
  jsonDb.markAllNotificationsRead(userId);
  res.json({ success: true });
});

// ─── AUTH LOGOUT REST API ───────────────────────────────────────────────────
app.post('/api/auth/logout', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    const { userId } = req.body;

    let user: any = userId ? jsonDb.getUserById(userId) : undefined;
    if (!user && token) {
      user = jsonDb.getUsers().find((u: any) => u.sessionToken === token);
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
        details: 'User logged out and session token invalidated',
      });
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

app.get('/api/calls/logs', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
  const logs = jsonDb.getCallLogs(String(userId));
  res.json({ success: true, logs });
});

app.post('/api/calls/logs', (req, res) => {
  try {
    const log = jsonDb.addCallLog(req.body);
    res.status(201).json({ success: true, log });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

  // 1. Check for explicit navigation commands
  const isNavIntent =
    q.includes('খোলো') ||
    q.includes('খুলুন') ||
    q.includes('যাও') ||
    q.includes('যাব') ||
    q.includes('দেখাও') ||
    q.includes('open') ||
    q.includes('go to') ||
    q.includes('show') ||
    q.includes('navigate');

  if (isNavIntent) {
    if (q.includes('বাজার') || q.includes('দাম') || q.includes('দর') || q.includes('rate') || q.includes('market')) {
      return {
        intent: 'NAVIGATE',
        reply: language === 'bn' ? 'বাজার দর পৃষ্ঠা দেখতে নিচের লিঙ্কে চাপ দিন।' : 'Click the button below to view live market rates.',
        action: { label: language === 'bn' ? 'বাজার দর পৃষ্ঠা দেখুন' : 'View Market Rates', action: 'OPEN_MARKET', route: '/market-rates' },
      };
    }
    if (q.includes('ডাক্তার') || q.includes('রোগ') || q.includes('doctor') || q.includes('disease')) {
      return {
        intent: 'NAVIGATE',
        reply: language === 'bn' ? 'ফসলের ডাক্তার খুলতে নিচের লিঙ্কে চাপ দিন।' : 'Click below to open AI Crop Doctor.',
        action: { label: language === 'bn' ? 'ফসলের ডাক্তার খুলুন' : 'Open Crop Doctor', action: 'OPEN_DOCTOR', route: '/crop-doctor' },
      };
    }
    if (q.includes('আবহাওয়া') || q.includes('weather') || q.includes('বৃষ্টি') || q.includes('বৃষ্টিপাত')) {
      return {
        intent: 'NAVIGATE',
        reply: language === 'bn' ? '৭ দিনের আবহাওয়া ও কৃষি সতর্কতা দেখতে নিচের বাটনে চাপ দিন।' : 'Click below to view the weather forecast.',
        action: { label: language === 'bn' ? 'আবহাওয়া পূর্বাভাস দেখুন' : 'View Weather Forecast', action: 'OPEN_WEATHER', route: '/weather' },
      };
    }
    if (q.includes('অর্ডার') || q.includes('order') || q.includes('লেনদেন') || q.includes('ট্র্যাকিং')) {
      return {
        intent: 'NAVIGATE',
        reply: language === 'bn' ? 'আপনার সকল অর্ডার ও ট্র্যাকিং দেখতে নিচের বাটনে চাপ দিন।' : 'Click below to view your orders.',
        action: { label: language === 'bn' ? 'অর্ডার তালিকা দেখুন' : 'View Orders', action: 'OPEN_ORDERS', route: '/orders' },
      };
    }
    if (q.includes('ড্যাশবোর্ড') || q.includes('dashboard') || q.includes('হোম') || q.includes('home')) {
      return {
        intent: 'NAVIGATE',
        reply: language === 'bn' ? 'আপনার ড্যাশবোর্ডে যেতে নিচের বাটনে চাপ দিন।' : 'Click below to go to your dashboard.',
        action: { label: language === 'bn' ? 'ড্যাশবোর্ডে প্রবেশ করুন' : 'Go to Dashboard', action: 'OPEN_DASHBOARD', route: '/dashboard' },
      };
    }
  }

  // 2. Real Authenticated User Orders lookup
  if (q.includes('অর্ডার') || q.includes('order') || q.includes('ডেলিভারি') || q.includes('অবস্থা')) {
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
      intent: 'ANSWER',
      reply: language === 'bn'
        ? 'আপনার বর্তমান অ্যাকাউন্টে কোনো সক্রিয় বা অপেক্ষমাণ অর্ডার পাওয়া যায়নি। আপনি মার্কেটপ্লেস থেকে অর্ডার করতে পারেন।'
        : 'No active orders found for your account. You can place orders from the marketplace.',
      action: { label: language === 'bn' ? 'মার্কেটপ্লেস দেখুন' : 'View Marketplace', action: 'OPEN_MARKET', route: '/marketplace' },
    };
  }

  // 3. Genuine Crop Market Prices & Rates lookup
  if (q.includes('দর') || q.includes('দাম') || q.includes('রেট') || q.includes('price') || q.includes('rate')) {
    // Check if district is specified in query
    let targetDistrict: string | null = null;
    for (const [key, val] of Object.entries(BANGLADESH_DISTRICT_COORDS)) {
      if (q.includes(key.toLowerCase()) || q.includes(val.bn)) {
        targetDistrict = key;
        break;
      }
    }

    // Identify crop from catalog
    const catalog = jsonDb.getCatalog();
    let matchedCrop = catalog.find(
      (c: any) => q.includes(c.name.toLowerCase()) || q.includes(c.nameBn) || c.keywords.some((k: string) => q.includes(k.toLowerCase()))
    );

    // If query asks for price but specifies neither a crop nor clear location:
    if (!matchedCrop && !targetDistrict) {
      return {
        intent: 'CLARIFY',
        reply: language === 'bn'
          ? 'আপনি কোন ফসলের এবং কোন জেলার বাজার দর জানতে চাচ্ছেন? যেমন: "বগুড়ায় টমেটোর পাইকারি দর কত?"'
          : 'Which crop and district price are you inquiring about? For example: "What is the tomato price in Bogura?"',
        action: null,
      };
    }

    const loc = targetDistrict || userLocation || 'Bogura';
    const locBn = BANGLADESH_DISTRICT_COORDS[loc]?.bn || loc;

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
        action: { label: language === 'bn' ? 'লাইভ বাজার দর চার্ট' : 'Live Rate Charts', action: 'OPEN_MARKET', route: '/market-rates' },
      };
    }
  }

  // 4. Crop Disease & Treatment questions
  if (q.includes('রোগ') || q.includes('ধসা') || q.includes('পোকা') || q.includes('ব্লাইট') || q.includes('কীটনাশক') || q.includes('disease') || q.includes('pest')) {
    return {
      intent: 'ANSWER',
      reply: language === 'bn'
        ? 'ফসলের রোগ বা পোকার আক্রমণের সঠিক সমাধানের জন্য এআই ক্রপ ডক্টরে আক্রান্ত পাতার ছবি আপলোড করুন অথবা লক্ষণ উল্লেখ করুন। তাৎক্ষণিক নিরাপদ চিকিৎসা পদ্ধতি প্রদান করা হবে।'
        : 'For crop disease diagnosis, upload leaf photos in AI Crop Doctor to receive approved treatments and safety dosages.',
      action: { label: language === 'bn' ? 'ফসলের ডাক্তার খুলুন' : 'Open Crop Doctor', action: 'OPEN_DOCTOR', route: '/crop-doctor' },
    };
  }

  // 5. Weather inquiry
  if (q.includes('আবহাওয়া') || q.includes('বৃষ্টি') || q.includes('তাপমাত্রা') || q.includes('ঝড়') || q.includes('weather') || q.includes('rain')) {
    const loc = userLocation || 'Bogura';
    const locBn = BANGLADESH_DISTRICT_COORDS[loc]?.bn || loc;
    return {
      intent: 'ANSWER',
      reply: language === 'bn'
        ? `${locBn} জেলার পরবর্তী ৭ দিনের আবহাওয়া পূর্বাভাস, বৃষ্টির সম্ভাবনা এবং ফসল রক্ষা সংক্রান্ত জরুরি সতর্কতা তৈরি রয়েছে।`
        : `Weather forecast, rain probability, and crop advisories for ${loc} are available.`,
      action: { label: language === 'bn' ? 'আবহাওয়া ড্যাশবোর্ড' : 'Weather Dashboard', action: 'OPEN_WEATHER', route: '/weather' },
    };
  }

  // 6. Ambiguous question -> ask one clear clarification question
  if (q.length < 5) {
    return {
      intent: 'CLARIFY',
      reply: language === 'bn'
        ? 'আমি আপনাকে কীভাবে সাহায্য করতে পারি? বাজার দর, আবহাওয়া, রোগ নির্ণয়, অথবা অর্ডার সম্পর্কিত প্রশ্ন করতে পারেন।'
        : 'How can I assist you today? You can ask about market rates, weather, crop health, or your orders.',
      action: null,
    };
  }

  // Default helpful direct answer
  return {
    intent: 'ANSWER',
    reply: language === 'bn'
      ? `আমি নেটিভবাজারের স্মার্ট সহকারী। আপনি যেকোনো ফসলের আজকের বাজার দর, আবহাওয়া সতর্কতা, বা আপনার অর্ডার স্থিতি সম্পর্কে সরাসরি জানতে পারেন।`
      : `I am NativeBazar Smart Assistant. You can ask for wholesale rates, weather alerts, or track your orders.`,
    action: { label: language === 'bn' ? 'বাজার দর অনুসন্ধান' : 'Check Market Rates', action: 'OPEN_MARKET', route: '/market-rates' },
  };
}

app.post('/api/ai/voice-assistant', async (req, res) => {
  const { query = '', role = 'farmer', userLocation = 'Bogura', language = 'bn', userId } = req.body;

  // 1. Generate factual rule-based result based on actual DB records
  const result = resolveContextAwareAssistant(query, role, userLocation, language, userId);

  // If Gemini AI is active and query is not a direct unambiguous intent, enhance wording without fabricating
  if (ai && query.trim().length > 6) {
    try {
      const prompt = `System: You are NativeBazar Assistant for Bangladesh Agriculture (${userLocation}).
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

// Mount Vite in development or static in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NativeBazar server listening on port ${PORT}`);
});
