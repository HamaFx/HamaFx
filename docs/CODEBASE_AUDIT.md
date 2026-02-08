# Hama Fx Codebase Audit
Date: February 7, 2026

## 1) Architecture Summary
- Frontend: React 19 + TypeScript + Vite + Tailwind 4.
- State: Zustand stores (`auth`, `settings`, `market`, `portfolio`, `watchlist`, `alert`, `chat`).
- Data sources:
- Crypto: CoinGecko primary + CoinCap fallback/WebSocket.
- Forex: ExchangeRate API primary + Frankfurter fallback/history.
- AI: Gemini direct API (user-provided key) + rule-based fallbacks.
- Persistence: localStorage (user-scoped for portfolio/trades/settings/chat; filtered shared buckets for watchlists/alerts).

## 2) Key Data Flow
- App boot:
- Restores auth session.
- Loads user-scoped settings + chat history for active account.
- Loads user-scoped portfolio/watchlists/alerts after authentication.
- Market:
- `marketStore` fetches, caches, and updates live prices.
- Pages/components read from stores and render derived stats.
- Trading:
- `OrderForm` -> `portfolioStore.placeOrder` / `closePosition`.
- Portfolio metrics and charts read from `portfolioStore`.
- Alerts:
- `alertStore` checks thresholds against live prices on interval.
- Notification behavior now respects settings.

## 3) Dependencies, Build, Test
- Build: `npm run build` (Vite split-chunk output with route-level lazy loading).
- Lint/typecheck/tests: `npm run lint`, `npm run typecheck`, `npm run test`.
- Local quality gate: `npm run check` (lint + typecheck + vitest + build + build stats + bundle budget).
- E2E (mobile): `npm run e2e`, `npm run e2e:smoke`, `npm run e2e:ui` (Playwright iPhone 13 + WebKit).
- CI workflows: `.github/workflows/ci.yml` and `.github/workflows/e2e-nightly.yml`.
- Size tooling: `npm run build:stats`, `npm run check:bundle-budget`.
- Current build profile: entry chunk ~22 KB gzip, total dist ~360 KB gzip across chunks.

## 4) High-Priority Issues Found
- Trading accounting bugs for short positions/equity calculation.
- Incorrect sell-fee handling on partial long exits.
- Hook misuse in `OrderForm` (`useCallback` invoked conditionally in JSX).
- Unsafe AI chat rendering path using `dangerouslySetInnerHTML` on model output.
- Cross-user data leakage risk from shared localStorage buckets.
- Settings toggles were mostly non-functional (no persisted effect).
- Missing automated tests and `typecheck`/`test` scripts.

## 5) Priority Upgrade Roadmap
1. Correctness and financial integrity:
- Fix portfolio equity math, close-position settlement, and fee calculations.
2. Security and runtime safety:
- Remove unsafe AI message HTML injection path.
3. Multi-user data isolation:
- Scope local storage by user where core account state is stored.
4. Functional settings:
- Wire preferences/notification toggles to persisted settings and behavior.
5. Developer experience:
- Add repeatable typecheck/test scripts and baseline unit tests.
6. Next wave (recommended):
- Consolidate duplicate chat implementations.
- Add linting + stricter CI checks.
- Add integration tests for trading flows (long/short, pending fills).
- Move sensitive operations to backend adapters in V2.

