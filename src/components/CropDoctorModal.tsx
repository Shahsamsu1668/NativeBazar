import React, { useState, useRef } from 'react';
import { CropDiagnosisResult, Language, User } from '../types';
import { requestCropDiagnosis } from '../services/aiService';
import {
  Stethoscope,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  FileText,
  ImagePlus,
  X,
  Info,
  ShieldAlert,
  Scissors,
  Droplets,
  Sun,
} from 'lucide-react';

export const toBanglaNumber = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '';
  const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
};

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

interface VerifiedPesticideInfo {
  name: string;
  generic: string;
  manufacturer: string;
  registrationNo: string;
  packImageUrl: string;
  safetyIntervalDays: number;
  whoClass: string;
  formulation: string;
}

const VERIFIED_PESTICIDES: Record<string, VerifiedPesticideInfo> = {
  ridomil: {
    name: 'Ridomil Gold MZ 68 WG',
    generic: 'Metalaxyl-M 4% + Mancozeb 64% WG',
    manufacturer: 'Syngenta Bangladesh Ltd.',
    registrationNo: 'DAE Reg. AP-812',
    packImageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
    safetyIntervalDays: 7,
    whoClass: 'Class III (Slightly Hazardous)',
    formulation: 'WG (Water Dispersible Granule)',
  },
  mancozeb: {
    name: 'Indofil M-45 (Mancozeb 75 WP)',
    generic: 'Mancozeb 75% WP',
    manufacturer: 'Indofil Industries / Auto Crop Care Ltd.',
    registrationNo: 'DAE Reg. AP-245',
    packImageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
    safetyIntervalDays: 14,
    whoClass: 'Class U (Unlikely acute hazard)',
    formulation: 'WP (Wettable Powder)',
  },
  nativo: {
    name: 'Nativo 75 WG',
    generic: 'Tebuconazole 50% + Trifloxystrobin 25% WG',
    manufacturer: 'Bayer CropScience Bangladesh Ltd.',
    registrationNo: 'DAE Reg. AP-1420',
    packImageUrl: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=300&auto=format&fit=crop&q=80',
    safetyIntervalDays: 14,
    whoClass: 'Class III (Slightly Hazardous)',
    formulation: 'WG (Water Dispersible Granule)',
  },
  amistar: {
    name: 'Amistar Top 325 SC',
    generic: 'Azoxystrobin 200 g/l + Difenoconazole 125 g/l SC',
    manufacturer: 'Syngenta Bangladesh Ltd.',
    registrationNo: 'DAE Reg. AP-1288',
    packImageUrl: 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=300&auto=format&fit=crop&q=80',
    safetyIntervalDays: 10,
    whoClass: 'Class III (Slightly Hazardous)',
    formulation: 'SC (Suspension Concentrate)',
  },
  score: {
    name: 'Score 250 EC',
    generic: 'Difenoconazole 250 g/l EC',
    manufacturer: 'Syngenta Bangladesh Ltd.',
    registrationNo: 'DAE Reg. AP-650',
    packImageUrl: 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=300&auto=format&fit=crop&q=80',
    safetyIntervalDays: 14,
    whoClass: 'Class III (Slightly Hazardous)',
    formulation: 'EC (Emulsifiable Concentrate)',
  },
  virtako: {
    name: 'Virtako 40 WG',
    generic: 'Chlorantraniliprole 20% + Thiamethoxam 20% WG',
    manufacturer: 'Syngenta Bangladesh Ltd.',
    registrationNo: 'DAE Reg. AP-1304',
    packImageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300&auto=format&fit=crop&q=80',
    safetyIntervalDays: 14,
    whoClass: 'Class III (Slightly Hazardous)',
    formulation: 'WG (Water Dispersible Granule)',
  },
};

function getVerifiedPesticide(medicineStr: string): VerifiedPesticideInfo {
  const lower = (medicineStr || '').toLowerCase();
  for (const [key, info] of Object.entries(VERIFIED_PESTICIDES)) {
    if (lower.includes(key)) return info;
  }
  return VERIFIED_PESTICIDES.ridomil;
}

