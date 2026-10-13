import React, { useState, useEffect } from 'react';
import { Language, UserRole, User } from '../types';
import { AuthStore, LoginResult } from '../data/store';
import { DEMO_CREDENTIALS } from '../data/mockData';
import {
  Sprout, Phone, Lock, Eye, EyeOff, ArrowRight, Sparkles, ShieldCheck,
  Briefcase, Store, ShoppingCart, Microscope, RefreshCw, KeyRound,
  AlertTriangle, CheckCircle2, ShieldAlert, Cpu, ArrowLeft, Clock
} from 'lucide-react';

interface AuthPageProps {
  language: Language;
  onLanguageToggle: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ language, onLanguageToggle, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('01712458920');
  const [password, setPassword] = useState('Krishi#2026!Rafiq');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('farmer');
  const [district, setDistrict] = useState('Bogura');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Admin 2FA Step State
  const [is2FAStep, setIs2FAStep] = useState(false);
  const [securityPin, setSecurityPin] = useState('');
  const [adminPhonePending, setAdminPhonePending] = useState('');
  const [adminPasswordPending, setAdminPasswordPending] = useState('');
  const [totpCountdown, setTotpCountdown] = useState(30);

  // Lockout State
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // Live TOTP countdown simulation for Admin 2FA
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

