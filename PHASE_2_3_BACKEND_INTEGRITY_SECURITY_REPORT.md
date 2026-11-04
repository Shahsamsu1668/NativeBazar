# NativeBazar — Phase 2.3: Isolated Backend Integrity & Security Testing Report

**Execution Date:** November 2, 2026  
**Final Status:** **`NOT READY — BACKEND OR SECURITY ISSUES REMAIN`**  
**Auditor / Runner:** DeepMind Antigravity Migration & Security Engine  
**Target Environment:** Isolated Neon Branch `dev-migration-test` (`br-super-pond-b37g04s1` / `ep-snowy-mode-b389h4uk`)  

---

## 1. Executive Summary

A comprehensive read-only and controlled-runtime verification of the migrated database schema, data integrity, transaction safety, audit protection, Express backend routes, and real-time mechanics was performed against the isolated Neon test branch `dev-migration-test`.

The investigation established that while **schema migration and historical data preservation succeeded completely (Tests 1, 2, and 3 PASSED)**, significant **backend integration, transactional safety, and audit immutability vulnerabilities remain (Tests 4, 5, 6, and 7 FAILED)**. Most critically, the running Express application is still reading and writing operational marketplace data (products, orders, messages, notifications) to **SQLite and JSON**, rather than the migrated Neon database. Furthermore, PostgreSQL audit logs lack database-level append-only enforcement.

### Test Verdict Summary

| Test ID | Test Name | Classification | Verdict |
| :--- | :--- | :--- | :--- |
| **Test 1** | Schema and Migration Completeness | **PASS** | Verified by runtime evidence (17/17 tables + `crops` view) |
| **Test 2** | Data Integrity & Value Verification | **PASS** | Verified by runtime evidence (0 orphans, 100% PK/FK integrity) |
| **Test 3** | Unit-Aware Inventory & Compatibility | **PASS** | Verified by runtime evidence (0 fabricated kg values, camelCase view verified) |
| **Test 4** | Order Transaction Security | **FAIL** | Verified by runtime evidence (Multi-seller orders allowed in DB; SQLite auto-replenish bug) |
| **Test 5** | Audit Protection & Immutability | **FAIL** | Verified by runtime evidence (`neondb_owner` has full `UPDATE` and `DELETE` privileges; 0 triggers) |
| **Test 6** | Backend Integration Audit | **FAIL** | Verified by runtime evidence & code inspection (Express routes still hit SQLite & JSON) |
| **Test 7** | Realtime and Persistence Audit | **FAIL** | Verified by code inspection & runtime analysis (In-memory SSE without multi-instance support; JSON storage) |

---

## 2. Test 1 — Schema and Migration Completeness

**Classification:** **PASS — Verified by Actual Runtime Evidence**

### Runtime Table & View Inventory
Every table and view on the isolated database `dev-migration-test` was inspected via `information_schema.tables`:

| # | Table / View Name | Object Type | Status | Actual Row Count | Source Data Origin |
| :-: | :--- | :--- | :--- | :-: | :--- |
| 1 | `users` | BASE TABLE | **EXISTS** | **42** | Neon (pre-existing) |
| 2 | `sessions` | BASE TABLE | **EXISTS** | **26** | Neon (pre-existing) |
| 3 | `login_audit_logs` | BASE TABLE | **EXISTS** | **24** | Neon (pre-existing) + JSON sync |
| 4 | `products` | BASE TABLE | **EXISTS** | **28** | SQLite (25) + Quarantined JSON (3) |
| 5 | `orders` | BASE TABLE | **EXISTS** | **10** | SQLite (10) |
| 6 | `order_items` | BASE TABLE | **EXISTS** | **10** | SQLite (10) |
| 7 | `wholesaler_offers` | BASE TABLE | **EXISTS** | **6** | SQLite (6) |
| 8 | `market_prices` | BASE TABLE | **EXISTS** | **7** | SQLite (7) |
| 9 | `trade_audit_logs` | BASE TABLE | **EXISTS** | **9** | SQLite (9) |
| 10 | `messages` | BASE TABLE | **EXISTS** | **11** | JSON `db.json` (11) |
| 11 | `connections` | BASE TABLE | **EXISTS** | **4** | JSON `db.json` (4) |
| 12 | `notifications` | BASE TABLE | **EXISTS** | **16** | JSON `db.json` (16) |
| 13 | `reviews` | BASE TABLE | **EXISTS** | **0** | Clean schema (source had 0) |
| 14 | `catalog` | BASE TABLE | **EXISTS** | **80** | JSON `db.json` (80) |
| 15 | `call_logs` | BASE TABLE | **EXISTS** | **0** | Clean schema (source had 0) |
| 16 | `farmer_expenses` | BASE TABLE | **EXISTS** | **0** | Clean schema (source had 0) |
| 17 | `negotiations` | BASE TABLE | **EXISTS** | **0** | Clean schema (source had 0) |
| 18 | `crops` | **VIEW** | **EXISTS** | **15** | Dynamic view over `products WHERE seller_role = 'farmer'` |

