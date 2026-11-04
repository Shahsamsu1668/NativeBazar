# NativeBazar — Phase 3.2: Wholesaler Demands, Market Rates, Messaging & Connections Neon Cutover Report

**Execution Timestamp:** 2026-11-02T23:28:30+06:00  
**Target Environment:** Isolated Test Branch `dev-migration-test` (`ep-snowy-mode-b389h4uk`)  
**Production Status:** Main Branch Untouched & Intact (`br-square-mud-b3mncdyw`)  
**Overall Phase Status:** **PHASE 3.2 PASSED — DOMAINS CONNECTED TO NEON**

---

## 1. Executive Summary

Phase 3.2 completed the backend cutover of five core interaction and market domains from legacy SQLite, JSON, and localStorage stores directly to Neon PostgreSQL on the verified test branch `dev-migration-test`:
1. **Wholesaler Procurement Demands / Offers** (`wholesaler_offers`)
2. **Official Market Rates & Farmer Intelligence** (`market_prices`)
3. **Direct Peer-to-Peer Messaging** (`messages`)
4. **Cross-Role User Connections** (`connections`)
5. **Transactional System & Activity Notifications** (`notifications`)

All operations were executed under strict safety rules:
- **Zero Production Access:** Only the isolated compute endpoint `ep-snowy-mode-b389h4uk` was accessed. Production Neon branch `br-square-mud-b3mncdyw` was completely protected.
- **Source Database Immutability:** Pre-cutover and post-testing cryptographic hashes of `nativebazar.db` (SQLite) and `server_data/db.json` (JSON) were identical.
- **Full Backward Compatibility:** Response payloads provide both camelCase (`wholesalerId`, `cropName`, `wholesalePrice`, `createdAt`) and snake_case (`wholesaler_id`, `crop_name`, `wholesale_price`, `created_at`) properties, ensuring seamless interoperation with all frontend views and client services.
- **Strict Identity & Security Enforcement:** Client-supplied IDs (`senderId`, `wholesalerId`, `requesterId`) are discarded in favor of authenticated session claims (`authUser.id`). Eavesdropping on third-party conversations, unauthorized demand tampering, forged connection approvals, and unauthorized notification manipulation are rejected with HTTP 403 Forbidden.
- **Deterministic Verification:** All 14 runtime integration tests passed with 100% success. All disposable test records were cleanly removed, preserving the initial historical database record counts.

---

## 2. Neon Branch & Endpoint Isolation Verification

| Parameter | Configuration | Verification Status |
| :--- | :--- | :--- |
| **Neon Project** | NativeBazar (`silent-pond-90040578`) | Verified |
| **Isolated Test Branch** | `dev-migration-test` (`br-super-pond-b37g04s1`) | Verified Active |
| **Isolated Compute Endpoint** | `ep-snowy-mode-b389h4uk` | Verified (`neondb`) |
| **Production Branch** | `br-square-mud-b3mncdyw` (`main`) | **UNTOUCHED (0 queries executed)** |
| **Test Server Port** | `5178` (ephemeral test runtime) | Successfully executed & terminated |

---

## 3. Pre-Cutover Backup Manifest & File Integrity

Prior to code edits, target source files were backed up with SHA-256 hashes recorded in `server_data/backups/phase3_2_pre_cutover/manifest.json`:

