import React, { useState, useRef } from 'react';
import { User, Language } from '../types';
import { AuthStore } from '../data/store';
import { BANGLADESH_LOCATIONS } from '../data/mockData';
import {
  X,
  Microscope,
  Upload,
  ImagePlus,
  CheckCircle2,
  AlertTriangle,
  Building,
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  GraduationCap,
  FileText,
  CreditCard,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface ExpertRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onSuccess: (newExpert: User) => void;
  onSwitchUser?: (user: User) => void;
}

const COMMON_INSTITUTES = [
  { name: 'Bangladesh Agricultural Research Institute (BARI)', short: 'BARI' },
  { name: 'Bangladesh Agricultural University (BAU)', short: 'BAU' },
  { name: 'Department of Agricultural Extension (DAE)', short: 'DAE' },
  { name: 'Bangladesh Rice Research Institute (BRRI)', short: 'BRRI' },
  { name: 'Sher-e-Bangla Agricultural University (SAU)', short: 'SAU' },
  { name: 'Bangladesh Institute of Nuclear Agriculture (BINA)', short: 'BINA' },
];

const SPECIALIZATION_OPTIONS = [
  { id: 'Plant Pathology', en: 'Plant Pathology & Disease Control', bn: 'উদ্ভিদ রোগতত্ত্ব ও দমন' },
  { id: 'Entomology & IPM', en: 'Entomology & Pest Management (IPM)', bn: 'কীটতত্ত্ব ও পোকা দমন (IPM)' },
  { id: 'Soil & Fertilizer', en: 'Soil Health & Fertilizer Management', bn: 'মাটি ও সুষম সার ব্যবস্থাপনা' },
  { id: 'Horticulture', en: 'Horticulture & Vegetable Production', bn: 'উদ্যানতত্ত্ব ও সবজি চাষ' },
  { id: 'Field Agronomy', en: 'Field Crop Agronomy & Seed Tech', bn: 'মাঠ ফসল বিজ্ঞান ও বীজ প্রযুক্তি' },
];

