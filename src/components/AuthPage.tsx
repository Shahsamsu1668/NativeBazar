import React, { useState, useEffect } from 'react';
import { Language, UserRole, User } from '../types';
import { AuthStore, LoginResult } from '../data/store';
import { DEMO_CREDENTIALS, BANGLADESH_LOCATIONS } from '../data/mockData';
import {
  Sprout,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  Store,
  ShoppingCart,
  Microscope,
  RefreshCw,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowLeft,
  Clock,
  Mail,
  GraduationCap,
  MapPin,
  Building,
} from 'lucide-react';

interface AuthPageProps {
  language: Language;
  onLanguageToggle: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  language,
  onLanguageToggle,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');

  // Login credentials
  const [loginIdentifier, setLoginIdentifier] = useState('01712458920');
  const [loginPassword, setLoginPassword] = useState('Krishi#2026!Rafiq');
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
  const [regEducation, setRegEducation] = useState('Diploma in Agriculture');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Role extras for registration
  const [farmSize, setFarmSize] = useState('3.5');
  const [cropsSelected, setCropsSelected] = useState('Potato, Tomato, Chili');
  const [businessName, setBusinessName] = useState('Bogura Trading Hub');
  const [businessType, setBusinessType] = useState('Wholesaler / Aratdar');
  const [shopName, setShopName] = useState('Krishi Upokoron Bitan');
  const [licenseNumber, setLicenseNumber] = useState('LIC-BOG-2026');
  const [designation, setDesignation] = useState('Assistant Agronomy Officer');
  const [institution, setInstitution] = useState('Department of Agricultural Extension (DAE)');

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
    setIs2FAStep(false);
    setError('');

    const cred = DEMO_CREDENTIALS[role];
    if (cred) {
      setLoginIdentifier(cred.phone);
      setLoginPassword(cred.password);
    }
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

    await new Promise((r) => setTimeout(r, 400));

    const result: LoginResult = AuthStore.login(
      loginIdentifier,
      loginPassword,
      is2FAStep ? securityPin : undefined,
      selectedRole
    );
    setLoading(false);

    if (result.locked) {
      setIsLocked(true);
      setLockoutSeconds(result.remainingSeconds || 180);
      setError(
        language === 'bn'
          ? `একাধিক ভুল চেষ্টার কারণে অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে। ${result.remainingSeconds} সেকেন্ড পর চেষ্টা করুন।`
          : `Account locked due to 3 failed attempts. Please retry in ${result.remainingSeconds}s.`
      );
      return;
    }

    if (result.require2FA) {
      setIs2FAStep(true);
      setAdminPhonePending(loginIdentifier);
      setAdminPasswordPending(loginPassword);
      if (result.error === 'INVALID_2FA_PIN') {
        setError(
          language === 'bn'
            ? 'প্রদত্ত ৬-সংখ্যার অ্যাডমিন টু-ফ্যাক্টর (2FA) পিন কোডটি ভুল! সঠিক কোডটি দিন।'
            : 'Invalid 6-digit Admin Security Code / PIN. Please re-enter.'
        );
      }
      return;
    }

