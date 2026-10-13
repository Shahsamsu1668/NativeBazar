// ─── CORE TYPES ────────────────────────────────────────────────────────

export type UserRole = 'farmer' | 'businessman' | 'supplier' | 'customer' | 'expert' | 'admin';
export type Language = 'en' | 'bn';

// ─── USER / AUTH ────────────────────────────────────────────────────────
export interface User {
  id: string;
  role: UserRole;
  name: string;
  nameBn?: string;
  phone: string;
  password: string; // stored hashed in production, plain here for demo
  email?: string;
  district: string;
  upazila?: string;
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
  cropName: string;
  banglaName: string;
  category: 'Vegetables' | 'Tubers' | 'Grains' | 'Spices';
  wholesaleBogura: number;
  wholesaleDhaka: number;
  retailBogura: number;
  unit: string;
  change24h: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated?: string;
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

// ─── VIEW TYPES ──────────────────────────────────────────────────────────
export type ActiveView = 'dashboard' | 'market_rates' | 'blueprint' | 'weather' | 'orders' | 'ledger' | 'notifications';

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
