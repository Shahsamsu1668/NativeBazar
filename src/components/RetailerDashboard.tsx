import React, { useState, useEffect } from 'react';
import {
  Language,
  User,
  MarketplaceProduct,
  SupplyChainOrder,
} from '../types';
import { productApi, orderApi } from '../services/api';
import { toBanglaNumber } from './Header';
import { NotificationStore } from '../data/store';
import { MASTER_AGRICULTURAL_CATALOG } from '../data/catalogData';
import {
  Store,
  Package,
  Truck,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Search,
  RefreshCw,
  ShoppingBag,
  DollarSign,
  Trash2,
  BadgeCheck,
  Layers,
  ShieldCheck,
  MapPin,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface RetailerDashboardProps {
  currentUser: User;
  language: Language;
}

type RetailerTabId = 'wholesaler_retailer_trade' | 'retailer_consumer_trade';
type ConsumerSubTabId = 'store_products' | 'consumer_orders';

// ─── TRANSLATION & LOCALIZATION DICTIONARIES ─────────────────────────────────

const CATEGORY_MAP: Record<string, { en: string; bn: string }> = {
  Vegetables: { en: 'Vegetables', bn: 'সবজি' },
  vegetables: { en: 'Vegetables', bn: 'সবজি' },
  Tubers: { en: 'Tubers', bn: 'আলু ও কন্দ' },
  tubers: { en: 'Tubers', bn: 'আলু ও কন্দ' },
  Spices: { en: 'Spices', bn: 'মশলা' },
  spices: { en: 'Spices', bn: 'মশলা' },
  Grains: { en: 'Grains', bn: 'খাদ্যশস্য' },
  grains: { en: 'Grains', bn: 'খাদ্যশস্য' },
  Fruits: { en: 'Fruits', bn: 'ফলমূল' },
  fruits: { en: 'Fruits', bn: 'ফলমূল' },
  leafy_greens: { en: 'Leafy Greens', bn: 'শাকসবজি' },
  other: { en: 'Other Agricultural Produce', bn: 'অন্যান্য কৃষিপণ্য' },
};

const CROP_NAME_MAP: Record<string, { en: string; bn: string }> = {
  'Fresh Table Tomatoes': { en: 'Fresh Table Tomatoes', bn: 'তাজা পাকা টমেটো' },
  'Hybrid Tomato': { en: 'Hybrid Tomato', bn: 'হাইব্রিড পাকা টমেটো' },
  'Tomato': { en: 'Tomato', bn: 'টমেটো' },
  'Diamond Red Potato': { en: 'Diamond Red Potato', bn: 'ডায়মন্ড লাল গোল আলু' },
  'Potato': { en: 'Potato', bn: 'আলু' },
  'Eggplant / Brinjal': { en: 'Eggplant / Brinjal', bn: 'গোল তাল বেগুন' },
  'Brinjal': { en: 'Brinjal', bn: 'বেগুন' },
  'Eggplant': { en: 'Eggplant', bn: 'বেগুন' },
  'Snowball Cauliflower': { en: 'Snowball Cauliflower', bn: 'স্নোবল তাজা ফুলকপি' },
  'Cauliflower': { en: 'Cauliflower', bn: 'ফুলকপি' },
  'Green Cabbage': { en: 'Green Cabbage', bn: 'সবুজ পাতাকপি / বাঁধাকপি' },
  'Cabbage': { en: 'Cabbage', bn: 'বাঁধাকপি' },
  'Green Chili': { en: 'Green Chili', bn: 'দেশি তাজা কাঁচা মরিচ' },
  'Chili': { en: 'Chili', bn: 'কাঁচা মরিচ' },
  'Red Onion': { en: 'Red Onion', bn: 'দেশি লাল পেঁয়াজ' },
  'Onion': { en: 'Onion', bn: 'পেঁয়াজ' },
  'Garlic': { en: 'Garlic', bn: 'দেশি রসুন' },
  'Ginger': { en: 'Ginger', bn: 'তাজা আদা' },
  'Carrot': { en: 'Carrot', bn: 'কমলা গাজর' },
  'Cucumber': { en: 'Cucumber', bn: 'শসা' },
  'Bitter Gourd': { en: 'Bitter Gourd', bn: 'করলা / উচ্ছে' },
  'Bottle Gourd': { en: 'Bottle Gourd', bn: 'লাউ' },
  'Pointed Gourd': { en: 'Pointed Gourd', bn: 'পটল' },
  'Okra / Lady Finger': { en: 'Okra / Lady Finger', bn: 'ঢ্যাঁড়শ' },
  'Green Papaya': { en: 'Green Papaya', bn: 'কাঁচা পেঁপে' },
  'Papaya': { en: 'Papaya', bn: 'পেঁপে' },
  'Pumpkin': { en: 'Pumpkin', bn: 'মিষ্টি কুমড়া' },
  'Watermelon': { en: 'Watermelon', bn: 'তরমুজ' },
  'Banana': { en: 'Banana', bn: 'কলা' },
  'Guava': { en: 'Guava', bn: 'পেয়ারা' },
  'Mango': { en: 'Mango', bn: 'আম' },
  'Rice': { en: 'Rice / Paddy', bn: 'চাল / ধান' },
  'Wheat': { en: 'Wheat', bn: 'গম' },
  'Corn': { en: 'Corn / Maize', bn: 'ভুট্টা' },
  'Mustard': { en: 'Mustard Seeds', bn: 'সরিষা' },
  'Lentils': { en: 'Lentils / Dal', bn: 'মসুর ডাল' },
};

const METADATA_TRANSLATIONS: Record<string, string> = {
  'Shibganj Farmer Cooperatives, Bogura': 'শিবগঞ্জ কৃষক সমবায়, বগুড়া',
  'Mahasthangarh Wholesale Arat Hub': 'মহাস্থানগড় পাইকারি আড়ত হাব',
  'Verified Regional Wholesale Hub': 'যাচাইকৃত আঞ্চলিক পাইকারি আড়ত',
  'Direct Mokam': 'সরাসরি মোকাম',
  'Freshly stocked today': 'আজকের তাজা সংগ্রহ',
  'Ready for Home Delivery': 'হোম ডেলিভারির জন্য প্রস্তুত',
  'Fresh Farm Stock': 'তাজা খামারের ফসল',
  'Within 24 hours from farm gate': 'ক্ষেত থেকে ২৪ ঘণ্টার মধ্যে সংগৃহীত',
  '100% formalin-free tested. Harvested naturally without chemical ripening agents.': '১০০% ফরমালিনমুক্ত পরীক্ষিত। রাসায়নিক পাকানোর উপাদান ছাড়া প্রাকৃতিকভাবে সংগৃহীত।',
  'Crisp, hand-picked table tomatoes directly sourced from Shibganj fields. Certified formalin-free and ready for home delivery.': 'শিবগঞ্জের মাঠ থেকে সরাসরি সংগৃহীত তাজা পাকা টমেটো। ১০০% ফরমালিনমুক্ত এবং দ্রুত হোম ডেলিভারির জন্য প্রস্তুত।',
  'Bogura': 'বগুড়া',
  'Bogura Sadar': 'বগুড়া সদর',
  'Shibganj': 'শিবগঞ্জ',
  'Sherpur': 'শেরপুর',
  'Gabtali': 'গাবতলী',
  'Kahaloo': 'কাহালু',
  'Shajahanpur': 'শাজাহানপুর',
  'Dhaka': 'ঢাকা',
  'Rajshahi': 'রাজশাহী',
  'Rangpur': 'রংপুর',
  'Jashore': 'যশোর',
  'Dinajpur': 'দিনাজপুর',
  'Mymensingh': 'ময়মনসিংহ',
  'Cash on Delivery': 'ক্যাশ অন ডেলিভারি',
  'Bank Transfer / Wholesale Credit': 'ব্যাংক ট্রান্সফার / পাইকারি বাকী',
  'bKash': 'বিকাশ',
  'Nagad': 'নগদ',
};

export function getCategoryName(category: string | undefined, lang: Language): string {
  if (!category) return lang === 'bn' ? 'সাধারণ' : 'General';
  const match = CATEGORY_MAP[category];
  if (match) return lang === 'bn' ? match.bn : match.en;
  return category;
}

export function getCropName(prod: { cropName?: string; banglaName?: string }, lang: Language): string {
  if (lang === 'bn') {
    if (prod.banglaName && prod.banglaName.trim()) return prod.banglaName;
    if (prod.cropName && CROP_NAME_MAP[prod.cropName]) return CROP_NAME_MAP[prod.cropName].bn;
    const cat = MASTER_AGRICULTURAL_CATALOG.find(
      (c) => c.name.toLowerCase() === (prod.cropName || '').toLowerCase()
    );
    if (cat?.nameBn) return cat.nameBn;
    return prod.cropName || '';
  } else {
    if (prod.cropName && prod.cropName.trim()) return prod.cropName;
    if (prod.banglaName && CROP_NAME_MAP[prod.banglaName]) return CROP_NAME_MAP[prod.banglaName].en;
    const cat = MASTER_AGRICULTURAL_CATALOG.find((c) => c.nameBn === prod.banglaName);
    if (cat?.name) return cat.name;
    return prod.banglaName || '';
  }
}

export function translateMetadata(text: string | undefined, lang: Language): string {
  if (!text) return '';
  if (text.includes(' || ')) {
    const [en, bn] = text.split(' || ');
    return lang === 'bn' ? (bn || en) : (en || bn);
  }
  if (lang === 'en') {
    for (const [enKey, bnVal] of Object.entries(METADATA_TRANSLATIONS)) {
      if (text === bnVal) return enKey;
    }
    return text;
  }
  // Bengali active
  if (METADATA_TRANSLATIONS[text]) {
    return METADATA_TRANSLATIONS[text];
  }
  let translated = text;
  translated = translated
    .replace(/Bogura/g, 'বগুড়া')
    .replace(/Shibganj/g, 'শিবগঞ্জ')
    .replace(/Sherpur/g, 'শেরপুর')
    .replace(/Gabtali/g, 'গাবতলী')
    .replace(/Dhaka/g, 'ঢাকা')
    .replace(/Rajshahi/g, 'রাজশাহী')
    .replace(/Rangpur/g, 'রংপুর')
    .replace(/Jashore/g, 'যশোর')
    .replace(/Farmer Cooperatives/g, 'কৃষক সমবায়')
    .replace(/Farmer Cooperative/g, 'কৃষক সমবায়')
    .replace(/Wholesale Arat Hub/g, 'পাইকারি আড়ত হাব')
    .replace(/Wholesale Arat/g, 'পাইকারি আড়ত')
    .replace(/Arat Hub/g, 'আড়ত হাব')
    .replace(/Arat/g, 'আড়ত')
    .replace(/Retail Store/g, 'খুচরা দোকান')
    .replace(/Retail Outlet/g, 'খুচরা বিক্রয়কেন্দ্র')
    .replace(/Farm/g, 'খামার')
    .replace(/Direct Mokam/g, 'সরাসরি মোকাম')
    .replace(/Fresh Farm Stock/g, 'তাজা খামারের ফসল')
    .replace(/Ready for Home Delivery/g, 'হোম ডেলিভারির জন্য প্রস্তুত')
    .replace(/Freshly stocked today/g, 'আজকের তাজা সংগ্রহ')
    .replace(/100% formalin-free tested/g, '১০০% ফরমালিনমুক্ত পরীক্ষিত')
    .replace(/[0-9]/g, (d) => toBanglaNumber(d));
  return translated;
}

export function getCropDescription(desc: string | undefined, lang: Language): string {
  if (!desc) return '';
  if (desc.includes(' || ')) {
    const [en, bn] = desc.split(' || ');
    return lang === 'bn' ? (bn || en) : (en || bn);
  }
  if (lang === 'bn') {
    if (METADATA_TRANSLATIONS[desc]) return METADATA_TRANSLATIONS[desc];
    const cat = MASTER_AGRICULTURAL_CATALOG.find(
      (c) => c.descriptionEn.toLowerCase() === desc.toLowerCase()
    );
    if (cat?.descriptionBn) return cat.descriptionBn;
    return translateMetadata(desc, 'bn');
  } else {
    for (const [enKey, bnVal] of Object.entries(METADATA_TRANSLATIONS)) {
      if (desc === bnVal) return enKey;
    }
    const cat = MASTER_AGRICULTURAL_CATALOG.find((c) => c.descriptionBn === desc);
    if (cat?.descriptionEn) return cat.descriptionEn;
    return desc;
  }
}

export function translatePaymentMethod(method: string | undefined, lang: Language): string {
  if (!method) return '';
  if (lang === 'bn') {
    return METADATA_TRANSLATIONS[method] || method;
  }
  for (const [enKey, bnVal] of Object.entries(METADATA_TRANSLATIONS)) {
    if (method === bnVal) return enKey;
  }
  return method;
}

export const RetailerDashboard: React.FC<RetailerDashboardProps> = ({
  currentUser,
  language,
}) => {
  // Main Sub-sections under "খুচরা বিক্রেতার বাণিজ্য":
  // Tab 1: Wholesaler-Retailer Trade (পাইকার-খুচরা বিক্রেতার বাণিজ্য)
  // Tab 2: Retailer-Consumer Trade (খুচরা বিক্রেতা-ভোক্তার বাণিজ্য)
  const [activeTab, setActiveTab] = useState<RetailerTabId>('wholesaler_retailer_trade');
  const [consumerSubTab, setConsumerSubTab] = useState<ConsumerSubTabId>('store_products');

  // Tab 1: Procure from Wholesalers (Wholesaler -> Retailer)
  const [wholesaleListings, setWholesaleListings] = useState<MarketplaceProduct[]>([]);
  const [wholesaleLoading, setWholesaleLoading] = useState(false);
  const [wholesaleSearch, setWholesaleSearch] = useState('');
  const [selectedWholesaleLot, setSelectedWholesaleLot] = useState<MarketplaceProduct | null>(null);
  const [orderKg, setOrderKg] = useState(100);
  const [submittingWholesaleOrder, setSubmittingWholesaleOrder] = useState(false);

  // Tab 2: Retail Store Products & Consumer Orders (Retailer -> Consumer)
  const [myRetailProducts, setMyRetailProducts] = useState<MarketplaceProduct[]>([]);
  const [retailProductsLoading, setRetailProductsLoading] = useState(false);
  const [showAddRetailModal, setShowAddRetailModal] = useState(false);
  const [retailForm, setRetailForm] = useState({
    cropName: 'Fresh Table Tomatoes',
    banglaName: 'তাজা পাকা টমেটো',
    category: 'Vegetables',
    variety: 'Hybrid Shingro-3',
    quantityKg: 300,
    pricePerKg: 52,
    marketPricePerKg: 56,
    qualityGrade: 'A' as 'A' | 'B' | 'C',
    organicCertified: true,
    farmerOrigin: 'Shibganj Farmer Cooperatives, Bogura',
    farmerOriginBn: 'শিবগঞ্জ কৃষক সমবায়, বগুড়া',
    wholesalerArat: 'Mahasthangarh Wholesale Arat Hub',
    wholesalerAratBn: 'মহাস্থানগড় পাইকারি আড়ত হাব',
    locationDetails: currentUser.address || `${currentUser.upazila || 'Bogura Sadar'} Retail Store`,
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
    description: 'Crisp, hand-picked table tomatoes directly sourced from Shibganj fields. Certified formalin-free and ready for home delivery.',
    descriptionBn: 'শিবগঞ্জের মাঠ থেকে সরাসরি সংগৃহীত তাজা পাকা টমেটো। ১০০% ফরমালিনমুক্ত এবং দ্রুত হোম ডেলিভারির জন্য প্রস্তুত।',
    safetyNote: '100% formalin-free tested. Harvested naturally without chemical ripening agents.',
    safetyNoteBn: '১০০% ফরমালিনমুক্ত পরীক্ষিত। রাসায়নিক পাকানোর উপাদান ছাড়া প্রাকৃতিকভাবে সংগৃহীত।',
  });

  const [consumerOrders, setConsumerOrders] = useState<SupplyChainOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);
  const formatNum = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined) return '';
    return language === 'bn' ? toBanglaNumber(val) : String(val);
  };

  // Load Wholesale lots (sellerRole=wholesaler & targetRole=retailer)
  // Strictly enforce that Retailers ONLY procure from Wholesalers and never from Farmers
  const loadWholesaleListings = async () => {
    setWholesaleLoading(true);
    try {
      const res = await productApi.getProducts({
        sellerRole: 'wholesaler',
        targetRole: 'retailer',
        search: wholesaleSearch.trim() || undefined,
      });
      // Safety filter: ensure no farmer or unauthorized listings are displayed to retailers
      const strictlyWholesalers = (res.products || []).filter(
        (p) => (p.sellerRole || '').toLowerCase() === 'wholesaler'
      );
      setWholesaleListings(strictlyWholesalers);
    } catch (e) {
      console.error('Failed to load wholesale listings', e);
    } finally {
      setWholesaleLoading(false);
    }
  };

  // Load My Retail Products (sellerRole=retailer & targetRole=consumer)
  const loadMyRetailProducts = async () => {
    setRetailProductsLoading(true);
    try {
      const res = await productApi.getProducts({
        sellerId: currentUser.id,
        sellerRole: 'retailer',
        targetRole: 'consumer',
      });
      const mine = (res.products || []).filter(
        (p) => p.sellerId === currentUser.id || p.sellerName === currentUser.name
      );
      setMyRetailProducts(mine);
    } catch (e) {
      console.error('Failed to load retail products', e);
      setMyRetailProducts([]);
    } finally {
      setRetailProductsLoading(false);
    }
  };

  // Load Consumer Orders received by this Retailer
  const loadConsumerOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await orderApi.getOrders({
        sellerId: currentUser.id,
        role: 'retailer',
      });
      setConsumerOrders(res.orders || []);
    } catch (e) {
      console.error('Failed to load consumer orders', e);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadMyRetailProducts();
    loadWholesaleListings();
    loadConsumerOrders();
  }, [currentUser.id]);

  const [isPublishingProduct, setIsPublishingProduct] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Execute Wholesale Purchase from Wholesaler (Wholesaler -> Retailer)
  const handlePurchaseFromWholesaler = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWholesaleLot) return;

    // Strict Supply Chain Enforcement: Retailers CANNOT purchase from Farmers
    const lotSellerRole = (selectedWholesaleLot.sellerRole || '').toLowerCase();
    if (lotSellerRole !== 'wholesaler') {
      showToast(
        t(
          'Trading Restriction: Retailers can ONLY purchase from Wholesalers. Direct purchasing from Farmers is strictly blocked.',
          'বাণিজ্যিক বিধিনিষেধ: খুচরা বিক্রেতারা শুধুমাত্র পাইকারদের থেকেই ক্রয় করতে পারবেন। কৃষকদের থেকে সরাসরি ক্রয় সম্পূর্ণ নিষিদ্ধ।'
        ),
        'error'
      );
      return;
    }

    if (orderKg < (selectedWholesaleLot.minOrderKg || 50)) {
      showToast(
        t(
          `Minimum wholesale order is ${selectedWholesaleLot.minOrderKg || 50} kg.`,
          `নূন্যতম পাইকারি অর্ডার ${toBanglaNumber(selectedWholesaleLot.minOrderKg || 50)} কেজি।`
        ),
        'error'
      );
      return;
    }

    setSubmittingWholesaleOrder(true);
    try {
      const res = await orderApi.createOrder({
        buyerId: currentUser?.id,
        buyerName: currentUser?.shopName || currentUser?.name || 'Retailer',
        buyerPhone: currentUser?.phone || '',
        buyerEmail: currentUser?.email,
        buyerRole: 'retailer',
        sellerId: selectedWholesaleLot.sellerId,
        sellerName: selectedWholesaleLot.sellerName,
        sellerPhone: selectedWholesaleLot.sellerPhone,
        sellerRole: 'wholesaler',
        items: [
          {
            productId: selectedWholesaleLot.id,
            quantityKg: orderKg,
          },
        ],
        paymentMethod: 'Bank Transfer / Wholesale Credit',
        deliveryAddress: currentUser?.address || `${currentUser?.district || 'Bogura'} Retail Outlet`,
        district: currentUser?.district || 'Bogura',
        notes: `Procured wholesale stock by ${currentUser?.shopName || currentUser?.name}`,
      });

      if (res.success) {
        showToast(
          t(
            `Wholesale stock ordered from Wholesaler! Order #${res.order.id}. Stock reserved.`,
            `পাইকার থেকে স্টক ক্রয় সম্পন্ন হয়েছে! অর্ডার #${toBanglaNumber(res.order.id)}। স্টক সংরক্ষিত।`
          ),
          'success'
        );
        setSelectedWholesaleLot(null);
        loadWholesaleListings();
        loadMyRetailProducts();
      }
    } catch (err: any) {
      showToast(err.message || t('Wholesale order failed', 'পাইকারি অর্ডার ব্যর্থ হয়েছে'), 'error');
    } finally {
      setSubmittingWholesaleOrder(false);
    }
  };

  // Publish Retail Product for Consumers (Retailer -> Consumer)
  const handlePublishRetailProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishingProduct) return;
    setIsPublishingProduct(true);

    const enName = retailForm.cropName.trim() || getCropName({ banglaName: retailForm.banglaName }, 'en');
    const bnName = retailForm.banglaName.trim() || getCropName({ cropName: retailForm.cropName }, 'bn');

    const combinedOrigin = retailForm.farmerOriginBn.trim()
      ? `${retailForm.farmerOrigin.trim()} || ${retailForm.farmerOriginBn.trim()}`
      : retailForm.farmerOrigin.trim();

    const combinedArat = retailForm.wholesalerAratBn.trim()
      ? `${retailForm.wholesalerArat.trim()} || ${retailForm.wholesalerAratBn.trim()}`
      : retailForm.wholesalerArat.trim();

    const combinedDesc = retailForm.descriptionBn.trim()
      ? `${retailForm.description.trim()} || ${retailForm.descriptionBn.trim()}`
      : retailForm.description.trim();

    const combinedSafety = retailForm.safetyNoteBn.trim()
      ? `${retailForm.safetyNote.trim()} || ${retailForm.safetyNoteBn.trim()}`
      : retailForm.safetyNote.trim();

    try {
      await productApi.createProduct({
        sellerId: currentUser?.id,
        sellerName: currentUser?.shopName || currentUser?.name || 'Retailer',
        sellerPhone: currentUser?.phone || '',
        sellerRole: 'retailer',
        targetRole: 'consumer',
        cropName: enName,
        banglaName: bnName,
        category: retailForm.category,
        variety: retailForm.variety,
        quantityKg: retailForm.quantityKg,
        availableKg: retailForm.quantityKg,
        minOrderKg: 1,
        pricePerKg: retailForm.pricePerKg,
        marketPricePerKg: retailForm.marketPricePerKg,
        qualityGrade: retailForm.qualityGrade,
        district: currentUser?.district || 'Bogura',
        upazila: currentUser?.upazila || 'Bogura Sadar',
        locationDetails: retailForm.locationDetails,
        harvestStatus: 'Fresh Farm Stock',
        availableDate: 'Ready for Home Delivery',
        organicCertified: retailForm.organicCertified,
        imageUrl: retailForm.imageUrl,
        description: combinedDesc,
        traceability: {
          farmerOrigin: combinedOrigin,
          wholesalerArat: combinedArat,
          procurementDate: 'Freshly stocked today',
          safetyNote: combinedSafety,
        },
      });

      NotificationStore.addSystemNotif(
        currentUser.id,
        t('Retail Product Live on Social Feed!', 'খুচরা পণ্য সোশ্যাল ফিডে প্রকাশিত!'),
        t(
          `Published ${enName} at ৳${retailForm.pricePerKg}/kg. Consumers can now purchase via Guest Checkout.`,
          `${bnName} ৳${toBanglaNumber(retailForm.pricePerKg)}/কেজি দরে ফিডে উন্মুক্ত করা হয়েছে। ভোক্তারা সরাসরি অর্ডার করতে পারবেন।`
        ),
        'success'
      );

      showToast(t('Retail Product Live on Social Feed!', 'খুচরা পণ্য সোশ্যাল ফিডে প্রকাশিত!'), 'success');
      setShowAddRetailModal(false);
      loadMyRetailProducts();
    } catch (err: any) {
      showToast(err.message || t('Failed to publish retail product', 'পণ্য প্রকাশ করতে ব্যর্থ হয়েছে'), 'error');
    } finally {
      setIsPublishingProduct(false);
    }
  };

  // Delete Retail Product
  const handleDeleteProduct = (id: string) => {
    setConfirmDialog({
      title: t('Delete Product', 'পণ্য মুছে ফেলুন'),
      message: t(
        'Remove this product from the Consumer Marketplace?',
        'ভোক্তা মার্কেটপ্লেস থেকে এই পণ্যটি কি সরাতে চান?'
      ),
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await productApi.deleteProduct(id);
          showToast(t('Product removed successfully', 'পণ্য সফলভাবে সরানো হয়েছে'), 'success');
          loadMyRetailProducts();
        } catch (e: any) {
          showToast(e.message || t('Failed to delete product', 'পণ্য মোছা ব্যর্থ হয়েছে'), 'error');
        }
      },
    });
  };

  // Update Consumer Order Status
  const handleUpdateConsumerOrderStatus = async (
    orderId: string,
    status: 'Confirmed' | 'Processing' | 'Dispatched' | 'Delivered'
  ) => {
    try {
      await orderApi.updateStatus(orderId, status, currentUser?.name || 'Retailer', 'retailer');
      showToast(
        t(
          `Order ${orderId} status updated to ${status}.`,
          `অর্ডার ${language === 'bn' ? toBanglaNumber(orderId) : orderId} স্ট্যাটাস ${status} এ হালনাগাদ করা হয়েছে।`
        ),
        'success'
      );
      loadConsumerOrders();
    } catch (e: any) {
      showToast(e.message || t('Failed to update order status', 'অর্ডার স্ট্যাটাস আপডেট ব্যর্থ হয়েছে'), 'error');
    }
  };

  const totalRetailKg = myRetailProducts.reduce((s, p) => s + (p.availableKg || 0), 0);
  const totalSalesVolume = consumerOrders.reduce((s, o) => s + (o.totalBDT || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* Retailer Hero Header */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-stone-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-teal-700/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-teal-800/60 border border-teal-400/40 px-3 py-1 rounded-full text-xs font-semibold text-teal-200">
              <Store className="w-3.5 h-3.5 text-teal-300" />
              <span>{t('Retailer Trade Hub: Wholesaler → Retailer → Consumer', 'খুচরা বিক্রেতার বাণিজ্য: পাইকার → খুচরা বিক্রেতা → ভোক্তা')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentUser.shopName || currentUser.name}
            </h1>
            <p className="text-teal-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {t(
                'Direct B2B procurement from certified Wholesalers and local retail fulfillment to Consumers. Direct trading with Farmers is restricted by platform governance.',
                'অনুমোদিত পাইকারদের থেকে পাইকারি লট সংগ্রহ এবং সাধারণ ভোক্তাদের কাছে দ্রুত ভ্যান ডেলিভারিসহ তাজা কৃষিপণ্য সরবরাহ। কৃষকদের সাথে সরাসরি লেনদেন সম্পূর্ণ নিষিদ্ধ।'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setActiveTab('retailer_consumer_trade');
                setConsumerSubTab('store_products');
                setShowAddRetailModal(true);
              }}
              className="bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('Publish Retail Product', 'ভোক্তা ফিডে নতুন পণ্য যোগ')}</span>
            </button>
            <button
              onClick={() => setActiveTab('wholesaler_retailer_trade')}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs backdrop-blur-xs border border-white/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Layers className="w-4 h-4 text-emerald-300" />
              <span>{t('Wholesaler-Retailer Trade', 'পাইকার-খুচরা বিক্রেতার বাণিজ্য')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Retail Stock */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Retail Stock in Store', 'দোকানের মোট মজুদ')}</span>
            <Package className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-stone-900">
            {formatNum(totalRetailKg.toLocaleString())}{' '}
            <span className="text-xs font-normal text-stone-500">{t('kg', 'কেজি')}</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {formatNum(myRetailProducts.length)} {t('Active items on Consumer Feed', 'টি পণ্য ফিডে লাইভ')}
          </p>
        </div>

        {/* Card 2: Consumer Orders */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Consumer Orders', 'ভোক্তাদের অর্ডার')}</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-700">
            {formatNum(consumerOrders.length)}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {t('Guest & Registered shoppers', 'ভোক্তাদের কাছ থেকে প্রাপ্ত অর্ডার')}
          </p>
        </div>

        {/* Card 3: Retail Sales Revenue */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Retail Sales Revenue', 'মোট খুচরা বিক্রয়')}</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-blue-700">
            ৳{formatNum(totalSalesVolume.toLocaleString())}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {t('Delivered & confirmed', 'সম্পন্ন খুচরা বিক্রয়')}
          </p>
        </div>

        {/* Card 4: Wholesale Lots Available / পাইকারি লট সুযোগ */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Wholesale Lots Available', 'পাইকারি লট সুযোগ')}</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-700">
            {formatNum(wholesaleListings.length)}{' '}
            <span className="text-xs font-normal text-stone-500">{t('lots', 'টি লট')}</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {language === 'bn'
              ? `আঞ্চলিক পাইকারদের থেকে ${toBanglaNumber(wholesaleListings.length)}টি লট সুযোগ`
              : `${wholesaleListings.length} lots from regional wholesalers`}
          </p>
        </div>
      </div>

      {/* ─── PRIMARY TABS UNDER "খুচরা বিক্রেতার বাণিজ্য" ─────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto no-scrollbar">
        {/* Tab 1: Wholesaler-Retailer Trade */}
        <button
          onClick={() => setActiveTab('wholesaler_retailer_trade')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'wholesaler_retailer_trade'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{t('Wholesaler-Retailer Trade', 'পাইকার-খুচরা বিক্রেতার বাণিজ্য')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {formatNum(wholesaleListings.length)}
          </span>
        </button>

        {/* Tab 2: Retailer-Consumer Trade */}
        <button
          onClick={() => setActiveTab('retailer_consumer_trade')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'retailer_consumer_trade'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>{t('Retailer-Consumer Trade', 'খুচরা বিক্রেতা-ভোক্তার বাণিজ্য')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {formatNum(myRetailProducts.length + consumerOrders.length)}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: WHOLESALER-RETAILER TRADE (পাইকার-খুচরা বিক্রেতার বাণিজ্য) ───── */}
      {activeTab === 'wholesaler_retailer_trade' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={wholesaleSearch}
                onChange={(e) => setWholesaleSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadWholesaleListings()}
                placeholder={t('Search wholesale lots from Wholesalers...', 'পাইকারদের সংরক্ষিত পাইকারি লট খুঁজুন...')}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-hidden font-medium"
              />
            </div>
            <button
              onClick={loadWholesaleListings}
              className="bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-800 cursor-pointer w-full sm:w-auto"
            >
              {t('Filter Lots', 'লট খুঁজুন')}
            </button>
          </div>

          {wholesaleLoading && (
            <div className="text-center py-12">
              <RefreshCw className="w-6 h-6 mx-auto text-emerald-600 animate-spin" />
            </div>
          )}

          {!wholesaleLoading && wholesaleListings.length === 0 && (
            <div className="text-center py-12 bg-white rounded-3xl border border-stone-200 p-8 space-y-2">
              <Package className="w-10 h-10 mx-auto text-stone-300" />
              <p className="text-xs font-semibold text-stone-700">
                {t('No wholesale lots available right now', 'এই মুহূর্তে কোনো পাইকারি লট পাওয়া যায়নি')}
              </p>
              <p className="text-[11px] text-stone-400">
                {t('Wholesalers from regional hubs will list bulk harvests here.', 'আঞ্চলিক পাইকাররা ফসল তালিকাভুক্ত করলে তা এখানে প্রদর্শিত হবে।')}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wholesaleListings.map((lot) => (
              <div
                key={lot.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow"
              >
                <div className="relative aspect-16/10 bg-stone-100">
                  <img src={lot.imageUrl} alt={getCropName(lot, language)} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="bg-blue-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                      {t('Wholesale Arat Lot', 'পাইকারি আড়ত লট')}
                    </span>
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                      {t('Grade', 'গ্রেড')} {lot.qualityGrade || 'A'}
                    </span>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-white/95 px-2.5 py-1 rounded-xl shadow-md border border-stone-200 text-right backdrop-blur-xs">
                    <span className="text-base font-black text-stone-900">৳{formatNum(lot.pricePerKg)}</span>
                    <span className="text-[10px] text-stone-500">{t('/kg wholesale', '/কেজি পাইকারি')}</span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm">
                      {getCropName(lot, language)}
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {t('Wholesaler:', 'পাইকার:')} <strong className="text-stone-800">{lot.sellerName}</strong> • {getCategoryName(lot.category, language)} {lot.variety ? `• ${lot.variety}` : ''}
                    </p>

                    {lot.description && (
                      <p className="text-[11px] text-stone-600 line-clamp-2 mt-1.5 leading-relaxed">
                        {getCropDescription(lot.description, language)}
                      </p>
                    )}

                    <div className="mt-2.5 p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1.5 text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500">{t('Available:', 'মজুদ:')}</span>
                        <strong className="text-blue-700 font-bold">{formatNum(lot.availableKg)} {t('kg', 'কেজি')}</strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-stone-500">{t('Min Purchase:', 'নূন্যতম ক্রয়:')}</span>
                        <span className="text-stone-800 font-semibold">{formatNum(lot.minOrderKg || 50)} {t('kg', 'কেজি')}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (lot.sellerRole && lot.sellerRole !== 'wholesaler') {
                        showToast(
                          t(
                            'Direct purchases from Farmers are restricted. Retailers can ONLY purchase from Wholesalers.',
                            'কৃষকদের থেকে সরাসরি ক্রয় নিষিদ্ধ। খুচরা বিক্রেতা শুধুমাত্র পাইকারদের থেকেই ক্রয় করতে পারবেন।'
                          ),
                          'error'
                        );
                        return;
                      }
                      setSelectedWholesaleLot(lot);
                      setOrderKg(lot.minOrderKg || 50);
                    }}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{t('Purchase for Shop', 'দোকানের জন্য ক্রয়')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 2: RETAILER-CONSUMER TRADE (খুচরা বিক্রেতা-ভোক্তার বাণিজ্য) ───────── */}
      {activeTab === 'retailer_consumer_trade' && (
        <div className="space-y-4">
          {/* Sub-navigation switcher between Store Products and Consumer Orders */}
          <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-2xl border border-stone-200 shadow-2xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConsumerSubTab('store_products')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  consumerSubTab === 'store_products'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {t('My Store Products for Consumers', 'দোকানের লাইভ পণ্য')} ({formatNum(myRetailProducts.length)})
              </button>
              <button
                onClick={() => setConsumerSubTab('consumer_orders')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  consumerSubTab === 'consumer_orders'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {t('Incoming Consumer Orders', 'ভোক্তাদের অর্ডার ও ডেলিভারি')} ({formatNum(consumerOrders.length)})
              </button>
            </div>

            {consumerSubTab === 'store_products' && (
              <button
                onClick={() => setShowAddRetailModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm cursor-pointer ml-auto"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('Add Retail Product', 'নতুন খুচরা পণ্য যোগ')}</span>
              </button>
            )}
          </div>

          {/* Sub-view A: Store Products */}
          {consumerSubTab === 'store_products' && (
            <div className="space-y-4">
              {retailProductsLoading && (
                <div className="text-center py-12">
                  <RefreshCw className="w-6 h-6 mx-auto text-emerald-600 animate-spin" />
                </div>
              )}

              {!retailProductsLoading && myRetailProducts.length === 0 && (
                <div className="text-center py-14 bg-white rounded-3xl border border-dashed border-stone-300 p-8 space-y-3">
                  <Store className="w-12 h-12 mx-auto text-stone-300" />
                  <h4 className="font-bold text-stone-700 text-sm">
                    {t('No retail products listed yet', 'এখনও কোনো খুচরা পণ্য তালিকাভুক্ত করা হয়নি')}
                  </h4>
                  <p className="text-xs text-stone-500 max-w-md mx-auto">
                    {t(
                      'Click "Add Retail Product" to publish traceable produce from your inventory to the consumer social-feed marketplace.',
                      'ভোক্তা মার্কেটপ্লেসে প্রদর্শনের জন্য "নতুন খুচরা পণ্য যোগ" বাটনে ক্লিক করে পণ্য প্রকাশ করুন।'
                    )}
                  </p>
                  <button
                    onClick={() => setShowAddRetailModal(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>{t('Add Retail Product', 'নতুন খুচরা পণ্য যোগ')}</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myRetailProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs flex flex-col justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-16/10 bg-stone-100">
                      <img
                        src={prod.imageUrl}
                        alt={getCropName(prod, language)}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 flex gap-1">
                        <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                          {t('Retail Feed Active', 'খুচরা ফিডে সক্রিয়')}
                        </span>
                        {prod.organicCertified && (
                          <span className="bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-2xs">
                            {t('Bio-Organic', 'বায়ো-অর্গানিক')}
                          </span>
                        )}
                      </div>
                      <div className="absolute bottom-2 right-2 bg-white/95 px-3 py-1 rounded-xl shadow-md border border-stone-200 text-right backdrop-blur-xs">
                        <span className="text-base font-black text-stone-900">৳{formatNum(prod.pricePerKg)}</span>
                        <span className="text-[10px] text-stone-500">{t('/kg retail', '/কেজি খুচরা')}</span>
                      </div>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                      <div>
                        <h4 className="font-extrabold text-stone-900 text-sm">
                          {getCropName(prod, language)}
                        </h4>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          {getCategoryName(prod.category, language)} {prod.variety ? `• ${prod.variety} • ` : '• '}
                          {t('Grade', 'গ্রেড')} {prod.qualityGrade || 'A'}
                        </p>

                        {prod.description && (
                          <p className="text-[11px] text-stone-600 line-clamp-2 mt-1.5 leading-relaxed">
                            {getCropDescription(prod.description, language)}
                          </p>
                        )}

                        <div className="mt-2.5 text-stone-700 font-semibold flex items-center justify-between text-xs bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                          <span>{t('Available Consumer Stock:', 'ভোক্তা মজুদ প্রাপ্তব্য:')}</span>
                          <strong className="text-emerald-700 font-black text-sm">
                            {formatNum(prod.availableKg)} {t('kg', 'কেজি')}
                          </strong>
                        </div>

                        <div className="mt-2.5 text-[10px] text-stone-500 space-y-1 bg-stone-50/70 p-2 rounded-xl border border-stone-100/80">
                          <div>
                            🌱 <strong>{t('Origin:', 'উৎস:')}</strong> {translateMetadata(prod.traceability?.farmerOrigin || prod.district, language)}
                          </div>
                          <div>
                            🏢 <strong>{t('Arat:', 'আড়ত:')}</strong>{' '}
                            {translateMetadata(prod.traceability?.wholesalerArat || 'Verified Regional Wholesale Hub', language)}
                          </div>
                          {prod.traceability?.safetyNote && (
                            <div>
                              🛡️ <strong>{t('Safety:', 'নিরাপত্তা:')}</strong> {translateMetadata(prod.traceability.safetyNote, language)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                        <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('Verified Retailer Listing', 'যাচাইকৃত খুচরা বিক্রেতা তালিকা')}</span>
                        </span>
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="text-stone-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          title={t('Delete Product', 'পণ্য মুছুন')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-view B: Consumer Orders */}
          {consumerSubTab === 'consumer_orders' && (
            <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-100 gap-2">
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">
                    {t('Incoming Consumer Orders', 'ভোক্তাদের হোম ডেলিভারি অর্ডার')}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {t('Orders placed through Guest Checkout on the Consumer Marketplace feed.', 'সোশ্যাল ফিডে সাধারণ ভোক্তাদের সরাসরি দেওয়া ডেলিভারি অর্ডার।')}
                  </p>
                </div>
                <span className="badge-success text-xs font-bold px-3 py-1 rounded-full self-start sm:self-auto">
                  {t('Retailer → Consumer', 'খুচরা বিক্রেতা → ভোক্তা')}
                </span>
              </div>

              {ordersLoading && (
                <div className="text-center py-10">
                  <RefreshCw className="w-6 h-6 mx-auto text-emerald-600 animate-spin" />
                </div>
              )}

              {!ordersLoading && consumerOrders.length === 0 && (
                <div className="text-center py-12 text-stone-400 space-y-2">
                  <ShoppingBag className="w-10 h-10 mx-auto text-stone-300" />
                  <p className="text-xs font-semibold text-stone-600">
                    {t('No consumer orders placed yet', 'এখনও কোনো ভোক্তা অর্ডার আসেনি')}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    {t('When visitors checkout on the social feed, their orders appear here for packing and dispatch.', 'সোশ্যাল ফিডে গ্রাহকরা অর্ডার করলে তা প্যাকিং ও ডেলিভারির জন্য এখানে যুক্ত হবে।')}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {consumerOrders.map((order) => {
                  const currentStatus = order.status || order.deliveryStatus || 'Confirmed';
                  return (
                    <div
                      key={order.id}
                      className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-stone-900 text-sm">
                            #{language === 'bn' ? toBanglaNumber(order.id) : order.id}
                          </span>
                          <span
                            className={`badge text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              currentStatus === 'Delivered'
                                ? 'badge-success'
                                : currentStatus === 'Dispatched'
                                ? 'badge-purple'
                                : 'badge-warning'
                            }`}
                          >
                            {currentStatus === 'Delivered'
                              ? t('Delivered', 'সম্পন্ন')
                              : currentStatus === 'Dispatched'
                              ? t('Dispatched', 'ডেলিভারিতে প্রেরিত')
                              : t('Confirmed', 'নিশ্চিতকৃত')}
                          </span>
                        </div>
                        <div className="text-stone-700 font-semibold">
                          {t('Shopper:', 'ভোক্তা:')} <strong className="text-stone-900">{order.buyerName}</strong> • {t('Phone:', 'ফোন:')}{' '}
                          <strong className="text-stone-900">{formatNum(order.buyerPhone)}</strong>
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {t('Delivery Address:', 'ডেলিভারি ঠিকানা:')} <strong className="text-stone-800">{order.deliveryAddress}</strong> •{' '}
                          {t('Payment:', 'পেমেন্ট:')} <span className="font-bold text-emerald-700">{translatePaymentMethod(order.paymentMethod, language)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 justify-between md:justify-end">
                        <div className="text-right">
                          <span className="text-stone-500 text-[11px] block">{t('Payable Total', 'পরিশোধযোগ্য মোট')}</span>
                          <span className="font-black text-emerald-700 text-base">
                            ৳{formatNum(order.totalBDT.toLocaleString())}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {currentStatus === 'Confirmed' && (
                            <button
                              onClick={() => handleUpdateConsumerOrderStatus(order.id, 'Dispatched')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>{t('Dispatch Van', 'ভ্যানে মাল পাঠান')}</span>
                            </button>
                          )}
                          {currentStatus === 'Dispatched' && (
                            <button
                              onClick={() => handleUpdateConsumerOrderStatus(order.id, 'Delivered')}
                              className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer transition-colors"
                            >
                              {t('Confirm Delivered', 'ডেলিভারি সম্পন্ন নিশ্চিতকরণ')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: PURCHASE WHOLESALE LOT FROM WHOLESALER ────────────────────────── */}
      {selectedWholesaleLot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-extrabold text-stone-900 text-base">
                {t('Purchase Wholesale Batch', 'পাইকারি লট ক্রয়')}
              </h3>
              <button
                onClick={() => setSelectedWholesaleLot(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePurchaseFromWholesaler} className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <h4 className="font-extrabold text-stone-900 text-sm">
                  {getCropName(selectedWholesaleLot, language)}
                </h4>
                <p className="text-stone-500">
                  {t('Wholesaler:', 'পাইকার:')} <strong>{selectedWholesaleLot.sellerName}</strong>
                </p>
                <div className="flex justify-between font-bold text-stone-900 pt-1">
                  <span>{t('Wholesale Price:', 'পাইকারি দর:')}</span>
                  <span className="text-blue-700 text-sm">৳{formatNum(selectedWholesaleLot.pricePerKg)}/{t('kg', 'কেজি')}</span>
                </div>
                <div className="flex justify-between text-stone-500 text-[11px]">
                  <span>{t('Available in Lot:', 'লটে মজুদ আছে:')}</span>
                  <span className="font-semibold">{formatNum(selectedWholesaleLot.availableKg)} {t('kg', 'কেজি')}</span>
                </div>
              </div>

              {/* Supply Chain Governance Notice */}
              <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-[11px] text-teal-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                <span>
                  {t(
                    'Retailer Trading Rule: Purchasing authorized from certified Wholesalers only.',
                    'খুচরা বাণিজ্য বিধি: শুধুমাত্র নিবন্ধিত পাইকারদের থেকেই ক্রয় অনুমোদিত।'
                  )}
                </span>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Quantity (kg)', 'পরিমাণ (কেজি)')} • {t('Min:', 'নূন্যতম:')} {formatNum(selectedWholesaleLot.minOrderKg || 50)} {t('kg', 'কেজি')}
                </label>
                <input
                  type="number"
                  min={selectedWholesaleLot.minOrderKg || 50}
                  max={selectedWholesaleLot.availableKg}
                  value={orderKg}
                  onChange={(e) => setOrderKg(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-900"
                  required
                />
              </div>

              <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200 flex justify-between items-center font-bold text-teal-900">
                <span>{t('Total Amount:', 'মোট মূল্য:')}</span>
                <span className="text-lg font-black text-teal-800">
                  ৳{formatNum((orderKg * selectedWholesaleLot.pricePerKg).toLocaleString())}
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedWholesaleLot(null)}
                  className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  {t('Cancel', 'বাতিল')}
                </button>
                <button
                  type="submit"
                  disabled={submittingWholesaleOrder}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-stone-400 text-white font-extrabold px-6 py-2 rounded-xl shadow-md cursor-pointer transition-colors"
                >
                  {submittingWholesaleOrder ? t('Confirming Order...', 'অর্ডার প্রক্রিয়াধীন...') : t('Confirm Order', 'অর্ডার নিশ্চিত করুন')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: PUBLISH RETAIL PRODUCT FOR CONSUMERS ──────────────────────────── */}
      {showAddRetailModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-200 my-8 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-extrabold text-stone-900 text-base">
                {t('Publish Retail Product to Consumer Marketplace', 'ভোক্তাদের জন্য খুচরা পণ্য প্রকাশ')}
              </h3>
              <button
                onClick={() => setShowAddRetailModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishRetailProduct} className="space-y-3.5 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Product Title (English)', 'পণ্যের ইংরেজি নাম')} *
                  </label>
                  <input
                    type="text"
                    value={retailForm.cropName}
                    onChange={(e) => setRetailForm((f) => ({ ...f, cropName: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Bangla Title', 'পণ্যের বাংলা নাম')} *
                  </label>
                  <input
                    type="text"
                    value={retailForm.banglaName}
                    onChange={(e) => setRetailForm((f) => ({ ...f, banglaName: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Category', 'বিভাগ')}
                  </label>
                  <select
                    value={retailForm.category}
                    onChange={(e) => setRetailForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-semibold cursor-pointer"
                  >
                    <option value="Vegetables">{t('Vegetables', 'সবজি')}</option>
                    <option value="Tubers">{t('Tubers', 'আলু ও কন্দ')}</option>
                    <option value="Spices">{t('Spices', 'মশলা')}</option>
                    <option value="Grains">{t('Grains', 'খাদ্যশস্য')}</option>
                    <option value="Fruits">{t('Fruits', 'ফলমূল')}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Retail Stock (kg)', 'মজুদ পরিমাণ (কেজি)')} *
                  </label>
                  <input
                    type="number"
                    value={retailForm.quantityKg}
                    onChange={(e) =>
                      setRetailForm((f) => ({ ...f, quantityKg: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Consumer Retail Price (৳/kg) *', 'ভোক্তা খুচরা বিক্রয় মূল্য (৳/কেজি) *')}
                  </label>
                  <input
                    type="number"
                    value={retailForm.pricePerKg}
                    onChange={(e) =>
                      setRetailForm((f) => ({ ...f, pricePerKg: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-black text-emerald-700 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('DAM Benchmark (৳/kg)', 'সরকারি কৃষি বিপণন দর (৳/কেজি)')}
                  </label>
                  <input
                    type="number"
                    value={retailForm.marketPricePerKg}
                    onChange={(e) =>
                      setRetailForm((f) => ({ ...f, marketPricePerKg: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Variety', 'জাত')}
                  </label>
                  <input
                    type="text"
                    value={retailForm.variety}
                    onChange={(e) => setRetailForm((f) => ({ ...f, variety: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                    placeholder="e.g. Hybrid Shingro-3"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Quality Grade', 'মান বা গ্রেড')}
                  </label>
                  <select
                    value={retailForm.qualityGrade}
                    onChange={(e) => setRetailForm((f) => ({ ...f, qualityGrade: e.target.value as 'A' | 'B' | 'C' }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-semibold cursor-pointer"
                  >
                    <option value="A">{t('Grade A (Premium)', 'গ্রেড এ (উন্নত)')}</option>
                    <option value="B">{t('Grade B (Standard)', 'গ্রেড বি (সাধারণ)')}</option>
                    <option value="C">{t('Grade C (Commercial)', 'গ্রেড সি (বাণিজ্যিক)')}</option>
                  </select>
                </div>
              </div>

              {/* Bilingual Origin & Arat inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Farmer Origin (English)', 'কৃষক ও খামারের উৎস (ইংরেজি)')}
                  </label>
                  <input
                    type="text"
                    value={retailForm.farmerOrigin}
                    onChange={(e) => setRetailForm((f) => ({ ...f, farmerOrigin: e.target.value }))}
                    placeholder="e.g. Shibganj Farm, Bogura"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Farmer Origin (Bangla)', 'কৃষক ও খামারের উৎস (বাংলা)')}
                  </label>
                  <input
                    type="text"
                    value={retailForm.farmerOriginBn}
                    onChange={(e) => setRetailForm((f) => ({ ...f, farmerOriginBn: e.target.value }))}
                    placeholder="যেমন: শিবগঞ্জ কৃষক সমবায়, বগুড়া"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Wholesale Sourcing Arat (English)', 'পাইকারি আড়ত (ইংরেজি)')}
                  </label>
                  <input
                    type="text"
                    value={retailForm.wholesalerArat}
                    onChange={(e) => setRetailForm((f) => ({ ...f, wholesalerArat: e.target.value }))}
                    placeholder="e.g. Mahasthangarh Arat"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Wholesale Sourcing Arat (Bangla)', 'পাইকারি আড়ত (বাংলা)')}
                  </label>
                  <input
                    type="text"
                    value={retailForm.wholesalerAratBn}
                    onChange={(e) => setRetailForm((f) => ({ ...f, wholesalerAratBn: e.target.value }))}
                    placeholder="যেমন: মহাস্থানগড় পাইকারি আড়ত হাব"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Bilingual Description inputs */}
              <div className="space-y-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Product Description (English)', 'পণ্যের বিবরণ (ইংরেজি)')}
                  </label>
                  <textarea
                    rows={2}
                    value={retailForm.description}
                    onChange={(e) => setRetailForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Product Description (Bangla)', 'পণ্যের বিবরণ (বাংলা)')}
                  </label>
                  <textarea
                    rows={2}
                    value={retailForm.descriptionBn}
                    onChange={(e) => setRetailForm((f) => ({ ...f, descriptionBn: e.target.value }))}
                    placeholder="বাংলা বিবরণ লিখুন (ঐচ্ছিক, না দিলে স্বয়ংক্রিয় অনূদিত হবে)"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Safety note */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Safety Note / Formalin-Free Assurance', 'নিরাপত্তা নিশ্চয়তা / ফরমালিনমুক্ত বিবরণ')}
                </label>
                <input
                  type="text"
                  value={language === 'bn' ? retailForm.safetyNoteBn : retailForm.safetyNote}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (language === 'bn') {
                      setRetailForm((f) => ({ ...f, safetyNoteBn: val }));
                    } else {
                      setRetailForm((f) => ({ ...f, safetyNote: val }));
                    }
                  }}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-700 pt-1">
                <input
                  type="checkbox"
                  checked={retailForm.organicCertified}
                  onChange={(e) =>
                    setRetailForm((f) => ({ ...f, organicCertified: e.target.checked }))
                  }
                  className="w-4 h-4 text-emerald-600 rounded-sm cursor-pointer"
                />
                <span>{t('Certified Bio-Organic / Formalin-Free', 'ফরমালিনমুক্ত ও প্রত্যয়িত বায়ো-অর্গানিক')}</span>
              </label>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddRetailModal(false)}
                  className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  {t('Cancel', 'বাতিল')}
                </button>
                <button
                  type="submit"
                  disabled={isPublishingProduct}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold px-6 py-2 rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-colors"
                >
                  {isPublishingProduct ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t('Publishing...', 'প্রকাশিত হচ্ছে...')}</span>
                    </>
                  ) : (
                    <span>{t('Publish to Social Feed', 'সোশ্যাল ফিডে প্রকাশ করুন')}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold transition-all transform animate-in slide-in-from-bottom-5 duration-300 ${
          toastMessage.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100 shadow-emerald-950/30'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-100 shadow-rose-950/30'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="max-w-md">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-100 animate-in zoom-in-95 duration-200">
            <h4 className="text-lg font-bold text-stone-900 mb-2">{confirmDialog.title}</h4>
            <p className="text-sm text-stone-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-stone-600 font-bold hover:bg-stone-100 rounded-xl transition-colors text-sm cursor-pointer"
              >
                {t('Cancel', 'বাতিল')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const onConfirm = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  onConfirm();
                }}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors text-sm cursor-pointer"
              >
                {t('Confirm', 'নিশ্চিত করুন')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
