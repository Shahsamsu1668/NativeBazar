// ─── CORE TYPES ────────────────────────────────────────────────────────

export type UserRole = 'farmer' | 'businessman' | 'supplier' | 'customer' | 'expert' | 'admin';
export type Language = 'en' | 'bn';
export type Theme = 'light' | 'dark';

// ─── USER / AUTH ────────────────────────────────────────────────────────
export interface User {
  id: string;
  role: UserRole;
  name: string;
  nameBn?: string;
  phone: string;
  password: string; // stored hashed in production, plain here for demo
  email: string; // Required for all registered users
  district: string;
  upazila?: string;
  education?: string; // Academic/Training qualification
  profileImageUrl?: string;
  verified: boolean;
  createdAt: string;
  // Security & Authentication
  passwordHash?: string;
  securityPin?: string; // 2FA PIN for Admin
  sessionToken?: string;
  sessionExpiresAt?: string;
  twoFactorEnabled?: boolean;
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string;
  // Farmer extras
  farmSizeAcres?: number;
  primaryCrops?: string[];
  // Businessman extras
  businessName?: string;
  businessType?: BusinessDemand['businessType'];
  // Supplier extras
  shopName?: string;
  licenseNumber?: string;
  // Expert extras
  designation?: string;
  institution?: string;
  specialization?: string[];
}

// ─── CROP LISTING ────────────────────────────────────────────────────────
export interface CropListing {
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
  marketBenchmarkPrice: number;
  status: 'Growing' | 'Ready to Harvest' | 'Sold' | 'Pre-contracted';
  imageUrl: string;
  fertilizerNeeded?: string[];
  matchedBuyersCount: number;
  forwardContractOffer?: {
    buyerName: string;
    offeredPrice: number;
    escrowAmountBDT: number;
  };
  qualityGrade?: 'A' | 'B' | 'C';
  organicCertified?: boolean;
  qrCode?: string;
  createdAt?: string;
}

// ─── BUSINESS DEMAND ─────────────────────────────────────────────────────
export interface BusinessDemand {
  id: string;
  buyerId?: string;
  businessName: string;
  businessType: 'Wholesaler' | 'Supermarket' | 'Agro Processor' | 'Restaurant Chain' | 'Exporter';
  contactPerson: string;
  phone: string;
  cropNeeded: string;
  cropBangla: string;
  quantityKgNeeded: number;
  fulfilledKg: number;
  targetPricePerKg: number;
  deliveryDeadline: string;
  district: string;
  urgent: boolean;
  notes: string;
  createdAt?: string;
}

// ─── SUPPLIER PRODUCT ────────────────────────────────────────────────────
export interface SupplierProduct {
  id: string;
  supplierId?: string;
  supplierName: string;
  shopName: string;
  category: 'Fertilizer' | 'Pesticide' | 'Seeds' | 'Machinery' | 'Organic';
  name: string;
  banglaName: string;
  brand: string;
  unitPriceBDT: number;
  unit: string;
  inStock: boolean;
  distanceKm: number;
  rating: number;
  phone: string;
  suitableCrops: string[];
  stockQty?: number;
  description?: string;
}

// ─── MARKET RATES ────────────────────────────────────────────────────────
export interface MarketRate {
  id: string;
  district: string;
  marketName: string;
  marketNameBn: string;
  cropName: string;
  banglaName: string;
  category: 'Vegetables' | 'Tubers' | 'Grains' | 'Spices' | 'Fruits';
  wholesalePrice: number; // Local district wholesale
  wholesaleDhaka: number; // Dhaka capital wholesale
  retailPrice: number;    // Local retail
  unit: string;           // 'kg' | 'maund' | 'piece' | 'crate'
  change24h: number;
  trend: 'up' | 'down' | 'stable';
  source: string;         // 'Department of Agricultural Marketing (DAM)'
  lastUpdated: string;
}

// ─── CUSTOMER PRODUCT ────────────────────────────────────────────────────
export interface CustomerProduct {
  id: string;
  farmerName: string;
  farmerId?: string;
  farmerLocation: string;
  cropName: string;
  banglaName: string;
  pricePerKg: number;
  marketPricePerKg: number;
  availableKg: number;
  harvestStatus: 'Harvested Today' | 'Pre-Order: Harvests in 3 Days' | 'Farm Fresh';
  imageUrl: string;
  organicCertified: boolean;
  farmerCutPercent: number;
  qualityGrade?: 'A' | 'B' | 'C';
  rating?: number;
  reviewCount?: number;
}

// ─── CART & ORDER ────────────────────────────────────────────────────────
export interface CartItem {
  product: CustomerProduct;
  quantityKg: number;
}

export interface CustomerOrder {
  id: string;
  customerId?: string;
  customerName: string;
  phone: string;
  items: CartItem[];
  totalBDT: number;
  paymentMethod: 'bKash' | 'Nagad' | 'Cash on Delivery' | 'Rocket';
  deliveryAddress: string;
  status: 'Confirmed' | 'Dispatched' | 'Delivered' | 'Cancelled' | 'Disputed';
  orderDate: string;
  deliveryDate?: string;
  trackingCode?: string;
  rating?: number;
  review?: string;
}

// ─── TWO-WAY TRADING & SUPPLIER ORDER MANAGEMENT ──────────────────────────
export type TradeOrderType = 'supplier_input' | 'b2b_trade' | 'consumer_retail';

export interface TradeOrderItem {
  itemId: string;
  itemName: string;
  itemBangla?: string;
  category?: string;
  unitPrice: number;
  unit: string;
  quantity: number;
  subtotal: number;
}

