# NexusTrade — API Integrations & Data Sources

> **📊 Status: ALL INTEGRATIONS COMPLETE** — 5 APIs integrated, caching + rate limiting + fallbacks all working.

---

## 1. Design Principles ✅ ALL IMPLEMENTED

- ✅ **Free tier only** — no upfront paid API keys required
- ✅ **User-provided keys** — users supply their own Gemini key and optionally NewsData.io key
- ✅ **CORS-friendly** — all APIs work from browser without proxy
- ✅ **Multiple fallbacks** — every data type has ≥2 sources
- ✅ **Graceful degradation** — if all APIs fail, use cached/mock data with clear indicator
- ✅ **Client-side rate limiting** — per-API budgets enforced
- ✅ **Backend-ready** — all API calls go through service interfaces

---

## 2. Market Data APIs

### 2.1 Cryptocurrency — CoinGecko (Primary) ✅ IMPLEMENTED

| Attribute | Detail | Status |
|-----------|--------|--------|
| **Base URL** | `https://api.coingecko.com/api/v3` | ✅ |
| **Auth** | None required (free tier) | ✅ |
| **CORS** | ✅ Supported | ✅ |
| **Rate Limit** | 10-30 calls/minute (free) | ✅ Throttled to 8/min |

**Endpoints Implemented:**

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /coins/markets` | Top coins with price, market cap, 24h change | ✅ |
| `GET /coins/{id}/market_chart` | Historical data for charts | ✅ |
| `GET /coins/{id}/ohlc` | OHLC candlestick data | ✅ |
| `GET /simple/price` | Quick price lookup | ✅ |

### 2.2 Cryptocurrency — CoinCap (Fallback + WebSocket) ✅ IMPLEMENTED

| Attribute | Detail | Status |
|-----------|--------|--------|
| **REST URL** | `https://api.coincap.io/v2` | ✅ |
| **WebSocket** | `wss://ws.coincap.io/prices?assets={ids}` | ✅ |
| **Auto-reconnect** | Exponential backoff (1s → 30s max) | ✅ |

### 2.3 Forex — ExchangeRate-API (Primary) ✅ IMPLEMENTED

| Attribute | Detail | Status |
|-----------|--------|--------|
| **Base URL** | `https://open.er-api.com/v6` | ✅ |
| **Pairs** | EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD, EUR/GBP | ✅ |
| **Simulated ticks** | Micro-movements between polls | ✅ |

### 2.4 Forex — Frankfurter (Fallback + Historical) ✅ IMPLEMENTED

| Attribute | Detail | Status |
|-----------|--------|--------|
| **Base URL** | `https://api.frankfurter.app` | ✅ |
| **Historical data** | Time series for charting & backtesting | ✅ |

---

## 3. AI / LLM APIs

### 3.1 Google Gemini ✅ IMPLEMENTED

| Attribute | Detail | Status |
|-----------|--------|--------|
| **Model** | `gemini-2.0-flash` | ✅ |
| **Auth** | User-provided API key | ✅ |
| **Free Tier** | 15 req/min, 1,500 req/day | ✅ Budgeted to ~8/min |

**Use Cases Implemented:**

| Use Case | Status | Details |
|----------|--------|---------|
| Market Analysis | ✅ | Signal, confidence, reasoning, SL/TP, support/resistance |
| Sentiment Analysis | ✅ | Score -100 to +100, key themes, impact assessment |
| Trade Evaluation | ✅ | Risk rating, position size assessment, diversification |
| AI Chat Copilot | ✅ | Conversational analysis with portfolio context |

### 3.2 Rule-Based Fallback Engine ✅ IMPLEMENTED
- Multi-indicator confluence scoring (RSI + MACD + BB + SMA + Volume)
- Used when no Gemini API key is configured
- Shows "📊 Algorithm-Based" badge vs "🤖 AI-Powered"

---

## 4. News APIs

### 4.1 NewsData.io ✅ IMPLEMENTED
- Live news when user provides API key
- Category filtering (crypto, forex, economy)

### 4.2 Curated Fallback ✅ IMPLEMENTED
- 20+ realistic financial articles with dynamic timestamps
- Clearly marked as "Sample Data"
- Keyword-based sentiment scoring (~50 weighted terms)

---

## 5. Economic Calendar ✅ IMPLEMENTED

- 28 recurring event types across 10 countries
- Dynamic date projection from known schedules
- Impact ratings (High/Medium/Low)
- No external API needed (curated dataset)

---

## 6. Real-Time Data Strategy ✅ IMPLEMENTED

| Method | Source | Status |
|--------|--------|--------|
| WebSocket streaming | CoinCap (crypto) | ✅ With auto-reconnect |
| Polling (30-60s) | CoinGecko, ExchangeRate | ✅ |
| Simulated ticks | Forex (between polls) | ✅ |

---

## 7. Rate Limiting ✅ IMPLEMENTED

| API | Our Budget | Status |
|-----|-----------|--------|
| CoinGecko | 8/min | ✅ |
| CoinCap REST | 20/min | ✅ |
| ExchangeRate-API | 30/day | ✅ |
| Frankfurter | 60/hour | ✅ |
| Gemini | 8/min | ✅ |
| NewsData.io | 50/day | ✅ |

---

## 8. Caching ✅ IMPLEMENTED

Two-tier cache: L1 (memory) → L2 (localStorage) with per-endpoint TTLs.

---

## 9. Error Handling ✅ IMPLEMENTED

Fallback chain: Primary API → Fallback API → Cached Data → Stale Cache → Error UI with retry button.

---

## 10. Data Attribution ✅ IMPLEMENTED

All data sources attributed in app footer and relevant pages.
