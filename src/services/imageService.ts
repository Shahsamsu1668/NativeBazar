/**
 * NativeBazar Crop Image Service
 * 
 * Provides dynamic image fetching for crops and agricultural products:
 * 1. Name normalization utility to translate/map Bengali, English, or Banglish into standard English search terms.
 * 2. Multi-tier free image API search (Unsplash API, Pixabay, Google Custom Search, Wikipedia/Wikimedia Commons).
 * 3. Robust fallback mechanism with `onError` image handler and self-contained SVG placeholder.
 */

import { MASTER_AGRICULTURAL_CATALOG } from '../data/catalogData';

// ─── 1. PREDEFINED GENERIC LOCAL PLACEHOLDER IMAGE (BASKET OF VEGETABLES) ───
// Self-contained high-res SVG data URI: guaranteed 100% offline uptime, zero network roundtrips, no broken images.
export const DEFAULT_CROP_PLACEHOLDER = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="%23f8fafc"/><stop offset="100%" stop-color="%23e2e8f0"/></linearGradient><linearGradient id="basket" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23b45309"/><stop offset="50%" stop-color="%2392400e"/><stop offset="100%" stop-color="%2378350f"/></linearGradient><linearGradient id="pmp" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23fb923c"/><stop offset="100%" stop-color="%23ea580c"/></linearGradient><linearGradient id="tom" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%23ef4444"/><stop offset="100%" stop-color="%23b91c1c"/></linearGradient><linearGradient id="egg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%237e22ce"/><stop offset="100%" stop-color="%23581c87"/></linearGradient><linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2322c55e"/><stop offset="100%" stop-color="%2315803d"/></linearGradient><filter id="sh"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="%230f172a" flood-opacity="0.15"/></filter></defs><rect width="400" height="300" fill="url(%23bg)"/><circle cx="200" cy="150" r="125" fill="%23ecfdf5" opacity="0.8"/><circle cx="200" cy="150" r="100" fill="%23f0fdf4" opacity="0.6"/><g filter="url(%23sh)"><path d="M140 120 C120 70, 160 50, 175 90 C190 60, 230 75, 215 110" fill="url(%23leaf)"/><path d="M220 115 C240 60, 275 80, 260 115" fill="%2316a34a"/><path d="M125 130 C100 90, 130 80, 145 115" fill="%2315803d"/><ellipse cx="160" cy="130" rx="36" ry="32" fill="url(%23pmp)"/><path d="M160 100 Q162 90, 168 88" stroke="%2315803d" stroke-width="4" stroke-linecap="round" fill="none"/><path d="M225 105 C245 105, 260 125, 255 145 C250 160, 230 165, 215 155 C205 145, 210 115, 225 105 Z" fill="url(%23egg)"/><circle cx="185" cy="150" r="22" fill="url(%23tom)"/><circle cx="218" cy="154" r="18" fill="url(%23tom)"/><path d="M140 155 Q160 170, 180 162" stroke="%2316a34a" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M115 145 L135 220 Q200 232, 265 220 L285 145 Q200 135, 115 145 Z" fill="url(%23basket)"/><path d="M110 144 Q200 135, 290 144 Q200 152, 110 144 Z" fill="%2378350f"/><path d="M130 155 Q200 165, 270 155 M132 175 Q200 185, 268 175 M135 195 Q200 205, 265 195" stroke="%2378350f" stroke-width="2.5" fill="none" opacity="0.6"/></g><rect x="120" y="248" width="160" height="26" rx="13" fill="%23065f46"/><text x="200" y="265" font-family="sans-serif" font-size="11" font-weight="700" fill="%23ffffff" text-anchor="middle">FRESH HARVEST</text></svg>`;

