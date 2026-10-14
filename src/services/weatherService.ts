/**
 * Weather Service — integrates Open-Meteo API (free, no API key required)
 * Provides real weather data for Bangladesh districts and generates
 * crop-specific alerts based on weather conditions.
 */

import { WeatherData, WeatherForecastDay, CropWeatherAlert } from '../types';

// District coordinates (Bangladesh)
const DISTRICT_COORDS: Record<string, { lat: number; lon: number }> = {
  Bogura:      { lat: 24.846, lon: 89.372 },
  Rajshahi:    { lat: 24.375, lon: 88.603 },
  Rangpur:     { lat: 25.747, lon: 89.275 },
  Dhaka:       { lat: 23.810, lon: 90.412 },
  Jashore:     { lat: 23.166, lon: 89.208 },
  Mymensingh:  { lat: 24.747, lon: 90.407 },
  Chittagong:  { lat: 22.356, lon: 91.783 },
  Sylhet:      { lat: 24.894, lon: 91.868 },
  Barisal:     { lat: 22.701, lon: 90.353 },
  Khulna:      { lat: 22.845, lon: 89.540 },
  Dinajpur:    { lat: 25.627, lon: 88.633 },
  Comilla:     { lat: 23.468, lon: 91.178 },
  Joypurhat:   { lat: 25.099, lon: 89.022 },
  Gabtali:     { lat: 24.789, lon: 89.225 },
  Shibganj:    { lat: 24.858, lon: 89.353 },
};

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
  // Return cached data if fresh
  if (weatherCache && weatherCache.district === district && Date.now() - weatherCache.fetchedAt < CACHE_TTL) {
    return weatherCache.data;
  }

  const coords = DISTRICT_COORDS[district] || DISTRICT_COORDS.Bogura;

  try {
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

    weatherCache = { district, data, fetchedAt: Date.now() };
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
