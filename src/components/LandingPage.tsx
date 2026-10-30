import React from 'react';
import { Language } from '../types';
import {
  Sprout,
  Briefcase,
  Store,
  ShoppingCart,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Users,
  Award,
  PhoneCall,
  Sparkles,
  Lock,
  ChevronRight,
  LogIn,
  HeartHandshake,
} from 'lucide-react';

interface LandingPageProps {
  language: Language;
  onOpenAuth: (mode?: 'login' | 'register', role?: 'farmer' | 'wholesaler' | 'retailer' | 'consumer') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  language,
  onOpenAuth,
}) => {
  const isBn = language === 'bn';

  return (
    <div className="space-y-12 sm:space-y-16 pb-12 animate-fade-in">
      {/* ── HERO SECTION ── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-stone-900 text-white p-6 sm:p-10 lg:p-12 shadow-2xl border border-emerald-800/40">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Core Value Proposition & Primary CTA */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-800/80 border border-emerald-500/40 text-emerald-200 text-xs font-bold tracking-wide shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{isBn ? 'ডিজিটাল কৃষি প্ল্যাটফর্ম • আমার হাট' : 'Digital Agri Platform • Amar Haat'}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight sm:leading-tight">
              {isBn ? (
                <>
                  মধ্যস্বত্বভোগী নয়, এবার ফসলের{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-200">
                    ন্যায্য দাম
                  </span>{' '}
                  সরাসরি কৃষকের হাতে
                </>
              ) : (
                <>
                  Eliminating Middlemen Syndicates:{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-200">
                    Fair Prices
                  </span>{' '}
                  Directly to Farmers
                </>
              )}
            </h1>

            <p className="text-stone-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto lg:mx-0">
              {isBn
                ? 'আমার হাট — বাংলাদেশের কৃষক ও পাইকারদের সরাসরি সংযোগকারী প্রথম ডিজিটাল কৃষি প্ল্যাটফর্ম। কোনো অদৃশ্য কমিশন, সিন্ডিকেট বা ফড়িয়া ছাড়া নিজের উৎপাদিত ফসল সরাসরি পাইকারের কাছে বিক্রি করে সর্বোচ্চ ন্যায্য লাভ নিশ্চিত করুন।'
                : "Amar Haat is Bangladesh's premier digital agricultural platform connecting farmers directly to verified wholesalers. Trade transparently without exploitative syndicates, brokers, or hidden commissions."}
            </p>

            {/* Value bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs sm:text-sm text-emerald-100 font-medium">
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{isBn ? '১০০% সিন্ডিকেট-মুক্ত সরাসরি কেনাবেচা' : '100% Direct, syndicate-free trade'}</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{isBn ? 'স্বচ্ছ ও উন্মুক্ত দরদাম নির্ধারণ' : 'Transparent, mutual price agreement'}</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{isBn ? 'কৃত্রিম বুদ্ধিমত্তা চালিত ফসলের ডাক্তার' : 'Smart AI Crop Doctor leaf diagnosis'}</span>
              </div>
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{isBn ? 'সরাসরি ভয়েস কল ও তাৎক্ষণিক যোগাযোগ' : 'Direct voice calls & real-time messaging'}</span>
              </div>
            </div>

            {/* ── PROMINENT "GET STARTED / নিবন্ধন করুন" CTA ── */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-black text-base sm:text-lg rounded-2xl shadow-xl hover:shadow-2xl hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-3 group border border-emerald-300/40"
              >
                <span>{isBn ? 'নিবন্ধন করুন / শুরু করুন' : 'Get Started / Register Now'}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="w-full sm:w-auto px-6 py-4 bg-stone-800/90 hover:bg-stone-800 text-stone-200 hover:text-white border border-stone-700/80 rounded-2xl font-bold text-sm sm:text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <LogIn className="w-4 h-4 text-emerald-400" />
                <span>{isBn ? 'লগইন করুন (Sign In)' : 'Sign In'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Clean Informational Value Overview (No live transaction/product cards) */}
          <div className="lg:col-span-5">
            <div className="bg-stone-900/90 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-950 text-emerald-400">
                    <Sprout className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    {isBn ? 'আমার হাট ইকোসিস্টেম' : 'Amar Haat Ecosystem'}
                  </span>
                </div>
                <span className="text-[11px] bg-stone-800 text-stone-300 px-2 py-0.5 rounded-full font-semibold">
                  {isBn ? 'কৃষি বাণিজ্য প্ল্যাটফর্ম' : 'Agri Trade Platform'}
                </span>
              </div>

              {/* Informational Pillars Showcase */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-stone-800/70 border border-stone-700/60">
                  <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center shrink-0 font-bold text-sm">
                    ১
                  </div>
                  <div className="text-xs space-y-0.5">
                    <h4 className="font-extrabold text-white text-xs sm:text-sm">
                      {isBn ? 'সরাসরি কৃষক-পাইকার ট্রেডিং' : 'Direct Farmer-Wholesaler Trading'}
                    </h4>
                    <p className="text-stone-300 text-[11px] leading-relaxed">
                      {isBn
                        ? 'মাঠের কৃষক সরাসরি পাইকারের সাথে যুক্ত হন। কোনো মধ্যস্বত্বভোগী সিন্ডিকেট বা অসাধু ফড়িয়া নেই।'
                        : 'Direct connection eliminates third-party commission and arat syndicate exploitation.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-stone-800/70 border border-stone-700/60">
                  <div className="w-8 h-8 rounded-lg bg-blue-950 text-blue-400 flex items-center justify-center shrink-0 font-bold text-sm">
                    ২
                  </div>
                  <div className="text-xs space-y-0.5">
                    <h4 className="font-extrabold text-white text-xs sm:text-sm">
                      {isBn ? 'উন্মুক্ত ও স্বচ্ছ দরদাম' : 'Fair & Transparent Pricing'}
                    </h4>
                    <p className="text-stone-300 text-[11px] leading-relaxed">
                      {isBn
                        ? 'কোনো গোপন সিন্ডিকেট ছাড়াই উভয় পক্ষের সম্মতিতে ন্যায্য ও স্বচ্ছ চুক্তি সম্পন্ন করার সুবিধা।'
                        : 'Open, mutually agreed pricing gives growers fair remuneration for their hard work.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-xl bg-stone-800/70 border border-stone-700/60">
                  <div className="w-8 h-8 rounded-lg bg-purple-950 text-purple-400 flex items-center justify-center shrink-0 font-bold text-sm">
                    ৩
                  </div>
                  <div className="text-xs space-y-0.5">
                    <h4 className="font-extrabold text-white text-xs sm:text-sm">
                      {isBn ? 'স্মার্ট এআই কৃষি প্রযুক্তি' : 'Smart AI Agricultural Tech'}
                    </h4>
                    <p className="text-stone-300 text-[11px] leading-relaxed">
                      {isBn
                        ? 'আক্রান্ত পাতার ছবি দিয়ে এআই ক্রপ ডক্টরে ফসলের রোগ নির্ণয় ও পরামর্শের সুযোগ।'
                        : 'AI-assisted leaf disease diagnosis and treatment guidance whenever needed.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informational Card CTA */}
              <button
                type="button"
                onClick={() => onOpenAuth('register')}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>{isBn ? 'বিনামূল্যে অ্যাকাউন্ট তৈরি করুন' : 'Create Free Account Today'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CORE VALUE PROPOSITIONS (কেন আমার হাট?) ── */}
      <section className="bg-stone-50 rounded-3xl p-6 sm:p-10 border border-stone-200/90 shadow-2xs space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/90 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>{isBn ? 'কৃষি বাণিজ্য সুরক্ষা' : 'Agri Trade Protection'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            {isBn ? 'কেন আমার হাট আপনার জন্য সেরা?' : 'Why Choose Amar Haat for Agricultural Trade?'}
          </h2>
          <p className="text-xs sm:text-sm text-stone-600">
            {isBn
              ? 'কৃষকের উৎপাদিত ফসলের সঠিক মূল্য নিশ্চিত করা এবং পাইকারদের সহজে তাজা ফসল পৌঁছে দেওয়ার একটি সম্পূর্ণ উন্মুক্ত প্ল্যাটফর্ম।'
              : 'A secure, digital marketplace ensuring farmers receive fair prices while wholesale buyers secure fresh produce reliably.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Proposition 1 */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
              <Sprout className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-stone-900 text-base">
              {isBn ? 'সরাসরি কৃষক-পাইকার ট্রেডিং' : 'Direct Farmer-Wholesaler Trade'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {isBn
                ? 'মাঠের কৃষক সরাসরি পাইকারের সাথে যুক্ত হন। কোনো মধ্যস্বত্বভোগী সিন্ডিকেট বা অসাধু ফড়িয়া নেই, ফলে কৃষক পান সর্বোচ্চ মুনাফা।'
                : 'Direct connection between cultivators and verified arat buyers eliminates extortionate third-party broker cuts.'}
            </p>
          </div>

          {/* Proposition 2 */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-black">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-stone-900 text-base">
              {isBn ? 'ন্যায্য ও স্বচ্ছ বাণিজ্য' : 'Fair & Mutual Agreements'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {isBn
                ? 'কোনো জোরজবরদস্তি বা গোপন সিন্ডিকেট ছাড়াই উভয় পক্ষের সম্মতিতে ন্যায্য দর নির্ধারণের পূর্ণ স্বাধীনতা।'
                : 'Both parties negotiate openly and agree on mutually beneficial rates without syndicate pressure.'}
            </p>
          </div>

          {/* Proposition 3 */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-black">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-stone-900 text-base">
              {isBn ? 'এআই ফসলের ডাক্তার' : 'Smart AI Crop Doctor'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {isBn
                ? 'আক্রান্ত পাতার ছবি আপলোড করলেই কৃত্রিম বুদ্ধিমত্তা তাৎক্ষণিক রোগ নির্ণয় করে এবং সঠিক সমাধান বাতলে দেয়।'
                : 'Instant plant disease diagnosis and verified remedies powered by intelligent agronomy algorithms.'}
            </p>
          </div>

          {/* Proposition 4 */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/90 shadow-2xs hover:shadow-md transition-shadow space-y-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-black">
              <PhoneCall className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-stone-900 text-base">
              {isBn ? 'সরাসরি যোগাযোগ ও কল' : 'Direct Voice Calls & Chat'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              {isBn
                ? 'অ্যাপের ভেতর থেকেই এক ক্লিকে পছন্দের পাইকার বা কৃষকের সাথে কথা বলুন এবং তাৎক্ষণিক চুক্তি নিশ্চিত করুন।'
                : 'Connect directly via instant phone calling or chat to negotiate terms and finalize procurement.'}
            </p>
          </div>
        </div>
      </section>

      {/* ── FOR EVERY ROLE SECTION (৪টি অনুমোদিত ভূমিকা) ── */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full">
            <Users className="w-3.5 h-3.5 text-amber-700" />
            <span>{isBn ? 'সবার জন্য সহজ প্ল্যাটফর্ম' : 'Tailored Roles'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            {isBn ? 'আমার হাটে কার কী সুবিধা?' : 'Value for Every Stakeholder'}
          </h2>
          <p className="text-xs sm:text-sm text-stone-500">
            {isBn ? 'কৃষক, পাইকার, খুচরা বিক্রেতা ও ভোক্তা — সবার জন্য রয়েছে সুনির্দিষ্ট সুযোগ।' : 'Empowering four authorized roles with dedicated tools and direct market access.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Role 1: Farmer */}
          <div className="bg-white rounded-2xl p-5 border-2 border-emerald-500/50 hover:border-emerald-600 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                  <Sprout className="w-6 h-6" />
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {isBn ? 'কৃষক' : 'Farmer'}
                </span>
              </div>
              <h3 className="font-black text-stone-900 text-lg">
                {isBn ? 'কৃষক (Farmer)' : 'For Farmers'}
              </h3>
              <ul className="space-y-2 text-xs text-stone-600 font-medium">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'মাঠের ফসল সরাসরি পাইকারের কাছে বিক্রয়' : 'Sell harvests directly to wholesalers'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'আড়ত সিন্ডিকেটের কমিশন ছাড়াই ন্যায্য লাভ' : 'Zero middleman deductions or commissions'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'এআই ক্রপ ডক্টর ও খামার খতিয়ান হিসাব' : 'AI Crop Doctor & farm revenue ledger'}</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onOpenAuth('register', 'farmer')}
              className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <span>{isBn ? 'কৃষক হিসেবে শুরু করুন' : 'Register as Farmer'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Role 2: Wholesaler */}
          <div className="bg-white rounded-2xl p-5 border-2 border-blue-500/50 hover:border-blue-600 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-xl bg-blue-100 text-blue-800">
                  <Briefcase className="w-6 h-6" />
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {isBn ? 'পাইকার' : 'Wholesaler'}
                </span>
              </div>
              <h3 className="font-black text-stone-900 text-lg">
                {isBn ? 'পাইকার (Wholesaler)' : 'For Wholesalers'}
              </h3>
              <ul className="space-y-2 text-xs text-stone-600 font-medium">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'সরাসরি কৃষকের জমি থেকে তাজা ফসল সংগ্রহ' : 'Procure bulk fresh crops at origin'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'চাহিদা অনুযায়ী ক্রয় প্রস্তাব পোস্ট করার সুবিধা' : 'Broadcast procurement demand contracts'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'খুচরা বিক্রেতাদের কাছে নিরাপদ চালান সরবরাহ' : 'Supply verified stock to retailers'}</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onOpenAuth('register', 'wholesaler')}
              className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <span>{isBn ? 'পাইকার হিসেবে শুরু করুন' : 'Register as Wholesaler'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Role 3: Retailer */}
          <div className="bg-white rounded-2xl p-5 border-2 border-amber-500/50 hover:border-amber-600 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-xl bg-amber-100 text-amber-800">
                  <Store className="w-6 h-6" />
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {isBn ? 'খুচরা বিক্রেতা' : 'Retailer'}
                </span>
              </div>
              <h3 className="font-black text-stone-900 text-lg">
                {isBn ? 'খুচরা বিক্রেতা (Retailer)' : 'For Retailers'}
              </h3>
              <ul className="space-y-2 text-xs text-stone-600 font-medium">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'পাইকারি মূল্যে উন্নত মানের কৃষিপণ্য সংগ্রহ' : 'Source top-grade produce at wholesale'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'নিয়মিত নির্ভরযোগ্য চালান ও স্টক প্রাপ্তি' : 'Reliable inventory replenishment'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'ভোক্তাদের কাছে সহজে তাজা পণ্য বিক্রয়' : 'Sell fresh goods to consumers'}</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onOpenAuth('register', 'retailer')}
              className="w-full py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <span>{isBn ? 'খুচরা বিক্রেতা হিসেবে শুরু' : 'Register as Retailer'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Role 4: Consumer */}
          <div className="bg-white rounded-2xl p-5 border-2 border-purple-500/50 hover:border-purple-600 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="p-2.5 rounded-xl bg-purple-100 text-purple-800">
                  <ShoppingCart className="w-6 h-6" />
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  {isBn ? 'ভোক্তা' : 'Consumer'}
                </span>
              </div>
              <h3 className="font-black text-stone-900 text-lg">
                {isBn ? 'ভোক্তা (Consumer)' : 'For Consumers'}
              </h3>
              <ul className="space-y-2 text-xs text-stone-600 font-medium">
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'রাসায়নিক ও ফরমালিনমুক্ত তাজা সবজি' : 'Fresh, chemical-free farm produce'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'সাশ্রয়ী খুচরা মূল্যে সরাসরি ডেলিভারি' : 'Affordable direct door delivery'}</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <span>{isBn ? 'স্থানীয় কৃষকদের সরাসরি সমর্থন' : 'Support local growers directly'}</span>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => onOpenAuth('register', 'consumer')}
              className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <span>{isBn ? 'ভোক্তা হিসেবে শুরু করুন' : 'Register as Consumer'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (সহজ ৩টি ধাপে আমার হাট) ── */}
      <section className="bg-gradient-to-br from-stone-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 border border-emerald-800/40 shadow-xl space-y-8">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            {isBn ? 'সহজ ও নিরাপদ প্রক্রিয়া' : 'Seamless 3-Step Process'}
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {isBn ? 'কীভাবে কাজ করে আমার হাট?' : 'How Amar Haat Works'}
          </h2>
          <p className="text-xs sm:text-sm text-stone-300">
            {isBn ? 'কোনো জটিলতা ছাড়াই মাত্র ৩টি সহজ ধাপে কৃষিপণ্য কেনাবেচা করুন।' : 'Start buying or selling verified agricultural produce in minutes.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Step 1 */}
          <div className="bg-stone-800/70 border border-emerald-700/40 rounded-2xl p-6 space-y-3 relative backdrop-blur-xs">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-stone-950 font-black text-base flex items-center justify-center shadow-md">
              ১
            </div>
            <h3 className="font-extrabold text-white text-base">
              {isBn ? 'বিনামূল্যে নিবন্ধন করুন' : '1. Free Registration'}
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              {isBn
                ? 'মোবাইল নম্বর ও নিজের ভূমিকা (কৃষক বা পাইকার) নির্বাচন করে মাত্র ১ মিনিটে অ্যাকাউন্ট তৈরি করুন।'
                : 'Sign up in under 60 seconds with your mobile number and select your designated role.'}
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-stone-800/70 border border-emerald-700/40 rounded-2xl p-6 space-y-3 relative backdrop-blur-xs">
            <div className="w-10 h-10 rounded-full bg-amber-400 text-stone-950 font-black text-base flex items-center justify-center shadow-md">
              ২
            </div>
            <h3 className="font-extrabold text-white text-base">
              {isBn ? 'ফসল যোগ করুন বা চাহিদা জানুন' : '2. List Crops or Demand'}
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              {isBn
                ? 'কৃষক ফসলের বিবরণ দিয়ে তালিকাভুক্ত করবেন এবং পাইকাররা সরাসরি নিজেদের চাহিদা ও অফার জানাবেন।'
                : 'Farmers publish crop volume and expected rate; wholesalers broadcast procurement demands.'}
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-stone-800/70 border border-emerald-700/40 rounded-2xl p-6 space-y-3 relative backdrop-blur-xs">
            <div className="w-10 h-10 rounded-full bg-teal-400 text-stone-950 font-black text-base flex items-center justify-center shadow-md">
              ৩
            </div>
            <h3 className="font-extrabold text-white text-base">
              {isBn ? 'সরাসরি কথা বলে চুক্তি সম্পন্ন' : '3. Connect & Finalize'}
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              {isBn
                ? 'সরাসরি ফোন বা চ্যাটে কথা বলে দরদাম চূড়ান্ত করে নিরাপদে ডেলিভারি ও লেনদেন সম্পন্ন করুন।'
                : 'Connect via instant calling or chat, agree on terms, and complete verified dispatch.'}
            </p>
          </div>
        </div>

        {/* Center CTA */}
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => onOpenAuth('register')}
            className="px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-sm sm:text-base rounded-2xl shadow-xl hover:scale-102 transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <span>{isBn ? 'নিবন্ধন করুন / শুরু করুন' : 'Create Free Account Today'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ── BIG BOTTOM CALL TO ACTION BANNER ── */}
      <section className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-8 sm:p-12 text-white text-center space-y-6 shadow-2xl relative overflow-hidden border border-emerald-600/50">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 text-emerald-200 text-xs font-bold border border-emerald-400/30">
            <Award className="w-4 h-4 text-amber-300" />
            <span>{isBn ? 'বাংলাদেশ কৃষি প্ল্যাটফর্ম' : 'Bangladesh Agri Platform'}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            {isBn
              ? 'আপনার ফসলের সেরা দাম নিশ্চিত করতে আজই যুক্ত হোন'
              : 'Join Amar Haat Today and Maximize Your Agri Revenue'}
          </h2>

          <p className="text-emerald-100 text-xs sm:text-sm leading-relaxed max-w-xl mx-auto">
            {isBn
              ? 'হাজারো কৃষক ও পাইকার ইতিমধ্যেই আমার হাটে নিয়মিত ব্যবসা করছেন। কোনো ফড়িয়া বা সিন্ডিকেটের ভয় ছাড়া আজই নিজের ফসল বিক্রি শুরু করুন।'
              : 'Growers and wholesale buyers are already connecting on Amar Haat. Register today for direct, transparent agricultural commerce.'}
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => onOpenAuth('register')}
              className="w-full sm:w-auto px-8 py-4 bg-white text-emerald-950 hover:bg-emerald-50 font-black text-base sm:text-lg rounded-2xl shadow-2xl hover:scale-102 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isBn ? 'নিবন্ধন করুন / শুরু করুন' : 'Get Started / Register'}</span>
              <ArrowRight className="w-5 h-5 text-emerald-700" />
            </button>

            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="w-full sm:w-auto px-6 py-4 bg-emerald-900/80 hover:bg-emerald-900 text-white border border-emerald-400/40 rounded-2xl font-bold text-sm sm:text-base transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>{isBn ? 'লগইন করুন (Sign In)' : 'Sign In'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── CLEAN PUBLIC FOOTER ── */}
      <footer className="border-t border-stone-200 pt-8 pb-4 text-xs text-stone-500 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold">
              <Sprout className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-stone-800 text-sm">
                {isBn ? 'আমার হাট (Amar Haat)' : 'Amar Haat'}
              </span>
              <p className="text-[11px] text-stone-400">
                {isBn ? 'বাংলাদেশের কৃষক ও পাইকারদের ডিজিটাল প্ল্যাটফর্ম' : 'Digital Agricultural Trading Network of Bangladesh'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-stone-600 font-semibold">
            <button onClick={() => onOpenAuth('register')} className="hover:text-emerald-700 cursor-pointer">
              {isBn ? 'নিবন্ধন করুন' : 'Register'}
            </button>
            <button onClick={() => onOpenAuth('login')} className="hover:text-emerald-700 cursor-pointer">
              {isBn ? 'লগইন করুন' : 'Sign In'}
            </button>
            <span className="text-stone-300">•</span>
            <span className="text-stone-500">
              {isBn ? 'কৃষি হেল্পলাইন: ১৬১২৩' : 'Agri Helpline: 16123'}
            </span>
          </div>
        </div>

        <div className="text-center text-[11px] text-stone-400 border-t border-stone-100 pt-4">
          © {new Date().getFullYear()} {isBn ? 'আমার হাট • সর্বস্বত্ব সংরক্ষিত।' : 'Amar Haat • All rights reserved.'}
        </div>
      </footer>
    </div>
  );
};
