import React, { useState } from 'react';
import { Language, User } from '../types';
import { AuthStore } from '../data/store';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, X, AlertTriangle, KeyRound } from 'lucide-react';

interface AdminVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (adminUser: User) => void;
  language: Language;
}

export const AdminVerificationModal: React.FC<AdminVerificationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  language,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError(t('Please enter administrator email address', 'দয়া করে অ্যাডমিন ইমেইল ঠিকানা দিন'));
      return;
    }
    if (!password) {
      setError(t('Please enter administrator password', 'দয়া করে অ্যাডমিন পাসওয়ার্ড দিন'));
      return;
    }

    setLoading(true);
    setTimeout(() => {
      const result = AuthStore.verifyAdminCredentials(email, password);
      setLoading(false);

      if (result.success && result.user) {
        onSuccess(result.user);
        onClose();
        setEmail('');
        setPassword('');
        setError('');
      } else {
        setError(
          result.message ||
            t(
              'Invalid administrator email or password. Access denied.',
              'ভুল অ্যাডমিন ইমেইল বা পাসওয়ার্ড। প্রবেশাধিকার প্রত্যাখ্যাত।'
            )
        );
      }
    }, 400);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-verify-title"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 id="admin-verify-title" className="font-extrabold text-stone-900 text-sm">
                {t('Admin Authentication Required', 'অ্যাডমিন নিরাপত্তা যাচাইকরণ')}
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                {t('Verify credentials to access admin section', 'অ্যাডমিন সেকশনে প্রবেশের জন্য অনুমোদিত তথ্য দিন')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('Close', 'বন্ধ করুন')}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-stone-100 text-stone-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 animate-slide-up">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleVerify} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              {t('Admin ID / Email', 'অ্যাডমিন আইডি / ইমেইল')}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="NativeBazarSJS"
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                autoFocus
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              {t('Admin Password', 'অ্যাডমিন পাসওয়ার্ড')}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-9 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl transition-colors"
            >
              {t('Cancel', 'বাতিল')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-2/3 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>{loading ? t('Verifying...', 'যাচাই হচ্ছে...') : t('Verify & Enter Admin', 'যাচাই ও প্রবেশ করুন')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
