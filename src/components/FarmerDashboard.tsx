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
import { toBanglaNumber, toBanglaDistrict } from './Header';

interface FarmerDashboardProps {
  currentUser: User;
  suppliers?: any[];
  language: Language;
  onOpenCropDoctor: () => void;
  onOpenVoiceAssistant: () => void;
}

type FarmerTabId = 'my_crops' | 'orders' | 'ledger';

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
  const [activeTab, setActiveTab] = useState<FarmerTabId>('my_crops');

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
  const [customCropName, setCustomCropName] = useState('');
  const [customCategory, setCustomCategory] = useState<'Vegetables' | 'Tubers' | 'Grains' | 'Spices' | 'Fruits'>('Vegetables');
  const [quantityKg, setQuantityKg] = useState(0);
  const [pricePerKg, setPricePerKg] = useState(0);
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

  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

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
        sellerId: currentUser.id,
        sellerRole: 'farmer',
      });
      // Strictly show ONLY this specific farmer's products
      const filtered = (res.products || []).filter(
        (p) => p.sellerId === currentUser.id || p.sellerName === currentUser.name
      );
      setMyProducts(filtered);
    } catch (err) {
      console.error('Failed to load farmer products', err);
      setMyProducts([]);
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

  // Listen for direct AI action to open crop modal
  useEffect(() => {
    const handleOpenAddCrop = () => {
      setShowAddModal(true);
    };
    window.addEventListener('nb_open_add_crop', handleOpenAddCrop);
    return () => window.removeEventListener('nb_open_add_crop', handleOpenAddCrop);
  }, []);

  // AI Price Recommendation
  const handlePredictPrice = async () => {
    setIsPredicting(true);
    const isCustom = customCropName.trim().length > 0;
    const cropName = isCustom ? customCropName.trim() : (QUICK_CROPS[selectedCropIndex]?.nameEn || 'Agro Product');
    try {
      const result = await requestMarketPrediction(
        cropName,
        quantityKg || 100,
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

    const isCustom = customCropName.trim().length > 0;
    const selected = !isCustom && selectedCropIndex >= 0 ? QUICK_CROPS[selectedCropIndex] : null;

    if (!isCustom && !selected) {
      showToast(t('Please select or type a crop name', 'অনুগ্রহ করে একটি ফসল নির্বাচন করুন বা নাম লিখুন'), 'error');
      return;
    }

    if (quantityKg <= 0) {
      showToast(t('Please enter valid crop quantity', 'অনুগ্রহ করে ফসলের সঠিক পরিমাণ উল্লেখ করুন'), 'error');
      return;
    }

    if (pricePerKg <= 0) {
      showToast(t('Please enter valid wholesale price', 'অনুগ্রহ করে প্রতি কেজির সঠিক পাইকারি দর উল্লেখ করুন'), 'error');
      return;
    }

    setSubmittingProduct(true);

    const cropNameEn = isCustom ? customCropName.trim() : (selected?.nameEn || 'Agro Product');
    const cropNameBn = isCustom ? customCropName.trim() : (selected?.nameBn || 'কৃষিপণ্য');
    const category = isCustom ? customCategory : (selected?.category || 'Vegetables');
    const cropImg = selected?.img || 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=800&auto=format&fit=crop&q=80';

    try {
      await productApi.createProduct({
        sellerId: currentUser.id,
        sellerName: currentUser.name,
        sellerPhone: currentUser.phone,
        sellerRole: 'farmer',
        targetRole: 'wholesaler',
        cropName: cropNameEn,
        banglaName: cropNameBn,
        category: category,
        variety: variety || (isCustom ? 'দেশি জাত' : selected?.variety) || 'দেশি উন্নত জাত',
        quantityKg,
        availableKg: quantityKg,
        minOrderKg: Math.min(50, quantityKg),
        pricePerKg,
        qualityGrade,
        district: currentUser.district || selectedDistrict,
        upazila: currentUser.upazila || 'Shibganj',
        locationDetails: `${currentUser.upazila || 'Shibganj'}, ${currentUser.district || 'Bogura'} জমি`,
        harvestStatus,
        organicCertified,
        imageUrl: cropImg,
        description: description || `${cropNameBn} সরাসরি চাষির জমি থেকে সংগৃহীত।`,
        traceability: {
          farmerOrigin: `${currentUser.name}, ${currentUser.upazila || 'Shibganj'}, ${currentUser.district || 'Bogura'}`,
          procurementDate: 'আজকের তাজা ফসল',
          safetyNote: '১০০% ফরমালিনমুক্ত এবং বিষমুক্ত চাষাবাদ।',
        },
      });

      NotificationStore.addSystemNotif(
        currentUser?.id || 'usr-farmer',
        t('Harvest Published!', 'ফসল তালিকাভুক্ত!'),
        t(
          `${cropNameEn} (${quantityKg}kg) published to Wholesalers at ৳${pricePerKg}/kg.`,
          `${cropNameBn} (${quantityKg} কেজি) পাইকারদের জন্য তালিকাভুক্ত করা হয়েছে। মূল্য ৳${pricePerKg}/কেজি।`
        ),
        'success'
      );

      showToast(t('Harvest published successfully!', 'ফসল সফলভাবে তালিকাভুক্ত হয়েছে!'), 'success');
      setShowAddModal(false);
      setCustomCropName('');
      setAiPrediction(null);
      loadMyProducts();
    } catch (err: any) {
      showToast(err.message || 'Failed to publish crop', 'error');
    } finally {
      setSubmittingProduct(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = (id: string) => {
    setConfirmDialog({
      message: t('Are you sure you want to remove this harvest listing?', 'এই ফসলের তালিকাটি কি নিশ্চিতভাবে মুছে ফেলতে চান?'),
      onConfirm: async () => {
        try {
          await productApi.deleteProduct(id);
          showToast(t('Harvest listing deleted', 'ফসলের তালিকাটি মুছে ফেলা হয়েছে'), 'success');
          loadMyProducts();
        } catch (e: any) {
          showToast(e.message || 'Failed to delete listing', 'error');
        }
      },
    });
  };

  // Update Order Delivery Status
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: 'Confirmed' | 'Processing' | 'Dispatched' | 'Delivered'
  ) => {
    try {
      await orderApi.updateStatus(orderId, status, currentUser?.name || 'Farmer', 'farmer');
      loadReceivedOrders();
      NotificationStore.addSystemNotif(
        currentUser?.id || 'usr-farmer',
        t('Order Updated', 'অর্ডারের অবস্থা পরিবর্তিত'),
        t(`Order #${orderId} marked as ${status}`, `অর্ডার #${orderId} এখন ${status}`),
        'info'
      );
      showToast(t(`Order #${orderId} marked as ${status}`, `অর্ডার #${orderId} এখন ${status}`), 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to update order status', 'error');
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
  const totalExpenses = ExpenseStore.totalExpenses(currentUser.id);
  const totalIncome = ExpenseStore.totalRevenue(currentUser.id);
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
                `Direct wholesale supply to registered wholesalers. Verified DAM market prices and buyer procurement bids for ${currentUser.district || 'Bogura'}.`,
                `সরাসরি নিবন্ধিত পাইকারদের কাছে পাইকারি দরে ফসল বিক্রি করুন। ${toBanglaDistrict(currentUser.district || 'বগুড়া')} ও স্থানীয় বাজারদর এবং আপডেট শুধুমাত্র কৃষকের জন্য।`
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
            {language === 'bn' ? toBanglaNumber(totalHarvestKg.toLocaleString()) : totalHarvestKg.toLocaleString()}{' '}
            <span className="text-xs font-normal text-stone-500">{language === 'bn' ? 'কেজি' : 'kg'}</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {language === 'bn' ? toBanglaNumber(myProducts.length) : myProducts.length} {t('active wholesale batches', 'টি পাইকারি লট')}
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Est. Wholesale Value', 'সম্ভাব্য বিক্রয় মূল্য')}</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-blue-700">
            ৳{language === 'bn' ? toBanglaNumber(totalEstRevenue.toLocaleString()) : totalEstRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Based on wholesale gate rates', 'পাইকারি দরের ভিত্তিতে')}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Verified Wholesaler Bids', 'পাইকারদের চাহিদা')}</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-700">
            {language === 'bn' ? toBanglaNumber(receivedOrders.length) : receivedOrders.length}{' '}
            <span className="text-xs font-normal text-stone-500">{t('Tenders / Offers', 'টি অফার')}</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Procurement bids received for your crops', 'আপনার ফসলের জন্য প্রাপ্ত ক্রয় চুক্তি ও অফার')}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Net Farm Profit', 'নিট খামার মুনাফা')}</span>
            <Wallet className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-stone-900">
            ৳{language === 'bn' ? toBanglaNumber(netProfit.toLocaleString()) : netProfit.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Calculated via Farm Ledger', 'খামার লেজার হিসাব অনুযায়ী')}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto no-scrollbar">
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
                      {language === 'bn' ? `সর্বনিম্ন অর্ডার: ${toBanglaNumber(prod.minOrderKg || 50)} কেজি` : `Min Order: ${prod.minOrderKg || 50} kg`}
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
                        (order.status || order.deliveryStatus) === 'Delivered'
                          ? 'badge-success'
                          : (order.status || order.deliveryStatus) === 'Dispatched'
                          ? 'badge-purple'
                          : 'badge-warning'
                      }`}
                    >
                      {order.status || order.deliveryStatus}
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
                    {((order.status || order.deliveryStatus) === 'Confirmed') && (
                      <button
                        onClick={() => handleUpdateOrderStatus(order.id, 'Dispatched')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                      >
                        {t('Mark Dispatched', 'মাল পাঠান')}
                      </button>
                    )}
                    {((order.status || order.deliveryStatus) === 'Dispatched') && (
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-2xl border border-stone-200 my-6 animate-scale-up">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black shadow-2xs">
                  <Sprout className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-base sm:text-lg">
                    {t('Publish Harvest to Wholesalers', 'পাইকারদের জন্য ফসল তালিকাভুক্ত করুন')}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {t(
                      'Direct wholesale listing for verified arats and traders',
                      'পাইকারদের জন্য সরাসরি আপনার জমির ফসল বিক্রির তালিকা তৈরি করুন'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishCrop} className="space-y-4 mt-4">
              {/* ─── Step 1: Crop Selection ─── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs sm:text-sm font-black text-stone-800">
                    {t('1. Select Crop (Quick-Pick or Custom):', '১. ফসল নির্বাচন করুন:')}
                  </label>
                  <span className="text-[11px] text-stone-500 font-medium">
                    {t('Tap image or type custom name below', 'ছবিতে স্পর্শ করুন বা নিজে নাম লিখুন')}
                  </span>
                </div>

                {/* Quick-Pick Image Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {QUICK_CROPS.map((crop, idx) => {
                    const isSelected = selectedCropIndex === idx && !customCropName.trim();
                    return (
                      <button
                        key={crop.nameEn}
                        type="button"
                        onClick={() => {
                          setSelectedCropIndex(idx);
                          setCustomCropName('');
                          setPricePerKg(crop.suggestedPrice);
                          setVariety(crop.variety);
                        }}
                        className={`p-2.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center gap-1 relative cursor-pointer active:scale-95 ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/90 text-emerald-950 font-black shadow-xs ring-2 ring-emerald-500/20'
                            : 'border-stone-200 text-stone-700 hover:bg-stone-50 hover:border-stone-300'
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </span>
                        )}
                        <img
                          src={crop.img}
                          alt={crop.nameEn}
                          className="w-11 h-11 rounded-xl object-cover shadow-2xs"
                        />
                        <span className="font-extrabold text-xs leading-tight line-clamp-1">
                          {language === 'bn' ? crop.nameBn : crop.nameEn}
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold bg-white/80 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                          ৳{language === 'bn' ? toBanglaNumber(crop.suggestedPrice) : crop.suggestedPrice}/কেজি
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* ── Custom Crop Text Input Field ── */}
                <div className="pt-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs sm:text-sm font-black text-stone-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t('Or Type Your Crop Name:', 'অথবা ফসলের নাম লিখুন:')}</span>
                    </label>
                    {customCropName.trim() && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {t('Custom Selected', 'কাস্টম ফসল সক্রিয়')}
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={customCropName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomCropName(val);
                        if (val.trim().length > 0) {
                          setSelectedCropIndex(-1);
                        }
                      }}
                      placeholder={t(
                        'Type crop name (e.g. Maize, Papaya, Garlic, Cucumber, Mustard)...',
                        'যেমন: ভুট্টা, পেঁপে, রসুন, শসা, গম, সরিষা বা যেকোনো ফসলের নাম...'
                      )}
                      className={`w-full px-4 py-3 bg-stone-50 border-2 rounded-2xl text-sm sm:text-base font-bold text-stone-900 transition-all focus:outline-hidden focus:bg-white placeholder:text-stone-400 placeholder:font-normal ${
                        customCropName.trim().length > 0
                          ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-white'
                          : 'border-stone-200 focus:border-emerald-600'
                      }`}
                    />
                    {customCropName && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomCropName('');
                          setSelectedCropIndex(0);
                          setPricePerKg(QUICK_CROPS[0].suggestedPrice);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-stone-200 hover:bg-stone-300 text-stone-600 flex items-center justify-center text-xs cursor-pointer font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Category Pills when Custom is typed */}
                  {customCropName.trim().length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                      <span className="text-[11px] font-bold text-stone-500 shrink-0">
                        {t('Category:', 'ক্যাটাগরি:')}
                      </span>
                      {(['Vegetables', 'Tubers', 'Grains', 'Spices', 'Fruits'] as const).map((cat) => {
                        const catLabels: Record<string, string> = {
                          Vegetables: 'শাকসবজি',
                          Tubers: 'আলু ও কন্দ',
                          Grains: 'দানাশস্য',
                          Spices: 'মসলা',
                          Fruits: 'ফলমূল',
                        };
                        const isCatSelected = customCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setCustomCategory(cat)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              isCatSelected
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                          >
                            {language === 'bn' ? catLabels[cat] : cat}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Step 2: Quantity & Price (Spacious & Farmer-Friendly) ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-stone-100">
                {/* Quantity Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs sm:text-sm font-black text-stone-800">
                      {t('2. Quantity (kg)', '২. ফসলের পরিমাণ (কেজি)')} *
                    </label>
                    <span className="text-[11px] text-stone-500 font-bold">
                      ≈ {language === 'bn' ? toBanglaNumber((quantityKg / 40).toFixed(1)) : (quantityKg / 40).toFixed(1)} মণ
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min="10"
                      value={quantityKg || ''}
                      onChange={(e) => setQuantityKg(Math.max(0, Number(e.target.value)))}
                      placeholder="১০০"
                      className="w-full pl-4 pr-12 py-3 bg-stone-50 border-2 border-stone-200 rounded-2xl font-black text-lg sm:text-xl font-mono text-stone-900 focus:outline-hidden focus:border-emerald-600 focus:bg-white transition"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-500">
                      {t('kg', 'কেজি')}
                    </span>
                  </div>

                  {/* Quick Quantity Increment Pills */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {[50, 100, 200, 500].map((increment) => (
                      <button
                        key={increment}
                        type="button"
                        onClick={() => setQuantityKg((prev) => (prev || 0) + increment)}
                        className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 border border-stone-200 text-[10px] font-bold text-stone-600 transition cursor-pointer active:scale-95"
                      >
                        +{language === 'bn' ? toBanglaNumber(increment) : increment}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wholesale Price Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-black text-stone-800">
                      {t('3. Wholesale Price (৳/kg)', '৩. পাইকারি দর (৳/কেজি)')} *
                    </label>
                    <button
                      type="button"
                      onClick={handlePredictPrice}
                      disabled={isPredicting}
                      className="text-emerald-700 hover:text-emerald-800 text-[11px] font-bold underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{isPredicting ? t('Checking...', 'যাচাই হচ্ছে...') : t('AI Price', 'এআই দর')}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl text-emerald-700">
                      ৳
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={pricePerKg || ''}
                      onChange={(e) => setPricePerKg(Math.max(0, Number(e.target.value)))}
                      placeholder="৩৫"
                      className="w-full pl-9 pr-14 py-3 bg-stone-50 border-2 border-stone-200 rounded-2xl font-black text-lg sm:text-xl font-mono text-emerald-800 focus:outline-hidden focus:border-emerald-600 focus:bg-white transition"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-500">
                      / {t('kg', 'কেজি')}
                    </span>
                  </div>

                  {/* Estimated Total Calculation */}
                  <div className="pt-1">
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between text-xs">
                      <span className="text-emerald-800 font-bold">{t('Est. Payout:', 'মোট মূল্য:')}</span>
                      <span className="font-black text-emerald-950 font-mono">
                        ৳{language === 'bn' ? toBanglaNumber((quantityKg * pricePerKg).toLocaleString()) : (quantityKg * pricePerKg).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Prediction Hint Box */}
              {aiPrediction && (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs space-y-1 animate-slide-down">
                  <div className="flex items-center justify-between font-bold text-emerald-900">
                    <span>{t('AI Market Recommended Wholesale:', 'এআই প্রস্তাবিত পাইকারি দর:')}</span>
                    <span className="font-black text-sm">৳{language === 'bn' ? toBanglaNumber(aiPrediction.expectedPriceRangeBDT.recommendedWholesale) : aiPrediction.expectedPriceRangeBDT.recommendedWholesale}/কেজি</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80">
                    {aiPrediction.keyMarketDrivers?.[0] || 'মহাস্থানগড় ও স্থানীয় আড়তের চাহিদার ভিত্তিতে প্রস্তাবিত দর।'}
                  </p>
                </div>
              )}

              {/* ─── Step 3: Quality & Readiness (Simplified) ─── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-stone-100">
                <div>
                  <label className="block text-xs font-black text-stone-700 mb-1.5">
                    {t('Quality Grade', 'ফসলের মান / গ্রেড')}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { val: 'A', labelEn: 'Grade A', labelBn: 'গ্রেড-এ' },
                      { val: 'B', labelEn: 'Grade B', labelBn: 'গ্রেড-বি' },
                      { val: 'C', labelEn: 'Grade C', labelBn: 'গ্রেড-সি' },
                    ].map((g) => (
                      <button
                        key={g.val}
                        type="button"
                        onClick={() => setQualityGrade(g.val as any)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold text-center transition cursor-pointer border ${
                          qualityGrade === g.val
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {language === 'bn' ? g.labelBn : g.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-stone-700 mb-1.5">
                    {t('Harvest Status', 'ফসল তোলার অবস্থা')}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { val: 'Ready to Harvest', labelEn: 'Field Ready', labelBn: 'তোলার উপযুক্ত' },
                      { val: 'Harvested in Sacks', labelEn: 'In Sacks', labelBn: 'বস্তাজাত সম্পন্ন' },
                    ].map((s) => (
                      <button
                        key={s.val}
                        type="button"
                        onClick={() => setHarvestStatus(s.val)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold text-center transition cursor-pointer border ${
                          harvestStatus === s.val
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {language === 'bn' ? s.labelBn : s.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Organic Checkbox */}
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-stone-50 border border-stone-200 text-stone-700 font-semibold cursor-pointer hover:bg-stone-100 transition">
                <input
                  type="checkbox"
                  checked={organicCertified}
                  onChange={(e) => setOrganicCertified(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded-md accent-emerald-600 cursor-pointer"
                />
                <span className="text-xs">
                  {t(
                    'Grown using organic compost & pesticide-free practices',
                    'জৈব সার ও বালাইনাশক মুক্ত প্রাকৃতিক পদ্ধতিতে চাষকৃত ফসল'
                  )}
                </span>
              </label>

              {/* ─── Submit Buttons ─── */}
              <div className="pt-3 flex flex-col sm:flex-row items-center justify-end gap-2.5 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-full sm:w-auto px-5 py-3 font-bold text-stone-600 hover:bg-stone-100 rounded-2xl transition cursor-pointer text-xs sm:text-sm"
                >
                  {t('Cancel', 'বাতিল')}
                </button>
                <button
                  type="submit"
                  disabled={submittingProduct}
                  className="w-full sm:w-auto flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:bg-stone-400 text-white font-black text-sm sm:text-base py-3 px-6 rounded-2xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {submittingProduct ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>{t('Publishing Harvest...', 'ফসল তালিকাভুক্ত হচ্ছে...')}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{t('Publish Crop to Wholesalers', 'ফসল প্রকাশ করুন (পাইকাররা দেখতে পাবে)')}</span>
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
            className="ml-2 text-stone-400 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-100 animate-in zoom-in-95 duration-200">
            <h4 className="text-lg font-bold text-stone-900 mb-2">{t('Confirm Action', 'নিশ্চিতকরণ')}</h4>
            <p className="text-sm text-stone-600 mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-stone-600 font-bold hover:bg-stone-100 rounded-xl transition-colors text-sm"
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors text-sm"
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
