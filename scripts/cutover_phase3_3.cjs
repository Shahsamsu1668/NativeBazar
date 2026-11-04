const fs = require('fs');
const path = require('path');

console.log('=== Executing Phase 3.3 Cutover Script ===');

// 1. Cutover server.ts
const serverPath = path.resolve('server.ts');
let serverCode = fs.readFileSync(serverPath, 'utf8');

// Section 1: Reviews and Catalog
const m1Start = '// Verified Buyer Review Submission (Allowed ONLY on Delivered Orders)';
const m1End = '// ─── REAL-TIME SSE (SERVER-SENT EVENTS) ENGINE ──────────────────────────────';

const idx1Start = serverCode.indexOf(m1Start);
const idx1End = serverCode.indexOf(m1End);

if (idx1Start === -1 || idx1End === -1) {
  throw new Error('Marker 1 boundaries not found in server.ts');
}

const section1Replacement = `// ─── REVIEWS REST APIS (NEON POSTGRESQL) ────────────────────────────────────

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

    const reviewId = \`rev-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;
    const ins = await pool.query(\`
      INSERT INTO reviews (
        id, order_id, product_id, user_id, user_name, rating, comment, verified_purchase, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, true, NOW()
      ) RETURNING *
    \`, [
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
      query += \` AND product_id = $\${idx++}\`;
      params.push(String(productId));
    }
    if (orderId) {
      query += \` AND order_id = $\${idx++}\`;
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

    const reviewId = \`rev-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;
    const ins = await pool.query(\`
      INSERT INTO reviews (
        id, order_id, product_id, user_id, user_name, rating, comment, verified_purchase, created_at
      ) VALUES (
        $1, null, $2, $3, $4, $5, $6, false, NOW()
      ) RETURNING *
    \`, [
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
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot delete another user\\'s review.' });
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
      sql += \` AND category = $\${idx++}\`;
      params.push(String(category));
    }
    if (query) {
      sql += \` AND (name ILIKE $\${idx} OR name_bn ILIKE $\${idx} OR description_en ILIKE $\${idx} OR description_bn ILIKE $\${idx})\`;
      params.push(\`%\${query}%\`);
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

    const id = req.body.id || \`cat-custom-\${Date.now()}\`;
    const ins = await pool.query(\`
      INSERT INTO catalog (
        id, name, name_bn, category, category_label_en, category_label_bn,
        unit, unit_bn, keywords, image_url, dam_benchmark_price, description_bn, description_en
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13
      ) RETURNING *
    \`, [
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

    const upd = await pool.query(\`
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
    \`, [
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

`;

serverCode = serverCode.slice(0, idx1Start) + section1Replacement + serverCode.slice(idx1End);
console.log('✓ Replaced Section 1: Reviews and Catalog in server.ts');

// Section 2: Call Logs, Farmer Expenses, Negotiations
const m2Start = "app.get('/api/calls/logs'";
const m2End = '// ─── ALL 64 BANGLADESH DISTRICTS REAL WEATHER ENGINE ────────────────────────';

const idx2Start = serverCode.indexOf(m2Start);
const idx2End = serverCode.indexOf(m2End);

if (idx2Start === -1 || idx2End === -1) {
  throw new Error('Marker 2 boundaries not found in server.ts');
}

