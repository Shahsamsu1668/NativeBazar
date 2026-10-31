import React, { useState, useEffect } from 'react';
import {
  Language,
  User,
  MarketplaceProduct,
  SupplyChainOrder,
  WholesalerOffer,
} from '../types';
import { productApi, orderApi, intelligenceApi } from '../services/api';
import { NotificationStore } from '../data/store';
import { toBanglaNumber } from './Header';
import {
  Building2,
  Package,
  Truck,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  Phone,
  ShieldCheck,
  Search,
  RefreshCw,
  ShoppingBag,
  DollarSign,
  ArrowRight,
  TrendingUp,
  Trash2,
  Filter,
} from 'lucide-react';

interface WholesalerDashboardProps {
  currentUser: User;
  language: Language;
}

type WholesalerTabId = 'procure_crops' | 'my_inventory' | 'retailer_orders' | 'post_tender';

export const WholesalerDashboard: React.FC<WholesalerDashboardProps> = ({
  currentUser,
  language,
}) => {
  const [activeTab, setActiveTab] = useState<WholesalerTabId>('procure_crops');

  // Tab 1: Browse Farmer Harvests (Procure from Farmers)
  const [farmerCrops, setFarmerCrops] = useState<MarketplaceProduct[]>([]);
  const [cropsLoading, setCropsLoading] = useState(false);
  const [cropSearch, setCropSearch] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('All');

  // Purchase Modal (Wholesaler buys from Farmer)
  const [selectedCropToBuy, setSelectedCropToBuy] = useState<MarketplaceProduct | null>(null);
  const [purchaseQtyKg, setPurchaseQtyKg] = useState(100);
  const [deliveryHub, setDeliveryHub] = useState(
    currentUser.upazila ? `${currentUser.upazila}, ${currentUser.district} Arat Hub` : 'Mahasthangarh Mokam Hub'
  );
  const [submittingPurchase, setSubmittingPurchase] = useState(false);

  // Tab 2: My Wholesale Stock & Listings for Retailers
  const [myWholesaleListings, setMyWholesaleListings] = useState<MarketplaceProduct[]>([]);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [showAddBatchModal, setShowAddBatchModal] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({
    cropName: 'Diamond Potato',
    banglaName: 'ডায়মন্ড আলু (পাইকারি)',
    category: 'Tubers',
    variety: 'Table Grade A',
    quantityKg: 2000,
    minOrderKg: 100,
    pricePerKg: 32,
    qualityGrade: 'A' as 'A' | 'B' | 'C',
    farmerOrigin: 'Shibganj Farmer Cooperatives, Bogura',
    imageUrl: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
    description: 'Bulk wholesale lot procured directly from verified Bogura farm gates.',
  });

  // Tab 3: Orders received from Retailers
  const [retailerOrders, setRetailerOrders] = useState<SupplyChainOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [tenderForm, setTenderForm] = useState({
    cropName: 'Hybrid Tomatoes',
    cropBangla: 'হাইব্রিড পাকা টমেটো',
    quantityKgNeeded: 3000,
    offeredPricePerKg: 39,
    district: currentUser?.district || 'Bogura',
    upazila: currentUser?.upazila || 'Shibganj',
    location: 'Mahasthangarh Highway Delivery Point',
    deadline: 'Within 7 days',
    urgent: true,
    notes: 'Grade A firm table tomatoes. Immediate payment upon crate weighing.',
  });
  const [submittingTender, setSubmittingTender] = useState(false);
  const [isPublishingBatch, setIsPublishingBatch] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // Load Farmer Harvests (Strictly sellerRole=farmer & targetRole=wholesaler)
  const loadFarmerCrops = async () => {
    setCropsLoading(true);
    try {
      const res = await productApi.getProducts({
        sellerRole: 'farmer',
        targetRole: 'wholesaler',
        district: selectedDistrict !== 'All' ? selectedDistrict : undefined,
        search: cropSearch.trim() || undefined,
      });
      setFarmerCrops(res.products || []);
    } catch (e) {
      console.error('Failed to load farmer harvests', e);
    } finally {
      setCropsLoading(false);
    }
  };

  // Load Wholesaler's Own Listings (sellerRole=wholesaler & targetRole=retailer)
  const loadMyListings = async () => {
    setMyListingsLoading(true);
    try {
      const res = await productApi.getProducts({
        sellerId: currentUser.id,
        sellerRole: 'wholesaler',
        targetRole: 'retailer',
      });
      const mine = (res.products || []).filter(
        (p) => p.sellerId === currentUser.id || p.sellerName === currentUser.name
      );
      setMyWholesaleListings(mine);
    } catch (e) {
      console.error('Failed to load wholesaler listings', e);
      setMyWholesaleListings([]);
    } finally {
      setMyListingsLoading(false);
    }
  };

  // Load Orders from Retailers
  const loadRetailerOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await orderApi.getOrders({
        sellerId: currentUser.id,
        role: 'wholesaler',
      });
      setRetailerOrders(res.orders || []);
    } catch (e) {
      console.error('Failed to load retailer orders', e);
    } finally {
      setOrdersLoading(false);
    }
  };

  useEffect(() => {
    loadFarmerCrops();
    loadMyListings();
    loadRetailerOrders();
  }, [currentUser.id, selectedDistrict]);

  // Execute Wholesale Purchase from Farmer (Farmer -> Wholesaler)
  const handleExecuteFarmerPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCropToBuy) return;

    if (purchaseQtyKg > selectedCropToBuy.availableKg) {
      showToast(t('Quantity exceeds available farm stock.', 'চাহিদার পরিমাণ মজুদ ফসলের চেয়ে বেশি।'), 'error');
      return;
    }

    setSubmittingPurchase(true);
    try {
      const res = await orderApi.createOrder({
        buyerId: currentUser?.id || 'usr-wholesaler',
        buyerName: currentUser?.businessName || currentUser?.name || 'Wholesaler Arat',
        buyerPhone: currentUser?.phone || '01711000000',
        buyerEmail: currentUser?.email,
        buyerRole: 'wholesaler',
        sellerId: selectedCropToBuy.sellerId,
        sellerName: selectedCropToBuy.sellerName,
        sellerPhone: selectedCropToBuy.sellerPhone,
        sellerRole: 'farmer',
        items: [
          {
            productId: selectedCropToBuy.id,
            quantityKg: purchaseQtyKg,
          },
        ],
        paymentMethod: 'Bank Transfer / Arat Escrow',
        deliveryAddress: deliveryHub,
        district: selectedCropToBuy.district,
        notes: `Wholesale procurement contract by ${currentUser?.businessName || currentUser?.name || 'Wholesaler'}. Pick-up at farm gate.`,
      });

      if (res.success) {
        showToast(
          t(
            `Wholesale Purchase Order placed successfully! Order #${res.order.id}. Stock reserved from Farmer.`,
            `পাইকারি ক্রয়াদেশ সফলভাবে সম্পন্ন হয়েছে! অর্ডার #${res.order.id}। কৃষকের মজুদ থেকে সংরক্ষিত।`
          ),
          'success'
        );
        setSelectedCropToBuy(null);
        loadFarmerCrops();
        loadMyListings();
      }
    } catch (err: any) {
      showToast(err.message || 'Purchase failed', 'error');
    } finally {
      setSubmittingPurchase(false);
    }
  };

  // Publish Wholesale Batch for Retailers (Wholesaler -> Retailer)
  const handlePublishWholesaleBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPublishingBatch) return;
    setIsPublishingBatch(true);
    try {
      await productApi.createProduct({
        sellerId: currentUser?.id || 'usr-wholesaler',
        sellerName: currentUser?.businessName || currentUser?.name || 'Wholesaler Arat',
        sellerPhone: currentUser?.phone || '01711000000',
        sellerRole: 'wholesaler',
        targetRole: 'retailer',
        cropName: newBatchForm.cropName,
        banglaName: newBatchForm.banglaName,
        category: newBatchForm.category,
        variety: newBatchForm.variety,
        quantityKg: newBatchForm.quantityKg,
        availableKg: newBatchForm.quantityKg,
        minOrderKg: newBatchForm.minOrderKg,
        pricePerKg: newBatchForm.pricePerKg,
        qualityGrade: newBatchForm.qualityGrade,
        district: currentUser?.district || 'Bogura',
        upazila: currentUser?.upazila || 'Shibganj',
        locationDetails: `${currentUser?.businessName || currentUser?.name || 'Wholesale'} Arat Depot`,
        harvestStatus: 'Cold-chain stored / Fresh Lot',
        availableDate: 'Ready for Retailer Dispatch',
        organicCertified: false,
        imageUrl: newBatchForm.imageUrl,
        description: newBatchForm.description,
        traceability: {
          farmerOrigin: newBatchForm.farmerOrigin,
          wholesalerArat: currentUser?.businessName || currentUser?.name || 'Wholesaler Arat',
          procurementDate: 'Procured from verified farmer',
          safetyNote: 'Sorted and crate-packed for retail shops.',
        },
      });

      NotificationStore.addSystemNotif(
        currentUser?.id || 'usr-wholesaler',
        t('Wholesale Batch Published', 'পাইকারি লট প্রকাশিত'),
        t(
          `Published ${newBatchForm.quantityKg}kg of ${newBatchForm.cropName} for retailers at ৳${newBatchForm.pricePerKg}/kg.`,
          `খুচরা বিক্রেতাদের জন্য ৳${newBatchForm.pricePerKg}/কেজি দরে পাইকারি লট প্রকাশ করা হয়েছে।`
        ),
        'success'
      );

      showToast(t('Wholesale batch published for retailers!', 'খুচরা বিক্রেতাদের জন্য পাইকারি লট সফলভাবে প্রকাশিত হয়েছে!'), 'success');
      setShowAddBatchModal(false);
      loadMyListings();
    } catch (err: any) {
      showToast(err.message || 'Failed to create wholesale batch', 'error');
    } finally {
      setIsPublishingBatch(false);
    }
  };

  // Post Procurement Tender for Farmers (Farmer Intelligence)
  const handlePostTender = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingTender(true);
    try {
      await intelligenceApi.createWholesalerOffer({
        wholesalerId: currentUser?.id || 'usr-wholesaler',
        wholesalerName: currentUser?.name || 'Wholesaler',
        wholesalerPhone: currentUser?.phone || '01711000000',
        businessName: currentUser?.businessName || currentUser?.name || 'Wholesaler Arat',
        cropName: tenderForm.cropName,
        cropBangla: tenderForm.cropBangla,
        quantityKgNeeded: tenderForm.quantityKgNeeded,
        fulfilledKg: 0,
        offeredPricePerKg: tenderForm.offeredPricePerKg,
        district: tenderForm.district,
        upazila: tenderForm.upazila,
        location: tenderForm.location,
        deadline: tenderForm.deadline,
        urgent: tenderForm.urgent,
        notes: tenderForm.notes,
      });

      showToast(
        t(
          'Procurement Tender published to Farmers successfully! It will now appear on all Farmers’ Intelligence screens.',
          'কৃষকদের জন্য শস্য ক্রয়ের দরপত্র সফলভাবে প্রকাশিত হয়েছে! এটি কৃষকদের ড্যাশবোর্ডে প্রদর্শিত হবে।'
        ),
        'success'
      );

      setActiveTab('procure_crops');
    } catch (err: any) {
      showToast(err.message || 'Failed to publish tender', 'error');
    } finally {
      setSubmittingTender(false);
    }
  };

  // Update Retailer Order Status
  const handleUpdateRetailerOrderStatus = async (
    orderId: string,
    status: 'Confirmed' | 'Processing' | 'Dispatched' | 'Delivered'
  ) => {
    try {
      await orderApi.updateStatus(orderId, status, currentUser?.name || 'Wholesaler', 'wholesaler');
      showToast(t(`Order status updated to ${status}!`, `অর্ডার স্ট্যাটাস ${status}-এ পরিবর্তিত হয়েছে!`), 'success');
      loadRetailerOrders();
    } catch (e: any) {
      showToast(e.message || 'Failed to update order status', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-blue-700/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-blue-800/60 border border-blue-400/40 px-3 py-1 rounded-full text-xs font-semibold text-blue-200">
              <Building2 className="w-3.5 h-3.5 text-blue-300" />
              <span>{t('Strict Supply Chain: Farmer → Wholesaler → Retailer', 'নিয়ন্ত্রিত সরবরাহ শৃঙ্খলা: কৃষক → পাইকার → খুচরা')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentUser.name || currentUser.businessName}
            </h1>
            {currentUser.businessName && !/^\+?[\d\s-]{7,15}$/.test(currentUser.businessName.trim()) && currentUser.businessName !== currentUser.name && (
              <p className="text-blue-300 font-semibold text-xs sm:text-sm">
                {currentUser.businessName}
              </p>
            )}
            <p className="text-blue-100 text-xs sm:text-sm max-w-2xl">
              {t(
                'Procure agricultural crops in bulk directly from verified farmers at wholesale rates. Sell wholesale lots to registered retailers with certified origin traceability.',
                'সরাসরি কৃষকদের কাছ থেকে পাইকারি দরে শস্য সংগ্রহ করুন এবং নিবন্ধিত খুচরা বিক্রেতাদের কাছে পাইকারি লটে সরবরাহ করুন।'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setActiveTab('post_tender')}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('Post Procurement Tender', 'কৃষকদের জন্য শস্য চাহিদা পোস্ট')}</span>
            </button>
            <button
              onClick={() => setShowAddBatchModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs backdrop-blur-xs border border-white/20 flex items-center gap-1.5"
            >
              <Package className="w-4 h-4 text-blue-300" />
              <span>{t('List Wholesale Batch', 'খুচরা বিক্রেতার জন্য লট তৈরি')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Available Farm Harvests', 'উপলব্ধ ফসলের লট')}</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-stone-900">
            {farmerCrops.length} <span className="text-xs font-normal text-stone-500">lots</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">Direct from verified farmers</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('My Wholesale Stock', 'মজুদ পাইকারি স্টক')}</span>
            <Package className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-blue-700">
            {language === 'bn'
              ? toBanglaNumber(myWholesaleListings.reduce((s, p) => s + (p.availableKg || 0), 0).toLocaleString())
              : myWholesaleListings.reduce((s, p) => s + (p.availableKg || 0), 0).toLocaleString()}{' '}
            <span className="text-xs font-normal text-stone-500">{language === 'bn' ? 'কেজি' : 'kg'}</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Listed for Retailer purchase', 'খুচরা বিক্রেতাদের ক্রয়ের জন্য প্রস্তুত')}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Retailer Orders', 'খুচরা ব্যবসায়ীদের অর্ডার')}</span>
            <Truck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-700">
            {language === 'bn' ? toBanglaNumber(retailerOrders.length) : retailerOrders.length}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Orders from retail shops', 'খুচরা দোকান থেকে প্রাপ্ত অর্ডার')}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Wholesale Revenue', 'মোট পাইকারি বিক্রয়')}</span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-stone-900">
            ৳
            {language === 'bn'
              ? toBanglaNumber(retailerOrders.reduce((s, o) => s + (o.totalBDT || 0), 0).toLocaleString())
              : retailerOrders.reduce((s, o) => s + (o.totalBDT || 0), 0).toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Processed order volume', 'সম্পন্ন লেনদেনের মোট পরিমাণ')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('procure_crops')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'procure_crops'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>{t('Procure from Farmers (Browse Harvests)', 'কৃষকদের কাছ থেকে পাইকারি ক্রয়')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {farmerCrops.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('my_inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'my_inventory'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>{t('My Wholesale Listings (Sell to Retailers)', 'খুচরা বিক্রেতাদের জন্য পাইকারি লট')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {myWholesaleListings.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('retailer_orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'retailer_orders'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>{t('Retailer Orders & Dispatch', 'খুচরা বিক্রেতাদের অর্ডার')}</span>
          {retailerOrders.length > 0 && (
            <span className="bg-blue-700 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {retailerOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('post_tender')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'post_tender'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>{t('Post Procurement Tender for Farmers', 'কৃষকদের জন্য শস্য ক্রয়ের দরপত্র')}</span>
        </button>
      </div>

      {/* ─── TAB 1: PROCURE CROPS FROM FARMERS ─────────────────────────────────────── */}
      {activeTab === 'procure_crops' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={cropSearch}
                onChange={(e) => setCropSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadFarmerCrops()}
                placeholder={t('Search potato, tomato, green chili from farmers...', 'কৃষকের আলু, টমেটো, মরিচ ইত্যাদি খুঁজুন...')}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-stone-600 shrink-0">District:</span>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800"
              >
                <option value="All">All Districts</option>
                <option value="Bogura">Bogura</option>
                <option value="Dhaka">Dhaka</option>
                <option value="Rajshahi">Rajshahi</option>
                <option value="Rangpur">Rangpur</option>
              </select>
              <button
                onClick={loadFarmerCrops}
                className="bg-stone-900 text-white px-3 py-2 rounded-xl text-xs font-bold shrink-0 hover:bg-stone-800"
              >
                Filter
              </button>
            </div>
          </div>

          {cropsLoading && (
            <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
              <RefreshCw className="w-6 h-6 mx-auto text-blue-600 animate-spin" />
              <p className="text-xs text-stone-500 mt-2">Loading farmer crops...</p>
            </div>
          )}

          {!cropsLoading && farmerCrops.length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8 space-y-2">
              <Package className="w-10 h-10 text-stone-300 mx-auto" />
              <h4 className="font-bold text-stone-800 text-sm">No farmer crops currently listed</h4>
              <p className="text-xs text-stone-500">
                You can post a Procurement Tender to attract farmers with the exact crops you need.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {farmerCrops.map((crop) => (
              <div
                key={crop.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="relative aspect-16/10 bg-stone-100">
                  <img
                    src={crop.imageUrl}
                    alt={crop.cropName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Farmer Gate Harvest
                    </span>
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Grade {crop.qualityGrade || 'A'}
                    </span>
                  </div>
                  <div
                    data-price-badge
                    className="product-price-badge absolute bottom-2 right-2 bg-white/95 dark:bg-stone-900/90 backdrop-blur-md px-3 py-1 rounded-xl shadow-md border border-stone-200 dark:border-stone-700 text-right"
                  >
                    <span className="price-amount text-base font-black text-stone-900 dark:text-white">৳{crop.pricePerKg}</span>
                    <span className="price-unit text-[10px] text-stone-500 dark:text-stone-300 block">/kg wholesale</span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm">
                      {language === 'bn' ? crop.banglaName || crop.cropName : crop.cropName}
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {crop.variety || 'Deshi Hybrid'} • {crop.locationDetails || crop.district}
                    </p>

                    <div className="mt-2.5 p-2.5 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Farmer:</span>
                        <strong className="text-stone-800">{crop.sellerName}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Available Bulk:</span>
                        <strong className="text-emerald-700 font-bold">{crop.availableKg} kg</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Min Order:</span>
                        <span className="text-stone-700">{crop.minOrderKg || 50} kg</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCropToBuy(crop);
                      setPurchaseQtyKg(Math.min(200, crop.availableKg));
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{t('Buy Wholesale Lot', 'পাইকারি লট ক্রয় করুন')}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 2: MY WHOLESALE LISTINGS FOR RETAILERS ────────────────────────────── */}
      {activeTab === 'my_inventory' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
            <div>
              <h3 className="font-extrabold text-stone-900 text-sm">
                {t('Wholesale Inventory for Retailers', 'খুচরা বিক্রেতাদের জন্য প্রস্তুত পাইকারি স্টক')}
              </h3>
              <p className="text-xs text-stone-500">
                {t(
                  'Only registered Retailers can view and purchase these wholesale batches.',
                  'শুধুমাত্র নিবন্ধিত খুচরা বিক্রেতারা এই পাইকারি স্টক থেকে অর্ডার করতে পারেন।'
                )}
              </p>
            </div>

            <button
              onClick={() => setShowAddBatchModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('Add New Wholesale Batch', 'নতুন পাইকারি ব্যাচ')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myWholesaleListings.map((batch) => (
              <div
                key={batch.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs flex flex-col justify-between"
              >
                <div className="relative aspect-16/10 bg-stone-100">
                  <img
                    src={batch.imageUrl}
                    alt={batch.cropName}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="bg-blue-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Wholesale Batch
                    </span>
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Grade {batch.qualityGrade || 'A'}
                    </span>
                  </div>
                  <div
                    data-price-badge
                    className="product-price-badge absolute bottom-2 right-2 bg-white/95 dark:bg-stone-900/90 backdrop-blur-md px-2.5 py-1 rounded-xl shadow-md border border-stone-200 dark:border-stone-700 text-right"
                  >
                    <span className="price-amount text-base font-black text-stone-900 dark:text-white">৳{batch.pricePerKg}</span>
                    <span className="price-unit text-[10px] text-stone-500 dark:text-stone-300 block">/kg to Retailers</span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm">
                      {language === 'bn' ? batch.banglaName || batch.cropName : batch.cropName}
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {batch.variety} • Min Order: {batch.minOrderKg || 100} kg
                    </p>

                    <div className="mt-2 text-stone-700 font-semibold flex items-center justify-between text-xs bg-stone-50 p-2 rounded-xl border border-stone-100">
                      <span>Available Stock:</span>
                      <strong className="text-blue-700 font-black text-sm">
                        {batch.availableKg} kg
                      </strong>
                    </div>

                    <div className="mt-1 text-[10px] text-stone-500">
                      🌱 <strong>Farmer Origin:</strong>{' '}
                      {batch.traceability?.farmerOrigin || 'Bogura Regional Farms'}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-[10px] text-stone-400">Target: Retailer Shops</span>
                    <button
                      onClick={() => {
                        setConfirmDialog({
                          message: t('Are you sure you want to delete this wholesale batch?', 'আপনি কি এই পাইকারি লটটি ডিলিট করতে চান?'),
                          onConfirm: async () => {
                            try {
                              await productApi.deleteProduct(batch.id);
                              showToast(t('Wholesale listing deleted', 'পাইকারি লট ডিলিট করা হয়েছে'), 'success');
                              loadMyListings();
                            } catch (e: any) {
                              showToast(e.message || 'Failed to delete listing', 'error');
                            }
                          },
                        });
                      }}
                      className="text-stone-400 hover:text-red-500 p-1 transition-colors"
                      title={t('Delete Listing', 'লট ডিলিট করুন')}
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

      {/* ─── TAB 3: RETAILER ORDERS ──────────────────────────────────────────────── */}
      {activeTab === 'retailer_orders' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="font-extrabold text-stone-900 text-base">
                {t('Orders Received from Retailers', 'খুচরা বিক্রেতাদের প্রাপ্ত অর্ডার')}
              </h3>
              <p className="text-xs text-stone-500">
                Retail shops purchasing your wholesale inventory lots.
              </p>
            </div>
            <span className="badge-purple text-xs">Wholesaler → Retailer</span>
          </div>

          {ordersLoading && (
            <div className="text-center py-10">
              <RefreshCw className="w-6 h-6 mx-auto text-blue-600 animate-spin" />
            </div>
          )}

          {!ordersLoading && retailerOrders.length === 0 && (
            <div className="text-center py-12 text-stone-400 space-y-2">
              <Truck className="w-10 h-10 mx-auto text-stone-300" />
              <p className="text-xs font-semibold text-stone-600">No retailer orders received yet</p>
              <p className="text-[11px] text-stone-400">
                When retail grocery stores order wholesale stock, they appear here.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {retailerOrders.map((order) => (
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
                    Retail Shop: <strong className="text-stone-900">{order.buyerName}</strong> (
                    {order.buyerPhone})
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Delivery Address: {order.deliveryAddress} • Payment: {order.paymentMethod}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-stone-500 text-[11px] block">Order Amount</span>
                    <span className="font-black text-blue-700 text-base">৳{order.totalBDT}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {((order.status || order.deliveryStatus) === 'Confirmed') && (
                      <button
                        onClick={() => handleUpdateRetailerOrderStatus(order.id, 'Dispatched')}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                      >
                        {t('Mark Dispatched', 'মাল পাঠান')}
                      </button>
                    )}
                    {((order.status || order.deliveryStatus) === 'Dispatched') && (
                      <button
                        onClick={() => handleUpdateRetailerOrderStatus(order.id, 'Delivered')}
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

      {/* ─── TAB 4: POST PROCUREMENT TENDER FOR FARMERS ─────────────────────────── */}
      {activeTab === 'post_tender' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-7 shadow-xs max-w-2xl mx-auto space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h3 className="font-extrabold text-stone-900 text-base">
              {t('Post Crop Procurement Tender for Farmers', 'কৃষকদের জন্য শস্য ক্রয়ের উন্মুক্ত দরপত্র')}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              {t(
                'This tender will appear directly on local farmers’ dashboards under Verified Wholesaler Bids.',
                'এই উন্মুক্ত দরপত্রটি স্থানীয় কৃষকদের ড্যাশবোর্ডে যাচাইকৃত পাইকারি চাহিদার তালিকায় সরাসরি প্রদর্শিত হবে।'
              )}
            </p>
          </div>

          <form onSubmit={handlePostTender} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Crop Needed (English)', 'প্রয়োজনীয় শস্য (ইংরেজি)')}
                </label>
                <input
                  type="text"
                  value={tenderForm.cropName}
                  onChange={(e) => setTenderForm((f) => ({ ...f, cropName: e.target.value }))}
                  placeholder={t('e.g. Hybrid Tomatoes', 'যেমন: Hybrid Tomatoes')}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Crop Needed (Bangla)', 'প্রয়োজনীয় শস্য (বাংলা)')}
                </label>
                <input
                  type="text"
                  value={tenderForm.cropBangla}
                  onChange={(e) => setTenderForm((f) => ({ ...f, cropBangla: e.target.value }))}
                  placeholder={t('e.g. হাইব্রিড টমেটো', 'যেমন: হাইব্রিড টমেটো')}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Target Quantity Needed (kg)', 'প্রয়োজনীয় মোট পরিমাণ (কেজি)')}
                </label>
                <input
                  type="number"
                  value={tenderForm.quantityKgNeeded}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, quantityKgNeeded: Number(e.target.value) }))
                  }
                  placeholder={t('e.g. 3000', 'যেমন: ৩০০০')}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Offered Price to Farmer (৳/kg)', 'কৃষকদের জন্য প্রস্তাবিত দর (৳/কেজি)')}
                </label>
                <input
                  type="number"
                  value={tenderForm.offeredPricePerKg}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, offeredPricePerKg: Number(e.target.value) }))
                  }
                  placeholder={t('e.g. 40', 'যেমন: ৪০')}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-black text-emerald-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Procurement District', 'সংগ্রহের জেলা')}
                </label>
                <select
                  value={tenderForm.district}
                  onChange={(e) => setTenderForm((f) => ({ ...f, district: e.target.value }))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                >
                  <option value="Bogura">{t('Bogura', 'বগুড়া')}</option>
                  <option value="Rajshahi">{t('Rajshahi', 'রাজশাহী')}</option>
                  <option value="Rangpur">{t('Rangpur', 'রংপুর')}</option>
                  <option value="Dinajpur">{t('Dinajpur', 'দিনাজপুর')}</option>
                  <option value="Dhaka">{t('Dhaka', 'ঢাকা')}</option>
                  <option value="Jashore">{t('Jashore', 'যশোর')}</option>
                  <option value="Chattogram">{t('Chattogram', 'চট্টগ্রাম')}</option>
                  <option value="Mymensingh">{t('Mymensingh', 'ময়মনসিংহ')}</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Procurement Deadline', 'দরপত্রের সময়সীমা')}
                </label>
                <input
                  type="text"
                  value={tenderForm.deadline}
                  onChange={(e) => setTenderForm((f) => ({ ...f, deadline: e.target.value }))}
                  placeholder={t('e.g. Within 7 days', 'যেমন: ৭ দিনের মধ্যে')}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">
                {t('Pick-up Location / Delivery Point', 'পণ্য সংগ্রহের স্থান / ডেলিভারি পয়েন্ট')}
              </label>
              <input
                type="text"
                value={tenderForm.location}
                onChange={(e) => setTenderForm((f) => ({ ...f, location: e.target.value }))}
                placeholder={t('e.g. Shibganj Wholesale Arat, Bogura', 'যেমন: শিবগঞ্জ পাইকারি আড়ত, বগুড়া')}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">
                {t('Notes / Terms', 'শর্তাবলী বা বিশেষ মন্তব্য')}
              </label>
              <textarea
                rows={2}
                value={tenderForm.notes}
                onChange={(e) => setTenderForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t('e.g. Spot cash payment upon weighing and quality verification.', 'যেমন: ওজন ও মান যাচাই শেষে সাথে সাথে নগদ পরিশোধ।')}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1 font-semibold text-stone-700">
              <input
                type="checkbox"
                checked={tenderForm.urgent}
                onChange={(e) => setTenderForm((f) => ({ ...f, urgent: e.target.checked }))}
                className="w-4 h-4 text-amber-600 rounded-sm"
              />
              <span>{t('Mark as Urgent Tender (Requires Fast Dispatch)', 'জরুরি উন্মুক্ত দরপত্র (দ্রুত সংগ্রহ প্রয়োজন)')}</span>
            </label>

            <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setActiveTab('procure_crops')}
                className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                {t('Cancel', 'বাতিল')}
              </button>
              <button
                type="submit"
                disabled={submittingTender}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-stone-400 text-white font-extrabold px-6 py-2 rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer"
              >
                {submittingTender ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t('Publishing Tender...', 'দরপত্র প্রকাশ করা হচ্ছে...')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('Publish Tender to Farmers', 'কৃষকদের জন্য উন্মুক্ত দরপত্র প্রকাশ করুন')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── MODAL: WHOLESALE PURCHASE FROM FARMER ───────────────────────────────── */}
      {selectedCropToBuy && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-stone-900 text-base">
                  {t('Procure from Farmer', 'কৃষকের কাছ থেকে ক্রয়')}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCropToBuy(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteFarmerPurchase} className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <h4 className="font-extrabold text-stone-900 text-sm">
                  {selectedCropToBuy.cropName} ({selectedCropToBuy.banglaName})
                </h4>
                <p className="text-stone-500">
                  Seller: <strong>{selectedCropToBuy.sellerName}</strong> • {selectedCropToBuy.district}
                </p>
                <div className="flex justify-between font-bold text-stone-800 pt-1">
                  <span>Farm Gate Price:</span>
                  <span className="text-emerald-700 text-sm">৳{selectedCropToBuy.pricePerKg}/kg</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Available Batch:</span>
                  <span>{selectedCropToBuy.availableKg} kg</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Quantity to Purchase (kg) *
                </label>
                <input
                  type="number"
                  min={selectedCropToBuy.minOrderKg || 50}
                  max={selectedCropToBuy.availableKg}
                  value={purchaseQtyKg}
                  onChange={(e) => setPurchaseQtyKg(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-black text-stone-900 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Wholesaler Receiving Hub / Arat Address *
                </label>
                <input
                  type="text"
                  value={deliveryHub}
                  onChange={(e) => setDeliveryHub(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-medium"
                  required
                />
              </div>

              <div className="p-3.5 bg-blue-50 rounded-2xl border border-blue-200 flex justify-between items-center font-bold text-blue-900">
                <span>Total Wholesale Amount:</span>
                <span className="text-lg font-black text-blue-700">
                  ৳{(purchaseQtyKg * selectedCropToBuy.pricePerKg).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedCropToBuy(null)}
                  className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPurchase}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-stone-400 text-white font-extrabold px-6 py-2 rounded-xl shadow-md flex items-center gap-2"
                >
                  {submittingPurchase ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Reserving Stock...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Wholesale Order</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: CREATE WHOLESALE BATCH FOR RETAILERS ─────────────────────────── */}
      {showAddBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-extrabold text-stone-900 text-base">
                {t('Publish Wholesale Batch for Retailers', 'খুচরা বিক্রেতাদের জন্য লট তৈরি')}
              </h3>
              <button
                onClick={() => setShowAddBatchModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishWholesaleBatch} className="space-y-3.5 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Crop Name</label>
                  <input
                    type="text"
                    value={newBatchForm.cropName}
                    onChange={(e) =>
                      setNewBatchForm((f) => ({ ...f, cropName: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Bangla Name</label>
                  <input
                    type="text"
                    value={newBatchForm.banglaName}
                    onChange={(e) =>
                      setNewBatchForm((f) => ({ ...f, banglaName: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Stock Quantity (kg)</label>
                  <input
                    type="number"
                    value={newBatchForm.quantityKg}
                    onChange={(e) =>
                      setNewBatchForm((f) => ({ ...f, quantityKg: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    Wholesale Price to Retailers (৳/kg)
                  </label>
                  <input
                    type="number"
                    value={newBatchForm.pricePerKg}
                    onChange={(e) =>
                      setNewBatchForm((f) => ({ ...f, pricePerKg: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-black text-blue-700 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Min Order (kg)</label>
                  <input
                    type="number"
                    value={newBatchForm.minOrderKg}
                    onChange={(e) =>
                      setNewBatchForm((f) => ({ ...f, minOrderKg: Number(e.target.value) }))
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Quality Grade</label>
                  <select
                    value={newBatchForm.qualityGrade}
                    onChange={(e) =>
                      setNewBatchForm((f) => ({ ...f, qualityGrade: e.target.value as any }))
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-semibold"
                  >
                    <option value="A">Grade A (Premium)</option>
                    <option value="B">Grade B (Standard)</option>
                    <option value="C">Grade C (Mixed)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Farmer Origin</label>
                <input
                  type="text"
                  value={newBatchForm.farmerOrigin}
                  onChange={(e) =>
                    setNewBatchForm((f) => ({ ...f, farmerOrigin: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddBatchModal(false)}
                  className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPublishingBatch}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold px-6 py-2 rounded-xl shadow-md flex items-center gap-2"
                >
                  {isPublishingBatch ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{t('Publishing...', 'প্রকাশিত হচ্ছে...')}</span>
                    </>
                  ) : (
                    <span>{t('Publish Batch', 'লট প্রকাশ করুন')}</span>
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
            ? 'bg-blue-950/90 border-blue-500/50 text-blue-100 shadow-blue-950/30'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-100 shadow-rose-950/30'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0" />
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
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors text-sm"
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
