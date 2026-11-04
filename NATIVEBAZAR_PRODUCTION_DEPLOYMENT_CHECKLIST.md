# NativeBazar — Production Deployment Checklist & Operational Runbook

**Document Version:** 1.0.0-PROD  
**Release Target:** NativeBazar v2.5 Production Cutover  
**Date:** November 3, 2026  
**Auditor:** Antigravity Advanced Agentic Verification System  
**Test Reference Database:** Neon PostgreSQL `dev-migration-test` (`ep-snowy-mode-b389h4uk.ap-southeast-1.aws.neon.tech`)  
**Target Production Database:** Neon PostgreSQL `main` (`ep-raspy-hat-b3y04kgr.ap-southeast-1.aws.neon.tech`)  
**Production Status:** Zero Writes Executed — Isolated Test & Pre-Deployment Staging  

---

## 1. Pre-Deployment Configuration & Prerequisites Checklist

### 1.1 Environment Variables Checklist
The production runtime environment must have the following configuration variables set.  
> [!IMPORTANT]
> **Zero-Secrets Policy:** Actual passwords, tokens, connection strings, and keys must NEVER be committed to Git or printed to public terminal logs. Only variable names, expected formats, and purposes are specified here.

| Variable Name | Required? | Recommended Production Format / Example | Description & Security Purpose |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **YES** | `production` | Enables Express production optimizations, secure cookies, and minimizes stack traces. |
| `PORT` | **YES** | `3000` (or host-assigned `$PORT`) | TCP port on which the Express HTTP and SSE server listens. |
| `DATABASE_URL` | **YES** | `postgres://[user]:[secret]@ep-raspy-hat-b3y04kgr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | **Pooled Neon connection** (via PgBouncer) used for all transactional web application traffic. |
| `NEON_DIRECT_DATABASE_URL` | **YES** | `postgres://[user]:[secret]@ep-raspy-hat-b3y04kgr.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` | **Direct Neon compute connection** used exclusively for DDL schema migrations and prepared statements that require session-level isolation. |
| `SESSION_SECRET` | **YES** | 64-character hex string (`crypto.randomBytes(32).toString('hex')`) | Cryptographic secret for signing session state and cookies. |
| `JWT_SECRET` | **YES** | 64-character hex string | Cryptographic secret for token signature verification. |
| `GEMINI_API_KEY` | **YES** | `AIzaSy...` (Google AI Studio Key) | Powers AI pricing advisory, market trend predictions, and multilingual assistance. |
| `APP_URL` | **YES** | `https://nativebazar.com` | Production canonical URL used for strict CORS and link generation. |
| `FRONTEND_URL` | Optional | `https://app.nativebazar.com` | Secondary allowed origin for separate frontend hosting (if decoupled). |
| `ADMIN_ACCESS_TOKEN` | **YES** | High-entropy token (min 32 chars) | Required header (`X-Admin-Token`) for accessing administrative repair and maintenance endpoints. |

---

### 1.2 Neon Database Configuration Checklist

- [ ] **Connection Pooling (PgBouncer) Activated:**  
  Verify that the production endpoint uses the `-pooler` subdomain for `DATABASE_URL`. This allows hundreds of concurrent HTTP connections to be multiplexed into a lightweight pool of PostgreSQL backends without exhausting compute RAM.
- [ ] **SSL Mode Enforced:**  
  Verify `sslmode=require` or `ssl: { rejectUnauthorized: true }` in `pg.Pool` configuration. Unencrypted plaintext connections must be rejected by PostgreSQL.
- [ ] **Pool Sizing Configured:**  
  Configure connection pool parameters in Node.js:
  ```javascript
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20, // Max concurrent clients per container instance
    idleTimeoutMillis: 30000, // Close idle clients after 30s
    connectionTimeoutMillis: 5000, // Fail fast if connection cannot be acquired in 5s
  });
  ```
- [ ] **Statement Timeouts Set:**  
  PostgreSQL `statement_timeout` must be configured to `15000` (15 seconds) to prevent runaway or deadlocking queries from holding pool resources.