**Runtime Evidence:**
- All 17 expected tables exist as PostgreSQL base tables.
- Zero-count tables (`reviews`, `call_logs`, `farmer_expenses`, `negotiations`) were successfully provisioned with full column types and constraints.
- `crops` compatibility view returned 15 active farmer crops.

---

## 3. Test 2 — Data Integrity & Value Verification

**Classification:** **PASS — Verified by Actual Runtime Evidence**

### 3.1 Primary-Key Uniqueness
Every populated table was tested for PK uniqueness (`COUNT(*) = COUNT(DISTINCT id)`):
- `users`: 42 total, 42 distinct (Unique: **true**)
- `sessions`: 26 total, 26 distinct (Unique: **true**)
- `products`: 28 total, 28 distinct (Unique: **true**)
- `orders`: 10 total, 10 distinct (Unique: **true**)
- `order_items`: 10 total, 10 distinct (Unique: **true**)
- `wholesaler_offers`: 6 total, 6 distinct (Unique: **true**)
- `market_prices`: 7 total, 7 distinct (Unique: **true**)
- `trade_audit_logs`: 9 total, 9 distinct (Unique: **true**)
- `messages`: 11 total, 11 distinct (Unique: **true**)
- `connections`: 4 total, 4 distinct (Unique: **true**)
- `notifications`: 16 total, 16 distinct (Unique: **true**)
- `catalog`: 80 total, 80 distinct (Unique: **true**)

### 3.2 Foreign-Key Integrity & Orphan Prevention
Foreign key relationships were verified using anti-join queries:
- `orders.buyer_id -> users.id`: **0 orphans** (Valid: **true**)
- `orders.seller_id -> users.id`: **0 orphans** (Valid: **true**)
- `order_items.order_id -> orders.id`: **0 orphans** (Valid: **true**)
- `order_items.product_id -> products.id`: **0 orphans** (Valid: **true**)
- `products.seller_id -> users.id`: **0 orphans** (Valid: **true**)
- `messages.sender_id -> users.id`: **0 orphans** (Valid: **true**)
- `messages.recipient_id -> users.id`: **0 orphans** (Valid: **true**)
- `notifications.user_id -> users.id`: **0 orphans** (Valid: **true**)

### 3.3 Historical Guest Orders & Orphan Preservation
- **3 Historical Guest Orders** (`ORD-472370-881`, `ORD-486888-552`, `ORD-950439-962`) were safely preserved with `buyer_id = NULL` without causing FK constraint crashes.
- Unregistered buyer phone numbers (`01888888888`, `01788888888`, `01766666666`) and delivery tracking codes were retained in full.

### 3.4 User ID Remapping: `far-shibganj-1` -> `user-farmer-rafiq`
- Remapping verified: 4 products (`prod-far-301`, `crop-chi-103`, `crop-pot-102`, `crop-tom-101`) successfully remapped to `user-farmer-rafiq`.
- Zero broken references remain pointing to legacy ID `far-shibganj-1`.

