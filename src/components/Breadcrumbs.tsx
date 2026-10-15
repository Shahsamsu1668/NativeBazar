import React from 'react';
import { ActiveView, Language, UserRole } from '../types';
import { ChevronRight, ArrowLeft, Home } from 'lucide-react';

interface BreadcrumbsProps {
  activeView: ActiveView;
  subTab?: string;
  role: UserRole;
  language: Language;
  onNavigate: (view: ActiveView, tab?: string) => void;
  onBack: () => void;
  canGoBack: boolean;
}

const VIEW_TITLES: Record<ActiveView, { en: string; bn: string }> = {
  dashboard: { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  market_rates: { en: 'Market Rates', bn: 'বাজার দর' },
  weather: { en: 'Weather Advisory', bn: 'আবহাওয়া বুলেটিন' },
  orders: { en: 'Orders & Settlements', bn: 'অর্ডার ও লেনদেন' },
  ledger: { en: 'Expense Ledger', bn: 'হিসাব খাতা' },
  profile: { en: 'My Profile', bn: 'আমার প্রোফাইল' },
  notifications: { en: 'Notifications', bn: 'বিজ্ঞপ্তি' },
  contacts: { en: 'Contacts & Messaging', bn: 'যোগাযোগ ও বার্তা' },
  bulletins: { en: 'Agricultural Bulletins', bn: 'কৃষি বুলেটিন' },
};

const ROLE_TITLES: Record<UserRole, { en: string; bn: string }> = {
  farmer: { en: 'Farmer Hub', bn: 'কৃষক হাব' },
  businessman: { en: 'Wholesale Buyer Hub', bn: 'পাইকারি ট্রেডার হাব' },
  supplier: { en: 'Agro Supplier Hub', bn: 'উপকরণ ডিলার হাব' },
  customer: { en: 'Fresh Marketplace', bn: 'ভোক্তা বাজার' },
  expert: { en: 'Agronomy Expert Hub', bn: 'কৃষি বিশেষজ্ঞ হাব' },
  admin: { en: 'Central Admin Telemetry', bn: 'প্রশাসন কন্ট্রোল সেন্টার' },
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  activeView,
  subTab,
  role,
  language,
  onNavigate,
  onBack,
  canGoBack,
}) => {
  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  const roleName = ROLE_TITLES[role] || { en: 'Dashboard', bn: 'ড্যাশবোর্ড' };
  const viewInfo = VIEW_TITLES[activeView] || { en: 'View', bn: 'ভিউ' };

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className="bg-white/80 backdrop-blur-xs border-b border-stone-200/80 px-4 py-2 text-xs"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Back Button + Breadcrumbs List */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-xs transition-colors shrink-0 ${canGoBack
                ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 active:scale-95'
                : 'text-stone-300 cursor-not-allowed bg-stone-50'
              }`}
            title={t('Go back to previous page', 'পূর্ববর্তী পৃষ্ঠায় ফিরে যান')}
            aria-label={t('Go back', 'ফিরে যান')}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('Back', 'ফিরে যান')}</span>
          </button>

          <span className="text-stone-300">|</span>

          <ol className="flex items-center gap-1.5 text-stone-600 whitespace-nowrap">
            <li className="flex items-center">
              <button
                onClick={() => onNavigate('dashboard')}
                className="flex items-center gap-1 text-stone-500 hover:text-emerald-700 font-medium transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>{t('Home', 'মূলপাতা')}</span>
              </button>
            </li>

            <li className="flex items-center text-stone-400">
              <ChevronRight className="w-3 h-3" />
            </li>

            <li className="flex items-center">
              {activeView === 'dashboard' && !subTab ? (
                <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md" aria-current="page">
                  {t(roleName.en, roleName.bn)}
                </span>
              ) : (
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="hover:text-emerald-700 font-medium text-stone-600 transition-colors"
                >
                  {t(roleName.en, roleName.bn)}
                </button>
              )}
            </li>

            {activeView !== 'dashboard' && (
              <>
                <li className="flex items-center text-stone-400">
                  <ChevronRight className="w-3 h-3" />
                </li>
                <li className="flex items-center">
                  <span
                    className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md"
                    aria-current="page"
                  >
                    {t(viewInfo.en, viewInfo.bn)}
                  </span>
                </li>
              </>
            )}

            {subTab && (
              <>
                <li className="flex items-center text-stone-400">
                  <ChevronRight className="w-3 h-3" />
                </li>
                <li className="flex items-center">
                  <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    {subTab}
                  </span>
                </li>
              </>
            )}
          </ol>
        </div>

        {/* Current Context Pill */}
        <div className="hidden md:flex items-center gap-2 text-[11px] text-stone-500 shrink-0 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>NativeBazar Pilot Node</span>
        </div>
      </div>
    </nav>
  );
};
