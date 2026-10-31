/**
 * NativeBazar Crop Image Service
 * 
 * Provides dynamic image fetching for crops and agricultural products:
 * 1. Checks predefined catalog/mock database first for high-quality verified images.
 * 2. If not found in predefined database:
 *    - Translates Bengali crop names to English agricultural keywords.
 *    - Searches free image APIs:
 *      * Unsplash API (via VITE_UNSPLASH_ACCESS_KEY or client key)
 *      * Pexels API (via VITE_PEXELS_API_KEY)
 *      * Google Custom Search API (via VITE_GOOGLE_SEARCH_API_KEY & VITE_GOOGLE_SEARCH_CX)
 *      * Backend image search proxy (/api/images/crop-search)
 *      * Free zero-key Wikimedia & Wikipedia PageImages API (CORS origin=*)
 *    - Automatically caches fetched images locally to minimize network latency.
 *    - Provides contextual agricultural fallback images by category when offline.
 */

import { MASTER_AGRICULTURAL_CATALOG, CatalogProduct } from '../data/catalogData';

// ─── COMPREHENSIVE BENGALI TO ENGLISH CROP MAPPING ─────────────────────────
export const BN_TO_EN_CROPS: Record<string, string> = {
  // Vegetables
  'পটল': 'pointed gourd',
  'দেশি পটল': 'pointed gourd',
  'কচি পটল': 'pointed gourd',
  'লাউ': 'bottle gourd',
  'কচি লাউ': 'bottle gourd',
  'মিষ্টি কুমড়া': 'sweet pumpkin',
  'মিষ্টি কুমড়া': 'sweet pumpkin',
  'কুমড়া': 'pumpkin',
  'কুমড়া': 'pumpkin',
  'চাল কুমড়া': 'ash gourd',
  'চাল কুমড়া': 'ash gourd',
  'করলা': 'bitter gourd',
  'উচ্ছে': 'bitter gourd',
  'ঝিঙে': 'ridge gourd',
  'ঝিঙ্গা': 'ridge gourd',
  'চিচিঙ্গা': 'snake gourd',
  'ধন্দুল': 'sponge gourd',
  'ধুন্দুল': 'sponge gourd',
  'ঢ্যাঁড়শ': 'okra lady finger',
  'ঢ্যাঁড়শ': 'okra lady finger',
  'ঢেঁড়শ': 'okra lady finger',
  'বেগুন': 'eggplant brinjal',
  'গোল বেগুন': 'eggplant brinjal',
  'তাল বেগুন': 'eggplant brinjal',
  'টমেটো': 'ripe red tomato',
  'শসা': 'fresh green cucumber',
  'ক্ষীরা': 'cucumber',
  'ফুলকপি': 'cauliflower',
  'স্নোবল ফুলকপি': 'cauliflower',
  'বাঁধাকপি': 'cabbage',
  'বাধাকপি': 'cabbage',
  'ওলকপি': 'kohlrabi',
  'ব্রকলি': 'green broccoli',
  'সজনে': 'moringa drumstick',
  'সজনে ডাঁটা': 'moringa drumstick',
  'সজিনা': 'moringa drumstick',
  'শিম': 'hyacinth bean',
  'বরবটি': 'yardlong bean',
  'মটরশুঁটি': 'green peas',
  'মটরশুটি': 'green peas',
  'গাজর': 'fresh carrot',
  'মুলা': 'white radish',
  'মূলা': 'white radish',
  'শালগম': 'turnip',
  'বিটরুট': 'beetroot',
  'মাশরুম': 'fresh edible mushroom',
  'ক্যাপসিকাম': 'bell pepper capsicum',
  'লেটুস': 'fresh lettuce leaves',
  'পালং শাক': 'spinach green leaves',
  'লাল শাক': 'red amaranth spinach',
  'পুঁই শাক': 'malabar spinach',
  'পুই শাক': 'malabar spinach',
  'কলমি শাক': 'water spinach',
  'ডাঁটা শাক': 'amaranth greens',
  'ডাটা শাক': 'amaranth greens',
  'পাট শাক': 'jute leaves vegetable',
  'কচু': 'taro root',
  'কচুর লতি': 'taro stolon',
  'কচুর মুখী': 'taro root eddoe',
  'অ্যাসপারাগাস': 'asparagus green',

  // Tubers
  'আলু': 'fresh potatoes',
  'গোল আলু': 'fresh potatoes',
  'ডায়মন্ড আলু': 'fresh potatoes',
  'মিষ্টি আলু': 'sweet potato',

  // Fruits
  'পেঁপে': 'fresh papaya fruit',
  'পেপে': 'fresh papaya fruit',
  'কাঁচা পেঁপে': 'raw green papaya',
  'পাকা পেঁপে': 'ripe sweet papaya fruit',
  'আম': 'fresh mangoes',
  'আম্রপালি': 'amrapali mangoes',
  'হিমসাগর': 'himsagar mangoes',
  'ফজলি': 'fazli mangoes',
  'কাঁঠাল': 'jackfruit',
  'কলা': 'fresh bananas',
  'সবরি কলা': 'fresh ripe bananas',
  'সাগর কলা': 'fresh ripe bananas',
  'কাঁচকলা': 'raw green cooking banana plantain',
  'পেয়ারা': 'fresh guava fruit',
  'পেয়ারা': 'fresh guava fruit',
  'লিচু': 'fresh sweet lychee litchi fruit',
  'তরমুজ': 'fresh whole watermelon',
  'বাঙ্গি': 'muskmelon cantaloupe',
  'আনারস': 'fresh whole pineapple fruit',
  'ড্রাগন ফল': 'red dragon fruit pitaya',
  'ড্রাগন': 'dragon fruit pitaya',
  'কমলা': 'fresh orange fruit',
  'মাল্টা': 'sweet malta orange citrus',
  'লেবু': 'fresh green lemon lime',
  'কাগজি লেবু': 'fresh green lime',
  'বাতাবি লেবু': 'pomelo citrus fruit',
  'আমলকী': 'amla indian gooseberry',
  'আমড়া': 'hog plum amra',
  'আমড়া': 'hog plum amra',
  'কামরাঙা': 'star fruit carambola',
  'জলপাই': 'fresh green olive fruit',
  'বেল': 'wood apple bael fruit',
  'কদবেল': 'elephant apple wood apple',
  'স্ট্রবেরি': 'fresh red strawberries',
  'কুল': 'jujube plum boroi',
  'বরই': 'jujube plum boroi',
  'ডালিম': 'pomegranate fruit',
  'বেদানা': 'pomegranate fruit',
  'আঙুর': 'fresh grapes fruit',
  'আতা': 'custard apple',
  'শরিফা': 'sugar apple',
  'সফেদা': 'sapodilla chickoo fruit',
  'জাম': 'black plum blackberry jamun',
  'এভোকাডো': 'avocado fresh fruit',
  'রামবুটান': 'rambutan fruit',

  // Grains & Pulses
  'ধান': 'paddy rice field harvest',
  'ব্রি ধান': 'paddy rice field harvest',
  'চাল': 'raw white rice grains',
  'গম': 'wheat grain harvest',
  'ভুট্টা': 'maize corn cob grain',
  'হলুদ ভুট্টা': 'yellow corn maize',
  'মসুর ডাল': 'red lentils masoor dal',
  'মুগ ডাল': 'yellow mung dal lentils',
  'ছোলা': 'chickpeas garbanzo beans',
  'খেসারি ডাল': 'grass pea lentils',
  'মাষকলাই': 'black gram dal',
  'কালাই': 'black gram dal',

  // Spices & Oilseeds
  'সরিষা': 'mustard seeds yellow field',
  'সর্ষে': 'mustard seeds yellow',
  'হলুদ সরিষা': 'yellow mustard seeds',
  'পেঁয়াজ': 'fresh red onions',
  'পেয়াজ': 'fresh red onions',
  'রসুন': 'fresh garlic bulbs',
  'আদা': 'fresh ginger root rhizome',
  'কাঁচা হলুদ': 'raw turmeric root',
  'হলুদ গুঁড়া': 'turmeric powder spice',
  'কাঁচা মরিচ': 'fresh green hot chili peppers',
  'শুকনা মরিচ': 'dry red hot chili peppers',
  'মরিচ': 'fresh green chili peppers',
  'ধনে': 'fresh coriander cilantro leaves',
  'ধনিয়া': 'coriander seeds cilantro',
  'জিরা': 'cumin seeds spice',
  'কালোজিরা': 'black seed nigella seeds',
  'মেথি': 'fenugreek seeds',
  'মৌরি': 'fennel seeds',
  'তিল': 'sesame seeds',
  'চিনাবাদাম': 'raw peanuts in shell groundnuts',
  'বাদাম': 'peanuts groundnuts',
  'সয়াবিন': 'soybean grains',
  'সয়াবিন': 'soybean grains',
  'তেজপাতা': 'bay leaves dried',
  'দারুচিনি': 'cinnamon sticks spice',
  'এলাচ': 'green cardamom pods',
  'লবঙ্গ': 'cloves spice',
  'গোলমরিচ': 'black pepper corns',
};