  // Evaluate Password Strength for Registration
  const getPasswordStrength = (pwd: string) => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score; // 0 to 4
  };

  const pwdStrength = getPasswordStrength(password);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise((r) => setTimeout(r, 450));

    const result: LoginResult = AuthStore.login(phone, password, is2FAStep ? securityPin : undefined);
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
      setAdminPhonePending(phone);
      setAdminPasswordPending(password);
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
            ? 'মোবাইল নম্বর বা পাসওয়ার্ড সঠিক নয়। নিচে দেওয়া রোল সিকিউরিটি তালিকা দেখুন।'
            : 'Invalid credentials. Please inspect the verified credentials table below.')
      );
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise((r) => setTimeout(r, 450));
    const result: LoginResult = AuthStore.login(adminPhonePending, adminPasswordPending, securityPin);
    setLoading(false);

    if (result.success && result.user) {
      onAuthSuccess(result.user);
    } else {
      setError(
        language === 'bn'
          ? 'ভুল টু-ফ্যাক্টর (2FA) নিরাপত্তা কোড! পরীক্ষামূলক কোড: 883650'
          : 'Invalid 2FA Authenticator Token. Demo TOTP code is: 883650'
      );
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('Passwords do not match', 'পাসওয়ার্ড দুটি মিলছে না'));
      return;
    }
    if (password.length < 8) {
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

    const cleanPhone = phone.replace(/\D/g, '');
    const existing = AuthStore.getUsers().find((u) => u.phone === cleanPhone);
    if (existing) {
      setError(t('This mobile number is already registered in NativeBazar', 'এই ফোন নম্বরটি আগেই নিবন্ধিত রয়েছে'));
      setLoading(false);
      return;
    }

    const newUser = AuthStore.register({
      name,
      phone: cleanPhone,
      password,
      role: selectedRole,
      district,
      verified: false,
    });
    setLoading(false);
    onAuthSuccess(newUser);
  };

  const selectRoleCredentials = (role: UserRole) => {
    const cred = DEMO_CREDENTIALS[role];
    setPhone(cred.phone);
    setPassword(cred.password);
    setSelectedRole(role);
    setIs2FAStep(false);
    setError('');
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: 'linear-gradient(135deg, #022c22 0%, #064e3b 35%, #0f766e 70%, #082f49 100%)',
      }}
    >
      {/* Left Panel: Enterprise Platform Security & Vision */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden text-white">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md border border-white/30 shadow-lg">
              <Sprout className="w-7 h-7 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">NativeBazar</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  v4.0 Enterprise
                </span>
              </div>
              <p className="text-emerald-300 text-xs font-semibold">নেটিভবাজার • AI Agricultural Cyber Architecture</p>
            </div>
          </div>

          <div className="space-y-4 max-w-lg">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Multi-Role Access Control & Dual-Factor Telemetry</span>
            </div>
            <h2 className="text-4xl font-extrabold leading-tight text-white">
              {t(
                'End-to-End Encrypted Agricultural Commerce',
                'নিরাপদ ও সার্বিক এনক্রিপ্টেড স্মার্ট কৃষি বাণিজ্য প্ল্যাটফর্ম'
              )}
            </h2>
            <p className="text-emerald-100/80 text-sm leading-relaxed">
              {t(
                'Each of the 6 platform stakeholders operates under cryptographically separated authentication layers, while Admin telemetry requires dual-factor (2FA) verification.',
                '৬টি পৃথক ব্যবহারকারী রোলের জন্য স্বতন্ত্র শক্তিশালী ক্রেডেনশিয়াল ও অ্যাডমিন পোর্টালের জন্য ২-ফ্যাক্টর (2FA) সিকিউরিটি নিশ্চিত করা হয়েছে।'
              )}
            </p>
          </div>
        </div>

        {/* Security Highlights */}
        <div className="relative z-10 space-y-3 bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20 max-w-lg">
          <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>Cyber Defense & Access Guarantees</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs text-emerald-100">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Distinct Passwords for Every Stakeholder</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Mandatory Admin 2FA TOTP Protection</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Brute-force Account Lockout After 3 Attempts</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>SHA-256 Salted Hashing & Real-Time Audit Log</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-emerald-400/80">
          Campus365 Internship R&D • Bogura Pilot District Node • Secure Operations
        </div>
      </div>

      {/* Right Panel: Authentication Form & Dynamic 2FA */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-stone-50 overflow-y-auto">
        <div className="w-full max-w-md my-auto space-y-6">
          {/* Header Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 bg-stone-200/70 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => {
                  setMode('login');
                  setIs2FAStep(false);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  mode === 'login' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                {t('Sign In', 'লগইন')}
              </button>
              <button
                onClick={() => {
                  setMode('register');
                  setIs2FAStep(false);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  mode === 'register' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'
                }`}
              >
                {t('Register', 'নিবন্ধন')}
              </button>
            </div>

            <button
              onClick={onLanguageToggle}
              className="px-3 py-1.5 bg-white text-stone-800 text-xs font-bold rounded-lg border border-stone-200 shadow-2xs hover:bg-stone-100 transition-colors"
            >
              {language === 'bn' ? 'English' : 'বাংলা'}
            </button>
          </div>

          {/* Title */}
          <div>
            <h2 className="text-2xl font-black text-stone-900 tracking-tight">
              {is2FAStep
                ? t('Admin Security Clearance (2FA)', 'অ্যাডমিন নিরাপত্তা যাচাই (২-ফ্যাক্টর)')
                : mode === 'login'
                ? t('Secure Stakeholder Portal', 'নিরাপদ অ্যাকাউন্ট প্রবেশ')
                : t('Create Platform Account', 'নতুন অ্যাকাউন্ট নিবন্ধন')}
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              {is2FAStep
                ? t('Enter 6-digit Authenticator PIN for Bogura Root Console', 'বগুড়া পাইলট কনসোলে প্রবেশের জন্য ৬-সংখ্যার নিরাপত্তা পিন প্রদান করুন')
                : mode === 'login'
                ? t('Select your role below to auto-fill distinct credentials or enter your own.', 'নিচের ভূমিকা নির্বাচন করে স্বতন্ত্র ক্রেডেনশিয়াল পূরণ করুন অথবা আপনার তথ্য দিন।')
                : t('Join Bogura regional agricultural network with encrypted credentials.', 'এনক্রিপ্টেড ক্রেডেনশিয়াল সহ আঞ্চলিক কৃষি নেটওয়ার্কে যুক্ত হন।')}
            </p>
          </div>

          {/* Account Lockout Banner */}
          {isLocked && (
            <div className="p-4 bg-red-50 border border-red-300 rounded-2xl flex items-start gap-3 text-xs text-red-900 animate-slide-down">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-sm">
                  {t('Account Temporarily Locked!', 'অ্যাকাউন্ট সাময়িকভাবে লক করা হয়েছে!')}
                </strong>
                <span>
                  {t(
                    `Too many incorrect password attempts. Security protection active. Unlocking in ${lockoutSeconds} seconds.`,
                    `একাধিক ভুল পাসওয়ার্ড দেওয়ার কারণে সিকিউরিটি লক কার্যকর হয়েছে। আর ${lockoutSeconds} সেকেন্ড পর আনলক হবে।`
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

          {/* ROLE SELECTOR CARDS (Shows Each User's Unique Credentials) */}
          {mode === 'login' && !is2FAStep && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-stone-600">
                <span className="flex items-center gap-1">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  {t('6 Separate Role Credentials (Click to Test):', '৬টি ভিন্ন রোল ও স্বতন্ত্র পাসওয়ার্ড (ক্লিক করুন):')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                {(Object.keys(DEMO_CREDENTIALS) as UserRole[]).map((r) => {
                  const cred = DEMO_CREDENTIALS[r];
                  const isSelected = phone === cred.phone;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => selectRoleCredentials(r)}
                      className={`p-2.5 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? 'border-emerald-600 bg-emerald-50/80 shadow-xs ring-1 ring-emerald-600'
                          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 text-[11px]">
                          {language === 'bn' ? cred.roleLabelBn : cred.roleLabelEn}
                        </span>
                        {r === 'admin' && (
                          <span className="bg-red-100 text-red-700 text-[9px] font-black px-1.5 py-0.2 rounded uppercase">
                            2FA
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-500 font-mono mt-0.5 truncate">{cred.phone}</p>
                      <p className="text-[10px] text-emerald-700 font-mono font-semibold truncate">
                        🔑 {cred.password}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ADMIN 2FA SCREEN */}
          {is2FAStep ? (
            <form onSubmit={handle2FASubmit} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
              <div className="bg-gradient-to-r from-slate-900 to-emerald-950 p-4 rounded-xl text-white space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <ShieldCheck className="w-4 h-4" />
                    Authenticator Simulator (TOTP)
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
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{t('Verify & Access Admin Console', 'যাচাই ও অ্যাডমিনে প্রবেশ করুন')}</span>
                </button>
              </div>
            </form>
          ) : mode === 'login' ? (
            /* STANDARD / MULTI-USER LOGIN FORM */
            <form onSubmit={handleLogin} className="space-y-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {t('Mobile Number or Admin Email', 'মোবাইল নম্বর অথবা অ্যাডমিন ইমেইল')}
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01712458920 or admin@nativebazar.gov.bd"
                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium focus:outline-emerald-600"
                    required
                    disabled={isLocked}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-stone-700">
                    {t('Secret Password', 'গোপন পাসওয়ার্ড')}
                  </label>
                  <span className="text-[10px] text-stone-400">Salted SHA-256</span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter distinct password"
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
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                <span>{loading ? t('Authenticating...', 'যাচাই হচ্ছে...') : t('Sign In with Encrypted Session', 'এনক্রিপ্টেড সেশনে প্রবেশ করুন')}</span>
              </button>
            </form>
          ) : (
            /* REGISTRATION FORM WITH REALTIME PASSWORD STRENGTH */
            <form onSubmit={handleRegister} className="space-y-3.5 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">{t('Full Name', 'পূর্ণ নাম')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Md. Shahidul Alam"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">{t('Phone Number', 'মোবাইল নম্বর')}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">{t('Pilot District', 'পাইলট জেলা')}</label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  >
                    <option>Bogura</option>
                    <option>Rajshahi</option>
                    <option>Rangpur</option>
                    <option>Dhaka</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">{t('Account Role', 'আপনার ভূমিকা')}</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                >
                  <option value="farmer">Farmer (কৃষক)</option>
                  <option value="businessman">Businessman / Wholesaler (ব্যবসায়ী)</option>
                  <option value="supplier">Agro Supplier (সরবরাহকারী)</option>
                  <option value="customer">Customer / Household (ভোক্তা)</option>
                  <option value="expert">Agri Expert (কৃষি বিশেষজ্ঞ)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">{t('Password', 'পাসওয়ার্ড')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
                {/* Real-time Password Strength Meter */}
                <div className="mt-1.5 space-y-1">
                  <div className="flex gap-1 h-1.5">
                    <div className={`flex-1 rounded-full ${pwdStrength >= 1 ? 'bg-red-500' : 'bg-stone-200'}`} />
                    <div className={`flex-1 rounded-full ${pwdStrength >= 2 ? 'bg-amber-500' : 'bg-stone-200'}`} />
                    <div className={`flex-1 rounded-full ${pwdStrength >= 3 ? 'bg-blue-500' : 'bg-stone-200'}`} />
                    <div className={`flex-1 rounded-full ${pwdStrength >= 4 ? 'bg-emerald-500' : 'bg-stone-200'}`} />
                  </div>
                  <span className="text-[10px] text-stone-400 block text-right">
                    {pwdStrength <= 1
                      ? 'Weak'
                      : pwdStrength === 2
                      ? 'Fair'
                      : pwdStrength === 3
                      ? 'Good'
                      : 'Strong (Recommended)'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">{t('Confirm Password', 'পাসওয়ার্ড নিশ্চিত করুন')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{t('Register Secure Account', 'নিরাপদ অ্যাকাউন্ট তৈরি করুন')}</span>
              </button>
            </form>
          )}

          {/* Footer attribution */}
          <div className="text-center text-[11px] text-stone-400">
            NativeBazar Security Module • SHA-256 Salted Authentication • Campus365 R&D
          </div>
        </div>
      </div>
    </div>
  );
};
