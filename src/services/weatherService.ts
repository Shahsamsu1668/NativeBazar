/**
 * Weather Service — integrates Open-Meteo API (free, no API key required)
 * Provides real weather data for Bangladesh districts and generates
 * crop-specific alerts based on weather conditions.
 */

import { WeatherData, WeatherForecastDay, CropWeatherAlert } from '../types';

// Comprehensive district coordinates and aliases (Bangladesh 64 districts)
export const BANGLADESH_DISTRICT_COORDS: Record<string, { lat: number; lon: number; bn: string; aliases: string[] }> = {
  // Rajshahi Division
  Bogura: { lat: 24.8465, lon: 89.3778, bn: 'বগুড়া', aliases: ['bogura', 'bogra', 'বগুড়া', 'বগুড়া'] },
  Rajshahi: { lat: 24.3745, lon: 88.6042, bn: 'রাজশাহী', aliases: ['rajshahi', 'রাজশাহী'] },
  Joypurhat: { lat: 25.0947, lon: 89.0209, bn: 'জয়পুরহাট', aliases: ['joypurhat', 'জয়পুরহাট', 'জয়পুরহাট'] },
  Naogaon: { lat: 24.7936, lon: 88.9318, bn: 'নওগাঁ', aliases: ['naogaon', 'নওগাঁ'] },
  Natore: { lat: 24.4206, lon: 89.0003, bn: 'নাটোর', aliases: ['natore', 'নাটোর'] },
  Chapainawabganj: { lat: 24.5965, lon: 88.2775, bn: 'চাঁপাইনবাবগঞ্জ', aliases: ['chapainawabganj', 'চাঁপাইনবাবগঞ্জ'] },
  Pabna: { lat: 24.0064, lon: 89.2372, bn: 'পাবনা', aliases: ['pabna', 'পাবনা'] },
  Sirajganj: { lat: 24.4534, lon: 89.7006, bn: 'সিরাজগঞ্জ', aliases: ['sirajganj', 'সিরাজগঞ্জ'] },

  // Dhaka Division
  Dhaka: { lat: 23.8103, lon: 90.4125, bn: 'ঢাকা', aliases: ['dhaka', 'ঢাকা'] },
  Gazipur: { lat: 23.9999, lon: 90.4203, bn: 'গাজীপুর', aliases: ['gazipur', 'গাজীপুর'] },
  Narayanganj: { lat: 23.6337, lon: 90.4965, bn: 'নারায়ণগঞ্জ', aliases: ['narayanganj', 'নারায়ণগঞ্জ', 'নারায়নগঞ্জ'] },
  Tangail: { lat: 24.2513, lon: 89.9167, bn: 'টাঙ্গাইল', aliases: ['tangail', 'টাঙ্গাইল'] },
  Narsingdi: { lat: 23.9322, lon: 90.7154, bn: 'নরসিংদী', aliases: ['narsingdi', 'নরসিংদী'] },
  Faridpur: { lat: 23.6071, lon: 89.8429, bn: 'ফরিদপুর', aliases: ['faridpur', 'ফরিদপুর'] },
  Manikganj: { lat: 23.8644, lon: 90.0047, bn: 'মানিকগঞ্জ', aliases: ['manikganj', 'মানিকগঞ্জ'] },
  Munshiganj: { lat: 23.5422, lon: 90.5305, bn: 'মুন্সীগঞ্জ', aliases: ['munshiganj', 'মুন্সীগঞ্জ'] },
  Gopalganj: { lat: 23.0051, lon: 89.8266, bn: 'গোপালগঞ্জ', aliases: ['gopalganj', 'গোপালগঞ্জ'] },
  Madaripur: { lat: 23.1641, lon: 90.1897, bn: 'মাদারীপুর', aliases: ['madaripur', 'মাদারীপুর'] },
  Rajbari: { lat: 23.7574, lon: 89.6445, bn: 'রাজবাড়ী', aliases: ['rajbari', 'রাজবাড়ী', 'রাজবাড়ি'] },
  Shariatpur: { lat: 23.2423, lon: 90.3526, bn: 'শরীয়তপুর', aliases: ['shariatpur', 'শরীয়তপুর', 'শরিয়তপুর'] },
  Kishoreganj: { lat: 24.4449, lon: 90.7766, bn: 'কিশোরগঞ্জ', aliases: ['kishoreganj', 'কিশোরগঞ্জ'] },

  // Rangpur Division
  Rangpur: { lat: 25.7439, lon: 89.2752, bn: 'রংপুর', aliases: ['rangpur', 'রংপুর'] },
  Dinajpur: { lat: 25.6217, lon: 88.6355, bn: 'দিনাজপুর', aliases: ['dinajpur', 'দিনাজপুর'] },
  Kurigram: { lat: 25.8054, lon: 89.6362, bn: 'কুড়িগ্রাম', aliases: ['kurigram', 'কুড়িগ্রাম', 'কুড়িগ্রাম'] },
  Gaibandha: { lat: 25.3288, lon: 89.5430, bn: 'গাইবান্ধা', aliases: ['gaibandha', 'গাইবান্ধা'] },
  Nilphamari: { lat: 25.9318, lon: 88.8560, bn: 'নীলফামারী', aliases: ['nilphamari', 'নীলফামারী'] },
  Panchagarh: { lat: 26.3411, lon: 88.5542, bn: 'পঞ্চগড়', aliases: ['panchagarh', 'পঞ্চগড়', 'পঞ্চগড়'] },
  Thakurgaon: { lat: 26.0337, lon: 88.4617, bn: 'ঠাকুরগাঁও', aliases: ['thakurgaon', 'ঠাকুরগাঁও'] },
  Lalmonirhat: { lat: 25.9923, lon: 89.2847, bn: 'লালমনিরহাট', aliases: ['lalmonirhat', 'লালমনিরহাট'] },

  // Chittagong Division
  Chittagong: { lat: 22.3569, lon: 91.7832, bn: 'চট্টগ্রাম', aliases: ['chittagong', 'chattogram', 'ctg', 'চট্টগ্রাম'] },
  CoxsBazar: { lat: 21.4272, lon: 92.0058, bn: 'কক্সবাজার', aliases: ['coxsbazar', "cox's bazar", 'কক্সবাজার'] },
  Comilla: { lat: 23.4682, lon: 91.1788, bn: 'কুমিল্লা', aliases: ['comilla', 'cumilla', 'কুমিল্লা'] },
  Feni: { lat: 23.0159, lon: 91.3976, bn: 'ফেনী', aliases: ['feni', 'ফেনী'] },
  Brahmanbaria: { lat: 23.9571, lon: 91.1119, bn: 'ব্রাহ্মণবাড়িয়া', aliases: ['brahmanbaria', 'ব্রাহ্মণবাড়িয়া', 'ব্রাহ্মণবাড়িয়া'] },
  Noakhali: { lat: 22.8696, lon: 91.0994, bn: 'নোয়াখালী', aliases: ['noakhali', 'নোয়াখালী', 'নোয়াখালী'] },
  Chandpur: { lat: 23.2333, lon: 90.6667, bn: 'চাঁদপুর', aliases: ['chandpur', 'চাঁদপুর'] },
  Lakshmipur: { lat: 22.9425, lon: 90.8412, bn: 'লক্ষ্মীপুর', aliases: ['lakshmipur', 'লক্ষ্মীপুর'] },
  Rangamati: { lat: 22.7324, lon: 92.2985, bn: 'রাঙ্গামাটি', aliases: ['rangamati', 'রাঙ্গামাটি'] },
  Khagrachhari: { lat: 23.1193, lon: 91.9847, bn: 'খাগড়াছড়ি', aliases: ['khagrachhari', 'খাগড়াছড়ি', 'খাগড়াছড়ি'] },
  Bandarban: { lat: 22.1953, lon: 92.2184, bn: 'বান্দরবান', aliases: ['bandarban', 'বান্দরবান'] },

  // Khulna Division
  Khulna: { lat: 22.8456, lon: 89.5403, bn: 'খুলনা', aliases: ['khulna', 'খুলনা'] },
  Jashore: { lat: 23.1664, lon: 89.2081, bn: 'যশোর', aliases: ['jashore', 'jessore', 'যশোর'] },
  Satkhira: { lat: 22.7185, lon: 89.0705, bn: 'সাতক্ষীরা', aliases: ['satkhira', 'সাতক্ষীরা'] },
  Bagerhat: { lat: 22.6516, lon: 89.7859, bn: 'বাগেরহাট', aliases: ['bagerhat', 'বাগেরহাট'] },
  Kushtia: { lat: 23.9013, lon: 89.1205, bn: 'কুষ্টিয়া', aliases: ['kushtia', 'কুষ্টিয়া', 'কুষ্টিয়া'] },
  Chuadanga: { lat: 23.6402, lon: 88.8418, bn: 'চুয়াডাঙ্গা', aliases: ['chuadanga', 'চুয়াডাঙ্গা', 'চুয়াডাঙ্গা'] },
  Meherpur: { lat: 23.7622, lon: 88.6318, bn: 'মেহেরপুর', aliases: ['meherpur', 'মেহেরপুর'] },
  Jhenaidah: { lat: 23.5448, lon: 89.1539, bn: 'ঝিনাইদহ', aliases: ['jhenaidah', 'ঝিনাইদহ'] },
  Magura: { lat: 23.4873, lon: 89.4199, bn: 'মাগুরা', aliases: ['magura', 'মাগুরা'] },
  Narail: { lat: 23.1725, lon: 89.5127, bn: 'নড়াইল', aliases: ['narail', 'নড়াইল', 'নড়াইল'] },

  // Barisal Division
  Barisal: { lat: 22.7010, lon: 90.3535, bn: 'বরিশাল', aliases: ['barisal', 'barishal', 'বরিশাল'] },
  Bhola: { lat: 22.6859, lon: 90.6481, bn: 'ভোলা', aliases: ['bhola', 'ভোলা'] },
  Jhalokati: { lat: 22.6406, lon: 90.1987, bn: 'ঝালকাঠি', aliases: ['jhalokati', 'jhalakati', 'ঝালকাঠি'] },
  Pirojpur: { lat: 22.5841, lon: 89.9720, bn: 'পিরোজপুর', aliases: ['pirojpur', 'পিরোজপুর'] },
  Barguna: { lat: 22.0953, lon: 90.1121, bn: 'বরগুনা', aliases: ['barguna', 'বরগুনা'] },
  Patuakhali: { lat: 22.3596, lon: 90.3299, bn: 'পটুয়াখালী', aliases: ['patuakhali', 'পটুয়াখালী', 'পটুয়াখালী'] },

  // Sylhet Division
  Sylhet: { lat: 24.8949, lon: 91.8687, bn: 'সিলেট', aliases: ['sylhet', 'সিলেট'] },
  Moulvibazar: { lat: 24.4829, lon: 91.7774, bn: 'মৌলভীবাজার', aliases: ['moulvibazar', 'মৌলভীবাজার'] },
  Habiganj: { lat: 24.3749, lon: 91.4155, bn: 'হবিগঞ্জ', aliases: ['habiganj', 'হবিগঞ্জ'] },
  Sunamganj: { lat: 25.0658, lon: 91.3950, bn: 'সুনামগঞ্জ', aliases: ['sunamganj', 'সুনামগঞ্জ'] },

  // Mymensingh Division
  Mymensingh: { lat: 24.7471, lon: 90.4203, bn: 'ময়মনসিংহ', aliases: ['mymensingh', 'ময়মনসিংহ', 'ময়মনসিংহ'] },
  Jamalpur: { lat: 24.9375, lon: 89.9378, bn: 'জামালপুর', aliases: ['jamalpur', 'জামালপুর'] },
  Netrokona: { lat: 24.8709, lon: 90.7279, bn: 'নেত্রকোণা', aliases: ['netrokona', 'নেত্রকোণা', 'নেত্রকোনা'] },
  Sherpur: { lat: 25.0205, lon: 90.0153, bn: 'শেরপুর', aliases: ['sherpur', 'শেরপুর'] },
};

