# NexusTrade — Backend Migration Guide

> **📊 Status: V1 COMPLETE (Client-Side) — This guide is for FUTURE V2 backend development**

---

## Current V1 Architecture (Complete)

| Layer | Implementation | Status |
|-------|---------------|--------|
| UI | React + Tailwind + Premium Components | ✅ |
| State | Zustand (7 stores) | ✅ |
| Services | Client adapters (direct API calls) | ✅ |
| Persistence | localStorage | ✅ |
| AI | Gemini API (user key) + rule-based fallback | ✅ |
| Real-time | CoinCap WebSocket + polling | ✅ |

---

## V2 Migration Steps (FUTURE)

### Step 1: Set Up Backend
- NestJS or Express server
- PostgreSQL database (schemas in DATABASE_SCHEMA.md)
- Redis for caching
- JWT authentication

### Step 2: Create Backend Adapters
Implement the same service interfaces with REST API calls:
- `BackendAuthService` → `POST /api/auth/login`
- `BackendMarketService` → `GET /api/market/crypto`
- `BackendTradingService` → `POST /api/trades`
- `BackendNewsService` → `GET /api/news`
- `BackendAnalysisService` → `POST /api/analysis`

### Step 3: Swap One File
Change `src/services/registry.ts` to use backend adapters.
**Zero UI code changes needed.**

### Step 4: Move Secrets Server-Side
- Gemini API key → server `.env`
- Remove API Keys settings section from UI

### Estimated Effort: 6-8 developer days
### Estimated Cost: ~$5/month (Railway/Fly.io)