| File | Pre-Cutover SHA-256 Hash | Post-Cutover Status |
| :--- | :--- | :--- |
| `server.ts` | `6d47c8a219f1af8e262d4010922c1c80f3a49349a54c36205fdf46620fb7c2e7` | Cut over to Neon for 5 domains |
| `src/services/apiService.ts` | `0bc97f52eb767dee4e36e7fe6c132b088481a0b5b34f62cf07cab91caba34e6d` | Updated with `credentials: 'include'` |
| `src/services/api.ts` | `3bd48f560bd7acb33503285833ef5096a0e78c818b9cfaffa75ac6976f413080` | Verified compatible |
| `src/data/store.ts` | `af7b51546d49b5565ae1103c9d9671e2f4c47a3c315d9bdd0a76c405520e2a61` | Verified compatible |
| `src/components/WholesalerDashboard.tsx`| `573e13b6577fe5e5defb9577a927102a101252a288ca2af095a5df308a21b98f` | Verified compatible |
| `src/components/ContactsView.tsx` | `0b1fb3ef3d885d48f008455f1ffbd43709126aed8f3222620d99178ec98c3b5e` | Verified compatible |
| `src/components/Header.tsx` | `412da0784fe4f4f999bb3acc603f43e53fd7ec67546c3758039877919b316b39` | Verified compatible |
| `src/components/MarketRatesView.tsx` | `e1dbcc8bb22ec42b0e1c79e33f7eb643b1327c0a9be2ea3a97e8856bfcefc276` | Verified compatible |

---

## 4. Domain-by-Domain Cutover Implementation Details

### Domain 1: Wholesaler Offers / Demands (`wholesaler_offers`)
- **Endpoints Connected:**
  - `GET /api/wholesaler-offers`: Dynamic filtering on `district` and `crop` (`crop_name` and `crop_bangla`), ordered by `urgent DESC, created_at DESC`. Returns `{ offers }` with camelCase and snake_case mapping.
  - `POST /api/wholesaler-offers`: Strictly restricted to `authUser.role === 'wholesaler' || authUser.role === 'admin'`. Derives `wholesaler_id` directly from authenticated session, preventing identity spoofing. Returns HTTP 201 Created.
  - `PUT /api/wholesaler-offers/:id`: Ownership-checked. Rejects non-owners with HTTP 403 Forbidden. Allows editing price, quantity, deadline, and urgency.
  - `DELETE /api/wholesaler-offers/:id`: Ownership-checked. Rejects non-owners with HTTP 403 Forbidden.

### Domain 2: Market Rates & Intelligence (`market_prices`)
- **Endpoints Connected:**
  - `GET /api/market-prices` & `GET /api/market-rates`: Paginated/district-filtered queries against Neon `market_prices`. Returns official prices and trend metrics.
  - `GET /api/farmer/intelligence`: Aggregates district market prices from Neon `market_prices` with active wholesaler demands from Neon `wholesaler_offers` and high-demand corridor analytics.
  - `POST /api/market-prices`: Admin-only. Inserts new DAM market rates into Neon. Non-admins receive HTTP 403.
  - `PUT /api/market-prices/:id`: Admin-only. Updates existing market rate records with timestamp refresh.
  - `DELETE /api/market-prices/:id`: Admin-only. Deletes market price records.

### Domain 3: Direct Messaging (`messages`)
- **Endpoints Connected:**
  - `GET /api/messages`: Requires `userA` and `userB`. Enforces strict conversation confidentiality: non-admin callers can **only** query conversations where `authUser.id === userA || authUser.id === userB`. Eavesdropping attempts fail with HTTP 403.
  - `POST /api/messages`: Discards client-provided `senderId` and binds sender identity to `authUser.id`. Verifies recipient existence in Neon `users` table (HTTP 404 if not found). Inserts message into Neon `messages`, automatically triggers a persistent notification in Neon `notifications` for the recipient, and broadcasts real-time SSE events (`new_message` to recipient, `message_sent` to sender).
  - `PUT /api/messages/read`: Updates `read = true` for unread messages where `recipient_id === authUser.id`. Broadcasts `messages_read` event via SSE.

### Domain 4: User Connections (`connections`)
- **Endpoints Connected:**
  - `GET /api/connections`: Scoped to `authUser.id` (or arbitrary user for administrators). Queries Neon `connections` where `requester_id = $1 OR recipient_id = $1`.
  - `POST /api/connections`: Derives requester identity from `authUser.id`. Blocks self-connections (`requesterId === recipientId`) with HTTP 400. Verifies recipient existence in Neon `users` (HTTP 404). Validates against existing active connections (duplicate pending/accepted connections rejected with HTTP 400). Inserts new pending connection, generates recipient notification, and emits SSE events.
  - `PUT /api/connections/:id`: Enforces that **only the connection recipient** (or admin) can accept or reject a request. Requesters or third parties attempting to accept are rejected with HTTP 403. Emits `connection_updated` SSE event and creates persistent notification for requester.
  - `DELETE /api/connections/:id`: Restricted to participants (`requester_id` or `recipient_id`) or admin. Rejects unauthorized third parties with HTTP 403.

