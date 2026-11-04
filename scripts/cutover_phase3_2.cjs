const fs = require('fs');
const path = require('path');

console.log('--- Starting Phase 3.2 Cutover ---');

// 1. Process server.ts
const serverPath = path.resolve('server.ts');
let serverCode = fs.readFileSync(serverPath, 'utf8');

const marker1Start = '// ─── WHOLESALER BIDS & FARMER INTELLIGENCE (FARMER-ONLY) ─────────────────────';
const marker1End = '// Admin Metrics & System Overview';

const replacement1 = `// ─── WHOLESALER BIDS & FARMER INTELLIGENCE (NEON POSTGRESQL) ─────────────────────

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
      query += \` AND district = $\${idx++}\`;
      params.push(district);
    }
    if (crop) {
      query += \` AND (crop_name ILIKE $\${idx} OR crop_bangla ILIKE $\${idx})\`;
      params.push(\`%\${crop}%\`);
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

    const offerId = \`bid-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;

    const insertRes = await pool.query(\`
      INSERT INTO wholesaler_offers (
        id, wholesaler_id, wholesaler_name, wholesaler_phone, business_name,
        crop_name, crop_bangla, quantity_kg_needed, fulfilled_kg, offered_price_per_kg,
        district, upazila, location, deadline, urgent, verified, notes, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, 0, $9,
        $10, $11, $12, $13, $14, true, $15, NOW()
      ) RETURNING *
    \`, [
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
      return res.status(403).json({ error: 'Forbidden: You cannot modify another wholesaler\\'s offer.' });
    }

    const {
      quantityKgNeeded, fulfilledKg, offeredPricePerKg, district, upazila,
      location, deadline, urgent, notes, cropName, cropBangla
    } = req.body;

    const updated = await pool.query(\`
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
    \`, [
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
      return res.status(403).json({ error: 'Forbidden: You cannot delete another wholesaler\\'s offer.' });
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

    const priceId = \`mp-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;
    const ins = await pool.query(\`
      INSERT INTO market_prices (
        id, district, upazila, market_name, market_name_bn, crop_name, bangla_name,
        category, wholesale_price, wholesale_dhaka, retail_price, unit, change_24h,
        trend, source, last_updated
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, NOW()
      ) RETURNING *
    \`, [
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
    const upd = await pool.query(\`
      UPDATE market_prices
      SET wholesale_price = COALESCE($1, wholesale_price),
          wholesale_dhaka = COALESCE($2, wholesale_dhaka),
          retail_price = COALESCE($3, retail_price),
          change_24h = COALESCE($4, change_24h),
          trend = COALESCE($5, trend),
          last_updated = NOW()
      WHERE id = $6
      RETURNING *
    \`, [
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

`;

const idx1Start = serverCode.indexOf(marker1Start);
const idx1End = serverCode.indexOf(marker1End);

if (idx1Start === -1 || idx1End === -1) {
  throw new Error('Could not find Marker 1 boundaries');
}

serverCode = serverCode.slice(0, idx1Start) + replacement1 + serverCode.slice(idx1End);
console.log('Replaced Section 1: Wholesaler Offers & Market Prices in server.ts');

const marker2Start = '// ─── DIRECT MESSAGING REST APIS ─────────────────────────────────────────────';
const marker2End = '// ─── AUTH LOGOUT REST API ───────────────────────────────────────────────────';

