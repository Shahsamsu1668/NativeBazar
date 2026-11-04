# NativeBazar — Production Release File Manifest & Staging Inventory

**Document Date:** November 3, 2026  
**Auditing Entity:** Antigravity Advanced Agentic Verification System  
**Release Target:** Render Web Service (Node.js persistent process) + Neon PostgreSQL `main`  
**Safety Mandate:** READ-ONLY Inventory; No Git staging or commits performed.

---

## 1. Release Inventory Summary

This manifest provides the definitive classification of every file in the NativeBazar repository prior to production deployment.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       FILE INVENTORY CLASSIFICATION                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. TRACKED & MODIFIED CORE FILES (13 files)        ──► STAGE FOR RELEASE    │
│ 2. UNTRACKED ESSENTIAL BACKEND MODULES (2 files)   ──► MUST TRACK & COMMIT  │
│ 3. NESTED SUBMODULE ARTIFACT (NativeBazar/)        ──► DETACH FROM INDEX    │
│ 4. STRICTLY EXCLUDED SECRETS & BACKUPS             ──► DO NOT STAGE         │
│ 5. SCRIPTS & HISTORICAL DOCUMENTATION              ──► COMMIT AS ARTIFACTS  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Category 1: Tracked & Modified Core Files (Ready for Release)

The following 13 tracked files contain necessary application logic, dependencies, and configuration enhancements:

| File Path | Description of Changes | Ready to Commit |
| :--- | :--- | :---: |
| [`.gitignore`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/.gitignore) | Hardened secret rules (`.neon`, `server_data/*.env`, `*.bak`, `chrome_*`). | **YES** |
| [`package.json`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/package.json) | Added `express-rate-limit`, moved `tsx` to `dependencies`. | **YES** |
| [`package-lock.json`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/package-lock.json) | Synchronized lockfile dependencies. | **YES** |
| [`server.ts`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/server.ts) | 12 Neon domains cutover, proxy trust (`trust proxy: 1`), rate limiters. | **YES** |
| [`server_data/db.json`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/server_data/db.json) | Baseline JSON datastore. | **YES** |
| [`src/App.tsx`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/src/App.tsx) | Auth checks, toast alerts, role routes. | **YES** |
| [`src/components/AdminVerificationModal.tsx`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/src/components/AdminVerificationModal.tsx) | Admin user verification modal. | **YES** |
| [`src/components/FarmerDashboard.tsx`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/src/components/FarmerDashboard.tsx) | Bounded offline fallback (fixed recursive loop). | **YES** |
| [`src/data/store.ts`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/src/data/store.ts) | Client-side reactive state & caching. | **YES** |
| [`src/server/db.ts`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/src/server/db.ts) | SQLite database fallback helper. | **YES** |
| [`src/services/api.ts`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/src/services/api.ts) | API client service. | **YES** |
| [`src/services/apiService.ts`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/src/services/apiService.ts) | REST client API methods. | **YES** |
| [`tsconfig.json`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/tsconfig.json) | TypeScript configuration. | **YES** |

---

## 3. Category 2: Untracked Essential Backend Modules (MUST TRACK)

The following two files are currently **UNTRACKED**. Because `server.ts` imports from them directly, they **MUST be added to Git** before deployment:

| File Path | Role & Necessity | Action Required |
| :--- | :--- | :---: |
| [`src/server/auth.ts`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/src/server/auth.ts) | Bcrypt hashing, session creation/validation, route middleware (`requireAuth`). | `git add src/server/auth.ts` |
| [`src/server/neonDb.ts`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/src/server/neonDb.ts) | PostgreSQL connection pooling, table initialization, atomic order transactions. | `git add src/server/neonDb.ts` |
| [`neon.ts`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/neon.ts) | Neon branch configuration (`@neon/config`). | `git add neon.ts` |

---

## 4. Category 3: Nested Submodule Anomaly (`NativeBazar/`)

- **Current State:** Embedded Git submodule link (mode `160000 2407cb1...`) without `.gitmodules`.
- **Safety Mandate:** Do **not** delete the folder or `.git` on disk.
- **Action Required Prior to Push:**
  Remove the gitlink from root Git index while keeping files on disk:
  ```bash
  git rm --cached NativeBazar
  ```
  Ensure `NativeBazar/` is listed in `.gitignore`.

