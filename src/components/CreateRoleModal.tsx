import React, { useState, useRef } from 'react';
import { User, Language, UserRole } from '../types';
import { AuthStore } from '../data/store';
import { BANGLADESH_LOCATIONS } from '../data/mockData';
import {
  X,
  Sprout,
  Briefcase,
  Store,
  ShoppingCart,
  Microscope,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Building,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  User as UserIcon,
  ImagePlus,
  FileText,
  CreditCard,
} from 'lucide-react';

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole: UserRole | null;
  currentUser: User;
  language: Language;
  onSuccess: (newRoleUser: User) => void;
}

const ROLE_META: Record<UserRole, { en: string; bn: string; icon: React.ReactNode }> = {
  farmer: { en: 'Farmer', bn: 'কৃষক', icon: <Sprout className="w-5 h-5 text-emerald-600" /> },
  businessman: { en: 'Trader / Wholesaler', bn: 'ব্যবসায়ী / আড়তদার', icon: <Briefcase className="w-5 h-5 text-blue-600" /> },
  supplier: { en: 'Agri Supplier', bn: 'সার ও কীটনাশক বিক্রেতা', icon: <Store className="w-5 h-5 text-amber-600" /> },
  customer: { en: 'Consumer / Buyer', bn: 'ভোক্তা / খুচরা ক্রেতা', icon: <ShoppingCart className="w-5 h-5 text-purple-600" /> },
  expert: { en: 'Agri Expert', bn: 'কৃষি বিশেষজ্ঞ', icon: <Microscope className="w-5 h-5 text-teal-600" /> },
  admin: { en: 'Admin', bn: 'অ্যাডমিন', icon: <ShieldCheck className="w-5 h-5 text-slate-700" /> },
};

