import React, { useState, useEffect } from 'react';
import { User, Language, UserRole } from '../types';
import { CallStore } from '../data/store';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ShieldCheck,
  ExternalLink,
  Sprout,
  Briefcase,
  Store,
  ShoppingCart,
  Microscope,
} from 'lucide-react';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  contactUser: User;
  language: Language;
}

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  farmer: <Sprout className="w-3.5 h-3.5" />,
  wholesaler: <Briefcase className="w-3.5 h-3.5" />,
  retailer: <Store className="w-3.5 h-3.5" />,
  consumer: <ShoppingCart className="w-3.5 h-3.5" />,
  businessman: <Briefcase className="w-3.5 h-3.5" />,
  supplier: <Store className="w-3.5 h-3.5" />,
  customer: <ShoppingCart className="w-3.5 h-3.5" />,
  expert: <Microscope className="w-3.5 h-3.5" />,
  admin: <ShieldCheck className="w-3.5 h-3.5" />,
};

const ROLE_NAMES: Record<UserRole, { en: string; bn: string }> = {
  farmer: { en: 'Farmer', bn: 'কৃষক' },
  wholesaler: { en: 'Wholesaler', bn: 'পাইকার' },
  retailer: { en: 'Retailer', bn: 'খুচরা বিক্রেতা' },
  consumer: { en: 'Consumer', bn: 'ভোক্তা' },
  businessman: { en: 'Trader / Buyer', bn: 'ব্যবসায়ী' },
  supplier: { en: 'Agri Supplier', bn: 'সরবরাহকারী' },
  customer: { en: 'Consumer', bn: 'ভোক্তা' },
  expert: { en: 'Agri Expert', bn: 'কৃষি বিশেষজ্ঞ' },
  admin: { en: 'Platform Admin', bn: 'অ্যাডমিন' },
};

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  contactUser,
  language,
}) => {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);

  // Auto-connect after 2.5s for realistic simulation
  useEffect(() => {
    if (!isOpen) {
      setCallStatus('ringing');
      setSeconds(0);
      return;
    }

    setCallStatus('ringing');
    setSeconds(0);

    const connectTimer = setTimeout(() => {
      setCallStatus('connected');
    }, 2400);

    return () => clearTimeout(connectTimer);
  }, [isOpen, contactUser.id]);

  // Call timer
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  if (!isOpen) return null;

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setCallStatus('ended');
    CallStore.add({
      callerId: currentUser.id,
      callerName: currentUser.name,
      callerRole: currentUser.role,
      receiverId: contactUser.id,
      receiverName: contactUser.name,
      receiverRole: contactUser.role,
      receiverPhone: contactUser.phone,
      status: seconds > 0 ? 'completed' : 'cancelled',
      durationSeconds: seconds,
    });
    setTimeout(() => {
      onClose();
      setCallStatus('ringing');
      setSeconds(0);
    }, 500);
  };

  const cleanPhone = contactUser.phone.replace(/\D/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-gradient-to-b from-stone-900 via-stone-850 to-stone-900 border border-stone-700/80 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-white flex flex-col items-center p-6 sm:p-8 space-y-6 relative">
        {/* Subtle glowing animated background pulse */}
        <div className="absolute -top-24 -left-24 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header info */}
        <div className="w-full flex items-center justify-between text-xs text-stone-400">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            {t('Encrypted Agri-VoIP', 'সুরক্ষিত এগ্রি-ভয়েস কল')}
          </span>
          <span className="text-[11px] bg-stone-800/80 border border-stone-700 px-2 py-0.5 rounded-full text-stone-300">
            HD Voice 48kHz
          </span>
        </div>

        {/* Contact Avatar with pulsing ripple rings */}
        <div className="relative my-2 flex items-center justify-center">
          {callStatus === 'ringing' && (
            <>
              <div className="absolute w-28 h-28 rounded-full border border-emerald-500/30 animate-ping pointer-events-none" />
              <div className="absolute w-36 h-36 rounded-full border border-emerald-500/20 animate-pulse pointer-events-none" />
            </>
          )}

          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-xl border-4 border-stone-800">
            {contactUser.name.charAt(0)}
          </div>
        </div>

        {/* Contact Details */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-black text-white tracking-tight">
            {contactUser.name}
          </h2>
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-400">
            {ROLE_ICONS[contactUser.role]}
            <span>{t(ROLE_NAMES[contactUser.role].en, ROLE_NAMES[contactUser.role].bn)}</span>
            <span className="text-stone-500">•</span>
            <span className="text-stone-300">{contactUser.district}</span>
          </div>
          <p className="text-xs text-stone-400 font-mono tracking-wider pt-0.5">
            {contactUser.phone}
          </p>
        </div>

        {/* Call Status & Timer */}
        <div className="text-center py-1">
          {callStatus === 'ringing' ? (
            <div className="flex items-center justify-center gap-2 text-stone-400 text-sm font-medium animate-pulse">
              <Phone className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>{t('Ringing… Connecting to user', 'ডায়াল করা হচ্ছে… সংযোগ চলছে')}</span>
            </div>
          ) : callStatus === 'connected' ? (
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 rounded-full text-emerald-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{t('Call Connected', 'সংযোগ স্থাপিত')}</span>
              </div>
              <p className="text-2xl font-mono font-black text-white tracking-widest">
                {formatTimer(seconds)}
              </p>
            </div>
          ) : (
            <span className="text-red-400 text-xs font-bold">{t('Call Ended', 'কল সমাপ্ত')}</span>
          )}
        </div>

        {/* Controls row */}
        <div className="w-full flex items-center justify-center gap-6 pt-2">
          {/* Mute */}
          <button
            onClick={() => setIsMuted((v) => !v)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* End Call (Red Button) */}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-xl shadow-red-600/40 transition-transform active:scale-95"
            title="End Call"
          >
            <PhoneOff className="w-7 h-7" />
          </button>

          {/* Speaker */}
          <button
            onClick={() => setIsSpeaker((v) => !v)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isSpeaker
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
            }`}
            title={isSpeaker ? 'Speaker On' : 'Speaker Off'}
          >
            {isSpeaker ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>

        {/* Fallback Direct SIM Call button */}
        <div className="w-full pt-3 border-t border-stone-800 text-center">
          <a
            href={`tel:${cleanPhone}`}
            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-semibold"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{t('Or Dial via Mobile SIM Network', 'অথবা মোবাইল সিম নেটওয়ার্কে ডায়াল করুন')}</span>
            <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
          </a>
        </div>
      </div>
    </div>
  );
};
