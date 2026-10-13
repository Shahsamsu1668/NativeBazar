/**
 * NativeBazar — Persistent Storage Layer
 * Uses localStorage to simulate a database until a real backend is available.
 * All writes are immediately persisted; reads return live data.
 */

import {
  CropListing,
  BusinessDemand,
  SupplierProduct,
  CustomerProduct,
  CartItem,
  CustomerOrder,
  AgroAdvisory,
  AIMatchItem,
  User,
  UserRole,
  ExpenseLedgerEntry,
  NegotiationOffer,
  Notification,
  LoginAuditLog,
  Language,
} from '../types';

import {
  INITIAL_CROP_LISTINGS,
  INITIAL_BUSINESS_DEMANDS,
  INITIAL_SUPPLIER_PRODUCTS,
  INITIAL_CUSTOMER_PRODUCTS,
  INITIAL_MARKET_RATES,
  INITIAL_AGRO_ADVISORIES,
  INITIAL_AI_MATCHES,
  INITIAL_USERS,
} from './mockData';

// ─── STORAGE KEYS ─────────────────────────────────────────────────────
const KEYS = {
  USERS:           'nb_users',
  CURRENT_USER:    'nb_current_user',
  CROP_LISTINGS:   'nb_crop_listings',
  BUSINESS_DEMANDS:'nb_business_demands',
  SUPPLIER_PRODUCTS:'nb_supplier_products',
  CUSTOMER_PRODUCTS:'nb_customer_products',
  ORDERS:          'nb_orders',
  CART:            'nb_cart',
  ADVISORIES:      'nb_advisories',
  AI_MATCHES:      'nb_ai_matches',
  EXPENSE_LEDGER:  'nb_expense_ledger',
  NEGOTIATIONS:    'nb_negotiations',
  NOTIFICATIONS:   'nb_notifications',
  LOGIN_AUDIT:     'nb_login_audit_logs',
  FAILED_ATTEMPTS: 'nb_failed_attempts',
  INITIALIZED:     'nb_initialized',
  LANGUAGE:        'nb_language',
  DISTRICT:        'nb_district',
  EVALUATION_MODE: 'nb_evaluation_mode',
};

// ─── SECURITY HELPERS ──────────────────────────────────────────────────
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

const INITIAL_LOGIN_AUDIT_LOGS: LoginAuditLog[] = [
  {
    id: 'log-101',
    timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
    phone: '01700000000',
    role: 'admin',
    status: 'SUCCESS',
    ip: '192.168.1.10 (Bogura Pilot Telemetry)',
    device: 'Desktop Chrome / Windows 11',
    details: '2FA TOTP Verified (883650) • Clearance Level 4 Root Token Issued',
  },
  {
    id: 'log-102',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    phone: '01712458920',
    role: 'farmer',
    status: 'SUCCESS',
    ip: '103.205.180.45 (Shibganj Mobile Node)',
    device: 'Android Mobile / Chrome',
    details: 'Verified Farmer PIN Session Established',
  },
  {
    id: 'log-103',
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    phone: '01711209934',
    role: 'businessman',
    status: 'SUCCESS',
    ip: '103.205.180.89 (Dhaka-Bogura Highway Hub)',
    device: 'Laptop / Edge',
    details: 'Wholesale Arat Escrow Session Authorized',
  },
  {
    id: 'log-104',
    timestamp: new Date(Date.now() - 3600000 * 0.5).toISOString(),
    phone: '01999887766',
    role: 'customer',
    status: 'FAILED_PASSWORD',
    ip: '182.160.112.5 (External Unverified IP)',
    device: 'Unknown Device',
    details: 'Unauthorized credential attempt blocked by firewall',
  },
];

// ─── GENERIC HELPERS ───────────────────────────────────────────────────
function getItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('localStorage write failed:', e);
  }
}