const replacement2 = `// ─── NEON NOTIFICATIONS HELPER ──────────────────────────────────────────────
async function createNeonNotification(
  userId: string,
  title: string,
  message: string,
  type: string = 'info',
  actionUrl?: string
) {
  const notifId = \`notif-\${Date.now()}-\${Math.random().toString(36).slice(2, 7)}\`;
  const now = new Date();
  await pool.query(
    \`INSERT INTO notifications (id, user_id, title, message, type, action_url, read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, $7)\`,
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
  } catch {}
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

    const result = await pool.query(\`
      SELECT * FROM messages
      WHERE (sender_id = $1 AND recipient_id = $2)
         OR (sender_id = $2 AND recipient_id = $1)
      ORDER BY created_at ASC
    \`, [uA, uB]);

    const messages = result.rows.map(formatMessageRow);
    return res.json({ success: true, messages });
  } catch (err: any) {
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

    // Verify recipient existence in Neon users
    const recipRes = await pool.query('SELECT id, name, role FROM users WHERE id = $1', [recipientId]);
    if (recipRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Recipient user not found.' });
    }
    const recipient = recipRes.rows[0];

    const messageId = \`msg-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;
    const ins = await pool.query(\`
      INSERT INTO messages (
        id, sender_id, sender_name, sender_role,
        recipient_id, recipient_name, recipient_role,
        content, read, reply_to_id, message_type, created_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, false, $9, 'text', NOW()
      ) RETURNING *
    \`, [
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

    // Durable notification in Neon PostgreSQL
    const notif = await createNeonNotification(
      recipient.id,
      \`New message from \${effectiveSenderName}\`,
      content.trim().slice(0, 100),
      'message',
      \`/contacts?tab=chat&userId=\${effectiveSenderId}\`
    );

    // Real-time dispatch via SSE
    sendSSE(recipient.id, 'new_message', { message: formattedMessage });
    sendSSE(effectiveSenderId, 'message_sent', { message: formattedMessage });

    return res.status(201).json({ success: true, message: formattedMessage, notificationId: notif.id });
  } catch (err: any) {
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

    await pool.query(\`
      UPDATE messages
      SET read = true
      WHERE recipient_id = $1 AND sender_id = $2 AND read = false
    \`, [effectiveRecipientId, String(senderId)]);

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

    const result = await pool.query(\`
      SELECT * FROM connections
      WHERE requester_id = $1 OR recipient_id = $1
      ORDER BY created_at DESC
    \`, [targetUserId]);

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
    const existingRes = await pool.query(\`
      SELECT * FROM connections
      WHERE (requester_id = $1 AND recipient_id = $2)
         OR (requester_id = $2 AND recipient_id = $1)
    \`, [effectiveRequesterId, recipientId]);

    if (existingRes.rows.length > 0) {
      const activeConn = existingRes.rows.find((c: any) => c.status === 'pending' || c.status === 'accepted');
      if (activeConn) {
        return res.status(400).json({
          success: false,
          error: \`Connection already \${activeConn.status}.\`,
          connection: formatConnectionRow(activeConn),
        });
      }
    }

    const connId = \`conn-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`;
    const ins = await pool.query(\`
      INSERT INTO connections (
        id, requester_id, requester_name, requester_role, requester_phone, requester_district,
        recipient_id, recipient_name, recipient_role, recipient_phone, recipient_district,
        status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        'pending', NOW(), NOW()
      ) RETURNING *
    \`, [
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
      \`\${requester.name} (\${requester.role}) wants to connect with you.\`,
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

    const upd = await pool.query(\`
      UPDATE connections
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    \`, [status, req.params.id]);

    const formattedConn = formatConnectionRow(upd.rows[0]);

    // Send persistent notification to requester in Neon
    await createNeonNotification(
      existing.requester_id,
      \`Connection \${status === 'accepted' ? 'Accepted' : 'Declined'}\`,
      \`\${existing.recipient_name} has \${status} your connection request.\`,
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
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot delete another user\\'s connection.' });
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

    const result = await pool.query(\`
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    \`, [targetUserId]);

    const notifications = result.rows.map(formatNotificationRow);
    return res.json({ success: true, notifications });
  } catch (err: any) {
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
      return res.status(403).json({ success: false, error: 'Forbidden: You cannot mark another user\\'s notification as read.' });
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

`;

const idx2Start = serverCode.indexOf(marker2Start);
const idx2End = serverCode.indexOf(marker2End);

if (idx2Start === -1 || idx2End === -1) {
  throw new Error('Could not find Marker 2 boundaries');
}

serverCode = serverCode.slice(0, idx2Start) + replacement2 + serverCode.slice(idx2End);
console.log('Replaced Section 2: Direct Messaging, Connections, Notifications in server.ts');

fs.writeFileSync(serverPath, serverCode, 'utf8');
console.log('Saved server.ts successfully!');

// 2. Process src/services/apiService.ts
const apiServicePath = path.resolve('src/services/apiService.ts');
let apiServiceCode = fs.readFileSync(apiServicePath, 'utf8');

// Ensure credentials: 'include' is set for direct messaging, connections, notifications
apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/messages?userA=\${encodeURIComponent(userA)}&userB=\${encodeURIComponent(userB)}\`);`,
  `const res = await fetch(\`\${BASE_URL}/messages?userA=\${encodeURIComponent(userA)}&userB=\${encodeURIComponent(userB)}\`, { credentials: 'include' });`
);

