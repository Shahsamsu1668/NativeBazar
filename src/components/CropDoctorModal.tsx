import React, { useState, useRef } from 'react';
import { CropDiagnosisResult, Language } from '../types';
import { requestCropDiagnosis } from '../services/aiService';
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
} from 'lucide-react';

interface CropDoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const CropDoctorModal: React.FC<CropDoctorModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImageError(null);
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      setImageError(language === 'bn' ? 'শুধুমাত্র ছবি ফাইল আপলোড করুন।' : 'Only image files are allowed.');
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setImageError(language === 'bn' ? 'ছবির সাইজ ৫ MB-এর বেশি হওয়া যাবে না।' : 'Image must be under 5 MB.');
      return;
    }

    setImageMimeType(file.type || 'image/jpeg');

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      // Strip the data:image/...;base64, prefix for the server
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-stone-200 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">
                {language === 'bn' ? 'নেটিভবাজার এআই ফসলের ডাক্তার' : 'NativeBazar AI Crop Doctor'}
              </h3>
              <p className="text-[11px] text-stone-500">
                {language === 'bn'
                  ? 'BARI জ্ঞানভাণ্ডার ভিত্তিক — এআই প্রাথমিক বিশ্লেষণ'
                  : 'BARI knowledge base — AI preliminary analysis only'}
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

        {/* AI Disclaimer Banner */}
        <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
          <span>
            {language === 'bn'
              ? 'সতর্কতা: এটি কেবল এআই ভিত্তিক প্রাথমিক পরামর্শ। কোনো রাসায়নিক ব্যবহারের পূর্বে স্থানীয় কৃষি কর্মকর্তার পরামর্শ নিন।'
              : 'Disclaimer: This is an AI-generated preliminary advisory only. Consult a certified agronomist or local agriculture officer before applying any treatment.'}
          </span>
        </div>

        {/* Input Form */}
        <form onSubmit={handleDiagnose} className="space-y-4 mt-4 text-xs">
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
              {language === 'bn' ? 'ফসলের রোগাক্রান্ত অংশের ছবি আপলোড করুন (ঐচ্ছিক)' : 'Upload Crop Image for Visual Analysis (Optional)'}
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
                  {language === 'bn' ? '✓ ছবি প্রস্তুত — এআই ভিজ্যুয়াল বিশ্লেষণ সক্রিয়' : '✓ Image ready — AI visual analysis enabled'}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-stone-300 hover:border-emerald-500 rounded-xl text-stone-500 hover:text-emerald-700 transition-colors w-full justify-center"
              >
                <Upload className="w-4 h-4" />
                <span>{language === 'bn' ? 'ছবি বেছে নিন (JPG/PNG, সর্বোচ্চ ৫ MB)' : 'Choose Photo (JPG/PNG, max 5 MB)'}</span>
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

              {/* Only show SAAO badge if explicitly verified by server — never show false positives */}
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
                <p className="font-semibold text-stone-900 text-[11px]">{diagnosis.chemicalTreatment.medicine}</p>
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

            {/* AI disclaimer in result */}
            {diagnosis.aiDisclaimer && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span>{diagnosis.aiDisclaimer}</span>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-emerald-200/80">
              <span className="text-[10px] text-stone-500">
                {language === 'bn' ? 'নিকটবর্তী অনুমোদিত ডিলারের কাছে ওষুধ খুঁজুন' : 'Order treatment from matched local dealer'}
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
    </div>
  );
};