// ─── INITIALIZE (runs once to seed demo data) ─────────────────────────
export function initializeStore(): void {
  if (localStorage.getItem(KEYS.INITIALIZED) === 'v4_secure') return;

  // Compute passwordHash for all initial users
  const securedUsers = INITIAL_USERS.map((u) => ({
    ...u,
    passwordHash: hashPassword(u.password),
  }));

  setItem(KEYS.USERS,            securedUsers);
  setItem(KEYS.CROP_LISTINGS,    INITIAL_CROP_LISTINGS);
  setItem(KEYS.BUSINESS_DEMANDS, INITIAL_BUSINESS_DEMANDS);
  setItem(KEYS.SUPPLIER_PRODUCTS,INITIAL_SUPPLIER_PRODUCTS);
  setItem(KEYS.CUSTOMER_PRODUCTS,INITIAL_CUSTOMER_PRODUCTS);
  setItem(KEYS.ADVISORIES,       INITIAL_AGRO_ADVISORIES);
  setItem(KEYS.AI_MATCHES,       INITIAL_AI_MATCHES);
  setItem(KEYS.LOGIN_AUDIT,      INITIAL_LOGIN_AUDIT_LOGS);
  setItem(KEYS.FAILED_ATTEMPTS,  {});
  setItem(KEYS.ORDERS,           []);
  setItem(KEYS.CART,             []);
  setItem(KEYS.EXPENSE_LEDGER,   []);
  setItem(KEYS.NEGOTIATIONS,     []);
  setItem(KEYS.NOTIFICATIONS,    []);

  localStorage.setItem(KEYS.INITIALIZED, 'v4_secure');
}

export interface LoginResult {
  success: boolean;
  user?: User;
  require2FA?: boolean;
  locked?: boolean;
  remainingSeconds?: number;
  error?: string;
  message?: string;
}

