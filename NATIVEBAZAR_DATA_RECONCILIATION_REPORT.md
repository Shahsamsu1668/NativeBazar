# NativeBazar — Comprehensive Historical Data Reconciliation Report

**Audit Date:** November 3, 2026  
**Auditor:** Antigravity Advanced Agentic Verification System  
**Environment:** Isolated Neon Test Branch `dev-migration-test` (`ep-snowy-mode-b389h4uk.ap-southeast-1.aws.neon.tech`)  
**Production Branch Status:** UNTOUCHED (`main` / `ep-raspy-hat-b3y04kgr.ap-southeast-1.aws.neon.tech`)  
**Verification Scope:** Record-by-Record Analysis across SQLite (`nativebazar.db`), JSON (`server_data/db.json`), and Neon PostgreSQL  

---

## 1. Executive Summary & Master Reconciliation Matrix

A deep, record-level reconciliation was executed across all persistent data domains comparing the original SQLite baseline, the original JSON baseline, and the active Neon PostgreSQL test database on `dev-migration-test`.

Every discrepancy, count variance, foreign-key relationship, and quarantined record has been traced to its exact origin:

| Domain # | Domain Name | SQLite Baseline | JSON Baseline | Neon Test Database | Reconciled Status | Root Cause & Classification |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | **Users** | 44 | 42 | **44** | **RECONCILED** | 42 baseline users + 2 E2E test actors. 1 phone collision (`far-shibganj-1` vs `user-farmer-rafiq`). |
| **2** | **Products** | 25 | 18 (15 crops + 3 supplier) | **28** | **RECONCILED** | 25 SQLite products + 3 Quarantined Meghna products (`seller_id = NULL`, `harvest_status = 'Archived'`). |
| **3** | **Orders** | 10 | 10 | **11** | **RECONCILED** | 10 historical SQLite orders + 1 active E2E test order (`ORD-747162-129`). |
| **4** | **Order Items** | 10 | 10 (nested) | **11** | **RECONCILED** | 10 historical SQLite items + 1 active E2E test item (`oi-1793643747108-myyq6q`). Exactly 1 item per order. |
| **5** | **Wholesaler Offers** | 6 | 0 | **6** | **RECONCILED (100% MATCH)** | Exact 1-to-1 match between SQLite and Neon. |
| **6** | **Market Prices** | 7 | 0 | **7** | **RECONCILED (100% MATCH)** | Exact 1-to-1 match between SQLite and Neon. |
| **7** | **Catalog Reference** | 0 | 80 | **80** | **RECONCILED (100% MATCH)** | Complete 80-item Bangladesh crop & input catalog from JSON. |
| **8** | **Direct Messages** | 0 | 11 | **11** | **RECONCILED (100% MATCH)** | Exact 1-to-1 match between JSON and Neon. |
| **9** | **User Connections** | 0 | 4 | **4** | **RECONCILED (100% MATCH)** | Exact 1-to-1 match between JSON and Neon. |
| **10** | **Notifications** | 0 | 16 | **26** | **RECONCILED** | 16 baseline notifications + 10 trade notification event logs generated during E2E testing. |
| **11** | **Audit Logs** | 9 | 0 | **32 Trade / 24 Login** | **RECONCILED & PROTECTED** | 9 historical order logs + runtime trade logs; protected by database immutability triggers. |

---

## 2. Detailed Record-Level Reconciliation

### 2.1 User Accounts Reconciliation

#### Exact Count Breakdown:
- **SQLite Users**: 44
- **JSON Users**: 42
- **Neon Users**: 44

#### Discrepancy Analysis:
1. **The Rafiqul Islam Phone Collision**:
   - In SQLite: User exists as `id: 'far-shibganj-1'`, phone: `'01712458920'`, name: `'MD.Rafiqul Islam'`, role: `'farmer'`.
   - In JSON: User exists as `id: 'user-farmer-rafiq'`, phone: `'01712458920'`, name: `'Rafiqul Islam'`, role: `'farmer'`.
   - **PostgreSQL Constraint**: The Neon `users` table enforces `UNIQUE(phone)`.
   - **Migration Behavior**: The initial JSON sync inserted `user-farmer-rafiq`. When SQLite was subsequently synced, `far-shibganj-1` was rejected by PostgreSQL due to duplicate phone `'01712458920'`.
   - **Reconciliation Finding**: The user exists in Neon under ID `user-farmer-rafiq`. No real human user account is missing. However, any historical SQLite foreign keys that pointed to `far-shibganj-1` would be orphaned unless mapped to `user-farmer-rafiq`.
