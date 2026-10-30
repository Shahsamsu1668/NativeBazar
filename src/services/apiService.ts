/**
 * NativeBazar API Service
 * Connects frontend UI components to persistent backend REST endpoints.
 */

import { User, CropListing, SupplierProduct, CustomerOrder, DirectMessage, UserConnection, Notification, CallLog } from '../types';
import { CatalogProduct } from '../data/catalogData';

const BASE_URL = '/api';

export interface RegisterPayload {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: 'farmer' | 'wholesaler' | 'retailer' | 'consumer';
  district: string;
  upazila?: string;
  farmSizeAcres?: number;
  primaryCrops?: string[];
  shopName?: string;
  licenseNumber?: string;
  isOrganicCertified?: boolean;
}

export interface LoginPayload {
  identifier: string;
  password: string;
  role?: string;
  securityPin?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  user?: User;
  token?: string;
  crop?: CropListing;
  crops?: CropListing[];
  product?: SupplierProduct;
  products?: SupplierProduct[];
  order?: CustomerOrder;
  orders?: CustomerOrder[];
  trackingCode?: string;
  stats?: any;
  error?: string;
  message?: string;
  require2FA?: boolean;
  locked?: boolean;
  remainingSeconds?: number;
}

export const apiService = {
  // ── Auth ─────────────────────────────────────────────────────────────
  async register(payload: RegisterPayload): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async login(payload: LoginPayload): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async getMe(token?: string, phone?: string): Promise<ApiResponse<{ user: User }>> {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const query = phone ? `?phone=${encodeURIComponent(phone)}` : '';
      const res = await fetch(`${BASE_URL}/auth/me${query}`, { headers });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── User Directory ───────────────────────────────────────────────────
  async getUsers(filter?: {
    excludeId?: string;
    viewerRole?: string;
    role?: string;
    district?: string;
    search?: string;
  }): Promise<{ success: boolean; users: User[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filter?.excludeId) params.append('excludeId', filter.excludeId);
      if (filter?.viewerRole) params.append('viewerRole', filter.viewerRole);
      if (filter?.role && filter.role !== 'all') params.append('role', filter.role);
      if (filter?.district && filter.district !== 'all') params.append('district', filter.district);
      if (filter?.search && filter.search.trim()) params.append('search', filter.search.trim());
      const res = await fetch(`${BASE_URL}/users?${params.toString()}`);
      return await res.json();
    } catch (err: any) {
      return { success: false, users: [], total: 0 };
    }
  },

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<{ user: User }>> {
    try {
      const res = await fetch(`${BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Crop Listings ────────────────────────────────────────────────────
  async getCrops(filter?: { farmerId?: string; district?: string }): Promise<CropListing[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.farmerId) params.append('farmerId', filter.farmerId);
      if (filter?.district) params.append('district', filter.district);
      const res = await fetch(`${BASE_URL}/crops?${params.toString()}`);
      const data = await res.json();
      return data.crops || [];
    } catch {
      return [];
    }
  },

  async createCrop(cropData: Partial<CropListing>): Promise<ApiResponse<CropListing>> {
    try {
      const res = await fetch(`${BASE_URL}/crops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cropData),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async updateCrop(id: string, updates: Partial<CropListing>): Promise<ApiResponse<CropListing>> {
    try {
      const res = await fetch(`${BASE_URL}/crops/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async deleteCrop(id: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${BASE_URL}/crops/${id}`, { method: 'DELETE' });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Supplier Products (Organic Focused) ──────────────────────────────
  async getSupplierProducts(filter?: { supplierId?: string; category?: string; organicOnly?: boolean }): Promise<SupplierProduct[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.supplierId) params.append('supplierId', filter.supplierId);
      if (filter?.category) params.append('category', filter.category);
      if (filter?.organicOnly) params.append('organicOnly', 'true');
      const res = await fetch(`${BASE_URL}/supplier-products?${params.toString()}`);
      const data = await res.json();
      return data.products || [];
    } catch {
      return [];
    }
  },

  async createSupplierProduct(productData: Partial<SupplierProduct>): Promise<ApiResponse<SupplierProduct>> {
    try {
      const res = await fetch(`${BASE_URL}/supplier-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async updateSupplierProduct(id: string, updates: Partial<SupplierProduct>): Promise<ApiResponse<SupplierProduct>> {
    try {
      const res = await fetch(`${BASE_URL}/supplier-products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async deleteSupplierProduct(id: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${BASE_URL}/supplier-products/${id}`, { method: 'DELETE' });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Orders & Order Tracking ──────────────────────────────────────────
  async getOrders(filter?: { customerId?: string; sellerId?: string; orderType?: string }): Promise<CustomerOrder[]> {
    try {
      const params = new URLSearchParams();
      if (filter?.customerId) params.append('customerId', filter.customerId);
      if (filter?.sellerId) params.append('sellerId', filter.sellerId);
      if (filter?.orderType) params.append('orderType', filter.orderType);
      const res = await fetch(`${BASE_URL}/orders?${params.toString()}`);
      const data = await res.json();
      return (data.orders || []).map((o: any) => ({
        ...o,
        id: o.id || o.orderId,
        status: o.status || o.deliveryStatus,
        deliveryStatus: o.deliveryStatus || o.status,
      }));
    } catch {
      return [];
    }
  },

  async createOrder(orderData: any): Promise<ApiResponse<CustomerOrder>> {
    try {
      const res = await fetch(`${BASE_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async updateOrderStatus(id: string, status: CustomerOrder['status'], deliveredDate?: string): Promise<ApiResponse<CustomerOrder>> {
    try {
      const res = await fetch(`${BASE_URL}/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, deliveredDate }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Verified Buyer Review ────────────────────────────────────────────
  async submitReview(orderId: string, rating: number, comment: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${BASE_URL}/orders/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getReviews(productId?: string): Promise<any[]> {
    try {
      const url = productId ? `${BASE_URL}/reviews?productId=${productId}` : `${BASE_URL}/reviews`;
      const res = await fetch(url);
      const data = await res.json();
      return data.reviews || [];
    } catch {
      return [];
    }
  },

  // ── Dynamic Real Stats ───────────────────────────────────────────────
  async getStats(): Promise<any> {
    try {
      const res = await fetch(`${BASE_URL}/stats`);
      const data = await res.json();
      return data.stats || {};
    } catch {
      return {};
    }
  },

  // ── Master Agricultural Catalog ──────────────────────────────────────
  async getCatalog(
    category?: string,
    query?: string,
    page = 1,
    limit: number | 'all' = 24
  ): Promise<{ products: CatalogProduct[]; total: number; page: number; totalPages: number }> {
    try {
      const params = new URLSearchParams();
      if (category && category !== 'all') params.append('category', category);
      if (query && query.trim()) params.append('query', query.trim());
      params.append('page', String(page));
      params.append('limit', String(limit));
      const res = await fetch(`${BASE_URL}/catalog?${params.toString()}`);
      const data = await res.json();
      return {
        products: data.products || [],
        total: data.total || 0,
        page: data.page || 1,
        totalPages: data.totalPages || 1,
      };
    } catch {
      return { products: [], total: 0, page: 1, totalPages: 1 };
    }
  },

  async getCatalogProductById(id: string): Promise<CatalogProduct | null> {
    try {
      const res = await fetch(`${BASE_URL}/catalog/${id}`);
      const data = await res.json();
      return data.product || null;
    } catch {
      return null;
    }
  },

  // ── Direct Messaging ─────────────────────────────────────────────────
  async getMessages(userA: string, userB: string): Promise<DirectMessage[]> {
    try {
      const res = await fetch(`${BASE_URL}/messages?userA=${encodeURIComponent(userA)}&userB=${encodeURIComponent(userB)}`);
      const data = await res.json();
      return data.messages || [];
    } catch {
      return [];
    }
  },

  async sendMessage(payload: Omit<DirectMessage, 'id' | 'createdAt' | 'read'>): Promise<{ success: boolean; message?: DirectMessage; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async markMessagesRead(recipientId: string, senderId: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${BASE_URL}/messages/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId, senderId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Connections ──────────────────────────────────────────────────────
  async getConnections(userId: string): Promise<UserConnection[]> {
    try {
      const res = await fetch(`${BASE_URL}/connections?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      return data.connections || [];
    } catch {
      return [];
    }
  },

  async sendConnectionRequest(requesterId: string, recipientId: string): Promise<ApiResponse<UserConnection>> {
    try {
      const res = await fetch(`${BASE_URL}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId, recipientId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async updateConnectionStatus(id: string, status: 'accepted' | 'rejected'): Promise<ApiResponse<UserConnection>> {
    try {
      const res = await fetch(`${BASE_URL}/connections/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async deleteConnection(id: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${BASE_URL}/connections/${id}`, { method: 'DELETE' });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Notifications ────────────────────────────────────────────────────
  async getNotifications(userId: string): Promise<Notification[]> {
    try {
      const res = await fetch(`${BASE_URL}/notifications?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      return data.notifications || [];
    } catch {
      return [];
    }
  },

  async markNotificationRead(id: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${BASE_URL}/notifications/${id}/read`, { method: 'PUT' });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async markAllNotificationsRead(userId: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${BASE_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Logout ───────────────────────────────────────────────────────────
  async logout(userId?: string, token?: string): Promise<ApiResponse> {
    try {
      const res = await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId, token }),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── WebRTC Call Signaling & Logs ─────────────────────────────────────
  async sendCallSignal(signal: {
    toUserId: string;
    fromUserId: string;
    fromUserName: string;
    fromUserRole: string;
    type: 'call_offer' | 'call_answer' | 'ice_candidate' | 'call_reject' | 'call_end';
    sdp?: any;
    candidate?: any;
    reason?: string;
  }): Promise<ApiResponse> {
    try {
      const res = await fetch(`${BASE_URL}/calls/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async getCallLogs(userId: string): Promise<CallLog[]> {
    try {
      const res = await fetch(`${BASE_URL}/calls/logs?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      return data.logs || [];
    } catch {
      return [];
    }
  },

  async createCallLog(log: Omit<CallLog, 'id' | 'timestamp'>): Promise<ApiResponse<CallLog>> {
    try {
      const res = await fetch(`${BASE_URL}/calls/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Context-Aware Voice Assistant ────────────────────────────────────
  async callVoiceAssistant(payload: {
    query: string;
    role?: string;
    userLocation?: string;
    language?: string;
    userId?: string;
  }): Promise<{
    intent: 'ANSWER' | 'NAVIGATE' | 'CLARIFY';
    reply: string;
    action?: { label: string; action: string; route: string } | null;
  }> {
    try {
      const res = await fetch(`${BASE_URL}/ai/voice-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (err: any) {
      return {
        intent: 'ANSWER',
        reply: payload.language === 'en' ? 'Network error occurred. Please try again.' : 'নেটওয়ার্ক সংযোগ বিচ্ছিন্ন। দয়া করে পুনরায় চেষ্টা করুন।',
      };
    }
  },
};