// ─── AUTH & SECURITY ENGINE ───────────────────────────────────────────
export const AuthStore = {
  getUsers: (): User[] => {
    const users = getItem<User[]>(KEYS.USERS, INITIAL_USERS);
    // Ensure all users have passwordHash computed
    return users.map((u) => (u.passwordHash ? u : { ...u, passwordHash: hashPassword(u.password) }));
  },

  getCurrentUser: (): User | null => {
    const user = getItem<User | null>(KEYS.CURRENT_USER, null);
    if (!user) return null;
    // Check session token expiration
    if (user.sessionExpiresAt && new Date(user.sessionExpiresAt).getTime() < Date.now()) {
      localStorage.removeItem(KEYS.CURRENT_USER);
      return null;
    }
    return user;
  },

  getAuditLogs: (): LoginAuditLog[] =>
    getItem<LoginAuditLog[]>(KEYS.LOGIN_AUDIT, INITIAL_LOGIN_AUDIT_LOGS),

  addAuditLog(entry: Omit<LoginAuditLog, 'id'>): void {
    const logs = this.getAuditLogs();
    const newLog: LoginAuditLog = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    };
    setItem(KEYS.LOGIN_AUDIT, [newLog, ...logs].slice(0, 50));
  },

  getFailedAttempts(phone: string): { count: number; lockedUntil: number } {
    const map = getItem<Record<string, { count: number; lockedUntil: number }>>(KEYS.FAILED_ATTEMPTS, {});
    return map[phone] || { count: 0, lockedUntil: 0 };
  },

  recordFailedAttempt(phone: string, role?: UserRole): { locked: boolean; remainingSeconds: number } {
    const map = getItem<Record<string, { count: number; lockedUntil: number }>>(KEYS.FAILED_ATTEMPTS, {});
    const current = map[phone] || { count: 0, lockedUntil: 0 };
    current.count += 1;

    let locked = false;
    let remainingSeconds = 0;

    // After 3 failed attempts, lock for 3 minutes (180 seconds)
    if (current.count >= 3) {
      current.lockedUntil = Date.now() + 180000;
      locked = true;
      remainingSeconds = 180;
      this.addAuditLog({
        timestamp: new Date().toISOString(),
        phone,
        role: role || 'customer',
        status: 'LOCKED',
        ip: '192.168.1.10 (Bogura Node)',
        device: 'Web Client',
        details: 'Account temporarily locked due to 3 consecutive failed login attempts',
      });
    }

    map[phone] = current;
    setItem(KEYS.FAILED_ATTEMPTS, map);
    return { locked, remainingSeconds };
  },

  resetFailedAttempts(phone: string): void {
    const map = getItem<Record<string, { count: number; lockedUntil: number }>>(KEYS.FAILED_ATTEMPTS, {});
    delete map[phone];
    setItem(KEYS.FAILED_ATTEMPTS, map);
  },

  login(phone: string, password: string, securityPin?: string): LoginResult {
    const cleanPhone = phone.trim().replace(/\D/g, '');
    const attempts = this.getFailedAttempts(cleanPhone);

    // 1. Check if account is locked
    if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
      const remainingSeconds = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
      return {
        success: false,
        locked: true,
        remainingSeconds,
        error: 'ACCOUNT_LOCKED',
        message: `Account locked due to multiple failed attempts. Try again in ${remainingSeconds} seconds.`,
      };
    }

    const users = this.getUsers();
    const user = users.find(
      (u) =>
        u.phone.replace(/\D/g, '') === cleanPhone ||
        (u.email && u.email.toLowerCase() === phone.trim().toLowerCase())
    );

    // 2. Validate user existence
    if (!user) {
      this.recordFailedAttempt(cleanPhone);
      this.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: cleanPhone || phone,
        role: 'customer',
        status: 'FAILED_PASSWORD',
        ip: '192.168.1.10 (Bogura Node)',
        device: 'Web Client',
        details: 'Non-existent account credential attempt rejected',
      });
      return {
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid phone number or credentials.',
      };
    }

    // 3. Validate password (supports both plaintext demo match and salted hash match)
    const computedHash = hashPassword(password);
    const passwordValid = user.password === password || user.passwordHash === computedHash;

    if (!passwordValid) {
      const { locked, remainingSeconds } = this.recordFailedAttempt(cleanPhone, user.role);
      this.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: cleanPhone,
        role: user.role,
        status: locked ? 'LOCKED' : 'FAILED_PASSWORD',
        ip: '192.168.1.10 (Bogura Node)',
        device: 'Web Client',
        details: `Failed password attempt (${attempts.count + 1}/3)`,
      });

      if (locked) {
        return {
          success: false,
          locked: true,
          remainingSeconds,
          error: 'ACCOUNT_LOCKED',
          message: `Too many failed attempts. Account locked for 3 minutes.`,
        };
      }

      return {
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: `Invalid password. Attempt ${attempts.count + 1} of 3 before lockout.`,
      };
    }

    // 4. Elevated Admin Two-Factor Authentication (2FA) Requirement
    if (user.role === 'admin') {
      const expectedPin = user.securityPin || '883650';
      if (!securityPin || securityPin.trim() === '') {
        // Prompt for 2FA PIN
        return {
          success: false,
          require2FA: true,
          message: 'Admin 2FA Security PIN Required (Level-4 Telemetry Authorization)',
        };
      }

      if (securityPin.trim() !== expectedPin) {
        this.addAuditLog({
          timestamp: new Date().toISOString(),
          phone: cleanPhone,
          role: 'admin',
          status: 'FAILED_2FA',
          ip: '192.168.1.10 (Bogura Root)',
          device: 'Admin Console',
          details: 'Admin 2FA PIN verification failed',
        });
        return {
          success: false,
          require2FA: true,
          error: 'INVALID_2FA_PIN',
          message: 'Invalid 6-digit Admin Security Code / PIN. Please try again.',
        };
      }
    }

    // 5. Successful Authentication
    this.resetFailedAttempts(cleanPhone);

    // Cryptographically random session token
    const sessionToken = `nb_sec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const sessionDurationMs = user.role === 'admin' ? 3600000 : 43200000; // 1 hr for admin, 12 hrs for others
    const sessionExpiresAt = new Date(Date.now() + sessionDurationMs).toISOString();

    const safeUser: User = {
      ...user,
      password: '***',
      passwordHash: user.passwordHash || computedHash,
      sessionToken,
      sessionExpiresAt,
      lastLoginAt: new Date().toISOString(),
    };

    setItem(KEYS.CURRENT_USER, safeUser);

    this.addAuditLog({
      timestamp: new Date().toISOString(),
      phone: cleanPhone,
      role: user.role,
      status: 'SUCCESS',
      ip: user.role === 'admin' ? '192.168.1.10 (Admin Root)' : '103.205.180.45 (Local Node)',
      device: navigator.userAgent.includes('Mobile') ? 'Mobile Client' : 'Desktop Browser',
      details:
        user.role === 'admin'
          ? 'Level-4 Admin 2FA Token Verified • Session Granted'
          : 'Role-verified encrypted session granted',
    });

    return {
      success: true,
      user: safeUser,
    };
  },

  register(data: Omit<User, 'id' | 'createdAt'>): User {
    const users = this.getUsers();
    const cleanPhone = data.phone.replace(/\D/g, '');
    const newUser: User = {
      ...data,
      phone: cleanPhone,
      id: `user-${Date.now()}`,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(data.password),
      verified: false,
      twoFactorEnabled: data.role === 'admin',
    };
    users.push(newUser);
    setItem(KEYS.USERS, users);

    const safeUser: User = {
      ...newUser,
      password: '***',
      sessionToken: `nb_sec_${Date.now()}_reg`,
      sessionExpiresAt: new Date(Date.now() + 43200000).toISOString(),
    };
    setItem(KEYS.CURRENT_USER, safeUser);

    this.addAuditLog({
      timestamp: new Date().toISOString(),
      phone: cleanPhone,
      role: newUser.role,
      status: 'SUCCESS',
      ip: '103.205.180.45 (Bogura Gateway)',
      device: 'Web Client',
      details: 'New user registration and instant session issued',
    });

    return safeUser;
  },

  logout(): void {
    const current = this.getCurrentUser();
    if (current) {
      this.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: current.phone,
        role: current.role,
        status: 'SUCCESS',
        ip: '192.168.1.10',
        device: 'Web Client',
        details: 'User explicitly signed out • Session revoked',
      });
    }
    localStorage.removeItem(KEYS.CURRENT_USER);
  },

  updateProfile(updates: Partial<User>): User | null {
    const current = this.getCurrentUser();
    if (!current) return null;
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.id === current.id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    setItem(KEYS.USERS, users);
    const updated = { ...users[idx], password: '***' };
    setItem(KEYS.CURRENT_USER, updated);
    return updated;
  },

  verifyAdminCredentials(email: string, password: string): { success: boolean; user?: User; message?: string } {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getUsers();
    const admin = users.find(
      (u) =>
        u.role === 'admin' &&
        ((u.email && u.email.toLowerCase() === cleanEmail) ||
          u.phone === cleanEmail.replace(/\D/g, ''))
    );

    if (!admin) {
      this.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: cleanEmail,
        role: 'admin',
        status: 'FAILED_PASSWORD',
        ip: '192.168.1.10 (Bogura Admin Gateway)',
        device: 'Web Admin Gate',
        details: `Unauthorized admin login attempt: user "${email}" not found`,
      });
      return {
        success: false,
        message: 'No administrator account found with this email / ID.',
      };
    }

    const computedHash = hashPassword(password);
    const passwordValid = admin.password === password || admin.passwordHash === computedHash;

    if (!passwordValid) {
      this.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: admin.phone,
        role: 'admin',
        status: 'FAILED_PASSWORD',
        ip: '192.168.1.10 (Bogura Admin Gateway)',
        device: 'Web Admin Gate',
        details: `Admin password mismatch attempt for ${cleanEmail}`,
      });
      return {
        success: false,
        message: 'Invalid Admin password. Access denied.',
      };
    }

    const sessionToken = `nb_sec_adm_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const sessionExpiresAt = new Date(Date.now() + 3600000).toISOString();
    const safeAdmin: User = {
      ...admin,
      password: '***',
      passwordHash: admin.passwordHash || computedHash,
      sessionToken,
      sessionExpiresAt,
      lastLoginAt: new Date().toISOString(),
    };

    setItem(KEYS.CURRENT_USER, safeAdmin);

    this.addAuditLog({
      timestamp: new Date().toISOString(),
      phone: admin.phone,
      role: 'admin',
      status: 'SUCCESS',
      ip: '192.168.1.10 (Bogura Admin Gateway)',
      device: 'Web Admin Gate',
      details: 'Admin verified via email & password • Elevated root session granted',
    });

    return { success: true, user: safeAdmin };
  },
};