export interface TradeOrder {
  id: string; // e.g. "ORD-SUP-1002" or "ORD-TRD-2005"
  orderType: TradeOrderType;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string;
  buyerRole: UserRole;
  sellerId: string;
  sellerName: string;
  sellerPhone?: string;
  sellerRole: UserRole;
  title: string;
  titleBn?: string;
  items: TradeOrderItem[];
  totalBDT: number;
  paymentMethod: 'bKash' | 'Nagad' | 'Bank Transfer' | 'Cash on Delivery' | 'Escrow Guarantee';
  deliveryAddress: string;
  district: string;
  upazila?: string;
  status: 'Pending' | 'Confirmed' | 'Dispatched' | 'Delivered' | 'Cancelled';
  createdAt: string;
  deliveredAt?: string;
  notes?: string;
}

// ─── CROP DIAGNOSIS ──────────────────────────────────────────────────────
export interface CropDiagnosisResult {
  diseaseName: string;
  diseaseBanglaName: string;
  confidence?: number;
  severity: 'Low' | 'Moderate' | 'High' | 'Critical';
  symptomsSummary: string;
  immediateActions: string[];
  chemicalTreatment: {
    medicine: string;
    dose: string;
    schedule: string;
  };
  organicTreatment: string;
  preventionTips: string;
  aiDisclaimer?: string;
  pesticideSafetyWarning?: string;
  isAiEstimate?: boolean;
  verifiedBySAAO?: boolean;
  expertEscalationNeeded?: boolean;
}

// ─── AGRO ADVISORY ───────────────────────────────────────────────────────
export interface AgroAdvisory {
  id: string;
  expertId?: string;
  expertName: string;
  designation: string;
  title: string;
  titleBn: string;
  category: 'Weather Alert' | 'Pest Outbreak' | 'Soil Advice' | 'Market Alert' | 'Price Warning';
  message: string;
  messageBn: string;
  severity: 'Warning' | 'Urgent' | 'Information';
  district: string;
  date: string;
  affectedCrops?: string[];
}

// ─── AI MATCH ────────────────────────────────────────────────────────────
export interface AIMatchItem {
  id: string;
  cropName: string;
  farmerName: string;
  farmerLocation: string;
  harvestQuantityKg: number;
  readyInDays: number;
  farmerExpectedPrice: number;
  buyerName: string;
  buyerType: string;
  buyerDemandKg: number;
  buyerBudgetPrice: number;
  matchScore: number;
  distanceKm: number;
  estimatedLogisticsCostPerKg: number;
  projectedProfitMargin: string;
  status: 'Ready to Contract' | 'Draft' | 'Locked in Escrow';
  createdAt?: string;
}

// ─── EXPENSE LEDGER ──────────────────────────────────────────────────────
export interface ExpenseLedgerEntry {
  id: string;
  farmerId: string;
  date: string;
  type: 'expense' | 'income';
  category: 'Fertilizer' | 'Pesticide' | 'Seeds' | 'Labor' | 'Irrigation' | 'Transport' | 'Sale' | 'Other';
  description: string;
  descriptionBn?: string;
  amountBDT: number;
  cropRelated?: string;
}

// ─── NEGOTIATION ────────────────────────────────────────────────────────
export interface NegotiationOffer {
  id: string;
  listingId: string;
  demandId?: string;
  buyerName: string;
  buyerPhone: string;
  offeredPricePerKg: number;
  quantityKg: number;
  message: string;
  status: 'Pending' | 'Accepted' | 'Countered' | 'Rejected';
  counterPrice?: number;
  createdAt: string;
}

// ─── NOTIFICATION ────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'danger' | 'ai';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// ─── WEATHER ────────────────────────────────────────────────────────────
export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
  descriptionBn: string;
  icon: string;
  forecast: WeatherForecastDay[];
  cropAlerts: CropWeatherAlert[];
}

export interface WeatherForecastDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitation: number;
  weatherCode: number;
}

export interface CropWeatherAlert {
  crop: string;
  cropBn: string;
  alertType: 'frost' | 'drought' | 'flood' | 'fog' | 'heatwave' | 'disease_risk' | 'ideal';
  message: string;
  messageBn: string;
  severity: 'low' | 'medium' | 'high';
}

// ─── VIEW TYPES ─────────────────────────────────────────────────────────
export type ActiveView = 'dashboard' | 'market_rates' | 'weather' | 'orders' | 'ledger' | 'profile' | 'notifications' | 'contacts';

// ─── CONNECTIONS & NETWORKING ───────────────────────────────────────────
export interface UserConnection {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterRole: UserRole;
  requesterPhone?: string;
  requesterDistrict?: string;
  recipientId: string;
  recipientName: string;
  recipientRole: UserRole;
  recipientPhone?: string;
  recipientDistrict?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt?: string;
}

// ─── DIRECT MESSAGING ───────────────────────────────────────────────────
export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId: string;
  recipientName: string;
  recipientRole: UserRole;
  content: string;
  createdAt: string;
  read: boolean;
  messageType?: 'text' | 'price_offer' | 'order_inquiry' | 'advisory';
}

// ─── CALL LOGS ──────────────────────────────────────────────────────────
export interface CallLog {
  id: string;
  callerId: string;
  callerName: string;
  callerRole: UserRole;
  receiverId: string;
  receiverName: string;
  receiverRole: UserRole;
  receiverPhone: string;
  status: 'completed' | 'missed' | 'cancelled';
  durationSeconds: number;
  timestamp: string;
}

// ─── SECURITY & AUDIT ───────────────────────────────────────────────────
export interface LoginAuditLog {
  id: string;
  timestamp: string;
  phone: string;
  role: UserRole;
  status: 'SUCCESS' | 'FAILED_PASSWORD' | 'FAILED_2FA' | 'LOCKED';
  ip: string;
  device: string;
  details?: string;
}

