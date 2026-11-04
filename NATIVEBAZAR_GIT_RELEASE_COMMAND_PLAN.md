# NativeBazar — Git Release Command Plan & Submodule Detachment Guide

**Document Date:** November 3, 2026  
**Auditing Entity:** Antigravity Advanced Agentic Verification System  
**Target Release:** Production Deployment on Render + Neon PostgreSQL `main`  
**Safety Mandate:** Non-executing plan; NO git commands, staging, commits, or pushes performed.

---

## 1. Overview & Objectives

This command plan provides the exact, non-destructive sequence of Git commands to prepare the NativeBazar repository for its first production push to GitHub and automated build on Render.

### Core Objectives:
1. Safely detach the unmapped nested gitlink (`NativeBazar`, mode `160000`) without deleting or altering files or history on disk.
2. Track essential untracked backend files (`src/server/auth.ts`, `src/server/neonDb.ts`, `neon.ts`) required by `server.ts`.
3. Stage application modifications (`package.json`, `package-lock.json`, `server.ts`, etc.).
4. Shield all secrets, credentials, test files, and database dumps via `.gitignore`.
5. Maintain 100% preservation of all historical SQLite, JSON, and source data.

---

## 2. Forensic Analysis of Nested Gitlink (`NativeBazar/`)

- **Root Git Index Entry:** `160000 2407cb1f5e5ca34b5ae1f478994fa2a4e5de04bb 0  NativeBazar`
- **Issue:** The root repository tracks `NativeBazar` as an embedded submodule reference. However, no `.gitmodules` file exists, triggering `fatal: no submodule mapping found in .gitmodules for path 'NativeBazar'`.
- **Physical Directory:** `NativeBazar/` is an earlier local prototype repository on disk containing its own `.git` directory.
- **The Non-Destructive Solution:**  
  Running `git rm --cached NativeBazar` removes the tree entry from the root staging index without deleting or touching a single byte inside `NativeBazar/` or `NativeBazar/.git` on disk. Adding `NativeBazar/` to `.gitignore` ensures it remains ignored by Git permanently.

---

## 3. Step-by-Step Release Command Plan

> [!IMPORTANT]
> The following commands are ready to be executed by the developer/operator when authorized. Do NOT run them until ready to publish.

### Step 1: Detach the Nested Gitlink (Non-Destructive)
Removes the submodule reference from the root Git index while leaving all local files and the nested `.git` directory completely untouched:
```bash
git rm --cached NativeBazar
```

### Step 2: Add `NativeBazar/` to `.gitignore`
Ensures Git never attempts to re-track the nested folder:
```bash
# Append NativeBazar/ to .gitignore if not already present
echo NativeBazar/ >> .gitignore
```

### Step 3: Stage Essential Untracked Backend Core Modules
These modules are imported by `server.ts` and are mandatory for application startup on Render:
```bash
git add src/server/auth.ts
git add src/server/neonDb.ts
git add neon.ts
```

### Step 4: Stage Core Modified Files & Dependency Configuration
Includes the `tsx` start dependency fix, reverse proxy hardening, and startup sync fix:
```bash
git add .gitignore
git add package.json
git add package-lock.json
git add server.ts
git add server_data/db.json
git add tsconfig.json
git add src/App.tsx
git add src/components/AdminVerificationModal.tsx
git add src/components/FarmerDashboard.tsx
git add src/data/store.ts
git add src/server/db.ts
git add src/services/api.ts
git add src/services/apiService.ts
```

### Step 5: Stage Key Verification Scripts & Audit Deliverables
Preserves production migration rehearsal scripts and architecture audit reports:
```bash
git add scripts/production_migration_rehearsal.cjs
git add scripts/test_production_start.cjs
git add scripts/test_trust_proxy_security.cjs
git add scripts/audit_data_migration_completeness.cjs
git add NATIVEBAZAR_*.md
```

### Step 6: Verify Staged Changes Before Committing
Verify that NO secrets, `.env` files, or database backups are staged:
```bash
# Check staged files
git diff --cached --stat

# Confirm no secrets or database dumps are staged
git diff --cached --name-only | grep -E '\.env|\.db$|\.bak|backups'
# (The command above must return empty)
```

### Step 7: Create Atomic Semantic Release Commit
```bash
git commit -m "feat(release): decouple startup sync, resolve tsx start dependency, and prepare Render deployment"
```

### Step 8: Push to Remote GitHub Repository
```bash
# Push the verified feature branch
git push origin feature/full-backend-migration

# (Optional: or merge feature/full-backend-migration into main and push main)
```

---

## 4. Render Deployment Verification Checklist

Once the code is pushed to GitHub and connected to the Render Web Service:

```
┌────┬──────────────────────────────────────────┬─────────────────────────────────────────────┐
│ #  │ Verification Item                        │ Expected Result                             │
├────┼──────────────────────────────────────────┼─────────────────────────────────────────────┤
│ 1  │ Render Build Output                      │ "✓ 1687 modules transformed. ✓ built..."    │
│ 2  │ Render Service Start                     │ "Listening on port 10000" (or assigned port)│
│ 3  │ Health Check Route                       │ curl https://<app-name>.onrender.com/api/   │
│    │                                          │ health returns HTTP 200                     │
│ 4  │ Reverse Proxy IP Resolution              │ Logs verify genuine client IP in req.ip     │
│ 5  │ Startup Database Initialization          │ "[Neon] PostgreSQL connection verified and  │
│    │                                          │ schema tables ready."                       │
│ 6  │ Zero Phone Collision Warnings            │ No duplicate key errors in Render logs      │
└────┴──────────────────────────────────────────┴─────────────────────────────────────────────┘
```

---

## 5. Summary Readiness Verdicts

| Action | Verdict | Prerequisite / Condition |
| :--- | :---: | :--- |
| **Safe to Stage?** | **YES** | Follow Steps 1 through 5 of this plan. |
| **Safe to Push?** | **YES** | Once staged per manifest; no secrets are tracked. |
| **Safe to Deploy Code?** | **YES** | Configure Render environment variables by name. |
| **Safe to Migrate Data?** | **CONDITIONALLY READY** | Requires code deployment first to create tables, then run `production_migration_rehearsal.cjs`. |

