# Hama Fx V2 Backend Setup (Vercel)

## 1) Provision Data Services

1. Add **Neon** from Vercel Marketplace.
2. Add **Upstash Redis** from Vercel Marketplace.
3. Link both to this Vercel project.

## 2) Configure Environment Variables

Set these in Vercel for `Production`, `Preview`, and `Development`:

- `AUTH_JWT_SECRET`
- `DATABASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- `CORS_ALLOWED_ORIGIN`
- `NEWSDATA_API_KEY` (optional)
- `COINGECKO_API_KEY` (optional)
- `GEMINI_API_KEY` (optional if using alternate LLM provider)
- `GROQ_API_KEY` (recommended fallback/primary for free-tier AI)
- `GROQ_MODEL` (optional, defaults to `llama-3.1-8b-instant`)
- `SCITELY_API_KEY` (optional)
- `SCITELY_MODEL` (optional, defaults to `qwen3-32b`)
- `AI_PROVIDER` (`auto`, `gemini`, `groq`, `scitely`; recommended `auto`)
- `PROTECTION_BYPASS_SECRET` (optional, recommended)
- `VITE_BACKEND_MODE` (`off`, `shadow`, `on`)

## 3) Generate and Apply DB Migrations

```bash
npm run db:generate
npm run db:migrate
```

## 4) Backend Health Check

`GET /api/v2/health` should report:

- env validation status
- postgres connectivity
- redis connectivity (if configured)

## 5) Frontend Rollout Modes

- `VITE_BACKEND_MODE=off`: V1 local-only.
- `VITE_BACKEND_MODE=shadow`: local-first with backend sync.
- `VITE_BACKEND_MODE=on`: backend-auth + backend state as primary.

## 6) One-Time Data Migration

Use the Settings page -> Data tab:

1. `Dry Run`
2. `Import to Backend`

This sends current local `hamafx_*` state to `/api/v2/migrate/import`.

## 7) Scheduled Maintenance

`vercel.json` schedules:

- `0 3 * * *` -> `/api/v2/cron/maintenance`

Endpoint requires `CRON_SECRET` in authorization header.
