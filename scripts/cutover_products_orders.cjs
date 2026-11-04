const fs = require('fs');
const path = require('path');

const serverFile = path.resolve(__dirname, '../server.ts');
let code = fs.readFileSync(serverFile, 'utf8');

// 1. Update import from ./src/server/neonDb.js
const oldImport = `import {
  pool,
  initNeonDatabase,
  syncLegacyUsersToNeon,
} from './src/server/neonDb.js';`;

const newImport = `import {
  pool,
  initNeonDatabase,
  syncLegacyUsersToNeon,
  executeNeonOrderTransaction,
} from './src/server/neonDb.js';`;

if (!code.includes(oldImport)) {
  console.error('Failed to match oldImport in server.ts');
  process.exit(1);
}
code = code.replace(oldImport, newImport);
console.log('✓ Updated neonDb import in server.ts');

// 2. Replacement for Products & Orders routes (formerly lines 870 to 1311)
const startProductsMarker = `// Consumers ONLY see Retailer products
// Retailers ONLY see Wholesaler products
// Wholesalers ONLY see Farmer products
app.get('/api/products', (req, res) => {`;

const endOrdersMarker = `// ─── WHOLESALER BIDS & FARMER INTELLIGENCE (FARMER-ONLY) ─────────────────────`;

const pStartIdx = code.indexOf(startProductsMarker);
const pEndIdx = code.indexOf(endOrdersMarker);

if (pStartIdx === -1 || pEndIdx === -1) {
  console.error('Failed to locate Products & Orders block markers in server.ts');
  process.exit(1);
}

const neonProductsAndOrdersBlock = `// ─── NEON POSTGRESQL PRODUCTS & SUPPLY CHAIN CATALOG ─────────────────────────
// Strict supply chain visibility:
// Consumers ONLY see Retailer products (target_role = 'consumer')
// Retailers ONLY see Wholesaler products (target_role = 'retailer')
// Wholesalers ONLY see Farmer products (target_role = 'wholesaler')
app.get('/api/products', async (req, res) => {
  try {
    const { targetRole, sellerRole, sellerId, district, category, search, minAvailable = 0 } = req.query as any;

    let query = \`
      SELECT id, seller_id, seller_name, seller_phone, seller_role, target_role,
             crop_name, bangla_name, category, variety, unit, quantity, available_qty,
             quantity_kg, available_kg, min_order_qty, unit_price, price_per_kg,
             market_price, quality_grade, district, upazila, location_details,
             harvest_status, available_date, organic_certified, image_url, description,
             farmer_origin, wholesaler_arat, procurement_date, safety_note, created_at, updated_at
      FROM products
      WHERE harvest_status != 'Archived' AND available_qty > $1
    \`;
    const params: any[] = [Number(minAvailable) || 0];
    let idx = 2;

    if (targetRole) {
      query += \` AND target_role = $\${idx++}\`;
      params.push(targetRole);
    }
    if (sellerRole) {
      query += \` AND seller_role = $\${idx++}\`;
      params.push(sellerRole);
    }
    if (sellerId) {
      query += \` AND seller_id = $\${idx++}\`;
      params.push(sellerId);
    }
    if (district && district !== 'All') {
      query += \` AND district = $\${idx++}\`;
      params.push(district);
    }
    if (category && category !== 'All') {
      query += \` AND category = $\${idx++}\`;
      params.push(category);
    }
    if (search) {
      query += \` AND (crop_name ILIKE $\${idx} OR bangla_name ILIKE $\${idx} OR seller_name ILIKE $\${idx})\`;
      params.push(\`%\${search}%\`);
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

    const prodId = \`prod-\${sRole.slice(0, 3)}-\${Date.now()}\`;
    const finalMarketPrice = marketPricePerKg ? Number(marketPricePerKg) : finalPrice * 1.15;

    await pool.query(\`
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
    \`, [
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
      message: \`Product successfully published for \${targetRole}s!\`,
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

    await pool.query(\`
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
    \`, [
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

    return res.status(201).json({
      success: true,
      message: 'Order confirmed successfully via Neon PostgreSQL!',
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
        query += \` AND buyer_id = $\${idx++}\`;
        params.push(targetBuyer);
      } else if (sellerId) {
        query += \` AND seller_id = $\${idx++}\`;
        params.push(sellerId);
      } else if (userId) {
        query += \` AND (buyer_id = $\${idx} OR seller_id = $\${idx})\`;
        params.push(userId);
        idx++;
      }
      if (role) {
        query += \` AND (buyer_role = $\${idx} OR seller_role = $\${idx})\`;
        params.push(role);
        idx++;
      }
    } else {
      // Non-admins strictly access only orders where they are buyer or seller
      query += \` AND (buyer_id = $\${idx} OR seller_id = $\${idx})\`;
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

    const fullOrders = orderRows.map((o) => ({
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
      deliveryStatus: o.delivery_status,
      status: o.delivery_status,
      deliveryAddress: o.delivery_address,
      district: o.district,
      trackingCode: o.tracking_code,
      notes: o.notes,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
      items: itemsByOrderId.get(o.id) || [],
    }));

    return res.json({ success: true, orders: fullOrders, total: fullOrders.length });
  } catch (err: any) {
    console.error('Error fetching Neon orders:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Update order status in Neon (or cancel with stock restoration)
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

    if (status === 'Cancelled') {
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
          "UPDATE orders SET delivery_status = 'Cancelled', updated_at = NOW() WHERE id = $1",
          [id]
        );
        await client.query(\`
          INSERT INTO trade_audit_logs (id, order_id, type, amount, actor_role, actor_name, description, created_at)
          VALUES ($1, $2, 'ORDER_CANCELLED', $3, $4, $5, $6, NOW())
        \`, [
          \`aud-cancel-\${Date.now()}\`, id, order.total_bdt, authUser.role, authUser.name,
          \`Order \${id} cancelled by \${authUser.name} (\${authUser.role}). Stock restored.\`
        ]);
        await client.query('COMMIT');
        return res.json({ success: true, message: \`Order \${id} cancelled and inventory restored.\` });
      } catch (cancelErr: any) {
        await client.query('ROLLBACK');
        throw cancelErr;
      } finally {
        client.release();
      }
    }

    await pool.query(
      'UPDATE orders SET delivery_status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );

    return res.json({ success: true, message: \`Order status updated to \${status}.\` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

`;