const section2Replacement = `// ─── CALL LOGS REST APIS (NEON POSTGRESQL) ──────────────────────────────────

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
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot view another user\\'s call logs.' });
    }

    const targetUserId = authUser.role === 'admin' ? requestedUserId : authUser.id;

    const result = await pool.query(\`
      SELECT * FROM call_logs
      WHERE caller_id = $1 OR receiver_id = $1
      ORDER BY timestamp DESC
      LIMIT 100
    \`, [targetUserId]);

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

    const logId = \`call-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;
    const ins = await pool.query(\`
      INSERT INTO call_logs (
        id, caller_id, caller_name, caller_role,
        receiver_id, receiver_name, receiver_role, receiver_phone,
        status, duration_seconds, timestamp
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, NOW()
      ) RETURNING *
    \`, [
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
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot inspect another farmer\\'s expense ledger.' });
    }

    const targetFarmerId = authUser.role === 'admin' ? requestedFarmerId : authUser.id;

    const result = await pool.query(\`
      SELECT * FROM farmer_expenses
      WHERE farmer_id = $1
      ORDER BY date DESC, created_at DESC
    \`, [targetFarmerId]);

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
    const expenseId = \`exp-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;

    const ins = await pool.query(\`
      INSERT INTO farmer_expenses (
        id, farmer_id, date, type, category, description, description_bn,
        amount_bdt, crop_related, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, NOW(), NOW()
      ) RETURNING *
    \`, [
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

app.put('/api/farmer/expenses/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    const expRes = await pool.query('SELECT * FROM farmer_expenses WHERE id = $1', [req.params.id]);
    if (expRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Expense record not found.' });
    }

    const existing = expRes.rows[0];
    if (existing.farmer_id !== authUser.id && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot modify another farmer\\'s ledger.' });
    }

    const { date, type, category, description, descriptionBn, amountBDT, cropRelated } = req.body;

    const upd = await pool.query(\`
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
    \`, [
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
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot delete another farmer\\'s ledger.' });
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
      const result = await pool.query(\`
        SELECT n.*, p.crop_name, p.bangla_name, p.seller_id, p.seller_name
        FROM negotiations n
        JOIN products p ON n.listing_id = p.id
        WHERE n.listing_id = $1
        ORDER BY n.created_at DESC
      \`, [String(listingId)]);

      // If caller is not seller or admin, they can only view negotiations where they are the buyer
      let filtered = result.rows;
      if (product.seller_id !== authUser.id && authUser.role !== 'admin') {
        filtered = filtered.filter((r: any) => r.buyer_id === authUser.id);
      }

      return res.json({ success: true, negotiations: filtered.map(formatNegotiationRow) });
    }

    // No listingId provided: return user's active negotiations (as buyer or seller)
    const result = await pool.query(\`
      SELECT n.*, p.crop_name, p.bangla_name, p.seller_id, p.seller_name
      FROM negotiations n
      JOIN products p ON n.listing_id = p.id
      WHERE n.buyer_id = $1 OR p.seller_id = $1
      ORDER BY n.created_at DESC
    \`, [authUser.id]);

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

    const negId = \`neg-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;
    const ins = await pool.query(\`
      INSERT INTO negotiations (
        id, listing_id, demand_id, buyer_id, buyer_name, buyer_phone,
        offered_price_per_kg, quantity_kg, message, status, counter_price, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, 'Pending', null, NOW(), NOW()
      ) RETURNING *
    \`, [
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
      \`\${buyerName} offered ৳\${price}/kg for \${qty}kg of \${product.crop_name}.\`,
      'negotiation',
      \`/products/\${listingId}\`
    );

    return res.status(201).json({ success: true, negotiation: formattedNeg });
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

    const negRes = await pool.query(\`
      SELECT n.*, p.seller_id, p.crop_name
      FROM negotiations n
      JOIN products p ON n.listing_id = p.id
      WHERE n.id = $1
    \`, [req.params.id]);

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

    const upd = await pool.query(\`
      UPDATE negotiations
      SET status = $1,
          counter_price = COALESCE($2, counter_price),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    \`, [status, parsedCounterPrice, req.params.id]);

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
        \`Negotiation \${status}\`,
        \`Your negotiation for \${negotiation.crop_name} was marked \${status}\${parsedCounterPrice ? \` at ৳\${parsedCounterPrice}/kg\` : ''}.\`,
        'negotiation',
        \`/products/\${negotiation.listing_id}\`
      );
    }

    return res.json({ success: true, negotiation: formattedNeg });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

`;

serverCode = serverCode.slice(0, idx2Start) + section2Replacement + serverCode.slice(idx2End);
console.log('✓ Replaced Section 2: Call Logs, Farmer Expenses, Negotiations in server.ts');

fs.writeFileSync(serverPath, serverCode, 'utf8');
console.log('Saved server.ts successfully!');