apiServiceCode = apiServiceCode.replace(
  `      const res = await fetch(\`\${BASE_URL}/messages\`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify(payload),\n      });`,
  `      const res = await fetch(\`\${BASE_URL}/messages\`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        credentials: 'include',\n        body: JSON.stringify(payload),\n      });`
);

apiServiceCode = apiServiceCode.replace(
  `      const res = await fetch(\`\${BASE_URL}/messages/read\`, {\n        method: 'PUT',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ recipientId, senderId }),\n      });`,
  `      const res = await fetch(\`\${BASE_URL}/messages/read\`, {\n        method: 'PUT',\n        headers: { 'Content-Type': 'application/json' },\n        credentials: 'include',\n        body: JSON.stringify({ recipientId, senderId }),\n      });`
);

apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/connections?userId=\${encodeURIComponent(userId)}\`);`,
  `const res = await fetch(\`\${BASE_URL}/connections?userId=\${encodeURIComponent(userId)}\`, { credentials: 'include' });`
);

apiServiceCode = apiServiceCode.replace(
  `      const res = await fetch(\`\${BASE_URL}/connections\`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ requesterId, recipientId }),\n      });`,
  `      const res = await fetch(\`\${BASE_URL}/connections\`, {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },\n        credentials: 'include',\n        body: JSON.stringify({ requesterId, recipientId }),\n      });`
);

apiServiceCode = apiServiceCode.replace(
  `      const res = await fetch(\`\${BASE_URL}/connections/\${id}\`, {\n        method: 'PUT',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ status }),\n      });`,
  `      const res = await fetch(\`\${BASE_URL}/connections/\${id}\`, {\n        method: 'PUT',\n        headers: { 'Content-Type': 'application/json' },\n        credentials: 'include',\n        body: JSON.stringify({ status }),\n      });`
);

apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/connections/\${id}\`, { method: 'DELETE' });`,
  `const res = await fetch(\`\${BASE_URL}/connections/\${id}\`, { method: 'DELETE', credentials: 'include' });`
);

apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/notifications?userId=\${encodeURIComponent(userId)}\`);`,
  `const res = await fetch(\`\${BASE_URL}/notifications?userId=\${encodeURIComponent(userId)}\`, { credentials: 'include' });`
);

apiServiceCode = apiServiceCode.replace(
  `const res = await fetch(\`\${BASE_URL}/notifications/\${id}/read\`, { method: 'PUT' });`,
  `const res = await fetch(\`\${BASE_URL}/notifications/\${id}/read\`, { method: 'PUT', credentials: 'include' });`
);

apiServiceCode = apiServiceCode.replace(
  `      const res = await fetch(\`\${BASE_URL}/notifications/read-all\`, {\n        method: 'PUT',\n        headers: { 'Content-Type': 'application/json' },\n        body: JSON.stringify({ userId }),\n      });`,
  `      const res = await fetch(\`\${BASE_URL}/notifications/read-all\`, {\n        method: 'PUT',\n        headers: { 'Content-Type': 'application/json' },\n        credentials: 'include',\n        body: JSON.stringify({ userId }),\n      });`
);

fs.writeFileSync(apiServicePath, apiServiceCode, 'utf8');
console.log('Saved src/services/apiService.ts with credentials: "include" successfully!');

console.log('--- Phase 3.2 Cutover completed ---');

