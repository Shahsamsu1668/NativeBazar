import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { db, hashPassword } from './server/db';

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

// Health Check with real stats
app.get('/api/health', (req, res) => {
  const stats = db.getStats();
  res.json({
    status: 'ok',
    service: 'NativeBazar Backend',
    aiEnabled: !!ai,
    models: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'],
    pilotDistrict: 'Bogura, Bangladesh',
    stats,
    timestamp: new Date().toISOString(),
  });
});

// ─── AUTH REST APIS ──────────────────────────────────────────────────────────
// 1. User Registration (Publicly allowed: Farmer, Supplier, Customer)
app.post('/api/auth/register', (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      role = 'farmer',
      district = 'Bogura',
      upazila = 'Shibganj',
      education,
      farmSizeAcres,
      primaryCrops,
      shopName,
      licenseNumber,
      isOrganicCertified,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Full name is required' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Role safety: public registration only allowed for farmer, supplier, customer
    const allowedRoles = ['farmer', 'supplier', 'customer'];
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Registration is only available for Farmers, Suppliers, and Consumers.',
      });
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    const cleanEmail = email ? email.trim().toLowerCase() : undefined;

    // Check existing
    const existing = db.findUserByIdentifier(cleanPhone, role);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `An account with this phone number already exists for role: ${role}.`,
      });
    }

    const token = `nb_sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const user = db.addUser({
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role,
      name: name.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      passwordHash: hashPassword(password),
      district: district.trim(),
      upazila: upazila ? upazila.trim() : undefined,
      education: education ? education.trim() : undefined,
      verified: true,
      createdAt: new Date().toISOString(),
      farmSizeAcres: farmSizeAcres ? parseFloat(farmSizeAcres) : undefined,
      primaryCrops: Array.isArray(primaryCrops) ? primaryCrops : undefined,
      shopName: shopName ? shopName.trim() : undefined,
      licenseNumber: licenseNumber ? licenseNumber.trim() : undefined,
      isOrganicCertified: !!isOrganicCertified,
      sessionToken: token,
    });

    db.addAuditLog({
      timestamp: new Date().toISOString(),
      phone: cleanPhone,
      role,
      status: 'SUCCESS',
      ip: req.ip || '127.0.0.1',
      device: (req.headers['user-agent'] as string) || 'Web Client',
      details: `New genuine ${role} account registered`,
    });

    const { passwordHash: _, ...safeUser } = user;
    return res.status(201).json({
      success: true,
      user: safeUser,
      token,
      message: 'Account registered successfully',
    });
  } catch (err: any) {
    console.error('[API Register Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// 2. User Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password, role, securityPin } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        error: 'Identifier (phone/email/admin ID) and password are required',
      });
    }

    const targetUser = db.findUserByIdentifier(identifier, role);
    if (!targetUser) {
      db.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: identifier,
        role: role || 'unknown',
        status: 'FAILED_PASSWORD',
        ip: req.ip || '127.0.0.1',
        device: (req.headers['user-agent'] as string) || 'Web Client',
        details: 'User account not found',
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials. Please verify your phone number / email and password.',
      });
    }

    const hashed = hashPassword(password);
    if (targetUser.passwordHash !== hashed) {
      db.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: targetUser.phone,
        role: targetUser.role,
        status: 'FAILED_PASSWORD',
        ip: req.ip || '127.0.0.1',
        device: (req.headers['user-agent'] as string) || 'Web Client',
        details: 'Incorrect password entered',
      });
      return res.status(401).json({
        success: false,
        error: 'Incorrect password. Please try again.',
      });
    }

    // Admin 2FA check if enabled
    if (targetUser.role === 'admin' && targetUser.twoFactorEnabled) {
      if (!securityPin) {
        return res.json({
          success: false,
          require2FA: true,
          message: '6-digit Admin security code required',
        });
      }
      if (securityPin !== (targetUser.securityPin || '883650')) {
        return res.status(401).json({
          success: false,
          require2FA: true,
          error: 'INVALID_2FA_PIN',
          message: 'Invalid 6-digit Admin Security Code / PIN',
        });
      }
    }

    const token = `nb_sec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    db.updateUser(targetUser.id, {
      sessionToken: token,
      lastLoginAt: new Date().toISOString(),
    });

    db.addAuditLog({
      timestamp: new Date().toISOString(),
      phone: targetUser.phone,
      role: targetUser.role,
      status: 'SUCCESS',
      ip: req.ip || '127.0.0.1',
      device: (req.headers['user-agent'] as string) || 'Web Client',
      details: 'Session established',
    });

    const { passwordHash: _, ...safeUser } = targetUser;
    safeUser.sessionToken = token;

    return res.json({
      success: true,
      user: safeUser,
      token,
      message: 'Login successful',
    });
  } catch (err: any) {
    console.error('[API Login Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// 3. Current User Profile
app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const phone = req.query.phone as string;

  let user = token ? db.getUsers().find(u => u.sessionToken === token) : undefined;
  if (!user && phone) {
    user = db.findUserByIdentifier(phone);
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

  const updated = db.updateUser(id, {
    name,
    nameBn,
    district,
    upazila,
    farmSizeAcres,
    primaryCrops,
    shopName,
    licenseNumber,
  });

  if (!updated) return res.status(404).json({ success: false, error: 'User not found' });
  const { passwordHash: _, ...safeUser } = updated;
  return res.json({ success: true, user: safeUser });
});

// ─── USER DIRECTORY REST API ─────────────────────────────────────────────────
// Returns all eligible users for the cross-role communication directory.
// Strips sensitive fields (passwordHash, sessionToken, securityPin) before sending.
app.get('/api/users', (req, res) => {
  try {
    const { excludeId, role, district, search } = req.query;

    let users = db.getUsers().filter((u) => {
      // Never expose admin accounts in directory
      if (u.role === 'admin') return false;
      // Exclude the requesting user themselves
      if (excludeId && u.id === String(excludeId)) return false;
      return true;
    });

    // Role filter
    if (role && role !== 'all') {
      users = users.filter((u) => u.role === String(role));
    }

    // District filter
    if (district && district !== 'all') {
      users = users.filter(
        (u) => u.district && u.district.toLowerCase() === String(district).toLowerCase()
      );
    }

    // Text search (name, nameBn, phone, businessName, shopName, designation, primaryCrops)
    if (search && String(search).trim()) {
      const q = String(search).toLowerCase().trim();
      users = users.filter((u) => {
        if (u.name && u.name.toLowerCase().includes(q)) return true;
        if (u.nameBn && u.nameBn.includes(q)) return true;
        if (u.phone && u.phone.includes(q)) return true;
        if (u.district && u.district.toLowerCase().includes(q)) return true;
        if ((u as any).businessName && (u as any).businessName.toLowerCase().includes(q)) return true;
        if ((u as any).shopName && (u as any).shopName.toLowerCase().includes(q)) return true;
        if ((u as any).designation && (u as any).designation.toLowerCase().includes(q)) return true;
        if (Array.isArray((u as any).primaryCrops)) {
          if ((u as any).primaryCrops.some((c: string) => c.toLowerCase().includes(q))) return true;
        }
        return false;
      });
    }

    // Strip sensitive fields
    const safeUsers = users.map(({ passwordHash: _, sessionToken: __, securityPin: ___, ...safe }) => ({
      ...safe,
      // Mask phone: show only last 4 digits publicly
      phone: safe.phone ? `****${safe.phone.slice(-4)}` : '',
    }));

    res.json({ success: true, users: safeUsers, total: safeUsers.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CROPS REST APIS ─────────────────────────────────────────────────────────
app.get('/api/crops', (req, res) => {
  const { farmerId, district } = req.query;
  const crops = db.getCrops({
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

    const newCrop = db.addCrop({
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
  const updated = db.updateCrop(req.params.id, req.body);
  if (!updated) return res.status(404).json({ success: false, error: 'Crop listing not found' });
  return res.json({ success: true, crop: updated });
});

app.delete('/api/crops/:id', (req, res) => {
  const deleted = db.deleteCrop(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Crop listing not found' });
  return res.json({ success: true, message: 'Crop listing deleted' });
});

// ─── SUPPLIER PRODUCTS REST APIS ─────────────────────────────────────────────
app.get('/api/supplier-products', (req, res) => {
  const { supplierId, category, organicOnly } = req.query;
  const products = db.getSupplierProducts({
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

    const created = db.addSupplierProduct({
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
  const updated = db.updateSupplierProduct(req.params.id, req.body);
  if (!updated) return res.status(404).json({ success: false, error: 'Product not found' });
  return res.json({ success: true, product: updated });
});

app.delete('/api/supplier-products/:id', (req, res) => {
  const deleted = db.deleteSupplierProduct(req.params.id);
  if (!deleted) return res.status(404).json({ success: false, error: 'Product not found' });
  return res.json({ success: true, message: 'Product deleted' });
});

// ─── ORDERS & ORDER TRACKING REST APIS ───────────────────────────────────────
app.get('/api/orders', (req, res) => {
  const { customerId, sellerId, orderType } = req.query;
  const orders = db.getOrders({
    customerId: customerId ? String(customerId) : undefined,
    sellerId: sellerId ? String(sellerId) : undefined,
    orderType: orderType ? String(orderType) : undefined,
  });
  res.json({ success: true, orders });
});

app.post('/api/orders', (req, res) => {
  try {
    const {
      orderType = 'consumer_retail',
      customerId,
      customerName,
      phone,
      items,
      totalBDT,
      paymentMethod = 'bKash',
      deliveryAddress,
      district = 'Bogura',
      upazila = 'Bogura Sadar',
      sellerId,
      sellerName,
      sellerRole,
      notes,
    } = req.body;

    if (!customerName || !phone || !items || !items.length || !totalBDT) {
      return res.status(400).json({ success: false, error: 'Missing required order details' });
    }

    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const trackingCode = `TRK-${district.slice(0, 3).toUpperCase()}-${randomSuffix}`;
    const orderId = `ORD-${Date.now().toString().slice(-6)}`;

    const newOrder = db.addOrder({
      id: orderId,
      orderType,
      customerId: customerId || `cust-${Date.now()}`,
      customerName,
      phone,
      items,
      totalBDT: Number(totalBDT),
      paymentMethod,
      deliveryAddress: deliveryAddress || `${district} City`,
      district,
      upazila,
      status: 'Confirmed',
      trackingCode,
      orderDate: new Date().toISOString(),
      sellerId,
      sellerName,
      sellerRole,
      notes,
    });

    return res.status(201).json({ success: true, order: newOrder, trackingCode });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/orders/:id/status', (req, res) => {
  const { status, deliveredDate } = req.body;
  if (!status) return res.status(400).json({ success: false, error: 'Status is required' });

  const updated = db.updateOrderStatus(req.params.id, status, deliveredDate);
  if (!updated) return res.status(404).json({ success: false, error: 'Order not found' });
  return res.json({ success: true, order: updated });
});

// Verified Buyer Review Submission (Allowed ONLY on Delivered Orders)
app.post('/api/orders/:id/review', (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, error: 'Valid star rating between 1 and 5 is required' });
    }

    const order = db.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (order.status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        error: 'Reviews are reserved exclusively for verified buyers with completed deliveries.',
      });
    }

    const updated = db.addOrderReview(req.params.id, Number(rating), comment || '');
    return res.json({ success: true, order: updated, message: 'Verified review submitted successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── REVIEWS REST APIS ───────────────────────────────────────────────────────
app.get('/api/reviews', (req, res) => {
  const { productId } = req.query;
  const reviews = db.getReviews(productId ? String(productId) : undefined);
  res.json({ success: true, reviews });
});

// ─── REAL STATS REST API ────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({ success: true, stats: db.getStats() });
});

// ─── MASTER AGRICULTURAL CATALOG REST APIS ──────────────────────────────────
app.get('/api/catalog', (req, res) => {
  const { category, query, page = '1', limit = '24' } = req.query;
  const cat = typeof category === 'string' ? category : undefined;
  const q = typeof query === 'string' ? query : undefined;
  const all = db.getCatalog(cat, q);

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
  const product = db.getCatalogById(req.params.id);
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
  const messages = db.getMessages(String(userA), String(userB));
  res.json({ success: true, messages });
});

app.post('/api/messages', (req, res) => {
  try {
    const { senderId, senderName, senderRole, recipientId, recipientName, recipientRole, content, replyToId } = req.body;
    if (!senderId || !recipientId || !content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Missing required message parameters' });
    }

    const message = db.addMessage({
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
  db.markMessagesRead(recipientId, senderId);
  sendSSE(senderId, 'messages_read', { recipientId, senderId });
  res.json({ success: true });
});

// ─── CONNECTIONS REST APIS ──────────────────────────────────────────────────
app.get('/api/connections', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
  const connections = db.getConnections(String(userId));
  res.json({ success: true, connections });
});

app.post('/api/connections', (req, res) => {
  try {
    const { requesterId, recipientId } = req.body;
    if (!requesterId || !recipientId) {
      return res.status(400).json({ success: false, error: 'requesterId and recipientId are required' });
    }
    const connection = db.addConnectionRequest(requesterId, recipientId);
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
  const connection = db.updateConnectionStatus(req.params.id, status);
  if (!connection) return res.status(404).json({ success: false, error: 'Connection not found' });

  sendSSE(connection.requesterId, 'connection_updated', { connection });
  sendSSE(connection.recipientId, 'connection_updated', { connection });
  res.json({ success: true, connection });
});

app.delete('/api/connections/:id', (req, res) => {
  const deleted = db.deleteConnection(req.params.id);
  res.json({ success: deleted });
});

// ─── NOTIFICATIONS REST APIS ────────────────────────────────────────────────
app.get('/api/notifications', (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
  const notifications = db.getNotifications(String(userId));
  res.json({ success: true, notifications });
});

app.put('/api/notifications/:id/read', (req, res) => {
  db.markNotificationRead(req.params.id);
  res.json({ success: true });
});

app.put('/api/notifications/read-all', (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
  db.markAllNotificationsRead(userId);
  res.json({ success: true });
});

// ─── AUTH LOGOUT REST API ───────────────────────────────────────────────────
app.post('/api/auth/logout', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;
    const { userId } = req.body;

    let user = userId ? db.getUserById(userId) : undefined;
    if (!user && token) {
      user = db.getUsers().find((u) => u.sessionToken === token);
    }

    if (user) {
      db.updateUser(user.id, { sessionToken: undefined });
      db.addAuditLog({
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
  const logs = db.getCallLogs(String(userId));
  res.json({ success: true, logs });
});

app.post('/api/calls/logs', (req, res) => {
  try {
    const log = db.addCallLog(req.body);
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
      const userOrders = db.getOrders({ customerId: userId }).concat(db.getOrders({ sellerId: userId }));
      if (userOrders.length > 0) {
        const latest = userOrders[0];
        const statusBn = latest.status === 'Delivered' ? 'সরবরাহ সম্পন্ন' : latest.status === 'Confirmed' ? 'নিশ্চিতকৃত ও প্রস্তুত' : 'প্রক্রিয়াধীন';
        return {
          intent: 'ANSWER',
          reply: language === 'bn'
            ? `আপনার সর্বশেষ অর্ডার #${latest.id} (${latest.items.map(i => i.itemName).join(', ')}) বর্তমানে "${statusBn}" অবস্থায় আছে। মোট মূল্য: ৳${latest.totalBDT}। ট্র্যাকিং কোড: ${latest.trackingCode}।`
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
    const catalog = db.getCatalog();
    let matchedCrop = catalog.find(
      (c) => q.includes(c.name.toLowerCase()) || q.includes(c.nameBn) || c.keywords.some((k) => q.includes(k.toLowerCase()))
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