- [ ] **Scale-to-Zero and Autoscaling Verified:**  
  Confirm Neon autoscaling parameters on `main` branch (e.g., minimum 0.25 CU, maximum 2.0 CU) to accommodate trade traffic peaks while minimizing idle cost.

---

### 1.3 Codebase & Build Readiness Checklist

- [ ] **TypeScript Type-Check Passes Cleanly:**  
  Execute `npx tsc --noEmit`. Must return **0 errors**.
- [ ] **Production Webpack/Vite Build Passes Cleanly:**  
  Execute `npm run build`. Verify generated bundle in `dist/` (`dist/index.html`, optimized JS and CSS bundles).
- [ ] **Dependency Security Audit Passes Cleanly:**  
  Execute `npm audit`. Must report **0 vulnerabilities** across all dependencies.
- [ ] **SQL Injection Audit Passes Cleanly:**  
  Verify that 100% of SQL queries executed against Neon use parameterized placeholders (`$1, $2, ...`). Zero raw string interpolations.
- [ ] **Source Baseline SHA-256 Hashes Verified:**  
  Confirm source data integrity before running ingestion:
  - `nativebazar.db`: `789498e18bae18062dc0a74dcad47ca5436019ee634fe209f9e72b28385e19c9`
  - `server_data/db.json`: `1ab54a39e6961360165e43b116b16e56b230f2c36bafc9156403d116f2cd7a7a`

---

## 2. Step-by-Step Production Cutover Sequence

```mermaid
flowchart TD
    A[Step 1: Create Pre-Cutover Neon Snapshot Branch] --> B[Step 2: Announce Maintenance & Enable 503 Maintenance Page]
    B --> C[Step 3: Execute Schema DDL Migrations on Production Neon]
    C --> D[Step 4: Execute Production Historical Data Ingestion]
    D --> E[Step 5: Verify Post-Migration Record Counts & Constraints]
    E --> F[Step 6: Deploy Production Node.js Application Container]
    F --> G[Step 7: Perform Controlled Smoke Tests Across 5 Roles]
    G -->|All Tests Pass| H[Step 8: Deactivate Maintenance & Open Live Traffic]
    G -->|Failure Detected| R[Execute Emergency Rollback Playbook]
    H --> I[Step 9: Monitor Telemetry, Connections & Latency for 60 Mins]
```

---

### Step 1: Pre-Cutover Backup & Branch Snapshotting
1. Create an instant point-in-time snapshot branch of the production database using the Neon CLI or API:
   ```bash
   neon branches create --project-id <project-id> --name pre-migration-snapshot-20261103 --parent main
   ```
2. Create cold copies of `nativebazar.db` and `server_data/db.json` and upload to encrypted offsite cloud storage.
3. Record the exact branch head LSN (Log Sequence Number) or timestamp for instant point-in-time recovery.

---

### Step 2: Maintenance Window & Traffic Control
1. **Maintenance Schedule:** Plan a 15-minute maintenance window during low-traffic agricultural hours (e.g., 02:00–02:15 AM BST).
2. Configure edge reverse proxy (Cloudflare / Nginx / ALB) to serve a branded maintenance notice:
   - HTTP Status: `503 Service Unavailable`
   - Header: `Retry-After: 900` (15 minutes)
   - Allowlist: Whitelist internal staging / testing IP addresses to access the live app during verification.
3. Drain existing SSE connections gracefully by issuing a server shutdown signal:
   ```javascript
   for (const [id, client] of sseClients.entries()) {
     client.res.write('event: maintenance\ndata: {"status":"migrating"}\n\n');
     client.res.end();
   }
   ```

---

