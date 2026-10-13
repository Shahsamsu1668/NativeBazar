import React, { useState } from 'react';
import { SupplierProduct, Language } from '../types';
import {
  Store,
  PlusCircle,
  Package,
  Radio,
  Star,
  MapPin,
  TrendingUp,
  AlertCircle,
  Phone,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface SupplierDashboardProps {
  products: SupplierProduct[];
  onAddProduct: (newProduct: Partial<SupplierProduct>) => void;
  language: Language;
}

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({
  products,
  onAddProduct,
  language,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [category, setCategory] = useState<'Fertilizer' | 'Pesticide' | 'Seeds' | 'Machinery' | 'Organic'>('Fertilizer');
  const [name, setName] = useState('');
  const [banglaName, setBanglaName] = useState('');
  const [brand, setBrand] = useState('Govt. BCIC / Lal Teer');
  const [unitPriceBDT, setUnitPriceBDT] = useState(500);
  const [unit, setUnit] = useState('50kg bag');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddProduct({
      supplierName: 'Meghna Fertilizer & Pesticide Depot',
      shopName: 'যমুনা ও মেঘনা সার বিতান (শিবগঞ্জ বাজার)',
      category,
      name,
      banglaName: banglaName || name,
      brand,
      unitPriceBDT,
      unit,
      inStock: true,
      distanceKm: 2.8,
      rating: 4.8,
      phone: '+880 1715-889900',
      suitableCrops: ['All local vegetables'],
    });
    setShowAddModal(false);
    setName('');
    setBanglaName('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-800 via-amber-700 to-yellow-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-amber-900/60 border border-amber-400/30 px-3 py-1 rounded-full text-xs font-semibold text-amber-200 mb-2">
              <Store className="w-3.5 h-3.5 text-amber-300" />
              <span>{language === 'bn' ? 'কৃষি উপকরণ ডিলার ও সরবরাহকারী পোর্টাল' : 'Agro-Input Dealer & Supplier Portal'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {language === 'bn' ? 'যমুনা ও মেঘনা সার বিতান' : 'Meghna Agro-Inputs Depot'}
            </h1>
            <p className="text-amber-100/90 text-sm mt-1 max-w-2xl">
              {language === 'bn'
                ? 'বগুড়ার স্থানীয় কৃষকদের আসন্ন ফসলের রুটিন অনুযায়ী সার, কীটনাশক ও বীজের চাহিদা আগেই জানুন।'
                : 'Forecast input demand before farmers ask. AI maps upcoming crop cycles across Bogura to match your stock.'}
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white hover:bg-amber-50 text-amber-900 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all hover:scale-102"
          >
            <PlusCircle className="w-4 h-4 text-amber-600" />
            <span>{language === 'bn' ? 'নতুন পণ্য যুক্ত করুন' : 'Add New Inventory'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase">
            <span>{language === 'bn' ? 'মোট নিবন্ধিত পণ্য' : 'Catalog Products'}</span>
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900">
            {products.length} <span className="text-sm font-normal text-stone-500">SKUs</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Fertilizers, seeds & bio-inputs</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase">
            <span>{language === 'bn' ? 'এআই পূর্বাভাষ চাহিদা' : 'Projected Farm Demand'}</span>
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            18.5 <span className="text-sm font-normal text-stone-500">tons</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Next 14 days in Shibganj upazila</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase">
            <span>{language === 'bn' ? 'গ্রাহক রেটিং' : 'Dealer Rating'}</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900">
            4.9 <span className="text-sm font-normal text-stone-500">/ 5.0</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Based on 142 farmer reviews</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase">
            <span>{language === 'bn' ? 'সরবরাহ দূরত্ব' : 'Avg Delivery Radius'}</span>
            <MapPin className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-teal-700">
            3.5 <span className="text-sm font-normal text-stone-500">km</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Same-day delivery by van</p>
        </div>
      </div>

      {/* AI Local Farmer Demand Radar (Report Highlight) */}
      <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Radio className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded">
                AI Farmer Demand Radar
              </span>
              <span className="text-xs text-stone-500">Real-time Agronomic Sensor</span>
            </div>
            <h3 className="text-base font-bold text-stone-900 mt-1">
              {language === 'bn'
                ? 'শিবগঞ্জ ও শেরপুরে আসন্ন সার ও ছত্রাকনাশক চাহিদার সংকেত'
                : 'Upcoming Input Demand Signals for Shibganj & Sherpur'}
            </h3>
            <p className="text-xs text-stone-700 mt-1 leading-relaxed">
              {language === 'bn'
                ? 'নেটিভবাজারে নিবন্ধিত ৩৮ জন কৃষকের টমেটো গাছে ফুল আসছে এবং ২০ জন কৃষকের আলুর জমি প্রস্তুত হচ্ছে। আগামী ৭ দিনে প্রায় ২.৫ টন এমওপি (পটাশ) সার এবং ১৮০ কেজি ম্যানকোজেব ছত্রাকনাশকের অতিরিক্ত চাহিদা তৈরি হবে। স্টক বজায় রাখার পরামর্শ দেওয়া হচ্ছে।'
                : 'NativeBazar detected 38 farmers with tomato flowering stages and 20 farmers preparing potato seedbeds. High local demand predicted: 2.5 metric tons MOP (Potash) and 180kg Mancozeb fungicide in next 7 days. Ensure distributor buffer.'}
            </p>
          </div>
        </div>
      </div>

      {/* Product Inventory Catalog */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" />
              <span>{language === 'bn' ? 'আমার ডিলার ইনভেন্টরি ও পণ্য তালিকা' : 'Dealer Inventory & Products'}</span>
            </h2>
            <p className="text-xs text-stone-500">
              {language === 'bn' ? 'কৃষকদের জন্য প্রদর্শিত অনুমোদিত কৃষি উপকরণ' : 'Certified inputs visible to surrounding farmers'}
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'পণ্য যোগ করুন' : 'Add Item'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-stone-200 hover:border-amber-300 transition-all bg-stone-50/40 hover:bg-white flex flex-col justify-between text-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded uppercase">
                    {item.category}
                  </span>
                  <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    In Stock
                  </span>
                </div>

                <h3 className="font-bold text-stone-900 text-sm mt-2">
                  {language === 'bn' ? item.banglaName : item.name}
                </h3>
                <p className="text-[11px] text-stone-500 font-medium">{item.brand}</p>
                <p className="text-[11px] text-stone-600 mt-2">
                  For: {item.suitableCrops.join(', ')}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-base font-extrabold text-stone-900">৳{item.unitPriceBDT}</span>
                  <span className="text-[10px] text-stone-500 block">/{item.unit}</span>
                </div>

                <span className="text-[11px] text-stone-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-stone-400" />
                  {item.distanceKm} km
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Add Inventory */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-600" />
                <span>{language === 'bn' ? 'নতুন পণ্য যুক্ত করুন' : 'Add New Inventory Item'}</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full border border-stone-300 rounded-lg p-2.5 bg-white focus:outline-hidden"
                >
                  <option value="Fertilizer">Fertilizer / রাসায়নিক সার</option>
                  <option value="Organic">Organic / জৈব সার (ভার্মিকম্পোস্ট)</option>
                  <option value="Seeds">Seeds / প্রত্যয়িত বীজ</option>
                  <option value="Pesticide">Pesticide / বালাইনাশক ও ছত্রাকনাশক</option>
                  <option value="Machinery">Machinery / স্প্রেয়ার ও যন্ত্রপাতি</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Product Name (English)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Zinc Sulfate Monohydrate"
                  className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">পণ্যের নাম (বাংলা)</label>
                <input
                  type="text"
                  value={banglaName}
                  onChange={(e) => setBanglaName(e.target.value)}
                  placeholder="যেমন: জিংক সালফেট মনোহাইড্রেট"
                  className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Brand / Company</label>
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Unit (e.g. 1kg, 50kg bag)</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Price in BDT (৳)</label>
                <input
                  type="number"
                  value={unitPriceBDT}
                  onChange={(e) => setUnitPriceBDT(Number(e.target.value))}
                  className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-4 py-2 rounded-lg shadow-sm"
                >
                  Save to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