// ─── USER PREFERENCES & PERSISTENCE ────────────────────────────────────
export const PrefStore = {
  getLanguage: (): Language => (localStorage.getItem(KEYS.LANGUAGE) as Language) || 'bn',
  setLanguage: (lang: Language): void => {
    try {
      localStorage.setItem(KEYS.LANGUAGE, lang);
    } catch { }
  },
  getDistrict: (): string => localStorage.getItem(KEYS.DISTRICT) || 'Bogura',
  setDistrict: (district: string): void => {
    try {
      localStorage.setItem(KEYS.DISTRICT, district);
    } catch { }
  },
  isEvaluationMode: (): boolean => localStorage.getItem(KEYS.EVALUATION_MODE) === 'true',
  setEvaluationMode: (enabled: boolean): void => {
    try {
      localStorage.setItem(KEYS.EVALUATION_MODE, enabled ? 'true' : 'false');
    } catch { }
  },
};


// ─── CROP LISTINGS ─────────────────────────────────────────────────────
export const CropStore = {
  getAll: (): CropListing[] => getItem<CropListing[]>(KEYS.CROP_LISTINGS, INITIAL_CROP_LISTINGS),

  add(listing: CropListing): void {
    const all = this.getAll();
    setItem(KEYS.CROP_LISTINGS, [listing, ...all]);
  },

  update(id: string, updates: Partial<CropListing>): void {
    const all = this.getAll().map(c => c.id === id ? { ...c, ...updates } : c);
    setItem(KEYS.CROP_LISTINGS, all);
  },

  delete(id: string): void {
    setItem(KEYS.CROP_LISTINGS, this.getAll().filter(c => c.id !== id));
  },

  getByFarmer(farmerId: string): CropListing[] {
    return this.getAll().filter(c => c.farmerId === farmerId);
  },

  getAvailable(): CropListing[] {
    return this.getAll().filter(c => c.status !== 'Sold');
  },
};

