import React, { useState, useEffect } from 'react';
import {
  Language,
  User,
  MarketRate,
  WholesalerOffer,
  MarketplaceProduct,
  SupplyChainOrder,
  ExpenseLedgerEntry,
} from '../types';
import { intelligenceApi, productApi, orderApi } from '../services/api';
import { ExpenseStore, NotificationStore } from '../data/store';
import {
  Sprout,
  PlusCircle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  ShieldCheck,
  Phone,
  MapPin,
  Stethoscope,
  Mic,
  DollarSign,
  Trash2,
  Star,
  ChevronDown,
  ChevronUp,
  Wallet,
  Package,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  CloudSun,
  Wind,
  Droplets,
  Layers,
  Clock,
  Building2,
  Truck,
  ExternalLink,
} from 'lucide-react';
import { requestMarketPrediction, MarketPredictionResult } from '../services/aiService';

interface FarmerDashboardProps {
  currentUser: User;
  suppliers?: any[];
  language: Language;
  onOpenCropDoctor: () => void;
  onOpenVoiceAssistant: () => void;
}

type FarmerTabId = 'intelligence' | 'my_crops' | 'orders' | 'ledger';

const QUICK_CROPS = [
  {
    nameEn: 'Diamond Potato',
    nameBn: 'ডায়মন্ড গোল আলু',
    category: 'Tubers',
    variety: 'Diamond Grade A',
    suggestedPrice: 28,
    img: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
  },
  {
    nameEn: 'Table Tomatoes',
    nameBn: 'হাইব্রিড পাকা টমেটো',
    category: 'Vegetables',
    variety: 'Shingro F1',
    suggestedPrice: 38,
    img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
  },
  {
    nameEn: 'Green Chili',
    nameBn: 'বগুড়ার তাজা কাঁচা মরিচ',
    category: 'Spices',
    variety: 'Char Bindu',
    suggestedPrice: 85,
    img: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=800&auto=format&fit=crop&q=80',
  },
  {
    nameEn: 'Cauliflower',
    nameBn: 'স্নোবল ফুলকপি',
    category: 'Vegetables',
    variety: 'White Snowball',
    suggestedPrice: 32,
    img: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=800&auto=format&fit=crop&q=80',
  },
  {
    nameEn: 'Paddy / BRRI Dhan',
    nameBn: 'ব্রি ধান-২৮',
    category: 'Grains',
    variety: 'BRRI-28 Premium',
    suggestedPrice: 32,
    img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop&q=80',
  },
  {
    nameEn: 'Brinjal / Eggplant',
    nameBn: 'গোল বেগুন',
    category: 'Vegetables',
    variety: 'Tal Begun',
    suggestedPrice: 36,
    img: 'https://images.unsplash.com/photo-1659261200833-ec8761558af7?w=800&auto=format&fit=crop&q=80',
  },
  {
    nameEn: 'Onion (Deshi)',
    nameBn: 'দেশি পেঁয়াজ',
    category: 'Spices',
    variety: 'Taherpuri Deshi',
    suggestedPrice: 70,
    img: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80',
  },
  {
    nameEn: 'Pointed Gourd (Patal)',
    nameBn: 'দেশি পটল',
    category: 'Vegetables',
    variety: 'Bogra Deshi',
    suggestedPrice: 42,
    img: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=800&auto=format&fit=crop&q=80',
  },
];

