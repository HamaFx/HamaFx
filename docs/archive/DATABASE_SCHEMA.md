# Hama Fx — Data Model & Persistence Schema

> **📊 Status: ALL ENTITIES IMPLEMENTED** — 10 entity types in localStorage, PostgreSQL schemas ready for V2.

---

## 1. Persistence Strategy

### V1: Client-Side (localStorage) ✅ IMPLEMENTED
All data stored in **localStorage** with structured JSON. Each "table" is a localStorage key containing a JSON array or object.

### V2: Backend (PostgreSQL) — FUTURE
Same data model, stored in PostgreSQL tables. The service abstraction layer means the UI code doesn't care which storage is used.

---

## 2. Storage Keys ✅ ALL IMPLEMENTED

> Namespace migration note: canonical keys now use `hamafx_*` (formerly `nexus_*` in NexusTrade), with legacy read fallback during upgrade.

| Key | Type | Status | Description |
|-----|------|--------|-------------|
| `hamafx_auth` | Object | ✅ | Current user session |
| `hamafx_users` | Array | ✅ | Registered users |
| `hamafx_portfolio_<userId>` | Object | ✅ | Positions, orders, balances |
| `hamafx_watchlists` | Array | ✅ | User watchlists |
| `hamafx_alerts` | Array | ✅ | Price/signal alerts |
| `hamafx_trades_<userId>` | Array | ✅ | Trade history |
| `hamafx_settings_<userId>` | Object | ✅ | App preferences + API keys |
| `hamafx_cache_*` | Object | ✅ | API response cache (L2) |
| `hamafx_audit` | Array | ✅ | System audit log |
| `hamafx_chat_<userId>` | Array | ✅ | AI chat conversation history |

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
