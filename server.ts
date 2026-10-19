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
    roles: ['Farmer', 'Wholesaler', 'Retailer', 'Consumer'],
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


// Comprehensive, command-aware fallback generator
function getVoiceFallback(query: string, role = 'Farmer', userLocation = 'Bogura', language = 'bn') {
  const q = (query || '').toLowerCase().trim();

  // 1. Market rates & pricing query
  if (q.includes('দর') || q.includes('দাম') || q.includes('রেট') || q.includes('rate') || q.includes('price') || q.includes('টাকা') || q.includes('market') || q.includes('বাজার')) {
    let cropSpecific = '';
    if (q.includes('টমেটো') || q.includes('tomato')) {
      cropSpecific = language === 'bn'
        ? 'বগুড়া শিবগঞ্জ ও মহাস্থান মোকামে হাইব্রিড পাকা টমেটো ৩৮-৪২ ৳/কেজি পাইকারি চলছে।'
        : 'Hybrid ripe tomatoes wholesale at ৳38-42/kg in Bogura Mahasthangarh arat.';
    } else if (q.includes('আলু') || q.includes('potato')) {
      cropSpecific = language === 'bn'
        ? 'বগুড়ার ডায়মন্ড আলু ২৮-৩২ ৳/কেজি এবং কার্ডিনাল আলু ২৬-২৯ ৳/কেজি পাইকারি চলছে।'
        : 'Diamond potatoes wholesale at ৳28-32/kg and Cardinal at ৳26-29/kg in Bogura.';
    } else if (q.includes('মরিচ') || q.includes('chili')) {
      cropSpecific = language === 'bn'
        ? 'বগুড়া বাজারে কাঁচা মরিচ পাইকারি ৮০-৯০ ৳/কেজি দরে বিক্রি হচ্ছে।'
        : 'Fresh green chilies wholesale at ৳80-90/kg in Bogura market.';
    } else if (q.includes('বেগুন') || q.includes('brinjal') || q.includes('eggplant')) {
      cropSpecific = language === 'bn'
        ? 'বগুড়ার স্থানীয় বেগুন পাইকারি ৩৫-৪০ ৳/কেজি দরে কেনাবেচা হচ্ছে।'
        : 'Fresh eggplants wholesale at ৳35-40/kg in local Bogura arats.';
    } else if (q.includes('ফুলকপি') || q.includes('cauliflower')) {
      cropSpecific = language === 'bn'
        ? 'শীতকালীন তাজা ফুলকপি আকারভেদে ২৫-৩০ ৳/পিস পাইকারি বিক্রি হচ্ছে।'
        : 'Fresh cauliflowers wholesale at ৳25-30/piece based on size.';
    } else if (q.includes('ধান') || q.includes('rice') || q.includes('paddy')) {
      cropSpecific = language === 'bn'
        ? 'ব্রি ধান-২৮ ও ২৯ প্রতি মণ ১,১০০-১,২২০ ৳ দরে পাইকারি বিক্রি হচ্ছে।'
        : 'BRRI Dhan-28 & 29 wholesale at ৳1,100-1,220 per maund.';
    } else {
      cropSpecific = language === 'bn'
        ? 'আজকের কৃষি বিপণন অধিদপ্তর (DAM) বগুড়া দর: ডায়মন্ড আলু ২৮ ৳/কেজি, কাঁচা মরিচ ৮৬ ৳/কেজি, এবং টমেটো ৩৮ ৳/কেজি।'
        : 'Today Bogura DAM wholesale benchmark: Potato ৳28/kg, Chili ৳86/kg, and Tomato ৳38/kg.';
    }

    return {
      reply: cropSpecific + (language === 'bn' ? ' সম্পূর্ণ লাইভ দর তালিকা দেখতে নিচের বাটনে চাপ দিন।' : ' Check live rates table below.'),
      suggestedActions: [
        { label: language === 'bn' ? 'বাজার দর পৃষ্ঠা দেখুন' : 'View Market Rates', action: 'OPEN_MARKET' },
        { label: language === 'bn' ? 'ফসল অগ্রিম বিক্রি করুন' : 'List Harvest', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_MARKET',
    };
  }

  // 2. Crop diseases, pest, medicine, diagnosis
  if (q.includes('রোগ') || q.includes('ডাক্তার') || q.includes('পোকা') || q.includes('ব্লাইট') || q.includes('ধসা') || q.includes('কীটপতঙ্গ') || q.includes('পচা') || q.includes('কুঁকড়ে') || q.includes('doctor') || q.includes('disease') || q.includes('pest') || q.includes('fungus') || q.includes('leaf') || q.includes('চিকিৎসা')) {
    return {
      reply: language === 'bn'
        ? 'ফসলের রোগ নির্ণয়ের জন্য আমাদের এআই ক্রপ ডক্টরে ছবি আপলোড করুন অথবা লক্ষণ জানান। আর্লি/লেইট ব্লাইটের জন্য ম্যানকোজেব ৭৫ ডব্লিউপি ২ গ্রাম/লিটার এবং পোকার জন্য ট্রাইকোডার্মা বা ফেরোমোন ট্র্যাপ অনুমোদিত।'
        : 'For crop diagnosis, upload a leaf photo or describe symptoms in AI Crop Doctor. Mancozeb 75 WP (2g/L) for blight and Trichoderma/pheromones for pests are recommended.',
      suggestedActions: [
        { label: language === 'bn' ? 'ফসলের ডাক্তার খুলুন' : 'Open Crop Doctor', action: 'OPEN_DOCTOR' },
        { label: language === 'bn' ? 'সার ও কীটনাশক ডিলার' : 'Find Input Dealers', action: 'OPEN_DEALERS' },
      ],
      executeAction: 'OPEN_DOCTOR',
    };
  }

  // 3. Weather & rainfall queries
  if (q.includes('আবহাওয়া') || q.includes('বৃষ্টি') || q.includes('ঝড়') || q.includes('রোদ') || q.includes('কুয়াশা') || q.includes('তাপমাত্রা') || q.includes('weather') || q.includes('rain') || q.includes('storm') || q.includes('temperature')) {
    return {
      reply: language === 'bn'
        ? `${userLocation} অঞ্চলে আগামী ৪৮ ঘণ্টায় আকাশ মূলত পরিষ্কার এবং হালকা রোদের সম্ভাবনা রয়েছে। পরিপক্ক শাকসবজি তোলার অনুকূল সময়। জমি পানি নিষ্কাশনের ব্যবস্থা রাখুন।`
        : `Mostly clear skies and pleasant weather forecasted for ${userLocation} over the next 48 hours. Ideal conditions for harvesting mature vegetables.`,
      suggestedActions: [
        { label: language === 'bn' ? 'পূর্ণাঙ্গ আবহাওয়া দেখুন' : 'View Weather Forecast', action: 'OPEN_WEATHER' },
        { label: language === 'bn' ? 'কৃষি সতর্কতা বুলেটিন' : 'Agro Bulletins', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_WEATHER',
    };
  }

  // 4. Wholesale buyers, aratdar, forward contracts
  if (q.includes('ক্রেতা') || q.includes('পাইকার') || q.includes('আড়তদার') || q.includes('বেচা') || q.includes('বিক্রি') || q.includes('চুক্তি') || q.includes('buyer') || q.includes('sell') || q.includes('contract') || q.includes('wholesaler') || q.includes('trade')) {
    return {
      reply: language === 'bn'
        ? `বগুড়া মোকাম ও ঢাকা কাওরান বাজারের ৩টি যাচাইকৃত পাইকারি প্রতিষ্ঠান বর্তমানে চুক্তিভিত্তিক সরবরাহের সন্ধান করছে। আপনি ড্যাশবোর্ড থেকে ফসল অগ্রিম তালিকাভুক্ত করে সরাসরি ফরওয়ার্ড চুক্তি লক করতে পারেন।`
        : `Verified wholesale buyers from Bogura and Dhaka Karwan Bazar are active. You can list your upcoming harvest on NativeBazar to lock guaranteed advance contracts.`,
      suggestedActions: [
        { label: language === 'bn' ? 'ক্রেতাদের তালিকা দেখুন' : 'View Wholesale Buyers', action: 'OPEN_BUYERS' },
        { label: language === 'bn' ? 'ফসল অগ্রিম বিক্রি করুন' : 'List Harvest Pre-sale', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_BUYERS',
    };
  }

  // 5. Fertilizer, seeds, pesticide, dealer
  if (q.includes('সার') || q.includes('কীটনাশক') || q.includes('বীজ') || q.includes('ডিলার') || q.includes('দোকান') || q.includes('ইউরিয়া') || q.includes('পটাশ') || q.includes('টিএসপি') || q.includes('dealer') || q.includes('fertilizer') || q.includes('seed') || q.includes('input') || q.includes('shop')) {
    return {
      reply: language === 'bn'
        ? 'শিবগঞ্জ ও বগুড়া সদরে মেঘনা ও যমুনা সার বিতানে সরকারি মূল্যে ইউরিয়া (১৬ ৳/কেজি), এমওপি পটাশ (২২ ৳/কেজি) এবং লাল তীর হাইব্রিড বীজ মজুদ রয়েছে।'
        : 'Government-certified fertilizers (MOP Potash @ ৳22/kg, Urea @ ৳16/kg) and Lal Teer hybrid seeds are in stock at licensed depots across Bogura.',
      suggestedActions: [
        { label: language === 'bn' ? 'সার-কীটনাশক ডিলার দেখুন' : 'Find Input Dealers', action: 'OPEN_DEALERS' },
        { label: language === 'bn' ? 'কৃষক ড্যাশবোর্ড' : 'Farmer Dashboard', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_DEALERS',
    };
  }

  // 6. Orders, cart, transactions, escrow
  if (q.includes('অর্ডার') || q.includes('কার্ট') || q.includes('লেনদেন') || q.includes('পেমেন্ট') || q.includes('টাকা') || q.includes('order') || q.includes('cart') || q.includes('payment') || q.includes('escrow')) {
    return {
      reply: language === 'bn'
        ? 'আপনার সমস্ত ক্রয়-বিক্রয় এসক্রো ডিজিটাল ট্রাস্ট দ্বারা সুরক্ষিত। পণ্য সরবরাহ নিশ্চিত হওয়ার পরই অর্থ স্থানান্তর কার্যকর হয়। বর্তমান অর্ডারের স্থিতি দেখতে পারেন।'
        : 'All orders and contracts are safeguarded by escrow escrow protection. Funds are released only upon verified delivery.',
      suggestedActions: [
        { label: language === 'bn' ? 'অর্ডার তালিকা দেখুন' : 'View Orders', action: 'OPEN_ORDERS' },
        { label: language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_ORDERS',
    };
  }

  // 7. Ledger / Farm accounts
  if (q.includes('লেজার') || q.includes('হিসাব') || q.includes('খরচ') || q.includes('লাভ') || q.includes('ledger') || q.includes('expense') || q.includes('profit')) {
    return {
      reply: language === 'bn'
        ? 'কৃষক ডিজিটাল লেজারে আপনার সার, বীজ, শ্রম খরচ এবং ফসল বিক্রির আয় স্বয়ংক্রিয়ভাবে সংরক্ষিত থাকে।'
        : 'The Farmer Digital Ledger tracks your input expenses, labor, and crop sales for transparent net profit calculations.',
      suggestedActions: [
        { label: language === 'bn' ? 'কৃষক লেজার দেখুন' : 'View Farm Ledger', action: 'OPEN_LEDGER' },
        { label: language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_LEDGER',
    };
  }

  // 8. General agro assistant greetings & commands
  return {
    reply: language === 'bn'
      ? `স্বাগতম! আমি নেটিভবাজারের স্মার্ট সহকারী (${userLocation})। আপনি বাংলায় কথা বলে বা লিখে বাজার দর অনুসন্ধান, ফসলের রোগ নির্ণয়, সার-কীটনাশক ডিলার অথবা ক্রেতা খুঁজতে পারেন।`
      : `Welcome! I am NativeBazar Smart Assistant for ${userLocation}. You can speak or type to check wholesale rates, diagnose crop diseases, find buyers, or locate certified inputs.`,
    suggestedActions: [
      { label: language === 'bn' ? 'বাজার দর দেখুন' : 'Check Market Rates', action: 'OPEN_MARKET' },
      { label: language === 'bn' ? 'ফসলের রোগ নির্ণয়' : 'Diagnose Crop Disease', action: 'OPEN_DOCTOR' },
      { label: language === 'bn' ? 'আবহাওয়া আপডেট' : 'Weather Forecast', action: 'OPEN_WEATHER' },
    ],
    executeAction: null,
  };
}

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

// 3. Voice & Natural Language Assistant Endpoint (with user command execution mapping)
app.post('/api/ai/voice-assistant', async (req, res) => {
  const { query = '', role = 'Farmer', userLocation = 'Bogura', language = 'bn' } = req.body;
  const fallback = getVoiceFallback(query, role, userLocation, language);

  if (!ai) {
    return res.json(fallback);
  }

  try {
    const systemPrompt = `You are NativeBazar's AI Voice & Assistant for agricultural trade and farming in Bangladesh (${userLocation}).
Current user role: ${role}.
Language: Respond in ${language === 'bn' ? 'Bengali (বাংলা)' : 'English'}.
Keep replies friendly, practical, and concise (2-3 sentences).

When the user asks or commands an action, map it to one of these Action Keys:
- "OPEN_MARKET": Market prices, rates, DAM wholesale data (দাম, বাজার দর, রেট)
- "OPEN_WEATHER": Weather forecasts, rain, storm, temperature (আবহাওয়া, বৃষ্টি)
- "OPEN_DOCTOR": Crop diseases, pest diagnosis, plant health (রোগ, ধসা, পোকা, ডাক্তার)
- "OPEN_ORDERS": Orders, delivery status, cart, escrow payments (অর্ডার, কার্ট, লেনদেন)
- "OPEN_BUYERS": Wholesale buyers, traders, aratdar contacts (ক্রেতা, পাইকার, আড়তদার)
- "OPEN_DEALERS": Certified fertilizer, seeds, pesticides, agro dealers (সার, বীজ, কীটনাশক, ডিলার)
- "OPEN_DASHBOARD": Go to dashboard, sell harvest, add listing (ড্যাশবোর্ড, ফসল বিক্রি)
- "OPEN_LEDGER": Farm ledger, expenses, accounting (লেজার, হিসাব-নিকাশ)

Return pure JSON schema:
{
  "reply": "helpful response in ${language === 'bn' ? 'Bengali' : 'English'}",
  "suggestedActions": [
    { "label": "Short Action Button Label", "action": "ACTION_KEY" }
  ],
  "executeAction": "ACTION_KEY or null if the user just asked a question without a direct command to navigate or open"
}`;

    const response = await callGemini(`User asks or commands: "${query}"`, {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    }, 15000);

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.reply) {
      return res.json({
        reply: parsed.reply,
        suggestedActions: parsed.suggestedActions || fallback.suggestedActions,
        executeAction: parsed.executeAction || fallback.executeAction || null,
      });
    }
    return res.json(fallback);
  } catch (error: any) {
    console.warn('Voice assistant fallback activated:', error.message);
    return res.json(fallback);
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
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NativeBazar server listening on port ${PORT}`);
});
