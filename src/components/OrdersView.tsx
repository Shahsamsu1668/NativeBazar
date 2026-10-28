import React, { useState, useEffect } from 'react';
import {
  SupplyChainOrder,
  Language,
  User,
} from '../types';
import { orderApi } from '../services/api';
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Phone,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Store,
  Sprout,
  Briefcase,
  DollarSign,
  PlusCircle,
  X,
  CreditCard,
  Building,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';

interface OrdersViewProps {
  currentUser: User | null;
  language: Language;
}

type OrderTabId = 'farmer_to_wholesaler' | 'wholesaler_to_retailer' | 'retailer_to_consumer';

export const OrdersView: React.FC<OrdersViewProps> = ({ currentUser, language }) => {
  const [activeTab, setActiveTab] = useState<OrderTabId>('farmer_to_wholesaler');
  const [orders, setOrders] = useState<SupplyChainOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await orderApi.getOrders();
      setOrders(res.orders || []);
    } catch (e) {
      console.error('Failed to load orders', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [currentUser?.id]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isOrderInTab = (o: SupplyChainOrder, tab: OrderTabId) => {
    const ot = (o.orderType || '').toLowerCase();
    const sRole = (o.sellerRole || '').toLowerCase();
    const bRole = (o.buyerRole || '').toLowerCase();

    if (tab === 'farmer_to_wholesaler') {
      return (
        ot === 'farmer_to_wholesaler' ||
        ot === '1st_tier' ||
        ot === 'supplier_input' ||
        (sRole === 'farmer' && (bRole === 'wholesaler' || bRole === 'businessman'))
      );
    }
    if (tab === 'wholesaler_to_retailer') {
      return (
        ot === 'wholesaler_to_retailer' ||
        ot === '2nd_tier' ||
        ot === 'b2b_trade' ||
        ((sRole === 'wholesaler' || sRole === 'businessman') && (bRole === 'retailer' || bRole === 'supplier'))
      );
    }
    if (tab === 'retailer_to_consumer') {
      return (
        ot === 'retailer_to_consumer' ||
        ot === '3rd_tier' ||
        ot === 'consumer_retail' ||
        ((sRole === 'retailer' || sRole === 'supplier') && (bRole === 'consumer' || bRole === 'customer'))
      );
    }
    return false;
  };

  const handleUpdateStatus = async (
    orderId: string,
    status: 'Confirmed' | 'Processing' | 'Dispatched' | 'Delivered' | 'Cancelled'
  ) => {
    try {
      await orderApi.updateStatus(orderId, status, currentUser?.name || 'Authorized User', currentUser?.role || 'admin');
      showToast(t(`Order ${orderId} status updated to ${status}.`, `অর্ডার ${orderId} স্ট্যাটাস ${status} এ পরিবর্তিত হয়েছে।`));
      loadOrders();
    } catch (e: any) {
      showToast(e.message || t('Status update failed', 'স্ট্যাটাস আপডেট ব্যর্থ হয়েছে'));
    }
  };

  // Filter orders by active tab
  const filteredOrders = orders.filter((o) => isOrderInTab(o, activeTab));

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
      <div className="bg-gradient-to-r from-stone-900 via-emerald-950 to-stone-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-800/40">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-emerald-900/70 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-300">
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('Strict Supply Chain Order Registry', 'নিয়ন্ত্রিত চার-স্তর সরবরাহ ও লেনদেন খতিয়ান')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t('Agricultural Trade & Order Registry', 'কৃষি বাণিজ্য ও অর্ডার রেজিস্ট্রি')}
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              {t(
                'Complete traceability across all 3 permitted trade tiers: Farmer to Wholesaler, Wholesaler to Retailer, and Retailer to Consumer. Real-time stock reservation and payment status.',
                'অনুমোদিত ৩টি স্তরের সম্পূর্ণ ট্রেসেবিলিটি: কৃষক থেকে পাইকার, পাইকার থেকে খুচরা এবং খুচরা থেকে ভোক্তা।'
              )}
            </p>
          </div>

          <button
            onClick={loadOrders}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 text-xs font-bold shrink-0"
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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('farmer_to_wholesaler')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'farmer_to_wholesaler'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Sprout className="w-4 h-4" />
          <span>{t('Tier 1: Farmer → Wholesaler', '১ম স্তর: কৃষক → পাইকার')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {orders.filter((o) => isOrderInTab(o, 'farmer_to_wholesaler')).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('wholesaler_to_retailer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'wholesaler_to_retailer'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>{t('Tier 2: Wholesaler → Retailer', '২য় স্তর: পাইকার → খুচরা')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {orders.filter((o) => isOrderInTab(o, 'wholesaler_to_retailer')).length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('retailer_to_consumer')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${
            activeTab === 'retailer_to_consumer'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{t('Tier 3: Retailer → Consumer', '৩য় স্তর: খুচরা → ভোক্তা')}</span>
          <span className="bg-stone-900 text-white text-[10px] px-1.5 py-0.2 rounded-full">
            {orders.filter((o) => isOrderInTab(o, 'retailer_to_consumer')).length}
          </span>
        </button>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {loading && (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200">
            <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin" />
            <p className="text-xs text-stone-500 mt-2">Loading transactions...</p>
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8 space-y-2">
            <Package className="w-10 h-10 text-stone-300 mx-auto" />
            <h4 className="font-bold text-stone-800 text-sm">
              {t('No orders found for this tier', 'এই স্তরে কোনো অর্ডার পাওয়া যায়নি')}
            </h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Transactions are created automatically when buyers place orders in their respective supply chain dashboards.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-3xl border border-stone-200 p-5 shadow-2xs hover:shadow-xs transition-all space-y-3 text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-extrabold text-stone-900 text-sm">
                    {order.id}
                  </span>
                  {getStatusBadge(order.status || order.deliveryStatus)}
                  <span className="text-[11px] text-stone-400">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-stone-500 text-[11px]">Total:</span>
                  <span className="font-black text-emerald-700 text-base">৳{order.totalBDT}</span>
                </div>
              </div>

              {/* Trade Entities */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200/80">
                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">
                    Seller ({order.sellerRole})
                  </span>
                  <div className="font-extrabold text-stone-900 mt-0.5">{order.sellerName}</div>
                  {order.sellerPhone && (
                    <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-stone-400" />
                      <span>{order.sellerPhone}</span>
                    </div>
                  )}
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">
                    Buyer ({order.buyerRole})
                  </span>
                  <div className="font-extrabold text-stone-900 mt-0.5">{order.buyerName}</div>
                  <div className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-stone-400" />
                    <span>{order.buyerPhone}</span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-stone-600">Ordered Produce:</div>
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
                          {it.quantityKg} kg × ৳{it.unitPrice}/kg
                        </span>
                      </div>
                      <span className="font-extrabold text-stone-800">৳{it.subtotal}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Details & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-stone-100 text-[11px] text-stone-500">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>Delivery Address: {order.deliveryAddress}</span>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  {order.status === 'Pending' && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'Confirmed')}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                    >
                      Confirm
                    </button>
                  )}
                  {(order.status === 'Confirmed' || order.deliveryStatus === 'Confirmed') && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'Dispatched')}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                    >
                      Dispatch
                    </button>
                  )}
                  {(order.status === 'Dispatched' || order.deliveryStatus === 'Dispatched') && (
                    <button
                      onClick={() => handleUpdateStatus(order.id, 'Delivered')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs"
                    >
                      Mark Delivered
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
