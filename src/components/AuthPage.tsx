import React, { useState, useEffect, useRef } from 'react';
import { Language, UserRole, User } from '../types';
import { AuthStore, LoginResult } from '../data/store';
import { BANGLADESH_LOCATIONS } from '../data/mockData';
import { apiService } from '../services/apiService';
import {
  Sprout,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Store,
  ShoppingCart,
  RefreshCw,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowLeft,
  Clock,
  Mail,
  MapPin,
  Building,
  Sparkles,
} from 'lucide-react';

interface AuthPageProps {
  language: Language;
  onLanguageToggle: () => void;
  onAuthSuccess: (user: User) => void;
}

const COMMON_CROP_PILLS = [
  { en: 'Potato', bn: 'আলু' },
  { en: 'Tomato', bn: 'টমেটো' },
  { en: 'Green Chili', bn: 'কাঁচা মরিচ' },
  { en: 'Eggplant', bn: 'বেগুন' },
  { en: 'Cauliflower', bn: 'ফুলকপি' },
  { en: 'Onion', bn: 'পেঁয়াজ' },
  { en: 'Paddy', bn: 'ধান' },
  { en: 'Cabbage', bn: 'বাঁধাকপি' },
  { en: 'Carrot', bn: 'গাজর' },
];

export const AuthPage: React.FC<AuthPageProps> = ({
  language,
  onLanguageToggle,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');
  const [isAdminPortal, setIsAdminPortal] = useState(false);

  // Login credentials - completely empty by default, no demo passwords
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Admin 2FA Step State
  const [is2FAStep, setIs2FAStep] = useState(false);
  const [securityPin, setSecurityPin] = useState('');
  const [adminPhonePending, setAdminPhonePending] = useState('');
  const [adminPasswordPending, setAdminPasswordPending] = useState('');
  const [totpCountdown, setTotpCountdown] = useState(30);

  // Lockout State
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Registration form states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regDistrict, setRegDistrict] = useState('Bogura');
  const [regUpazila, setRegUpazila] = useState('Shibganj');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Farmer specific simplified fields
  const [farmSize, setFarmSize] = useState('');
  const [selectedCropPills, setSelectedCropPills] = useState<string[]>(['Potato', 'Tomato']);

  // Supplier specific fields
  const [shopName, setShopName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // TOTP Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTotpCountdown((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutSeconds > 0) {
      const lockTimer = setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(lockTimer);
    }
  }, [lockoutSeconds]);

  // Select a role tab & configure defaults
  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setIsAdminPortal(role === 'admin');
    setIs2FAStep(false);
    setError('');
  };

  // Upazilas based on chosen district
  const selectedLocation = BANGLADESH_LOCATIONS.find(
    (l) => l.district.toLowerCase() === regDistrict.toLowerCase()
  );
  const upazilaList = selectedLocation ? selectedLocation.upazilas : [];

  // Password strength
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };
  const pwdStrength = getPasswordStrength(regPassword);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const targetRole = isAdminPortal ? 'admin' : selectedRole;

    try {
      const apiRes = await apiService.login({
        identifier: loginIdentifier.trim(),
        password: loginPassword,
        securityPin: is2FAStep ? securityPin.trim() : undefined,
        role: targetRole,
      });

      if (apiRes.require2FA) {
        setIs2FAStep(true);
        setAdminPhonePending(loginIdentifier);
        setAdminPasswordPending(loginPassword);
        setLoading(false);
        return;
      }

      if (apiRes.locked) {
        setIsLocked(true);
        setLockoutSeconds(apiRes.remainingSeconds || 180);
        setError(
          language === 'bn'
            ? `একাধিক ভুল চেষ্টার কারণে অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে। ${apiRes.remainingSeconds} সেকেন্ড পর চেষ্টা করুন।`
            : `Account locked due to failed attempts. Please retry in ${apiRes.remainingSeconds}s.`
        );
        setLoading(false);
        return;
      }

      if (apiRes.success && apiRes.user) {
        AuthStore.setCurrentUser(apiRes.user);
        setLoading(false);
        onAuthSuccess(apiRes.user);
        return;
      }

      if (apiRes.error) {
        setError(apiRes.message || (language === 'bn' ? 'লগইন তথ্য সঠিক নয়।' : 'Invalid credentials.'));
        setLoading(false);
        return;
      }
    } catch {
      // Offline fallback to local store
      const result: LoginResult = AuthStore.login(
        loginIdentifier,
        loginPassword,
        is2FAStep ? securityPin : undefined,
        targetRole
      );
      setLoading(false);

      if (result.locked) {
        setIsLocked(true);
        setLockoutSeconds(result.remainingSeconds || 180);
        setError(
          language === 'bn'
            ? `একাধিক ভুল চেষ্টার কারণে অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে। ${result.remainingSeconds} সেকেন্ড পর চেষ্টা করুন।`
            : `Account locked due to 3 failed attempts. Please retry in ${result.remainingSeconds}s.`
        );
        return;
      }

      if (result.require2FA) {
        setIs2FAStep(true);
        setAdminPhonePending(loginIdentifier);
        setAdminPasswordPending(loginPassword);
        return;
      }

      if (result.success && result.user) {
        onAuthSuccess(result.user);
      } else {
        setError(
          result.message ||
            (language === 'bn'
              ? 'মোবাইল নম্বর/ইমেইল বা পাসওয়ার্ড সঠিক নয়।'
              : 'Invalid credentials. Please verify your phone/email and password.')
        );
      }
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiRes = await apiService.login({
        identifier: adminPhonePending,
        password: adminPasswordPending,
        securityPin: securityPin.trim(),
        role: 'admin',
      });
      setLoading(false);

      if (apiRes.success && apiRes.user) {
        AuthStore.setCurrentUser(apiRes.user);
        onAuthSuccess(apiRes.user);
        return;
      }

      setError(apiRes.message || (language === 'bn' ? 'ভুল টু-ফ্যাক্টর (2FA) নিরাপত্তা কোড!' : 'Invalid 2FA security code.'));
    } catch {
      const result: LoginResult = AuthStore.login(
        adminPhonePending,
        adminPasswordPending,
        securityPin
      );
      setLoading(false);

      if (result.success && result.user) {
        onAuthSuccess(result.user);
      } else {
        setError(
          language === 'bn'
            ? 'ভুল টু-ফ্যাক্টর (2FA) নিরাপত্তা কোড! পুনরায় চেষ্টা করুন।'
            : 'Invalid 2FA Authenticator Token. Please re-enter.'
        );
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedRole === 'admin') {
      setError(
        t(
          'Admin accounts are managed privately. Please sign in via Admin portal.',
          'অ্যাডমিন অ্যাকাউন্ট উন্মুক্ত নিবন্ধনের জন্য উপলব্ধ নয়।'
        )
      );
      return;
    }

    if (!regName.trim()) {
      setError(t('Please enter your full name', 'আপনার পূর্ণ নাম লিখুন'));
      return;
    }

    const cleanPhone = regPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setError(t('Please enter a valid mobile number (e.g. 017XXXXXXXX)', 'সঠিক মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)'));
      return;
    }

    if (selectedRole !== 'farmer' && regEmail.trim() && !regEmail.includes('@')) {
      setError(t('Please enter a valid email address', 'সঠিক ইমেইল ঠিকানা দিন'));
      return;
    }

    if (selectedRole === 'supplier' && !shopName.trim()) {
      setError(t('Shop / Enterprise name is required', 'দোকান বা প্রতিষ্ঠানের নাম আবশ্যক'));
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError(t('Passwords do not match', 'পাসওয়ার্ড দুটি মিলছে না'));
      return;
    }

    if (regPassword.length < 6) {
      setError(
        t(
          'Password must be at least 6 characters',
          'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে'
        )
      );
      return;
    }

    setLoading(true);

    const cleanEmail = regEmail.trim().toLowerCase() || `${cleanPhone}@nativebazar.local`;

    try {
      const apiRes = await apiService.register({
        name: regName.trim(),
        phone: cleanPhone,
        email: cleanEmail,
        password: regPassword,
        role: selectedRole as 'farmer' | 'supplier' | 'customer',
        district: regDistrict,
        upazila: regUpazila || (upazilaList[0] || 'Bogura Sadar'),
        farmSizeAcres: selectedRole === 'farmer' ? (parseFloat(farmSize) || undefined) : undefined,
        primaryCrops: selectedRole === 'farmer' ? selectedCropPills : undefined,
        shopName: selectedRole === 'supplier' ? shopName.trim() : undefined,
        licenseNumber: selectedRole === 'supplier' ? licenseNumber.trim() : undefined,
      });

      if (apiRes.success && apiRes.user) {
        AuthStore.setCurrentUser(apiRes.user);
        setLoading(false);
        onAuthSuccess(apiRes.user);
        return;
      }

      if (apiRes.error) {
        setError(apiRes.message || (language === 'bn' ? 'নিবন্ধনে ত্রুটি হয়েছে।' : 'Registration failed.'));
        setLoading(false);
        return;
      }
    } catch {
      // Local fallback
      const existingRoleAccount = AuthStore.getUsers().find(
        (u) =>
          ((u.phone && u.phone === cleanPhone) ||
           (u.email && u.email.toLowerCase() === cleanEmail)) &&
          u.role === selectedRole
      );

      if (existingRoleAccount) {
        setError(
          t(
            `An account already exists with this phone/email. Please sign in instead.`,
            `এই ফোন নম্বরে ইতিমধ্যে একটি অ্যাকাউন্ট রয়েছে। লগইন করুন।`
          )
        );
        setLoading(false);
        return;
      }

      const newUser = AuthStore.register({
        name: regName.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        password: regPassword,
        role: selectedRole,
        district: regDistrict,
        upazila: regUpazila || (upazilaList[0] || 'Bogura Sadar'),
        verified: true,
        farmSizeAcres: selectedRole === 'farmer' ? (parseFloat(farmSize) || undefined) : undefined,
        primaryCrops: selectedRole === 'farmer' ? selectedCropPills : undefined,
        shopName: selectedRole === 'supplier' ? shopName.trim() : undefined,
        licenseNumber: selectedRole === 'supplier' ? licenseNumber.trim() : undefined,
      });

      setLoading(false);
      onAuthSuccess(newUser);
    }
  };

  // Only expose Farmer, Supplier, and Consumer
  const roleNavItems: Array<{
    role: UserRole;
    icon: React.ReactNode;
    labelEn: string;
    labelBn: string;
    badgeBg: string;
    descEn: string;
    descBn: string;
  }> = [
    {
      role: 'farmer',
      icon: <Sprout className="w-4 h-4" />,
      labelEn: 'Farmer',
      labelBn: 'কৃষক',
      badgeBg: 'text-emerald-700 bg-emerald-50 border-emerald-300',
      descEn: 'Direct farm produce listings, transparent rates, organic inputs & orders.',
      descBn: 'সরাসরি ফসল বিক্রি, স্বচ্ছ বাজার দর, জৈব সার-বীজ সংগ্রহ ও অর্ডার।',
    },
    {
      role: 'supplier',
      icon: <Store className="w-4 h-4" />,
      labelEn: 'Supplier',
      labelBn: 'সরবরাহকারী',
      badgeBg: 'text-amber-700 bg-amber-50 border-amber-300',
      descEn: 'Verified organic inputs, bio-fertilizers, seeds & delivery fulfillment.',
      descBn: 'জৈব সার, বালাইনাশক, উন্নত বীজ সরবরাহ ও ডেলিভারি ব্যবস্থাপনা।',
    },
    {
      role: 'customer',
      icon: <ShoppingCart className="w-4 h-4" />,
      labelEn: 'Consumer',
      labelBn: 'ভোক্তা',
      badgeBg: 'text-purple-700 bg-purple-50 border-purple-300',
      descEn: 'Fresh chemical-free harvests directly from local farmers at fair prices.',
      descBn: 'মাঠ থেকে সরাসরি তাজা ও রাসায়নিকমুক্ত কৃষিপণ্য সুলভ মূল্যে সংগ্রহ।',
    },
  ];

  const activeRoleConfig = isAdminPortal
    ? {
        role: 'admin' as UserRole,
        icon: <ShieldCheck className="w-4 h-4" />,
        labelEn: 'Admin Portal',
        labelBn: 'অ্যাডমিন পোর্টাল',
        badgeBg: 'text-slate-800 bg-slate-100 border-slate-300',
        descEn: 'Administrative security governance & platform management.',
        descBn: 'প্ল্যাটফর্ম প্রশাসন ও নিরাপত্তা ব্যবস্থাপনা।',
      }
    : roleNavItems.find((r) => r.role === selectedRole) || roleNavItems[0];

  const displayedRoles = roleNavItems;

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{
        background: 'linear-gradient(135deg, #022c22 0%, #064e3b 40%, #0f766e 75%, #082f49 100%)',
      }}
    >
      {/* Left Overview Panel */}
      <div className="hidden lg:flex flex-col justify-between w-5/12 p-10 xl:p-14 text-white relative overflow-hidden">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-lg">
              <Sprout className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">NativeBazar</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  v5.0 Enterprise
                </span>
              </div>
              <p className="text-emerald-300 text-xs font-semibold">নেটিভবাজার • AI Agricultural Cyber Architecture</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Multi-Role Authentication & Location Intelligence</span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-extrabold leading-tight text-white">
              {t(
                'Role-Separated Agricultural Commerce Engine',
                'ভূমিকাভিত্তিক নিরাপদ স্মার্ট কৃষি ও সরবরাহ প্ল্যাটফর্ম'
              )}
            </h2>
            <p className="text-emerald-100/80 text-xs xl:text-sm leading-relaxed">
              {t(
                'Distinct portals for Farmers, Businessmen, Suppliers, Consumers, Agronomy Experts, and Administrators, backed by verified location data and official DAM daily market bulletins.',
                'কৃষক, পাইকারি ব্যবসায়ী, সার-বীজ সরবরাহকারী, ভোক্তা, কৃষি কর্মকর্তা এবং অ্যাডমিনদের জন্য সম্পূর্ণ স্বতন্ত্র ও এনক্রিপ্টেড প্রবেশ ব্যবস্থা।'
              )}
            </p>
          </div>

          {/* Role Preview Card */}
          <div className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                {activeRoleConfig.icon}
                <span>Active Portal: {t(activeRoleConfig.labelEn, activeRoleConfig.labelBn)}</span>
              </span>
              {selectedRole === 'admin' && (
                <span className="px-2 py-0.5 bg-emerald-500/30 border border-emerald-400 text-emerald-200 text-[10px] font-black rounded-md">
                  AUTHENTICATED ACCESS
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-100 leading-normal">
              {language === 'bn' ? activeRoleConfig.descBn : activeRoleConfig.descEn}
            </p>
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-emerald-400/80 space-y-1">
          <p>NativeBazar • Bogura Pilot Node • Department of Agricultural Marketing (DAM)</p>
          <p className="text-[10px] text-emerald-400/60">Strictly zero-fabrication real agricultural telemetry.</p>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-7/12 flex items-center justify-center p-4 sm:p-8 bg-stone-50 overflow-y-auto min-h-screen">
        <div className="w-full max-w-xl my-auto space-y-5">
          {/* Top Controls: Mode & Language */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-stone-200/80 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setIs2FAStep(false);
                  setError('');
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  mode === 'login' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                {t('Sign In (লগইন)', 'লগইন')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setIs2FAStep(false);
                  setError('');
                  if (selectedRole === 'admin') {
                    handleRoleSelect('farmer');
                  }
                }}
                className={`px-3.5 py-1.5 rounded-lg transition-all ${
                  mode === 'register' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                {t('Register (নিবন্ধন)', 'নিবন্ধন')}
              </button>
            </div>

            <button
              type="button"
              onClick={onLanguageToggle}
              className="px-3 py-1.5 bg-white text-stone-800 text-xs font-bold rounded-xl border border-stone-200 shadow-2xs hover:bg-stone-100 transition-colors"
            >
              {language === 'bn' ? 'English' : 'বাংলা'}
            </button>
          </div>

          {/* ROLE TABS */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-stone-600 block">
              {t('Select Stakeholder Role / ভূমিকা নির্বাচন করুন:', 'আপনার ভূমিকা নির্বাচন করুন:')}
            </span>
            <div className={`grid gap-2 ${mode === 'register' ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3 sm:grid-cols-6'}`}>
              {displayedRoles.map((r) => {
                const isSelected = selectedRole === r.role;
                return (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => handleRoleSelect(r.role)}
                    className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-extrabold shadow-xs ring-2 ring-emerald-500/20'
                        : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 font-medium'
                    }`}
                  >
                    <span className={isSelected ? 'text-emerald-700' : 'text-stone-500'}>
                      {r.icon}
                    </span>
                    <span className="text-[11px] leading-tight">
                      {language === 'bn' ? r.labelBn : r.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Header Title */}
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${activeRoleConfig.badgeBg}`}>
                {language === 'bn' ? activeRoleConfig.labelBn : activeRoleConfig.labelEn}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                {is2FAStep
                  ? t('Admin Security Clearance (2FA)', 'অ্যাডমিন নিরাপত্তা যাচাই (২-ফ্যাক্টর)')
                  : mode === 'login'
                  ? t(
                      `${activeRoleConfig.labelEn} Portal Login`,
                      `${activeRoleConfig.labelBn} পোর্টালে প্রবেশ`
                    )
                  : t(
                      `Register as ${activeRoleConfig.labelEn}`,
                      `নতুন ${activeRoleConfig.labelBn} হিসেবে নিবন্ধন`
                    )}
              </h2>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {is2FAStep
                ? t(
                    'Enter 6-digit TOTP security code to authenticate root clearance',
                    'রুট সেশনে প্রবেশের জন্য ৬-সংখ্যার নিরাপত্তা পিন প্রদান করুন'
                  )
                : mode === 'login'
                ? t(
                    'Enter your registered Email or Mobile Phone and password.',
                    'আপনার নিবন্ধিত ইমেইল বা মোবাইল নম্বর এবং গোপন পাসওয়ার্ড দিন।'
                  )
                : t(
                    'Fill in required personal details, educational qualification, and location.',
                    'নাম, শিক্ষাগত যোগ্যতা, জেলা-উপজেলা, ইমেইল এবং পাসওয়ার্ড দিয়ে ফরমটি পূরণ করুন।'
                  )}
            </p>
          </div>

          {/* Lockout Banner */}
          {isLocked && (
            <div className="p-4 bg-red-50 border border-red-300 rounded-2xl flex items-start gap-3 text-xs text-red-900 animate-slide-down">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-sm">
                  {t('Account Temporarily Locked!', 'অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে!')}
                </strong>
                <span>
                  {t(
                    `Too many incorrect attempts. Unlocking in ${lockoutSeconds} seconds.`,
                    `একাধিক ভুল পাসওয়ার্ডের কারণে অ্যাকাউন্ট লক হয়েছে। আর ${lockoutSeconds} সেকেন্ড অপেক্ষা করুন।`
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !isLocked && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 animate-slide-up">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ADMIN 2FA FORM */}
          {is2FAStep ? (
            <form
              onSubmit={handle2FASubmit}
              className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4"
            >
              <div className="bg-gradient-to-r from-slate-900 to-emerald-950 p-4 rounded-xl text-white space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    {t('Two-Factor Authentication (2FA)', 'টু-ফ্যাক্টর নিরাপত্তা যাচাই (2FA)')}
                  </span>
                  <span className="text-[10px] font-mono text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {totpCountdown}s
                  </span>
                </div>
                <p className="text-[11px] text-stone-300">
                  {t(
                    'Enter the 6-digit TOTP code generated by your Authenticator application.',
                    'আপনার প্রমাণীকরণ অ্যাপ (Authenticator) থেকে ৬-সংখ্যার কোডটি প্রবেশ করান।'
                  )}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {t('Enter 6-Digit Security Code', '৬-সংখ্যার নিরাপত্তা পিন দিন')}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    maxLength={6}
                    value={securityPin}
                    onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-base font-mono font-bold tracking-widest text-center focus:outline-emerald-600"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIs2FAStep(false)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t('Back', 'ফিরে যান')}
                </button>
                <button
                  type="submit"
                  disabled={loading || securityPin.length < 6}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>{t('Verify & Sign In', 'যাচাই ও প্রবেশ করুন')}</span>
                </button>
              </div>
            </form>
          ) : mode === 'login' ? (
            /* ROLE-BASED LOGIN INTERFACE */
            <form
              onSubmit={handleLogin}
              className="space-y-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm"
            >
              {/* Login Identifier: Email, Phone, or Admin ID */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {isAdminPortal
                    ? t('Administrator ID or Email', 'অ্যাডমিন আইডি বা ইমেইল')
                    : selectedRole === 'farmer'
                    ? t('Mobile Phone Number / ইমেইল', 'মোবাইল নম্বর অথবা ইমেইল')
                    : t('Email Address or Mobile Phone', 'ইমেইল ঠিকানা অথবা মোবাইল নম্বর')}
                </label>
                <div className="relative">
                  {isAdminPortal ? (
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  ) : selectedRole === 'farmer' ? (
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  ) : (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  )}
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={
                      isAdminPortal
                        ? 'Admin ID / Email'
                        : selectedRole === 'farmer'
                        ? '017XXXXXXXX'
                        : '017XXXXXXXX / user@example.com'
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium focus:outline-emerald-600 font-mono"
                    required
                    disabled={isLocked}
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-stone-700">
                    {t('Password', 'পাসওয়ার্ড')}
                  </label>
                  <span className="text-[10px] text-stone-400">Salted SHA-256</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder={t('Enter password', 'পাসওয়ার্ড দিন')}
                    className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium focus:outline-emerald-600"
                    required
                    disabled={isLocked}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || isLocked}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>
                  {loading
                    ? t('Authenticating...', 'যাচাই হচ্ছে...')
                    : t(
                        `Sign In to ${activeRoleConfig.labelEn} Account`,
                        `${activeRoleConfig.labelBn} অ্যাকাউন্টে প্রবেশ করুন`
                      )}
                </span>
              </button>

              {/* Discreet Administrator Access Link */}
              <div className="pt-2 text-center border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminPortal(!isAdminPortal);
                    setError('');
                  }}
                  className="text-[11px] font-semibold text-stone-400 hover:text-stone-700 transition-colors inline-flex items-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>
                    {isAdminPortal
                      ? t('← Back to Stakeholder Portal', '← ব্যবহারকারী পোর্টালে ফিরুন')
                      : t('Administrative Security Portal', 'অ্যাডমিন সিকিউরিটি পোর্টাল')}
                  </span>
                </button>
              </div>
            </form>
          ) : (
            /* ROLE-BASED REGISTRATION INTERFACE */
            <form
              onSubmit={handleRegister}
              className="space-y-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm text-xs"
            >
              {/* Mandatory: Full Name */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {selectedRole === 'farmer'
                    ? t('Full Name (কৃষকের নাম) *', 'আপনার নাম *')
                    : selectedRole === 'supplier'
                    ? t('Dealer / Representative Name (প্রতিনিধির নাম) *', 'প্রতিনিধির পূর্ণ নাম *')
                    : t('Full Name (পূর্ণ নাম) *', 'পূর্ণ নাম *')}
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder={
                    selectedRole === 'farmer'
                      ? 'যেমন: মোঃ মোস্তফা কামাল'
                      : 'e.g. Md. Mostafa Kamal'
                  }
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
              </div>

              {/* Mobile Phone & Optional Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-stone-400" />
                    {t('Mobile Number (মোবাইল নম্বর) *', 'মোবাইল নম্বর *')}
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    {selectedRole === 'farmer'
                      ? t('Email Address (ঐচ্ছিক)', 'ইমেইল (প্রয়োজন হলে দিন)')
                      : t('Email Address (ইমেইল)', 'ইমেইল ঠিকানা')}
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Location: District & Upazila */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    {t('District (জেলা) *', 'জেলা *')}
                  </label>
                  <select
                    value={regDistrict}
                    onChange={(e) => {
                      setRegDistrict(e.target.value);
                      const loc = BANGLADESH_LOCATIONS.find(
                        (l) => l.district.toLowerCase() === e.target.value.toLowerCase()
                      );
                      if (loc && loc.upazilas.length > 0) {
                        setRegUpazila(loc.upazilas[0]);
                      }
                    }}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl cursor-pointer"
                  >
                    {BANGLADESH_LOCATIONS.map((loc) => (
                      <option key={loc.district} value={loc.district}>
                        {loc.district} ({loc.districtBn})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Upazila / Thana (উপজেলা) *', 'উপজেলা *')}
                  </label>
                  <select
                    value={regUpazila}
                    onChange={(e) => setRegUpazila(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl cursor-pointer"
                  >
                    {upazilaList.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* FARMER EXTRAS: Simplified with clickable Crop presets */}
              {selectedRole === 'farmer' && (
                <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 flex items-center gap-1 text-xs">
                      <Sprout className="w-4 h-4 text-emerald-700" />
                      {t('What crops do you grow?', 'আপনার প্রধান ফসলসমূহ নির্বাচন করুন')}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      {t('Click to toggle', 'ক্লিক করে নির্বাচন করুন')}
                    </span>
                  </div>

                  {/* Crop Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_CROP_PILLS.map((crop) => {
                      const isSelected = selectedCropPills.includes(crop.en);
                      return (
                        <button
                          key={crop.en}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedCropPills((prev) => prev.filter((c) => c !== crop.en));
                            } else {
                              setSelectedCropPills((prev) => [...prev, crop.en]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:bg-emerald-100/50'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                          <span>{language === 'bn' ? crop.bn : crop.en}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block font-semibold text-emerald-950 mb-1 text-[11px]">
                      {t('Farm Size (Optional, in Acres)', 'জমির আয়তন (ঐচ্ছিক, একরে)')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={farmSize}
                      onChange={(e) => setFarmSize(e.target.value)}
                      placeholder="e.g. 2.5"
                      className="w-full p-2 bg-white border border-emerald-300 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {/* SUPPLIER EXTRAS: Organic focused shop name and license */}
              {selectedRole === 'supplier' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Enterprise / Shop Name *', 'প্রতিষ্ঠান বা দোকানের নাম *')}
                    </label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Modern Krishi Bitan"
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Trade License / Reg (Optional)', 'ট্রেড লাইসেন্স (ঐচ্ছিক)')}
                    </label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="e.g. DAE-TRD-2026"
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Password *', 'পাসওয়ার্ড *')}
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder={t('Min 6 characters', 'কমপক্ষে ৬ অক্ষর')}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                    autoComplete="new-password"
                  />
                  {/* Real-time Password Strength Meter */}
                  <div className="mt-1.5 space-y-1">
                    <div className="flex gap-1 h-1.5">
                      <div
                        className={`flex-1 rounded-full ${
                          pwdStrength >= 1 ? 'bg-red-500' : 'bg-stone-200'
                        }`}
                      />
                      <div
                        className={`flex-1 rounded-full ${
                          pwdStrength >= 2 ? 'bg-amber-500' : 'bg-stone-200'
                        }`}
                      />
                      <div
                        className={`flex-1 rounded-full ${
                          pwdStrength >= 3 ? 'bg-blue-500' : 'bg-stone-200'
                        }`}
                      />
                      <div
                        className={`flex-1 rounded-full ${
                          pwdStrength >= 4 ? 'bg-emerald-500' : 'bg-stone-200'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    {t('Confirm Password *', 'পাসওয়ার্ড নিশ্চিত করুন *')}
                  </label>
                  <input
                    type="password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder={t('Repeat password', 'পুনরায় লিখুন')}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>
                  {t(
                    `Register as ${activeRoleConfig.labelEn}`,
                    `${activeRoleConfig.labelBn} হিসেবে নিবন্ধন সম্পন্ন করুন`
                  )}
                </span>
              </button>
            </form>
          )}

          {/* Footer attribution */}
          <div className="text-center text-[11px] text-stone-400">
            NativeBazar Security Module • SHA-256 Salted Hashing • Zero-Fabrication Platform
          </div>
        </div>
      </div>
    </div>
  );
};