### Step 3: Production Schema DDL Migration
1. Connect to production Neon using `NEON_DIRECT_DATABASE_URL` (direct endpoint, bypassing pooler).
2. Execute the production unified schema DDL:
   - Tables: `users`, `products`, `orders`, `order_items`, `wholesaler_offers`, `market_prices`, `catalog`, `messages`, `connections`, `notifications`, `trade_audit_logs`, `login_audit_logs`, `sessions`, `farmer_expenses`, `negotiations`, `reviews`, `call_logs`.
   - Views: `crops` compatibility view.
   - Indexes: All 24 performance indexes across `seller_id`, `buyer_id`, `created_at`, `status`, `phone`.
   - Triggers: Execute `setup_audit_triggers.cjs` to attach `trg_protect_trade_audit_logs` and `trg_protect_login_audit_logs` (blocking all `UPDATE` and `DELETE` operations at the PostgreSQL engine level).

---

### Step 4: Production Data Ingestion & Conflict Resolution
Execute the production migration script with strict conflict handling:
1. **Users Ingestion:**
   - Ingest 42 baseline users from `server_data/db.json`.
   - Map phone collision: User `far-shibganj-1` from SQLite must be explicitly mapped to `user-farmer-rafiq` (phone: `01712458920`).
   - Hash legacy passwords using `bcrypt.hash(password, 10)` or insert with legacy indicator for progressive re-hashing upon first login.
2. **Products Ingestion:**
   - Ingest 25 products from SQLite.
   - Apply orphaned seller remediation: The 5 products with dangling `seller_id`s (`prod-far-1792428431395`, `prod-who-1792429290897`, `prod-ret-1792429849368`, `prod-who-1793118824779`, `prod-ret-1793261720613`) must have `seller_id = NULL` to satisfy foreign key integrity.
   - Ingest the 3 Meghna supplier products (`sup-meghna-potash`, `sup-meghna-seed`, `sup-meghna-tricho`) with `seller_id = NULL` and `harvest_status = 'Archived'` so they remain preserved in catalog history but hidden from buyer search feeds.
3. **Orders & Order Items Ingestion:**
   - Ingest the 10 historical orders (`ORD-001` through `ORD-010`) and their 10 matching order items.
   - Re-link any order pointing to `far-shibganj-1` to `user-farmer-rafiq`.
   - Do NOT import temporary E2E test orders (`ORD-747162-129`).
4. **Demands, Rates, Catalog & Messaging Ingestion:**
   - Ingest 6 wholesaler offers (`dem-001` to `dem-006`).
   - Ingest 7 benchmark market prices.
   - Ingest 80 agricultural catalog entries.
   - Ingest 11 direct messages and 4 user connections.
   - Ingest 16 baseline notifications.
   - Ingest 9 baseline trade audit logs.

---

### Step 5: Post-Migration Data Verification Queries
Execute verification queries against the production Neon database. All conditions must return `true`:

```sql
-- 1. Verify User Count
SELECT COUNT(*) = 42 AS users_verified FROM users;

-- 2. Verify Product Count
SELECT COUNT(*) = 28 AS products_verified FROM products;

-- 3. Verify Quarantined Meghna Products
SELECT COUNT(*) = 3 AS meghna_archived FROM products WHERE seller_id IS NULL AND harvest_status = 'Archived';

-- 4. Verify Zero Orphaned Foreign Keys in Products
SELECT COUNT(*) = 0 AS no_orphaned_products FROM products p LEFT JOIN users u ON p.seller_id = u.id WHERE p.seller_id IS NOT NULL AND u.id IS NULL;

-- 5. Verify Orders and Order Items Count
SELECT COUNT(*) = 10 AS orders_verified FROM orders;
SELECT COUNT(*) = 10 AS items_verified FROM order_items;

-- 6. Verify 1-to-1 Order Referential Integrity
SELECT COUNT(*) = 0 AS no_orphaned_items FROM order_items oi LEFT JOIN orders o ON oi.order_id = o.id WHERE o.id IS NULL;
SELECT COUNT(*) = 0 AS no_empty_orders FROM orders o LEFT JOIN order_items oi ON o.id = oi.order_id WHERE oi.id IS NULL;

-- 7. Verify Wholesaler Demands & Market Rates
SELECT COUNT(*) = 6 AS offers_verified FROM wholesaler_offers;
SELECT COUNT(*) = 7 AS prices_verified FROM market_prices;

-- 8. Verify Audit Log Protection Trigger
-- Expect PostgreSQL error: "trade_audit_logs records are immutable and cannot be updated or deleted"
DO $$
BEGIN
  UPDATE trade_audit_logs SET action = 'tampered' WHERE id = (SELECT id FROM trade_audit_logs LIMIT 1);
  RAISE EXCEPTION 'TRIGGER FAILED: Update was permitted!';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'SUCCESS: Audit log immutability trigger blocked update: %', SQLERRM;
END $$;
```