### 3.5 Meghna Supplier Quarantine
- 3 legacy products (`sup-meghna-potash`, `sup-meghna-seed`, `sup-meghna-tricho`) verified:
  - `seller_id = NULL` (No synthetic user account was created)
  - `harvest_status = 'Archived'`
  - Stock quantities and package units preserved (`850 kg`, `90 10g pack`, `120 500g pack`).

### 3.6 Direct Field-by-Field Value Comparison (SQLite vs Neon)
Sample product records compared field-for-field:
- `prod-ret-101`: SQLite `crop_name="Fresh Farm Table Tomatoes", qty=400, price=52, district="Bogura"`  
  Neon: `crop_name="Fresh Farm Table Tomatoes", qty=400.00, price=52.00, district="Bogura"` — **MATCH: true**
- `prod-ret-102`: SQLite `crop_name="Bogura Diamond Red Potatoes", qty=850, price=38, district="Bogura"`  
  Neon: `crop_name="Bogura Diamond Red Potatoes", qty=850.00, price=38.00, district="Bogura"` — **MATCH: true**
- `prod-ret-103`: SQLite `crop_name="Pungent Green Chilies (Spicy)", qty=180, price=120, district="Bogura"`  
  Neon: `crop_name="Pungent Green Chilies (Spicy)", qty=180.00, price=120.00, district="Bogura"` — **MATCH: true**

---

## 4. Test 3 — Unit-Aware Inventory & Compatibility View

**Classification:** **PASS — Verified by Actual Runtime Evidence**

### 4.1 Unit-Aware Inventory Evaluation
PostgreSQL generated columns (`quantity_kg`, `available_kg`, `price_per_kg`) evaluated dynamically:

```sql
quantity_kg NUMERIC(12, 2) GENERATED ALWAYS AS (CASE WHEN unit = 'kg' THEN quantity ELSE NULL END) STORED
```

1. **Bulk Produce (`unit = 'kg'`)**:
   - `prod-ret-101` (Tomatoes): `quantity = 400.00`, `quantity_kg = 400.00`, `price_per_kg = 52.00` (**Populated correctly**)
2. **Seed Packets (`unit = '10g pack'`)**:
   - `sup-meghna-seed`: `quantity = 90.00`, `quantity_kg = NULL`, `price_per_kg = NULL` (**Fabricated kg values prevented**)
3. **Bio-Fungicide (`unit = '500g pack'`)**:
   - `sup-meghna-tricho`: `quantity = 120.00`, `quantity_kg = NULL`, `price_per_kg = NULL` (**Fabricated kg values prevented**)

### 4.2 Fabrication Protection Query Result
```sql
SELECT count(*)::int as fabricated_count 
FROM products 
WHERE unit != 'kg' AND (quantity_kg IS NOT NULL OR price_per_kg IS NOT NULL);
```
- **Fabricated Count:** **0** (Expected: 0). Discrete packaged products are completely protected against accidental kg dimensional scaling.

### 4.3 Crops Compatibility View Aliases
Querying the `crops` SQL view verified exact camelCase compatibility for legacy frontend consumers:
- `farmerId`: Maps to `seller_id` (`user-farmer-rafiq`)
- `farmerName`: Maps to `seller_name` (`Farmer Rafiqul Islam (Shibganj Hub)`)
- `cropName`: Maps to `crop_name` (`Harvest Ready Hybrid Tomatoes`)
- `cropBangla`: Maps to `bangla_name` (`ক্ষেতের পাকা হাইব্রিড টমেটো`)
- `quantityKg`: Maps to `quantity_kg` (`3500.00`)
- `availableKg`: Maps to `available_kg` (`3500.00`)
- `expectedPricePerKg`: Maps to `price_per_kg` (`38.00`)
- `status`: Maps to `harvest_status` (`Harvesting in Progress`)

---

## 5. Test 4 — Order Transaction Security

**Classification:** **FAIL — Critical Application & Constraint Gaps Identified**

A controlled runtime test was conducted using disposable test records inside an isolated transaction on `dev-migration-test`.

### 5.1 Verification Checklist & Runtime Findings