code = code.slice(0, pStartIdx) + neonProductsAndOrdersBlock + code.slice(pEndIdx);
console.log('✓ Replaced Products & Orders block with Neon implementation');

// 3. Replacement for Crops routes (formerly lines 1892 to 2065)
const cropsStartMarker = `// ─── CROPS REST APIS ─────────────────────────────────────────────────────────
app.get('/api/crops', (req, res) => {`;
const cropsEndMarker = `// ─── SUPPLIER PRODUCTS REST APIS ───────────────────────────────────────────`;

const cStartIdx = code.indexOf(cropsStartMarker);
const cEndIdx = code.indexOf(cropsEndMarker);

if (cStartIdx === -1 || cEndIdx === -1) {
  console.error('Failed to locate Crops block markers in server.ts');
  process.exit(1);
}

const neonCropsBlock = `// ─── NEON CROPS REST APIS (VIEW & PRODUCTS UNIFIED) ─────────────────────────
app.get('/api/crops', async (req, res) => {
  try {
    const { farmerId, district } = req.query;
    let query = 'SELECT * FROM crops WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (farmerId) {
      query += \` AND "farmerId" = $\${idx++}\`;
      params.push(String(farmerId));
    }
    if (district && district !== 'All') {
      query += \` AND district = $\${idx++}\`;
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

    const prodId = \`crop-\${Date.now()}-\${Math.random().toString(36).slice(2, 6)}\`;
    const finalMarketPrice = marketBenchmarkPrice ? Number(marketBenchmarkPrice) : Number(expectedPricePerKg) * 1.15;

    await pool.query(\`
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
    \`, [
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
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot modify another farmer\\'s crops.' });
    }

    const { expectedPricePerKg, quantityKg, availableKg, qualityGrade, status, availableDate, imageUrl } = req.body;

    await pool.query(\`
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
    \`, [
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
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot delete another farmer\\'s crops.' });
    }

    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Crop listing deleted' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

`;

code = code.slice(0, cStartIdx) + neonCropsBlock + code.slice(cEndIdx);
console.log('✓ Replaced Crops block with Neon implementation');

// 4. Replacement for legacy orders endpoint (lines 2167 to 2184)
const legStartMarker = `// ─── ORDERS & ORDER TRACKING REST APIS ───────────────────────────────────────
app.get('/api/legacy/orders', requireAuth, (req: AuthenticatedRequest, res) => {`;
const legEndMarker = `// Verified Buyer Review Submission (Allowed ONLY on Delivered Orders)`;

const lStartIdx = code.indexOf(legStartMarker);
const lEndIdx = code.indexOf(legEndMarker);

if (lStartIdx === -1 || lEndIdx === -1) {
  console.error('Failed to locate legacy orders block markers in server.ts');
  process.exit(1);
}

const neonLegacyOrdersBlock = `// ─── NEON ORDERS & ORDER TRACKING REST APIS ─────────────────────────────────
app.get('/api/legacy/orders', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const authUser = req.user!;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];
    let idx = 1;

    if (authUser.role === 'admin') {
      const { customerId, sellerId } = req.query;
      if (customerId) {
        query += \` AND buyer_id = $\${idx++}\`;
        params.push(String(customerId));
      } else if (sellerId) {
        query += \` AND seller_id = $\${idx++}\`;
        params.push(String(sellerId));
      }
    } else {
      query += \` AND (buyer_id = $\${idx} OR seller_id = $\${idx})\`;
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

`;

code = code.slice(0, lStartIdx) + neonLegacyOrdersBlock + code.slice(lEndIdx);
console.log('✓ Replaced Legacy Orders block with Neon implementation');

fs.writeFileSync(serverFile, code, 'utf8');
console.log('=== server.ts SUCCESSFULLY CUTOVER TO NEON POSTGRESQL ===');