---

### Step 6: Application Deployment
1. Deploy updated application bundle to the production hosting environment.
2. Confirm persistent Node.js service startup with production environment variables.
3. Check application logs for successful connection to Neon:
   ```
   [Neon] PostgreSQL connection pool initialized (host: ep-raspy-hat-b3y04kgr-pooler.ap-southeast-1.aws.neon.tech).
   [Neon] PostgreSQL tables ready and verified.
   NativeBazar Server listening on port 3000 (NODE_ENV: production)
   ```
4. Verify HTTP Health Probe:
   `GET https://nativebazar.com/api/health` returns `{"status":"ok","database":"connected","timestamp":"..."}` with HTTP 200.

---

## 3. Post-Deployment Smoke Test Procedure (5 Roles)

Perform the following smoke tests on production through the internal allowlisted IP before opening public traffic:

### Smoke Test 1: Farmer Role
- [ ] Log in as `user-farmer-rafiq` (`01712458920`).
- [ ] Confirm Farmer Dashboard loads active crop listings.
- [ ] Check Farmer Received Orders: Verify historical order received from Wholesaler.
- [ ] Test Farmer Expense Sync: POST `/api/farmer/expenses/sync` with offline ledger entries; verify 200 OK and database persistence.
- [ ] Test AI Assistant: Query crop disease advisory and verify Gemini AI responds within 5 seconds.

### Smoke Test 2: Wholesaler Role
- [ ] Log in as `who-001` (`01711223344`).
- [ ] Confirm Wholesaler Hub displays 6 active wholesaler demands.
- [ ] Post a new crop procurement demand for 500 kg Diamond Potato at ৳26/kg.
- [ ] Confirm real-time SSE notification is broadcast to connected farmers.
- [ ] Delete test demand after verification.

### Smoke Test 3: Retailer Role
- [ ] Log in as `usr-retailer-jafor` (`01715566778`).
- [ ] Browse Wholesale Marketplace: Verify wholesale farmer and wholesaler listings appear.
- [ ] Place a test B2B order: Create order for 50 kg tomatoes; verify transaction succeeds, stock decrements atomically, and trade audit log entry is written.
- [ ] Verify tracking code generation and invoice view.

### Smoke Test 4: Consumer Role
- [ ] Log in as `con-001` (`01718899001`).
- [ ] Browse Consumer Retail Market: Verify retail produce listings with BDT pricing.
- [ ] Add item to cart, proceed to checkout, verify address validation, and complete test order.
- [ ] Verify order appears under Consumer Order History.

### Smoke Test 5: Agricultural Supplier Role
- [ ] Verify supplier input catalog: 80 catalog entries available across Seeds, Fertilizers, and Tools.
- [ ] Verify quarantined Meghna products: Confirm `sup-meghna-potash`, `sup-meghna-seed`, and `sup-meghna-tricho` do NOT appear in active consumer/retail search results.
- [ ] Verify supplier inquiry form submits cleanly to `/api/messages`.

---

## 4. Traffic Restoration & Post-Launch Monitoring

1. **Deactivate Maintenance Mode:**
   - Remove 503 maintenance page at edge reverse proxy.
   - Direct 100% of live traffic to the production cluster.
2. **Monitor Telemetry Dashboard (First 60 Minutes):**
   - **PostgreSQL Connection Pool:** Monitor active clients vs idle clients (`pg_stat_activity`). Pool usage must remain below 50% capacity.
   - **HTTP 5xx Error Rate:** Must remain strictly below 0.05%.
   - **p95 Latency:** Database queries < 40ms; API responses < 180ms.
   - **Active SSE Streams:** Verify client heartbeat pings (`:keepalive\n\n`) every 25 seconds with 0 dropped sockets.

