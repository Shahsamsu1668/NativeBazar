import React, { useState } from 'react';
import { User, Language, UserRole } from '../types';
import { BANGLADESH_LOCATIONS } from '../data/mockData';
import { AuthStore, CropStore, DemandStore, SupplierStore, OrderStore, TradeOrderStore } from '../data/store';
import {
  X,
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  ShieldCheck,
  Calendar,
  CheckCircle2,
  Edit3,
  Save,
  Sprout,
  Briefcase,
  Store,
  ShoppingCart,
  Microscope,
  Award,
  Key,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
  language: Language;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  language,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone);
  const [district, setDistrict] = useState(currentUser.district || 'Bogura');
  const [upazila, setUpazila] = useState(currentUser.upazila || '');
  const [education, setEducation] = useState(
    currentUser.education || 'B.Sc in Agriculture (BAU, Mymensingh)'
  );

  // Role-specific fields
  const [farmSizeAcres, setFarmSizeAcres] = useState(
    currentUser.farmSizeAcres || 4.5
  );
  const [businessName, setBusinessName] = useState(
    currentUser.businessName || 'Bogura Agro Trading Corp'
  );
  const [shopName, setShopName] = useState(
    currentUser.shopName || 'Bismillah Krishi Bitan'
  );
  const [licenseNumber, setLicenseNumber] = useState(
    currentUser.licenseNumber || 'DAE-SUP-2024-992'
  );
  const [designation, setDesignation] = useState(
    currentUser.designation || 'Upazila Agricultural Officer (UAO)'
  );
  const [institution, setInstitution] = useState(
    currentUser.institution || 'Department of Agricultural Extension (DAE)'
  );

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // Available upazilas for current selected district
  const selectedLocation = BANGLADESH_LOCATIONS.find(
    (l) => l.district.toLowerCase() === district.toLowerCase()
  );
  const upazilas = selectedLocation ? selectedLocation.upazilas : [];

  // Calculate live user-specific stats
  const roleStats = (() => {
    switch (currentUser.role) {
      case 'farmer': {
        const crops = CropStore.getByFarmer(currentUser.id);
        const myOrders = TradeOrderStore.getAll().filter(
          (o) => o.buyerId === currentUser.id || o.sellerId === currentUser.id
        );
        return {
          metric1: `${crops.length} Active Listings`,
          metric1Bn: `${crops.length} টি সক্রিয় শস্য তালিকা`,
          metric2: `${crops.reduce((s, c) => s + c.quantityKg, 0).toLocaleString()} kg Harvest Volume`,
          metric2Bn: `${crops.reduce((s, c) => s + c.quantityKg, 0).toLocaleString()} কেজি মোট ফসল`,
          metric3: `${myOrders.length} B2B Trade Contracts`,
          metric3Bn: `${myOrders.length} টি বাণিজ্যিক চুক্তি`,
        };
      }
      case 'businessman': {
        const demands = DemandStore.getByBuyer(currentUser.id);
        const tradeOrders = TradeOrderStore.getAll().filter(
          (o) => o.buyerId === currentUser.id
        );
        return {
          metric1: `${demands.length} Procurement Demands`,
          metric1Bn: `${demands.length} টি ক্রয়াভিপ্রায় চাহিদা`,
          metric2: `${tradeOrders.length} Trade Orders Executed`,
          metric2Bn: `${tradeOrders.length} টি পাইকারি অর্ডার`,
          metric3: `৳${tradeOrders.reduce((s, o) => s + o.totalBDT, 0).toLocaleString()} Volume Traded`,
          metric3Bn: `৳${tradeOrders.reduce((s, o) => s + o.totalBDT, 0).toLocaleString()} মোট লেনদেন`,
        };
      }
      case 'supplier': {
        const products = SupplierStore.getBySupplierId(currentUser.id);
        const supplierOrders = TradeOrderStore.getAll().filter(
          (o) => o.sellerId === currentUser.id
        );
        return {
          metric1: `${products.length} Catalog Items`,
          metric1Bn: `${products.length} টি ইনপুট পণ্য`,
          metric2: `${supplierOrders.length} Orders Fulfilled`,
          metric2Bn: `${supplierOrders.length} টি অর্ডার সরবরাহকৃত`,
          metric3: 'Authorized Distributor',
          metric3Bn: 'অনুমোদিত ডিলার সনদপ্রাপ্ত',
        };
      }
      case 'customer': {
        const customerOrders = OrderStore.getByCustomer(currentUser.id);
        return {
          metric1: `${customerOrders.length} Farm-to-Table Orders`,
          metric1Bn: `${customerOrders.length} টি অর্ডার সফল`,
          metric2: 'Verified Consumer',
          metric2Bn: 'যাচাইকৃত পরিবারের ভোক্তা',
          metric3: 'Express Delivery Hub',
          metric3Bn: 'দ্রুত হোম ডেলিভারি অন্তর্ভুক্ত',
        };
      }
      case 'expert': {
        return {
          metric1: 'Agronomy Specialist',
          metric1Bn: 'উদ্ভিদ ও মৃত্তিকা বিশেষজ্ঞ',
          metric2: 'AI Diagnosis Overseer',
          metric2Bn: 'এআই প্রেসক্রিপশন নিরীক্ষক',
          metric3: 'Official DAE Liaison',
          metric3Bn: 'কৃষি সম্প্রসারণ অধিদপ্তর কর্মকর্তা',
        };
      }
      case 'admin': {
        return {
          metric1: 'Clearance Level 4 Root',
          metric1Bn: 'সর্বোচ্চ প্রশাসনিক সিকিউরিটি লেভেল-৪',
          metric2: 'Dual-Factor 2FA Active',
          metric2Bn: 'টু-ফ্যাক্টর নিরাপত্তা সক্রিয়',
          metric3: 'Encrypted Telemetry Node',
          metric3Bn: 'এনক্রিপ্টেড ডাটা সেন্টার নোড',
        };
      }
    }
  })();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const updates: Partial<User> = {
      name,
      email,
      phone,
      district,
      upazila: upazila || (upazilas[0] || 'Bogura Sadar'),
      education,
      farmSizeAcres: currentUser.role === 'farmer' ? farmSizeAcres : undefined,
      businessName: currentUser.role === 'businessman' ? businessName : undefined,
      shopName: currentUser.role === 'supplier' ? shopName : undefined,
      licenseNumber: currentUser.role === 'supplier' ? licenseNumber : undefined,
      designation: currentUser.role === 'expert' ? designation : undefined,
      institution: currentUser.role === 'expert' ? institution : undefined,
    };

    const updated = AuthStore.updateProfile(updates);
    setSaving(false);

    if (updated) {
      onUpdateUser(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditing(false);
      }, 1200);
    }
  };

  const roleBadgeInfo: Record<
    UserRole,
    { labelEn: string; labelBn: string; color: string; icon: React.ReactNode }
  > = {
    farmer: {
      labelEn: 'Farmer (কৃষক)',
      labelBn: 'কৃষক',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: <Sprout className="w-3.5 h-3.5 text-emerald-700" />,
    },
    businessman: {
      labelEn: 'Wholesale Trader / Buyer',
      labelBn: 'ব্যবসায়ী ও পাইকার',
      color: 'bg-blue-100 text-blue-800 border-blue-300',
      icon: <Briefcase className="w-3.5 h-3.5 text-blue-700" />,
    },
    supplier: {
      labelEn: 'Agro Input Supplier',
      labelBn: 'কৃষি উপকরণ ডিলার',
      color: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: <Store className="w-3.5 h-3.5 text-amber-700" />,
    },
    customer: {
      labelEn: 'Household Consumer',
      labelBn: 'ভোক্তা',
      color: 'bg-purple-100 text-purple-800 border-purple-300',
      icon: <ShoppingCart className="w-3.5 h-3.5 text-purple-700" />,
    },
    expert: {
      labelEn: 'Agronomy Specialist',
      labelBn: 'কৃষি সম্প্রসারণ কর্মকর্তা',
      color: 'bg-teal-100 text-teal-800 border-teal-300',
      icon: <Microscope className="w-3.5 h-3.5 text-teal-700" />,
    },
    admin: {
      labelEn: 'Central Platform Administrator',
      labelBn: 'সিস্টেম অ্যাডমিনিস্ট্রেটর',
      color: 'bg-slate-200 text-slate-800 border-slate-300',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-slate-700" />,
    },
  };

  const badge = roleBadgeInfo[currentUser.role] || roleBadgeInfo.farmer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200">
        {/* Header Ribbon */}
        <div className="relative p-6 bg-gradient-to-r from-emerald-800 via-teal-900 to-stone-900 text-white rounded-t-3xl">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-2xl font-black shadow-lg">
              {currentUser.name.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                  {currentUser.name}
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/30 border border-emerald-400 text-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  {t('Verified Member', 'যাচাইকৃত সদস্য')}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-emerald-200">
                <span className="inline-flex items-center gap-1 font-semibold">
                  {badge.icon}
                  {t(badge.labelEn, badge.labelBn)}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {currentUser.upazila ? `${currentUser.upazila}, ` : ''}
                  {currentUser.district}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2 text-xs text-emerald-800 animate-slide-down">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {t(
                  'Profile details updated successfully!',
                  'আপনার প্রোফাইলের তথ্য সফলভাবে সংরক্ষিত হয়েছে!'
                )}
              </span>
            </div>
          )}

          {/* Quick Role Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                {t('Status / Capacity', 'সক্ষমতা / বিবরণ')}
              </span>
              <p className="text-xs font-black text-stone-800">
                {language === 'bn' ? roleStats.metric1Bn : roleStats.metric1}
              </p>
            </div>
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                {t('Agricultural Activity', 'কার্যক্রম')}
              </span>
              <p className="text-xs font-black text-stone-800">
                {language === 'bn' ? roleStats.metric2Bn : roleStats.metric2}
              </p>
            </div>
            <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                {t('Trade Status', 'বাণিজ্য স্ট্যাটাস')}
              </span>
              <p className="text-xs font-black text-stone-800">
                {language === 'bn' ? roleStats.metric3Bn : roleStats.metric3}
              </p>
            </div>
          </div>

          {/* Edit Mode Toggle */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-3">
            <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-600" />
              <span>{t('Personal & Registration Information', 'ব্যক্তিগত ও নিবন্ধন সংক্রান্ত তথ্য')}</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isEditing ? t('Cancel Editing', 'বাতিল') : t('Edit Profile', 'তথ্য পরিবর্তন')}</span>
            </button>
          </div>

          {/* Form / Details View */}
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Full Name', 'পূর্ণ নাম')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-emerald-600"
                  />
                ) : (
                  <p className="p-2.5 bg-stone-50 rounded-xl font-bold text-stone-900">
                    {currentUser.name}
                  </p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  {t('Email Address', 'ইমেইল ঠিকানা')}
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-emerald-600"
                  />
                ) : (
                  <p className="p-2.5 bg-stone-50 rounded-xl font-mono text-stone-800">
                    {currentUser.email || `${currentUser.role}@nativebazar.gov.bd`}
                  </p>
                )}
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-stone-400" />
                  {t('Mobile Number', 'মোবাইল নম্বর')}
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-emerald-600"
                  />
                ) : (
                  <p className="p-2.5 bg-stone-50 rounded-xl font-mono text-stone-800">
                    {currentUser.phone}
                  </p>
                )}
              </div>

              {/* Role Display */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Assigned Role', 'ব্যবহারকারী ভূমিকা')}
                </label>
                <div className="p-2.5 bg-stone-50 rounded-xl flex items-center justify-between">
                  <span className="font-bold text-stone-900 uppercase tracking-wide">
                    {currentUser.role}
                  </span>
                  <span className="text-[10px] bg-stone-200 text-stone-700 px-2 py-0.5 rounded-full font-bold">
                    {t('Fixed Access', 'স্থির রোল')}
                  </span>
                </div>
              </div>

              {/* District */}
              <div>
                <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-stone-400" />
                  {t('District', 'জেলা')}
                </label>
                {isEditing ? (
                  <select
                    value={district}
                    onChange={(e) => {
                      setDistrict(e.target.value);
                      const loc = BANGLADESH_LOCATIONS.find(
                        (l) => l.district.toLowerCase() === e.target.value.toLowerCase()
                      );
                      if (loc && loc.upazilas.length > 0) {
                        setUpazila(loc.upazilas[0]);
                      }
                    }}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-emerald-600"
                  >
                    {BANGLADESH_LOCATIONS.map((loc) => (
                      <option key={loc.district} value={loc.district}>
                        {loc.district} ({loc.districtBn})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="p-2.5 bg-stone-50 rounded-xl font-bold text-stone-800">
                    {currentUser.district}
                  </p>
                )}
              </div>

              {/* Upazila */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Upazila / Area', 'উপজেলা / এলাকা')}
                </label>
                {isEditing ? (
                  <select
                    value={upazila}
                    onChange={(e) => setUpazila(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-emerald-600"
                  >
                    {upazilas.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="p-2.5 bg-stone-50 rounded-xl font-medium text-stone-800">
                    {currentUser.upazila || t('Not specified', 'উল্লেখ নেই')}
                  </p>
                )}
              </div>

              {/* Education / Qualification */}
              <div className="sm:col-span-2">
                <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-stone-400" />
                  {t('Education / Agricultural Qualification', 'শিক্ষাগত যোগ্যতা / কৃষি প্রশিক্ষণ')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="e.g. B.Sc in Agriculture / DAE Certified Diploma"
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium focus:outline-emerald-600"
                  />
                ) : (
                  <p className="p-2.5 bg-stone-50 rounded-xl font-semibold text-stone-800">
                    {education}
                  </p>
                )}
              </div>

              {/* Role Specific Extras */}
              {currentUser.role === 'farmer' && (
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Farm Size (Acres)', 'জমির পরিমাণ (একর)')}
                  </label>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.1"
                      value={farmSizeAcres}
                      onChange={(e) => setFarmSizeAcres(parseFloat(e.target.value) || 0)}
                      className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-emerald-600"
                    />
                  ) : (
                    <p className="p-2.5 bg-stone-50 rounded-xl font-mono font-bold text-stone-800">
                      {farmSizeAcres} Acres
                    </p>
                  )}
                </div>
              )}

              {currentUser.role === 'businessman' && (
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Business / Enterprise Name', 'প্রতিষ্ঠানের নাম')}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-emerald-600"
                    />
                  ) : (
                    <p className="p-2.5 bg-stone-50 rounded-xl font-bold text-stone-800">
                      {businessName}
                    </p>
                  )}
                </div>
              )}

              {currentUser.role === 'supplier' && (
                <>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Agro Input Shop Name', 'দোকান / প্রতিষ্ঠানের নাম')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-emerald-600"
                      />
                    ) : (
                      <p className="p-2.5 bg-stone-50 rounded-xl font-bold text-stone-800">
                        {shopName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Trade License / Registration', 'ট্রেড লাইসেন্স নম্বর')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-emerald-600"
                      />
                    ) : (
                      <p className="p-2.5 bg-stone-50 rounded-xl font-mono text-stone-800">
                        {licenseNumber}
                      </p>
                    )}
                  </div>
                </>
              )}

              {currentUser.role === 'expert' && (
                <>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Official Designation', 'পদবি')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-emerald-600"
                      />
                    ) : (
                      <p className="p-2.5 bg-stone-50 rounded-xl font-bold text-stone-800">
                        {designation}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Institution / Department', 'প্রতিষ্ঠান')}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-emerald-600"
                      />
                    ) : (
                      <p className="p-2.5 bg-stone-50 rounded-xl text-stone-800">
                        {institution}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Registration Date */}
              <div>
                <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  {t('Member Registration Date', 'নিবন্ধনের তারিখ')}
                </label>
                <p className="p-2.5 bg-stone-50 rounded-xl font-mono text-stone-700">
                  {new Date(currentUser.createdAt || '2026-01-15').toLocaleDateString(
                    language === 'bn' ? 'bn-BD' : 'en-US',
                    { year: 'numeric', month: 'long', day: 'numeric' }
                  )}
                </p>
              </div>

              {/* Active Session & Security Token */}
              <div>
                <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-stone-400" />
                  {t('Session Security Clearance', 'সিকিউরিটি সেশন')}
                </label>
                <div className="p-2.5 bg-stone-50 rounded-xl flex items-center justify-between">
                  <span className="font-mono text-[11px] text-emerald-800 font-bold">
                    {currentUser.sessionToken ? 'Active Encrypted Token' : 'Verified'}
                  </span>
                  <span className="text-[10px] text-stone-400">SHA-256 Salted</span>
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 font-bold hover:bg-stone-100 transition-colors"
                >
                  {t('Cancel', 'বাতিল')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? t('Saving...', 'সংরক্ষণ হচ্ছে...') : t('Save Changes', 'সংরক্ষণ করুন')}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
