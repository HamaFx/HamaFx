# NexusTrade — Data Model & Persistence Schema

> **📊 Status: ALL ENTITIES IMPLEMENTED** — 10 entity types in localStorage, PostgreSQL schemas ready for V2.

---

## 1. Persistence Strategy

### V1: Client-Side (localStorage) ✅ IMPLEMENTED
All data stored in **localStorage** with structured JSON. Each "table" is a localStorage key containing a JSON array or object.

### V2: Backend (PostgreSQL) — FUTURE
Same data model, stored in PostgreSQL tables. The service abstraction layer means the UI code doesn't care which storage is used.

---

## 2. Storage Keys ✅ ALL IMPLEMENTED

| Key | Type | Status | Description |
|-----|------|--------|-------------|
| `nexus_auth` | Object | ✅ | Current user session |
| `nexus_users` | Array | ✅ | Registered users |
| `nexus_portfolio` | Object | ✅ | Positions, orders, balances |
| `nexus_watchlists` | Array | ✅ | User watchlists |
| `nexus_alerts` | Array | ✅ | Price/signal alerts |
| `nexus_trades` | Array | ✅ | Trade history |
| `nexus_settings` | Object | ✅ | App preferences + API keys |
| `nexus_cache` | Object | ✅ | API response cache (L2) |
| `nexus_audit` | Array | ✅ | System audit log |
| `nexus_chat` | Array | ✅ | AI chat conversation history |

---

## 3. Entities ✅ ALL IMPLEMENTED

| Entity | Fields | Status |
|--------|--------|--------|
| User | id, email, username, passwordHash, createdAt, lastLoginAt | ✅ |
| Portfolio | virtualBalance, positions[], orders[], balanceHistory[] | ✅ |
| Position | id, symbol, side, quantity, entryPrice, currentPrice, SL/TP | ✅ |
| Order | id, symbol, type, side, quantity, price, status | ✅ |
| TradeRecord | id, symbol, side, price, quantity, fee, pnl, executedAt | ✅ |
| Watchlist | id, name, symbols[], createdAt | ✅ |
| Alert | id, symbol, type, targetValue, isTriggered, isActive | ✅ |
| AuditEntry | id, action, details, metadata, timestamp | ✅ |
| AppSettings | theme, notifications, trading, display, ai, apiKeys | ✅ |
| ChatMessage | id, role, content, timestamp | ✅ |

---

## 4. Audit Actions Tracked ✅

- LOGIN, LOGOUT, REGISTER
- TRADE_EXECUTED, ORDER_PLACED, ORDER_CANCELLED
- ALERT_CREATED, ALERT_TRIGGERED
- WATCHLIST_MODIFIED
- SETTINGS_CHANGED, PORTFOLIO_RESET
- API_KEY_ADDED, API_KEY_REMOVED
- AI_ANALYSIS_REQUESTED, DATA_EXPORTED

---

## 5. PostgreSQL Schemas — READY FOR V2

All CREATE TABLE statements documented with proper indexes, foreign keys, and JSONB columns for flexible data. See full SQL in the detailed schema section below.

(Full SQL schemas preserved from original document for V2 migration reference.)
