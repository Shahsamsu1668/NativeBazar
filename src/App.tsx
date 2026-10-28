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
} from './data/store';

import { Header } from './components/Header';
import { AuthPage } from './components/AuthPage';
import { AdminVerificationModal } from './components/AdminVerificationModal';
import { FarmerDashboard } from './components/FarmerDashboard';
import { WholesalerDashboard } from './components/WholesalerDashboard';
import { RetailerDashboard } from './components/RetailerDashboard';
import { CustomerMarketplace } from './components/CustomerMarketplace';
import { AdminDashboard } from './components/AdminDashboard';
import { MarketRatesView } from './components/MarketRatesView';
import { WeatherView } from './components/WeatherView';
import { OrdersView } from './components/OrdersView';
import { ProfileModal } from './components/ProfileModal';
import { UserProfilePage } from './components/UserProfilePage';
import { CropDoctorModal } from './components/CropDoctorModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
import { ContactsView } from './components/ContactsView';
import { CallModal } from './components/CallModal';
import { NoRoleAccountModal } from './components/NoRoleAccountModal';
import { CreateRoleModal } from './components/CreateRoleModal';
import { BulletinsPage } from './components/BulletinsPage';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

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
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Bogura');
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');

  // Auth Modal State (When guest clicks Sign In / Register)
  const [isAuthOpen, setIsAuthOpen] = useState(false);

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
  const [initialChatUserId, setInitialChatUserId] = useState<string | null>(null);

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

  // If Auth modal is triggered by user clicking "Sign In / Register"
  if (isAuthOpen) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col">
        <AuthPage
          language={language}
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
        selectedDistrict={selectedDistrict}
        onDistrictChange={setSelectedDistrict}
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
        onLogout={() => {
          AuthStore.logout();
          setCurrentUser(null);
          setActiveView('dashboard');
          showToast(
            language === 'bn' ? 'লগআউট সম্পন্ন হয়েছে।' : 'Signed out successfully.'
          );
        }}
        onOpenProfile={() => setViewedUser(currentUser)}
        onOpenAuth={() => setIsAuthOpen(true)}
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
            onCallUser={(u) => setCallingUser(u)}
          />
        ) : (
          <>
            {activeView === 'contacts' && currentUser && (
              <ContactsView
                currentUser={currentUser}
                language={language}
                onViewUser={(u) => setViewedUser(u)}
                onInitiateCall={(c) => setCallingUser(c)}
                initialChatUserId={initialChatUserId}
              />
            )}

            {activeView === 'market_rates' && (
              <MarketRatesView
                rates={INITIAL_MARKET_RATES}
                language={language}
                selectedDistrict={selectedDistrict}
                onDistrictChange={setSelectedDistrict}
              />
            )}

            {activeView === 'weather' && (
              <WeatherView district={selectedDistrict} language={language} />
            )}

            {activeView === 'orders' && (
              <OrdersView currentUser={currentUser} language={language} />
            )}

            {activeView === 'bulletins' && (
              <BulletinsPage language={language} selectedDistrict={selectedDistrict} />
            )}

            {activeView === 'ledger' && currentUser && canonicalRole === 'farmer' && (
              <FarmerDashboard
                currentUser={currentUser}
                suppliers={supplierProducts}
                language={language}
                onOpenCropDoctor={() => setIsCropDoctorOpen(true)}
                onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
              />
            )}

            {/* Default Dashboard / Marketplace View */}
            {activeView === 'dashboard' && (
              <>
                {/* 1. Guest or Consumer -> Instant Social-Feed Marketplace with zero login */}
                {(!currentUser || canonicalRole === 'consumer') && (
                  <CustomerMarketplace
                    language={language}
                    currentUser={currentUser}
                    onOpenAuth={() => setIsAuthOpen(true)}
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
                  <AdminDashboard matches={aiMatches} language={language} />
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
          setCallingUser(expert);
        }}
      />

      {/* Bangla Voice Assistant Modal */}
      <VoiceAssistantModal
        isOpen={isVoiceAssistantOpen}
        onClose={() => setIsVoiceAssistantOpen(false)}
        language={language}
        currentRole={canonicalRole}
        selectedDistrict={selectedDistrict}
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
                className="flex-1 bg-stone-900 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-stone-800 transition-all"
              >
                {language === 'bn' ? 'যাচাই করুন' : 'Verify & Switch'}
              </button>
              <button
                onClick={() => {
                  setPendingRole(null);
                  setRoleSwitchPwd('');
                  setRoleSwitchError('');
                }}
                className="px-4 py-2.5 bg-stone-100 text-stone-700 rounded-xl text-sm font-bold hover:bg-stone-200"
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
            AuthStore.logout();
            setCurrentUser(null);
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
            <span className="font-bold text-stone-800">NativeBazar (নেটিভবাজার)</span>
            <span>•</span>
            <span>Local Agriculture, Business & Supply Chain Platform</span>
          </div>

          <div className="text-center sm:text-right">
            <span>Bangladesh Agricultural Platform • Bogura Pilot Node • Department of Agricultural Marketing (DAM)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
