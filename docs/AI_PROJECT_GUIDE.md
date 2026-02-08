# Hama Fx AI Project Guide (Source of Truth)

Last validated against code on branch `feat/ai-copilot-v2`.

## 1) System Snapshot

Hama Fx is a hash-routed SPA with optional V2 backend mode.

- Frontend: `src/*`
- Backend (Vercel Functions): `api/*`
- Public API namespace: `/api/v2/*`
- Primary data stores in V2: Neon Postgres + Upstash Redis
- AI orchestration: backend provider failover (Groq/Gemini/Scitely) + deterministic fallbacks

## 2) Runtime Modes

Controlled by `VITE_BACKEND_MODE` in frontend build env:

- `off`
Frontend-local behavior (localStorage persistence, direct provider calls where applicable).

- `shadow`
Frontend stays local-first but pushes state to backend in background.

- `on`
Backend auth/state become primary. Frontend consumes `/api/v2/*`.

Mode parser lives in `src/services/backend/config.ts`.

## 3) Frontend Architecture

## 3.1 Entry and Routing

- Entry: `src/main.tsx`
- App shell + route mounting: `src/App.tsx`
- Router: `HashRouter`

Primary routes:

- `/login`
- `/`
- `/markets`
- `/asset/:id`
- `/portfolio`
- `/watchlist`
- `/news`
- `/alerts`
- `/calendar`
- `/backtest`
- `/heatmap`
- `/terminal`
- `/risk`
- `/settings`

## 3.2 State Stores (Zustand)

- `src/stores/authStore.ts`
Authentication/session, audit logging hooks, backend auth bridging.

- `src/stores/settingsStore.ts`
Theme, notification preferences, API key settings, trading guardrail defaults.

- `src/stores/marketStore.ts`
Crypto/forex data loading and updates.

- `src/stores/portfolioStore.ts`
Orders, positions, fills, PnL, risk-guardrail enforcement.

- `src/stores/watchlistStore.ts`
Watchlist CRUD and persistence.

- `src/stores/alertStore.ts`
Alert lifecycle + notification behavior.

- `src/stores/chatStore.ts`
Chat messages and AI drawer history.

## 3.3 Services and Data Access

- Market APIs: `src/services/api/*`
- AI/chat frontend orchestration: `src/services/gemini.ts`, `src/services/chatService.ts`
- Backend client layer: `src/services/backend/*`
- Caching/rate-limiting helpers: `src/services/cache.ts`, `src/services/rateLimiter.ts`
- Risk guardrails: `src/services/riskGuardrails.ts`

## 4) Backend Architecture (Vercel Functions)

## 4.1 Public Function Surface

- Wrapper routes (stable): `api/v2/*`
- Core handlers: `api/_v2/*`
- Shared backend libs: `api/_lib/*`

`api/v2/*` wrappers dispatch to `api/_v2/*` and preserve stable paths used by frontend.
Vercel rewrites also map compatibility paths (for example `/api/v2/trading/*`, `/api/v2/data/*`) into these handlers.

## 4.2 Core Backend Modules

- Env validation: `api/_lib/env.ts`
- DB client + schema: `api/_lib/db/client.ts`, `api/_lib/db/schema.ts`
- Auth/session/JWT: `api/_lib/auth.ts`
- Domain state repository: `api/_lib/state.ts`
- AI orchestration: `api/_lib/ai.ts`
- Market/news proxy: `api/_lib/market.ts`, `api/_lib/news.ts`
- Risk evaluation: `api/_lib/risk.ts`
- HTTP/CORS/handler utilities: `api/_lib/http.ts`, `api/_lib/request.ts`, `api/_lib/handler.ts`

## 4.3 Data Model (Postgres)

Main tables:

- `users`, `sessions`
- `portfolios`, `positions`, `orders`, `trades`
- `watchlists`, `watchlist_items`
- `alerts`, `settings`, `chat_messages`, `audit_events`

Schema source: `api/_lib/db/schema.ts`.

## 4.4 Redis Usage

- Cache hot API responses (`withRedisCache`)
- Rate-limit selected endpoints (`rateLimit`)
- Optional dependency: backend still runs without Redis (degrades to no-cache/no-rate-limit persistence).

