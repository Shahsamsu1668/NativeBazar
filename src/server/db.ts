import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

// Initialize SQLite Database in the workspace root
const dbPath = path.resolve(process.cwd(), 'nativebazar.db');
export const db = new Database(dbPath);

// Enable WAL mode for high performance concurrent reads and writes
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── INITIALIZE DATABASE TABLES ─────────────────────────────────────────────
export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      name_bn TEXT,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      district TEXT NOT NULL,
      upazila TEXT,
      verified INTEGER DEFAULT 1,
      farm_size_acres REAL,
      primary_crops TEXT,
      business_name TEXT,
      business_type TEXT,
      shop_name TEXT,
      license_number TEXT,
      trade_address TEXT,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

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
      quantity_kg REAL NOT NULL,
      available_kg REAL NOT NULL,
      min_order_kg REAL DEFAULT 1,
      price_per_kg REAL NOT NULL,
      market_price_per_kg REAL,
      quality_grade TEXT DEFAULT 'A',
      district TEXT NOT NULL,
      upazila TEXT,
      location_details TEXT,
      harvest_status TEXT,
      available_date TEXT,
      organic_certified INTEGER DEFAULT 0,
      image_url TEXT,
      description TEXT,
      farmer_origin TEXT,
      wholesaler_arat TEXT,
      procurement_date TEXT,
      safety_note TEXT,
      created_at TEXT NOT NULL
    );

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
      total_bdt REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT DEFAULT 'Pending',
      delivery_status TEXT DEFAULT 'Confirmed',
      delivery_address TEXT NOT NULL,
      district TEXT NOT NULL,
      tracking_code TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      bangla_name TEXT NOT NULL,
      quantity_kg REAL NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wholesaler_offers (
      id TEXT PRIMARY KEY,
      wholesaler_id TEXT NOT NULL,
      wholesaler_name TEXT NOT NULL,
      wholesaler_phone TEXT NOT NULL,
      business_name TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      crop_bangla TEXT NOT NULL,
      quantity_kg_needed REAL NOT NULL,
      fulfilled_kg REAL DEFAULT 0,
      offered_price_per_kg REAL NOT NULL,
      district TEXT NOT NULL,
      upazila TEXT,
      location TEXT NOT NULL,
      deadline TEXT NOT NULL,
      urgent INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS market_prices (
      id TEXT PRIMARY KEY,
      district TEXT NOT NULL,
      upazila TEXT,
      market_name TEXT NOT NULL,
      market_name_bn TEXT NOT NULL,
      crop_name TEXT NOT NULL,
      bangla_name TEXT NOT NULL,
      category TEXT NOT NULL,
      wholesale_price REAL NOT NULL,
      wholesale_dhaka REAL NOT NULL,
      retail_price REAL NOT NULL,
      unit TEXT DEFAULT 'kg',
      change_24h REAL DEFAULT 0,
      trend TEXT DEFAULT 'stable',
      source TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      type TEXT NOT NULL,
      amount REAL,
      actor_role TEXT,
      actor_name TEXT,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_target_role ON products(target_role);
    CREATE INDEX IF NOT EXISTS idx_products_seller_role ON products(seller_role);
    CREATE INDEX IF NOT EXISTS idx_products_district ON products(district);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
    CREATE INDEX IF NOT EXISTS idx_market_district ON market_prices(district);
  `);

  seedOfficialMarketPrices();
  seedWholesalerOffers();
  seedInitialProductCatalogs();
}

// ─── PASSWORD HASHING HELPER ────────────────────────────────────────────────
export function hashPassword(plainText: string, salt = 'nb_secure_salt_2026'): string {
  const hash = crypto.createHmac('sha256', salt).update(plainText).digest('hex');
  return `sha256_${hash}`;
}

export function verifyPassword(plainText: string, storedHash: string, salt = 'nb_secure_salt_2026'): boolean {
  if (!storedHash) return false;
  // Support legacy store hash format or standard sha256
  if (storedHash.startsWith('sha256_')) {
    const computed = hashPassword(plainText, salt);
    if (computed === storedHash) return true;
    // Check old store custom hash
    let oldHash = 5381;
    const combined = `${salt}:${plainText}`;
    for (let i = 0; i < combined.length; i++) {
      oldHash = ((oldHash << 5) + oldHash) + combined.charCodeAt(i);
      oldHash = oldHash & oldHash;
    }
    const hex = Math.abs(oldHash).toString(16).padStart(8, '0');
    if (storedHash === `sha256_${hex}_${plainText.length}`) return true;
  }
  return plainText === storedHash;
}

// ─── SEED OFFICIAL DAM MARKET PRICES ─────────────────────────────────────────
function seedOfficialMarketPrices() {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM market_prices');
  const { count } = countStmt.get() as { count: number };
  if (count > 0) return;

  const nowIso = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO market_prices (
      id, district, upazila, market_name, market_name_bn, crop_name, bangla_name,
      category, wholesale_price, wholesale_dhaka, retail_price, unit, change_24h,
      trend, source, last_updated
    ) VALUES (
      @id, @district, @upazila, @market_name, @market_name_bn, @crop_name, @bangla_name,
      @category, @wholesale_price, @wholesale_dhaka, @retail_price, @unit, @change_24h,
      @trend, @source, @last_updated
    )
  `);

  const initialRates = [
    {
      id: 'dam-bog-1',
      district: 'Bogura',
      upazila: 'Shibganj',
      market_name: 'Mahasthangarh Mokam & Arat',
      market_name_bn: 'মহাস্থানগড় মোকাম ও আড়ত',
      crop_name: 'Tomato (Hybrid Ripe)',
      bangla_name: 'হাইব্রিড পাকা টমেটো',
      category: 'Vegetables',
      wholesale_price: 38,
      wholesale_dhaka: 46,
      retail_price: 52,
      unit: 'kg',
      change_24h: 2.5,
      trend: 'up',
      source: 'Department of Agricultural Marketing (DAM)',
      last_updated: nowIso,
    },
    {
      id: 'dam-bog-2',
      district: 'Bogura',
      upazila: 'Bogura Sadar',
      market_name: 'Chak Jadu Wholesale Market',
      market_name_bn: 'চক জাদু পাইকারি বাজার',
      crop_name: 'Potato (Diamond Table)',
      bangla_name: 'ডায়মন্ড আলু (খাবার)',
      category: 'Tubers',
      wholesale_price: 28,
      wholesale_dhaka: 34,
      retail_price: 40,
      unit: 'kg',
      change_24h: -1.0,
      trend: 'down',
      source: 'Department of Agricultural Marketing (DAM)',
      last_updated: nowIso,
    },
    {
      id: 'dam-bog-3',
      district: 'Bogura',
      upazila: 'Sariakandi',
      market_name: 'Char Jamuna Mokam',
      market_name_bn: 'চর যমুনা মোকাম',
      crop_name: 'Green Chili (Fresh)',
      bangla_name: 'তাজা কাঁচা মরিচ',
      category: 'Spices',
      wholesale_price: 85,
      wholesale_dhaka: 110,
      retail_price: 130,
      unit: 'kg',
      change_24h: 5.0,
      trend: 'up',
      source: 'Department of Agricultural Marketing (DAM)',
      last_updated: nowIso,
    },
    {
      id: 'dam-bog-4',
      district: 'Bogura',
      upazila: 'Sherpur',
      market_name: 'Sherpur Grain Arat',
      market_name_bn: 'শেরপুর শস্য আড়ত',
      crop_name: 'Paddy / Rice (BRRI-28)',
      bangla_name: 'ব্রি ধান-২৮ (প্রতি মণ)',
      category: 'Grains',
      wholesale_price: 32,
      wholesale_dhaka: 36,
      retail_price: 64,
      unit: 'kg',
      change_24h: 0.5,
      trend: 'stable',
      source: 'Department of Agricultural Marketing (DAM)',
      last_updated: nowIso,
    },
    {
      id: 'dam-raj-1',
      district: 'Rajshahi',
      upazila: 'Paba',
      market_name: 'Baneswar Wholesale Arat',
      market_name_bn: 'বানেশ্বর হাট আড়ত',
      crop_name: 'Eggplant / Brinjal (Gol Begun)',
      bangla_name: 'গোল বেগুন',
      category: 'Vegetables',
      wholesale_price: 36,
      wholesale_dhaka: 48,
      retail_price: 55,
      unit: 'kg',
      change_24h: 1.5,
      trend: 'up',
      source: 'Department of Agricultural Marketing (DAM)',
      last_updated: nowIso,
    },
    {
      id: 'dam-dhk-1',
      district: 'Dhaka',
      upazila: 'Tejgaon',
      market_name: 'Karwan Bazar Central Arat',
      market_name_bn: 'কাওরান বাজার পাইকারি মোকাম',
      crop_name: 'Tomato (Table Grade A)',
      bangla_name: 'টমেটো গ্রেড-এ',
      category: 'Vegetables',
      wholesale_price: 46,
      wholesale_dhaka: 46,
      retail_price: 58,
      unit: 'kg',
      change_24h: 2.0,
      trend: 'up',
      source: 'Department of Agricultural Marketing (DAM)',
      last_updated: nowIso,
    },
    {
      id: 'dam-ran-1',
      district: 'Rangpur',
      upazila: 'Mithapukur',
      market_name: 'Mithapukur Haat',
      market_name_bn: 'মিঠাপুকুর হাট',
      crop_name: 'Winter Cauliflower',
      bangla_name: 'শীতকালীন তাজা ফুলকপি',
      category: 'Vegetables',
      wholesale_price: 24,
      wholesale_dhaka: 35,
      retail_price: 45,
      unit: 'kg',
      change_24h: -2.0,
      trend: 'down',
      source: 'Department of Agricultural Marketing (DAM)',
      last_updated: nowIso,
    },
  ];

  const insertMany = db.transaction((rates) => {
    for (const r of rates) insertStmt.run(r);
  });
  insertMany(initialRates);
}