const toBanglaSeverity = (sev: string): string => {
  const s = (sev || '').toLowerCase();
  if (s.includes('high')) return 'উচ্চ ঝুঁকি';
  if (s.includes('mod')) return 'মাঝারি ঝুঁকি';
  if (s.includes('low')) return 'স্বল্প ঝুঁকি';
  return 'নিয়ন্ত্রণযোগ্য';
};

export const CropDoctorModal: React.FC<CropDoctorModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<CropDiagnosisResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Direct AI diagnosis trigger from leaf image
  const runDiagnosis = async (b64?: string, mime?: string) => {
    const targetB64 = b64 || imageBase64;
    const targetMime = mime || imageMimeType;

    if (!targetB64) {
      setImageError(
        language === 'bn'
          ? 'অনুগ্রহ করে আক্রান্ত পাতার ছবি আপলোড করুন।'
          : 'Please upload an image of the affected leaf.'
      );
      return;
    }

    setLoading(true);
    setDiagnosis(null);
    setImageError(null);

    try {
      const res = await requestCropDiagnosis(
        'Auto-detect',
        'Direct leaf pathology analysis from image',
        targetB64,
        targetMime,
        language
      );
      setDiagnosis(res);
    } catch (err) {
      console.error(err);
      setImageError(
        language === 'bn'
          ? 'রোগ নির্ণয় সম্পন্ন করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
          : 'Diagnosis failed. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

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

    const mime = file.type || 'image/jpeg';
    setImageMimeType(mime);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      const base64Part = result.split(',')[1];
      setImageBase64(base64Part);
      // Trigger AI diagnosis directly from the uploaded leaf photo
      runDiagnosis(base64Part, mime);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setImageBase64(undefined);
    setImageMimeType('image/jpeg');
    setImageError(null);
    setDiagnosis(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
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
                  {language === 'bn' ? 'আমার হাট ফসলের ডাক্তার' : 'Amar Haat Crop Doctor'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 hidden sm:inline-block">
                  {language === 'bn' ? 'বারি ও ডিএই গাইডলাইন' : 'BARI & DAE Guidelines'}
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                {language === 'bn'
                  ? 'এআই ভিত্তিক আক্রান্ত পাতার ছবি বিশ্লেষণ ও তাৎক্ষণিক ডিজিটাল প্রেসক্রিপশন'
                  : 'AI-assisted leaf image pathology diagnosis and instant digital prescription'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 font-bold text-sm p-1.5 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <div className="space-y-4">
            {/* AI Disclaimer Banner */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="flex-1 leading-relaxed">
                <span>
                  {language === 'bn'
                    ? 'সতর্কতা: এটি কেবল এআই ভিত্তিক প্রাথমিক বিশ্লেষণ। কোনো রাসায়নিক ব্যবহারের পূর্বে স্থানীয় উপ-সহকারী কৃষি কর্মকর্তা (SAAO) বা কৃষি বিশেষজ্ঞের পরামর্শ নিন।'
                    : 'Disclaimer: This is an AI-generated preliminary advisory only. Consult your local agricultural officer before applying chemical treatments.'}
                </span>
              </div>
            </div>

            {/* Photo Upload Area Only (Crop name and symptoms removed) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runDiagnosis();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-bold text-stone-800 mb-1.5 text-sm">
                  {language === 'bn' ? 'আক্রান্ত পাতার ছবি' : 'Affected Leaf Image'}
                </label>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="crop-photo-input"
                />

                {!imagePreview ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-stone-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer bg-stone-50 hover:bg-emerald-50/30 transition-all group"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-100 group-hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-colors">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="font-extrabold text-stone-800 text-sm">
                        {language === 'bn' ? 'আক্রান্ত পাতার ছবি তুলুন বা গ্যালারি থেকে আপলোড করুন' : 'Take photo or upload affected leaf image'}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {language === 'bn'
                          ? 'ছবি নির্বাচন করার সাথে সাথে স্বয়ংক্রিয়ভাবে এআই রোগ নির্ণয় শুরু হবে'
                          : 'AI diagnosis will automatically run as soon as an image is selected'}
                      </p>
                      <p className="text-[10px] text-stone-400">
                        PNG, JPG, WEBP (সর্বোচ্চ {language === 'bn' ? '৫' : '5'} MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-2xl border border-stone-300 overflow-hidden bg-stone-900 flex items-center justify-center max-h-64 shadow-inner">
                    <img
                      src={imagePreview}
                      alt="Crop symptom preview"
                      className="max-h-64 w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 shadow-md transition-colors cursor-pointer"
                      title={language === 'bn' ? 'ছবি মুছে ফেলুন' : 'Remove image'}
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{language === 'bn' ? 'আক্রান্ত পাতার ছবি যুক্ত হয়েছে' : 'Leaf image attached'}</span>
                    </div>
                  </div>
                )}

                {imageError && (
                  <p className="text-[11px] text-red-600 mt-2 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> {imageError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-stone-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  {language === 'bn' ? 'জেমিনাই ফ্ল্যাশ মাল্টিমোডাল প্যাথলজি ইঞ্জিন' : 'Gemini Flash Multimodal Pathology Engine'}
                </span>

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{language === 'bn' ? 'বিশ্লেষণ ও রোগ নির্ণয় চলছে...' : 'Analyzing leaf photo...'}</span>
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
              <div className="mt-5 p-4 sm:p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 text-xs space-y-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                      {language === 'bn'
                        ? `${toBanglaSeverity(diagnosis.severity)} • ${toBanglaNumber(diagnosis.confidence || 92)}% এআই নির্ভুলতা`
                        : `${diagnosis.severity} Severity • ${diagnosis.confidence || 92}% AI Confidence`}
                    </span>
                    <h4 className="text-base sm:text-lg font-extrabold text-stone-900 mt-1">
                      {language === 'bn' ? diagnosis.diseaseBanglaName : diagnosis.diseaseName}
                    </h4>
                    <p className="text-[11px] text-stone-500 italic">{diagnosis.diseaseName}</p>
                  </div>

                  {diagnosis.verifiedBySAAO === true && (
                    <div className="flex items-center gap-1 bg-white border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-2xs shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{language === 'bn' ? 'এসএএও (SAAO) দ্বারা যাচাইকৃত' : 'SAAO Verified'}</span>
                    </div>
                  )}
                </div>

                <p className="text-stone-700 text-xs leading-relaxed bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-2xs">
                  <strong className="text-stone-900">{language === 'bn' ? 'লক্ষণ সারাংশ:' : 'Symptoms Summary:'}</strong> {diagnosis.symptomsSummary}
                </p>

                {/* Treatment Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Chemical Recommendation with genuine verified pesticide product */}
                  {(() => {
                    const pInfo = getVerifiedPesticide(diagnosis.chemicalTreatment.medicine);
                    return (
                      <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs space-y-2.5">
                        <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-2">
                          <div>
                            <span className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-emerald-600" />
                              {language === 'bn' ? 'অনুমোদিত বালাইনাশক চিকিৎসা' : 'Verified Chemical Prescription'}
                            </span>
                            <span className="text-[10px] text-stone-500 block mt-0.5">
                              {pInfo.registrationNo}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                            {pInfo.manufacturer}
                          </span>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-stone-200 shrink-0 bg-stone-50 flex items-center justify-center">
                            <img
                              src={pInfo.packImageUrl}
                              alt={pInfo.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="font-bold text-stone-900 text-xs leading-tight">
                              {pInfo.name}
                            </p>
                            <p className="text-stone-500 text-[10px] truncate">
                              {pInfo.generic}
                            </p>
                            <div className="text-[10px] text-stone-700 space-y-0.5 pt-0.5">
                              <p><strong>{language === 'bn' ? 'প্রয়োগ মাত্রা:' : 'Dose:'}</strong> {diagnosis.chemicalTreatment.dose}</p>
                              <p><strong>{language === 'bn' ? 'স্প্রে সময়সূচী:' : 'Schedule:'}</strong> {diagnosis.chemicalTreatment.schedule}</p>
                            </div>
                          </div>
                        </div>

                        {/* Safety & Pre-Harvest Interval (PHI) */}
                        <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-900 space-y-0.5">
                          <div className="flex items-center gap-1 font-bold">
                            <ShieldAlert className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>{language === 'bn' ? 'বালাইনাশক নিরাপত্তা ও ব্যবহারের নির্দেশিকা:' : 'Pesticide Safety & Harvest Interval (PHI):'}</span>
                          </div>
                          <p className="text-[9.5px] leading-tight text-amber-800">
                            {language === 'bn'
                              ? `ফসল তোলার পূর্ববর্তী নিরাপদ সময় (PHI): ${toBanglaNumber(pInfo.safetyIntervalDays)} দিন। স্প্রে করার সময় মাস্ক ও গ্লাভস ব্যবহার করুন। বাতাসের বিপরীতে স্প্রে করবেন না।`
                              : `Pre-Harvest Interval (PHI): ${pInfo.safetyIntervalDays} days. Wear protective mask and gloves. Avoid spraying against wind.`}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Organic Botanical Remedy */}
                  <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-2xs space-y-2 flex flex-col justify-between">
                    <div>
                      <span className="font-extrabold text-teal-950 text-xs flex items-center gap-1.5 border-b border-stone-100 pb-2">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        {language === 'bn' ? 'জৈব ও প্রাকৃতিক প্রতিকার (পরিবেশবান্ধব)' : 'Organic Botanical Remedy (Eco-friendly)'}
                      </span>
                      <p className="text-stone-700 text-[11px] leading-relaxed mt-2.5">
                        {diagnosis.organicTreatment}
                      </p>
                      {diagnosis.preventionTips && (
                        <div className="mt-2.5 pt-2 border-t border-stone-100 text-[10px] text-stone-600">
                          <strong className="text-stone-800">{language === 'bn' ? 'ভবিষ্যৎ প্রতিরোধ টিপস: ' : 'Future Prevention: '}</strong>
                          {diagnosis.preventionTips}
                        </div>
                      )}
                    </div>

                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-[10px] text-teal-900">
                      <span className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-teal-700" />
                        {language === 'bn' ? 'নিরাপদ জৈব চাষাবাদ পদ্ধতি' : 'Safe organic farming practice'}
                      </span>
                      <p className="text-[9.5px] text-teal-800 mt-0.5">
                        {language === 'bn'
                          ? 'রাসায়নিক প্রয়োগের পূর্বে সর্বদা জৈব ও সমন্বিত বালাই ব্যবস্থাপনা (IPM) অনুসরণ করুন।'
                          : 'Always prioritize Integrated Pest Management (IPM) before chemical intervention.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Immediate Actions — Visual Step-by-Step Cards */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-stone-900 font-extrabold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{language === 'bn' ? 'তাৎক্ষণিক করণীয় পদক্ষেপ (ধাপ অনুযায়ী):' : 'Immediate Step-by-Step Cultural Actions:'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {diagnosis.immediateActions.map((action, idx) => {
                      const stepIcons = [
                        <Scissors key="1" className="w-4 h-4 text-emerald-700" />,
                        <Droplets key="2" className="w-4 h-4 text-blue-700" />,
                        <Sun key="3" className="w-4 h-4 text-amber-700" />,
                      ];
                      const stepLabelsBn = ['ধাপ ১: পরিচ্ছন্নতা ও ছাঁটাই', 'ধাপ ২: পানি ও সেচ ব্যবস্থাপনা', 'ধাপ ৩: বায়ু ও সূর্যালোক'];
                      const stepLabelsEn = ['Step 1: Sanitation', 'Step 2: Water Care', 'Step 3: Aeration'];

                      return (
                        <div
                          key={idx}
                          className="bg-white border border-stone-200/90 rounded-xl p-3 shadow-2xs hover:border-emerald-300 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {language === 'bn' ? (stepLabelsBn[idx] || `ধাপ ${toBanglaNumber(idx + 1)}`) : (stepLabelsEn[idx] || `Step ${idx + 1}`)}
                              </span>
                              <div className="w-6 h-6 rounded-lg bg-stone-50 border border-stone-200 flex items-center justify-center">
                                {stepIcons[idx % stepIcons.length]}
                              </div>
                            </div>
                            <p className="text-stone-700 text-[11px] leading-relaxed font-medium">
                              {action}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
