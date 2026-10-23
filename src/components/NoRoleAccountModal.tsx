import React from 'react';
import { UserRole, Language, User } from '../types';
import {
  AlertCircle,
  PlusCircle,
  LogIn,
  X,
  Sprout,
  Briefcase,
  Store,
  ShoppingCart,
  Microscope,
  ShieldCheck,
} from 'lucide-react';

interface NoRoleAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetRole: UserRole | null;
  currentUser: User;
  language: Language;
  onCreateRoleAccount: (role: UserRole) => void;
  onLoginDifferentAccount?: () => void;
}

const ROLE_META: Record<UserRole, { en: string; bn: string; icon: React.ReactNode; color: string }> = {
  farmer: { en: 'Farmer', bn: 'কৃষক', icon: <Sprout className="w-5 h-5 text-emerald-600" />, color: 'emerald' },
  wholesaler: { en: 'Wholesaler / Aratdar', bn: 'পাইকার / আড়তদার', icon: <Briefcase className="w-5 h-5 text-blue-600" />, color: 'blue' },
  retailer: { en: 'Retailer Store', bn: 'খুচরা বিক্রেতা', icon: <Store className="w-5 h-5 text-amber-600" />, color: 'amber' },
  consumer: { en: 'Consumer', bn: 'ভোক্তা / ক্রেতা', icon: <ShoppingCart className="w-5 h-5 text-purple-600" />, color: 'purple' },
  businessman: { en: 'Wholesaler', bn: 'ব্যবসায়ী / পাইকার', icon: <Briefcase className="w-5 h-5 text-blue-600" />, color: 'blue' },
  supplier: { en: 'Retailer', bn: 'খুচরা বিক্রেতা', icon: <Store className="w-5 h-5 text-amber-600" />, color: 'amber' },
  customer: { en: 'Consumer', bn: 'ভোক্তা / ক্রেতা', icon: <ShoppingCart className="w-5 h-5 text-purple-600" />, color: 'purple' },
  expert: { en: 'Agricultural Expert', bn: 'কৃষি বিশেষজ্ঞ', icon: <Microscope className="w-5 h-5 text-teal-600" />, color: 'teal' },
  admin: { en: 'Platform Administrator', bn: 'প্ল্যাটফর্ম অ্যাডমিন', icon: <ShieldCheck className="w-5 h-5 text-slate-700" />, color: 'slate' },
};

export const NoRoleAccountModal: React.FC<NoRoleAccountModalProps> = ({
  isOpen,
  onClose,
  targetRole,
  currentUser,
  language,
  onCreateRoleAccount,
  onLoginDifferentAccount,
}) => {
  if (!isOpen || !targetRole) return null;

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);
  const meta = ROLE_META[targetRole] || ROLE_META.farmer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-md p-6 space-y-6 animate-slide-down">
        {/* Header Icon & Close */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              {meta.icon}
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                {t('Role Not Registered', 'রোল নিবন্ধিত নেই')}
              </span>
              <h2 className="text-base font-extrabold text-stone-900 mt-1">
                {t(
                  `You don't have an account of this role`,
                  `আপনার এই রোলটিতে কোনো অ্যাকাউন্ট নেই`
                )}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Detailed Message Box */}
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs text-stone-600 space-y-2">
          <p className="font-semibold text-stone-800 leading-relaxed">
            {language === 'bn' ? (
              <>
                আপনার বর্তমান পরিচয় (<strong>{currentUser.email || currentUser.phone}</strong>) দিয়ে কোনো{' '}
                <strong className="text-stone-950 font-bold">{meta.bn}</strong> অ্যাকাউন্ট পাওয়া যায়নি।
              </>
            ) : (
              <>
                No registered <strong>{meta.en}</strong> account was found under your credentials (
                <strong>{currentUser.email || currentUser.phone}</strong>).
              </>
            )}
          </p>
          <p className="text-[11px] text-stone-500 leading-normal">
            {t(
              'NativeBazar allows you to maintain multiple role profiles under the same email. You can instantly create a linked profile for this role now.',
              'NativeBazar এ একই ব্যবহারকারী কৃষক, ব্যবসায়ী বা ভোক্তা হিসেবে একাধিক অ্যাকাউন্ট বজায় রাখতে পারেন।'
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* Primary Action: Create Role Account */}
          <button
            onClick={() => {
              onClose();
              onCreateRoleAccount(targetRole);
            }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-700/20 active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span>
              {language === 'bn'
                ? `নতুন ${meta.bn} অ্যাকাউন্ট তৈরি করুন`
                : `Create ${meta.en} Account`}
            </span>
          </button>

          {/* Secondary Action: Login to different account or cancel */}
          {onLoginDifferentAccount && (
            <button
              onClick={() => {
                onClose();
                onLoginDifferentAccount();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-bold transition-colors"
            >
              <LogIn className="w-4 h-4 text-stone-500" />
              <span>{t('Sign in with Another Account', 'অন্য অ্যাকাউন্ট দিয়ে লগইন করুন')}</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 text-stone-500 hover:text-stone-800 text-xs font-semibold text-center transition-colors"
          >
            {t('Cancel & Stay on Current Role', 'বাতিল করুন')}
          </button>
        </div>
      </div>
    </div>
  );
};
