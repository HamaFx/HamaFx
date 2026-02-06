# NexusTrade — Forex & Crypto Trading Platform
## Master Project Plan

> **📊 V1 Status: COMPLETE + V1.1 HARDENING ACTIVE** — All P0/P1 features implemented. PR quality gate, mobile E2E smoke, mobile UX polish, split-chunk build, and risk guardrails are now implemented in frontend scope.

---

## 1. Executive Summary

**NexusTrade** is a production-grade, browser-based trading intelligence platform that combines live forex and crypto market data, real-time news, **LLM-powered AI analysis (Google Gemini)**, paper trading, and portfolio management into a single, polished mobile-first experience. The app targets retail traders who want institutional-grade tools without the complexity.

> **Deployment Note:** V1 is a front-end SPA deployed as a static bundle. However, **every service is behind an abstraction layer (interface → adapter pattern)** so the entire backend can be swapped from localStorage/direct-API to a real server without changing any UI code.

### V1.1 Hardening Snapshot (Priorities 3-7)
- CI quality gate: GitHub Actions workflow runs lint, typecheck, unit/integration tests, build, build stats, and bundle-budget check.
- Mobile E2E harness: Playwright iPhone 13 + WebKit smoke suite for auth, trade flow, portfolio close, and alerts/settings.
- Mobile UX: safe-area handling, 44px touch targets, better keyboard behavior on core forms, sticky trade submit on mobile.
- Performance: route-level lazy loading and vendor split chunks (`vendor-react`, `vendor-utils`, `vendor-lightweight-charts`, `vendor-recharts`).
- Risk controls: hybrid guardrails (hard blocks + warnings) wired in both UI pre-check and store-level enforcement.
- Backend remains deferred to V2.

---

## 2. Assumptions & Constraints

| # | Assumption | Rationale | Status |
|---|-----------|-----------|--------|
| A1 | **No dedicated backend server in V1** — the app runs in the browser. But **all services are abstracted behind interfaces** so a backend can be plugged in without UI changes | Deployment target is static dist/index.html, but future-proofing is a core requirement | ✅ Implemented |
| A2 | **Free-tier APIs only** — CoinGecko, CoinCap, Frankfurter, Gemini Free | Demo/showcase context | ✅ Implemented |
| A3 | **User-provided API keys** — users enter their own Gemini API key (and optionally others) via Settings → API Keys. Keys stored in localStorage | Cannot hide secrets without a backend; this is the standard pattern for client-side AI tools | ✅ Implemented |
| A4 | **Paper trading only** — no real money, no brokerage integration | Risk mitigation, legal compliance | ✅ Implemented |
| A5 | **Google Gemini (Free Tier)** for AI analysis — 15 req/min, 1,500 req/day | Real LLM-powered insights; falls back to rule-based if no key provided | ✅ Implemented |
| A6 | **WebSocket streaming** — CoinCap WebSocket for crypto; polling + simulated ticks for forex | Many free APIs don't offer true WebSockets for forex | ✅ Implemented |
| A7 | **USD as base currency** for all portfolio calculations | Simplification | ✅ Implemented |
| A8 | **English only** for V1 | Scope management | ✅ Implemented |

---

## 3. Backend-Ready Architecture Philosophy

### The Problem
V1 runs entirely client-side, but this is a **temporary constraint**. The architecture must allow us to add a backend (Node/Express/NestJS + PostgreSQL + Redis) without rewriting UI code.

### The Solution: Service Abstraction Layer ✅ IMPLEMENTED

Every piece of business logic goes through an **interface** with two implementations:

```
┌───────────────────────────────────────────┐
│              UI Components                 │
│     (React — never touches APIs directly) │
└──────────────────┬────────────────────────┘
                   │ calls
┌──────────────────▼────────────────────────┐
│         Service Interfaces                 │
│  IAuthService, IMarketService,            │
│  ITradingService, INewsService,           │
│  IAnalysisService, IStorageService        │
└──────────┬───────────────┬────────────────┘
           │               │
    ┌──────▼──────┐ ┌──────▼──────┐
    │  Client     │ │  Backend    │
    │  Adapter    │ │  Adapter    │
    │  (V1) ✅    │ │  (Future)   │
    │             │ │             │
    │ localStorage│ │ REST API    │
    │ Direct API  │ │ calls to    │
    │ Gemini      │ │ your own    │
    │ direct      │ │ server      │
    └─────────────┘ └─────────────┘
```

---

## 4. Requirements

### 4.1 Functional Requirements

