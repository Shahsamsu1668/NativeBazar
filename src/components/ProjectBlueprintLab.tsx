import React, { useState } from 'react';
import { Language } from '../types';
import {
  FileText,
  Lightbulb,
  Cpu,
  Database,
  Layers,
  ShieldCheck,
  CheckCircle2,
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  GitBranch,
  PhoneCall,
  DollarSign,
  TrendingUp,
  Package,
  Award,
} from 'lucide-react';

interface ProjectBlueprintLabProps {
  language: Language;
  onSelectRole: (role: any) => void;
}

export const ProjectBlueprintLab: React.FC<ProjectBlueprintLabProps> = ({
  language,
  onSelectRole,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'architecture' | 'erd' | 'brainstorming'>('overview');

  return (
    <div className="space-y-6">
      {/* Official Internship Header Card */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-emerald-500/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Award className="w-4 h-4 text-emerald-400" />
              <span>Campus365 Software Engineer Internship Assignment</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              NativeBazar (নেটিভবাজার) Project Blueprint & R&D Defense
            </h1>
            <p className="text-emerald-100/90 text-sm mt-1 max-w-2xl">
              An AI-Powered Local Agriculture, Business, and Supply-Demand Platform for Bangladesh.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3.5 border border-white/15 text-xs space-y-1">
            <span className="text-emerald-300 font-bold block text-[11px] uppercase tracking-wider">
              Project Authors (Intern Team)
            </span>
            <p className="font-semibold text-white">Md. Shahriar Shakib • ID: 2048</p>
            <p className="font-semibold text-white">Jubayer Bishwas Shadhin • ID: 2055</p>
            <p className="font-semibold text-white">Sumayya Islam • ID: 2080</p>
            <span className="text-[10px] text-emerald-200/80 block pt-1 border-t border-white/10">
              Host Organization: <strong>Campus365</strong>
            </span>
          </div>
        </div>

        {/* Blueprint Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-white/15 text-xs font-semibold">
          {[
            { id: 'overview', label: 'Executive Concept & SWOT', icon: <Compass className="w-4 h-4" /> },
            { id: 'features', label: 'Recommended Feature Matrix (MVP vs Scale)', icon: <Layers className="w-4 h-4" /> },
            { id: 'architecture', label: 'System Architecture & Tech Stack', icon: <Cpu className="w-4 h-4" /> },
            { id: 'erd', label: 'Database Schema & ERD Design', icon: <Database className="w-4 h-4" /> },
            { id: 'brainstorming', label: '10 Innovative Brainstorming Ideas', icon: <Lightbulb className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-stone-950 font-bold shadow-md'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: EXECUTIVE CONCEPT & SWOT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* The Problem & Solution */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-3">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-600" />
                <span>1. Problem Statement: Disconnected Agro-Ecosystem</span>
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                In Bangladesh, farmers, businesses, suppliers, and customers operate in deep isolation. Farmers lack market visibility before harvest day, leading to distress sales to predatory middlemen (arats). Wholesalers struggle to secure reliable bulk produce, while farmers face inflated prices or fake seeds/fertilizers from unverified sources.
              </p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950">
                <strong>Core Thesis:</strong> "Existing platforms solve isolated problems (disease detection alone, or simple marketplaces). NativeBazar unifies the entire value chain into a shared intelligence layer: <strong>Farmer ➔ Supplier ➔ Businessman ➔ Customer</strong>."
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-3">
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <span>2. The Core Value Proposition</span>
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                <em>"The right product, from the right person, to the right person, at the right time."</em>
              </p>
              <ul className="space-y-2 text-xs text-stone-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>AI Forward Harvest Matching:</strong> Listing 500kg tomatoes 10 days before harvest lets buyers lock contracts before picking.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Two-Sided Recommendation:</strong> Recommends buyers to farmers AND certified fertilizer/seed suppliers to farmers based on distance, price, and crop lifecycle.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Pilot Feasibility:</strong> Launched first in Bogura (the agricultural hub of Bangladesh) with scalable expansion to Rajshahi and Rangpur.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* SWOT Analysis Matrix */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-4">
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <span>3. SWOT Analysis & Engineering Mitigations</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
                <span className="font-extrabold text-emerald-900 text-sm block">Strengths (অভ্যন্তরীণ শক্তি)</span>
                <ul className="space-y-1 text-emerald-950 list-disc pl-4">
                  <li>Unifies 6 roles with customized tailored dashboards.</li>
                  <li>AI supply-demand matching eliminates predatory arat cartels.</li>
                  <li>Bilingual Bangla-friendly interface with voice assistance.</li>
                  <li>Predictive forward intelligence rather than reactive listing.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-2">
                <span className="font-extrabold text-amber-900 text-sm block">Weaknesses & Mitigations</span>
                <ul className="space-y-1 text-amber-950 list-disc pl-4">
                  <li><strong>Risk:</strong> Farmers with low digital literacy. <strong>Mitigation:</strong> Bangla voice recognition & simulated USSD (*365#).</li>
                  <li><strong>Risk:</strong> AI crop pathology errors. <strong>Mitigation:</strong> Human-in-the-loop SAAO Agronomist verification queue!</li>
                  <li><strong>Risk:</strong> Cold start network effect. <strong>Mitigation:</strong> Pilot focused on Bogura Mahasthangarh/Shibganj belt first.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 space-y-2">
                <span className="font-extrabold text-blue-900 text-sm block">Opportunities (সুযোগ)</span>
                <ul className="space-y-1 text-blue-950 list-disc pl-4">
                  <li>Explosive adoption of bKash & Nagad mobile banking in rural Bangladesh.</li>
                  <li>Partnerships with DAE (Department of Agricultural Extension) & BCIC fertilizer dealers.</li>
                  <li>Agri-credit scoring and micro-financing based on transparent harvest records.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 space-y-2">
                <span className="font-extrabold text-red-900 text-sm block">Threats & Defense</span>
                <ul className="space-y-1 text-red-950 list-disc pl-4">
                  <li>Middleman syndicates resisting digital disintermediation.</li>
                  <li>Sudden extreme climate events (flash floods, severe cold waves).</li>
                  <li>Mitigation: Forward contract escrow guarantees and weather insurance triggers.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RECOMMENDED FEATURE MATRIX */}
      {activeTab === 'features' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Recommended Feature Roadmap (MVP to National Scale)</span>
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              For your Campus365 internship defense, structured implementation in 3 distinct progressive phases:
            </p>
          </div>

          <div className="space-y-4">
            {/* Phase 1 MVP */}
            <div className="border border-emerald-200 rounded-xl p-5 bg-emerald-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="bg-emerald-700 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Phase 1: Minimum Viable Product (Bogura Pilot) — Current Implementation
                </span>
                <span className="text-xs font-semibold text-emerald-800">Timeline: Month 1–3</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                  <strong>1. Role Auth & Dashboards:</strong> Dedicated screens for Farmer, Businessman, Supplier, Consumer, Expert, Admin.
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                  <strong>2. Forward Harvest Pre-Sales:</strong> List ripening crops (e.g., 500kg tomatoes in 10 days) with target prices.
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                  <strong>3. 2-Way AI Match Engine:</strong> Algorithmic matching between farmer harvests and business procurement demands.
                </div>
                <div className="bg-white p-3 rounded-lg border border-emerald-100 shadow-2xs">
                  <strong>4. AI Crop Doctor with SAAO:</strong> Multi-modal Gemini diagnosis with local agronomist verification triage.
                </div>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="border border-blue-200 rounded-xl p-5 bg-blue-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="bg-blue-700 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Phase 2: Regional Scaling & Logistics Integration (North Bengal Belt)
                </span>
                <span className="text-xs font-semibold text-blue-800">Timeline: Month 4–8</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-2xs">
                  <strong>1. Smallholder Aggregation:</strong> Combines 5 small farmers' 400kg batches to fill a single 2-ton truck to Dhaka.
                </div>
                <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-2xs">
                  <strong>2. USSD & IVR Fallback:</strong> Dial *365# for feature phones to report harvest volumes without smartphones.
                </div>
                <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-2xs">
                  <strong>3. Shared Cold Storage:</strong> Book excess space in Bogura cold storages during harvest gluts.
                </div>
                <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-2xs">
                  <strong>4. Plastic Crate Pool:</strong> Reusable plastic crates replace rough bamboo tokris to reduce transit bruising.
                </div>
              </div>
            </div>

            {/* Phase 3 */}
            <div className="border border-purple-200 rounded-xl p-5 bg-purple-50/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="bg-purple-700 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Phase 3: National Platform, Agri-Fintech & Parametric Insurance
                </span>
                <span className="text-xs font-semibold text-purple-800">Timeline: Month 9–14</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-2xs">
                  <strong>1. Agri-Credit Scoring:</strong> Verified track record of harvest fulfillment unlocks low-interest micro-loans from banks.
                </div>
                <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-2xs">
                  <strong>2. Parametric Insurance:</strong> Automated bKash compensation if satellite data detects severe fog/flood.
                </div>
                <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-2xs">
                  <strong>3. Circular Input Credit:</strong> Fertilizer supplier provides inputs today; cost is deducted from harvest sale escrow.
                </div>
                <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-2xs">
                  <strong>4. National Wholesale Export:</strong> Supply pipelines connecting Bogura, Jashore, and Rangpur directly to supermarket chains.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM ARCHITECTURE & TECH STACK */}
      {activeTab === 'architecture' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <span>Full-Stack Technical Architecture</span>
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Recommended production architecture for Campus365 implementation:
            </p>
          </div>

          {/* Architecture Flow Diagram */}
          <div className="bg-stone-900 text-stone-100 p-5 rounded-2xl font-mono text-xs overflow-x-auto space-y-4">
            <div className="text-emerald-400 font-bold text-center border-b border-stone-800 pb-2">
              [ NativeBazar 3-Way Circular Ecosystem Data Flow ]
            </div>
            <pre className="text-[11px] leading-relaxed text-stone-300">
{`+-------------------------------------------------------------------------------------------------+
|                                 CLIENT APPLICATIONS LAYER                                      |
|  +--------------------+   +--------------------+   +--------------------+   +-----------------+ |
|  |   Farmer PWA App   |   | Trader/Arat Portal |   | Supplier Inventory |   | Consumer Basket | |
|  | (Bangla Voice+SMS) |   | (Bulk Aggregator)  |   | (Input Orders)     |   | (Farm-to-Table) | |
|  +---------+----------+   +---------+----------+   +---------+----------+   +--------+--------+ |
+------------|------------------------|------------------------|-----------------------|----------+
             |                        |                        |                       |
             v                        v                        v                       v
+-------------------------------------------------------------------------------------------------+
|                       API GATEWAY & BUSINESS ENGINE (Node.js / Express / tsx)                   |
|  * Role Auth & RBAC (JWT / Phone OTP)                * Forward Contract Escrow Simulator        |
|  * DAM Market Price Scraper & Sync                   * Push Notification / SMS Gateway (bKash)  |
+-------------------------------------------------------------------------------------------------+
             |                                                                         |
             v                                                                         v
+----------------------------------------+               +----------------------------------------+
|      AI & INTELLIGENCE LAYER           |               |           PERSISTENCE LAYER            |
|  * Google Gemini 3.8 Flash Engine      |               |  * PostgreSQL + PostGIS (Geo-distance) |
|    - Multi-modal Leaf Pathology        | <-----------> |  * Redis Cache (Market Rates & Locks)  |
|    - Price Volatility Forecasting      |               |  * Cloud Storage (Crop Leaf Photos)    |
|  * 3-Way Matchmaker Engine             |               |  * Audit Log (Escrow Transactions)     |
|    - Linear Batch Aggregator           |               |                                        |
+----------------------------------------+               +----------------------------------------+`}
            </pre>
          </div>

          {/* Recommended Tech Stack Table */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
              <span className="font-bold text-stone-900 text-sm block">Frontend & Mobile Interface</span>
              <p className="text-stone-600"><strong>Framework:</strong> React 19 / Vite + PWA (Progressive Web App) with offline Service Worker support for rural network drops.</p>
              <p className="text-stone-600"><strong>Styling:</strong> Tailwind CSS 4 with high-contrast accessibility badges.</p>
              <p className="text-stone-600"><strong>Voice & Audio:</strong> Web Speech API + Bengali Natural Speech Synthesis for zero-typing accessibility.</p>
            </div>

            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
              <span className="font-bold text-stone-900 text-sm block">Backend & AI Infrastructure</span>
              <p className="text-stone-600"><strong>Server Engine:</strong> Express / Node.js with TypeScript (`server.ts`).</p>
              <p className="text-stone-600"><strong>AI Integration:</strong> `@google/genai` TypeScript SDK using `gemini-3.8-flash` for low-latency reasoning and structured JSON output.</p>
              <p className="text-stone-600"><strong>Database:</strong> PostgreSQL with PostGIS extension for spatial distance calculations between farmers and dealers.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE SCHEMA & ERD DESIGN */}
      {activeTab === 'erd' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-amber-600" />
              <span>Entity Relationship Diagram (ERD) & Schema Models</span>
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Core database entities required to power the NativeBazar platform:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 font-mono space-y-2">
              <span className="font-bold text-stone-900 text-sm font-sans flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600" />
                Table: users
              </span>
              <ul className="text-stone-700 text-[11px] space-y-1">
                <li>• id: UUID PRIMARY KEY</li>
                <li>• phone_number: VARCHAR(20) UNIQUE</li>
                <li>• role: ENUM ('farmer','trader','supplier','consumer','expert','admin')</li>
                <li>• full_name: VARCHAR(100)</li>
                <li>• district: VARCHAR(50) (e.g. 'Bogura')</li>
                <li>• upazila: VARCHAR(50) (e.g. 'Shibganj')</li>
                <li>• location_coords: GEOMETRY(POINT, 4326)</li>
                <li>• rating_score: DECIMAL(2,1) DEFAULT 5.0</li>
                <li>• verified_status: BOOLEAN DEFAULT FALSE</li>
              </ul>
            </div>

            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 font-mono space-y-2">
              <span className="font-bold text-stone-900 text-sm font-sans flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" />
                Table: crop_listings (Upcoming Harvests)
              </span>
              <ul className="text-stone-700 text-[11px] space-y-1">
                <li>• id: UUID PRIMARY KEY</li>
                <li>• farmer_id: UUID REFERENCES users(id)</li>
                <li>• crop_name: VARCHAR(100)</li>
                <li>• variety: VARCHAR(100)</li>
                <li>• quantity_kg: INTEGER</li>
                <li>• estimated_harvest_date: DATE</li>
                <li>• target_price_bdt_per_kg: DECIMAL(8,2)</li>
                <li>• stage: ENUM ('field_growing','ripening','harvested','contracted')</li>
                <li>• created_at: TIMESTAMP</li>
              </ul>
            </div>

            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 font-mono space-y-2">
              <span className="font-bold text-stone-900 text-sm font-sans flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
                Table: procurement_demands (Trader Orders)
              </span>
              <ul className="text-stone-700 text-[11px] space-y-1">
                <li>• id: UUID PRIMARY KEY</li>
                <li>• buyer_id: UUID REFERENCES users(id)</li>
                <li>• crop_needed: VARCHAR(100)</li>
                <li>• required_quantity_kg: INTEGER</li>
                <li>• max_budget_bdt_per_kg: DECIMAL(8,2)</li>
                <li>• required_by_date: DATE</li>
                <li>• fulfillment_status: ENUM ('open','partially_matched','fulfilled')</li>
              </ul>
            </div>

            <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/60 font-mono space-y-2">
              <span className="font-bold text-stone-900 text-sm font-sans flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                Table: forward_contracts & escrow
              </span>
              <ul className="text-stone-700 text-[11px] space-y-1">
                <li>• id: UUID PRIMARY KEY</li>
                <li>• listing_id: UUID REFERENCES crop_listings(id)</li>
                <li>• demand_id: UUID REFERENCES procurement_demands(id)</li>
                <li>• agreed_price_per_kg: DECIMAL(8,2)</li>
                <li>• total_value_bdt: DECIMAL(12,2)</li>
                <li>• escrow_advance_bdt: DECIMAL(12,2) (held in escrow)</li>
                <li>• delivery_status: ENUM ('locked','dispatched','received','payout_cleared')</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: 10 INNOVATIVE BRAINSTORMING IDEAS */}
      {activeTab === 'brainstorming' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs space-y-6">
          <div>
            <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <span>10 High-Impact Brainstorming Ideas to Present at Campus365</span>
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Use these concrete talking points during your intern idea defense to demonstrate deep domain problem-solving:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {[
              {
                num: '1',
                title: 'The "Tri-Partite Deferred Input Credit" Model',
                desc: 'Farmers often lack cash for fertilizer mid-season. Because a verified Wholesaler has already locked a Forward Contract on NativeBazar, the Fertilizer Supplier provides inputs on credit, guaranteed to be settled from the escrow payout when the harvest arrives!',
              },
              {
                num: '2',
                title: 'Automated Multi-Smallholder Truck Aggregation',
                desc: 'A single smallholder with 400kg cannot afford a mini-truck to Dhaka. NativeBazar AI groups 5 farmers within a 6km radius into a single combined 2-ton lorry shipment, dividing transport overhead by 70%.',
              },
              {
                num: '3',
                title: 'Offline USSD (*365#) & Interactive Voice Response (IVR)',
                desc: 'Overcomes the digital literacy barrier for elderly Bangladeshi farmers. Farmers dial *365# or receive an automated phone call in regional Bogura dialect asking: "Press 1 if you have tomatoes ready this week."',
              },
              {
                num: '4',
                title: 'Standardized Plastic Crate Return Logistics',
                desc: 'Traditional transport in bamboo baskets (ঝুড়ি / টোকা) causes 25-35% physical bruising and rot. NativeBazar runs a deposit-based plastic crate pool collected at destination wholesale arats.',
              },
              {
                num: '5',
                title: 'Human-in-the-Loop SAAO Tele-Agri Triage',
                desc: 'Solves the SWOT danger of hallucinated AI crop prescriptions. Local government Sub-Assistant Agriculture Officers (SAAO) earn a micro-incentive to verify AI-flagged diagnoses before spraying.',
              },
              {
                num: '6',
                title: 'Predictive Glut & Spoilage Early Warning Radar',
                desc: 'When AI detects a 20% tomato harvest surplus across Bogura in 10 days, it automatically notifies food processing companies (e.g., Pran, Square) to purchase processing batches before local market prices crash.',
              },
              {
                num: '7',
                title: 'Farm-to-Consumer "Pre-Harvest" Direct Baskets',
                desc: 'Urban consumers pre-order fresh produce 3 days before picking. They receive produce picked the very morning of delivery with zero cold-chain chemical preservatives.',
              },
              {
                num: '8',
                title: 'Agri-Credit Scoring for Rural Bank Lending',
                desc: 'Banks in Bangladesh struggle to assess smallholder creditworthiness. NativeBazar provides verified export transaction records and escrow history to qualify farmers for collateral-free agri-loans.',
              },
              {
                num: '9',
                title: 'Parametric Climate Micro-Insurance',
                desc: 'Integration with meteorological radar. If Bogura experiences 4 consecutive days of heavy fog during the potato blight window, an automated insurance micro-payout is sent via bKash to purchase fungicides.',
              },
              {
                num: '10',
                title: 'Monetization via Circular Micro-Commissions',
                desc: 'Completely free for farmers and consumers. Revenue generated via a 1.2% B2B matching commission from wholesalers and sponsored shelf placement for certified input dealers.',
              },
            ].map((idea) => (
              <div key={idea.num} className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-1.5 hover:bg-white hover:border-amber-300 transition-all">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 font-black flex items-center justify-center text-[10px] shrink-0">
                    {idea.num}
                  </span>
                  <h4 className="font-bold text-stone-900 text-xs">{idea.title}</h4>
                </div>
                <p className="text-stone-600 leading-relaxed text-[11px] pl-7">
                  {idea.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
