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
  ExternalLink,
  CheckCircle2,
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
        ? 'আসসালামু আলাইকুম! আমি নেটিভবাজারের স্মার্ট এআই সহকারী। মাইক্রোফোন চেপে বাংলায় কথা বলুন অথবা লিখে জানান—যেমন "বাজার দর দেখাও", "রোগ নির্ণয় করো", "ক্রেতা খুঁজুন", অথবা "সার ডিলার কোথায়"।'
        : 'Assalamu Alaikum! I am NativeBazar Smart AI Assistant. Tap mic or type commands—e.g. "Show market rates", "Diagnose disease", "Find buyers", or "Find fertilizer dealers".',
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

  const quickPrompts = [
    {
      labelBn: '📊 আমাকে আজকের বাজার দর পৃষ্ঠা দেখাও',
      labelEn: '📊 Show me today\'s wholesale market rates',
    },
    {
      labelBn: '🩺 টমেটো ও আলুর ধসা রোগের চিকিৎসা কি?',
      labelEn: '🩺 Diagnose tomato & potato blight disease',
    },
    {
      labelBn: '🌦️ বগুড়ার আগামী ২ দিনের আবহাওয়া কেমন?',
      labelEn: '🌦️ What is the 48h weather forecast for Bogura?',
    },
    {
      labelBn: '🤝 আমার ৫০০ কেজি টমেটো আছে, পাইকার ক্রেতা কে?',
      labelEn: '🤝 I have 500kg tomatoes, who are wholesale buyers?',
    },
    {
      labelBn: '🏪 শিবগঞ্জে অনুমোদিত সার ও কীটনাশক ডিলার কোথায়?',
      labelEn: '🏪 Where are certified fertilizer dealers in Shibganj?',
    },
  ];

  // Action dispatcher that maps AI actions to real app navigation
  const executeActionHandler = (actionKey: string) => {
    switch (actionKey) {
      case 'OPEN_MARKET':
      case 'CHECK_RATES':
      case 'VIEW_RATES':
        onNavigate?.('market_rates');
        onClose();
        break;
      case 'OPEN_WEATHER':
        onNavigate?.('weather');
        onClose();
        break;
      case 'OPEN_ORDERS':
      case 'VIEW_ORDERS':
        onNavigate?.('orders');
        onClose();
        break;
      case 'OPEN_LEDGER':
        onNavigate?.('ledger');
        onClose();
        break;
      case 'OPEN_DASHBOARD':
      case 'OPEN_BUYERS':
      case 'OPEN_DEALERS':
      case 'CREATE_HARVEST':
      case 'LIST_HARVEST':
      case 'LOCK_CONTRACT':
      case 'FIND_DEALERS':
      case 'CALL_DEALER':
      case 'VIEW_BUYERS':
        onNavigate?.('dashboard');
        onClose();
        break;
      case 'OPEN_DOCTOR':
      case 'DIAGNOSE_CROP':
        onClose();
        onOpenCropDoctor?.();
        break;
      case 'SWITCH_ROLE_FARMER':
        onSwitchRole?.('farmer');
        onClose();
        break;
      case 'SWITCH_ROLE_BUSINESSMAN':
        onSwitchRole?.('businessman');
        onClose();
        break;
      case 'SWITCH_ROLE_SUPPLIER':
        onSwitchRole?.('supplier');
        onClose();
        break;
      case 'SWITCH_ROLE_CUSTOMER':
        onSwitchRole?.('customer');
        onClose();
        break;
      case 'SWITCH_ROLE_EXPERT':
        onSwitchRole?.('expert');
        onClose();
        break;
      case 'SWITCH_LANG_BN':
      case 'SWITCH_LANG_EN':
      case 'TOGGLE_LANGUAGE':
        onToggleLanguage?.();
        break;
      default:
        onClose();
        break;
    }
  };

  const getActionDisplayName = (actionKey: string): string => {
    switch (actionKey) {
      case 'OPEN_MARKET':
      case 'CHECK_RATES':
      case 'VIEW_RATES':
        return language === 'bn' ? 'বাজার দর পৃষ্ঠায় যান' : 'Go to Market Rates';
      case 'OPEN_WEATHER':
        return language === 'bn' ? 'আবহাওয়া পৃষ্ঠায় যান' : 'Go to Weather Forecast';
      case 'OPEN_DOCTOR':
      case 'DIAGNOSE_CROP':
        return language === 'bn' ? 'ফসলের ডাক্তার খুলুন' : 'Open Crop Doctor';
      case 'OPEN_ORDERS':
      case 'VIEW_ORDERS':
        return language === 'bn' ? 'অর্ডার পৃষ্ঠায় যান' : 'Go to Orders';
      case 'OPEN_LEDGER':
        return language === 'bn' ? 'কৃষক লেজারে যান' : 'Go to Farm Ledger';
      case 'OPEN_BUYERS':
      case 'VIEW_BUYERS':
        return language === 'bn' ? 'ক্রেতাদের ড্যাশবোর্ডে যান' : 'Go to Buyers';
      case 'OPEN_DEALERS':
      case 'FIND_DEALERS':
        return language === 'bn' ? 'সার-কীটনাশক ডিলারদের তালিকায় যান' : 'Go to Input Dealers';
      case 'OPEN_DASHBOARD':
      case 'CREATE_HARVEST':
      case 'LIST_HARVEST':
        return language === 'bn' ? 'ড্যাশবোর্ডে যান' : 'Go to Dashboard';
      default:
        return language === 'bn' ? 'পৃষ্ঠা খুলুন' : 'Open Page';
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
      // Allows user to review and correct recognized text in the input box before manual submission
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-stone-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-xs transition-colors ${isListening ? 'bg-red-500 animate-pulse' : 'bg-teal-600'}`}>
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                {language === 'bn' ? 'নেটিভবাজার ভয়েস ও চ্যাট সহকারী' : 'NativeBazar Bilingual Voice AI'}
              </h3>
              <p className="text-[11px] text-stone-500">
                {language === 'bn'
                  ? 'সহজ বাংলায় কথা বলুন বা কমান্ড দিন — যেমন "বাজার দর দেখাও"'
                  : 'Speak Bangla or type commands — e.g. "Show market rates"'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 font-bold text-sm p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Chat Stream */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'ai' && (
                <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs ${
                  m.sender === 'user'
                    ? 'bg-emerald-700 text-white rounded-br-none'
                    : 'bg-stone-100 text-stone-800 rounded-bl-none border border-stone-200/70'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-line">{m.text}</p>

                {/* Direct executable action banner if matched */}
                {m.executeAction && (
                  <div className="mt-2.5 pt-2 border-t border-stone-200">
                    <button
                      onClick={() => executeActionHandler(m.executeAction!)}
                      className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{getActionDisplayName(m.executeAction)}</span>
                      <ExternalLink className="w-3 h-3 ml-0.5" />
                    </button>
                  </div>
                )}

                {/* Suggested clickable action button - strictly one relevant action without duplicates */}
                {!m.executeAction && m.actions && m.actions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-stone-200 flex flex-wrap gap-1.5">
                    {m.actions.slice(0, 1).map((act, i) => (
                      <button
                        key={i}
                        onClick={() => executeActionHandler(act.action)}
                        className="bg-white hover:bg-teal-50 text-teal-800 border border-teal-300 font-bold text-[11px] px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                      >
                        <span>{act.label}</span>
                        <ArrowRight className="w-3 h-3 text-teal-600" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {m.sender === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-stone-500 text-xs italic pl-9">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{language === 'bn' ? 'এআই উত্তর ও কমান্ড প্রসেস করছে...' : 'Processing query and commands...'}</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Prompts */}
        <div className="pt-2 pb-3 border-t border-stone-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block mb-1.5">
            {language === 'bn' ? 'নমুনা কমান্ড ও প্রশ্ন:' : 'Sample Commands & Queries:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, i) => (
              <button
                key={i}
                onClick={() => handleSendQuery(language === 'bn' ? p.labelBn : p.labelEn)}
                className="bg-stone-50 hover:bg-teal-50 hover:border-teal-300 border border-stone-200 text-stone-700 text-[11px] px-2.5 py-1 rounded-lg text-left transition-colors"
              >
                {language === 'bn' ? p.labelBn : p.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Input Bar */}
        <div className="flex items-center gap-2">
          {/* Mic button */}
          {speechSupported ? (
            <button
              type="button"
              onClick={handleMicToggle}
              title={isListening
                ? (language === 'bn' ? 'থামান' : 'Stop listening')
                : (language === 'bn' ? 'মাইক্রোফোন চালু করুন' : 'Start voice input')}
              className={`p-2.5 rounded-xl shrink-0 transition-all shadow-xs ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                  : 'bg-stone-100 hover:bg-teal-100 text-teal-700 border border-stone-200'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          ) : (
            <div
              title="Speech recognition not supported in this browser"
              className="p-2.5 rounded-xl shrink-0 bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed"
            >
              <MicOff className="w-4 h-4" />
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
                ? 'কমান্ড লিখুন বা মাইকে কথা বলুন...'
                : 'Type query or tap mic to speak...'
            }
            className="flex-1 text-xs border border-stone-300 rounded-xl p-2.5 focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
          />

          <button
            onClick={() => handleSendQuery(query)}
            disabled={!query.trim() || loading}
            className="bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white p-2.5 rounded-xl transition-colors shrink-0 shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Speech notice */}
        {!speechSupported && (
          <p className="text-[10px] text-stone-400 text-center mt-1.5 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            {language === 'bn'
              ? 'ভয়েস ইনপুট Chrome/Edge ব্রাউজারে সর্বোত্তম সমর্থিত'
              : 'Voice recognition best supported on Chrome/Edge'}
          </p>
        )}
      </div>
    </div>
  );
};
