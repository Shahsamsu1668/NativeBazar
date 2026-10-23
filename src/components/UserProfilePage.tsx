import React, { useState, useMemo } from 'react';
import { User, Language, UserRole } from '../types';
import {
  AuthStore,
  CropStore,
  DemandStore,
  SupplierStore,
  OrderStore,
  TradeOrderStore,
  AdvisoryStore,
  ConnectionStore,
} from '../data/store';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Calendar,
  CheckCircle2,
  Edit3,
  Save,
  X,
  Sprout,
  Briefcase,
  Store,
  ShoppingCart,
  Microscope,
  ShieldCheck,
  Award,
  Package,
  TrendingUp,
  Clock,
  Star,
  Activity,
  Leaf,
  BarChart3,
  FileText,
  ShoppingBag,
  MessageSquare,
  Hash,
  BookOpen,
  Layers,
  BadgeCheck,
  AlertTriangle,
  ChevronRight,
  Users,
  Zap,
  PhoneCall,
  UserPlus,
  UserCheck,
} from 'lucide-react';

interface UserProfilePageProps {
  user: User;
  currentUser: User | null;
  language: Language;
  onBack: () => void;
  onUpdateUser?: (updated: User) => void;
  onViewUser?: (user: User) => void;
  onMessageUser?: (targetUser: User) => void;
  onCallUser?: (targetUser: User) => void;
}

const roleConfig: Record<
  UserRole,
  { color: string; bg: string; border: string; icon: React.ReactNode; label: string; labelBn: string }
> = {
  farmer: {
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: <Sprout className="w-5 h-5" />,
    label: 'Farmer',
    labelBn: 'কৃষক',
  },
  wholesaler: {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Briefcase className="w-5 h-5" />,
    label: 'Wholesaler',
    labelBn: 'পাইকার',
  },
  retailer: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <Store className="w-5 h-5" />,
    label: 'Retailer',
    labelBn: 'খুচরা বিক্রেতা',
  },
  consumer: {
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: <ShoppingCart className="w-5 h-5" />,
    label: 'Consumer',
    labelBn: 'ভোক্তা',
  },
  businessman: {
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: <Briefcase className="w-5 h-5" />,
    label: 'Wholesaler',
    labelBn: 'ব্যবসায়ী',
  },
  supplier: {
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: <Store className="w-5 h-5" />,
    label: 'Retailer',
    labelBn: 'সরবরাহকারী',
  },
  customer: {
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: <ShoppingCart className="w-5 h-5" />,
    label: 'Consumer',
    labelBn: 'ভোক্তা',
  },
  expert: {
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    icon: <Microscope className="w-5 h-5" />,
    label: 'Agri Expert',
    labelBn: 'কৃষি বিশেষজ্ঞ',
  },
  admin: {
    color: 'text-slate-700',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: <ShieldCheck className="w-5 h-5" />,
    label: 'Admin',
    labelBn: 'অ্যাডমিন',
  },
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatBDT(amount: number) {
  return `৳${amount.toLocaleString('en-IN')}`;
}

type TabId = 'overview' | 'activity' | 'orders' | 'edit';

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-2 pb-2 border-b border-stone-200 mb-3">
    {icon}
    <h3 className="text-sm font-bold text-stone-800">{title}</h3>
  </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="py-8 text-center text-stone-400 text-sm">
    <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
    {message}
  </div>
);

const InfoCard: React.FC<{ label: string; value: string; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs">
    <span className="shrink-0">{icon}</span>
    <div>
      <span className="text-stone-400 text-[11px] block">{label}</span>
      <span className="font-bold text-stone-800">{value}</span>
    </div>
  </div>
);

const EditField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
}> = ({ label, value, onChange, disabled, type = 'text' }) => (
  <div>
    <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-xl bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:bg-stone-50 disabled:text-stone-500 disabled:cursor-not-allowed transition-all"
    />
  </div>
);

