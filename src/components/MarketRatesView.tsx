import React from 'react';
import { MarketRate, Language } from '../types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Building,
  Store,
  MapPin,
  Clock,
  ArrowUpRight,
} from 'lucide-react';

interface MarketRatesViewProps {
  rates: MarketRate[];
  language: Language;
}

export const MarketRatesView: React.FC<MarketRatesViewProps> = ({ rates, language }) => {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-stone-800 to-emerald-950 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-amber-800/60 border border-amber-400/30 px-3 py-1 rounded-full text-xs font-semibold text-amber-200 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-amber-300" />
              <span>{language === 'bn' ? 'কৃষি বিপণন অধিদপ্তর (DAM) দৈনিক বাজার দর' : 'DAM Daily Agricultural Market Radar'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {language === 'bn' ? 'বগুড়া ও ঢাকা পাইকারি আড়ত দর সূচক' : 'Bogura & Dhaka Wholesale Price Index'}
            </h1>
            <p className="text-amber-100/90 text-sm mt-1 max-w-2xl">
              {language === 'bn'
                ? 'বগুড়ার মহাস্থানগড় ও ফতেহ আলী পাইকারি বাজার বনাম ঢাকার কারওয়ান বাজারের রিয়েল-টাইম দর তুলনা।'
                : 'Real-time price intelligence comparing Bogura Mahasthangarh/Raja Bazar Arat with Dhaka Karwan Bazar terminal wholesale.'}
            </p>
          </div>

          <div className="text-right text-xs text-amber-200">
            <span className="block font-bold">Updated: Today 06:00 AM</span>
            <span className="text-[11px] text-amber-300/80">Source: DAM & Arat Syndicate API</span>
          </div>
        </div>
      </div>

      {/* Rates Table Card */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            <span>{language === 'bn' ? 'প্রধান কৃষিপণ্যের বাজার দর' : 'Commodity Wholesale & Retail Benchmark'}</span>
          </h2>
          <span className="text-xs text-stone-500">Currency: Bangladeshi Taka (৳ BDT)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Commodity / Crop</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Bogura Arat (Wholesale)</th>
                <th className="py-3 px-4">Dhaka Terminal (Wholesale)</th>
                <th className="py-3 px-4">Bogura Local Retail</th>
                <th className="py-3 px-4 text-right">24h Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rates.map((rate) => (
                <tr key={rate.id} className="hover:bg-stone-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-stone-900 text-sm">
                    {language === 'bn' ? rate.banglaName : rate.cropName}
                    <span className="block text-[11px] font-normal text-stone-500">
                      per {rate.unit}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-stone-600">{rate.category}</td>
                  <td className="py-3.5 px-4 font-extrabold text-stone-900 text-sm">
                    ৳{rate.wholesaleBogura}
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-blue-700 text-sm">
                    ৳{rate.wholesaleDhaka}
                  </td>
                  <td className="py-3.5 px-4 font-extrabold text-stone-800 text-sm">
                    ৳{rate.retailBogura}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <span
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-bold text-[11px] ${
                        rate.trend === 'up'
                          ? 'bg-emerald-100 text-emerald-800'
                          : rate.trend === 'down'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {rate.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                      {rate.trend === 'down' && <TrendingDown className="w-3 h-3" />}
                      {rate.trend === 'stable' && <Minus className="w-3 h-3" />}
                      {rate.change24h > 0 ? `+${rate.change24h}%` : `${rate.change24h}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