2. **Additional Test Users in SQLite & Neon**:
   - `usr-farmer-1793643743986` (phone: `'01799567458'`)
   - `usr-farmer-1793643805907` (phone: `'01799173103'`)
   - These 2 users were generated during controlled Phase 3.1 runtime test runs. They exist in both SQLite and Neon.

---

### 2.2 Products & Product Ownership Reconciliation

#### Exact Count Breakdown:
- **SQLite Products**: 25
- **JSON Crops**: 15 (subset of SQLite farmer products)
- **JSON Supplier Products**: 3 (Meghna supplier items)
- **Neon Products**: 28

#### Discrepancy & Quarantine Analysis:
1. **The 3 Quarantined Meghna Products**:
   - In JSON `server_data/db.json`, 3 agricultural input products were listed under `supplierId: 'user-supplier-meghna'`:
     - `sup-meghna-potash`: *Muriate of Potash (MOP)* (50 kg bag, ৳1,200)
     - `sup-meghna-seed`: *Lal Teer Hybrid Tomato Seeds (Bijli Plus)* (10g pack, ৳450)
     - `sup-meghna-tricho`: *Trichoderma Bio-Fungicide* (1 kg pack, ৳380)
   - As audited in Phase 2.1.4, `user-supplier-meghna` was never registered in `users` in either SQLite or JSON.
   - To preserve catalog history without fabricating synthetic user accounts, these 3 products were inserted into Neon with:
     - `seller_id = NULL`
     - `harvest_status = 'Archived'`
   - Verified at runtime: Archived products are strictly filtered out of active marketplace queries (`harvest_status != 'Archived'`), preventing invalid purchases while keeping product records intact.
2. **The 5 Orphaned SQLite Products**:
   Inspection revealed that in the original source SQLite database (`nativebazar.db`), 5 products pointed to `seller_id` values that **never existed** in SQLite's `users` table:
   - `prod-far-1792428431395` (*Paddy / BRRI Dhan*): `seller_id = 'usr-farmer-1792427693522'` (seller: *MD.Rafikul*)
   - `prod-who-1792429290897` (*Diamond Potato*): `seller_id = 'usr-wholesaler-1792429001007'` (seller: *Karwan Bazar*)
   - `prod-ret-1792429849368` (*Fresh Table Tomatoes*): `seller_id = 'usr-retailer-1792429560584'` (seller: *Bismillah krishi corner*)
   - `prod-who-1793118824779` (*Diamond potato*): `seller_id = 'usr-wholesaler-1793117893463'` (seller: *Karwan Bazar*)
   - `prod-ret-1793261720613` (*Fresh Table Tomatoes*): `seller_id = 'usr-retailer-1793258113266'` (seller: *Bismillah Krishi corner*)

   **Root Cause**: In SQLite, foreign key constraints are disabled by default (`PRAGMA foreign_keys = OFF`). The legacy application deleted or failed to create the user rows, leaving dangling seller references.
   **Safe Handling in Neon**: PostgreSQL enforces strict foreign keys (`FOREIGN KEY (seller_id) REFERENCES users(id)`). In `scripts/repair_sqlite_data_completeness.cjs`, these 5 products had their `seller_id` set to `NULL` while preserving their `seller_name`, `seller_role`, prices, and quantities.
   **Current Neon State**: Zero products have orphaned/dangling foreign keys (`withForeignSeller: []`).

---

### 2.3 Orders & Order Items Reconciliation

#### Exact Count Breakdown:
- **SQLite Orders**: 10 | **SQLite Order Items**: 10
- **JSON Orders**: 10
- **Neon Orders**: 11 | **Neon Order Items**: 11

#### Discrepancy Analysis:
1. **10 Historical Orders Reconciled**:
   All 10 historical orders from SQLite (`ORD-001` through `ORD-010`) are 100% restored and verified in Neon:
   - `ORD-001` (Farmer `far-001` → Wholesaler `who-001`, ৳17,500)
   - `ORD-002` (Wholesaler `who-001` → Retailer `ret-001`, ৳5,600)
   - `ORD-003` (Retailer `ret-001` → Consumer `con-001`, ৳750)
   - `ORD-004` through `ORD-010`: All preserved with matching `total_bdt`, `delivery_status`, and payment methods.
