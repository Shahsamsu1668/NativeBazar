import React, { useState, useEffect } from 'react';
import { MarketplaceProduct, Language, User } from '../types';
import { productApi, orderApi } from '../services/api';
import {
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  Trash2,
  MapPin,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Search,
  Sparkles,
  Heart,
  Share2,
  BadgeCheck,
  Leaf,
  Truck,
  AlertCircle,
  Store,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

interface CartItem {
  product: MarketplaceProduct;
  quantityKg: number;
}

interface CustomerMarketplaceProps {
  language: Language;
  currentUser?: User | null;
  onOpenAuth?: () => void;
}

const CATEGORIES = ['All', 'Vegetables', 'Tubers', 'Spices', 'Grains', 'Fruits'];
const DISTRICTS = ['All', 'Bogura', 'Dhaka', 'Rajshahi', 'Rangpur', 'Dinajpur'];

export const CustomerMarketplace: React.FC<CustomerMarketplaceProps> = ({
  language,
  currentUser,
  onOpenAuth,
}) => {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart & Drawer
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('nb_guest_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Likes & expanded traceability accordions
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [expandedTraceMap, setExpandedTraceMap] = useState<Record<string, boolean>>({});

  // Guest Checkout Form
  const [customerName, setCustomerName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [deliveryAddress, setDeliveryAddress] = useState(
    currentUser?.address || (currentUser?.upazila ? `${currentUser.upazila}, ${currentUser.district}` : '')
  );
  const [paymentMethod, setPaymentMethod] = useState<'Cash on Delivery' | 'bKash' | 'Nagad'>('Cash on Delivery');
  const [orderSuccessDetails, setOrderSuccessDetails] = useState<{
    orderId: string;
    totalBDT: number;
    retailerName: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Save cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem('nb_guest_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [cart]);

  // Load retail products (strictly targetRole=consumer & sellerRole=retailer)
  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await productApi.getProducts({
        targetRole: 'consumer',
        sellerRole: 'retailer',
        district: selectedDistrict !== 'All' ? selectedDistrict : undefined,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        search: searchQuery.trim() || undefined,
      });
      setProducts(res.products || []);
    } catch (err: any) {
      console.error('Failed to load marketplace products', err);
      setError(
        language === 'bn'
          ? 'পণ্য লোড করতে ব্যর্থ হয়েছে। স্থানীয় সার্ভার চালু আছে কিনা পরীক্ষা করুন।'
          : 'Failed to load products. Checking local database...'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedDistrict]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  // Cart operations
  const addToCart = (product: MarketplaceProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantityKg: Math.min(item.quantityKg + 1, product.availableKg) }
            : item
        );
      }
      return [...prev, { product, quantityKg: Math.max(1, product.minOrderKg || 1) }];
    });
    setIsCartOpen(true);
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantityKg + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantityKg: Math.min(newQty, item.product.availableKg),
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const totalKg = cart.reduce((acc, item) => acc + item.quantityKg, 0);
  const cartSubtotalBDT = cart.reduce(
    (acc, item) => acc + item.product.pricePerKg * item.quantityKg,
    0
  );
  const deliveryFeeBDT = cartSubtotalBDT > 0 ? (cartSubtotalBDT > 500 ? 0 : 35) : 0;
  const grandTotalBDT = cartSubtotalBDT + deliveryFeeBDT;

  // Toggle Like
  const toggleLike = (productId: string) => {
    setLikedMap((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  // Toggle Traceability
  const toggleTrace = (productId: string) => {
    setExpandedTraceMap((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  // Execute Order
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    if (!customerName.trim() || !phone.trim() || !deliveryAddress.trim()) {
      showToast(
        language === 'bn'
          ? 'অনুগ্রহ করে আপনার নাম, মোবাইল নম্বর এবং সম্পূর্ণ ডেলিভারি ঠিকানা পূরণ করুন।'
          : 'Please provide your name, phone number, and delivery address.',
        'error'
      );
      return;
    }

    setSubmittingOrder(true);
    try {
      // Group items by retailer sellerId
      const groupedBySeller: Record<string, CartItem[]> = {};
      cart.forEach((item) => {
        const sid = item.product.sellerId || 'retailer-general';
        if (!groupedBySeller[sid]) groupedBySeller[sid] = [];
        groupedBySeller[sid].push(item);
      });

      let lastOrderId = '';
      let primaryRetailer = '';

      for (const sellerId of Object.keys(groupedBySeller)) {
        const sellerItems = groupedBySeller[sellerId];
        const primaryProduct = sellerItems[0].product;
        primaryRetailer = primaryProduct.sellerName;

        const res = await orderApi.createOrder({
          buyerId: currentUser?.id,
          buyerName: customerName.trim(),
          buyerPhone: phone.trim(),
          buyerEmail: currentUser?.email,
          buyerRole: 'consumer',
          sellerId: primaryProduct.sellerId,
          sellerName: primaryProduct.sellerName,
          sellerPhone: primaryProduct.sellerPhone,
          sellerRole: 'retailer',
          items: sellerItems.map((si) => ({
            productId: si.product.id,
            quantityKg: si.quantityKg,
          })),
          paymentMethod,
          deliveryAddress: deliveryAddress.trim(),
          district: primaryProduct.district || 'Bogura',
          notes: `Guest Consumer Order. Sourced via NativeBazar Social Feed.`,
        });

        if (res.success && res.order) {
          lastOrderId = res.order.id || res.order.orderId;
        }
      }

      setOrderSuccessDetails({
        orderId: lastOrderId || `NB-ORD-${Date.now().toString().slice(-6)}`,
        totalBDT: grandTotalBDT,
        retailerName: primaryRetailer,
      });

      // Clear cart
      setCart([]);
      localStorage.removeItem('nb_guest_cart');
      fetchProducts(); // Refresh stock
    } catch (err: any) {
      console.error('Order placement failed', err);
      showToast(
        err.message ||
          (language === 'bn'
            ? 'অর্ডার প্রক্রিয়া করতে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
            : 'Failed to place order. Please try again.'),
        'error'
      );
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Consumer Hero Header (Zero-Login Welcoming Feed Banner) */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-950 via-teal-900 to-stone-900 text-white shadow-xl border border-emerald-800/40 p-6 sm:p-8">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {language === 'bn'
                ? 'বগুড়া ও উত্তরবঙ্গের সরাসরি খুচরা কৃষিপণ্য ফিড'
                : 'Fresh Retail Harvests • Direct from Local Retailers & Verified Hubs'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            {language === 'bn' ? (
              <>
                তাজা দেশি কৃষিপণ্য কিনুন, <span className="text-emerald-400">নিরাপদ ও স্বচ্ছ মূল্যে</span>
              </>
            ) : (
              <>
                Fresh Native Produce, <span className="text-emerald-400">Direct & Traceable</span>
              </>
            )}
          </h1>

          <p className="text-stone-300 text-xs sm:text-sm leading-relaxed max-w-2xl">
            {language === 'bn'
              ? 'কোনো অ্যাকাউন্ট বা লগইন প্রয়োজন নেই। বিশ্বস্ত খুচরা বিক্রেতা ও বাজার কেন্দ্র থেকে টাটকা সবজি, আলু, মরিচ ও শস্য বেছে নিন। প্রতিটি পণ্যে রয়েছে কৃষক উৎসের ট্রেসেবিলিটি।'
              : 'Zero registration required for shoppers. Browse daily retail harvests from certified market retailers, verify farm origins, and enjoy same-day home delivery.'}
          </p>

          {/* Quick Stats Pill Bar */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-stone-300">
            <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-xl border border-white/10">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{language === 'bn' ? '১০০% ফরমালিনমুক্ত ও নিরাপদ' : '100% Quality & Origin Checked'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-xl border border-white/10">
              <Truck className="w-4 h-4 text-teal-400" />
              <span>{language === 'bn' ? 'দ্রুত হোম ডেলিভারি' : 'Local Fast Van Delivery'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-xl border border-white/10">
              <BadgeCheck className="w-4 h-4 text-amber-400" />
              <span>{language === 'bn' ? 'খুচরা বিক্রেতা গ্যারান্টি' : 'Verified Retailer Guarantee'}</span>
            </div>
          </div>
        </div>

        {/* Decorative Graphic Element */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-400 via-transparent to-transparent hidden md:block" />
      </div>

      {/* Sticky Cart Top-Pill Bar for Mobile / Quick View */}
      {cart.length > 0 && (
        <div className="sticky top-20 z-30 bg-stone-900/95 backdrop-blur-md text-white rounded-2xl p-3 px-4 shadow-xl border border-stone-700 flex items-center justify-between transition-all animate-slide-down">
          <div className="flex items-center gap-3 text-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 text-stone-950 flex items-center justify-center font-bold">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-sm">৳{cartSubtotalBDT}</span>
              <span className="text-stone-400 text-xs ml-2">
                ({totalKg.toFixed(1)} kg • {cart.length} {language === 'bn' ? 'আইটেম' : 'items'})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCartOpen(true)}
              className="bg-stone-800 hover:bg-stone-700 text-stone-200 px-3 py-1.5 rounded-xl text-xs font-semibold"
            >
              {language === 'bn' ? 'কার্ট বিস্তারিত' : 'View Basket'}
            </button>
            <button
              onClick={() => setShowCheckoutModal(true)}
              className="bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold px-4 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md"
            >
              <span>{language === 'bn' ? 'অর্ডার দিন' : 'Guest Checkout'}</span>
              <Truck className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Search & Category Filter Section */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'bn'
                  ? 'সবজি, আলু, মরিচ বা খুচরা বিক্রেতা খুঁজুন...'
                  : 'Search fresh tomatoes, potatoes, chilies, or retailers...'
              }
              className="w-full pl-9 pr-20 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 placeholder-stone-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-stone-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-stone-800"
            >
              {language === 'bn' ? 'খুঁজুন' : 'Search'}
            </button>
          </form>

          {/* District Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-stone-600 shrink-0">
              {language === 'bn' ? 'জেলা:' : 'District:'}
            </span>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="bg-stone-50 border border-stone-200 text-xs font-semibold text-stone-800 rounded-xl px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            >
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d === 'All' ? (language === 'bn' ? 'সকল জেলা' : 'All Districts') : d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200/80'
              }`}
            >
              {cat === 'All' ? (language === 'bn' ? 'সব পণ্য' : 'All Products') : cat}
            </button>
          ))}
          <button
            onClick={fetchProducts}
            title={language === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
            className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 border border-stone-200 shrink-0 ml-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Feed Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Social-Feed Style Product Stream */}
        <div className="lg:col-span-2 space-y-6">
          {loading && (
            <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-emerald-600 animate-spin" />
              <p className="text-xs font-semibold text-stone-600">
                {language === 'bn'
                  ? 'তাজা খুচরা কৃষিপণ্য ফিড লোড হচ্ছে...'
                  : 'Loading fresh retail marketplace stream...'}
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">{error}</p>
                <button
                  onClick={fetchProducts}
                  className="mt-2 text-xs font-bold underline hover:text-red-900"
                >
                  {language === 'bn' ? 'পুনরায় চেষ্টা করুন' : 'Retry'}
                </button>
              </div>
            </div>
          )}

          {!loading && products.length === 0 && !error && (
            <div className="text-center py-16 bg-white rounded-3xl border border-stone-200 p-8 space-y-3 shadow-xs">
              <Store className="w-12 h-12 text-stone-300 mx-auto" />
              <h3 className="text-base font-bold text-stone-800">
                {language === 'bn' ? 'কোনো পণ্য পাওয়া যায়নি' : 'No Retail Products Found'}
              </h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                {language === 'bn'
                  ? 'এই ক্যাটাগরি বা জেলায় বর্তমানে কোনো খুচরা বিক্রেতা পণ্য পোস্ট করেননি।'
                  : 'No retail products matching your current filters. Try selecting "All" or a different category.'}
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedDistrict('All');
                  setSearchQuery('');
                  fetchProducts();
                }}
                className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
              >
                {language === 'bn' ? 'ফিল্টার রিসেট করুন' : 'Reset Filters'}
              </button>
            </div>
          )}

          {/* Social Feed Cards List */}
          <div className="space-y-6">
            {products.map((product) => {
              const inCart = cart.find((c) => c.product.id === product.id);
              const isLiked = !!likedMap[product.id];
              const isTraceExpanded = !!expandedTraceMap[product.id];

              return (
                <article
                  key={product.id}
                  className="bg-white rounded-3xl border border-stone-200/90 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col"
                >
                  {/* Feed Card Header: Seller/Retailer Profile Post Info */}
                  <div className="p-4 sm:p-5 pb-3 flex items-center justify-between border-b border-stone-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-extrabold text-stone-900 text-xs sm:text-sm">
                            {product.sellerName}
                          </h4>
                          <span
                            title="Verified Retailer Store"
                            className="text-emerald-600 inline-flex items-center"
                          >
                            <BadgeCheck className="w-4 h-4 fill-emerald-100 text-emerald-600" />
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-stone-400" />
                          <span>
                            {product.locationDetails || product.district} •{' '}
                            <span className="text-emerald-700 font-semibold">Retail Outlet</span>
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleLike(product.id)}
                        className={`p-2 rounded-xl text-stone-400 hover:text-red-500 transition-colors ${
                          isLiked ? 'text-red-500 bg-red-50' : 'hover:bg-stone-50'
                        }`}
                        title="Like"
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500' : ''}`} />
                      </button>
                      <button
                        onClick={() => {
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(window.location.href);
                            showToast(language === 'bn' ? 'লিঙ্ক কপি করা হয়েছে!' : 'Link copied to clipboard!', 'info');
                          }
                        }}
                        className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-50 transition-colors"
                        title="Share"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Card Media: High-res crop photograph */}
                  <div className="relative aspect-video sm:aspect-21/9 w-full bg-stone-100 overflow-hidden">
                    <img
                      src={
                        product.imageUrl ||
                        'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80'
                      }
                      alt={product.cropName}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-103"
                    />

                    {/* Floating Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <span className="bg-stone-950/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{product.harvestStatus || 'Harvested Today'}</span>
                      </span>

                      {product.organicCertified && (
                        <span className="bg-emerald-600/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-xs">
                          <Leaf className="w-3 h-3" />
                          <span>Bio-Organic</span>
                        </span>
                      )}

                      <span className="bg-blue-600/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                        Grade {product.qualityGrade || 'A'}
                      </span>
                    </div>

                    {/* Price Tag Pill */}
                    <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-md rounded-2xl p-2 px-3 shadow-lg border border-stone-200/80 text-right">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span className="text-base sm:text-lg font-black text-stone-900">
                          ৳{product.pricePerKg}
                        </span>
                        <span className="text-[11px] font-semibold text-stone-500">/kg</span>
                      </div>
                      {product.marketPricePerKg && product.marketPricePerKg > product.pricePerKg && (
                        <span className="text-[10px] text-stone-400 line-through block">
                          Govt DAM: ৳{product.marketPricePerKg}/kg
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body: Details & Traceability */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                        <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
                          {language === 'bn' ? product.banglaName || product.cropName : product.cropName}
                        </h3>
                        <span className="text-xs text-stone-500 font-medium">
                          {language === 'bn' ? 'জাত:' : 'Variety:'}{' '}
                          <span className="font-bold text-stone-700">
                            {product.variety || 'Local Deshi'}
                          </span>
                        </span>
                      </div>

                      {product.description && (
                        <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}

                      {/* Origin & Authenticity Verification Badge */}
                      <div className="mt-3 bg-stone-50 rounded-2xl border border-stone-200/80 p-3 text-xs">
                        <div className="flex items-center justify-between text-stone-700 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>
                              {language === 'bn' ? 'উৎপত্তি ও ট্রেসেবিলিটি:' : 'Traceability & Origin:'}
                            </span>
                          </div>
                          <button
                            onClick={() => toggleTrace(product.id)}
                            className="text-emerald-700 hover:text-emerald-800 text-[11px] font-bold flex items-center gap-0.5"
                          >
                            <span>{isTraceExpanded ? 'সংক্ষিপ্ত' : 'যাচাই বিস্তারিত'}</span>
                            {isTraceExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-600">
                          <span>
                            🌱 <strong>Farmer Origin:</strong>{' '}
                            {product.traceability?.farmerOrigin || product.district}
                          </span>
                          <span>
                            🏢 <strong>Procured Arat:</strong>{' '}
                            {product.traceability?.wholesalerArat || 'Direct Mokam'}
                          </span>
                        </div>

                        {/* Expandable Traceability details */}
                        {isTraceExpanded && (
                          <div className="mt-3 pt-3 border-t border-stone-200/80 space-y-1.5 text-[11px] text-stone-600 animate-slide-down">
                            <p>
                              🗓️ <strong>Procurement Timeline:</strong>{' '}
                              {product.traceability?.procurementDate || 'Within 24 hours from farm gate'}
                            </p>
                            <p>
                              🛡️ <strong>Purity & Safety Assurance:</strong>{' '}
                              {product.traceability?.safetyNote ||
                                'Verified formalin-free and harvested following natural post-harvest safety.'}
                            </p>
                            <p>
                              📞 <strong>Retailer Verification:</strong> Call{' '}
                              <span className="font-bold text-stone-800">
                                {product.sellerPhone || 'Verified in NativeBazar Database'}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stock & Add to Cart Controls */}
                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3">
                      <div className="text-xs text-stone-500">
                        {language === 'bn' ? 'মজুদ আছে:' : 'Stock Available:'}{' '}
                        <strong className="text-stone-800 font-bold">
                          {product.availableKg} kg
                        </strong>
                        {product.minOrderKg && product.minOrderKg > 1 && (
                          <span className="text-[10px] text-stone-400 block">
                            (Min: {product.minOrderKg} kg)
                          </span>
                        )}
                      </div>

                      {inCart ? (
                        <div className="flex items-center gap-2 bg-stone-100 rounded-xl p-1 border border-stone-200">
                          <button
                            onClick={() => updateCartQty(product.id, -1)}
                            className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-stone-800 shadow-2xs hover:bg-stone-50 active:scale-95"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-extrabold text-xs px-2 text-stone-900">
                            {inCart.quantityKg} kg
                          </span>
                          <button
                            onClick={() => updateCartQty(product.id, 1)}
                            className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-stone-800 shadow-2xs hover:bg-stone-50 active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(product)}
                          disabled={product.availableKg <= 0}
                          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-300 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all hover:scale-102 active:scale-98"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{language === 'bn' ? 'ব্যাগে যোগ করুন' : 'Add to Basket'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
                );
              })}
          </div>
        </div>

        {/* Right Col: Instant Guest Cart & Order Summary Drawer */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-stone-200 p-5 shadow-xs sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-sm">
                    {language === 'bn' ? 'আপনার বাজার ঝুড়ি' : 'Your Shopping Basket'}
                  </h3>
                  <p className="text-[10px] text-stone-400">
                    {language === 'bn' ? 'লগইন ছাড়াই সহজে অর্ডার করুন' : 'Guest checkout • No login needed'}
                  </p>
                </div>
              </div>
              <span className="bg-emerald-100 text-emerald-800 font-extrabold text-xs px-2 py-0.5 rounded-full">
                {cart.length} {language === 'bn' ? 'টি' : 'items'}
              </span>
            </div>

            {cart.length > 0 ? (
              <div className="space-y-4 mt-4">
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-3 p-2.5 bg-stone-50 rounded-2xl border border-stone-200/80 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-stone-900 truncate">
                          {language === 'bn'
                            ? item.product.banglaName || item.product.cropName
                            : item.product.cropName}
                        </h4>
                        <p className="text-[10px] text-stone-500">
                          {item.quantityKg} kg × ৳{item.product.pricePerKg} •{' '}
                          <span className="text-emerald-700 font-semibold truncate">
                            {item.product.sellerName}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-black text-stone-900 text-xs">
                          ৳{item.quantityKg * item.product.pricePerKg}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-stone-400 hover:text-red-500 p-1 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculation breakdown */}
                <div className="space-y-1.5 pt-3 border-t border-stone-200 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>{language === 'bn' ? 'পণ্যের মোট মূল্য' : 'Items Subtotal'}</span>
                    <span className="font-semibold text-stone-800">৳{cartSubtotalBDT}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>{language === 'bn' ? 'ডেলিভারি চার্জ (লোকাল ভ্যান)' : 'Local Delivery'}</span>
                    <span className="font-semibold text-emerald-700">
                      {deliveryFeeBDT === 0 ? 'Free' : `৳${deliveryFeeBDT}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-900 font-black text-sm pt-2 border-t border-dashed border-stone-200">
                    <span>{language === 'bn' ? 'সর্বমোট প্রদেয়' : 'Total Payable'}</span>
                    <span className="text-emerald-700 text-base">৳{grandTotalBDT}</span>
                  </div>
                </div>

                {/* Checkout Trigger */}
                <button
                  onClick={() => setShowCheckoutModal(true)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 hover:scale-102 active:scale-98"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {language === 'bn' ? 'গেস্ট চেকআউট করুন' : 'Proceed to Checkout'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="text-center py-10 space-y-2 text-stone-400">
                <ShoppingCart className="w-10 h-10 mx-auto text-stone-300 stroke-1" />
                <p className="text-xs font-semibold text-stone-600">
                  {language === 'bn' ? 'আপনার ঝুড়ি খালি আছে' : 'Your basket is empty'}
                </p>
                <p className="text-[11px] text-stone-400">
                  {language === 'bn'
                    ? 'ফিড থেকে পছন্দমতো তাজা পণ্য যোগ করুন'
                    : 'Tap "Add to Basket" on any fresh product in the feed'}
                </p>
              </div>
            )}

            {/* Platform Guarantee Footnote */}
            <div className="mt-5 pt-4 border-t border-stone-100 space-y-2 text-[11px] text-stone-500">
              <div className="flex items-center gap-1.5 font-semibold text-stone-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === 'bn' ? 'স্বচ্ছ খুচরা বাজার' : 'Fair Retail Guarantee'}</span>
              </div>
              <p className="leading-relaxed">
                {language === 'bn'
                  ? 'প্রতিটি অর্ডার স্থানীয় ভ্যান বা ডেলিভারি সার্ভিসের মাধ্যমে দ্রুত ঠিকানায় পৌঁছে দেওয়া হয়। ক্যাশ অন ডেলিভারি সুবিধা রয়েছে।'
                  : 'Pay upon delivery after checking physical freshness and crate quality.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Guest Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-stone-200 my-8 animate-scale-up">
            {orderSuccessDetails ? (
              /* Success Screen */
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-stone-900">
                    {language === 'bn' ? 'অর্ডার সফলভাবে নিশ্চিত হয়েছে!' : 'Order Placed Successfully!'}
                  </h3>
                  <p className="text-xs text-stone-600">
                    {language === 'bn'
                      ? 'খুচরা বিক্রেতা আপনার অর্ডার প্যাকেজিং শুরু করেছেন।'
                      : 'The verified local retailer has received your delivery dispatch request.'}
                  </p>
                </div>

                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 text-xs space-y-2 text-left">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Order Tracking Code:</span>
                    <strong className="text-stone-900 font-mono text-sm">
                      {orderSuccessDetails.orderId}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Retail Seller:</span>
                    <strong className="text-stone-900">{orderSuccessDetails.retailerName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Total Payable:</span>
                    <strong className="text-emerald-700 font-bold text-sm">
                      ৳{orderSuccessDetails.totalBDT}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Delivery Status:</span>
                    <span className="badge-warning text-[10px]">Processing Dispatch</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setOrderSuccessDetails(null);
                    setShowCheckoutModal(false);
                  }}
                  className="w-full bg-stone-900 hover:bg-stone-800 text-white font-extrabold py-3 rounded-2xl text-xs transition-all"
                >
                  {language === 'bn' ? 'কেনাকাটা চালিয়ে যান' : 'Continue Shopping'}
                </button>
              </div>
            ) : (
              /* Checkout Form */
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-stone-900 text-base">
                        {language === 'bn' ? 'দ্রুত গেস্ট চেকআউট' : 'Quick Guest Checkout'}
                      </h3>
                      <p className="text-[11px] text-stone-500">
                        {language === 'bn'
                          ? 'শুধুমাত্র প্রয়োজনীয় ডেলিভারির তথ্য দিন'
                          : 'No login required. Just enter delivery details.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowCheckoutModal(false)}
                    className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handlePlaceOrder} className="space-y-4 mt-5 text-xs">
                  {/* Customer Name */}
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {language === 'bn' ? 'আপনার নাম' : 'Full Name'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={language === 'bn' ? 'যেমন: মোহাম্মদ করিম' : 'e.g. John Doe'}
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {language === 'bn' ? 'মোবাইল নম্বর (এসএমএস ও ট্র্যাকিং)' : 'Mobile Phone (for delivery SMS)'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Delivery Address */}
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      {language === 'bn' ? 'ডেলিভারি ঠিকানা' : 'Complete Delivery Address'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder={
                        language === 'bn'
                          ? 'বাড়ি নম্বর, রাস্তা/মহল্লা, উপজেলা, জেলা...'
                          : 'House/Street, Area, Upazila, District...'
                      }
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block font-bold text-stone-700 mb-1.5">
                      {language === 'bn' ? 'পেমেন্ট পদ্ধতি' : 'Payment Method'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['Cash on Delivery', 'bKash', 'Nagad'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`p-2.5 rounded-xl border text-center font-bold text-xs transition-all ${
                            paymentMethod === method
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-2xs'
                              : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount Summary */}
                  <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-stone-500 block">Total Payable</span>
                      <span className="text-[11px] text-stone-400">
                        {cart.length} items • {totalKg.toFixed(1)} kg
                      </span>
                    </div>
                    <span className="text-emerald-700 font-black text-xl">৳{grandTotalBDT}</span>
                  </div>

                  {/* Form actions */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCheckoutModal(false)}
                      className="px-4 py-2.5 rounded-xl text-stone-600 font-bold hover:bg-stone-100"
                    >
                      {language === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={submittingOrder}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-400 text-white font-extrabold px-6 py-2.5 rounded-xl shadow-md transition-all flex items-center gap-2"
                    >
                      {submittingOrder ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{language === 'bn' ? 'অর্ডার প্রক্রিয়াধীন...' : 'Processing...'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{language === 'bn' ? 'অর্ডার নিশ্চিত করুন' : 'Confirm Order'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-sm font-semibold transition-all transform animate-in slide-in-from-bottom-5 duration-300 ${
          toastMessage.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-100'
            : toastMessage.type === 'info'
            ? 'bg-sky-950/90 border-sky-500/50 text-sky-100'
            : 'bg-rose-950/90 border-rose-500/50 text-rose-100'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : toastMessage.type === 'info' ? (
            <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="max-w-md">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-stone-400 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
