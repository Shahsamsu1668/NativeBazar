import React, { useState, useRef, useEffect } from 'react';
import { UserRole, Language, User, ActiveView, Theme, Notification } from '../types';
import {
  Sprout, Briefcase, Store, ShoppingCart, ShoppingBag, Microscope, ShieldCheck,
  Mic, Stethoscope, Globe, MapPin, TrendingUp,
  Bell, LogOut, ChevronDown, Menu, X,
  Package, CheckCircle2, Sun, Moon, User as UserIcon,
  Users, MessageSquare,
} from 'lucide-react';
import { NotificationStore, MessageStore, AuthStore } from '../data/store';

export const toBanglaNumber = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
};

export const toBanglaDistrict = (d: string): string => {
  const map: Record<string, string> = {
    Bogura: 'বগুড়া',
    Bogra: 'বগুড়া',
    Rajshahi: 'রাজশাহী',
    Rangpur: 'রংপুর',
    Jashore: 'যশোর',
    Dhaka: 'ঢাকা',
    Mymensingh: 'ময়মনসিংহ',
    Dinajpur: 'দিনাজপুর',
    Chattogram: 'চট্টগ্রাম',
    Sylhet: 'সিলেট',
    Khulna: 'খুলনা',
    Barishal: 'বরিশাল',
    Cumilla: 'কুমিল্লা',
  };
  return map[d] || d;
};

interface HeaderProps {
  currentUser: User | null;
  language: Language;
  onLanguageToggle: () => void;
  selectedDistrict: string;
  onDistrictChange: (district: string) => void;
  onOpenCropDoctor: () => void;
  onOpenVoiceAssistant: () => void;
  activeView: ActiveView;
  onViewChange: (view: ActiveView) => void;
  cartCount: number;
  onLogout: () => void;
  onOpenProfile?: () => void;
  onOpenAuth?: () => void;
  onCallUser?: (user: User) => void;
  theme?: Theme;
  onThemeToggle?: () => void;
}

