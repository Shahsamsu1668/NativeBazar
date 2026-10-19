import React, { useState, useRef, useMemo } from 'react';
import { CropDiagnosisResult, Language, User } from '../types';
import { requestCropDiagnosis } from '../services/aiService';
import { AuthStore } from '../data/store';
import { BANGLADESH_LOCATIONS } from '../data/mockData';
import {
  Stethoscope,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Store,
  FileText,
  ImagePlus,
  X,
  Info,
  Microscope,
  Phone,
  MessageSquare,
  Building,
  UserCheck,
  Search,
  Filter,
  ShieldCheck,
  GraduationCap,
  CreditCard,
  PhoneCall,
  UserPlus,
  ExternalLink,
  MapPin,
  Mail,
  Award,
} from 'lucide-react';

interface CropDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currentUser?: User | null;
  onSwitchUser?: (user: User) => void;
  onMessageExpert?: (expert: User) => void;
  onCallExpert?: (expert: User) => void;
  initialSubSection?: 'ai_diagnosis' | 'expert_advice';
}

type SubSectionTab = 'ai_diagnosis' | 'expert_advice';

export const CropDoctorModal: React.FC<CropDoctorModalProps> = ({
  isOpen,
  onClose,
  language,
  currentUser,
  onSwitchUser,
  onMessageExpert,
  onCallExpert,
  initialSubSection = 'ai_diagnosis',
}) => {
  // Sub-section navigation
  const [activeTab, setActiveTab] = useState<SubSectionTab>(initialSubSection);

  // AI Diagnosis State
  const [cropName, setCropName] = useState('Tomato');
  const [symptoms, setSymptoms] = useState('Concentric dark brown rings on lower leaves with yellowing margins');
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<CropDiagnosisResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expert Advice State
  const [expertSearch, setExpertSearch] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('all');
  const [showExpertRegistration, setShowExpertRegistration] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    type: 'certificate' | 'nid';
    title: string;
    expertName: string;
    url: string;
    institution?: string;
  } | null>(null);

  // Version counter to trigger refresh when a new expert registers
  const [expertsVersion, setExpertsVersion] = useState(0);

  // Check if an expert user is currently logged in
  const effectiveCurrentUser = currentUser || AuthStore.getCurrentUser();
  const isExpertLoggedIn = !!(effectiveCurrentUser && effectiveCurrentUser.role === 'expert');

  // Display ONLY the currently logged-in expert's profile; empty if no expert is logged in
  const registeredExperts = useMemo(() => {
    if (isExpertLoggedIn && effectiveCurrentUser) {
      return [effectiveCurrentUser];
    }
    return [];
  }, [isExpertLoggedIn, effectiveCurrentUser, expertsVersion, isOpen]);

  // Filtered experts based on user search & specialty selection
  const filteredExperts = useMemo(() => {
    return registeredExperts.filter((expert) => {
      // Role check guarantee: ONLY registered expert users
      if (expert.role !== 'expert') return false;

      // Specialty filter
      if (selectedSpecialty !== 'all') {
        const matchesSpec = (expert.specialization || []).some((s) =>
          s.toLowerCase().includes(selectedSpecialty.toLowerCase())
        );
        if (!matchesSpec) return false;
      }

      // District filter
      if (selectedDistrictFilter !== 'all') {
        if (expert.district.toLowerCase() !== selectedDistrictFilter.toLowerCase()) {
          return false;
        }
      }

      // Search query
      if (expertSearch.trim()) {
        const q = expertSearch.toLowerCase();
        const matchName =
          expert.name.toLowerCase().includes(q) ||
          (expert.nameBn && expert.nameBn.includes(q));
        const matchInstitute = expert.institution?.toLowerCase().includes(q);
        const matchDesignation = expert.designation?.toLowerCase().includes(q);
        const matchDistrict = expert.district.toLowerCase().includes(q);
        const matchSpecialization = (expert.specialization || []).some((s) =>
          s.toLowerCase().includes(q)
        );
        return matchName || matchInstitute || matchDesignation || matchDistrict || matchSpecialization;
      }

      return true;
    });
  }, [registeredExperts, selectedSpecialty, selectedDistrictFilter, expertSearch]);

  if (!isOpen) return null;

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  // AI Diagnosis handlers
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImageError(null);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError(language === 'bn' ? 'শুধুমাত্র ছবি ফাইল আপলোড করুন।' : 'Only image files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError(language === 'bn' ? 'ছবির সাইজ ৫ MB-এর বেশি হওয়া যাবে না।' : 'Image must be under 5 MB.');
      return;
    }

    setImageMimeType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      const base64Part = result.split(',')[1];
      setImageBase64(base64Part);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageBase64(undefined);
    setImageMimeType('image/jpeg');
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDiagnose = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDiagnosis(null);
    try {
      const res = await requestCropDiagnosis(cropName, symptoms, imageBase64, imageMimeType, language);
      setDiagnosis(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpertMessage = (expert: User) => {
    if (onMessageExpert) {
      onMessageExpert(expert);
    }
  };

  const handleExpertCall = (expert: User) => {
    if (onCallExpert) {
      onCallExpert(expert);
    }
  };

  const handleExpertRegisteredSuccess = (newExpert: User) => {
    setExpertsVersion((v) => v + 1);
    if (onSwitchUser) {
      onSwitchUser(newExpert);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col overflow-hidden animate-slide-down">
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-stone-200 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-stone-900 text-base sm:text-lg">
                    {language === 'bn' ? 'নেটিভবাজার ফসলের ডাক্তার' : 'NativeBazar Crop Doctor'}
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 hidden sm:inline-block">
                    BARI & DAE Certified
                  </span>
                </div>
                <p className="text-[11px] text-stone-500">
                  {language === 'bn'
                    ? 'এআই প্রাথমিক রোগ নির্ণয় এবং নিবন্ধিত কৃষি বিশেষজ্ঞদের সাথে সরাসরি যোগাযোগ'
                    : 'AI pathology diagnosis and direct consultation with verified agricultural specialists'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-700 font-bold text-sm p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Sub-section Navigation Tabs */}
          <div className="flex items-center justify-between bg-stone-50/90 border-b border-stone-200 px-4 sm:px-6 pt-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('ai_diagnosis')}
                className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl border-b-2 transition-all ${
                  activeTab === 'ai_diagnosis'
                    ? 'border-emerald-600 text-emerald-800 bg-white shadow-2xs'
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/60'
                }`}
              >
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>{language === 'bn' ? 'এআই রোগ নির্ণয়' : 'AI Pathology Diagnosis'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('expert_advice')}
                className={`flex items-center gap-2 px-4 py-2.5 font-bold text-xs rounded-t-xl border-b-2 transition-all relative ${
                  activeTab === 'expert_advice'
                    ? 'border-teal-600 text-teal-800 bg-white shadow-2xs'
                    : 'border-transparent text-stone-500 hover:text-stone-800 hover:bg-stone-100/60'
                }`}
              >
                <Microscope className="w-4 h-4 text-teal-600" />
                <span>{language === 'bn' ? 'বিশেষজ্ঞ পরামর্শ' : 'Expert Advice'}</span>
                <span className="flex items-center gap-1 bg-teal-100 text-teal-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border border-teal-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
                  {registeredExperts.length}
                </span>
              </button>
            </div>

            {/* Quick Action to open dedicated registration */}
            {activeTab === 'expert_advice' && (
              <button
                type="button"
                onClick={() => setShowExpertRegistration(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs mb-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{language === 'bn' ? 'বিশেষজ্ঞ নিবন্ধন' : 'Register as Expert'}</span>
              </button>
            )}
          </div>

          {/* Scrollable Sub-section Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* ════════ SUB-SECTION 1: AI DIAGNOSIS ════════ */}
            {activeTab === 'ai_diagnosis' && (
              <div className="space-y-4">
                {/* AI Disclaimer Banner */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div className="flex-1 leading-relaxed">
                    <span>
                      {language === 'bn'
                        ? 'সতর্কতা: এটি কেবল এআই ভিত্তিক প্রাথমিক বিশ্লেষণ। কোনো রাসায়নিক ব্যবহারের পূর্বে আমাদের "বিশেষজ্ঞ পরামর্শ" উপ-বিভাগে নিবন্ধিত কৃষি বিশেষজ্ঞের পরামর্শ নিন।'
                        : 'Disclaimer: This is an AI-generated preliminary advisory. For prescription confirmation, consult certified specialists in the "Expert Advice" sub-section.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('expert_advice')}
                    className="shrink-0 text-amber-900 font-bold underline hover:text-amber-950 text-[11px]"
                  >
                    {language === 'bn' ? 'বিশেষজ্ঞ দেখুন →' : 'Consult Experts →'}
                  </button>
                </div>

                {/* Input Form */}
                <form onSubmit={handleDiagnose} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">
                        {language === 'bn' ? 'ফসলের নাম' : 'Select Crop'}
                      </label>
                      <select
                        value={cropName}
                        onChange={(e) => setCropName(e.target.value)}
                        className="w-full border border-stone-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      >
                        <option value="Tomato">Tomato / টমেটো</option>
                        <option value="Potato">Potato / আলু</option>
                        <option value="Chili">Chili / মরিচ</option>
                        <option value="Cauliflower">Cauliflower / ফুলকপি</option>
                        <option value="Rice / Paddy">Rice (BRRI Dhan) / ধান</option>
                        <option value="Pointed Gourd">Pointed Gourd / পটল</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-stone-700 mb-1">
                        {language === 'bn' ? 'সাধারণ রোগ লক্ষণ সিলেক্ট করুন' : 'Common Symptom Presets'}
                      </label>
                      <select
                        onChange={(e) => setSymptoms(e.target.value)}
                        className="w-full border border-stone-300 rounded-lg p-2.5 bg-white focus:outline-hidden"
                      >
                        <option value="Concentric dark brown rings on lower leaves with yellowing margins">
                          Dark concentric brown spots on leaves (Blight)
                        </option>
                        <option value="Water-soaked black lesions on potato leaf tips with white fuzz underneath">
                          Water-soaked black spots on potato leaves (Late Blight)
                        </option>
                        <option value="Leaves curling upwards, stunted bushy growth, yellow veins">
                          Leaf curl &amp; yellow veins (Leaf Curl Virus)
                        </option>
                        <option value="Borer holes in tomato fruits with insect droppings">
                          Fruit borer caterpillar entering tomato
                        </option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-stone-700 mb-1">
                      {language === 'bn' ? 'লক্ষণ বিস্তারিত লিখুন' : 'Detailed Symptoms Description'}
                    </label>
                    <textarea
                      rows={2}
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      className="w-full border border-stone-300 rounded-lg p-2.5 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      required
                    />
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                      <ImagePlus className="w-3.5 h-3.5 text-emerald-600" />
                      {language === 'bn'
                        ? 'ফসলের রোগাক্রান্ত অংশের ছবি আপলোড করুন (ঐচ্ছিক)'
                        : 'Upload Crop Image for Visual Analysis (Optional)'}
                    </label>

                    {imagePreview ? (
                      <div className="relative inline-block">
                        <img
                          src={imagePreview}
                          alt="crop preview"
                          className="h-28 w-auto rounded-xl border border-stone-300 object-cover shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xs hover:bg-red-700"
                          title="Remove image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <p className="text-[10px] text-emerald-700 mt-1 font-semibold">
                          {language === 'bn'
                            ? '✓ ছবি প্রস্তুত — এআই ভিজ্যুয়াল বিশ্লেষণ সক্রিয়'
                            : '✓ Image ready — AI visual analysis enabled'}
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-stone-300 hover:border-emerald-500 rounded-xl text-stone-500 hover:text-emerald-700 transition-colors w-full justify-center"
                      >
                        <Upload className="w-4 h-4" />
                        <span>
                          {language === 'bn'
                            ? 'ছবি বেছে নিন (JPG/PNG, সর্বোচ্চ ৫ MB)'
                            : 'Choose Photo (JPG/PNG, max 5 MB)'}
                        </span>
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    {imageError && (
                      <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {imageError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-stone-500 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Gemini Flash Multimodal Pathology Engine
                    </span>

                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{language === 'bn' ? 'বিশ্লেষণ চলছে...' : 'Analyzing...'}</span>
                        </>
                      ) : (
                        <>
                          <Stethoscope className="w-3.5 h-3.5" />
                          <span>{language === 'bn' ? 'রোগ নির্ণয় করুন' : 'Run AI Diagnosis'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Diagnosis Results Card */}
                {diagnosis && (
                  <div className="mt-5 p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 text-xs space-y-3.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                          {diagnosis.severity} Severity • {diagnosis.confidence}% AI Confidence
                        </span>
                        <h4 className="text-base font-extrabold text-stone-900 mt-1">
                          {language === 'bn' ? diagnosis.diseaseBanglaName : diagnosis.diseaseName}
                        </h4>
                        <p className="text-[11px] text-stone-500">{diagnosis.diseaseName}</p>
                      </div>

                      {diagnosis.verifiedBySAAO === true && (
                        <div className="flex items-center gap-1 bg-white border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>SAAO Verified</span>
                        </div>
                      )}
                    </div>

                    <p className="text-stone-700 text-xs leading-relaxed bg-white/80 p-2.5 rounded-lg border border-emerald-100">
                      <strong>Summary:</strong> {diagnosis.symptomsSummary}
                    </p>

                    {/* Treatment Breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-1">
                        <span className="font-bold text-emerald-900 block text-xs flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-emerald-600" />
                          {language === 'bn' ? 'অনুমোদিত বালাইনাশক চিকিৎসা' : 'Chemical Recommendation'}
                        </span>
                        <p className="font-semibold text-stone-900 text-[11px]">
                          {diagnosis.chemicalTreatment.medicine}
                        </p>
                        <p className="text-stone-600 text-[10px]">
                          <strong>Dose:</strong> {diagnosis.chemicalTreatment.dose}
                        </p>
                        <p className="text-stone-600 text-[10px]">
                          <strong>Schedule:</strong> {diagnosis.chemicalTreatment.schedule}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-lg border border-stone-200 space-y-1">
                        <span className="font-bold text-teal-900 block text-xs flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                          {language === 'bn' ? 'জৈব ও প্রাকৃতিক প্রতিকার' : 'Organic Botanical Remedy'}
                        </span>
                        <p className="text-stone-700 text-[11px] leading-relaxed">
                          {diagnosis.organicTreatment}
                        </p>
                      </div>
                    </div>

                    {/* Immediate Actions */}
                    <div>
                      <span className="font-bold text-stone-800 text-[11px] block mb-1">
                        {language === 'bn' ? 'তাৎক্ষণিক করণীয় পদক্ষেপ:' : 'Immediate Cultural Actions:'}
                      </span>
                      <ul className="list-disc pl-4 space-y-0.5 text-stone-600 text-[11px]">
                        {diagnosis.immediateActions.map((action, idx) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Connect with registered expert callout */}
                    <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <Microscope className="w-5 h-5 text-teal-700 shrink-0" />
                        <div>
                          <span className="font-bold text-teal-950 block text-xs">
                            {language === 'bn'
                              ? 'বিশেষজ্ঞের দ্বিতীয় মতামত চান?'
                              : 'Want a second opinion on this diagnosis?'}
                          </span>
                          <span className="text-[11px] text-teal-800">
                            {language === 'bn'
                              ? 'নিবন্ধিত কৃষি বিশেষজ্ঞের সাথে মেসেজ বা সরাসরি ভয়েস কলে কথা বলুন।'
                              : 'Chat or call directly with verified agronomists in Expert Advice.'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('expert_advice')}
                        className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 self-start sm:self-auto"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'বিশেষজ্ঞদের তালিকা দেখুন' : 'Consult Experts'}</span>
                      </button>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-emerald-200/80">
                      <span className="text-[10px] text-stone-500">
                        {language === 'bn'
                          ? 'নিকটবর্তী অনুমোদিত ডিলারের কাছে ওষুধ খুঁজুন'
                          : 'Order treatment from matched local dealer'}
                      </span>
                      <button
                        onClick={onClose}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1"
                      >
                        <Store className="w-3.5 h-3.5" />
                        <span>{language === 'bn' ? 'ডিলার স্টক দেখুন' : 'Find Dealer Stock'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════════ SUB-SECTION 2: EXPERT ADVICE ════════ */}
            {activeTab === 'expert_advice' && (
              <div className="space-y-4">
                {/* Expert Advice Banner */}
                <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 rounded-2xl p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="inline-flex items-center gap-1.5 bg-teal-700/60 border border-teal-500/40 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-teal-100 mb-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                        <span>
                          {language === 'bn'
                            ? 'শুধুমাত্র নিবন্ধিত ও যাচাইকৃত কৃষি বিশেষজ্ঞ'
                            : 'Registered & Certified Agricultural Specialists Only'}
                        </span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-extrabold tracking-tight">
                        {language === 'bn'
                          ? 'কৃষি বিশেষজ্ঞ পরামর্শ কেন্দ্র'
                          : 'Verified Agricultural Expert Advice'}
                      </h3>
                      <p className="text-teal-100/90 text-xs mt-1 max-w-xl leading-relaxed">
                        {language === 'bn'
                          ? 'বাংলাদেশ কৃষি গবেষণা ইনস্টিটিউট (BARI), কৃষি বিশ্ববিদ্যালয় (BAU) ও কৃষি সম্প্রসারণ অধিদপ্তর (DAE)-এর অনুমোদিত বিশেষজ্ঞদের সাথে বার্তা ও কলের মাধ্যমে সরাসরি পরামর্শ নিন।'
                          : 'Connect directly with certified specialists from BARI, BAU, DAE, and BRRI. Initiate encrypted chat messages or VoIP calls for personalized crop prescriptions.'}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowExpertRegistration(true)}
                        className="bg-white hover:bg-teal-50 text-teal-900 px-4 py-2.5 rounded-xl font-extrabold text-xs shadow-md flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                      >
                        <UserPlus className="w-4 h-4 text-teal-600" />
                        <span>{language === 'bn' ? 'বিশেষজ্ঞ নিবন্ধন করুন' : 'Register as Expert'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2.5">
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={expertSearch}
                        onChange={(e) => setExpertSearch(e.target.value)}
                        placeholder={
                          language === 'bn'
                            ? 'নাম, প্রতিষ্ঠান (BARI, DAE, BAU...), বা বিশেষজ্ঞতা দিয়ে খুঁজুন...'
                            : 'Search by expert name, institute (BARI, BAU...), or specialty...'
                        }
                        className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                      />
                      {expertSearch && (
                        <button
                          type="button"
                          onClick={() => setExpertSearch('')}
                          className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* District Filter */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <select
                        value={selectedDistrictFilter}
                        onChange={(e) => setSelectedDistrictFilter(e.target.value)}
                        className="text-xs bg-white border border-stone-300 rounded-lg px-2.5 py-2 font-medium text-stone-700 focus:outline-hidden w-full sm:w-auto"
                      >
                        <option value="all">
                          {language === 'bn' ? 'সকল জেলা' : 'All Districts'}
                        </option>
                        {BANGLADESH_LOCATIONS.map((loc) => (
                          <option key={loc.district} value={loc.district}>
                            {loc.district} ({loc.districtBn})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Specialty Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                    <span className="text-stone-500 font-bold shrink-0">
                      {language === 'bn' ? 'ক্ষেত্র:' : 'Specialty:'}
                    </span>
                    {[
                      { id: 'all', label: language === 'bn' ? 'সকল বিশেষজ্ঞ' : 'All Specialties' },
                      { id: 'Pathology', label: language === 'bn' ? 'উদ্ভিদ রোগতত্ত্ব' : 'Plant Pathology' },
                      { id: 'Entomology', label: language === 'bn' ? 'কীটতত্ত্ব ও পোকা' : 'Entomology' },
                      { id: 'Soil', label: language === 'bn' ? 'মাটি ও সার' : 'Soil & Fertilizer' },
                      { id: 'Horticulture', label: language === 'bn' ? 'উদ্যানতত্ত্ব' : 'Horticulture' },
                      { id: 'Agronomy', label: language === 'bn' ? 'মাঠ ফসল' : 'Agronomy' },
                    ].map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setSelectedSpecialty(chip.id)}
                        className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                          selectedSpecialty === chip.id
                            ? 'bg-teal-700 text-white shadow-2xs'
                            : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Registered Expert Cards Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-stone-500 font-medium px-1">
                    <span>
                      {isExpertLoggedIn
                        ? (language === 'bn'
                            ? `লগইনকৃত বিশেষজ্ঞ প্রোফাইল (${filteredExperts.length})`
                            : `Currently logged-in expert (${filteredExperts.length})`)
                        : (language === 'bn'
                            ? 'বর্তমানে কোনো কৃষি বিশেষজ্ঞ উপলব্ধ নেই'
                            : 'No agricultural experts are currently available.')}
                    </span>
                    <span className="text-[11px] text-teal-700 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {language === 'bn' ? 'এনআইডি ও ডিগ্রি সনদ যাচাইকৃত' : 'NID & Degree Verified'}
                    </span>
                  </div>

                  {filteredExperts.length === 0 ? (
                    <div className="bg-stone-50 border border-dashed border-stone-300 rounded-2xl p-8 text-center space-y-3">
                      <Microscope className="w-10 h-10 text-stone-300 mx-auto" />
                      <h4 className="font-bold text-stone-800 text-sm">
                        {!isExpertLoggedIn
                          ? (language === 'bn'
                              ? 'বর্তমানে কোনো কৃষি বিশেষজ্ঞ উপলব্ধ নেই।'
                              : 'No agricultural experts are currently available.')
                          : (language === 'bn'
                              ? 'অনুসন্ধানের সাথে কোনো বিশেষজ্ঞ মেলেনি'
                              : 'No experts match your search criteria')}
                      </h4>
                      <p className="text-xs text-stone-500 max-w-sm mx-auto">
                        {!isExpertLoggedIn
                          ? (language === 'bn'
                              ? 'শুধুমাত্র বর্তমানে লগইনকৃত কৃষি বিশেষজ্ঞের প্রোফাইল এখানে প্রদর্শিত হবে।'
                              : 'Only the currently logged-in agricultural expert profile is displayed.')
                          : (language === 'bn'
                              ? 'ফিল্টার বা অনুসন্ধানের শব্দ পরিবর্তন করে চেষ্টা করুন।'
                              : 'Try clearing your search filters to view your profile.')}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowExpertRegistration(true)}
                        className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{language === 'bn' ? 'বিশেষজ্ঞ নিবন্ধন করুন' : 'Register as an Expert'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {filteredExperts.map((expert) => {
                        const isOnline = true;
                        return (
                          <div
                            key={expert.id}
                            className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                          >
                            <div className="space-y-2.5">
                              {/* Top Profile Header */}
                              <div className="flex items-start gap-3">
                                <div className="relative shrink-0">
                                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-700 text-white font-extrabold text-sm flex items-center justify-center shadow-xs">
                                    {expert.name
                                      .split(' ')
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join('')}
                                  </div>
                                  <span
                                    className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white absolute -bottom-0.5 -right-0.5 shadow-2xs"
                                    title="Online for consultation"
                                  />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="font-extrabold text-stone-900 text-sm truncate">
                                      {expert.name}
                                    </h4>
                                    <span className="bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                      <ShieldCheck className="w-3 h-3 text-teal-600" />
                                      {language === 'bn' ? 'যাচাইকৃত' : 'Verified'}
                                    </span>
                                  </div>
                                  {expert.nameBn && (
                                    <p className="text-[11px] text-stone-500 font-medium">
                                      {expert.nameBn}
                                    </p>
                                  )}
                                  <p className="text-xs font-semibold text-teal-800 flex items-center gap-1 mt-0.5 truncate">
                                    <Award className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                    <span>{expert.designation || 'Agricultural Specialist'}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Institution Badge */}
                              <div className="p-2 bg-stone-50 rounded-xl border border-stone-200 text-[11px] text-stone-700 flex items-start gap-1.5">
                                <Building className="w-3.5 h-3.5 text-stone-500 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <span className="font-bold text-stone-900 block truncate">
                                    {expert.institution || 'National Agricultural Research System'}
                                  </span>
                                  <span className="text-[10px] text-stone-500 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {expert.district}
                                    {expert.upazila ? `, ${expert.upazila}` : ''}
                                  </span>
                                </div>
                              </div>

                              {/* Specialization Tags */}
                              {(expert.specialization || []).length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {(expert.specialization || []).map((spec, i) => (
                                    <span
                                      key={i}
                                      className="bg-teal-50 border border-teal-200/80 text-teal-900 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    >
                                      {spec}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Document Verification Proof Chips */}
                              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
                                {expert.certificatePhotoUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewDoc({
                                        type: 'certificate',
                                        title: 'Degree / Academic Certificate',
                                        expertName: expert.name,
                                        url: expert.certificatePhotoUrl!,
                                        institution: expert.institution,
                                      })
                                    }
                                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                                  >
                                    <FileText className="w-3 h-3 text-emerald-600" />
                                    <span>{language === 'bn' ? 'সনদপত্র দেখুন' : 'Certificate Verified'}</span>
                                  </button>
                                )}

                                {expert.nidPhotoUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewDoc({
                                        type: 'nid',
                                        title: 'National Identity Card (NID)',
                                        expertName: expert.name,
                                        url: expert.nidPhotoUrl!,
                                        institution: expert.institution,
                                      })
                                    }
                                    className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                                  >
                                    <CreditCard className="w-3 h-3 text-blue-600" />
                                    <span>{language === 'bn' ? 'NID কার্ড দেখুন' : 'NID Verified'}</span>
                                  </button>
                                )}

                                <span className="text-stone-400 ml-auto text-[10px]">
                                  {expert.phone}
                                </span>
                              </div>
                            </div>

                            {/* ─── REQUIRED ACTIONS: Message and Call ─── */}
                            <div className="pt-3 border-t border-stone-200 grid grid-cols-2 gap-2">
                              {/* Message Action */}
                              <button
                                type="button"
                                onClick={() => handleExpertMessage(expert)}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-bold transition-all shadow-2xs hover:-translate-y-0.2"
                                title={
                                  language === 'bn'
                                    ? `${expert.name}-কে বার্তা পাঠান`
                                    : `Send direct message to ${expert.name}`
                                }
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-teal-700" />
                                <span>{language === 'bn' ? 'বার্তা পাঠান' : 'Message'}</span>
                              </button>

                              {/* Call Action */}
                              <button
                                type="button"
                                onClick={() => handleExpertCall(expert)}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:-translate-y-0.2"
                                title={
                                  language === 'bn'
                                    ? `${expert.name}-কে কল করুন`
                                    : `Start voice call with ${expert.name}`
                                }
                              >
                                <PhoneCall className="w-3.5 h-3.5 text-emerald-200" />
                                <span>{language === 'bn' ? 'কল করুন' : 'Call'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Expert Consultation Notice */}
                <div className="p-4 bg-gradient-to-r from-stone-100 to-teal-50/50 border border-stone-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <h5 className="font-extrabold text-stone-900 text-xs">
                      {language === 'bn'
                        ? 'কৃষি বৈজ্ঞানিক ও সম্প্রসারণ কর্মকর্তাদের পরামর্শ সেবা'
                        : 'Agronomist & Extension Advisory Support'}
                    </h5>
                    <p className="text-stone-500 text-[11px] mt-0.5">
                      {language === 'bn'
                        ? 'নেটিভবাজার এআই ফসলের ডাক্তার এবং সংশ্লিষ্ট জেলা কৃষি সম্প্রসারণ অধিদপ্তরের (DAE) তথ্যের ভিত্তিতে পরামর্শ প্রদান করা হয়।'
                        : 'Advisories are backed by NativeBazar AI diagnostic engines and regional DAE agronomical guidelines.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verified Document Preview Modal (Certificate / NID) */}
      {previewDoc && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 max-w-xl w-full p-5 space-y-4 animate-slide-down">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h4 className="font-extrabold text-stone-900 text-sm">
                    {previewDoc.title}
                  </h4>
                  <p className="text-[11px] text-stone-500">
                    {previewDoc.expertName} • {previewDoc.institution}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-stone-400 hover:text-stone-600 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-stone-100 rounded-xl p-2 border border-stone-200 flex items-center justify-center overflow-hidden">
              <img
                src={previewDoc.url}
                alt={previewDoc.title}
                className="max-h-[60vh] w-auto rounded-lg object-contain shadow-xs bg-white"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
              <span className="flex items-center gap-1 text-emerald-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified Document via NativeBazar Expert Registry
              </span>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-3 py-1.5 bg-stone-900 text-white rounded-lg font-bold text-xs"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