// 2. Update src/services/apiService.ts
const apiServicePath = path.resolve('src/services/apiService.ts');
let apiServiceCode = fs.readFileSync(apiServicePath, 'utf8');

// Ensure credentials: 'include' for calls and reviews
apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/orders/\${orderId}/review\`, {`,
  `const res = await fetch(\`\${BASE_URL}/orders/\${orderId}/review\`, {\n        credentials: 'include',`
);

apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(url);`,
  `const res = await fetch(url, { credentials: 'include' });`
);

apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/catalog?\${params.toString()}\`);`,
  `const res = await fetch(\`\${BASE_URL}/catalog?\${params.toString()}\`, { credentials: 'include' });`
);

apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/catalog/\${id}\`);`,
  `const res = await fetch(\`\${BASE_URL}/catalog/\${id}\`, { credentials: 'include' });`
);

apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/calls/logs?userId=\${encodeURIComponent(userId)}\`);`,
  `const res = await fetch(\`\${BASE_URL}/calls/logs?userId=\${encodeURIComponent(userId)}\`, { credentials: 'include' });`
);

apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/calls/logs\`, {`,
  `const res = await fetch(\`\${BASE_URL}/calls/logs\`, {\n        credentials: 'include',`
);

// Add Farmer Expenses & Negotiations methods to apiService
if (!apiServiceCode.includes('getFarmerExpenses')) {
  const insertMarker = '  // ── Logout ───────────────────────────────────────────────────────────';
  const newMethods = `  // ── Farmer Expense Ledger (Neon PostgreSQL) ──────────────────────────
  async getFarmerExpenses(farmerId?: string): Promise<{ success: boolean; expenses: any[]; totalExpenses: number; totalIncome: number; netProfit: number }> {
    try {
      const qs = farmerId ? \`?farmerId=\${encodeURIComponent(farmerId)}\` : '';
      const res = await fetch(\`\${BASE_URL}/farmer/expenses\${qs}\`, { credentials: 'include' });
      return await res.json();
    } catch {
      return { success: false, expenses: [], totalExpenses: 0, totalIncome: 0, netProfit: 0 };
    }
  },

  async addFarmerExpense(payload: any): Promise<ApiResponse> {
    try {
      const res = await fetch(\`\${BASE_URL}/farmer/expenses\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async deleteFarmerExpense(id: string): Promise<ApiResponse> {
    try {
      const res = await fetch(\`\${BASE_URL}/farmer/expenses/\${id}\`, {
        method: 'DELETE',
        credentials: 'include',
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Price Negotiations (Neon PostgreSQL) ──────────────────────────────
  async getNegotiations(listingId?: string): Promise<{ success: boolean; negotiations: any[] }> {
    try {
      const qs = listingId ? \`?listingId=\${encodeURIComponent(listingId)}\` : '';
      const res = await fetch(\`\${BASE_URL}/negotiations\${qs}\`, { credentials: 'include' });
      return await res.json();
    } catch {
      return { success: false, negotiations: [] };
    }
  },

  async createNegotiation(payload: any): Promise<ApiResponse> {
    try {
      const res = await fetch(\`\${BASE_URL}/negotiations\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async updateNegotiation(id: string, updates: any): Promise<ApiResponse> {
    try {
      const res = await fetch(\`\${BASE_URL}/negotiations/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

`;
  apiServiceCode = apiServiceCode.replace(insertMarker, newMethods + insertMarker);
  console.log('✓ Added Expense and Negotiation methods to src/services/apiService.ts');
}

fs.writeFileSync(apiServicePath, apiServiceCode, 'utf8');
console.log('Saved src/services/apiService.ts successfully!');

// 3. Update src/components/FarmerDashboard.tsx to sync expenses with backend
const fdPath = path.resolve('src/components/FarmerDashboard.tsx');
let fdCode = fs.readFileSync(fdPath, 'utf8');

// Ensure apiService is imported
if (!fdCode.includes('apiService')) {
  fdCode = fdCode.replace(
    "import { productApi, orderApi, intelligenceApi } from '../services/api';",
    "import { productApi, orderApi, intelligenceApi } from '../services/api';\nimport { apiService } from '../services/apiService';"
  );
}

