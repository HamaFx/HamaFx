# Hama Fx Deployment Hardening

## 1) Custom Domain + HTTPS

Vercel manages HTTPS certificates automatically once DNS is configured.

Run:

```bash
scripts/vercel-prod-setup.sh your-domain.com
```

Manual path:
1. Vercel Project -> `Settings` -> `Domains`
2. Add your domain
3. Configure DNS records shown by Vercel
4. Set production domain as primary

## 2) Environment Variables (Production vs Preview)

Set these in Vercel Project -> `Settings` -> `Environment Variables`:

- `LIVE_BASE_URL`
- `PROD_HEALTHCHECK_URL`

Recommended values:
- Production: `https://<your-production-domain>`
- Preview: `https://<your-preview-domain>` (optional)

GitHub Actions secrets required:
- `LIVE_BASE_URL` for `.github/workflows/live-mobile-smoke.yml`
- `PROD_HEALTHCHECK_URL` for `.github/workflows/uptime-monitor.yml`
- `PROTECTION_BYPASS_SECRET` (optional, recommended) for protected deployments and live smoke/uptime headers.

## 3) Analytics + Speed Insights

The app now includes:
- `@vercel/analytics/react`
- `@vercel/speed-insights/react`

No extra code changes are needed. Enable both in Vercel project dashboard if prompted.

## 4) Branch Protection

Apply protection with:

```bash
GH_TOKEN=... scripts/apply-branch-protection.sh HamaFx HamaFx main
```

Required checks:
- `Quality Gate`
- `E2E Mobile Smoke`

If your repository is private and on a plan that blocks branch protection, GitHub will return `403` until plan/visibility allows it.

## 5) Uptime Monitoring

Workflow: `.github/workflows/uptime-monitor.yml`
- Runs every 15 minutes
- Fails if health URL returns non-2xx/3xx

## 6) Live Mobile Smoke

Workflow: `.github/workflows/live-mobile-smoke.yml`
- Runs every 6 hours + manual trigger
- Uses deployed URL from `LIVE_BASE_URL`
- Runs existing mobile smoke suite against live deployment

## 7) Sentry Integration

Frontend runtime reporting:

- Set `VITE_SENTRY_DSN`.
- Optional tuning: `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_TRACES_SAMPLE_RATE`.

Backend/API reporting:

- Set `SENTRY_DSN`.
- Optional tuning: `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`.

Sourcemap upload (recommended for readable production stack traces):

- Set build-time vars `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- Build automatically enables sourcemaps/upload when all three are present.

## 8) CodeRabbit Integration

1. Install the CodeRabbit GitHub App on the repository.
2. Keep `.coderabbit.yaml` at repository root to control review behavior.
3. Ensure branch protection includes the CodeRabbit check once it appears in PR status checks.

## 9) Troubleshooting Checklist

If AI/chat appears to return only fallback responses:

1. Confirm frontend mode in deployed env is `VITE_BACKEND_MODE=on` (or expected value).
2. Re-login to refresh access token/cookie pair.
3. Verify `/api/v2/health` and `/api/v2/ai/chat` return successful responses.
4. Verify provider env values are set and trimmed (`AI_PROVIDER`, `GROQ_API_KEY`, `GEMINI_API_KEY`, etc.).
5. If deployment protection is enabled, ensure automation requests include `x-vercel-protection-bypass`.
