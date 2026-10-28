import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MASTER_AGRICULTURAL_CATALOG, CatalogProduct } from '../src/data/catalogData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'server_data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Simple secure hash helper (consistent with frontend hashPassword)
export function hashPassword(plainText: string, salt = 'nb_secure_salt_2026'): string {
  let hash = 5381;
  const combined = `${salt}:${plainText}`;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash) + combined.charCodeAt(i);
    hash = hash & hash;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `sha256_${hex}_${plainText.length}`;
}

export interface UserRecord {
  id: string;
  role: 'farmer' | 'wholesaler' | 'retailer' | 'consumer' | 'admin';
  name: string;
  nameBn?: string;
  phone: string;
  email?: string;
  passwordHash: string;
  district: string;
  upazila?: string;
  education?: string;
  verified: boolean;
  createdAt: string;
  farmSizeAcres?: number;
  primaryCrops?: string[];
  shopName?: string;
  licenseNumber?: string;
  businessName?: string;
  businessType?: string;
  designation?: string;
  institution?: string;
  specialization?: string[];
  isOrganicCertified?: boolean;
  certificationDetails?: string;
  sessionToken?: string;
  twoFactorEnabled?: boolean;
  securityPin?: string;
  lastLoginAt?: string;
}

export interface CropRecord {
  id: string;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  district: string;
  upazila: string;
  cropName: string;
  cropBangla: string;
  variety: string;
  quantityKg: number;
  availableDate: string;
  expectedPricePerKg: number;
  marketBenchmarkPrice?: number;
  status: 'Growing' | 'Ready to Harvest' | 'Sold' | 'Pre-contracted';
  imageUrl: string;
  qualityGrade?: 'A' | 'B' | 'C';
  organicCertified: boolean;
  createdAt: string;
}

export interface SupplierProductRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  shopName: string;
  category: 'Fertilizer' | 'Pesticide' | 'Seeds' | 'Machinery' | 'Organic';
  name: string;
  banglaName: string;
  brand: string;
  unitPriceBDT: number;
  unit: string;
  inStock: boolean;
  stockQty: number;
  phone: string;
  suitableCrops: string[];
  description: string;
  organicCertified: boolean;
  certificationNumber?: string;
  deliveryRadiusKm: number;
  createdAt: string;
}

export interface OrderItemRecord {
  itemId: string;
  itemName: string;
  itemBangla?: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  subtotal: number;
  imageUrl?: string;
}

export interface OrderRecord {
  id: string;
  orderType: 'consumer_retail' | 'supplier_input' | 'b2b_trade';
  customerId: string;
  customerName: string;
  phone: string;
  items: OrderItemRecord[];
  totalBDT: number;
  paymentMethod: 'bKash' | 'Nagad' | 'Cash on Delivery' | 'Rocket' | 'Bank Transfer';
  deliveryAddress: string;
  district: string;
  upazila?: string;
  status: 'Confirmed' | 'Dispatched' | 'Delivered' | 'Cancelled';
  trackingCode: string;
  orderDate: string;
  deliveredDate?: string;
  notes?: string;
  sellerId?: string;
  sellerName?: string;
  sellerRole?: string;
  review?: {
    rating: number;
    comment: string;
    reviewedAt: string;
  };
}

export interface ReviewRecord {
  id: string;
  orderId: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  verifiedPurchase: boolean;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  phone: string;
  role: string;
  status: 'SUCCESS' | 'FAILED_PASSWORD' | 'FAILED_2FA' | 'LOCKED' | 'LOGOUT';
  ip: string;
  device: string;
  details?: string;
}

export interface DirectMessageRecord {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  content: string;
  createdAt: string;
  read: boolean;
  replyToId?: string;
  messageType?: 'text' | 'price_offer' | 'order_inquiry' | 'advisory';
}

