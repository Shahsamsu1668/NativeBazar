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
}

// Popular crops in Bangladesh for interactive one-click farmer selection
const POPULAR_CROPS = [
  { id: 'Potato', en: 'Potato', bn: 'αªåαª▓αºü', icon: '≡ƒÑö' },
  { id: 'Tomato', en: 'Tomato', bn: 'αªƒαª«αºçαªƒαºï', icon: '≡ƒìà' },
  { id: 'Chili', en: 'Green Chili', bn: 'αªòαª╛αªüαªÜαª╛ αª«αª░αª┐αªÜ', icon: '≡ƒî╢∩╕Å' },
  { id: 'Rice', en: 'Paddy / Rice', bn: 'αªºαª╛αª¿ / αªÜαª╛αª▓', icon: '≡ƒî╛' },
  { id: 'Eggplant', en: 'Brinjal', bn: 'αª¼αºçαªùαºüαª¿', icon: '≡ƒìå' },
  { id: 'Cauliflower', en: 'Cauliflower', bn: 'αª½αºüαª▓αªòαª¬αª┐', icon: '≡ƒÑª' },
  { id: 'Onion', en: 'Onion', bn: 'αª¬αºçαªüαª»αª╝αª╛αª£', icon: '≡ƒºà' },
  { id: 'Cabbage', en: 'Cabbage', bn: 'αª¼αª╛αªüαªºαª╛αªòαª¬αª┐', icon: '≡ƒÑ¼' },
  { id: 'Mustard', en: 'Mustard', bn: 'αª╕αª░αª┐αª╖αª╛', icon: '≡ƒî╝' },
  { id: 'Maize', en: 'Maize', bn: 'αª¡αºüαªƒαºìαªƒαª╛', icon: '≡ƒî╜' },
];