| Rule | Expected Behavior | Observed Behavior | Status |
| :--- | :--- | :--- | :--- |
| **1. Seller Identity Verification** | Seller ID taken strictly from database product records | `server.ts` line 1123 reads `sellerId` from `req.body` directly if supplied by client | **FAIL** |
| **2. Client Price Tamper Resistance** | Client-supplied unit prices ignored | Prices derived exclusively from database product record (`subtotal = prod.price_per_kg * quantity`) | **PASS** |
| **3. Buyer Role Verification** | Role extracted from authenticated session token | `effectiveBuyerRole = authUser.role` from verified JWT/session | **PASS** |
| **4. Supply Chain Hierarchy** | Farmer→Wholesaler, Wholesaler→Retailer, Retailer→Consumer strictly enforced | `validateSupplyChainTrade` blocks unauthorized cross-tier trading | **PASS** |
| **5. Single-Seller Order Enforcement** | An order cannot contain products from multiple distinct sellers | **DB Level:** Allowed without error (2 distinct sellers inserted). **App Level:** Iterates items without verifying all products match `order.seller_id` | **FAIL** |
| **6. Duplicate Cart Item Aggregation** | Duplicate cart items merged into single line-item | Cart items inserted as separate redundant `order_items` records | **FAIL** |
| **7. Inventory Oversell Protection** | Insufficient stock blocks order execution | **Neon DB:** `CHECK (available_qty >= 0)` blocked oversell with `products_available_qty_check`. **Existing SQLite Code:** Auto-replenished stock (`available_kg + item.quantityKg * 2`) instead of failing! | **FAIL (In App Code)** |
| **8. Atomic Multi-Table Mutation** | Order + Items + Stock + Audit committed or rolled back together | Verified supported on Neon via `BEGIN ... ROLLBACK`; but **NOT yet implemented in Express API for Neon** | **FAIL** |

### 5.2 Critical Vulnerabilities Found in `executeOrderTransaction`
1. **Multi-Seller Order Leak**: An attacker could craft a payload with item A from Seller 1 and item B from Seller 2. The order is inserted with Seller 1, but order items reference Seller 2.
2. **SQLite Auto-Replenish Bug**: In `src/server/db.ts` lines 1150-1155, when available stock is less than requested quantity, the code automatically increases stock:
   ```typescript
   if (prod.available_kg < item.quantityKg) {
     db.prepare('UPDATE products SET available_kg = available_kg + ? WHERE id = ?')
       .run(item.quantityKg * 2, prod.id);
   }
   ```
   This invalidates inventory tracking by fabricating phantom stock.

---

## 6. Test 5 — Audit Protection & Immutability

**Classification:** **FAIL — Database-Level Immutability Does Not Exist**

Runtime privileges and database protections were inspected for the connecting role (`neondb_owner`) on `trade_audit_logs` and `login_audit_logs`.

### 6.1 Database Privilege Audit

```sql
SELECT grantee, table_name, privilege_type 
FROM information_schema.table_privileges 
WHERE table_name IN ('trade_audit_logs', 'login_audit_logs') AND grantee = 'neondb_owner';
```

**Result:**
The connecting user holds `INSERT`, `SELECT`, **`UPDATE`**, **`DELETE`**, **`TRUNCATE`**, `TRIGGER`, `REFERENCES` on both audit tables.

### 6.2 Trigger & Rule Inspection
- **Database Triggers (`information_schema.triggers`):** **0 triggers found**.
- **Database Rules (`pg_rules`):** **0 rules found**.

### 6.3 Runtime Mutation Test Evidence
A disposable record (`test-trade-audit-temp-1`) was inserted, modified, and deleted within an active transaction:
- **`UPDATE trade_audit_logs`:** **SUCCEEDED** (Returned 1 updated row without error).
- **`DELETE FROM trade_audit_logs`:** **SUCCEEDED** (Returned 1 deleted row without error).
- Transaction was subsequently rolled back.

