# Hama Fx — Architecture Decision Records

> **📊 Status: ALL 13 ADRs IMPLEMENTED**

---

## ADR-001: Client-Side SPA with Backend-Ready Abstraction ✅ IMPLEMENTED
- **Decision:** Build as static SPA with service interface layer for future backend swap
- **Result:** All services behind interfaces. One-file swap to add backend.

## ADR-002: Zustand over Redux ✅ IMPLEMENTED
- **Decision:** Use Zustand for state management
- **Result:** 7 stores (auth, settings, market, portfolio, watchlist, alert, chat) with localStorage persistence

## ADR-003: TradingView Lightweight Charts ✅ IMPLEMENTED
- **Decision:** Use Lightweight Charts v5 for financial charting
- **Result:** Candlestick/line/area charts with 6 indicators, crosshair tooltip, zoom/pan

## ADR-004: Google Gemini for AI ✅ IMPLEMENTED
- **Decision:** Use Gemini 2.0 Flash (free tier) for AI analysis
- **Result:** Market analysis, sentiment, trade evaluation, chat copilot all working

## ADR-005: Dual AI Engine ✅ IMPLEMENTED
- **Decision:** Gemini primary + rule-based fallback
- **Result:** App works with or without API key, clear source badges

## ADR-006: User-Provided API Keys ✅ IMPLEMENTED
- **Decision:** Users enter their own API keys via Settings
- **Result:** Gemini + NewsData key management with validation

## ADR-007: Two-Tier Caching ✅ IMPLEMENTED
- **Decision:** L1 memory + L2 localStorage with TTL
- **Result:** Reduces API calls, enables offline resilience

## ADR-008: CoinCap WebSocket for Real-Time ✅ IMPLEMENTED
- **Decision:** Use CoinCap WebSocket for crypto streaming, polling for forex
- **Result:** Auto-reconnect with exponential backoff, simulated forex ticks

## ADR-009: Client-Side Technical Indicators ✅ IMPLEMENTED
- **Decision:** Calculate all indicators in browser (no backend needed)
- **Result:** SMA, EMA, RSI, MACD, BB, Stochastic — pure TypeScript functions

## ADR-010: LLM-Powered Sentiment Analysis ✅ IMPLEMENTED
- **Decision:** Use Gemini for sentiment, keyword-based fallback
- **Result:** Score -100 to +100, key themes, impact assessment

## ADR-011: Paper Trading Engine ✅ IMPLEMENTED
- **Decision:** Client-side order execution with realistic slippage and fees
- **Result:** Market/limit/stop orders, long/short, SL/TP, 0.1% crypto / 0.01% forex fees

## ADR-012: Custom UI Components (No Library) ✅ IMPLEMENTED
- **Decision:** Build custom Tailwind components instead of using a UI library
- **Result:** Full design control, smaller bundle, premium glassmorphism aesthetic

## ADR-013: Service Interface Design Principles ✅ IMPLEMENTED
- **Decision:** All services async, domain-typed, no implementation leakage
- **Result:** Clean interfaces ready for backend adapter swap
