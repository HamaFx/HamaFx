> ⚠️ Historical planning document. For current implementation truth, start at `docs/README.md` and `docs/AI_PROJECT_GUIDE.md`.

# Hama Fx — Phased Implementation Plan

> **📊 Status: ALL PHASES COMPLETE** — 7 core phases + 5 UI/UX upgrade phases + 4 premium features. 0 build errors.

---

## Why Phases?

The build environment has a step limit per interaction. Each phase is designed to:
1. **Be self-contained** — builds successfully at end of each phase
2. **Deliver incremental value** — each phase adds visible features
3. **Minimize risk** — core infrastructure first, features second
4. **Stay within limits** — ~15-18 tool calls per phase
5. **Backend-ready** — every phase uses service interfaces, not direct implementations

---

## Phase Overview

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| **1** | Foundation | ✅ COMPLETE | Routing, layout, theme, auth, service interfaces |
| **2** | Market Data | ✅ COMPLETE | API clients, caching, market list, live prices, WebSocket |
| **3** | Charts & Analysis | ✅ COMPLETE | TradingView charts, indicators, Gemini AI integration |
| **4** | Paper Trading | ✅ COMPLETE | Order form, execution engine, portfolio, P&L |
| **5** | News & Calendar | ✅ COMPLETE | News feed, Gemini sentiment analysis, economic calendar |
| **6** | Advanced Features | ✅ COMPLETE | Watchlists, alerts, backtesting, audit log, API key management |
| **7** | Polish | ✅ COMPLETE | Animations, error states, accessibility, disclaimers |

### Premium Feature Phases

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| **A** | Market Heatmap | ✅ COMPLETE | Squarified treemap, 4 timeframes, 3 size modes |
| **B** | Risk Dashboard | ✅ COMPLETE | Risk score, VaR, Monte Carlo, correlation matrix, position sizer |
| **C** | Multi-Chart Terminal | ✅ COMPLETE | 1/2/4 panel layouts, independent asset/timeframe per panel |
| **D** | AI Chat Copilot | ✅ COMPLETE | Gemini chat, streaming text, markdown, follow-up suggestions |

### UI/UX Upgrade Phases

| Phase | Name | Status | Key Deliverables |
|-------|------|--------|-----------------|
| **U1** | Animation Foundation | ✅ COMPLETE | Price flash, number countUp, page transitions, stagger |
| **U2** | Premium Components | ✅ COMPLETE | PremiumButton/Card/Input/Modal/Toggle/Badge, glassmorphism |
| **U3** | Dashboard Bento | ✅ COMPLETE | Bento grid, hero portfolio card, top movers, glassmorphism |
| **U4** | Chart & Portfolio | ✅ COMPLETE | Crosshair tooltip, order lines, drawdown chart, daily P&L |
| **U5** | Final Polish | ✅ COMPLETE | AI chat streaming, toast spring physics, notification center |

---

## Phase 1: Foundation ✅ COMPLETE

**Delivered:**
- React Router with 14 routes
- Responsive layout (desktop sidebar + mobile bottom nav)
- Dark/light theme toggle
- Auth system (register, login, demo account)
- Settings page with API key management
- Zustand stores (auth, settings) with localStorage persistence
- Risk disclaimers on all pages
- Audit logging

---

## Phase 2: Market Data ✅ COMPLETE

**Delivered:**
- CoinGecko API client (25+ crypto assets)
- CoinCap API client (fallback + WebSocket streaming)
- ExchangeRate-API + Frankfurter (forex, 8 pairs)
- Two-tier cache (L1 memory → L2 localStorage with TTL)
- Rate limiter (per-API budgets)
- Market store with live crypto + forex state
- WebSocket auto-reconnect with exponential backoff
- Forex simulated ticks between polls
- Fallback chain: Primary → Fallback → Cache → Stale → Error UI

---

## Phase 3: Charts & Analysis ✅ COMPLETE

**Delivered:**
- TradingView Lightweight Charts (candlestick, line, area)
- 5 chart timeframes (1D, 7D, 1M, 3M, 1Y)
- 6 technical indicators (SMA, EMA, RSI, MACD, BB, Stochastic)
- Indicator toggle panel
- Gemini AI integration (gemini-2.0-flash)
- AI market analysis with signal, confidence, reasoning, SL/TP
- Rule-based fallback engine (multi-indicator confluence)
- AI source badges (🤖 AI-Powered vs 📊 Algorithm)
- AI response caching (5-min TTL)
- Complete Asset Detail page

---

## Phase 4: Paper Trading ✅ COMPLETE

**Delivered:**
- Portfolio store with full persistence
- Market/Limit/Stop order execution
- Long & Short positions
- Fee simulation (0.1% crypto, 0.01% forex)
- Realistic slippage (0.01-0.05%)
- Stop Loss / Take Profit per position
- Order form with Buy/Sell toggle, quick amounts
- Trade confirmation modal
- Portfolio page with equity curve, allocation pie, stats
- AI pre-trade evaluation via Gemini
- Recharts performance charts

---

## Phase 5: News & Calendar ✅ COMPLETE

