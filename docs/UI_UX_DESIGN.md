# Hama Fx — UI/UX Design System

> **📊 Status: COMPLETE** — 14 pages, 60+ components, premium design system, full accessibility.

---

## 1. Design Philosophy ✅ IMPLEMENTED

- ✅ **Mobile-first** — bottom nav on mobile, sidebar on desktop
- ✅ **Dark mode primary** — professional trading aesthetic
- ✅ **Information dense but not cluttered** — bento grid dashboard
- ✅ **Glassmorphism** — frosted glass cards with backdrop-blur
- ✅ **Animated** — price flashes, number countUp, page transitions, stagger

---

## 2. Design System ✅ IMPLEMENTED

### Colors
- Background: `#0a0a0f` (dark) / `#f8f9fa` (light)
- Cards: Glass effect with `backdrop-blur` and semi-transparent backgrounds
- Profit: Emerald gradient (`#10b981` → `#34d399`)
- Loss: Rose gradient (`#ef4444` → `#f87171`)
- AI/Premium: Purple/Indigo (`#8b5cf6` → `#6366f1`)
- Accent: Gold (`#f59e0b`) for premium features

### Typography
- **Headlines:** System sans-serif with tight letter-spacing
- **Numbers:** JetBrains Mono (monospace) for all prices, values, percentages
- **Body:** System font stack

### Animations
- Price flash: green/red background highlight on tick (300ms)
- Number countUp: smooth interpolation via requestAnimationFrame
- Page transition: fade-up (200ms ease-out)
- Stagger: cards appear 30-50ms apart
- Button press: scale(0.97) on active
- Card hover: translateY(-2px) with shadow increase
- Modal: scale-in with backdrop blur
- Toast: spring physics (`cubic-bezier(0.34, 1.56, 0.64, 1)`)

---

## 3. Pages ✅ ALL 14 IMPLEMENTED

| Page | Route | Status | Key Features |
|------|-------|--------|-------------|
| Login | `/login` | ✅ | Register/Login forms, demo account button |
| Dashboard | `/` | ✅ | Bento grid, hero portfolio card, top movers, watchlist, AI card, news, alerts |
| Markets | `/markets` | ✅ | 25+ crypto + 8 forex, search, filters, sort, grid/list, premium cards |
| Asset Detail | `/asset/:id` | ✅ | TradingView chart, indicators, AI analysis, order form, stats |
| Portfolio | `/portfolio` | ✅ | Equity curve, drawdown, daily P&L, positions, trade history, allocation pie |
| Heatmap | `/heatmap` | ✅ | Treemap visualization, 4 timeframes, 3 size modes |
| Terminal | `/terminal` | ✅ | Multi-chart 1/2/4 panels, independent controls |
| Risk | `/risk` | ✅ | Risk score, VaR, Monte Carlo, correlation, position sizer |
| Watchlist | `/watchlist` | ✅ | Multiple named lists, add/remove, live prices |
| Alerts | `/alerts` | ✅ | Create/manage alerts, browser notifications |
| News | `/news` | ✅ | Live feed + fallback, sentiment, categories, search |
| Calendar | `/calendar` | ✅ | 28 events, 10 countries, impact filters, list/grid |
| Backtest | `/backtest` | ✅ | 4 strategies, equity curve, trade log, stats |
| Settings | `/settings` | ✅ | API keys, theme, profile, data export, audit log |

---

## 4. Components ✅ 60+ IMPLEMENTED

### Premium UI Components
- PremiumButton (5 variants, 3 sizes, glow, loading)
- PremiumCard (glassmorphism, hover lift, glow border)
- PremiumInput (floating label, focus glow, error shake)
- PremiumModal (backdrop blur, scale-in)
- PremiumToggle (gradient, spring knob)
- PremiumBadge (7 colors, pulsing dot)
- StatCard, SectionHeader, TabBar, EmptyState, GlassDivider, Skeleton

### Animation Components
- AnimatedPrice (flash green/red on tick)
- AnimatedPercent (colored percentage with direction)
- useAnimatedNumber hook (smooth countUp/countDown)
- PageTransition (fade-up wrapper)

### Feature Components
- TradingChart (candlestick/line/area, 6 indicators, crosshair tooltip)
- OrderForm (buy/sell, market/limit/stop, SL/TP, AI evaluation)
- AIChatDrawer (streaming text, markdown, follow-ups)
- ToastContainer (spring animation, progress bar)
- NotificationCenter (bell dropdown, time grouping, sound)
- GlobalSearch (overlay modal, keyboard shortcut)
- OnboardingWizard (4-step flow)
- ErrorBoundary (crash recovery)

---

## 5. Navigation ✅ IMPLEMENTED

### Desktop (≥1024px)
- Left sidebar with icons + labels
- 12 nav items + logout
- Collapsible

### Mobile (<1024px)
- Bottom tab bar (5 items: Dashboard, Markets, Portfolio, Chat, More)
- Hamburger menu for additional pages
- Full-width pages

### Keyboard Shortcuts
- `/` — Open global search
- `C` — Toggle AI chat
- `Escape` — Close modals/drawers

---

## 6. Accessibility ✅ IMPLEMENTED

- ARIA labels on all interactive elements
- Keyboard navigation (Tab, Enter, Escape)
- Focus visible rings (custom styling)
- Reduced motion support (`prefers-reduced-motion`)
- Semantic HTML throughout
- Touch targets ≥ 44x44px
- Color contrast ratios meeting WCAG 2.1 AA
- Screen reader friendly with live regions