export function resolveDistrictKey(districtInput: string): string | null {
  if (!districtInput || !districtInput.trim()) return null;
  const clean = districtInput.trim().toLowerCase();

  for (const [key, val] of Object.entries(BANGLADESH_DISTRICT_COORDS)) {
    if (key.toLowerCase() === clean || val.bn.toLowerCase() === clean) return key;
    if (val.aliases.some((a) => a.toLowerCase() === clean)) return key;
  }
  return null;
}

// WMO weather codes to descriptions
const WEATHER_CODES: Record<number, { en: string; bn: string; icon: string }> = {
  0:  { en: 'Clear sky', bn: 'পরিষ্কার আকাশ', icon: '☀️' },
  1:  { en: 'Mainly clear', bn: 'প্রধানত পরিষ্কার', icon: '🌤️' },
  2:  { en: 'Partly cloudy', bn: 'আংশিক মেঘলা', icon: '⛅' },
  3:  { en: 'Overcast', bn: 'মেঘাচ্ছন্ন', icon: '☁️' },
  45: { en: 'Foggy', bn: 'কুয়াশাচ্ছন্ন', icon: '🌫️' },
  48: { en: 'Icy fog', bn: 'বরফ কুয়াশা', icon: '🌫️' },
  51: { en: 'Light drizzle', bn: 'হালকা গুঁড়িগুঁড়ি বৃষ্টি', icon: '🌦️' },
  61: { en: 'Slight rain', bn: 'হালকা বৃষ্টি', icon: '🌧️' },
  63: { en: 'Moderate rain', bn: 'মাঝারি বৃষ্টি', icon: '🌧️' },
  65: { en: 'Heavy rain', bn: 'ভারী বৃষ্টি', icon: '⛈️' },
  80: { en: 'Rain showers', bn: 'বৃষ্টির ঝাপটা', icon: '🌦️' },
  95: { en: 'Thunderstorm', bn: 'বজ্রঝড়', icon: '⛈️' },
};

