/**
 * TCB (Trading Corporation of Bangladesh) Scraper & Price Parser
 * Fetches and parses daily market price data from http://tcb.gov.bd/pages/daily-rmps
 * 
 * Strict Constraint: Only updates wholesale/retail prices for crops that
 * ALREADY exist in the website's database/mockData. Never inserts non-crop items.
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

export interface TcbParsedItem {
  name: string;
  unit: string;
  min: number;
  max: number;
  avg: number;
}

export interface TcbMatchedCrop {
  cropId: string;
  cropName: string;
  banglaName: string;
  category: string;
  tcbItemName: string;
  tcbUnit: string;
  wholesaleDhaka: number;
  retailDhaka: number;
  avgDhaka: number;
  lastSynced: string;
}

export interface TcbSyncResult {
  success: boolean;
  source: string;
  sourceUrl: string;
  reportTitle: string;
  reportDate?: string;
  syncedAt: string;
  totalMatchedCrops: number;
  matchedCrops: Record<string, TcbMatchedCrop>;
  error?: string;
}

// ─── EXISTING NATIVEBAZAR MASTER CROPS (31 CROPS ONLY) ────────────────────────
export const EXISTING_MASTER_CROPS = [
  { id: 'veg-tomato', cropName: 'Hybrid Tomato', banglaName: 'হাইব্রিড পাকা টমেটো', category: 'Vegetables', baseWholesale: 36, baseDhaka: 46, baseRetail: 50 },
  { id: 'veg-brinjal', cropName: 'Round Eggplant (Brinjal)', banglaName: 'গোল তাল বেগুন', category: 'Vegetables', baseWholesale: 32, baseDhaka: 42, baseRetail: 48 },
  { id: 'veg-cauliflower', cropName: 'Snowball Cauliflower', banglaName: 'স্নোবল সাদা ফুলকপি', category: 'Vegetables', baseWholesale: 28, baseDhaka: 38, baseRetail: 42 },
  { id: 'veg-cabbage', cropName: 'Green Cabbage', banglaName: 'সবুজ বাঁধাকপি', category: 'Vegetables', baseWholesale: 24, baseDhaka: 34, baseRetail: 38 },
  { id: 'veg-bitter-gourd', cropName: 'Bitter Gourd (Korola)', banglaName: 'উচ্ছে / তাজা করলা', category: 'Vegetables', baseWholesale: 48, baseDhaka: 62, baseRetail: 68 },
  { id: 'veg-bottle-gourd', cropName: 'Bottle Gourd (Lau)', banglaName: 'দেশি কচি লাউ', category: 'Vegetables', baseWholesale: 35, baseDhaka: 48, baseRetail: 55 },
  { id: 'veg-pointed-gourd', cropName: 'Pointed Gourd (Potol)', banglaName: 'তাজা সবুজ পটল', category: 'Vegetables', baseWholesale: 34, baseDhaka: 45, baseRetail: 50 },
  { id: 'veg-okra', cropName: 'Okra / Ladyfinger', banglaName: 'নরম কচি ঢ্যাঁড়শ', category: 'Vegetables', baseWholesale: 36, baseDhaka: 48, baseRetail: 55 },
  { id: 'veg-cucumber', cropName: 'Crisp Cucumber', banglaName: 'দেশি তাজা শসা', category: 'Vegetables', baseWholesale: 28, baseDhaka: 38, baseRetail: 45 },
  { id: 'veg-green-papaya', cropName: 'Green Papaya', banglaName: 'কাঁচা পেঁপে', category: 'Vegetables', baseWholesale: 22, baseDhaka: 30, baseRetail: 35 },
  { id: 'veg-radish', cropName: 'White Radish', banglaName: 'সাদা তাজা মুলা', category: 'Vegetables', baseWholesale: 18, baseDhaka: 26, baseRetail: 30 },
  { id: 'veg-red-amaranth', cropName: 'Red Amaranth (Lal Shak)', banglaName: 'তাজা লাল শাক', category: 'Vegetables', baseWholesale: 16, baseDhaka: 24, baseRetail: 28 },
  { id: 'tub-diamond-potato', cropName: 'Diamond Round Potato', banglaName: 'ডায়মন্ড গোল আলু', category: 'Tubers', baseWholesale: 28, baseDhaka: 34, baseRetail: 38 },
  { id: 'tub-cardinal-potato', cropName: 'Cardinal Red Potato', banglaName: 'কার্ডিনাল লাল আলু', category: 'Tubers', baseWholesale: 30, baseDhaka: 37, baseRetail: 40 },
  { id: 'tub-granola-potato', cropName: 'Granola Potato', banglaName: 'গ্রানোলা দেশি আলু', category: 'Tubers', baseWholesale: 26, baseDhaka: 33, baseRetail: 36 },
  { id: 'tub-sweet-potato', cropName: 'Sweet Potato', banglaName: 'রাঙা / মিষ্টি আলু', category: 'Tubers', baseWholesale: 32, baseDhaka: 42, baseRetail: 48 },
  { id: 'grn-miniket-rice', cropName: 'Miniket Rice', banglaName: 'মিনিকেট চাল', category: 'Grains', baseWholesale: 68, baseDhaka: 76, baseRetail: 82 },
  { id: 'grn-najirshail-rice', cropName: 'Nazirshail Rice', banglaName: 'নাজিরশাইল চাল', category: 'Grains', baseWholesale: 78, baseDhaka: 88, baseRetail: 94 },
  { id: 'grn-brri28-paddy', cropName: 'BRRI Dhan-28 (Paddy)', banglaName: 'ব্রি ধান-২৮ (ধান)', category: 'Grains', baseWholesale: 1180, baseDhaka: 1280, baseRetail: 1340 },
  { id: 'grn-swarna-paddy', cropName: 'Aman Swarna (Paddy)', banglaName: 'আমন স্বর্ণা ধান', category: 'Grains', baseWholesale: 1080, baseDhaka: 1180, baseRetail: 1240 },
  { id: 'grn-wheat', cropName: 'Whole Wheat', banglaName: 'লাল গম', category: 'Grains', baseWholesale: 40, baseDhaka: 46, baseRetail: 50 },
  { id: 'grn-maize', cropName: 'Yellow Maize / Corn', banglaName: 'হলুদ দানা ভুট্টা', category: 'Grains', baseWholesale: 27, baseDhaka: 33, baseRetail: 36 },
  { id: 'spc-onion', cropName: 'Local Onion', banglaName: 'দেশি পেঁয়াজ', category: 'Spices', baseWholesale: 72, baseDhaka: 85, baseRetail: 92 },
  { id: 'spc-green-chili', cropName: 'Fresh Green Chili', banglaName: 'তাজা কাঁচা মরিচ', category: 'Spices', baseWholesale: 85, baseDhaka: 110, baseRetail: 120 },
  { id: 'spc-garlic', cropName: 'Local Garlic', banglaName: 'দেশি রসুন', category: 'Spices', baseWholesale: 185, baseDhaka: 215, baseRetail: 230 },
  { id: 'spc-ginger', cropName: 'Fresh Ginger', banglaName: 'দেশি আদা', category: 'Spices', baseWholesale: 190, baseDhaka: 225, baseRetail: 240 },
  { id: 'spc-dry-chili', cropName: 'Dry Red Chili', banglaName: 'শুকনা লাল মরিচ', category: 'Spices', baseWholesale: 340, baseDhaka: 390, baseRetail: 420 },
  { id: 'frt-banana', cropName: 'Sabri Banana', banglaName: 'সবরি সাগর কলা', category: 'Fruits', baseWholesale: 42, baseDhaka: 55, baseRetail: 65 },
  { id: 'frt-guava', cropName: 'Thai Guava', banglaName: 'থাই পেয়ারা', category: 'Fruits', baseWholesale: 52, baseDhaka: 68, baseRetail: 75 },
  { id: 'frt-green-coconut', cropName: 'Green Coconut', banglaName: 'মিষ্টি ডাব', category: 'Fruits', baseWholesale: 85, baseDhaka: 120, baseRetail: 135 },
  { id: 'frt-watermelon', cropName: 'Sweet Watermelon', banglaName: 'রসালো তরমুজ', category: 'Fruits', baseWholesale: 35, baseDhaka: 48, baseRetail: 55 },
];

// Strict Crop Matching Rules (Maps TCB items to existing NativeBazar crop IDs)
export const CROP_MATCH_RULES = [
  { keywords: ['আলু', 'potato'], cropIds: ['tub-diamond-potato', 'tub-cardinal-potato', 'tub-granola-potato'], exclude: ['মিষ্টি আলু'] },
  { keywords: ['মিষ্টি আলু', 'রাঙা আলু', 'sweet potato'], cropIds: ['tub-sweet-potato'] },
  { keywords: ['পিঁয়াজ', 'পেঁয়াজ', 'onion'], cropIds: ['spc-onion'] },
  { keywords: ['কাঁচামরিচ', 'কাঁচা মরিচ', 'green chili'], cropIds: ['spc-green-chili'] },
  { keywords: ['শুকনা মরিচ', 'শুকনো মরিচ', 'dry chili', 'red chili'], cropIds: ['spc-dry-chili'] },
  { keywords: ['রসুন', 'garlic'], cropIds: ['spc-garlic'] },
  { keywords: ['আদা', 'ginger'], cropIds: ['spc-ginger'] },
  { keywords: ['বেগুন', 'brinjal', 'eggplant'], cropIds: ['veg-brinjal'] },
  { keywords: ['শসা', 'cucumber'], cropIds: ['veg-cucumber'] },
  { keywords: ['টমেটো', 'tomato'], cropIds: ['veg-tomato'] },
  { keywords: ['ফুলকপি', 'cauliflower'], cropIds: ['veg-cauliflower'] },
  { keywords: ['বাঁধাকপি', 'বাধাকপি', 'cabbage'], cropIds: ['veg-cabbage'] },
  { keywords: ['করলা', 'উচ্ছে', 'bitter gourd'], cropIds: ['veg-bitter-gourd'] },
  { keywords: ['লাউ', 'bottle gourd'], cropIds: ['veg-bottle-gourd'] },
  { keywords: ['পটল', 'pointed gourd'], cropIds: ['veg-pointed-gourd'] },
  { keywords: ['ঢ্যাঁড়শ', 'ঢেঁড়শ', 'okra', 'ladyfinger'], cropIds: ['veg-okra'] },
  { keywords: ['পেঁপে', 'পেপে', 'papaya'], cropIds: ['veg-green-papaya'] },
  { keywords: ['মুলা', 'মূলা', 'radish'], cropIds: ['veg-radish'] },
  { keywords: ['লাল শাক', 'লালশাক', 'amaranth'], cropIds: ['veg-red-amaranth'] },
  { keywords: ['নাজির', 'মিনিকেট', 'miniket', 'najirshail', 'চাল সরু'], cropIds: ['grn-miniket-rice', 'grn-najirshail-rice'] },
  { keywords: ['স্বর্ণা', 'swarna', 'চাল (মোটা)'], cropIds: ['grn-swarna-paddy'] },
  { keywords: ['পাইজাম', 'brri28', 'ধান-২৮'], cropIds: ['grn-brri28-paddy'] },
  { keywords: ['গম', 'আটা সাদা', 'wheat'], cropIds: ['grn-wheat'], exclude: ['পাইজাম/আটাশ'] },
  { keywords: ['ভুট্টা', 'maize', 'corn'], cropIds: ['grn-maize'] },
  { keywords: ['কলা', 'banana'], cropIds: ['frt-banana'] },
  { keywords: ['পেয়ারা', 'পেয়ারা', 'guava'], cropIds: ['frt-guava'] },
  { keywords: ['ডাব', 'নারকেল', 'coconut'], cropIds: ['frt-green-coconut'] },
  { keywords: ['তরমুজ', 'watermelon'], cropIds: ['frt-watermelon'] },
];

/**
 * Fetch buffer with support for 301/302/308 redirects and gov.bd SSL compatibility
 */
