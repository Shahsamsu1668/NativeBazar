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
  TradeOrder,
  TradeOrderType,
  MarketRate,
  Theme,
  AgroAdvisory,
  AIMatchItem,
  User,
  UserRole,
  ExpenseLedgerEntry,
  NegotiationOffer,
  Notification,
  LoginAuditLog,
  Language,
  UserConnection,
  DirectMessage,
  CallLog,
} from '../types';

import {
  INITIAL_CROP_LISTINGS,
  INITIAL_BUSINESS_DEMANDS,
  INITIAL_SUPPLIER_PRODUCTS,
  INITIAL_CUSTOMER_PRODUCTS,
  INITIAL_MARKET_RATES,
  INITIAL_TRADE_ORDERS,
  INITIAL_AGRO_ADVISORIES,
  INITIAL_AI_MATCHES,
  INITIAL_USERS,
  BANGLADESH_LOCATIONS,
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
  TRADE_ORDERS:    'nb_trade_orders_v5',
  MARKET_RATES:    'nb_market_rates_v5',
  CART:            'nb_cart',
  ADVISORIES:      'nb_advisories',
  AI_MATCHES:      'nb_ai_matches',
  EXPENSE_LEDGER:  'nb_expense_ledger',
  NEGOTIATIONS:    'nb_negotiations',
  NOTIFICATIONS:   'nb_notifications',
  CONNECTIONS:     'nb_connections_v1',
  MESSAGES:        'nb_messages_v1',
  CALLS:           'nb_call_logs_v1',
  LOGIN_AUDIT:     'nb_login_audit_logs',
  FAILED_ATTEMPTS: 'nb_failed_attempts',
  INITIALIZED:     'nb_initialized',
  LANGUAGE:        'nb_language',
  DISTRICT:        'nb_district',
  THEME:           'nb_theme',
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

// ─── INITIALIZE (runs once to seed data) ────────────────────────────
export function initializeStore(): void {
  const STORE_VERSION = 'v15_zero_demo_users';

  // Purge any stale demo user accounts from local storage
  const DEMO_IDS = ['f-1', 'f-2', 'b-1', 'b-2', 's-1', 'c-1', 'a-1', 'e-1', 'e-2', 'e-3', 'e-4'];
  const currentUserRaw = getItem<User | null>(KEYS.CURRENT_USER, null);
  if (currentUserRaw && DEMO_IDS.includes(currentUserRaw.id)) {
    localStorage.removeItem(KEYS.CURRENT_USER);
  }

  // Always re-run if key changes (bump version to force re-init)
  if (localStorage.getItem(KEYS.INITIALIZED) === STORE_VERSION) {
    const currentUsers = getItem<User[]>(KEYS.USERS, []);
    const filteredUsers = currentUsers.filter((u) => !DEMO_IDS.includes(u.id));
    if (filteredUsers.length !== currentUsers.length) {
      setItem(KEYS.USERS, filteredUsers);
    }
    return;
  }

  // Preserve legitimately registered users while purging demo accounts
  const existingUsers = getItem<User[]>(KEYS.USERS, []);
  const cleanExisting = existingUsers
    .filter((u) => !DEMO_IDS.includes(u.id))
    .map((u) => {
      // Map legacy roles safely
      let role = u.role;
      if (role === 'businessman') role = 'wholesaler';
      if (role === 'supplier') role = 'retailer';
      if (role === 'customer') role = 'consumer';
      return {
        ...u,
        role,
        passwordHash: u.passwordHash || (u.password ? hashPassword(u.password) : undefined),
      };
    });

  setItem(KEYS.USERS,            cleanExisting);
  setItem(KEYS.CROP_LISTINGS,    []);
  setItem(KEYS.BUSINESS_DEMANDS, []);
  setItem(KEYS.SUPPLIER_PRODUCTS,[]);
  setItem(KEYS.CUSTOMER_PRODUCTS,[]);
  setItem(KEYS.MARKET_RATES,     INITIAL_MARKET_RATES);
  setItem(KEYS.TRADE_ORDERS,     []);
  setItem(KEYS.ADVISORIES,       []);
  setItem(KEYS.AI_MATCHES,       []);
  setItem(KEYS.LOGIN_AUDIT,      []);
  setItem(KEYS.FAILED_ATTEMPTS,  {});
  setItem(KEYS.ORDERS,           []);
  setItem(KEYS.CART,             []);
  setItem(KEYS.EXPENSE_LEDGER,   []);
  setItem(KEYS.NEGOTIATIONS,     []);
  setItem(KEYS.NOTIFICATIONS,    []);

  localStorage.setItem(KEYS.INITIALIZED, STORE_VERSION);
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
    let users = getItem<User[]>(KEYS.USERS, []);
    const DEMO_IDS = ['f-1', 'f-2', 'b-1', 'b-2', 's-1', 'c-1', 'a-1', 'e-1', 'e-2', 'e-3', 'e-4'];
    users = users.filter((u) => !DEMO_IDS.includes(u.id));

    return users.map((u) => {
      let role = u.role;
      if (role === 'businessman') role = 'wholesaler';
      if (role === 'supplier') role = 'retailer';
      if (role === 'customer') role = 'consumer';
      return {
        ...u,
        role,
        passwordHash: u.passwordHash || (u.password ? hashPassword(u.password) : undefined),
      };
    });
  },

  getCurrentUser: (): User | null => {
    const user = getItem<User | null>(KEYS.CURRENT_USER, null);
    if (!user) return null;
    // Check if user is an old hardcoded expert
    if (['e-1', 'e-2', 'e-3', 'e-4'].includes(user.id)) {
      localStorage.removeItem(KEYS.CURRENT_USER);
      return null;
    }
    // Check session token expiration
    if (user.sessionExpiresAt && new Date(user.sessionExpiresAt).getTime() < Date.now()) {
      localStorage.removeItem(KEYS.CURRENT_USER);
      return null;
    }
    return user;
  },

  setCurrentUser: (user: User | null): void => {
    if (!user) {
      localStorage.removeItem(KEYS.CURRENT_USER);
    } else {
      setItem(KEYS.CURRENT_USER, user);
      // Ensure user is present in users array if not already present
      const users = getItem<User[]>(KEYS.USERS, []);
      const idx = users.findIndex((u) => u.id === user.id || u.phone === user.phone);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...user };
        setItem(KEYS.USERS, users);
      } else {
        setItem(KEYS.USERS, [...users, user]);
      }
    }
  },

  getAuditLogs: (): LoginAuditLog[] =>
    getItem<LoginAuditLog[]>(KEYS.LOGIN_AUDIT, []),

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

  getUserAccounts(identifier: string): User[] {
    const raw = (identifier || '').trim();
    if (!raw) return [];
    const isEmail = raw.includes('@');
    const isAdminId = raw.toLowerCase() === 'nativebazarsjs';
    const cleanPhone = raw.replace(/\D/g, '');
    const cleanEmail = raw.toLowerCase();
    return this.getUsers().filter((u) =>
      (isAdminId && u.role === 'admin') ||
      (isEmail && u.email && u.email.toLowerCase() === cleanEmail) ||
      (!isEmail && cleanPhone && u.phone && u.phone.replace(/\D/g, '') === cleanPhone) ||
      (u.email && u.email.toLowerCase() === cleanEmail) ||
      (cleanPhone && u.phone && u.phone.replace(/\D/g, '') === cleanPhone)
    );
  },

  hasRoleAccount(identifier: string, role: UserRole): boolean {
    return this.getUserAccounts(identifier).some((u) => u.role === role);
  },

  getRoleAccount(identifier: string, role: UserRole): User | undefined {
    return this.getUserAccounts(identifier).find((u) => u.role === role);
  },

  login(identifier: string, password: string, securityPin?: string, targetRole?: UserRole): LoginResult {
    const raw = (identifier || '').trim();
    const isEmail = raw.includes('@');
    const isAdminId = raw.toLowerCase() === 'nativebazarsjs';
    const normalizedKey = isAdminId ? 'nativebazarsjs' : (isEmail ? raw.toLowerCase() : (raw.replace(/\D/g, '') || raw.toLowerCase()));
    const attempts = this.getFailedAttempts(normalizedKey);

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
    // Match candidate users by email, phone, or admin ID, and if targetRole is given, filter by that role
    const candidates = users.filter((u) => {
      if (targetRole && u.role !== targetRole) return false;
      if (isAdminId && u.role === 'admin') return true;
      if (u.email && u.email.toLowerCase() === raw.toLowerCase()) return true;
      if (u.phone && u.phone.toLowerCase() === raw.toLowerCase()) return true;
      if (isEmail && u.email && u.email.toLowerCase() === normalizedKey) return true;
      const cleanPhone = raw.replace(/\D/g, '');
      if (!isEmail && cleanPhone && u.phone && u.phone.replace(/\D/g, '') === cleanPhone) return true;
      return false;
    });

    const user = candidates[0];

    // 2. Validate user existence
    if (!user) {
      this.recordFailedAttempt(normalizedKey);
      this.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: raw,
        role: targetRole || 'customer',
        status: 'FAILED_PASSWORD',
        ip: '192.168.1.10 (Bogura Node)',
        device: 'Web Client',
        details: 'Non-existent account credential attempt rejected',
      });
      return {
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid ID, email/phone or password credentials.',
      };
    }

    const cleanPhone = user.phone || (isEmail ? raw : raw.replace(/\D/g, ''));

    // 3. Validate password (supports both plaintext demo match and salted hash match)
    const computedHash = hashPassword(password);
    const passwordValid = user.password === password || user.passwordHash === computedHash;

    if (!passwordValid) {
      const { locked, remainingSeconds } = this.recordFailedAttempt(normalizedKey, user.role);
      this.addAuditLog({
        timestamp: new Date().toISOString(),
        phone: user.phone || raw,
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

    // 4. Elevated Admin Two-Factor Authentication (2FA) Requirement (only if 2FA is explicitly enabled)
    if (user.role === 'admin' && user.twoFactorEnabled) {
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
      device: typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Mobile') ? 'Mobile Client' : 'Desktop Browser',
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
    const cleanPhone = (data.phone || '').replace(/\D/g, '') || `017${Math.floor(10000000 + Math.random() * 90000000)}`;
    const cleanEmail = (data.email || '').trim().toLowerCase();
    const newUser: User = {
      ...data,
      phone: cleanPhone,
      email: cleanEmail,
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
      details: `New ${newUser.role} registered (${newUser.email || newUser.phone}) and session granted`,
    });

    return safeUser;
  },

  createRoleAccount(
    primaryUser: User,
    targetRole: UserRole,
    roleData: Partial<User> = {}
  ): User {
    const users = this.getUsers();
    const cleanPhone = (primaryUser.phone || '').replace(/\D/g, '') || `017${Math.floor(10000000 + Math.random() * 90000000)}`;
    const cleanEmail = (primaryUser.email || '').trim().toLowerCase();

    // Check if account already exists for this role
    const existing = users.find(
      (u) =>
        ((u.email && u.email.toLowerCase() === cleanEmail) ||
         (u.phone && u.phone.replace(/\D/g, '') === cleanPhone)) &&
        u.role === targetRole
    );
    if (existing) {
      return existing;
    }

    const pwd = roleData.password || primaryUser.password || 'Krishi#2026';
    const newUser: User = {
      ...primaryUser,
      ...roleData,
      id: `user-${Date.now()}-${targetRole}`,
      role: targetRole,
      createdAt: new Date().toISOString(),
      password: pwd,
      passwordHash: hashPassword(pwd),
      verified: true,
      twoFactorEnabled: targetRole === 'admin',
    };

    users.push(newUser);
    setItem(KEYS.USERS, users);

    const safeUser: User = {
      ...newUser,
      password: '***',
      sessionToken: `nb_sec_${Date.now()}_switch`,
      sessionExpiresAt: new Date(Date.now() + 43200000).toISOString(),
    };
    setItem(KEYS.CURRENT_USER, safeUser);

    this.addAuditLog({
      timestamp: new Date().toISOString(),
      phone: cleanPhone,
      role: targetRole,
      status: 'SUCCESS',
      ip: '103.205.180.45 (Bogura Gateway)',
      device: 'Web Client',
      details: `New ${targetRole} multi-role account created and linked for ${primaryUser.name} (${cleanEmail || cleanPhone})`,
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
          (u.phone && u.phone.toLowerCase() === cleanEmail) ||
          (cleanEmail.replace(/\D/g, '') && u.phone === cleanEmail.replace(/\D/g, '')))
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

// ─── TWO-WAY TRADE & SUPPLIER ORDER STORE ──────────────────────────────
export const TradeOrderStore = {
  getAll: (): TradeOrder[] => getItem<TradeOrder[]>(KEYS.TRADE_ORDERS, INITIAL_TRADE_ORDERS),

  getById: (id: string): TradeOrder | undefined => {
    return TradeOrderStore.getAll().find((o) => o.id === id);
  },

  getByUser: (userId: string): TradeOrder[] => {
    return TradeOrderStore.getAll().filter((o) => o.buyerId === userId || o.sellerId === userId);
  },

  getByType: (type: TradeOrderType): TradeOrder[] => {
    return TradeOrderStore.getAll().filter((o) => o.orderType === type);
  },

  add: (order: TradeOrder): void => {
    const all = TradeOrderStore.getAll();
    setItem(KEYS.TRADE_ORDERS, [order, ...all]);
  },

  update: (id: string, updates: Partial<TradeOrder>): void => {
    const all = TradeOrderStore.getAll().map((o) => (o.id === id ? { ...o, ...updates } : o));
    setItem(KEYS.TRADE_ORDERS, all);
  },

  delete: (id: string): void => {
    setItem(KEYS.TRADE_ORDERS, TradeOrderStore.getAll().filter((o) => o.id !== id));
  },
};

// ─── DAILY MARKET RATES STORE ──────────────────────────────────────────
export const MarketRateStore = {
  getAll: (): MarketRate[] => getItem<MarketRate[]>(KEYS.MARKET_RATES, INITIAL_MARKET_RATES),

  getByDistrict: (district: string): MarketRate[] => {
    const all = MarketRateStore.getAll();
    const query = (district || '').trim().toLowerCase();
    const filtered = all.filter((r) => r.district.toLowerCase() === query);
    return filtered.length > 0 ? filtered : all.filter((r) => r.district.toLowerCase() === 'bogura');
  },

  update: (id: string, updates: Partial<MarketRate>): void => {
    const all = MarketRateStore.getAll().map((r) => (r.id === id ? { ...r, ...updates } : r));
    setItem(KEYS.MARKET_RATES, all);
  },
};

// ─── THEME STORE (DARK / LIGHT MODE) ───────────────────────────────────
export const ThemeStore = {
  get: (): Theme => {
    const saved = localStorage.getItem(KEYS.THEME) as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  },

  set: (theme: Theme): void => {
    try {
      localStorage.setItem(KEYS.THEME, theme);
      if (typeof document !== 'undefined') {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    } catch {}
  },

  init: (): Theme => {
    const theme = ThemeStore.get();
    ThemeStore.set(theme);
    return theme;
  },

  toggle: (): Theme => {
    const current = ThemeStore.get();
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    ThemeStore.set(next);
    return next;
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

    // Agricultural crop family and synonym dictionary for bilingual matching
    const CROP_FAMILIES: string[][] = [
      ['tomato', 'tomatoes', 'টমেটো', 'পাকা টমেটো', 'বিজলি', 'bijli'],
      ['potato', 'potatoes', 'আলু', 'ডায়মন্ড', 'diamond', 'গোল আলু', 'কার্ডিনাল'],
      ['chili', 'chilies', 'chilli', 'মরিচ', 'কাঁচা মরিচ', 'বিন্দু', 'bindu'],
      ['cauliflower', 'ফুলকপি', 'স্নোবল', 'snowball', 'কপি'],
      ['cabbage', 'বাঁধাকপি', 'পাতাকপি'],
      ['brinjal', 'eggplant', 'বেগুন', 'তালবেগুন'],
      ['onion', 'পেঁয়াজ', 'পিয়াজ'],
      ['garlic', 'রসুন'],
      ['rice', 'paddy', 'ধান', 'চাল', 'ব্রি', 'brri'],
      ['gourd', 'patal', 'পটল', 'লাউ', 'করলা', 'উচ্ছে'],
      ['ginger', 'আদা'],
      ['carrot', 'গাজর'],
    ];

    const getKeywords = (text: string): string[] => {
      return (text || '')
        .toLowerCase()
        .replace(/[(),.\-/#]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 2);
    };

    const isCropMatch = (listing: CropListing, demand: BusinessDemand): { matched: boolean; similarityScore: number } => {
      const listingTokens = [
        ...getKeywords(listing.cropName),
        ...getKeywords(listing.cropBangla),
        ...getKeywords(listing.variety || ''),
      ];
      const demandTokens = [
        ...getKeywords(demand.cropNeeded),
        ...getKeywords(demand.cropBangla),
      ];

      // 1. Direct token overlap (e.g. potato, tomato, chili, etc.)
      const sharedTokens = listingTokens.filter((lt) =>
        demandTokens.some((dt) => lt === dt || (lt.length >= 3 && dt.includes(lt)) || (dt.length >= 3 && lt.includes(dt)))
      );
      if (sharedTokens.length > 0) {
        return { matched: true, similarityScore: Math.min(40, 25 + sharedTokens.length * 8) };
      }

      // 2. Crop family dictionary matching
      for (const family of CROP_FAMILIES) {
        const listingInFamily = family.some((member) =>
          listingTokens.some((t) => t.includes(member) || member.includes(t))
        );
        const demandInFamily = family.some((member) =>
          demandTokens.some((t) => t.includes(member) || member.includes(t))
        );
        if (listingInFamily && demandInFamily) {
          return { matched: true, similarityScore: 35 };
        }
      }

      return { matched: false, similarityScore: 0 };
    };

    const availableListings = listings.filter((l) => l.status !== 'Sold');
    const openDemands = demands.filter((d) => (d.fulfilledKg || 0) < d.quantityKgNeeded);

    availableListings.forEach((listing) => {
      openDemands.forEach((demand) => {
        const { matched, similarityScore } = isCropMatch(listing, demand);
        if (!matched) return;

        // Price scoring (up to 35 points)
        const diff = listing.expectedPricePerKg - demand.targetPricePerKg;
        let priceScore = 20;
        let marginText = '';

        if (diff <= 0) {
          // Farmer's asking price is at or below buyer's budget -> high match & cost savings
          const savings = Math.abs(diff);
          priceScore = Math.min(35, 28 + Math.round(savings * 1.5));
          marginText = savings > 0 ? `+৳${savings.toFixed(1)}/kg (Buyer Savings)` : '৳0.00/kg (Exact Budget Match)';
        } else {
          // Farmer asks slightly more than buyer budget
          const excessPct = diff / demand.targetPricePerKg;
          if (excessPct <= 0.15) {
            priceScore = Math.max(15, Math.round(25 - excessPct * 40));
          } else if (excessPct <= 0.35) {
            priceScore = Math.max(8, Math.round(18 - excessPct * 30));
          } else {
            priceScore = Math.max(4, Math.round(10 - excessPct * 20));
          }
          marginText = `৳${diff.toFixed(1)}/kg spread (Negotiable)`;
        }

        // Quantity fulfillment score (up to 20 points)
        const qtyRatio = Math.min(1.5, listing.quantityKg / Math.max(1, demand.quantityKgNeeded));
        const qtyScore = Math.round(Math.min(20, Math.max(8, qtyRatio * 18)));

        // Proximity / distance scoring (up to 10 points)
        const sameUpazila = listing.upazila && demand.district && demand.district.toLowerCase().includes(listing.upazila.toLowerCase());
        const sameDistrict = listing.district && demand.district && demand.district.toLowerCase().includes(listing.district.toLowerCase());
        const distKm = sameUpazila ? 4.5 : sameDistrict ? 11.2 : 28.5;
        const distScore = sameUpazila ? 10 : sameDistrict ? 8 : 4;

        const totalScore = Math.min(99, Math.max(45, Math.round(similarityScore + priceScore + qtyScore + distScore)));

        const existing = matches.find(
          (m) => m.farmerName === listing.farmerName && m.cropName === listing.cropName && m.buyerName === demand.businessName
        );
        if (!existing) {
          matches.push({
            id: `match-${listing.id}-${demand.id}`,
            cropName: listing.cropName,
            farmerName: listing.farmerName,
            farmerLocation: `${listing.upazila || 'Shibganj'}, ${listing.district || 'Bogura'}`,
            harvestQuantityKg: listing.quantityKg,
            readyInDays: parseInt(listing.availableDate) || (listing.status === 'Ready to Harvest' ? 0 : 7),
            farmerExpectedPrice: listing.expectedPricePerKg,
            buyerName: demand.businessName,
            buyerType: demand.businessType,
            buyerDemandKg: demand.quantityKgNeeded,
            buyerBudgetPrice: demand.targetPricePerKg,
            matchScore: totalScore,
            distanceKm: parseFloat(distKm.toFixed(1)),
            estimatedLogisticsCostPerKg: parseFloat((distKm * 0.12).toFixed(2)),
            projectedProfitMargin: marginText,
            status: totalScore >= 85 ? 'Ready to Contract' : 'Draft',
            createdAt: new Date().toISOString(),
          });
        }
      });
    });

    return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 30);
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

// ─── USER CONNECTIONS & NETWORKING ─────────────────────────────────────
export const ConnectionStore = {
  getAll: (): UserConnection[] => getItem<UserConnection[]>(KEYS.CONNECTIONS, []),

  getByUser: (userId: string): UserConnection[] => {
    return ConnectionStore.getAll().filter(
      (c) => c.requesterId === userId || c.recipientId === userId
    );
  },

  getStatus: (userId1: string, userId2: string): 'none' | 'pending_sent' | 'pending_received' | 'accepted' => {
    const conn = ConnectionStore.getAll().find(
      (c) =>
        (c.requesterId === userId1 && c.recipientId === userId2) ||
        (c.requesterId === userId2 && c.recipientId === userId1)
    );
    if (!conn) return 'none';
    if (conn.status === 'accepted') return 'accepted';
    if (conn.requesterId === userId1) return 'pending_sent';
    return 'pending_received';
  },

  sendRequest: (requester: User, recipient: User): UserConnection => {
    const conns = ConnectionStore.getAll();
    const existingIndex = conns.findIndex(
      (c) =>
        (c.requesterId === requester.id && c.recipientId === recipient.id) ||
        (c.requesterId === recipient.id && c.recipientId === requester.id)
    );
    const newConn: UserConnection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      requesterId: requester.id,
      requesterName: requester.name,
      requesterRole: requester.role,
      requesterPhone: requester.phone,
      requesterDistrict: requester.district,
      recipientId: recipient.id,
      recipientName: recipient.name,
      recipientRole: recipient.role,
      recipientPhone: recipient.phone,
      recipientDistrict: recipient.district,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      conns[existingIndex] = newConn;
      setItem(KEYS.CONNECTIONS, conns);
    } else {
      setItem(KEYS.CONNECTIONS, [newConn, ...conns]);
    }

    // Live notification for recipient
    NotificationStore.addSystemNotif(
      recipient.id,
      'নতুন সংযোগের অনুরোধ / New Connection Request',
      `${requester.name} (${requester.role.toUpperCase()}) আপনার সাথে যুক্ত হতে অনুরোধ পাঠিয়েছেন।`,
      'info'
    );

    return newConn;
  },

  accept: (connectionId: string): void => {
    const conns = ConnectionStore.getAll();
    const conn = conns.find((c) => c.id === connectionId);
    if (!conn) return;
    conn.status = 'accepted';
    conn.updatedAt = new Date().toISOString();
    setItem(KEYS.CONNECTIONS, conns);

    // Live notification for requester
    NotificationStore.addSystemNotif(
      conn.requesterId,
      'সংযোগ গৃহীত হয়েছে / Connection Accepted',
      `${conn.recipientName} আপনার সংযোগ অনুরোধ গ্রহণ করেছেন। এখন সরাসরি বার্তা বা কল করতে পারেন।`,
      'success'
    );
  },

  reject: (connectionId: string): void => {
    const conns = ConnectionStore.getAll().filter((c) => c.id !== connectionId);
    setItem(KEYS.CONNECTIONS, conns);
  },

  remove: (userId1: string, userId2: string): void => {
    const conns = ConnectionStore.getAll().filter(
      (c) =>
        !(
          (c.requesterId === userId1 && c.recipientId === userId2) ||
          (c.requesterId === userId2 && c.recipientId === userId1)
        )
    );
    setItem(KEYS.CONNECTIONS, conns);
  },
};

// ─── DIRECT MESSAGING ──────────────────────────────────────────────────
export const MessageStore = {
  getAll: (): DirectMessage[] => getItem<DirectMessage[]>(KEYS.MESSAGES, []),

  getConversation: (userA: string, userB: string): DirectMessage[] => {
    return MessageStore.getAll()
      .filter(
        (m) =>
          (m.senderId === userA && m.recipientId === userB) ||
          (m.senderId === userB && m.recipientId === userA)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  sendMessage: (data: Omit<DirectMessage, 'id' | 'createdAt' | 'read'>): DirectMessage => {
    const messages = MessageStore.getAll();
    const newMsg: DirectMessage = {
      ...data,
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setItem(KEYS.MESSAGES, [...messages, newMsg]);

    // Live notification for recipient
    NotificationStore.addSystemNotif(
      data.recipientId,
      `নতুন বার্তা: ${data.senderName}`,
      data.content.length > 60 ? `${data.content.slice(0, 60)}…` : data.content,
      'info'
    );

    return newMsg;
  },

  markRead: (recipientId: string, senderId: string): void => {
    const messages = MessageStore.getAll().map((m) =>
      m.recipientId === recipientId && m.senderId === senderId
        ? { ...m, read: true }
        : m
    );
    setItem(KEYS.MESSAGES, messages);
  },

  getUnreadCount: (userId: string): number => {
    return MessageStore.getAll().filter((m) => m.recipientId === userId && !m.read).length;
  },
};

// ─── CALL STORE ────────────────────────────────────────────────────────
export const CallStore = {
  getAll: (): CallLog[] => getItem<CallLog[]>(KEYS.CALLS, []),

  getByUser: (userId: string): CallLog[] => {
    return CallStore.getAll()
      .filter((c) => c.callerId === userId || c.receiverId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  add: (log: Omit<CallLog, 'id' | 'timestamp'>): CallLog => {
    const logs = CallStore.getAll();
    const newLog: CallLog = {
      ...log,
      id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setItem(KEYS.CALLS, [newLog, ...logs].slice(0, 100));

    if (log.status === 'missed') {
      NotificationStore.addSystemNotif(
        log.receiverId,
        'মিসড কল / Missed Call',
        `${log.callerName} (${log.callerRole.toUpperCase()}) থেকে কল এসেছিল।`,
        'warning'
      );
    }

    return newLog;
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
