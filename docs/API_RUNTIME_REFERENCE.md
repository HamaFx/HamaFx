# API + Runtime Reference (Canonical)

## 1) Response Envelope

Backend helpers return JSON envelopes from `api/_lib/http.ts`:

- Success: `{ "ok": true, "data": ... }`
- Error: `{ "ok": false, "error": "...", "details"?: ... }`

Frontend backend client (`src/services/backend/http.ts`) unwraps `data` automatically.

## 2) Auth Model

- Access token: short-lived JWT in localStorage key `hamafx_api_token`
- Refresh token: `HttpOnly` cookie (`refresh_token`)
- Refresh endpoint: `POST /api/v2/auth/refresh`
- Client retry flow: one automatic refresh attempt on 401

## 3) Public API Surface (`/api/v2`)

## 3.1 Health and Ops

- `GET /api/v2/health`
- `GET /api/v2/cron/maintenance`
- `POST /api/v2/cron/maintenance`

## 3.2 Auth

- `POST /api/v2/auth/register`
- `POST /api/v2/auth/login`
- `POST /api/v2/auth/refresh`
- `POST /api/v2/auth/logout`
- `GET /api/v2/auth/me`

## 3.3 Trading and Portfolio

- `GET /api/v2/portfolio`
- `PUT /api/v2/portfolio`
- `POST /api/v2/orders`
- `GET /api/v2/orders`
- `DELETE /api/v2/orders/:id`
- `POST /api/v2/positions/:id/close`
- `GET /api/v2/trades`

## 3.4 User Domain State

- `GET /api/v2/settings`
- `PUT /api/v2/settings`
- `GET /api/v2/watchlists`
- `POST /api/v2/watchlists`
- `PUT /api/v2/watchlists`
- `PATCH /api/v2/watchlists/:id`
- `DELETE /api/v2/watchlists/:id`
- `GET /api/v2/alerts`
- `POST /api/v2/alerts`
- `PUT /api/v2/alerts`
- `PATCH /api/v2/alerts/:id`
- `DELETE /api/v2/alerts/:id`
- `GET /api/v2/chat`
- `POST /api/v2/chat`
- `PUT /api/v2/chat`
- `DELETE /api/v2/chat`
- `GET /api/v2/audit`
- `GET /api/v2/state`
- `PUT /api/v2/state`
- `POST /api/v2/migrate/import`

## 3.5 Market and News

- `GET /api/v2/market/crypto?mode=markets|ohlc|chart`
- `GET /api/v2/market/forex?mode=latest|history|pairs|quotes|candles` (compatibility route)
- `GET /api/v2/market/forex/pairs`
- `GET /api/v2/market/forex/quotes`
- `GET /api/v2/market/forex/candles`
- `GET /api/v2/news`

## 3.6 AI Endpoints

- `POST /api/v2/ai/chat`
- `GET /api/v2/ai/insights`
- `GET /api/v2/ai/command-center`
- `POST /api/v2/ai/analysis`
- `POST /api/v2/ai/sentiment`
- `POST /api/v2/ai/trade-eval`
- `GET /api/v2/ai/news-brief`
- `GET /api/v2/ai/news-intel`
- `GET /api/v2/ai/status`

`POST /api/v2/ai/chat` request supports optional mode routing:
- `mode=general|portfolio|risk|news|execution`

## 3.7 Auth Requirement Matrix

Public/no auth:

- `GET /api/v2/health`
- `POST /api/v2/auth/register`
- `POST /api/v2/auth/login`
- `POST /api/v2/auth/refresh`

Cron secret required (not user JWT):

- `GET /api/v2/cron/maintenance`
Accepted auth headers:
- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

User JWT required:

- `GET /api/v2/auth/me`
- `POST /api/v2/auth/logout`
- All market and news endpoints (`/api/v2/market/*`, `/api/v2/news`)
- All trading/state/AI endpoints listed in sections 3.3, 3.4, and 3.6

## 4) Required Environment Variables

Validated in `api/_lib/env.ts`:

- `AUTH_JWT_SECRET`
- `DATABASE_URL`
- `CRON_SECRET`
- `CORS_ALLOWED_ORIGIN`

Strongly recommended:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Optional integrations:

- `NEWSDATA_API_KEY`
- `COINGECKO_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `GROQ_MODEL`
- `SCITELY_API_KEY`
- `SCITELY_MODEL`
- `AI_PROVIDER=auto|gemini|groq|scitely`
- `SENTRY_DSN`
- `SENTRY_ENVIRONMENT`
- `SENTRY_TRACES_SAMPLE_RATE`
- `PROTECTION_BYPASS_SECRET`

Frontend runtime vars:

- `VITE_APP_NAME` (optional branding label)
- `VITE_BACKEND_MODE=off|shadow|on`
- `VITE_SENTRY_DSN`
- `VITE_SENTRY_ENVIRONMENT`
- `VITE_SENTRY_TRACES_SAMPLE_RATE`
- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_PROTECTION_BYPASS`

Build-time (optional, sourcemap upload):

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## 4.1 Environment Validation Behavior

- Env schema is validated in `api/_lib/env.ts`.
- `/api/v2/health` reports degraded status when required env/dependencies are invalid.
- Most domain endpoints fail fast if required env is missing.

## 5) Provider Behavior

AI backend (`api/_lib/ai.ts`) tries providers in configured order.

- `AI_PROVIDER=auto`: first available configured provider, then failover.
- If no provider succeeds, endpoint uses deterministic fallback logic.
- Runtime visibility endpoint: `GET /api/v2/ai/status`.

## 6) Security-Critical Defaults

- CORS response headers injected through `api/_lib/request.ts`.
- Refresh cookie uses `HttpOnly` and `SameSite=Lax`; `Secure` in production.
- Auth-required endpoints call `requireAuth(...)`.
- AI chat endpoint applies per-user rate limiting when Redis is configured.

## 7) Vercel Runtime Notes

Configured in `vercel.json`:

- Function durations (`maxDuration`) for `/api/v2/*`
- Cron schedule: `0 3 * * *` -> `/api/v2/cron/maintenance`
- Security headers and API rewrites are centralized there.

## 8) Rewrite Compatibility Notes

`vercel.json` includes compatibility rewrites such as:

- `/api/v2/portfolio` -> `/api/v2/trading/portfolio`
- `/api/v2/orders` -> `/api/v2/trading/orders`
- `/api/v2/watchlists` -> `/api/v2/data/watchlists`

Use canonical public paths documented in section 3 (`/api/v2/...`) from frontend clients.
Treat `/api/v2/trading/*` and `/api/v2/data/*` as internal routing surfaces.
