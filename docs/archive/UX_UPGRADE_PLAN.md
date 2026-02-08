> ⚠️ Historical planning document. For current implementation truth, start at `docs/README.md` and `docs/AI_PROJECT_GUIDE.md`.

# UI/UX Premium Upgrade Plan

## Overview
10 upgrades across 5 build phases. Each phase is self-contained and buildable independently.

---

## Phase Sequence

| Phase | Name | Upgrades Included | Why This Order |
|-------|------|-------------------|----------------|
| **Phase U1** | Animation Foundation | #1 Price Flash, #9 Number Animations, #3 Page Transitions | Creates the animation system everything else depends on |
| **Phase U2** | Component Library | #4 Premium Components, #10 Color & Typography | Rebuilds the design tokens and components used everywhere |
| **Phase U3** | Dashboard Rebirth | #2 Bento Grid Dashboard | Applies new components + animations to the hero page |
| **Phase U4** | Chart & Portfolio | #5 Interactive Chart, #6 Portfolio Equity Curve | Upgrades the two most data-heavy pages |
| **Phase U5** | Final Polish | #7 AI Chat Visual, #8 Notification Polish | Polishes the overlay/drawer components |

---

## Phase U1: Animation Foundation

### Goal
Create reusable animation primitives that make the entire app feel alive.

### Upgrade #1 — Price Flash Animations
**What:** Every price number flashes green/red on change with background highlight fade.

**Files to create:**
- `src/components/ui/AnimatedPrice.tsx` — The core component

**Component API:**
```tsx
<AnimatedPrice value={29450.50} previousValue={29430.00} currency="USD" />
```

**Behavior:**
- Compares current vs previous value
- On uptick: number turns green, bg flashes green-100 (light) or green-900/20 (dark), fades over 600ms
- On downtick: number turns red, bg flashes, fades
- No change: neutral color, no flash
- Uses CSS transitions only (no JS animation library needed)
- Formats with locale-aware number formatting

**Implementation steps:**
1. Create `AnimatedPrice` component with `useRef` to track previous value
2. Use `useEffect` to detect change and trigger CSS class toggle
3. Add CSS keyframe `@keyframes flash-green` and `flash-red` in index.css
4. Create `usePriceFlash` hook for reuse
5. Replace raw price displays across: Dashboard, Markets, Watchlist, Portfolio, AssetDetail header

### Upgrade #9 — Number Animations (CountUp)
**What:** Numbers smoothly interpolate from old to new value instead of snapping.

**Files to create:**
- `src/hooks/useCountUp.ts` — Custom hook for animated counting
- `src/components/ui/AnimatedNumber.tsx` — Wrapper component

**Behavior:**
- Uses `requestAnimationFrame` for smooth 60fps interpolation
- Duration: 400ms for small changes, 800ms for large
- Easing: ease-out cubic
- Supports prefix ($), suffix (%), decimal places
- Optional circular progress ring for percentages

**Implementation steps:**
1. Create `useCountUp` hook with RAF-based interpolation
2. Create `AnimatedNumber` component wrapping the hook
3. Create `AnimatedPercent` variant with optional circular ring (SVG arc)
4. Replace key numbers: portfolio value, P&L, asset prices, percent changes
5. Add to Dashboard hero section, Portfolio summary, Risk score gauge

### Upgrade #3 — Page Transitions & List Animations
**What:** Staggered fade-up for cards, page transitions, skeleton morphing.

**Files to create:**
- `src/components/ui/AnimatedList.tsx` — Staggered children animation
- `src/components/ui/FadeIn.tsx` — Simple fade-in wrapper
- `src/components/ui/PageTransition.tsx` — Page-level transition wrapper
- Add CSS keyframes to `index.css`

