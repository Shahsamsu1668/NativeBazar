# NativeBazar — Persistent Node.js Hosting Architecture Evaluation

**Evaluation Date:** November 3, 2026  
**Auditing Entity:** Antigravity Advanced Agentic Verification System  
**Target Workload:** NativeBazar Unified Production Stack (Express HTTP API + Vite SPA + SSE Real-Time Event Bus)  
**Database Architecture:** Neon Serverless PostgreSQL (`ap-southeast-1.aws.neon.tech`)  
**Deployment Policy:** Architectural Evaluation Only — Zero Accounts Created, Zero Hosting Configured  

---

## 1. Executive Summary & Recommended Platform

### 1.1 The Definitive Recommendation

```
╔══════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                          ║
║   RECOMMENDED PRODUCTION HOST: RENDER (Web Service — Singapore Region / ap-southeast-1)  ║
║                                                                                          ║
╚══════════════════════════════════════════════════════════════════════════════════════════╝
```

### 1.2 Primary Architectural Justifications:
1. **Zero-Latency Database Colocation:** Render offers a first-class **Singapore (`sin`)** region directly colocated with Neon's primary database cluster in AWS Singapore (`ap-southeast-1`), delivering sub-3ms roundtrip query latency.
2. **Native Unbuffered SSE Streaming:** Render's reverse proxy does not buffer chunked HTTP responses, allowing NativeBazar's `/api/events` Server-Sent Events stream to push instant price alerts, wholesaler demands, and order updates to farmers without connection drops or proxy timeouts.
3. **Out-of-the-Box In-Memory Pub/Sub:** Operating on a single persistent container (Render Starter or Standard) allows NativeBazar's existing in-memory `sseClients` Map to function flawlessly without requiring an external Redis cache on Day 1.
4. **Automated Zero-Downtime Rollouts:** Built-in health check endpoint monitoring (`/api/health`) ensures zero-downtime blue/green deployments.

---

## 2. In-Depth Platform Comparison Matrix

| Evaluation Dimension | Render | Railway | Fly.io | DigitalOcean App Platform |
| :--- | :--- | :--- | :--- | :--- |
| **Persistent Node.js Runtime** | **Native** (Web Service container; never idles on paid plans). | **Native** (Container persistent runtime via Nixpacks). | **Native** (Firecracker microVM; persistent process). | **Native** (Managed Kubernetes pod; persistent). |
| **SSE Compatibility (`/api/events`)** | **EXCELLENT**: Long-lived HTTP streaming supported; no response chunk buffering; HTTP/2 native. | **GOOD**: Supports SSE, but proxy disconnects can occur during internal deployment hops. | **EXCELLENT**: Low-level TCP/HTTP proxy; full streaming support. | **FAIR**: Requires explicit keepalive pings (< 60s) to prevent ingress proxy timeouts. |
| **Neon PostgreSQL Integration** | **EXCELLENT**: Singapore region colocated with Neon `ap-southeast-1`; PgBouncer pooled URL supported. | **GOOD**: Singapore region available; supports pooled and direct connection strings. | **EXCELLENT**: Global WireGuard mesh; Singapore (`sin`) region available. | **FAIR**: DO Singapore `sgp1` to AWS `ap-southeast-1` has cross-cloud latency (~8–15ms). |
| **Environment Variable Security** | **EXCELLENT**: Encrypted environment groups, secret files, zero token exposure in build logs. | **EXCELLENT**: Shared environment variables, CLI secret injection, role-based access. | **EXCELLENT**: Hardware-level encrypted secrets (`fly secrets set`). | **GOOD**: Encrypted secrets in App Spec; masked in console. |
| **Deployment Complexity** | **LOW**: Direct Git branch linking; auto-builds on push; zero YAML/Docker config required. | **LOW**: Git integration; auto-detects Vite + Express; very intuitive dashboard. | **MEDIUM-HIGH**: Requires `flyctl` CLI, `fly.toml` configuration, Dockerfile tuning. | **LOW-MEDIUM**: Git push integration; App Platform UI or doctl CLI. |
| **Pricing & Cost Predictability** | **PREDICTABLE**: \$7/mo (Starter 512MB) to \$25/mo (Standard 2GB); flat monthly billing. | **USAGE-BASED**: vCPU + RAM per minute; \$5 free credit; ~$10–\$25/mo estimated. | **USAGE-BASED**: Generous free tier (3 shared-cpu VMs); ~$5–\$20/mo estimated. | **PREDICTABLE**: \$5/mo (Basic 512MB) to \$25/mo (Professional 2GB). |
| **Health Checks & Monitoring** | **NATIVE**: Configurable health check path (`/api/health`); live metrics (CPU, RAM, HTTP latency). | **GOOD**: Automatic restart policies, build logs, resource graphs. | **EXCELLENT**: Deep Prometheus metrics and Grafana dashboards built-in. | **GOOD**: Built-in alerts, CPU/Memory telemetry, automatic restart on failure. |
| **Horizontal Scaling & Pub/Sub** | Single instance: In-memory works.<br>Multi-instance: Needs Redis/Neon pub/sub. | Single instance: In-memory works.<br>Multi-instance: Needs Redis plugin. | Multi-VM: Immediately requires Redis or Neon `LISTEN/NOTIFY`. | Multi-pod: Immediately requires Redis or Neon `LISTEN/NOTIFY`. |

