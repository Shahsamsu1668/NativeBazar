import React, { useState } from 'react';
import { AIMatchItem, Language, LoginAuditLog } from '../types';
import { AuthStore } from '../data/store';
import {
  ShieldCheck,
  TrendingUp,
  Activity,
  Users,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Database,
  BarChart3,
  Layers,
  Sparkles,
  Lock,
  KeyRound,
  ShieldAlert,
  Clock,
  Laptop,
} from 'lucide-react';

interface AdminDashboardProps {
  matches: AIMatchItem[];
  language: Language;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ matches, language }) => {
  const [auditLogs, setAuditLogs] = useState<LoginAuditLog[]>(() => AuthStore.getAuditLogs());

  // Crop supply vs demand balance index for Bogura pilot
  const equilibriumData = [
    { crop: 'Tomatoes', status: 'Surplus (+14%)', balance: 114, alert: 'High harvest glut in 10 days' },
    { crop: 'Diamond Potatoes', status: 'Balanced (0%)', balance: 100, alert: 'Cold storage buffer stable' },
    { crop: 'Green Chilies', status: 'Deficit (-18%)', balance: 82, alert: 'Procurement demand exceeding local acreage' },
    { crop: 'Cauliflower', status: 'Slight Surplus (+6%)', balance: 106, alert: 'Normal winter production' },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-stone-900 to-emerald-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-stone-800/80 border border-stone-600 px-3 py-1 rounded-full text-xs font-semibold text-stone-200 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'bn' ? 'আমার হাট কেন্দ্রীয় প্রশাসন ও এআই নজরদারি' : 'Amar Haat Central Operations & AI Telemetry'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {language === 'bn' ? 'বগুড়া পাইলট ইকোসিস্টেম কন্ট্রোল সেন্টার' : 'Bogura Pilot Ecosystem Operations'}
            </h1>
            <p className="text-stone-300 text-sm mt-1 max-w-2xl">
              {language === 'bn'
                ? '৪টি ব্যবহারকারী রোল ও সরবরাহ শৃঙ্খলের রিয়েল-টাইম এআই ডেটা সংযোগ এবং বাজার ভারসাম্য বিশ্লেষণ।'
                : 'Real-time telemetry monitoring the 4-role ecosystem: Farmer ↔ Wholesaler ↔ Retailer ↔ Consumer.'}
            </p>
          </div>

          <div className="bg-emerald-900/40 border border-emerald-500/40 rounded-xl p-3 text-right">
            <span className="text-[11px] text-emerald-300 font-semibold uppercase block">Ecosystem Health</span>
            <span className="text-xl font-black text-white">99.4% Uptime</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">Bogura Pilot Node Active</span>
          </div>
        </div>
      </div>

      {/* Network Scale KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase">
            <span>{language === 'bn' ? 'নিবন্ধিত কৃষক' : 'Active Farmers'}</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-stone-900">
            1,420 <span className="text-xs font-normal text-emerald-600 font-semibold">+18% this month</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Shibganj, Sherpur, Sadar, Gabtali</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase">
            <span>{language === 'bn' ? 'পাইকার ও আড়তদার' : 'Wholesalers & Aratdars'}</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700">
            340 <span className="text-xs font-normal text-stone-500">enterprises</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Including Dhaka Karwan Bazar buyers</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase">
            <span>{language === 'bn' ? 'খুচরা বিক্রেতা' : 'Retail Stores'}</span>
            <Database className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700">
            180 <span className="text-xs font-normal text-stone-500">depots</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Certified BCIC & seed franchises</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 text-xs font-semibold uppercase">
            <span>{language === 'bn' ? 'ভোক্তা' : 'Direct Consumers'}</span>
            <Sparkles className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-700">
            4,850 <span className="text-xs font-normal text-stone-500">households</span>
          </div>
          <p className="text-xs text-stone-500 mt-1">Bogura urban & regional buyers</p>
        </div>
      </div>

      {/* Grid: Supply-Demand Equilibrium & Live AI Matches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Supply-Demand Equilibrium Gauge (Unique Report Innovation) */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <span>{language === 'bn' ? 'ফসল সরবরাহ ও চাহিদা ভারসাম্য সূচক' : 'Supply-Demand Equilibrium Index'}</span>
              </h2>
              <p className="text-xs text-stone-500">
                {language === 'bn'
                  ? 'কৃষকের উৎপাদিত ফসলের পরিমাণের সাথে পাইকারদের ক্রয়ের অনুপাত'
                  : 'Predictive equilibrium to prevent market crashes and sudden shortages'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {equilibriumData.map((item) => (
              <div key={item.crop} className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-stone-800 text-sm">{item.crop}</span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                      item.balance > 110
                        ? 'bg-amber-100 text-amber-800'
                        : item.balance < 90
                        ? 'bg-red-100 text-red-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                <div className="w-full bg-stone-100 rounded-full h-2.5 overflow-hidden flex">
                  <div
                    className={`h-2.5 rounded-full ${
                      item.balance > 110 ? 'bg-amber-500' : item.balance < 90 ? 'bg-red-500' : 'bg-emerald-600'
                    }`}
                    style={{ width: `${Math.min(100, item.balance)}%` }}
                  />
                </div>

                <p className="text-[11px] text-stone-500 italic flex items-center gap-1">
                  <Activity className="w-3 h-3 text-stone-400" />
                  {item.alert}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 leading-relaxed">
            <strong>System Intelligence:</strong> When Tomato surplus reaches +14%, Amar Haat automatically opens inter-district export corridors to Dhaka and notifies food processors (e.g. Pran) to absorb volume before price crashes.
          </div>
        </div>

        {/* Right: Live AI Matchmaker Transaction Logs */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-200">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <span>{language === 'bn' ? 'লাইভ এআই ম্যাচিং ট্রানজ্যাকশন লগ' : 'Real-time AI Matchmaker Engine Logs'}</span>
              </h2>
              <p className="text-xs text-stone-500">
                {language === 'bn'
                  ? 'কৃষক ও ব্যবসায়ীদের মধ্যবর্তী সফল অ্যালগরিদমিক সংযোগ'
                  : 'Automated 2-way and 3-way algorithmic matchmaking'}
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              Live Engine
            </span>
          </div>

          <div className="space-y-3">
            {matches.map((m) => (
              <div
                key={m.id}
                className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 hover:bg-white text-xs space-y-2 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-stone-900 text-sm">{m.cropName}</span>
                    <p className="text-[11px] text-stone-500">
                      👨‍🌾 {m.farmerName} ➔ 💼 {m.buyerName}
                    </p>
                  </div>

                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {m.matchScore}% Match Score
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-600 bg-white p-2 rounded-lg border border-stone-200">
                  <div>
                    <span>Agreed Escrow Rate:</span>{' '}
                    <strong className="text-emerald-700">৳{m.buyerBudgetPrice}/kg</strong>
                  </div>
                  <div>
                    <span>Transit Distance:</span> <strong>{m.distanceKm} km</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px]">
                  <span className="text-emerald-700 font-semibold">{m.projectedProfitMargin}</span>
                  <span
                    className={`font-bold ${
                      m.status === 'Locked in Escrow'
                        ? 'text-purple-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    ● {m.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Security Telemetry & Access Audit Log (Demonstrating Multi-Layer Platform Security) */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-200 gap-2">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-700" />
              <span>{language === 'bn' ? 'প্ল্যাটফর্ম নিরাপত্তা টেলিমেট্রি ও লগইন অডিট ট্রেল' : 'Platform Security Telemetry & Access Audit Trail'}</span>
            </h2>
            <p className="text-xs text-stone-500">
              {language === 'bn'
                ? '৬টি ব্যবহারকারী রোলের স্বতন্ত্র সেশন, অ্যাডমিন ২-ফ্যাক্টর অথেনটিকেশন ও ব্রুট-ফোর্স লকআউট পর্যবেক্ষণ।'
                : 'Real-time telemetry tracking distinct encrypted role sessions, 2FA enforcement, and brute-force defenses.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Admin Authorized (NativeBazarSJS)
            </span>
            <span className="text-[11px] font-bold text-stone-700 bg-stone-100 px-2 py-1 rounded-full border border-stone-200">
              SHA-256 Active
            </span>
          </div>
        </div>

        {/* Security KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
            <span className="text-stone-500 text-[11px] block">Admin Session Security</span>
            <span className="font-bold text-stone-900 text-sm mt-0.5 block">Level-4 Root Access</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Strict 60m Idle Timeout</span>
          </div>
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
            <span className="text-stone-500 text-[11px] block">Role Credential Separation</span>
            <span className="font-bold text-emerald-700 text-sm mt-0.5 block">6/6 Unique Keys</span>
            <span className="text-[10px] text-stone-500">Zero Shared Passwords</span>
          </div>
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
            <span className="text-stone-500 text-[11px] block">Brute-Force Shield</span>
            <span className="font-bold text-blue-700 text-sm mt-0.5 block">3-Attempt Lockout</span>
            <span className="text-[10px] text-stone-500">180s Auto-Defense Active</span>
          </div>
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
            <span className="text-stone-500 text-[11px] block">Recorded Audit Entries</span>
            <span className="font-bold text-stone-900 text-sm mt-0.5 block">{auditLogs.length} Events</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Bogura Node Verified</span>
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pt-2">
          {auditLogs.map((log) => {
            const isSuccess = log.status === 'SUCCESS';
            const is2FAFail = log.status === 'FAILED_2FA';
            const isLocked = log.status === 'LOCKED';
            return (
              <div
                key={log.id}
                className="p-3 bg-stone-50/70 hover:bg-stone-50 rounded-xl border border-stone-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isSuccess
                        ? 'bg-emerald-100 text-emerald-800'
                        : is2FAFail
                        ? 'bg-amber-100 text-amber-800'
                        : isLocked
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {isSuccess ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : is2FAFail ? (
                      <KeyRound className="w-4 h-4" />
                    ) : isLocked ? (
                      <ShieldAlert className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{log.role.toUpperCase()}</span>
                      <span className="text-[11px] font-mono text-stone-500">{log.phone}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                          isSuccess
                            ? 'bg-emerald-100 text-emerald-800'
                            : is2FAFail
                            ? 'bg-amber-100 text-amber-800'
                            : isLocked
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-600 mt-0.5">{log.details}</p>
                  </div>
                </div>

                <div className="text-right shrink-0 text-[10px] text-stone-400 font-mono">
                  <div>{log.ip}</div>
                  <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Economic Impact Metrics */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-stone-50 rounded-2xl border border-emerald-200 p-6">
        <h3 className="text-base font-bold text-stone-900 mb-2">
          {language === 'bn' ? 'সামাজিক ও অর্থনৈতিক প্রভাব সূচক (Impact Metrics)' : 'Demonstrated Pilot Economic Impact in Bogura'}
        </h3>
        <p className="text-xs text-stone-600 mb-4">
          Key performance indicators proving the feasibility of Amar Haat over traditional disconnected models:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-2xs">
            <span className="text-xs font-bold text-emerald-800 block">Farmer Net Income Uplift</span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block">+28.4%</span>
            <p className="text-[11px] text-stone-500 mt-1">
              Direct forward pricing without arat middleman cuts and prompt mobile escrow payout.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-teal-200 shadow-2xs">
            <span className="text-xs font-bold text-teal-800 block">Post-Harvest Spoilage Waste</span>
            <span className="text-2xl font-black text-teal-700 mt-1 block">-34.0%</span>
            <p className="text-[11px] text-stone-500 mt-1">
              Crops pre-ordered 7-10 days in advance get picked and dispatched without decaying in arats.
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-2xs">
            <span className="text-xs font-bold text-blue-800 block">Input Procurement Savings</span>
            <span className="text-2xl font-black text-blue-700 mt-1 block">-14.2%</span>
            <p className="text-[11px] text-stone-500 mt-1">
              Direct supplier recommendations allow farmers to buy certified fertilizers at fair govt rates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
