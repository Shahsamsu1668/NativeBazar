import React, { useState, useEffect, useRef } from 'react';
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
import { ExpenseStore, NotificationStore, WholesalerOfferStore } from '../data/store';
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
  Upload,
} from 'lucide-react';
import { requestMarketPrediction, MarketPredictionResult } from '../services/aiService';
import { fetchCropImage, handleImageError, normalizeCropName } from '../services/imageService';
import { toBanglaNumber, toBanglaDistrict } from './Header';
import { BANGLADESH_DISTRICT_COORDS, resolveDistrictKey } from '../services/weatherService';
import { BANGLADESH_LOCATIONS } from '../data/bangladeshLocations';

interface FarmerDashboardProps {
  currentUser: User;
  suppliers?: any[];
  language: Language;
  selectedDistrict?: string;
  onDistrictChange?: (district: string) => void;
  onOpenCropDoctor: () => void;
  onOpenVoiceAssistant: () => void;
}

type FarmerTabId = 'my_crops' | 'demands' | 'orders' | 'ledger';

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
    img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Pointed_gourd.jpg/800px-Pointed_gourd.jpg',
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
  const [customCropName, setCustomCropName] = useState('');
  const [cropNameError, setCropNameError] = useState<string | null>(null);
  const [uploadedCropImage, setUploadedCropImage] = useState<string>('');
  const [quantityKg, setQuantityKg] = useState<number | ''>('');
  const [quantityDozen, setQuantityDozen] = useState<number | ''>('');
  const [pricePerKg, setPricePerKg] = useState<number | ''>('');
  const [qualityGrade, setQualityGrade] = useState<'A' | 'B' | 'C'>('A');
  const [harvestStatus, setHarvestStatus] = useState('Ready to Harvest');
  const [organicCertified, setOrganicCertified] = useState(false);
  const [variety, setVariety] = useState('দেশি উন্নত জাত');
  const [description, setDescription] = useState('Freshly harvested batch from our family farmland.');
  const cropImageInputRef = useRef<HTMLInputElement>(null);
  const cropNameInputRef = useRef<HTMLInputElement>(null);

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setCustomCropName('');
    setCropNameError(null);
    setAiPrediction(null);
    setUploadedCropImage('');
    setQuantityKg('');
    setQuantityDozen('');
    setPricePerKg('');
    if (cropImageInputRef.current) cropImageInputRef.current.value = '';
  };

  const handleCropImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast(language === 'bn' ? 'শুধুমাত্র ছবি ফাইল নির্বাচন করুন' : 'Please select an image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(language === 'bn' ? 'ছবির সাইজ ৫ MB এর কম হতে হবে' : 'Image size must be under 5MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedCropImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

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

  // Demand Fulfillment (Farmer sells directly to Wholesaler)
  const [selectedDemandToFulfill, setSelectedDemandToFulfill] = useState<WholesalerOffer | null>(null);
  const [fulfillQty, setFulfillQty] = useState<number | ''>('');
  const [selectedFarmerBatchId, setSelectedFarmerBatchId] = useState<string>('');
  const [fulfillNotes, setFulfillNotes] = useState<string>('');
  const [submittingFulfill, setSubmittingFulfill] = useState(false);

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
      const localOffers = WholesalerOfferStore.getByDistrict(selectedDistrict);
      const mergedOffers = (data.wholesalerOffers && data.wholesalerOffers.length > 0)
        ? data.wholesalerOffers
        : localOffers;
      setWholesalerOffers(mergedOffers);
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

  // Execute Direct Crop Fulfillment to Wholesaler Demand
  const handleConfirmFulfill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDemandToFulfill) return;

    const qty = Number(fulfillQty);
    if (!qty || qty <= 0) {
      showToast(t('Please enter a valid supply quantity.', 'অনুগ্রহ করে সঠিক পরিমাণ লিখুন।'), 'error');
      return;
    }

    setSubmittingFulfill(true);
    try {
      const isDozen = selectedDemandToFulfill.unit === 'dozen';
      const totalBDT = qty * (selectedDemandToFulfill.offeredPricePerKg || 0);

      await orderApi.createOrder({
        buyerId: selectedDemandToFulfill.wholesalerId,
        buyerName: selectedDemandToFulfill.businessName || selectedDemandToFulfill.wholesalerName || 'Wholesaler',
        buyerPhone: selectedDemandToFulfill.wholesalerPhone || '',
        buyerRole: 'wholesaler',
        sellerId: currentUser.id,
        sellerName: currentUser.name,
        sellerPhone: currentUser.phone,
        sellerRole: 'farmer',
        items: [
          {
            productId: selectedFarmerBatchId || `crop-${selectedDemandToFulfill.id}`,
            quantityKg: isDozen ? (qty * 12) : qty,
          },
        ],
        paymentMethod: 'Bank Transfer',
        deliveryAddress: selectedDemandToFulfill.location,
        district: selectedDemandToFulfill.district,
        notes: fulfillNotes || `Direct farmer fulfillment for demand post #${selectedDemandToFulfill.id}. Quantity: ${qty} ${isDozen ? 'dozen' : 'kg'}`,
      });

      // Update fulfilled amount on demand post in WholesalerOfferStore
      WholesalerOfferStore.fulfill(selectedDemandToFulfill.id, qty);

      // Send notification to wholesaler
      NotificationStore.addSystemNotif(
        selectedDemandToFulfill.wholesalerId,
        t('Farmer Supplied Harvest', 'কৃষক ফসল সরবরাহ করেছেন'),
        t(
          `Farmer ${currentUser.name} accepted your demand post for ${selectedDemandToFulfill.cropName} (${qty} ${isDozen ? 'dozen' : 'kg'}).`,
          `কৃষক ${currentUser.name} আপনার ${selectedDemandToFulfill.cropBangla || selectedDemandToFulfill.cropName} চাহিদা অনুযায়ী ${qty} ${isDozen ? 'ডজন' : 'কেজি'} সরবরাহের অর্ডার নিশ্চিত করেছেন।`
        ),
        'success'
      );

      showToast(
        t(
          'Supply order confirmed! Wholesaler has been notified.',
          'পাইকারের কাছে সফলভাবে ফসল বিক্রির অর্ডার নিশ্চিত করা হয়েছে! পাইকারকে অবহিত করা হয়েছে।'
        ),
        'success'
      );

      setSelectedDemandToFulfill(null);
      setFulfillQty('');
      setFulfillNotes('');
      setSelectedFarmerBatchId('');

      // Refresh intelligence and orders
      loadIntelligence();
      loadReceivedOrders();
    } catch (err: any) {
      showToast(err.message || 'Failed to confirm supply', 'error');
    } finally {
      setSubmittingFulfill(false);
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
    const cropName = customCropName.trim();
    if (!cropName) {
      const errMsg = language === 'bn' ? 'ফসলের নাম লিখুন' : 'Please enter crop name';
      setCropNameError(errMsg);
      showToast(errMsg, 'error');
      setAiPrediction(null);
      if (cropNameInputRef.current) {
        cropNameInputRef.current.focus();
        cropNameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setCropNameError(null);
    setIsPredicting(true);
    try {
      const qty = Number(quantityKg) || Number(quantityDozen) || 100;
      const result = await requestMarketPrediction(
        cropName,
        qty,
        'in 7 days',
        currentUser.district || selectedDistrict,
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

    const cropName = customCropName.trim();
    if (!cropName) {
      const errMsg = language === 'bn' ? 'ফসলের নাম লিখুন' : 'Please enter crop name';
      setCropNameError(errMsg);
      showToast(errMsg, 'error');
      if (cropNameInputRef.current) {
        cropNameInputRef.current.focus();
        cropNameInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (!pricePerKg || Number(pricePerKg) <= 0) {
      showToast(t('Please enter valid wholesale price', 'অনুগ্রহ করে সঠিক পাইকারি দর উল্লেখ করুন'), 'error');
      return;
    }

    setSubmittingProduct(true);

    const norm = normalizeCropName(cropName);
    const cropNameEn = cropName;
    const cropNameBn = cropName;
    const category = norm.category || 'Vegetables';

    let cropImg = uploadedCropImage;
    if (!cropImg) {
      cropImg = await fetchCropImage(cropNameEn, category);
    }

    const finalQuantityKg = Number(quantityKg) || 0;
    const finalQuantityDozen = Number(quantityDozen) || 0;

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
        variety: variety || 'দেশি উন্নত জাত',
        quantityKg: finalQuantityKg,
        availableKg: finalQuantityKg,
        quantityDozen: finalQuantityDozen > 0 ? finalQuantityDozen : undefined,
        minOrderKg: finalQuantityKg > 0 ? Math.min(50, finalQuantityKg) : undefined,
        pricePerKg: Number(pricePerKg),
        qualityGrade,
        district: currentUser.district || selectedDistrict,
        upazila: currentUser.upazila || 'Shibganj',
        locationDetails: `${currentUser.upazila || 'Shibganj'}, ${currentUser.district || 'Bogura'} জমি`,
        harvestStatus,
        organicCertified,
        imageUrl: cropImg,
        description: description || `${cropNameBn} সরাসরি চাষির জমি থেকে সংগৃহীত।`,
        traceability: {
          farmerOrigin: `${currentUser.name}${currentUser.upazila ? ', ' + currentUser.upazila : ''}, ${currentUser.district || selectedDistrict}`,
          procurementDate: 'আজকের তাজা ফসল',
          safetyNote: '১০০% ফরমালিনমুক্ত এবং বিষমুক্ত চাষাবাদ।',
        },
      });

      NotificationStore.addSystemNotif(
        'নতুন ফসল তালিকাভুক্ত হয়েছে',
        `${cropNameBn} পাইকারদের জন্য সফলভাবে যোগ করা হয়েছে। পাইকারি দর ৳${pricePerKg}`,
        'success'
      );

      showToast(
        language === 'bn'
          ? `${cropNameBn} সফলভাবে পাইকারদের জন্য তালিকাভুক্ত করা হয়েছে!`
          : `${cropNameEn} successfully published to Wholesalers!`,
        'success'
      );

      handleCloseAddModal();
      await loadMyProducts();
    } catch (err: any) {
      console.error('Failed to create product', err);
      showToast(t('Failed to publish crop', 'ফসল তালিকাভুক্ত করতে সমস্যা হয়েছে'), 'error');
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

        <div
          onClick={() => setActiveTab('demands')}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs cursor-pointer hover:border-amber-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span className="group-hover:text-amber-700 transition-colors">{t('Verified Wholesaler Demands', 'পাইকারদের চাহিদা পোস্ট')}</span>
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-700">
            {language === 'bn' ? toBanglaNumber(wholesalerOffers.length) : wholesalerOffers.length}{' '}
            <span className="text-xs font-normal text-stone-500">{t('Active Posts', 'টি পোস্ট')}</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Click to directly fulfill & sell harvest to wholesalers', 'সরাসরি পাইকারদের কাছে ফসল বিক্রয় ও সরবরাহের জন্য ক্লিক করুন')}</p>
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
          onClick={() => setActiveTab('demands')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'demands'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>{t('Wholesaler Demands', 'পাইকারদের চাহিদা পোস্ট')}</span>
          {wholesalerOffers.length > 0 && (
            <span className="bg-amber-500 text-stone-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
              {wholesalerOffers.length}
            </span>
          )}
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
                    onError={handleImageError}
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
                  <div
                    data-price-badge
                    className="product-price-badge absolute bottom-2 right-2 bg-white/95 dark:bg-stone-900/90 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-md border border-stone-200 dark:border-stone-700 text-right"
                  >
                    <span className="price-amount text-sm font-black text-stone-900 dark:text-white">৳{prod.pricePerKg}</span>
                    <span className="price-unit text-[10px] text-stone-500 dark:text-stone-300 block">/kg wholesale</span>
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

      {/* ─── TAB: WHOLESALER DEMAND POSTS (FARMER-ONLY) ─────────────────────────── */}
      {activeTab === 'demands' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">
                  🔒 {t('Farmer Exclusive', 'শুধুমাত্র কৃষকদের জন্য')}
                </span>
                <span className="text-xs text-stone-500">
                  {wholesalerOffers.length} {t('procurement demands listed', 'টি ক্রয়ের চাহিদা')}
                </span>
              </div>
              <h3 className="font-extrabold text-stone-900 text-base mt-1">
                {t('Wholesaler Crop Demands (Open Bids)', 'পাইকারদের শস্য ক্রয়ের চাহিদা পোস্ট')}
              </h3>
              <p className="text-xs text-stone-500">
                {t(
                  'Wholesalers post crop demands here. If you have the requested crop, directly sell and fulfill the order to the wholesaler!',
                  'পাইকারদের ক্রয়ের চাহিদা দেখে আপনার জমি বা গুদামের ফসল সরাসরি পাইকারের কাছে বিক্রি ও সরবরাহ করুন।'
                )}
              </p>
            </div>

            <button
              onClick={loadIntelligence}
              disabled={intelligenceLoading}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${intelligenceLoading ? 'animate-spin' : ''}`} />
              <span>{t('Refresh Demands', 'রিফ্রেশ চাহিদা')}</span>
            </button>
          </div>

          {wholesalerOffers.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200 p-12 text-center text-stone-500 space-y-3 shadow-xs">
              <Package className="w-12 h-12 text-stone-300 mx-auto" />
              <p className="font-bold text-base text-stone-800">
                {t('No wholesaler demands found in this district.', 'বর্তমানে এই জেলায় কোনো পাইকারি চাহিদা পোস্ট নেই।')}
              </p>
              <p className="text-xs text-stone-400">
                {t('Check back soon or browse other districts for open procurement tenders.', 'অন্যান্য জেলার চাহিদা দেখতে উপরের লোকেশন ফিল্টার পরিবর্তন করুন।')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {wholesalerOffers.map((offer) => {
                const isDozen = offer.unit === 'dozen';
                const totalNeeded = offer.quantityDozenNeeded || offer.quantityKgNeeded;
                const unitLabel = isDozen ? t('dozen', 'ডজন') : t('kg', 'কেজি');
                const fulfilled = offer.fulfilledKg || 0;
                const percent = Math.min(100, Math.round((fulfilled / (totalNeeded || 1)) * 100));

                return (
                  <div
                    key={offer.id}
                    className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-stone-900 text-base">
                              {offer.cropBangla || offer.cropName}
                            </span>
                            {offer.urgent && (
                              <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                                {t('Urgent', 'জরুরি')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-400 font-medium">{offer.cropName}</p>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-stone-400 font-bold block">{t('Offered Price', 'প্রস্তাবিত দর')}</span>
                          <span className="text-lg font-black text-emerald-700 font-mono">
                            ৳{offer.offeredPricePerKg}
                          </span>
                          <span className="text-[10px] text-stone-500 font-bold"> / {unitLabel}</span>
                        </div>
                      </div>

                      {/* Wholesaler Details */}
                      <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 text-xs space-y-1">
                        <div className="flex items-center justify-between text-stone-800 font-bold">
                          <span className="flex items-center gap-1.5 truncate">
                            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">{offer.businessName || offer.wholesalerName}</span>
                          </span>
                          {offer.verified && (
                            <span className="text-[10px] text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded font-extrabold shrink-0">
                              ✓ {t('Verified', 'যাচাইকৃত')}
                            </span>
                          )}
                        </div>
                        {offer.wholesalerPhone && (
                          <div className="text-stone-500 flex items-center gap-1 text-[11px]">
                            <Phone className="w-3 h-3 text-stone-400 shrink-0" />
                            <a href={`tel:${offer.wholesalerPhone}`} className="hover:underline font-mono">
                              {offer.wholesalerPhone}
                            </a>
                          </div>
                        )}
                        <div className="text-stone-500 flex items-center gap-1 text-[11px]">
                          <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                          <span className="truncate">{offer.location} ({offer.district})</span>
                        </div>
                      </div>

                      {/* Demand Quantity & Progress */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-stone-600">
                          <span className="text-[11px] font-bold">{t('Total Demand Needed:', 'মোট চাহিদা:')}</span>
                          <span className="font-black text-stone-900 font-mono">
                            {offer.quantityDozenNeeded ? `${offer.quantityDozenNeeded} ${t('dozen', 'ডজন')}` : ''}
                            {offer.quantityKgNeeded && offer.quantityDozenNeeded ? ' / ' : ''}
                            {offer.quantityKgNeeded ? `${offer.quantityKgNeeded} ${t('kg', 'কেজি')}` : ''}
                          </span>
                        </div>

                        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex justify-between text-[10px] text-stone-400 font-medium">
                          <span>{t('Fulfilled:', 'সরবরাহ হয়েছে:')} {fulfilled} {unitLabel}</span>
                          <span className="text-blue-700 font-bold">{offer.deadline}</span>
                        </div>
                      </div>

                      {offer.notes && (
                        <p className="text-[11px] text-stone-500 italic bg-amber-50/60 p-2 rounded-xl border border-amber-200/50">
                          "{offer.notes}"
                        </p>
                      )}
                    </div>

                    {/* Direct Sell/Fulfill Action Button */}
                    <button
                      onClick={() => {
                        setSelectedDemandToFulfill(offer);
                        setFulfillQty(Math.min(100, totalNeeded - fulfilled > 0 ? totalNeeded - fulfilled : 100));
                        setFulfillNotes('');
                      }}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Truck className="w-4 h-4" />
                      <span>{t('Sell / Fulfill Demand', 'সরাসরি বিক্রি / সরবরাহ করুন')}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
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

      {/* ─── MODAL: FULFILL WHOLESALER DEMAND (Farmer -> Wholesaler) ─────────────── */}
      {selectedDemandToFulfill && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-stone-900 text-base">
                  {t('Fulfill Wholesaler Demand', 'পাইকারের কাছে সরাসরি ফসল বিক্রি / সরবরাহ')}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDemandToFulfill(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmFulfill} className="space-y-4 mt-4 text-xs">
              {/* Wholesaler & Crop Summary Box */}
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-stone-900 text-sm">
                    {selectedDemandToFulfill.cropBangla || selectedDemandToFulfill.cropName}
                  </h4>
                  <span className="text-emerald-700 font-black text-sm font-mono">
                    ৳{selectedDemandToFulfill.offeredPricePerKg} / {selectedDemandToFulfill.unit === 'dozen' ? t('dozen', 'ডজন') : t('kg', 'কেজি')}
                  </span>
                </div>
                <p className="text-stone-500">
                  {t('Wholesaler:', 'পাইকার:')} <strong>{selectedDemandToFulfill.businessName || selectedDemandToFulfill.wholesalerName}</strong>
                </p>
                <div className="flex justify-between text-[11px] text-stone-500 pt-1 border-t border-stone-200">
                  <span>📍 {selectedDemandToFulfill.location}</span>
                  <span className="font-bold text-blue-700">{selectedDemandToFulfill.deadline}</span>
                </div>
              </div>

              {/* Quantity to Supply Input */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t(
                    `Quantity to Supply (${selectedDemandToFulfill.unit === 'dozen' ? 'Dozen' : 'kg'}) *`,
                    `সরবরাহের পরিমাণ (${selectedDemandToFulfill.unit === 'dozen' ? 'ডজন' : 'কেজি'}) *`
                  )}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={fulfillQty}
                    onChange={(e) => setFulfillQty(e.target.value === '' ? '' : Math.max(1, Number(e.target.value)))}
                    placeholder="যেমন: ১০০"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-black text-emerald-800 text-base focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono"
                    required
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-stone-500">
                    {selectedDemandToFulfill.unit === 'dozen' ? t('dozen', 'ডজন') : t('kg', 'কেজি')}
                  </span>
                </div>
              </div>

              {/* Optional Farm Batch Selection */}
              {myProducts.length > 0 && (
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Select Harvest Lot from Farm (Optional)', 'আপনার খামারের লট নির্বাচন করুন (ঐচ্ছিক)')}
                  </label>
                  <select
                    value={selectedFarmerBatchId}
                    onChange={(e) => setSelectedFarmerBatchId(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">{t('-- Fresh Lot from Field --', '-- জমি থেকে তাজা সংগ্রহিত লট --')}</option>
                    {myProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.banglaName || p.cropName} ({p.availableKg} kg available)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes for Wholesaler */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Delivery Note / Message for Wholesaler', 'পাইকারের জন্য বার্তা বা ডেলিভারির সময়')}
                </label>
                <textarea
                  rows={2}
                  value={fulfillNotes}
                  onChange={(e) => setFulfillNotes(e.target.value)}
                  placeholder={t('e.g. Freshly picked this morning, ready for delivery.', 'যেমন: আজ সকালে জমি থেকে তোলা তাজা ফসল, বিকেলে পৌঁছাবে।')}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Total Payout Calculation */}
              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center font-bold text-emerald-950">
                <span>{t('Total Estimated Payout:', 'মোট প্রাপ্তি মূল্য:')}</span>
                <span className="text-xl font-black text-emerald-800 font-mono">
                  ৳{((Number(fulfillQty) || 0) * (selectedDemandToFulfill.offeredPricePerKg || 0)).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedDemandToFulfill(null)}
                  className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  {t('Cancel', 'বাতিল')}
                </button>
                <button
                  type="submit"
                  disabled={submittingFulfill}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-400 text-white font-extrabold px-6 py-2 rounded-xl shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {submittingFulfill ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t('Confirming Order...', 'অর্ডার নিশ্চিত হচ্ছে...')}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('Confirm Wholesale Supply', 'সরবরাহ নিশ্চিত করুন')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
                onClick={handleCloseAddModal}
                className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishCrop} className="space-y-4 mt-4">
              {/* 1. Crop Name Input (First Field) */}
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-black text-stone-800 dark:text-stone-100">
                  {t('Crop Name', 'ফসলের নাম লিখুন')} *
                </label>
                <div className="relative">
                  <input
                    ref={cropNameInputRef}
                    id="add-crop-name-input"
                    type="text"
                    value={customCropName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomCropName(val);
                      if (!val.trim()) {
                        setAiPrediction(null);
                      }
                      if (cropNameError) {
                        setCropNameError(null);
                      }
                    }}
                    placeholder={t(
                      'Type crop name (e.g. Rice, Potato, Tomato, Eggplant, Onion, Mango, Papaya)...',
                      'যেমন: ধান, আলু, টমেটো, বেগুন, পেঁয়াজ, আম, পেঁপে, লিচু বা যেকোনো ফসলের নাম...'
                    )}
                    className={`w-full px-4 py-3 bg-stone-50 dark:bg-stone-800/80 border-2 rounded-2xl text-sm sm:text-base font-bold text-stone-900 dark:text-white transition-all focus:outline-hidden focus:bg-white dark:focus:bg-stone-800 placeholder:text-stone-400 placeholder:font-normal ${
                      cropNameError
                        ? 'border-rose-500 focus:border-rose-600 ring-2 ring-rose-500/20'
                        : 'border-stone-200 dark:border-stone-700 focus:border-emerald-600'
                    }`}
                    required
                  />
                  {customCropName && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomCropName('');
                        setCropNameError(null);
                        setAiPrediction(null);
                        cropNameInputRef.current?.focus();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 dark:hover:bg-stone-600 text-stone-600 dark:text-stone-300 flex items-center justify-center text-xs cursor-pointer font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {cropNameError && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1 mt-1 animate-slide-down">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{cropNameError}</span>
                  </p>
                )}
              </div>

              {/* 2. Optional Image Upload Field Below Crop Name */}
              <div className="space-y-1.5">
                <label className="block text-xs sm:text-sm font-black text-stone-800 dark:text-stone-100">
                  {t('Add Crop Image (Optional)', 'ফসলের ছবি অ্যাড করুন (ঐচ্ছিক)')}
                </label>

                <input
                  type="file"
                  accept="image/*"
                  ref={cropImageInputRef}
                  onChange={handleCropImageUpload}
                  className="hidden"
                  id="crop-image-file-input"
                />

                {!uploadedCropImage ? (
                  <div
                    onClick={() => cropImageInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-4 text-center cursor-pointer bg-stone-50 dark:bg-stone-800/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all group"
                  >
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center transition-colors group-hover:scale-105">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-stone-800 dark:text-stone-200 text-xs sm:text-sm">
                          {t('Upload crop photo from your device', 'ডিভাইস স্টোরেজ থেকে ফসলের ছবি আপলোড করুন')}
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400">
                          PNG, JPG, WEBP (ঐচ্ছিক)
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-2xl border-2 border-emerald-500/50 bg-stone-50 dark:bg-stone-800/80 p-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-200 dark:bg-stone-700 shrink-0 border border-stone-300 dark:border-stone-600">
                        <img
                          src={uploadedCropImage}
                          alt="Uploaded crop preview"
                          onError={handleImageError}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{t('Image attached', 'ছবি যুক্ত হয়েছে')}</span>
                        </p>
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {t('Stored as image data for product listing', 'তালিকাভুক্তির জন্য প্রস্তুত')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => cropImageInputRef.current?.click()}
                        className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-stone-700 hover:bg-stone-100 dark:hover:bg-stone-600 border border-stone-200 dark:border-stone-600 rounded-xl text-stone-700 dark:text-stone-200 transition cursor-pointer"
                      >
                        {t('Change', 'পরিবর্তন')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedCropImage('');
                          if (cropImageInputRef.current) cropImageInputRef.current.value = '';
                        }}
                        className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold transition cursor-pointer"
                        title={t('Remove Image', 'ছবি মুছুন')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Side-by-side Quantity Section (Non-mandatory, no asterisks, no required) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                {/* Quantity in kg */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs sm:text-sm font-black text-stone-800 dark:text-stone-200">
                      {t('Crop/Fruit Quantity (kg)', 'ফসলের/ফলের পরিমাণ (কেজি)')}
                    </label>
                    {Number(quantityKg) > 0 && (
                      <span className="text-[11px] text-stone-500 font-bold">
                        ≈ {language === 'bn' ? toBanglaNumber((Number(quantityKg) / 40).toFixed(1)) : (Number(quantityKg) / 40).toFixed(1)} মণ
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={quantityKg || ''}
                      onChange={(e) => setQuantityKg(Math.max(0, Number(e.target.value)))}
                      placeholder="১০০"
                      className="w-full pl-4 pr-14 py-3 bg-stone-50 dark:bg-stone-800/80 border-2 border-stone-200 dark:border-stone-700 rounded-2xl font-black text-lg sm:text-xl font-mono text-stone-900 dark:text-white focus:outline-hidden focus:border-emerald-600 focus:bg-white dark:focus:bg-stone-800 transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-500 dark:text-stone-400">
                      {t('kg', 'কেজি')}
                    </span>
                  </div>

                  {/* Quick Quantity Increment Pills */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {[50, 100, 200, 500].map((increment) => (
                      <button
                        key={increment}
                        type="button"
                        onClick={() => setQuantityKg((prev) => (Number(prev) || 0) + increment)}
                        className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-stone-800 dark:hover:bg-emerald-950/40 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[10px] font-bold text-stone-600 transition cursor-pointer active:scale-95"
                      >
                        +{language === 'bn' ? toBanglaNumber(increment) : increment}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quantity in Dozen */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs sm:text-sm font-black text-stone-800 dark:text-stone-200">
                      {t('Fruit Quantity (Dozen)', 'ফলের পরিমাণ (ডজন)')}
                    </label>
                    {Number(quantityDozen) > 0 && (
                      <span className="text-[11px] text-stone-500 font-bold">
                        = {language === 'bn' ? toBanglaNumber(Number(quantityDozen) * 12) : Number(quantityDozen) * 12} টি
                      </span>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={quantityDozen || ''}
                      onChange={(e) => setQuantityDozen(Math.max(0, Number(e.target.value)))}
                      placeholder="৫০"
                      className="w-full pl-4 pr-16 py-3 bg-stone-50 dark:bg-stone-800/80 border-2 border-stone-200 dark:border-stone-700 rounded-2xl font-black text-lg sm:text-xl font-mono text-stone-900 dark:text-white focus:outline-hidden focus:border-emerald-600 focus:bg-white dark:focus:bg-stone-800 transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-500 dark:text-stone-400">
                      {t('Dozen', 'ডজন')}
                    </span>
                  </div>

                  {/* Quick Dozen Increment Pills */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {[10, 25, 50, 100].map((increment) => (
                      <button
                        key={increment}
                        type="button"
                        onClick={() => setQuantityDozen((prev) => (Number(prev) || 0) + increment)}
                        className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-stone-800 dark:hover:bg-emerald-950/40 dark:text-stone-300 border border-stone-200 dark:border-stone-700 text-[10px] font-bold text-stone-600 transition cursor-pointer active:scale-95"
                      >
                        +{language === 'bn' ? toBanglaNumber(increment) : increment}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Wholesale Price Input (Mandatory with * and required) */}
              <div className="space-y-1.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-black text-stone-800 dark:text-stone-100">
                    {t('Wholesale Price *', 'পাইকারি দর *')}
                  </label>
                  <button
                    type="button"
                    onClick={handlePredictPrice}
                    disabled={isPredicting}
                    className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 text-[11px] font-bold underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isPredicting ? t('Checking...', 'যাচাই হচ্ছে...') : t('AI Price', 'এআই দর')}</span>
                  </button>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl text-emerald-700 dark:text-emerald-400">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={pricePerKg || ''}
                    onChange={(e) => setPricePerKg(Math.max(0, Number(e.target.value)))}
                    placeholder="৩৫"
                    className="w-full pl-9 pr-14 py-3 bg-stone-50 dark:bg-stone-800/80 border-2 border-stone-200 dark:border-stone-700 rounded-2xl font-black text-lg sm:text-xl font-mono text-emerald-800 dark:text-emerald-300 focus:outline-hidden focus:border-emerald-600 focus:bg-white dark:focus:bg-stone-800 transition"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-xs text-stone-500 dark:text-stone-400">
                    / {t('unit', 'কেজি')}
                  </span>
                </div>

                {/* Estimated Total Calculation */}
                {((Number(quantityKg) > 0) || (Number(quantityDozen) > 0)) && Number(pricePerKg) > 0 && (
                  <div className="pt-1">
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-between text-xs">
                      <span className="text-emerald-800 dark:text-emerald-300 font-bold">{t('Est. Payout:', 'মোট মূল্য:')}</span>
                      <span className="font-black text-emerald-950 dark:text-emerald-200 font-mono">
                        ৳{language === 'bn'
                          ? toBanglaNumber(((Number(quantityKg) || Number(quantityDozen) || 0) * Number(pricePerKg)).toLocaleString())
                          : ((Number(quantityKg) || Number(quantityDozen) || 0) * Number(pricePerKg)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* AI Prediction Hint Box */}
              {aiPrediction && (
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs space-y-1 animate-slide-down">
                  <div className="flex items-center justify-between font-bold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <span>{t('AI Market Recommended Wholesale:', 'এআই প্রস্তাবিত পাইকারি দর:')}</span>
                      {aiPrediction.isTcbSynced && (
                        <span className="text-[10px] bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-extrabold px-1.5 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-700">
                          {t('TCB Official', 'টিসিবি রেট')}
                        </span>
                      )}
                    </span>
                    <span className="font-black text-sm">৳{language === 'bn' ? toBanglaNumber(aiPrediction.expectedPriceRangeBDT.recommendedWholesale) : aiPrediction.expectedPriceRangeBDT.recommendedWholesale}/কেজি</span>
                  </div>
                  <p className="text-[11px] text-emerald-800/80">
                    {aiPrediction.buyerRecommendation || aiPrediction.keyMarketDrivers?.[0] || 'মহাস্থানগড় ও স্থানীয় আড়তের চাহিদার ভিত্তিতে প্রস্তাবিত দর।'}
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
                  onClick={handleCloseAddModal}
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
