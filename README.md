# 🌾 NativeBazar (নেটিভবাজার)
### AI-Powered Local Agriculture, Business & Supply-Demand Ecosystem for Bangladesh

[![Campus365 Internship](https://img.shields.io/badge/Campus365-Software_Engineer_Internship-059669?style=for-the-badge&logo=shield)](https://campus365.io)
[![React 19](https://img.shields.io/badge/React-19.0.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite 8](https://img.shields.io/badge/Vite-8.3.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4.3.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Google Gemini AI](https://img.shields.io/badge/Google_Gemini-3.1_Flash_Lite-8E75C2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Express](https://img.shields.io/badge/Express-4.21.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)

---

## 📌 Project Overview

**NativeBazar (নেটিভবাজার)** is a full-stack, AI-powered agricultural supply-demand platform designed to solve the deep fragmentation and predatory middleman syndicates (*faria/arat cartels*) in the rural agricultural supply chain of Bangladesh.

Developed as a flagship **Campus365 Software Engineer Internship Assignment**, the platform introduces a **circular, 3-way multi-stakeholder ecosystem** centered on forward market intelligence:

$$\text{Farmer (কৃষক)} \longleftrightarrow \text{Businessman / Arat} \longleftrightarrow \text{Agro Supplier} \longleftrightarrow \text{Retail Customer} \longleftrightarrow \text{Agronomist / SAAO} \longleftrightarrow \text{Central Admin}$$

The pilot implementation is centered in **Bogura (বগুড়া)** — the agricultural capital of North Bengal, covering the high-yield agro-corridors of **Shibganj, Sherpur, Bogura Sadar, Gabtali, and Mahasthangarh**.

---

## 👥 Authors & Internship Credits

| Name | Role | Student / Intern ID | Organization |
| :--- | :--- | :--- | :--- |
| **Md. Shahriar Shakib** | Software Engineer Intern | **2048** | **Campus365** |
| **Jubayer Bishwas Shadhin** | Software Engineer Intern | **2055** | **Campus365** |
| **Sumayya Islam** | Software Engineer Intern | **2080** | **Campus365** |

> **Host Organization:** [Campus365](https://campus365.io)  
> **Course / Track:** 4-1 B.Sc. in Computer Science & Engineering / Software Engineering Internship Defense

---

## 🎯 The Core Problem & Value Proposition

### The Problem in Bangladesh Agriculture
1. **Zero Pre-Harvest Market Visibility:** Smallholder farmers harvest crops blindly without knowing demand, causing distress fire-sales to local *aratdars* at 40–60% below market value.
2. **Predatory Middleman Markup:** Wholesalers pay low farmgate rates, but urban consumers face high retail prices while farmers receive less than 40% of the shelf value.
3. **Counterfeit Inputs & High Prices:** Unverified seed, fertilizer, and pesticide dealers sell substandard inputs at inflated prices without government BCIC price compliance.
4. **Agro-Pathology Loss:** High crop failure due to pest outbreaks (e.g., Late Blight in potatoes) and lack of timely expert advice.

### NativeBazar's Solution
> *"The right product, from the right person, to the right person, at the right time."*

- **Forward Harvest Pre-Sales:** Farmers list ripening crops (e.g., *500 kg Hybrid Tomatoes ripening in 10 days*) so wholesalers can lock forward contracts with escrow guarantees before harvesting.
- **Two-Sided Smart Recommendations:** Simultaneously connects farmers to bulk buyers and links them with certified, nearby fertilizer/seed dealers.
- **Human-in-the-Loop AI Agronomy:** Multimodal Gemini vision diagnoses leaf diseases while local Sub-Assistant Agriculture Officers (SAAO) verify prescriptions to eliminate AI hallucinations.
- **Direct Farm-to-Consumer Basket:** Consumers pre-order produce harvested the morning of delivery, featuring a transparent **Farmer Cut** breakdown (85%+ directly to the grower).

---

## 🌟 Key Platform Features by Role

NativeBazar provides **6 dedicated, role-tailored dashboards** with comprehensive role-based access control (RBAC):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NATIVEBAZAR ECOSYSTEM                           │
├───────────────┬───────────────┬───────────────┬────────────────────────┤
│  👨‍🌾 Farmer   │ 🏢 Business   │ 🏪 Supplier   │ 🛒 Customer/Consumer   │
│ • Forward     │ • Bulk Demand │ • BCIC Inputs │ • Direct Farm Basket   │
│   Pre-Sales   │   Posting     │ • Proximity   │ • Pre-Harvest Orders   │
│ • AI Doctor   │ • AI Matches  │   Radius      │ • Transparent Cut      │
│ • Expense Log │ • Escrow Bid  │ • Stock Toggle│ • bKash/Nagad Checkout │
├───────────────┴───────────────┴───────────────┴────────────────────────┤
│  🔬 Agri Expert / SAAO (BARI) │  🛡️ Central Admin (Bogura Operations) │
│ • AI Tele-Agri Triage Queue   │ • Pilot Telemetry & Health Radar       │
│ • Regional Agro Advisories    │ • Supply-Demand Equilibrium Tracker    │
│ • Pathology Prescription Pass │ • 2FA PIN Protection & Login Audit Log │
└───────────────────────────────┴────────────────────────────────────────┘
```

### 1. 👨‍🌾 Farmer Dashboard (`FarmerDashboard.tsx`)
- **Forward Harvest Pre-Sales Listing:** List upcoming harvests with estimated quantity, ripening date, target price, and real-time market benchmark comparison.
- **Two-Way AI Matching:** Instant algorithmic matching against active wholesale procurement demands in Bogura and Dhaka.
- **AI Crop Doctor Modal (`CropDoctorModal.tsx`):** Multimodal Gemini 3.1 Flash-Lite leaf diagnosis with symptoms, chemical dosage (Mancozeb 75 WP, etc.), and organic remedies (Neem oil, Trichoderma).
- **Nearby Certified Suppliers:** Real-time distance, stock, and official BCIC rate comparison for authorized dealers in Shibganj, Sherpur, etc.
- **Farm Expense & Income Ledger:** Track seasonal production costs (fertilizer, pesticide, labor, irrigation) vs. sale revenues with Net Profit calculation.
- **Bengali Smart Voice Assistant:** Web Speech API voice interaction designed for low-literacy farmers.
- **Micro-Climate Risk Radar:** Weather forecasts with crop-specific alerts (e.g., Late Blight fog alerts for potatoes).

### 2. 🏢 Businessman & Wholesaler Dashboard (`BusinessmanDashboard.tsx`)
- **Procurement Demand Posting:** Publish bulk purchase needs (quantity kg, delivery deadline, target budget).
- **Direct Farmer Sourcing:** Cut out arat middlemen by contracting directly with smallholders.
- **Forward Contract Escrow Offers:** Make formal binding price offers with escrow payment guarantees.
- **Logistics & Smallholder Truck Aggregator:** Group multiple local farmers to fill a single 2-ton or 5-ton truck to Dhaka.
- **DAM Wholesale Rate Tracker:** Benchmark live pricing against the Department of Agricultural Marketing (DAM) rates.

### 3. 🏪 Certified Agro Input Supplier Dashboard (`SupplierDashboard.tsx`)
- **Authorized Inventory Management:** Manage stocks of fertilizers (Urea, DAP, MOP Potash), hybrid seeds (Lal Teer, Metal), and crop protection chemicals.
- **Official Price Compliance:** Displays government-fixed BCIC prices to eliminate overcharging.
- **Proximity-Based Radius:** Serves farmers based on geographic distance in Bogura upazilas.
- **Deferred Credit Integration:** Connects with the tri-partite harvest escrow model to provide inputs on deferred credit settled upon harvest.

### 4. 🛒 Consumer Marketplace (`CustomerMarketplace.tsx`)
- **Farm-to-Table Direct Orders:** Zero-middleman produce shopping.
- **Pre-Harvest Direct Baskets:** Pre-order vegetables 3 days before picking to receive zero-chemical produce picked that morning.
- **Farmer Share Transparency:** Shows exact percentage of the price received by the farmer (e.g., 85–90%).
- **Multi-Method Mobile Checkout:** Integrated with bKash, Nagad, Rocket, and Cash on Delivery.
- **Persistent Cart & Tracking:** Orders persist to localStorage with status transitions (*Confirmed ➔ Dispatched ➔ Delivered*).

### 5. 🔬 Agri Expert & Agronomist Dashboard (`ExpertDashboard.tsx`)
- **Human-in-the-Loop SAAO Tele-Agri Triage:** Review and endorse AI-generated crop prescriptions before farmers apply chemicals.
- **Regional Agro Advisory Broadcasting:** Issue high-priority alerts (Weather warnings, Pest outbreaks, Fertilizer advice) to farmers across specific districts.
- **Field Inspection Logs:** Document regional soil conditions and pathogen outbreaks.

### 6. 🛡️ Central Admin & Operations Dashboard (`AdminDashboard.tsx`)
- **Pilot Telemetry & KPIs:** Real-time metrics for registered farmers, trading volume, escrow value, and active contracts.
- **Supply-Demand Equilibrium Index:** Evaluates whether crops are in Surplus (+14% Tomatoes), Deficit (-18% Green Chilies), or Balanced (Potatoes).
- **Mandatory 2FA Authenticator Security:** Requires security PIN `883650` for access.
- **Comprehensive Login Audit Trail:** Captures timestamp, phone, role, IP, device, and authentication status.

---

## 🧠 AI Capabilities (Google Gemini 3.1 Flash-Lite)

NativeBazar uses `@google/genai` to run server-side AI with low latency, structured JSON schemas, and reliable fallbacks:

| Feature | Backend Endpoint | AI Model | Capabilities & Safeguards |
| :--- | :--- | :--- | :--- |
| **AI Crop Doctor** | `POST /api/ai/diagnose-crop` | `gemini-3.1-flash-lite` | Multi-modal image analysis of plant leaves, symptom categorization, chemical dosage, organic remedies, and SAAO human verification badge. |
| **Supply-Demand Price Forecasting** | `POST /api/ai/predict-demand` | `gemini-3.1-flash-lite` | Evaluates crop volume, harvest timing, district trends, wholesale vs. retail spread, arrival volume at Bogura Mahasthangarh arats, and risk factors. |
| **Bengali Voice Assistant** | `POST /api/ai/voice-assistant` | `gemini-3.1-flash-lite` | Bilingual voice-to-text chat assistant answering crop sales, fertilizer depot stocks, and mandi rates in natural Bengali. |

> [!TIP]
> **Resilience Architecture:** Every AI call is wrapped with a strict 7.5-second timeout and offline client-side heuristic fallbacks. The application continues running smoothly even when offline or without an active Gemini API key.

---

## 🧪 Interactive Project Blueprint Lab & R&D Defense

An interactive defense lab is built directly into the application (`ProjectBlueprintLab.tsx`), providing 5 comprehensive modules for internship presentations:

1. **Executive Concept & SWOT Analysis:** Full Strengths, Weaknesses, Opportunities, and Threats breakdown with engineering mitigations.
2. **Progressive Roadmap (MVP to National Scale):**
   - **Phase 1 (Months 1–3):** Minimum Viable Product in Bogura (*Current Implementation*).
   - **Phase 2 (Months 4–8):** Multi-smallholder batch truck aggregation, offline USSD (`*365#`) & IVR, plastic crate pool.
   - **Phase 3 (Months 9–14):** National agri-credit scoring, parametric weather micro-insurance via bKash, circular input credit.
3. **Full-Stack Architecture & Data Flow:** Detailed structural breakdown of frontend, API gateway, AI layer, and database.
4. **Database Schema & ERD Models:** Relational schema covering `users`, `crop_listings`, `procurement_demands`, `forward_contracts`, `supplier_products`, `orders`, and `audit_logs`.
5. **10 High-Impact Brainstorming Ideas:** Domain-specific concepts (e.g., Tri-Partite Deferred Input Credit, Automated Smallholder Truck Aggregation, Parametric Fog Insurance).

---

## 🏗️ System Architecture

```
+-------------------------------------------------------------------------------------------------+
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
|  * DAM Market Price Scraper & Sync                   * Open-Meteo Weather & Crop Hazard Radar   |
+-------------------------------------------------------------------------------------------------+
             |                                                                         |
             v                                                                         v
+----------------------------------------+               +----------------------------------------+
|      AI & INTELLIGENCE LAYER           |               |           PERSISTENCE LAYER            |
|  * Google Gemini 3.1 Flash-Lite Engine |               |  * Modular LocalStorage Seed Store     |
|    - Multi-modal Leaf Pathology        | <-----------> |  * PostgreSQL + PostGIS (Production)   |
|    - Price Volatility Forecasting      |               |  * Redis Cache (Price & Escrow Locks)  |
|  * 3-Way Matchmaker Engine             |               |  * Audit Log (Login & Escrow Telemetry)|
+----------------------------------------+               +----------------------------------------+
```

---

## 💻 Tech Stack

| Domain | Technology / Library | Version | Description |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **React** | `19.0.1` | Modern UI with hooks, Suspense, and state persistence |
| **Language** | **TypeScript** | `7.0.2` | End-to-end type safety across client and server |
| **Build Tool** | **Vite** | `8.3.0` | Ultra-fast HMR and optimized production bundle |
| **Styling** | **Tailwind CSS** | `4.3.3` | Modern utility CSS with high-contrast accessibility |
| **Icons** | **Lucide React** | `0.546.0` | Rich icon library for all dashboard interactions |
| **Animations** | **Motion** | `12.23.24` | Smooth transitions and micro-animations |
| **Backend Server** | **Express.js** | `4.21.2` | Lightweight REST API gateway and Vite SSR/dev bridge |
| **Server Runtime** | **tsx** | `4.21.0` | High-performance TypeScript execution for Node.js |
| **Generative AI** | **@google/genai** | `2.4.0` | Official Google GenAI SDK for Gemini 3.1 Flash-Lite |
| **Weather Engine** | **Open-Meteo API** | Free / Live | Live weather forecasts and agricultural hazard triggers |
| **Environment Config** | **dotenv** | `17.2.3` | Secure runtime environment variable management |

---

## 🔑 Quick Demo Credentials

All 6 roles come pre-configured with realistic credentials for quick testing:

| Role | Name & Designation | Phone Number | Password | 2FA PIN | District |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Farmer** | Md. Rafiqul Islam | `01712458920` | `Krishi#2026!Rafiq` | — | Bogura (Shibganj) |
| **Businessman** | Haji Nurul Alam (Arat Syndicate) | `01711209934` | `AratTrade$2026@Alam` | — | Bogura / Karwan Bazar |
| **Supplier** | Meghna Fertilizer Depot | `01715889900` | `Fertilizer#9900!Depot` | — | Bogura (Shibganj) |
| **Customer** | Nasrin Akter (Retail Buyer) | `01680123456` | `BazarShop*2026!Nasrin` | — | Bogura Sadar |
| **Expert** | Dr. Akramuzzaman (BARI Officer) | `01711000001` | `BariAgri^2026#Expert` | — | Bogura Regional Station |
| **Admin** | Central Platform Admin | `01700000000` | `SuperAdmin#NB2026!Security` | **`883650`** | Bogura Central Hub |

> [!IMPORTANT]
> The **Central Admin** role requires a mandatory **Two-Factor Authentication (2FA) PIN**: **`883650`**.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- Optional: A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/) for live AI models (fallbacks are included if absent).

---

### Step 1: Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/your-username/nativebazar.git

# Navigate into project directory
cd nativebazar---ai-powered-local-agriculture-&-supply-demand-platform

# Install npm dependencies
npm install
```

---

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and set your configuration:
```env
# Google Gemini API Key (from https://aistudio.google.com)
GEMINI_API_KEY="AIzaSyYourActualKeyHere..."

# Server Port (default: 3000)
PORT=3000

# Base URL (default: http://localhost:3000)
APP_URL="http://localhost:3000"
```

> [!NOTE]
> If `GEMINI_API_KEY` is not provided, NativeBazar automatically activates smart offline heuristic fallback responses for disease diagnosis, price prediction, and voice chat without throwing errors.

---

### Step 3: Run the Development Server
```bash
npm run dev
```

The Express backend and Vite development server will start together:
- **Local Application URL:** [http://localhost:3000](http://localhost:3000)
- **Health Check API:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

### Step 4: Build for Production
To generate an optimized production bundle:
```bash
npm run build
```

To run the production server:
```bash
npm start
```

---

## 📁 Directory Structure

```
├── .env.example                # Environment variables template
├── index.html                  # HTML5 entry point with SEO metadata
├── metadata.json               # AI Studio & app capability manifest
├── package.json                # Project dependencies, scripts, and engine info
├── server.ts                   # Express server, Gemini API endpoints & Vite bridge
├── tsconfig.json               # TypeScript compiler configuration
├── vite.config.ts              # Vite bundler configuration with React & Tailwind plugins
│
└── src/
    ├── main.tsx                # React root hydration entry point
    ├── App.tsx                 # Master state container, RBAC switcher, and view router
    ├── index.css               # Design system tokens and styling
    ├── types.ts                # TypeScript interfaces for entities, roles & views
    │
    ├── components/             # Reusable UI & role dashboards
    │   ├── Header.tsx                  # Top navigation, role switcher, language toggle, cart badge
    │   ├── AuthPage.tsx                # Secure role-based login & 2FA modal
    │   ├── FarmerDashboard.tsx         # Harvest pre-sales, AI match, ledger, micro-weather
    │   ├── BusinessmanDashboard.tsx    # Procurement demands, forward contract escrow, logistics
    │   ├── SupplierDashboard.tsx       # Certified input inventory, BCIC compliance, stock
    │   ├── CustomerMarketplace.tsx     # Direct farm-to-table shopping, checkout, farmer cut
    │   ├── ExpertDashboard.tsx         # SAAO tele-agri triage, advisory broadcast
    │   ├── AdminDashboard.tsx          # Pilot telemetry, equilibrium balance, login audit log
    │   ├── CropDoctorModal.tsx         # Multimodal leaf diagnosis with camera & symptoms
    │   ├── VoiceAssistantModal.tsx     # Bengali voice chat assistant with Web Speech API
    │   ├── MarketRatesView.tsx         # Live DAM daily rates and price spread
    │   ├── WeatherView.tsx             # Open-Meteo live forecasts and crop hazard radar
    │   ├── OrdersView.tsx              # Order lifecycle tracker and customer feedback
    │   └── ProjectBlueprintLab.tsx     # Campus365 Internship Defense Blueprint (5 modules)
    │
    ├── data/                   # State management & persistent storage
    │   ├── mockData.ts         # Initial seed dataset (users, listings, demands, rates)
    │   └── store.ts            # LocalStorage persistence stores with CRUD operations
    │
    └── services/               # External service integration
        ├── aiService.ts        # Client wrappers for Gemini endpoints with fallbacks
        └── weatherService.ts   # Open-Meteo API client and crop-specific alert rules
```

---

## 📡 REST API Reference

### 1. Health Check
- **Endpoint:** `GET /api/health`
- **Description:** Returns service status, pilot district info, and AI engine status.
- **Sample Response:**
```json
{
  "status": "ok",
  "service": "NativeBazar Backend",
  "aiEnabled": true,
  "model": "gemini-3.1-flash-lite",
  "pilotDistrict": "Bogura, Bangladesh",
  "timestamp": "2026-10-12T17:15:00.000Z"
}
```

### 2. AI Crop Doctor Diagnosis
- **Endpoint:** `POST /api/ai/diagnose-crop`
- **Request Body:**
```json
{
  "cropName": "Tomato",
  "symptoms": "Dark concentric rings on lower leaves",
  "imageBase64": "data:image/jpeg;base64,...",
  "language": "bn"
}
```
- **Response:**
```json
{
  "diseaseName": "Early Blight (Alternaria solani)",
  "diseaseBanglaName": "টমেটোর আগাম ধসা রোগ",
  "confidence": 94,
  "severity": "Moderate",
  "symptomsSummary": "Dark concentric brown rings on lower leaves with yellow halo margins.",
  "immediateActions": [
    "আক্রান্ত পাতা সংগ্রহ করে পুড়িয়ে ফেলুন",
    "গাছের গোড়ায় অতিরিক্ত পানি নিষ্কাশন নিশ্চিত করুন"
  ],
  "chemicalTreatment": {
    "medicine": "Mancozeb 75 WP or Ridomil Gold MZ",
    "dose": "প্রতি লিটার পানিতে ২ গ্রাম হারে স্প্রে করুন",
    "schedule": "৭-১০ দিন পর পর ২ বার স্প্রে করুন"
  },
  "organicTreatment": "নিম তেলের দ্রবণ (প্রতি লিটারে ৫ মিলি) অথবা ট্রাইকোডার্মা ব্যবহার করুন।",
  "preventionTips": "পরবর্তী মৌসুমে রোগমুক্ত প্রত্যয়িত বীজ ব্যবহার করুন।",
  "verifiedBySAAO": true
}
```

### 3. Supply-Demand Price Forecasting
- **Endpoint:** `POST /api/ai/predict-demand`
- **Request Body:**
```json
{
  "cropName": "Tomato",
  "quantityKg": 500,
  "targetHarvestDate": "in 10 days",
  "district": "Bogura",
  "language": "bn"
}
```

### 4. Bengali Natural Voice Assistant
- **Endpoint:** `POST /api/ai/voice-assistant`
- **Request Body:**
```json
{
  "query": "বগুড়ায় টমেটোর পাইকারি দর কত?",
  "role": "Farmer",
  "userLocation": "Bogura",
  "language": "bn"
}
```

---

## 🔒 Security & RBAC Implementation

- **Role-Based Access Control (RBAC):** Strict view and operational segregation for 6 distinct personas.
- **Mandatory 2FA for Admin:** Central Admin operations are gated behind a 6-digit security PIN (`883650`).
- **Telemetry Audit Logging:** Every authentication attempt records timestamp, user phone, role, status (`SUCCESS`, `FAILED_PASSWORD`, `FAILED_2FA`, `LOCKED`), client IP, and device user-agent.
- **Rate-Limiting & Timeouts:** Server-side AI calls are bounded by 7.5s timeouts to prevent worker starvation.

---

## 📜 License & Intellectual Property

This project was developed for the **Campus365 Software Engineer Internship Assignment**.  
All rights reserved © 2026 **Campus365** and the Student Author Team (**Md. Shahriar Shakib**, **Jubayer Bishwas Shadhin**, **Sumayya Islam**).
