# Changelog: Gemini Branch + Recent Layout Stabilization

This document records what was introduced by the `gemini-agent-dev` branch and what was changed after merge on `main`, including the latest layout stabilization pass.

## Scope

- Repository: `HamaFx`
- Baseline before Gemini branch changes: `137f2dd` (`feat(forex): ship v2 forex compatibility stack`)
- Gemini branch head merged into main: `14f7060` (merge commit)
- Additional main commit after merge: `e2992cf`
- Latest stabilization patch: current working changes in:
  - `src/components/layout/Layout.tsx`
  - `src/components/layout/GlobalSearch.tsx`
  - `src/components/ui/AiCompanion.tsx`

## 1) Changes from `gemini-agent-dev`

### Commit Range

`3c93a11` through `4b91210` (merged via `14f7060`)

### Files Changed

- `src/App.tsx`
- `src/components/layout/Layout.tsx`
- `src/components/ui/AiCompanion.tsx` (added)
- `src/components/ui/MiniTicker.tsx` (added)
- `src/index.css`
- `src/pages/Login.tsx`

### Functional Summary

1. Visual shell and atmosphere
- Added cyberpunk-style global background layers (grid/orbs/vignette) and made shell surfaces transparent enough to reveal those layers.
- Increased ambient motion intensity and visibility tuning through iterative style commits.

2. Header and sidebar chrome upgrades
- Introduced enhanced sidebar visual treatment and ticker-oriented header chrome.
- Added/iterated `MiniTicker` integration in layout.

3. AI companion revamp
- Added new `AiCompanion` component.
- Evolved it from simple indicator to FaceBot behavior with richer state modes:
  - sleep/talking/dizzy/happy/sad/love/scared/alert-driven states
  - reaction to market moves, alerts, and trade events
  - timed speech bubble messaging
- Added timer and animation stability fixes in later Gemini branch commits.

4. Login and shell visibility fixes
- Multiple fixes to ensure background layers remained visible on login and app shell.

## 2) Recent Main Changes After Gemini Merge

### Commit `e2992cf`

`feat(layout): ship command palette and adaptive sidebar`

Files:
- `src/components/layout/GlobalSearch.tsx`
- `src/components/layout/Layout.tsx`

Summary:
- Added command palette improvements and adaptive sidebar behavior.
- Extended top-level layout interactions and navigation ergonomics.

## 3) Latest Stabilization Patch (Current)

This patch was applied to resolve scattered/unstable layout behavior observed across desktop/tablet/mobile.

### Files

- `src/components/layout/Layout.tsx`
- `src/components/layout/GlobalSearch.tsx`
- `src/components/ui/AiCompanion.tsx`

### Key Fixes

1. Root layout width collapse fix
- Moved desktop disclaimer bar into the main content column flow.
- Removed prior placement that could shrink the primary content area in horizontal flex layouts.

2. Header stability and density cleanup
- Stabilized header structure and breakpoint behavior.
- Reduced icon/control collisions and tightened responsive visibility rules.
- Ensured center search area and right-side actions stay coherent across widths.

3. Mobile overlap prevention
- Hide floating mobile AI action button while mobile sidebar drawer is open.

4. AI companion compact behavior for header usage
- Added `compact` mode to `AiCompanion`.
- Disabled random speech bubble/tip/poke interactions in compact mode to avoid header jitter/clutter.

5. Command palette modal UX
- Added body scroll lock while command palette is open.

### Validation Run

All checks passed after stabilization:

- `npm run lint`
- `npm run typecheck`
- `npm run test` (49/49)
- `npm run build`

Manual/automated visual verification was performed on desktop/tablet/mobile, including AI drawer and mobile menu states.

## 4) Notes

- Backend/provider availability can still affect market data freshness messaging in local mode.
- Local browser CORS/network conditions may produce data-fetch warnings while layout remains functional.
