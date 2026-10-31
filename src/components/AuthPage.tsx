import React, { useState, useEffect } from 'react';
import { Language, UserRole, User } from '../types';
import { AuthStore, LoginResult, ThemeStore } from '../data/store';
import { BANGLADESH_LOCATIONS } from '../data/mockData';
import { authApi } from '../services/api';
import {
  Sprout,
  Briefcase,
  Store,
  ShoppingCart,
  Lock,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ArrowLeft,
  User as UserIcon,
  MapPin,
  Building,
  KeyRound,
  Sparkles,
  Moon,
  Sun,
} from 'lucide-react';

interface AuthPageProps {
  language: Language;
  onLanguageToggle: () => void;
  onAuthSuccess: (user: User) => void;
  onBack?: () => void;
  initialMode?: 'login' | 'register';
  initialRole?: 'farmer' | 'wholesaler' | 'retailer' | 'consumer';
}

// Popular crops in Bangladesh for interactive one-click farmer selection
const POPULAR_CROPS = [
  { id: 'Potato', en: 'Potato', bn: 'আলু', icon: '🥔' },
  { id: 'Tomato', en: 'Tomato', bn: 'টমেটো', icon: '🍅' },
  { id: 'Chili', en: 'Green Chili', bn: 'কাঁচা মরিচ', icon: '🌶️' },
  { id: 'Rice', en: 'Paddy / Rice', bn: 'ধান / চাল', icon: '🌾' },
  { id: 'Eggplant', en: 'Brinjal', bn: 'বেগুন', icon: '🍆' },
  { id: 'Cauliflower', en: 'Cauliflower', bn: 'ফুলকপি', icon: '🥦' },
  { id: 'Onion', en: 'Onion', bn: 'পেঁয়াজ', icon: '🧅' },
  { id: 'Cabbage', en: 'Cabbage', bn: 'বাঁধাকপি', icon: '🥬' },
  { id: 'Mustard', en: 'Mustard', bn: 'সরিষা', icon: '🌼' },
  { id: 'Maize', en: 'Maize', bn: 'ভুট্টা', icon: '🌽' },
];

