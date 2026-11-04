# NativeBazar — Production Deployment Quick Checklist & Release Gate

**Document Date:** November 3, 2026  
**Auditing Entity:** Antigravity Advanced Agentic Verification System  
**Release Target:** Render Web Service + Neon PostgreSQL `main` (AWS `ap-southeast-1`)  
**Safety Status:** READ-ONLY Verification Complete; Awaiting Stakeholder Execution Approval

---

## 1. Release Gate Classification Overview

Every item in this checklist is categorized into one of three strict operational gates:
- **Category A: MUST FIX BEFORE FIRST DEPLOYMENT** (P0 Blockers — deployment will fail or break without these).
- **Category B: MUST VERIFY AFTER DEPLOYMENT** (P1 Validation Items — post-deploy operational sanity checks).
- **Category C: CAN SAFELY BE COMPLETED AFTER INITIAL DEPLOYMENT** (P2 Enhancements — non-blocking optimizations).

---

## 2. Category A: MUST FIX BEFORE FIRST DEPLOYMENT

> [!CRITICAL]
> **All Category A items are P0/P1 blockers.** Do not trigger production deployment or push code to GitHub until these items are addressed.

### [ ] Item A-1: Track Core Backend Modules in Git (Severity: P0)
- **Evidence Inspected:** `git status --porcelain src/server/` reveals untracked files:
  - `?? src/server/auth.ts`
  - `?? src/server/neonDb.ts`
- **Verification Level:** *Directly verified*
- **Severity:** **P0**
- **Impact if Unfixed:** Render performs a clean `git clone`. Because these files are untracked, they will not exist in the clone, causing `server.ts` to fail at startup with `Cannot find module './src/server/neonDb.js'`.
- **Exact Recommended Action:**
  Stage and commit both files:
  ```bash
  git add src/server/auth.ts src/server/neonDb.ts
  ```

---

### [ ] Item A-2: Resolve Production Start Dependency on `tsx` (Severity: P0)
- **Evidence Inspected:** `package.json` line 9 specifies `"start": "tsx server.ts"`, but line 46 classifies `"tsx"` under `"devDependencies"`.
- **Verification Level:** *Directly verified*
- **Severity:** **P0**
- **Impact if Unfixed:** Render runs `npm install` with `NODE_ENV=production`, pruning all devDependencies. When `npm start` runs, it crashes with `command not found: tsx`.
- **Exact Recommended Action:**
  In Render service settings, set Build Command to:
  ```bash
  npm install --include=dev && npm run build
  ```
  *(Or move `"tsx"` into `"dependencies"` in `package.json`)*.

---

### [ ] Item A-3: Detach Submodule Artifact in `NativeBazar/` (Severity: P1)
- **Evidence Inspected:** `git status` lists `modified: NativeBazar (modified content, untracked content)`, and `git submodule status` returns `fatal: no submodule mapping found in .gitmodules`.
- **Verification Level:** *Directly verified*
- **Severity:** **P1**
- **Impact if Unfixed:** May trigger git submodule warnings or fail automated repository sync in CI/CD pipelines.
- **Exact Recommended Action:**
  Delete the nested `.git` directory inside `NativeBazar/` before pushing so Git treats the directory cleanly.

---

### [ ] Item A-4: Configure Render Environment Variables (Severity: P0)
- **Evidence Inspected:** `server.ts` and `src/server/neonDb.ts` read `process.env`.
- **Verification Level:** *Directly verified*
- **Severity:** **P0**
- **Impact if Unfixed:** Missing `DATABASE_URL` prevents database connection; missing `JWT_SECRET` breaks token signing.
- **Exact Recommended Action:**
  In the Render Dashboard Environment tab, add these keys:
  - `NODE_ENV` = `production`
  - `DATABASE_URL` = *(Neon production pooled connection string)*
  - `JWT_SECRET` = *(Cryptographic 256-bit token)*
  - `TRUST_PROXY` = `true`
  - `GEMINI_API_KEY` = *(Gemini API key)*

---

## 3. Separation of Concerns: Code Deployment vs. Data Migration

> [!IMPORTANT]
> **Strict Operational Rule:**  
> Code deployment and data migration are two separate stages. Never execute them simultaneously.

```
       STAGE 1: CODE DEPLOYMENT                    STAGE 2: DATA MIGRATION
 ┌───────────────────────────────────┐       ┌───────────────────────────────────┐
 │ 1. Push code to repository        │       │ 1. Schema verified active on Neon │
 │ 2. Render builds frontend assets  │ ────► │ 2. Run rehearsal migration with   │
 │ 3. Express starts and initializes │       │    ALLOW_PRODUCTION_MIGRATION auth│
 │    empty tables via initNeonDB()  │       │ 3. Ingests 44 users & 28 products │
 │ 4. Verify /api/health returns 200 │       │ 4. Verifies assertions & commits  │
 └───────────────────────────────────┘       └───────────────────────────────────┘
```