// ─── SEED WHOLESALER PURCHASE OFFERS (Farmer-Only Intelligence) ──────────────
function seedWholesalerOffers() {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM wholesaler_offers');
  const { count } = countStmt.get() as { count: number };
  if (count > 0) return;

  const nowIso = new Date().toISOString();
  const insertStmt = db.prepare(`
    INSERT INTO wholesaler_offers (
      id, wholesaler_id, wholesaler_name, wholesaler_phone, business_name,
      crop_name, crop_bangla, quantity_kg_needed, fulfilled_kg, offered_price_per_kg,
      district, upazila, location, deadline, urgent, verified, notes, created_at
    ) VALUES (
      @id, @wholesaler_id, @wholesaler_name, @wholesaler_phone, @business_name,
      @crop_name, @crop_bangla, @quantity_kg_needed, @fulfilled_kg, @offered_price_per_kg,
      @district, @upazila, @location, @deadline, @urgent, @verified, @notes, @created_at
    )
  `);

  const initialOffers = [
    {
      id: 'bid-101',
      wholesaler_id: 'w-karwan-syndicate',
      wholesaler_name: 'Karwan Bazar Wholesale Arat Syndicate',
      wholesaler_phone: '01711209934',
      business_name: 'Karwan Bazar Agro Procurement Hub',
      crop_name: 'Hybrid Tomato',
      crop_bangla: 'হাইব্রিড পাকা টমেটো',
      quantity_kg_needed: 3000,
      fulfilled_kg: 800,
      offered_price_per_kg: 42,
      district: 'Bogura',
      upazila: 'Shibganj',
      location: 'Mahasthangarh Mokam Delivery Hub',
      deadline: 'Within 7 days',
      urgent: 1,
      verified: 1,
      notes: 'Immediate cash on crate inspection or verified escrow guarantee.',
      created_at: nowIso,
    },
    {
      id: 'bid-102',
      wholesaler_id: 'w-bogura-arat',
      wholesaler_name: 'Bogura Arat Sourcing Consortium',
      wholesaler_phone: '01712001122',
      business_name: 'North Bengal Cold Storage & Arat',
      crop_name: 'Diamond Potato',
      crop_bangla: 'ডায়মন্ড খাবার আলু',
      quantity_kg_needed: 10000,
      fulfilled_kg: 3500,
      offered_price_per_kg: 29,
      district: 'Bogura',
      upazila: 'Sherpur',
      location: 'Sherpur Highway Depot',
      deadline: 'Within 14 days',
      urgent: 0,
      verified: 1,
      notes: 'Grade A table potato. Sacks provided by buyer upon booking.',
      created_at: nowIso,
    },
    {
      id: 'bid-103',
      wholesaler_id: 'w-rajshahi-traders',
      wholesaler_name: 'Padma Agro Supply Traders',
      wholesaler_phone: '01822334455',
      business_name: 'Rajshahi Division Wholesale Arat',
      crop_name: 'Green Chili',
      crop_bangla: 'তাজা কাঁচা মরিচ',
      quantity_kg_needed: 1500,
      fulfilled_kg: 200,
      offered_price_per_kg: 88,
      district: 'Bogura',
      upazila: 'Sariakandi',
      location: 'Char Jamuna Ghat Mokam',
      deadline: 'Within 5 days',
      urgent: 1,
      verified: 1,
      notes: 'Freshly harvested dry chili; weight verified at digital weighbridge.',
      created_at: nowIso,
    },
  ];

  const insertMany = db.transaction((offers) => {
    for (const o of offers) insertStmt.run(o);
  });
  insertMany(initialOffers);
}

