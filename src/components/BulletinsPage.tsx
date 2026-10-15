import React, { useState } from 'react';
import { AgroAdvisory, Language } from '../types';
import { AdvisoryStore } from '../data/store';
import {
  FileText, BellRing, MapPin, Calendar, ChevronDown, ChevronUp,
  Info, AlertTriangle, AlertCircle, Filter, Search, X,
} from 'lucide-react';

interface BulletinsPageProps {
  language: Language;
  selectedDistrict?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Weather Alert': 'bg-blue-100 text-blue-800 border-blue-200',
  'Pest Outbreak': 'bg-red-100 text-red-800 border-red-200',
  'Soil Advice': 'bg-amber-100 text-amber-800 border-amber-200',
  'Market Alert': 'bg-purple-100 text-purple-800 border-purple-200',
  'Price Warning': 'bg-orange-100 text-orange-800 border-orange-200',
};

const SEVERITY_ICONS: Record<string, string> = {
  Warning: '⚠️',
  Urgent: '🔴',
  Information: 'ℹ️',
};

const SEVERITY_BORDER: Record<string, string> = {
  Warning: 'border-l-4 border-amber-500',
  Urgent: 'border-l-4 border-red-500',
  Information: 'border-l-4 border-blue-500',
};

export const BulletinsPage: React.FC<BulletinsPageProps> = ({ language, selectedDistrict }) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [search, setSearch] = useState('');

  const t = (en: string, bn: string) => language === 'bn' ? bn : en;

  const allAdvisories = AdvisoryStore.getAll();

  const filtered = allAdvisories.filter(adv => {
    const matchSearch = !search ||
      adv.title.toLowerCase().includes(search.toLowerCase()) ||
      adv.titleBn.includes(search) ||
      adv.message.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterCategory || adv.category === filterCategory;
    const matchSeverity = !filterSeverity || adv.severity === filterSeverity;
    return matchSearch && matchCategory && matchSeverity;
  });

  const urgentCount = allAdvisories.filter(a => a.severity === 'Urgent').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-full opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at right, emerald, transparent 70%)' }} />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 bg-emerald-800/60 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-200 mb-2">
            <BellRing className="w-3.5 h-3.5 text-emerald-300" />
            <span>{t('Agricultural Expert Bulletin Board', 'কৃষি বিশেষজ্ঞ বুলেটিন বোর্ড')}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {t('Regional Agricultural Bulletins', 'আঞ্চলিক কৃষি বুলেটিন')}
          </h1>
          <p className="text-emerald-100/90 text-sm mt-1 max-w-2xl">
            {t(
              'Official advisories and notices from verified agricultural experts, DAE and BARI officers.',
              'যাচাইকৃত কৃষি বিশেষজ্ঞ, DAE ও BARI কর্মকর্তাদের সরকারি পরামর্শ ও বিজ্ঞপ্তি।'
            )}
          </p>
          {selectedDistrict && (
            <p className="text-emerald-300 text-xs mt-2 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {t(`Showing bulletins for: ${selectedDistrict}`, `দেখানো হচ্ছে: ${selectedDistrict}`)}
            </p>
          )}
        </div>
        {/* Stats */}
        <div className="relative z-10 mt-5 grid grid-cols-3 gap-3">
          {[
            { label: t('Total Bulletins', 'মোট বুলেটিন'), value: String(allAdvisories.length) },
            { label: t('Urgent Alerts', 'জরুরি সতর্কতা'), value: String(urgentCount) },
            { label: t('Categories', 'বিভাগ'), value: String(new Set(allAdvisories.map(a => a.category)).size) },
          ].map((stat, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 text-center">
              <p className="text-[11px] text-emerald-200/80 font-medium">{stat.label}</p>
              <p className="text-xl font-extrabold text-white mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('Search bulletins...', 'বুলেটিন খুঁজুন...')}
            className="w-full pl-9 pr-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-stone-700"
        >
          <option value="">{t('All Categories', 'সকল বিভাগ')}</option>
          <option value="Weather Alert">Weather Alert</option>
          <option value="Pest Outbreak">Pest Outbreak</option>
          <option value="Soil Advice">Soil Advice</option>
          <option value="Market Alert">Market Alert</option>
          <option value="Price Warning">Price Warning</option>
        </select>
        <select
          value={filterSeverity}
          onChange={e => setFilterSeverity(e.target.value)}
          className="px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 text-stone-700"
        >
          <option value="">{t('All Severity', 'সব মাত্রা')}</option>
          <option value="Urgent">🔴 Urgent</option>
          <option value="Warning">⚠️ Warning</option>
          <option value="Information">ℹ️ Information</option>
        </select>
        {(filterCategory || filterSeverity || search) && (
          <button onClick={() => { setFilterCategory(''); setFilterSeverity(''); setSearch(''); }}
            className="px-4 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl border border-stone-200 transition-colors flex items-center gap-1.5">
            <X className="w-3.5 h-3.5" />
            {t('Clear', 'মুছুন')}
          </button>
        )}
      </div>

      {/* Bulletin list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <FileText className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="font-bold text-stone-600 text-base">
            {allAdvisories.length === 0
              ? t('No bulletins published yet', 'এখনো কোনো বুলেটিন প্রকাশিত হয়নি')
              : t('No bulletins match your filters', 'ফিল্টারে কোনো বুলেটিন মিলছে না')}
          </h3>
          <p className="text-sm text-stone-400 mt-1">
            {allAdvisories.length === 0
              ? t('Agricultural experts will publish advisories here.', 'কৃষি বিশেষজ্ঞরা এখানে পরামর্শ প্রকাশ করবেন।')
              : t('Try adjusting your search or filters.', 'অনুসন্ধান বা ফিল্টার পরিবর্তন করে চেষ্টা করুন।')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-stone-500 font-medium">
            {t(`Showing ${filtered.length} of ${allAdvisories.length} bulletins`, `${allAdvisories.length}টির মধ্যে ${filtered.length}টি বুলেটিন দেখানো হচ্ছে`)}
          </p>
          {filtered.map(adv => {
            const isExpanded = expanded === adv.id;
            const categoryStyle = CATEGORY_COLORS[adv.category] || 'bg-stone-100 text-stone-700 border-stone-200';
            const borderStyle = SEVERITY_BORDER[adv.severity] || '';
            return (
              <div key={adv.id} className={`bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden hover:shadow-md transition-all ${borderStyle}`}>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${categoryStyle}`}>{adv.category}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          adv.severity === 'Urgent' ? 'bg-red-100 text-red-800'
                          : adv.severity === 'Warning' ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                        }`}>
                          {SEVERITY_ICONS[adv.severity]} {adv.severity}
                        </span>
                      </div>
                      <h3 className="font-bold text-stone-900 text-base leading-snug">
                        {language === 'bn' ? adv.titleBn : adv.title}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-xs text-stone-500 flex-wrap">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{adv.date}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{adv.district}</span>
                        <span className="font-medium text-stone-700">By {adv.expertName}</span>
                        {adv.affectedCrops && adv.affectedCrops.length > 0 && (
                          <span className="text-emerald-700">🌾 {adv.affectedCrops.slice(0, 2).join(', ')}{adv.affectedCrops.length > 2 ? '...' : ''}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setExpanded(isExpanded ? null : adv.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Preview */}
                  {!isExpanded && (
                    <p className="text-sm text-stone-600 leading-relaxed mt-3 line-clamp-3">
                      {language === 'bn' ? adv.messageBn : adv.message}
                    </p>
                  )}

                  {/* Full details */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 animate-slide-down">
                      <div>
                        <h4 className="text-xs font-bold text-stone-700 mb-2 flex items-center gap-1">
                          <Info className="w-3.5 h-3.5 text-emerald-600" />
                          {t('Full Advisory Details', 'সম্পূর্ণ পরামর্শ')}
                        </h4>
                        <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                          {language === 'bn' ? adv.messageBn : adv.message}
                        </div>
                      </div>

                      {adv.affectedCrops && adv.affectedCrops.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-stone-700 mb-2">{t('Affected Crops', 'প্রভাবিত ফসল')}</h4>
                          <div className="flex flex-wrap gap-2">
                            {adv.affectedCrops.map(crop => (
                              <span key={crop} className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full font-medium">
                                🌾 {crop}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expert info */}
                      <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs text-emerald-800">
                        <div className="font-bold mb-0.5">{adv.expertName}</div>
                        <div className="text-emerald-700">{adv.designation}</div>
                        <div className="text-emerald-600 mt-1">Region: {adv.district} • Published: {adv.date}</div>
                      </div>

                      {/* Official notice */}
                      <div className={`p-4 rounded-xl border text-xs font-medium ${
                        adv.severity === 'Urgent' ? 'bg-red-50 border-red-200 text-red-800'
                        : adv.severity === 'Warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-blue-50 border-blue-200 text-blue-800'
                      }`}>
                        <div className="font-bold mb-1">{SEVERITY_ICONS[adv.severity]} Official Agricultural Notice</div>
                        This bulletin has been issued by a verified agricultural expert and broadcast to all registered farmers in {adv.district} district. 
                        Please follow the recommended actions promptly and consult your local agricultural extension officer if needed.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