---

## 4. Category B: MUST VERIFY AFTER DEPLOYMENT

> [!NOTE]
> These verification checks must be performed immediately after Render reports service status **Live**.

### [ ] Item B-1: Health Endpoint Check (Severity: P1)
- **Action:** Visit `https://<render-service-url>/api/health` in browser or curl.
- **Expected Result:** HTTP 200 with `{ "status": "ok", "uptime": ... }`.
- **Verification Level:** *Directly tested locally*

### [ ] Item B-2: Reverse Proxy Header Resolution (Severity: P1)
- **Action:** Inspect Render logs during a test request.
- **Expected Result:** Verify `req.ip` reflects the external client IP, confirming `app.set('trust proxy', 1)` is operating correctly without IP spoofing vulnerabilities.
- **Verification Level:** *Runtime tested in simulation*

### [ ] Item B-3: Historical Farmer Login Verification (Severity: P0)
- **Action:** Log in with canonical farmer account (`01712458920`).
- **Expected Result:**
  - Login succeeds.
  - HTTP-only cookie `nb_session` is received (`secure: true; SameSite: lax`).
  - Farmer profile displays Md. Rafiqul Islam with 3.5 acres landholding.
- **Verification Level:** *Runtime tested in dry-run*

### [ ] Item B-4: Marketplace Supply Chain Visibility (Severity: P1)
- **Action:** Log in as Consumer, Retailer, and Wholesaler sequentially.
- **Expected Result:**
  - Consumer sees Retailer products.
  - Retailer sees Wholesaler products.
  - Wholesaler sees Farmer products.
  - Quarantined Meghna products and archived products are hidden.
- **Verification Level:** *Runtime tested in Phase 3.1*

### [ ] Item B-5: Atomic Order Placement & Stock Deduction (Severity: P0)
- **Action:** Place a single test order and verify stock decrease.
- **Expected Result:**
  - Order executes inside a PostgreSQL transaction (`SELECT ... FOR UPDATE`).
  - Stock decrements immediately.
  - Row created in `trade_audit_logs`.
- **Verification Level:** *Runtime tested in Phase 2.4 & Master Prompt 2*

### [ ] Item B-6: Server-Sent Events (SSE) Stream Longevity (Severity: P1)
- **Action:** Connect to `/api/events` and maintain connection for > 60 seconds.
- **Expected Result:**
  - Connection stays active without closing.
  - Keep-alive heartbeat comments (`:keep-alive\n\n`) arrive every 25 seconds.
- **Verification Level:** *Runtime tested in Master Prompt 2*

---

## 5. Category C: CAN SAFELY BE COMPLETED AFTER INITIAL DEPLOYMENT

> [!TIP]
> The following items do not block the launch and can be completed incrementally in post-launch maintenance sprints.

### [ ] Item C-1: Multi-Container Distributed Pub/Sub (Severity: P2)
- **Context:** Single Render instance handles SSE connections via in-memory broadcast.
- **Future Action:** When scaling to multiple Render instances, integrate PostgreSQL `LISTEN`/`NOTIFY` or Redis pub/sub.
- **Verification Level:** *Inferred*

### [ ] Item C-2: Frontend Chunk Code-Splitting (Severity: P2)
- **Context:** Vite reports `dist/assets/index-DTGU0SOs.js` is 1,033 kB.
- **Future Action:** Implement React dynamic `import()` for rarely used admin sub-pages.
- **Verification Level:** *Directly verified*

### [ ] Item C-3: Deprecate Legacy JSON Routes (Severity: P2)
- **Context:** `/api/supplier-products` and `/api/admin/db/*` retain legacy JSON fallback handlers.
- **Future Action:** Fully deprecate after all legacy mock data is retired.
- **Verification Level:** *Directly verified*

---

## 6. Execution Timeline & Shortest Safe Route

```
00:00 ── Stage A-1 & A-2 fixes (Move tsx, stage auth.ts & neonDb.ts)
00:10 ── Push branch to GitHub
00:15 ── Configure Render Web Service (Singapore, Node 22, Env vars)
00:30 ── Render initial build & boot (/api/health HTTP 200)
00:35 ── Run authorized migration rehearsal script into Neon production
00:40 ── Execute Category B post-deployment verifications (B-1 through B-6)
00:45 ── SYSTEM FULLY LIVE & VERIFIED IN PRODUCTION
```

**Total Required Execution Window: 45 Minutes.**

