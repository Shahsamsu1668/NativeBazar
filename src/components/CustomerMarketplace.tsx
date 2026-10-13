import React, { useState } from 'react';
import { CustomerProduct, CartItem, Language, CustomerOrder } from '../types';
import {
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  Trash2,
  PieChart,
  Truck,
  Sparkles,
  MapPin,
  Clock,
  ShieldCheck,
  CreditCard,
  ShoppingBag,
} from 'lucide-react';

interface CustomerMarketplaceProps {
  products: CustomerProduct[];
  cart: CartItem[];
  onAddToCart: (product: CustomerProduct) => void;
  onUpdateCartQty: (productId: string, delta: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onCheckout: (order: Partial<CustomerOrder>) => void;
  language: Language;
}

export const CustomerMarketplace: React.FC<CustomerMarketplaceProps> = ({
  products,
  cart,
  onAddToCart,
  onUpdateCartQty,
  onRemoveFromCart,
  onCheckout,
  language,
}) => {
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [customerName, setCustomerName] = useState('Dr. Tanveer Mahmud');
  const [phone, setPhone] = useState('+880 1711-889922');
  const [deliveryAddress, setDeliveryAddress] = useState('Jaleswaritola, Bogura City');
  const [paymentMethod, setPaymentMethod] = useState<'bKash' | 'Nagad' | 'Cash on Delivery'>('bKash');
  const [orderSuccess, setOrderSuccess] = useState(false);

  const cartTotalBDT = cart.reduce((acc, item) => acc + item.product.pricePerKg * item.quantityKg, 0);

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    onCheckout({
      customerName,
      phone,
      deliveryAddress,
      paymentMethod,
      totalBDT: cartTotalBDT,
      items: cart,
    });
    setOrderSuccess(true);
    setTimeout(() => {
      setOrderSuccess(false);
      setShowCheckoutModal(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-purple-800/60 border border-purple-400/30 px-3 py-1 rounded-full text-xs font-semibold text-purple-200 mb-2">
              <ShoppingCart className="w-3.5 h-3.5 text-purple-300" />
              <span>{language === 'bn' ? 'সরাসরি কৃষক থেকে ভোক্তা বাজার' : 'Direct Farm-to-Consumer Bazar'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {language === 'bn' ? 'তাজা দেশি কৃষিপণ্য কিনুন' : 'Fresh Native Harvests at Fair Prices'}
            </h1>
            <p className="text-purple-100/90 text-sm mt-1 max-w-2xl">
              {language === 'bn'
                ? 'দালাল ছাড়াই বগুড়ার স্থানীয় কৃষকের জমি থেকে সরাসরি টাটকা সবজি সংগ্রহ করুন। স্বচ্ছ মূল্যের নিশ্চয়তা।'
                : 'Zero intermediate cartels. Pre-order directly from verified local Bogura farmers with full price transparency.'}
            </p>
          </div>

          {cart.length > 0 && (
            <button
              onClick={() => setShowCheckoutModal(true)}
              className="bg-purple-500 hover:bg-purple-400 text-stone-950 font-bold px-4 py-2.5 rounded-xl text-sm shadow-md flex items-center gap-2 transition-all hover:scale-102"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {language === 'bn' ? 'কার্ট দেখুন' : 'View Cart'} ({cart.length}) • ৳{cartTotalBDT}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Products on Left, Cart & Transparency widget on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Fresh Products */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">
              {language === 'bn' ? 'আজকের তাজা ফসল ও অগ্রিম প্রি-অর্ডার' : 'Today Fresh Harvests & Pre-Orders'}
            </h2>
            <span className="text-xs text-stone-500">
              {products.length} {language === 'bn' ? 'টি পণ্য পাওয়া যাচ্ছে' : 'Available items'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {products.map((item) => {
              const inCart = cart.find((c) => c.product.id === item.id);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="relative">
                    <img
                      src={item.imageUrl}
                      alt={item.cropName}
                      className="w-full h-44 object-cover"
                    />
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                      <span className="bg-stone-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        {item.harvestStatus}
                      </span>
                      {item.organicCertified && (
                        <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Bio-Fresh
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between text-xs">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-bold text-stone-900 text-sm">
                          {language === 'bn' ? item.banglaName : item.cropName}
                        </h3>
                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-stone-900 text-sm">৳{item.pricePerKg}</span>
                          <span className="text-[10px] text-stone-500">/kg</span>
                          <span className="text-[10px] text-stone-400 line-through block">৳{item.marketPricePerKg}</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        {item.farmerName} • {item.farmerLocation}
                      </p>

                      {/* Transparent Price Breakdown Tag */}
                      <div className="mt-3 bg-stone-50 border border-stone-200 rounded-lg p-2 text-[10px] text-stone-600">
                        <span className="font-semibold text-emerald-700 block">
                          💚 {item.farmerCutPercent}% of this price goes directly to the farmer
                        </span>
                        <span className="text-stone-500 block mt-0.5">
                          (Middleman arat cut is typically 45-55% in ordinary markets)
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-[11px] text-stone-500">
                        Stock: <strong>{item.availableKg} kg</strong>
                      </span>

                      {inCart ? (
                        <div className="flex items-center gap-2 bg-stone-100 rounded-lg p-1">
                          <button
                            onClick={() => onUpdateCartQty(item.id, -1)}
                            className="w-6 h-6 rounded bg-white flex items-center justify-center text-stone-700 shadow-2xs hover:bg-stone-50"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-bold text-xs px-1">{inCart.quantityKg} kg</span>
                          <button
                            onClick={() => onUpdateCartQty(item.id, 1)}
                            className="w-6 h-6 rounded bg-white flex items-center justify-center text-stone-700 shadow-2xs hover:bg-stone-50"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(item)}
                          className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'ব্যাগে নিন' : 'Add to Basket'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Transparent Price Breakdown & Cart Summary */}
        <div className="space-y-6">
          {/* Transparent Value Chain Widget (Report USP) */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 text-xs">
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2 mb-2">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>{language === 'bn' ? 'স্বচ্ছ মূল্য সূচক (Transparency Index)' : 'Transparent Value Breakdown'}</span>
            </h3>
            <p className="text-stone-500 text-[11px] leading-relaxed">
              {language === 'bn'
                ? 'নেটিভবাজারে কোনো গোপন মধ্যস্বত্বভোগী নেই। প্রতিটি ১০০ টাকার হিসাব স্পষ্ট:'
                : 'NativeBazar eliminates multi-tier broker gouging. For every ৳100 spent:'}
            </p>

            <div className="space-y-2 mt-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-emerald-900">
                  <span>👨‍🌾 Farmer Direct Gate Earnings</span>
                  <span>78%</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2 mt-1 overflow-hidden">
                  <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '78%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-blue-900">
                  <span>🚚 Local Crate Logistics & Packaging</span>
                  <span>14%</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2 mt-1 overflow-hidden">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '14%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] font-semibold text-purple-900">
                  <span>⚡ NativeBazar Quality QA & Platform</span>
                  <span>8%</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2 mt-1 overflow-hidden">
                  <div className="bg-purple-600 h-2 rounded-full" style={{ width: '8%' }} />
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-stone-200 text-[10px] text-stone-500">
              * Traditional wholesale markets deduct 40-50% in middleman arat commissions before reaching farmers.
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 text-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-purple-600" />
                <span>{language === 'bn' ? 'আপনার বাজার ঝুড়ি' : 'Your Shopping Basket'}</span>
              </h3>
              <span className="text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-full">
                {cart.length} items
              </span>
            </div>

            {cart.length > 0 ? (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-stone-50 border border-stone-200/80"
                  >
                    <div>
                      <h4 className="font-bold text-stone-900 text-xs">{item.product.cropName}</h4>
                      <p className="text-[10px] text-stone-500">
                        {item.quantityKg} kg × ৳{item.product.pricePerKg}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">
                        ৳{item.quantityKg * item.product.pricePerKg}
                      </span>
                      <button
                        onClick={() => onRemoveFromCart(item.product.id)}
                        className="text-stone-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-stone-200 space-y-1 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal</span>
                    <span>৳{cartTotalBDT}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Delivery (Bogura Local)</span>
                    <span className="text-emerald-700 font-medium">Free (Pilot Offer)</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-sm text-stone-900 pt-1">
                    <span>Total Amount</span>
                    <span className="text-purple-700">৳{cartTotalBDT}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowCheckoutModal(true)}
                  className="w-full mt-2 bg-purple-700 hover:bg-purple-800 text-white font-bold py-2.5 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{language === 'bn' ? 'অর্ডার সম্পন্ন করুন' : 'Proceed to Checkout'}</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-stone-400">
                <ShoppingCart className="w-8 h-8 mx-auto text-stone-300 mb-2" />
                <p>{language === 'bn' ? 'আপনার ঝুড়ি খালি আছে' : 'Your cart is empty'}</p>
                <p className="text-[11px] text-stone-400 mt-0.5">Add fresh produce to order</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Checkout */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200">
            {orderSuccess ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-stone-900">
                  {language === 'bn' ? 'অর্ডার সফলভাবে নিশ্চিত হয়েছে!' : 'Order Placed Successfully!'}
                </h3>
                <p className="text-xs text-stone-600">
                  {language === 'bn'
                    ? 'কৃষক আপনার পণ্য সংগ্রহ করছেন। বগুড়া এক্সপ্রেস ডেলিভারির মাধ্যমে পৌঁছে যাবে।'
                    : 'The farmer has been notified to pick your batch. Delivering to Bogura address.'}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                  <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-purple-600" />
                    <span>{language === 'bn' ? 'অর্ডার ও পেমেন্ট' : 'Checkout & Payment'}</span>
                  </h3>
                  <button
                    onClick={() => setShowCheckoutModal(false)}
                    className="text-stone-400 hover:text-stone-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handlePlaceOrder} className="space-y-4 mt-4 text-xs">
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Customer Name</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Phone Number (bKash/SMS)</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Delivery Address</label>
                    <input
                      type="text"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['bKash', 'Nagad', 'Cash on Delivery'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`p-2 rounded-lg border text-center font-bold text-xs transition-all ${
                            paymentMethod === method
                              ? 'border-purple-600 bg-purple-50 text-purple-800'
                              : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex justify-between items-center text-xs font-bold text-stone-900">
                    <span>Payable Total:</span>
                    <span className="text-purple-700 text-base">৳{cartTotalBDT}</span>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCheckoutModal(false)}
                      className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-4 py-2 rounded-lg shadow-sm"
                    >
                      Confirm Order
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