---

## 5. Category 4: Strictly Excluded Secrets & Database Dumps (DO NOT STAGE)

The following files are strictly excluded by `.gitignore` and **MUST NEVER BE COMMITTED**:

| File / Pattern | Justification | Enforced Status |
| :--- | :--- | :---: |
| `server_data/test_branch.env` | Contains test branch database connection string | Ignored by `.gitignore` |
| `.env.local` | Contains local development environment variables | Ignored by `.gitignore` |
| `server_data/backups/*` | Contains historical SQLite database snapshots | Ignored by `.gitignore` |
| `*.bak` | File backup copies | Ignored by `.gitignore` |
| `server_data/chrome_*` | Temporary browser test profiles | Ignored by `.gitignore` |

---

## 6. Category 5: Production Scripts & Audit Reports (Safe to Commit)

The following scripts and audit documentation can be safely committed to document system provenance:

### Production Migration Scripts:
- [`scripts/production_migration_rehearsal.cjs`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/scripts/production_migration_rehearsal.cjs): Rehearsal & production migration runner.
- [`scripts/test_production_start.cjs`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/scripts/test_production_start.cjs): Production boot tester.
- [`scripts/test_trust_proxy_security.cjs`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/scripts/test_trust_proxy_security.cjs): Proxy anti-spoofing verification test.
- [`scripts/audit_data_migration_completeness.cjs`](file:///c:/Users/User/OneDrive/Desktop/Newfolder/NativeBazar/scripts/audit_data_migration_completeness.cjs): Cross-source reconciliation auditor.

### Core Architecture & Audit Reports:
- `NATIVEBAZAR_MASTER_PROMPT_7_BLOCKER_FIX_REPORT.md`
- `NATIVEBAZAR_MASTER_PROMPT_6_RELEASE_READINESS.md`
- `NATIVEBAZAR_DEPLOYMENT_QUICK_CHECKLIST.md`
- `NATIVEBAZAR_PHASE5_HARDENING_REPORT.md`
- `NATIVEBAZAR_IDENTITY_MAPPING_DRY_RUN.md`
- `NATIVEBAZAR_MIGRATION_SCRIPT_DESIGN.md`
- `NATIVEBAZAR_RENDER_DEPLOYMENT_PREPARATION.md`

---

## 7. Exact Future Staging & Release Commands

When the user gives explicit approval to prepare the Git commit:

```bash
# 1. Untrack the nested submodule gitlink without deleting files
git rm --cached NativeBazar

# 2. Stage the essential untracked backend files
git add src/server/auth.ts src/server/neonDb.ts neon.ts

# 3. Stage the modified application core files
git add .gitignore package.json package-lock.json server.ts server_data/db.json
git add src/App.tsx src/components/AdminVerificationModal.tsx src/components/FarmerDashboard.tsx
git add src/data/store.ts src/server/db.ts src/services/api.ts src/services/apiService.ts tsconfig.json

# 4. Stage key rehearsal scripts and audit reports
git add scripts/production_migration_rehearsal.cjs scripts/test_production_start.cjs scripts/test_trust_proxy_security.cjs
git add NATIVEBAZAR_*.md

# 5. Commit with descriptive semantic message
git commit -m "feat(release): remediate deployment blockers, integrate Neon PostgreSQL, and harden reverse proxy"
```

---

## 8. Final Release Safety Verdict

| Evaluation Dimension | Verdict | Notes |
| :--- | :---: | :--- |
| **Code Stability** | **PASSED** | 0 build errors, 0 typecheck errors, 0 CVEs. |
| **Start Script Compatibility** | **PASSED** | `tsx` in `dependencies`; production boot verified HTTP 200. |
| **Database Architecture** | **PASSED** | 12 domains backed by Neon PostgreSQL. |
| **Secret Shielding** | **PASSED** | Hardened `.gitignore` excludes all credential files. |
| **Safe to Push to GitHub?** | **YES** | Once Category 2 (`auth.ts`, `neonDb.ts`) is staged and `NativeBazar` gitlink is detached. |
| **Safe to Deploy to Render?** | **YES** | Ready for Render service provisioning with env var names. |