export const AuthPage: React.FC<AuthPageProps> = ({
  language,
  onLanguageToggle,
  onAuthSuccess,
  onBack,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  // ONLY 4 public roles
  const [selectedRole, setSelectedRole] = useState<'farmer' | 'wholesaler' | 'retailer' | 'consumer'>('farmer');

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
        // If backend returns an explicit credential error, display it
        if (backendErr.message && !backendErr.message.includes('fetch')) {
          setError(backendErr.message);
          setLoading(false);
          return;
        }
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
            ? `αªÅαªòαª╛αªºαª┐αªò αª¡αºüαª▓ αªÜαºçαª╖αºìαªƒαª╛αª░ αªòαª╛αª░αªúαºç αªàαºìαª»αª╛αªòαª╛αªëαª¿αºìαªƒ αª╕αª╛αª«αºƒαª┐αªòαª¡αª╛αª¼αºç αª▓αªò αªòαª░αª╛ αª╣αºƒαºçαª¢αºçαÑñ ${localResult.remainingSeconds} αª╕αºçαªòαºçαª¿αºìαªí αª¬αª░ αªÜαºçαª╖αºìαªƒαª╛ αªòαª░αºüαª¿αÑñ`
            : `Account locked due to 3 failed attempts. Please retry in ${localResult.remainingSeconds}s.`
        );
        return;
      }

      if (!localResult.success || !localResult.user) {
        setError(
          language === 'bn'
            ? 'αª«αºïαª¼αª╛αªçαª▓ αª¿αª«αºìαª¼αª░ αªàαªÑαª¼αª╛ αª¬αª╛αª╕αªôαª»αª╝αª╛αª░αºìαªí αª╕αªáαª┐αªò αª¿αª»αª╝αÑñ αªªαª»αª╝αª╛ αªòαª░αºç αªåαª¼αª╛αª░ αªÜαºçαª╖αºìαªƒαª╛ αªòαª░αºüαª¿αÑñ'
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
        setError(language === 'bn' ? 'αªàαºìαª»αª╛αªíαª«αª┐αª¿ αªÅαªòαºìαª╕αºçαª╕ αª¬αºìαª░αªñαºìαª»αª╛αªûαºìαª»αª╛αªñαÑñ' : 'Admin Access Denied.');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || (language === 'bn' ? 'αªàαª¿αºüαª«αºïαªªαª┐αªñ αªàαºìαª»αª╛αªíαª«αª┐αª¿ αªñαªÑαºìαª» αª╕αªáαª┐αªò αª¿αºƒαÑñ' : 'Invalid admin authorization credentials.'));
    }
  };

  // Handle Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!regName.trim()) {
      setError(language === 'bn' ? 'αªåαª¬αª¿αª╛αª░ αª¬αºéαª░αºìαªú αª¿αª╛αª« αª▓αª┐αªûαºüαª¿αÑñ' : 'Please enter your full name.');
      return;
    }
    if (!regPhone.trim() || regPhone.length < 9) {
      setError(language === 'bn' ? 'αª╕αªáαª┐αªò αººαºº αª╕αªéαªûαºìαª»αª╛αª░ αª«αºïαª¼αª╛αªçαª▓ αª¿αª«αºìαª¼αª░ αªªαª┐αª¿αÑñ' : 'Please enter a valid mobile number.');
      return;
    }
    if (regPassword.length < 6) {
      setError(language === 'bn' ? 'αª¬αª╛αª╕αªôαª»αª╝αª╛αª░αºìαªí αªòαª«αª¬αªòαºìαª╖αºç αº¼ αªàαªòαºìαª╖αª░αºçαª░ αª╣αªñαºç αª╣αª¼αºçαÑñ' : 'Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError(language === 'bn' ? 'αªëαª¡αª»αª╝ αª¬αª╛αª╕αªôαª»αª╝αª╛αª░αºìαªí αªÅαªòαªç αª╣αªñαºç αª╣αª¼αºçαÑñ' : 'Passwords do not match.');
      return;
    }

    if (selectedRole === 'farmer' && selectedCrops.length === 0) {
      setError(language === 'bn' ? 'αªòαª«αª¬αªòαºìαª╖αºç αªÅαªòαªƒαª┐ αª¬αºìαª░αªºαª╛αª¿ αª½αª╕αª▓ αª¿αª┐αª░αºìαª¼αª╛αªÜαª¿ αªòαª░αºüαª¿αÑñ' : 'Please select at least one primary crop.');
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
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Top Bar with Back and Language switch */}
      <div className="max-w-xl w-full mx-auto flex items-center justify-between mb-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-emerald-700 bg-white px-3 py-1.5 rounded-xl border border-stone-200 transition-colors shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('Back to Marketplace', 'αª«αª╛αª░αºìαªòαºçαªƒαª¬αºìαª▓αºçαª╕αºç αª½αª┐αª░αºüαª¿')}</span>
          </button>
        ) : <div />}

        <button
          onClick={onLanguageToggle}
          className="text-xs font-bold text-stone-700 bg-white px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors shadow-2xs"
        >
          {language === 'bn' ? 'English' : 'αª¼αª╛αªéαª▓αª╛'}
        </button>
      </div>

      <div className="max-w-xl w-full mx-auto bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-800 via-emerald-900 to-stone-900 px-6 py-6 text-white text-center relative">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-3 shadow-inner">
            <Sprout className="w-7 h-7 text-emerald-300" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            NativeBazar ΓÇó {t('Agricultural Platform', 'αª¿αºçαªƒαª┐αª¡αª¼αª╛αª£αª╛αª░ αªòαºâαª╖αª┐ αª¬αºìαª▓αºìαª»αª╛αªƒαª½αª░αºìαª«')}
          </h1>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-sm mx-auto">
            {t(
              'Secure agricultural supply chain connecting Farmers, Wholesalers, Retailers & Consumers.',
              'αªòαºâαª╖αªò, αª¬αª╛αªçαªòαª╛αª░, αªûαºüαªÜαª░αª╛ αª¼αª┐αªòαºìαª░αºçαªñαª╛ αªô αª¡αºïαªòαºìαªñαª╛αªªαºçαª░ αª╕αª░αª╛αª╕αª░αª┐ αª¿αª┐αª░αª╛αª¬αªª αªòαºâαª╖αª┐ αª¼αª╛αª£αª╛αª░αÑñ'
            )}
          </p>
        </div>

        {/* Admin Portal Toggle View */}
        {isAdminMode ? (
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-slate-800" />
                <h2 className="text-base font-bold text-stone-900">
                  {t('Authorized Administrator Access', 'αªàαª¿αºüαª«αºïαªªαª┐αªñ αªàαºìαª»αª╛αªíαª«αª┐αª¿ αª¬αºïαª░αºìαªƒαª╛αª▓')}
                </h2>
              </div>
              <button
                onClick={() => { setIsAdminMode(false); setError(''); }}
                className="text-xs font-bold text-emerald-700 hover:underline"
              >
                {t('Return to Public Login', 'αª╕αª╛αªºαª╛αª░αªú αª▓αªùαªçαª¿αºç αª½αª┐αª░αºüαª¿')}
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              {t(
                'This section is strictly restricted to certified platform administrators. Unauthorized access attempts are monitored and logged.',
                'αªÅαªç αª╕αºçαªòαª╢αª¿αªƒαª┐ αª╢αºüαªºαºüαª«αª╛αªñαºìαª░ αª¬αºìαª▓αºìαª»αª╛αªƒαª½αª░αºìαª« αªàαºìαª»αª╛αªíαª«αª┐αª¿αª┐αª╕αºìαªƒαºìαª░αºçαªƒαª░αªªαºçαª░ αª£αª¿αºìαª» αª╕αªéαª░αªòαºìαª╖αª┐αªñαÑñ αªàαª¿αª¿αºüαª«αºïαªªαª┐αªñ αª¬αºìαª░αªÜαºçαª╖αºìαªƒαª╛ αª¿αª┐αª░αºÇαªòαºìαª╖αª┐αªñ αª╣αºƒαÑñ'
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                ΓÜá∩╕Å {error}
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t('Admin ID / Username', 'αªàαºìαª»αª╛αªíαª«αª┐αª¿ αªåαªçαªíαª┐')}
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
                  {t('Secret Password', 'αªùαºïαª¬αª¿ αª¬αª╛αª╕αªôαºƒαª╛αª░αºìαªí')}
                </label>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t('Clearance 2FA Security PIN', 'αª╕αª┐αªòαª┐αªëαª░αª┐αªƒαª┐ αª¬αª┐αª¿')}
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
                <span>{loading ? t('Authenticating...', 'αª»αª╛αªÜαª╛αªç αªòαª░αª╛ αª╣αªÜαºìαª¢αºç...') : t('Verify Admin Clearance', 'αªàαºìαª»αª╛αªíαª«αª┐αª¿ αª»αª╛αªÜαª╛αªç αªô αª¬αºìαª░αª¼αºçαª╢')}</span>
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
                {t('Sign In (Existing Account)', 'αª▓αªùαªçαª¿ αªòαª░αºüαª¿')}
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
                {t('Create New Account', 'αª¿αªñαºüαª¿ αªàαºìαª»αª╛αªòαª╛αªëαª¿αºìαªƒ αªûαºüαª▓αºüαª¿')}
              </button>
            </div>

            {/* Exactly 4 Public Roles Selector */}
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-2">
                {t('Select Your Role in Supply Chain:', 'αªåαª¬αª¿αª╛αª░ αª¡αºéαª«αª┐αªòαª╛ αª¿αª┐αª░αºìαª¼αª╛αªÜαª¿ αªòαª░αºüαª¿:')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'farmer', en: 'Farmer', bn: 'αªòαºâαª╖αªò', icon: <Sprout className="w-4 h-4" />, color: 'emerald' },
                  { id: 'wholesaler', en: 'Wholesaler', bn: 'αª¬αª╛αªçαªòαª╛αª░', icon: <Briefcase className="w-4 h-4" />, color: 'blue' },
                  { id: 'retailer', en: 'Retailer', bn: 'αªûαºüαªÜαª░αª╛ αª¼αª┐αªòαºìαª░αºçαªñαª╛', icon: <Store className="w-4 h-4" />, color: 'amber' },
                  { id: 'consumer', en: 'Consumer', bn: 'αª¡αºïαªòαºìαªñαª╛', icon: <ShoppingCart className="w-4 h-4" />, color: 'purple' },
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
                <span>ΓÜá∩╕Å</span>
                <span>{error}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t('Mobile Phone Number', 'αª«αºïαª¼αª╛αªçαª▓ αª¿αª«αºìαª¼αª░')}
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
                    {t('Password', 'αª¬αª╛αª╕αªôαª»αª╝αª╛αª░αºìαªí')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder={t('Enter your password', 'αª¬αª╛αª╕αªôαª»αª╝αª╛αª░αºìαªí αª▓αª┐αªûαºüαª¿')}
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
                  <span>{loading ? t('Signing in...', 'αª¬αºìαª░αª¼αºçαª╢ αªòαª░αª╛ αª╣αªÜαºìαª¢αºç...') : t(`Sign In as ${selectedRole}`, 'αª▓αªùαªçαª¿ αªòαª░αºüαª¿')}</span>
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
                        'αªòαºâαª╖αªòαªªαºçαª░ αª£αª¿αºìαª» αª╕αª╣αª£ αª¿αª┐αª¼αª¿αºìαªºαª¿! αªåαª¬αª¿αª╛αª░ αª½αª╕αª▓ αªÅαª¼αªé αª«αºïαª¼αª╛αªçαª▓ αª¿αª«αºìαª¼αª░ αªªαª┐αºƒαºç αªàαºìαª»αª╛αªòαª╛αªëαª¿αºìαªƒ αªûαºüαª▓αºüαª¿αÑñ'
                      )}
                    </span>
                  </div>
                )}

                {/* Consumer notice */}
                {selectedRole === 'consumer' && (
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-medium">
                    {t(
                      'Tip: Consumers can immediately browse and place orders as guests without any account!',
                      'αª¬αª░αª╛αª«αª░αºìαª╢: αª¡αºïαªòαºìαªñαª╛αª░αª╛ αª¿αª┐αª¼αª¿αºìαªºαª¿ αª¢αª╛αº£αª╛αªç αª╕αª░αª╛αª╕αª░αª┐ αª¬αªúαºìαª» αª¥αºüαº£αª┐αªñαºç αª¿αª┐αºƒαºç αªàαª░αºìαªíαª╛αª░ αªòαª░αªñαºç αª¬αª╛αª░αºçαª¿αÑñ'
                    )}
                  </div>
                )}

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {t('Full Name', 'αª¬αºéαª░αºìαªú αª¿αª╛αª«')} *
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
                    {t('Mobile Phone Number', 'αª«αºïαª¼αª╛αªçαª▓ αª¿αª«αºìαª¼αª░')} *
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
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t('District', 'αª£αºçαª▓αª╛')} *
                    </label>
                    <select
                      value={regDistrict}
                      onChange={(e) => {
                        setRegDistrict(e.target.value);
                        const loc = BANGLADESH_LOCATIONS.find((l) => l.district === e.target.value);
                        if (loc && loc.upazilas.length > 0) setRegUpazila(loc.upazilas[0]);
                      }}
                      className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      {BANGLADESH_LOCATIONS.map((loc) => (
                        <option key={loc.district} value={loc.district}>
                          {language === 'bn' ? loc.districtBn : loc.district}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {t('Upazila / Area', 'αªëαª¬αª£αºçαª▓αª╛')} *
                    </label>
                    <select
                      value={regUpazila}
                      onChange={(e) => setRegUpazila(e.target.value)}
                      className="w-full px-3 py-2.5 text-xs font-bold rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
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
                        {t('Select Your Primary Crops (Click to choose):', 'αªåαª¬αª¿αª╛αª░ αªÜαª╛αª╖αª╛αª¼αª╛αªªαªòαºâαªñ αª½αª╕αª▓ αª¿αª┐αª░αºìαª¼αª╛αªÜαª¿ αªòαª░αºüαª¿:')}
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
                        {t('Farm Size (Bigha / Acres)', 'αª£αª«αª┐αª░ αª¬αª░αª┐αª«αª╛αªú (αª¼αª┐αªÿαª╛ / αªÅαªòαª░)')}
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
                        {t('Wholesale Business / Arat Name', 'αª¬αª╛αªçαªòαª╛αª░αª┐ αª¬αºìαª░αªñαª┐αª╖αºìαªáαª╛αª¿ / αªåαº£αªñαºçαª░ αª¿αª╛αª«')} *
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
                        {t('Procurement Scale', 'αª¼αºìαª»αª¼αª╕αª╛αª░ αªºαª░αªú')}
                      </label>
                      <select
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white font-semibold"
                      >
                        <option value="Wholesaler">Bulk Wholesaler (αª«αºïαªòαª╛αª« αª¬αª╛αªçαªòαª╛αª░)</option>
                        <option value="Aratdar">Aratdar Syndicate (αªåαº£αªñαªªαª╛αª░ αª╕αª┐αª¿αºìαªíαª┐αªòαºçαªƒ)</option>
                        <option value="Processor">Agro Food Processor (αªûαª╛αªªαºìαª» αª¬αºìαª░αªòαºìαª░αª┐αºƒαª╛αª£αª╛αªñαªòαª╛αª░αºÇ)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 3. RETAILER: Shop Name */}
                {selectedRole === 'retailer' && (
                  <div className="space-y-3 p-3.5 bg-amber-50/50 rounded-2xl border border-amber-100">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1">
                        {t('Retail Shop / Outlet Name', 'αªûαºüαªÜαª░αª╛ αªªαºïαªòαª╛αª¿ / αªåαªëαªƒαª▓αºçαªƒαºçαª░ αª¿αª╛αª«')} *
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
                        {t('Shop Address / Location', 'αªªαºïαªòαª╛αª¿αºçαª░ αªáαª┐αªòαª╛αª¿αª╛')}
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
                      {t('Home / Office Delivery Address', 'αªíαºçαª▓αª┐αª¡αª╛αª░αª┐αª░ αªáαª┐αªòαª╛αª¿αª╛')}
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
                      {t('Password', 'αª¬αª╛αª╕αªôαª»αª╝αª╛αª░αºìαªí')} *
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
                      {t('Confirm Password', 'αª¬αºüαª¿αª░αª╛αª»αª╝ αª¬αª╛αª╕αªôαª»αª╝αª╛αª░αºìαªí')} *
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
                  <span>{loading ? t('Creating Account...', 'αªàαºìαª»αª╛αªòαª╛αªëαª¿αºìαªƒ αªñαºêαª░αª┐ αª╣αªÜαºìαª¢αºç...') : t('Complete Registration', 'αª¿αª┐αª¼αª¿αºìαªºαª¿ αª╕αª«αºìαª¬αª¿αºìαª¿ αªòαª░αºüαª¿')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Restricted Administrator Portal Link */}
            <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
              <span>NativeBazar Pilot ΓÇó Bangladesh</span>
              <button
                type="button"
                onClick={() => { setIsAdminMode(true); setError(''); }}
                className="flex items-center gap-1 text-stone-500 hover:text-stone-800 font-semibold transition-colors"
              >
                <KeyRound className="w-3 h-3 text-slate-500" />
                <span>{t('Authorized Admin Portal', 'αªàαª¿αºüαª«αºïαªªαª┐αªñ αªàαºìαª»αª╛αªíαª«αª┐αª¿ αª¬αºìαª░αª¼αºçαª╢')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