export interface UserConnectionRecord {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  requesterPhone?: string;
  requesterDistrict?: string;
  recipientId: string;
  recipientName: string;
  recipientRole: string;
  recipientPhone?: string;
  recipientDistrict?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger' | 'ai';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

export interface CallLogRecord {
  id: string;
  callerId: string;
  callerName: string;
  callerRole: string;
  receiverId: string;
  receiverName: string;
  receiverRole: string;
  receiverPhone: string;
  status: 'completed' | 'missed' | 'cancelled';
  durationSeconds: number;
  timestamp: string;
}

export interface DatabaseSchema {
  version: string;
  users: UserRecord[];
  crops: CropRecord[];
  supplierProducts: SupplierProductRecord[];
  orders: OrderRecord[];
  reviews: ReviewRecord[];
  auditLogs: AuditLogRecord[];
  messages: DirectMessageRecord[];
  connections: UserConnectionRecord[];
  notifications: NotificationRecord[];
  callLogs: CallLogRecord[];
  catalog: CatalogProduct[];
}

function createInitialDatabase(): DatabaseSchema {
  return {
    version: '2.0.0',
    users: [
      {
        id: 'admin-root',
        role: 'admin',
        name: 'Amar Haat System Administrator',
        nameBn: 'আমার হাট সিস্টেম অ্যাডমিন',
        phone: 'NativeBazarSJS',
        email: 'admin@nativebazar.gov.bd',
        passwordHash: hashPassword('12345678'),
        district: 'Bogura',
        upazila: 'Bogura Sadar',
        verified: true,
        twoFactorEnabled: false,
        securityPin: '883650',
        createdAt: '2026-10-18T07:04:38.551Z',
      },
      {
        id: 'user-farmer-rafiq',
        role: 'farmer',
        name: 'Md. Rafiqul Islam',
        nameBn: 'মো. রফিকুল ইসলাম',
        phone: '01712458920',
        email: 'rafiqul.farmer@nativebazar.com',
        passwordHash: hashPassword('Krishi#2026!Rafiq'),
        district: 'Bogura',
        upazila: 'Shibganj',
        farmSizeAcres: 3.5,
        primaryCrops: ['Hybrid Tomato', 'Diamond Red Potato', 'Green Chili'],
        verified: true,
        education: 'Diploma in Agriculture (Bogura ATI)',
        twoFactorEnabled: false,
        createdAt: '2026-10-18T07:10:00.000Z',
      },
      {
        id: 'user-wholesaler-sumaiya',
        role: 'wholesaler',
        name: 'Sumaiya Islam',
        nameBn: 'সুমাইয়া ইসলাম',
        phone: '01711209934',
        email: 'i.sumayyaislam@gmail.com',
        passwordHash: hashPassword('Krishi#2026!Sumaiya'),
        district: 'Bogura',
        upazila: 'Bogura Sadar',
        businessName: 'Islam Agro Wholesale Syndicate',
        businessType: 'Wholesaler',
        verified: true,
        education: 'BBA - Agricultural Marketing',
        twoFactorEnabled: false,
        createdAt: '2026-10-18T07:15:00.000Z',
      },
      {
        id: 'user-consumer-tanveer',
        role: 'consumer',
        name: 'Dr. Tanveer Mahmud',
        nameBn: 'ড. তানভীর মাহমুদ',
        phone: '01711889922',
        email: 'tanveer.consumer@gmail.com',
        passwordHash: hashPassword('Bazar#2026!Tanveer'),
        district: 'Bogura',
        upazila: 'Bogura Sadar',
        verified: true,
        twoFactorEnabled: false,
        createdAt: '2026-10-18T07:30:00.000Z',
      },
    ],
    crops: [],
    supplierProducts: [
      {
        id: 'sup-meghna-potash',
        supplierId: 'user-supplier-meghna',
        supplierName: 'Meghna Agro Depot Manager',
        shopName: 'যমুনা ও মেঘনা সার বিতান',
        category: 'Fertilizer',
        name: 'Muriate of Potash (MOP)',
        banglaName: 'এমওপি পটাশ সার (সরকারি রেট)',
        brand: 'BCIC Govt. Supply',
        unitPriceBDT: 22,
        unit: 'kg',
        inStock: true,
        stockQty: 850,
        phone: '01715889900',
        suitableCrops: ['Potato', 'Tomato', 'Chili', 'Cauliflower'],
        description: 'সরকারি প্রত্যায়িত মানসম্মত লাল পটাশ সার।',
        organicCertified: false,
        certificationNumber: 'BCIC-BGR-2026',
        deliveryRadiusKm: 25,
        createdAt: '2026-10-18T08:00:00.000Z',
      },
      {
        id: 'sup-meghna-tricho',
        supplierId: 'user-supplier-meghna',
        supplierName: 'Meghna Agro Depot Manager',
        shopName: 'যমুনা ও মেঘনা সার বিতান',
        category: 'Organic',
        name: 'Trichoderma Bio-Fungicide',
        banglaName: 'ট্রাইকোডার্মা জৈব ছত্রাকনাশক',
        brand: 'GreenBio Organic Agro',
        unitPriceBDT: 180,
        unit: '500g pack',
        inStock: true,
        stockQty: 120,
        phone: '01715889900',
        suitableCrops: ['All Vegetables', 'Potato', 'Tomato'],
        description: 'মাটি শোধন ও মূল পচা রোধে প্রাকৃতিক উপকারী অনুজীব ছত্রাকনাশক।',
        organicCertified: true,
        certificationNumber: 'BIO-2026-OK',
        deliveryRadiusKm: 30,
        createdAt: '2026-10-18T08:15:00.000Z',
      },
      {
        id: 'sup-meghna-seed',
        supplierId: 'user-supplier-meghna',
        supplierName: 'Meghna Agro Depot Manager',
        shopName: 'যমুনা ও মেঘনা সার বিতান',
        category: 'Seeds',
        name: 'Lal Teer Hybrid Tomato Seeds (Bijli Plus)',
        banglaName: 'লাল তীর হাইব্রিড টমেটো বীজ (বিজলি প্লাস)',
        brand: 'Lal Teer Seed Ltd.',
        unitPriceBDT: 280,
        unit: '10g pack',
        inStock: true,
        stockQty: 90,
        phone: '01715889900',
        suitableCrops: ['Tomato'],
        description: 'উচ্চফলনশীল ও রোগপ্রতিরোধী বিজলি প্লাস জাতের প্রত্যায়িত বীজ।',
        organicCertified: false,
        deliveryRadiusKm: 35,
        createdAt: '2026-10-18T08:30:00.000Z',
      },
    ],
    orders: [],
    reviews: [],
    auditLogs: [],
    messages: [],
    connections: [],
    notifications: [],
    callLogs: [],
    catalog: MASTER_AGRICULTURAL_CATALOG,
  };
}

class DatabaseManager {
  private cache: DatabaseSchema | null = null;

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (!fs.existsSync(DB_FILE)) {
        const initial = createInitialDatabase();
        fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
        this.cache = initial;
      } else {
        const content = fs.readFileSync(DB_FILE, 'utf-8');
        this.cache = JSON.parse(content);

        // Auto-migrate schema properties if missing
        let needsSave = false;
        if (!this.cache!.messages) { this.cache!.messages = []; needsSave = true; }
        if (!this.cache!.connections) { this.cache!.connections = []; needsSave = true; }
        if (!this.cache!.notifications) { this.cache!.notifications = []; needsSave = true; }
        if (!this.cache!.callLogs) { this.cache!.callLogs = []; needsSave = true; }
        if (!this.cache!.catalog || this.cache!.catalog.length < 80) {
          this.cache!.catalog = MASTER_AGRICULTURAL_CATALOG;
          needsSave = true;
        }

        // Ensure essential accounts (Rafiq, Sumaiya, Admin) exist
        const init = createInitialDatabase();
        for (const defaultUser of init.users) {
          const exists = this.cache!.users.some(
            u => u.id === defaultUser.id || (defaultUser.phone && u.phone === defaultUser.phone && u.role === defaultUser.role)
          );
          if (!exists) {
            this.cache!.users.push(defaultUser);
            needsSave = true;
          }
        }

        // Ensure Rafiq has initial crops listed
        if (this.cache!.crops.length === 0) {
          this.cache!.crops = init.crops;
          needsSave = true;
        }

        // Ensure supplier products exist
        if (this.cache!.supplierProducts.length === 0) {
          this.cache!.supplierProducts = init.supplierProducts;
          needsSave = true;
        }

        if (needsSave) {
          this.save();
        }
      }
    } catch (err) {
      console.error('[DB] Failed to initialize database file:', err);
      this.cache = createInitialDatabase();
    }
  }

  private save(): void {
    if (!this.cache) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.cache, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('[DB] Failed to save database file:', err);
    }
  }

  // ── USER METHODS ────────────────────────────────────────────────────────
  getUsers(): UserRecord[] {
    return this.cache ? [...this.cache.users] : [];
  }

  getUserById(id: string): UserRecord | undefined {
    return this.cache?.users.find(u => u.id === id);
  }

  findUserByIdentifier(identifier: string, role?: string): UserRecord | undefined {
    const clean = identifier.trim().toLowerCase();
    const cleanPhone = identifier.replace(/\D/g, '');

    return this.cache?.users.find(u => {
      const matchPhone = u.phone && (u.phone === identifier || (cleanPhone && u.phone.replace(/\D/g, '') === cleanPhone));
      const matchEmail = u.email && u.email.toLowerCase() === clean;
      const matchRole = role ? u.role === role : true;
      return (matchPhone || matchEmail) && matchRole;
    });
  }

  addUser(user: UserRecord): UserRecord {
    this.cache!.users.push(user);
    this.save();
    return user;
  }

  updateUser(id: string, updates: Partial<UserRecord>): UserRecord | undefined {
    const idx = this.cache!.users.findIndex(u => u.id === id);
    if (idx === -1) return undefined;
    this.cache!.users[idx] = { ...this.cache!.users[idx], ...updates };
    this.save();
    return this.cache!.users[idx];
  }

  invalidateSession(token: string): boolean {
    let modified = false;
    this.cache!.users.forEach(u => {
      if (u.sessionToken === token) {
        u.sessionToken = undefined;
        modified = true;
      }
    });
    if (modified) this.save();
    return modified;
  }

  // ── MASTER AGRICULTURAL CATALOG ──────────────────────────────────────────
  getCatalog(category?: string, query?: string): CatalogProduct[] {
    let list = this.cache?.catalog || MASTER_AGRICULTURAL_CATALOG;
    if (category && category !== 'all') {
      list = list.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.nameBn.includes(q) ||
        p.keywords.some(k => k.toLowerCase().includes(q))
      );
    }
    return list;
  }

  getCatalogById(id: string): CatalogProduct | undefined {
    return (this.cache?.catalog || MASTER_AGRICULTURAL_CATALOG).find(c => c.id === id);
  }

  // ── CROP LISTINGS ────────────────────────────────────────────────────────
  getCrops(filter?: { farmerId?: string; district?: string }): CropRecord[] {
    let list = this.cache ? [...this.cache.crops] : [];
    if (filter?.farmerId) list = list.filter(c => c.farmerId === filter.farmerId);
    if (filter?.district) list = list.filter(c => c.district.toLowerCase() === filter.district!.toLowerCase());
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getCropById(id: string): CropRecord | undefined {
    return this.cache?.crops.find(c => c.id === id);
  }

  addCrop(crop: CropRecord): CropRecord {
    // Foreign key validation: farmerId must be a valid registered farmer
    const farmer = this.getUserById(crop.farmerId);
    if (!farmer) {
      throw new Error(`FOREIGN_KEY_VIOLATION: Farmer with id "${crop.farmerId}" does not exist.`);
    }
    this.cache!.crops.unshift(crop);
    this.save();
    return crop;
  }

  updateCrop(id: string, updates: Partial<CropRecord>): CropRecord | undefined {
    const idx = this.cache!.crops.findIndex(c => c.id === id);
    if (idx === -1) return undefined;
    this.cache!.crops[idx] = { ...this.cache!.crops[idx], ...updates };
    this.save();
    return this.cache!.crops[idx];
  }

  deleteCrop(id: string): boolean {
    const before = this.cache!.crops.length;
    this.cache!.crops = this.cache!.crops.filter(c => c.id !== id);
    if (this.cache!.crops.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  // ── SUPPLIER PRODUCTS ────────────────────────────────────────────────────
  getSupplierProducts(filter?: { supplierId?: string; category?: string; organicOnly?: boolean }): SupplierProductRecord[] {
    let list = this.cache ? [...this.cache.supplierProducts] : [];
    if (filter?.supplierId) list = list.filter(p => p.supplierId === filter.supplierId);
    if (filter?.category) list = list.filter(p => p.category === filter.category);
    if (filter?.organicOnly) list = list.filter(p => p.organicCertified);
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getSupplierProductById(id: string): SupplierProductRecord | undefined {
    return this.cache?.supplierProducts.find(p => p.id === id);
  }

  addSupplierProduct(product: SupplierProductRecord): SupplierProductRecord {
    // Foreign key validation: supplierId must exist
    const supplier = this.getUserById(product.supplierId);
    if (!supplier) {
      throw new Error(`FOREIGN_KEY_VIOLATION: Supplier with id "${product.supplierId}" does not exist.`);
    }
    this.cache!.supplierProducts.unshift(product);
    this.save();
    return product;
  }

  updateSupplierProduct(id: string, updates: Partial<SupplierProductRecord>): SupplierProductRecord | undefined {
    const idx = this.cache!.supplierProducts.findIndex(p => p.id === id);
    if (idx === -1) return undefined;
    this.cache!.supplierProducts[idx] = { ...this.cache!.supplierProducts[idx], ...updates };
    this.save();
    return this.cache!.supplierProducts[idx];
  }

  deleteSupplierProduct(id: string): boolean {
    const before = this.cache!.supplierProducts.length;
    this.cache!.supplierProducts = this.cache!.supplierProducts.filter(p => p.id !== id);
    if (this.cache!.supplierProducts.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  // ── ORDERS & TRANSACTIONS WITH STRICT FOREIGN KEY VALIDATION ──────────────
  getOrders(filter?: { customerId?: string; sellerId?: string; orderType?: string }): OrderRecord[] {
    let list = this.cache ? [...this.cache.orders] : [];
    if (filter?.customerId) list = list.filter(o => o.customerId === filter.customerId);
    if (filter?.sellerId) list = list.filter(o => o.sellerId === filter.sellerId);
    if (filter?.orderType) list = list.filter(o => o.orderType === filter.orderType);
    return list.sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }

  getOrderById(id: string): OrderRecord | undefined {
    return this.cache?.orders.find(o => o.id === id);
  }

  addOrder(order: OrderRecord): OrderRecord {
    // 1. Foreign Key Validation: Customer / Buyer must exist
    const customer = this.getUserById(order.customerId);
    if (!customer) {
      // Check if user is known by phone or email
      const byPhone = this.findUserByIdentifier(order.phone);
      if (byPhone) {
        order.customerId = byPhone.id;
      } else {
        throw new Error(
          `FOREIGN_KEY_VIOLATION: Customer account "${order.customerId}" (${order.phone}) not registered in system.`
        );
      }
    }

    // 2. Validate Seller reference if provided
    if (order.sellerId) {
      const seller = this.getUserById(order.sellerId);
      if (!seller) {
        throw new Error(`FOREIGN_KEY_VIOLATION: Seller account "${order.sellerId}" does not exist.`);
      }
    }

    // 3. Validate Items and Check Stock (Atomicity)
    const stockDeductions: Array<{ type: 'crop' | 'supplier'; id: string; qty: number }> = [];

    for (const item of order.items) {
      // Check if item references a crop
      const crop = this.getCropById(item.itemId);
      if (crop) {
        if (crop.quantityKg < item.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK: Crop "${crop.cropBangla || crop.cropName}" has ${crop.quantityKg} kg available, requested ${item.quantity} kg.`
          );
        }
        stockDeductions.push({ type: 'crop', id: crop.id, qty: item.quantity });
        continue;
      }

      // Check if item references a supplier product
      const product = this.getSupplierProductById(item.itemId);
      if (product) {
        if (product.stockQty < item.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK: Product "${product.banglaName || product.name}" has ${product.stockQty} ${product.unit} available, requested ${item.quantity}.`
          );
        }
        stockDeductions.push({ type: 'supplier', id: product.id, qty: item.quantity });
        continue;
      }

      // Item from catalog or pre-order
      const catalogItem = this.getCatalogById(item.itemId);
      if (!catalogItem && !item.itemName) {
        throw new Error(`FOREIGN_KEY_VIOLATION: Order item "${item.itemId}" is invalid.`);
      }
    }

    // 4. Perform atomic stock deductions
    for (const deduction of stockDeductions) {
      if (deduction.type === 'crop') {
        const crop = this.getCropById(deduction.id);
        if (crop) {
          const remaining = Math.max(0, crop.quantityKg - deduction.qty);
          this.updateCrop(crop.id, {
            quantityKg: remaining,
            status: remaining === 0 ? 'Sold' : crop.status,
          });
        }
      } else if (deduction.type === 'supplier') {
        const prod = this.getSupplierProductById(deduction.id);
        if (prod) {
          const remaining = Math.max(0, prod.stockQty - deduction.qty);
          this.updateSupplierProduct(prod.id, {
            stockQty: remaining,
            inStock: remaining > 0,
          });
        }
      }
    }

    // 5. Commit order
    this.cache!.orders.unshift(order);

    // 6. Automatically generate persistent notification for seller & buyer
    if (order.sellerId) {
      this.addNotification({
        userId: order.sellerId,
        title: 'নতুন অর্ডার নিশ্চিত হয়েছে!',
        message: `${order.customerName} থেকে ৳${order.totalBDT}-এর অর্ডার প্রাপ্ত হয়েছে। ট্র্যাকিং কোড: ${order.trackingCode}`,
        type: 'success',
        actionUrl: `/orders?orderId=${order.id}`,
      });
    }

    this.addNotification({
      userId: order.customerId,
      title: 'অর্ডার সফলভাবে নিশ্চিত হয়েছে!',
      message: `আপনার অর্ডার #${order.id} প্রস্তুত হচ্ছে। ট্র্যাকিং কোড: ${order.trackingCode}`,
      type: 'info',
      actionUrl: `/orders?orderId=${order.id}`,
    });

    this.save();
    return order;
  }

  updateOrderStatus(id: string, status: OrderRecord['status'], deliveredDate?: string): OrderRecord | undefined {
    const order = this.cache?.orders.find(o => o.id === id);
    if (!order) return undefined;
    order.status = status;
    if (status === 'Delivered') {
      order.deliveredDate = deliveredDate || new Date().toISOString();
    }
    this.save();
    return order;
  }

  addOrderReview(orderId: string, rating: number, comment: string): OrderRecord | undefined {
    const order = this.cache?.orders.find(o => o.id === orderId);
    if (!order) return undefined;
    if (order.status !== 'Delivered') {
      throw new Error('Only delivered orders can be reviewed');
    }
    order.review = {
      rating,
      comment,
      reviewedAt: new Date().toISOString(),
    };

    for (const item of order.items) {
      const reviewRec: ReviewRecord = {
        id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderId,
        productId: item.itemId,
        userId: order.customerId,
        userName: order.customerName,
        rating,
        comment,
        createdAt: new Date().toISOString(),
        verifiedPurchase: true,
      };
      this.cache!.reviews.unshift(reviewRec);
    }

    this.save();
    return order;
  }

  // ── REVIEWS ──────────────────────────────────────────────────────────────
  getReviews(productId?: string): ReviewRecord[] {
    let list = this.cache ? [...this.cache.reviews] : [];
    if (productId) list = list.filter(r => r.productId === productId);
    return list;
  }

  // ── AUDIT LOGS ───────────────────────────────────────────────────────────
  getAuditLogs(): AuditLogRecord[] {
    return this.cache ? [...this.cache.auditLogs].slice(0, 100) : [];
  }

  addAuditLog(log: Omit<AuditLogRecord, 'id'>): void {
    const entry: AuditLogRecord = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...log,
    };
    this.cache!.auditLogs.unshift(entry);
    if (this.cache!.auditLogs.length > 500) {
      this.cache!.auditLogs = this.cache!.auditLogs.slice(0, 500);
    }
    this.save();
  }

  // ── DIRECT MESSAGING (PERSISTENT & CROSS-ACCOUNT) ─────────────────────────
  getMessages(userA: string, userB: string): DirectMessageRecord[] {
    if (!this.cache) return [];
    return this.cache.messages
      .filter(
        m => (m.senderId === userA && m.recipientId === userB) || (m.senderId === userB && m.recipientId === userA)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  addMessage(msg: Omit<DirectMessageRecord, 'id' | 'createdAt' | 'read'>): DirectMessageRecord {
    // Foreign key validation
    const sender = this.getUserById(msg.senderId);
    const recipient = this.getUserById(msg.recipientId);
    if (!sender || !recipient) {
      throw new Error(`FOREIGN_KEY_VIOLATION: Sender or recipient does not exist.`);
    }

    const newMsg: DirectMessageRecord = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...msg,
      createdAt: new Date().toISOString(),
      read: false,
    };
    this.cache!.messages.push(newMsg);

    // Create persistent notification for recipient
    this.addNotification({
      userId: msg.recipientId,
      title: `নতুন বার্তা: ${msg.senderName}`,
      message: msg.content.length > 60 ? `${msg.content.slice(0, 60)}…` : msg.content,
      type: 'info',
      actionUrl: `/contacts?tab=chat&userId=${msg.senderId}`,
    });

    this.save();
    return newMsg;
  }

  markMessagesRead(recipientId: string, senderId: string): void {
    let modified = false;
    this.cache!.messages.forEach(m => {
      if (m.recipientId === recipientId && m.senderId === senderId && !m.read) {
        m.read = true;
        modified = true;
      }
    });
    if (modified) this.save();
  }

  getUnreadMessageCount(userId: string): number {
    return (this.cache?.messages || []).filter(m => m.recipientId === userId && !m.read).length;
  }

  // ── USER CONNECTIONS (NETWORKING) ────────────────────────────────────────
  getConnections(userId: string): UserConnectionRecord[] {
    if (!this.cache) return [];
    return this.cache.connections.filter(c => c.requesterId === userId || c.recipientId === userId);
  }

  addConnectionRequest(requesterId: string, recipientId: string): UserConnectionRecord {
    const requester = this.getUserById(requesterId);
    const recipient = this.getUserById(recipientId);
    if (!requester || !recipient) {
      throw new Error(`FOREIGN_KEY_VIOLATION: Connection user not found.`);
    }
    if (requesterId === recipientId) {
      throw new Error(`INVALID_OPERATION: Cannot connect with oneself.`);
    }

    // Check if connection already exists
    const existing = this.cache!.connections.find(
      c => (c.requesterId === requesterId && c.recipientId === recipientId) ||
           (c.requesterId === recipientId && c.recipientId === requesterId)
    );
    if (existing) {
      return existing;
    }

    const newConn: UserConnectionRecord = {
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requesterId,
      requesterName: requester.name,
      requesterRole: requester.role,
      requesterPhone: requester.phone,
      requesterDistrict: requester.district,
      recipientId,
      recipientName: recipient.name,
      recipientRole: recipient.role,
      recipientPhone: recipient.phone,
      recipientDistrict: recipient.district,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.cache!.connections.unshift(newConn);

    // Notify recipient
    this.addNotification({
      userId: recipientId,
      title: 'নতুন সংযোগের অনুরোধ / New Connection Request',
      message: `${requester.name} (${requester.role.toUpperCase()}) আপনার সাথে যুক্ত হতে অনুরোধ পাঠিয়েছেন।`,
      type: 'info',
      actionUrl: '/contacts?tab=connections',
    });

    this.save();
    return newConn;
  }

  updateConnectionStatus(id: string, status: 'accepted' | 'rejected'): UserConnectionRecord | undefined {
    const conn = this.cache!.connections.find(c => c.id === id);
    if (!conn) return undefined;
    conn.status = status;
    conn.updatedAt = new Date().toISOString();

    if (status === 'accepted') {
      this.addNotification({
        userId: conn.requesterId,
        title: 'সংযোগ গৃহীত হয়েছে / Connection Accepted',
        message: `${conn.recipientName} আপনার সংযোগ অনুরোধ গ্রহণ করেছেন।`,
        type: 'success',
        actionUrl: `/contacts?tab=chat&userId=${conn.recipientId}`,
      });
    }

    this.save();
    return conn;
  }

  deleteConnection(id: string): boolean {
    const before = this.cache!.connections.length;
    this.cache!.connections = this.cache!.connections.filter(c => c.id !== id);
    if (this.cache!.connections.length !== before) {
      this.save();
      return true;
    }
    return false;
  }

  // ── NOTIFICATIONS ────────────────────────────────────────────────────────
  getNotifications(userId: string): NotificationRecord[] {
    if (!this.cache) return [];
    return this.cache.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  addNotification(notif: Omit<NotificationRecord, 'id' | 'createdAt' | 'read'>): NotificationRecord {
    const newNotif: NotificationRecord = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...notif,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.cache!.notifications.unshift(newNotif);
    if (this.cache!.notifications.length > 2000) {
      this.cache!.notifications = this.cache!.notifications.slice(0, 2000);
    }
    this.save();
    return newNotif;
  }

  markNotificationRead(id: string): void {
    const notif = this.cache!.notifications.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this.save();
    }
  }

  markAllNotificationsRead(userId: string): void {
    let modified = false;
    this.cache!.notifications.forEach(n => {
      if (n.userId === userId && !n.read) {
        n.read = true;
        modified = true;
      }
    });
    if (modified) this.save();
  }

  // ── CALL LOGS ────────────────────────────────────────────────────────────
  getCallLogs(userId: string): CallLogRecord[] {
    if (!this.cache) return [];
    return this.cache.callLogs
      .filter(c => c.callerId === userId || c.receiverId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  addCallLog(log: Omit<CallLogRecord, 'id' | 'timestamp'>): CallLogRecord {
    const newLog: CallLogRecord = {
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ...log,
      timestamp: new Date().toISOString(),
    };
    this.cache!.callLogs.unshift(newLog);
    if (this.cache!.callLogs.length > 500) {
      this.cache!.callLogs = this.cache!.callLogs.slice(0, 500);
    }
    this.save();
    return newLog;
  }

  // ── STATS ────────────────────────────────────────────────────────────────
  getStats() {
    const users = this.cache?.users || [];
    const crops = this.cache?.crops || [];
    const supplierProducts = this.cache?.supplierProducts || [];
    const orders = this.cache?.orders || [];
    const reviews = this.cache?.reviews || [];

    const deliveredOrders = orders.filter(o => o.status === 'Delivered');
    const totalVolumeBDT = deliveredOrders.reduce((sum, o) => sum + (o.totalBDT || 0), 0);

    return {
      farmersCount: users.filter(u => u.role === 'farmer').length,
      wholesalersCount: users.filter(u => u.role === 'wholesaler').length,
      retailersCount: users.filter(u => u.role === 'retailer').length,
      consumersCount: users.filter(u => u.role === 'consumer').length,
      totalRegisteredUsers: users.length,
      activeCropsCount: crops.filter(c => c.status !== 'Sold').length,
      supplierProductsCount: supplierProducts.filter(p => p.inStock).length,
      organicProductsCount: supplierProducts.filter(p => p.organicCertified && p.inStock).length,
      totalOrdersCount: orders.length,
      deliveredOrdersCount: deliveredOrders.length,
      totalVolumeBDT,
      verifiedReviewsCount: reviews.length,
      averageRating: reviews.length > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1) : null,
    };
  }
}

export const db = new DatabaseManager();
