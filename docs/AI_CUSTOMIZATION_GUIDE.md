# AI Customization Guide (How to Extend Safely)

This guide is written for AI agents and contributors who need to customize Hama Fx without breaking critical flows.

## 1) Safe Change Workflow

1. Run baseline checks:

```bash
npm run check
npm run e2e:smoke
```

2. Make scoped changes in one domain at a time.
3. Re-run targeted tests first, then full checks.
4. Keep backend mode behavior compatible (`off`, `shadow`, `on`).

## 2) Where to Edit by Use Case

## 2.1 Branding and Copy

- App shell and title surfaces: `src/components/layout/Layout.tsx`, `index.html`
- Login text and onboarding copy: `src/pages/Login.tsx`, `src/pages/Dashboard.tsx`
- AI assistant wording: `src/components/AIChatDrawer.tsx`, `src/services/chatService.ts`

## 2.2 Theme and UI System

- Global tokens, animations, layout primitives: `src/index.css`
- Reusable UI components: `src/components/ui/Premium.tsx`
- Page-level composition: `src/pages/*.tsx`

## 2.3 Navigation and Routing

- Route table and route-level lazy loading: `src/App.tsx`
- Navigation menus: `src/components/layout/Layout.tsx`
- URL state contracts: `src/utils/urlState.ts`

## 2.4 Trading Logic and Guardrails

- Order validation and risk policy core: `src/services/riskGuardrails.ts`
- Execution and settlement: `src/stores/portfolioStore.ts`
- Trade UI and pre-check UX: `src/components/trading/OrderForm.tsx`

If changing guardrail behavior, update tests:

- `src/services/riskGuardrails.test.ts`
- `src/stores/portfolioStore.integration.test.ts`

## 2.5 AI Behavior

Frontend orchestration:

- `src/services/gemini.ts`
- `src/services/chatService.ts`
- `src/services/backend/aiApi.ts`

Backend AI orchestration:

- `api/_lib/ai.ts`
- Endpoint handlers: `api/_v2/ai/*`
- Proactive intelligence endpoints: `api/_v2/ai/command-center.ts`, `api/_v2/ai/news-intel.ts`, `api/_v2/ai/status.ts`

When changing output shape, keep `src/types/index.ts` aligned and update UI renderers.

## 2.6 News Improvements

- Frontend merge/fallback strategy: `src/services/newsService.ts`
- Backend news proxy and normalization: `api/_lib/news.ts`, `api/_v2/news.ts`
- Curated fallback dataset: `src/data/curatedNews.ts`
- AI narrative overlays: `src/services/gemini.ts` (`getNewsBrief`, `getNewsIntel`) + `src/pages/News.tsx`

## 2.7 Backend Domain State

State repository and persistence:

- `api/_lib/state.ts`
- `api/_lib/db/schema.ts`

Public state endpoints:

- `api/_v2/state.ts`
- `api/_v2/settings.ts`
- `api/_v2/watchlists*.ts`
- `api/_v2/alerts*.ts`
- `api/_v2/chat.ts`

## 2.8 Observability and PR Review Automation

- Frontend Sentry init: `src/main.tsx`
- Backend Sentry capture: `api/_lib/sentry.ts`, `api/_lib/handler.ts`
- Build sourcemap upload integration: `vite.config.ts`
- CodeRabbit policy config: `.coderabbit.yaml`

## 3) Common Customization Recipes

## 3.1 Add a New Dashboard Widget

1. Build component in `src/pages/Dashboard.tsx` or a child component under `src/components/*`.
2. Source data from store selectors (avoid direct fetch in component if possible).
3. Add loading/skeleton + empty/error states.
4. Ensure mobile layout and safe-area behavior.

## 3.2 Add a New API Endpoint

1. Create handler in `api/_v2/...`.
2. Wire route wrapper in `api/v2/...` if path is dynamic or grouped.
3. Validate payload with Zod.
4. Apply auth guard if user-scoped.
5. Expose a typed frontend client under `src/services/backend/*`.
6. Add at least one unit/integration test.

## 3.3 Add a New AI Provider

1. Extend provider enum + env schema in `api/_lib/env.ts`.
2. Add provider call implementation in `api/_lib/ai.ts`.
3. Insert provider into ordering logic (`getProviderOrder`).
4. Update `.env.example` and docs.
5. Verify fallback behavior still returns deterministic outputs.

## 3.4 Add a New Persisted User Module

1. Extend DB schema in `api/_lib/db/schema.ts`.
2. Add migration (`npm run db:generate`, `npm run db:migrate`).
3. Add repository read/write in `api/_lib/state.ts`.
4. Expose endpoint(s) under `/api/v2`.
5. Hook into `src/services/backend/stateSync.ts` if needed for sync modes.

## 4) Testing Expectations for Changes

Minimum expectation before merge:

```bash
npm run check
npm run e2e:smoke
```

For backend changes, additionally validate:

- `/api/v2/health` returns expected dependency status.
- Auth refresh flow remains functional.
- Endpoint contracts keep `{ok,data}` envelope compatibility.

## 5) High-Risk Pitfalls

1. Breaking backend mode compatibility:
- Always verify `off`, `shadow`, and `on` logic.

2. Silent fallback masking errors:
- AI/chat intentionally degrades to local responses when backend fails.
- Confirm network calls actually succeed before assuming AI regressions are fixed.

3. Auth token/cookie mismatch:
- Backend endpoints need valid bearer token.
- Refresh cookie path is critical for token renewal.

4. Docs drift:
- Update canonical docs (`docs/README.md`, this file, and API reference) in the same PR as architecture changes.
