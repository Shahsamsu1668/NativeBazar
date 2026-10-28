import React, { useState, useRef, useEffect } from 'react';
import { Language, UserRole, ActiveView } from '../types';
import { requestVoiceAssistant, VoiceAssistantResponse } from '../services/aiService';
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Bot,
  User,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  TrendingUp,
  Users,
  Stethoscope,
  Package,
  Wallet,
  CloudSun,
  Sprout,
  CheckCircle2,
  LogOut,
} from 'lucide-react';

// Extend window to include webkit Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currentRole: UserRole;
  selectedDistrict: string;
  onNavigate?: (view: ActiveView) => void;
  onOpenCropDoctor?: () => void;
  onSwitchRole?: (role: UserRole) => void;
  onToggleLanguage?: () => void;
  onLogout?: () => void;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  language,
  currentRole,
  selectedDistrict,
  onNavigate,
  onOpenCropDoctor,
  onSwitchRole,
  onToggleLanguage,
  onLogout,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<{
    sender: 'user' | 'ai';
    text: string;
    actions?: { label: string; action: string }[];
    executeAction?: string | null;
  }[]>([
    {
      sender: 'ai',
      text: language === 'bn'
        ? 'আসসালামু আলাইকুম! আমি আমার হাটের স্মার্ট সহকারী। আপনি মুখে বলে বা লিখে যেকোনো কাজের সহায়তা চাইতে পারেন—যেমন ফসল বিক্রি, বাজার দর দেখা, পাইকার খোঁজা বা ফসলের রোগ নির্ণয়।'
        : 'Assalamu Alaikum! I am Amar Haat AI Assistant. Speak or type to add crops, check market rates, find wholesalers, or diagnose diseases.',
      actions: [
        { label: language === 'bn' ? '🌾 নতুন ফসল তালিকাভুক্ত করুন' : '🌾 Add New Crop', action: 'OPEN_ADD_CROP' },
        { label: language === 'bn' ? '📊 আজকের বাজার দর দেখুন' : '📊 View Market Rates', action: 'OPEN_MARKET' },
        { label: language === 'bn' ? '🤝 পাইকারদের তালিকা দেখুন' : '🤝 Find Wholesalers', action: 'OPEN_CONTACTS' },
      ],
    },
  ]);

  // Check speech recognition support
  useEffect(() => {
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechAPI);
  }, []);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  // Real-world practical prompt shortcuts for farmers
  const quickPrompts = [
    {
      labelBn: '🌾 নতুন ফসল যোগ করব কিভাবে',
      labelEn: '🌾 How to add a new crop',
    },
    {
      labelBn: '📊 বাজার দর দেখাও',
      labelEn: '📊 Show market rates',
    },
    {
      labelBn: '🚪 লগ আউট কিভাবে করব',
      labelEn: '🚪 How to log out',
    },
    {
      labelBn: '🤝 পাইকারদের সাথে যোগাযোগ করব কিভাবে?',
      labelEn: '🤝 How to contact wholesale buyers?',
    },
    {
      labelBn: '🩺 ফসলের পাতায় রোগ হয়েছে, চিকিৎসা কি?',
      labelEn: '🩺 Diagnose crop disease & get remedy',
    },
    {
      labelBn: '📦 আমার সকল অর্ডার ও ডেলিভারি দেখতে চাই',
      labelEn: '📦 Show my orders & tracking',
    },
    {
      labelBn: '📒 খামারের খরচের হিসাব দেখতে চাই',
      labelEn: '📒 Show farm expense ledger',
    },
  ];

  // Helper mapping action keys to icons and metadata
  const getActionMeta = (actionKey: string) => {
    switch (actionKey) {
      case 'OPEN_ADD_CROP':
      case 'ADD_CROP':
      case 'CREATE_HARVEST':
      case 'LIST_HARVEST':
        return {
          labelBn: '🌾 নতুন ফসল তালিকাভুক্ত করুন',
          labelEn: '🌾 Add New Harvest Crop',
          icon: <PlusCircle className="w-4 h-4 text-emerald-600" />,
        };
      case 'OPEN_MARKET':
      case 'CHECK_RATES':
      case 'VIEW_RATES':
        return {
          labelBn: '📊 আজকের বাজার দর পৃষ্ঠা দেখুন',
          labelEn: '📊 View Market Rates Page',
          icon: <TrendingUp className="w-4 h-4 text-blue-600" />,
        };
      case 'OPEN_CONTACTS':
      case 'OPEN_BUYERS':
      case 'VIEW_BUYERS':
      case 'FIND_WHOLESALERS':
      case 'OPEN_DIRECTORY':
        return {
          labelBn: '🤝 পাইকার ও নেটওয়ার্ক ডিরেক্টরি',
          labelEn: '🤝 Find Wholesalers Directory',
          icon: <Users className="w-4 h-4 text-purple-600" />,
        };
      case 'OPEN_DOCTOR':
      case 'DIAGNOSE_CROP':
        return {
          labelBn: '🩺 ফসলের ডাক্তার খুলুন',
          labelEn: '🩺 Open AI Crop Doctor',
          icon: <Stethoscope className="w-4 h-4 text-rose-600" />,
        };
      case 'OPEN_ORDERS':
      case 'VIEW_ORDERS':
        return {
          labelBn: '📦 অর্ডার তালিকা ও ট্র্যাকিং',
          labelEn: '📦 View Orders & Tracking',
          icon: <Package className="w-4 h-4 text-amber-600" />,
        };
      case 'OPEN_LEDGER':
      case 'VIEW_LEDGER':
        return {
          labelBn: '📒 খামার খতিয়ান ও হিসাব',
          labelEn: '📒 Open Farm Ledger',
          icon: <Wallet className="w-4 h-4 text-emerald-600" />,
        };
      case 'OPEN_WEATHER':
        return {
          labelBn: '🌦️ আবহাওয়া পূর্বাভাস দেখুন',
          labelEn: '🌦️ View Weather Forecast',
          icon: <CloudSun className="w-4 h-4 text-sky-600" />,
        };
      case 'LOGOUT':
      case 'EXECUTE_LOGOUT':
        return {
          labelBn: '🚪 লগআউট করুন',
          labelEn: '🚪 Log Out',
          icon: <LogOut className="w-4 h-4 text-rose-600" />,
        };
      case 'OPEN_PROFILE':
      case 'VIEW_PROFILE':
        return {
          labelBn: '👤 প্রোফাইল দেখুন',
          labelEn: '👤 View Profile',
          icon: <User className="w-4 h-4 text-emerald-600" />,
        };
      case 'OPEN_DASHBOARD':
        return {
          labelBn: '🏠 ড্যাশবোর্ড দেখুন',
          labelEn: '🏠 Go to Dashboard',
          icon: <Sprout className="w-4 h-4 text-emerald-600" />,
        };
      default:
        return {
          labelBn: 'সরাসরি পৃষ্ঠা খুলুন',
          labelEn: 'Open Page',
          icon: <ArrowRight className="w-4 h-4 text-teal-600" />,
        };
    }
  };

  // Action dispatcher that maps AI actions to real app navigation and modal triggers
  const executeActionHandler = (actionKey: string) => {
    switch (actionKey) {
      case 'OPEN_ADD_CROP':
      case 'ADD_CROP':
      case 'CREATE_HARVEST':
      case 'LIST_HARVEST':
        // Navigate to dashboard and immediately open Add Crop modal
        onNavigate?.('dashboard');
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('nb_open_add_crop'));
        }, 80);
        onClose();
        break;

      case 'OPEN_MARKET':
      case 'CHECK_RATES':
      case 'VIEW_RATES':
        onNavigate?.('market_rates');
        onClose();
        break;

      case 'OPEN_CONTACTS':
      case 'OPEN_BUYERS':
      case 'VIEW_BUYERS':
      case 'FIND_WHOLESALERS':
      case 'OPEN_DIRECTORY':
        onNavigate?.('contacts');
        onClose();
        break;

      case 'OPEN_DOCTOR':
      case 'DIAGNOSE_CROP':
        onClose();
        onOpenCropDoctor?.();
        break;

      case 'OPEN_ORDERS':
      case 'VIEW_ORDERS':
        onNavigate?.('orders');
        onClose();
        break;

      case 'OPEN_LEDGER':
      case 'VIEW_LEDGER':
        onNavigate?.('ledger');
        onClose();
        break;

      case 'OPEN_WEATHER':
        onNavigate?.('weather');
        onClose();
        break;

      case 'OPEN_DASHBOARD':
        onNavigate?.('dashboard');
        onClose();
        break;

      case 'SWITCH_ROLE_FARMER':
        onSwitchRole?.('farmer');
        onClose();
        break;

      case 'SWITCH_ROLE_WHOLESALER':
        onSwitchRole?.('wholesaler');
        onClose();
        break;

      case 'SWITCH_ROLE_RETAILER':
        onSwitchRole?.('retailer');
        onClose();
        break;

      case 'SWITCH_ROLE_CONSUMER':
        onSwitchRole?.('consumer');
        onClose();
        break;

      case 'SWITCH_LANG_BN':
      case 'SWITCH_LANG_EN':
      case 'TOGGLE_LANGUAGE':
        onToggleLanguage?.();
        break;

      default:
        onNavigate?.('dashboard');
        onClose();
        break;
    }
  };

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    const userMsg = queryText.trim();
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setQuery('');
    setLoading(true);

    try {
      const res: VoiceAssistantResponse = await requestVoiceAssistant(
        userMsg,
        currentRole,
        selectedDistrict,
        language
      );
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.reply,
          actions: res.suggestedActions,
          executeAction: res.executeAction,
        },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMicToggle = () => {
    if (!speechSupported) return;
    const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechAPI();
    recognition.lang = language === 'bn' ? 'bn-BD' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[88vh] animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-stone-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl text-white flex items-center justify-center shadow-xs transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-emerald-600'}`}>
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-stone-900 text-base sm:text-lg">
                {language === 'bn' ? 'আমার হাট ভয়েস ও চ্যাট সহকারী' : 'Amar Haat Voice & Chat AI'}
              </h3>
              <p className="text-xs text-stone-500">
                {language === 'bn'
                  ? 'সহজ বাংলায় কথা বলুন বা নির্দেশ দিন — যেমন "ফসল যোগ করো", "বাজার দর"'
                  : 'Speak Bangla or type commands — e.g. "Add crop", "Market rates"'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold text-sm flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {messages.map((m, idx) => {
            // Deduplicated list of actions for this message
            const allActions: { label: string; action: string }[] = [];
            if (m.executeAction) {
              const meta = getActionMeta(m.executeAction);
              const label = language === 'bn' ? meta.labelBn : meta.labelEn;
              allActions.push({ label, action: m.executeAction });
            }
            if (m.actions && m.actions.length > 0) {
              m.actions.forEach((act) => {
                if (!allActions.some((a) => a.action === act.action)) {
                  allActions.push(act);
                }
              });
            }

            return (
              <div
                key={idx}
                className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'ai' && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm ${
                    m.sender === 'user'
                      ? 'bg-emerald-700 text-white rounded-br-none shadow-xs'
                      : 'bg-stone-50 text-stone-900 rounded-bl-none border border-stone-200/90 shadow-2xs'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-line font-medium">{m.text}</p>

                  {/* ── Direct Clickable Action Links / Buttons in AI Responses ── */}
                  {allActions.length > 0 && (
                    <div className="mt-3.5 pt-3 border-t border-stone-200/90 space-y-2">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>{language === 'bn' ? 'সরাসরি যাওয়ার লিঙ্ক:' : 'Direct Action Link:'}</span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {allActions.map((act, i) => {
                          const meta = getActionMeta(act.action);
                          const label = act.label || (language === 'bn' ? meta.labelBn : meta.labelEn);
                          const isLogout = act.action === 'LOGOUT' || act.action === 'EXECUTE_LOGOUT';
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => executeActionHandler(act.action)}
                              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black shadow-2xs hover:shadow-xs active:scale-98 transition-all cursor-pointer group text-left ${
                                isLogout
                                  ? 'bg-rose-50 hover:bg-rose-100 border-2 border-rose-500 hover:border-rose-600 text-rose-950'
                                  : 'bg-white hover:bg-emerald-50 border-2 border-emerald-500/80 hover:border-emerald-600 text-emerald-950'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`p-1 rounded-lg shrink-0 ${isLogout ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {meta.icon}
                                </span>
                                <span className="truncate">{label}</span>
                              </div>
                              <div className={`flex items-center gap-1 text-[11px] font-bold shrink-0 ${isLogout ? 'text-rose-700' : 'text-emerald-700'}`}>
                                <span>{isLogout ? (language === 'bn' ? 'লগআউট' : 'Logout') : (language === 'bn' ? 'যান' : 'Go')}</span>
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {m.sender === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-stone-500 text-xs italic pl-10">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              <span>{language === 'bn' ? 'এআই উত্তর ও অ্যাকশন প্রস্তুত করছে...' : 'Processing query and actions...'}</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Suggestion Prompts */}
        <div className="pt-2.5 pb-3 border-t border-stone-200">
          <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block mb-1.5">
            {language === 'bn' ? 'সাধারণ প্রশ্ন ও অ্যাকশন:' : 'Common Actions & Questions:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendQuery(language === 'bn' ? p.labelBn : p.labelEn)}
                className="bg-stone-50 hover:bg-emerald-50 hover:border-emerald-300 border border-stone-200 text-stone-700 font-semibold text-[11px] px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer"
              >
                {language === 'bn' ? p.labelBn : p.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2 pt-1">
          {/* Mic button */}
          {speechSupported ? (
            <button
              type="button"
              onClick={handleMicToggle}
              title={isListening
                ? (language === 'bn' ? 'থামান' : 'Stop listening')
                : (language === 'bn' ? 'মাইক্রোফোন চালু করুন' : 'Start voice input')}
              className={`p-3 rounded-2xl shrink-0 transition-all shadow-xs cursor-pointer active:scale-95 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-stone-100 hover:bg-emerald-50 text-emerald-800 border border-stone-300'
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          ) : (
            <div
              title="Speech recognition not supported in this browser"
              className="p-3 rounded-2xl shrink-0 bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed"
            >
              <MicOff className="w-5 h-5" />
            </div>
          )}

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendQuery(query)}
            placeholder={
              isListening
                ? (language === 'bn' ? '🎙️ শুনছি... বলুন' : '🎙️ Listening... speak now')
                : language === 'bn'
                ? 'প্রশ্ন বা নির্দেশ লিখুন (যেমন: ফসল বিক্রি, বাজার দর, পাইকার)...'
                : 'Type query (e.g. Add crop, Market rates, Find wholesaler)...'
            }
            className="flex-1 text-xs sm:text-sm border border-stone-300 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden bg-stone-50 focus:bg-white transition"
          />

          <button
            type="button"
            onClick={() => handleSendQuery(query)}
            disabled={!query.trim() || loading}
            className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white p-3 rounded-2xl transition-colors shrink-0 shadow-xs cursor-pointer active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Speech notice */}
        {!speechSupported && (
          <p className="text-[10px] text-stone-400 text-center mt-1.5 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            {language === 'bn'
              ? 'ভয়েস ইনপুট Chrome বা Edge ব্রাউজারে সবচেয়ে ভালো কাজ করে'
              : 'Voice recognition best supported on Chrome/Edge'}
          </p>
        )}
      </div>
    </div>
  );
};