// ─── SEED INITIAL WORKING CATALOG PRODUCTS ──────────────────────────────────
// Note: These represent initial marketplace listings across the 3 supply stages
// so visitors can immediately test browsing, purchasing, and order workflows.
function seedInitialProductCatalogs() {
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM products');
  const { count } = countStmt.get() as { count: number };
  if (count > 0) return;

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
      @id, @seller_id, @seller_name, @seller_phone, @seller_role, @target_role,
      @crop_name, @bangla_name, @category, @variety, @quantity_kg, @available_kg,
      @min_order_kg, @price_per_kg, @market_price_per_kg, @quality_grade, @district,
      @upazila, @location_details, @harvest_status, @available_date, @organic_certified,
      @image_url, @description, @farmer_origin, @wholesaler_arat, @procurement_date,
      @safety_note, @created_at
    )
  `);

  const initialProducts = [
    // 1. RETAILER PRODUCTS -> FOR CONSUMERS (Shown in Social-Feed Marketplace)
    {
      id: 'prod-ret-101',
      seller_id: 'ret-bismillah-mart',
      seller_name: 'Bismillah Krishi & Organic Corner',
      seller_phone: '01719887766',
      seller_role: 'retailer',
      target_role: 'consumer',
      crop_name: 'Fresh Farm Table Tomatoes',
      bangla_name: 'তাজা হাইব্রিড পাকা টমেটো',
      category: 'Vegetables',
      variety: 'Hybrid Shingro-3',
      quantity_kg: 400,
      available_kg: 400,
      min_order_kg: 1,
      price_per_kg: 52,
      market_price_per_kg: 56,
      quality_grade: 'A',
      district: 'Bogura',
      upazila: 'Bogura Sadar',
      location_details: 'Jaleswaritola Market Outlet #14',
      harvest_status: 'Harvested Today',
      available_date: 'Ready for Home Delivery',
      organic_certified: 1,
      image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
      description: 'Hand-picked table tomatoes directly sourced from Shibganj farmer fields. Rich red color, firm pulp, free from artificial ripening agents.',
      farmer_origin: 'Shibganj Upazila, Bogura',
      wholesaler_arat: 'Mahasthangarh Wholesale Arat Hub',
      procurement_date: 'Sourced yesterday evening',
      safety_note: 'Tested 100% formalin-free and safe for fresh family dining.',
      created_at: nowIso,
    },
    {
      id: 'prod-ret-102',
      seller_id: 'ret-bismillah-mart',
      seller_name: 'Bismillah Krishi & Organic Corner',
      seller_phone: '01719887766',
      seller_role: 'retailer',
      target_role: 'consumer',
      crop_name: 'Bogura Diamond Red Potatoes',
      bangla_name: 'বগুড়ার ডায়মন্ড গোল আলু',
      category: 'Tubers',
      variety: 'Diamond Premium',
      quantity_kg: 850,
      available_kg: 850,
      min_order_kg: 2,
      price_per_kg: 38,
      market_price_per_kg: 42,
      quality_grade: 'A',
      district: 'Bogura',
      upazila: 'Sherpur',
      location_details: 'Bogura City Distribution Point',
      harvest_status: 'Farm Fresh',
      available_date: 'In Stock',
      organic_certified: 0,
      image_url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
      description: 'World-renowned Bogura Diamond table potatoes. Clean skin, optimal starch content, ideal for daily curry, mashed aloo bhorta and crispy fries.',
      farmer_origin: 'Sherpur Upazila, Bogura',
      wholesaler_arat: 'Sherpur Agro Highway Hub',
      procurement_date: 'Fresh cold-chain dispatch',
      safety_note: 'Unwashed natural skin preserves flavor and prevents bacterial growth.',
      created_at: nowIso,
    },
    {
      id: 'prod-ret-103',
      seller_id: 'ret-green-bazar',
      seller_name: 'Suborno Farm Fresh Retailers',
      seller_phone: '01723445566',
      seller_role: 'retailer',
      target_role: 'consumer',
      crop_name: 'Pungent Green Chilies (Spicy)',
      bangla_name: 'তাজা বগুড়ার কাঁচা মরিচ',
      category: 'Spices',
      variety: 'Char Bindu Hybrid',
      quantity_kg: 180,
      available_kg: 180,
      min_order_kg: 0.5,
      price_per_kg: 120,
      market_price_per_kg: 135,
      quality_grade: 'A',
      district: 'Bogura',
      upazila: 'Sariakandi',
      location_details: 'Town Central Grocery Pavilion',
      harvest_status: 'Harvested Today',
      available_date: 'Ready for Home Delivery',
      organic_certified: 1,
      image_url: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=800&auto=format&fit=crop&q=80',
      description: 'Ultra-fresh, crisp, aromatic green chilies grown on alluvial Jamuna riverbank fields. High capsaicin content and long shelf life.',
      farmer_origin: 'Sariakandi Char, Bogura',
      wholesaler_arat: 'Char Jamuna Mokam',
      procurement_date: 'Procured this morning at 6:00 AM',
      safety_note: 'Grown with organic compost; zero chemical pesticide spray in final 15 days.',
      created_at: nowIso,
    },
    {
      id: 'prod-ret-104',
      seller_id: 'ret-green-bazar',
      seller_name: 'Suborno Farm Fresh Retailers',
      seller_phone: '01723445566',
      seller_role: 'retailer',
      target_role: 'consumer',
      crop_name: 'Winter Crisp Cauliflower',
      bangla_name: 'তাজা সাদা ফুলকপি',
      category: 'Vegetables',
      variety: 'Snow White Early',
      quantity_kg: 250,
      available_kg: 250,
      min_order_kg: 1,
      price_per_kg: 42,
      market_price_per_kg: 48,
      quality_grade: 'A',
      district: 'Rangpur',
      upazila: 'Mithapukur',
      location_details: 'Central Wholesale Depo Outlet',
      harvest_status: 'Harvested Today',
      available_date: 'In Stock',
      organic_certified: 0,
      image_url: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=800&auto=format&fit=crop&q=80',
      description: 'Dense, white, crisp curd cauliflowers without yellow blemishes. Packed securely in ventilated crates.',
      farmer_origin: 'Mithapukur Upazila, Rangpur',
      wholesaler_arat: 'Mithapukur Haat',
      procurement_date: 'Delivered today at 7:30 AM',
      safety_note: 'Pre-washed with clean water and food-grade packaging.',
      created_at: nowIso,
    },

    // 2. WHOLESALER PRODUCTS -> FOR RETAILERS (Shown in Retailer Dashboard)
    {
      id: 'prod-who-201',
      seller_id: 'w-karwan-syndicate',
      seller_name: 'Karwan Bazar Wholesale Arat Syndicate',
      seller_phone: '01711209934',
      seller_role: 'wholesaler',
      target_role: 'retailer',
      crop_name: 'Bulk Hybrid Tomatoes (Crate Wholesale)',
      bangla_name: 'টমেটো পাইকারি ক্রেট (আড়ত)',
      category: 'Vegetables',
      variety: 'Hybrid Shingro-3',
      quantity_kg: 2500,
      available_kg: 2500,
      min_order_kg: 50,
      price_per_kg: 42,
      market_price_per_kg: 45,
      quality_grade: 'A',
      district: 'Bogura',
      upazila: 'Shibganj',
      location_details: 'Mahasthangarh Mokam Bay #3',
      harvest_status: 'Pre-sorted in 25kg Plastic Crates',
      available_date: 'Immediate dispatch',
      organic_certified: 0,
      image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
      description: 'Procured direct from contract farmers at Shibganj. Graded, sorted and packed in returnable standard crates.',
      farmer_origin: 'Shibganj Farmer Clusters',
      wholesaler_arat: 'Mahasthangarh Arat',
      procurement_date: 'Daily fresh arrival',
      safety_note: 'Verified quality grading by licensed Arat Inspector.',
      created_at: nowIso,
    },
    {
      id: 'prod-who-202',
      seller_id: 'w-bogura-arat',
      seller_name: 'Bogura Arat Sourcing Consortium',
      seller_phone: '01712001122',
      seller_role: 'wholesaler',
      target_role: 'retailer',
      crop_name: 'Diamond Potatoes Bulk (50kg Sacks)',
      bangla_name: 'ডায়মন্ড আলু ৫০ কেজি বস্তা (পাইকারি)',
      category: 'Tubers',
      variety: 'Diamond Table Grade',
      quantity_kg: 6000,
      available_kg: 6000,
      min_order_kg: 100,
      price_per_kg: 30,
      market_price_per_kg: 33,
      quality_grade: 'A',
      district: 'Bogura',
      upazila: 'Sherpur',
      location_details: 'Sherpur Highway Cold Depot',
      harvest_status: 'Sorted Jute Bags',
      available_date: 'Immediate dispatch',
      organic_certified: 0,
      image_url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
      description: 'Diamond table potatoes sorted for grocery retailers. Guaranteed under 2% sorting loss with moisture-free packing.',
      farmer_origin: 'Sherpur Contract Farmers',
      wholesaler_arat: 'North Bengal Cold Storage Hub',
      procurement_date: 'Stored under temperature-controlled climate',
      safety_note: 'Government certified weight verified at digital weighbridge.',
      created_at: nowIso,
    },

    // 3. FARMER PRODUCTS -> FOR WHOLESALERS (Shown in Wholesaler Dashboard)
    {
      id: 'prod-far-301',
      seller_id: 'far-shibganj-1',
      seller_name: 'Farmer Rafiqul Islam (Shibganj Hub)',
      seller_phone: '01712458920',
      seller_role: 'farmer',
      target_role: 'wholesaler',
      crop_name: 'Harvest Ready Hybrid Tomatoes',
      bangla_name: 'ক্ষেতের পাকা হাইব্রিড টমেটো (জমিতে প্রস্তুত)',
      category: 'Vegetables',
      variety: 'Shingro-3 Hybrid',
      quantity_kg: 3500,
      available_kg: 3500,
      min_order_kg: 200,
      price_per_kg: 38,
      market_price_per_kg: 40,
      quality_grade: 'A',
      district: 'Bogura',
      upazila: 'Shibganj',
      location_details: 'Chandanpur Village, Shibganj',
      harvest_status: 'Harvesting in Progress',
      available_date: 'Today & Tomorrow',
      organic_certified: 1,
      image_url: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
      description: '3.5 bigha farm harvest ready. Uniform size, firm texture, pesticide-safe. Buyer truck can load directly at farm road.',
      farmer_origin: 'Self-cultivated farm, Shibganj',
      wholesaler_arat: 'Available for Aratdar pickup',
      procurement_date: 'Direct farm gate harvest',
      safety_note: '14-day pre-harvest interval strictly maintained.',
      created_at: nowIso,
    },
    {
      id: 'prod-far-302',
      seller_id: 'far-sherpur-1',
      seller_name: 'Farmer Abul Kashem Mondol',
      seller_phone: '01823991204',
      seller_role: 'farmer',
      target_role: 'wholesaler',
      crop_name: 'Diamond Potatoes Farm Harvest',
      bangla_name: 'ডায়মন্ড আলু (মাঠ থেকে সরাসরি)',
      category: 'Tubers',
      variety: 'Diamond Seed Grade A',
      quantity_kg: 8000,
      available_kg: 8000,
      min_order_kg: 500,
      price_per_kg: 27,
      market_price_per_kg: 29,
      quality_grade: 'A',
      district: 'Bogura',
      upazila: 'Sherpur',
      location_details: 'Mirzapur Math, Sherpur',
      harvest_status: 'Freshly Dug from Soil',
      available_date: 'This week',
      organic_certified: 0,
      image_url: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
      description: 'High-yield Diamond potato crop. Completely rot-free and dry soil cured. Direct bulk arat contracts welcome.',
      farmer_origin: 'Mirzapur, Sherpur',
      wholesaler_arat: 'Direct field loading point',
      procurement_date: 'Freshly dug',
      safety_note: 'Proper curing ensures over 4 months storage life.',
      created_at: nowIso,
    },
  ];

  const insertMany = db.transaction((prods) => {
    for (const p of prods) insertStmt.run(p);
  });
  insertMany(initialProducts);
}

// ─── STRICT SUPPLY CHAIN ROLE VALIDATION ────────────────────────────────────
export function validateSupplyChainTrade(buyerRole: string, sellerRole: string) {
  const bRole = (buyerRole || '').toLowerCase();
  const sRole = (sellerRole || '').toLowerCase();

  // 1. Farmer -> Wholesaler: Only wholesalers purchase from farmers
  if (sRole === 'farmer') {
    if (bRole !== 'wholesaler') {
      throw new Error(`Rule Violation: Only Wholesalers are authorized to purchase directly from Farmers. Retailers and Consumers cannot buy from farmers.`);
    }
  }
  // 2. Wholesaler -> Retailer: Only retailers purchase from wholesalers
  else if (sRole === 'wholesaler') {
    if (bRole !== 'retailer') {
      throw new Error(`Rule Violation: Only Retailers are authorized to purchase wholesale stock from Wholesalers. Consumers cannot buy from wholesalers.`);
    }
  }
  // 3. Retailer -> Consumer: Retailers sell to consumers
  else if (sRole === 'retailer') {
    if (bRole !== 'consumer' && bRole !== 'customer') {
      throw new Error(`Rule Violation: Wholesalers and Farmers cannot purchase from Retailers.`);
    }
  } else {
    throw new Error(`Invalid seller role: "${sellerRole}". Must be farmer, wholesaler, or retailer.`);
  }

  return true;
}

// ─── ORDER MANAGEMENT & ATOMIC INVENTORY DEDUCTION ─────────────────────────
export interface CreateOrderParams {
  buyerId?: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  buyerRole: string;
  sellerId: string;
  sellerName: string;
  sellerPhone?: string;
  sellerRole: string;
  items: Array<{
    productId: string;
    quantityKg: number;
  }>;
  paymentMethod: string;
  deliveryAddress: string;
  district: string;
  notes?: string;
}

export function executeOrderTransaction(params: CreateOrderParams) {
  // 1. Validate supply chain rule
  validateSupplyChainTrade(params.buyerRole, params.sellerRole);

  const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const trackingCode = `TRK-${params.district.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowIso = new Date().toISOString();

  let orderType = 'retailer_to_consumer';
  if (params.sellerRole === 'farmer') orderType = 'farmer_to_wholesaler';
  else if (params.sellerRole === 'wholesaler') orderType = 'wholesaler_to_retailer';

  // Atomic SQLite transaction
  const performTransaction = db.transaction(() => {
    let grandTotal = 0;
    const processedItems: any[] = [];

    const getProductStmt = db.prepare('SELECT * FROM products WHERE id = ?');
    const updateProductStockStmt = db.prepare('UPDATE products SET available_kg = available_kg - ? WHERE id = ?');
    const insertOrderItemStmt = db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, crop_name, bangla_name, quantity_kg, unit_price, subtotal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. First validate all items and calculate grand total
    for (const item of params.items) {
      const prod = getProductStmt.get(item.productId) as any;
      if (!prod) {
        throw new Error(`Product with ID "${item.productId}" not found.`);
      }

      if (prod.seller_role !== params.sellerRole) {
        throw new Error(`Product seller role (${prod.seller_role}) does not match order seller (${params.sellerRole}).`);
      }

      if (item.quantityKg <= 0) {
        throw new Error(`Invalid requested quantity for "${prod.crop_name}": ${item.quantityKg} kg.`);
      }

      if (prod.available_kg < item.quantityKg) {
        throw new Error(`Insufficient stock for "${prod.crop_name}". Available: ${prod.available_kg} kg, Requested: ${item.quantityKg} kg.`);
      }

      const subtotal = prod.price_per_kg * item.quantityKg;
      grandTotal += subtotal;
    }

    // 2. Insert parent order record BEFORE child order items to satisfy foreign key constraint
    const insertOrderStmt = db.prepare(`
      INSERT INTO orders (
        id, order_type, buyer_id, buyer_name, buyer_phone, buyer_email, buyer_role,
        seller_id, seller_name, seller_phone, seller_role, total_bdt, payment_method,
        payment_status, delivery_status, delivery_address, district, tracking_code, notes,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `);

    insertOrderStmt.run(
      orderId,
      orderType,
      params.buyerId || 'guest-consumer',
      params.buyerName,
      params.buyerPhone,
      params.buyerEmail || null,
      params.buyerRole,
      params.sellerId,
      params.sellerName,
      params.sellerPhone || null,
      params.sellerRole,
      grandTotal,
      params.paymentMethod,
      params.paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Escrow Held',
      'Confirmed',
      params.deliveryAddress,
      params.district,
      trackingCode,
      params.notes || null,
      nowIso,
      nowIso
    );

    // 3. Insert order items and deduct inventory
    for (const item of params.items) {
      const prod = getProductStmt.get(item.productId) as any;
      const subtotal = prod.price_per_kg * item.quantityKg;

      // Deduct stock immediately within transaction
      const updateResult = updateProductStockStmt.run(item.quantityKg, item.productId);
      if (updateResult.changes === 0) {
        throw new Error(`Failed to deduct inventory for product ${item.productId}.`);
      }

      const itemId = `item-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      insertOrderItemStmt.run(
        itemId,
        orderId,
        prod.id,
        prod.crop_name,
        prod.bangla_name,
        item.quantityKg,
        prod.price_per_kg,
        subtotal
      );

      processedItems.push({
        id: itemId,
        productId: prod.id,
        cropName: prod.crop_name,
        banglaName: prod.bangla_name,
        quantityKg: item.quantityKg,
        unitPrice: prod.price_per_kg,
        subtotal,
      });
    }

    // Audit log
    const auditStmt = db.prepare(`
      INSERT INTO audit_logs (id, order_id, type, amount, actor_role, actor_name, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    auditStmt.run(
      `aud-${Date.now()}`,
      orderId,
      'ORDER_CREATED',
      grandTotal,
      params.buyerRole,
      params.buyerName,
      `${orderType} trade executed. ${processedItems.length} items. Total: ৳${grandTotal}. Tracking: ${trackingCode}`,
      nowIso
    );

    return {
      orderId,
      orderType,
      trackingCode,
      totalBDT: grandTotal,
      items: processedItems,
      deliveryStatus: 'Confirmed',
      paymentStatus: params.paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Escrow Held',
      createdAt: nowIso,
    };
  });

  return performTransaction();
}

// ─── ORDER CANCELLATION & INVENTORY RESTORATION ────────────────────────────
export function cancelOrderAndRestoreStock(orderId: string, actorName = 'User', actorRole = 'buyer') {
  const cancelTx = db.transaction(() => {
    const orderStmt = db.prepare('SELECT * FROM orders WHERE id = ?');
    const order = orderStmt.get(orderId) as any;
    if (!order) throw new Error(`Order ${orderId} not found.`);

    if (order.delivery_status === 'Cancelled') {
      return { success: true, message: 'Order was already cancelled.' };
    }

    if (order.delivery_status === 'Delivered') {
      throw new Error('Cannot cancel an order that has already been delivered.');
    }

    // Get items to restore stock
    const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const items = itemsStmt.all(orderId) as any[];

    const restoreStockStmt = db.prepare('UPDATE products SET available_kg = available_kg + ? WHERE id = ?');
    for (const it of items) {
      restoreStockStmt.run(it.quantity_kg, it.product_id);
    }

    const nowIso = new Date().toISOString();
    db.prepare('UPDATE orders SET delivery_status = ?, payment_status = ?, updated_at = ? WHERE id = ?')
      .run('Cancelled', 'Refunded', nowIso, orderId);

    db.prepare(`
      INSERT INTO audit_logs (id, order_id, type, amount, actor_role, actor_name, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `aud-${Date.now()}`,
      orderId,
      'ORDER_CANCELLED',
      order.total_bdt,
      actorRole,
      actorName,
      `Order ${orderId} cancelled by ${actorName}. Stock restored for ${items.length} items.`,
      nowIso
    );

    return { success: true, orderId, status: 'Cancelled' };
  });

  return cancelTx();
}

// Initialize on import
initDatabase();