### Domain 5: System & Activity Notifications (`notifications`)
- **Endpoints Connected:**
  - `GET /api/notifications`: Retrieves up to 100 recent notifications for `authUser.id`. Strict user isolation.
  - `PUT /api/notifications/:id/read`: Ownership enforced. Users cannot mark another user's notifications as read (HTTP 403).
  - `PUT /api/notifications/read-all`: Marks all unread notifications read for `authUser.id`.
  - Helper `createNeonNotification(...)`: Shared asynchronous helper enabling transactional notification insertion into Neon PostgreSQL with real-time SSE dispatch.

---

## 5. Realtime Architecture & SSE Synchronization

- **Event Delivery:** Server-Sent Events (`GET /api/realtime?userId=...`) remain active for real-time frontend notifications and chat updates.
- **Persistence Foundation:** All messages, connections, and notifications are now stored durably in Neon PostgreSQL before SSE delivery. In the event of network disruption or client disconnection, reloading the view or opening the application re-fetches canonical state from Neon.
- **Architectural Note on Scaling:** The current SSE mechanism uses a single-process in-memory registry (`sseClients` Map). While lightweight and optimal for single-node deployments, multi-instance horizontal scaling (e.g. running multiple web server instances behind a load balancer) requires a distributed pub/sub backbone (such as PostgreSQL `LISTEN/NOTIFY` via `@neon/realtime` or Redis Pub/Sub). For the current single-instance deployment, durability and real-time delivery are 100% assured.

---

## 6. Runtime Integration Test Results (14 Scenarios)

The comprehensive test suite `scripts/test_phase3_2_runtime.cjs` executed against ephemeral port `5178` with active test sessions on Neon `dev-migration-test`:

| # | Scenario Tested | Method & Path | Expected Result | Actual Result | Status |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | Wholesaler Demand Creation & Retrieval | `POST /api/wholesaler-offers`<br>`GET /api/wholesaler-offers` | 201 Created, identity derived, offer listed in Bogura query | 201 Created (`offerId: bid-1793640483114-691`), retrieved accurately | **PASS** |
| **2** | Unauthorized Offer Modification Rejection | `PUT /api/wholesaler-offers/:id`<br>`DELETE /api/wholesaler-offers/:id` | Rogue wholesaler rejected with 403; authorized wholesaler succeeds with 200 | Rogue edit: 403<br>Rogue delete: 403<br>Legit edit: 200 (৳45/kg) | **PASS** |
| **3** | Market Rates Retrieval & Admin Authorization | `GET /api/market-prices`<br>`POST/PUT /api/market-prices` | Public read 200; non-admin write 403; admin write 201/200 | Public rates: 200<br>Non-admin: 403<br>Admin create: 201<br>Admin update: 200 (৳30/kg) | **PASS** |
| **4** | Direct Messaging Identity Derivation | `POST /api/messages` | Spoofed `senderId` overridden by auth session; invalid recipient 404; empty content 400 | Sender forced to `user-wholesaler-sumaiya`; bad recipient 404; empty content 400 | **PASS** |
| **5** | Messaging Privacy & Read State | `GET /api/messages`<br>`PUT /api/messages/read` | Participants see conversation (200); third-party blocked (403); read state persisted | Convo: 200<br>Third-party: 403 Forbidden<br>Read updated to `true` in Neon | **PASS** |
| **6** | Connection Request Creation & Validations | `POST /api/connections` | Self-connection 400; bad recipient 404; valid request 201 pending | Self-conn: 400<br>Bad recip: 404<br>Valid conn: 201 (`status: pending`) | **PASS** |
| **7** | Duplicate Connection Prevention | `POST /api/connections` | Duplicate connection while pending rejected with 400 | 400 Bad Request (`Connection already pending.`) | **PASS** |
| **8** | Connection State Transition Authorization | `PUT /api/connections/:id` | Requester cannot accept (403); third-party cannot accept (403); recipient accepts (200) | Requester: 403<br>Third-party: 403<br>Recipient: 200 (`status: accepted`) | **PASS** |
| **9** | Connection Deletion Authorization | `DELETE /api/connections/:id` | Unauthorized third-party cannot delete (403) | 403 Forbidden | **PASS** |
| **10** | Automatic Notification Generation | `GET /api/notifications` | Notifications generated for message, connection request, and connection acceptance | Message notif: verified<br>Conn request notif: verified<br>Conn accept notif: verified | **PASS** |
| **11** | Notification Isolation & Read Sync | `PUT /api/notifications/:id/read`<br>`PUT /api/notifications/read-all` | Rogue mark-read 403; legit mark-read 200; read-all marks all user notifs read | Rogue mark-read: 403<br>Legit mark-read: 200<br>Read-all: 200 (all `read: true`) | **PASS** |
| **12** | Historical Record Preservation | Neon Table Row Count Checks | Pre-existing rows remain intact during operations | Pre: offers:6, prices:7, msgs:11, conns:4, notifs:16<br>Post: offers:7, prices:8, msgs:12, conns:5, notifs:19 | **PASS** |
| **13** | Source DB Immutability | SHA-256 Checksum Comparison | `nativebazar.db` and `db.json` match pre-test checksums exactly | Hashes identical (SQLite: `789498e1...`, JSON: `1ab54a39...`) | **PASS** |
| **14** | Products & Orders Regression Check | `GET /api/products`<br>`GET /api/orders` | Phase 3.1 endpoints continue to succeed without regression | Products: 200 (6 consumer products)<br>Orders: 200 (1 order) | **PASS** |