### 6.4 Risk Assessment
> [!WARNING]
> While the Express API currently exposes no `PUT` or `DELETE` endpoints for audit logs, **PostgreSQL provides zero immutability guarantees**. Any compromised backend credential, SQL injection, or maintenance script can tamper with or delete financial trade logs and login audit trails without database rejection.
> 
> **Required Remediation:** A PostgreSQL `BEFORE UPDATE OR DELETE` trigger must be attached to `trade_audit_logs` and `login_audit_logs` to reject mutations at the engine level (`RAISE EXCEPTION 'Audit logs are append-only'`).

---

## 7. Test 6 — Backend Integration Audit

**Classification:** **FAIL — Operational Endpoints Still Point to SQLite, JSON & LocalStorage**

A thorough inspection of `server.ts`, `src/server/db.ts`, and `src/services/apiService.ts` was conducted to verify whether the backend actually interacts with the migrated Neon tables.

### 7.1 Database Storage by Application Feature

| Application Feature | Intended Neon Table | Current Active Storage Engine | Integrates with Neon? |
| :--- | :--- | :--- | :---: |
| **Authentication & Sessions** | `users`, `sessions` | **Neon PostgreSQL** | **YES** |
| **Login Audit Logs** | `login_audit_logs` | **Neon PostgreSQL** + JSON sync | **PARTIAL** |
| **User Profile Updates** | `users` | **Neon PostgreSQL** | **YES** |
| **Products (Marketplace)** | `products` | **SQLite** (`db.prepare(...)`) + JSON (`supplierProducts`) | **NO** |
| **Crops (Farmer Catalog)** | `products` / `crops` | **JSON** (`db.json`) + SQLite mirror | **NO** |
| **Orders & Checkout** | `orders` | **SQLite** (`db.prepare(...)`) + JSON (`db.json`) | **NO** |
| **Order Items** | `order_items` | **SQLite** (`db.prepare(...)`) | **NO** |
| **Wholesaler Offers** | `wholesaler_offers` | **SQLite** (`db.prepare(...)`) | **NO** |
| **Market Rates / DAM Rates** | `market_prices` | **SQLite** (`db.prepare(...)`) | **NO** |
| **Trade Audit Logs** | `trade_audit_logs` | **SQLite** (`audit_logs`) | **NO** |
| **Direct Messages** | `messages` | **JSON** (`db.json`) + In-memory cache | **NO** |
| **User Connections** | `connections` | **JSON** (`db.json`) + In-memory cache | **NO** |
| **Notifications** | `notifications` | **JSON** (`db.json`) + In-memory cache | **NO** |
| **Reviews** | `reviews` | **JSON** (`db.json`) + In-memory cache | **NO** |
| **Master Catalog** | `catalog` | **JSON** (`db.json`) | **NO** |
| **Call Logs / WebRTC** | `call_logs` | **JSON** (`db.json`) + In-memory cache | **NO** |
| **Farmer Expenses** | `farmer_expenses` | **Frontend localStorage** (`nb_expense_ledger`) | **NO** |
| **Price Negotiations** | `negotiations` | **Frontend localStorage** (`nb_negotiations`) | **NO** |

### 7.2 Frontend LocalStorage Drift
Inspection of `src/data/store.ts` revealed that 22 separate keys are actively managed in the browser's `localStorage` (`nb_orders`, `nb_crop_listings`, `nb_messages_v1`, `nb_connections_v1`, `nb_notifications`, `nb_expense_ledger`, `nb_negotiations`). This creates dual-source drift whenever users switch browsers or devices.

---

## 8. Test 7 — Realtime and Persistence Audit

**Classification:** **FAIL — In-Memory Architecture Without Multi-Instance Support**

### 8.1 Database Persistence
- **Runtime Persistence:** In `server.ts` (lines 2344, 2390, 2410), incoming messages, connections, notifications, and call signals are written to `jsonDb` (`server_data/db.json`), not Neon PostgreSQL.
- Historical data on `dev-migration-test` will rapidly drift from the operational JSON file if users interact with the app.