**AnimatedList behavior:**
```tsx
<AnimatedList stagger={50}>
  {items.map(item => <Card key={item.id} />)}
</AnimatedList>
```
- Each child fades up with 50ms delay after the previous
- Uses CSS `animation-delay` with `--index` custom property
- First render only (doesn't re-animate on data updates)

**PageTransition behavior:**
- Wraps each page route
- Fade + subtle slide-up (transform: translateY(8px) → 0)
- Duration: 200ms
- Uses CSS only, triggered by mount

**Implementation steps:**
1. Add keyframes to index.css: `fade-up`, `fade-in`, `slide-in`
2. Create `FadeIn` component (simple opacity 0→1 with optional delay)
3. Create `AnimatedList` with stagger support
4. Create `PageTransition` wrapper
5. Wrap each page in App.tsx with `<PageTransition>`
6. Wrap card lists in Dashboard, Markets, Portfolio, News with `<AnimatedList>`

### Phase U1 Deliverables:
- 5 new files (3 components, 1 hook, CSS additions)
- ~20 files updated (replacing raw numbers/prices with animated versions)
- Every page feels alive with motion

---

## Phase U2: Premium Component Library & Design Tokens

### Goal
Rebuild core UI components with premium feel. Establish design tokens.

### Upgrade #10 — Color System & Typography
**What:** Sophisticated gradient-based color scale, monospace numbers, premium typography.

**Files to update:**
- `src/index.css` — New CSS custom properties, font imports
- `tailwind.config.js` (via index.css variables)

**Color changes:**
- Gains: Single green → gradient scale (emerald-400 mild → lime-400 strong)
- Losses: Single red → gradient scale (rose-400 mild → crimson-600 heavy)  
- Neutral: Cool blue-gray-400 instead of plain gray
- Accent: Keep purple/indigo for AI features
- Add `--gain-mild`, `--gain-strong`, `--loss-mild`, `--loss-strong` CSS variables
- Function: `getGainColor(percent)` returns appropriate shade

**Typography changes:**
- Import JetBrains Mono (from Google Fonts) for all numerical displays
- Add `font-mono-trading` utility class
- Tighter letter-spacing on headings (-0.025em)
- Slightly larger line-height on body text (1.6)
- Number tabular-nums for aligned columns

**Implementation steps:**
1. Add Google Font import for JetBrains Mono to index.html
2. Add CSS custom properties for gradient color scales in index.css
3. Create `src/utils/colors.ts` — `getGainColor(pct)`, `getLossColor(pct)` utility
4. Add `.font-trading` class for monospace numbers
5. Update AnimatedPrice and AnimatedNumber to use gradient colors
6. Apply font-trading across Markets table, Portfolio, Dashboard numbers

### Upgrade #4 — Premium Components
**What:** Rebuild Button, Toggle, Input, Card, Modal, Tooltip with premium interactions.

**Files to create/update:**
- `src/components/ui/Button.tsx` — New premium button
- `src/components/ui/Card.tsx` — Glassmorphism card
- `src/components/ui/Input.tsx` — Floating label input
- `src/components/ui/Toggle.tsx` — Spring-physics toggle
- `src/components/ui/Modal.tsx` — Backdrop blur modal
- `src/components/ui/Tooltip.tsx` — Arrow tooltip

**Button spec:**
- Subtle scale-down on press (transform: scale(0.97))
- Gradient backgrounds for primary actions
- Ripple effect on click (CSS only using ::after pseudo-element)
- Loading state with spinner
- Variants: primary, secondary, ghost, danger
- Sizes: sm, md, lg

**Card spec:**
- `backdrop-filter: blur(12px)` for glassmorphism
- `background: rgba(15,23,42,0.6)` — semi-transparent
- Subtle gradient border (`border-image` or `::before` with gradient)
- Hover: slight lift (translateY(-2px)) with shadow increase
- Optional glow variant for AI/featured cards

**Input spec:**
- Floating label (label sits inside, moves up on focus/value)
- Focus ring with brand color glow
- Error state with red border + shake animation
- Success state with green check
- Clean transitions on all state changes

**Modal spec:**
- `backdrop-filter: blur(8px)` on overlay
- Scale-in animation (0.95 → 1.0) + fade
- Scale-out on close
- Trap focus inside modal

**Implementation steps:**
1. Create Button component with variants, press effect, ripple
2. Create Card component with glassmorphism, hover lift, glow variant
3. Create Input component with floating labels
4. Create Toggle with spring transition
5. Create Modal with backdrop blur and scale animation
6. Create Tooltip with positioning and arrow
7. Update existing pages to use new components (progressive replacement)

### Phase U2 Deliverables:
- 6 new/rebuilt component files
- Design tokens in CSS
- JetBrains Mono font
- Gradient color scale utility
- Foundation for all subsequent phases

---

## Phase U3: Dashboard Bento Redesign

### Goal
Transform the dashboard into a stunning bento grid layout.

### Upgrade #2 — Bento Grid Dashboard

**Layout structure (desktop):**
```
┌──────────────────┬───────────┬───────────┐
│                  │  Market   │   AI      │
│  Portfolio Hero   │  Movers   │  Insight  │
│  (large card)    │  (tiles)  │  (glow)   │
├────────┬─────────┼───────────┤───────────┤
│ Quick  │ Watchl. │  Mini     │  Alerts   │
│ Trade  │ Spark   │  Heatmap  │  Feed     │
├────────┴─────────┼───────────┴───────────┤
│   Recent Trades  │    News Headlines      │
└──────────────────┴───────────────────────┘
```

**Portfolio Hero card:**
- Large prominent portfolio value with countUp animation
- Sparkline chart behind the number (semi-transparent)
- Daily P&L with AnimatedPrice
- Percentage change with circular progress ring
- Glassmorphism card with gradient border

**Market Movers tiles:**
- Top 3 gainers, top 3 losers as compact tiles
- Each tile has: coin icon, symbol, price, change%
- Green/red gradient background based on performance
- Subtle pulse animation on the strongest mover

**AI Insight card:**
- Glowing purple/indigo border (the "AI glow")
- Latest AI market sentiment summary
- Confidence gauge
- "Ask AI" quick action button → opens chat

**Mini Heatmap:**
- Embedded tiny version of the heatmap (top 12 assets only)
- Click opens full heatmap page

**Quick Trade widget:**
- BTC/ETH quick buy/sell buttons
- Amount input
- One-tap execution

**Implementation steps:**
1. Create `src/pages/DashboardV2.tsx` — new dashboard (keep old as backup)
2. Build bento grid with CSS Grid (`grid-template-areas`)
3. Create `PortfolioHero` widget component
4. Create `MarketMovers` widget component  
5. Create `AiInsightCard` widget component
6. Create `MiniHeatmap` widget component
7. Create `QuickTrade` widget component
8. Create `RecentTradesWidget` component
9. Create `NewsHeadlinesWidget` component
10. Create `AlertsFeedWidget` component
11. Add responsive breakpoints — 3 col → 2 col → 1 col
12. Replace old Dashboard in App.tsx

### Phase U3 Deliverables:
- 1 new page + 7-8 widget components
- Stunning visual impact
- Bento grid with glassmorphism
- All widgets use Phase U1 animations and Phase U2 components

---

## Phase U4: Chart & Portfolio Upgrades

### Goal
Make charts and portfolio pages best-in-class.

### Upgrade #5 — Interactive Chart
**Enhancements to existing TradingChart:**

- **Crosshair data panel:** On hover, show floating tooltip near crosshair with OHLCV + active indicator values at that candle
- **Current price marker:** Horizontal dashed line at current price extending across chart, with price label on Y-axis, pulsing dot at the line end
- **Order lines:** When positions exist, show entry price as green dashed line, SL as red line, TP as blue line
- **Volume profile:** Optional volume bars on right side showing volume at each price level
- **Zoom controls:** Mouse wheel zoom, pinch zoom on mobile, double-click reset, zoom buttons (+/-)
- **Time range slider:** Draggable range selector below chart to narrow visible window

**Implementation steps:**
1. Add crosshair move handler to chart, compute indicator values at hovered time
2. Create floating tooltip component positioned near crosshair
3. Add price line series for current price with `createPriceLine`
4. Add order/position lines using `createPriceLine` on the series
5. Add zoom buttons overlay (chart.timeScale().scrollToPosition)
6. Style improvements: better grid lines, cleaner axes

### Upgrade #6 — Portfolio Equity Curve Enhancement
**Enhancements to Portfolio page charts:**

- **Benchmark overlay:** Toggle BTC or total market overlay line on equity curve for comparison
- **Drawdown visualization:** Below equity curve, show inverted red area chart showing drawdown from peak
- **Time range selector:** Buttons for 1W/1M/3M/ALL plus draggable range
- **Daily P&L bar chart:** Green/red bars per day showing daily gains/losses
- **Animated curve:** On page load, the equity line draws from left to right
- **Gradient fill:** Area under curve uses gradient from brand color to transparent

**Implementation steps:**
1. Calculate drawdown series from equity data (peak - current / peak)
2. Add drawdown Recharts AreaChart below main chart (inverted, red fill)
3. Add benchmark data fetch (BTC price over same period) with toggle
4. Add daily P&L computation and BarChart component
5. Add time range filter buttons
6. Improve chart styling: gradient fills, better tooltips, axis formatting

### Phase U4 Deliverables:
- Enhanced chart interactions
- Position/order visualization on charts
- Benchmark comparison
- Drawdown analysis
- Daily P&L bars

---

## Phase U5: Final Polish

### Goal
Polish the overlay/drawer components to match the premium feel.

### Upgrade #7 — AI Chat Visual Upgrade
**Enhancements to AIChatDrawer:**

- **Streamed text effect:** Words appear progressively (typing effect) instead of all at once
- **Message bubbles:** User messages right-aligned with brand color, AI left-aligned with dark bg
- **AI avatar:** Robot emoji or icon with subtle glow
- **Markdown rendering:** Bold, italic, bullet lists, code blocks rendered properly
- **Suggested follow-ups:** After each AI response, show 2-3 follow-up prompt chips
- **Copy button:** On each AI message, copy to clipboard
- **Pin/bookmark:** Star important insights
- **Better drawer animation:** Slide in from right with spring easing, backdrop blur

**Implementation steps:**
1. Create markdown parser (simple regex for bold/italic/lists/code)
2. Add typing effect hook (`useTypingEffect`) — reveals text character by character
3. Redesign message bubbles with proper alignment and styling
4. Add suggested prompts based on AI response content
5. Add copy-to-clipboard button per message
6. Add pin/bookmark toggle per message with persistence
7. Improve drawer animation with better easing

### Upgrade #8 — Notification & Alert Polish
**Enhancements to toast and notification systems:**

- **Spring physics toasts:** Slide in with overshoot, settle animation
- **Progress bar:** Auto-dismiss countdown visible as thin bar at bottom of toast
- **Stack behavior:** Multiple toasts stack vertically with offset
- **Bell icon pulse:** When unread notifications exist, bell has a pulsing glow
- **Notification grouping:** Group by time — "Today", "Yesterday", "This Week"
- **Critical alert style:** Position SL hit = distinct red pulsing toast that requires manual dismiss
- **Sound option:** Optional soft chime on alert trigger (Web Audio API, no file needed)

**Implementation steps:**
1. Add CSS spring animation keyframes for toast entrance
2. Add progress bar element to toast with CSS animation matching duration
3. Improve toast stacking with transform offsets
4. Add pulsing glow animation to bell icon when unread > 0
5. Group notifications by date in NotificationCenter
6. Add critical toast variant (red, no auto-dismiss, pulsing border)
7. Add optional alert sound using Web Audio API oscillator (tiny sine wave beep)

### Phase U5 Deliverables:
- Premium AI chat experience
- Professional notification system
- Final visual polish across all overlays

---

## Summary — Total New/Modified Files Per Phase

| Phase | New Files | Modified Files | Estimated Effort |
|-------|-----------|----------------|-----------------|
| U1 | 5 | ~15 | Medium |
| U2 | 7 | ~10 | Medium |
| U3 | 9 | 2 | Large |
| U4 | 3 | 4 | Medium |
| U5 | 2 | 4 | Medium |
| **Total** | **~26** | **~35** | — |
