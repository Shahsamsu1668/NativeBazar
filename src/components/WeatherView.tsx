import React, { useState, useEffect } from 'react';
import { Language, WeatherData } from '../types';
import { fetchWeather } from '../services/weatherService';
import {
  Cloud, Wind, Droplets, Thermometer, AlertTriangle, CheckCircle2,
  Sprout, RefreshCw, MapPin, Sun, CloudRain,
} from 'lucide-react';

interface WeatherViewProps {
  district: string;
  language: Language;
}

function WeatherCode({ code }: { code: number }) {
  const icons: Record<number, string> = {
    0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
    51:'🌦️',61:'🌧️',63:'🌧️',65:'⛈️',80:'🌦️',95:'⛈️',
  };
  const closest = Object.keys(icons).reduce((prev, curr) =>
    Math.abs(Number(curr) - code) < Math.abs(Number(prev) - code) ? curr : prev
  );
  return <span>{icons[Number(closest)] || '🌡️'}</span>;
}

const SEVERITY_COLOR: Record<string, string> = {
  high:   'bg-red-50 border-red-200 text-red-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-800',
  low:    'bg-emerald-50 border-emerald-200 text-emerald-800',
};

const ALERT_ICONS: Record<string, React.ReactNode> = {
  disease_risk: <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />,
  frost:        <Thermometer className="w-4 h-4 text-blue-500 flex-shrink-0" />,
  flood:        <CloudRain className="w-4 h-4 text-blue-600 flex-shrink-0" />,
  heatwave:     <Sun className="w-4 h-4 text-orange-500 flex-shrink-0" />,
  ideal:        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
  fog:          <Cloud className="w-4 h-4 text-stone-500 flex-shrink-0" />,
  drought:      <Droplets className="w-4 h-4 text-amber-500 flex-shrink-0" />,
};

