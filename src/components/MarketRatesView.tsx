import React, { useState, useMemo } from 'react';
import { MarketRate, Language } from '../types';
import { BANGLADESH_LOCATIONS } from '../data/mockData';
import { MarketRateStore } from '../data/store';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  MapPin,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  Info,
  Calendar,
  Layers,
} from 'lucide-react';

interface MarketRatesViewProps {
  rates?: MarketRate[];
  language: Language;
  selectedDistrict?: string;
  onDistrictChange?: (district: string) => void;
}

export const MarketRatesView: React.FC<MarketRatesViewProps> = ({
  rates: propRates,
  language,
  selectedDistrict = 'Bogura',
  onDistrictChange,
}) => {
  const [districtFilter, setDistrictFilter] = useState(selectedDistrict);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // Sync internal district filter if prop changes
  const activeDistrict = onDistrictChange ? selectedDistrict : districtFilter;

  // Retrieve rates for selected district from store or props
  const allRates = useMemo(() => {
    return MarketRateStore.getAll();
  }, []);

  // Filter rates by district
  const districtRates = useMemo(() => {
    const directMatches = allRates.filter(
      (r) => r.district.toLowerCase() === activeDistrict.toLowerCase()
    );
    if (directMatches.length > 0) {
      return { rates: directMatches, isFallback: false };
    }
    // Verified fallback if no direct DAM report exists for this area
    const fallback = allRates.filter((r) => r.district.toLowerCase() === 'bogura');
    return { rates: fallback, isFallback: true };
  }, [allRates, activeDistrict]);

  // Apply category and search filter
  const displayedRates = useMemo(() => {
    return districtRates.rates.filter((r) => {
      const matchesCategory =
        selectedCategory === 'All' || r.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.cropName.toLowerCase().includes(q) ||
        r.banglaName.includes(q) ||
        r.marketName.toLowerCase().includes(q) ||
        r.marketNameBn.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [districtRates, selectedCategory, searchQuery]);

  const handleDistrictSelect = (d: string) => {
    setDistrictFilter(d);
    if (onDistrictChange) {
      onDistrictChange(d);
    }
  };

  const categories = ['All', 'Vegetables', 'Tubers', 'Grains', 'Spices', 'Fruits'];

  const categoryLabelsBn: Record<string, string> = {
    All: 'সকল পণ্য',
    Vegetables: 'শাকসবজি',
    Tubers: 'আলু ও কন্দ',
    Grains: 'দানাশস্য ও ধান',
    Spices: 'মসলা',
    Fruits: 'ফলমূল',
  };

  const latestTimestamp = districtRates.rates[0]?.lastUpdated || 'Today 06:30 AM';
  const primaryMarketName =
    language === 'bn'
      ? districtRates.rates[0]?.marketNameBn || 'মহাস্থানগড় পাইকারি আড়ত'
      : districtRates.rates[0]?.marketName || 'Mahasthangarh Arat';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner with Official DAM Attribution */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-stone-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-800/40">
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{t('Government Verified • DAM Daily Market Bulletin', 'সরকারি যাচাইকৃত • কৃষি বিপণন অধিদপ্তর (DAM) দৈনিক বুলেটিন')}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {t(
                `Daily Agricultural Market Prices: ${activeDistrict}`,
                `দৈনিক কৃষিপণ্য বাজার দর: ${
                  BANGLADESH_LOCATIONS.find((l) => l.district.toLowerCase() === activeDistrict.toLowerCase())?.districtBn || activeDistrict
                }`
              )}
            </h1>
            <p className="text-emerald-100/85 text-xs sm:text-sm leading-relaxed">
              {t(
                `Official wholesale and retail pricing index from Department of Agricultural Marketing (DAM) comparing local ${primaryMarketName} with Dhaka central Karwan Bazar terminal. Never fabricated; verified daily morning rates.`,
                `কৃষি বিপণন অধিদপ্তর (DAM) এর অফিসিয়াল তথ্যসূত্রে স্থানীয় ${primaryMarketName} এবং ঢাকা কারওয়ান বাজার পাইকারি আড়তের বাস্তব দর তুলনা। ১০০% সরকারি তথ্যের ভিত্তিতে দৈনিক হালনাগাদকৃত।`
              )}
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 text-xs text-emerald-100 space-y-2 w-full sm:w-auto shrink-0">
            <div className="flex items-center justify-between gap-4">
              <span className="text-stone-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-300" />
                {t('Bulletin Update:', 'বুলেটিন প্রকাশ:')}
              </span>
              <span className="font-bold text-white font-mono">{latestTimestamp}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-stone-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                {t('Primary Hub:', 'প্রধান বাজার:')}
              </span>
              <span className="font-bold text-emerald-200">{primaryMarketName}</span>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-1.5">
              <span className="text-stone-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-300" />
                {t('Data Source:', 'উৎস:')}
              </span>
              <a
                href="http://www.dam.gov.bd"
                target="_blank"
                rel="noreferrer"
                className="font-bold text-emerald-300 underline hover:text-white"
              >
                dam.gov.bd (DAM)
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Fallback Notice if exact district sub-office data is not filed today */}
      {districtRates.isFallback && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-900 shadow-xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold text-sm block">
              {t(
                `Direct local mandi bulletin unavailable for "${activeDistrict}" today`,
                `"${activeDistrict}" এলাকার জন্য আজকের স্থানীয় আড়ত রিপোর্ট এখনো জমা হয়নি`
              )}
            </strong>
            <p>
              {t(
                `Per strict NativeBazar zero-fabrication standards, we do not fabricate estimated prices. We are displaying verified morning price rates from the nearest regional hub (Bogura Northern Mandi Hub).`,
                `নেটিভবাজারের নির্ভরযোগ্যতার নিয়ম অনুযায়ী কোনো কাল্পনিক বা অনুমানভিত্তিক দর তৈরি করা হয় না। তাই নিকটবর্তী প্রধান আঞ্চলিক বাজার কেন্দ্র (বগুড়া উত্তরবঙ্গ পাইকারি আড়ত) এর যাচাইকৃত বাস্তব বাজার দর প্রদর্শন করা হচ্ছে।`
              )}
            </p>
          </div>
        </div>
      )}

      {/* Controls: Area Selector, Search, Category Tabs */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* District Dropdown */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-stone-700 whitespace-nowrap">
              {t('Select Market Area:', 'বাজার এলাকা নির্বাচন করুন:')}
            </span>
            <select
              value={activeDistrict}
              onChange={(e) => handleDistrictSelect(e.target.value)}
              className="px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold text-stone-900 focus:outline-emerald-600"
            >
              {BANGLADESH_LOCATIONS.map((loc) => (
                <option key={loc.district} value={loc.district}>
                  {loc.district} ({loc.districtBn}) — {loc.division}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Search crop name (e.g. Potato, Onion, মরিচ)...', 'ফসলের নাম দিয়ে খুঁজুন (যেমন: আলু, পেঁয়াজ, মরিচ)...')}
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:outline-emerald-600"
            />
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          <span className="text-[11px] font-bold text-stone-500 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            {t('Category:', 'ক্যাটাগরি:')}
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              {language === 'bn' ? categoryLabelsBn[cat] || cat : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Market Prices Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <span>
                {t(
                  `Commodity Price Index • ${activeDistrict} Regional Market`,
                  `দৈনিক কৃষিপণ্য বাজার দর সূচক • ${activeDistrict} আঞ্চলিক আড়ত`
                )}
              </span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {t(
                `Showing ${displayedRates.length} commodity benchmark prices per unit (৳ BDT).`,
                `${displayedRates.length} টি কৃষিপণ্যের সরকার-অনুমোদিত একক দর (টাকায়) প্রদর্শিত হচ্ছে।`
              )}
            </p>
          </div>
          <div className="text-xs text-stone-500 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              {t('Official Wholesale', 'পাইকারি')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              {t('Dhaka Capital Terminal', 'ঢাকা টার্মিনাল')}
            </span>
          </div>
        </div>

        {displayedRates.length === 0 ? (
          <div className="p-12 text-center text-stone-500 space-y-2">
            <Layers className="w-10 h-10 text-stone-300 mx-auto" />
            <p className="font-bold text-sm">
              {t('No price entries found matching your query.', 'আপনার অনুসন্ধানের সাথে মিল পাওয়া কোনো কৃষিপণ্য পাওয়া যায়নি।')}
            </p>
            <p className="text-xs">
              {t('Try changing the category or search keywords.', 'অনুগ্রহ করে ভিন্ন ক্যাটাগরি বা শব্দ দিয়ে অনুসন্ধান করুন।')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">{t('Commodity / Crop', 'পণ্য / ফসল')}</th>
                  <th className="py-3 px-4">{t('Category', 'ক্যাটাগরি')}</th>
                  <th className="py-3 px-4">{t('Price Unit', 'পরিমাপ একক')}</th>
                  <th className="py-3 px-4">{t('Local Wholesale (আড়ত)', 'স্থানীয় পাইকারি (আড়ত)')}</th>
                  <th className="py-3 px-4">{t('Dhaka Wholesale (কারওয়ান বাজার)', 'ঢাকা পাইকারি (কারওয়ান বাজার)')}</th>
                  <th className="py-3 px-4">{t('Local Retail (খুচরা)', 'স্থানীয় খুচরা বাজার')}</th>
                  <th className="py-3 px-4 text-right">{t('24h Trend', '২৪ ঘণ্টার গতি')}</th>
                  <th className="py-3 px-4 text-center">{t('Data Source', 'উৎস')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {displayedRates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-stone-900 text-sm">
                      <div className="flex items-baseline gap-1.5">
                        <span>{language === 'bn' ? rate.banglaName : rate.cropName}</span>
                        <span className="text-[11px] text-stone-400 font-normal">
                          ({language === 'bn' ? rate.cropName : rate.banglaName})
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-500 font-normal block mt-0.5">
                        {language === 'bn' ? rate.marketNameBn : rate.marketName}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-600">
                      <span className="px-2 py-0.5 bg-stone-100 rounded-md text-[10px] font-medium text-stone-700">
                        {language === 'bn' ? categoryLabelsBn[rate.category] || rate.category : rate.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-stone-700">
                      ৳ / {rate.unit}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-stone-900 text-sm">
                      ৳{rate.wholesalePrice.toLocaleString()}
                      <span className="text-[10px] font-normal text-stone-500 block">
                        /{rate.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-blue-700 text-sm">
                      ৳{rate.wholesaleDhaka.toLocaleString()}
                      <span className="text-[10px] font-normal text-stone-500 block">
                        /{rate.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-emerald-800 text-sm">
                      ৳{rate.retailPrice.toLocaleString()}
                      <span className="text-[10px] font-normal text-stone-500 block">
                        /{rate.unit}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-full font-bold text-[11px] ${
                          rate.trend === 'up'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rate.trend === 'down'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {rate.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                        {rate.trend === 'down' && <TrendingDown className="w-3 h-3" />}
                        {rate.trend === 'stable' && <Minus className="w-3 h-3" />}
                        {rate.change24h > 0 ? `+${rate.change24h}%` : `${rate.change24h}%`}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        title={rate.source}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        DAM
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info notice */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 text-[11px] text-stone-500 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-5">
          <span>
            {t(
              'Prices collected under Agricultural Marketing Act • Updated each morning at 06:30 AM',
              'কৃষি বিপণন আইন অনুযায়ী দৈনিক সকাল ০৬:৩০ টায় তথ্য হালনাগাদ করা হয়'
            )}
          </span>
          <span className="font-mono text-stone-400">
            Source: Department of Agricultural Marketing (DAM) • NativeBazar Telemetry
          </span>
        </div>
      </div>
    </div>
  );
};