## 5) AI System (Current Behavior)

## 5.1 Provider Selection

Configured server-side with:

- `AI_PROVIDER=auto|groq|gemini|scitely`
- `GROQ_API_KEY`, `GEMINI_API_KEY`, `SCITELY_API_KEY`

Execution order:

- `auto` uses first configured provider, then failover order
- explicit provider pins first choice and then falls back if available providers remain

Implementation: `api/_lib/ai.ts`.

Core AI endpoints:

- `/api/v2/ai/chat`
- `/api/v2/ai/insights`
- `/api/v2/ai/command-center`
- `/api/v2/ai/analysis`
- `/api/v2/ai/sentiment`
- `/api/v2/ai/trade-eval`
- `/api/v2/ai/news-brief`
- `/api/v2/ai/news-intel`
- `/api/v2/ai/status`

## 5.2 Frontend AI Call Path

- Chat UI -> `src/components/AIChatDrawer.tsx`
- Chat service -> `src/services/chatService.ts`
- Backend client -> `src/services/backend/aiApi.ts`
- HTTP wrapper + token refresh -> `src/services/backend/http.ts`
- Backend endpoint -> `/api/v2/ai/chat`

If backend request fails, frontend intentionally falls back to local deterministic responses.
AI chat now supports optional mode routing (`general|portfolio|risk|news|execution`) for specialized responses.

## 6) Data Flow (Critical Paths)

## 6.1 Boot

1. `restoreSession()` from auth store.
2. Load settings/chat history.
3. If authenticated:
- in backend `on` mode: pull backend state first.
- otherwise: load local portfolio/watchlists/alerts.
4. If backend sync enabled (`on` or `shadow`), subscribe stores for debounced push sync.

Coordinator: `src/services/backend/stateSync.ts`.

## 6.2 Trading

1. User submits order from `OrderForm`.
2. Risk guardrails evaluate candidate.
3. In backend mode, order APIs call `/api/v2/orders` and related endpoints.
4. Portfolio state updates + audit events recorded.

## 6.3 News

- Backend mode: `/api/v2/news` first.
- Fallback: direct NewsData key from user settings.
- Final fallback: curated local dataset (`src/data/curatedNews.ts`).
- AI narrative overlays are served by `/api/v2/ai/news-brief` and `/api/v2/ai/news-intel`.

## 7) Build, Test, CI

## 7.1 Local Commands

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run build:stats`
- `npm run check:bundle-budget`
- `npm run check` (full gate)
- `npm run e2e:smoke`

## 7.2 CI Workflows

- `.github/workflows/ci.yml`
Quality gate + mobile smoke gate on PR/push.

- `.github/workflows/e2e-nightly.yml`
Full mobile E2E scheduled run.

- `.github/workflows/live-mobile-smoke.yml`
Hits deployed URL with optional protection bypass header.

- `.github/workflows/uptime-monitor.yml`
Scheduled production health checks.

## 8) Deployment Topology

- Vercel project serves SPA and API functions same-origin.
- `vercel.json` defines function durations, rewrites, cron job, and security headers.
- Analytics and speed insights mounted in `src/main.tsx`.
- Sentry is optional and env-gated:
  - frontend init in `src/main.tsx`
  - backend capture in `api/_lib/sentry.ts` and `api/_lib/handler.ts`

## 9) Local Storage Contracts (Still Relevant)

Canonical prefixes are `hamafx_*` with legacy-read fallback for older `nexus_*` keys.

Common keys:

- `hamafx_auth`
- `hamafx_users`
- `hamafx_settings_<userId>`
- `hamafx_portfolio_<userId>`
- `hamafx_trades_<userId>`
- `hamafx_chat_<userId>`

Migration helper: `src/utils/storageMigration.ts`.

## 10) Known Engineering Constraints

- `HashRouter` is required for current deployment path assumptions.
- AI surfaces intentionally degrade gracefully to rule-based responses.
- Backend auth requires both bearer access token and refresh cookie lifecycle.
- Redis is optional; behavior degrades without it.
- Historical planning docs are archived under `docs/archive/`; use this file + `docs/README.md` as canonical.
