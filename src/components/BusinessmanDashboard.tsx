import React, { useState, useEffect } from 'react';
import { BusinessDemand, CropListing, Language, User, AIMatchItem, NegotiationOffer, TradeOrder } from '../types';
import { DemandStore, CropStore, MatchStore, NegotiationStore, NotificationStore, TradeOrderStore } from '../data/store';
import {
  Briefcase, PlusCircle, TrendingUp, AlertCircle, Calendar, Sparkles,
  ShieldCheck, Phone, MapPin, ChevronDown, ChevronUp, X, RefreshCw,
  MessageSquare, Package, BarChart3, CheckCircle2, AlertTriangle, Eye,
  Trash2, Filter,
} from 'lucide-react';

interface BusinessmanDashboardProps {
  currentUser: User;
  language: Language;
}

type TabId = 'demands' | 'matches' | 'available';

const URGENCY_COLOR: Record<string, string> = {
  true:  'bg-red-50 border-red-200',
  false: 'bg-white border-stone-200',
};

export const BusinessmanDashboard: React.FC<BusinessmanDashboardProps> = ({ currentUser, language }) => {
  const [activeTab, setActiveTab]         = useState<TabId>('demands');
  const [demands, setDemands]             = useState<BusinessDemand[]>([]);
  const [availableListings, setAvailable] = useState<CropListing[]>([]);
  const [aiMatches, setAiMatches]         = useState<AIMatchItem[]>([]);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [showNegModal, setShowNegModal]   = useState<string | null>(null);
  const [negForm, setNegForm] = useState({ offeredPrice: 0, quantityKg: 500, message: '' });
  const [filterCrop, setFilterCrop] = useState('');

  const [demandForm, setDemandForm] = useState({
    cropNeeded: 'Hybrid Tomatoes',
    cropBangla: 'হাইব্রিড টমেটো',
    quantityKgNeeded: 2000,
    targetPricePerKg: 40,
    deliveryDeadline: 'Within 10 days',
    businessType: 'Wholesaler' as BusinessDemand['businessType'],
    notes: '',
    urgent: false,
  });

  const t = (en: string, bn: string) => language === 'bn' ? bn : en;

  const loadData = () => {
    const allDemands = DemandStore.getAll();
    const myDemands  = allDemands.filter(d => d.buyerId === currentUser.id || d.buyerId === 'b-1' || d.buyerId === 'b-2');
    const listings   = CropStore.getAvailable();
    // Compute matches against current demands or all open demands
    const allOpenDemands = allDemands.filter(d => (d.fulfilledKg || 0) < d.quantityKgNeeded);
    const matchSource = myDemands.length > 0 ? myDemands : allOpenDemands;
    const computed   = MatchStore.computeMatches(listings, matchSource);
    const stored     = MatchStore.getAll();
    setDemands(myDemands.length > 0 ? myDemands : allDemands.filter(d => d.buyerId === currentUser.id));
    setAvailable(listings);
    // Merge computed + stored, deduplicating by crop + farmer + buyer
    const matchKey = (m: AIMatchItem) => `${m.cropName}-${m.farmerName}-${m.buyerName}`;
    const seen = new Set(computed.map(matchKey));
    const merged = [...computed, ...stored.filter(s => !seen.has(matchKey(s)))].slice(0, 30);
    setAiMatches(merged);
  };

  useEffect(() => { loadData(); }, [currentUser.id]);

  // KPIs
  const totalDemanded   = demands.reduce((s, d) => s + d.quantityKgNeeded, 0);
  const totalFulfilled  = demands.reduce((s, d) => s + d.fulfilledKg, 0);
  const fillRate        = totalDemanded > 0 ? Math.round((totalFulfilled / totalDemanded) * 100) : 0;
  const urgentCount     = demands.filter(d => d.urgent && d.fulfilledKg < d.quantityKgNeeded).length;
  const topMatchScore   = aiMatches.length > 0 ? Math.max(...aiMatches.map(m => m.matchScore)) : 0;

  const handleAddDemand = (e: React.FormEvent) => {
    e.preventDefault();
    const demand: BusinessDemand = {
      id:               `dem-${Date.now()}`,
      buyerId:          currentUser.id,
      businessName:     currentUser.businessName || currentUser.name,
      businessType:     demandForm.businessType,
      contactPerson:    currentUser.name,
      phone:            currentUser.phone,
      cropNeeded:       demandForm.cropNeeded,
      cropBangla:       demandForm.cropBangla,
      quantityKgNeeded: demandForm.quantityKgNeeded,
      fulfilledKg:      0,
      targetPricePerKg: demandForm.targetPricePerKg,
      deliveryDeadline: demandForm.deliveryDeadline,
      district:         currentUser.district,
      urgent:           demandForm.urgent,
      notes:            demandForm.notes,
      createdAt:        new Date().toISOString(),
    };
    DemandStore.add(demand);
    NotificationStore.addSystemNotif(currentUser.id,
      t('Demand Posted!', 'চাহিদা পোস্ট করা হয়েছে!'),
      t(`Demand for ${demandForm.cropNeeded} posted. Matching farmers...`, `${demandForm.cropBangla}-এর চাহিদা পোস্ট হয়েছে। কৃষক মেলানো হচ্ছে...`),
      'success'
    );
    setShowAddModal(false);
    loadData();
  };

  const handleLockContract = (match: AIMatchItem) => {
    MatchStore.update(match.id, { status: 'Locked in Escrow' });
    const listing = availableListings.find(l => l.farmerName === match.farmerName);
    if (listing) CropStore.update(listing.id, { status: 'Pre-contracted' });
    NotificationStore.addSystemNotif(currentUser.id,
      t('Contract Locked!', 'চুক্তি পাকা!'),
      t(`Supply contract for ${match.cropName} locked with ${match.farmerName}. Escrow secured.`, `${match.farmerName}-এর সাথে ${match.cropName}-এর চুক্তি পাকা। এসক্রো নিশ্চিত।`),
      'success'
    );
    loadData();
  };

  const handleSendNegotiation = (listing: CropListing) => {
    if (!negForm.offeredPrice) return;
    const neg: NegotiationOffer = {
      id:               `neg-${Date.now()}`,
      listingId:        listing.id,
      buyerName:        currentUser.businessName || currentUser.name,
      buyerPhone:       currentUser.phone,
      offeredPricePerKg:negForm.offeredPrice,
      quantityKg:       negForm.quantityKg,
      message:          negForm.message,
      status:           'Pending',
      createdAt:        new Date().toISOString(),
    };
    NegotiationStore.add(neg);
    setShowNegModal(null);
    NotificationStore.addSystemNotif(currentUser.id,
      t('Offer Sent!', 'প্রস্তাব পাঠানো হয়েছে!'),
      t(`Offer of ৳${negForm.offeredPrice}/kg sent to ${listing.farmerName}`, `${listing.farmerName}-কে ৳${negForm.offeredPrice}/কেজি প্রস্তাব পাঠানো হয়েছে`),
      'info'
    );
  };

  const CROP_OPTIONS = [
    { en: 'Hybrid Tomatoes', bn: 'হাইব্রিড টমেটো' },
    { en: 'Diamond Red Potato', bn: 'ডায়মন্ড লাল আলু' },
    { en: 'Local Green Chili', bn: 'কাঁচা মরিচ' },
    { en: 'White Snowball Cauliflower', bn: 'স্নোবল ফুলকপি' },
    { en: 'Pointed Gourd (Patal)', bn: 'পটল' },
    { en: 'Brinjal (Eggplant)', bn: 'বেগুন' },
  ];

  const filteredListings = availableListings.filter(l => {
    if (!filterCrop) return true;
    const q = filterCrop.toLowerCase().trim();
    return (
      l.cropName.toLowerCase().includes(q) ||
      (l.cropBangla && l.cropBangla.includes(q)) ||
      (l.variety && l.variety.toLowerCase().includes(q)) ||
      (l.upazila && l.upazila.toLowerCase().includes(q)) ||
      (l.district && l.district.toLowerCase().includes(q)) ||
      (l.farmerName && l.farmerName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Banner */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e40af 50%, #1d4ed8 100%)' }}>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, white 0%, transparent 70%)' }} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-blue-900/60 border border-blue-400/30 px-3 py-1 rounded-full text-xs font-semibold text-blue-200 mb-2">
              <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              {t('Buyer / Wholesaler Dashboard', 'ব্যবসায়ী / পাইকার ড্যাশবোর্ড')}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {t(`Welcome, ${currentUser.name.split(' ')[0]}`, `স্বাগতম, ${currentUser.name.split(' ')[0]}`)}
            </h1>
            <p className="text-blue-100/90 text-sm mt-1 max-w-xl">
              {t(
                'Post bulk procurement demands. AI matches ripening crops from verified local farmers. Lock forward contracts with escrow.',
                'পাইকারি চাহিদাপত্র পোস্ট করুন। এআই স্থানীয় কৃষকের পাকন্ত ফসলের সাথে মেলায়। এসক্রোসহ অগ্রিম চুক্তি করুন।'
              )}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-white hover:bg-blue-50 text-blue-900 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 transition-all hover:-translate-y-0.5 flex-shrink-0"
          >
            <PlusCircle className="w-4 h-4 text-blue-600" />
            {t('Post Bulk Demand', 'পাইকারি চাহিদা যোগ করুন')}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('Total Demanded', 'মোট চাহিদা'), value: `${totalDemanded.toLocaleString()} kg`, sub: `${demands.length} ${t('orders', 'অর্ডার')}`, accent: '#2563eb' },
          { label: t('Procurement Rate', 'প্রাপ্তি হার'), value: `${fillRate}%`, sub: `${totalFulfilled.toLocaleString()} kg ${t('sourced', 'সংগ্রহ')}`, accent: fillRate > 70 ? '#059669' : '#d97706' },
          { label: t('AI Match Score', 'এআই ম্যাচ স্কোর'), value: `${topMatchScore}%`, sub: `${aiMatches.length} ${t('matches found', 'ম্যাচ পাওয়া')}`, accent: '#7c3aed' },
          { label: t('Urgent Demands', 'জরুরি চাহিদা'), value: String(urgentCount), sub: t('requires immediate sourcing', 'দ্রুত সংগ্রহ প্রয়োজন'), accent: '#dc2626' },
        ].map((kpi, i) => (
          <div key={i} className="stat-card animate-bounce-in" style={{ '--accent-color': kpi.accent + '15', animationDelay: `${i * 0.08}s` } as React.CSSProperties}>
            <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase tracking-wide">
              <span>{kpi.label}</span>
            </div>
            <div className="mt-2 text-2xl font-extrabold" style={{ color: kpi.accent }}>{kpi.value}</div>
            <p className="text-xs text-stone-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {([
          { id: 'demands',   label: t('My Demands', 'আমার চাহিদা'), count: demands.length },
          { id: 'matches',   label: t('AI Match', 'এআই ম্যাচ'), count: aiMatches.length },
          { id: 'available', label: t('Find Crops', 'ফসল খুঁজুন'), count: filteredListings.length },
        ] as Array<{ id: TabId; label: string; count: number }>).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-stone-600 hover:text-stone-800'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-blue-100 text-blue-800' : 'bg-stone-200 text-stone-600'}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── TAB: DEMANDS ─── */}
      {activeTab === 'demands' && (
        <div className="space-y-4">
          {demands.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><Package className="w-8 h-8" /></div>
              <h3 className="font-bold text-stone-700">{t('No demands posted yet', 'এখনো কোনো চাহিদা পোস্ট করা হয়নি')}</h3>
              <button onClick={() => setShowAddModal(true)} className="mt-4 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2">
                <PlusCircle className="w-4 h-4" /> {t('Post First Demand', 'প্রথম চাহিদা পোস্ট করুন')}
              </button>
            </div>
          ) : demands.map(demand => {
            const pct     = Math.min(100, Math.round((demand.fulfilledKg / demand.quantityKgNeeded) * 100));
            const isOpen  = expandedId === demand.id;
            return (
              <div key={demand.id} className={`card p-4 border ${URGENCY_COLOR[String(demand.urgent)]} transition-all`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-stone-900 text-base">{t(demand.cropNeeded, demand.cropBangla)}</h3>
                      {demand.urgent && <span className="badge badge-danger">🔴 {t('Urgent', 'জরুরি')}</span>}
                      <span className="badge badge-info">{demand.businessType}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone-500 mt-1 flex-wrap">
                      <span className="font-semibold text-stone-700">{demand.quantityKgNeeded.toLocaleString()} kg</span>
                      <span className="font-bold text-blue-700">৳{demand.targetPricePerKg}/kg</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{demand.deliveryDeadline}</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{demand.district}</span>
                    </div>
                    {/* Fill progress */}
                    <div className="mt-2.5">
                      <div className="flex justify-between text-[11px] text-stone-600 mb-1">
                        <span>{t('Procurement progress', 'সংগ্রহ অগ্রগতি')}</span>
                        <span className="font-bold">{demand.fulfilledKg.toLocaleString()}/{demand.quantityKgNeeded.toLocaleString()} kg ({pct}%)</span>
                      </div>
                      <div className="progress-bar">
                        <div className={`progress-fill ${pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setExpandedId(isOpen ? null : demand.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors flex-shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-stone-100 space-y-2 animate-slide-down text-xs">
                    <p className="text-stone-600">{demand.notes}</p>
                    <div className="flex items-center gap-3">
                      <a href={`tel:${demand.phone}`} className="flex items-center gap-1 text-blue-700 font-semibold hover:underline">
                        <Phone className="w-3 h-3" />{demand.phone}
                      </a>
                      <button onClick={() => { DemandStore.delete(demand.id); loadData(); }}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold ml-auto">
                        <Trash2 className="w-3 h-3" /> {t('Delete', 'মুছুন')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── TAB: AI MATCHES ─── */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          {aiMatches.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><Sparkles className="w-8 h-8" /></div>
              <h3 className="font-bold text-stone-700">{t('No AI Matches Available', 'কোনো এআই ম্যাচ নেই')}</h3>
              <p className="text-sm text-stone-400 max-w-sm">
                {availableListings.length === 0 && demands.length === 0
                  ? t('No crop listings or demands exist yet. Post a demand and ask farmers to list their crops to start matching.', 'এখনো কোনো ফসলের তালিকা বা চাহিদা নেই। চাহিদা পোস্ট করুন এবং কৃষকদের ফসল তালিকা যুক্ত করতে বলুন।')
                  : availableListings.length === 0
                  ? t('No crop listings available yet. Farmers need to add their harvest listings first.', 'এখনো কোনো ফসলের তালিকা নেই। কৃষকদের প্রথমে ফসল তালিকা যুক্ত করতে হবে।')
                  : demands.length === 0
                  ? t('Post a procurement demand to enable AI crop matching.', 'এআই ম্যাচিং চালু করতে একটি চাহিদা পোস্ট করুন।')
                  : t('No crop-demand matches found with enough similarity. Try adjusting your price range or crop type.', 'মূল্য বা ফসলের ধরন পরিবর্তন করে আবার চেষ্টা করুন।')}
              </p>
              <div className="flex gap-2 mt-4 flex-wrap justify-center">
                <button onClick={() => setShowAddModal(true)} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2">
                  <PlusCircle className="w-4 h-4" /> {t('Post Demand', 'চাহিদা পোস্ট করুন')}
                </button>
                <button onClick={() => setActiveTab('available')} className="px-5 py-2.5 bg-stone-100 text-stone-700 text-sm font-bold rounded-xl hover:bg-stone-200 transition-colors flex items-center gap-2">
                  <Eye className="w-4 h-4" /> {t('Find Crops', 'ফসল খুঁজুন')}
                </button>
                <button onClick={loadData} className="px-5 py-2.5 bg-stone-100 text-stone-700 text-sm font-bold rounded-xl hover:bg-stone-200 transition-colors flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> {t('Refresh', 'রিফ্রেশ করুন')}
                </button>
              </div>
              {availableListings.length > 0 && demands.length > 0 && (
                <p className="text-xs text-stone-400 mt-3">
                  {t(`${availableListings.length} crop listings available • ${demands.length} demands posted • Price similarity required for matching`, `${availableListings.length}টি ফসল তালিকা • ${demands.length}টি চাহিদা • মূল্য মিল প্রয়োজন`)}
                </p>
              )}
            </div>
          ) : aiMatches.map((match, i) => (
            <div key={match.id} className="card p-4 animate-slide-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex items-start gap-3.5">
                {/* Match Score Ring */}
                <div className={`match-ring flex-shrink-0 ${match.matchScore >= 90 ? 'score-high' : match.matchScore >= 70 ? 'score-medium' : 'score-low'}`}>
                  {match.matchScore}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-stone-900 text-sm">{match.cropName}</h3>
                      <p className="text-xs text-stone-500">👨‍🌾 {match.farmerName} • {match.farmerLocation}</p>
                    </div>
                    <span className={`badge flex-shrink-0 ${match.status === 'Locked in Escrow' ? 'badge-purple' : match.status === 'Ready to Contract' ? 'badge-success' : 'badge-info'}`}>
                      {match.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 text-xs">
                    <div className="bg-stone-50 rounded-lg p-2">
                      <p className="text-stone-400">{t('Available', 'উপলব্ধ')}</p>
                      <p className="font-bold text-stone-800">{match.harvestQuantityKg.toLocaleString()} kg</p>
                    </div>
                    <div className="bg-stone-50 rounded-lg p-2">
                      <p className="text-stone-400">{t('Farmer Price', 'কৃষকের দর')}</p>
                      <p className="font-bold text-stone-800">৳{match.farmerExpectedPrice}/kg</p>
                    </div>
                    <div className="bg-stone-50 rounded-lg p-2">
                      <p className="text-stone-400">{t('Ready In', 'প্রস্তুত')}</p>
                      <p className="font-bold text-stone-800">{match.readyInDays} {t('days', 'দিনে')}</p>
                    </div>
                    <div className="bg-stone-50 rounded-lg p-2">
                      <p className="text-stone-400">{t('Distance', 'দূরত্ব')}</p>
                      <p className="font-bold text-stone-800">{match.distanceKm} km</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-emerald-700 font-semibold">{match.projectedProfitMargin}</span>
                    {match.status !== 'Locked in Escrow' && (
                      <button
                        onClick={() => handleLockContract(match)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {t('Lock in Escrow', 'এসক্রো চুক্তি')}
                      </button>
                    )}
                    {match.status === 'Locked in Escrow' && (
                      <span className="flex items-center gap-1 text-purple-700 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" /> {t('Secured', 'নিশ্চিত')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── TAB: FIND CROPS ─── */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="text"
                value={filterCrop}
                onChange={e => setFilterCrop(e.target.value)}
                placeholder={t('Search crop, variety, farmer, or upazila...', 'ফসল, জাত, কৃষক বা উপজেলা দিয়ে খুঁজুন...')}
                className="field-input pl-9 text-xs w-full"
              />
              {filterCrop && (
                <button
                  onClick={() => setFilterCrop('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">
                {filteredListings.length} {t('crops available', 'ফসল পাওয়া গেছে')}
              </span>
            </div>
          </div>

          {filteredListings.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><Package className="w-8 h-8" /></div>
              <p className="text-stone-500">{t('No crops match your filter', 'কোনো ফসল মিলছে না')}</p>
            </div>
          ) : filteredListings.map((listing, i) => (
            <div key={listing.id} className="card p-4 flex gap-3.5 hover:shadow-md transition-all animate-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
              <img
                src={listing.imageUrl}
                alt={listing.cropName}
                className="w-16 h-16 rounded-xl object-cover border border-stone-200 flex-shrink-0"
                onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=200'; }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-stone-900 text-sm">{t(listing.cropName, listing.cropBangla)}</h3>
                    <p className="text-xs text-stone-500">{listing.farmerName} • {listing.upazila}</p>
                  </div>
                  <span className={`badge flex-shrink-0 ${listing.status === 'Ready to Harvest' ? 'badge-warning' : 'badge-success'}`}>
                    {listing.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                  <span className="font-bold text-blue-700">৳{listing.expectedPricePerKg}/kg</span>
                  <span className="text-stone-500">{listing.quantityKg.toLocaleString()} kg</span>
                  <span className="text-stone-500 flex items-center gap-0.5"><Calendar className="w-3 h-3" />{listing.availableDate}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <a href={`tel:${listing.farmerPhone}`} className="flex items-center gap-1 text-xs text-stone-600 hover:text-blue-700 font-medium">
                    <Phone className="w-3 h-3" />{listing.farmerPhone}
                  </a>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onClick={() => { setShowNegModal(listing.id); setNegForm({ offeredPrice: listing.expectedPricePerKg, quantityKg: Math.min(listing.quantityKg, 500), message: '' }); }}
                      className="flex items-center gap-1 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-lg border border-stone-200 transition-colors"
                    >
                      <MessageSquare className="w-3 h-3" />
                      {t('Make Offer', 'প্রস্তাব')}
                    </button>
                    <button
                      onClick={() => {
                        const newOrder: TradeOrder = {
                          id: `ORD-TRD-${Date.now().toString().slice(-4)}`,
                          orderType: 'b2b_trade',
                          buyerId: currentUser.id,
                          buyerName: currentUser.businessName || currentUser.name,
                          buyerPhone: currentUser.phone,
                          buyerEmail: currentUser.email,
                          buyerRole: 'businessman',
                          sellerId: listing.farmerId,
                          sellerName: listing.farmerName,
                          sellerPhone: listing.farmerPhone,
                          sellerRole: 'farmer',
                          title: `${listing.cropName} Harvest Trade`,
                          titleBn: `${listing.cropBangla} পাইকারি ক্রয়াদেশ`,
                          items: [
                            {
                              itemId: listing.id,
                              itemName: listing.cropName,
                              itemBangla: listing.cropBangla,
                              unitPrice: listing.expectedPricePerKg,
                              unit: 'kg',
                              quantity: Math.min(listing.quantityKg, 500),
                              subtotal: listing.expectedPricePerKg * Math.min(listing.quantityKg, 500),
                            },
                          ],
                          totalBDT: listing.expectedPricePerKg * Math.min(listing.quantityKg, 500),
                          paymentMethod: 'Escrow Guarantee',
                          deliveryAddress: `${listing.upazila}, ${listing.district}`,
                          district: listing.district,
                          upazila: listing.upazila,
                          status: 'Confirmed',
                          createdAt: new Date().toISOString(),
                        };
                        TradeOrderStore.add(newOrder);
                        NotificationStore.addSystemNotif(
                          currentUser.id,
                          t('Trade Order Confirmed!', 'বাণিজ্যিক ক্রয়াদেশ নিশ্চিত!'),
                          t(
                            `B2B Trade order placed with ${listing.farmerName} for ${listing.cropName}.`,
                            `${listing.farmerName}-এর সাথে ${listing.cropBangla} ক্রয়াদেশ নিশ্চিত হয়েছে।`
                          ),
                          'success'
                        );
                        alert(t(`✓ Trade Order successfully placed with farmer ${listing.farmerName}! View in Orders & Settlements tab.`, `✓ কৃষক ${listing.farmerName}-এর সাথে পাইকারি ক্রয়াদেশ সফল হয়েছে! অর্ডার ও লেনদেন ট্যাবে দেখুন।`));
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                    >
                      <Briefcase className="w-3 h-3" />
                      {t('Buy Harvest', 'ক্রয়াদেশ দিন')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Negotiation Modal */}
              {showNegModal === listing.id && (
                <div className="modal-overlay">
                  <div className="modal-box max-w-md w-full p-6">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                      <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                        {t('Send Offer to Farmer', 'কৃষককে প্রস্তাব দিন')}
                      </h3>
                      <button onClick={() => setShowNegModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-600">
                        <strong className="text-stone-800">{t(listing.cropName, listing.cropBangla)}</strong> — {listing.farmerName}<br />
                        {t('Asking price:', 'কৃষকের দর:')} <strong>৳{listing.expectedPricePerKg}/kg</strong>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="field-label">{t('Your Offered Price (৳/kg)', 'আপনার প্রস্তাবিত দর')}</label>
                          <input type="number" min="1" value={negForm.offeredPrice}
                            onChange={e => setNegForm(f => ({ ...f, offeredPrice: Number(e.target.value) }))}
                            className="field-input" required />
                        </div>
                        <div>
                          <label className="field-label">{t('Quantity (kg)', 'পরিমাণ (কেজি)')}</label>
                          <input type="number" min="1" max={listing.quantityKg} value={negForm.quantityKg}
                            onChange={e => setNegForm(f => ({ ...f, quantityKg: Number(e.target.value) }))}
                            className="field-input" />
                        </div>
                      </div>
                      <div>
                        <label className="field-label">{t('Message to Farmer (optional)', 'কৃষককে বার্তা (ঐচ্ছিক)')}</label>
                        <textarea rows={2} value={negForm.message}
                          onChange={e => setNegForm(f => ({ ...f, message: e.target.value }))}
                          className="field-input resize-none"
                          placeholder={t('e.g. Can deliver with my own vehicle...', 'যেমন: নিজের গাড়িতে ডেলিভারি দিতে পারব...')} />
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                        <button onClick={() => setShowNegModal(null)} className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl">
                          {t('Cancel', 'বাতিল')}
                        </button>
                        <button onClick={() => { handleSendNegotiation(listing); setShowNegModal(null); }}
                          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" /> {t('Send Offer', 'প্রস্তাব পাঠান')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── ADD DEMAND MODAL ─── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                {t('Post Bulk Procurement Demand', 'পাইকারি চাহিদাপত্র পোস্ট করুন')}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddDemand} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">{t('Crop Needed', 'প্রয়োজনীয় ফসল')}</label>
                  <select value={demandForm.cropNeeded}
                    onChange={e => {
                      const opt = CROP_OPTIONS.find(o => o.en === e.target.value);
                      setDemandForm(f => ({ ...f, cropNeeded: e.target.value, cropBangla: opt?.bn || e.target.value }));
                    }}
                    className="field-input">
                    {CROP_OPTIONS.map(o => <option key={o.en} value={o.en}>{o.en}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label">{t('Business Type', 'ব্যবসার ধরন')}</label>
                  <select value={demandForm.businessType} onChange={e => setDemandForm(f => ({ ...f, businessType: e.target.value as BusinessDemand['businessType'] }))} className="field-input">
                    {['Wholesaler','Supermarket','Agro Processor','Restaurant Chain','Exporter'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="field-label">{t('Quantity (kg)', 'পরিমাণ (কেজি)')}</label>
                  <input type="number" min="100" value={demandForm.quantityKgNeeded}
                    onChange={e => setDemandForm(f => ({ ...f, quantityKgNeeded: Number(e.target.value) }))}
                    className="field-input" required />
                </div>
                <div>
                  <label className="field-label">{t('Max Price (৳/kg)', 'সর্বোচ্চ দর')}</label>
                  <input type="number" min="1" value={demandForm.targetPricePerKg}
                    onChange={e => setDemandForm(f => ({ ...f, targetPricePerKg: Number(e.target.value) }))}
                    className="field-input" required />
                </div>
                <div>
                  <label className="field-label">{t('Deadline', 'সময়সীমা')}</label>
                  <input type="text" value={demandForm.deliveryDeadline}
                    onChange={e => setDemandForm(f => ({ ...f, deliveryDeadline: e.target.value }))}
                    className="field-input" placeholder="Within 10 days" />
                </div>
              </div>
              <div>
                <label className="field-label">{t('Notes / Quality Requirements', 'বিশেষ নির্দেশনা / মানের শর্ত')}</label>
                <textarea rows={2} value={demandForm.notes}
                  onChange={e => setDemandForm(f => ({ ...f, notes: e.target.value }))}
                  className="field-input resize-none"
                  placeholder={t('e.g. Grade A only, washed, mesh-bagged...', 'যেমন: শুধু গ্রেড-এ, পরিষ্কার করা...')} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={demandForm.urgent} onChange={e => setDemandForm(f => ({ ...f, urgent: e.target.checked }))}
                  className="w-4 h-4 rounded text-red-600 border-stone-300 focus:ring-red-500" />
                <span className="text-sm font-semibold text-stone-700">{t('Mark as URGENT (needs immediate sourcing)', 'জরুরি হিসেবে চিহ্নিত করুন')}</span>
              </label>
              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl">
                  {t('Cancel', 'বাতিল')}
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> {t('Post & Match Farmers', 'পোস্ট করুন ও কৃষক মেলান')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