## 6) Implemented In This Pass
- Trading/accounting fixes:
- `src/stores/portfolioStore.ts`
- Fixed short equity valuation in `getTotalValue`.
- Fixed short close cash settlement logic.
- Fixed partial-sell fee calculation to use actual sold quantity.
- User-scoped storage and auth alignment:
- `src/stores/portfolioStore.ts`
- `src/stores/authStore.ts`
- `src/stores/watchlistStore.ts`
- `src/stores/alertStore.ts`
- `src/App.tsx`
- Security hardening + chat correctness:
- `src/components/AIChatDrawer.tsx`
- Removed unsafe `dangerouslySetInnerHTML` path.
- Fixed watchlist context serialization and chat history role mapping.
- Stability fix:
- `src/components/trading/OrderForm.tsx`
- Moved AI evaluation callback to top-level hook usage.
- Settings functionality:
- `src/pages/Settings.tsx`
- Persisted theme/trading/notification toggle behavior.
- Alert behavior now respects notification settings:
- `src/stores/alertStore.ts`
- DX and test setup:
- `package.json` scripts: `typecheck`, `test`, `test:watch`.
- Added `vitest` dev dependency.
- Added utility tests:
- `src/utils/riskCalculations.test.ts`
- `src/utils/treemap.test.ts`
- Second-wave upgrades:
- `src/stores/settingsStore.ts`
- Migrated to canonical `hamafx_settings_<userId>` keys with one-time legacy fallback from `nexus_settings_<userId>` / `nexus_settings`.
- Added robust nested settings merge and `loadUserSettings` for account transitions.
- `src/stores/chatStore.ts`
- Migrated to canonical `hamafx_chat_<userId>` keys with one-time legacy fallback from `nexustrade-chat_<userId>` / `nexus_chat`.
- Added explicit `loadMessages` action for auth/user transitions.
- `src/App.tsx`
- Loads user-scoped settings/chat on auth state changes to prevent cross-user bleed.
- `src/pages/Settings.tsx`
- Export now includes user-scoped portfolio/trades/settings/chat and user-filtered alerts/watchlists/audit.
- Fixed storage usage meter to compute real key/value usage rather than `JSON.stringify(localStorage)`.
- `src/services/chatService.ts`
- Portfolio chat context now uses short-aware P&L math and store `getTotalValue()`.
- `src/pages/MultiChart.tsx`
- Removed `any` series ref; replaced with typed `ISeriesApi` union.
- Added tests:
- `src/stores/settingsStore.test.ts`
- `src/stores/chatStore.test.ts`
- `src/utils/storage.test.ts`

## 7) V1.1 Hardening Wave (Priorities 3-7)
- CI quality gate:
- Added ESLint flat config, CI workflow with lint/typecheck/test/build, and bundle budget check.
- Mobile E2E:
- Added Playwright config, deterministic API route mocks, auth helpers, and smoke specs for auth/trade/portfolio/alerts.
- Mobile UX:
- Improved touch targets (44px+), safe-area padding, mobile keyboard ergonomics, sticky trade CTA, and clearer inline form validation.
- Performance:
- Removed single-file production bundling.
- Added route-level lazy loading and tuned manual chunking (`vendor-react`, `vendor-utils`, `vendor-lightweight-charts`, `vendor-recharts`).
- Risk controls:
- Added hybrid guardrail policy with hard blocks (daily loss, position size, open positions) and warning acknowledgements.
- Enforced guardrails in both `OrderForm` and `portfolioStore` pending-fill path.
- Added audit events and settings controls for guardrail thresholds.
- Tests added in this wave:
- `src/services/riskGuardrails.test.ts` expanded to include daily-loss date-boundary behavior.
- `src/stores/portfolioStore.integration.test.ts` expanded with guardrail hard-block and pending-fill expiration scenarios.
- `src/stores/settingsStore.test.ts` expanded for migration/default coverage of new trading guardrail settings.
- Remaining local limitation:
- WebKit mobile smoke cannot execute in this machine without OS packages (`libicu74`, `libxml2`, `libflite1`); CI remains the authoritative WebKit gate.

## 8) Rebrand and Storage Namespace Migration
- Product branding has been reworked to Hama Fx (formerly NexusTrade), using:
- `HamaFX` for logo/title/chrome surfaces.
- `Hama Fx` for prose/documentation copy.
- Canonical localStorage namespace now uses `hamafx_*` keys.
- Backward compatibility is preserved via one-time migration + legacy read fallback from `nexus_*` / `nexustrade-*` keys.

## 9) V1 UI/UX Core Flow Upgrades
- Accessibility and semantics:
- Removed viewport zoom lock and added explicit color-scheme metadata.
- Added keyboard skip link and main landmark targeting in layout.
- Added live-region semantics for toasts and expanded aria labeling on icon-only controls.
- Migrated core navigation-like click targets to semantic links/cards in Dashboard, Markets, Portfolio, Asset Detail, and Watchlist.
- Form and mobile UX:
- Added explicit labels/ids/autocomplete wiring in auth forms.
- Improved order-form validation feedback and focus behavior for invalid inputs.
- Kept sticky mobile trade CTA and safe-area spacing with improved touch-target consistency.
- Motion and interaction:
- Replaced `transition-all` across touched core-flow files with property-scoped transitions.
- Normalized overlay/dialog behavior with modal scroll containment in search, notifications, chat, and modal primitives.
- Perceived performance and stability:
- Added explicit image dimensions for key list/detail images in Dashboard, Markets, Asset Detail, Global Search, and Watchlist to reduce layout shift.
- URL-shareable state and onboarding:
- Added query-string state sync for `Markets`, `Portfolio`, and `Settings`:
- `portfolioTab`, `marketsView`, `marketsAsset`, `marketsSort`, `marketsOrder`, `marketsQ`, `settingsTab`.
- Added a first-session onboarding checklist card on Dashboard and a persistent risk-posture chip in the app header.

