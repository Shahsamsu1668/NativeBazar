import React, { useState, useEffect } from 'react';
import { CropListing, SupplierProduct, Language, User, ExpenseLedgerEntry, NegotiationOffer, TradeOrder } from '../types';
import { CropStore, DemandStore, ExpenseStore, NegotiationStore, NotificationStore, MatchStore, TradeOrderStore } from '../data/store';
import {
  Sprout, PlusCircle, TrendingUp, Store, CheckCircle2, AlertCircle,
  Calendar, Sparkles, ShieldCheck, Phone, MapPin, Stethoscope, Mic,
  DollarSign, Trash2, Edit3, Star, QrCode, MessageSquare,
  ChevronDown, ChevronUp, X, Wallet, BarChart3, Package, RefreshCw,
  AlertTriangle, ArrowUpRight, Eye,
} from 'lucide-react';
import { requestMarketPrediction, MarketPredictionResult } from '../services/aiService';

interface FarmerDashboardProps {
  currentUser: User;
  suppliers: SupplierProduct[];
  language: Language;
  onOpenCropDoctor: () => void;
  onOpenVoiceAssistant: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  'Growing':        'badge-success',
  'Ready to Harvest':'badge-warning',
  'Pre-contracted': 'badge-purple',
  'Sold':           'bg-stone-100 text-stone-600 border border-stone-200',
};

type TabId = 'listings' | 'inputs' | 'negotiations' | 'ledger';

