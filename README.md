# 🌾 NativeBazar (নেটিভবাজার)
### AI-Powered Local Agriculture, Business & Supply-Demand Ecosystem for Bangladesh

[![React 19](https://img.shields.io/badge/React-19.0.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite 8](https://img.shields.io/badge/Vite-8.3.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4.3.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Google Gemini AI](https://img.shields.io/badge/Google_Gemini-2.5_Flash-8E75C2?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev)
[![Express](https://img.shields.io/badge/Express-4.21.2-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Deployed-181717?style=for-the-badge&logo=github&logoColor=white)](https://shahsamsu1668.github.io/NativeBazar/)

---

## 📌 Project Overview

**NativeBazar (নেটিভবাজার)** is a full-stack, AI-powered agricultural supply-demand ecosystem designed to solve deep market fragmentation, lack of pre-harvest transparency, and predatory middleman syndicates (*faria/arat cartels*) in the rural agricultural supply chain of Bangladesh.

The platform establishes a **circular, 6-way multi-stakeholder ecosystem** centered on forward market intelligence, verified agro-input quality, and human-in-the-loop scientific guidance:

$$\text{Farmer} \longleftrightarrow \text{Businessman / Arat} \longleftrightarrow \text{Agro Supplier} \longleftrightarrow \text{Retail Customer} \longleftrightarrow \text{Agronomist / Expert} \longleftrightarrow \text{Central Admin}$$

The pilot implementation is centered in **Bogura (বগুড়া)** — the agricultural capital of North Bengal, covering the high-yield agro-corridors of **Shibganj, Sherpur, Bogura Sadar, Gabtali, and Mahasthangarh**, with live price synchronization extending to **Dhaka, Rajshahi, Rangpur, and Jashore**.

> 🌐 **Live Demo:** [https://shahsamsu1668.github.io/NativeBazar/](https://shahsamsu1668.github.io/NativeBazar/)

---

## 👥 Authors & Team Credits

| Name | Role | Student ID | Academic Track |
| :--- | :--- | :--- | :--- |
| **Md. Shahriar Shakib** | Software Engineer | **2048** | 4-1 B.Sc. in Computer Science & Engineering |
| **Jubayer Bishwas Shadhin** | Software Engineer | **2055** | 4-1 B.Sc. in Computer Science & Engineering |
| **Sumayya Islam** | Software Engineer | **2080** | 4-1 B.Sc. in Computer Science & Engineering |

---

## 🎯 The Core Problem & NativeBazar's Solution

### The Structural Problem in Bangladesh Agriculture
1. **Zero Pre-Harvest Market Visibility:** Smallholder farmers harvest crops blindly without knowing market demand or price direction, forcing distress fire-sales to local *aratdars* at 40–60% below fair market value.
2. **Predatory Middleman Markup:** Wholesalers pay low farmgate rates, but urban consumers face exorbitant retail prices while farmers receive less than 40% of the shelf value.
3. **Counterfeit Inputs & Excessive Costs:** Unverified seed, fertilizer, and pesticide dealers sell substandard inputs at inflated rates without government BCIC price compliance.
4. **Agro-Pathology Crop Loss:** Severe yield losses occur due to pest outbreaks (e.g., Late Blight in potatoes, leaf miners in tomatoes) and lack of timely expert extension advice.
5. **Disconnected Communication:** Farmers lack direct, verifiable communication channels with certified agronomists and regional extension officers.

### NativeBazar's Architectural Solutions
> *"The right product, from the right grower, to the right buyer, at the right time."*

- **Forward Harvest Pre-Sales:** Farmers list ripening crops days before picking so wholesalers can secure forward contracts backed by escrow guarantees.
- **Multi-Criteria AI Matching Engine:** Pairs available crop listings with procurement demands using bilingual semantic matching, price competitiveness, batch quantity fulfillment, and regional logistics proximity.
- **Find Crops Interactive Portal:** Wholesalers search and filter available harvests by crop name, Bengali title, variety, upazila, and farmer name to initiate negotiations or B2B trade orders.
- **Human-in-the-Loop AI Agronomy:** Multimodal Gemini vision diagnoses leaf diseases, while local Sub-Assistant Agriculture Officers (SAAO) and BARI researchers verify prescriptions to eliminate hallucinations.
- **Expert–Farmer Communication Center:** Direct messaging and triage portal allowing verified experts to receive, review, and reply to farmer inquiries with real-time notifications.
- **Regional Agricultural Bulletins:** Dedicated farmer-accessible bulletin board publishing regional advisories, fog/pest warnings, soil recommendations, and official extension notices.
- **Direct Farm-to-Consumer Marketplace:** Consumers pre-order produce with a transparent **Farmer Cut** breakdown (85%+ directly to the grower).

---

## 🏗️ System Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                     CLIENT APPLICATIONS LAYER                                     |
|  +--------------------+   +--------------------+   +--------------------+   +-------------------+ |
|  |   Farmer Hub       |   | Wholesale Buyer    |   | Agro Supplier      |   | Fresh Marketplace | |
|  | (Pre-Sales & Voice)|   | (AI Match & Escrow)|   | (BCIC Inputs)      |   | (Farm-to-Table)   | |
|  +---------+----------+   +---------+----------+   +---------+----------+   +---------+---------+ |
|            |                        |                        |                        |           |
|  +---------+----------+             |              +---------+----------+             |           |
|  | Agronomist Portal  |             +--------------+ Central Admin Hub  +-------------+           |
|  | (Triage & Advising)|                            | (Telemetry & 2FA)  |                         |
|  +---------+----------+                            +---------+----------+                         |
+------------|-------------------------------------------------|------------------------------------+
             |                                                 |
             v                                                 v
+---------------------------------------------------------------------------------------------------+
|                      API GATEWAY & SERVICE RUNTIME (Node.js / Express / tsx)                      |
|  * Role-Based Access Control (RBAC & Multi-Role Links)      * Forward Contract Escrow Engine      |
|  * DAM Live Daily Market Price Scraper & Sync               * Open-Meteo Weather & Hazard Radar   |
|  * Bi-directional Direct Messaging & Notification Bus       * Two-Way Trade Order Lifecycle       |
|  * REST Auth API (Register, Login, Session Management)      * JSON-File Persistent Database       |
+---------------------------------------------------------------------------------------------------+
             |                                                 |
             v                                                 v
+------------------------------------------+     +--------------------------------------------------+
|        AI & INTELLIGENCE LAYER           |     |                 PERSISTENCE LAYER                |
|  * Google Gemini 2.5 Flash (Primary)     |     |  * JSON-File Database (server_data/db.json)      |
|    - Multimodal Plant Leaf Pathology     |     |  * 18 Domain-Specific Reactive Client Stores     |
|    - Forward Price & Volatility Forecast | <-> |  * Security Audit & Session Telemetry Logs       |
|    - Natural Bengali Voice Assistant     |     |  * Cross-Role Linkage & Password Credential Hash |
|  * gemini-3.1-flash-lite (Fallback)      |     |  * Offline Heuristic Fallback State              |
|  * Multi-Criteria AI Matching Engine     |     |  * LocalStorage Seed Store (Client CRUD)         |
+------------------------------------------+     +--------------------------------------------------+
```

---

## 🌟 Comprehensive Features by Role (6 Personas)

### 1. 👨‍🌾 Farmer Hub (`FarmerDashboard.tsx`)
- **Forward Harvest Pre-Sales Listing:** List upcoming harvests with estimated quantity (kg), target readiness date, expected price, and benchmark comparison against local mandi rates.
- **AI Crop Doctor Modal (`CropDoctorModal.tsx`):** Multimodal Gemini 2.5 Flash diagnosis for leaf symptoms, chemical prescriptions (e.g., Mancozeb 75 WP, Ridomil Gold), organic treatments (Neem oil, Trichoderma), and expert consultation.
- **Regional Agricultural Bulletins (`BulletinsPage.tsx`):** Official advisories from BARI and DAE officers, categorized by weather hazards, pest outbreaks, and soil nutrition.
- **Farm Expense & Revenue Ledger:** Track production expenditures (seeds, fertilizer, labor, irrigation) against crop sales revenue with automatic net profit/loss calculation.
- **Nearby Certified Input Dealers:** Proximity-sorted list of authorized suppliers displaying government-fixed BCIC rates.
- **Bengali Smart Voice Assistant (`VoiceAssistantModal.tsx`):** Hands-free voice navigation using the Web Speech API and Gemini audio triage.
- **Micro-Climate Hazard Radar (`WeatherView.tsx`):** Live temperature, rainfall, humidity, and agro-hazard warnings (e.g., fog triggering potato Late Blight alerts).

### 2. 🏢 Wholesale Buyer & Businessman Hub (`BusinessmanDashboard.tsx`)
- **Bulk Procurement Demands:** Publish bulk purchase needs (crop type, volume in kg, target price, delivery deadline, and urgency badge).
- **AI Match Engine:** Algorithmic matching between farm listings and procurement demands incorporating crop type, price spread, volume, and distance.
- **Find Crops Interactive Search:** Search all active harvests by English name, Bengali name, variety, farmer name, or upazila with live status indicators.
- **Forward Contract Escrow Locking:** Secure contracts with token advance payments held in simulated escrow.
- **Direct Farmer Negotiations:** Send binding negotiation counter-offers (`Make Offer`) directly to farmers.
- **B2B Trade Orders:** Create wholesale trade orders tracked in the central `OrdersView.tsx`.

### 3. 🏪 Certified Agro Input Supplier Hub (`SupplierDashboard.tsx`)
- **Authorized Inventory Management:** Manage stocks of fertilizers (Urea, DAP, MOP Potash), hybrid seeds (Lal Teer, Metal), pesticides, organic vermicompost, and sprayers.
- **Official BCIC Price Compliance:** Displays mandated government prices to combat illegal black-market markups.
- **Stock Availability Toggles:** Live one-click stock status toggles for instant visibility to farmers.
- **B2B Input Supply Order Fulfillment:** Review and confirm input orders placed by farmers with delivery tracking.
- **Agro Catalog View:** Browse and manage the complete product catalog powered by `catalogData.ts`.

### 4. 🛒 Fresh Consumer Marketplace (`CustomerMarketplace.tsx`)
- **Zero-Middleman Produce Shopping:** Purchase farm-fresh vegetables and fruits directly from smallholder growers.
- **Pre-Harvest Direct Baskets:** Pre-order vegetables days before harvesting for peak freshness.
- **Farmer Share Transparency:** Transparent cost breakdown showing the exact percentage (85–90%) of shelf price paid directly to the farmer.
- **Persistent Cart & Mobile Checkout:** Multi-item basket with bKash, Nagad, Rocket, and Cash on Delivery support.

### 5. 🔬 Agronomy Expert & Extension Hub (`ExpertDashboard.tsx`)
- **Tele-Agri Triage Queue:** Review incoming farmer AI diagnoses, examine symptoms, and issue verified prescriptions.
- **Farmer Inquiries & Triage (Direct Messaging):** Full communication portal to receive farmer queries and reply with professional advice.
- **Regional Advisory Broadcasting:** Compose and broadcast urgent bulletins (Weather Alert, Pest Outbreak, Soil Advice) to specific agro-zones.
- **Verified Expert Credential Flow (`ExpertRegistrationModal.tsx`):** Specialized registration requiring degree certificate and National ID (NID) document uploads.

### 6. 🛡️ Central Platform Admin Hub (`AdminDashboard.tsx`)
- **Platform Telemetry & Health Radar:** Monitor real-time counts of registered farmers, traders, listings, open demands, and escrow transaction volume.
- **Supply-Demand Equilibrium Index:** Real-time equilibrium monitoring indicating Surplus, Deficit, or Balanced states per crop.
- **Mandatory Level-4 2FA PIN Security:** Protected by a secondary 6-digit TOTP security code (`883650`).
- **Immutable Login & Security Audit Trail:** Logs timestamp, phone/email, role, status (`SUCCESS`, `FAILED_PASSWORD`, `FAILED_2FA`, `LOCKED`), client IP, and device user-agent.
- **User Verification Management:** Approve or reject newly registered expert accounts with credential review.

---

## 💬 Expert–Farmer Communication & Messaging System

NativeBazar includes a complete bi-directional messaging and notification architecture:

1. **Farmer Initiates Inquiry:** Farmers discover verified agronomists through the **Contacts & Network** directory (`ContactsView.tsx`) or from the **AI Crop Doctor** modal and send a direct consultation message.
2. **Real-Time Notification:** `MessageStore.sendMessage` immediately dispatches a system notification to the expert's inbox and increments the unread badge in the header.
3. **Expert Triage & Reply:** Inside `ExpertDashboard.tsx`, the agronomist reviews the farmer's concern and responds with targeted treatment advice.
4. **Instant Farmer Alert:** The farmer receives a live system notification and can open the chat thread to follow up.
5. **Voice Call Simulation (`CallModal.tsx`):** Users can initiate simulated voice calls between stakeholders with call log tracking (duration, status: completed/missed/cancelled).

---

## 📢 Regional Agricultural Bulletins Board

A dedicated bulletin delivery mechanism connects extension research to smallholders:

- **Broadcasting:** Agronomists author advisories selecting category (*Weather Alert, Pest Outbreak, Soil Advice, Market Alert, Price Warning*), severity level (*Urgent, Warning, Information*), target district, and affected crops.
- **Farmer Access:** The **Bulletins & Advisories** page (`BulletinsPage.tsx`) provides:
  - Live search across titles and Bengali descriptions
  - Quick category and severity filter pills
  - Expandable advisory cards with publication dates, officer credentials, and recommended remedies
  - Integration with the top navigation bar and breadcrumbs trail

---

## 🧠 AI Capabilities & Architecture (Google Gemini 2.5 Flash)

NativeBazar utilizes `@google/genai` SDK (`v2.4.0`) with an **automatic model fallback chain**: `gemini-2.5-flash` → `gemini-3.1-flash-lite`.

| Feature | Backend Endpoint | Primary Model | Capabilities |
| :--- | :--- | :--- | :--- |
| **AI Crop Doctor** | `POST /api/ai/diagnose-crop` | `gemini-2.5-flash` | Multi-modal visual leaf pathology, disease naming (English & Bangla), confidence score, chemical dosage, and organic alternatives. |
| **Price & Demand Predictor** | `POST /api/ai/predict-demand` | `gemini-2.5-flash` | 10-day price trend forecasting, supply-demand pressure analysis, wholesale vs. retail margin prediction, and optimal harvest timing. |
| **Bengali Voice Assistant** | `POST /api/ai/voice-assistant` | `gemini-2.5-flash` | Natural Bengali speech understanding answering market rates, weather hazards, and navigation commands. |

> [!TIP]
> **Resilience Architecture:** Every AI call is protected by a strict 15-second timeout and automated offline heuristic engines. The entire application functions smoothly even without an active internet connection or Gemini API key.

---

## 💻 Tech Stack & Dependencies

| Domain | Technology / Library | Version | Role in Ecosystem |
| :--- | :--- | :--- | :--- |
| **Frontend Framework** | **React** | `19.0.1` | Modern reactive component architecture with hooks |
| **Language** | **TypeScript** | `7.0.2` | Strict end-to-end type safety across client and server |
| **Bundler & Dev Server** | **Vite** | `8.3.0` | High-speed HMR, Rollup production bundling, and middleware bridge |
| **Styling** | **Tailwind CSS** | `4.3.3` | Utility-first responsive styling with custom design tokens |
| **Icons** | **Lucide React** | `0.546.0` | Comprehensive icon set for agricultural and transactional UI |
| **Animation Engine** | **Motion** | `12.23.24` | Smooth transitions and state animations |
| **Backend Server** | **Express.js** | `4.21.2` | REST API routing, GenAI integration, and static asset serving |
| **TypeScript Engine** | **tsx** | `4.21.0` | Native TypeScript runtime execution for Node.js |
| **Generative AI** | **@google/genai** | `2.4.0` | Official Google GenAI SDK for Gemini 2.5 Flash |
| **Weather Engine** | **Open-Meteo API** | Free Tier | Real-time weather forecasts and agricultural micro-climate radar |
| **Environment Config** | **dotenv** | `17.2.3` | Secure runtime environment variable management |
| **CI/CD** | **GitHub Actions** | — | Automated build and deployment to GitHub Pages on every push to `main` |

---

## 🔑 Pre-Configured Demo Credentials

All 6 roles come pre-configured with realistic credentials for instant evaluation:

| Role | Name & Designation | Login Phone / ID | Password | 2FA PIN | District |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Farmer** | Md. Rafiqul Islam | `01712458920` | `Krishi#2026!Rafiq` | — | Bogura (Shibganj) |
| **Businessman** | Haji Nurul Alam (Wholesaler) | `01711209934` | `AratTrade$2026@Alam` | — | Bogura Sadar / Karwan Bazar |
| **Agro Supplier** | Meghna Fertilizer Manager | `01715889900` | `Fertilizer#9900!Depot` | — | Bogura (Shibganj) |
| **Retail Customer** | Nasrin Akter (Consumer) | `01680123456` | `BazarShop*2026!Nasrin` | — | Bogura Sadar |
| **Agri Expert** | Dr. Akramuzzaman (Agronomist) | *Self-Register* | *Custom (Min 6 chars)* | — | Bogura Regional Station |
| **Central Admin** | NativeBazar Platform Admin | `NativeBazarSJS` | `12345678` | **`883650`** | Bogura Central Hub |

> [!IMPORTANT]
> The **Central Admin** portal requires both the administrator password and the secondary **Two-Factor Authentication (2FA) PIN**: **`883650`**.
> Agronomists can register their own accounts with certificate and NID document upload verification, or link an expert profile via the multi-role switcher.

---

## 🚀 Quickstart & Setup Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher (`v20+` or `v22+` recommended)
- **npm**: `v9.0.0` or higher
- Optional: A **Gemini API Key** from [Google AI Studio](https://aistudio.google.com/) for live generative AI features.

---

### Step 1: Clone Repository & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/Shahsamsu1668/NativeBazar.git

# Navigate into project directory
cd NativeBazar

# Install all dependencies
npm install
```

---

### Step 2: Configure Environment Variables
Copy `.env.example` to create `.env`:
```bash
cp .env.example .env
```

Set your configuration in `.env`:
```env
# Google Gemini API Key (from https://aistudio.google.com)
GEMINI_API_KEY="AIzaSyYourActualKeyHere..."

# Server Port (default: 3000)
PORT=3000

# Base Application URL
APP_URL="http://localhost:3000"
```

*Note: If no Gemini API key is provided, NativeBazar runs in resilient offline mode with comprehensive heuristic responses.*

---

### Step 3: Run the Development Server
```bash
npm run dev
```

The Express server with integrated Vite middleware will start on:
- **Application Web UI:** [http://localhost:3000](http://localhost:3000)
- **Health Check Endpoint:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

### Step 4: Validate & Build for Production
Run TypeScript compiler verification:
```bash
npm run lint
# or: npx tsc --noEmit
```

Build the optimized production client bundle:
```bash
npm run build
```

Run the production server with pre-built assets:
```bash
npm start
```

---

## 📁 Directory Structure

```
NativeBazar/
├── .env.example                    # Environment variable template
├── .github/
│   └── workflows/
│       └── deploy.yml              # GitHub Actions: auto-deploy to GitHub Pages on push to main
├── index.html                      # HTML5 root with SEO metadata and Open Graph tags
├── metadata.json                   # Web app manifest and AI Studio capability declarations
├── package.json                    # npm scripts and project dependencies
├── server.ts                       # Express backend: Gemini AI endpoints, REST APIs & Vite SSR bridge
├── server_data/
│   └── db.json                     # Persistent JSON file database (users, orders, listings, messages)
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite config with React, Tailwind plugins & GitHub Pages base path
│
├── server/
│   └── db.ts                       # JSON-file database engine: CRUD for all 18 domain entities
│
└── src/
    ├── main.tsx                    # React client entry point
    ├── App.tsx                     # Master state container, view routing & RBAC switcher
    ├── index.css                   # Custom design system tokens and responsive styles
    ├── types.ts                    # Complete TypeScript domain interfaces and types (18 models)
    │
    ├── components/                 # UI components and persona hubs
    │   ├── Header.tsx              # Top bar, role switcher, notifications badge & cart
    │   ├── AuthPage.tsx            # Secure login, 2FA prompt & role-based registration
    │   ├── Breadcrumbs.tsx         # Hierarchical view navigation and history trail
    │   ├── BulletinsPage.tsx       # Farmer-accessible regional agricultural bulletins
    │   ├── FarmerDashboard.tsx     # Pre-sales listings, AI demand matching, farm ledger
    │   ├── BusinessmanDashboard.tsx# Bulk demands, AI Match, Find Crops & B2B trade escrow
    │   ├── SupplierDashboard.tsx   # BCIC subsidized inputs, stock toggles & inventory
    │   ├── CustomerMarketplace.tsx # Farm-to-table shopping, checkout & farmer cut display
    │   ├── ExpertDashboard.tsx     # Triage queue, farmer inquiries chat & bulletin broadcasting
    │   ├── AdminDashboard.tsx      # Platform telemetry, equilibrium index & login audits
    │   ├── CropDoctorModal.tsx     # Multimodal AI leaf diagnosis & expert consultation
    │   ├── VoiceAssistantModal.tsx # Natural Bengali voice chat with Web Speech API
    │   ├── MarketRatesView.tsx     # Live DAM mandi rates and inter-district price spreads
    │   ├── WeatherView.tsx         # Open-Meteo micro-climate radar & crop hazard forecasts
    │   ├── OrdersView.tsx          # Comprehensive order tracker (retail, trade, supplier)
    │   ├── ContactsView.tsx        # Stakeholder directory, direct messaging & network
    │   ├── CallModal.tsx           # Voice call simulation between stakeholders with call logs
    │   ├── CreateRoleModal.tsx     # Linked multi-role account creation modal
    │   ├── NoRoleAccountModal.tsx  # Prompt modal when switching to uncreated persona role
    │   ├── ExpertRegistrationModal.tsx # Verified expert registration with certificate/NID upload
    │   ├── AdminVerificationModal.tsx  # Admin identity challenge modal (2FA PIN gate)
    │   ├── UserProfilePage.tsx     # Public profile view for any stakeholder
    │   └── ProfileModal.tsx        # Personal profile editing & settings
    │
    ├── data/                       # State management & persistence
    │   ├── mockData.ts             # Initial seed dataset (users, listings, demands, market rates)
    │   ├── catalogData.ts          # Complete agro-product catalog (fertilizers, seeds, pesticides)
    │   └── store.ts                # 18 reactive client stores with CRUD and LocalStorage
    │
    └── services/                   # External service wrappers
        ├── aiService.ts            # Client wrappers for Gemini AI endpoints with offline fallbacks
        ├── apiService.ts           # REST API client for server-side data fetching
        └── weatherService.ts       # Open-Meteo API client and crop-specific hazard alert engine
```

---

## 📡 REST API Reference

### 1. Health & Status Check
- **Endpoint:** `GET /api/health`
- **Description:** Verifies server responsiveness, pilot region, AI availability, and live database stats.
- **Sample Response:**
```json
{
  "status": "ok",
  "service": "NativeBazar Backend",
  "aiEnabled": true,
  "models": ["gemini-2.5-flash", "gemini-3.1-flash-lite"],
  "pilotDistrict": "Bogura, Bangladesh",
  "stats": { "users": 12, "listings": 8, "orders": 15 },
  "timestamp": "2026-10-23T10:00:00.000Z"
}
```

### 2. User Registration
- **Endpoint:** `POST /api/auth/register`
- **Allowed Roles:** `farmer`, `supplier`, `customer` (public registration)
- **Request Payload:**
```json
{
  "name": "Md. Karim",
  "phone": "01712345678",
  "email": "karim@example.com",
  "password": "MyPass#2026",
  "role": "farmer",
  "district": "Bogura",
  "upazila": "Shibganj"
}
```

### 3. User Login
- **Endpoint:** `POST /api/auth/login`
- **Request Payload:**
```json
{
  "identifier": "01712345678",
  "password": "MyPass#2026",
  "role": "farmer"
}
```

### 4. Multimodal AI Crop Doctor
- **Endpoint:** `POST /api/ai/diagnose-crop`
- **Request Payload:**
```json
{
  "cropName": "Tomato",
  "symptoms": "Concentric brown rings on lower leaves with yellow halo margins",
  "imageBase64": "data:image/jpeg;base64,...",
  "language": "bn"
}
```
- **Sample Response:**
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

### 5. Supply-Demand Price Forecasting
- **Endpoint:** `POST /api/ai/predict-demand`
- **Request Payload:**
```json
{
  "cropName": "Hybrid Tomatoes",
  "quantityKg": 500,
  "targetHarvestDate": "in 10 days",
  "district": "Bogura",
  "language": "bn"
}
```

### 6. Natural Bengali Voice Assistant
- **Endpoint:** `POST /api/ai/voice-assistant`
- **Request Payload:**
```json
{
  "query": "বগুড়ায় আজকের টমেটোর পাইকারি দর কত?",
  "role": "Farmer",
  "userLocation": "Bogura",
  "language": "bn"
}
```

---

## 🚢 Deployment (GitHub Pages)

The frontend is automatically deployed to **GitHub Pages** via GitHub Actions on every push to the `main` branch.

**Workflow file:** `.github/workflows/deploy.yml`

```
push to main  →  npm ci  →  npm run build  →  upload dist/  →  deploy to GitHub Pages
```

> [!NOTE]
> The Vite config sets `base: '/NativeBazar/'` for correct GitHub Pages asset resolution. A `404.html` is automatically copied from `index.html` post-build to support SPA client-side routing on GitHub Pages.

The **backend Express server** (`server.ts`) is not deployed to GitHub Pages (static hosting only). For full-stack deployment with live AI features, use a Node.js-compatible host such as Railway, Render, or Google Cloud Run.

---

## 🔒 Security Architecture & Governance

- **Role-Based Access Control (RBAC):** Strict view and operational isolation among Farmer, Wholesaler, Supplier, Customer, Agronomist, and Admin.
- **Mandatory 2FA Authenticator Gate:** Platform administration requires password authentication followed by a Level-4 security PIN (`883650`).
- **Credential Protection:** Passwords secured with salted SHA-256 hashing (`server/db.ts`).
- **Session Token Management:** Secure session tokens with expiry tracking and automatic invalidation.
- **Account Lockout:** Failed login attempt tracking with temporary lockout protection (`lockedUntil` field).
- **Comprehensive Audit Logging:** Every authentication attempt records timestamp, user phone/email, role, status (`SUCCESS`, `FAILED_PASSWORD`, `FAILED_2FA`, `LOCKED`), IP address, and user-agent string.
- **Timeout & Rate-Limiting Protections:** Backend AI invocations are bounded by strict 15-second timeouts with automated heuristic fallbacks to prevent worker thread exhaustion.

---

## 📜 License & Intellectual Property

All rights reserved © 2026 NativeBazar Engineering Team (**Md. Shahriar Shakib**, **Jubayer Bishwas Shadhin**, **Sumayya Islam**).  
Licensed under standard academic and evaluation terms for demonstration in modern agro-informatics.