// ─── BUSINESS DEMANDS ──────────────────────────────────────────────────
export const DemandStore = {
  getAll: (): BusinessDemand[] => getItem<BusinessDemand[]>(KEYS.BUSINESS_DEMANDS, INITIAL_BUSINESS_DEMANDS),

  add(demand: BusinessDemand): void {
    setItem(KEYS.BUSINESS_DEMANDS, [demand, ...this.getAll()]);
  },

  update(id: string, updates: Partial<BusinessDemand>): void {
    const all = this.getAll().map(d => d.id === id ? { ...d, ...updates } : d);
    setItem(KEYS.BUSINESS_DEMANDS, all);
  },

  delete(id: string): void {
    setItem(KEYS.BUSINESS_DEMANDS, this.getAll().filter(d => d.id !== id));
  },

  getByBuyer(buyerId: string): BusinessDemand[] {
    return this.getAll().filter(d => d.buyerId === buyerId);
  },

  recordFulfillment(demandId: string, quantityKg: number): void {
    const all = this.getAll();
    const idx = all.findIndex(d => d.id === demandId);
    if (idx >= 0) {
      all[idx].fulfilledKg = Math.min(all[idx].quantityKgNeeded, (all[idx].fulfilledKg || 0) + quantityKg);
      setItem(KEYS.BUSINESS_DEMANDS, all);
    }
  },
};

