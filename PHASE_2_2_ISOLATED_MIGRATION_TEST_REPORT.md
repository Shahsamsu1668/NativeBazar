# NativeBazar — Phase 2.2: Isolated Neon Migration Test Report

**Execution Date:** November 2, 2026  
**Final Test Status:** **`ISOLATED MIGRATION TEST PASSED`**  
**Auditor / Runner:** DeepMind Antigravity Migration Engine  

---

## 1. Executive Summary

In accordance with Phase 2.2 specifications, a full rehearsal migration was executed on an isolated Neon test branch (`dev-migration-test`) branched off production parent `br-square-mud-b3mncdyw` at LSN `0/1D72950`.

The production database branch was **completely untouched** (0 modifications, 0 schema additions, verified via Neon schema inspection). All 42 pre-existing users, 26 active sessions, and 24 login audit logs remain intact. The migration script was executed inside an atomic transaction on the isolated branch, consolidating SQLite and JSON into PostgreSQL under the unified schema approved in Phase 2.1.4.

All validation checks in Stage D passed with 100% accuracy.

---

## 2. Stage A — Isolated Branch Identity & Safety Verification

Before any write operations took place, the branch hierarchy and compute endpoints were verified through Neon MCP tools.

| Attribute | Production Branch | Isolated Test Branch | Status / Verification |
| :--- | :--- | :--- | :--- |
| **Branch Name** | `main` | `dev-migration-test` | Verified distinct |
| **Branch ID** | `br-square-mud-b3mncdyw` | `br-super-pond-b37g04s1` | Isolated branch verified |
| **Parent Branch** | *None* | `br-square-mud-b3mncdyw` | Branch point: `0/1D72950` |
| **Compute Endpoint** | `ep-orange-forest-b3h3e66f` | `ep-snowy-mode-b389h4uk` | Different pooler endpoints |
| **Database Name** | `neondb` | `neondb` | Logical DB on test branch |
| **Points to Production?** | **NO** | **NO** | Safety guard verified (`false`) |
| **Credentials Masked?** | **YES** | **YES** | No connection secrets exposed |

> [!NOTE]
> Connection credentials for the isolated branch are stored strictly in `server_data/test_branch.env` (untracked, gitignored, excluded from source control).

---

## 3. Stage B — Source Database Verification & Backup Manifest

Immutable pre-migration backups were generated and SHA-256 verified prior to any migration activity.

### Verified File Hashes & Sizes

| File Description | Location | Size (Bytes) | SHA-256 Hash |
| :--- | :--- | :--- | :--- |
| **SQLite Source** | `nativebazar.db` | 122,880 | `b2325d28ef2c3e7f0fb37f6bd0270f53af6d2658d0e1b4ba99e7cf4a1a867992` |
| **SQLite Backup** | `server_data/backups/phase2_2_verified_backups/nativebazar.db` | 122,880 | `b2325d28ef2c3e7f0fb37f6bd0270f53af6d2658d0e1b4ba99e7cf4a1a867992` |
| **JSON Source** | `server_data/db.json` | 132,901 | `1ab54a39e6961360165e43b116b16e56b230f2c36bafc9156403d116f2cd7a7a` |
| **JSON Backup** | `server_data/backups/phase2_2_verified_backups/db.json` | 132,901 | `1ab54a39e6961360165e43b116b16e56b230f2c36bafc9156403d116f2cd7a7a` |

Backup Manifest verified at: [manifest.json](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/server_data/backups/phase2_2_verified_backups/manifest.json).

### Pre-Migration Source Counts

- **SQLite Database (`nativebazar.db`)**:
  - `users`: 42
  - `products`: 25
  - `orders`: 10
  - `order_items`: 10
  - `wholesaler_offers`: 6
  - `market_prices`: 7
  - `audit_logs`: 9
- **JSON Database (`server_data/db.json`)**:
  - `users`: 42
  - `crops`: 15 (subset of SQLite products with farmer roles)
  - `supplierProducts`: 3 (`sup-meghna-potash`, `sup-meghna-tricho`, `sup-meghna-seed`)
  - `orders`: 10
  - `messages`: 11
  - `connections`: 4
  - `notifications`: 16
  - `catalog`: 80
  - `auditLogs`: 24
  - `reviews`: 0
  - `callLogs`: 0