| ID | Feature | Priority | Status | Description |
|----|---------|----------|--------|-------------|
| F1 | **Live Market Data** | P0 | ✅ DONE | CoinGecko + CoinCap (crypto), ExchangeRate-API + Frankfurter (forex), WebSocket streaming |
| F2 | **Interactive Charts** | P0 | ✅ DONE | TradingView Lightweight Charts — candlestick, line, area with zoom, pan, crosshair tooltip |
| F3 | **Technical Indicators** | P0 | ✅ DONE | SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic — all calculated client-side |
| F4 | **Live News Feed** | P0 | ✅ DONE | NewsData.io (with key) + curated fallback, category filtering, search |
| F5 | **AI Trading Signals (Gemini LLM)** | P0 | ✅ DONE | Gemini-powered BUY/SELL/HOLD with confidence, reasoning, SL/TP. Rule-based fallback |
| F6 | **Paper Trading** | P0 | ✅ DONE | $100K virtual, market/limit/stop orders, long/short, fees, slippage |
| F7 | **Portfolio Dashboard** | P0 | ✅ DONE | Equity curve, drawdown chart, daily P&L bars, allocation pie, positions, trade history |
| F8 | **Watchlists** | P1 | ✅ DONE | Multiple named watchlists, add/remove assets, live prices, dedicated page |
| F9 | **Alerts & Notifications** | P1 | ✅ DONE | Price above/below/% change, browser notifications, in-app toasts, notification center, alert sound |
| F10 | **Sentiment Analysis (Gemini LLM)** | P1 | ✅ DONE | Gemini sentiment on news headlines, keyword-based fallback |
| F11 | **Economic Calendar** | P1 | ✅ DONE | 28 event types, 10 countries, impact filters, list/grid views |
| F12 | **Backtesting Engine** | P2 | ✅ DONE | 4 strategies (SMA Cross, RSI, MACD, EMA Trend), equity curve, trade log, stats |
| F13 | **User Accounts** | P1 | ✅ DONE | Register, login, demo account, profile management, localStorage persistence |
| F14 | **Audit Logs** | P2 | ✅ DONE | All trades, auth events, alert triggers, settings changes logged with timestamps |
| F15 | **Multi-Asset Support** | P0 | ✅ DONE | 25+ crypto (CoinGecko) + 8 forex pairs |
| F16 | **Risk Disclaimers** | P0 | ✅ DONE | On every AI card, signal page, trade form, page footers |
| F17 | **Dark/Light Theme** | P1 | ✅ DONE | Manual toggle in header + settings page |
| F18 | **Responsive Design** | P0 | ✅ DONE | Mobile-first, bottom nav mobile, sidebar desktop, 320px–4K |
| F19 | **API Key Management** | P0 | ✅ DONE | Settings page with Gemini + NewsData key entry, validation, masked display |
| F20 | **Data Export** | P2 | ✅ DONE | JSON export of all app data from Settings |

### 4.2 Premium Features (Added Post-Plan)

| ID | Feature | Status | Description |
|----|---------|--------|-------------|
| F21 | **Market Heatmap** | ✅ DONE | Squarified treemap, color-coded performance, 4 timeframes, 3 size modes |
| F22 | **Multi-Chart Terminal** | ✅ DONE | 1/2/4 panel layouts, independent asset/timeframe per panel |
| F23 | **Risk Dashboard** | ✅ DONE | Risk score, VaR, max drawdown, Monte Carlo simulation, correlation matrix, position sizer |
| F24 | **AI Chat Copilot** | ✅ DONE | Gemini chat with portfolio context, streaming text, markdown, follow-up suggestions |
| F25 | **Global Search** | ✅ DONE | `/` keyboard shortcut, search all assets, overlay modal |
| F26 | **Notification Center** | ✅ DONE | Bell icon dropdown, time grouping, unread badge, mark all read |
| F27 | **Onboarding Wizard** | ✅ DONE | 4-step first-time flow, API key setup, demo account |

### 4.3 Non-Functional Requirements

| ID | Requirement | Target | Status |
|----|------------|--------|--------|
| NF1 | **First Contentful Paint** | < 1.5s | ✅ Improved (smaller entry chunk + lazy routes) |
| NF2 | **Lighthouse Performance** | > 90 | ✅ Expected (small bundle, no render-blocking) |
| NF3 | **Bundle Size** | < 2MB gzipped | ✅ Met (split chunks; entry ~22KB gzip, total dist ~360KB gzip) |
| NF4 | **Accessibility** | WCAG 2.1 AA | ✅ ARIA labels, keyboard nav, reduced motion, focus rings |
| NF5 | **Browser Support** | Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ | ✅ Standard React/Vite output |
| NF6 | **Offline Resilience** | Graceful degradation with cached data | ✅ Two-tier cache, stale fallback |
| NF7 | **API Failure Handling** | Retry + fallback + notification | ✅ Fallback chain per API, error UI |
| NF8 | **Rate Limiting** | Client-side per API | ✅ Per-API budgets enforced |
| NF9 | **Data Caching** | In-memory + localStorage with TTL | ✅ L1 memory + L2 localStorage |
| NF10 | **Backend Portability** | Zero UI changes to add backend | ✅ Service interface pattern |
| NF11 | **PR Quality Gate** | Mandatory lint/type/test/build | ✅ GitHub Actions enforced |
| NF12 | **Mobile E2E Smoke on PR** | iPhone viewport critical flows | ✅ Playwright suite + CI job |

---

## 5. Technology Stack ✅ ALL IMPLEMENTED

### 5.1 Frontend (Core)