const DAY_NAMES_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const WeatherView: React.FC<WeatherViewProps> = ({ district, language }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = (en: string, bn: string) => language === 'bn' ? bn : en;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchWeather(district);
      setWeather(data);
    } catch {
      setError(t('Failed to load weather data', 'আবহাওয়ার তথ্য লোড করতে ব্যর্থ'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [district]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 skeleton rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 skeleton rounded-xl" />)}
        </div>
        <div className="h-40 skeleton rounded-2xl" />
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="card p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h3 className="font-bold text-stone-800 mb-1">{t('Weather Unavailable', 'আবহাওয়া পাওয়া যাচ্ছে না')}</h3>
        <p className="text-stone-500 text-sm mb-4">{error}</p>
        <button onClick={load} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors">
          {t('Retry', 'আবার চেষ্টা করুন')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Weather Card */}
      <div className="hero-banner text-white">
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-6xl leading-none">{weather.icon}</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-emerald-300" />
                  <span className="text-emerald-200 text-sm font-semibold">{district}, Bangladesh</span>
                </div>
                <div className="text-6xl font-black leading-none">{weather.temperature}°C</div>
                <p className="text-emerald-100 mt-1 font-medium">
                  {language === 'bn' ? weather.descriptionBn : weather.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-6 text-center">
              <div>
                <Droplets className="w-5 h-5 text-blue-300 mx-auto mb-1" />
                <p className="text-2xl font-bold">{weather.humidity}%</p>
                <p className="text-emerald-300 text-xs">{t('Humidity', 'আর্দ্রতা')}</p>
              </div>
              <div>
                <Wind className="w-5 h-5 text-cyan-300 mx-auto mb-1" />
                <p className="text-2xl font-bold">{weather.windSpeed}</p>
                <p className="text-emerald-300 text-xs">{t('km/h Wind', 'বায়ু km/h')}</p>
              </div>
              <button
                onClick={load}
                className="flex flex-col items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
              >
                <RefreshCw className="w-5 h-5 text-emerald-300" />
                <p className="text-emerald-300 text-xs">{t('Refresh', 'রিফ্রেশ')}</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7-Day Forecast */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
          <Cloud className="w-5 h-5 text-blue-500" />
          {t('7-Day Forecast', '৭ দিনের পূর্বাভাস')}
        </h2>
        <div className="grid grid-cols-7 gap-2">
          {weather.forecast.map((day, i) => {
            const date = new Date(day.date);
            const dow  = date.getDay();
            const isToday = i === 0;
            return (
              <div
                key={day.date}
                className={`flex flex-col items-center p-2 rounded-xl text-center ${
                  isToday ? 'bg-emerald-600 text-white' : 'bg-stone-50 hover:bg-stone-100'
                } transition-colors`}
              >
                <p className={`text-[10px] font-bold ${isToday ? 'text-emerald-200' : 'text-stone-500'}`}>
                  {isToday ? t('Today', 'আজ') : (language === 'bn' ? DAY_NAMES_BN[dow] : DAY_NAMES_EN[dow])}
                </p>
                <span className="text-lg my-1"><WeatherCode code={day.weatherCode} /></span>
                <p className={`text-xs font-bold ${isToday ? 'text-white' : 'text-stone-800'}`}>{day.maxTemp}°</p>
                <p className={`text-[10px] ${isToday ? 'text-emerald-200' : 'text-stone-400'}`}>{day.minTemp}°</p>
                {day.precipitation > 0 && (
                  <p className={`text-[9px] mt-0.5 font-semibold ${isToday ? 'text-blue-200' : 'text-blue-500'}`}>
                    {day.precipitation}mm
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Crop Alerts */}
      {weather.cropAlerts.length > 0 && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
            <Sprout className="w-5 h-5 text-emerald-600" />
            {t('AI Crop Weather Alerts', 'এআই ফসল আবহাওয়া সতর্কতা')}
            <span className="text-[11px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
              {weather.cropAlerts.length} {t('active', 'সক্রিয়')}
            </span>
          </h2>
          <div className="space-y-3">
            {weather.cropAlerts.map((alert, i) => (
              <div
                key={i}
                className={`flex gap-3 p-3.5 rounded-xl border ${SEVERITY_COLOR[alert.severity]} animate-slide-up`}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {ALERT_ICONS[alert.alertType] || <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-sm">{language === 'bn' ? alert.cropBn : alert.crop}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      alert.severity === 'high' ? 'bg-red-200 text-red-900' :
                      alert.severity === 'medium' ? 'bg-amber-200 text-amber-900' :
                      'bg-emerald-200 text-emerald-900'
                    }`}>{alert.severity}</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    {language === 'bn' ? alert.messageBn : alert.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-stone-400 mt-3 flex items-center gap-1">
            <Cloud className="w-3 h-3" />
            {t(
              'Powered by Open-Meteo API (real-time weather). Alerts are AI-generated based on actual conditions.',
              'ওপেন-মেটিও এপিআই থেকে আসল আবহাওয়া ডেটা। সতর্কতাগুলো এআই দ্বারা তৈরি।'
            )}
          </p>
        </div>
      )}

      {/* Farming Tips based on weather */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-stone-900 mb-4 flex items-center gap-2">
          <Sprout className="w-5 h-5 text-emerald-600" />
          {t('Today\'s Farming Tips', 'আজকের কৃষি পরামর্শ')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              condition: weather.humidity > 80,
              icon: '💧',
              en: 'High humidity: Reduce irrigation frequency. Check for fungal diseases.',
              bn: 'আর্দ্রতা বেশি: সেচের পরিমাণ কমান। ছত্রাকজনিত রোগ পরীক্ষা করুন।',
            },
            {
              condition: weather.temperature > 30,
              icon: '🌡️',
              en: 'High temp: Water your crops early morning (6-8 AM) to reduce evaporation.',
              bn: 'তাপমাত্রা বেশি: সকালে (৬-৮টা) সেচ দিন, বাষ্পীভবন কম হবে।',
            },
            {
              condition: weather.windSpeed > 20,
              icon: '💨',
              en: 'Strong winds: Avoid spraying pesticides. Wait for calm conditions.',
              bn: 'তেজ বাতাস: কীটনাশক স্প্রে এড়িয়ে চলুন। বাতাস কমলে স্প্রে করুন।',
            },
            {
              condition: weather.weatherCode < 3,
              icon: '✅',
              en: 'Clear day: Ideal for harvesting, field preparation and transplanting seedlings.',
              bn: 'পরিষ্কার দিন: ফসল কাটা, জমি প্রস্তুত ও চারা লাগানোর জন্য আদর্শ।',
            },
          ].filter(tip => tip.condition).slice(0, 4).map((tip, i) => (
            <div key={i} className="flex gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
              <span className="text-2xl flex-shrink-0">{tip.icon}</span>
              <p className="text-xs text-stone-700 leading-relaxed">
                {language === 'bn' ? tip.bn : tip.en}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