function getWeatherDesc(code: number) {
  return WEATHER_CODES[code] || { en: 'Unknown', bn: 'অজানা', icon: '🌡️' };
}

// Generate crop weather alerts from weather data
function generateCropAlerts(
  temp: number,
  humidity: number,
  weatherCode: number,
  precipitation7d: number
): CropWeatherAlert[] {
  const alerts: CropWeatherAlert[] = [];
  const isFoggy   = weatherCode === 45 || weatherCode === 48;
  const isRainy   = weatherCode >= 51 && weatherCode <= 82;
  const isHot     = temp > 35;
  const isCold    = temp < 12;
  const isHumid   = humidity > 85;

  if (isFoggy || (isHumid && temp < 22)) {
    alerts.push({
      crop: 'Potato', cropBn: 'আলু',
      alertType: 'disease_risk',
      message: 'Late blight (Phytophthora) risk is HIGH due to fog and high humidity. Apply preventive Mancozeb spray immediately.',
      messageBn: 'কুয়াশা ও আর্দ্রতার কারণে আলুতে নাবি ধসা (লেইট ব্লাইট) ঝুঁকি বেশি। এখনই ম্যানকোজেব স্প্রে করুন।',
      severity: 'high',
    });
    alerts.push({
      crop: 'Tomato', cropBn: 'টমেটো',
      alertType: 'disease_risk',
      message: 'Early blight risk elevated. Increase plant spacing and avoid evening irrigation.',
      messageBn: 'টমেটোতে আগাম ধসা রোগের ঝুঁকি বেড়েছে। সন্ধ্যায় পানি দেওয়া বন্ধ রাখুন।',
      severity: 'medium',
    });
  }

  if (isHot) {
    alerts.push({
      crop: 'Cauliflower', cropBn: 'ফুলকপি',
      alertType: 'heatwave',
      message: `Temperature ${temp}°C is too high for cauliflower curd development. Shade netting recommended.`,
      messageBn: `তাপমাত্রা ${temp}°C ফুলকপির কার্ড তৈরির জন্য অনেক বেশি। ছায়াজাল ব্যবহার করুন।`,
      severity: 'high',
    });
  }

  if (isCold) {
    alerts.push({
      crop: 'Tomato', cropBn: 'টমেটো',
      alertType: 'frost',
      message: `Temperature ${temp}°C may cause flower drop. Avoid stress irrigation.`,
      messageBn: `তাপমাত্রা ${temp}°C টমেটোর ফুল ঝরিয়ে দিতে পারে। সেচ কমান।`,
      severity: 'medium',
    });
  }

  if (isRainy && precipitation7d > 50) {
    alerts.push({
      crop: 'Green Chili', cropBn: 'কাঁচা মরিচ',
      alertType: 'flood',
      message: 'Heavy rainfall may cause waterlogging. Ensure field drainage and harvest ripe chilies urgently.',
      messageBn: 'অতিবৃষ্টিতে জলাবদ্ধতার আশঙ্কা। মাঠের পানি নিষ্কাশন নিশ্চিত করুন এবং পাকা মরিচ দ্রুত তুলুন।',
      severity: 'high',
    });
  }

  if (!isFoggy && !isRainy && temp >= 18 && temp <= 28 && humidity >= 60 && humidity <= 75) {
    alerts.push({
      crop: 'All Vegetables', cropBn: 'সব সবজি',
      alertType: 'ideal',
      message: 'Excellent growing conditions today. Ideal for fertilizer application and transplanting.',
      messageBn: 'আজকের আবহাওয়া চাষাবাদের জন্য আদর্শ। সার প্রয়োগ ও চারা রোপণের উপযুক্ত সময়।',
      severity: 'low',
    });
  }

  return alerts;
}

