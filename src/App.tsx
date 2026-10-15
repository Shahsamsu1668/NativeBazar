import React, { useState, useEffect } from 'react';
import {
  UserRole,
  Language,
  User,
  ActiveView,
  SupplierProduct,
  CustomerProduct,
  CartItem,
  CustomerOrder,
  AgroAdvisory,
  AIMatchItem,
  Theme,
} from './types';
import { INITIAL_MARKET_RATES } from './data/mockData';
import {
  initializeStore,
  AuthStore,
  OrderStore,
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
import { BusinessmanDashboard } from './components/BusinessmanDashboard';
import { SupplierDashboard } from './components/SupplierDashboard';
import { CustomerMarketplace } from './components/CustomerMarketplace';
import { ExpertDashboard } from './components/ExpertDashboard';
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
import {
  CheckCircle2,
  Sprout,
  Briefcase,
  Store,
  ShoppingCart,
  Microscope,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function App() {
  // Ensure store is seeded once
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

  // Cart state persisted to CartStore
  const [cart, setCart] = useState<CartItem[]>(() => CartStore.get());

  // Supplier & Customer products & Advisories & Matches
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>(() =>
    SupplierStore.getAll()
  );
  const [customerProducts, setCustomerProducts] = useState<CustomerProduct[]>(() =>
    CustomerProductStore.getAll()
  );
  const [agroAdvisories, setAgroAdvisories] = useState<AgroAdvisory[]>(() =>
    AdvisoryStore.getAll()
  );
  const [aiMatches, setAiMatches] = useState<AIMatchItem[]>(() => MatchStore.getAll());

  // Modals
  const [isCropDoctorOpen, setIsCropDoctorOpen] = useState(false);
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Individual user profile page navigation
  const [viewedUser, setViewedUser] = useState<import('./types').User | null>(null);

  // Contact & Calling state
  const [callingUser, setCallingUser] = useState<User | null>(null);
  const [initialChatUserId, setInitialChatUserId] = useState<string | null>(null);

  // Multi-role account modals
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

  const currentRole = currentUser?.role || 'farmer';

  // Role switching — checks if current user has an account for that role
  const switchRole = (newRole: UserRole) => {
    if (newRole === currentUser?.role) return; // already on this role

    const identifier = currentUser?.email || currentUser?.phone || '';
    const hasAccount = AuthStore.hasRoleAccount(identifier, newRole);

    if (!hasAccount) {
      // User doesn't have an account of this role: show NoRoleAccountModal!
      setPendingRole(newRole);
      setNoRoleModalOpen(true);
      return;
    }

    if (newRole === 'admin') {
      return;
    }

    // User DOES have an account for this role: open password gate for that specific account!
    setPendingRole(newRole);
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
          ? language === 'bn' ? 'অ্যাকাউন্ট সাময়িকভাবে লক হয়েছে। পরে চেষ্টা করুন।' : 'Account temporarily locked. Try again later.'
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
    NotificationStore.addSystemNotif(
      safeUser.id,
      language === 'bn' ? 'ভূমিকা পরিবর্তন সফল' : 'Role Switched',
      language === 'bn'
        ? `আপনি সফলভাবে ${safeUser.name} (${pendingRole}) হিসেবে লগইন করেছেন।`
        : `Logged in as ${safeUser.name} (${pendingRole}).`
    );
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
    showToast(
      language === 'bn'
        ? 'অ্যাডমিন যাচাই সফল! রুট এক্সেস সক্রিয়।'
        : 'Admin verified! Root access granted.'
    );
  };

  // Supplier Actions
  const handleAddSupplierProduct = (newProduct: Partial<SupplierProduct>) => {
    const created: SupplierProduct = {
      id: `sup-${Date.now()}`,
      supplierName: newProduct.supplierName || 'Meghna Fertilizer Depot',
      shopName: newProduct.shopName || 'যমুনা ও মেঘনা সার বিতান',
      category: newProduct.category || 'Fertilizer',
      name: newProduct.name || 'Agro Input',
      banglaName: newProduct.banglaName || 'কৃষি উপকরণ',
      brand: newProduct.brand || 'BCIC',
      unitPriceBDT: newProduct.unitPriceBDT || 100,
      unit: newProduct.unit || 'unit',
      inStock: true,
      distanceKm: 2.8,
      rating: 4.8,
      phone: '+880 1715-889900',
      suitableCrops: ['All crops'],
    };
    SupplierStore.add(created);
    setSupplierProducts(SupplierStore.getAll());
    showToast(
      language === 'bn'
        ? 'উপকরণ ক্যাটালগে নতুন পণ্য যুক্ত হয়েছে!'
        : 'Product SKU added to supplier inventory!'
    );
  };

  // Customer Marketplace Actions
  const handleAddToCart = (product: CustomerProduct) => {
    CartStore.addOrUpdate(product, 1);
    setCart(CartStore.get());
    showToast(
      language === 'bn'
        ? `${product.banglaName} ঝুড়িতে যুক্ত করা হয়েছে!`
        : `${product.cropName} added to basket!`
    );
  };

  const handleUpdateCartQty = (productId: string, delta: number) => {
    const prod = customerProducts.find((p) => p.id === productId);
    if (prod) {
      CartStore.addOrUpdate(prod, delta);
      setCart(CartStore.get());
    }
  };

  const handleRemoveFromCart = (productId: string) => {
    CartStore.remove(productId);
    setCart(CartStore.get());
  };

  const handleCheckout = (orderData: Partial<CustomerOrder>) => {
    const created: CustomerOrder = {
      id: `ORD-${Date.now().toString().slice(-6)}`,
      customerName: orderData.customerName || currentUser?.name || 'Customer',
      phone: orderData.phone || currentUser?.phone || '',
      items: orderData.items || cart,
      totalBDT: orderData.totalBDT || CartStore.total(),
      paymentMethod: orderData.paymentMethod || 'bKash',
      deliveryAddress: orderData.deliveryAddress || `${selectedDistrict} City`,
      status: 'Confirmed',
      orderDate: new Date().toISOString(),
    };
    OrderStore.add(created);
    CartStore.clear();
    setCart([]);
    NotificationStore.addSystemNotif(
      currentUser!.id,
      language === 'bn' ? 'অর্ডার নিশ্চিত' : 'Order Confirmed',
      language === 'bn'
        ? `আপনার অর্ডার ${created.id} সফলভাবে গৃহীত হয়েছে। মোট: ৳${created.totalBDT}।`
        : `Order ${created.id} confirmed. Total: ৳${created.totalBDT}. Delivery in progress.`,
      'success'
    );
    showToast(
      language === 'bn'
        ? 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে! এসক্রো পেমেন্ট প্রক্রিয়াধীন।'
        : 'Order confirmed! Direct farmer dispatch initiated.'
    );
  };

  // Expert Actions
  const handleAddAdvisory = (newAdvisory: Partial<AgroAdvisory>) => {
    const created: AgroAdvisory = {
      id: `adv-${Date.now()}`,
      expertName: newAdvisory.expertName || currentUser?.name || 'Agricultural Specialist',
      designation: newAdvisory.designation || currentUser?.designation || 'Agricultural Specialist',
      title: newAdvisory.title || 'Agro Alert',
      titleBn: newAdvisory.titleBn || 'কৃষি সতর্কতা',
      category: newAdvisory.category || 'Weather Alert',
      message: newAdvisory.message || '',
      messageBn: newAdvisory.messageBn || '',
      severity: newAdvisory.severity || 'Warning',
      district: selectedDistrict,
      date: 'Just now',
    };
    AdvisoryStore.add(created);
    setAgroAdvisories(AdvisoryStore.getAll());
    // Fire real notification
    NotificationStore.addSystemNotif(
      currentUser!.id,
      language === 'bn' ? 'পরামর্শ প্রকাশিত' : 'Advisory Published',
      language === 'bn'
        ? `"নতুন পরামর্শ: ${created.title}" ${selectedDistrict}-এ প্রচার করা হয়েছে।`
        : `Advisory "${created.title}" has been broadcast to ${selectedDistrict} district.`,
      'info'
    );
    showToast(
      language === 'bn'
        ? 'কৃষি সতর্কতা সফলভাবে ফোনে পাঠানো হয়েছে!'
        : 'Advisory bulletin broadcasted across district!'
    );
  };

  // If user is logged out, show the Auth Page
  if (!currentUser) {
    return (
      <AuthPage
        language={language}
        onLanguageToggle={() => setLanguage((prev) => (prev === 'bn' ? 'en' : 'bn'))}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          showToast(
            language === 'bn'
              ? `স্বাগতম, ${user.name}! আপনি সফলভাবে লগইন করেছেন।`
              : `Welcome, ${user.name}! Signed in successfully.`
          );
        }}
      />
    );
  }

  const roleNavButtons: { role: UserRole; icon: React.ReactNode; labelEn: string; labelBn: string; color: string }[] = [
    { role: 'farmer', icon: <Sprout className="w-3.5 h-3.5" />, labelEn: 'Farmer', labelBn: 'কৃষক', color: 'hover:bg-emerald-50 text-emerald-700' },
    { role: 'businessman', icon: <Briefcase className="w-3.5 h-3.5" />, labelEn: 'Businessman', labelBn: 'ব্যবসায়ী', color: 'hover:bg-blue-50 text-blue-700' },
    { role: 'supplier', icon: <Store className="w-3.5 h-3.5" />, labelEn: 'Supplier', labelBn: 'সরবরাহকারী', color: 'hover:bg-amber-50 text-amber-700' },
    { role: 'customer', icon: <ShoppingCart className="w-3.5 h-3.5" />, labelEn: 'Customer', labelBn: 'ভোক্তা', color: 'hover:bg-purple-50 text-purple-700' },
    { role: 'expert', icon: <Microscope className="w-3.5 h-3.5" />, labelEn: 'Agri Expert', labelBn: 'বিশেষজ্ঞ', color: 'hover:bg-teal-50 text-teal-700' },
  ];

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
        }}
        onOpenProfile={() => setViewedUser(currentUser)}
        theme={theme}
        onThemeToggle={() => setTheme(ThemeStore.toggle())}
      />

      {/* Quick Role Switcher Bar */}
      <div className="bg-white border-b border-stone-200 px-4 py-1.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500 whitespace-nowrap">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{language === 'bn' ? '৫টি ভূমিকা তাৎক্ষণিক পরিবর্তন:' : 'Switch 5 Roles:'}</span>
          </div>

          <div className="flex items-center gap-1">
            {roleNavButtons.map((r) => {
              const isSelected = currentRole === r.role;
              return (
                <button
                  key={r.role}
                  onClick={() => {
                    switchRole(r.role);
                    setActiveView('dashboard');
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-stone-900 text-white shadow-xs'
                      : `bg-stone-100 ${r.color} border border-stone-200`
                  }`}
                >
                  {r.icon}
                  <span>{language === 'bn' ? r.labelBn : r.labelEn}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* Individual User Profile Page (takes priority) */}
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
            {activeView === 'contacts' && (
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

            {activeView === 'ledger' && (
              <FarmerDashboard
                currentUser={currentUser}
                suppliers={supplierProducts}
                language={language}
                onOpenCropDoctor={() => setIsCropDoctorOpen(true)}
                onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
              />
            )}

            {activeView === 'dashboard' && (
              <>
                {currentRole === 'farmer' && (
                  <FarmerDashboard
                    currentUser={currentUser}
                    suppliers={supplierProducts}
                    language={language}
                    onOpenCropDoctor={() => setIsCropDoctorOpen(true)}
                    onOpenVoiceAssistant={() => setIsVoiceAssistantOpen(true)}
                  />
                )}

                {currentRole === 'businessman' && (
                  <BusinessmanDashboard currentUser={currentUser} language={language} />
                )}

                {currentRole === 'supplier' && (
                  <SupplierDashboard
                    products={supplierProducts}
                    onAddProduct={handleAddSupplierProduct}
                    language={language}
                  />
                )}

                {currentRole === 'customer' && (
                  <CustomerMarketplace
                    products={customerProducts}
                    cart={cart}
                    onAddToCart={handleAddToCart}
                    onUpdateCartQty={handleUpdateCartQty}
                    onRemoveFromCart={handleRemoveFromCart}
                    onCheckout={handleCheckout}
                    language={language}
                  />
                )}

                {currentRole === 'expert' && (
                  <ExpertDashboard
                    advisories={agroAdvisories}
                    onAddAdvisory={handleAddAdvisory}
                    language={language}
                    currentUser={currentUser}
                  />
                )}

                {currentRole === 'admin' && (
                  <AdminDashboard matches={aiMatches} language={language} />
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Profile Modal (used only when viewedUser is null) */}
      {!viewedUser && (
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
        onSwitchUser={(user) => {
          const safeUser: User = {
            ...user,
            password: '***',
            sessionToken: `nb_sec_${Date.now()}_expert`,
            sessionExpiresAt: new Date(Date.now() + 43200000).toISOString(),
          };
          setCurrentUser(safeUser);
          localStorage.setItem('nb_current_user', JSON.stringify(safeUser));
          showToast(
            language === 'bn'
              ? `স্বাগতম! আপনি ${safeUser.name} (কৃষি বিশেষজ্ঞ) হিসেবে প্রবেশ করেছেন।`
              : `Logged in as ${safeUser.name} (Agricultural Expert).`
          );
        }}
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
        currentRole={currentRole}
        selectedDistrict={selectedDistrict}
        onNavigate={(view) => setActiveView(view)}
        onOpenCropDoctor={() => setIsCropDoctorOpen(true)}
        onSwitchRole={switchRole}
        onToggleLanguage={() => setLanguage((prev) => (prev === 'bn' ? 'en' : 'bn'))}
      />


      {/* Role Switch Password Gate (shown only when the user has an account for target role) */}
      {pendingRole && !noRoleModalOpen && !createRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
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
                    : `Enter the password for the "${pendingRole}" account`}
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
                onChange={(e) => { setRoleSwitchPwd(e.target.value); setRoleSwitchError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && confirmRoleSwitch()}
                placeholder={language === 'bn' ? 'পাসওয়ার্ড লিখুন…' : 'Enter password…'}
                autoFocus
                className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-xl bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all"
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
                onClick={() => { setPendingRole(null); setRoleSwitchPwd(''); setRoleSwitchError(''); }}
                className="px-4 py-2.5 bg-stone-100 text-stone-700 rounded-xl text-sm font-bold hover:bg-stone-200 transition-all"
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
      {callingUser && (
        <CallModal
          isOpen={!!callingUser}
          onClose={() => setCallingUser(null)}
          currentUser={currentUser}
          contactUser={callingUser}
          language={language}
        />
      )}

      {/* No Role Account Modal */}
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

      {/* Create Role Modal */}
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
              ? `নতুন ${newRoleUser.role} অ্যাকাউন্ট সফলভাবে তৈরি ও সক্রিয় করা হয়েছে!`
              : `New ${newRoleUser.role} account created and activated!`
          );
        }}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-12 py-6 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-800">NativeBazar (নেটিভবাজার)</span>
            <span>•</span>
            <span>AI-Powered Local Agriculture, Business & Supply-Demand Platform</span>
          </div>

          <div className="text-center sm:text-right">
            <span>Bangladesh Agricultural Platform • Bogura Pilot Node • Department of Agricultural Marketing (DAM)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