/**
 * Robust error handler for <img> tags.
 * Replaces broken images with the predefined vegetable basket placeholder without infinite recursion.
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement, Event>,
  fallbackUrl: string = DEFAULT_CROP_PLACEHOLDER
): void {
  const target = event.currentTarget;
  if (target.dataset.hasFallback === 'true') return;
  target.dataset.hasFallback = 'true';
  target.src = fallbackUrl;
}

// ─── 2. COMPREHENSIVE BENGALI SCRIPT CROP MAPPING ─────────────────────────
export const BN_TO_EN_CROPS: Record<string, { term: string; category: string }> = {
  // Vegetables
  'পটল': { term: 'pointed gourd', category: 'Vegetables' },
  'দেশি পটল': { term: 'pointed gourd', category: 'Vegetables' },
  'কচি পটল': { term: 'pointed gourd', category: 'Vegetables' },
  'লাউ': { term: 'bottle gourd', category: 'Vegetables' },
  'কচি লাউ': { term: 'bottle gourd', category: 'Vegetables' },
  'মিষ্টি কুমড়া': { term: 'sweet pumpkin', category: 'Vegetables' },
  'মিষ্টি কুমড়া': { term: 'sweet pumpkin', category: 'Vegetables' },
  'কুমড়া': { term: 'pumpkin', category: 'Vegetables' },
  'কুমড়া': { term: 'pumpkin', category: 'Vegetables' },
  'চাল কুমড়া': { term: 'ash gourd', category: 'Vegetables' },
  'চাল কুমড়া': { term: 'ash gourd', category: 'Vegetables' },
  'করলা': { term: 'bitter gourd', category: 'Vegetables' },
  'উচ্ছে': { term: 'bitter gourd', category: 'Vegetables' },
  'ঝিঙে': { term: 'ridge gourd', category: 'Vegetables' },
  'ঝিঙ্গা': { term: 'ridge gourd', category: 'Vegetables' },
  'চিচিঙ্গা': { term: 'snake gourd', category: 'Vegetables' },
  'ধন্দুল': { term: 'sponge gourd', category: 'Vegetables' },
  'ধুন্দুল': { term: 'sponge gourd', category: 'Vegetables' },
  'ঢ্যাঁড়শ': { term: 'okra lady finger', category: 'Vegetables' },
  'ঢ্যাঁড়শ': { term: 'okra lady finger', category: 'Vegetables' },
  'ঢেঁড়শ': { term: 'okra lady finger', category: 'Vegetables' },
  'বেগুন': { term: 'eggplant brinjal', category: 'Vegetables' },
  'গোল বেগুন': { term: 'eggplant brinjal', category: 'Vegetables' },
  'তাল বেগুন': { term: 'eggplant brinjal', category: 'Vegetables' },
  'টমেটো': { term: 'ripe red tomato', category: 'Vegetables' },
  'শসা': { term: 'fresh green cucumber', category: 'Vegetables' },
  'ক্ষীরা': { term: 'cucumber', category: 'Vegetables' },
  'ফুলকপি': { term: 'cauliflower', category: 'Vegetables' },
  'স্নোবল ফুলকপি': { term: 'cauliflower', category: 'Vegetables' },
  'বাঁধাকপি': { term: 'cabbage', category: 'Vegetables' },
  'বাধাকপি': { term: 'cabbage', category: 'Vegetables' },
  'ওলকপি': { term: 'kohlrabi', category: 'Vegetables' },
  'ব্রকলি': { term: 'green broccoli', category: 'Vegetables' },
  'সজনে': { term: 'moringa drumstick', category: 'Vegetables' },
  'সজনে ডাঁটা': { term: 'moringa drumstick', category: 'Vegetables' },
  'সজিনা': { term: 'moringa drumstick', category: 'Vegetables' },
  'শিম': { term: 'hyacinth bean', category: 'Vegetables' },
  'বরবটি': { term: 'yardlong bean', category: 'Vegetables' },
  'মটরশুঁটি': { term: 'green peas', category: 'Vegetables' },
  'মটরশুটি': { term: 'green peas', category: 'Vegetables' },
  'গাজর': { term: 'fresh carrot', category: 'Vegetables' },
  'মুলা': { term: 'white radish', category: 'Vegetables' },
  'মূলা': { term: 'white radish', category: 'Vegetables' },
  'শালগম': { term: 'turnip', category: 'Vegetables' },
  'বিটরুট': { term: 'beetroot', category: 'Vegetables' },
  'মাশরুম': { term: 'fresh edible mushroom', category: 'Vegetables' },
  'ক্যাপসিকাম': { term: 'bell pepper capsicum', category: 'Vegetables' },
  'লেটুস': { term: 'fresh lettuce leaves', category: 'Vegetables' },
  'পালং শাক': { term: 'spinach green leaves', category: 'Vegetables' },
  'লাল শাক': { term: 'red amaranth spinach', category: 'Vegetables' },
  'পুঁই শাক': { term: 'malabar spinach', category: 'Vegetables' },
  'পুই শাক': { term: 'malabar spinach', category: 'Vegetables' },
  'কলমি শাক': { term: 'water spinach', category: 'Vegetables' },
  'ডাঁটা শাক': { term: 'amaranth greens', category: 'Vegetables' },
  'ডাটা শাক': { term: 'amaranth greens', category: 'Vegetables' },
  'পাট শাক': { term: 'jute leaves vegetable', category: 'Vegetables' },
  'কচু': { term: 'taro root', category: 'Vegetables' },
  'কচুর লতি': { term: 'taro stolon', category: 'Vegetables' },
  'কচুর মুখী': { term: 'taro root eddoe', category: 'Vegetables' },
  'অ্যাসপারাগাস': { term: 'asparagus green', category: 'Vegetables' },

  // Tubers
  'আলু': { term: 'fresh potatoes', category: 'Tubers' },
  'গোল আলু': { term: 'fresh potatoes', category: 'Tubers' },
  'ডায়মন্ড আলু': { term: 'fresh potatoes', category: 'Tubers' },
  'ডায়মন্ড আলু': { term: 'fresh potatoes', category: 'Tubers' },
  'মিষ্টি আলু': { term: 'sweet potato', category: 'Tubers' },

  // Fruits
  'পেঁপে': { term: 'fresh papaya fruit', category: 'Fruits' },
  'পেপে': { term: 'fresh papaya fruit', category: 'Fruits' },
  'কাঁচা পেঁপে': { term: 'raw green papaya', category: 'Vegetables' },
  'পাকা পেঁপে': { term: 'ripe sweet papaya fruit', category: 'Fruits' },
  'আম': { term: 'fresh mangoes', category: 'Fruits' },
  'আম্রপালি': { term: 'amrapali mangoes', category: 'Fruits' },
  'হিমসাগর': { term: 'himsagar mangoes', category: 'Fruits' },
  'ফজলি': { term: 'fazli mangoes', category: 'Fruits' },
  'কাঁঠাল': { term: 'jackfruit', category: 'Fruits' },
  'কলা': { term: 'fresh bananas', category: 'Fruits' },
  'সবরি কলা': { term: 'fresh ripe bananas', category: 'Fruits' },
  'সাগর কলা': { term: 'fresh ripe bananas', category: 'Fruits' },
  'কাঁচকলা': { term: 'raw green cooking banana plantain', category: 'Vegetables' },
  'পেয়ারা': { term: 'fresh guava fruit', category: 'Fruits' },
  'পেয়ারা': { term: 'fresh guava fruit', category: 'Fruits' },
  'লিচু': { term: 'fresh sweet lychee litchi fruit', category: 'Fruits' },
  'তরমুজ': { term: 'fresh whole watermelon', category: 'Fruits' },
  'বাঙ্গি': { term: 'muskmelon cantaloupe', category: 'Fruits' },
  'আনারস': { term: 'fresh whole pineapple fruit', category: 'Fruits' },
  'ড্রাগন ফল': { term: 'red dragon fruit pitaya', category: 'Fruits' },
  'ড্রাগন': { term: 'dragon fruit pitaya', category: 'Fruits' },
  'কমলা': { term: 'fresh orange fruit', category: 'Fruits' },
  'মাল্টা': { term: 'sweet malta orange citrus', category: 'Fruits' },
  'লেবু': { term: 'fresh green lemon lime', category: 'Fruits' },
  'কাগজি লেবু': { term: 'fresh green lime', category: 'Fruits' },
  'বাতাবি লেবু': { term: 'pomelo citrus fruit', category: 'Fruits' },
  'আমলকী': { term: 'amla indian gooseberry', category: 'Fruits' },
  'আমড়া': { term: 'hog plum amra', category: 'Fruits' },
  'আমড়া': { term: 'hog plum amra', category: 'Fruits' },
  'কামরাঙা': { term: 'star fruit carambola', category: 'Fruits' },
  'জলপাই': { term: 'fresh green olive fruit', category: 'Fruits' },
  'বেল': { term: 'wood apple bael fruit', category: 'Fruits' },
  'কদবেল': { term: 'elephant apple wood apple', category: 'Fruits' },
  'স্ট্রবেরি': { term: 'fresh red strawberries', category: 'Fruits' },
  'কুল': { term: 'jujube plum boroi', category: 'Fruits' },
  'বরই': { term: 'jujube plum boroi', category: 'Fruits' },
  'ডালিম': { term: 'pomegranate fruit', category: 'Fruits' },
  'বেদানা': { term: 'pomegranate fruit', category: 'Fruits' },
  'আঙুর': { term: 'fresh grapes fruit', category: 'Fruits' },
  'আতা': { term: 'custard apple', category: 'Fruits' },
  'শরিফা': { term: 'sugar apple', category: 'Fruits' },
  'সফেদা': { term: 'sapodilla chickoo fruit', category: 'Fruits' },
  'জাম': { term: 'black plum blackberry jamun', category: 'Fruits' },
  'এভোকাডো': { term: 'avocado fresh fruit', category: 'Fruits' },

  // Grains & Pulses
  'ধান': { term: 'paddy rice field harvest', category: 'Grains' },
  'ব্রি ধান': { term: 'paddy rice field harvest', category: 'Grains' },
  'চাল': { term: 'raw white rice grains', category: 'Grains' },
  'গম': { term: 'wheat grain harvest', category: 'Grains' },
  'ভুট্টা': { term: 'maize corn cob grain', category: 'Grains' },
  'হলুদ ভুট্টা': { term: 'yellow corn maize', category: 'Grains' },
  'মসুর ডাল': { term: 'red lentils masoor dal', category: 'Grains' },
  'মুগ ডাল': { term: 'yellow mung dal lentils', category: 'Grains' },
  'ছোলা': { term: 'chickpeas garbanzo beans', category: 'Grains' },
  'খেসারি ডাল': { term: 'grass pea lentils', category: 'Grains' },
  'মাষকলাই': { term: 'black gram dal', category: 'Grains' },

  // Spices & Oilseeds
  'সরিষা': { term: 'mustard seeds yellow field', category: 'Spices' },
  'সর্ষে': { term: 'mustard seeds yellow', category: 'Spices' },
  'হলুদ সরিষা': { term: 'yellow mustard seeds', category: 'Spices' },
  'পেঁয়াজ': { term: 'fresh red onions', category: 'Spices' },
  'পেয়াজ': { term: 'fresh red onions', category: 'Spices' },
  'রসুন': { term: 'fresh garlic bulbs', category: 'Spices' },
  'আদা': { term: 'fresh ginger root rhizome', category: 'Spices' },
  'কাঁচা হলুদ': { term: 'raw turmeric root', category: 'Spices' },
  'হলুদ গুঁড়া': { term: 'turmeric powder spice', category: 'Spices' },
  'হলুদ': { term: 'turmeric root', category: 'Spices' },
  'কাঁচা মরিচ': { term: 'fresh green hot chili peppers', category: 'Spices' },
  'শুকনা মরিচ': { term: 'dry red hot chili peppers', category: 'Spices' },
  'মরিচ': { term: 'fresh green chili peppers', category: 'Spices' },
  'ধনে': { term: 'fresh coriander cilantro leaves', category: 'Spices' },
  'ধনিয়া': { term: 'coriander seeds cilantro', category: 'Spices' },
  'জিরা': { term: 'cumin seeds spice', category: 'Spices' },
  'কালোজিরা': { term: 'black seed nigella seeds', category: 'Spices' },
  'মেথি': { term: 'fenugreek seeds', category: 'Spices' },
  'মৌরি': { term: 'fennel seeds', category: 'Spices' },
  'তিল': { term: 'sesame seeds', category: 'Spices' },
  'চিনাবাদাম': { term: 'raw peanuts in shell groundnuts', category: 'Spices' },
  'বাদাম': { term: 'peanuts groundnuts', category: 'Spices' },
  'সয়াবিন': { term: 'soybean grains', category: 'Spices' },
  'সয়াবিন': { term: 'soybean grains', category: 'Spices' },
  'তেজপাতা': { term: 'bay leaves dried', category: 'Spices' },
  'দারুচিনি': { term: 'cinnamon sticks spice', category: 'Spices' },
  'এলাচ': { term: 'green cardamom pods', category: 'Spices' },
  'লবঙ্গ': { term: 'cloves spice', category: 'Spices' },
  'গোলমরিচ': { term: 'black pepper corns', category: 'Spices' },
};

// ─── 3. BANGLISH (PHONETIC LATIN SCRIPT) TO ENGLISH CROP MAPPING ───────────
export const BANGLISH_TO_EN_CROPS: Record<string, { term: string; category: string; bn: string }> = {
  // Vegetables
  potol: { term: 'pointed gourd', category: 'Vegetables', bn: 'পটল' },
  patal: { term: 'pointed gourd', category: 'Vegetables', bn: 'পটল' },
  potal: { term: 'pointed gourd', category: 'Vegetables', bn: 'পটল' },
  deshipotol: { term: 'pointed gourd', category: 'Vegetables', bn: 'দেশি পটল' },
  deshipatal: { term: 'pointed gourd', category: 'Vegetables', bn: 'দেশি পটল' },
  tomato: { term: 'tomato', category: 'Vegetables', bn: 'টমেটো' },
  tamato: { term: 'tomato', category: 'Vegetables', bn: 'টমেটো' },
  tometo: { term: 'tomato', category: 'Vegetables', bn: 'টমেটো' },
  begun: { term: 'eggplant brinjal', category: 'Vegetables', bn: 'বেগুন' },
  baigon: { term: 'eggplant brinjal', category: 'Vegetables', bn: 'বেগুন' },
  brinjal: { term: 'eggplant brinjal', category: 'Vegetables', bn: 'বেগুন' },
  eggplant: { term: 'eggplant brinjal', category: 'Vegetables', bn: 'বেগুন' },
  talbegun: { term: 'eggplant brinjal', category: 'Vegetables', bn: 'তাল বেগুন' },
  golbegun: { term: 'eggplant brinjal', category: 'Vegetables', bn: 'গোল বেগুন' },
  morich: { term: 'green chili', category: 'Spices', bn: 'কাঁচা মরিচ' },
  moris: { term: 'green chili', category: 'Spices', bn: 'কাঁচা মরিচ' },
  kachamorich: { term: 'green chili', category: 'Spices', bn: 'কাঁচা মরিচ' },
  kachamoris: { term: 'green chili', category: 'Spices', bn: 'কাঁচা মরিচ' },
  shuknamorich: { term: 'dry red chili', category: 'Spices', bn: 'শুকনা মরিচ' },
  lalmorich: { term: 'red chili', category: 'Spices', bn: 'লাল মরিচ' },
  chili: { term: 'green chili', category: 'Spices', bn: 'কাঁচা মরিচ' },
  chilli: { term: 'green chili', category: 'Spices', bn: 'কাঁচা মরিচ' },
  lau: { term: 'bottle gourd', category: 'Vegetables', bn: 'লাউ' },
  lao: { term: 'bottle gourd', category: 'Vegetables', bn: 'লাউ' },
  kodu: { term: 'bottle gourd', category: 'Vegetables', bn: 'লাউ' },
  korola: { term: 'bitter gourd', category: 'Vegetables', bn: 'করলা' },
  karola: { term: 'bitter gourd', category: 'Vegetables', bn: 'করলা' },
  kerela: { term: 'bitter gourd', category: 'Vegetables', bn: 'করলা' },
  uchhe: { term: 'bitter gourd', category: 'Vegetables', bn: 'উচ্ছে' },
  ucche: { term: 'bitter gourd', category: 'Vegetables', bn: 'উচ্ছে' },
  kumra: { term: 'pumpkin', category: 'Vegetables', bn: 'কুমড়া' },
  kumro: { term: 'pumpkin', category: 'Vegetables', bn: 'কুমড়া' },
  mistikumra: { term: 'sweet pumpkin', category: 'Vegetables', bn: 'মিষ্টি কুমড়া' },
  mistikumro: { term: 'sweet pumpkin', category: 'Vegetables', bn: 'মিষ্টি কুমড়া' },
  sweetpumpkin: { term: 'sweet pumpkin', category: 'Vegetables', bn: 'মিষ্টি কুমড়া' },
  chalkumra: { term: 'ash gourd', category: 'Vegetables', bn: 'চাল কুমড়া' },
  dherosh: { term: 'okra lady finger', category: 'Vegetables', bn: 'ঢ্যাঁড়শ' },
  dharosh: { term: 'okra lady finger', category: 'Vegetables', bn: 'ঢ্যাঁড়শ' },
  dhendosh: { term: 'okra lady finger', category: 'Vegetables', bn: 'ঢ্যাঁড়শ' },
  vendi: { term: 'okra lady finger', category: 'Vegetables', bn: 'ঢ্যাঁড়শ' },
  bhindi: { term: 'okra lady finger', category: 'Vegetables', bn: 'ঢ্যাঁড়শ' },
  okra: { term: 'okra lady finger', category: 'Vegetables', bn: 'ঢ্যাঁড়শ' },
  ladyfinger: { term: 'okra lady finger', category: 'Vegetables', bn: 'ঢ্যাঁড়শ' },
  jhinga: { term: 'ridge gourd', category: 'Vegetables', bn: 'ঝিঙে' },
  jhinge: { term: 'ridge gourd', category: 'Vegetables', bn: 'ঝিঙে' },
  chichinga: { term: 'snake gourd', category: 'Vegetables', bn: 'চিচিঙ্গা' },
  sichinga: { term: 'snake gourd', category: 'Vegetables', bn: 'চিচিঙ্গা' },
  dhundul: { term: 'sponge gourd', category: 'Vegetables', bn: 'ধুন্দুল' },
  dhundol: { term: 'sponge gourd', category: 'Vegetables', bn: 'ধুন্দুল' },
  fulkopi: { term: 'cauliflower', category: 'Vegetables', bn: 'ফুলকপি' },
  phoolkopi: { term: 'cauliflower', category: 'Vegetables', bn: 'ফুলকপি' },
  phulkopi: { term: 'cauliflower', category: 'Vegetables', bn: 'ফুলকপি' },
  cauliflower: { term: 'cauliflower', category: 'Vegetables', bn: 'ফুলকপি' },
  badhakopi: { term: 'cabbage', category: 'Vegetables', bn: 'বাঁধাকপি' },
  bandhakopi: { term: 'cabbage', category: 'Vegetables', bn: 'বাঁধাকপি' },
  cabbage: { term: 'cabbage', category: 'Vegetables', bn: 'বাঁধাকপি' },
  olkopi: { term: 'kohlrabi', category: 'Vegetables', bn: 'ওলকপি' },
  shosa: { term: 'cucumber', category: 'Vegetables', bn: 'শসা' },
  shosha: { term: 'cucumber', category: 'Vegetables', bn: 'শসা' },
  sosa: { term: 'cucumber', category: 'Vegetables', bn: 'শসা' },
  khira: { term: 'cucumber', category: 'Vegetables', bn: 'ক্ষীরা' },
  kheera: { term: 'cucumber', category: 'Vegetables', bn: 'ক্ষীরা' },
  cucumber: { term: 'cucumber', category: 'Vegetables', bn: 'শসা' },
  gajor: { term: 'carrot', category: 'Vegetables', bn: 'গাজর' },
  gajur: { term: 'carrot', category: 'Vegetables', bn: 'গাজর' },
  carrot: { term: 'carrot', category: 'Vegetables', bn: 'গাজর' },
  mula: { term: 'white radish', category: 'Vegetables', bn: 'মুলা' },
  moola: { term: 'white radish', category: 'Vegetables', bn: 'মুলা' },
  radish: { term: 'white radish', category: 'Vegetables', bn: 'মুলা' },
  shalgom: { term: 'turnip', category: 'Vegetables', bn: 'শালগম' },
  salgom: { term: 'turnip', category: 'Vegetables', bn: 'শালগম' },
  turnip: { term: 'turnip', category: 'Vegetables', bn: 'শালগম' },
  palong: { term: 'spinach', category: 'Vegetables', bn: 'পালং শাক' },
  palongshak: { term: 'spinach', category: 'Vegetables', bn: 'পালং শাক' },
  palak: { term: 'spinach', category: 'Vegetables', bn: 'পালং শাক' },
  spinach: { term: 'spinach', category: 'Vegetables', bn: 'পালং শাক' },
  lalshak: { term: 'red amaranth spinach', category: 'Vegetables', bn: 'লাল শাক' },
  lalsak: { term: 'red amaranth spinach', category: 'Vegetables', bn: 'লাল শাক' },
  puishak: { term: 'malabar spinach', category: 'Vegetables', bn: 'পুঁই শাক' },
  puisak: { term: 'malabar spinach', category: 'Vegetables', bn: 'পুঁই শাক' },
  kolmishak: { term: 'water spinach', category: 'Vegetables', bn: 'কলমি শাক' },
  kolmisak: { term: 'water spinach', category: 'Vegetables', bn: 'কলমি শাক' },
  datashak: { term: 'amaranth greens', category: 'Vegetables', bn: 'ডাঁটা শাক' },
  patshak: { term: 'jute leaves vegetable', category: 'Vegetables', bn: 'পাট শাক' },
  kochu: { term: 'taro root', category: 'Vegetables', bn: 'কচু' },
  kochurloti: { term: 'taro stolon', category: 'Vegetables', bn: 'কচুর লতি' },
  mukhikochu: { term: 'taro eddoe', category: 'Vegetables', bn: 'কচুর মুখী' },
  shim: { term: 'hyacinth bean', category: 'Vegetables', bn: 'শিম' },
  seem: { term: 'hyacinth bean', category: 'Vegetables', bn: 'শিম' },
  borboti: { term: 'yardlong bean', category: 'Vegetables', bn: 'বরবটি' },
  barbati: { term: 'yardlong bean', category: 'Vegetables', bn: 'বরবটি' },
  motorshuti: { term: 'green peas', category: 'Vegetables', bn: 'মটরশুঁটি' },
  motorsuti: { term: 'green peas', category: 'Vegetables', bn: 'মটরশুঁটি' },
  peas: { term: 'green peas', category: 'Vegetables', bn: 'মটরশুঁটি' },
  shojne: { term: 'moringa drumstick', category: 'Vegetables', bn: 'সজনে' },
  sojne: { term: 'moringa drumstick', category: 'Vegetables', bn: 'সজনে' },
  moringa: { term: 'moringa drumstick', category: 'Vegetables', bn: 'সজনে' },
  capsicum: { term: 'bell pepper capsicum', category: 'Vegetables', bn: 'ক্যাপসিকাম' },
  broccoli: { term: 'green broccoli', category: 'Vegetables', bn: 'ব্রকলি' },
  mushroom: { term: 'fresh mushroom', category: 'Vegetables', bn: 'মাশরুম' },

  // Tubers
  alu: { term: 'fresh potato', category: 'Tubers', bn: 'আলু' },
  aalu: { term: 'fresh potato', category: 'Tubers', bn: 'আলু' },
  golalu: { term: 'fresh potato', category: 'Tubers', bn: 'গোল আলু' },
  potato: { term: 'fresh potato', category: 'Tubers', bn: 'আলু' },
  potatoes: { term: 'fresh potato', category: 'Tubers', bn: 'আলু' },
  diamondalu: { term: 'potato', category: 'Tubers', bn: 'ডায়মন্ড আলু' },
  mistialu: { term: 'sweet potato', category: 'Tubers', bn: 'মিষ্টি আলু' },
  sweetpotato: { term: 'sweet potato', category: 'Tubers', bn: 'মিষ্টি আলু' },

  // Fruits
  pepe: { term: 'fresh papaya', category: 'Fruits', bn: 'পেঁপে' },
  kachapepe: { term: 'green raw papaya', category: 'Vegetables', bn: 'কাঁচা পেঁপে' },
  pakapepe: { term: 'ripe papaya fruit', category: 'Fruits', bn: 'পাকা পেঁপে' },
  papaya: { term: 'papaya fruit', category: 'Fruits', bn: 'পেঁপে' },
  aam: { term: 'mango', category: 'Fruits', bn: 'আম' },
  am: { term: 'mango', category: 'Fruits', bn: 'আম' },
  mango: { term: 'fresh mango', category: 'Fruits', bn: 'আম' },
  mangoes: { term: 'fresh mangoes', category: 'Fruits', bn: 'আম' },
  amrapali: { term: 'amrapali mango', category: 'Fruits', bn: 'আম্রপালি' },
  himsagar: { term: 'himsagar mango', category: 'Fruits', bn: 'হিমসাগর' },
  fazli: { term: 'fazli mango', category: 'Fruits', bn: 'ফজলি' },
  kola: { term: 'banana', category: 'Fruits', bn: 'কলা' },
  shobrikola: { term: 'ripe banana', category: 'Fruits', bn: 'সবরি কলা' },
  sagorkola: { term: 'ripe banana', category: 'Fruits', bn: 'সাগর কলা' },
  kachakola: { term: 'raw green plantain cooking banana', category: 'Vegetables', bn: 'কাঁচকলা' },
  banana: { term: 'banana', category: 'Fruits', bn: 'কলা' },
  plantain: { term: 'green cooking plantain banana', category: 'Vegetables', bn: 'কাঁচকলা' },
  kathal: { term: 'jackfruit', category: 'Fruits', bn: 'কাঁঠাল' },
  kaathal: { term: 'jackfruit', category: 'Fruits', bn: 'কাঁঠাল' },
  jackfruit: { term: 'jackfruit', category: 'Fruits', bn: 'কাঁঠাল' },
  peyara: { term: 'guava fruit', category: 'Fruits', bn: 'পেয়ারা' },
  piyara: { term: 'guava fruit', category: 'Fruits', bn: 'পেয়ারা' },
  peara: { term: 'guava fruit', category: 'Fruits', bn: 'পেয়ারা' },
  guava: { term: 'guava fruit', category: 'Fruits', bn: 'পেয়ারা' },
  lebu: { term: 'lemon lime', category: 'Fruits', bn: 'লেবু' },
  kagojilebu: { term: 'lime green lemon', category: 'Fruits', bn: 'কাগজি লেবু' },
  lemon: { term: 'lemon', category: 'Fruits', bn: 'লেবু' },
  lime: { term: 'lime green', category: 'Fruits', bn: 'লেবু' },
  tormuj: { term: 'watermelon', category: 'Fruits', bn: 'তরমুজ' },
  tarmuj: { term: 'watermelon', category: 'Fruits', bn: 'তরমুজ' },
  watermelon: { term: 'watermelon', category: 'Fruits', bn: 'তরমুজ' },
  bangi: { term: 'muskmelon cantaloupe', category: 'Fruits', bn: 'বাঙ্গি' },
  anaros: { term: 'pineapple fruit', category: 'Fruits', bn: 'আনারস' },
  anarosh: { term: 'pineapple fruit', category: 'Fruits', bn: 'আনারস' },
  pineapple: { term: 'pineapple fruit', category: 'Fruits', bn: 'আনারস' },
  lichu: { term: 'lychee litchi fruit', category: 'Fruits', bn: 'লিচু' },
  leechu: { term: 'lychee fruit', category: 'Fruits', bn: 'লিচু' },
  lychee: { term: 'lychee fruit', category: 'Fruits', bn: 'লিচু' },
  dragon: { term: 'dragon fruit pitaya', category: 'Fruits', bn: 'ড্রাগন ফল' },
  dragonfruit: { term: 'dragon fruit pitaya', category: 'Fruits', bn: 'ড্রাগন ফল' },
  komla: { term: 'fresh orange citrus', category: 'Fruits', bn: 'কমলা' },
  orange: { term: 'fresh orange citrus', category: 'Fruits', bn: 'কমলা' },
  malta: { term: 'malta orange citrus fruit', category: 'Fruits', bn: 'মাল্টা' },
  strawberry: { term: 'strawberry', category: 'Fruits', bn: 'স্ট্রবেরি' },
  dalim: { term: 'pomegranate', category: 'Fruits', bn: 'ডালিম' },
  bedana: { term: 'pomegranate', category: 'Fruits', bn: 'বেদানা' },
  pomegranate: { term: 'pomegranate', category: 'Fruits', bn: 'ডালিম' },
  angur: { term: 'fresh grapes', category: 'Fruits', bn: 'আঙুর' },
  grapes: { term: 'fresh grapes', category: 'Fruits', bn: 'আঙুর' },
  boroi: { term: 'jujube plum', category: 'Fruits', bn: 'বরই' },
  kul: { term: 'jujube plum', category: 'Fruits', bn: 'কুল' },
  bel: { term: 'wood apple', category: 'Fruits', bn: 'বেল' },
  amra: { term: 'hog plum', category: 'Fruits', bn: 'আমড়া' },

  // Grains & Pulses
  dhan: { term: 'paddy rice field harvest', category: 'Grains', bn: 'ধান' },
  paddy: { term: 'paddy rice harvest', category: 'Grains', bn: 'ধান' },
  bridhan: { term: 'paddy rice harvest', category: 'Grains', bn: 'ব্রি ধান' },
  chal: { term: 'raw white rice grains', category: 'Grains', bn: 'চাল' },
  chaal: { term: 'raw white rice grains', category: 'Grains', bn: 'চাল' },
  rice: { term: 'rice grains harvest', category: 'Grains', bn: 'চাল' },
  gom: { term: 'wheat grain harvest', category: 'Grains', bn: 'গম' },
  wheat: { term: 'wheat grain harvest', category: 'Grains', bn: 'গম' },
  bhutta: { term: 'corn maize cob', category: 'Grains', bn: 'ভুট্টা' },
  butta: { term: 'corn maize cob', category: 'Grains', bn: 'ভুট্টা' },
  corn: { term: 'corn maize', category: 'Grains', bn: 'ভুট্টা' },
  maize: { term: 'corn maize', category: 'Grains', bn: 'ভুট্টা' },
  dal: { term: 'lentils pulses', category: 'Grains', bn: 'ডাল' },
  daal: { term: 'lentils pulses', category: 'Grains', bn: 'ডাল' },
  mosurdal: { term: 'red lentils masoor dal', category: 'Grains', bn: 'মসুর ডাল' },
  masoordal: { term: 'red lentils masoor dal', category: 'Grains', bn: 'মসুর ডাল' },
  mugdal: { term: 'mung dal lentils', category: 'Grains', bn: 'মুগ ডাল' },
  chola: { term: 'chickpeas', category: 'Grains', bn: 'ছোলা' },
  chickpeas: { term: 'chickpeas', category: 'Grains', bn: 'ছোলা' },

  // Spices & Oilseeds
  shorshe: { term: 'mustard seeds', category: 'Spices', bn: 'সরিষা' },
  sorisha: { term: 'mustard seeds', category: 'Spices', bn: 'সরিষা' },
  sorisa: { term: 'mustard seeds', category: 'Spices', bn: 'সরিষা' },
  mustard: { term: 'mustard seeds', category: 'Spices', bn: 'সরিষা' },
  peyaj: { term: 'fresh red onions', category: 'Spices', bn: 'পেঁয়াজ' },
  peaj: { term: 'fresh red onions', category: 'Spices', bn: 'পেঁয়াজ' },
  piyaj: { term: 'fresh red onions', category: 'Spices', bn: 'পেঁয়াজ' },
  piaz: { term: 'fresh red onions', category: 'Spices', bn: 'পেঁয়াজ' },
  onion: { term: 'fresh red onions', category: 'Spices', bn: 'পেঁয়াজ' },
  onions: { term: 'fresh red onions', category: 'Spices', bn: 'পেঁয়াজ' },
  roshun: { term: 'fresh garlic bulbs', category: 'Spices', bn: 'রসুন' },
  roshon: { term: 'fresh garlic bulbs', category: 'Spices', bn: 'রসুন' },
  roson: { term: 'fresh garlic bulbs', category: 'Spices', bn: 'রসুন' },
  garlic: { term: 'fresh garlic bulbs', category: 'Spices', bn: 'রসুন' },
  ada: { term: 'fresh ginger root', category: 'Spices', bn: 'আদা' },
  aada: { term: 'fresh ginger root', category: 'Spices', bn: 'আদা' },
  ginger: { term: 'fresh ginger root', category: 'Spices', bn: 'আদা' },
  holud: { term: 'turmeric root', category: 'Spices', bn: 'হলুদ' },
  haldi: { term: 'turmeric root', category: 'Spices', bn: 'হলুদ' },
  turmeric: { term: 'turmeric root', category: 'Spices', bn: 'হলুদ' },
  jeera: { term: 'cumin seeds', category: 'Spices', bn: 'জিরা' },
  jira: { term: 'cumin seeds', category: 'Spices', bn: 'জিরা' },
  cumin: { term: 'cumin seeds', category: 'Spices', bn: 'জিরা' },
  dhonia: { term: 'coriander seeds cilantro', category: 'Spices', bn: 'ধনিয়া' },
  dhone: { term: 'fresh coriander leaves', category: 'Spices', bn: 'ধনে' },
  coriander: { term: 'coriander seeds', category: 'Spices', bn: 'ধনে' },
  badam: { term: 'peanuts groundnuts', category: 'Spices', bn: 'বাদাম' },
  chinabadam: { term: 'raw peanuts in shell', category: 'Spices', bn: 'চিনাবাদাম' },
  peanuts: { term: 'raw peanuts', category: 'Spices', bn: 'চিনাবাদাম' },
  til: { term: 'sesame seeds', category: 'Spices', bn: 'তিল' },
  sesame: { term: 'sesame seeds', category: 'Spices', bn: 'তিল' },
  elach: { term: 'cardamom pods', category: 'Spices', bn: 'এলাচ' },
  elachi: { term: 'cardamom pods', category: 'Spices', bn: 'এলাচ' },
  cardamom: { term: 'cardamom pods', category: 'Spices', bn: 'এলাচ' },
  daruchini: { term: 'cinnamon sticks', category: 'Spices', bn: 'দারুচিনি' },
  cinnamon: { term: 'cinnamon sticks', category: 'Spices', bn: 'দারুচিনি' },
  golmorich: { term: 'black peppercorns', category: 'Spices', bn: 'গোলমরিচ' },
  blackpepper: { term: 'black peppercorns', category: 'Spices', bn: 'গোলমরিচ' },
};

// ─── 4. HIGH RESOLUTION CATEGORY FALLBACK IMAGES ──────────────────────────
export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  Vegetables: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  Fruits: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&auto=format&fit=crop&q=80',
  Tubers: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
  Grains: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&auto=format&fit=crop&q=80',
  Spices: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&auto=format&fit=crop&q=80',
  Other: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=800&auto=format&fit=crop&q=80',
};

// ─── 5. NAME NORMALIZATION UTILITY ─────────────────────────────────────────
export interface NormalizedCropResult {
  searchTerm: string;
  category: string;
  isBengali: boolean;
  isBanglish: boolean;
  originalInput: string;
  matchedBengali?: string;
}

/**
 * Normalizes user-input crop names (Bengali, English, or Banglish)
 * into a clean, standard English search term before querying image APIs.
 */