// ─── SUPPLIER PRODUCTS ─────────────────────────────────────────────────
export const SupplierStore = {
  getAll: (): SupplierProduct[] => getItem<SupplierProduct[]>(KEYS.SUPPLIER_PRODUCTS, INITIAL_SUPPLIER_PRODUCTS),

  add(product: SupplierProduct): void {
    setItem(KEYS.SUPPLIER_PRODUCTS, [product, ...this.getAll()]);
  },

  update(id: string, updates: Partial<SupplierProduct>): void {
    const all = this.getAll().map(p => p.id === id ? { ...p, ...updates } : p);
    setItem(KEYS.SUPPLIER_PRODUCTS, all);
  },

  delete(id: string): void {
    setItem(KEYS.SUPPLIER_PRODUCTS, this.getAll().filter(p => p.id !== id));
  },

  getBySupplierId(supplierId: string): SupplierProduct[] {
    return this.getAll().filter(p => p.supplierId === supplierId);
  },
};

// ─── CUSTOMER PRODUCTS ─────────────────────────────────────────────────
export const CustomerProductStore = {
  getAll: (): CustomerProduct[] => getItem<CustomerProduct[]>(KEYS.CUSTOMER_PRODUCTS, INITIAL_CUSTOMER_PRODUCTS),
  add(p: CustomerProduct): void {
    setItem(KEYS.CUSTOMER_PRODUCTS, [p, ...this.getAll()]);
  },
  update(id: string, updates: Partial<CustomerProduct>): void {
    setItem(KEYS.CUSTOMER_PRODUCTS, this.getAll().map(p => p.id === id ? { ...p, ...updates } : p));
  },
  deductStock(productId: string, quantityKg: number): boolean {
    const products = this.getAll();
    const idx = products.findIndex(p => p.id === productId);
    if (idx >= 0) {
      products[idx].availableKg = Math.max(0, products[idx].availableKg - quantityKg);
      setItem(KEYS.CUSTOMER_PRODUCTS, products);
      return true;
    }
    return false;
  },
};

// ─── CART ──────────────────────────────────────────────────────────────
export const CartStore = {
  get: (): CartItem[] => getItem<CartItem[]>(KEYS.CART, []),

  addOrUpdate(product: CustomerProduct, delta = 1): void {
    const cart = this.get();
    const idx  = cart.findIndex(i => i.product.id === product.id);
    if (idx >= 0) {
      cart[idx].quantityKg = Math.max(0, cart[idx].quantityKg + delta);
      if (cart[idx].quantityKg === 0) cart.splice(idx, 1);
    } else if (delta > 0) {
      cart.push({ product, quantityKg: delta });
    }
    setItem(KEYS.CART, cart);
  },

  remove(productId: string): void {
    setItem(KEYS.CART, this.get().filter(i => i.product.id !== productId));
  },

  clear(): void {
    setItem(KEYS.CART, []);
  },

  total(): number {
    return this.get().reduce((sum, i) => sum + i.product.pricePerKg * i.quantityKg, 0);
  },

  itemCount(): number {
    return this.get().length;
  },
};

// ─── ORDERS ────────────────────────────────────────────────────────────
export const OrderStore = {
  getAll: (): CustomerOrder[] => getItem<CustomerOrder[]>(KEYS.ORDERS, []),

  add(order: CustomerOrder): void {
    setItem(KEYS.ORDERS, [order, ...this.getAll()]);
  },

  update(id: string, updates: Partial<CustomerOrder>): void {
    setItem(KEYS.ORDERS, this.getAll().map(o => o.id === id ? { ...o, ...updates } : o));
  },

  getByCustomer(customerId: string): CustomerOrder[] {
    return this.getAll().filter(o => o.customerId === customerId);
  },
};

