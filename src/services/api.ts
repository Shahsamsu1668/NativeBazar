/**
 * NativeBazar API Client
 * Persistent database-backed REST communications with the backend Express / SQLite server.
 */

import { MarketplaceProduct, SupplyChainOrder, WholesalerOffer, User, MarketRate } from '../types';

const BASE_URL = '';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let errMsg = `Request failed: ${res.statusText}`;
    try {
      const data = await res.json();
      if (data && data.error) errMsg = data.error;
    } catch {
      // fallback
    }
    throw new Error(errMsg);
  }

  return res.json();
}

// ─── AUTHENTICATION API ──────────────────────────────────────────────────────
export const authApi = {
  async register(userData: {
    role: string;
    name: string;
    phone: string;
    password: string;
    email?: string;
    district?: string;
    upazila?: string;
    farmSizeAcres?: number;
    primaryCrops?: string[];
    businessName?: string;
    businessType?: string;
    shopName?: string;
    licenseNumber?: string;
  }): Promise<{ success: boolean; user: User; message?: string }> {
    return fetchJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async login(credentials: {
    identifier: string;
    password: string;
    role?: string;
  }): Promise<{ success: boolean; user: User }> {
    return fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  async adminLogin(adminCredentials: {
    username: string;
    password: string;
    securityPin?: string;
  }): Promise<{ success: boolean; user: User }> {
    return fetchJson('/api/auth/admin-login', {
      method: 'POST',
      body: JSON.stringify(adminCredentials),
    });
  },
};

// ─── PRODUCTS MARKETPLACE API ────────────────────────────────────────────────
export const productApi = {
  async getProducts(params?: {
    targetRole?: string;
    sellerRole?: string;
    district?: string;
    category?: string;
    search?: string;
  }): Promise<{ products: MarketplaceProduct[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.targetRole) query.set('targetRole', params.targetRole);
    if (params?.sellerRole) query.set('sellerRole', params.sellerRole);
    if (params?.district && params.district !== 'All') query.set('district', params.district);
    if (params?.category && params.category !== 'All') query.set('category', params.category);
    if (params?.search) query.set('search', params.search);

    const qs = query.toString();
    return fetchJson(`/api/products${qs ? `?${qs}` : ''}`);
  },

  async createProduct(productData: Partial<MarketplaceProduct>): Promise<{ success: boolean; productId: string; targetRole: string }> {
    return fetchJson('/api/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  async updateProduct(id: string, updates: Partial<MarketplaceProduct>): Promise<{ success: boolean }> {
    return fetchJson(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    return fetchJson(`/api/products/${id}`, {
      method: 'DELETE',
    });
  },
};

// ─── STRICT SUPPLY CHAIN ORDERS API ──────────────────────────────────────────
export const orderApi = {
  async createOrder(orderPayload: {
    buyerId?: string;
    buyerName: string;
    buyerPhone: string;
    buyerEmail?: string;
    buyerRole: 'wholesaler' | 'retailer' | 'consumer';
    sellerId: string;
    sellerName: string;
    sellerPhone?: string;
    sellerRole: 'farmer' | 'wholesaler' | 'retailer';
    items: Array<{ productId: string; quantityKg: number }>;
    paymentMethod: string;
    deliveryAddress: string;
    district: string;
    notes?: string;
  }): Promise<{ success: boolean; order: any; message: string }> {
    return fetchJson('/api/orders', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });
  },

  async getOrders(params?: {
    userId?: string;
    role?: string;
    sellerId?: string;
    buyerId?: string;
  }): Promise<{ orders: SupplyChainOrder[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.userId) query.set('userId', params.userId);
    if (params?.role) query.set('role', params.role);
    if (params?.sellerId) query.set('sellerId', params.sellerId);
    if (params?.buyerId) query.set('buyerId', params.buyerId);

    const qs = query.toString();
    return fetchJson(`/api/orders${qs ? `?${qs}` : ''}`);
  },

  async updateStatus(
    orderId: string,
    status: 'Confirmed' | 'Processing' | 'Dispatched' | 'Delivered' | 'Cancelled',
    actorName = 'User',
    actorRole = 'seller'
  ): Promise<{ success: boolean; message: string }> {
    return fetchJson(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, actorName, actorRole }),
    });
  },
};

// ─── FARMER-ONLY INTELLIGENCE & WHOLESALER BIDS API ──────────────────────────
export const intelligenceApi = {
  async getFarmerIntelligence(district = 'Bogura'): Promise<{
    district: string;
    marketRates: MarketRate[];
    wholesalerOffers: WholesalerOffer[];
    highDemandCrops: Array<{ name: string; demandIndex: number; trend: string; reason: string }>;
    officialSource: string;
    lastRefreshed: string;
    verified: boolean;
  }> {
    return fetchJson(`/api/farmer/intelligence?district=${encodeURIComponent(district)}`);
  },

  async getWholesalerOffers(district?: string, crop?: string): Promise<{ offers: WholesalerOffer[] }> {
    const query = new URLSearchParams();
    if (district && district !== 'All') query.set('district', district);
    if (crop) query.set('crop', crop);
    const qs = query.toString();
    return fetchJson(`/api/wholesaler-offers${qs ? `?${qs}` : ''}`);
  },

  async createWholesalerOffer(offerData: Partial<WholesalerOffer>): Promise<{ success: boolean; offerId: string }> {
    return fetchJson('/api/wholesaler-offers', {
      method: 'POST',
      body: JSON.stringify(offerData),
    });
  },

  async getMarketPrices(district?: string): Promise<{ rates: MarketRate[]; source: string }> {
    const qs = district && district !== 'All' ? `?district=${encodeURIComponent(district)}` : '';
    return fetchJson(`/api/market-prices${qs}`);
  },
};

// ─── ADMIN METRICS API ───────────────────────────────────────────────────────
export const adminApi = {
  async getMetrics(): Promise<{
    userCounts: Array<{ role: string; count: number }>;
    productCounts: Array<{ target_role: string; count: number; total_kg: number }>;
    totalOrders: number;
    totalVolumeBDT: number;
    auditLogs: any[];
    timestamp: string;
  }> {
    return fetchJson('/api/admin/metrics');
  },
};