**Delivered:**
- NewsData.io integration (when API key provided)
- 20 curated fallback articles with dynamic timestamps
- News category filtering (All, Crypto, Forex, Economy)
- News search
- Gemini sentiment analysis on headlines
- Keyword-based sentiment fallback (~50 weighted terms)
- Economic calendar with 28 event types
- 10 countries with flag emojis
- Impact ratings (High/Medium/Low)
- Calendar filters and list/grid views

---

## Phase 6: Advanced Features ✅ COMPLETE

**Delivered:**
- Watchlist store with multiple named lists
- Dedicated Watchlist page with add/remove, live prices
- Alert store with price above/below/% change
- Alert checking every 5 seconds against live prices
- Browser push notifications + in-app toasts
- Backtesting engine with 4 strategies (SMA Cross, RSI, MACD, EMA Trend)
- Equity curve, trade log, detailed performance stats
- API key management in Settings
- Audit log viewer
- JSON data export

---

## Phase 7: Polish ✅ COMPLETE

**Delivered:**
- Error boundary with crash recovery
- Toast notification system
- Onboarding wizard (4-step first-time flow)
- Accessibility (ARIA labels, keyboard nav, reduced motion, focus rings)
- Loading skeletons
- Risk disclaimers everywhere required

---

## Premium Features ✅ ALL COMPLETE

### Phase A: Market Heatmap ✅
- Squarified treemap algorithm (custom implementation)
- Color mapping: deep red (-10%) → gray (0%) → deep green (+10%)
- 3 size modes: Market Cap, Volume, Equal
- 4 timeframes: 1H, 24H, 7D, 30D
- Click-to-navigate to asset detail

### Phase B: Risk Dashboard ✅
- Risk score gauge (0-100)
- Value at Risk (VaR) calculation
- Maximum drawdown analysis
- Monte Carlo simulation (500 paths)
- Correlation matrix (color grid)
- Position size calculator
- Exposure breakdown (pie chart)

### Phase C: Multi-Chart Terminal ✅
- 3 layouts: Single, Dual (1×2), Quad (2×2)
- Independent asset/timeframe/chart type per panel
- Reuses TradingChart component
- Auto-downgrades on small screens

### Phase D: AI Chat Copilot ✅
- Slide-out drawer
- Full portfolio/market context injection
- Gemini-powered responses
- Streaming text effect (character-by-character)
- Markdown rendering
- Follow-up suggestion chips
- Copy message button
- Conversation history

---

## UI/UX Upgrades ✅ ALL COMPLETE

### Phase U1: Animation Foundation ✅
- Price flash animations (green uptick, red downtick)
- Number countUp/countDown with requestAnimationFrame
- Page fade-up transitions
- Staggered list animations
- Live glow pulse on WebSocket indicator
- Reduced motion support

### Phase U2: Premium Components ✅
- PremiumButton (5 variants, 3 sizes, glow hover, press-down)
- PremiumCard (glassmorphism, hover lift, glow border)
- PremiumInput (floating label, focus glow, error shake)
- PremiumModal (backdrop blur, scale-in)
- PremiumToggle (gradient track, spring knob)
- PremiumBadge (7 colors, pulsing dot)
- StatCard, SectionHeader, TabBar, EmptyState, GlassDivider, Skeleton
- CSS: glassmorphism, gradient text, premium shadows

### Phase U3: Dashboard Bento ✅
- 4-column bento grid layout
- Hero portfolio card with sparkline
- Top gainers/losers widgets
- Watchlist widget with live prices
- AI insights card
- Recent trades widget
- Alerts summary
- News headlines
- Market overview strip

### Phase U4: Charts & Portfolio ✅
- Crosshair OHLCV tooltip overlay
- Current price horizontal line
- Order price lines (entry/SL/TP)
- Zoom controls (mouse wheel, pinch, drag)
- Double-click to reset view
- Portfolio drawdown chart
- Daily P&L bar chart
- Benchmark comparison line
- Position sorting

### Phase U5: Final Polish ✅
- AI streaming text effect (15ms per character)
- Markdown parsing (bold, headers, bullets, code)
- Follow-up suggestion chips after AI response
- Toast spring physics animation
- Toast progress bar countdown
- Toast stacking (max 5)
- Notification time grouping (Today, Yesterday, etc.)
- Bell pulse animation for unread
- Alert sound via Web Audio API (440Hz→880Hz sweep)

---

## Final Build Stats

- **Total files:** ~95
- **Bundle size:** 348KB gzipped
- **Build errors:** 0
- **Pages:** 14
- **Stores:** 7
- **API integrations:** 5 (CoinGecko, CoinCap, ExchangeRate, Frankfurter, Gemini)
- **Technical indicators:** 6
- **Backtest strategies:** 4
- **Premium components:** 12

---

## Backend Migration Checklist (Post-V1 — FUTURE)

When ready to add a backend, the developer needs to:

- [ ] Set up Express/NestJS server
- [ ] Set up PostgreSQL with schemas from `DATABASE_SCHEMA.md`
- [ ] Set up Redis for caching
- [ ] Move Gemini API key to server `.env`
- [ ] Create `Backend*Service` classes implementing same interfaces
- [ ] Update service registry to use backend adapters
- [ ] Add `VITE_API_BASE_URL` environment variable
- [ ] Remove "API Keys" settings section
- [ ] Test all flows end-to-end
- [ ] **Zero UI component changes needed** ✅
