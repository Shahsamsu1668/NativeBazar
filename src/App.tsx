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
} from './types';
import { INITIAL_MARKET_RATES, INITIAL_USERS } from './data/mockData';
import {
  initializeStore,
  AuthStore,
  OrderStore,
  CartStore,
  SupplierStore,
  CustomerProductStore,
  AdvisoryStore,
  MatchStore,
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
import { ProjectBlueprintLab } from './components/ProjectBlueprintLab';
import { CropDoctorModal } from './components/CropDoctorModal';
import { VoiceAssistantModal } from './components/VoiceAssistantModal';
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

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    initializeStore();
    return AuthStore.getCurrentUser() || INITIAL_USERS[0];
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

  // Admin verification modal for role switcher
  const [isAdminVerifyOpen, setIsAdminVerifyOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const currentRole = currentUser?.role || 'farmer';

  // Role switching utility — Admin requires email+password verification
  const switchRole = (newRole: UserRole) => {
    if (newRole === 'admin' && currentUser?.role !== 'admin') {
      setIsAdminVerifyOpen(true);
      return;
    }

    const demoUser = INITIAL_USERS.find((u) => u.role === newRole) || {
      id: `usr-${newRole}`,
      role: newRole,
      name: `Demo ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}`,
      phone: '01700000000',
      password: '***',
      district: selectedDistrict,
      verified: true,
      createdAt: new Date().toISOString(),
    };
    const safeUser: User = {
      ...demoUser,
      password: '***',
      sessionToken: `nb_sec_${Date.now()}_switch`,
      sessionExpiresAt: new Date(Date.now() + 43200000).toISOString(),
    };
    setCurrentUser(safeUser);
    localStorage.setItem('nb_current_user', JSON.stringify(safeUser));
    const roleLabelBn: Record<UserRole, string> = {
      farmer: 'কৃষক', businessman: 'ব্যবসায়ী', supplier: 'সরবরাহকারী',
      customer: 'ভোক্তা', expert: 'কৃষি বিশেষজ্ঞ', admin: 'অ্যাডমিন',
    };
    showToast(
      language === 'bn'
        ? `ভূমিকা পরিবর্তন: ${roleLabelBn[newRole]}`
        : `Switched to: ${newRole.toUpperCase()}`
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
      expertName: newAdvisory.expertName || currentUser?.name || 'Dr. Mohammad Akramuzzaman',
      designation: newAdvisory.designation || 'Scientific Officer, BARI',
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
    showToast(
      language === 'bn'
        ? 'কৃষি সতর্কতা সফলভাবে বগুড়া অঞ্চলের কৃষকদের ফোনে পাঠানো হয়েছে!'
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
    { role: 'admin', icon: <ShieldCheck className="w-3.5 h-3.5" />, labelEn: 'Admin', labelBn: 'অ্যাডমিন', color: 'hover:bg-slate-50 text-slate-700' },
  ];

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans">
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
          setActiveView(v);
        }}
        cartCount={cart.reduce((acc, c) => acc + c.quantityKg, 0)}
        onLogout={() => {
          AuthStore.logout();
          setCurrentUser(null);
        }}
      />

      {/* Quick Role Switcher Bar (Essential for Campus365 evaluation of all 6 roles) */}
      <div className="bg-white border-b border-stone-200 px-4 py-1.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-500 whitespace-nowrap">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>{language === 'bn' ? '৬টি ভূমিকা তাৎক্ষণিক পরিবর্তন:' : 'Switch 6 Roles:'}</span>
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
        {activeView === 'blueprint' && (
          <ProjectBlueprintLab
            language={language}
            onSelectRole={(role) => {
              switchRole(role);
              setActiveView('dashboard');
            }}
          />
        )}

        {activeView === 'market_rates' && (
          <MarketRatesView rates={INITIAL_MARKET_RATES} language={language} />
        )}

        {activeView === 'weather' && (
          <WeatherView district={selectedDistrict} language={language} />
        )}

        {activeView === 'orders' && (
          <OrdersView currentUser={currentUser} language={language} />
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
              />
            )}

            {currentRole === 'admin' && (
              <AdminDashboard matches={aiMatches} language={language} />
            )}
          </>
        )}
      </main>

      {/* AI Crop Doctor Modal */}
      <CropDoctorModal
        isOpen={isCropDoctorOpen}
        onClose={() => setIsCropDoctorOpen(false)}
        language={language}
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

      {/* Admin Email+Password Verification Modal */}
      <AdminVerificationModal
        isOpen={isAdminVerifyOpen}
        onClose={() => setIsAdminVerifyOpen(false)}
        onSuccess={handleAdminVerifySuccess}
        language={language}
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
            <span>
              <strong>Campus365 Internship Team:</strong> Md. Shahriar Shakib (2048) • Jubayer
              Bishwas Shadhin (2055) • Sumayya Islam (2080)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