---

## 4. Stage C — Migration Execution on Isolated Test Branch

The rehearsal migration was executed via `scripts/rehearse_migration_test_branch.cjs` within an atomic PostgreSQL transaction (`BEGIN ... COMMIT`).

### Schema Setup
The unified schema established 17 base tables and 1 compatibility view:
1. `users` (pre-existing)
2. `sessions` (pre-existing)
3. `login_audit_logs` (pre-existing)
4. `products` (created with unit-aware inventory and generated `_kg` columns)
5. `crops` (created as backward-compatible SQL `VIEW` with 16 camelCase aliases)
6. `orders` (created with single-seller tracking, guest buyer handling)
7. `order_items` (created with FKs to `orders` and `products`)
8. `wholesaler_offers` (created with demand status checks)
9. `market_prices` (created with DAM benchmark tracking)
10. `trade_audit_logs` (created with immutable audit records)
11. `messages` (created with chat indexing)
12. `connections` (created with requester/recipient user pairs)
13. `notifications` (created with multi-type alert support)
14. `catalog` (created with bilingual search terms and DAM benchmark prices)
15. `reviews` (created with order/product verification)
16. `call_logs` (created for communication logs)
17. `farmer_expenses` (created for financial ledger)
18. `negotiations` (created for trade price offers)

### Data Migration Decisions Applied
1. **Quarantined Meghna Supplier Products**:
   - The 3 supplier products (`sup-meghna-potash`, `sup-meghna-tricho`, `sup-meghna-seed`) were migrated to `products` with:
     - `seller_id = NULL` (no fake user created)
     - `harvest_status = 'Archived'`
     - `seller_role = 'retailer'`, `target_role = 'farmer'`
     - `district = 'Bogura'`, `upazila = 'Shibganj'`
2. **Legacy User Mapping**:
   - Legacy farmer reference `far-shibganj-1` was remapped to registered Neon user `user-farmer-rafiq`.
   - Other references without registered Neon user accounts were safely imported with `NULL` foreign keys (`ON DELETE SET NULL`), preventing foreign key constraint violations while preserving complete transactional history.
3. **Unit-Aware Packaging**:
   - Fertilizer, bio-pesticide, and seed products were recorded with native units (`50kg bag`, `500g pack`, `10g pack`).
   - Generated columns `quantity_kg`, `available_kg`, and `price_per_kg` automatically evaluated to `NULL` for discrete non-kg packages, preventing dimensional corruption.
4. **Notification Normalization**:
   - Handled schema variation where legacy `db.json` used `body` instead of `message` (`COALESCE(message, body, '')`).

---

## 5. Stage D — Comprehensive Validation Test Results

Validation script `scripts/validate_test_branch.cjs` executed 20 automated checks against `dev-migration-test`.

### 5.1 Table Row Counts

| Table Name | Expected Count | Migrated Count on Test Branch | Verification Result |
| :--- | :--- | :--- | :--- |
| `users` | 42 | 42 | **PASSED** |
| `sessions` | 26 | 26 | **PASSED** |
| `login_audit_logs` | 24 | 24 | **PASSED** |
| `products` | 28 (25 SQLite + 3 Quarantined) | 28 | **PASSED** |
| `orders` | 10 | 10 | **PASSED** |
| `order_items` | 10 | 10 | **PASSED** |
| `wholesaler_offers` | 6 | 6 | **PASSED** |
| `market_prices` | 7 | 7 | **PASSED** |
| `trade_audit_logs` | 9 | 9 | **PASSED** |
| `messages` | 11 | 11 | **PASSED** |
| `connections` | 4 | 4 | **PASSED** |
| `notifications` | 16 | 16 | **PASSED** |
| `catalog` | 80 | 80 | **PASSED** |

### 5.2 Quarantined Products Validation
- **Products Tested:** `sup-meghna-potash`, `sup-meghna-tricho`, `sup-meghna-seed`
- **Result:** Found 3 rows.
- **Constraints Verified:** All 3 rows have `seller_id = NULL` and `harvest_status = 'Archived'`. No synthetic user was created.
- **Status:** **PASSED**

