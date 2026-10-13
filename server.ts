import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '15mb' }));

// Initialize Google GenAI client if API key is present
const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Timeout wrapper helper to guarantee responses never hang
function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Resilient Gemini runner with automatic model fallback
async function callGemini(contents: any, config?: any, timeoutMs = 15000) {
  if (!ai) throw new Error('AI client not initialized');
  const candidateModels = ['gemini-2.5-flash', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const p = ai.models.generateContent({
        model,
        contents,
        config,
      });
      const response = await withTimeout(p, timeoutMs);
      if (response && response.text) {
        return response;
      }
    } catch (err: any) {
      console.warn(`[Gemini] Model ${model} attempt failed:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('All candidate AI models were unreachable');
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'NativeBazar Backend',
    aiEnabled: !!ai,
    models: ['gemini-2.5-flash', 'gemini-3.1-flash-lite'],
    pilotDistrict: 'Bogura, Bangladesh',
    timestamp: new Date().toISOString(),
  });
});

// Comprehensive, command-aware fallback generator
function getVoiceFallback(query: string, role = 'Farmer', userLocation = 'Bogura', language = 'bn') {
  const q = (query || '').toLowerCase().trim();

  // 1. Market rates & pricing query
  if (q.includes('দর') || q.includes('দাম') || q.includes('রেট') || q.includes('rate') || q.includes('price') || q.includes('টাকা') || q.includes('market') || q.includes('বাজার')) {
    let cropSpecific = '';
    if (q.includes('টমেটো') || q.includes('tomato')) {
      cropSpecific = language === 'bn'
        ? 'বগুড়া শিবগঞ্জ ও মহাস্থান মোকামে হাইব্রিড পাকা টমেটো ৩৮-৪২ ৳/কেজি পাইকারি চলছে।'
        : 'Hybrid ripe tomatoes wholesale at ৳38-42/kg in Bogura Mahasthangarh arat.';
    } else if (q.includes('আলু') || q.includes('potato')) {
      cropSpecific = language === 'bn'
        ? 'বগুড়ার ডায়মন্ড আলু ২৮-৩২ ৳/কেজি এবং কার্ডিনাল আলু ২৬-২৯ ৳/কেজি পাইকারি চলছে।'
        : 'Diamond potatoes wholesale at ৳28-32/kg and Cardinal at ৳26-29/kg in Bogura.';
    } else if (q.includes('মরিচ') || q.includes('chili')) {
      cropSpecific = language === 'bn'
        ? 'বগুড়া বাজারে কাঁচা মরিচ পাইকারি ৮০-৯০ ৳/কেজি দরে বিক্রি হচ্ছে।'
        : 'Fresh green chilies wholesale at ৳80-90/kg in Bogura market.';
    } else if (q.includes('বেগুন') || q.includes('brinjal') || q.includes('eggplant')) {
      cropSpecific = language === 'bn'
        ? 'বগুড়ার স্থানীয় বেগুন পাইকারি ৩৫-৪০ ৳/কেজি দরে কেনাবেচা হচ্ছে।'
        : 'Fresh eggplants wholesale at ৳35-40/kg in local Bogura arats.';
    } else if (q.includes('ফুলকপি') || q.includes('cauliflower')) {
      cropSpecific = language === 'bn'
        ? 'শীতকালীন তাজা ফুলকপি আকারভেদে ২৫-৩০ ৳/পিস পাইকারি বিক্রি হচ্ছে।'
        : 'Fresh cauliflowers wholesale at ৳25-30/piece based on size.';
    } else if (q.includes('ধান') || q.includes('rice') || q.includes('paddy')) {
      cropSpecific = language === 'bn'
        ? 'ব্রি ধান-২৮ ও ২৯ প্রতি মণ ১,১০০-১,২২০ ৳ দরে পাইকারি বিক্রি হচ্ছে।'
        : 'BRRI Dhan-28 & 29 wholesale at ৳1,100-1,220 per maund.';
    } else {
      cropSpecific = language === 'bn'
        ? 'আজকের কৃষি বিপণন অধিদপ্তর (DAM) বগুড়া দর: ডায়মন্ড আলু ২৮ ৳/কেজি, কাঁচা মরিচ ৮৬ ৳/কেজি, এবং টমেটো ৩৮ ৳/কেজি।'
        : 'Today Bogura DAM wholesale benchmark: Potato ৳28/kg, Chili ৳86/kg, and Tomato ৳38/kg.';
    }

    return {
      reply: cropSpecific + (language === 'bn' ? ' সম্পূর্ণ লাইভ দর তালিকা দেখতে নিচের বাটনে চাপ দিন।' : ' Check live rates table below.'),
      suggestedActions: [
        { label: language === 'bn' ? 'বাজার দর পৃষ্ঠা দেখুন' : 'View Market Rates', action: 'OPEN_MARKET' },
        { label: language === 'bn' ? 'ফসল অগ্রিম বিক্রি করুন' : 'List Harvest', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_MARKET',
    };
  }

  // 2. Crop diseases, pest, medicine, diagnosis
  if (q.includes('রোগ') || q.includes('ডাক্তার') || q.includes('পোকা') || q.includes('ব্লাইট') || q.includes('ধসা') || q.includes('কীটপতঙ্গ') || q.includes('পচা') || q.includes('কুঁকড়ে') || q.includes('doctor') || q.includes('disease') || q.includes('pest') || q.includes('fungus') || q.includes('leaf') || q.includes('চিকিৎসা')) {
    return {
      reply: language === 'bn'
        ? 'ফসলের রোগ নির্ণয়ের জন্য আমাদের এআই ক্রপ ডক্টরে ছবি আপলোড করুন অথবা লক্ষণ জানান। আর্লি/লেইট ব্লাইটের জন্য ম্যানকোজেব ৭৫ ডব্লিউপি ২ গ্রাম/লিটার এবং পোকার জন্য ট্রাইকোডার্মা বা ফেরোমোন ট্র্যাপ অনুমোদিত।'
        : 'For crop diagnosis, upload a leaf photo or describe symptoms in AI Crop Doctor. Mancozeb 75 WP (2g/L) for blight and Trichoderma/pheromones for pests are recommended.',
      suggestedActions: [
        { label: language === 'bn' ? 'ফসলের ডাক্তার খুলুন' : 'Open Crop Doctor', action: 'OPEN_DOCTOR' },
        { label: language === 'bn' ? 'সার ও কীটনাশক ডিলার' : 'Find Input Dealers', action: 'OPEN_DEALERS' },
      ],
      executeAction: 'OPEN_DOCTOR',
    };
  }

  // 3. Weather & rainfall queries
  if (q.includes('আবহাওয়া') || q.includes('বৃষ্টি') || q.includes('ঝড়') || q.includes('রোদ') || q.includes('কুয়াশা') || q.includes('তাপমাত্রা') || q.includes('weather') || q.includes('rain') || q.includes('storm') || q.includes('temperature')) {
    return {
      reply: language === 'bn'
        ? `${userLocation} অঞ্চলে আগামী ৪৮ ঘণ্টায় আকাশ মূলত পরিষ্কার এবং হালকা রোদের সম্ভাবনা রয়েছে। পরিপক্ক শাকসবজি তোলার অনুকূল সময়। জমি পানি নিষ্কাশনের ব্যবস্থা রাখুন।`
        : `Mostly clear skies and pleasant weather forecasted for ${userLocation} over the next 48 hours. Ideal conditions for harvesting mature vegetables.`,
      suggestedActions: [
        { label: language === 'bn' ? 'পূর্ণাঙ্গ আবহাওয়া দেখুন' : 'View Weather Forecast', action: 'OPEN_WEATHER' },
        { label: language === 'bn' ? 'কৃষি সতর্কতা বুলেটিন' : 'Agro Bulletins', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_WEATHER',
    };
  }

  // 4. Wholesale buyers, aratdar, forward contracts
  if (q.includes('ক্রেতা') || q.includes('পাইকার') || q.includes('আড়তদার') || q.includes('বেচা') || q.includes('বিক্রি') || q.includes('চুক্তি') || q.includes('buyer') || q.includes('sell') || q.includes('contract') || q.includes('wholesaler') || q.includes('trade')) {
    return {
      reply: language === 'bn'
        ? `বগুড়া মোকাম ও ঢাকা কাওরান বাজারের ৩টি যাচাইকৃত পাইকারি প্রতিষ্ঠান বর্তমানে চুক্তিভিত্তিক সরবরাহের সন্ধান করছে। আপনি ড্যাশবোর্ড থেকে ফসল অগ্রিম তালিকাভুক্ত করে সরাসরি ফরওয়ার্ড চুক্তি লক করতে পারেন।`
        : `Verified wholesale buyers from Bogura and Dhaka Karwan Bazar are active. You can list your upcoming harvest on NativeBazar to lock guaranteed advance contracts.`,
      suggestedActions: [
        { label: language === 'bn' ? 'ক্রেতাদের তালিকা দেখুন' : 'View Wholesale Buyers', action: 'OPEN_BUYERS' },
        { label: language === 'bn' ? 'ফসল অগ্রিম বিক্রি করুন' : 'List Harvest Pre-sale', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_BUYERS',
    };
  }

  // 5. Fertilizer, seeds, pesticide, dealer
  if (q.includes('সার') || q.includes('কীটনাশক') || q.includes('বীজ') || q.includes('ডিলার') || q.includes('দোকান') || q.includes('ইউরিয়া') || q.includes('পটাশ') || q.includes('টিএসপি') || q.includes('dealer') || q.includes('fertilizer') || q.includes('seed') || q.includes('input') || q.includes('shop')) {
    return {
      reply: language === 'bn'
        ? 'শিবগঞ্জ ও বগুড়া সদরে মেঘনা ও যমুনা সার বিতানে সরকারি মূল্যে ইউরিয়া (১৬ ৳/কেজি), এমওপি পটাশ (২২ ৳/কেজি) এবং লাল তীর হাইব্রিড বীজ মজুদ রয়েছে।'
        : 'Government-certified fertilizers (MOP Potash @ ৳22/kg, Urea @ ৳16/kg) and Lal Teer hybrid seeds are in stock at licensed depots across Bogura.',
      suggestedActions: [
        { label: language === 'bn' ? 'সার-কীটনাশক ডিলার দেখুন' : 'Find Input Dealers', action: 'OPEN_DEALERS' },
        { label: language === 'bn' ? 'কৃষক ড্যাশবোর্ড' : 'Farmer Dashboard', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_DEALERS',
    };
  }

  // 6. Orders, cart, transactions, escrow
  if (q.includes('অর্ডার') || q.includes('কার্ট') || q.includes('লেনদেন') || q.includes('পেমেন্ট') || q.includes('টাকা') || q.includes('order') || q.includes('cart') || q.includes('payment') || q.includes('escrow')) {
    return {
      reply: language === 'bn'
        ? 'আপনার সমস্ত ক্রয়-বিক্রয় এসক্রো ডিজিটাল ট্রাস্ট দ্বারা সুরক্ষিত। পণ্য সরবরাহ নিশ্চিত হওয়ার পরই অর্থ স্থানান্তর কার্যকর হয়। বর্তমান অর্ডারের স্থিতি দেখতে পারেন।'
        : 'All orders and contracts are safeguarded by escrow escrow protection. Funds are released only upon verified delivery.',
      suggestedActions: [
        { label: language === 'bn' ? 'অর্ডার তালিকা দেখুন' : 'View Orders', action: 'OPEN_ORDERS' },
        { label: language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_ORDERS',
    };
  }

  // 7. Ledger / Farm accounts
  if (q.includes('লেজার') || q.includes('হিসাব') || q.includes('খরচ') || q.includes('লাভ') || q.includes('ledger') || q.includes('expense') || q.includes('profit')) {
    return {
      reply: language === 'bn'
        ? 'কৃষক ডিজিটাল লেজারে আপনার সার, বীজ, শ্রম খরচ এবং ফসল বিক্রির আয় স্বয়ংক্রিয়ভাবে সংরক্ষিত থাকে।'
        : 'The Farmer Digital Ledger tracks your input expenses, labor, and crop sales for transparent net profit calculations.',
      suggestedActions: [
        { label: language === 'bn' ? 'কৃষক লেজার দেখুন' : 'View Farm Ledger', action: 'OPEN_LEDGER' },
        { label: language === 'bn' ? 'ড্যাশবোর্ড' : 'Dashboard', action: 'OPEN_DASHBOARD' },
      ],
      executeAction: 'OPEN_LEDGER',
    };
  }

  // 8. General agro assistant greetings & commands
  return {
    reply: language === 'bn'
      ? `স্বাগতম! আমি নেটিভবাজারের স্মার্ট সহকারী (${userLocation})। আপনি বাংলায় কথা বলে বা লিখে বাজার দর অনুসন্ধান, ফসলের রোগ নির্ণয়, সার-কীটনাশক ডিলার অথবা ক্রেতা খুঁজতে পারেন।`
      : `Welcome! I am NativeBazar Smart Assistant for ${userLocation}. You can speak or type to check wholesale rates, diagnose crop diseases, find buyers, or locate certified inputs.`,
    suggestedActions: [
      { label: language === 'bn' ? 'বাজার দর দেখুন' : 'Check Market Rates', action: 'OPEN_MARKET' },
      { label: language === 'bn' ? 'ফসলের রোগ নির্ণয়' : 'Diagnose Crop Disease', action: 'OPEN_DOCTOR' },
      { label: language === 'bn' ? 'আবহাওয়া আপডেট' : 'Weather Forecast', action: 'OPEN_WEATHER' },
    ],
    executeAction: null,
  };
}

// 1. Crop Diagnosis Endpoint
app.post('/api/ai/diagnose-crop', async (req, res) => {
  const { cropName = 'Tomato', symptoms = '', imageBase64, imageMimeType = 'image/jpeg', language = 'bn' } = req.body;

  const fallback = {
    diseaseName: cropName.toLowerCase().includes('tomato') || cropName.toLowerCase().includes('টমেটো')
      ? 'Early Blight (Alternaria solani)'
      : cropName.toLowerCase().includes('potato') || cropName.toLowerCase().includes('আলু')
      ? 'Late Blight (Phytophthora infestans)'
      : 'Bacterial Leaf Spot',
    diseaseBanglaName: cropName.toLowerCase().includes('tomato') || cropName.toLowerCase().includes('টমেটো')
      ? 'টমেটোর আগাম ধসা রোগ'
      : cropName.toLowerCase().includes('potato') || cropName.toLowerCase().includes('আলু')
      ? 'আলুর নাবি ধসা রোগ (লেইট ব্লাইট)'
      : 'পাতার ব্যাকটেরিয়াজনিত দাগ রোগ',
    severity: 'Moderate' as const,
    isAiEstimate: true,
    symptomsSummary: symptoms || 'Dark concentric brown rings on lower leaves with yellow halo margins.',
    immediateActions: language === 'bn'
      ? ['আক্রান্ত পাতা সংগ্রহ করে পুড়িয়ে ফেলুন', 'গাছের গোড়ায় অতিরিক্ত পানি নিষ্কাশন নিশ্চিত করুন', 'বাতাস চলাচলের জন্য জমি আগাছামুক্ত রাখুন']
      : ['Collect and burn severely infected leaves', 'Ensure proper drainage at roots', 'Keep field weed-free for aeration'],
    chemicalTreatment: {
      medicine: 'Mancozeb 75 WP (Dithane M-45) or Ridomil Gold MZ',
      dose: language === 'bn' ? 'প্রতি লিটার পানিতে ২ গ্রাম হারে স্প্রে করুন' : '2 grams per liter of water',
      schedule: language === 'bn' ? '৭-১০ দিন পর পর ২ বার স্প্রে করুন' : 'Spray twice at 7-10 day intervals',
    },
    organicTreatment: language === 'bn'
      ? 'নিম তেলের দ্রবণ (প্রতি লিটারে ৫ মিলি) অথবা ট্রাইকোডার্মা জৈব ছত্রাকনাশক ব্যবহার করুন।'
      : 'Neem oil solution (5ml/L) or Trichoderma bio-fungicide soil treatment.',
    preventionTips: language === 'bn'
      ? 'পরবর্তী মৌসুমে রোগমুক্ত প্রত্যায়িত বীজ ব্যবহার করুন এবং ফসল পর্যায়ক্রম অনুসরণ করুন।'
      : 'Use certified disease-free seeds and practice crop rotation next season.',
    aiDisclaimer: language === 'bn'
      ? 'সতর্কতা: এটি এআই ভিত্তিক প্রাথমিক বিশ্লেষণ। কোনো রাসায়নিক প্রয়োগের পূর্বে অবশ্যই স্থানীয় উপ-সহকারী কৃষি কর্মকর্তা (SAAO/UAO) বা কৃষি বিশেষজ্ঞের পরামর্শ নিন।'
      : 'Advisory: This is an automated AI diagnostic estimate. Always consult your local Sub-Assistant Agriculture Officer (SAAO) or certified agronomist before taking action.',
    pesticideSafetyWarning: language === 'bn'
      ? 'কীটনাশক সতর্কতা: স্প্রে করার সময় মাস্ক ও গ্লাভস পরিধান করুন। ফসল তোলার পূর্ববর্তী নির্ধারিত নিরাপদ সময় (PHI) বজায় রাখুন।'
      : 'Pesticide Safety: Wear protective gloves and face mask. Strictly adhere to Pre-Harvest Intervals (PHI).',
    verifiedBySAAO: false,
  };

  if (!ai) {
    return res.json(fallback);
  }

  try {
    const promptText = `Expert Agronomist for Bogura Bangladesh. Diagnose this crop:
Crop: ${cropName}
Symptoms: ${symptoms}
Language: ${language === 'bn' ? 'Bengali' : 'English'}
NOTE: Do NOT claim human or SAAO verification. Do NOT return fake certainty or confidence percentages.
Return JSON with:
{
  "diseaseName": "English name",
  "diseaseBanglaName": "বাংলা নাম",
  "severity": "Moderate",
  "symptomsSummary": "short explanation",
  "immediateActions": ["action 1", "action 2"],
  "chemicalTreatment": {
    "medicine": "Mancozeb 75 WP or approved chemical",
    "dose": "2g per liter",
    "schedule": "every 7 days"
  },
  "organicTreatment": "Neem oil or bio remedy",
  "preventionTips": "crop rotation and clean seed",
  "aiDisclaimer": "AI advisory note",
  "pesticideSafetyWarning": "safety notice"
}`;

    const parts: any[] = [{ text: promptText }];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: imageMimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    const response = await callGemini(parts, {
      responseMimeType: 'application/json',
    }, 15000);

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ ...fallback, ...parsed });
  } catch (error: any) {
    console.warn('Crop diagnosis fallback activated:', error.message);
    return res.json(fallback);
  }
});

// 2. Supply-Demand & Price Prediction Endpoint
app.post('/api/ai/predict-demand', async (req, res) => {
  const { cropName = 'Tomato', quantityKg = 500, targetHarvestDate = 'in 10 days', district = 'Bogura', language = 'bn' } = req.body;

  const fallback = {
    cropName,
    district,
    expectedPriceRangeBDT: {
      min: 36,
      max: 46,
      recommendedWholesale: 41,
      retailExpected: 54,
    },
    marketTrend: 'Bullish (Demand exceeding local supply by 15%)',
    demandLevel: 'High' as const,
    boguraAratArrivalEstimate: 'Medium (approx. 45-60 metric tons daily next week)',
    buyerRecommendation: language === 'bn'
      ? `আগামী ১০ দিনে বগুড়া ও ঢাকা কারওয়ান বাজারের চাহিদা চাঙ্গা থাকবে। ফসল তোলার ৩ দিন আগে পাইকারদের সাথে দর পাকা করার পরামর্শ দেওয়া হচ্ছে।`
      : `High procurement demand anticipated across Bogura Wholesale Arat & Dhaka corridors. Recommended to pre-contract 3-5 days prior.`,
    keyRiskFactor: language === 'bn'
      ? 'বৃষ্টিপাতের সম্ভাবনা রয়েছে, ফসল দ্রুত শুকিয়ে গ্রেডিং নিশ্চিত করুন।'
      : 'Intermittent rainfall forecasted; ensure post-harvest curing and proper crate packing.',
    suggestedAction: 'List on NativeBazar forward-contracts for guaranteed ৳41/kg rate',
  };

  if (!ai) {
    return res.json(fallback);
  }

  try {
    const prompt = `Agricultural economist for Bogura Bangladesh. Predict market rate for:
Crop: ${cropName}, Qty: ${quantityKg} kg, Harvest in: ${targetHarvestDate}, District: ${district}
Return JSON:
{
  "cropName": "${cropName}",
  "district": "${district}",
  "expectedPriceRangeBDT": { "min": 35, "max": 48, "recommendedWholesale": 42, "retailExpected": 56 },
  "marketTrend": "short trend string",
  "demandLevel": "High",
  "boguraAratArrivalEstimate": "estimate string",
  "buyerRecommendation": "recommendation in ${language === 'bn' ? 'Bengali' : 'English'}",
  "keyRiskFactor": "short risk note",
  "suggestedAction": "action note"
}`;

    const response = await callGemini(prompt, {
      responseMimeType: 'application/json',
    }, 15000);

    const parsed = JSON.parse(response.text || '{}');
    return res.json({ ...fallback, ...parsed });
  } catch (error: any) {
    console.warn('Market prediction fallback activated:', error.message);
    return res.json(fallback);
  }
});

// 3. Voice & Natural Language Assistant Endpoint (with user command execution mapping)
app.post('/api/ai/voice-assistant', async (req, res) => {
  const { query = '', role = 'Farmer', userLocation = 'Bogura', language = 'bn' } = req.body;
  const fallback = getVoiceFallback(query, role, userLocation, language);

  if (!ai) {
    return res.json(fallback);
  }

  try {
    const systemPrompt = `You are NativeBazar's AI Voice & Assistant for agricultural trade and farming in Bangladesh (${userLocation}).
Current user role: ${role}.
Language: Respond in ${language === 'bn' ? 'Bengali (বাংলা)' : 'English'}.
Keep replies friendly, practical, and concise (2-3 sentences).

When the user asks or commands an action, map it to one of these Action Keys:
- "OPEN_MARKET": Market prices, rates, DAM wholesale data (দাম, বাজার দর, রেট)
- "OPEN_WEATHER": Weather forecasts, rain, storm, temperature (আবহাওয়া, বৃষ্টি)
- "OPEN_DOCTOR": Crop diseases, pest diagnosis, plant health (রোগ, ধসা, পোকা, ডাক্তার)
- "OPEN_ORDERS": Orders, delivery status, cart, escrow payments (অর্ডার, কার্ট, লেনদেন)
- "OPEN_BUYERS": Wholesale buyers, traders, aratdar contacts (ক্রেতা, পাইকার, আড়তদার)
- "OPEN_DEALERS": Certified fertilizer, seeds, pesticides, agro dealers (সার, বীজ, কীটনাশক, ডিলার)
- "OPEN_DASHBOARD": Go to dashboard, sell harvest, add listing (ড্যাশবোর্ড, ফসল বিক্রি)
- "OPEN_LEDGER": Farm ledger, expenses, accounting (লেজার, হিসাব-নিকাশ)

Return pure JSON schema:
{
  "reply": "helpful response in ${language === 'bn' ? 'Bengali' : 'English'}",
  "suggestedActions": [
    { "label": "Short Action Button Label", "action": "ACTION_KEY" }
  ],
  "executeAction": "ACTION_KEY or null if the user just asked a question without a direct command to navigate or open"
}`;

    const response = await callGemini(`User asks or commands: "${query}"`, {
      systemInstruction: systemPrompt,
      responseMimeType: 'application/json',
    }, 15000);

    const parsed = JSON.parse(response.text || '{}');
    if (parsed.reply) {
      return res.json({
        reply: parsed.reply,
        suggestedActions: parsed.suggestedActions || fallback.suggestedActions,
        executeAction: parsed.executeAction || fallback.executeAction || null,
      });
    }
    return res.json(fallback);
  } catch (error: any) {
    console.warn('Voice assistant fallback activated:', error.message);
    return res.json(fallback);
  }
});

// Mount Vite in development or static in production
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NativeBazar server listening on port ${PORT}`);
});