export const CreateRoleModal: React.FC<CreateRoleModalProps> = ({
  isOpen,
  onClose,
  targetRole,
  currentUser,
  language,
  onSuccess,
}) => {
  if (!isOpen || !targetRole) return null;

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);
  const meta = ROLE_META[targetRole] || ROLE_META.farmer;

  // Form states pre-filled from current user
  const [name, setName] = useState(currentUser.name);
  const [email] = useState(currentUser.email);
  const [phone] = useState(currentUser.phone);
  const [district, setDistrict] = useState(currentUser.district || 'Bogura');
  const [upazila, setUpazila] = useState(currentUser.upazila || 'Shibganj');
  const [education, setEducation] = useState(currentUser.education || 'Graduate');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Role extras
  const [farmSize, setFarmSize] = useState('3.0');
  const [crops, setCrops] = useState('Potato, Tomato, Cauliflower');
  const [businessName, setBusinessName] = useState(`${currentUser.name.split(' ')[0]} Agro Traders`);
  const [businessType, setBusinessType] = useState<'Wholesaler' | 'Supermarket' | 'Agro Processor' | 'Restaurant Chain' | 'Exporter'>('Wholesaler');
  const [shopName, setShopName] = useState(`${currentUser.name.split(' ')[0]} Krishi Seba`);
  const [licenseNumber, setLicenseNumber] = useState('LIC-2026-BD');
  const [designation, setDesignation] = useState('Scientific Officer / Agronomist');
  const [institution, setInstitution] = useState('Department of Agricultural Extension');
  const [certPreview, setCertPreview] = useState<string | null>(null);
  const [nidPreview, setNidPreview] = useState<string | null>(null);
  const certInputRef = useRef<HTMLInputElement>(null);
  const nidInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedLoc = BANGLADESH_LOCATIONS.find((l) => l.district.toLowerCase() === district.toLowerCase());
  const upazilas = selectedLoc ? selectedLoc.upazilas : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError(t('Please set a password for this role account', 'এই রোল অ্যাকাউন্টের জন্য একটি পাসওয়ার্ড দিন'));
      return;
    }
    if (password.length < 8) {
      setError(t('Password must be at least 8 characters', 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('Passwords do not match', 'পাসওয়ার্ড দুটি মিলছে না'));
      return;
    }

    if (targetRole === 'expert') {
      if (!institution.trim()) {
        setError(t('Institute Name is required for Expert role', 'বিশেষজ্ঞ অ্যাকাউন্টের জন্য প্রতিষ্ঠানের নাম আবশ্যক'));
        return;
      }
      if (!certPreview) {
        setError(t('Certificate photo upload is required for Expert role', 'বিশেষজ্ঞ অ্যাকাউন্টের জন্য ডিগ্রি সনদপত্রের ছবি আপলোড আবশ্যক'));
        return;
      }
      if (!nidPreview) {
        setError(t('National ID (NID) photo upload is required for Expert role', 'বিশেষজ্ঞ অ্যাকাউন্টের জন্য জাতীয় পরিচয়পত্র (NID) ছবি আপলোড আবশ্যক'));
        return;
      }
    }

    setLoading(true);

    const roleData: Partial<User> = {
      name,
      district,
      upazila,
      education,
      password,
      farmSizeAcres: targetRole === 'farmer' ? parseFloat(farmSize) || 3 : undefined,
      primaryCrops: targetRole === 'farmer' ? crops.split(',').map((c) => c.trim()) : undefined,
      businessName: targetRole === 'businessman' ? businessName : undefined,
      businessType: targetRole === 'businessman' ? businessType : undefined,
      shopName: targetRole === 'supplier' ? shopName : undefined,
      licenseNumber: targetRole === 'supplier' ? licenseNumber : undefined,
      designation: targetRole === 'expert' ? designation : undefined,
      institution: targetRole === 'expert' ? institution : undefined,
      certificatePhotoUrl: targetRole === 'expert' ? (certPreview || undefined) : undefined,
      nidPhotoUrl: targetRole === 'expert' ? (nidPreview || undefined) : undefined,
    };

    const newRoleUser = AuthStore.createRoleAccount(currentUser, targetRole, roleData);
    setLoading(false);
    onSuccess(newRoleUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg p-6 space-y-5 animate-slide-down my-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              {meta.icon}
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {t('Multi-Role Account Creation', 'একাধিক রোল অ্যাকাউন্ট তৈরি')}
              </span>
              <h2 className="text-base font-extrabold text-stone-900 mt-1">
                {language === 'bn' ? `নতুন ${meta.bn} অ্যাকাউন্ট যোগ করুন` : `Create & Link ${meta.en} Profile`}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Note */}
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {t(
              `This ${meta.en} account will be directly linked to your email (${email}) and phone (${phone}).`,
              `এই ${meta.bn} অ্যাকাউন্টটি আপনার ইমেইল (${email}) ও ফোনের সাথে সংযুক্ত থাকবে।`
            )}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
              {t('Full Name', 'পূর্ণ নাম')}
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-stone-800"
              />
            </div>
          </div>

          {/* District & Upazila */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                {t('District', 'জেলা')}
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-stone-800 bg-white"
              >
                {BANGLADESH_LOCATIONS.map((loc) => (
                  <option key={loc.district} value={loc.district}>
                    {loc.district} ({loc.districtBn})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                {t('Upazila', 'উপজেলা')}
              </label>
              <select
                value={upazila}
                onChange={(e) => setUpazila(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium text-stone-800 bg-white"
              >
                {upazilas.map((upz) => (
                  <option key={upz} value={upz}>
                    {upz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Role specific inputs */}
          {targetRole === 'farmer' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  {t('Farm Size (Acres)', 'জমির পরিমাণ (একর)')}
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={farmSize}
                  onChange={(e) => setFarmSize(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  {t('Primary Crops', 'প্রধান ফসলসমূহ')}
                </label>
                <input
                  type="text"
                  value={crops}
                  onChange={(e) => setCrops(e.target.value)}
                  placeholder="Potato, Tomato"
                  className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white"
                />
              </div>
            </div>
          )}

          {targetRole === 'businessman' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  {t('Business Name', 'ব্যবসা প্রতিষ্ঠানের নাম')}
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  {t('Business Type', 'ব্যবসার ধরন')}
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white"
                >
                  <option value="Wholesaler">Wholesaler (পাইকার)</option>
                  <option value="Supermarket">Supermarket (সুপারশপ)</option>
                  <option value="Agro Processor">Agro Processor (প্রসেসর)</option>
                  <option value="Exporter">Exporter (রপ্তানিকারক)</option>
                </select>
              </div>
            </div>
          )}

          {targetRole === 'supplier' && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-2xl border border-stone-200">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  {t('Shop / Store Name', 'দোকানের নাম')}
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                  {t('License Number', 'ডিলার লাইসেন্স নম্বর')}
                </label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white"
                />
              </div>
            </div>
          )}

          {targetRole === 'expert' && (
            <div className="space-y-3 p-3 bg-teal-50/50 rounded-2xl border border-teal-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                    {t('Designation', 'পদবি')}
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 uppercase mb-1">
                    {t('Institution *', 'কর্মরত প্রতিষ্ঠান *')}
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-stone-200 rounded-xl bg-white"
                    required
                  />
                </div>
              </div>

              {/* Certificate & NID photo uploads */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3 text-teal-600" />
                    {t('Certificate Photo *', 'ডিগ্রি সনদপত্র *')}
                  </label>
                  {certPreview ? (
                    <div className="flex items-center gap-2 p-1.5 bg-white border border-teal-300 rounded-lg">
                      <img src={certPreview} alt="Certificate" className="w-8 h-8 rounded object-cover" />
                      <span className="text-[10px] text-emerald-700 font-bold truncate flex-1">✓ Uploaded</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCertPreview(null);
                          if (certInputRef.current) certInputRef.current.value = '';
                        }}
                        className="text-stone-400 hover:text-red-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => certInputRef.current?.click()}
                      className="w-full py-1.5 px-2 bg-white border border-dashed border-teal-300 rounded-lg text-[10px] font-semibold text-stone-600 flex items-center justify-center gap-1 hover:bg-teal-50/50"
                    >
                      <ImagePlus className="w-3 h-3 text-teal-600" />
                      <span>{t('Upload Cert', 'সনদপত্র')}</span>
                    </button>
                  )}
                  <input
                    ref={certInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setCertPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-stone-600 uppercase mb-1 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-teal-600" />
                    {t('NID Photo *', 'NID ছবি *')}
                  </label>
                  {nidPreview ? (
                    <div className="flex items-center gap-2 p-1.5 bg-white border border-teal-300 rounded-lg">
                      <img src={nidPreview} alt="NID" className="w-8 h-8 rounded object-cover" />
                      <span className="text-[10px] text-emerald-700 font-bold truncate flex-1">✓ Uploaded</span>
                      <button
                        type="button"
                        onClick={() => {
                          setNidPreview(null);
                          if (nidInputRef.current) nidInputRef.current.value = '';
                        }}
                        className="text-stone-400 hover:text-red-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => nidInputRef.current?.click()}
                      className="w-full py-1.5 px-2 bg-white border border-dashed border-teal-300 rounded-lg text-[10px] font-semibold text-stone-600 flex items-center justify-center gap-1 hover:bg-teal-50/50"
                    >
                      <CreditCard className="w-3 h-3 text-teal-600" />
                      <span>{t('Upload NID', 'NID কার্ড')}</span>
                    </button>
                  )}
                  <input
                    ref={nidInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setNidPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Password fields */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                {t('Account Password', 'পাসওয়ার্ড')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-600 uppercase mb-1">
                {t('Confirm Password', 'নিশ্চিত করুন')}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 text-xs border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold">
              ⚠ {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-700/20"
            >
              {loading
                ? t('Creating account…', 'অ্যাকাউন্ট তৈরি হচ্ছে…')
                : language === 'bn'
                ? `তৈরি ও সক্রিয় করুন (${meta.bn})`
                : `Create & Switch to ${meta.en}`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-bold transition-colors"
            >
              {t('Cancel', 'বাতিল')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
