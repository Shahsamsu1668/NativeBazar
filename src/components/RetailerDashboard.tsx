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
import {
  Store,
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
  TrendingUp,
  Trash2,
  Eye,
  BadgeCheck,
  Leaf,
  Layers,
} from 'lucide-react';

interface RetailerDashboardProps {
  currentUser: User;
  language: Language;
}

type RetailerTabId = 'procure_wholesale' | 'my_retail_shop' | 'consumer_orders';

export const RetailerDashboard: React.FC<RetailerDashboardProps> = ({
  currentUser,
  language,
}) => {
  const [activeTab, setActiveTab] = useState<RetailerTabId>('my_retail_shop');

  // Tab 1: Procure from Wholesalers (Wholesaler -> Retailer)
  const [wholesaleListings, setWholesaleListings] = useState<MarketplaceProduct[]>([]);
  const [wholesaleLoading, setWholesaleLoading] = useState(false);
  const [wholesaleSearch, setWholesaleSearch] = useState('');
  const [selectedWholesaleLot, setSelectedWholesaleLot] = useState<MarketplaceProduct | null>(null);
  const [orderKg, setOrderKg] = useState(100);
  const [submittingWholesaleOrder, setSubmittingWholesaleOrder] = useState(false);

  // Tab 2: My Retail Shop Products (Retailer -> Consumer)
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
    wholesalerArat: 'Mahasthangarh Wholesale Arat Hub',
    locationDetails: currentUser.address || `${currentUser.upazila || 'Bogura Sadar'} Retail Store`,
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
    description: 'Crisp, hand-picked table tomatoes directly sourced from Shibganj fields. Certified formalin-free and ready for home delivery.',
    safetyNote: '100% formalin-free tested. Harvested naturally without chemical ripening agents.',
  });

  // Tab 3: Consumer Orders (Retailer fulfills Consumer orders)
  const [consumerOrders, setConsumerOrders] = useState<SupplyChainOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // Load Wholesale lots (sellerRole=wholesaler & targetRole=retailer)
  const loadWholesaleListings = async () => {
    setWholesaleLoading(true);
    try {
      const res = await productApi.getProducts({
        sellerRole: 'wholesaler',
        targetRole: 'retailer',
        search: wholesaleSearch.trim() || undefined,
      });
      setWholesaleListings(res.products || []);
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

    if (orderKg < (selectedWholesaleLot.minOrderKg || 50)) {
      showToast(t(`Minimum wholesale order is ${selectedWholesaleLot.minOrderKg || 50} kg.`, `নূন্যতম পাইকারি অর্ডার ${selectedWholesaleLot.minOrderKg || 50} কেজি।`), 'error');
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
            `পাইকার থেকে স্টক ক্রয় সম্পন্ন হয়েছে! অর্ডার #${res.order.id}। স্টক সংরক্ষিত।`
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

    try {
      await productApi.createProduct({
        sellerId: currentUser?.id,
        sellerName: currentUser?.shopName || currentUser?.name || 'Retailer',
        sellerPhone: currentUser?.phone || '',
        sellerRole: 'retailer',
        targetRole: 'consumer',
        cropName: retailForm.cropName,
        banglaName: retailForm.banglaName,
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
        description: retailForm.description,
        traceability: {
          farmerOrigin: retailForm.farmerOrigin,
          wholesalerArat: retailForm.wholesalerArat,
          procurementDate: 'Freshly stocked today',
          safetyNote: retailForm.safetyNote,
        },
      });

      NotificationStore.addSystemNotif(
        currentUser.id,
        t('Retail Product Live on Social Feed!', 'খুচরা পণ্য সোশ্যাল ফিডে প্রকাশিত!'),
        t(
          `Published ${retailForm.cropName} at ৳${retailForm.pricePerKg}/kg. Consumers can now purchase via Guest Checkout.`,
          `${retailForm.cropName} ৳${retailForm.pricePerKg}/কেজি দরে ফিডে উন্মুক্ত করা হয়েছে। ভোক্তারা সরাসরি অর্ডার করতে পারবেন।`
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
      message: t('Remove this product from the Consumer Marketplace?', 'ভোক্তা মার্কেটপ্লেস থেকে এই পণ্যটি কি সরাতে চান?'),
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
      showToast(t(`Order ${orderId} status updated to ${status}.`, `অর্ডার ${orderId} স্ট্যাটাস ${status} এ হালনাগাদ করা হয়েছে।`), 'success');
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
              <span>{t('Strict Supply Chain: Wholesaler → Retailer → Consumer', 'নিয়ন্ত্রিত সরবরাহ শৃঙ্খলা: পাইকার → খুচরা → ভোক্তা')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentUser.shopName || currentUser.name}
            </h1>
            <p className="text-teal-100 text-xs sm:text-sm max-w-2xl">
              {t(
                'Procure wholesale lots from certified Wholesalers. Publish fresh, traceable retail products to the Consumer Social-Feed Marketplace with fast local van delivery.',
                'পাইকারদের কাছ থেকে পাইকারি লট সংগ্রহ করুন এবং সাধারণ ভোক্তাদের জন্য তাজা খুচরা কৃষিপণ্য সোশ্যাল ফিডে সরবরাহ করুন।'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAddRetailModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold px-4 py-2.5 rounded-xl text-xs shadow-md flex items-center gap-1.5 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('Publish Retail Product to Feed', 'ভোক্তা ফিডে নতুন পণ্য যোগ')}</span>
            </button>
            <button
              onClick={() => setActiveTab('procure_wholesale')}
              className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-2.5 rounded-xl text-xs backdrop-blur-xs border border-white/20 flex items-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4 text-emerald-300" />
              <span>{t('Procure from Wholesalers', 'পাইকার থেকে মাল ক্রয়')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Retail Stock in Store', 'দোকানের মোট মজুদ')}</span>
            <Package className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-stone-900">
            {language === 'bn' ? toBanglaNumber(totalRetailKg.toLocaleString()) : totalRetailKg.toLocaleString()}{' '}
            <span className="text-xs font-normal text-stone-500">{language === 'bn' ? 'কেজি' : 'kg'}</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">
            {language === 'bn' ? toBanglaNumber(myRetailProducts.length) : myRetailProducts.length} {t('Active items on Consumer Feed', 'টি পণ্য ফিডে লাইভ')}
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Consumer Orders', 'ভোক্তাদের অর্ডার')}</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-emerald-700">
            {language === 'bn' ? toBanglaNumber(consumerOrders.length) : consumerOrders.length}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Guest & Registered shoppers', 'গ্রাহকদের কাছ থেকে প্রাপ্ত অর্ডার')}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Retail Sales Revenue', 'মোট খুচরা বিক্রয়')}</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-blue-700">
            ৳{language === 'bn' ? toBanglaNumber(totalSalesVolume.toLocaleString()) : totalSalesVolume.toLocaleString()}
          </div>
          <p className="text-[11px] text-stone-500 mt-1">{t('Delivered & confirmed', 'সম্পন্ন খুচরা বিক্রয়')}</p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 text-[11px] font-bold uppercase">
            <span>{t('Wholesale Lots Available', 'পাইকারি লট সুযোগ')}</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-amber-700">
            {wholesaleListings.length} <span className="text-xs font-normal text-stone-500">lots</span>
          </div>
          <p className="text-[11px] text-stone-500 mt-1">From regional wholesalers</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('my_retail_shop')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'my_retail_shop'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>{t('My Retail Store Products (Sell to Consumers)', 'আমার খুচরা দোকান (ভোক্তাদের কাছে বিক্রয়)')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {myRetailProducts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('consumer_orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'consumer_orders'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>{t('Consumer Orders & Local Delivery', 'ভোক্তাদের অর্ডার ও হোম ডেলিভারি')}</span>
          {consumerOrders.length > 0 && (
            <span className="bg-emerald-700 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {consumerOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('procure_wholesale')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'procure_wholesale'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>{t('Procure from Wholesalers (Browse Stock)', 'পাইকারদের কাছ থেকে পাইকারি ক্রয়')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {wholesaleListings.length}
          </span>
        </button>
      </div>

      {/* ─── TAB 1: MY RETAIL STORE PRODUCTS (Sell to Consumers) ──────────────────── */}
      {activeTab === 'my_retail_shop' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
            <div>
              <h3 className="font-extrabold text-stone-900 text-sm">
                {t('Live Products on the Consumer Marketplace Feed', 'ভোক্তা সোশ্যাল মার্কেটপ্লেসে লাইভ পণ্য')}
              </h3>
              <p className="text-xs text-stone-500">
                {t(
                  'These products appear directly on the landing page for all shoppers with origin traceability and quality badges.',
                  'এই পণ্যগুলো সাধারণ ভোক্তাদের সোশ্যাল ফিডে ট্রেসেবিলিটি ও কোয়ালিটি ব্যাজসহ সরাসরি প্রদর্শিত হয়।'
                )}
              </p>
            </div>

            <button
              onClick={() => setShowAddRetailModal(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('Add Retail Product', 'নতুন খুচরা পণ্য')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myRetailProducts.map((prod) => (
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
                    <span className="bg-emerald-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Retail Feed Active
                    </span>
                    {prod.organicCertified && (
                      <span className="bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Bio-Organic
                      </span>
                    )}
                  </div>
                  <div className="absolute bottom-2 right-2 bg-white/95 px-3 py-1 rounded-xl shadow-md border border-stone-200 text-right">
                    <span className="text-base font-black text-stone-900">৳{prod.pricePerKg}</span>
                    <span className="text-[10px] text-stone-500">/kg retail</span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm">
                      {language === 'bn' ? prod.banglaName || prod.cropName : prod.cropName}
                    </h4>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      {prod.variety} • Grade {prod.qualityGrade || 'A'}
                    </p>

                    <div className="mt-2 text-stone-700 font-semibold flex items-center justify-between text-xs bg-stone-50 p-2 rounded-xl border border-stone-100">
                      <span>Available Consumer Stock:</span>
                      <strong className="text-emerald-700 font-black text-sm">
                        {prod.availableKg} kg
                      </strong>
                    </div>

                    <div className="mt-2 text-[10px] text-stone-500 space-y-0.5">
                      <div>
                        🌱 <strong>Origin:</strong> {prod.traceability?.farmerOrigin || prod.district}
                      </div>
                      <div>
                        🏢 <strong>Arat:</strong>{' '}
                        {prod.traceability?.wholesalerArat || 'Verified Regional Wholesale Hub'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified Retailer Listing</span>
                    </span>
                    <button
                      onClick={() => handleDeleteProduct(prod.id)}
                      className="text-stone-400 hover:text-red-500 p-1"
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

      {/* ─── TAB 2: CONSUMER ORDERS & LOCAL DELIVERY ──────────────────────────────── */}
      {activeTab === 'consumer_orders' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="font-extrabold text-stone-900 text-base">
                {t('Incoming Consumer Orders', 'ভোক্তাদের হোম ডেলিভারি অর্ডার')}
              </h3>
              <p className="text-xs text-stone-500">
                Orders placed through Guest Checkout on the Consumer Marketplace feed.
              </p>
            </div>
            <span className="badge-success text-xs">Retailer → Consumer</span>
          </div>

          {ordersLoading && (
            <div className="text-center py-10">
              <RefreshCw className="w-6 h-6 mx-auto text-emerald-600 animate-spin" />
            </div>
          )}

          {!ordersLoading && consumerOrders.length === 0 && (
            <div className="text-center py-12 text-stone-400 space-y-2">
              <ShoppingBag className="w-10 h-10 mx-auto text-stone-300" />
              <p className="text-xs font-semibold text-stone-600">No consumer orders placed yet</p>
              <p className="text-[11px] text-stone-400">
                When visitors checkout on the social feed, their orders appear here for packing and dispatch.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {consumerOrders.map((order) => (
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
                    Shopper: <strong className="text-stone-900">{order.buyerName}</strong> • Phone:{' '}
                    <strong className="text-stone-900">{order.buyerPhone}</strong>
                  </div>
                  <div className="text-[11px] text-stone-500">
                    Delivery Address: <strong className="text-stone-800">{order.deliveryAddress}</strong> •{' '}
                    Payment: <span className="font-bold text-emerald-700">{order.paymentMethod}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-stone-500 text-[11px] block">Payable Total</span>
                    <span className="font-black text-emerald-700 text-base">৳{order.totalBDT}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {((order.status || order.deliveryStatus) === 'Confirmed') && (
                      <button
                        onClick={() => handleUpdateConsumerOrderStatus(order.id, 'Dispatched')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Dispatch Van</span>
                      </button>
                    )}
                    {((order.status || order.deliveryStatus) === 'Dispatched') && (
                      <button
                        onClick={() => handleUpdateConsumerOrderStatus(order.id, 'Delivered')}
                        className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                      >
                        Confirm Delivered
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 3: PROCURE FROM WHOLESALERS ──────────────────────────────────────── */}
      {activeTab === 'procure_wholesale' && (
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
              className="bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-800"
            >
              Filter Lots
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wholesaleListings.map((lot) => (
              <div
                key={lot.id}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs flex flex-col justify-between"
              >
                <div className="relative aspect-16/10 bg-stone-100">
                  <img src={lot.imageUrl} alt={lot.cropName} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className="bg-blue-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Wholesale Arat Lot
                    </span>
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      Grade {lot.qualityGrade || 'A'}
                    </span>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-white/95 px-2.5 py-1 rounded-xl shadow-md border border-stone-200 text-right">
                    <span className="text-base font-black text-stone-900">৳{lot.pricePerKg}</span>
                    <span className="text-[10px] text-stone-500">/kg wholesale</span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3 text-xs">
                  <div>
                    <h4 className="font-extrabold text-stone-900 text-sm">{lot.cropName}</h4>
                    <p className="text-[11px] text-stone-500">
                      Wholesaler: <strong className="text-stone-800">{lot.sellerName}</strong>
                    </p>

                    <div className="mt-2 p-2 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Available:</span>
                        <strong className="text-blue-700 font-bold">{lot.availableKg} kg</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Min Purchase:</span>
                        <span className="text-stone-800">{lot.minOrderKg || 50} kg</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedWholesaleLot(lot);
                      setOrderKg(lot.minOrderKg || 50);
                    }}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-2.5 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Purchase for Shop</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── MODAL: PURCHASE WHOLESALE LOT FROM WHOLESALER ────────────────────────── */}
      {selectedWholesaleLot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h3 className="font-extrabold text-stone-900 text-base">Purchase Wholesale Batch</h3>
              <button
                onClick={() => setSelectedWholesaleLot(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePurchaseFromWholesaler} className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-1">
                <h4 className="font-extrabold text-stone-900">{selectedWholesaleLot.cropName}</h4>
                <p className="text-stone-500">Wholesaler: {selectedWholesaleLot.sellerName}</p>
                <div className="flex justify-between font-bold text-stone-900 pt-1">
                  <span>Wholesale Price:</span>
                  <span className="text-blue-700 text-sm">৳{selectedWholesaleLot.pricePerKg}/kg</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  Quantity (kg) • Min: {selectedWholesaleLot.minOrderKg || 50} kg
                </label>
                <input
                  type="number"
                  min={selectedWholesaleLot.minOrderKg || 50}
                  max={selectedWholesaleLot.availableKg}
                  value={orderKg}
                  onChange={(e) => setOrderKg(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                  required
                />
              </div>

              <div className="p-3 bg-teal-50 rounded-2xl border border-teal-200 flex justify-between items-center font-bold text-teal-900">
                <span>Total Amount:</span>
                <span className="text-lg font-black text-teal-800">
                  ৳{(orderKg * selectedWholesaleLot.pricePerKg).toLocaleString()}
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedWholesaleLot(null)}
                  className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingWholesaleOrder}
                  className="bg-teal-600 hover:bg-teal-700 disabled:bg-stone-400 text-white font-extrabold px-6 py-2 rounded-xl shadow-md"
                >
                  Confirm Order
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
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishRetailProduct} className="space-y-3.5 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Product Title</label>
                  <input
                    type="text"
                    value={retailForm.cropName}
                    onChange={(e) => setRetailForm((f) => ({ ...f, cropName: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Bangla Title</label>
                  <input
                    type="text"
                    value={retailForm.banglaName}
                    onChange={(e) => setRetailForm((f) => ({ ...f, banglaName: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Category</label>
                  <select
                    value={retailForm.category}
                    onChange={(e) => setRetailForm((f) => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-semibold"
                  >
                    <option value="Vegetables">Vegetables</option>
                    <option value="Tubers">Tubers</option>
                    <option value="Spices">Spices</option>
                    <option value="Grains">Grains</option>
                    <option value="Fruits">Fruits</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Retail Stock (kg)</label>
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
                    Consumer Retail Price (৳/kg) *
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
                  <label className="block font-bold text-stone-700 mb-1">DAM Benchmark (৳/kg)</label>
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
                  <label className="block font-bold text-stone-700 mb-1">Farmer Origin</label>
                  <input
                    type="text"
                    value={retailForm.farmerOrigin}
                    onChange={(e) =>
                      setRetailForm((f) => ({ ...f, farmerOrigin: e.target.value }))
                    }
                    placeholder="e.g. Shibganj Farm, Bogura"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Wholesale Sourcing Arat</label>
                  <input
                    type="text"
                    value={retailForm.wholesalerArat}
                    onChange={(e) =>
                      setRetailForm((f) => ({ ...f, wholesalerArat: e.target.value }))
                    }
                    placeholder="e.g. Mahasthangarh Arat"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">Product Description</label>
                <textarea
                  rows={2}
                  value={retailForm.description}
                  onChange={(e) => setRetailForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={retailForm.organicCertified}
                  onChange={(e) =>
                    setRetailForm((f) => ({ ...f, organicCertified: e.target.checked }))
                  }
                  className="w-4 h-4 text-emerald-600 rounded-sm"
                />
                <span>Certified Bio-Organic / Formalin-Free</span>
              </label>

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddRetailModal(false)}
                  className="px-4 py-2 font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPublishingProduct}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold px-6 py-2 rounded-xl shadow-md flex items-center gap-2"
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
