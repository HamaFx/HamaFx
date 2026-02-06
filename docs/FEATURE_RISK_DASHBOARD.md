# Feature: Risk Management Dashboard

> **📊 Status: ✅ COMPLETE**

## Implementation
- `src/utils/riskCalculations.ts` — Pure math functions for all risk metrics
- `src/pages/RiskDashboard.tsx` — Full analytics page with charts and widgets

## Features Delivered
- ✅ Composite risk score (0-100) with color-coded gauge
- ✅ Value at Risk (VaR) — 95% confidence historical simulation
- ✅ Maximum drawdown calculation from portfolio peak
- ✅ Monte Carlo simulation — 500 random paths projected forward
- ✅ Correlation matrix — NxN color grid between held assets
- ✅ Position size calculator — risk-based sizing with auto-fill
- ✅ Exposure breakdown — pie chart (long/short, crypto/forex, cash)
- ✅ Recharts visualizations for equity, Monte Carlo fan, drawdown
- ✅ Risk disclaimers present
