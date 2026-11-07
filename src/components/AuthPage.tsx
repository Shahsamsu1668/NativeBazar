import React, { useState, useEffect } from 'react';
import { Language, UserRole, User } from '../types';
import { AuthStore, LoginResult } from '../data/store';
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
} from 'lucide-react';

interface AuthPageProps {
  language: Language;
  onLanguageToggle: () => void;
  onAuthSuccess: (user: User) => void;
  onBack?: () => void;
  initialMode?: 'login' | 'register';
  initialRole?: 'farmer' | 'wholesaler' | 'retailer' | 'consumer';
}

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

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

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

  // Upazilas based on chosen district
  const selectedLocation = BANGLADESH_LOCATIONS.find(
    (l) => l.district.toLowerCase() === regDistrict.toLowerCase()
  );
  const upazilaList = selectedLocation ? selectedLocation.upazilas : ['Sadar', 'Shibganj', 'Sherpur'];

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
        // Only block local fallback for explicit credential rejection (401/wrong password messages)
        const msg: string = (backendErr.message || '').toLowerCase();
        const isCredentialError =
          msg.includes('invalid') ||
          msg.includes('incorrect') ||
          msg.includes('wrong password') ||
          msg.includes('unauthorized') ||
          msg.includes('not found') === false && msg.includes('401');
        if (isCredentialError && !msg.includes('fetch') && !msg.includes('network') && !msg.includes('failed to fetch')) {
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
      const res = await authApi.adminLogin({
        username: adminUsername.trim(),
        password: adminPassword,
        securityPin: adminPin.trim(),
      });

      setLoading(false);
      if (res && res.success && res.user) {
        AuthStore.setCurrentUser(res.user);
        onAuthSuccess(res.user);
      } else {
        setError(language === 'bn' ? 'অ্যাডমিন এক্সেস প্রত্যাখ্যাত।' : 'Admin Access Denied.');
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

    setLoading(true);

    const payload = {
      role: selectedRole,
      name: regName.trim(),
      phone: regPhone.trim(),
      email: regEmail.trim(),
      district: regDistrict,
      upazila: regUpazila,
      password: regPassword,
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
        if (backendErr.message && !backendErr.message.includes('fetch')) {
          setError(backendErr.message);
          setLoading(false);
          return;
        }
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
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar with Back and Language switch */}
      <div className="max-w-xl w-full mx-auto flex items-center justify-between mb-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-stone-600 dark:text-stone-200 hover:text-emerald-700 dark:hover:text-emerald-400 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 transition-colors shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('Back to Marketplace', 'মার্কেটপ্লেসে ফিরুন')}</span>
          </button>
        ) : <div />}

        <button
          onClick={onLanguageToggle}
          className="text-xs font-bold text-stone-700 dark:text-stone-200 bg-white dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors shadow-2xs cursor-pointer"
        >
          {language === 'bn' ? 'English' : 'বাংলা'}
        </button>
      </div>

      <div className="max-w-xl w-full mx-auto bg-white dark:bg-[#161b22] rounded-3xl shadow-xl border border-stone-200 dark:border-stone-800 overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-stone-900 px-6 py-6 text-white text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-3 shadow-inner">
            <Sprout className="w-7 h-7 text-emerald-300" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {language === 'bn' ? 'আমার হাট' : 'Amar Haat'} • {t('Agricultural Platform', 'আমার হাট কৃষি প্ল্যাটফর্ম')}
          </h1>
          <p className="text-xs text-emerald-100/90 mt-1 max-w-sm mx-auto font-medium">
            {t(
              'Secure agricultural supply chain connecting Farmers, Wholesalers, Retailers & Consumers.',
              'কৃষক, পাইকার, খুচরা বিক্রেতা ও ভোক্তাদের সরাসরি নিরাপদ কৃষি বাজার।'
            )}
          </p>
        </div>

        {/* Admin Portal Toggle View */}
        {isAdminMode ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-700 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-slate-800 dark:text-emerald-400" />
                <h2 className="text-base font-bold text-stone-900 dark:text-white">
                  {t('Authorized Administrator Access', 'অনুমোদিত অ্যাডমিন পোর্টাল')}
                </h2>
              </div>
              <button
                onClick={() => { setIsAdminMode(false); setError(''); }}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {t('Return to Public Login', 'সাধারণ লগইনে ফিরুন')}
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-stone-800/70 border border-slate-200 dark:border-stone-700 rounded-xl text-xs text-slate-700 dark:text-stone-200 font-medium">
              {t(
                'This section is strictly restricted to certified platform administrators. Unauthorized access attempts are monitored and logged.',
                'এই সেকশনটি শুধুমাত্র প্ল্যাটফর্ম অ্যাডমিনিস্ট্রেটরদের জন্য সংরক্ষিত। অননুমোদিত প্রচেষ্টা নিরীক্ষিত হয়।'
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold">
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                  {t('Admin ID / Username', 'অ্যাডমিন আইডি')}
                </label>
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="NativeBazarAdmin"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                  {t('Secret Password', 'গোপন পাসওয়ার্ড')}
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                  {t('Clearance 2FA Security PIN', 'সিকিউরিটি পিন')}
                </label>
                <input
                  type="password"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="883650"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-stone-900 hover:bg-stone-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400 dark:text-white" />
                <span>{loading ? t('Authenticating...', 'যাচাই করা হচ্ছে...') : t('Verify Admin Clearance', 'অ্যাডমিন যাচাই ও প্রবেশ')}</span>
              </button>
            </form>
          </div>
        ) : (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Mode Selector: Login vs Register */}
            <div className="flex bg-stone-100 dark:bg-stone-800/90 p-1 rounded-2xl border border-transparent dark:border-stone-700">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-500 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {t('Sign In (Existing Account)', 'লগইন করুন')}
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                    : 'text-stone-500 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white'
                }`}
              >
                {t('Create New Account', 'নতুন অ্যাকাউন্ট খুলুন')}
              </button>
            </div>

            {/* Exactly 4 Public Roles Selector */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-2">
                {t('Select Your Role in Supply Chain:', 'আপনার ভূমিকা নির্বাচন করুন:')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'farmer', en: 'Farmer', bn: 'কৃষক', icon: <Sprout className="w-4 h-4" /> },
                  { id: 'wholesaler', en: 'Wholesaler', bn: 'পাইকার', icon: <Briefcase className="w-4 h-4" /> },
                  { id: 'retailer', en: 'Retailer', bn: 'খুচরা বিক্রেতা', icon: <Store className="w-4 h-4" /> },
                  { id: 'consumer', en: 'Consumer', bn: 'ভোক্তা', icon: <ShoppingCart className="w-4 h-4" /> },
                ].map((r) => {
                  const isSelected = selectedRole === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setSelectedRole(r.id as any); setError(''); }}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'role-card-selected border-emerald-600 dark:border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-300 shadow-xs font-black'
                          : 'role-card-unselected border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/90 hover:bg-white dark:hover:bg-stone-700 text-stone-700 dark:text-white font-semibold'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 transition-colors ${
                        isSelected ? 'bg-emerald-600 text-white shadow-xs' : 'bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-white'
                      }`}>
                        {r.icon}
                      </div>
                      <span className={`text-xs leading-tight font-bold transition-colors ${isSelected ? 'text-emerald-900 dark:text-emerald-300 font-black' : 'text-stone-700 dark:text-white'}`}>
                        {language === 'bn' ? r.bn : r.en}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                    {t('Mobile Phone Number', 'মোবাইল নম্বর')}
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 dark:text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                    {t('Password', 'পাসওয়ার্ড')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 dark:text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder={t('Enter your password', 'পাসওয়ার্ড লিখুন')}
                      className="w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-2.5 text-stone-400 dark:text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || isLocked}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
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
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      {t(
                        'Easy registration for farmers! Just enter your name, mobile number, and password.',
                        'কৃষকদের জন্য সহজ নিবন্ধন! আপনার নাম, মোবাইল নম্বর এবং পাসওয়ার্ড দিয়ে অ্যাকাউন্ট খুলুন।'
                      )}
                    </span>
                  </div>
                )}

                {/* Consumer notice */}
                {selectedRole === 'consumer' && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 rounded-xl text-xs text-purple-900 dark:text-purple-200 font-medium">
                    {t(
                      'Tip: Consumers can immediately browse and place orders as guests without any account!',
                      'পরামর্শ: ভোক্তারা নিবন্ধন ছাড়াই সরাসরি পণ্য ঝুড়িতে নিয়ে অর্ডার করতে পারেন।'
                    )}
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                    {t('Full Name', 'পূর্ণ নাম')} *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-stone-400 dark:text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder={selectedRole === 'farmer' ? 'Md. Rafiqul Islam' : 'Your Name'}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* Mobile Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                    {t('Mobile Phone Number', 'মোবাইল নম্বর')} *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 dark:text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                {/* District and Upazila */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                      {t('District', 'জেলা')} *
                    </label>
                    <select
                      value={regDistrict}
                      onChange={(e) => {
                        setRegDistrict(e.target.value);
                        const loc = BANGLADESH_LOCATIONS.find((l) => l.district === e.target.value);
                        if (loc && loc.upazilas.length > 0) setRegUpazila(loc.upazilas[0]);
                      }}
                      className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {BANGLADESH_LOCATIONS.map((loc) => (
                        <option key={loc.district} value={loc.district} className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">
                          {language === 'bn' ? loc.districtBn : loc.district}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                      {t('Upazila / Area', 'উপজেলা')} *
                    </label>
                    <select
                      value={regUpazila}
                      onChange={(e) => setRegUpazila(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {upazilaList.map((u) => (
                        <option key={u} value={u} className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ROLE SPECIFIC INPUTS */}

                {/* 1. WHOLESALER: Arat Name & Business Type */}
                {selectedRole === 'wholesaler' && (
                  <div className="space-y-3 p-3.5 bg-blue-50/50 dark:bg-blue-950/40 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                        {t('Wholesale Business / Arat Name', 'পাইকারি প্রতিষ্ঠান / আড়তের নাম')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Karwan Bazar Agro Arat"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                        {t('Procurement Scale', 'ব্যবসার ধরণ')}
                      </label>
                      <select
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white font-semibold cursor-pointer"
                      >
                        <option value="Wholesaler" className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">Bulk Wholesaler (মোকাম পাইকার)</option>
                        <option value="Aratdar" className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">Aratdar Syndicate (আড়তদার সিন্ডিকেট)</option>
                        <option value="Processor" className="bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100">Agro Food Processor (খাদ্য প্রক্রিয়াজাতকারী)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 3. RETAILER: Shop Name */}
                {selectedRole === 'retailer' && (
                  <div className="space-y-3 p-3.5 bg-amber-50/50 dark:bg-amber-950/40 rounded-2xl border border-amber-100 dark:border-amber-900/50">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                        {t('Retail Shop / Outlet Name', 'খুচরা দোকান / আউটলেটের নাম')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="Bismillah Krishi Corner"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                        {t('Shop Address / Location', 'দোকানের ঠিকানা')}
                      </label>
                      <input
                        type="text"
                        value={tradeAddress}
                        onChange={(e) => setTradeAddress(e.target.value)}
                        placeholder="Station Road Market #12"
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}

                {/* 4. CONSUMER: Delivery Address */}
                {selectedRole === 'consumer' && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                      {t('Home / Office Delivery Address', 'ডেলিভারির ঠিকানা')}
                    </label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="House #12, Road #4, Jaleswaritola"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}

                {/* Passwords */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                      {t('Password', 'পাসওয়ার্ড')} *
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min 6 chars"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 dark:text-stone-200 mb-1">
                      {t('Confirm Password', 'পুনরায় পাসওয়ার্ড')} *
                    </label>
                    <input
                      type="password"
                      required
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Confirm"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-white placeholder:text-stone-400 dark:placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{loading ? t('Creating Account...', 'অ্যাকাউন্ট তৈরি হচ্ছে...') : t('Complete Registration', 'নিবন্ধন সম্পন্ন করুন')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Restricted Administrator Portal Link */}
            <div className="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400">
              <span>{language === 'bn' ? 'আমার হাট পাইলট • বাংলাদেশ' : 'Amar Haat Pilot • Bangladesh'}</span>
              <button
                type="button"
                onClick={() => { setIsAdminMode(true); setError(''); }}
                className="flex items-center gap-1 text-stone-500 dark:text-stone-300 hover:text-stone-800 dark:hover:text-white font-semibold transition-colors cursor-pointer"
              >
                <KeyRound className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                <span>{t('Authorized Admin Portal', 'অনুমোদিত অ্যাডমিন প্রবেশ')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