    if (result.success && result.user) {
      onAuthSuccess(result.user);
    } else {
      setError(
        result.message ||
          (language === 'bn'
            ? 'মোবাইল নম্বর/ইমেইল বা পাসওয়ার্ড সঠিক নয়। নিচের ডেমো বাটনে ক্লিক করে সঠিক তথ্য পূরণ করতে পারেন।'
            : 'Invalid credentials. Please click the demo credential chip below to auto-fill.')
      );
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise((r) => setTimeout(r, 450));
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
          ? 'ভুল টু-ফ্যাক্টর (2FA) নিরাপত্তা কোড! পরীক্ষামূলক কোড: 883650'
          : 'Invalid 2FA Authenticator Token. Demo code is: 883650'
      );
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedRole === 'admin') {
      setError(
        t(
          'Admin accounts are pre-provisioned by platform security authority. Please sign in via Admin portal.',
          'নিরাপত্তাজনিত কারণে অ্যাডমিন অ্যাকাউন্ট সরাসরি নিবন্ধনযোগ্য নয়। অনুগ্রহ করে অ্যাডমিন লগইন ব্যবহার করুন।'
        )
      );
      return;
    }

    if (!regName.trim()) {
      setError(t('Please enter your full name', 'আপনার পূর্ণ নাম লিখুন'));
      return;
    }

    if (!regEmail.includes('@')) {
      setError(t('Please enter a valid email address', 'সঠিক ইমেইল ঠিকানা দিন'));
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError(t('Passwords do not match', 'পাসওয়ার্ড দুটি মিলছে না'));
      return;
    }

    if (regPassword.length < 8) {
      setError(
        t(
          'Password must be at least 8 characters with numbers & symbols for security',
          'নিরাপত্তার স্বার্থে পাসওয়ার্ড কমপক্ষে ৮ অক্ষর, সংখ্যা ও স্পেশাল চিহ্নের হতে হবে'
        )
      );
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    const cleanPhone = regPhone.replace(/\D/g, '');
    const cleanEmail = regEmail.trim().toLowerCase();

    const existingRoleAccount = AuthStore.getUsers().find(
      (u) =>
        ((u.phone && u.phone === cleanPhone) ||
         (u.email && u.email.toLowerCase() === cleanEmail)) &&
        u.role === selectedRole
    );

    if (existingRoleAccount) {
      setError(
        t(
          `You already have a registered ${selectedRole.toUpperCase()} account with this email/phone. Please sign in instead.`,
          `এই ইমেইল বা ফোন নম্বরে ইতিমধ্যে একটি ${selectedRole === 'farmer' ? 'কৃষক' : selectedRole === 'businessman' ? 'ব্যবসায়ী' : selectedRole === 'supplier' ? 'সরবরাহকারী' : selectedRole === 'customer' ? 'ভোক্তা' : 'বিশেষজ্ঞ'} অ্যাকাউন্ট রয়েছে। অনুগ্রহ করে লগইন করুন।`
        )
      );
      setLoading(false);
      return;
    }

    const newUser = AuthStore.register({
      name: regName,
      email: cleanEmail,
      phone: cleanPhone || `017${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: regPassword,
      role: selectedRole,
      district: regDistrict,
      upazila: regUpazila || (upazilaList[0] || 'Bogura Sadar'),
      education: regEducation,
      verified: true,
      farmSizeAcres: selectedRole === 'farmer' ? parseFloat(farmSize) || 3 : undefined,
      primaryCrops: selectedRole === 'farmer' ? cropsSelected.split(',').map((s) => s.trim()) : undefined,
      businessName: selectedRole === 'businessman' ? businessName : undefined,
      shopName: selectedRole === 'supplier' ? shopName : undefined,
      licenseNumber: selectedRole === 'supplier' ? licenseNumber : undefined,
      designation: selectedRole === 'expert' ? designation : undefined,
      institution: selectedRole === 'expert' ? institution : undefined,
    });

    setLoading(false);
    onAuthSuccess(newUser);
  };

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
      descEn: 'Direct farm produce sales, mandi benchmark comparison, supplier orders & AI crop diagnostics.',
      descBn: 'ফসল বিক্রি, সরকারি আড়ত দর নিরীক্ষণ, কৃষি উপকরণ ক্রয় এবং এআই রোগ নির্ণয়।',
    },
    {
      role: 'businessman',
      icon: <Briefcase className="w-4 h-4" />,
      labelEn: 'Businessman',
      labelBn: 'ব্যবসায়ী',
      badgeBg: 'text-blue-700 bg-blue-50 border-blue-300',
      descEn: 'B2B agricultural trading, bulk harvest procurement, escrow contracts and logistics tracking.',
      descBn: 'পাইকারি ফসল ক্রয়, কৃষকদের সাথে সরাসরি চুক্তি ও আড়ত সরবরাহ ব্যবস্থাপনা।',
    },
    {
      role: 'supplier',
      icon: <Store className="w-4 h-4" />,
      labelEn: 'Supplier',
      labelBn: 'সরবরাহকারী',
      badgeBg: 'text-amber-700 bg-amber-50 border-amber-300',
      descEn: 'Certified seeds, bio-fertilizers, pesticides & machinery distribution to local farmers.',
      descBn: 'উন্নত বীজ, সার, কীটনাশক ও আধুনিক কৃষিযন্ত্র ডিলারশিপ ও অর্ডার ব্যবস্থাপনা।',
    },
    {
      role: 'customer',
      icon: <ShoppingCart className="w-4 h-4" />,
      labelEn: 'Customer',
      labelBn: 'ভোক্তা',
      badgeBg: 'text-purple-700 bg-purple-50 border-purple-300',
      descEn: 'Farm-fresh chemical-free produce delivered directly to your household with transparent pricing.',
      descBn: 'মাঠ থেকে সরাসরি তাজা সবজি, ফল ও খাদ্যপণ্য ন্যায্যমূল্যে হোম ডেলিভারি।',
    },
    {
      role: 'expert',
      icon: <Microscope className="w-4 h-4" />,
      labelEn: 'Agri Expert',
      labelBn: 'কৃষি কর্মকর্তা',
      badgeBg: 'text-teal-700 bg-teal-50 border-teal-300',
      descEn: 'Agronomy specialist portal for reviewing disease cases and publishing weather advisories.',
      descBn: 'কৃষি সম্প্রসারণ অধিদপ্তর কর্মকর্তা ও বিশেষজ্ঞদের জন্য প্রেসক্রিপশন ও পরামর্শ হাব।',
    },
    {
      role: 'admin',
      icon: <ShieldCheck className="w-4 h-4" />,
      labelEn: 'Admin',
      labelBn: 'অ্যাডমিন',
      badgeBg: 'text-slate-800 bg-slate-100 border-slate-300',
      descEn: 'Platform administrative governance control panel.',
      descBn: 'প্ল্যাটফর্মের কেন্দ্রীয় মনিটরিং ও কন্ট্রোল প্যানেল।',
    },
  ];

  const activeRoleConfig =
    roleNavItems.find((r) => r.role === selectedRole) || roleNavItems[0];
  const demoCred = DEMO_CREDENTIALS[selectedRole];
  const displayedRoles =
    mode === 'register' ? roleNavItems.filter((r) => r.role !== 'admin') : roleNavItems;

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
          <p>Campus365 Internship R&D • Bogura Pilot Node • Department of Agricultural Marketing (DAM)</p>
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
              <div className="bg-gradient-to-r from-slate-900 to-emerald-950 p-4 rounded-xl text-white space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    Level-4 TOTP Security Code
                  </span>
                  <span className="text-[10px] font-mono text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {totpCountdown}s
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-stone-300 block">Current Admin 2FA Token</span>
                    <span className="text-2xl font-black font-mono tracking-widest text-emerald-300">
                      883 650
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSecurityPin('883650')}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold shadow-xs transition-colors"
                  >
                    Insert 883650
                  </button>
                </div>
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
                    placeholder="883650"
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
                  <span>{t('Verify & Access Admin Console', 'যাচাই ও প্রবেশ করুন')}</span>
                </button>
              </div>
            </form>
          ) : mode === 'login' ? (
            /* ROLE-BASED LOGIN INTERFACE */
            <form
              onSubmit={handleLogin}
              className="space-y-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm"
            >
              {/* Demo quick credential helper chip */}
              {demoCred && (
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-stone-700 block text-[11px]">
                      {t(`Verified Demo Account (${activeRoleConfig.labelEn}):`, `পরীক্ষামূলক ${activeRoleConfig.labelBn} অ্যাকাউন্ট:`)}
                    </span>
                    <span className="font-mono text-stone-500 text-[10px]">
                      {selectedRole === 'admin'
                        ? `ID: ${demoCred.phone} • Password: ${demoCred.password}`
                        : `${demoCred.phone} • ${demoCred.password}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginIdentifier(demoCred.phone);
                      setLoginPassword(demoCred.password);
                    }}
                    className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold transition-colors"
                  >
                    {t('Fill Demo', 'তথ্য বসান')}
                  </button>
                </div>
              )}

              {/* Login Identifier: Email, Phone, or Admin ID */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {selectedRole === 'admin'
                    ? t('Admin ID / অ্যাডমিন আইডি', 'অ্যাডমিন আইডি')
                    : t('Email Address or Mobile Phone', 'ইমেইল ঠিকানা অথবা মোবাইল নম্বর')}
                </label>
                <div className="relative">
                  {selectedRole === 'admin' ? (
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  ) : (
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  )}
                  <input
                    type="text"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder={
                      selectedRole === 'admin'
                        ? 'NativeBazarSJS'
                        : 'e.g. rafiq@gmail.com or 01712458920'
                    }
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium focus:outline-emerald-600 font-mono"
                    required
                    disabled={isLocked}
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
                    placeholder="Enter password"
                    className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium focus:outline-emerald-600"
                    required
                    disabled={isLocked}
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
            </form>
          ) : (
            /* ROLE-BASED REGISTRATION INTERFACE */
            <form
              onSubmit={handleRegister}
              className="space-y-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm text-xs"
            >
              {selectedRole === 'admin' && (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 space-y-1">
                  <strong className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-700" />
                    {t('Admin Registration Restricted', 'অ্যাডমিন অ্যাকাউন্ট নিবন্ধন সংরক্ষিত')}
                  </strong>
                  <p>
                    {t(
                      'Admin accounts are pre-provisioned by platform security. Switch to Sign In and use official credentials.',
                      'নিরাপত্তার স্বার্থে অ্যাডমিন সরাসরি নিবন্ধন করা যায় না। লগইন অপশন নির্বাচন করে নির্ধারিত ক্রেডেনশিয়াল দিন।'
                    )}
                  </p>
                </div>
              )}

              {/* Mandatory: Full Name */}
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  {t('Full Name (পূর্ণ নাম) *', 'পূর্ণ নাম *')}
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Md. Mostafa Kamal"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
              </div>

              {/* Mandatory: Email and Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-stone-400" />
                    {t('Email Address (ইমেইল) *', 'ইমেইল ঠিকানা *')}
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
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
              </div>

              {/* Mandatory: Location (District & Upazila from BANGLADESH_LOCATIONS) */}
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
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
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
                    {t('Upazila / Area (উপজেলা) *', 'উপজেলা *')}
                  </label>
                  <select
                    value={regUpazila}
                    onChange={(e) => setRegUpazila(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  >
                    {upazilaList.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mandatory: Education / Qualification */}
              <div>
                <label className="block font-bold text-stone-700 mb-1 flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-stone-400" />
                  {t('Education / Agricultural Training (শিক্ষাগত যোগ্যতা) *', 'শিক্ষাগত যোগ্যতা / প্রশিক্ষণ *')}
                </label>
                <input
                  type="text"
                  value={regEducation}
                  onChange={(e) => setRegEducation(e.target.value)}
                  placeholder="e.g. Diploma in Agronomy, B.Sc in Agriculture, SSC / HSC"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
              </div>

              {/* Role-Specific Contextual Fields */}
              {selectedRole === 'farmer' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Farm Size (Acres)', 'জমির আয়তন (একর)')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={farmSize}
                      onChange={(e) => setFarmSize(e.target.value)}
                      placeholder="e.g. 4.5"
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Major Crops Grown', 'প্রধান ফসলসমূহ')}
                    </label>
                    <input
                      type="text"
                      value={cropsSelected}
                      onChange={(e) => setCropsSelected(e.target.value)}
                      placeholder="Potato, Cauliflower, Paddy"
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {selectedRole === 'businessman' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-200">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Trading Firm / Business Name', 'ব্যবসা প্রতিষ্ঠানের নাম')}
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Bogura Food Processors Ltd."
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Business Type', 'ব্যবসার ধরন')}
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                    >
                      <option>Wholesaler / Aratdar</option>
                      <option>Food Processor</option>
                      <option>Supermarket Chain</option>
                      <option>Exporter</option>
                      <option>Local Retailer</option>
                    </select>
                  </div>
                </div>
              )}

              {selectedRole === 'supplier' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Agro Input Enterprise / Shop', 'বীজ-সার দোকানের নাম')}
                    </label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Modern Krishi Bitan"
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Trade License / Registration Number', 'ট্রেড লাইসেন্স নম্বর')}
                    </label>
                    <input
                      type="text"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="e.g. DAE-TRD-2026-88"
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {selectedRole === 'expert' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-teal-50/50 rounded-xl border border-teal-200">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Official Designation', 'সরকারি পদবি')}
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Scientific Officer (BARI)"
                      className="w-full p-2 bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {t('Institution / Department', 'প্রতিষ্ঠান')}
                    </label>
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="e.g. DAE / BARI / BRRI"
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
                    placeholder="Min 8 characters"
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                    required
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
                    placeholder="Repeat password"
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || selectedRole === 'admin'}
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
            NativeBazar Security Module • SHA-256 Salted Hashing • Zero-Fabrication Agriculture
          </div>
        </div>
      </div>
    </div>
  );
};
