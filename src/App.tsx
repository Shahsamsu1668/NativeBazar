import React, { useState, useEffect } from 'react';
import {
  UserRole,
  Language,
  User,
  ActiveView,
  SupplierProduct,
  CustomerProduct,
  CartItem,
  AgroAdvisory,
  AIMatchItem,
  Theme,
  normalizeRole,
} from './types';
import { INITIAL_MARKET_RATES } from './data/mockData';
import {
  initializeStore,
  AuthStore,
  CartStore,
  SupplierStore,
  CustomerProductStore,
  AdvisoryStore,
  MatchStore,
  ThemeStore,
  NotificationStore,
  CallStore,
} from './data/store';
import { apiService } from './services/apiService';

import { Header, toBanglaDistrict, toBanglaNumber } from './components/Header';
import { AuthPage } from './components/AuthPage';
import { AdminVerificationModal } from './components/AdminVerificationModal';
import { FarmerDashboard } from './components/FarmerDashboard';
import { WholesalerDashboard } from './components/WholesalerDashboard';
import { RetailerDashboard } from './components/RetailerDashboard';
import { CustomerMarketplace } from './components/CustomerMarketplace';
import { LandingPage } from './components/LandingPage';
import { AdminDashboard } from './components/AdminDashboard';
import { MarketRatesView } from './components/MarketRatesView';
import { OrdersView } from './components/OrdersView';
import { ProfileModal } from './components/ProfileModal';
import { UserProfilePage } from './components/UserProfilePage';
import { CropDoctorModal } from './components/CropDoctorModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { ContactsView } from './components/ContactsView';
import { CallModal } from './components/CallModal';
import { NoRoleAccountModal } from './components/NoRoleAccountModal';
import { CreateRoleModal } from './components/CreateRoleModal';
import { CheckCircle2, ShieldCheck, Phone, PhoneOff } from 'lucide-react';