export function normalizeCropName(rawInput: string): NormalizedCropResult {
  const originalInput = (rawInput || '').trim();
  if (!originalInput) {
    return {
      searchTerm: 'vegetable crop',
      category: 'Vegetables',
      isBengali: false,
      isBanglish: false,
      originalInput: '',
    };
  }

  // Detect Bengali characters
  const isBengali = /[\u0980-\u09FF]/.test(originalInput);

  if (isBengali) {
    const cleanBn = originalInput.replace(/[^\u0980-\u09FF\s]/g, '').trim();

    // 1. Direct match in Bengali dictionary
    if (BN_TO_EN_CROPS[cleanBn]) {
      return {
        searchTerm: BN_TO_EN_CROPS[cleanBn].term,
        category: BN_TO_EN_CROPS[cleanBn].category,
        isBengali: true,
        isBanglish: false,
        originalInput,
        matchedBengali: cleanBn,
      };
    }

    // 2. Substring match
    for (const [bnKey, data] of Object.entries(BN_TO_EN_CROPS)) {
      if (cleanBn.includes(bnKey) || bnKey.includes(cleanBn)) {
        return {
          searchTerm: data.term,
          category: data.category,
          isBengali: true,
          isBanglish: false,
          originalInput,
          matchedBengali: bnKey,
        };
      }
    }

    // 3. Word token match
    const tokens = cleanBn.split(/\s+/);
    for (const token of tokens) {
      if (BN_TO_EN_CROPS[token]) {
        return {
          searchTerm: BN_TO_EN_CROPS[token].term,
          category: BN_TO_EN_CROPS[token].category,
          isBengali: true,
          isBanglish: false,
          originalInput,
          matchedBengali: token,
        };
      }
    }

    return {
      searchTerm: cleanBn,
      category: 'Vegetables',
      isBengali: true,
      isBanglish: false,
      originalInput,
    };
  }

  // Input is in Latin script: English or Banglish
  const cleanLatin = originalInput.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  const compactLatin = cleanLatin.replace(/\s+/g, '');

  // 1. Check compact Banglish (e.g. "kachamorich", "mistikumra", "deshipotol")
  if (BANGLISH_TO_EN_CROPS[compactLatin]) {
    const item = BANGLISH_TO_EN_CROPS[compactLatin];
    return {
      searchTerm: item.term,
      category: item.category,
      isBengali: false,
      isBanglish: true,
      originalInput,
      matchedBengali: item.bn,
    };
  }

  // 2. Check tokenized Banglish
  const tokens = cleanLatin.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (BANGLISH_TO_EN_CROPS[token]) {
      const item = BANGLISH_TO_EN_CROPS[token];
      return {
        searchTerm: item.term,
        category: item.category,
        isBengali: false,
        isBanglish: true,
        originalInput,
        matchedBengali: item.bn,
      };
    }
  }

  // 3. Strip generic prefixes / adjectives from English
  const englishStripped = cleanLatin
    .replace(/\b(fresh|organic|hybrid|deshi|desi|local|quality|grade|green|red|yellow|raw|dry|ripe|pure|winter|summer|farm|sweet)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const finalEnglishTerm = englishStripped.length >= 2 ? englishStripped : cleanLatin;

  // Check if stripped term matches Banglish
  const strippedCompact = finalEnglishTerm.replace(/\s+/g, '');
  if (BANGLISH_TO_EN_CROPS[strippedCompact]) {
    const item = BANGLISH_TO_EN_CROPS[strippedCompact];
    return {
      searchTerm: item.term,
      category: item.category,
      isBengali: false,
      isBanglish: true,
      originalInput,
      matchedBengali: item.bn,
    };
  }

  return {
    searchTerm: finalEnglishTerm,
    category: 'Vegetables',
    isBengali: false,
    isBanglish: false,
    originalInput,
  };
}