export const UserProfilePage: React.FC<UserProfilePageProps> = ({
  user,
  currentUser,
  language,
  onBack,
  onUpdateUser,
  onViewUser,
  onMessageUser,
  onCallUser,
}) => {
  const isOwnProfile = currentUser ? currentUser.id === user.id : false;
  const isAdmin = currentUser ? currentUser.role === 'admin' : false;
  const canEdit = isOwnProfile || isAdmin;

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editPhone, setEditPhone] = useState(user.phone);
  const [editDistrict, setEditDistrict] = useState(user.district || 'Bogura');
  const [editEducation, setEditEducation] = useState(user.education || '');
  const [editFarmSize, setEditFarmSize] = useState(user.farmSizeAcres || 4.5);
  const [editBusinessName, setEditBusinessName] = useState(user.businessName || '');
  const [editShopName, setEditShopName] = useState(user.shopName || '');
  const [editDesignation, setEditDesignation] = useState(user.designation || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [connStatus, setConnStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>(
    currentUser ? ConnectionStore.getStatus(currentUser.id, user.id) : 'none'
  );

  const handleConnectToggle = () => {
    if (!currentUser) return;
    if (connStatus === 'none') {
      ConnectionStore.sendRequest(currentUser, user);
      setConnStatus('pending_sent');
    } else {
      ConnectionStore.remove(currentUser.id, user.id);
      setConnStatus('none');
    }
  };

  const cropListings = useMemo(() => CropStore.getAll().filter((c) => c.farmerId === user.id), [user.id]);
  const businessDemands = useMemo(() => DemandStore.getAll().filter((d) => d.buyerId === user.id), [user.id]);
  const supplierProducts = useMemo(() => SupplierStore.getAll().filter((p) => p.supplierId === user.id), [user.id]);
  const orders = useMemo(() => OrderStore.getAll().filter((o) => o.customerId === user.id), [user.id]);
  const tradeOrders = useMemo(() => TradeOrderStore.getByUser(user.id), [user.id]);
  const advisories = useMemo(() => AdvisoryStore.getAll().filter((a) => a.expertId === user.id), [user.id]);
  const auditLogs = useMemo(
    () => AuthStore.getAuditLogs().filter((l) => l.phone === user.phone || l.phone === user.email),
    [user.phone, user.email]
  );
  const allUsers = useMemo(() => (isAdmin ? AuthStore.getUsers() : []), [isAdmin]);

  const rc = roleConfig[user.role];

  const stats = useMemo(() => {
    if (user.role === 'farmer') {
      const totalRevenue = cropListings.reduce((s, c) => s + c.expectedPricePerKg * c.quantityKg, 0);
      return [
        { label: language === 'bn' ? 'ফসলের তালিকা' : 'Crop Listings', value: cropListings.length, icon: <Leaf className="w-4 h-4" />, color: 'text-emerald-600' },
        { label: language === 'bn' ? 'সম্ভাব্য আয়' : 'Expected Revenue', value: formatBDT(totalRevenue), icon: <TrendingUp className="w-4 h-4" />, color: 'text-blue-600' },
        { label: language === 'bn' ? 'জমির আকার' : 'Farm Size', value: `${user.farmSizeAcres || editFarmSize} acres`, icon: <MapPin className="w-4 h-4" />, color: 'text-amber-600' },
        { label: language === 'bn' ? 'ট্রেড অর্ডার' : 'Trade Orders', value: tradeOrders.length, icon: <Package className="w-4 h-4" />, color: 'text-purple-600' },
      ];
    } else if (user.role === 'businessman') {
      const totalDemandValue = businessDemands.reduce((s, d) => s + d.targetPricePerKg * d.quantityKgNeeded, 0);
      return [
        { label: language === 'bn' ? 'চাহিদার তালিকা' : 'Purchase Demands', value: businessDemands.length, icon: <FileText className="w-4 h-4" />, color: 'text-blue-600' },
        { label: language === 'bn' ? 'মোট ক্রয় মূল্য' : 'Total Buy Value', value: formatBDT(totalDemandValue), icon: <BarChart3 className="w-4 h-4" />, color: 'text-emerald-600' },
        { label: language === 'bn' ? 'ব্যবসার নাম' : 'Business', value: user.businessName || '–', icon: <Briefcase className="w-4 h-4" />, color: 'text-amber-600' },
        { label: language === 'bn' ? 'ট্রেড অর্ডার' : 'Trade Orders', value: tradeOrders.length, icon: <Package className="w-4 h-4" />, color: 'text-purple-600' },
      ];
    } else if (user.role === 'supplier') {
      const inStock = supplierProducts.filter((p) => p.inStock).length;
      const avgRating = supplierProducts.reduce((s, p) => s + (p.rating || 0), 0) / (supplierProducts.length || 1);
      return [
        { label: language === 'bn' ? 'মোট পণ্য' : 'Total Products', value: supplierProducts.length, icon: <Package className="w-4 h-4" />, color: 'text-amber-600' },
        { label: language === 'bn' ? 'স্টকে আছে' : 'In Stock', value: inStock, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600' },
        { label: language === 'bn' ? 'গড় রেটিং' : 'Avg. Rating', value: `${avgRating.toFixed(1)} ★`, icon: <Star className="w-4 h-4" />, color: 'text-yellow-600' },
        { label: language === 'bn' ? 'দোকান' : 'Shop', value: user.shopName || '–', icon: <Store className="w-4 h-4" />, color: 'text-blue-600' },
      ];
    } else if (user.role === 'customer') {
      const totalSpent = orders.reduce((s, o) => s + o.totalBDT, 0);
      const delivered = orders.filter((o) => o.status === 'Delivered').length;
      return [
        { label: language === 'bn' ? 'মোট অর্ডার' : 'Total Orders', value: orders.length, icon: <ShoppingBag className="w-4 h-4" />, color: 'text-purple-600' },
        { label: language === 'bn' ? 'মোট ব্যয়' : 'Total Spent', value: formatBDT(totalSpent), icon: <TrendingUp className="w-4 h-4" />, color: 'text-blue-600' },
        { label: language === 'bn' ? 'ডেলিভারি হয়েছে' : 'Delivered', value: delivered, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600' },
        { label: language === 'bn' ? 'পেন্ডিং' : 'Pending', value: orders.length - delivered, icon: <Clock className="w-4 h-4" />, color: 'text-amber-600' },
      ];
    } else if (user.role === 'expert') {
      const urgent = advisories.filter((a) => a.severity === 'Urgent').length;
      return [
        { label: language === 'bn' ? 'পরামর্শ' : 'Advisories', value: advisories.length, icon: <MessageSquare className="w-4 h-4" />, color: 'text-teal-600' },
        { label: language === 'bn' ? 'জরুরি সতর্কতা' : 'Urgent Alerts', value: urgent, icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-600' },
        { label: language === 'bn' ? 'পদবী' : 'Designation', value: (user.designation || 'Officer').split(',')[0], icon: <Award className="w-4 h-4" />, color: 'text-amber-600' },
        { label: language === 'bn' ? 'বিশেষত্ব' : 'Specialization', value: (user.specialization || ['Crop Science'])[0], icon: <BookOpen className="w-4 h-4" />, color: 'text-blue-600' },
      ];
    } else {
      const allOrders = OrderStore.getAll();
      return [
        { label: language === 'bn' ? 'মোট ব্যবহারকারী' : 'Total Users', value: allUsers.length, icon: <Users className="w-4 h-4" />, color: 'text-slate-600' },
        { label: language === 'bn' ? 'মোট অর্ডার' : 'Total Orders', value: allOrders.length, icon: <ShoppingBag className="w-4 h-4" />, color: 'text-blue-600' },
        { label: language === 'bn' ? 'অডিট লগ' : 'Audit Logs', value: AuthStore.getAuditLogs().length, icon: <Activity className="w-4 h-4" />, color: 'text-emerald-600' },
        { label: language === 'bn' ? 'সিস্টেম স্তর' : 'System Level', value: 'Level-4', icon: <ShieldCheck className="w-4 h-4" />, color: 'text-red-600' },
      ];
    }
  }, [user, language, cropListings, businessDemands, supplierProducts, orders, tradeOrders, advisories, editFarmSize, allUsers]);

  const handleSave = () => {
    const updates: Partial<User> = {
      name: editName,
      phone: editPhone,
      district: editDistrict,
      education: editEducation,
    };
    if (user.role === 'farmer') updates.farmSizeAcres = editFarmSize;
    if (user.role === 'businessman') updates.businessName = editBusinessName;
    if (user.role === 'supplier') updates.shopName = editShopName;
    if (user.role === 'expert') updates.designation = editDesignation;
    const updated = AuthStore.updateProfile(updates);
    if (updated && onUpdateUser) {
      onUpdateUser(updated);
      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const tabs: { id: TabId; label: string; labelBn: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', labelBn: 'সারসংক্ষেপ', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', labelBn: 'কার্যক্রম', icon: <Activity className="w-4 h-4" /> },
    { id: 'orders', label: 'Orders & Trades', labelBn: 'অর্ডার ও লেনদেন', icon: <Package className="w-4 h-4" /> },
    ...(canEdit ? [{ id: 'edit' as TabId, label: 'Edit Profile', labelBn: 'প্রোফাইল সম্পাদনা', icon: <Edit3 className="w-4 h-4" /> }] : []),
  ];

  return (
    <div className="space-y-6">
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 px-3 py-2 rounded-lg hover:bg-stone-50 transition-all shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          {language === 'bn' ? 'ফিরে যান' : 'Back'}
        </button>
        <div className="text-sm text-stone-400 flex items-center gap-1.5">
          <span>{language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-stone-700 font-semibold">
            {language === 'bn' ? 'ব্যবহারকারী প্রোফাইল' : 'User Profile'}
          </span>
          {!isOwnProfile && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-stone-900 font-bold">{user.name}</span>
            </>
          )}
        </div>
      </div>

      {/* Profile Hero */}
      <div className={`bg-white border ${rc.border} rounded-2xl p-6 shadow-sm relative overflow-hidden`}>
        <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${rc.bg}`} />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-5">
          {/* Avatar */}
          <div className={`w-20 h-20 rounded-2xl ${rc.bg} ${rc.border} border-2 flex items-center justify-center shadow-md shrink-0`}>
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} alt={user.name} className="w-full h-full rounded-2xl object-cover" />
            ) : (
              <span className={`text-2xl font-black ${rc.color}`}>{getInitials(user.name)}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h1 className="text-2xl font-extrabold text-stone-900">{user.name}</h1>
              {user.verified && (
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  <BadgeCheck className="w-3.5 h-3.5" />{' '}
                  {language === 'bn' ? 'যাচাইকৃত' : 'Verified'}
                </span>
              )}
            </div>
            <div className={`inline-flex items-center gap-1.5 ${rc.bg} ${rc.border} border ${rc.color} px-3 py-1 rounded-full text-xs font-bold mb-3`}>
              {rc.icon}
              <span>{language === 'bn' ? rc.labelBn : rc.label}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-stone-600">
              {user.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{user.phone}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{user.district}{user.upazila ? `, ${user.upazila}` : ''}</span>
              </span>
              {user.education && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span className="truncate">{user.education}</span>
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{language === 'bn' ? 'যোগদান: ' : 'Joined: '}{formatDate(user.createdAt)}</span>
              </span>
              {user.lastLoginAt && (
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  <span>{language === 'bn' ? 'শেষ লগইন: ' : 'Last login: '}{formatDate(user.lastLoginAt)}</span>
                </span>
              )}
            </div>
          </div>

          {/* ID badge */}
          <div className={`shrink-0 ${rc.bg} ${rc.border} border rounded-xl p-4 text-right`}>
            <span className={`text-[11px] font-bold ${rc.color} uppercase block`}>
              {language === 'bn' ? 'পরিচয় আইডি' : 'User ID'}
            </span>
            <span className="text-xs font-mono font-bold text-stone-800 block mt-0.5">
              {user.id.length > 14 ? user.id.slice(0, 14) + '…' : user.id}
            </span>
            <span className={`text-[10px] font-semibold ${rc.color} mt-1 block`}>
              {user.twoFactorEnabled ? '2FA Enabled' : 'Standard Auth'}
            </span>
          </div>
        </div>

        {/* Action buttons when viewing another user */}
        {!isOwnProfile && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-stone-200">
            <button
              onClick={() => onMessageUser && onMessageUser(user)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{language === 'bn' ? 'বার্তা পাঠান' : 'Send Message'}</span>
            </button>

            <button
              onClick={() => onCallUser && onCallUser(user)}
              className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <PhoneCall className="w-4 h-4 text-emerald-400" />
              <span>{language === 'bn' ? 'কল করুন' : 'Call Now'}</span>
            </button>

            <button
              onClick={handleConnectToggle}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                connStatus === 'accepted'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : connStatus === 'pending_sent'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
              }`}
            >
              {connStatus === 'accepted' ? (
                <>
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'bn' ? 'সংযুক্ত ✓' : 'Connected ✓'}</span>
                </>
              ) : connStatus === 'pending_sent' ? (
                <>
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>{language === 'bn' ? 'অনুরোধ পাঠানো হয়েছে' : 'Request Sent'}</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 text-stone-500" />
                  <span>{language === 'bn' ? 'যুক্ত হোন' : '+ Connect'}</span>
                </>
              )}
            </button>
          </div>
        )}

        {saveSuccess && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {language === 'bn' ? 'প্রোফাইল সফলভাবে সংরক্ষণ করা হয়েছে!' : 'Profile updated successfully!'}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase text-stone-500 mb-2">
              <span className="truncate mr-1">{stat.label}</span>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div className={`text-xl font-black ${stat.color} leading-tight`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="flex items-center border-b border-stone-200 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); if (tab.id !== 'edit') setIsEditing(false); }}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-stone-900 text-stone-900 bg-stone-50'
                  : 'border-transparent text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              {tab.icon}
              {language === 'bn' ? tab.labelBn : tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {user.role === 'farmer' && (
                <>
                  <SectionHeader icon={<Leaf className="w-4 h-4 text-emerald-600" />} title={language === 'bn' ? 'আমার ফসলের তালিকা' : 'My Crop Listings'} />
                  {cropListings.length === 0 ? (
                    <EmptyState message={language === 'bn' ? 'এখনো কোনো ফসল তালিকাভুক্ত করা হয়নি' : 'No crops listed yet'} />
                  ) : (
                    <div className="space-y-2">
                      {cropListings.map((crop) => (
                        <div key={crop.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                          <div>
                            <span className="font-bold text-stone-900">{crop.cropName}</span>
                            <span className="text-stone-500 ml-2">{crop.cropBangla}</span>
                          </div>
                          <div className="flex items-center gap-3 text-right">
                            <span className="text-stone-600">{crop.quantityKg} kg</span>
                            <span className="font-bold text-emerald-700">৳{crop.expectedPricePerKg}/kg</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              crop.status === 'Ready to Harvest' ? 'bg-emerald-100 text-emerald-800' :
                              crop.status === 'Growing' ? 'bg-blue-100 text-blue-800' :
                              crop.status === 'Sold' ? 'bg-stone-100 text-stone-600' :
                              'bg-amber-100 text-amber-800'
                            }`}>{crop.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <InfoCard label={language === 'bn' ? 'মূল ফসল' : 'Primary Crops'} value={(user.primaryCrops || ['Rice', 'Vegetables']).join(', ')} icon={<Sprout className="w-4 h-4 text-emerald-500" />} />
                    <InfoCard label={language === 'bn' ? 'জমির আকার' : 'Farm Area'} value={`${user.farmSizeAcres || 4.5} acres`} icon={<MapPin className="w-4 h-4 text-amber-500" />} />
                  </div>
                </>
              )}

              {user.role === 'businessman' && (
                <>
                  <SectionHeader icon={<FileText className="w-4 h-4 text-blue-600" />} title={language === 'bn' ? 'আমার ক্রয় চাহিদা' : 'My Purchase Demands'} />
                  {businessDemands.length === 0 ? (
                    <EmptyState message={language === 'bn' ? 'এখনো কোনো চাহিদা পোস্ট করা হয়নি' : 'No demands posted yet'} />
                  ) : (
                    <div className="space-y-2">
                      {businessDemands.map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                          <div>
                            <span className="font-bold text-stone-900">{d.cropNeeded}</span>
                            <span className="text-stone-500 ml-2">{d.cropBangla}</span>
                            <p className="text-stone-500 text-[11px]">{d.businessName} • {d.district}</p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-blue-700 block">৳{d.targetPricePerKg}/kg</span>
                            <span className="text-stone-500">{d.quantityKgNeeded} kg</span>
                            {d.urgent && <span className="ml-1 text-red-600 font-bold text-[10px]">⚡ Urgent</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <InfoCard label={language === 'bn' ? 'ব্যবসার ধরন' : 'Business Type'} value={user.businessType || 'Wholesaler'} icon={<Briefcase className="w-4 h-4 text-blue-500" />} />
                </>
              )}

              {user.role === 'supplier' && (
                <>
                  <SectionHeader icon={<Package className="w-4 h-4 text-amber-600" />} title={language === 'bn' ? 'আমার পণ্য ক্যাটালগ' : 'My Product Catalog'} />
                  {supplierProducts.length === 0 ? (
                    <EmptyState message={language === 'bn' ? 'এখনো কোনো পণ্য যুক্ত করা হয়নি' : 'No products added yet'} />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {supplierProducts.map((p) => (
                        <div key={p.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="font-bold text-stone-900">{p.name}</span>
                            <span className="font-bold text-amber-700">৳{p.unitPriceBDT}/{p.unit}</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-500">
                            <span>{p.brand}</span>
                            <span>•</span>
                            <span>{p.category}</span>
                            <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${p.inStock ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                              {p.inStock ? 'In Stock' : 'Out'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {user.shopName && <InfoCard label={language === 'bn' ? 'দোকানের নাম' : 'Shop Name'} value={user.shopName} icon={<Store className="w-4 h-4 text-amber-500" />} />}
                    {user.licenseNumber && <InfoCard label={language === 'bn' ? 'লাইসেন্স নম্বর' : 'License No.'} value={user.licenseNumber} icon={<Hash className="w-4 h-4 text-stone-400" />} />}
                  </div>
                </>
              )}

              {user.role === 'customer' && (
                <>
                  <SectionHeader icon={<ShoppingBag className="w-4 h-4 text-purple-600" />} title={language === 'bn' ? 'আমার অর্ডার ইতিহাস' : 'My Order History'} />
                  {orders.length === 0 ? (
                    <EmptyState message={language === 'bn' ? 'এখনো কোনো অর্ডার করা হয়নি' : 'No orders placed yet'} />
                  ) : (
                    <div className="space-y-2">
                      {orders.map((o) => (
                        <div key={o.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-stone-900">#{o.id}</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              o.status === 'Delivered' ? 'bg-emerald-100 text-emerald-800' :
                              o.status === 'Confirmed' ? 'bg-blue-100 text-blue-800' :
                              o.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-800'
                            }`}>{o.status}</span>
                          </div>
                          <div className="flex justify-between text-stone-600">
                            <span>{o.items.length} item(s) • {o.paymentMethod}</span>
                            <span className="font-bold text-purple-700">৳{o.totalBDT}</span>
                          </div>
                          <p className="text-[11px] text-stone-400 mt-0.5">{formatDate(o.orderDate)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {user.role === 'expert' && (
                <>
                  <SectionHeader icon={<MessageSquare className="w-4 h-4 text-teal-600" />} title={language === 'bn' ? 'প্রকাশিত কৃষি পরামর্শ' : 'Published Advisories'} />
                  {advisories.length === 0 ? (
                    <EmptyState message={language === 'bn' ? 'এখনো কোনো পরামর্শ প্রকাশিত হয়নি' : 'No advisories published yet'} />
                  ) : (
                    <div className="space-y-2">
                      {advisories.map((a) => (
                        <div key={a.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-stone-900">{a.title}</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              a.severity === 'Urgent' ? 'bg-red-100 text-red-800' :
                              a.severity === 'Warning' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>{a.severity}</span>
                          </div>
                          <p className="text-stone-600 line-clamp-2">{a.message || a.messageBn}</p>
                          <p className="text-[11px] text-stone-400 mt-0.5">{a.category} • {a.district}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    <InfoCard label={language === 'bn' ? 'পদবী' : 'Designation'} value={user.designation || 'Scientific Officer, BARI'} icon={<Award className="w-4 h-4 text-teal-500" />} />
                    <InfoCard label={language === 'bn' ? 'প্রতিষ্ঠান' : 'Institution'} value={user.institution || 'BARI'} icon={<BookOpen className="w-4 h-4 text-blue-500" />} />
                  </div>
                  {(user.specialization || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(user.specialization || []).map((s) => (
                        <span key={s} className="bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold px-2.5 py-1 rounded-full">{s}</span>
                      ))}
                    </div>
                  )}
                </>
              )}

              {user.role === 'admin' && isAdmin && (
                <>
                  <SectionHeader icon={<Users className="w-4 h-4 text-slate-600" />} title={language === 'bn' ? 'সকল নিবন্ধিত ব্যবহারকারী' : 'All Registered Users'} />
                  <div className="space-y-2">
                    {allUsers.map((u) => {
                      const urc = roleConfig[u.role];
                      return (
                        <div
                          key={u.id}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer hover:bg-stone-50 transition-all ${urc.border} bg-white`}
                          onClick={() => onViewUser && onViewUser(u)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${urc.bg} ${urc.border} border flex items-center justify-center shrink-0`}>
                              <span className={`text-xs font-black ${urc.color}`}>{getInitials(u.name)}</span>
                            </div>
                            <div>
                              <span className="font-bold text-stone-900">{u.name}</span>
                              <p className="text-stone-500 text-[11px]">{u.email || u.phone} • {u.district}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`${urc.bg} ${urc.border} border ${urc.color} text-[10px] font-bold px-2 py-0.5 rounded-full`}>
                              {language === 'bn' ? urc.labelBn : urc.label}
                            </span>
                            {u.verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500" />}
                            <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ACTIVITY ── */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <SectionHeader icon={<Clock className="w-4 h-4 text-stone-600" />} title={language === 'bn' ? 'সাম্প্রতিক কার্যক্রম লগ' : 'Recent Activity Log'} />
              {auditLogs.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {log.status === 'SUCCESS' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        </div>
                        <div>
                          <span className="font-bold text-stone-900">{log.status}</span>
                          <p className="text-stone-500 text-[11px]">{log.details}</p>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-stone-400 font-mono">
                        <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                        <div className="text-[10px] max-w-[100px] truncate">{log.ip}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {user.role === 'farmer' && cropListings.length > 0 && cropListings.slice(0, 5).map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      <Leaf className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold text-stone-800">Listed: {c.cropName}</span>
                        <p className="text-stone-500 text-[11px]">{c.quantityKg}kg • ৳{c.expectedPricePerKg}/kg • {c.status}</p>
                      </div>
                      <span className="text-[11px] text-stone-400">{c.createdAt ? formatDate(c.createdAt) : 'Recent'}</span>
                    </div>
                  ))}
                  {user.role === 'customer' && orders.length > 0 && orders.slice(0, 5).map((o) => (
                    <div key={o.id} className="flex items-center gap-2.5 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      <ShoppingBag className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold text-stone-800">Order #{o.id}</span>
                        <p className="text-stone-500 text-[11px]">{o.items.length} items • ৳{o.totalBDT} • {o.status}</p>
                      </div>
                      <span className="text-[11px] text-stone-400">{formatDate(o.orderDate)}</span>
                    </div>
                  ))}
                  {user.role === 'expert' && advisories.length > 0 && advisories.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center gap-2.5 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      <MessageSquare className="w-4 h-4 text-teal-600 shrink-0" />
                      <div className="flex-1">
                        <span className="font-semibold text-stone-800">{a.title}</span>
                        <p className="text-stone-500 text-[11px]">{a.severity} • {a.category}</p>
                      </div>
                      <span className="text-[11px] text-stone-400">{a.date}</span>
                    </div>
                  ))}
                  {cropListings.length + orders.length + advisories.length === 0 && (
                    <EmptyState message={language === 'bn' ? 'কোনো কার্যক্রম পাওয়া যায়নি' : 'No activity recorded yet'} />
                  )}
                </>
              )}

              {tradeOrders.length > 0 && (
                <>
                  <SectionHeader icon={<Layers className="w-4 h-4 text-indigo-600" />} title={language === 'bn' ? 'ট্রেড লেনদেন' : 'Trade Transactions'} />
                  <div className="space-y-2">
                    {tradeOrders.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                        <div>
                          <span className="font-bold text-stone-900">{t.title}</span>
                          <p className="text-stone-500 text-[11px]">{t.buyerName} → {t.sellerName}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-indigo-700 block">৳{t.totalBDT.toLocaleString()}</span>
                          <span className={`text-[10px] font-bold ${
                            t.status === 'Delivered' ? 'text-emerald-600' :
                            t.status === 'Confirmed' ? 'text-blue-600' :
                            'text-amber-600'
                          }`}>{t.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ORDERS & TRADES ── */}
          {activeTab === 'orders' && (
            <div className="space-y-5">
              <SectionHeader icon={<ShoppingBag className="w-4 h-4 text-purple-600" />} title={language === 'bn' ? 'ভোক্তা অর্ডার' : 'Consumer Orders'} />
              {orders.length === 0 ? (
                <EmptyState message={language === 'bn' ? 'কোনো অর্ডার নেই' : 'No orders found'} />
              ) : (
                <div className="space-y-3">
                  {orders.map((o) => (
                    <div key={o.id} className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-stone-900 text-sm">Order #{o.id}</span>
                          <p className="text-stone-500 text-[11px] mt-0.5">{o.deliveryAddress} • {o.paymentMethod}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-purple-700">৳{o.totalBDT}</span>
                          <span className={`block text-[10px] font-bold mt-1 ${
                            o.status === 'Delivered' ? 'text-emerald-700' :
                            o.status === 'Confirmed' ? 'text-blue-700' :
                            'text-amber-700'
                          }`}>{o.status}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {o.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-stone-600 bg-white p-2 rounded-lg border border-stone-200">
                            <span>{item.product.cropName}</span>
                            <span className="font-bold text-stone-800">{item.quantityKg}kg × ৳{item.product.pricePerKg}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-stone-400">{formatDate(o.orderDate)}</p>
                    </div>
                  ))}
                </div>
              )}

              <SectionHeader icon={<Package className="w-4 h-4 text-indigo-600" />} title={language === 'bn' ? 'সরবরাহকারী ও বাণিজ্য অর্ডার' : 'Supplier & B2B Trade Orders'} />
              {tradeOrders.length === 0 ? (
                <EmptyState message={language === 'bn' ? 'কোনো ট্রেড অর্ডার নেই' : 'No trade orders found'} />
              ) : (
                <div className="space-y-3">
                  {tradeOrders.map((t) => (
                    <div key={t.id} className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-stone-900 text-sm">{t.title}</span>
                          <p className="text-stone-500 text-[11px] mt-0.5">#{t.id} • {t.paymentMethod}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-indigo-700">৳{t.totalBDT.toLocaleString()}</span>
                          <span className={`block text-[10px] font-bold mt-1 ${
                            t.status === 'Delivered' ? 'text-emerald-700' :
                            t.status === 'Confirmed' ? 'text-blue-700' :
                            t.status === 'Pending' ? 'text-amber-700' :
                            'text-red-700'
                          }`}>{t.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-stone-600 bg-white p-2 rounded-lg border border-stone-200 text-[11px]">
                        <span><strong>Buyer:</strong> {t.buyerName} ({t.buyerRole})</span>
                        <span>→</span>
                        <span><strong>Seller:</strong> {t.sellerName} ({t.sellerRole})</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {t.items.map((item) => (
                          <span key={item.itemId} className="bg-white border border-stone-200 px-2 py-1 rounded-lg text-stone-700 text-[11px]">
                            {item.itemName} × {item.quantity} {item.unit}
                          </span>
                        ))}
                      </div>
                      <p className="text-[11px] text-stone-400">{formatDate(t.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── EDIT ── */}
          {activeTab === 'edit' && canEdit && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditField label={language === 'bn' ? 'পূর্ণ নাম' : 'Full Name'} value={editName} onChange={setEditName} disabled={!isEditing} />
                <EditField label={language === 'bn' ? 'ফোন নম্বর' : 'Phone Number'} value={editPhone} onChange={setEditPhone} disabled={!isEditing} />
                <EditField label={language === 'bn' ? 'জেলা' : 'District'} value={editDistrict} onChange={setEditDistrict} disabled={!isEditing} />
                <EditField label={language === 'bn' ? 'শিক্ষাগত যোগ্যতা' : 'Education'} value={editEducation} onChange={setEditEducation} disabled={!isEditing} />
                {user.role === 'farmer' && (
                  <EditField label={language === 'bn' ? 'জমির আকার (একর)' : 'Farm Size (acres)'} value={String(editFarmSize)} onChange={(v) => setEditFarmSize(parseFloat(v) || 0)} type="number" disabled={!isEditing} />
                )}
                {user.role === 'businessman' && (
                  <EditField label={language === 'bn' ? 'ব্যবসার নাম' : 'Business Name'} value={editBusinessName} onChange={setEditBusinessName} disabled={!isEditing} />
                )}
                {user.role === 'supplier' && (
                  <EditField label={language === 'bn' ? 'দোকানের নাম' : 'Shop Name'} value={editShopName} onChange={setEditShopName} disabled={!isEditing} />
                )}
                {user.role === 'expert' && (
                  <EditField label={language === 'bn' ? 'পদবী' : 'Designation'} value={editDesignation} onChange={setEditDesignation} disabled={!isEditing} />
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 bg-stone-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-stone-800 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                    {language === 'bn' ? 'সম্পাদনা করুন' : 'Edit Profile'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSave}
                      className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
                    >
                      <Save className="w-4 h-4" />
                      {language === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center gap-2 bg-stone-100 text-stone-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-stone-200 transition-all"
                    >
                      <X className="w-4 h-4" />
                      {language === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                  </>
                )}
              </div>

              <div className="mt-4 p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <h3 className="text-xs font-bold text-stone-700 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-stone-500" />
                  {language === 'bn' ? 'নিরাপত্তা তথ্য (পরিবর্তনযোগ্য নয়)' : 'Security Info (Read-only)'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white border border-stone-200 rounded-lg p-2.5">
                    <span className="text-stone-400 block text-[11px]">{language === 'bn' ? 'অ্যাকাউন্ট তৈরির তারিখ' : 'Account Created'}</span>
                    <span className="font-bold text-stone-800">{formatDate(user.createdAt)}</span>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-lg p-2.5">
                    <span className="text-stone-400 block text-[11px]">{language === 'bn' ? 'ই-মেইল' : 'Email'}</span>
                    <span className="font-bold text-stone-800 truncate block">{user.email || '—'}</span>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-lg p-2.5">
                    <span className="text-stone-400 block text-[11px]">{language === 'bn' ? '২-স্তর যাচাইকরণ' : '2FA Status'}</span>
                    <span className={`font-bold ${user.twoFactorEnabled ? 'text-emerald-700' : 'text-stone-500'}`}>
                      {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