function fetchBufferWithRedirects(url: string, maxRedirects: number = 5): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects fetching ' + url));

    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(
      url,
      {
        rejectUnauthorized: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NativeBazar/1.0 TcbPriceSync',
          Accept: '*/*',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          let nextUrl = res.headers.location;
          if (!nextUrl.startsWith('http')) {
            nextUrl = new URL(nextUrl, url).toString();
          }
          return fetchBufferWithRedirects(nextUrl, maxRedirects - 1).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP status ${res.statusCode} from ${url}`));
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout fetching ' + url));
    });
  });
}

/**
 * Scrape, download and parse raw TCB daily price items
 */
export async function scrapeRawTcbItems(): Promise<{
  reportDate?: string;
  items: TcbParsedItem[];
}> {
  const targetUrl = 'http://tcb.gov.bd/pages/daily-rmps';
  const htmlBuffer = await fetchBufferWithRedirects(targetUrl);
  const html = htmlBuffer.toString('utf8');

  // Look for .xlsx link in page
  const xlsxMatches =
    html.match(/href=[\"'](https?:\/\/[^\"']+\.xlsx)[\"']/i) ||
    html.match(/href=[\"'](\/[^\"']+\.xlsx)[\"']/i);

  if (!xlsxMatches) {
    throw new Error('No .xlsx link found on TCB daily-rmps page');
  }

  let xlsxUrl = xlsxMatches[1];
  if (!xlsxUrl.startsWith('http')) {
    xlsxUrl = 'https://tcb.gov.bd' + xlsxUrl;
  }

  // Extract report date if present
  let reportDate = '০১-১১-২০২৬';
  const dateMatch = html.match(/(\d{1,2}[-–]\d{1,2}[-–]\d{4})/);
  if (dateMatch) {
    reportDate = dateMatch[1];
  }

  const xlsxBuffer = await fetchBufferWithRedirects(xlsxUrl);
  const workbook = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const items: TcbParsedItem[] = [];
  rows.forEach((row) => {
    if (!row || !row[0]) return;
    const name = String(row[0]).trim();
    const unit = row[1] ? String(row[1]).trim() : '';
    const min = parseFloat(row[2]);
    const max = parseFloat(row[3]);
    if (!isNaN(min) && !isNaN(max) && min > 0) {
      items.push({ name, unit, min, max, avg: Math.round((min + max) / 2) });
    }
  });

  return { reportDate, items };
}

/**
 * STRICT CONSTRAINT:
 * Only updates wholesale/retail prices for the crops that ALREADY exist in MASTER_CROPS.
 * Never inserts or displays non-crop or unknown items.
 */
export function matchTcbWithExistingCrops(tcbItems: TcbParsedItem[]): Record<string, TcbMatchedCrop> {
  const matched: Record<string, TcbMatchedCrop> = {};
  const nowIso = new Date().toISOString();

  tcbItems.forEach((tcbItem) => {
    const normName = tcbItem.name.toLowerCase();

    for (const rule of CROP_MATCH_RULES) {
      if (rule.exclude && rule.exclude.some((ex) => normName.includes(ex.toLowerCase()))) {
        continue;
      }
      const matchesKeyword = rule.keywords.some((kw) => normName.includes(kw.toLowerCase()));
      if (matchesKeyword) {
        rule.cropIds.forEach((cId) => {
          const crop = EXISTING_MASTER_CROPS.find((c) => c.id === cId);
          if (!crop) return; // Strict guard: Must exist in our master list!

          if (!matched[cId] || (tcbItem.name.includes('দেশী') || tcbItem.name.includes('নতুন') || tcbItem.name.includes('খোলা'))) {
            const isMaund = crop.id.includes('paddy');
            const multiplier = isMaund ? 40 : 1;

            matched[cId] = {
              cropId: cId,
              cropName: crop.cropName,
              banglaName: crop.banglaName,
              category: crop.category,
              tcbItemName: tcbItem.name,
              tcbUnit: tcbItem.unit,
              wholesaleDhaka: tcbItem.min * multiplier,
              retailDhaka: tcbItem.max * multiplier,
              avgDhaka: tcbItem.avg * multiplier,
              lastSynced: nowIso,
            };
          }
        });
      }
    }
  });

  return matched;
}

/**
 * Full Sync Process:
 * Scrapes TCB, matches existing crops, updates tcbPricesFallback.json on disk.
 */
export async function syncTcbPricesToStorage(): Promise<TcbSyncResult> {
  try {
    const { reportDate, items } = await scrapeRawTcbItems();
    const matchedCrops = matchTcbWithExistingCrops(items);

    const result: TcbSyncResult = {
      success: true,
      source: 'Trading Corporation of Bangladesh (TCB) & DAM MoA Govt. of Bangladesh',
      sourceUrl: 'http://tcb.gov.bd/pages/daily-rmps',
      reportTitle: 'ঢাকা মহানগরীর নিত্য প্রয়োজনীয় পণ্যের দৈনিক খুচরা বাজার দর',
      reportDate: reportDate || 'Today',
      syncedAt: new Date().toISOString(),
      totalMatchedCrops: Object.keys(matchedCrops).length,
      matchedCrops,
    };

    // Save to persistent fallback file for GitHub Pages and offline use
    const fallbackPath = path.resolve(process.cwd(), 'src/data/tcbPricesFallback.json');
    fs.writeFileSync(fallbackPath, JSON.stringify(result, null, 2), 'utf8');

    return result;
  } catch (err: any) {
    console.warn('[TCB Scraper] Live sync failed, reading local fallback cache:', err.message);
    const cached = getCachedTcbPrices();
    return {
      ...cached,
      success: false,
      error: err.message,
    };
  }
}

/**
 * Read cached fallback data from disk
 */
export function getCachedTcbPrices(): TcbSyncResult {
  try {
    const fallbackPath = path.resolve(process.cwd(), 'src/data/tcbPricesFallback.json');
    if (fs.existsSync(fallbackPath)) {
      const raw = fs.readFileSync(fallbackPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error reading tcbPricesFallback.json', e);
  }

  return {
    success: true,
    source: 'Trading Corporation of Bangladesh (TCB) & DAM MoA Govt. of Bangladesh',
    sourceUrl: 'http://tcb.gov.bd/pages/daily-rmps',
    reportTitle: 'ঢাকা মহানগরীর নিত্য প্রয়োজনীয় পণ্যের দৈনিক খুচরা বাজার দর',
    syncedAt: new Date().toISOString(),
    totalMatchedCrops: 0,
    matchedCrops: {},
  };
}