// Update loadExpenses in FarmerDashboard
if (!fdCode.includes('loadExpensesFromServer')) {
  const loadExpensesFunc = `  const loadExpensesFromServer = async () => {
    try {
      const res = await apiService.getFarmerExpenses(currentUser.id);
      if (res.success && Array.isArray(res.expenses)) {
        setLedgerEntries(res.expenses);
        ExpenseStore.syncWithServer(res.expenses);
      } else {
        setLedgerEntries(ExpenseStore.getAll().filter((e) => e.farmerId === currentUser.id));
      }
    } catch {
      setLedgerEntries(ExpenseStore.getAll().filter((e) => e.farmerId === currentUser.id));
    }
  };
`;
  fdCode = fdCode.replace(
    "  useEffect(() => {\n    loadIntelligence();\n    loadMyProducts();\n    loadReceivedOrders();\n    setLedgerEntries(ExpenseStore.getAll().filter((e) => e.farmerId === currentUser.id));\n  }, [currentUser.id, selectedDistrict]);",
    loadExpensesFunc + "\n  useEffect(() => {\n    loadIntelligence();\n    loadMyProducts();\n    loadReceivedOrders();\n    loadExpensesFromServer();\n  }, [currentUser.id, selectedDistrict]);"
  );

  // Update handleAddLedgerEntry
  const targetAdd = `  const handleAddLedgerEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: ExpenseLedgerEntry = {
      id: \`ledger-\${Date.now()}\`,
      farmerId: currentUser.id,
      ...ledgerForm,
    };
    ExpenseStore.add(entry);
    setShowLedgerModal(false);
    setLedgerForm({
      type: 'expense',
      category: 'Fertilizer',
      description: '',
      amountBDT: 0,
      date: new Date().toISOString().split('T')[0],
    });
    setLedgerEntries(ExpenseStore.getAll().filter((entry) => entry.farmerId === currentUser.id));
  };`;

  const replaceAdd = `  const handleAddLedgerEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    const entryData = {
      farmerId: currentUser.id,
      ...ledgerForm,
    };
    try {
      const res = await apiService.addFarmerExpense(entryData);
      if (res.success && (res as any).expense) {
        ExpenseStore.add((res as any).expense);
      } else {
        ExpenseStore.add({ id: \`ledger-\${Date.now()}\`, ...entryData });
      }
    } catch {
      ExpenseStore.add({ id: \`ledger-\${Date.now()}\`, ...entryData });
    }
    setShowLedgerModal(false);
    setLedgerForm({
      type: 'expense',
      category: 'Fertilizer',
      description: '',
      amountBDT: 0,
      date: new Date().toISOString().split('T')[0],
    });
    loadExpensesFromServer();
  };`;

  if (fdCode.includes('const handleAddLedgerEntry = (e: React.FormEvent) => {')) {
    fdCode = fdCode.replace(targetAdd, replaceAdd);
    console.log('✓ Updated handleAddLedgerEntry in FarmerDashboard.tsx');
  }
}

fs.writeFileSync(fdPath, fdCode, 'utf8');

// 4. Update src/data/store.ts
const storePath = path.resolve('src/data/store.ts');
let storeCode = fs.readFileSync(storePath, 'utf8');

if (!storeCode.includes('syncWithServer')) {
  storeCode = storeCode.replace(
    '  delete(id: string): void {\n    setItem(KEYS.EXPENSE_LEDGER, this.getAll().filter(e => e.id !== id));\n  },',
    `  delete(id: string): void {
    setItem(KEYS.EXPENSE_LEDGER, this.getAll().filter(e => e.id !== id));
  },

  syncWithServer(serverEntries: ExpenseLedgerEntry[]): void {
    if (Array.isArray(serverEntries)) {
      setItem(KEYS.EXPENSE_LEDGER, serverEntries);
    }
  },`
  );
  console.log('✓ Added syncWithServer to ExpenseStore in src/data/store.ts');
  fs.writeFileSync(storePath, storeCode, 'utf8');
}

console.log('=== Phase 3.3 Cutover successfully applied! ===');