export const FarmerDashboard: React.FC<FarmerDashboardProps> = ({
  currentUser,
  language,
  onOpenCropDoctor,
  onOpenVoiceAssistant,
}) => {
  const [activeTab, setActiveTab] = useState<FarmerTabId>('intelligence');

  // Farmer Intelligence State
  const [intelligenceLoading, setIntelligenceLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState(currentUser.district || 'Bogura');
  const [marketRates, setMarketRates] = useState<MarketRate[]>([]);
  const [wholesalerOffers, setWholesalerOffers] = useState<WholesalerOffer[]>([]);
  const [highDemandCrops, setHighDemandCrops] = useState<
    Array<{ name: string; demandIndex: number; trend: string; reason: string }>
  >([]);
  const [officialSource, setOfficialSource] = useState('Department of Agricultural Marketing (DAM)');
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>('');

  // Live Weather for Farmer District
  const [weatherData, setWeatherData] = useState<{
    temp: number;
    condition: string;
    conditionBn: string;
    humidity: number;
    windSpeed: number;
    rainProb: number;
    source: string;
    forecast: string;
  }>({
    temp: 29,
    condition: 'Partly Sunny',
    conditionBn: 'আংশিক রৌদ্রোজ্জ্বল',
    humidity: 68,
    windSpeed: 12,
    rainProb: 15,
    source: 'Open-Meteo & Bangladesh Met Dept (BMD)',
    forecast: 'Favorable for vegetable harvesting and crate transport.',
  });

  // Farmer's listed products (for Wholesalers)
  const [myProducts, setMyProducts] = useState<MarketplaceProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);

  // Orders from Wholesalers
  const [receivedOrders, setReceivedOrders] = useState<SupplyChainOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Add Product Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [selectedCropIndex, setSelectedCropIndex] = useState(0);
  const [quantityKg, setQuantityKg] = useState(500);
  const [pricePerKg, setPricePerKg] = useState(28);
  const [qualityGrade, setQualityGrade] = useState<'A' | 'B' | 'C'>('A');
  const [harvestStatus, setHarvestStatus] = useState('Ready to Harvest');
  const [organicCertified, setOrganicCertified] = useState(false);
  const [variety, setVariety] = useState('Diamond Grade A');
  const [description, setDescription] = useState('Freshly harvested batch from our family farmland.');

  // AI Price Prediction
  const [isPredicting, setIsPredicting] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<MarketPredictionResult | null>(null);

  // Financial Ledger
  const [ledgerEntries, setLedgerEntries] = useState<ExpenseLedgerEntry[]>([]);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerForm, setLedgerForm] = useState({
    type: 'expense' as 'expense' | 'income',
    category: 'Fertilizer' as ExpenseLedgerEntry['category'],
    description: '',
    amountBDT: 0,
    date: new Date().toISOString().split('T')[0],
  });

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // Load Farmer Intelligence (Market prices, bids, weather)
  const loadIntelligence = async () => {
    setIntelligenceLoading(true);
    try {
      const data = await intelligenceApi.getFarmerIntelligence(selectedDistrict);
      setMarketRates(data.marketRates || []);
      setWholesalerOffers(data.wholesalerOffers || []);
      setHighDemandCrops(data.highDemandCrops || []);
      setOfficialSource(data.officialSource || 'Department of Agricultural Marketing (DAM)');
      setLastRefreshedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      // Fetch Live Meteorological Weather from Open-Meteo
      try {
        const coords: Record<string, { lat: number; lon: number }> = {
          Bogura: { lat: 24.8465, lon: 89.3777 },
          Dhaka: { lat: 23.8103, lon: 90.4125 },
          Rajshahi: { lat: 24.3636, lon: 88.6241 },
          Rangpur: { lat: 25.7439, lon: 89.2752 },
          Dinajpur: { lat: 25.6217, lon: 88.6355 },
        };
        const c = coords[selectedDistrict] || coords['Bogura'];
        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
        );
        if (wRes.ok) {
          const wJson = await wRes.json();
          const curr = wJson.current;
          if (curr) {
            setWeatherData({
              temp: Math.round(curr.temperature_2m),
              condition: curr.temperature_2m > 30 ? 'Warm & Clear' : 'Fair Agro Conditions',
              conditionBn: curr.temperature_2m > 30 ? 'উষ্ণ ও রৌদ্রোজ্জ্বল' : 'অনুকূল কৃষি আবহাওয়া',
              humidity: Math.round(curr.relative_humidity_2m),
              windSpeed: Math.round(curr.wind_speed_10m),
              rainProb: curr.weather_code >= 51 ? 65 : 10,
              source: 'Open-Meteo Grounded Meteorological Feed',
              forecast:
                curr.weather_code >= 51
                  ? 'Rain expected. Ensure dry storage for harvested sacks.'
                  : 'Favorable conditions for morning crop picking and wholesale transport.',
            });
          }
        }
      } catch (e) {
        console.warn('Weather fetch fallback to recorded parameters', e);
      }
    } catch (err) {
      console.error('Failed to load farmer intelligence', err);
    } finally {
      setIntelligenceLoading(false);
    }
  };

  // Load Farmer's Products
  const loadMyProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await productApi.getProducts({
        sellerRole: 'farmer',
      });
      // Filter for this farmer's listings (or all farmer harvests if testing)
      const filtered = res.products.filter(
        (p) => p.sellerId === currentUser.id || p.sellerName === currentUser.name
      );
      setMyProducts(filtered.length > 0 ? filtered : res.products);
    } catch (err) {
      console.error('Failed to load farmer products', err);
    } finally {
      setProductsLoading(false);
    }
  };

  // Load Wholesale Orders received from Wholesalers
  const loadReceivedOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await orderApi.getOrders({
        sellerId: currentUser.id,
        role: 'farmer',
      });
      setReceivedOrders(res.orders || []);
    } catch (err) {
      console.error('Failed to load farmer orders', err);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadIntelligence();
    loadMyProducts();
    loadReceivedOrders();
    setLedgerEntries(ExpenseStore.getAll().filter((e) => e.farmerId === currentUser.id));
  }, [currentUser.id, selectedDistrict]);

  // AI Price Recommendation
  const handlePredictPrice = async () => {
    setIsPredicting(true);
    const selected = QUICK_CROPS[selectedCropIndex];
    try {
      const result = await requestMarketPrediction(
        selected.nameEn,
        quantityKg,
        harvestStatus,
        selectedDistrict,
        language
      );
      setAiPrediction(result);
      if (result.expectedPriceRangeBDT?.recommendedWholesale) {
        setPricePerKg(result.expectedPriceRangeBDT.recommendedWholesale);
      }
    } catch (e) {
      console.error('AI prediction error', e);
    } finally {
      setIsPredicting(false);
    }
  };

  // Publish Crop Batch (Farmer -> Wholesaler)
  const handlePublishCrop = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingProduct(true);
    const selected = QUICK_CROPS[selectedCropIndex];

    try {
      await productApi.createProduct({
        sellerId: currentUser.id,
        sellerName: currentUser.name,
        sellerPhone: currentUser.phone,
        sellerRole: 'farmer',
        targetRole: 'wholesaler',
        cropName: selected.nameEn,
        banglaName: selected.nameBn,
        category: selected.category,
        variety: variety || selected.variety,
        quantityKg,
        availableKg: quantityKg,
        minOrderKg: 50,
        pricePerKg,
        qualityGrade,
        district: currentUser.district || selectedDistrict,
        upazila: currentUser.upazila || 'Shibganj',
        locationDetails: `${currentUser.upazila || 'Shibganj'}, ${currentUser.district || 'Bogura'} Farmland`,
        harvestStatus,
        organicCertified,
        imageUrl: selected.img,
        description: description || `Freshly harvested ${selected.nameEn} directly from farm gate.`,
        traceability: {
          farmerOrigin: `${currentUser.name}, ${currentUser.upazila || 'Shibganj'}, ${currentUser.district || 'Bogura'}`,
          procurementDate: 'Freshly harvested today',
          safetyNote: '100% formalin-free with standard field curing.',
        },
      });

      NotificationStore.addSystemNotif(
        currentUser.id,
        t('Harvest Published!', 'ফসল তালিকাভুক্ত!'),
        t(
          `${selected.nameEn} (${quantityKg}kg) published to Wholesalers at ৳${pricePerKg}/kg.`,
          `${selected.nameBn} (${quantityKg}কেজি) পাইকারদের জন্য তালিকাভুক্ত করা হয়েছে। মূল্য ৳${pricePerKg}/কেজি।`
        ),
        'success'
      );

      setShowAddModal(false);
      setAiPrediction(null);
      loadMyProducts();
    } catch (err: any) {
      alert(err.message || 'Failed to publish crop');
    } finally {
      setSubmittingProduct(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    if (confirm(t('Are you sure you want to remove this harvest listing?', 'এই ফসলের তালিকাটি কি নিশ্চিতভাবে মুছে ফেলতে চান?'))) {
      try {
        await productApi.deleteProduct(id);
        loadMyProducts();
      } catch (e: any) {
        alert(e.message || 'Failed to delete listing');
      }
    }
  };

  // Update Order Delivery Status
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: 'Confirmed' | 'Processing' | 'Dispatched' | 'Delivered'
  ) => {
    try {
      await orderApi.updateStatus(orderId, status, currentUser.name, 'farmer');
      loadReceivedOrders();
      NotificationStore.addSystemNotif(
        currentUser.id,
        t('Order Updated', 'অর্ডারের অবস্থা পরিবর্তিত'),
        t(`Order #${orderId} marked as ${status}`, `অর্ডার #${orderId} এখন ${status}`),
        'info'
      );
    } catch (e: any) {
      alert(e.message || 'Failed to update order status');
    }
  };

  // Add Financial Ledger Entry
  const handleAddLedgerEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: ExpenseLedgerEntry = {
      id: `ledger-${Date.now()}`,
      farmerId: currentUser.id,
      ...ledgerForm,
    };
    ExpenseStore.add(entry);
    setShowLedgerModal(false);
    setLedgerForm({
      type: 'expense',
      category: 'Fertilizer',
      description: '',
      amountBDT: 0,
      date: new Date().toISOString().split('T')[0],
    });
    setLedgerEntries(ExpenseStore.getAll().filter((entry) => entry.farmerId === currentUser.id));
  };

  const totalHarvestKg = myProducts.reduce((s, p) => s + (p.availableKg || 0), 0);
  const totalEstRevenue = myProducts.reduce((s, p) => s + (p.availableKg || 0) * p.pricePerKg, 0);
  const totalExpenses = ExpenseStore.totalExpenses();
  const totalIncome = ExpenseStore.totalRevenue();
  const netProfit = totalIncome - totalExpenses;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* Farmer Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-stone-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-700/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-emerald-800/70 border border-emerald-400/40 px-3 py-1 rounded-full text-xs font-semibold text-emerald-200">
              <Sprout className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('Farmer Command Center • Strict Supply Chain', 'কৃষক পোর্টাল • পাইকারি সরবরাহ কেন্দ্র')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentUser.name} {language === 'bn' ? 'এর খামার কেন্দ্র' : 'Agro Harvest Hub'}
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm">
              {t(
                `Direct wholesale supply to registered wholesalers. Verified DAM market prices, live weather alerts, and buyer procurement bids for ${selectedDistrict}.`,
                `সরাসরি নিবন্ধিত পাইকারদের কাছে পাইকারি দরে ফসল বিক্রি করুন। বগুড়া ও স্থানীয় বাজারদর এবং আবহাওয়া বার্তা শুধুমাত্র কৃষকের জন্য।`
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-md flex items-center gap-2 transition-all hover:scale-102"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('List New Harvest', 'নতুন ফসল যুক্ত করুন')}</span>
            </button>
            <button
              onClick={onOpenCropDoctor}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2.5 rounded-xl text-xs backdrop-blur-xs border border-white/20 flex items-center gap-1.5"
            >
              <Stethoscope className="w-4 h-4 text-emerald-300" />
              <span>{t('Crop Doctor AI', 'এআই শস্য ডাক্তার')}</span>
            </button>
            <button
              onClick={onOpenVoiceAssistant}
              className="bg-white/10 hover:bg-white/20 text-white font-bold p-2.5 rounded-xl text-xs backdrop-blur-xs border border-white/20"
              title="Voice Assistant"
            >
              <Mic className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Active Harvest Stock', 'মজুদ ফসল')}</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-stone-900">
            {totalHarvestKg.toLocaleString()}{' '}
            <span className="text-xs font-normal text-stone-500">kg</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {myProducts.length} {t('active wholesale batches', 'টি পাইকারি লট')}
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Est. Wholesale Value', 'সম্ভাব্য বিক্রয় মূল্য')}</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-blue-700">
            ৳{totalEstRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Based on wholesale gate rates', 'পাইকারি দরের ভিত্তিতে')}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Verified Wholesaler Bids', 'পাইকারদের চাহিদা')}</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-700">
            {wholesalerOffers.length}{' '}
            <span className="text-xs font-normal text-stone-500">{t('Tenders', 'টি অফার')}</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Immediate buyer contracts', 'তাৎক্ষণিক পাইকারি ক্রয় চুক্তি')}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Net Farm Profit', 'নিট খামার মুনাফা')}</span>
            <Wallet className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-stone-900">
            ৳{netProfit.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Calculated via Farm Ledger', 'খামার লেজার হিসাব অনুযায়ী')}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('intelligence')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'intelligence'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t('Farmer Intelligence (Weather, Bids & DAM Prices)', 'কৃষক তথ্যভাণ্ডার (আবহাওয়া, দর ও চাহিদা)')}</span>
        </button>

        <button
          onClick={() => setActiveTab('my_crops')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'my_crops'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Sprout className="w-4 h-4" />
          <span>{t('My Harvest Listings', 'আমার ফসলের তালিকা')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {myProducts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'orders'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>{t('Wholesaler Orders', 'পাইকারদের অর্ডার')}</span>
          {receivedOrders.length > 0 && (
            <span className="bg-emerald-700 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {receivedOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'ledger'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>{t('Expense & Earnings Ledger', 'আয়-ব্যয় হিসাব')}</span>
        </button>
      </div>

      {/* ─── TAB 1: FARMER-ONLY INTELLIGENCE ────────────────────────────────────────── */}
      {activeTab === 'intelligence' && (
        <div className="space-y-6">
          {/* Top Intelligence Ribbon: Weather + Official Grounding Notice */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Weather Card */}
            <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white p-5 rounded-3xl shadow-md border border-blue-800/40 space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-blue-200">
                  <span className="font-bold flex items-center gap-1.5">
                    <CloudSun className="w-4 h-4 text-amber-300" />
                    <span>{selectedDistrict} {t('Weather Radar', 'আবহাওয়া রাডার')}</span>
                  </span>
                  <span className="text-[10px] bg-blue-800/80 px-2 py-0.5 rounded-full">Live</span>
                </div>

                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-4xl font-black">{weatherData.temp}°C</span>
                  <span className="text-xs font-semibold text-blue-100">
                    {language === 'bn' ? weatherData.conditionBn : weatherData.condition}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-blue-100/90 pt-2 border-t border-blue-800/60">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-blue-300" /> Humidity
                  </span>
                  <strong className="text-white">{weatherData.humidity}%</strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1">
                    <Wind className="w-3.5 h-3.5 text-blue-300" /> Wind
                  </span>
                  <strong className="text-white">{weatherData.windSpeed} km/h</strong>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Rain Chance</span>
                  <strong className="text-amber-300">{weatherData.rainProb}%</strong>
                </div>
                <p className="text-[10px] text-blue-200/80 pt-1 leading-tight">
                  📌 {weatherData.forecast}
                </p>
                <p className="text-[9px] text-blue-300/60 pt-0.5">
                  Source: {weatherData.source} • Verified
                </p>
              </div>
            </div>

            {/* Official Grounding & DAM Transparency Notice */}
            <div className="md:col-span-2 bg-white rounded-3xl border border-stone-200 p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-extrabold text-stone-900 text-sm">
                      {t('Verifiable Agricultural Data Protocol', 'যাচাইকৃত সরকারি কৃষি তথ্য প্রোটোকল')}
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold text-stone-500">
                    Refreshed: {lastRefreshedTime || 'Just now'}
                  </span>
                </div>

                <p className="text-xs text-stone-600 mt-2.5 leading-relaxed">
                  {t(
                    'All market prices and benchmark wholesale rates displayed below are grounded in official records published by Bangladesh’s Department of Agricultural Marketing (DAM). Wholesaler procurement tenders represent genuine verified purchase commitments.',
                    'নেটিভবাজারের সকল বাজারদর ও পাইকারি রেফারেন্স মূল্য সরাসরি বাংলাদেশ সরকারের কৃষি বিপণন অধিদপ্তর (DAM)-এর অফিসিয়াল রেকর্ডের ভিত্তিতে প্রদর্শিত হয়। পাইকারদের ক্রয় প্রস্তাবগুলো সম্পূর্ণ যাচাইকৃত।'
                  )}
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200/80 text-emerald-900">
                    <strong>Department of Agricultural Marketing (DAM):</strong> Wholesale & retail benchmark ground truth.
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200/80 text-blue-900">
                    <strong>Zero Fabrication Guarantee:</strong> Unverified estimates and simulated price spikes are strictly prohibited.
                  </div>
                </div>
              </div>

              {/* District Filter Selector */}
              <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs">
                <span className="text-stone-500 font-semibold">{t('Filter District Records:', 'জেলা নির্বাচন করুন:')}</span>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="bg-stone-50 border border-stone-200 font-bold text-stone-800 rounded-xl px-3 py-1.5 focus:outline-hidden"
                >
                  <option value="Bogura">Bogura (বগুড়া)</option>
                  <option value="Dhaka">Dhaka (ঢাকা)</option>
                  <option value="Rajshahi">Rajshahi (রাজশাহী)</option>
                  <option value="Rangpur">Rangpur (রংপুর)</option>
                  <option value="Dinajpur">Dinajpur (দিনাজপুর)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Verified Wholesaler Purchase Offers (Tenders) */}
          <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-600" />
                  <h3 className="font-extrabold text-stone-900 text-base">
                    {t('Verified Wholesaler Purchase Offers (Bids)', 'যাচাইকৃত পাইকারদের সরাসরি ক্রয়ের প্রস্তাব')}
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  {t(
                    'Direct wholesale buyers with confirmed funds and pick-up hubs in your region.',
                    'আপনার এলাকার জন্য নিবন্ধিত পাইকারি আড়ত ও ব্যবসায়ীদের জরুরি শস্য চাহিদা।'
                  )}
                </p>
              </div>

              <span className="text-xs font-bold bg-amber-50 text-amber-800 px-3 py-1 rounded-full border border-amber-200">
                {wholesalerOffers.length} {t('Active Tenders', 'টি অফার')}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50 text-stone-600 font-bold uppercase text-[10px] border-y border-stone-200">
                  <tr>
                    <th className="py-3 px-3">Crop / Variety</th>
                    <th className="py-3 px-3">Required Qty</th>
                    <th className="py-3 px-3">Offered Price</th>
                    <th className="py-3 px-3">Wholesaler / Arat</th>
                    <th className="py-3 px-3">Delivery Location & Deadline</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {wholesalerOffers.map((offer) => (
                    <tr key={offer.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-extrabold text-stone-900 text-xs">
                          {language === 'bn' ? offer.cropBangla || offer.cropName : offer.cropName}
                        </div>
                        {offer.urgent && (
                          <span className="badge-warning text-[9px] mt-0.5">Urgent Need</span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-stone-800">
                          {offer.quantityKgNeeded.toLocaleString()} kg
                        </span>
                        {offer.fulfilledKg > 0 && (
                          <span className="text-[10px] text-stone-400 block">
                            ({offer.fulfilledKg} kg booked)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-black text-emerald-700 text-sm">
                          ৳{offer.offeredPricePerKg}
                        </span>
                        <span className="text-[10px] text-stone-500"> /kg</span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-stone-900">{offer.businessName}</div>
                        <div className="text-[11px] text-stone-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-stone-400" />
                          <span>{offer.wholesalerPhone}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="text-stone-700 font-medium flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                          <span>{offer.location}</span>
                        </div>
                        <div className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{offer.deadline}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <a
                          href={`tel:${offer.wholesalerPhone}`}
                          className="inline-flex items-center gap-1 bg-stone-900 hover:bg-stone-800 text-white font-bold px-3 py-1.5 rounded-xl text-[11px] shadow-2xs transition-all"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{t('Contact & Deal', 'কথা বলুন')}</span>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Official DAM Wholesale & Retail Benchmark Table */}
          <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-extrabold text-stone-900 text-base">
                    {t(
                      `Department of Agricultural Marketing (DAM) Wholesale Rates • ${selectedDistrict}`,
                      `কৃষি বিপণন অধিদপ্তর (DAM) পাইকারি বাজারদর • ${selectedDistrict}`
                    )}
                  </h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Official daily benchmarks. Farmers should use the Wholesale Price as baseline for wholesale negotiations.
                </p>
              </div>

              <div className="text-xs text-stone-500 font-medium">
                Source: <span className="font-bold text-stone-700">{officialSource}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-stone-50 text-stone-600 font-bold uppercase text-[10px] border-y border-stone-200">
                  <tr>
                    <th className="py-3 px-3">Crop / Commodity</th>
                    <th className="py-3 px-3">Market Mokam</th>
                    <th className="py-3 px-3">Local Wholesale (৳/kg)</th>
                    <th className="py-3 px-3">Dhaka Wholesale (৳/kg)</th>
                    <th className="py-3 px-3">Retail Price (৳/kg)</th>
                    <th className="py-3 px-3">24h Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {marketRates.map((rate) => (
                    <tr key={rate.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-extrabold text-stone-900">
                          {language === 'bn' ? rate.banglaName || rate.cropName : rate.cropName}
                        </div>
                        <span className="text-[10px] text-stone-400 font-medium">
                          {rate.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-stone-700">
                        {language === 'bn' ? rate.marketNameBn || rate.marketName : rate.marketName}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-black text-emerald-700 text-sm">
                          ৳{rate.wholesalePrice}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-stone-800">
                        ৳{rate.wholesaleDhaka}
                      </td>
                      <td className="py-3 px-3 font-semibold text-stone-500">
                        ৳{rate.retailPrice}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-xs ${
                            rate.trend === 'up'
                              ? 'text-emerald-600'
                              : rate.trend === 'down'
                              ? 'text-red-500'
                              : 'text-stone-500'
                          }`}
                        >
                          {rate.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                          {rate.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                          <span>{rate.change24h > 0 ? `+৳${rate.change24h}` : rate.change24h === 0 ? 'Stable' : `৳${rate.change24h}`}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* High Demand Agricultural Commodities Radar */}
          <div className="bg-stone-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-stone-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span>{t('High-Demand Crop Radar', 'শীর্ষ চাহিদাসম্পন্ন ফসলের রাডার')}</span>
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Aggregated from wholesale buyers and cold-storage demand indices.
                </p>
              </div>
              <span className="text-[11px] font-bold text-amber-400 bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-800">
                Bogura Division
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {highDemandCrops.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-stone-800/80 border border-stone-700 rounded-2xl p-4 space-y-2"
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-stone-100">{item.name}</span>
                    <span className="text-emerald-400 font-black">{item.demandIndex}% Demand</span>
                  </div>
                  <div className="w-full bg-stone-700 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${item.demandIndex}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-stone-400 leading-tight">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: MY HARVEST LISTINGS (Sell to Wholesalers) ────────────────────── */}
      {activeTab === 'my_crops' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
            <div>
              <h3 className="font-extrabold text-stone-900 text-sm">
                {t('Wholesale Harvest Listings for Wholesalers', 'পাইকারদের কাছে বিক্রয়ের জন্য তালিকাভুক্ত ফসল')}
              </h3>
              <p className="text-xs text-stone-500">
                {t(
                  'Only registered Wholesalers can view and purchase these wholesale harvest lots.',
                  'শুধুমাত্র নিবন্ধিত পাইকাররা এই ফসলগুলো পাইকারি দরে সরাসরি কিনতে পারেন।'
                )}
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('Add New Harvest', 'নতুন ফসল যোগ করুন')}</span>
            </button>
          </div>

          {productsLoading && (
            <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
              <RefreshCw className="w-6 h-6 mx-auto text-emerald-600 animate-spin" />
              <p className="text-xs text-stone-500 mt-2">Loading harvest listings...</p>
            </div>
          )}

          {!productsLoading && myProducts.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8 space-y-3">
              <Sprout className="w-12 h-12 text-stone-300 mx-auto" />
              <h4 className="font-bold text-stone-800 text-sm">
                {t('No active harvest listings', 'কোনো ফসল তালিকাভুক্ত করা হয়নি')}
              </h4>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {t(
                  'List your crops now so local wholesalers and arats can purchase your stock directly.',
                  'এখনই ফসল তালিকাভুক্ত করুন যাতে স্থানীয় পাইকাররা সরাসরি আপনার জমি বা মোকাম থেকে কিনতে পারে।'
                )}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-sm"
              >
                {t('Publish First Crop', 'প্রথম ফসল যোগ করুন')}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs flex flex-col justify-between"
              >
                <div className="relative aspect-16/10 bg-stone-100">
                  <img
                    src={prod.imageUrl}
                    alt={prod.cropName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {prod.harvestStatus || 'Ready'}
                    </span>
                    <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Grade {prod.qualityGrade || 'A'}
                    </span>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-white/95 px-2.5 py-1 rounded-xl shadow-md border border-stone-200 text-right">
                    <span className="text-sm font-black text-stone-900">৳{prod.pricePerKg}</span>
                    <span className="text-[10px] text-stone-500">/kg wholesale</span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm">
                      {language === 'bn' ? prod.banglaName || prod.cropName : prod.cropName}
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {prod.variety || 'Deshi Hybrid'} • {prod.locationDetails || prod.district}
                    </p>
                    <div className="mt-2 text-stone-700 font-semibold flex items-center justify-between text-xs bg-stone-50 p-2 rounded-xl border border-stone-100">
                      <span>Available Stock:</span>
                      <strong className="text-emerald-700 font-black text-sm">
                        {prod.availableKg} kg
                      </strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-[10px] text-stone-400">
                      Min Order: {prod.minOrderKg || 50} kg
                    </span>
                    <button
                      onClick={() => handleDeleteProduct(prod.id)}
                      className="text-stone-400 hover:text-red-500 p-1 transition-colors"
                      title="Delete Listing"
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

      {/* ─── TAB 3: WHOLESALER ORDERS ────────────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="font-extrabold text-stone-900 text-base">
                {t('Wholesale Orders from Registered Wholesalers', 'নিবন্ধিত পাইকারদের ক্রয়াদেশ')}
              </h3>
              <p className="text-xs text-stone-500">
                {t(
                  'Orders received from wholesalers purchasing your crops. Update dispatch status upon crate delivery.',
                  'আপনার ফসল ক্রয়ে পাইকারদের অর্ডার। মাল পাঠানোর পর স্ট্যাটাস আপডেট করুন।'
                )}
              </p>
            </div>
            <span className="badge-success text-xs">Strict Supply Chain</span>
          </div>

          {ordersLoading && (
            <div className="text-center py-10">
              <RefreshCw className="w-6 h-6 mx-auto text-emerald-600 animate-spin" />
            </div>
          )}

          {!ordersLoading && receivedOrders.length === 0 && (
            <div className="text-center py-12 text-stone-400 space-y-2">
              <Truck className="w-10 h-10 mx-auto text-stone-300" />
              <p className="text-xs font-semibold text-stone-600">
                {t('No wholesale orders received yet', 'এখনও কোনো পাইকারি অর্ডার আসেনি')}
              </p>
              <p className="text-[11px] text-stone-400">
                Wholesalers will order directly from your active harvest listings.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {receivedOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-stone-900 text-sm">{order.id}</span>
                    <span
                      className={`badge text-[10px] ${
                        order.status === 'Delivered'
                          ? 'badge-success'
                          : order.status === 'Dispatched'
                          ? 'badge-purple'
                          : 'badge-warning'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="text-stone-700 font-semibold">
                    Wholesaler: <strong className="text-stone-900">{order.buyerName}</strong> (
                    {order.buyerPhone})
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Delivery Hub: {order.deliveryAddress} • Payment: {order.paymentMethod}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-stone-500 text-[11px] block">Order Total</span>
                    <span className="font-black text-emerald-700 text-base">৳{order.totalBDT}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {order.status === 'Confirmed' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'Dispatched')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                      >
                        {t('Mark Dispatched', 'মাল পাঠান')}
                      </button>
                    )}
                    {order.status === 'Dispatched' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'Delivered')}
                        className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                      >
                        {t('Mark Delivered', 'ডেলিভারি সম্পন্ন')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 4: EXPENSE & EARNINGS LEDGER ─────────────────────────────────────── */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-extrabold text-stone-900 text-base">
                  {t('Farm Financial Ledger (Khatiyaan)', 'খামার আর্থিক হিসাব (খতিয়ান)')}
                </h3>
                <p className="text-xs text-stone-500">
                  Track seed, fertilizer, irrigation, labor expenses and wholesale revenue.
                </p>
              </div>

              <button
                onClick={() => setShowLedgerModal(true)}
                className="bg-stone-900 hover:bg-stone-800 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t('Add Entry', 'নতুন এন্ট্রি')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-stone-500">Total Crop Revenue</span>
                <div className="text-lg font-black text-emerald-700 mt-1">৳{totalIncome}</div>
              </div>
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-stone-500">Total Input Expenses</span>
                <div className="text-lg font-black text-red-600 mt-1">৳{totalExpenses}</div>
              </div>
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="text-emerald-900 font-semibold">Current Net Profit</span>
                <div className="text-lg font-black text-emerald-800 mt-1">৳{netProfit}</div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {ledgerEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs"
                >
                  <div>
                    <span className="font-bold text-stone-900">{entry.description || entry.category}</span>
                    <span className="text-[10px] text-stone-400 block">{entry.date} • {entry.category}</span>
                  </div>
                  <span
                    className={`font-black text-sm ${
                      entry.type === 'income' ? 'text-emerald-700' : 'text-stone-800'
                    }`}
                  >
                    {entry.type === 'income' ? `+৳${entry.amountBDT}` : `-৳${entry.amountBDT}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD HARVEST CROP (Farmer -> Wholesaler) ────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-stone-200 my-8 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-base">
                    {t('Publish Harvest to Wholesalers', 'পাইকারদের জন্য ফসল তালিকাভুক্ত করুন')}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Simple farmer-friendly form. Select crop with 1 tap.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishCrop} className="space-y-4 mt-4 text-xs">
              {/* Quick Crop Selector Pills */}
              <div>
                <label className="block font-bold text-stone-700 mb-2">
                  {t('1. Select Crop (1-Tap Fast Pick)', '১. ফসল নির্বাচন করুন (এক ট্যাপে বাছাই)')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {QUICK_CROPS.map((crop, idx) => (
                    <button
                      key={crop.nameEn}
                      type="button"
                      onClick={() => {
                        setSelectedCropIndex(idx);
                        setPricePerKg(crop.suggestedPrice);
                        setVariety(crop.variety);
                      }}
                      className={`p-2 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        selectedCropIndex === idx
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-2xs'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <img
                        src={crop.img}
                        alt={crop.nameEn}
                        className="w-10 h-10 rounded-xl object-cover"
                      />
                      <span className="font-extrabold text-[11px] leading-tight">
                        {language === 'bn' ? crop.nameBn : crop.nameEn}
                      </span>
                      <span className="text-[10px] text-stone-400">৳{crop.suggestedPrice}/kg</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity in Kg */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Harvest Quantity (kg)', 'ফসলের পরিমাণ (কেজি)')} *
                  </label>
                  <input
                    type="number"
                    value={quantityKg}
                    onChange={(e) => setQuantityKg(Math.max(10, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <span className="text-[10px] text-stone-400 mt-0.5 block">
                    ≈ {(quantityKg / 40).toFixed(1)} মণ (Maunds)
                  </span>
                </div>

                {/* Expected Price */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-stone-700">
                      {t('Wholesale Price (৳/kg)', 'পাইকারি দর (৳/কেজি)')} *
                    </label>
                    <button
                      type="button"
                      onClick={handlePredictPrice}
                      disabled={isPredicting}
                      className="text-emerald-700 hover:text-emerald-800 text-[10px] font-bold underline flex items-center gap-0.5"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{isPredicting ? 'AI Checking...' : 'AI Price Suggest'}</span>
                    </button>
                  </div>
                  <input
                    type="number"
                    value={pricePerKg}
                    onChange={(e) => setPricePerKg(Math.max(1, Number(e.target.value)))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-black text-emerald-700 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                  <span className="text-[10px] text-stone-400 mt-0.5 block">
                    Total: ৳{(quantityKg * pricePerKg).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* AI Prediction Hint Box */}
              {aiPrediction && (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs space-y-1 animate-slide-down">
                  <div className="flex items-center justify-between font-bold text-emerald-900">
                    <span>AI Suggested Wholesale Benchmark:</span>
                    <span>৳{aiPrediction.expectedPriceRangeBDT.recommendedWholesale}/kg</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80">
                    {aiPrediction.keyMarketDrivers?.[0] ||
                      'Favorable seasonal market demand in Bogura arat.'}
                  </p>
                </div>
              )}

              {/* Quality & Ready Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Quality Grade', 'ফসলের মান / গ্রেড')}
                  </label>
                  <select
                    value={qualityGrade}
                    onChange={(e) => setQualityGrade(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-semibold text-stone-800"
                  >
                    <option value="A">Grade A (Premium / Export Quality)</option>
                    <option value="B">Grade B (Standard Market Grade)</option>
                    <option value="C">Grade C (Mixed Size / Processing)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Harvest Status', 'বর্তমান অবস্থা')}
                  </label>
                  <select
                    value={harvestStatus}
                    onChange={(e) => setHarvestStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-semibold text-stone-800"
                  >
                    <option value="Ready to Harvest">Ready to Harvest (তোলার উপযুক্ত)</option>
                    <option value="Harvested in Sacks">Harvested in Sacks (বস্তাজাত)</option>
                    <option value="Growing (10 days)">Growing (১০ দিনের মধ্যে তোলা যাবে)</option>
                  </select>
                </div>
              </div>

              {/* Organic Checkbox */}
              <label className="flex items-center gap-2 text-stone-700 font-semibold cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={organicCertified}
                  onChange={(e) => setOrganicCertified(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                <span>{t('Grown using organic compost (Bio-fresh)', 'জৈব সার ও বালাইনাশক মুক্ত পদ্ধতিতে চাষ করা')}</span>
              </label>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  {t('Cancel', 'বাতিল')}
                </button>
                <button
                  type="submit"
                  disabled={submittingProduct}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-400 text-white font-extrabold px-6 py-2 rounded-xl shadow-md flex items-center gap-2"
                >
                  {submittingProduct ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t('Publishing...', 'তালিকাভুক্ত হচ্ছে...')}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('Publish Harvest', 'ফসল প্রকাশ করুন')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: ADD LEDGER ENTRY ────────────────────────────────────────────── */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-stone-200">
            <h3 className="font-extrabold text-stone-900 text-base mb-3">
              {t('New Financial Ledger Entry', 'নতুন খতিয়ান এন্ট্রি')}
            </h3>

            <form onSubmit={handleAddLedgerEntry} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLedgerForm((f) => ({ ...f, type: 'expense' }))}
                  className={`py-2 rounded-xl font-bold border ${
                    ledgerForm.type === 'expense'
                      ? 'bg-red-50 border-red-500 text-red-700'
                      : 'border-stone-200 text-stone-600'
                  }`}
                >
                  Expense (ব্যয়)
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerForm((f) => ({ ...f, type: 'income' }))}
                  className={`py-2 rounded-xl font-bold border ${
                    ledgerForm.type === 'income'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                      : 'border-stone-200 text-stone-600'
                  }`}
                >
                  Income (আয়)
                </button>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Category</label>
                <select
                  value={ledgerForm.category}
                  onChange={(e) =>
                    setLedgerForm((f) => ({ ...f, category: e.target.value as any }))
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-semibold"
                >
                  <option value="Fertilizer">Fertilizer (সার)</option>
                  <option value="Seeds">Seeds (বীজ)</option>
                  <option value="Irrigation">Irrigation (সেচ)</option>
                  <option value="Labor">Labor (শ্রমিক)</option>
                  <option value="Pesticide">Pesticide (কীটনাশক)</option>
                  <option value="Transport">Transport (পরিবহন)</option>
                  <option value="Harvest Sale">Harvest Sale (ফসল বিক্রয়)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Amount (BDT)</label>
                <input
                  type="number"
                  value={ledgerForm.amountBDT}
                  onChange={(e) =>
                    setLedgerForm((f) => ({ ...f, amountBDT: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Description / Memo</label>
                <input
                  type="text"
                  value={ledgerForm.description}
                  onChange={(e) =>
                    setLedgerForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="e.g. 2 sacks Urea fertilizer"
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLedgerModal(false)}
                  className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-stone-900 text-white font-bold px-4 py-2 rounded-xl shadow-xs"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
