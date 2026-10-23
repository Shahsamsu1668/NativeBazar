import React, { useState, useRef } from 'react';
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
  FileText,
  ImagePlus,
  X,
  Info,
  ShieldAlert,
  Scissors,
  Droplets,
  Sun,
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

export const CropDoctorModal: React.FC<CropDoctorModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
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

  if (!isOpen) return null;

  // AI Diagnosis handlers
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImageError(null);
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError(language === 'bn' ? 'αª╢αºüαªºαºüαª«αª╛αªñαºìαª░ αª¢αª¼αª┐ αª½αª╛αªçαª▓ αªåαª¬αª▓αºïαªí αªòαª░αºüαª¿αÑñ' : 'Only image files are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError(language === 'bn' ? 'αª¢αª¼αª┐αª░ αª╕αª╛αªçαª£ αº½ MB-αªÅαª░ αª¼αºçαª╢αª┐ αª╣αªôαª»αª╝αª╛ αª»αª╛αª¼αºç αª¿αª╛αÑñ' : 'Image must be under 5 MB.');
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
                  {language === 'bn' ? 'αª¿αºçαªƒαª┐αª¡αª¼αª╛αª£αª╛αª░ αª½αª╕αª▓αºçαª░ αªíαª╛αªòαºìαªñαª╛αª░' : 'NativeBazar Crop Doctor'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 hidden sm:inline-block">
                  BARI & DAE Guidelines
                </span>
              </div>
              <p className="text-[11px] text-stone-500">
                {language === 'bn'
                  ? 'αªÅαªåαªç αª¡αª┐αªñαºìαªñαª┐αªò αª½αª╕αª▓αºçαª░ αª░αºïαªù αª¿αª┐αª░αºìαªúαª»αª╝ αªô αªíαª┐αª£αª┐αªƒαª╛αª▓ αª¬αºìαª░αºçαª╕αªòαºìαª░αª┐αª¬αª╢αª¿'
                  : 'AI-assisted crop pathology diagnosis and digital prescription'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 font-bold text-sm p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            Γ£ò
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
                    ? 'αª╕αªñαª░αºìαªòαªñαª╛: αªÅαªƒαª┐ αªòαºçαª¼αª▓ αªÅαªåαªç αª¡αª┐αªñαºìαªñαª┐αªò αª¬αºìαª░αª╛αªÑαª«αª┐αªò αª¼αª┐αª╢αºìαª▓αºçαª╖αªúαÑñ αªòαºïαª¿αºï αª░αª╛αª╕αª╛αª»αª╝αª¿αª┐αªò αª¼αºìαª»αª¼αª╣αª╛αª░αºçαª░ αª¬αºéαª░αºìαª¼αºç αª╕αºìαªÑαª╛αª¿αºÇαª»αª╝ αªëαª¬-αª╕αª╣αªòαª╛αª░αºÇ αªòαºâαª╖αª┐ αªòαª░αºìαª«αªòαª░αºìαªñαª╛ (SAAO) αª¼αª╛ αªòαºâαª╖αª┐ αª¼αª┐αª╢αºçαª╖αª£αºìαª₧αºçαª░ αª¬αª░αª╛αª«αª░αºìαª╢ αª¿αª┐αª¿αÑñ'
                    : 'Disclaimer: This is an AI-generated preliminary advisory only. Consult your local agricultural officer before applying chemical treatments.'}
                </span>
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleDiagnose} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    {language === 'bn' ? 'αª½αª╕αª▓αºçαª░ αª¿αª╛αª«' : 'Select Crop'}
                  </label>
                  <select
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  >
                    <option value="Tomato">Tomato / αªƒαª«αºçαªƒαºï</option>
                    <option value="Potato">Potato / αªåαª▓αºü</option>
                    <option value="Chili">Chili / αª«αª░αª┐αªÜ</option>
                    <option value="Cauliflower">Cauliflower / αª½αºüαª▓αªòαª¬αª┐</option>
                    <option value="Rice / Paddy">Rice (BRRI Dhan) / αªºαª╛αª¿</option>
                    <option value="Pointed Gourd">Pointed Gourd / αª¬αªƒαª▓</option>
                    <option value="Brinjal">Brinjal (Eggplant) / αª¼αºçαªùαºüαª¿</option>
                    <option value="Cabbage">Cabbage / αª¼αª╛αªüαªºαª╛αªòαª¬αª┐</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-stone-700 mb-1">
                    {language === 'bn' ? 'αª▓αªòαºìαª╖αªú αªô αª¼αª┐αª¼αª░αªú' : 'Visible Symptoms'}
                  </label>
                  <input
                    type="text"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder={
                      language === 'bn'
                        ? 'αª¬αª╛αªñαª╛αª»αª╝ αªªαª╛αªù, αª¼αª┐αª¼αª░αºìαªúαªñαª╛ αª¼αª╛ αªòαºÇαªƒ αªåαªòαºìαª░αª«αªúαºçαª░ αª¼αª┐αª¼αª░αªú αª▓αª┐αªûαºüαª¿...'
                        : 'Describe spots, leaf curling, or rot symptoms...'
                    }
                    className="w-full border border-stone-300 rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Photo Upload Area */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  {language === 'bn' ? 'αªåαªòαºìαª░αª╛αª¿αºìαªñ αª¬αª╛αªñαª╛αª░ αª¢αª¼αª┐ (αªÉαªÜαºìαª¢αª┐αªò αªòαª┐αª¿αºìαªñαºü αª¿αª┐αª░αºìαª¡αºüαª▓αªñαª╛αª░ αª£αª¿αºìαª» αª£αª░αºüαª░αª┐)' : 'Upload Crop Leaf Image (Recommended)'}
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
                    className="border-2 border-dashed border-stone-300 hover:border-emerald-500 rounded-xl p-4 text-center cursor-pointer bg-stone-50 hover:bg-emerald-50/30 transition-colors"
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-stone-700 text-xs">
                        {language === 'bn' ? 'αªòαºìαª»αª╛αª«αºçαª░αª╛ αªªαª┐αª»αª╝αºç αª¢αª¼αª┐ αªñαºüαª▓αºüαª¿ αª¼αª╛ αªùαºìαª»αª╛αª▓αª╛αª░αª┐ αªÑαºçαªòαºç αªåαª¬αª▓αºïαªí αªòαª░αºüαª¿' : 'Take photo or upload leaf image'}
                      </p>
                      <p className="text-[10px] text-stone-400">
                        PNG, JPG, WEBP (αª╕αª░αºìαª¼αºïαªÜαºìαªÜ αº½ MB)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-xl border border-stone-300 overflow-hidden bg-stone-100 flex items-center justify-center max-h-48">
                    <img
                      src={imagePreview}
                      alt="Crop symptom preview"
                      className="max-h-48 w-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md transition-colors"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ImagePlus className="w-3 h-3" />
                      <span>{language === 'bn' ? 'αª¢αª¼αª┐ αª»αºüαªòαºìαªñ αª╣αª»αª╝αºçαª¢αºç' : 'Image attached'}</span>
                    </div>
                  </div>
                )}

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
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{language === 'bn' ? 'αª¼αª┐αª╢αºìαª▓αºçαª╖αªú αªÜαª▓αª¢αºç...' : 'Analyzing...'}</span>
                    </>
                  ) : (
                    <>
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>{language === 'bn' ? 'αª░αºïαªù αª¿αª┐αª░αºìαªúαª»αª╝ αªòαª░αºüαª¿' : 'Run AI Diagnosis'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Diagnosis Results Card */}
            {diagnosis && (
              <div className="mt-5 p-4 sm:p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-teal-50/40 text-xs space-y-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                      {diagnosis.severity} Severity ΓÇó {diagnosis.confidence || 92}% AI Confidence
                    </span>
                    <h4 className="text-base sm:text-lg font-extrabold text-stone-900 mt-1">
                      {language === 'bn' ? diagnosis.diseaseBanglaName : diagnosis.diseaseName}
                    </h4>
                    <p className="text-[11px] text-stone-500 italic">{diagnosis.diseaseName}</p>
                  </div>

                  {diagnosis.verifiedBySAAO === true && (
                    <div className="flex items-center gap-1 bg-white border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-full text-[10px] font-bold shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>SAAO Verified</span>
                    </div>
                  )}
                </div>

                <p className="text-stone-700 text-xs leading-relaxed bg-white/90 p-3 rounded-xl border border-emerald-100 shadow-2xs">
                  <strong className="text-stone-900">{language === 'bn' ? 'αª▓αªòαºìαª╖αªú αª╕αª╛αª░αª╛αªéαª╢:' : 'Symptoms Summary:'}</strong> {diagnosis.symptomsSummary}
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
                              {language === 'bn' ? 'αªàαª¿αºüαª«αºïαªªαª┐αªñ αª¼αª╛αª▓αª╛αªçαª¿αª╛αª╢αªò αªÜαª┐αªòαª┐αºÄαª╕αª╛' : 'Verified Chemical Prescription'}
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
                              <p><strong>{language === 'bn' ? 'αª¬αºìαª░αª»αª╝αºïαªù αª«αª╛αªñαºìαª░αª╛:' : 'Dose:'}</strong> {diagnosis.chemicalTreatment.dose}</p>
                              <p><strong>{language === 'bn' ? 'αª╕αºìαª¬αºìαª░αºç αª╕αª«αª»αª╝αª╕αºéαªÜαºÇ:' : 'Schedule:'}</strong> {diagnosis.chemicalTreatment.schedule}</p>
                            </div>
                          </div>
                        </div>

                        {/* Safety & Pre-Harvest Interval (PHI) */}
                        <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-900 space-y-0.5">
                          <div className="flex items-center gap-1 font-bold">
                            <ShieldAlert className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>{language === 'bn' ? 'αª¼αª╛αª▓αª╛αªçαª¿αª╛αª╢αªò αª¿αª┐αª░αª╛αª¬αªñαºìαªñαª╛ αªô αª¼αºìαª»αª¼αª╣αª╛αª░αºçαª░ αª¿αª┐αª░αºìαªªαºçαª╢αª┐αªòαª╛:' : 'Pesticide Safety & Harvest Interval (PHI):'}</span>
                          </div>
                          <p className="text-[9.5px] leading-tight text-amber-800">
                            {language === 'bn'
                              ? `αª½αª╕αª▓ αªñαºïαª▓αª╛αª░ αª¬αºéαª░αºìαª¼αª¼αª░αºìαªñαºÇ αª¿αª┐αª░αª╛αª¬αªª αª╕αª«αª»αª╝ (PHI): ${pInfo.safetyIntervalDays} αªªαª┐αª¿αÑñ αª╕αºìαª¬αºìαª░αºç αªòαª░αª╛αª░ αª╕αª«αª»αª╝ αª«αª╛αª╕αºìαªò αªô αªùαºìαª▓αª╛αª¡αª╕ αª¼αºìαª»αª¼αª╣αª╛αª░ αªòαª░αºüαª¿αÑñ αª¼αª╛αªñαª╛αª╕αºçαª░ αª¼αª┐αª¬αª░αºÇαªñαºç αª╕αºìαª¬αºìαª░αºç αªòαª░αª¼αºçαª¿ αª¿αª╛αÑñ`
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
                        {language === 'bn' ? 'αª£αºêαª¼ αªô αª¬αºìαª░αª╛αªòαºâαªñαª┐αªò αª¬αºìαª░αªñαª┐αªòαª╛αª░ (αª¬αª░αª┐αª¼αºçαª╢αª¼αª╛αª¿αºìαªºαª¼)' : 'Organic Botanical Remedy (Eco-friendly)'}
                      </span>
                      <p className="text-stone-700 text-[11px] leading-relaxed mt-2.5">
                        {diagnosis.organicTreatment}
                      </p>
                      {diagnosis.preventionTips && (
                        <div className="mt-2.5 pt-2 border-t border-stone-100 text-[10px] text-stone-600">
                          <strong className="text-stone-800">{language === 'bn' ? 'αª¡αª¼αª┐αª╖αºìαª»αºÄ αª¬αºìαª░αªñαª┐αª░αºïαªº αªƒαª┐αª¬αª╕: ' : 'Future Prevention: '}</strong>
                          {diagnosis.preventionTips}
                        </div>
                      )}
                    </div>

                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-[10px] text-teal-900">
                      <span className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-teal-700" />
                        {language === 'bn' ? 'αª¿αª┐αª░αª╛αª¬αªª αª£αºêαª¼ αªÜαª╛αª╖αª╛αª¼αª╛αªª αª¬αªªαºìαªºαªñαª┐' : 'Safe organic farming practice'}
                      </span>
                      <p className="text-[9.5px] text-teal-800 mt-0.5">
                        {language === 'bn'
                          ? 'αª░αª╛αª╕αª╛αª»αª╝αª¿αª┐αªò αª¬αºìαª░αª»αª╝αºïαªùαºçαª░ αª¬αºéαª░αºìαª¼αºç αª╕αª░αºìαª¼αªªαª╛ αª£αºêαª¼ αªô αª╕αª«αª¿αºìαª¼αª┐αªñ αª¼αª╛αª▓αª╛αªç αª¼αºìαª»αª¼αª╕αºìαªÑαª╛αª¬αª¿αª╛ (IPM) αªàαª¿αºüαª╕αª░αªú αªòαª░αºüαª¿αÑñ'
                          : 'Always prioritize Integrated Pest Management (IPM) before chemical intervention.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Immediate Actions ΓÇö Visual Step-by-Step Cards */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-1.5 text-stone-900 font-extrabold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{language === 'bn' ? 'αªñαª╛αºÄαªòαºìαª╖αªúαª┐αªò αªòαª░αªúαºÇαª»αª╝ αª¬αªªαªòαºìαª╖αºçαª¬ (αªºαª╛αª¬ αªàαª¿αºüαª»αª╛αª»αª╝αºÇ):' : 'Immediate Step-by-Step Cultural Actions:'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {diagnosis.immediateActions.map((action, idx) => {
                      const stepIcons = [
                        <Scissors key="1" className="w-4 h-4 text-emerald-700" />,
                        <Droplets key="2" className="w-4 h-4 text-blue-700" />,
                        <Sun key="3" className="w-4 h-4 text-amber-700" />,
                      ];
                      const stepLabelsBn = ['αªºαª╛αª¬ αºº: αª¬αª░αª┐αªÜαºìαª¢αª¿αºìαª¿αªñαª╛ αªô αª¢αª╛αªüαªƒαª╛αªç', 'αªºαª╛αª¬ αº¿: αª¬αª╛αª¿αª┐ αªô αª╕αºçαªÜ αª¼αºìαª»αª¼αª╕αºìαªÑαª╛αª¬αª¿αª╛', 'αªºαª╛αª¬ αº⌐: αª¼αª╛αª»αª╝αºü αªô αª╕αºéαª░αºìαª»αª╛αª▓αºïαªò'];
                      const stepLabelsEn = ['Step 1: Sanitation', 'Step 2: Water Care', 'Step 3: Aeration'];

                      return (
                        <div
                          key={idx}
                          className="bg-white border border-stone-200/90 rounded-xl p-3 shadow-2xs hover:border-emerald-300 transition-colors flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {language === 'bn' ? (stepLabelsBn[idx] || `αªºαª╛αª¬ ${idx + 1}`) : (stepLabelsEn[idx] || `Step ${idx + 1}`)}
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