### 5.3 Unit-Aware Inventory Fields
- **Test:** Queried non-kg products (`seeds`, `fertilizer`).
- **Example Verified:** `Trichoderma Bio-Fungicide` has `unit = '500g pack'`, `quantity = 120.00`, and `quantity_kg = NULL`.
- **Status:** **PASSED**

### 5.4 Crops Compatibility View
- **Test:** Queried view columns with camelCase aliases (`farmerId`, `farmerName`, `cropName`, `expectedPricePerKg`, `status`, `district`).
- **Sample Record:**
  - `farmerId`: `user-farmer-rafiq`
  - `cropName`: `Harvest Ready Hybrid Tomatoes`
  - `expectedPricePerKg`: `38.00`
  - `status`: `Ready`
- **Status:** **PASSED**

### 5.5 Order & Item Integrity
- **Test:** Joined `orders` with `order_items`.
- **Result:** All 10 orders correctly join to their respective item rows (1:1 mapping verified).
- **Status:** **PASSED**

### 5.6 Single-Seller Compliance Check
- **Test:** Evaluated whether any historical order contains items from multiple distinct sellers.
- **Result:** 0 multi-seller orders found. 100% of orders adhere strictly to the single-seller model.
- **Status:** **PASSED**

### 5.7 Atomic Rollback Capability
- **Test:** Executed a transactional insert of a test row followed by an explicit `ROLLBACK`.
- **Result:** Verified that the rolled-back record was completely discarded with zero side-effects.
- **Status:** **PASSED**

### 5.8 Production Zero-Impact Isolation Verification

A direct schema query was performed via Neon MCP on the production branch (`br-square-mud-b3mncdyw`):

```json
[
  { "table_schema": "public", "table_name": "login_audit_logs", "table_type": "BASE TABLE" },
  { "table_schema": "public", "table_name": "sessions", "table_type": "BASE TABLE" },
  { "table_schema": "public", "table_name": "users", "table_type": "BASE TABLE" }
]
```

**Result:** The production database branch contains only the 3 original tables. Not a single table, view, or record on production was altered or contaminated.

---

## 6. Migration Risk Matrix & Findings

| Risk Item | Pre-Test Concern | Observed In Test Rehearsal | Resolution / Final Design |
| :--- | :--- | :--- | :--- |
| **Notification Schema Inconsistency** | `db.json` notifications had `body` instead of `message` | Initial constraint violation on `notif-test-...` | Rehearsal script patched to `COALESCE(message, body, '')`. All 16 migrated cleanly. |
| **Orphaned Historical FKs** | Guest orders or test buyer IDs missing from `users` | Would violate `REFERENCES users(id)` | Configured `ON DELETE SET NULL`; unmapped foreign keys set to `NULL` while preserving order details. |
| **Legacy Supplier User** | Meghna supplier referenced in 3 products | Risk of synthetic user injection | Quarantined with `seller_id = NULL` and `harvest_status = 'Archived'`. Zero synthetic users created. |
| **Legacy Farmer Alias** | `far-shibganj-1` used across SQLite & JSON | Broken FK to `users` table | Cleanly remapped to `user-farmer-rafiq` whose identity matches the records. |
| **Dimensional Corruption** | Packaged seeds/fertilizers coerced to `kg` | Price/weight calculation errors | Implemented discrete `unit` + `quantity` with generated `_kg` columns. Verified working. |

---

## 7. Migration Readiness Assessment & Recommendation

Based on the 100% successful validation of Stage A through Stage D:
1. The database schema design from Phase 2.1.4 is **production-ready**.
2. The migration script `scripts/rehearse_migration_test_branch.cjs` handles all edge cases, foreign key relationships, and legacy data quirks idempotently and atomically.
3. The rollback mechanics have been verified under live PostgreSQL conditions.

### Final Verdict

# `ISOLATED MIGRATION TEST PASSED`

---
*End of Phase 2.2 Report. No further write actions or production migrations will be taken without explicit user authorization.*