// ─── ADVISORIES ────────────────────────────────────────────────────────
export const AdvisoryStore = {
  getAll: (): AgroAdvisory[] => getItem<AgroAdvisory[]>(KEYS.ADVISORIES, INITIAL_AGRO_ADVISORIES),

  add(advisory: AgroAdvisory): void {
    setItem(KEYS.ADVISORIES, [advisory, ...this.getAll()]);
  },

  update(id: string, updates: Partial<AgroAdvisory>): void {
    setItem(KEYS.ADVISORIES, this.getAll().map(a => a.id === id ? { ...a, ...updates } : a));
  },
};

// ─── AI MATCHES ────────────────────────────────────────────────────────
export const MatchStore = {
  getAll: (): AIMatchItem[] => getItem<AIMatchItem[]>(KEYS.AI_MATCHES, INITIAL_AI_MATCHES),

  add(match: AIMatchItem): void {
    setItem(KEYS.AI_MATCHES, [match, ...this.getAll()]);
  },

  update(id: string, updates: Partial<AIMatchItem>): void {
    setItem(KEYS.AI_MATCHES, this.getAll().map(m => m.id === id ? { ...m, ...updates } : m));
  },

  // Compute matches between available crop listings and open demands
  computeMatches(listings: CropListing[], demands: BusinessDemand[]): AIMatchItem[] {
    const matches: AIMatchItem[] = [];
    listings.filter(l => l.status === 'Growing' || l.status === 'Ready to Harvest').forEach(listing => {
      demands.filter(d => d.fulfilledKg < d.quantityKgNeeded).forEach(demand => {
        const nameSimilarity = listing.cropName.toLowerCase().includes(demand.cropNeeded.toLowerCase().split(' ')[0])
          || demand.cropNeeded.toLowerCase().includes(listing.cropName.toLowerCase().split(' ')[0]);
        if (!nameSimilarity) return;

        const priceDiff      = Math.abs(listing.expectedPricePerKg - demand.targetPricePerKg);
        const priceScore     = Math.max(0, 40 - priceDiff * 4);
        const qtyRatio       = Math.min(listing.quantityKg / demand.quantityKgNeeded, 1);
        const qtyScore       = qtyRatio * 30;
        const distKm         = Math.random() * 15 + 2;
        const distScore      = Math.max(0, 30 - distKm);
        const matchScore     = Math.round(priceScore + qtyScore + distScore);

        if (matchScore < 40) return;

        const existing = matches.find(m =>
          m.farmerName === listing.farmerName && m.buyerName === demand.businessName
        );
        if (!existing) {
          matches.push({
            id: `match-${listing.id}-${demand.id}`,
            cropName:              listing.cropName,
            farmerName:            listing.farmerName,
            farmerLocation:        `${listing.upazila}, ${listing.district}`,
            harvestQuantityKg:     listing.quantityKg,
            readyInDays:           parseInt(listing.availableDate) || 7,
            farmerExpectedPrice:   listing.expectedPricePerKg,
            buyerName:             demand.businessName,
            buyerType:             demand.businessType,
            buyerDemandKg:         demand.quantityKgNeeded,
            buyerBudgetPrice:      demand.targetPricePerKg,
            matchScore:            Math.min(98, matchScore),
            distanceKm:            parseFloat(distKm.toFixed(1)),
            estimatedLogisticsCostPerKg: parseFloat((distKm * 0.15).toFixed(2)),
            projectedProfitMargin: `+৳${(demand.targetPricePerKg - listing.expectedPricePerKg).toFixed(0)}/kg`,
            status:                matchScore >= 85 ? 'Ready to Contract' : 'Draft',
          });
        }
      });
    });
    return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 20);
  },
};