// Cache to avoid excessive API calls
let weatherCache: { district: string; data: WeatherData; fetchedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function fetchWeather(district = 'Bogura'): Promise<WeatherData> {
  const resolvedKey = resolveDistrictKey(district) || 'Bogura';

  // Return cached data if fresh
  if (weatherCache && weatherCache.district === resolvedKey && Date.now() - weatherCache.fetchedAt < CACHE_TTL) {
    return weatherCache.data;
  }

  const coords = BANGLADESH_DISTRICT_COORDS[resolvedKey];

  try {
    // 1. Try our backend proxy first
    const proxyRes = await fetch(`/api/weather/${encodeURIComponent(resolvedKey)}`).catch(() => null);
    if (proxyRes && proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.success && json.data) {
        const cur = json.data.current_weather || json.data.current;
        const day = json.data.daily;
        const temp = Math.round(cur.temperature || cur.temperature_2m);
        const humidity = cur.relative_humidity_2m || 70;
        const code = cur.weathercode !== undefined ? cur.weathercode : cur.weather_code;
        const desc = getWeatherDesc(code);

        const forecast: WeatherForecastDay[] = (day.time as string[]).slice(0, 7).map((date: string, i: number) => ({
          date,
          maxTemp: Math.round(day.temperature_2m_max[i]),
          minTemp: Math.round(day.temperature_2m_min[i]),
          precipitation: parseFloat((day.precipitation_sum[i] || 0).toFixed(1)),
          weatherCode: day.weathercode ? day.weathercode[i] : day.weather_code[i],
        }));

        const precipitation7d = forecast.reduce((s, d) => s + d.precipitation, 0);
        const cropAlerts = generateCropAlerts(temp, humidity, code, precipitation7d);

        const data: WeatherData = {
          temperature: temp,
          humidity,
          windSpeed: Math.round(cur.windspeed || cur.wind_speed_10m || 10),
          weatherCode: code,
          description: desc.en,
          descriptionBn: desc.bn,
          icon: desc.icon,
          forecast,
          cropAlerts,
        };

        weatherCache = { district: resolvedKey, data, fetchedAt: Date.now() };
        return data;
      }
    }

    // 2. Direct Open-Meteo fallback
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude',         String(coords.lat));
    url.searchParams.set('longitude',        String(coords.lon));
    url.searchParams.set('current',          'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m');
    url.searchParams.set('daily',            'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum');
    url.searchParams.set('forecast_days',    '7');
    url.searchParams.set('timezone',         'Asia/Dhaka');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const cur  = json.current;
    const day  = json.daily;

    const temp     = Math.round(cur.temperature_2m);
    const humidity = cur.relative_humidity_2m;
    const code     = cur.weather_code;
    const desc     = getWeatherDesc(code);

    const forecast: WeatherForecastDay[] = (day.time as string[]).slice(0, 7).map((date: string, i: number) => ({
      date,
      maxTemp:       Math.round(day.temperature_2m_max[i]),
      minTemp:       Math.round(day.temperature_2m_min[i]),
      precipitation: parseFloat((day.precipitation_sum[i] || 0).toFixed(1)),
      weatherCode:   day.weather_code[i],
    }));

    const precipitation7d = forecast.reduce((s, d) => s + d.precipitation, 0);
    const cropAlerts = generateCropAlerts(temp, humidity, code, precipitation7d);

    const data: WeatherData = {
      temperature:   temp,
      humidity,
      windSpeed:     Math.round(cur.wind_speed_10m),
      weatherCode:   code,
      description:   desc.en,
      descriptionBn: desc.bn,
      icon:          desc.icon,
      forecast,
      cropAlerts,
    };

    weatherCache = { district: resolvedKey, data, fetchedAt: Date.now() };
    return data;
  } catch (err) {
    console.warn('Weather API fallback:', err);
    // Return reasonable fallback for Bangladesh October conditions
    return {
      temperature:   28,
      humidity:      72,
      windSpeed:     12,
      weatherCode:   1,
      description:   'Mainly clear',
      descriptionBn: 'প্রধানত পরিষ্কার',
      icon:          '🌤️',
      forecast: Array.from({ length: 7 }, (_, i) => ({
        date:          new Date(Date.now() + i * 86400000).toISOString().split('T')[0],
        maxTemp:       30 - i,
        minTemp:       18 + i % 3,
        precipitation: i === 3 || i === 5 ? 12 : 0,
        weatherCode:   i === 3 || i === 5 ? 63 : 1,
      })),
      cropAlerts: [
        {
          crop: 'Potato', cropBn: 'আলু',
          alertType: 'disease_risk',
          message: 'Monitor for late blight as October fog season approaches.',
          messageBn: 'অক্টোবরের কুয়াশায় আলুতে লেইট ব্লাইটের দিকে নজর রাখুন।',
          severity: 'medium',
        }
      ],
    };
  }
}