---

## 7. Clean-Up and Database Integrity Verification

After runtime testing completed:
1. All disposable test records were cleanly purged from `dev-migration-test`:
   - 5 isolated test sessions deleted.
   - 1 disposable wholesaler offer deleted.
   - 1 disposable market price record deleted.
   - 1 disposable test direct message deleted.
   - 1 disposable test connection deleted.
   - 3 disposable test notifications deleted.
2. Verified final database counts on Neon `dev-migration-test`:
   - `wholesaler_offers`: **6** (matches initial baseline exactly)
   - `market_prices`: **7** (matches initial baseline exactly)
   - `messages`: **11** (matches initial baseline exactly)
   - `connections`: **4** (matches initial baseline exactly)
   - `notifications`: **16** (matches initial baseline exactly)
   - `products`: **18** (matches initial baseline exactly)
   - `orders`: **7** (matches initial baseline exactly)
   - `users`: **42** (matches initial baseline exactly)

---

## 8. Remaining Domains Status (Phase 4 Scope)

The following secondary features remain outside Phase 3.2 scope and are currently backed by SQLite/JSON:
1. **Product & Order Reviews** (`/api/reviews`, `/api/orders/:id/review`): Currently in JSON DB. Scheduled for Phase 4.1.
2. **Audio/Video VoIP Call Logs** (`/api/calls/logs`): WebRTC signaling logs currently in JSON DB. Scheduled for Phase 4.2.
3. **Legacy Catalog & Static Datasets** (`/api/catalog`): Static crop guides. Scheduled for Phase 4.3.
4. **Farmer Expenses & Field Logbooks**: Frontend localStorage. Scheduled for Phase 4.4.
5. **Direct Offer Negotiations**: Dynamic counter-offers. Scheduled for Phase 4.5.

---

## 9. Next Steps

1. **Phase 4 Planning:** Plan cutover of remaining secondary domains (Reviews, Call Logs, Catalog) to Neon PostgreSQL.
2. **Production Readiness Review:** Once all domains are validated on `dev-migration-test`, prepare final cutover script for production Neon (`br-square-mud-b3mncdyw`).