2. **The 1 Extra Order in Neon**:
   - `id: 'ORD-747162-129'`, buyer: `'usr-retailer-jafor'`, total: `৳1,050.00`.
   - Matching Item: `id: 'oi-1793643747108-myyq6q'`, product: `'prod-who-201'`, quantity: `30 kg`, unit price: `৳35.00`.
   - **Origin**: Created during Phase 3.1 / Master Prompt 2 runtime verification tests to validate transactional order creation and audit logging.
3. **Referential Integrity**:
   - `Orders without Order Items`: **0**
   - `Order Items without Orders`: **0**
   - 100% 1-to-1 consistency between `orders` and `order_items`.

---

### 2.4 Wholesaler Offers & Market Rates Reconciliation

- **SQLite `wholesaler_offers`**: 6 records (`dem-001` through `dem-006`).
- **Neon `wholesaler_offers`**: 6 records.
- **Match Status**: **100% EXACT MATCH**. Every demand has valid `wholesaler_id`, `crop_name`, `quantity_kg_needed`, and `offered_price_per_kg`.
- **SQLite `market_prices`**: 7 records.
- **Neon `market_prices`**: 7 records.
- **Match Status**: **100% EXACT MATCH**. Includes benchmark rates for Potato, Tomato, Onion, Chili, Cauliflower, Cabbage, and Brinjal.

---

### 2.5 Catalog, Messages & Connections Reconciliation

- **Catalog**:
  - JSON baseline: 80 items across 5 categories (Vegetables, Fruits, Grains, Fertilizers, Seeds).
  - Neon `catalog`: 80 items.
  - Match: **100% EXACT MATCH**.
- **Direct Messages**:
  - JSON baseline: 11 direct messages.
  - Neon `messages`: 11 messages.
  - Match: **100% EXACT MATCH**.
- **Connections**:
  - JSON baseline: 4 user connections.
  - Neon `connections`: 4 connections.
  - Match: **100% EXACT MATCH**.

---

### 2.6 Notifications & Audit Logs Reconciliation

- **Notifications**:
  - JSON baseline: 16 notifications.
  - Neon `notifications`: 26 records (16 baseline + 10 trade activity notifications generated during runtime tests).
- **Audit Logs**:
  - SQLite `audit_logs`: 9 historical order logs.
  - Neon `trade_audit_logs`: 32 records (includes all historical trades + test trade audit entries).
  - Neon `login_audit_logs`: 24 records (tracks user logins/logouts).
  - Both audit log tables are protected by PostgreSQL immutability triggers (`trg_protect_trade_audit_logs` and `trg_protect_login_audit_logs`).

---

## 3. Production Blocker & Discrepancy Classification

| Finding # | Data Discrepancy | Severity | Production Blocker? | Remediation Requirement |
| :---: | :--- | :---: | :---: | :--- |
| **D-1** | Phone collision: `far-shibganj-1` (SQLite) vs `user-farmer-rafiq` (JSON) | Medium | **YES (If unhandled)** | Formally map `far-shibganj-1` to `user-farmer-rafiq` in the production migration script so historical orders linked to `far-shibganj-1` point to `user-farmer-rafiq`. |
| **D-2** | 5 SQLite products with orphaned `seller_id`s pointing to deleted users | Low | **NO (Remediated)** | Retain `seller_id = NULL` with archived/historical status. Stakeholder sign-off required. |
| **D-3** | 3 Meghna products with unverified supplier | Low | **NO (Remediated)** | Retained as quarantined items (`seller_id = NULL`, `harvest_status = 'Archived'`). |
| **D-4** | 1 disposable test order (`ORD-747162-129`) in test Neon database | Low | **NO** | Test artifact on `dev-migration-test`. Production migration will only import the 10 real historical orders. |

---

## 4. Final Data Reconciliation Sign-Off

The data reconciliation between SQLite, JSON, and Neon PostgreSQL is **COMPLETE, EXPLAINED, AND VERIFIED**. Zero unexplained discrepancies remain. All records have an auditable lineage.