// ─── HIGH RESOLUTION CATEGORY FALLBACK IMAGES ──────────────────────────────
export const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  Vegetables: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
  Fruits: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?w=800&auto=format&fit=crop&q=80',
  Tubers: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
  Grains: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=800&auto=format&fit=crop&q=80',
  Spices: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=800&auto=format&fit=crop&q=80',
  Other: 'https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=800&auto=format&fit=crop&q=80',
};

// Local storage cache key
const CACHE_KEY = 'nativebazar_crop_images_cache';

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
  } catch {
    // ignore storage quota errors
  }
};

/**
 * 1. Checks if the crop exists in the predefined catalog/database.
 * Returns the verified predefined image URL or null if not found.
 */
export function findPredefinedCropImage(cropName: string): string | null {
  if (!cropName || typeof cropName !== 'string') return null;
  const q = cropName.toLowerCase().trim();
  if (!q) return null;

  // Direct special fix for pointed gourd / potol
  if (q.includes('পটল') || q.includes('pointed gourd') || q.includes('patal') || q.includes('potol')) {
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

/**
 * 2. Translates or normalizes Bengali and English crop names into an optimized search query.
 */
export function translateCropNameToEnglish(name: string): {
  query: string;
  isBengali: boolean;
  original: string;
} {
  const original = (name || '').trim();
  if (!original) return { query: 'vegetable crop', isBengali: false, original: '' };

  const isBengali = /[\u0980-\u09FF]/.test(original);

  if (!isBengali) {
    // English cleanup: remove generic adjectives like "Fresh", "Hybrid", "Organic", "Deshi"
    const cleaned = original
      .replace(/\b(fresh|organic|hybrid|deshi|local|quality|grade|green|raw|dry|ripe)\b/gi, '')
      .replace(/[^\w\s-]/g, '')
      .trim();
    return {
      query: cleaned.length > 2 ? cleaned : original,
      isBengali: false,
      original,
    };
  }

  // Bengali translation lookup
  const cleanBn = original.replace(/[^\u0980-\u09FF\s]/g, '').trim();

  // Exact match in dictionary
  if (BN_TO_EN_CROPS[cleanBn]) {
    return { query: BN_TO_EN_CROPS[cleanBn], isBengali: true, original };
  }

  // Substring match in dictionary
  for (const [bnKey, enVal] of Object.entries(BN_TO_EN_CROPS)) {
    if (cleanBn.includes(bnKey) || bnKey.includes(cleanBn)) {
      return { query: enVal, isBengali: true, original };
    }
  }

  // Word-by-word token lookup
  const tokens = cleanBn.split(/\s+/);
  for (const token of tokens) {
    if (BN_TO_EN_CROPS[token]) {
      return { query: BN_TO_EN_CROPS[token], isBengali: true, original };
    }
  }

  return { query: cleanBn, isBengali: true, original };
}

/**
 * 3. Search Wikipedia and Wikimedia Commons PageImages APIs (100% Free, No Key Required, with CORS origin=*).
 */
async function searchWikipediaImage(query: string, isBengali: boolean, originalBn: string): Promise<string | null> {
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
      } catch {
        // continue to en.wikipedia
      }
    }

    // Try en.wikipedia.org with English query
    const enSearchTerms = [`${query} crop`, `${query} fruit`, `${query} vegetable`, query];
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
      } catch {
        // try next term
      }
    }

    // Try Wikimedia Commons search
    try {
      const commUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        `${query} vegetable fruit`
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
    } catch {
      // fallback
    }

    clearTimeout(timeoutId);
    return null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * 4. Search Unsplash API (free access key if configured)
 */
