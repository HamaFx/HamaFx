# Forex Compatibility Reference (V2)

## 1) Scope and Mode Behavior

HamaFX forex behavior is backend-first in:

- `VITE_BACKEND_MODE=on`
- `VITE_BACKEND_MODE=shadow`

In backend modes:

- Quotes and candles come from `/api/v2/market/forex/*`.
- 24h change is provider-derived (not random).
- Random local forex tick simulation is disabled.

In `VITE_BACKEND_MODE=off`:

- Local provider fallback is allowed.
- Simulated ticks are allowed only as degraded local behavior.

## 2) Canonical Pair Catalog

Pair definitions are centralized and shared:

- Frontend: `src/config/forexCatalog.ts`
- Backend: `api/_lib/forex/catalog.ts`

Each pair includes:

- `pipSize`, `pipetteSize`
- `displayPrecision`, `priceStep`
- `sessionGroup`, `rank`, `isMajor`
- `typicalSpreadPips`
- symbol aliases and normalization mapping

Compatibility:

- `EUR/USD`, `eurusd`, `EURUSD` all resolve to canonical `EURUSD`.
- Legacy ids like `eurusd` remain valid.

## 3) Forex API Contracts

Canonical endpoints:

- `GET /api/v2/market/forex/pairs`
- `GET /api/v2/market/forex/quotes?symbols=EURUSD,GBPUSD`
- `GET /api/v2/market/forex/candles?symbol=EURUSD&interval=1h&range=30d`

Compatibility endpoint:

- `GET /api/v2/market/forex?mode=latest|history|pairs|quotes|candles`

Quote payload fields include:

- `mid`, optional `bid`, `ask`
- `spreadPips`
- `change24h`, `changePercent24h`, `pipMove24h`
- `source`, `stale`, `lastUpdated`
- `marketStatus`, `sessionLabel`, `sessionNextTransitionAt`

Candles payload includes:

- `quality`: `provider_ohlc` or `derived_close_only`
- `source`
- sorted candle array (`time`, `open`, `high`, `low`, `close`)

## 4) Provider and Fallback Model

Backend provider chain:

- Primary latest rates: ExchangeRate-API
- Fallback latest/history: Frankfurter
- Optional enhanced candles: Alpha Vantage (`ALPHA_VANTAGE_API_KEY`)

Caching:

- short TTL for quotes
- medium TTL for candles
- stale flag computed from session-aware max age

## 5) Session and Market Hours

Session engine states:

- `open`
- `thin_liquidity`
- `rollover`
- `weekend_closed`

Used in:

- backend quotes metadata
- frontend Markets and Asset Detail session badges/warnings

Weekend and rollover periods intentionally surface `stale`/session context instead of implying broken data.

## 6) Trading Precision and Pip Semantics

Forex math utilities:

- `src/utils/forexMath.ts`
- `api/_lib/forex/math.ts`

Key behavior:

- pair-specific rounding (`priceStep`, `displayPrecision`)
- pip conversion helpers (`pipsToPrice`, `priceToPips`)
- lot helpers (micro/mini/standard display)
- USD notional conversion for non-USD quote pairs

Server-side execution and close logic apply forex normalization and USD notional conversion via:

- `api/_lib/trading.ts`

## 7) UI Compatibility Upgrades

Updated forex-aware surfaces:

- `Markets`: spread (pips), pip move, session status, stale/source badges
- `AssetDetail`: candle quality/source, forex line fallback when OHLC is derived-only
- `OrderForm`: pair precision, step enforcement, lot helpers, pip SL/TP presets
- `Alerts`: `pip_distance` trigger mode for forex pairs
- `Watchlist` and `GlobalSearch`: alias-aware symbol lookup and precision formatting

## 8) Testing Coverage

Automated forex tests now include:

- catalog normalization/legacy mapping
- session state transitions
- forex math (pips, rounding, lot conversion, USD notionals)
- market handler route coverage for compatibility and canonical forex endpoints