/**
 * Legacy translation helper for backward compatibility
 */
export function translateCropNameToEnglish(name: string): {
  query: string;
  isBengali: boolean;
  original: string;
} {
  const norm = normalizeCropName(name);
  return {
    query: norm.searchTerm,
    isBengali: norm.isBengali,
    original: norm.originalInput,
  };
}

// ─── 6. LOCAL STORAGE IMAGE CACHE ──────────────────────────────────────────
const CACHE_KEY = 'nativebazar_crop_images_cache_v2';

const getCache = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const setCache = (key: string, url: string) => {
  if (typeof window === 'undefined') return;
  try {
    const cache = getCache();
    cache[key.toLowerCase().trim()] = url;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
};

// ─── 7. PREDEFINED VERIFIED AGRICULTURAL CATALOG LOOKUP ────────────────────
export function findPredefinedCropImage(cropName: string): string | null {
  if (!cropName || typeof cropName !== 'string') return null;
  const q = cropName.toLowerCase().trim();
  if (!q) return null;

  // Direct special fix for pointed gourd / potol
  if (/পটল|pointed gourd|potol|patal/i.test(q)) {
    return 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/Pointed_gourd.jpg/800px-Pointed_gourd.jpg';
  }

  // Exact or keyword match in predefined MASTER_AGRICULTURAL_CATALOG
  for (const item of MASTER_AGRICULTURAL_CATALOG) {
    const nameEn = (item.name || '').toLowerCase();
    const nameBn = (item.nameBn || '').toLowerCase();
    const keywords = (item.keywords || []).map((k: string) => k.toLowerCase());

    if (
      nameEn === q ||
      nameBn === q ||
      keywords.includes(q) ||
      nameEn.includes(q) ||
      nameBn.includes(q) ||
      keywords.some((k: string) => q.includes(k) || k.includes(q))
    ) {
      if (item.imageUrl && !item.imageUrl.includes('photo-1626074353765-517a681e40be')) {
        return item.imageUrl;
      }
    }
  }

  return null;
}

// ─── 8. FREE IMAGE APIS INTEGRATION ─────────────────────────────────────────

/**
 * A. Pixabay Image API
 * Free, reliable image search for high quality agricultural and food photos.
 */
async function searchPixabayApi(searchTerm: string): Promise<string | null> {
  const pixabayKey = (import.meta as any).env?.VITE_PIXABAY_API_KEY || '49091632-4752899478f4b005e8dae41ad';
  if (!pixabayKey) return null;

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3500);

    const url = `https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(
      searchTerm + ' vegetable'
    )}&image_type=photo&category=food&per_page=3&safesearch=true`;
    
    const res = await fetch(url, { signal: controller?.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const hit = data?.hits?.[0];
      if (hit?.webformatURL || hit?.largeImageURL) {
        return hit.webformatURL || hit.largeImageURL;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * B. Unsplash API
 * Queries official Unsplash search with configured access key.
 */
async function searchUnsplashApi(searchTerm: string): Promise<string | null> {
  const unsplashKey = (import.meta as any).env?.VITE_UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) return null;

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3500);

    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      searchTerm + ' agriculture'
    )}&per_page=1&orientation=landscape&client_id=${unsplashKey}`;
    const res = await fetch(url, { signal: controller?.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const photo = data?.results?.[0];
      if (photo?.urls?.regular) {
        return photo.urls.regular;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * C. Google Custom Search API
 */
async function searchGoogleCustomSearch(searchTerm: string): Promise<string | null> {
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_SEARCH_API_KEY;
  const cx = (import.meta as any).env?.VITE_GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) return null;

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3500);

    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      searchTerm + ' crop agriculture'
    )}&searchType=image&num=1&key=${apiKey}&cx=${cx}`;
    const res = await fetch(url, { signal: controller?.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const item = data?.items?.[0];
      if (item?.link) {
        return item.link;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * D. Backend Node.js Image Proxy (/api/images/crop-search)
 */
async function searchBackendImageProxy(searchTerm: string, category?: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3000);

    const baseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
    const url = `${baseUrl}/api/images/crop-search?q=${encodeURIComponent(searchTerm)}&category=${encodeURIComponent(
      category || ''
    )}`;
    const res = await fetch(url, { signal: controller?.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.imageUrl) {
        return data.imageUrl;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * E. Wikipedia and Wikimedia Commons PageImages APIs
 * 100% Free, zero auth keys required, open CORS (origin=*).
 */
async function searchWikipediaImage(searchTerm: string, isBengali: boolean, originalBn: string): Promise<string | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = setTimeout(() => controller?.abort(), 3500);

  try {
    // If input is Bengali, try bn.wikipedia.org first
    if (isBengali && originalBn) {
      try {
        const bnUrl = `https://bn.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          originalBn
        )}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json&origin=*`;
        const res = await fetch(bnUrl, { signal: controller?.signal });
        if (res.ok) {
          const data = await res.json();
          const pages = data?.query?.pages;
          if (pages) {
            const first = Object.values(pages)[0] as any;
            if (first?.thumbnail?.source) {
              clearTimeout(timeoutId);
              return first.thumbnail.source;
            }
          }
        }
      } catch {}
    }

    // Try en.wikipedia.org with English query
    const enSearchTerms = [`${searchTerm} crop`, `${searchTerm} vegetable`, `${searchTerm} fruit`, searchTerm];
    for (const term of enSearchTerms) {
      try {
        const enUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          term
        )}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json&origin=*`;
        const res = await fetch(enUrl, { signal: controller?.signal });
        if (res.ok) {
          const data = await res.json();
          const pages = data?.query?.pages;
          if (pages) {
            const first = Object.values(pages)[0] as any;
            if (first?.thumbnail?.source) {
              clearTimeout(timeoutId);
              return first.thumbnail.source;
            }
          }
        }
      } catch {}
    }

    // Try Wikimedia Commons search
    try {
      const commUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        `${searchTerm} vegetable harvest`
      )}&gsrlimit=1&prop=imageinfo&iiprop=url&format=json&origin=*`;
      const res = await fetch(commUrl, { signal: controller?.signal });
      if (res.ok) {
        const data = await res.json();
        const pages = data?.query?.pages;
        if (pages) {
          const first = Object.values(pages)[0] as any;
          const imgUrl = first?.imageinfo?.[0]?.url;
          if (imgUrl && !imgUrl.endsWith('.svg') && !imgUrl.endsWith('.ogg')) {
            clearTimeout(timeoutId);
            return imgUrl;
          }
        }
      }
    } catch {}

    clearTimeout(timeoutId);
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

// ─── 9. MAIN FUNCTION: DYNAMIC IMAGE FETCHING ──────────────────────────────
/**
 * Automatically searches and fetches a relevant image for any crop name
 * (Bengali, English, or Banglish).
 * 
 * Pipeline:
 * 1. Checks local cache for instant retrieval.
 * 2. Checks predefined agricultural database.
 * 3. Normalizes input (translates Bengali/Banglish to standard English).
 * 4. Queries Free APIs:
 *    - Pixabay API
 *    - Unsplash API
 *    - Google Custom Search API
 *    - Backend proxy
 *    - Open Wikipedia/Wikimedia Commons PageImages API
 * 5. Falls back cleanly to category imagery or the default SVG placeholder.
 */
export async function fetchCropImage(cropName: string, category?: string): Promise<string> {
  const trimmed = (cropName || '').trim();
  if (!trimmed) {
    return DEFAULT_CROP_PLACEHOLDER;
  }

  const cacheKey = trimmed.toLowerCase();

  // 1. Check local cache
  const cached = getCache()[cacheKey];
  if (cached && !cached.includes('photo-1626074353765-517a681e40be')) {
    return cached;
  }

  // 2. Check predefined verified database
  const predefined = findPredefinedCropImage(trimmed);
  if (predefined) {
    setCache(cacheKey, predefined);
    return predefined;
  }

  // 3. Normalize crop name (Bengali, Banglish, or English)
  const norm = normalizeCropName(trimmed);
  const activeCategory = category || norm.category || 'Vegetables';
  const searchTerm = norm.searchTerm;

  // 4. Multi-tier API search:

  // A. Pixabay Image API
  try {
    const pixabayUrl = await searchPixabayApi(searchTerm);
    if (pixabayUrl) {
      setCache(cacheKey, pixabayUrl);
      return pixabayUrl;
    }
  } catch {}

  // B. Unsplash API
  try {
    const unsplashUrl = await searchUnsplashApi(searchTerm);
    if (unsplashUrl) {
      setCache(cacheKey, unsplashUrl);
      return unsplashUrl;
    }
  } catch {}

  // C. Google Custom Search
  try {
    const googleUrl = await searchGoogleCustomSearch(searchTerm);
    if (googleUrl) {
      setCache(cacheKey, googleUrl);
      return googleUrl;
    }
  } catch {}

  // D. Backend Proxy
  try {
    const backendUrl = await searchBackendImageProxy(searchTerm, activeCategory);
    if (backendUrl) {
      setCache(cacheKey, backendUrl);
      return backendUrl;
    }
  } catch {}

  // E. Wikipedia & Wikimedia Commons PageImages (Open CORS, No Key)
  try {
    const wikiUrl = await searchWikipediaImage(searchTerm, norm.isBengali, norm.matchedBengali || trimmed);
    if (wikiUrl) {
      setCache(cacheKey, wikiUrl);
      return wikiUrl;
    }
  } catch {}

  // 5. High-resolution category fallback or default harvest placeholder
  const fallback = CATEGORY_FALLBACK_IMAGES[activeCategory] || DEFAULT_CROP_PLACEHOLDER;
  setCache(cacheKey, fallback);
  return fallback;
}