### 8.2 Real-time SSE Architecture
- Endpoint: `GET /api/realtime` (SSE - Server-Sent Events).
- Client tracking is handled via an in-memory Map:
  ```typescript
  const sseClients = new Map<string, Set<express.Response>>();
  ```
- **Single-Node Limitation:** If the backend is deployed across multiple serverless containers, container replicas, or instances:
  - User A connected to Instance 1 will **never receive** messages sent by User B connected to Instance 2.
  - No distributed message broker (Redis, Neon Realtime, or PostgreSQL `LISTEN / NOTIFY`) is implemented.

### 8.3 Frontend LocalStorage Fallback
- `src/data/store.ts` maintains in-memory and `localStorage` stores for messages and notifications.
- When an SSE event arrives, the client updates both React state and `localStorage`. However, if the browser is reloaded or opened on a second device, un-synced messages do not reconstruct from the server database.

---

## 9. Comprehensive Risk Matrix

| Risk ID | Category | Severity | Description | Remediation Required |
| :---: | :--- | :---: | :--- | :--- |
| **R-1** | **Backend Cutover** | **CRITICAL** | API endpoints for products, orders, messages, and catalog read/write to SQLite & JSON, ignoring Neon. | Rewire Express controllers in `server.ts` and `src/server/db.ts` to execute PostgreSQL queries against `pool`. |
| **R-2** | **Audit Immutability** | **HIGH** | `neondb_owner` can UPDATE and DELETE `login_audit_logs` and `trade_audit_logs`. | Deploy PostgreSQL trigger: `CREATE TRIGGER trg_protect_audit BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`. |
| **R-3** | **Order Security** | **HIGH** | Orders can contain items from multiple sellers; client can supply forged `sellerId`. | Enforce single-seller validation and lookup product seller from DB inside PostgreSQL transaction. |
| **R-4** | **Inventory Logic** | **HIGH** | SQLite order function replenishes stock automatically (`+ quantity * 2`) on deficit. | Remove replenishment logic; use `available_qty >= requested` with `SELECT ... FOR UPDATE`. |
| **R-5** | **Realtime Multi-Node** | **MEDIUM** | In-memory `sseClients` map cannot route events across multiple instances. | Implement Redis pub/sub or Neon Realtime / PG `LISTEN/NOTIFY`. |
| **R-6** | **LocalStorage Drift** | **MEDIUM** | Frontend relies on `localStorage` for offline caching of orders, ledger, and messages. | Transition frontend store to fetch authoritative data from REST APIs on mount. |

---

## 10. Final Recommendation & Readiness Verdict

The isolated database schema on `dev-migration-test` has proven completely sound, unit-aware, and faithful to source data. However, **the application codebase has not yet been integrated with the migrated database**, and **critical transactional security and audit protection gaps remain**.

Moving directly to production migration without addressing these backend gaps would leave the new PostgreSQL database dormant while the running server continues writing to SQLite and JSON.

### Final Verdict:
# **`NOT READY — BACKEND OR SECURITY ISSUES REMAIN`**

---

### Recommended Remediation Steps (Phase 2.4 / Phase 3):
1. **Apply PostgreSQL Audit Trigger**: Add immutable append-only triggers to `trade_audit_logs` and `login_audit_logs` on `dev-migration-test`.
2. **Rewrite `executeOrderTransaction` for PostgreSQL**: Implement atomic transaction on `pool` with `SELECT ... FOR UPDATE`, single-seller enforcement, cart item aggregation, and true oversell blocking.
3. **Cutover Express Endpoints to Neon**: Migrate `server.ts` routes (`/api/products`, `/api/orders`, `/api/messages`, `/api/notifications`, `/api/connections`, `/api/catalog`) from SQLite/JSON to Neon `pool.query`.
4. **Clean up LocalStorage Fallbacks**: Refactor `src/data/store.ts` to source data strictly from the integrated backend API.
5. **Re-Test & Approve Production Cutover**: Re-run Phase 2.3 validation test suite once backend integration is wired.

---
*End of Phase 2.3 Report. As required by safety boundaries, no production changes, database alterations, or Git commits have been made.*