## 10) Deployment and Operations Hardening
- Added Vercel production headers config: `vercel.json`.
- Added Vercel observability in app runtime: `@vercel/analytics/react`, `@vercel/speed-insights/react` in `src/main.tsx`.
- Added uptime monitor workflow: `.github/workflows/uptime-monitor.yml` (15-minute healthcheck).
- Added live deployed mobile smoke workflow: `.github/workflows/live-mobile-smoke.yml`.
- Added branch protection automation script: `scripts/apply-branch-protection.sh`.
- Added deployment setup script for domain/env bootstrap: `scripts/vercel-prod-setup.sh`.
- Added deployment runbook: `docs/DEPLOYMENT_HARDENING.md`.
- Limitation observed during automation: GitHub branch protection API returns `403` for current private-repo plan; enable GitHub Pro or make repo public to activate branch protection.

## 11) V2 Backend Foundation (Vercel)
- Added V2 API namespace under `api/v2/*` for:
- auth (`register`, `login`, `refresh`, `logout`, `me`)
- portfolio/orders/trades/position close
- watchlists/alerts/settings/chat/audit
- market + news proxy routes
- migration import and cron maintenance
- Added shared server libraries in `api/_lib/*`:
- env validation (`zod`)
- postgres/drizzle client + schema
- redis cache/rate-limit wrapper
- JWT + refresh session utilities
- state repository helpers + guardrail evaluation
- Added Drizzle config and migration tooling:
- `drizzle.config.ts`
- npm scripts: `db:generate`, `db:migrate`, `db:studio`
- Added frontend V2 backend mode support:
- `VITE_BACKEND_MODE=off|shadow|on`
- backend auth API client and token refresh flow
- backend state sync orchestrator
- settings UI migration assistant (`Dry Run` + `Import to Backend`)
- Added backup/restore artifacts and documentation for V1 pre-V2 safety:
- `backups/hamafx-v1-b386ec6-20260207-1707.tar.gz`
- `backups/hamafx-pre-v2-working-tree-20260207-1707.tar.gz`
- `docs/V1_BACKUP_RESTORE.md`
- Added backend setup runbook:
- `docs/V2_BACKEND_SETUP.md`

## 12) V2 AI System Upgrade (Backend-Driven)
- Added unified backend AI orchestration library:
- `api/_lib/ai.ts`
- Added authenticated AI endpoints:
- `POST /api/v2/ai/chat`
- `GET /api/v2/ai/insights`
- `POST /api/v2/ai/analysis`
- `POST /api/v2/ai/sentiment`
- `POST /api/v2/ai/trade-eval`
- `GET /api/v2/ai/news-brief`
- Added frontend backend AI client:
- `src/services/backend/aiApi.ts`
- Updated AI service layer to backend-first with graceful fallback:
- `src/services/gemini.ts`
- Updated chat flow to structured responses (follow-ups + risk level):
- `src/services/chatService.ts`
- `src/stores/chatStore.ts`
- `src/components/AIChatDrawer.tsx`
- Upgraded AI-driven UX surfaces:
- `src/pages/Dashboard.tsx` now uses backend AI insights.
- `src/pages/News.tsx` now includes AI news brief card.
- `src/components/layout/Layout.tsx` and `src/pages/Settings.tsx` now reflect backend AI-connected status.
- Added new backend AI environment variable documentation:
- `GEMINI_API_KEY` in `.env.example` and `docs/V2_BACKEND_SETUP.md`.
- Added multi-provider backend fallback support:
- `AI_PROVIDER=auto` can now fail over from Gemini quota exhaustion to Groq/Scitely when configured.
- Added env knobs: `GROQ_API_KEY`, `GROQ_MODEL`, `SCITELY_API_KEY`, `SCITELY_MODEL`.