export const AuthPage: React.FC<AuthPageProps> = ({
  language,
  onLanguageToggle,
  onAuthSuccess,
  onBack,
  initialMode = 'login',
  initialRole = 'farmer',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);
  // ONLY 4 public roles
  const [selectedRole, setSelectedRole] = useState<'farmer' | 'wholesaler' | 'retailer' | 'consumer'>(initialRole);
  useEffect(() => {
    if (initialRole) setSelectedRole(initialRole);
  }, [initialRole]);

  // Login credentials - completely blank by default (NO hardcoded demo passwords)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Admin access portal state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPin, setAdminPin] = useState('');

  // Lockout State
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Common Registration fields
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDistrict, setRegDistrict] = useState('Bogura');
  const [regUpazila, setRegUpazila] = useState('Shibganj');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Farmer specific: one-click crop selection
  const [selectedCrops, setSelectedCrops] = useState<string[]>(['Potato', 'Tomato']);
  const [farmSize, setFarmSize] = useState('3');

  // Wholesaler specific
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('Wholesaler');

  // Retailer specific
  const [shopName, setShopName] = useState('');
  const [tradeAddress, setTradeAddress] = useState('');

  // Consumer specific
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => ThemeStore.get());
  const toggleTheme = () => {
    const next = ThemeStore.toggle();
    setCurrentTheme(next);
  };

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // Upazilas based on chosen district
  const selectedLocation = BANGLADESH_LOCATIONS.find(
    (l) => l.district.toLowerCase() === regDistrict.toLowerCase()
  );
  const upazilaList = selectedLocation ? selectedLocation.upazilas : ['Sadar', 'Shibganj', 'Sherpur'];

  // Ensure upazila is always valid for the selected district
  useEffect(() => {
    if (upazilaList.length > 0 && !upazilaList.includes(regUpazila)) {
      setRegUpazila(upazilaList[0]);
    }
  }, [regDistrict, upazilaList, regUpazila]);

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

  const toggleCrop = (cropId: string) => {
    if (selectedCrops.includes(cropId)) {
      setSelectedCrops(selectedCrops.filter((c) => c !== cropId));
    } else {
      setSelectedCrops([...selectedCrops, cropId]);
    }
  };

  // Handle Standard Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Try persistent backend API
      try {
        const res = await authApi.login({
          identifier: loginIdentifier.trim(),
          password: loginPassword,
          role: selectedRole,
        });
        if (res && res.success && res.user) {
          AuthStore.setCurrentUser(res.user);
          setLoading(false);
          onAuthSuccess(res.user);
          return;
        }
      } catch (backendErr: any) {
        const msg: string = (backendErr.message || '').toLowerCase();
        // Ignore generic connection or request failures and fall through to AuthStore.login
        if (
          msg.includes('request failed') ||
          msg.includes('failed to fetch') ||
          msg.includes('network') ||
          msg.includes('not found') ||
          msg.includes('abort') ||
          msg.includes('timeout')
        ) {
          // Fall through to local store verification
        } else if (msg.includes('locked')) {
          setError(backendErr.message);
          setLoading(false);
          return;
        }
        // Network/server errors: fall through to local store
      }

      // 2. Fallback to client-side store verification
      const localResult: LoginResult = AuthStore.login(
        loginIdentifier.trim(),
        loginPassword,
        undefined,
        selectedRole
      );

      setLoading(false);
      if (localResult.locked) {
        setIsLocked(true);
        setLockoutSeconds(localResult.remainingSeconds || 180);
        setError(
          language === 'bn'
            ? `একাধিক ভুল চেষ্টার কারণে অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে। ${localResult.remainingSeconds} সেকেন্ড পর চেষ্টা করুন।`
            : `Account locked due to 3 failed attempts. Please retry in ${localResult.remainingSeconds}s.`
        );
        return;
      }

      if (!localResult.success || !localResult.user) {
        setError(
          language === 'bn'
            ? 'মোবাইল নম্বর অথবা পাসওয়ার্ড সঠিক নয়। দয়া করে আবার চেষ্টা করুন।'
            : 'Incorrect credentials. Please verify your phone number and password.'
        );
        return;
      }

      onAuthSuccess(localResult.user);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Login failed.');
    }
  };

  // Handle Admin Login (Restricted to Authorized Administrators only)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      try {
        const res = await authApi.adminLogin({
          username: adminUsername.trim(),
          password: adminPassword,
          securityPin: adminPin.trim(),
        });

        if (res && res.success && res.user) {
          AuthStore.setCurrentUser(res.user);
          setLoading(false);
          onAuthSuccess(res.user);
          return;
        }
      } catch (backendErr: any) {
        // Network or fallback error: fall through to client store verification
      }

      // Fallback to client-side store verification for offline/GitHub Pages demo
      const localUser = AuthStore.adminLogin(
        adminUsername.trim(),
        adminPassword,
        adminPin.trim()
      );

      setLoading(false);
      if (localUser) {
        AuthStore.setCurrentUser(localUser);
        onAuthSuccess(localUser);
      } else {
        setError(language === 'bn' ? 'অনুমোদিত অ্যাডমিন তথ্য সঠিক নয়।' : 'Invalid admin authorization credentials.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || (language === 'bn' ? 'অনুমোদিত অ্যাডমিন তথ্য সঠিক নয়।' : 'Invalid admin authorization credentials.'));
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!regName.trim()) {
      setError(language === 'bn' ? 'আপনার পূর্ণ নাম লিখুন।' : 'Please enter your full name.');
      return;
    }
    if (!regPhone.trim() || regPhone.length < 9) {
      setError(language === 'bn' ? 'সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন।' : 'Please enter a valid mobile number.');
      return;
    }
    if (regPassword.length < 6) {
      setError(language === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError(language === 'bn' ? 'উভয় পাসওয়ার্ড একই হতে হবে।' : 'Passwords do not match.');
      return;
    }

    if (selectedRole === 'farmer' && selectedCrops.length === 0) {
      setError(language === 'bn' ? 'কমপক্ষে একটি প্রধান ফসল নির্বাচন করুন।' : 'Please select at least one primary crop.');
      return;
    }

    setLoading(true);

    const payload = {
      role: selectedRole,
      name: regName.trim(),
      phone: regPhone.trim(),
      email: regEmail.trim(),
      district: regDistrict,
      upazila: regUpazila,
      password: regPassword,
      farmSizeAcres: selectedRole === 'farmer' ? Number(farmSize) : undefined,
      primaryCrops: selectedRole === 'farmer' ? selectedCrops : undefined,
      businessName: selectedRole === 'wholesaler' ? (businessName.trim() || `${regName}'s Wholesale Arat`) : undefined,
      businessType: selectedRole === 'wholesaler' ? businessType : undefined,
      shopName: selectedRole === 'retailer' ? (shopName.trim() || `${regName}'s Agro Shop`) : undefined,
      tradeAddress: selectedRole === 'retailer' ? tradeAddress.trim() : undefined,
      deliveryAddress: selectedRole === 'consumer' ? deliveryAddress.trim() : undefined,
    };

    try {
      // 1. Try persistent backend API
      try {
        const res = await authApi.register(payload);
        if (res && res.success && res.user) {
          AuthStore.setCurrentUser(res.user);
          setLoading(false);
          onAuthSuccess(res.user);
          return;
        }
      } catch (backendErr: any) {
        const msg = (backendErr.message || '').toLowerCase();
        // Only block fallback for explicit duplicate phone conflict from backend database
        if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('phone taken')) {
          setError(
            language === 'bn'
              ? 'এই মোবাইল নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা হয়েছে।'
              : (backendErr.message || 'Mobile number already registered.')
          );
          setLoading(false);
          return;
        }
        // Network/server/404/"Request failed" errors: fall through to local registration!
      }

      // 2. Client store fallback
      const newUser = AuthStore.register(payload as any);
      setLoading(false);
      onAuthSuccess(newUser);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Registration failed.');
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar with Back and Language switch */}
      <div className="max-w-xl w-full mx-auto flex items-center justify-between mb-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-emerald-700 bg-white px-3 py-1.5 rounded-xl border border-stone-200 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('Back to Marketplace', 'মার্কেটপ্লেসে ফিরুন')}</span>
          </button>
        ) : <div />}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-stone-600 dark:text-stone-300 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors shadow-2xs"
            title={currentTheme === 'dark' ? t('Switch to Light Mode', 'লাইট মোডে পরিবর্তন') : t('Switch to Dark Mode', 'ডার্ক মোডে পরিবর্তন')}
            aria-label="Toggle theme"
          >
            {currentTheme === 'dark' ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-stone-600" />}
          </button>
          <button
            onClick={onLanguageToggle}
            className="text-xs font-bold text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors shadow-2xs"
          >
            {language === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </div>

      <div className="max-w-xl w-full mx-auto bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-stone-900 px-6 py-6 text-white text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-3 shadow-inner">
            <Sprout className="w-7 h-7 text-emerald-300" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            {language === 'bn' ? 'আমার হাট' : 'Amar Haat'} • {t('Agricultural Platform', 'আমার হাট কৃষি প্ল্যাটফর্ম')}
          </h1>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-sm mx-auto">
            {t(
              'Secure agricultural supply chain connecting Farmers, Wholesalers, Retailers & Consumers.',
              'কৃষক, পাইকার, খুচরা বিক্রেতা ও ভোক্তাদের সরাসরি নিরাপদ কৃষি বাজার।'
            )}
          </p>
        </div>

        {/* Quick Demo Fill Banner for Live Demo & GitHub Pages */}
        <div className="bg-emerald-50/70 border-b border-emerald-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{t('Live Demo (1-Click Fill):', 'লাইভ ডেমো এক ক্লিকে পূরণ:')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsAdminMode(false);
                setMode('login');
                setSelectedRole('farmer');
                setLoginIdentifier('01712458920');
                setLoginPassword('12345678');
                setError('');
              }}
              className="px-2 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-600 hover:text-white transition-colors text-[11px] font-semibold shadow-2xs"
            >
              🌾 {t('Farmer', 'কৃষক')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdminMode(false);
                setMode('login');
                setSelectedRole('wholesaler');
                setLoginIdentifier('01711209934');
                setLoginPassword('12345678');
                setError('');
              }}
              className="px-2 py-0.5 rounded-lg bg-white border border-blue-300 text-blue-800 hover:bg-blue-600 hover:text-white transition-colors text-[11px] font-semibold shadow-2xs"
            >
              🏢 {t('Wholesaler', 'পাইকার')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdminMode(false);
                setMode('login');
                setSelectedRole('retailer');
                setLoginIdentifier('01715889900');
                setLoginPassword('12345678');
                setError('');
              }}
              className="px-2 py-0.5 rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-600 hover:text-white transition-colors text-[11px] font-semibold shadow-2xs"
            >
              🏪 {t('Retailer', 'খুচরা')}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdminMode(false);
                setMode('login');
                setSelectedRole('consumer');
                setLoginIdentifier('01711889922');
                setLoginPassword('12345678');
                setError('');
              }}
              className="px-2 py-0.5 rounded-lg bg-white border border-purple-300 text-purple-800 hover:bg-purple-600 hover:text-white transition-colors text-[11px] font-semibold shadow-2xs"
            >
              🛒 {t('Consumer', 'ভোক্তা')}
            </button>
          </div>
        </div>

        {/* Admin Portal Toggle View */}
        {isAdminMode ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-slate-800" />
                <h2 className="text-base font-bold text-stone-900">
                  {t('Authorized Administrator Access', 'অনুমোদিত অ্যাডমিন পোর্টাল')}
                </h2>
              </div>
              <button
                onClick={() => { setIsAdminMode(false); setError(''); }}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                {t('Return to Public Login', 'সাধারণ লগইনে ফিরুন')}
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              {t(
                'This section is strictly restricted to certified platform administrators. Unauthorized access attempts are monitored and logged.',
                'এই সেকশনটি শুধুমাত্র প্ল্যাটফর্ম অ্যাডমিনিস্ট্রেটরদের জন্য সংরক্ষিত। অননুমোদিত প্রচেষ্টা নিরীক্ষিত হয়।'
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t('Admin ID / Username', 'অ্যাডমিন আইডি')}
                </label>
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="NativeBazarAdmin"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t('Secret Password', 'গোপন পাসওয়ার্ড')}
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t('Clearance 2FA Security PIN', 'সিকিউরিটি পিন')}
                </label>
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="883650"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{loading ? t('Authenticating...', 'যাচাই করা হচ্ছে...') : t('Verify Admin Clearance', 'অ্যাডমিন যাচাই ও প্রবেশ')}</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Mode Selector: Login vs Register */}
            <div className="flex bg-stone-100 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  mode === 'login'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                {t('Sign In (Existing Account)', 'লগইন করুন')}
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  mode === 'register'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                {t('Create New Account', 'নতুন অ্যাকাউন্ট খুলুন')}
              </button>
            </div>

            {/* Exactly 4 Public Roles Selector */}
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-2">
                {t('Select Your Role in Supply Chain:', 'আপনার ভূমিকা নির্বাচন করুন:')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'farmer', en: 'Farmer', bn: 'কৃষক', icon: <Sprout className="w-4 h-4" />, color: 'emerald' },
                  { id: 'wholesaler', en: 'Wholesaler', bn: 'পাইকার', icon: <Briefcase className="w-4 h-4" />, color: 'blue' },
                  { id: 'retailer', en: 'Retailer', bn: 'খুচরা বিক্রেতা', icon: <Store className="w-4 h-4" />, color: 'amber' },
                  { id: 'consumer', en: 'Consumer', bn: 'ভোক্তা', icon: <ShoppingCart className="w-4 h-4" />, color: 'purple' },
                ].map((r) => {
                  const isSelected = selectedRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setSelectedRole(r.id as any); setError(''); }}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 shadow-xs font-black'
                          : 'border-stone-200 bg-stone-50/50 hover:bg-white text-stone-600 font-semibold'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 ${
                        isSelected ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {r.icon}
                      </div>
                      <span className="text-xs leading-tight">{language === 'bn' ? r.bn : r.en}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t('Mobile Phone Number', 'মোবাইল নম্বর')}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t('Password', 'পাসওয়ার্ড')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder={t('Enter your password', 'পাসওয়ার্ড লিখুন')}
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-2.5 text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || isLocked}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <span>{loading ? t('Signing in...', 'প্রবেশ করা হচ্ছে...') : t(`Sign In as ${selectedRole}`, 'লগইন করুন')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* REGISTRATION FORM (Minimal, Role-Specific, Clickable Crop Chips) */
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Farmer Friendly notice */}
                {selectedRole === 'farmer' && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {t(
                        'Easy registration for farmers! Just pick your crops, phone number, and password.',
                        'কৃষকদের জন্য সহজ নিবন্ধন! আপনার ফসল এবং মোবাইল নম্বর দিয়ে অ্যাকাউন্ট খুলুন।'
                      )}
                    </span>
                  </div>
                )}

                {/* Consumer notice */}
                {selectedRole === 'consumer' && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-medium">
                    {t(
                      'Tip: Consumers can immediately browse and place orders as guests without any account!',
                      'পরামর্শ: ভোক্তারা নিবন্ধন ছাড়াই সরাসরি পণ্য ঝুড়িতে নিয়ে অর্ডার করতে পারেন।'
                    )}
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t('Full Name', 'পূর্ণ নাম')} *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder={selectedRole === 'farmer' ? 'Md. Rafiqul Islam' : 'Your Name'}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* Mobile Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t('Mobile Phone Number', 'মোবাইল নম্বর')} *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* District and Upazila */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {t('District (64 Zilas)', 'জেলা (৬৪টি জেলা)')} *
                    </label>
                    <select
                      value={regDistrict}
                      onChange={(e) => {
                        const newDist = e.target.value;
                        setRegDistrict(newDist);
                        const loc = BANGLADESH_LOCATIONS.find((l) => l.district.toLowerCase() === newDist.toLowerCase());
                        if (loc && loc.upazilas.length > 0) {
                          setRegUpazila(loc.upazilas[0]);
                        }
                      }}
                      className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    >
                      {BANGLADESH_LOCATIONS.map((loc) => (
                        <option key={loc.district} value={loc.district}>
                          {language === 'bn' ? `${loc.districtBn} (${loc.district})` : `${loc.district} (${loc.districtBn})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                      {t('Upazila / Area', 'উপজেলা')} *
                    </label>
                    <select
                      value={regUpazila}
                      onChange={(e) => setRegUpazila(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                    >
                      {upazilaList.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ROLE SPECIFIC INPUTS */}

                {/* 1. FARMER: Clickable Crop Selector & Farm Size */}
                {selectedRole === 'farmer' && (
                  <div className="space-y-3 p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                    <div>
                      <label className="block text-xs font-bold text-stone-800 mb-1.5">
                        {t('Select Your Primary Crops (Click to choose):', 'আপনার চাষাবাদকৃত ফসল নির্বাচন করুন:')}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {POPULAR_CROPS.map((crop) => {
                          const isPicked = selectedCrops.includes(crop.id);
                          return (
                            <button
                              key={crop.id}
                              type="button"
                              onClick={() => toggleCrop(crop.id)}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                isPicked
                                  ? 'bg-emerald-700 text-white shadow-2xs scale-102'
                                  : 'bg-white text-stone-700 border border-stone-300 hover:border-emerald-500'
                              }`}
                            >
                              <span>{crop.icon}</span>
                              <span>{language === 'bn' ? crop.bn : crop.en}</span>
                              {isPicked && <CheckCircle2 className="w-3 h-3 text-emerald-200" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t('Farm Size (Bigha / Acres)', 'জমির পরিমাণ (বিঘা / একর)')}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={farmSize}
                        onChange={(e) => setFarmSize(e.target.value)}
                        placeholder="3"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {/* 2. WHOLESALER: Arat Name & Business Type */}
                {selectedRole === 'wholesaler' && (
                  <div className="space-y-3 p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t('Wholesale Business / Arat Name', 'পাইকারি প্রতিষ্ঠান / আড়তের নাম')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Karwan Bazar Agro Arat"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t('Procurement Scale', 'ব্যবসার ধরণ')}
                      </label>
                      <select
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white font-semibold"
                      >
                        <option value="Wholesaler">Bulk Wholesaler (মোকাম পাইকার)</option>
                        <option value="Aratdar">Aratdar Syndicate (আড়তদার সিন্ডিকেট)</option>
                        <option value="Processor">Agro Food Processor (খাদ্য প্রক্রিয়াজাতকারী)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 3. RETAILER: Shop Name */}
                {selectedRole === 'retailer' && (
                  <div className="space-y-3 p-3.5 bg-amber-50/50 rounded-2xl border border-amber-100">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t('Retail Shop / Outlet Name', 'খুচরা দোকান / আউটলেটের নাম')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="Bismillah Krishi Corner"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t('Shop Address / Location', 'দোকানের ঠিকানা')}
                      </label>
                      <input
                        type="text"
                        value={tradeAddress}
                        onChange={(e) => setTradeAddress(e.target.value)}
                        placeholder="Station Road Market #12"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* 4. CONSUMER: Delivery Address */}
                {selectedRole === 'consumer' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t('Home / Office Delivery Address', 'ডেলিভারির ঠিকানা')}
                    </label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="House #12, Road #4, Jaleswaritola"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                {/* Passwords */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t('Password', 'পাসওয়ার্ড')} *
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t('Confirm Password', 'পুনরায় পাসওয়ার্ড')} *
                    </label>
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Confirm"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <span>{loading ? t('Creating Account...', 'অ্যাকাউন্ট তৈরি হচ্ছে...') : t('Complete Registration', 'নিবন্ধন সম্পন্ন করুন')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Restricted Administrator Portal Link */}
            <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
              <span>{language === 'bn' ? 'আমার হাট পাইলট • বাংলাদেশ' : 'Amar Haat Pilot • Bangladesh'}</span>
              <button
                type="button"
                onClick={() => { setIsAdminMode(true); setError(''); }}
                className="flex items-center gap-1 text-stone-500 hover:text-stone-800 font-semibold transition-colors"
              >
                <KeyRound className="w-3 h-3 text-slate-500" />
                <span>{t('Authorized Admin Portal', 'অনুমোদিত অ্যাডমিন প্রবেশ')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