const ROLE_CONFIG: Record<UserRole, { icon: React.ReactNode; color: string; labelEn: string; labelBn: string; badgeBg: string }> = {
  farmer:      { icon: <Sprout className="w-3.5 h-3.5" />,       color: 'text-emerald-700', labelEn: 'Farmer',      labelBn: 'কৃষক',          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  wholesaler:  { icon: <Briefcase className="w-3.5 h-3.5" />,    color: 'text-blue-700',    labelEn: 'Wholesaler',   labelBn: 'পাইকার',        badgeBg: 'bg-blue-100 text-blue-800 border-blue-200' },
  retailer:    { icon: <Store className="w-3.5 h-3.5" />,        color: 'text-amber-700',   labelEn: 'Retailer',     labelBn: 'খুচরা বিক্রেতা', badgeBg: 'bg-amber-100 text-amber-800 border-amber-200' },
  consumer:    { icon: <ShoppingCart className="w-3.5 h-3.5" />, color: 'text-purple-700',  labelEn: 'Consumer',     labelBn: 'ভোক্তা',        badgeBg: 'bg-purple-100 text-purple-800 border-purple-200' },
  admin:       { icon: <ShieldCheck className="w-3.5 h-3.5" />,  color: 'text-slate-800',   labelEn: 'Admin',       labelBn: 'অ্যাডমিন',      badgeBg: 'bg-slate-200 text-slate-800 border-slate-300' },
};

// Removed weather, bulletins, and ledger navigation items
const NAV_ITEMS: Array<{ id: ActiveView; icon: React.ReactNode; labelEn: string; labelBn: string; roles?: UserRole[] }> = [
  { id: 'dashboard',    icon: <Sprout className="w-4 h-4" />,    labelEn: 'Marketplace / Dashboard', labelBn: 'ড্যাশবোর্ড' },
  { id: 'market_rates', icon: <TrendingUp className="w-4 h-4" />,labelEn: 'DAM Market Rates', labelBn: 'বাজার দর', roles: ['farmer', 'wholesaler', 'retailer', 'admin'] },
  { id: 'orders',       icon: <Package className="w-4 h-4" />,   labelEn: 'Farmer-Wholesaler Trades', labelBn: 'কৃষক-পাইকার বাণিজ্য', roles: ['farmer', 'wholesaler', 'retailer', 'consumer', 'admin'] },
  { id: 'contacts',     icon: <Users className="w-4 h-4" />,      labelEn: 'Trade Network', labelBn: 'যোগাযোগ ও নেটওয়ার্ক', roles: ['farmer', 'wholesaler', 'retailer', 'consumer', 'admin'] },
];

export const Header: React.FC<HeaderProps> = ({
  currentUser, language, onLanguageToggle,
  selectedDistrict, onDistrictChange,
  onOpenCropDoctor, onOpenVoiceAssistant,
  activeView, onViewChange, cartCount, onLogout,
  onOpenProfile, onOpenAuth, onCallUser, theme = 'light', onThemeToggle,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notifRef  = useRef<HTMLDivElement>(null);
  const userRef   = useRef<HTMLDivElement>(null);

  // Reactive state for dynamic notifications & message badges
  const [notifs, setNotifs] = useState<Notification[]>(() =>
    currentUser ? NotificationStore.getByUser(currentUser.id).slice(0, 8) : []
  );
  const [unread, setUnread] = useState<number>(() =>
    currentUser ? NotificationStore.unreadCount(currentUser.id) : 0
  );
  const [unreadMsgCount, setUnreadMsgCount] = useState<number>(() =>
    currentUser ? MessageStore.getUnreadCount(currentUser.id) : 0
  );

  useEffect(() => {
    const syncStore = () => {
      if (currentUser) {
        setNotifs(NotificationStore.getByUser(currentUser.id).slice(0, 8));
        setUnread(NotificationStore.unreadCount(currentUser.id));
        setUnreadMsgCount(MessageStore.getUnreadCount(currentUser.id));
      } else {
        setNotifs([]);
        setUnread(0);
        setUnreadMsgCount(0);
      }
    };

    syncStore();

    window.addEventListener('nb_notifications_updated', syncStore);
    window.addEventListener('nb_messages_updated', syncStore);
    window.addEventListener('nb_unread_updated', syncStore);
    window.addEventListener('nb_call_incoming', syncStore);
    window.addEventListener('storage', syncStore);

    const interval = setInterval(syncStore, 1200);

    return () => {
      window.removeEventListener('nb_notifications_updated', syncStore);
      window.removeEventListener('nb_messages_updated', syncStore);
      window.removeEventListener('nb_unread_updated', syncStore);
      window.removeEventListener('nb_call_incoming', syncStore);
      window.removeEventListener('storage', syncStore);
      clearInterval(interval);
    };
  }, [currentUser?.id]);

  const role: UserRole = currentUser ? currentUser.role : 'consumer';
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.consumer;

  // Use the logged-in user's profile district for the header logo subtitle; fallback to view filter
  const profileDistrict = currentUser?.district || selectedDistrict || 'Bogura';

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (userRef.current  && !userRef.current.contains(e.target as Node))  setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const t = (en: string, bn: string) => language === 'bn' ? bn : en;
  const visibleNavItems = !currentUser
    ? [
        { id: 'dashboard' as ActiveView, icon: <Sprout className="w-4 h-4" />, labelEn: 'Home', labelBn: 'হোম' },
        { id: 'market_rates' as ActiveView, icon: <TrendingUp className="w-4 h-4" />, labelEn: 'DAM Market Rates', labelBn: 'বাজার দর' },
      ]
    : NAV_ITEMS.filter(n => !n.roles || n.roles.includes(role));

  const handleNotificationClick = (n: Notification) => {
    const isCallNotif =
      n.type === 'warning' ||
      n.title.includes('কল') ||
      n.title.includes('Call') ||
      (n.actionUrl?.includes('calls') ?? false);

    if (isCallNotif) {
      // Dismiss / remove call notification automatically when viewed or attended
      NotificationStore.dismiss(n.id);
    } else {
      NotificationStore.markRead(n.id);
    }

    setShowNotifs(false);
    if (currentUser) {
      setNotifs(NotificationStore.getByUser(currentUser.id).slice(0, 8));
      setUnread(NotificationStore.unreadCount(currentUser.id));
    }

    if (n.actionUrl) {
      if (isCallNotif && n.actionUrl.includes('callerId=')) {
        const urlParams = new URLSearchParams(n.actionUrl.split('?')[1] || '');
        const callerId = urlParams.get('callerId');
        if (callerId) {
          const caller = AuthStore.getUsers().find((u) => u.id === callerId);
          if (caller && onCallUser) {
            onCallUser(caller);
            return;
          }
        }
        onViewChange('contacts');
        return;
      }

      if (n.actionUrl.includes('contacts') || n.actionUrl.includes('chat') || n.actionUrl.includes('connection')) {
        const urlParams = new URLSearchParams(n.actionUrl.split('?')[1] || '');
        const chatUserId = urlParams.get('userId');
        if (chatUserId && currentUser) {
          MessageStore.markRead(currentUser.id, chatUserId);
          setUnreadMsgCount(MessageStore.getUnreadCount(currentUser.id));
        }
        onViewChange('contacts');
      } else if (n.actionUrl.includes('order')) {
        onViewChange('orders');
      } else if (n.actionUrl.includes('market')) {
        onViewChange('market_rates');
      } else {
        onViewChange('dashboard');
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-xs">
      {/* Subtle Top Info Bar */}
      <div className="bg-stone-900 text-stone-200 text-[11px] py-1 px-4 border-b border-stone-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-600 text-white font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wide uppercase">
              {language === 'bn' ? 'লাইভ' : 'LIVE'}
            </span>
            <span className="text-stone-300 font-medium">
              {language === 'bn' ? 'আমার হাট' : 'Amar Haat'} • {t('Local Agricultural Marketplace', 'স্থানীয় কৃষি ও ফসল বাজার')}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-stone-400 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>{t('Bangladesh Agricultural Platform', 'বাংলাদেশ কৃষি প্ল্যাটফর্ম')}</span>
          </div>
        </div>
      </div>

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
          <button
            onClick={() => { onViewChange('dashboard'); setMobileMenuOpen(false); }}
            className="flex items-center gap-2.5 text-left group shrink-0"
            aria-label="Amar Haat Home"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-700 flex items-center justify-center text-white shadow-xs group-hover:bg-emerald-800 transition-colors">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-stone-900 group-hover:text-emerald-700 transition-colors">
                  {language === 'bn' ? 'আমার হাট' : 'Amar Haat'}
                </span>
              </div>
              <p className="text-[10px] text-stone-500 font-medium leading-none">
                {currentUser
                  ? (language === 'bn' ? `${toBanglaDistrict(profileDistrict)} • বাংলাদেশ` : `${profileDistrict} • Bangladesh`)
                  : (language === 'bn' ? 'ডিজিটাল কৃষি প্ল্যাটফর্ম • বাংলাদেশ' : 'Digital Agri Platform • Bangladesh')}
              </p>
            </div>
          </button>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2 flex-1 justify-end">
            {/* AI Crop Doctor Button — hidden for consumer */}
            {role !== 'consumer' && role !== 'retailer' && (
              <button
                onClick={onOpenCropDoctor}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                title={t('Open AI Crop Doctor', 'এআই ফসলের ডাক্তার খুলুন')}
              >
                <Stethoscope className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('Crop Doctor', 'ফসলের ডাক্তার')}</span>
              </button>
            )}

            {/* Voice Assistant Button — hidden for consumer */}
            {role !== 'consumer' && role !== 'retailer' && (
              <button
                onClick={onOpenVoiceAssistant}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                title={t('Open Voice AI Assistant', 'ভয়েস সহকারী খুলুন')}
              >
                <Mic className="w-3.5 h-3.5 text-teal-600" />
                <span>{t('Voice AI', 'ভয়েস সহকারী')}</span>
              </button>
            )}

            {/* District Selector (Only for authenticated users) */}
            {currentUser && (
            <div className="flex items-center gap-1 bg-stone-100 border border-stone-200 rounded-lg px-2 py-1.5 text-xs">
              <MapPin className="w-3.5 h-3.5 text-stone-500 shrink-0" />
              <select
                value={selectedDistrict}
                onChange={e => onDistrictChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-stone-700 focus:outline-hidden cursor-pointer"
                aria-label={t('Select district', 'জেলা নির্বাচন')}
              >
                <option value="Bogura">{language === 'bn' ? 'বগুড়া' : 'Bogura (বগুড়া)'}</option>
                <option value="Rajshahi">{language === 'bn' ? 'রাজশাহী' : 'Rajshahi (রাজশাহী)'}</option>
                <option value="Rangpur">{language === 'bn' ? 'রংপুর' : 'Rangpur (রংপুর)'}</option>
                <option value="Jashore">{language === 'bn' ? 'যশোর' : 'Jashore (যশোর)'}</option>
                <option value="Dhaka">{language === 'bn' ? 'ঢাকা' : 'Dhaka (ঢাকা)'}</option>
                <option value="Mymensingh">{language === 'bn' ? 'ময়মনসিংহ' : 'Mymensingh (ময়মনসিংহ)'}</option>
              </select>
            </div>
            )}

            {/* Dark / Light Theme Toggle */}
            <button
              onClick={onThemeToggle}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors border border-stone-200 cursor-pointer"
              title={theme === 'dark' ? t('Switch to Light Mode', 'লাইট মোড চালু করুন') : t('Switch to Dark Mode', 'ডার্ক মোড চালু করুন')}
              aria-label={t('Toggle theme', 'থিম পরিবর্তন')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-stone-600" />}
            </button>

            {/* Language Switcher */}
            <button
              onClick={onLanguageToggle}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg border border-stone-200 transition-colors cursor-pointer"
              title={t('Switch Language', 'ভাষা পরিবর্তন')}
              aria-label={t('Switch Language', 'ভাষা পরিবর্তন')}
            >
              <Globe className="w-3.5 h-3.5 text-stone-600" />
              <span>{language === 'bn' ? 'বাং' : 'EN'}</span>
            </button>

            {currentUser && (
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => { setShowNotifs(v => !v); setShowUserMenu(false); }}
                className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                aria-label={t('Notifications', 'বিজ্ঞপ্তি')}
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
                    {unread > 9 ? (language === 'bn' ? '৯+' : '9+') : (language === 'bn' ? toBanglaNumber(unread) : unread)}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden animate-slide-down z-50">
                  <div className="px-4 py-2.5 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                    <h3 className="font-bold text-stone-900 text-xs">{t('Notifications', 'বিজ্ঞপ্তি')}</h3>
                    {unread > 0 && (
                      <button onClick={() => NotificationStore.markAllRead(currentUser?.id)} className="text-[11px] text-emerald-700 hover:underline font-semibold cursor-pointer">
                        {t('Mark all read', 'সব পড়া হয়েছে')}
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-stone-100">
                    {notifs.length === 0 ? (
                      <div className="p-6 text-center text-stone-400 text-xs">
                        {t('No notifications yet', 'এখনো কোনো বিজ্ঞপ্তি নেই')}
                      </div>
                    ) : notifs.map((n) => {
                      const isCall =
                        n.type === 'warning' ||
                        n.title.includes('কল') ||
                        n.title.includes('Call') ||
                        (n.actionUrl?.includes('calls') ?? false);

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`px-4 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors text-xs ${
                            !n.read
                              ? isCall
                                ? 'bg-amber-50/80 border-l-4 border-amber-500'
                                : 'bg-emerald-50/60'
                              : ''
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-stone-900 text-xs">{n.title}</p>
                            {isCall && (
                              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 animate-pulse">
                                {language === 'bn' ? 'ইনকামিং কল' : 'INCOMING CALL'}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">{n.message}</p>
                          {isCall && (
                            <div className="mt-2 flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNotificationClick(n);
                                }}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs"
                              >
                                <span>{language === 'bn' ? '📞 গ্রহণ করুন' : '📞 Attend Call'}</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  NotificationStore.dismiss(n.id);
                                  if (currentUser) {
                                    setNotifs(NotificationStore.getByUser(currentUser.id).slice(0, 8));
                                    setUnread(NotificationStore.unreadCount(currentUser.id));
                                  }
                                }}
                                className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-[10px] font-bold"
                              >
                                <span>{language === 'bn' ? 'মুছুন' : 'Dismiss'}</span>
                              </button>
                            </div>
                          )}
                          <p className="text-[10px] text-stone-400 mt-1">
                            {new Date(n.createdAt).toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Quick Direct Messages / Contacts Button (For registered traders) */}
            {currentUser && role !== 'consumer' && (
              <button
                onClick={() => onViewChange('contacts')}
                className={`relative w-8 h-8 flex items-center justify-center rounded-lg transition-colors border cursor-pointer ${
                  activeView === 'contacts'
                    ? 'bg-emerald-700 text-white border-emerald-800'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200'
                }`}
                title={t('Messages & Contacts', 'বার্তা ও যোগাযোগ')}
                aria-label={t('Messages & Contacts', 'বার্তা ও যোগাযোগ')}
              >
                <MessageSquare className="w-4 h-4" />
                {unreadMsgCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white animate-pulse">
                    {unreadMsgCount > 9 ? (language === 'bn' ? '৯+' : '9+') : (language === 'bn' ? toBanglaNumber(unreadMsgCount) : unreadMsgCount)}
                  </span>
                )}
              </button>
            )}

            {/* Cart Badge (Visible for consumers or guests) */}
            {cartCount > 0 && (
              <button
                onClick={() => onViewChange('dashboard')}
                className="relative flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-2xs cursor-pointer"
                title={t('Cart Items', 'ঝুড়ির পণ্য')}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? toBanglaNumber(cartCount) : cartCount}</span>
              </button>
            )}

            {/* User Menu or Sign In Button */}
            {currentUser ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => { setShowUserMenu(v => !v); setShowNotifs(false); }}
                  className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg border border-stone-200 transition-colors cursor-pointer"
                  aria-label={t('User profile menu', 'ব্যবহারকারী প্রোফাইল')}
                >
                  <div className="w-6 h-6 rounded-md bg-stone-800 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {(currentUser.name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p className="text-xs font-bold text-stone-800 leading-none">{(currentUser.name || 'User').split(' ')[0]}</p>
                    <p className="text-[10px] text-stone-500 leading-none mt-0.5">{t(config.labelEn, config.labelBn)}</p>
                  </div>
                  <ChevronDown className="w-3 h-3 text-stone-400" />
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-stone-200 overflow-hidden animate-slide-down z-50">
                    <div className="px-4 py-3 bg-stone-50 border-b border-stone-200">
                      <p className="font-bold text-stone-900 text-xs">{currentUser.name || 'User'}</p>
                      <p className="text-[11px] text-stone-500 font-mono mt-0.5">
                        {language === 'bn' ? toBanglaNumber(currentUser.phone) : currentUser.phone}
                      </p>
                      <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.badgeBg}`}>
                        {config.icon}
                        {t(config.labelEn, config.labelBn)}
                      </span>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <button
                        onClick={() => {
                          if (onOpenProfile) onOpenProfile();
                          setShowUserMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-stone-700 hover:bg-stone-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t('View & Edit Profile', 'প্রোফাইল দেখুন')}</span>
                      </button>
                      <button
                        onClick={() => { onLogout(); setShowUserMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>{t('Sign Out', 'লগআউট')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={onOpenAuth}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>{t('Sign In / Register', 'লগইন / নিবন্ধন')}</span>
              </button>
            )}
          </div>

          {/* Mobile hamburger button */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-stone-100 text-stone-700 cursor-pointer"
            onClick={() => setMobileMenuOpen(v => !v)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {currentUser && (
      <nav className="border-t border-stone-200 bg-stone-50/70" aria-label="Main Navigation">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {visibleNavItems.map(nav => {
              const isActive = activeView === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => onViewChange(nav.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                      : 'text-stone-700 hover:bg-stone-200/70 hover:text-stone-900'
                  }`}
                >
                  {nav.id === 'orders' && role === 'consumer' ? <ShoppingBag className="w-4 h-4" /> : nav.icon}
                  <span>{nav.id === 'orders' ? (role === 'consumer' ? t('Consumer Purchases', 'ভোক্তার ক্রয়') : role === 'retailer' ? t('Retailer Trade', 'খুচরা বিক্রেতার বাণিজ্য') : t(nav.labelEn, nav.labelBn)) : t(nav.labelEn, nav.labelBn)}</span>
                </button>
              );
            })}

            {/* Status indicator */}
            <div className="ml-auto hidden lg:flex items-center gap-1.5 text-[11px] text-stone-400 font-medium shrink-0 pr-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t('AI Network Active', 'এআই নেটওয়ার্ক সক্রিয়')}</span>
            </div>
          </div>
        </div>
      </nav>
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-stone-200 p-4 space-y-3 animate-slide-down">
          {currentUser ? (
            <div className="flex items-center gap-2 p-3 bg-stone-50 rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-stone-900 text-white flex items-center justify-center text-xs font-bold">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-stone-900 text-xs">{currentUser.name}</p>
                <p className="text-[11px] text-stone-500">
                  {t(config.labelEn, config.labelBn)} • {language === 'bn' ? toBanglaDistrict(currentUser.district || profileDistrict) : (currentUser.district || profileDistrict)}
                </p>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { if (onOpenAuth) onOpenAuth(); setMobileMenuOpen(false); }}
              className="w-full py-2.5 bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <UserIcon className="w-4 h-4" />
              <span>{t('Sign In / Register', 'লগইন / নিবন্ধন')}</span>
            </button>
          )}

          {/* Crop Doctor & Voice AI — hidden for consumer role on mobile, Crop Doctor hidden for retailer */}
          {role !== 'consumer' && (
            <div className={role === 'retailer' ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-2 gap-2'}>
              {role !== 'retailer' && (
                <button
                  onClick={() => { onOpenCropDoctor(); setMobileMenuOpen(false); }}
                  className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 cursor-pointer"
                >
                  <Stethoscope className="w-4 h-4 text-emerald-600" /> {t('Crop Doctor', 'ফসলের ডাক্তার')}
                </button>
              )}
              <button
                onClick={() => { onOpenVoiceAssistant(); setMobileMenuOpen(false); }}
                className="flex items-center gap-2 p-2 bg-teal-50 border border-teal-200 rounded-lg text-xs font-semibold text-teal-800 cursor-pointer"
              >
                <Mic className="w-4 h-4 text-teal-600" /> {t('Voice AI', 'ভয়েস সহকারী')}
              </button>
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 flex items-center gap-1 bg-stone-100 rounded-lg px-2 py-1.5 text-xs">
              <MapPin className="w-3.5 h-3.5 text-stone-500" />
              <select
                value={selectedDistrict}
                onChange={e => onDistrictChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-stone-700 focus:outline-hidden flex-1 cursor-pointer"
              >
                <option value="Bogura">{language === 'bn' ? 'বগুড়া' : 'Bogura'}</option>
                <option value="Rajshahi">{language === 'bn' ? 'রাজশাহী' : 'Rajshahi'}</option>
                <option value="Rangpur">{language === 'bn' ? 'রংপুর' : 'Rangpur'}</option>
                <option value="Jashore">{language === 'bn' ? 'যশোর' : 'Jashore'}</option>
                <option value="Dhaka">{language === 'bn' ? 'ঢাকা' : 'Dhaka'}</option>
                <option value="Mymensingh">{language === 'bn' ? 'ময়মনসিংহ' : 'Mymensingh'}</option>
              </select>
            </div>
            <button
              onClick={onLanguageToggle}
              className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs font-bold text-stone-800 text-center cursor-pointer"
            >
              {language === 'bn' ? 'EN' : 'বাংলা'}
            </button>
          </div>

          {currentUser && (
            <button
              onClick={() => { onLogout(); setMobileMenuOpen(false); }}
              className="w-full flex items-center justify-center gap-2 p-2 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> {t('Sign Out', 'লগআউট')}
            </button>
          )}
        </div>
      )}
    </header>
  );
};