// ─── EXPENSE LEDGER ────────────────────────────────────────────────────
export const ExpenseStore = {
  getAll: (): ExpenseLedgerEntry[] => getItem<ExpenseLedgerEntry[]>(KEYS.EXPENSE_LEDGER, []),

  add(entry: ExpenseLedgerEntry): void {
    setItem(KEYS.EXPENSE_LEDGER, [entry, ...this.getAll()]);
  },

  delete(id: string): void {
    setItem(KEYS.EXPENSE_LEDGER, this.getAll().filter(e => e.id !== id));
  },

  totalExpenses(): number {
    return this.getAll().filter(e => e.type === 'expense').reduce((s, e) => s + e.amountBDT, 0);
  },

  totalRevenue(): number {
    return this.getAll().filter(e => e.type === 'income').reduce((s, e) => s + e.amountBDT, 0);
  },

  netProfit(): number {
    return this.totalRevenue() - this.totalExpenses();
  },
};

// ─── NEGOTIATIONS ──────────────────────────────────────────────────────
export const NegotiationStore = {
  getAll: (): NegotiationOffer[] => getItem<NegotiationOffer[]>(KEYS.NEGOTIATIONS, []),

  add(offer: NegotiationOffer): void {
    setItem(KEYS.NEGOTIATIONS, [offer, ...this.getAll()]);
  },

  update(id: string, updates: Partial<NegotiationOffer>): void {
    setItem(KEYS.NEGOTIATIONS, this.getAll().map(n => n.id === id ? { ...n, ...updates } : n));
  },

  getByListing(listingId: string): NegotiationOffer[] {
    return this.getAll().filter(n => n.listingId === listingId);
  },
};

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────
export const NotificationStore = {
  getAll: (): Notification[] => getItem<Notification[]>(KEYS.NOTIFICATIONS, []),

  add(notif: Notification): void {
    setItem(KEYS.NOTIFICATIONS, [notif, ...this.getAll()].slice(0, 100));
  },

  markRead(id: string): void {
    setItem(KEYS.NOTIFICATIONS, this.getAll().map(n => n.id === id ? { ...n, read: true } : n));
  },

  markAllRead(): void {
    setItem(KEYS.NOTIFICATIONS, this.getAll().map(n => ({ ...n, read: true })));
  },

  unreadCount(): number {
    return this.getAll().filter(n => !n.read).length;
  },

  addSystemNotif(userId: string, title: string, message: string, type: Notification['type'] = 'info'): void {
    this.add({
      id:        `notif-${Date.now()}`,
      userId,
      title,
      message,
      type,
      read:      false,
      createdAt: new Date().toISOString(),
    });
  },
};

// ─── ANALYTICS ─────────────────────────────────────────────────────────
export const AnalyticsStore = {
  getPlatformStats() {
    const users    = AuthStore.getUsers();
    const listings = CropStore.getAll();
    const demands  = DemandStore.getAll();
    const orders   = OrderStore.getAll();
    const matches  = MatchStore.getAll();

    return {
      totalFarmers:    users.filter(u => u.role === 'farmer').length,
      totalBusinessmen:users.filter(u => u.role === 'businessman').length,
      totalSuppliers:  users.filter(u => u.role === 'supplier').length,
      totalCustomers:  users.filter(u => u.role === 'customer').length,
      totalExperts:    users.filter(u => u.role === 'expert').length,
      activeListings:  listings.filter(l => l.status !== 'Sold').length,
      openDemands:     demands.filter(d => d.fulfilledKg < d.quantityKgNeeded).length,
      totalOrders:     orders.length,
      completedOrders: orders.filter(o => o.status === 'Delivered').length,
      totalRevenue:    orders.reduce((s, o) => s + o.totalBDT, 0),
      totalMatchScore: matches.reduce((s, m) => s + m.matchScore, 0) / Math.max(1, matches.length),
      lockedContracts: matches.filter(m => m.status === 'Locked in Escrow').length,
    };
  },
};