export const FarmerDashboard: React.FC<FarmerDashboardProps> = ({
  currentUser, suppliers, language, onOpenCropDoctor, onOpenVoiceAssistant,
}) => {
  const [activeTab, setActiveTab]       = useState<TabId>('listings');
  const [listings, setListings]         = useState<CropListing[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<MarketPredictionResult | null>(null);
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [negotiations, setNegotiations] = useState<NegotiationOffer[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<ExpenseLedgerEntry[]>([]);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // Form state
  const [form, setForm] = useState({
    cropName: 'Hybrid Tomatoes (Bijli Plus)',
    cropBangla: 'হাইব্রিড বিজলি প্লাস টমেটো',
    variety: 'Bijli Plus F1',
    quantityKg: 500,
    daysToHarvest: 10,
    expectedPrice: 38,
    fertilizerNeeded: 'Potash (MOP), Mancozeb Fungicide',
    qualityGrade: 'A' as 'A' | 'B' | 'C',
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80',
  });

  // Ledger form
  const [ledgerForm, setLedgerForm] = useState({
    type: 'expense' as 'expense' | 'income',
    category: 'Fertilizer' as ExpenseLedgerEntry['category'],
    description: '',
    amountBDT: 0,
    date: new Date().toISOString().split('T')[0],
  });

  const t = (en: string, bn: string) => language === 'bn' ? bn : en;

  const loadData = () => {
    const myListings    = CropStore.getAll().filter(l => l.farmerId === currentUser.id || l.farmerId === 'f-1' || l.farmerId === 'f-2');
    const allNegs       = NegotiationStore.getAll();
    const myNegotiations = allNegs.filter(n => myListings.some(l => l.id === n.listingId));
    setListings(myListings);
    setNegotiations(myNegotiations);
    setLedgerEntries(ExpenseStore.getAll().filter(e => e.farmerId === currentUser.id));
  };

  useEffect(() => { loadData(); }, [currentUser.id]);

  // KPIs
  const myListings         = listings.filter(l => l.status !== 'Sold');
  const totalHarvestKg     = myListings.reduce((s, c) => s + c.quantityKg, 0);
  const totalEstRevenue    = myListings.reduce((s, c) => s + c.quantityKg * c.expectedPricePerKg, 0);
  const contractedCount    = myListings.filter(l => l.status === 'Pre-contracted').length;
  const totalExpenses      = ExpenseStore.totalExpenses();
  const totalIncome        = ExpenseStore.totalRevenue();
  const netProfit          = totalIncome - totalExpenses;

  const handlePredictPrice = async () => {
    setIsPredicting(true);
    try {
      const result = await requestMarketPrediction(form.cropName, form.quantityKg, `In ${form.daysToHarvest} days`, currentUser.district || 'Bogura', language);
      setAiPrediction(result);
      if (result.expectedPriceRangeBDT?.recommendedWholesale) {
        setForm(f => ({ ...f, expectedPrice: result.expectedPriceRangeBDT.recommendedWholesale }));
      }
    } catch { } finally {
      setIsPredicting(false);
    }
  };

  const handleAddListing = (e: React.FormEvent) => {
    e.preventDefault();
    const listing: CropListing = {
      id: `crop-${Date.now()}`,
      farmerId:             currentUser.id,
      farmerName:           currentUser.name,
      farmerPhone:          currentUser.phone,
      district:             currentUser.district,
      upazila:              currentUser.upazila || currentUser.district,
      cropName:             form.cropName,
      cropBangla:           form.cropBangla,
      variety:              form.variety,
      quantityKg:           form.quantityKg,
      availableDate:        `Ready in ${form.daysToHarvest} days`,
      expectedPricePerKg:   form.expectedPrice,
      marketBenchmarkPrice: form.expectedPrice + 4,
      status:               'Growing',
      imageUrl:             form.imageUrl,
      fertilizerNeeded:     form.fertilizerNeeded.split(',').map(s => s.trim()),
      matchedBuyersCount:   Math.floor(Math.random() * 4) + 1,
      qualityGrade:         form.qualityGrade,
      createdAt:            new Date().toISOString(),
      forwardContractOffer: aiPrediction ? {
        buyerName:      'AI-Matched Buyer via NativeBazar',
        offeredPrice:   aiPrediction.expectedPriceRangeBDT.recommendedWholesale,
        escrowAmountBDT: form.quantityKg * 8,
      } : undefined,
    };
    CropStore.add(listing);
    NotificationStore.addSystemNotif(currentUser.id, t('Harvest Listed!', 'ফসল তালিকাভুক্ত!'),
      t(`${form.cropName} (${form.quantityKg}kg) listed. AI matching buyers...`, `${form.cropBangla} (${form.quantityKg}কেজি) তালিকাভুক্ত। এআই ক্রেতা খুঁজছে...`),
      'success'
    );
    setShowAddModal(false);
    setAiPrediction(null);
    loadData();
  };

  const handleSignContract = (listing: CropListing) => {
    CropStore.update(listing.id, { status: 'Pre-contracted' });
    NotificationStore.addSystemNotif(currentUser.id,
      t('Contract Signed!', 'চুক্তি সম্পন্ন!'),
      t(`Forward contract for ${listing.cropName} locked. Escrow secured.`, `${listing.cropBangla}-এর অগ্রিম চুক্তি পাকা। এসক্রো নিশ্চিত।`),
      'success'
    );
    loadData();
  };

  const handleDeleteListing = (id: string) => {
    if (window.confirm(t('Delete this listing?', 'এই তালিকা মুছবেন?'))) {
      CropStore.delete(id);
      loadData();
    }
  };

  const handleAddLedgerEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: ExpenseLedgerEntry = {
      id:          `ledger-${Date.now()}`,
      farmerId:    currentUser.id,
      ...ledgerForm,
    };
    ExpenseStore.add(entry);
    setShowLedgerModal(false);
    setLedgerForm({ type: 'expense', category: 'Fertilizer', description: '', amountBDT: 0, date: new Date().toISOString().split('T')[0] });
    loadData();
  };

  const handleNegotiationResponse = (neg: NegotiationOffer, response: 'Accepted' | 'Rejected') => {
    NegotiationStore.update(neg.id, { status: response });
    if (response === 'Accepted') {
      const listing = listings.find(l => l.id === neg.listingId);
      if (listing) {
        CropStore.update(listing.id, {
          status: 'Pre-contracted',
          forwardContractOffer: {
            buyerName:       neg.buyerName,
            offeredPrice:    neg.offeredPricePerKg,
            escrowAmountBDT: neg.quantityKg * 8,
          }
        });
      }
      NotificationStore.addSystemNotif(currentUser.id, t('Offer Accepted!', 'প্রস্তাব গ্রহণ!'),
        t(`Accepted ৳${neg.offeredPricePerKg}/kg from ${neg.buyerName}`, `${neg.buyerName}-এর ৳${neg.offeredPricePerKg}/কেজি প্রস্তাব গ্রহণ`), 'success');
    }
    loadData();
  };

  const CROP_OPTIONS = [
    { en: 'Hybrid Tomatoes (Bijli Plus)', bn: 'হাইব্রিড বিজলি প্লাস টমেটো', img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80' },
    { en: 'Diamond Red Potato', bn: 'বগুড়ার ডায়মন্ড লাল আলু', img: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600&auto=format&fit=crop&q=80' },
    { en: 'Local Green Chili (Bogura Jhal)', bn: 'বগুড়ার কাঁচা মরিচ', img: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=600&auto=format&fit=crop&q=80' },
    { en: 'White Snowball Cauliflower', bn: 'স্নোবল ফুলকপি', img: 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=600&auto=format&fit=crop&q=80' },
    { en: 'Pointed Gourd (Patal)', bn: 'দেশি পটল', img: 'https://images.unsplash.com/photo-1626074353765-517a681e40be?w=600&auto=format&fit=crop&q=80' },
    { en: 'Brinjal (Eggplant)', bn: 'বেগুন', img: 'https://images.unsplash.com/photo-1659261200833-ec8761558af7?w=600&auto=format&fit=crop&q=80' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Banner */}
      <div className="hero-banner">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="ai-chip mb-2">
              <Sprout className="w-3.5 h-3.5" />
              {t('Farmer Dashboard • ' + currentUser.district, 'কৃষক ড্যাশবোর্ড • ' + currentUser.district)}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {t(`Welcome, ${currentUser.name.split(' ')[0]}!`, `স্বাগতম, ${currentUser.nameBn || currentUser.name.split(' ')[0]}!`)}
            </h1>
            <p className="text-emerald-100/90 text-sm mt-1 max-w-xl">
              {t(
                'List your upcoming harvests, get AI price forecasts, and find pre-matched wholesale buyers before harvest day.',
                'আগামী ফসলের তালিকা দিন, এআই দর পূর্বাভাস পান এবং ফসল তোলার আগেই যাচাইকৃত পাইকারি ক্রেতা খুঁজে নিন।'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAddModal(true)}
              className="bg-white hover:bg-emerald-50 text-emerald-900 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2 transition-all hover:-translate-y-0.5">
              <PlusCircle className="w-4 h-4 text-emerald-600" />
              {t('List Harvest', 'ফসল তালিকাভুক্ত')}
            </button>
            <button onClick={onOpenCropDoctor}
              className="bg-emerald-700/60 hover:bg-emerald-700 text-white border border-emerald-500/30 px-3.5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 transition-colors">
              <Stethoscope className="w-4 h-4" />
              {t('Crop Doctor', 'রোগ নির্ণয়')}
            </button>
            <button onClick={onOpenVoiceAssistant}
              className="bg-teal-700/60 hover:bg-teal-700 text-white border border-teal-500/30 px-3.5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-1.5 transition-colors">
              <Mic className="w-4 h-4" />
              {t('Voice AI', 'ভয়েস')}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('Active Harvests', 'সক্রিয় ফসল'), value: `${totalHarvestKg.toLocaleString()} kg`, sub: `${myListings.length} ${t('batches', 'ব্যাচ')}`, icon: <Sprout className="w-5 h-5 text-emerald-600" />, accent: '#059669' },
          { label: t('Est. Revenue', 'সম্ভাব্য আয়'), value: `৳${totalEstRevenue.toLocaleString()}`, sub: t('+25% vs arat middleman', 'দালাল ছাড়াই +২৫%'), icon: <TrendingUp className="w-5 h-5 text-blue-600" />, accent: '#2563eb' },
          { label: t('Contracted', 'চুক্তিবদ্ধ'), value: String(contractedCount), sub: t('with escrow secured', 'এসক্রো নিশ্চিত'), icon: <ShieldCheck className="w-5 h-5 text-purple-600" />, accent: '#7c3aed' },
          { label: t('Net Profit (Ledger)', 'নিট লাভ (লেজার)'), value: `৳${Math.abs(netProfit).toLocaleString()}`, sub: netProfit >= 0 ? t('Profit', 'লাভ') : t('Loss', 'লোকসান'), icon: <Wallet className="w-5 h-5 text-amber-600" />, accent: '#d97706' },
        ].map((kpi, i) => (
          <div key={i} className="stat-card animate-bounce-in" style={{ '--accent-color': kpi.accent + '15', animationDelay: `${i * 0.08}s` } as React.CSSProperties}>
            <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase tracking-wide">
              <span>{kpi.label}</span>
              {kpi.icon}
            </div>
            <div className="mt-2 text-2xl font-extrabold text-stone-900">{kpi.value}</div>
            <p className="text-xs text-stone-500 mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-fit">
        {([
          { id: 'listings',     label: t('My Harvests', 'আমার ফসল'), count: myListings.length },
          { id: 'inputs',       label: t('Agro Inputs', 'কৃষি উপকরণ'), count: suppliers.length },
          { id: 'negotiations', label: t('Offers', 'প্রস্তাব'), count: negotiations.filter(n => n.status === 'Pending').length },
          { id: 'ledger',       label: t('Ledger', 'লেজার'), count: ledgerEntries.length },
        ] as Array<{ id: TabId; label: string; count: number }>).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-600 hover:text-stone-800'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── TAB: LISTINGS ─── */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {listings.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><Sprout className="w-8 h-8" /></div>
              <h3 className="font-bold text-stone-700 text-base">{t('No harvest listings yet', 'এখনো কোনো ফসল তালিকা নেই')}</h3>
              <p className="text-sm text-stone-400 max-w-xs">{t('List your upcoming harvest to start getting matched with buyers', 'আগামী ফসলের তালিকা দিন, ক্রেতাদের সাথে ম্যাচিং শুরু হবে')}</p>
              <button onClick={() => setShowAddModal(true)} className="mt-4 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                {t('List First Harvest', 'প্রথম ফসল তালিকাভুক্ত করুন')}
              </button>
            </div>
          ) : (
            listings.map(listing => (
              <div key={listing.id} className="card p-4 hover:shadow-md transition-all">
                <div className="flex gap-3.5">
                  <img
                    src={listing.imageUrl}
                    alt={listing.cropName}
                    className="w-20 h-20 rounded-xl object-cover border border-stone-200 flex-shrink-0 shadow-sm"
                    onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=200'; }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-stone-900 text-base">
                            {t(listing.cropName, listing.cropBangla)}
                          </h3>
                          <span className={`badge ${STATUS_STYLE[listing.status] || 'badge-info'}`}>
                            {listing.status}
                          </span>
                          {listing.qualityGrade && (
                            <span className="badge badge-amber">Grade {listing.qualityGrade}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-stone-500 mt-1 flex-wrap">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{listing.availableDate}</span>
                          <span className="font-semibold text-stone-700">{listing.quantityKg.toLocaleString()} kg</span>
                          <span className="font-bold text-emerald-700">৳{listing.expectedPricePerKg}/kg</span>
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{listing.upazila}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setExpandedId(expandedId === listing.id ? null : listing.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-500 transition-colors">
                          {expandedId === listing.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => handleDeleteListing(listing.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-red-100 text-stone-500 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Est value + matched buyers */}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-base font-extrabold text-stone-900">
                        ৳{(listing.quantityKg * listing.expectedPricePerKg).toLocaleString()}
                      </span>
                      <span className="text-xs text-stone-500">{t('estimated total', 'আনুমানিক মোট')}</span>
                      <span className="badge badge-info ml-auto">
                        <Sparkles className="w-3 h-3" />
                        {listing.matchedBuyersCount} {t('buyers matched', 'ক্রেতা ম্যাচড')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded: Contract Offer */}
                {expandedId === listing.id && (
                  <div className="mt-4 pt-4 border-t border-stone-100 space-y-3 animate-slide-down">
                    {listing.forwardContractOffer && (
                      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-emerald-900">
                              {t('AI Forward Contract Offer:', 'এআই অগ্রিম চুক্তির প্রস্তাব:')} {listing.forwardContractOffer.buyerName}
                            </p>
                            <p className="text-xs text-emerald-700 mt-0.5">
                              {t(
                                `৳${listing.forwardContractOffer.offeredPrice}/kg offered • ৳${listing.forwardContractOffer.escrowAmountBDT} escrow advance`,
                                `৳${listing.forwardContractOffer.offeredPrice}/কেজি প্রস্তাব • ৳${listing.forwardContractOffer.escrowAmountBDT} এসক্রো অগ্রিম`
                              )}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSignContract(listing)}
                          disabled={listing.status === 'Pre-contracted'}
                          className={`text-xs font-bold px-4 py-2 rounded-xl transition-all flex-shrink-0 flex items-center gap-1.5 ${
                            listing.status === 'Pre-contracted'
                              ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                              : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {listing.status === 'Pre-contracted' ? t('Contracted ✓', 'চুক্তি সম্পন্ন ✓') : t('Lock Contract', 'চুক্তি পাকা করুন')}
                        </button>
                      </div>
                    )}

                    {listing.fertilizerNeeded && listing.fertilizerNeeded.length > 0 && (
                      <div className="text-xs text-stone-600">
                        <span className="font-semibold text-stone-800">{t('Inputs needed: ', 'প্রয়োজনীয় উপকরণ: ')}</span>
                        {listing.fertilizerNeeded.join(' • ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ─── TAB: INPUTS ─── */}
      {activeTab === 'inputs' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {suppliers.map(sup => (
            <div key={sup.id} className="card p-4 hover:shadow-md transition-all">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className={`badge badge-amber text-[10px] mb-2`}>{sup.category}</span>
                  <h4 className="font-bold text-stone-900 text-sm mt-0.5">{t(sup.name, sup.banglaName)}</h4>
                  <p className="text-xs text-stone-500">{sup.shopName}</p>
                  <p className="text-xs text-stone-500 mt-0.5">Brand: {sup.brand}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xl font-extrabold text-stone-900">৳{sup.unitPriceBDT}</span>
                  <span className="text-xs text-stone-500 block">/{sup.unit}</span>
                  <div className="flex items-center gap-0.5 justify-end mt-1">
                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-semibold text-stone-700">{sup.rating}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100 text-xs">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <MapPin className="w-3 h-3" />{sup.distanceKm} km {t('away', 'দূরে')}
                </span>
                <span className={`font-semibold ${sup.inStock ? 'text-emerald-600' : 'text-red-500'}`}>
                  {sup.inStock ? (sup.stockQty ? `${sup.stockQty} in stock` : t('In Stock', 'স্টকে আছে')) : t('Out of Stock', 'স্টকে নেই')}
                </span>
                <a href={`tel:${sup.phone}`} className="flex items-center gap-1 text-stone-700 hover:text-emerald-700 font-semibold">
                  <Phone className="w-3 h-3" />{sup.phone}
                </a>
              </div>
              <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-between">
                <span className="text-[11px] text-stone-500">{t('Direct Dealer Dispatch', 'সরাসরি ডিলার ডেলিভারি')}</span>
                <button
                  type="button"
                  onClick={() => {
                    const newOrder: TradeOrder = {
                      id: `ORD-SUP-${Date.now().toString().slice(-4)}`,
                      orderType: 'supplier_input',
                      buyerId: currentUser.id,
                      buyerName: currentUser.name,
                      buyerPhone: currentUser.phone,
                      buyerEmail: currentUser.email,
                      buyerRole: 'farmer',
                      sellerId: sup.supplierId || 'sup-1',
                      sellerName: sup.shopName,
                      sellerPhone: sup.phone,
                      sellerRole: 'supplier',
                      title: sup.name,
                      titleBn: sup.banglaName,
                      items: [
                        {
                          itemId: sup.id,
                          itemName: sup.name,
                          itemBangla: sup.banglaName,
                          category: sup.category,
                          unitPrice: sup.unitPriceBDT,
                          unit: sup.unit,
                          quantity: 2,
                          subtotal: sup.unitPriceBDT * 2,
                        },
                      ],
                      totalBDT: sup.unitPriceBDT * 2,
                      paymentMethod: 'bKash',
                      deliveryAddress: `${currentUser.upazila || 'Shibganj'}, ${currentUser.district || 'Bogura'}`,
                      district: currentUser.district || 'Bogura',
                      upazila: currentUser.upazila || 'Shibganj',
                      status: 'Confirmed',
                      createdAt: new Date().toISOString(),
                    };
                    TradeOrderStore.add(newOrder);
                    NotificationStore.addSystemNotif(
                      currentUser.id,
                      t('Supplier Order Placed!', 'উপকরণ ক্রয়াদেশ পাঠানো হয়েছে!'),
                      t(
                        `Order placed for 2 ${sup.unit} of ${sup.name} from ${sup.shopName}. Check Orders tab.`,
                        `${sup.shopName} থেকে ২ ${sup.unit} ${sup.banglaName} ক্রয়াদেশ সফল হয়েছে। অর্ডার ট্যাবে দেখুন।`
                      ),
                      'success'
                    );
                    alert(t(`✓ Order successfully placed for 2 ${sup.unit} of ${sup.name}! Track in Orders & Settlements tab.`, `✓ ${sup.banglaName}-এর ক্রয়াদেশ সফল হয়েছে! অর্ডার ও লেনদেন ট্যাবে ট্র্যাক করুন।`));
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>{t('Order from Supplier', 'ক্রয়াদেশ দিন')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── TAB: NEGOTIATIONS ─── */}
      {activeTab === 'negotiations' && (
        <div className="space-y-3">
          {negotiations.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><MessageSquare className="w-8 h-8" /></div>
              <h3 className="font-bold text-stone-700">{t('No offers yet', 'এখনো কোনো প্রস্তাব নেই')}</h3>
              <p className="text-sm text-stone-400">{t('Buyer offers will appear here once your listing is active', 'তালিকা সক্রিয় হলে ক্রেতাদের প্রস্তাব এখানে দেখাবে')}</p>
            </div>
          ) : negotiations.map(neg => {
            const listing = listings.find(l => l.id === neg.listingId);
            return (
              <div key={neg.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-stone-900 text-sm">{neg.buyerName}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{listing ? t(listing.cropName, listing.cropBangla) : 'Unknown listing'}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="font-bold text-emerald-700 text-base">৳{neg.offeredPricePerKg}/kg</span>
                      <span className="text-stone-500">{neg.quantityKg}kg</span>
                      <span className="badge-info badge">
                        ৳{(neg.offeredPricePerKg * neg.quantityKg).toLocaleString()} total
                      </span>
                    </div>
                    {neg.message && <p className="text-xs text-stone-600 mt-2 italic">"{neg.message}"</p>}
                  </div>
                  <div className="flex-shrink-0">
                    {neg.status === 'Pending' ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleNegotiationResponse(neg, 'Accepted')}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                          {t('Accept', 'গ্রহণ')}
                        </button>
                        <button onClick={() => handleNegotiationResponse(neg, 'Rejected')}
                          className="px-3 py-1.5 bg-stone-100 text-stone-700 text-xs font-bold rounded-lg hover:bg-red-50 hover:text-red-700 transition-colors">
                          {t('Decline', 'প্রত্যাখ্যান')}
                        </button>
                      </div>
                    ) : (
                      <span className={`badge ${neg.status === 'Accepted' ? 'badge-success' : 'badge-danger'}`}>
                        {neg.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── TAB: LEDGER ─── */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t('Total Income', 'মোট আয়'), value: `৳${totalIncome.toLocaleString()}`, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
              { label: t('Total Expense', 'মোট খরচ'), value: `৳${totalExpenses.toLocaleString()}`, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
              { label: t('Net Profit', 'নিট লাভ'), value: `৳${Math.abs(netProfit).toLocaleString()}`, color: netProfit >= 0 ? 'text-emerald-700' : 'text-red-700', bg: 'bg-stone-50 border-stone-200' },
            ].map((s, i) => (
              <div key={i} className={`p-3 rounded-xl border ${s.bg} text-center`}>
                <p className="text-[11px] text-stone-500 font-semibold">{s.label}</p>
                <p className={`text-lg font-extrabold mt-0.5 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-900">{t('Expense Records', 'খরচের রেকর্ড')}</h3>
            <button onClick={() => setShowLedgerModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors">
              <PlusCircle className="w-3.5 h-3.5" />
              {t('Add Entry', 'এন্ট্রি যোগ করুন')}
            </button>
          </div>

          {ledgerEntries.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><Wallet className="w-8 h-8" /></div>
              <p className="text-stone-500 text-sm">{t('No ledger entries yet. Track your farm expenses and income here.', 'এখনো কোনো লেজার এন্ট্রি নেই। এখানে খরচ ও আয় ট্র্যাক করুন।')}</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Date', 'তারিখ')}</th>
                    <th>{t('Category', 'বিভাগ')}</th>
                    <th>{t('Description', 'বিবরণ')}</th>
                    <th className="text-right">{t('Amount', 'পরিমাণ')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEntries.map(entry => (
                    <tr key={entry.id}>
                      <td className="text-xs">{entry.date}</td>
                      <td><span className="badge badge-info text-[10px]">{entry.category}</span></td>
                      <td className="text-xs text-stone-700">{entry.description}</td>
                      <td className={`text-right font-bold text-sm ${entry.type === 'income' ? 'text-emerald-700' : 'text-red-600'}`}>
                        {entry.type === 'income' ? '+' : '-'}৳{entry.amountBDT.toLocaleString()}
                      </td>
                      <td>
                        <button onClick={() => { ExpenseStore.delete(entry.id); loadData(); }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── ADD LISTING MODAL ─── */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-600" />
                {t('List Upcoming Harvest', 'আগাম ফসল তালিকাভুক্ত করুন')}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddListing} className="space-y-4">
              <div>
                <label className="field-label">{t('Crop & Variety', 'ফসলের নাম ও জাত')}</label>
                <select
                  value={form.cropName}
                  onChange={e => {
                    const opt = CROP_OPTIONS.find(o => o.en === e.target.value);
                    setForm(f => ({ ...f, cropName: e.target.value, cropBangla: opt?.bn || e.target.value, imageUrl: opt?.img || f.imageUrl }));
                  }}
                  className="field-input"
                >
                  {CROP_OPTIONS.map(o => <option key={o.en} value={o.en}>{o.en} / {o.bn}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="field-label">{t('Quantity (kg)', 'পরিমাণ (কেজি)')}</label>
                  <input type="number" min="1" value={form.quantityKg}
                    onChange={e => setForm(f => ({ ...f, quantityKg: Number(e.target.value) }))}
                    className="field-input" required />
                </div>
                <div>
                  <label className="field-label">{t('Ready in (days)', 'কত দিনে?')}</label>
                  <input type="number" min="1" max="90" value={form.daysToHarvest}
                    onChange={e => setForm(f => ({ ...f, daysToHarvest: Number(e.target.value) }))}
                    className="field-input" required />
                </div>
                <div>
                  <label className="field-label">{t('Grade', 'গ্রেড')}</label>
                  <select value={form.qualityGrade} onChange={e => setForm(f => ({ ...f, qualityGrade: e.target.value as 'A' | 'B' | 'C' }))} className="field-input">
                    <option value="A">Grade A (Premium)</option>
                    <option value="B">Grade B (Standard)</option>
                    <option value="C">Grade C (Economy)</option>
                  </select>
                </div>
              </div>

              {/* AI Price Predictor */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    {t('AI Price & Demand Forecast', 'এআই দর ও চাহিদা পূর্বাভাস')}
                  </span>
                  <button type="button" onClick={handlePredictPrice} disabled={isPredicting}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5">
                    {isPredicting ? <><RefreshCw className="w-3 h-3 animate-spin" />{t('Predicting...', 'বিশ্লেষণ...')}</> : t('Predict', 'পূর্বাভাস নিন')}
                  </button>
                </div>
                {aiPrediction && (
                  <div className="mt-2.5 pt-2.5 border-t border-emerald-200 text-xs space-y-1 animate-slide-down">
                    <div className="flex justify-between font-bold">
                      <span className="text-emerald-900">{t('Recommended Price:', 'প্রস্তাবিত দর:')}</span>
                      <span className="text-emerald-800 text-sm">৳{aiPrediction.expectedPriceRangeBDT.recommendedWholesale}/kg</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-stone-500">{t('Demand level:', 'চাহিদার স্তর:')}</span>
                      <span className={`font-bold ${aiPrediction.demandLevel === 'High' ? 'text-emerald-700' : aiPrediction.demandLevel === 'Medium' ? 'text-amber-700' : 'text-red-700'}`}>{aiPrediction.demandLevel}</span>
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">{aiPrediction.buyerRecommendation}</p>
                    {aiPrediction.keyRiskFactor && (
                      <p className="text-[11px] text-amber-700 flex items-start gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />{aiPrediction.keyRiskFactor}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="field-label">{t('Your Target Price (৳/kg)', 'আপনার কাঙ্ক্ষিত দর (৳/কেজি)')}</label>
                <input type="number" min="1" value={form.expectedPrice}
                  onChange={e => setForm(f => ({ ...f, expectedPrice: Number(e.target.value) }))}
                  className="field-input" required />
              </div>

              <div>
                <label className="field-label">{t('Required Inputs / Fertilizers (comma-separated)', 'প্রয়োজনীয় সার/কীটনাশক (কমা দিয়ে আলাদা)')}</label>
                <input type="text" value={form.fertilizerNeeded}
                  onChange={e => setForm(f => ({ ...f, fertilizerNeeded: e.target.value }))}
                  placeholder="MOP Potash, Urea, Mancozeb"
                  className="field-input" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors">
                  {t('Cancel', 'বাতিল')}
                </button>
                <button type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-xl transition-colors shadow-sm flex items-center gap-2">
                  <Sprout className="w-4 h-4" />
                  {t('List & Find Buyers', 'তালিকাভুক্ত করুন ও ক্রেতা খুঁজুন')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADD LEDGER MODAL ─── */}
      {showLedgerModal && (
        <div className="modal-overlay">
          <div className="modal-box max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-600" />
                {t('Add Ledger Entry', 'লেজার এন্ট্রি যোগ করুন')}
              </h3>
              <button onClick={() => setShowLedgerModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddLedgerEntry} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">{t('Type', 'ধরন')}</label>
                  <select value={ledgerForm.type} onChange={e => setLedgerForm(f => ({ ...f, type: e.target.value as 'expense' | 'income' }))} className="field-input">
                    <option value="expense">{t('Expense', 'খরচ')}</option>
                    <option value="income">{t('Income', 'আয়')}</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">{t('Category', 'বিভাগ')}</label>
                  <select value={ledgerForm.category} onChange={e => setLedgerForm(f => ({ ...f, category: e.target.value as ExpenseLedgerEntry['category'] }))} className="field-input">
                    {['Fertilizer','Pesticide','Seeds','Labor','Irrigation','Transport','Sale','Other'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">{t('Description', 'বিবরণ')}</label>
                <input type="text" value={ledgerForm.description} onChange={e => setLedgerForm(f => ({ ...f, description: e.target.value }))} className="field-input" required placeholder={t('e.g. Bought MOP fertilizer', 'যেমন: এমওপি সার কেনা')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label">{t('Amount (৳)', 'পরিমাণ (৳)')}</label>
                  <input type="number" min="1" value={ledgerForm.amountBDT || ''} onChange={e => setLedgerForm(f => ({ ...f, amountBDT: Number(e.target.value) }))} className="field-input" required />
                </div>
                <div>
                  <label className="field-label">{t('Date', 'তারিখ')}</label>
                  <input type="date" value={ledgerForm.date} onChange={e => setLedgerForm(f => ({ ...f, date: e.target.value }))} className="field-input" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button type="button" onClick={() => setShowLedgerModal(false)} className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl">
                  {t('Cancel', 'বাতিল')}
                </button>
                <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> {t('Save Entry', 'সংরক্ষণ করুন')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