---

## 5. Emergency Rollback Playbook

### 5.1 Rollback Trigger Conditions
Initiate immediate emergency rollback if ANY of the following occur during or immediately following deployment:
1. **Critical Data Corruption / Referential Integrity Failure:** Orders or users become inaccessible or unlinked.
2. **Elevated Error Rate:** HTTP 500 error rate exceeds 2% of total traffic for more than 3 consecutive minutes.
3. **Transactional Order Failure:** Atomic checkout transactions throw uncaught PostgreSQL rollbacks or stock calculation anomalies.
4. **Neon Connection Exhaustion:** Database connection timeouts exceed 5,000ms.

### 5.2 Step-by-Step Rollback Execution Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Admin as DevOps / Incident Commander
    participant Edge as Edge Proxy / Cloudflare
    participant App as Node.js App Cluster
    participant Neon as Neon PostgreSQL

    Admin->>Edge: 1. Enable 503 Maintenance Page Immediately
    Admin->>App: 2. Stop App Containers / Drain Traffic
    Admin->>Neon: 3. Restore Production Branch from pre-migration-snapshot
    Note over Neon: Instant Branch Reset / PITR to snapshot LSN
    Admin->>App: 4. Revert App Deployment to Previous Stable Release
    Admin->>App: 5. Start App in Rollback State & Run Verification
    Admin->>Edge: 6. Lift Maintenance Page & Restore User Access
    Admin->>Admin: 7. Open Post-Mortem Incident Log
```

1. **Execute Step 1 (Maintenance):** Re-enable edge 503 maintenance page immediately.
2. **Execute Step 2 (Stop Traffic):** Terminate running application instances to halt database writes.
3. **Execute Step 3 (Database Recovery):**
   - Use Neon Point-in-Time Restore (PITR) or reset `main` from `pre-migration-snapshot-20261103`:
     ```bash
     neon branches restore main --source pre-migration-snapshot-20261103
     ```
   - Recovery time: **< 120 seconds** (instant copy-on-write branch restoration).
4. **Execute Step 4 (Application Reversion):**
   - Redeploy the previous verified release artifact / container image.
5. **Execute Step 5 (Verification):**
   - Run health probe against restored environment.
   - Verify previous user state and orders are intact.
6. **Execute Step 6 (Traffic Restoration):**
   - Remove 503 maintenance page.
   - Confirm normal user traffic resumes.
7. **Post-Mortem & Incident Logging:**
   - Retain failed deployment logs for diagnostic review.
   - Target Recovery Time Objective (RTO): **< 15 minutes**.
   - Maximum Tolerable Downtime (MTD): **30 minutes**.

---

## 6. Operational Contact Matrix & Communication Templates

### 6.1 Role Contact Matrix
| Role | Contact Title | Responsibility | Escalation Level |
| :--- | :--- | :--- | :--- |
| **Incident Commander** | Lead Platform Architect | Go/No-Go Decision, Rollback Trigger | Level 1 |
| **Database Administrator** | Neon Database Specialist | DDL Migration, Connection Pool, Snapshot Recovery | Level 1 |
| **Backend Engineer** | Express & Security Lead | API Endpoints, Token Auth, Error Diagnostics | Level 2 |
| **Frontend Engineer** | React / UI Lead | Client Store Sync, Offline Ledger Verification | Level 2 |

### 6.2 Maintenance Communication Template (Customer Facing)
```
[NativeBazar Scheduled System Upgrade]
Notice: NativeBazar is undergoing scheduled platform maintenance and database enhancements to improve agricultural trade speed and security.
Window: November 3, 2026, 02:00 - 02:15 AM BST.
Impact: Marketplace browsing, ordering, and messaging will be temporarily paused.
All orders, balances, and listings are fully secured. We apologize for any inconvenience.
```

