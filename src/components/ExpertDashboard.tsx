import React, { useState } from 'react';
import { AgroAdvisory, Language } from '../types';
import {
  Microscope,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  BellRing,
  Send,
  FileCheck,
  ShieldCheck,
  Stethoscope,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';

interface ExpertDashboardProps {
  advisories: AgroAdvisory[];
  onAddAdvisory: (newAdvisory: Partial<AgroAdvisory>) => void;
  language: Language;
}

interface PendingReview {
  id: string;
  farmerName: string;
  phone: string;
  location: string;
  crop: string;
  aiSuspectedDisease: string;
  confidence: number;
  symptoms: string;
  aiPrescription: string;
  status: 'Pending' | 'Verified';
}

export const ExpertDashboard: React.FC<ExpertDashboardProps> = ({
  advisories,
  onAddAdvisory,
  language,
}) => {
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Advisory Form
  const [title, setTitle] = useState('');
  const [titleBn, setTitleBn] = useState('');
  const [category, setCategory] = useState<'Weather Alert' | 'Pest Outbreak' | 'Soil Advice'>('Weather Alert');
  const [message, setMessage] = useState('');
  const [messageBn, setMessageBn] = useState('');
  const [severity, setSeverity] = useState<'Warning' | 'Urgent' | 'Information'>('Warning');

  // Pending farmer AI diagnosis verifications (Directly solving the SWOT analysis risk)
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([
    {
      id: 'rev-1',
      farmerName: 'Md. Rafiqul Islam (রফিকুল ইসলাম)',
      phone: '+880 1712-458920',
      location: 'Shibganj, Bogura',
      crop: 'Hybrid Tomato',
      aiSuspectedDisease: 'Early Blight (Alternaria solani)',
      confidence: 93,
      symptoms: 'Concentric brown rings on lower leaves, mild yellow halo.',
      aiPrescription: 'Mancozeb 75 WP @ 2g/L water + proper root drainage.',
      status: 'Pending',
    },
    {
      id: 'rev-2',
      farmerName: 'Abul Kashem Mondol',
      phone: '+880 1823-991204',
      location: 'Sherpur, Bogura',
      crop: 'Diamond Potato',
      aiSuspectedDisease: 'Late Blight (Phytophthora infestans)',
      confidence: 89,
      symptoms: 'Water-soaked blackish lesions on leaf tips with white mildew underneath.',
      aiPrescription: 'Ridomil Gold MZ (Metalaxyl + Mancozeb) @ 2.5g/L water.',
      status: 'Pending',
    },
  ]);

  const handleVerify = (id: string) => {
    setPendingReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'Verified' } : r))
    );
  };

  const handleSubmitAdvisory = (e: React.FormEvent) => {
    e.preventDefault();
    onAddAdvisory({
      expertName: 'Dr. Mohammad Akramuzzaman',
      designation: 'Senior Scientific Officer, BARI Bogura Regional Station',
      title,
      titleBn: titleBn || title,
      category,
      message,
      messageBn: messageBn || message,
      severity,
      district: 'Bogura & Rajshahi Zone',
      date: 'Just now',
    });
    setShowBroadcastModal(false);
    setTitle('');
    setMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-teal-800/60 border border-teal-400/30 px-3 py-1 rounded-full text-xs font-semibold text-teal-200 mb-2">
              <Microscope className="w-3.5 h-3.5 text-teal-300" />
              <span>{language === 'bn' ? 'কৃষি সম্প্রসারণ ও বিশেষজ্ঞ পোর্টাল (DAE / BARI)' : 'Agronomy Expert & Extension Portal'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {language === 'bn' ? 'কৃষি বিশেষজ্ঞ ড্যাশবোর্ড' : 'Agronomist Command Center'}
            </h1>
            <p className="text-teal-100/90 text-sm mt-1 max-w-2xl">
              {language === 'bn'
                ? 'এসডব্লিউওটি (SWOT) বিশ্লেষণ অনুযায়ী: এআই-এর রোগ নির্ণয় বিশেষজ্ঞদের দ্বারা যাচাইকরণ ও আঞ্চলিক কৃষকদের দ্রুত বার্তা পাঠানোর প্ল্যাটফর্ম।'
                : 'Closing the AI reliability gap: Agronomist verification queue for AI plant diagnoses & regional warning broadcasts.'}
            </p>
          </div>

          <button
            onClick={() => setShowBroadcastModal(true)}
            className="bg-white hover:bg-teal-50 text-teal-900 px-4 py-2.5 rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all hover:scale-102"
          >
            <BellRing className="w-4 h-4 text-teal-600" />
            <span>{language === 'bn' ? 'আঞ্চলিক সতর্কতা জারি করুন' : 'Broadcast Agro Advisory'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Expert Verification Queue & Active Advisories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: AI Diagnosis Triage Queue (SWOT Solution) */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-teal-600" />
                <span>{language === 'bn' ? 'এআই রোগ নির্ণয় যাচাইকরণ কিউ' : 'AI Crop Diagnosis Verification Queue'}</span>
              </h2>
              <p className="text-xs text-stone-500">
                {language === 'bn'
                  ? 'কৃষকদের ভুল ওষুধ প্রতিরোধে উপ-সহকারী কৃষি কর্মকর্তা (SAAO) কর্তৃক অনুমোদন'
                  : 'Expert oversight to prevent crop damage from incorrect AI detections'}
              </p>
            </div>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingReviews.filter((r) => r.status === 'Pending').length} Pending
            </span>
          </div>

          <div className="space-y-3.5">
            {pendingReviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-white transition-all text-xs space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-stone-900 text-sm">{rev.farmerName}</span>
                    <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-stone-400" />
                      {rev.location} • {rev.crop}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rev.status === 'Verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {rev.status === 'Verified' ? '✓ Expert Verified' : 'Awaiting Review'}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-stone-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800">AI Suspected: {rev.aiSuspectedDisease}</span>
                    <span className="text-[10px] text-teal-700 font-semibold">{rev.confidence}% Confidence</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    <strong>Symptoms:</strong> {rev.symptoms}
                  </p>
                  <p className="text-[11px] text-stone-600">
                    <strong>AI Recommendation:</strong> {rev.aiPrescription}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {rev.status === 'Pending' ? (
                    <button
                      onClick={() => handleVerify(rev.id)}
                      className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'যাচাই ও অনুমোদন করুন' : 'Approve Prescription'}</span>
                    </button>
                  ) : (
                    <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" />
                      Official Prescription Issued
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Active Advisories Broadcasted */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <BellRing className="w-5 h-5 text-teal-600" />
                <span>{language === 'bn' ? 'প্রচারিত কৃষি ও আবহাওয়া সতর্কতা' : 'Broadcasted Regional Bulletins'}</span>
              </h2>
              <p className="text-xs text-stone-500">
                {language === 'bn'
                  ? 'বগুড়া জেলার সকল কৃষক ও ব্যবসায়ীদের জন্য পাঠানো বার্তা'
                  : 'Real-time advisories pushed to Bogura farmer apps and SMS'}
              </p>
            </div>

            <button
              onClick={() => setShowBroadcastModal(true)}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200"
            >
              + New Bulletin
            </button>
          </div>

          <div className="space-y-3.5">
            {advisories.map((adv) => (
              <div
                key={adv.id}
                className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-white transition-all text-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        adv.severity === 'Warning'
                          ? 'bg-amber-100 text-amber-800'
                          : adv.severity === 'Urgent'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {adv.category} • {adv.severity}
                    </span>
                    <h3 className="font-bold text-stone-900 text-sm mt-1.5">
                      {language === 'bn' ? adv.titleBn : adv.title}
                    </h3>
                  </div>
                  <span className="text-[10px] text-stone-400 shrink-0">{adv.date}</span>
                </div>

                <p className="text-stone-600 text-xs leading-relaxed">
                  {language === 'bn' ? adv.messageBn : adv.message}
                </p>

                <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-[11px] text-stone-500">
                  <span>Author: {adv.expertName}</span>
                  <span className="font-medium text-teal-700">{adv.district}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Broadcast Agro Advisory */}
      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <h3 className="font-bold text-stone-900 text-base flex items-center gap-2">
                <BellRing className="w-5 h-5 text-teal-600" />
                <span>{language === 'bn' ? 'আঞ্চলিক কৃষি বুলেটিন জারি করুন' : 'Broadcast Regional Agro Bulletin'}</span>
              </h3>
              <button
                onClick={() => setShowBroadcastModal(false)}
                className="text-stone-400 hover:text-stone-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAdvisory} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Bulletin Title (English)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Heavy Fog Advisory: Potato Late Blight Prevention"
                  className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">শিরোনাম (বাংলা)</label>
                <input
                  type="text"
                  value={titleBn}
                  onChange={(e) => setTitleBn(e.target.value)}
                  placeholder="যেমন: কুয়াশা সতর্কতা: আলুর নাবি ধসা রোগ প্রতিরোধ"
                  className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full border border-stone-300 rounded-lg p-2.5 bg-white focus:outline-hidden"
                  >
                    <option value="Weather Alert">Weather Alert / আবহাওয়া সতর্কতা</option>
                    <option value="Pest Outbreak">Pest Outbreak / পোকা বা রোগ সংক্রমণ</option>
                    <option value="Soil Advice">Soil & Fertilizer / সার ও মাটি ব্যবস্থাপনা</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">Severity</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as any)}
                    className="w-full border border-stone-300 rounded-lg p-2.5 bg-white focus:outline-hidden"
                  >
                    <option value="Warning">Warning / সতর্কতা</option>
                    <option value="Urgent">Urgent / জরুরি</option>
                    <option value="Information">Information / তথ্য</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">Advisory Advice Details</label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Provide precise preventive steps, medicine doses, and cultural practices..."
                  className="w-full border border-stone-300 rounded-lg p-2.5 focus:outline-hidden"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast to District</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