| Technology | Version | Status |
|-----------|---------|--------|
| **React 19** | 19.x | ✅ |
| **TypeScript** | 5.x | ✅ |
| **Vite** | 7.x | ✅ |
| **Tailwind CSS 4** | 4.x | ✅ |

### 5.2 Key Libraries

| Library | Purpose | Status |
|---------|---------|--------|
| **Lightweight Charts (TradingView)** | Financial charts | ✅ |
| **Zustand** | State management | ✅ |
| **React Router** | Client-side routing | ✅ |
| **Lucide React** | Icons | ✅ |
| **Recharts** | Analytics charts | ✅ |
| **ESLint + TypeScript ESLint** | Static quality gate | ✅ |
| **Playwright** | Mobile E2E automation | ✅ |

### 5.3 AI / LLM

| Service | Purpose | Status |
|---------|---------|--------|
| **Google Gemini (gemini-2.0-flash)** | Market analysis, sentiment, chat | ✅ |
| **Rule-based fallback engine** | Indicator confluence scoring | ✅ |

---

## 6. Architecture Overview ✅ IMPLEMENTED

(Architecture diagram unchanged — see original above)

### 6.1 V1.1 Enforcement and Runtime Guardrails
- CI quality workflow: `.github/workflows/ci.yml`
- Nightly E2E workflow: `.github/workflows/e2e-nightly.yml`
- Risk policy service: `src/services/riskGuardrails.ts`
- Store-level enforcement: `src/stores/portfolioStore.ts` (`placeOrder`, `checkPendingOrders`)
- UI guardrail feedback and warning acknowledgement: `src/components/trading/OrderForm.tsx`
- User-configurable guardrail policy: `src/pages/Settings.tsx`

---

## 7. API Key Management ✅ IMPLEMENTED

- Settings → API Keys page with Gemini + NewsData entry
- Key validation with test request
- Masked display (last 4 chars)
- Graceful fallback when no key provided

---

## 8. Risk Disclaimers ✅ IMPLEMENTED

- Persistent banners on signal/analysis pages
- AI-specific disclaimers
- Footer disclaimer on every page
- Pre-trade confirmation modal
- Risk disclaimer on every AI card

---

## 9. Security Considerations ✅ V1 MITIGATIONS IN PLACE

| Concern | V1 Mitigation | Status |
|---------|--------------|--------|
| API keys exposure | User-provided keys | ✅ |
| XSS | React built-in escaping | ✅ |
| Data integrity | Input validation | ✅ |
| Auth simulation | Clear demo indicators | ✅ |
| CORS | CORS-friendly APIs only | ✅ |
| Rate limiting | Client-side throttling | ✅ |
| Risk policy violations | Hard blocks + audit trail + warning acknowledgement | ✅ |

---

## 10. Deployment Plan

### V1 (Static SPA) ✅ COMPLETE
1. ✅ `npm run build` → produces `dist/index.html`
2. ✅ Served as static file
3. ✅ Client-side API calls
4. ✅ User provides own Gemini API key
5. ✅ CI/CD quality gate via GitHub Actions (`ci.yml`, `e2e-nightly.yml`)

### V2 (Add Backend) — FUTURE
- Express/NestJS API server
- PostgreSQL + Redis
- Server-side API keys
- Real JWT authentication

### V3 (Scale) — FUTURE
- WebSocket server
- Push notifications
- Server-side alert checking
- Multi-region deployment

---

## 11. Risk Mitigations

| Risk | Status | Mitigation |
|------|--------|------------|
| API rate limiting | ✅ Mitigated | Client-side throttling, caching, fallback data |
| API unavailability | ✅ Mitigated | Multiple fallback APIs, cached last-known data |
| Gemini API failures | ✅ Mitigated | Rule-based fallback engine |
| Bundle too large | ✅ Mitigated | Split-chunk build, entry ~22KB gzip, total dist ~360KB gzip |
| CORS blocking | ✅ Mitigated | Only CORS-friendly APIs used |
| Browser storage limits | ✅ Mitigated | Reasonable data sizes, TTL eviction |
| Build timeout | ✅ Mitigated | Phased implementation completed |
| Invalid API key | ✅ Mitigated | Validation before saving |
| LLM hallucination | ✅ Mitigated | Strong disclaimers, structured prompts |
| Frontend trading risk misuse | ✅ Mitigated | Guardrail hard blocks + warnings + audit actions |

---

## 12. Success Metrics

- [x] All P0 features functional
- [x] Build succeeds without errors
- [x] Mobile-responsive (tested at 375px, 768px, 1440px)
- [x] Charts render with live data or graceful fallback
- [x] AI analysis works with Gemini key (and gracefully without)
- [x] Paper trading executes correctly
- [x] All risk disclaimers present
- [x] Dark/light theme works
- [x] No console errors in production build
- [x] Service interfaces documented for backend migration
- [x] `npm run check` parity with CI quality gate
- [x] Mobile smoke E2E specs authored and wired into PR workflow
- [x] Hybrid risk guardrails enforced in UI and store paths