export default function App() {
  // Ensure store is seeded once without demo users
  useEffect(() => {
    initializeStore();
  }, []);

  const [theme, setTheme] = useState<Theme>(() => ThemeStore.init());

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    initializeStore();
    return AuthStore.getCurrentUser();
  });

  const [language, setLanguage] = useState<Language>('bn');

  // Separate viewDistrict (filtering only) from currentUser.district (saved profile)
  // Initial state comes from the logged-in user's saved profile district (defaulting to 'Bogura')
  const [viewDistrict, setViewDistrict] = useState<string>(() => {
    initializeStore();
    const user = AuthStore.getCurrentUser();
    return user?.district || 'Bogura';
  });

  // When currentUser changes (e.g. login, switch role), sync the filter to their profile district
  useEffect(() => {
    if (currentUser?.district) {
      setViewDistrict(currentUser.district);
    }
  }, [currentUser?.id, currentUser?.district]);

  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  // Auth Modal State (When guest clicks Sign In / Register)
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authRole, setAuthRole] = useState<'farmer' | 'wholesaler' | 'retailer' | 'consumer'>('farmer');

  const handleOpenAuth = (mode: 'login' | 'register' = 'login', role?: 'farmer' | 'wholesaler' | 'retailer' | 'consumer') => {
    setAuthMode(mode);
    if (role) setAuthRole(role);
    setIsAuthOpen(true);
  };

  // Cart state
  const [cart, setCart] = useState<CartItem[]>(() => CartStore.get());

  // Products & Matches
  const [supplierProducts] = useState<SupplierProduct[]>(() => SupplierStore.getAll());
  const [customerProducts] = useState<CustomerProduct[]>(() => CustomerProductStore.getAll());
  const [agroAdvisories] = useState<AgroAdvisory[]>(() => AdvisoryStore.getAll());
  const [aiMatches] = useState<AIMatchItem[]>(() => MatchStore.getAll());

  // Modals
  const [isCropDoctorOpen, setIsCropDoctorOpen] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Individual user profile page navigation
  const [viewedUser, setViewedUser] = useState<User | null>(null);

  // Contact & Calling state
  const [callingUser, setCallingUser] = useState<User | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ caller: User; callNotifId?: string } | null>(null);
  const [initialChatUserId, setInitialChatUserId] = useState<string | null>(null);

  const handleStartCall = (target: User) => {
    if (!currentUser) return;
    const notifId = CallStore.startCall(currentUser, target);
    apiService.sendCallSignal({
      toUserId: target.id,
      fromUserId: currentUser.id,
      fromUserName: currentUser.name,
      fromUserRole: currentUser.role,
      type: 'call_offer',
    }).catch(() => {});
    setCallingUser(target);
  };

  // Real-time incoming call listener
  useEffect(() => {
    if (!currentUser) return;

    const handleIncomingCallEvent = (e: any) => {
      const { caller, receiver, callNotifId } = e.detail || {};
      if (receiver?.id === currentUser.id && caller) {
        setIncomingCall({ caller, callNotifId });
      }
    };

    window.addEventListener('nb_call_incoming', handleIncomingCallEvent);

    let es: EventSource | null = null;
    try {
      const envUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_API_URL;
      const isStaticHost = typeof window !== 'undefined' && (window.location.hostname.includes('github.io') || window.location.hostname.includes('netlify') || window.location.hostname.includes('vercel'));
      const baseUrl = envUrl ? envUrl.replace(/\/api\/?$/, '') : (typeof window !== 'undefined' && !isStaticHost ? `${window.location.protocol}//${window.location.hostname}:3000` : '');
      if (baseUrl) {
        es = new EventSource(`${baseUrl}/api/realtime?userId=` + encodeURIComponent(currentUser.id));
      es.addEventListener('call_signal', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'call_offer') {
            const allUsers = AuthStore.getUsers();
            const caller = allUsers.find((u) => u.id === data.fromUserId) || ({
              id: data.fromUserId,
              name: data.fromUserName || 'Caller',
              role: data.fromUserRole || 'farmer',
              phone: '',
              district: '',
              verified: true,
              createdAt: new Date().toISOString(),
            } as User);

            const notifs = NotificationStore.getByUser(currentUser.id);
            const existing = notifs.find((n) => n.actionUrl && n.actionUrl.includes(caller.id));
            let callNotifId = existing ? existing.id : undefined;
            if (!existing) {
              callNotifId = 'call-notif-' + Date.now();
              NotificationStore.add({
                id: callNotifId,
                userId: currentUser.id,
                title: language === 'bn' ? '📞 ইনকামিং কল' : '📞 Incoming Call',
                message: language === 'bn'
                  ? caller.name + ' আপনাকে কল করছেন... গ্রহণ করতে ক্লিক করুন।'
                  : caller.name + ' is calling you... Click to accept.',
                type: 'warning',
                read: false,
                createdAt: new Date().toISOString(),
                actionUrl: '/contacts?tab=calls&action=attend&callerId=' + caller.id + '&callNotifId=' + callNotifId,
              });
            }
            setIncomingCall({ caller, callNotifId });
          } else if (data.type === 'call_end' || data.type === 'call_reject') {
            setIncomingCall(null);
            window.dispatchEvent(new CustomEvent('nb_call_ended', { detail: data }));
            if (callingUser && callingUser.id === data.fromUserId) {
              setCallingUser(null);
            }
          }
        } catch {}
      });
      }
    } catch {}

    return () => {
      window.removeEventListener('nb_call_incoming', handleIncomingCallEvent);
      if (es) es.close();
    };
  }, [currentUser?.id, callingUser?.id, language]);

  // Multi-role account modals (restricted to 4 public roles)
  const [noRoleModalOpen, setNoRoleModalOpen] = useState(false);
  const [createRoleModalOpen, setCreateRoleModalOpen] = useState(false);
  const [roleToCreate, setRoleToCreate] = useState<UserRole | null>(null);

  // Role-switch password gate
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [roleSwitchPwd, setRoleSwitchPwd] = useState('');
  const [roleSwitchError, setRoleSwitchError] = useState('');

  // Admin verification modal for role switcher
  const [isAdminVerifyOpen, setIsAdminVerifyOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Normalized canonical role
  const canonicalRole = currentUser ? normalizeRole(currentUser.role) : 'consumer';

  // Role switching — only allows the 4 public roles or admin
  const switchRole = (newRole: UserRole) => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }

    const normNewRole = normalizeRole(newRole);
    if (normNewRole === canonicalRole) return;

    if (normNewRole === 'admin') {
      setIsAdminVerifyOpen(true);
      return;
    }

    const identifier = currentUser.email || currentUser.phone || '';
    const hasAccount = AuthStore.hasRoleAccount(identifier, normNewRole);

    if (!hasAccount) {
      setPendingRole(normNewRole);
      setNoRoleModalOpen(true);
      return;
    }

    setPendingRole(normNewRole);
    setRoleSwitchPwd('');
    setRoleSwitchError('');
  };

  const confirmRoleSwitch = () => {
    if (!pendingRole || !currentUser) return;
    const identifier = currentUser.email || currentUser.phone || '';
    const targetUser = AuthStore.getRoleAccount(identifier, pendingRole);

    if (!targetUser) {
      setRoleSwitchError(
        language === 'bn'
          ? 'এই ভূমিকার আপনার কোনো অ্যাকাউন্ট নেই।'
          : 'You do not have an account for this role.'
      );
      return;
    }

    const result = AuthStore.login(targetUser.email || targetUser.phone, roleSwitchPwd, undefined, pendingRole);
    if (!result.success || !result.user) {
      setRoleSwitchError(
        result.locked
          ? language === 'bn' ? 'অ্যাকাউন্ট সাময়িকভাবে লক হয়েছে।' : 'Account temporarily locked.'
          : language === 'bn' ? 'পাসওয়ার্ড ভুল। আবার চেষ্টা করুন।' : 'Incorrect password. Try again.'
      );
      return;
    }

    const safeUser: User = {
      ...result.user,
      password: '***',
      sessionToken: `nb_sec_${Date.now()}_switch`,
      sessionExpiresAt: new Date(Date.now() + 43200000).toISOString(),
    };
    setCurrentUser(safeUser);
    localStorage.setItem('nb_current_user', JSON.stringify(safeUser));
    setPendingRole(null);
    setRoleSwitchPwd('');
    setRoleSwitchError('');
    setViewedUser(null);
    setActiveView('dashboard');
    showToast(
      language === 'bn'
        ? `ভূমিকা পরিবর্তন সফল: ${safeUser.name} (${pendingRole})`
        : `Switched to: ${safeUser.name} (${pendingRole.toUpperCase()})`
    );
  };

  const handleAdminVerifySuccess = (adminUser: User) => {
    const safeAdmin: User = {
      ...adminUser,
      password: '***',
      sessionToken: `nb_sec_${Date.now()}_admin`,
      sessionExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    setCurrentUser(safeAdmin);
    localStorage.setItem('nb_current_user', JSON.stringify(safeAdmin));
    setActiveView('dashboard');
    setIsAdminVerifyOpen(false);
    showToast(
      language === 'bn'
        ? 'অ্যাডমিন যাচাই সফল! রুট অ্যাক্সেস সক্রিয়।'
        : 'Admin verified! Root access granted.'
    );
  };

  const handleLogout = () => {
    AuthStore.logout();
    setCurrentUser(null);
    setIsAuthOpen(true);
    setActiveView('dashboard');
    showToast(
      language === 'bn' ? 'লগআউট সম্পন্ন হয়েছে।' : 'Signed out successfully.'
    );
  };

  useEffect(() => {
    const handleLogoutEvent = () => {
      handleLogout();
    };
    window.addEventListener('nb_logout', handleLogoutEvent);
    return () => window.removeEventListener('nb_logout', handleLogoutEvent);
  }, []);

  // If Auth modal is triggered by user clicking "Sign In / Register"
  if (isAuthOpen) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col">
        <AuthPage
          language={language}
          initialMode={authMode}
          initialRole={authRole}
          onLanguageToggle={() => setLanguage((prev) => (prev === 'bn' ? 'en' : 'bn'))}
          onBack={() => setIsAuthOpen(false)}
          onAuthSuccess={(user) => {
            // Persist to store and local storage, then navigate to dashboard
            const safeUser: User = {
              ...user,
              password: '***',
              sessionToken: user.sessionToken || `nb_sec_${Date.now()}`,
              sessionExpiresAt: user.sessionExpiresAt || new Date(Date.now() + 43200000).toISOString(),
            };
            AuthStore.setCurrentUser(safeUser);
            localStorage.setItem('nb_current_user', JSON.stringify(safeUser));
            setCurrentUser(safeUser);
            setIsAuthOpen(false);
            setActiveView('dashboard');
            showToast(
              language === 'bn'
                ? `স্বাগতম, ${safeUser.name || 'ব্যবহারকারী'}! আপনি সফলভাবে প্রবেশ করেছেন।`
                : `Welcome, ${safeUser.name || 'User'}! Signed in successfully.`
            );
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans transition-colors">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold border border-stone-700 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Global Header */}
      <Header
        currentUser={currentUser}
        language={language}
        onLanguageToggle={() => setLanguage((prev) => (prev === 'bn' ? 'en' : 'bn'))}
        selectedDistrict={viewDistrict}
        onDistrictChange={setViewDistrict}
        onOpenCropDoctor={() => setIsCropDoctorOpen(true)}
        onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
        activeView={activeView}
        onViewChange={(v) => {
          if (v === 'profile') {
            setViewedUser(currentUser);
          } else {
            setViewedUser(null);
            setActiveView(v);
          }
        }}
        cartCount={cart.reduce((acc, c) => acc + c.quantityKg, 0)}
        onLogout={handleLogout}
        onCallUser={handleStartCall}
        onOpenProfile={() => setViewedUser(currentUser)}
        onOpenAuth={() => handleOpenAuth('login')}
        theme={theme}
        onThemeToggle={() => setTheme(ThemeStore.toggle())}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* Individual User Profile Page */}
        {viewedUser ? (
          <UserProfilePage
            user={viewedUser}
            currentUser={currentUser}
            language={language}
            onBack={() => setViewedUser(null)}
            onUpdateUser={(updated) => {
              setCurrentUser(updated);
              setViewedUser(updated);
              showToast(
                language === 'bn'
                  ? 'প্রোফাইলের তথ্য সফলভাবে হালনাগাদ করা হয়েছে!'
                  : 'Profile updated successfully!'
              );
            }}
            onViewUser={(u) => setViewedUser(u)}
            onMessageUser={(u) => {
              setInitialChatUserId(u.id);
              setViewedUser(null);
              setActiveView('contacts');
            }}
            onCallUser={handleStartCall}
          />
        ) : (
          <>
            {activeView === 'contacts' && currentUser && (
              <ContactsView
                currentUser={currentUser}
                language={language}
                onViewUser={(u) => setViewedUser(u)}
                onInitiateCall={handleStartCall}
                initialChatUserId={initialChatUserId}
              />
            )}

            {activeView === 'market_rates' && (
              <MarketRatesView
                rates={INITIAL_MARKET_RATES}
                language={language}
                selectedDistrict={viewDistrict}
                onDistrictChange={setViewDistrict}
              />
            )}

            {activeView === 'orders' && (
              <OrdersView currentUser={currentUser} language={language} />
            )}

            {/* Default Dashboard / Marketplace View */}
            {activeView === 'dashboard' && (
              <>
                {/* 1. Unauthenticated Visitor -> Public Landing Page */}
                {!currentUser && (
                  <LandingPage
                    language={language}
                    onOpenAuth={handleOpenAuth}
                  />
                )}

                {/* 2. Consumer Role -> Verified Consumer Produce Hub */}
                {currentUser && canonicalRole === 'consumer' && (
                  <CustomerMarketplace
                    language={language}
                    currentUser={currentUser}
                    onOpenAuth={() => handleOpenAuth('login')}
                  />
                )}

                {/* 2. Farmer Role -> Farmer Command Center & Intelligence */}
                {currentUser && canonicalRole === 'farmer' && (
                  <FarmerDashboard
                    currentUser={currentUser}
                    suppliers={supplierProducts}
                    language={language}
                    onOpenCropDoctor={() => setIsCropDoctorOpen(true)}
                    onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
                  />
                )}

                {/* 3. Wholesaler Role -> Wholesaler Procurement & Wholesale Hub */}
                {currentUser && canonicalRole === 'wholesaler' && (
                  <WholesalerDashboard currentUser={currentUser} language={language} />
                )}

                {/* 4. Retailer Role -> Retailer Store & Consumer Fulfillment */}
                {currentUser && canonicalRole === 'retailer' && (
                  <RetailerDashboard currentUser={currentUser} language={language} />
                )}

                {/* 5. Restricted Administrator Access */}
                {currentUser && canonicalRole === 'admin' && (
                  <AdminDashboard matches={aiMatches} language={language} currentUser={currentUser} />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Profile Modal */}
      {!viewedUser && currentUser && (
        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentUser={currentUser}
          onUpdateUser={(updated) => {
            setCurrentUser(updated);
            showToast(
              language === 'bn'
                ? 'প্রোফাইলের তথ্য সফলভাবে হালনাগাদ করা হয়েছে!'
                : 'Profile updated successfully!'
            );
          }}
          language={language}
        />
      )}

      {/* AI Crop Doctor Modal */}
      <CropDoctorModal
        isOpen={isCropDoctorOpen}
        onClose={() => setIsCropDoctorOpen(false)}
        language={language}
        currentUser={currentUser}
        onSwitchUser={() => {}}
        onMessageExpert={(expert) => {
          setIsCropDoctorOpen(false);
          setInitialChatUserId(expert.id);
          setViewedUser(null);
          setActiveView('contacts');
        }}
        onCallExpert={(expert) => {
          setIsCropDoctorOpen(false);
          handleStartCall(expert);
        }}
      />

      {/* Bangla Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceAssistantOpen}
        onClose={() => setIsVoiceAssistantOpen(false)}
        language={language}
        currentRole={canonicalRole}
        selectedDistrict={viewDistrict}
        onNavigate={(view) => setActiveView(view)}
        onOpenCropDoctor={() => setIsCropDoctorOpen(true)}
        onSwitchRole={switchRole}
        onToggleLanguage={() => setLanguage((prev) => (prev === 'bn' ? 'en' : 'bn'))}
      />

      {/* Role Switch Password Gate */}
      {pendingRole && !noRoleModalOpen && !createRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-sm p-6 space-y-5 animate-slide-down">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h2 className="font-extrabold text-stone-900 text-base leading-tight">
                  {language === 'bn' ? 'ভূমিকা পরিবর্তনের যাচাই' : 'Role Switch Verification'}
                </h2>
                <p className="text-[11px] text-stone-500 mt-0.5">
                  {language === 'bn'
                    ? `"${pendingRole}" অ্যাকাউন্টের পাসওয়ার্ড দিন`
                    : `Enter password for "${pendingRole}" account`}
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium">
              {language === 'bn'
                ? 'নিরাপত্তার জন্য প্রতিটি ভূমিকা পরিবর্তনে পাসওয়ার্ড যাচাই বাধ্যতামূলক।'
                : 'Password verification is required before switching to another account role.'}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-500 uppercase mb-1.5">
                {language === 'bn' ? 'পাসওয়ার্ড' : 'Password'}
              </label>
              <input
                type="password"
                value={roleSwitchPwd}
                onChange={(e) => {
                  setRoleSwitchPwd(e.target.value);
                  setRoleSwitchError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && confirmRoleSwitch()}
                placeholder={language === 'bn' ? 'পাসওয়ার্ড লিখুন…' : 'Enter password…'}
                autoFocus
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl bg-white text-stone-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-400"
              />
              {roleSwitchError && (
                <p className="text-red-600 text-[11px] font-bold mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {roleSwitchError}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={confirmRoleSwitch}
                className="flex-1 bg-stone-900 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-stone-800 transition-all cursor-pointer"
              >
                {language === 'bn' ? 'যাচাই করুন' : 'Verify & Switch'}
              </button>
              <button
                onClick={() => {
                  setPendingRole(null);
                  setRoleSwitchPwd('');
                  setRoleSwitchError('');
                }}
                className="px-4 py-2.5 bg-stone-100 text-stone-700 rounded-xl text-sm font-bold hover:bg-stone-200 cursor-pointer"
              >
                {language === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Email+Password Verification Modal */}
      <AdminVerificationModal
        isOpen={isAdminVerifyOpen}
        onClose={() => setIsAdminVerifyOpen(false)}
        onSuccess={handleAdminVerifySuccess}
        language={language}
      />

      {/* Real-time Incoming Call Floating Alert Banner */}
      {incomingCall && currentUser && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-stone-900/95 text-white p-4 rounded-2xl shadow-2xl border-2 border-emerald-500/80 backdrop-blur-md animate-bounce-once">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white font-extrabold text-base shadow-md">
                {incomingCall.caller.name.charAt(0)}
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                  {language === 'bn' ? 'ইনকামিং এগ্রি-কল' : 'INCOMING CALL'}
                </p>
              </div>
              <h4 className="font-extrabold text-sm truncate text-white mt-0.5">
                {incomingCall.caller.name}
              </h4>
              <p className="text-[11px] text-stone-300">
                {incomingCall.caller.role} {incomingCall.caller.district ? '• ' + incomingCall.caller.district : ''}
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-stone-800">
            <button
              onClick={() => {
                if (incomingCall.callNotifId) {
                  NotificationStore.dismiss(incomingCall.callNotifId);
                }
                const caller = incomingCall.caller;
                setIncomingCall(null);
                setCallingUser(caller);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Phone className="w-3.5 h-3.5 animate-bounce" />
              <span>{language === 'bn' ? 'গ্রহণ করুন' : 'Accept'}</span>
            </button>
            <button
              onClick={() => {
                if (incomingCall.callNotifId) {
                  NotificationStore.dismiss(incomingCall.callNotifId);
                }
                apiService.sendCallSignal({
                  toUserId: incomingCall.caller.id,
                  fromUserId: currentUser.id,
                  fromUserName: currentUser.name,
                  fromUserRole: currentUser.role,
                  type: 'call_reject',
                }).catch(() => {});
                setIncomingCall(null);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-red-600/90 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'বাতিল' : 'Decline'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Interactive VoIP Voice Call Modal */}
      {callingUser && currentUser && (
        <CallModal
          isOpen={!!callingUser}
          onClose={() => setCallingUser(null)}
          currentUser={currentUser}
          contactUser={callingUser}
          language={language}
        />
      )}

      {/* No Role Account Modal */}
      {noRoleModalOpen && currentUser && (
        <NoRoleAccountModal
          isOpen={noRoleModalOpen}
          onClose={() => {
            setNoRoleModalOpen(false);
            setPendingRole(null);
          }}
          targetRole={pendingRole}
          currentUser={currentUser}
          language={language}
          onCreateRoleAccount={(role) => {
            setNoRoleModalOpen(false);
            setRoleToCreate(role);
            setCreateRoleModalOpen(true);
          }}
          onLoginDifferentAccount={() => {
            setNoRoleModalOpen(false);
            setPendingRole(null);
            handleLogout();
          }}
        />
      )}

      {/* Create Role Modal */}
      {createRoleModalOpen && currentUser && (
        <CreateRoleModal
          isOpen={createRoleModalOpen}
          onClose={() => {
            setCreateRoleModalOpen(false);
            setRoleToCreate(null);
            setPendingRole(null);
          }}
          targetRole={roleToCreate}
          currentUser={currentUser}
          language={language}
          onSuccess={(newRoleUser) => {
            setCurrentUser(newRoleUser);
            setPendingRole(null);
            setRoleToCreate(null);
            setActiveView('dashboard');
            showToast(
              language === 'bn'
                ? `নতুন ${newRoleUser.role} অ্যাকাউন্ট তৈরি ও সক্রিয় করা হয়েছে!`
                : `New ${newRoleUser.role} account created and activated!`
            );
          }}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-12 py-6 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-800">{language === 'bn' ? 'আমার হাট (Amar Haat)' : 'Amar Haat (আমার হাট)'}</span>
            <span>•</span>
            <span>{language === 'bn' ? 'স্থানীয় কৃষি, ব্যবসা ও সরবরাহ চেইন প্ল্যাটফর্ম' : 'Local Agriculture, Business & Supply Chain Platform'}</span>
          </div>

          <div className="text-center sm:text-right">
            <span>
              {language === 'bn'
                ? `বাংলাদেশ কৃষি প্ল্যাটফর্ম • ${toBanglaDistrict(currentUser?.district || viewDistrict || 'Bogura')} নোড • কৃষি বিপণন অধিদপ্তর (DAM)`
                : `Bangladesh Agricultural Platform • ${currentUser?.district || viewDistrict || 'Bogura'} Node • Department of Agricultural Marketing (DAM)`}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
