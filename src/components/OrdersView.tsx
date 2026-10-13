import React, { useState } from 'react';
import { CustomerOrder, Language, User, NegotiationOffer, AIMatchItem } from '../types';
import { OrderStore, NegotiationStore, MatchStore, CropStore } from '../data/store';
import {
  Package, Truck, CheckCircle2, Clock, AlertCircle, Phone, MapPin,
  ShieldCheck, ArrowUpRight, DollarSign, Calendar, RefreshCw, FileText
} from 'lucide-react';

interface OrdersViewProps {
  currentUser: User;
  language: Language;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ currentUser, language }) => {
  const [activeTab, setActiveTab] = useState<'consumer' | 'contracts'>('consumer');
  const [orders, setOrders] = useState<CustomerOrder[]>(OrderStore.getAll());
  const [negotiations, setNegotiations] = useState<NegotiationOffer[]>(NegotiationStore.getAll());
  const [matches, setMatches] = useState<AIMatchItem[]>(MatchStore.getAll());

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  const handleUpdateOrderStatus = (orderId: string, status: CustomerOrder['status']) => {
    OrderStore.update(orderId, { status });
    setOrders(OrderStore.getAll());
  };

  const statusBadge = (status: CustomerOrder['status']) => {
    switch (status) {
      case 'Confirmed':
        return <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> {t('Confirmed', 'নিশ্চিত')}</span>;
      case 'Dispatched':
        return <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><Truck className="w-3 h-3" /> {t('Dispatched', 'পাঠানো হয়েছে')}</span>;
      case 'Delivered':
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {t('Delivered', 'বিতরিত')}</span>;
      default:
        return <span className="bg-stone-100 text-stone-700 text-[11px] font-bold px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner */}
      <div className="bg-gradient-to-r from-stone-900 via-emerald-950 to-stone-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-emerald-900/60 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-300 mb-2">
              <Package className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('Orders, Escrow & Contract Management', 'অর্ডার, এসক্রো ও চুক্তি ট্র্যাকিং')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t('Transparent Trade Settlement Portal', 'স্বচ্ছ কৃষি বাণিজ্য ও অর্ডার নিষ্পত্তি')}
            </h1>
            <p className="text-stone-300 text-sm mt-1 max-w-2xl">
              {t(
                'Track consumer retail dispatches, verified farm forward contracts, and automated escrow payouts across Bogura pilot network.',
                'খুচরা ভোক্তা ডেলিভারি, অনুমোদিত কৃষকের অগ্রিম চুক্তি ও ডিজিটাল এসক্রো পেমেন্ট স্বচ্ছতার সাথে ট্র্যাক করুন।'
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('consumer')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'consumer'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {t('Direct Consumer Orders', 'ভোক্তা রিটেল অর্ডার')} ({orders.length})
            </button>
            <button
              onClick={() => setActiveTab('contracts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'contracts'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {t('Forward Contracts & Escrow', 'অগ্রিম চুক্তি ও এসক্রো')} ({negotiations.length + matches.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tab: Consumer Orders */}
      {activeTab === 'consumer' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-stone-200 shadow-xs">
              <Package className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-stone-800">
                {t('No consumer orders found', 'কোনো অর্ডার পাওয়া যায়নি')}
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                {t(
                  'Orders placed from Customer Marketplace will appear here with live tracking, delivery stage updates, and payment receipts.',
                  'গ্রাহক বাজার থেকে করা সমস্ত অর্ডার লাইভ ট্র্যাকিং এবং ডেলিভারি স্ট্যাটাস সহ এখানে প্রদর্শিত হবে।'
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orders.map((ord) => (
                <div key={ord.id} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-stone-900 text-sm">{ord.id}</span>
                        {statusBadge(ord.status)}
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {ord.customerName} • {ord.phone}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-emerald-700">৳{ord.totalBDT}</span>
                      <span className="text-[10px] text-stone-400 block">{ord.paymentMethod}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="bg-stone-50 rounded-xl p-3 space-y-2 text-xs border border-stone-100">
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wide">
                      {t('Order Items', 'অর্ডারের পণ্যসমূহ')}
                    </span>
                    {ord.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-stone-700">
                        <span>
                          {language === 'bn' ? item.product.banglaName : item.product.cropName} × {item.quantityKg} kg
                        </span>
                        <span className="font-semibold">৳{item.product.pricePerKg * item.quantityKg}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-stone-600 pt-2 border-t border-stone-100">
                    <div className="flex items-center gap-1.5 text-stone-500">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{ord.deliveryAddress}</span>
                    </div>
                    
                    {/* Status updater for demo/admin/farmer */}
                    <div className="flex items-center gap-1.5">
                      {ord.status === 'Confirmed' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'Dispatched')}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold transition-colors"
                        >
                          {t('Dispatch Now', 'ডেসপ্যাচ করুন')}
                        </button>
                      )}
                      {ord.status === 'Dispatched' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(ord.id, 'Delivered')}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors"
                        >
                          {t('Mark Delivered', 'ডেলিভারি সম্পন্ন')}
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

      {/* Tab: Forward Contracts & Escrows */}
      {activeTab === 'contracts' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-stone-900">{m.cropName}</span>
                      <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {m.status}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      👨‍🌾 {m.farmerName} ({m.farmerLocation}) ➔ 💼 {m.buyerName}
                    </p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-2 py-1 rounded-lg border border-emerald-200">
                    {m.matchScore}% AI Match
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-stone-50 p-3 rounded-xl text-center text-xs border border-stone-100">
                  <div>
                    <span className="text-[10px] text-stone-400 block">{t('Volume', 'পরিমাণ')}</span>
                    <strong className="text-stone-800 font-bold">{m.harvestQuantityKg} kg</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">{t('Escrow Rate', 'এসক্রো দর')}</span>
                    <strong className="text-emerald-700 font-bold">৳{m.buyerBudgetPrice}/kg</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-400 block">{t('Transit', 'দূরত্ব')}</span>
                    <strong className="text-stone-800 font-bold">{m.distanceKm} km</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 text-stone-500">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                    <span>Bank/bKash Escrow Secured</span>
                  </span>
                  <span className="font-semibold text-emerald-700">{m.projectedProfitMargin} margin</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
