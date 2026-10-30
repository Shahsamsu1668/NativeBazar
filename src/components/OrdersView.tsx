import React, { useState, useEffect } from 'react';
import {
  SupplyChainOrder,
  Language,
  User,
} from '../types';
import { orderApi } from '../services/api';
import { toBanglaNumber } from './Header';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  MapPin,
  Store,
  Sprout,
  Briefcase,
  DollarSign,
  RefreshCw,
  ShoppingBag,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface OrdersViewProps {
  currentUser: User | null;
  language: Language;
}

type OrderTabId = 'wholesaler_to_retailer' | 'retailer_to_consumer' | 'farmer_to_wholesaler' | 'consumer_purchases';

export const OrdersView: React.FC<OrdersViewProps> = ({ currentUser, language }) => {
  const isRetailer = currentUser?.role === 'retailer';
  const isConsumer = currentUser?.role === 'consumer';

  // Set default tab based on user role
  const [activeTab, setActiveTab] = useState<OrderTabId>(() => {
    if (isConsumer) return 'consumer_purchases';
    if (isRetailer) return 'wholesaler_to_retailer';
    return 'farmer_to_wholesaler';
  });

  const [orders, setOrders] = useState<SupplyChainOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);
  const formatNum = (val: number | string | null | undefined): string => {
    if (val === null || val === undefined) return '';
    return language === 'bn' ? toBanglaNumber(val) : String(val);
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getOrders(
        isConsumer
          ? { role: 'consumer', buyerId: currentUser?.id }
          : isRetailer
          ? { role: 'retailer' }
          : currentUser && currentUser.role !== 'admin'
          ? { userId: currentUser.id }
          : undefined
      );
      setOrders(res.orders || []);
    } catch (e) {
      console.error('Failed to load orders', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    if (isConsumer) {
      setActiveTab('consumer_purchases');
    } else if (isRetailer && activeTab === 'farmer_to_wholesaler') {
      setActiveTab('wholesaler_to_retailer');
    }
  }, [currentUser?.id, currentUser?.role]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Strict role-based trade filtering
  const isOrderInTab = (o: SupplyChainOrder) => {
    const ot = (o.orderType || '').toLowerCase();
    const sRole = (o.sellerRole || '').toLowerCase();
    const bRole = (o.buyerRole || '').toLowerCase();

    // 1. CONSUMER ROLE: Strictly display ONLY items bought by the Consumer from Retailers
    // Strictly block and exclude any direct trade involving Farmers or Wholesalers
    if (isConsumer) {
      if (sRole === 'farmer' || sRole === 'wholesaler' || bRole === 'farmer' || bRole === 'wholesaler') {
        return false;
      }

      // Must be bought from a Retailer
      const isFromRetailer = sRole === 'retailer' || ot === 'retailer_to_consumer';

      // Match this consumer's purchase record
      const isMyOrder =
        (currentUser && (o.buyerId === currentUser.id || (currentUser.phone && o.buyerPhone === currentUser.phone))) ||
        bRole === 'consumer' ||
        ot === 'retailer_to_consumer';

      return isFromRetailer && isMyOrder;
    }

    // 2. RETAILER ROLE: Strictly enforce Wholesaler -> Retailer and Retailer -> Consumer
    // Strictly block and exclude direct trades with Farmers
    if (isRetailer) {
      if (sRole === 'farmer' || bRole === 'farmer') {
        return false;
      }

      if (activeTab === 'wholesaler_to_retailer') {
        return (
          (bRole === 'retailer' && sRole === 'wholesaler') ||
          ot === 'wholesaler_to_retailer' ||
          (o.buyerId === currentUser?.id && sRole === 'wholesaler')
        );
      }

      if (activeTab === 'retailer_to_consumer') {
        return (
          (sRole === 'retailer' && bRole === 'consumer') ||
          ot === 'retailer_to_consumer' ||
          (o.sellerId === currentUser?.id && bRole === 'consumer')
        );
      }

      return false;
    }

    // 3. OTHER ROLES (Farmer, Wholesaler, Admin):
    return (
      ot === 'farmer_to_wholesaler' ||
      ot === '1st_tier' ||
      (sRole === 'farmer' && bRole === 'wholesaler')
    );
  };

  const handleUpdateStatus = async (
    orderId: string,
    status: 'Confirmed' | 'Processing' | 'Dispatched' | 'Delivered' | 'Cancelled'
  ) => {
    try {
      await orderApi.updateStatus(orderId, status, currentUser?.name || 'Authorized User', currentUser?.role || 'admin');
      showToast(
        t(
          `Order ${orderId} status updated to ${status}.`,
          `অর্ডার ${language === 'bn' ? toBanglaNumber(orderId) : orderId} স্ট্যাটাস ${status} এ পরিবর্তিত হয়েছে।`
        )
      );
      loadOrders();
    } catch (e: any) {
      showToast(e.message || t('Status update failed', 'স্ট্যাটাস আপডেট ব্যর্থ হয়েছে'));
    }
  };

  const filteredOrders = orders.filter(isOrderInTab);

  // Tab count calculations for retailers
  const wholesaleProcureOrdersCount = orders.filter((o) => {
    const ot = (o.orderType || '').toLowerCase();
    const sRole = (o.sellerRole || '').toLowerCase();
    const bRole = (o.buyerRole || '').toLowerCase();
    return (
      sRole !== 'farmer' &&
      bRole !== 'farmer' &&
      ((bRole === 'retailer' && sRole === 'wholesaler') || ot === 'wholesaler_to_retailer')
    );
  }).length;

  const consumerOrdersCount = orders.filter((o) => {
    const ot = (o.orderType || '').toLowerCase();
    const sRole = (o.sellerRole || '').toLowerCase();
    const bRole = (o.buyerRole || '').toLowerCase();
    return (
      sRole !== 'farmer' &&
      bRole !== 'farmer' &&
      ((sRole === 'retailer' && bRole === 'consumer') || ot === 'retailer_to_consumer')
    );
  }).length;

  const getStatusBadge = (status: SupplyChainOrder['status']) => {
    switch (status) {
      case 'Pending':
        return (
          <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-200">
            <Clock className="w-3 h-3" /> {t('Pending', 'অপেক্ষমাণ')}
          </span>
        );
      case 'Confirmed':
        return (
          <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-blue-200">
            <Clock className="w-3 h-3" /> {t('Confirmed', 'নিশ্চিত')}
          </span>
        );
      case 'Processing':
        return (
          <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-indigo-200">
            <Package className="w-3 h-3" /> {t('Packing', 'প্যাকেজিং')}
          </span>
        );
      case 'Dispatched':
        return (
          <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-purple-200">
            <Truck className="w-3 h-3" /> {t('In Transit', 'পরিবহনে')}
          </span>
        );
      case 'Delivered':
        return (
          <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> {t('Delivered', 'বিতরিত')}
          </span>
        );
      case 'Cancelled':
        return (
          <span className="bg-red-100 text-red-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-red-200">
            {t('Cancelled', 'বাতিল')}
          </span>
        );
      default:
        return (
          <span className="bg-stone-100 text-stone-700 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 animate-fade-in">
      {/* Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-teal-950 to-stone-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-teal-800/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-teal-900/70 border border-teal-400/30 px-3 py-1 rounded-full text-xs font-semibold text-teal-300">
              {isConsumer ? (
                <ShoppingBag className="w-3.5 h-3.5 text-teal-300" />
              ) : isRetailer ? (
                <Store className="w-3.5 h-3.5 text-teal-400" />
              ) : (
                <Sprout className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>
                {isConsumer
                  ? t('Consumer Purchase History', 'ভোক্তার ক্রয় খতিয়ান')
                  : isRetailer
                  ? t('Retailer Trade Hub', 'খুচরা বিক্রেতার বাণিজ্য হাব')
                  : t('Farmer & Wholesaler Trade Registry', 'কৃষক ও পাইকার সরাসরি বাণিজ্য খতিয়ান')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {isConsumer
                ? t('Consumer Purchases', 'ভোক্তার ক্রয়')
                : isRetailer
                ? t('Retailer Trade', 'খুচরা বিক্রেতার বাণিজ্য')
                : t('Agricultural Trade & Order Registry', 'কৃষি বাণিজ্য ও অর্ডার রেজিস্ট্রি')}
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              {isConsumer
                ? t(
                    'Order history and live delivery tracking of fresh agricultural items purchased from certified Retailers. Direct purchases from Farmers or Wholesalers are restricted by supply chain rules.',
                    'প্রত্যয়িত স্থানীয় খুচরা বিক্রেতাদের থেকে ক্রয়কৃত তাজা কৃষিপণ্যের অর্ডার খতিয়ান ও হোম ডেলিভারি ট্র্যাকিং। সরবরাহ শৃঙ্খলা নীতি অনুযায়ী কৃষক বা পাইকারদের থেকে সরাসরি ক্রয় নিষিদ্ধ।'
                  )
                : isRetailer
                ? t(
                    'Dedicated commercial registry for Retailers. Enforces strict supply chain: Retailers purchase exclusively from certified Wholesalers and fulfill orders to Consumers. Direct trading with Farmers is restricted.',
                    'খুচরা বিক্রেতাদের সুনির্দিষ্ট বাণিজ্যিক খতিয়ান। নিয়ন্ত্রিত সরবরাহ শৃঙ্খলা: খুচরা বিক্রেতা শুধুমাত্র অনুমোদিত পাইকারদের থেকেই ক্রয় করবেন এবং সাধারণ ভোক্তাদের কাছে বিক্রয় করবেন। কৃষকদের সাথে সরাসরি লেনদেন সম্পূর্ণ নিষিদ্ধ।'
                  )
                : t(
                    'Direct trading platform connecting Farmers with regional Wholesalers for transparent, fair-price crop procurements.',
                    'কৃষক ও আঞ্চলিক পাইকারদের মধ্যে সরাসরি ফসল ক্রয়-বিক্রয়ের স্বচ্ছ বাণিজ্যিক প্ল্যাটফর্ম।'
                  )}
            </p>
          </div>

          <button
            onClick={loadOrders}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('Refresh Orders', 'রিফ্রেশ')}</span>
          </button>
        </div>
      </div>


      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold border border-stone-700 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── TABS NAVIGATION ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto no-scrollbar">
        {isConsumer ? (
          /* 1. CONSUMER ROLE: Dedicated "ভোক্তার ক্রয়" (Consumer Purchases) tab */
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all bg-teal-700 text-white shadow-sm cursor-default"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{t('Consumer Purchases', 'ভোক্তার ক্রয়')}</span>
            <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {formatNum(filteredOrders.length)}
            </span>
          </button>
        ) : isRetailer ? (
          /* 2. RETAILER ROLE: Wholesaler-Retailer Trade and Retailer-Consumer Trade tabs */
          <>
            <button
              onClick={() => setActiveTab('wholesaler_to_retailer')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'wholesaler_to_retailer'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{t('Wholesaler-Retailer Trade', 'পাইকার-খুচরা বিক্রেতার বাণিজ্য')}</span>
              <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {formatNum(wholesaleProcureOrdersCount)}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('retailer_to_consumer')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'retailer_to_consumer'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{t('Retailer-Consumer Trade', 'খুচরা বিক্রেতা-ভোক্তার বাণিজ্য')}</span>
              <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {formatNum(consumerOrdersCount)}
              </span>
            </button>
          </>
        ) : (
          /* 3. NON-RETAILER / NON-CONSUMER ROLES: Farmer-Wholesaler Trade */
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all bg-emerald-600 text-white shadow-sm cursor-default"
          >
            <Sprout className="w-4 h-4" />
            <span>{t('Farmer-Wholesaler Trade', 'কৃষক-পাইকার বাণিজ্য')}</span>
            <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {formatNum(filteredOrders.length)}
            </span>
          </button>
        )}
      </div>

      {/* ─── ORDERS LIST ──────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {loading && (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200">
            <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin" />
            <p className="text-xs text-stone-500 mt-2">{t('Loading transactions...', 'লেনদেন লোড হচ্ছে...')}</p>
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8 space-y-2">
            <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
            <h4 className="font-bold text-stone-800 text-sm">
              {isConsumer
                ? t('No consumer purchases found', 'এখনও কোনো ক্রয়ের তথ্য পাওয়া যায়নি')
                : isRetailer
                ? activeTab === 'wholesaler_to_retailer'
                  ? t('No Wholesaler ↔ Retailer trades found', 'কোনো পাইকার-খুচরা বিক্রেতা বাণিজ্য পাওয়া যায়নি')
                  : t('No Retailer ↔ Consumer trades found', 'কোনো খুচরা বিক্রেতা-ভোক্তা বাণিজ্য পাওয়া যায়নি')
                : t('No Farmer ↔ Wholesaler trades found', 'কোনো সক্রিয় কৃষক ও পাইকার লেনদেন পাওয়া যায়নি')}
            </h4>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              {isConsumer
                ? t(
                    'Items you purchase from verified local Retailers on the marketplace feed will appear here for order tracking and delivery status.',
                    'মার্কেটপ্লেস ফিড থেকে অনুমোদিত খুচরা বিক্রেতাদের থেকে পণ্য ক্রয় করলে তা হোম ডেলিভারি ট্র্যাকিং ও রসিদের জন্য এখানে যুক্ত হবে।'
                  )
                : isRetailer
                ? activeTab === 'wholesaler_to_retailer'
                  ? t(
                      'Wholesale procurement contracts appear here when you order bulk stock from verified Wholesalers.',
                      'অনুমোদিত পাইকারদের কাছ থেকে পাইকারি লট ক্রয় করলে সেই চুক্তি ও ট্র্যাকিং এখানে প্রদর্শিত হবে।'
                    )
                  : t(
                      'Consumer delivery orders appear here when shoppers order your retail products from the marketplace.',
                      'ভোক্তারা আপনার খুচরা পণ্য অর্ডার করলে প্যাকিং ও ভ্যান ডেলিভারির জন্য এখানে যুক্ত হবে।'
                    )
                : t(
                    'Direct trade contracts appear here when Wholesalers procure harvest lots directly from Farmers at agreed fixed prices.',
                    'পাইকাররা কৃষকদের কাছ থেকে সরাসরি ফসল ক্রয় করলে সেই চুক্তিগুলো এখানে প্রদর্শিত হবে।'
                  )}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const currentStatus = order.status || order.deliveryStatus || 'Confirmed';
            return (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-stone-200 p-5 shadow-2xs hover:shadow-xs transition-all space-y-3 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-extrabold text-stone-900 text-sm">
                      #{language === 'bn' ? toBanglaNumber(order.id) : order.id}
                    </span>
                    {getStatusBadge(currentStatus)}
                    <span className="text-[11px] text-stone-400">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                    {order.trackingCode && (
                      <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md border border-stone-200">
                        {order.trackingCode}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 text-[11px]">
                      {isConsumer ? t('Total Paid:', 'পরিশোধিত মোট:') : t('Total Amount:', 'মোট মূল্য:')}
                    </span>
                    <span className="font-black text-emerald-700 text-base">
                      ৳{formatNum(order.totalBDT.toLocaleString())}
                    </span>
                  </div>
                </div>

                {/* Trade Entities */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">
                      {isConsumer
                        ? t('Purchased From Retailer', 'খুচরা বিক্রেতা (দোকান)')
                        : `${t('Seller', 'বিক্রেতা')} (${order.sellerRole === 'wholesaler' ? t('Wholesaler', 'পাইকার') : order.sellerRole === 'retailer' ? t('Retailer', 'খুচরা বিক্রেতা') : order.sellerRole})`}
                    </span>
                    <div className="font-extrabold text-stone-900 mt-0.5">{order.sellerName}</div>
                    {order.sellerPhone && (
                      <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-stone-400" />
                        <span>{formatNum(order.sellerPhone)}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-stone-400 block">
                      {isConsumer
                        ? t('Consumer (Buyer)', 'ক্রেতা (ভোক্তা)')
                        : `${t('Buyer', 'ক্রেতা')} (${order.buyerRole === 'retailer' ? t('Retailer', 'খুচরা বিক্রেতা') : order.buyerRole === 'consumer' ? t('Consumer', 'ভোক্তা') : order.buyerRole === 'wholesaler' ? t('Wholesaler', 'পাইকার') : order.buyerRole})`}
                    </span>
                    <div className="font-extrabold text-stone-900 mt-0.5">{order.buyerName}</div>
                    <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-stone-400" />
                      <span>{formatNum(order.buyerPhone)}</span>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-stone-600">
                    {isConsumer ? t('Purchased Items:', 'ক্রয়কৃত কৃষিপণ্য:') : t('Ordered Produce:', 'অর্ডারকৃত কৃষিপণ্য:')}
                  </div>
                  <div className="divide-y divide-stone-100 border border-stone-100 rounded-xl overflow-hidden">
                    {order.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 px-3 bg-white flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-stone-900">
                            {language === 'bn' ? it.banglaName || it.cropName : it.cropName}
                          </span>
                          <span className="text-stone-500 text-[11px] ml-2">
                            {formatNum(it.quantityKg)} {t('kg', 'কেজি')} × ৳{formatNum(it.unitPrice)}/{t('kg', 'কেজি')}
                          </span>
                        </div>
                        <span className="font-extrabold text-stone-800">
                          ৳{formatNum(it.subtotal.toLocaleString())}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Details & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-100 text-[11px] text-stone-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span>
                      {t('Delivery Address:', 'ডেলিভারি ঠিকানা:')} <strong>{order.deliveryAddress}</strong>
                    </span>
                  </div>

                  {/* Delivery status indicator for consumers */}
                  {isConsumer && (
                    <div className="text-emerald-700 font-semibold flex items-center gap-1">
                      {currentStatus === 'Confirmed' && (
                        <span>🚚 {t('Order confirmed. Retailer is preparing local van dispatch.', 'অর্ডার নিশ্চিত হয়েছে। খুচরা বিক্রেতা ভ্যান ডেলিভারির জন্য মাল প্রস্তুত করছেন।')}</span>
                      )}
                      {currentStatus === 'Dispatched' && (
                        <span>🚛 {t('Dispatched! Delivery van is on the way to your doorstep.', 'ভ্যানে পাঠানো হয়েছে! ডেলিভারি ভ্যান আপনার ঠিকানার পথে।')}</span>
                      )}
                      {currentStatus === 'Delivered' && (
                        <span>✅ {t('Delivered successfully to your address.', 'সফলভাবে পণ্য আপনার ঠিকানায় পৌঁছে দেওয়া হয়েছে।')}</span>
                      )}
                    </div>
                  )}

                  {/* Status update controls for Retailers and Sellers */}
                  {!isConsumer && (
                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                      {order.status === 'Pending' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'Confirmed')}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                        >
                          {t('Confirm', 'নিশ্চিত করুন')}
                        </button>
                      )}
                      {currentStatus === 'Confirmed' && isRetailer && activeTab === 'retailer_to_consumer' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'Dispatched')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{t('Dispatch Van', 'ভ্যানে মাল পাঠান')}</span>
                        </button>
                      )}
                      {currentStatus === 'Dispatched' && isRetailer && activeTab === 'retailer_to_consumer' && (
                        <button
                          onClick={() => handleUpdateStatus(order.id, 'Delivered')}
                          className="bg-stone-900 hover:bg-stone-800 text-white font-bold px-3 py-1.5 rounded-xl text-xs cursor-pointer"
                        >
                          {t('Mark Delivered', 'ডেলিভারি নিশ্চিত করুন')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