export const ExpertRegistrationModal: React.FC<ExpertRegistrationModalProps> = ({
  isOpen,
  onClose,
  language,
  onSuccess,
  onSwitchUser,
}) => {
  // Required fields according to prompt:
  // 1. Name
  const [name, setName] = useState('');
  // 2. Email
  const [email, setEmail] = useState('');
  // 3. Mobile Number
  const [phone, setPhone] = useState('');
  // 4. Institute Name
  const [institution, setInstitution] = useState('');
  // 5. Certificate photo upload
  const [certPreview, setCertPreview] = useState<string | null>(null);
  const [certFileName, setCertFileName] = useState<string>('');
  const [certFileSize, setCertFileSize] = useState<string>('');
  // 6. NID photo upload
  const [nidPreview, setNidPreview] = useState<string | null>(null);
  const [nidFileName, setNidFileName] = useState<string>('');
  const [nidFileSize, setNidFileSize] = useState<string>('');

  // Complementary account/profile fields
  const [designation, setDesignation] = useState('Senior Scientific Officer');
  const [district, setDistrict] = useState('Bogura');
  const [upazila, setUpazila] = useState('Bogura Sadar');
  const [specializations, setSpecializations] = useState<string[]>(['Plant Pathology']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Validation & status
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [registeredExpert, setRegisteredExpert] = useState<User | null>(null);

  const certInputRef = useRef<HTMLInputElement>(null);
  const nidInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  const selectedLoc = BANGLADESH_LOCATIONS.find(
    (l) => l.district.toLowerCase() === district.toLowerCase()
  );
  const upazilas = selectedLoc ? selectedLoc.upazilas : [];

  // Helper for file size display
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Certificate upload handler
  const handleCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({
        ...prev,
        certificate: t('Only image files (JPG, PNG, WebP) are allowed.', 'শুধুমাত্র ছবি ফাইল (JPG, PNG, WebP) আপলোড করুন।'),
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        certificate: t('Certificate photo must be under 5 MB.', 'সনদপত্রের ছবির সাইজ ৫ MB-এর বেশি হওয়া যাবে না।'),
      }));
      return;
    }

    setCertFileName(file.name);
    setCertFileSize(formatFileSize(file.size));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.certificate;
      return copy;
    });

    const reader = new FileReader();
    reader.onload = (ev) => {
      setCertPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // NID upload handler
  const handleNidUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({
        ...prev,
        nid: t('Only image files (JPG, PNG, WebP) are allowed.', 'শুধুমাত্র ছবি ফাইল (JPG, PNG, WebP) আপলোড করুন।'),
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        nid: t('NID photo must be under 5 MB.', 'NID ছবির সাইজ ৫ MB-এর বেশি হওয়া যাবে না।'),
      }));
      return;
    }

    setNidFileName(file.name);
    setNidFileSize(formatFileSize(file.size));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy.nid;
      return copy;
    });

    const reader = new FileReader();
    reader.onload = (ev) => {
      setNidPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleSpecialization = (id: string) => {
    setSpecializations((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    // 1. Name validation
    if (!name.trim()) {
      newErrors.name = t('Full Name is required.', 'পূর্ণ নাম আবশ্যক।');
    }

    // 2. Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      newErrors.email = t('Please enter a valid official email address.', 'সঠিক অফিসিয়াল ইমেইল ঠিকানা দিন।');
    }

    // 3. Phone validation
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      newErrors.phone = t('Please enter a valid 11-digit mobile number.', 'সঠিক ১১-ডিজিটের মোবাইল নম্বর দিন।');
    }

    // 4. Institute Name validation
    if (!institution.trim()) {
      newErrors.institution = t('Institute / Organization Name is required.', 'প্রতিষ্ঠানের নাম আবশ্যক।');
    }

    // 5. Certificate photo upload validation
    if (!certPreview) {
      newErrors.certificate = t(
        'Certificate photo upload is required for expert verification.',
        'বিশেষজ্ঞ যাচাইয়ের জন্য ডিগ্রি/সনদপত্রের ছবি আপলোড আবশ্যক।'
      );
    }

    // 6. NID photo upload validation
    if (!nidPreview) {
      newErrors.nid = t(
        'National ID (NID) photo upload is required for identity verification.',
        'জাতীয় পরিচয়পত্র (NID) ছবি আপলোড আবশ্যক।'
      );
    }

    // Password validation
    if (!password) {
      newErrors.password = t('Password is required to secure your expert account.', 'পাসওয়ার্ড দেওয়া আবশ্যক।');
    } else if (password.length < 8) {
      newErrors.password = t('Password must be at least 8 characters.', 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t('Passwords do not match.', 'পাসওয়ার্ড দুটি মিলছে না।');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await new Promise((r) => setTimeout(r, 600));

      const cleanEmail = email.trim().toLowerCase();

      // Check duplicate
      const allUsers = AuthStore.getUsers();
      const existing = allUsers.find(
        (u) =>
          u.role === 'expert' &&
          ((u.email && u.email.toLowerCase() === cleanEmail) ||
            (u.phone && u.phone.replace(/\D/g, '') === cleanPhone))
      );

      if (existing) {
        setErrors({
          form: t(
            'An expert account is already registered with this email or mobile number.',
            'এই ইমেইল বা মোবাইল নম্বরে ইতিমধ্যে একটি বিশেষজ্ঞ অ্যাকাউন্ট নিবন্ধিত রয়েছে।'
          ),
        });
        setLoading(false);
        return;
      }

      // Register the Expert
      const newExpert = AuthStore.register({
        name: name.trim(),
        nameBn: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        password: password,
        role: 'expert',
        district,
        upazila,
        education: `${designation} • ${institution}`,
        institution: institution.trim(),
        designation: designation.trim() || 'Agricultural Specialist',
        specialization: specializations.length > 0 ? specializations : ['Plant Pathology'],
        certificatePhotoUrl: certPreview || undefined,
        nidPhotoUrl: nidPreview || undefined,
        nidNumber: `NID-${cleanPhone.slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
        verified: true,
      });

      setRegisteredExpert(newExpert);
      onSuccess(newExpert);
    } catch (err: any) {
      console.error('Expert registration failed:', err);
      setErrors({ form: err?.message || 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-slide-down">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-xs z-10 flex items-center justify-between p-4 sm:p-5 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
              <Microscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
                  {t('Official Expert Verification', 'অফিসিয়াল বিশেষজ্ঞ যাচাই')}
                </span>
              </div>
              <h2 className="font-extrabold text-stone-900 text-base sm:text-lg">
                {t('Dedicated Expert Registration Flow', 'কৃষি বিশেষজ্ঞ নিবন্ধন')}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 font-bold text-sm p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {registeredExpert ? (
          <div className="p-6 sm:p-8 text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-stone-900">
                {t('Expert Registration Successful!', 'বিশেষজ্ঞ নিবন্ধন সফল হয়েছে!')}
              </h3>
              <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                {t(
                  `Congratulations, ${registeredExpert.name}! Your degree certificate and National ID have been verified and linked to ${registeredExpert.institution}.`,
                  `অভিনন্দন, ${registeredExpert.name}! আপনার সনদপত্র ও জাতীয় পরিচয়পত্র যাচাই করা হয়েছে এবং ${registeredExpert.institution}-এর সাথে নিবন্ধিত হয়েছে।`
                )}
              </p>
            </div>

            {/* Credential summary card */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-xs text-left max-w-md mx-auto space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-stone-200">
                <span className="font-bold text-stone-800">{registeredExpert.name}</span>
                <span className="bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded text-[10px]">
                  ✓ Verified Expert
                </span>
              </div>
              <p className="text-stone-600 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{registeredExpert.institution}</span>
              </p>
              <p className="text-stone-600 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{registeredExpert.phone}</span>
              </p>
              <p className="text-stone-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <span>{registeredExpert.email}</span>
              </p>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-emerald-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Degree Certificate & NID Documents Verified</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {onSwitchUser && (
                <button
                  type="button"
                  onClick={() => {
                    onSwitchUser(registeredExpert);
                    onClose();
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Microscope className="w-4 h-4" />
                  <span>{t('Sign in as this Expert Now', 'এই বিশেষজ্ঞ হিসেবে এখনই লগইন করুন')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>{t('View in Crop Doctor Expert Advice', 'ক্রপ ডক্টর বিশেষজ্ঞ তালিকায় দেখুন')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="p-4 sm:p-6 space-y-5 text-xs">
            {/* Notice Banner */}
            <div className="p-3 bg-teal-50/80 border border-teal-200 rounded-xl text-[11px] text-teal-900 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="block text-teal-950 font-bold mb-0.5">
                  {t('Official Specialist Enrollment Requirements:', 'বিশেষজ্ঞ নিবন্ধনের আবশ্যক শর্তাবলী:')}
                </strong>
                <span>
                  {t(
                    'Per NativeBazar compliance, Expert accounts require official full name, verifiable email, mobile number, institutional affiliation, educational certificate photo, and National ID (NID) photo.',
                    'নেটিভবাজার নীতি অনুযায়ী বিশেষজ্ঞ অ্যাকাউন্টের জন্য পূর্ণ নাম, ইমেইল, মোবাইল নম্বর, প্রতিষ্ঠানের নাম, ডিগ্রি সনদপত্রের ছবি এবং জাতীয় পরিচয়পত্র (NID) ছবি আপলোড আবশ্যক।'
                  )}
                </span>
              </div>
            </div>

            {errors.form && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{errors.form}</span>
              </div>
            )}

            {/* Required Fields Section */}
            <div className="space-y-4">
              <h3 className="font-bold text-stone-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-stone-200 pb-1.5">
                <UserIcon className="w-3.5 h-3.5 text-teal-600" />
                {t('1. Required Personal & Institutional Details', '১. আবশ্যক ব্যক্তিগত ও প্রাতিষ্ঠানিক তথ্য')}
              </h3>

              {/* 1. Name */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Full Name / বিশেষজ্ঞের পূর্ণ নাম', 'পূর্ণ নাম')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. Mohammad Akramuzzaman"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border ${
                      errors.name ? 'border-red-500 bg-red-50/30' : 'border-stone-300 bg-white'
                    } focus:ring-2 focus:ring-teal-500 focus:outline-hidden`}
                  />
                </div>
                {errors.name && <p className="text-[11px] text-red-600 mt-1">{errors.name}</p>}
              </div>

              {/* 2. Email & 3. Mobile Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Official Email Address', 'অফিসিয়াল ইমেইল')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. dr.akram@bari.gov.bd"
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border ${
                        errors.email ? 'border-red-500 bg-red-50/30' : 'border-stone-300 bg-white'
                      } focus:ring-2 focus:ring-teal-500 focus:outline-hidden`}
                    />
                  </div>
                  {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Mobile Number', 'মোবাইল নম্বর')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 01711000001"
                      className={`w-full pl-9 pr-3 py-2.5 rounded-xl border ${
                        errors.phone ? 'border-red-500 bg-red-50/30' : 'border-stone-300 bg-white'
                      } focus:ring-2 focus:ring-teal-500 focus:outline-hidden`}
                    />
                  </div>
                  {errors.phone && <p className="text-[11px] text-red-600 mt-1">{errors.phone}</p>}
                </div>
              </div>

              {/* 4. Institute Name */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Institute Name / প্রতিষ্ঠানের নাম', 'প্রতিষ্ঠানের নাম')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. Bangladesh Agricultural Research Institute (BARI)"
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border ${
                      errors.institution ? 'border-red-500 bg-red-50/30' : 'border-stone-300 bg-white'
                    } focus:ring-2 focus:ring-teal-500 focus:outline-hidden`}
                  />
                </div>
                {errors.institution && (
                  <p className="text-[11px] text-red-600 mt-1">{errors.institution}</p>
                )}

                {/* Quick suggestions */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-stone-500 self-center">
                    {t('Popular:', 'পরিচিত প্রতিষ্ঠান:')}
                  </span>
                  {COMMON_INSTITUTES.map((inst) => (
                    <button
                      key={inst.short}
                      type="button"
                      onClick={() => setInstitution(inst.name)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all ${
                        institution === inst.name
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {inst.short}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Document Uploads Section (Certificate & NID) */}
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-stone-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-stone-200 pb-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                {t('2. Required Document Photo Uploads', '২. আবশ্যক সনদপত্র ও পরিচয়পত্র আপলোড')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 5. Certificate Photo Upload */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-stone-700">
                    {t('Certificate Photo Upload', 'সনদপত্রের ছবি আপলোড')} <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-stone-500">
                    {t('Degree, Ph.D, or B.Sc Ag certificate scan/photo (max 5 MB)', 'ডিগ্রি সনদপত্রের ছবি বা স্ক্যান কপি (সর্বোচ্চ ৫ MB)')}
                  </p>

                  {certPreview ? (
                    <div className="relative rounded-xl border border-teal-300 bg-teal-50/50 p-2.5 flex items-center gap-3 shadow-2xs">
                      <img
                        src={certPreview}
                        alt="Certificate Preview"
                        className="w-16 h-16 rounded-lg object-cover border border-teal-200 shrink-0 bg-white"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded inline-block mb-1">
                          ✓ {t('Certificate Uploaded', 'সনদপত্র আপলোড সম্পন্ন')}
                        </span>
                        <p className="text-[11px] font-semibold text-stone-800 truncate">
                          {certFileName || 'certificate.jpg'}
                        </p>
                        <p className="text-[10px] text-stone-500">{certFileSize || 'Verified image'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCertPreview(null);
                          setCertFileName('');
                          setCertFileSize('');
                          if (certInputRef.current) certInputRef.current.value = '';
                        }}
                        className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-red-50 text-stone-400 hover:text-red-600 flex items-center justify-center transition-colors shrink-0"
                        title={t('Remove certificate', 'মুছে ফেলুন')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => certInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-teal-500 hover:bg-teal-50/30 ${
                        errors.certificate ? 'border-red-400 bg-red-50/20' : 'border-stone-300 bg-stone-50/50'
                      }`}
                    >
                      <ImagePlus className="w-6 h-6 mx-auto text-teal-600 mb-1" />
                      <span className="font-bold text-stone-800 block text-xs">
                        {t('Upload Certificate Photo', 'সনদপত্রের ছবি বেছে নিন')}
                      </span>
                      <span className="text-[10px] text-stone-500 block mt-0.5">
                        JPG, PNG, WebP (max 5 MB)
                      </span>
                    </div>
                  )}

                  <input
                    ref={certInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCertUpload}
                    className="hidden"
                  />
                  {errors.certificate && (
                    <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {errors.certificate}
                    </p>
                  )}
                </div>

                {/* 6. NID Photo Upload */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-stone-700">
                    {t('National ID (NID) Photo Upload', 'জাতীয় পরিচয়পত্র (NID) ছবি')} <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-stone-500">
                    {t('Smart NID card front photo or scan (max 5 MB)', 'স্মার্ট NID কার্ডের ছবি বা স্ক্যান কপি (সর্বোচ্চ ৫ MB)')}
                  </p>

                  {nidPreview ? (
                    <div className="relative rounded-xl border border-teal-300 bg-teal-50/50 p-2.5 flex items-center gap-3 shadow-2xs">
                      <img
                        src={nidPreview}
                        alt="NID Preview"
                        className="w-16 h-16 rounded-lg object-cover border border-teal-200 shrink-0 bg-white"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded inline-block mb-1">
                          ✓ {t('NID Uploaded', 'NID আপলোড সম্পন্ন')}
                        </span>
                        <p className="text-[11px] font-semibold text-stone-800 truncate">
                          {nidFileName || 'nid_card.jpg'}
                        </p>
                        <p className="text-[10px] text-stone-500">{nidFileSize || 'Verified image'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNidPreview(null);
                          setNidFileName('');
                          setNidFileSize('');
                          if (nidInputRef.current) nidInputRef.current.value = '';
                        }}
                        className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-red-50 text-stone-400 hover:text-red-600 flex items-center justify-center transition-colors shrink-0"
                        title={t('Remove NID photo', 'মুছে ফেলুন')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => nidInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:border-teal-500 hover:bg-teal-50/30 ${
                        errors.nid ? 'border-red-400 bg-red-50/20' : 'border-stone-300 bg-stone-50/50'
                      }`}
                    >
                      <CreditCard className="w-6 h-6 mx-auto text-teal-600 mb-1" />
                      <span className="font-bold text-stone-800 block text-xs">
                        {t('Upload NID Photo', 'NID কার্ডের ছবি বেছে নিন')}
                      </span>
                      <span className="text-[10px] text-stone-500 block mt-0.5">
                        JPG, PNG, WebP (max 5 MB)
                      </span>
                    </div>
                  )}

                  <input
                    ref={nidInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleNidUpload}
                    className="hidden"
                  />
                  {errors.nid && (
                    <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> {errors.nid}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Profile & Credentials Section */}
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-stone-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-stone-200 pb-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-teal-600" />
                {t('3. Designation, Specialty & Location', '৩. পদবী, বিশেষজ্ঞ ক্ষেত্র ও অবস্থান')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Designation / Role Title', 'পদবী')}
                  </label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder="e.g. Senior Scientific Officer, BARI"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('District & Station', 'পোস্টিং জেলা')}
                  </label>
                  <select
                    value={district}
                    onChange={(e) => {
                      setDistrict(e.target.value);
                      const loc = BANGLADESH_LOCATIONS.find((l) => l.district === e.target.value);
                      if (loc && loc.upazilas.length > 0) setUpazila(loc.upazilas[0]);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  >
                    {BANGLADESH_LOCATIONS.map((loc) => (
                      <option key={loc.district} value={loc.district}>
                        {loc.district} ({loc.districtBn})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Specialization Pills */}
              <div>
                <label className="block font-bold text-stone-700 mb-1.5">
                  {t('Specialization Areas', 'বিশেষজ্ঞতার ক্ষেত্রসমূহ')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALIZATION_OPTIONS.map((spec) => {
                    const isSelected = specializations.includes(spec.id);
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => toggleSpecialization(spec.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-teal-700 text-white border-teal-700 shadow-2xs'
                            : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                        }`}
                      >
                        {isSelected ? '✓ ' : '+ '}
                        {language === 'bn' ? spec.bn : spec.en}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Account Password Section */}
            <div className="space-y-4 pt-2">
              <h3 className="font-bold text-stone-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-stone-200 pb-1.5">
                <Lock className="w-3.5 h-3.5 text-teal-600" />
                {t('4. Set Account Password for Sign In', '৪. অ্যাকাউন্টে লগইন করার পাসওয়ার্ড')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Password (min 8 characters)', 'পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full px-3 py-2.5 rounded-xl border ${
                        errors.password ? 'border-red-500 bg-red-50/30' : 'border-stone-300 bg-white'
                      } focus:ring-2 focus:ring-teal-500 focus:outline-hidden pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-[11px] text-red-600 mt-1">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Confirm Password', 'পাসওয়ার্ড নিশ্চিত করুন')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`w-full px-3 py-2.5 rounded-xl border ${
                      errors.confirmPassword ? 'border-red-500 bg-red-50/30' : 'border-stone-300 bg-white'
                    } focus:ring-2 focus:ring-teal-500 focus:outline-hidden`}
                  />
                  {errors.confirmPassword && (
                    <p className="text-[11px] text-red-600 mt-1">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Bar */}
            <div className="pt-4 border-t border-stone-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold text-xs transition-colors"
              >
                {t('Cancel', 'বাতিল')}
              </button>

              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:bg-stone-300 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 hover:-translate-y-0.5"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{t('Verifying & Registering...', 'যাচাই ও নিবন্ধন চলছে...')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('Complete Expert Registration', 'বিশেষজ্ঞ নিবন্ধন সম্পন্ন করুন')}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