async function searchUnsplashApi(query: string): Promise<string | null> {
  const unsplashKey = (import.meta as any).env?.VITE_UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) return null;

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3500);

    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      query + ' agriculture'
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
 * 5. Search Pexels API (free API key if configured)
 */
async function searchPexelsApi(query: string): Promise<string | null> {
  const pexelsKey = (import.meta as any).env?.VITE_PEXELS_API_KEY;
  if (!pexelsKey) return null;

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3500);

    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + ' crop')}&per_page=1`;
    const res = await fetch(url, {
      headers: { Authorization: pexelsKey },
      signal: controller?.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const photo = data?.photos?.[0];
      if (photo?.src?.large || photo?.src?.medium) {
        return photo.src.large || photo.src.medium;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 6. Search Google Custom Search API (if configured)
 */
async function searchGoogleCustomSearch(query: string): Promise<string | null> {
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_SEARCH_API_KEY;
  const cx = (import.meta as any).env?.VITE_GOOGLE_SEARCH_CX;
  if (!apiKey || !cx) return null;

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3500);

    const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
      query + ' crop'
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
 * 7. Call Backend Crop Image Search Endpoint (/api/images/crop-search) if available
 */
async function searchBackendImageProxy(query: string, category?: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = setTimeout(() => controller?.abort(), 3000);

    const baseUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
    const url = `${baseUrl}/api/images/crop-search?q=${encodeURIComponent(query)}&category=${encodeURIComponent(
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
 * MAIN FUNCTION:
 * Automatically searches and fetches a relevant image for any crop name (Bengali or English).
 * 
 * - Checks predefined catalog database first.
 * - Searches configured free image APIs (Unsplash, Pexels, Google Custom Search).
 * - Queries backend proxy or open Wikipedia/Wikimedia PageImages.
 * - Falls back cleanly to high-res agricultural category imagery if offline.
 */
export async function fetchCropImage(cropName: string, category: string = 'Vegetables'): Promise<string> {
  const trimmed = (cropName || '').trim();
  if (!trimmed) {
    return CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.Vegetables;
  }

  const cacheKey = trimmed.toLowerCase();

  // 1. Check local cache
  const cached = getCache()[cacheKey];
  if (cached && !cached.includes('photo-1626074353765-517a681e40be')) {
    return cached;
  }

  // 2. Check predefined database
  const predefined = findPredefinedCropImage(trimmed);
  if (predefined) {
    setCache(cacheKey, predefined);
    return predefined;
  }

  // 3. Normalize & translate crop name
  const { query, isBengali, original } = translateCropNameToEnglish(trimmed);

  // 4. Try configured APIs in sequence:
  // A. Unsplash API
  try {
    const unsplashUrl = await searchUnsplashApi(query);
    if (unsplashUrl) {
      setCache(cacheKey, unsplashUrl);
      return unsplashUrl;
    }
  } catch {}

  // B. Pexels API
  try {
    const pexelsUrl = await searchPexelsApi(query);
    if (pexelsUrl) {
      setCache(cacheKey, pexelsUrl);
      return pexelsUrl;
    }
  } catch {}

  // C. Google Custom Search API
  try {
    const googleUrl = await searchGoogleCustomSearch(query);
    if (googleUrl) {
      setCache(cacheKey, googleUrl);
      return googleUrl;
    }
  } catch {}

  // D. Backend Search Proxy (Node.js server)
  try {
    const backendUrl = await searchBackendImageProxy(query, category);
    if (backendUrl) {
      setCache(cacheKey, backendUrl);
      return backendUrl;
    }
  } catch {}

  // E. Wikipedia & Wikimedia Commons PageImages API (100% Free, No Key, Open CORS)
  try {
    const wikiUrl = await searchWikipediaImage(query, isBengali, original);
    if (wikiUrl) {
      setCache(cacheKey, wikiUrl);
      return wikiUrl;
    }
  } catch {}

  // 5. Fallback to agricultural category image
  const fallback = CATEGORY_FALLBACK_IMAGES[category] || CATEGORY_FALLBACK_IMAGES.Vegetables;
  setCache(cacheKey, fallback);
  return fallback;
}
