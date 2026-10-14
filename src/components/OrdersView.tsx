import React, { useState, useMemo } from 'react';
import {
  CustomerOrder,
  TradeOrder,
  TradeOrderType,
  Language,
  User,
  SupplierProduct,
} from '../types';
import {
  OrderStore,
  TradeOrderStore,
  SupplierStore,
  CropStore,
  NotificationStore,
} from '../data/store';
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
  Filter,
} from 'lucide-react';

interface OrdersViewProps {
  currentUser: User;
  language: Language;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ currentUser, language }) => {
  const [activeTab, setActiveTab] = useState<'supplier_inputs' | 'b2b_trades' | 'consumer_retail'>(
    'supplier_inputs'
  );

  const [tradeOrders, setTradeOrders] = useState<TradeOrder[]>(TradeOrderStore.getAll());
  const [consumerOrders, setConsumerOrders] = useState<CustomerOrder[]>(OrderStore.getAll());

  // New Order Modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderModalType, setOrderModalType] = useState<TradeOrderType>('supplier_input');

  // Supplier input order form
  const supplierProducts = useMemo(() => SupplierStore.getAll(), []);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    supplierProducts[0]?.id || ''
  );
  const [orderQuantity, setOrderQuantity] = useState<number>(2);
  const [deliveryAddress, setDeliveryAddress] = useState(
    `${currentUser.upazila || 'Shibganj'}, ${currentUser.district || 'Bogura'}`
  );
  const [paymentMethod, setPaymentMethod] = useState<
    'bKash' | 'Nagad' | 'Bank Transfer' | 'Cash on Delivery' | 'Escrow Guarantee'
  >('bKash');

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  const reloadOrders = () => {
    setTradeOrders(TradeOrderStore.getAll());
    setConsumerOrders(OrderStore.getAll());
  };

  const handleUpdateTradeStatus = (
    orderId: string,
    status: TradeOrder['status']
  ) => {
    TradeOrderStore.update(orderId, { status });
    reloadOrders();
  };

  const handleUpdateConsumerStatus = (
    orderId: string,
    status: CustomerOrder['status']
  ) => {
    OrderStore.update(orderId, { status });
    reloadOrders();
  };

  // Place a new supplier input order or B2B trade order
  const handlePlaceTradeOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (orderModalType === 'supplier_input') {
      const product = supplierProducts.find((p) => p.id === selectedProductId);
      if (!product) return;

      const total = product.unitPriceBDT * orderQuantity;
      const newOrder: TradeOrder = {
        id: `ORD-SUP-${Date.now().toString().slice(-4)}`,
        orderType: 'supplier_input',
        buyerId: currentUser.id,
        buyerName: currentUser.name,
        buyerPhone: currentUser.phone,
        buyerEmail: currentUser.email,
        buyerRole: currentUser.role,
        sellerId: product.supplierId || 'sup-1',
        sellerName: product.shopName,
        sellerPhone: product.phone,
        sellerRole: 'supplier',
        title: product.name,
        titleBn: product.banglaName,
        items: [
          {
            itemId: product.id,
            itemName: product.name,
            itemBangla: product.banglaName,
            category: product.category,
            unitPrice: product.unitPriceBDT,
            unit: product.unit,
            quantity: orderQuantity,
            subtotal: total,
          },
        ],
        totalBDT: total,
        paymentMethod,
        deliveryAddress,
        district: currentUser.district || 'Bogura',
        upazila: currentUser.upazila || 'Shibganj',
        status: 'Confirmed',
        createdAt: new Date().toISOString(),
      };

      TradeOrderStore.add(newOrder);
      NotificationStore.addSystemNotif(
        currentUser.id,
        t('Order Placed Successfully!', 'অর্ডার সফলভাবে সম্পন্ন হয়েছে!'),
        t(
          `Your order for ${orderQuantity} ${product.unit} of ${product.name} has been placed.`,
          `${product.banglaName}-এর ${orderQuantity} ${product.unit} অর্ডার কনফার্ম হয়েছে।`
        ),
        'success'
      );
    } else {
      // Mutual B2B Trade Order
      const newOrder: TradeOrder = {
        id: `ORD-TRD-${Date.now().toString().slice(-4)}`,
        orderType: 'b2b_trade',
        buyerId: currentUser.id,
        buyerName: currentUser.businessName || currentUser.name,
        buyerPhone: currentUser.phone,
        buyerEmail: currentUser.email,
        buyerRole: currentUser.role,
        sellerId: 'user-farmer-1',
        sellerName: 'Md. Rafiqul Islam (Verified Farmer)',
        sellerPhone: '01712458920',
        sellerRole: 'farmer',
        title: 'Bulk Grade-A Diamond Red Potato Harvest',
        titleBn: 'পাইকারি গ্রেড-এ ডায়মন্ড লাল আলু',
        items: [
          {
            itemId: 'crop-pot-101',
            itemName: 'Diamond Red Potato',
            itemBangla: 'ডায়মন্ড লাল আলু',
            unitPrice: 28,
            unit: 'kg',
            quantity: orderQuantity * 100, // in hundreds of kg
            subtotal: 28 * orderQuantity * 100,
          },
        ],
        totalBDT: 28 * orderQuantity * 100,
        paymentMethod: 'Escrow Guarantee',
        deliveryAddress,
        district: currentUser.district || 'Bogura',
        upazila: currentUser.upazila || 'Shibganj',
        status: 'Confirmed',
        createdAt: new Date().toISOString(),
      };

      TradeOrderStore.add(newOrder);
      NotificationStore.addSystemNotif(
        currentUser.id,
        t('B2B Trade Order Issued!', 'বাণিজ্যিক ক্রয়াদেশ সম্পন্ন!'),
        t(
          'Trade order placed with escrow payment protection.',
          'এসক্রো পেমেন্ট সুরক্ষায় ফসল ক্রয়াদের নিশ্চিত করা হয়েছে।'
        ),
        'success'
      );
    }

    setShowOrderModal(false);
    reloadOrders();
  };

  // Filter orders by tab
  const supplierOrders = useMemo(
    () => tradeOrders.filter((o) => o.orderType === 'supplier_input'),
    [tradeOrders]
  );
  const b2bOrders = useMemo(
    () => tradeOrders.filter((o) => o.orderType === 'b2b_trade'),
    [tradeOrders]
  );

  const getStatusBadge = (status: TradeOrder['status'] | CustomerOrder['status']) => {
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
    <div className="space-y-6 animate-fade-in">
      {/* Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-emerald-950 to-stone-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 bg-emerald-900/70 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-300">
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('Comprehensive Agricultural Order Registry', 'কৃষি বাণিজ্য ও অর্ডার রেজিস্ট্রি')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t('Dedicated Order & Trade Management', 'অর্ডার ও দ্বিমুখী বাণিজ্য ব্যবস্থাপনা')}
            </h1>
            <p className="text-stone-300 text-xs sm:text-sm leading-relaxed">
              {t(
                'Order farm inputs directly from certified agro suppliers, manage mutual two-way trades between farmers and business wholesalers, and track consumer grocery dispatches with complete escrow transparency.',
                'ডিলারদের কাছ থেকে সরাসরি সার-বীজ ও কৃষি উপকরণ ক্রয়, কৃষক ও ব্যবসায়ীদের মধ্যে দ্বিমুখী পাইকারি ক্রয়াদেশ এবং হোম ডেলিভারি ট্র্যাক করুন।'
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => {
                setOrderModalType('supplier_input');
                setShowOrderModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Store className="w-4 h-4" />
              <span>{t('Order from Supplier', 'উপকরণ ক্রয়াদেশ দিন')}</span>
            </button>
            <button
              onClick={() => {
                setOrderModalType('b2b_trade');
                setShowOrderModal(true);
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Briefcase className="w-4 h-4" />
              <span>{t('Place B2B Trade Order', 'দ্বিমুখী বাণিজ্য অর্ডার')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-stone-200 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('supplier_inputs')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'supplier_inputs'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>{t('Supplier Input Orders', 'উপকরণ ডিলার অর্ডার')}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
              {supplierOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('b2b_trades')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'b2b_trades'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>{t('B2B Trade Orders (Two-Way)', 'কৃষক-ব্যবসায়ী দ্বিমুখী বাণিজ্য')}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
              {b2bOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('consumer_retail')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'consumer_retail'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>{t('Consumer Retail Deliveries', 'ভোক্তা রিটেল অর্ডার')}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
              {consumerOrders.length}
            </span>
          </button>
        </div>

        <span className="text-xs text-stone-500 font-medium self-end sm:self-auto">
          {t('Live Reactive Storage Active', 'রিয়েলটাইম স্টোরেজ কার্যকর')}
        </span>
      </div>

      {/* ─── TAB 1: SUPPLIER INPUT ORDERS ─── */}
      {activeTab === 'supplier_inputs' && (
        <div className="space-y-4">
          {supplierOrders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <Store className="w-12 h-12 text-stone-300 mx-auto" />
              <h3 className="font-bold text-stone-800 text-base">
                {t('No Supplier Input Orders Found', 'কোনো উপকরণ ক্রয়াদেশ নেই')}
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                {t(
                  'Farmers and businesses can order certified seeds, fertilizers, and tools from verified agro-input shops.',
                  'কৃষক ও ব্যবসায়ীরা সার, বীজ ও আধুনিক কৃষিযন্ত্রের জন্য ডিলারদের ক্রয়াদেশ দিতে পারেন।'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {supplierOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:border-emerald-300 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-stone-900">
                            {order.id}
                          </span>
                          <span className="text-[10px] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-full border border-amber-200">
                            {t('Supplier Input Purchase', 'কৃষি উপকরণ ক্রয়')}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-stone-800 mt-0.5">
                          {language === 'bn' ? order.titleBn || order.title : order.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(order.status)}
                      <span className="text-base font-black text-stone-900">
                        ৳{order.totalBDT.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-stone-600 bg-stone-50 p-3.5 rounded-xl">
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold block uppercase">
                        {t('Ordered By (Buyer)', 'ক্রেতা')}
                      </span>
                      <span className="font-bold text-stone-800">{order.buyerName}</span>
                      <span className="text-[11px] text-stone-500 block capitalize">
                        Role: {order.buyerRole}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold block uppercase">
                        {t('Supplier (Dealer)', 'ডিলার / দোকান')}
                      </span>
                      <span className="font-bold text-stone-800">{order.sellerName}</span>
                      <span className="text-[11px] text-stone-500 block">
                        📞 {order.sellerPhone || 'Verified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold block uppercase">
                        {t('Delivery Destination', 'ডেলিভারি গন্তব্য')}
                      </span>
                      <span className="font-medium text-stone-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        {order.deliveryAddress}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold block uppercase">
                        {t('Payment / Date', 'পেমেন্ট ও তারিখ')}
                      </span>
                      <span className="font-medium text-emerald-700">{order.paymentMethod}</span>
                      <span className="text-[10px] text-stone-400 block font-mono">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Progression & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1 text-[11px] text-stone-500">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <span>{t('Certified input receipt • Quality guaranteed by DAE dealer license', 'অনুমোদিত ডিলার ভাউচার • মান যাচাইকৃত')}</span>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {order.status !== 'Delivered' && (
                        <button
                          onClick={() =>
                            handleUpdateTradeStatus(
                              order.id,
                              order.status === 'Confirmed' ? 'Dispatched' : 'Delivered'
                            )
                          }
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold transition-colors"
                        >
                          {order.status === 'Confirmed'
                            ? t('Mark Dispatched (পাঠানো হয়েছে)', 'পাঠানো হয়েছে চিহ্নিত করুন')
                            : t('Mark Delivered (বিতরিত)', 'বিতরিত চিহ্নিত করুন')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: B2B TRADE ORDERS (TWO-WAY) ─── */}
      {activeTab === 'b2b_trades' && (
        <div className="space-y-4">
          {b2bOrders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <Briefcase className="w-12 h-12 text-stone-300 mx-auto" />
              <h3 className="font-bold text-stone-800 text-base">
                {t('No Mutual B2B Trade Orders', 'কোনো দ্বিমুখী বাণিজ্যিক অর্ডার নেই')}
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                {t(
                  'Farmers and businessmen can buy and sell agricultural commodities to each other directly.',
                  'কৃষক এবং ব্যবসায়ীরা একে অপরের সাথে সরাসরি শস্য ও পণ্যের পাইকারি ক্রয়-বিক্রয় চুক্তি করতে পারেন।'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {b2bOrders.map((trade) => (
                <div
                  key={trade.id}
                  className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs hover:border-blue-300 transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-stone-900">
                            {trade.id}
                          </span>
                          <span className="text-[10px] bg-blue-50 text-blue-800 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                            {t('Two-Way B2B Trade Contract', 'দ্বিমুখী বাণিজ্যিক ক্রয়াদেশ')}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-stone-800 mt-0.5">
                          {language === 'bn' ? trade.titleBn || trade.title : trade.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(trade.status)}
                      <span className="text-base font-black text-blue-900">
                        ৳{trade.totalBDT.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Trade Participants Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-stone-600 bg-stone-50 p-3.5 rounded-xl">
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold block uppercase">
                        {t('Buyer (ক্রয়কারী)', 'ক্রেতা')}
                      </span>
                      <span className="font-bold text-stone-800">{trade.buyerName}</span>
                      <span className="text-[11px] text-blue-700 block font-semibold capitalize">
                        Role: {trade.buyerRole}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold block uppercase">
                        {t('Seller (বিক্রেতা)', 'বিক্রেতা')}
                      </span>
                      <span className="font-bold text-stone-800">{trade.sellerName}</span>
                      <span className="text-[11px] text-emerald-700 block font-semibold capitalize">
                        Role: {trade.sellerRole}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold block uppercase">
                        {t('Logistics & Delivery', 'পরিবহন ও ডেলিভারি')}
                      </span>
                      <span className="font-medium text-stone-800 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-stone-400" />
                        {trade.deliveryAddress}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-stone-400 font-bold block uppercase">
                        {t('Settlement Security', 'নিরাপত্তা')}
                      </span>
                      <span className="font-bold text-emerald-700 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {trade.paymentMethod}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                    <span className="text-[11px] text-stone-500">
                      {t('Protected by NativeBazar Escrow Protocol • Payment released upon weighbridge verification', 'এসক্রো প্রোটোকল দ্বারা সুরক্ষিত • ওজন স্কেলে যাচাইয়ের পর পেমেন্ট ছাড়')}
                    </span>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {trade.status !== 'Delivered' && (
                        <button
                          onClick={() =>
                            handleUpdateTradeStatus(
                              trade.id,
                              trade.status === 'Confirmed' ? 'Dispatched' : 'Delivered'
                            )
                          }
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-lg text-xs font-bold transition-colors"
                        >
                          {trade.status === 'Confirmed'
                            ? t('Dispatch Harvest (পাঠানো হয়েছে)', 'পাঠানো হয়েছে চিহ্নিত করুন')
                            : t('Complete Trade (সম্পন্ন)', 'বাণিজ্য সম্পন্ন করুন')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: CONSUMER RETAIL ORDERS ─── */}
      {activeTab === 'consumer_retail' && (
        <div className="space-y-4">
          {consumerOrders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <Package className="w-12 h-12 text-stone-300 mx-auto" />
              <h3 className="font-bold text-stone-800 text-base">
                {t('No Consumer Orders Recorded', 'কোনো ভোক্তা অর্ডার নেই')}
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                {t(
                  'Orders placed from Customer Fresh Marketplace will be recorded here with delivery updates.',
                  'ভোক্তা মার্কেটপ্লেস থেকে করা অর্ডারের বিবরণ এখানে যুক্ত হবে।'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {consumerOrders.map((co) => (
                <div
                  key={co.id}
                  className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-mono text-xs font-bold text-stone-900">
                          {co.id}
                        </span>
                        <p className="text-xs font-bold text-stone-800 mt-0.5">
                          {co.customerName} • 📞 {co.phone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusBadge(co.status)}
                      <span className="text-base font-black text-purple-900">
                        ৳{co.totalBDT.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-stone-600 bg-stone-50 p-3.5 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-700">{t('Items Ordered:', 'পণ্যসমূহ:')}</span>
                      <span className="font-semibold text-emerald-800">{co.paymentMethod}</span>
                    </div>
                    <div className="divide-y divide-stone-200/60">
                      {co.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between py-1">
                          <span>
                            {it.product.cropName} ({it.quantityKg} kg)
                          </span>
                          <span className="font-bold">৳{it.product.pricePerKg * it.quantityKg}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-stone-500 pt-1">
                      📍 {t('Delivery Address:', 'ঠিকানা:')} {co.deliveryAddress}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {co.status !== 'Delivered' && (
                      <button
                        onClick={() =>
                          handleUpdateConsumerStatus(
                            co.id,
                            co.status === 'Confirmed' ? 'Dispatched' : 'Delivered'
                          )
                        }
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg text-xs font-bold transition-colors"
                      >
                        {co.status === 'Confirmed'
                          ? t('Dispatch Order (পাঠানো হয়েছে)', 'পাঠানো হয়েছে চিহ্নিত করুন')
                          : t('Mark Delivered (বিতরিত)', 'বিতরিত চিহ্নিত করুন')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: PLACE NEW ORDER ─── */}
      {showOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-black text-stone-900 text-base flex items-center gap-2">
                {orderModalType === 'supplier_input' ? (
                  <>
                    <Store className="w-5 h-5 text-emerald-600" />
                    <span>{t('Order Inputs from Supplier', 'উপকরণ ক্রয়াদেশ ফরম')}</span>
                  </>
                ) : (
                  <>
                    <Briefcase className="w-5 h-5 text-blue-600" />
                    <span>{t('Place Mutual B2B Trade Order', 'দ্বিমুখী বাণিজ্যিক অর্ডার')}</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowOrderModal(false)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePlaceTradeOrder} className="space-y-4 text-xs">
              {orderModalType === 'supplier_input' ? (
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Select Supplier Product', 'উপকরণ পণ্য নির্বাচন করুন')}
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  >
                    {supplierProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.shopName}) — ৳{p.unitPriceBDT}/{p.unit}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 space-y-1">
                  <p className="font-bold">
                    {t('Commodity: Diamond Red Potato (Bulk)', 'পণ্য: ডায়মন্ড লাল আলু (পাইকারি)')}
                  </p>
                  <p className="text-[11px] text-blue-700">
                    {t('Seller: Md. Rafiqul Islam (Shibganj, Bogura)', 'বিক্রেতা: মো: রফিকুল ইসলাম (শিবগঞ্জ, বগুড়া)')}
                  </p>
                </div>
              )}

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {orderModalType === 'supplier_input'
                    ? t('Order Quantity (Packages/Bags)', 'পরিমাণ (প্যাকেট/বস্তা)')
                    : t('Quantity (x 100 kg units)', 'পরিমাণ (শত কেজি এককে)')}
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Delivery Destination Address', 'ডেলিভারি ঠিকানা')}
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Payment Security Method', 'পেমেন্ট ও জামানত পদ্ধতি')}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                >
                  <option value="bKash">bKash (বিকাশ মার্চেন্ট)</option>
                  <option value="Nagad">Nagad (নগদ)</option>
                  <option value="Bank Transfer">Bank Transfer (ব্যাংক ট্রান্সফার)</option>
                  <option value="Escrow Guarantee">Digital Escrow Guarantee (ডিজিটাল এসক্রো)</option>
                  <option value="Cash on Delivery">Cash on Delivery (ক্যাশ অন ডেলিভারি)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-stone-600 hover:bg-stone-100"
                >
                  {t('Cancel', 'বাতিল')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md"
                >
                  {t('Confirm & Place Order', 'অর্ডার নিশ্চিত করুন')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