---

## 3. Deep Architectural Analysis

### 3.1 Why Serverless Was Rejected for NativeBazar
Serverless platforms (such as Vercel Serverless Functions or AWS Lambda) were evaluated and strictly rejected for NativeBazar based on three fatal architectural incompatibilities:
1. **Server-Sent Events (SSE) Execution Limits:** Serverless function executions are capped by strict timeouts (typically 10 to 60 seconds). NativeBazar's `/api/events` requires long-lived, open HTTP streaming connections for live agricultural trade events.
2. **In-Memory Connection Isolation:** NativeBazar registers active users in `sseClients = new Map<string, { res, role }>()`. In a serverless model, each incoming request spins up an isolated ephemeral micro-container. When an order is created, the function handling the order cannot broadcast to clients connected to other function instances.
3. **Database Connection Churn:** Ephemeral serverless invocations open and close PostgreSQL connections rapidly, exhausting Neon compute connection limits during trade surges. A persistent Node.js service maintains a warm connection pool (`max: 20`) with sub-millisecond reuse.

---

### 3.2 SSE Real-Time Event Bus & Pub/Sub Architecture

NativeBazar's real-time notification engine operates via `/api/events`:

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as Farmer Browser
    participant Node as Render Node.js Container (Single Instance)
    participant Neon as Neon PostgreSQL

    Farmer->>Node: 1. GET /api/events (SSE Connection Opened)
    Note over Node: Registered in memory: sseClients.set('usr-rafiq', { res, role: 'farmer' })
    Node-->>Farmer: 2. HTTP 200 (text/event-stream) + Heartbeat (:keepalive)
    
    actor Wholesaler as Wholesaler Browser
    Wholesaler->>Node: 3. POST /api/orders (Creates B2B Purchase)
    Node->>Neon: 4. Atomic Transaction Insert
    Neon-->>Node: 5. Transaction Committed (ORD-123)
    
    Note over Node: Loop over sseClients: find connected farmers
    Node-->>Farmer: 6. event: trade_event (data: {"orderId":"ORD-123","status":"Confirmed"})
```

#### The Pub/Sub Scalability Boundary:
- **Phase 1 (Single Persistent Container):**  
  The current in-memory `sseClients` Map is **100% functional and production-ready**. A single Node.js process with 1GB RAM can easily maintain 5,000+ idle SSE connections with negligible CPU overhead.
- **Phase 2 (Multi-Instance Clustering Scale-Out):**  
  When scaling to multiple container replicas behind a load balancer, instances cannot share memory. NativeBazar can transition seamlessly using **Neon's built-in PostgreSQL `LISTEN / NOTIFY` primitives** (zero external dependencies) or an Upstash Redis pub/sub channel.

---

## 4. Render Production Deployment Blueprint

When ready for live deployment, configure Render as follows:

### 4.1 Service Specification
- **Service Type:** Web Service
- **Runtime:** Node
- **Region:** `Singapore (Southeast Asia)`
- **Branch:** `main`
- **Instance Type:** `Starter` (\$7/mo, 512MB RAM) or `Standard` (\$25/mo, 2GB RAM)
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start` (or `node ./node_modules/tsx/dist/cli.mjs server.ts`)
- **Health Check Path:** `/api/health`
- **Auto-Deploy:** Yes (on Git push to main)

### 4.2 Required Environment Variables on Render
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://[user]:[secret]@ep-raspy-hat-b3y04kgr-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
NEON_DIRECT_DATABASE_URL=postgres://[user]:[secret]@ep-raspy-hat-b3y04kgr.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
SESSION_SECRET=[64-character-hex-secret]
JWT_SECRET=[64-character-hex-secret]
GEMINI_API_KEY=[google-ai-studio-key]
APP_URL=https://nativebazar.onrender.com
ADMIN_ACCESS_TOKEN=[high-entropy-admin-token]
```

### 4.3 Production Reverse Proxy Configuration (`trust proxy`)
Because Render terminates TLS at its edge reverse proxy and forwards requests with the `X-Forwarded-For` header, Express must trust the proxy in production:
```typescript
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
```
This ensures accurate client IP resolution for `authLimiter`, `aiLimiter`, and `productsLimiter`.

