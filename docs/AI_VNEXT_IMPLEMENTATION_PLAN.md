# Hama Fx AI VNext Plan (Architect Track)

This plan excludes the previously deferred tracks:
- `#2` strict universal structured-output migration
- `#7` long-horizon personalization memory
- `#8` dedicated AI eval/regression harness

## Objectives

- Make AI guidance feel proactive, not reactive.
- Improve trust by exposing source/runtime status and fallback behavior.
- Upgrade the News tab into a usable intelligence surface.
- Keep risk-first posture and paper-trading constraints explicit.
- Maintain compatibility with current V2 backend and frontend architecture.

## Scope

- In scope:
- Backend AI runtime status endpoint.
- Backend AI command-center endpoint for proactive direction.
- Backend AI news-intel endpoint for narrative/catalyst/risk synthesis.
- Frontend integration in `Dashboard` and `News`.
- Canonical docs update for new endpoints and flow.

- Out of scope:
- New provider onboarding beyond existing `gemini|groq|scitely`.
- Server-driven memory profiles.
- Broker execution automation.
- Autonomous order execution.

## Task Checklist

- [x] Add runtime visibility in backend AI core (`api/_lib/ai.ts`).
- [x] Add `AiRuntimeStatus` contract.
- [x] Add `AiCommandCenter` contract and fallback strategy.
- [x] Add `AiNewsIntel` contract and fallback strategy.
- [x] Add `GET /api/v2/ai/status`.
- [x] Add `GET /api/v2/ai/command-center`.
- [x] Add `GET /api/v2/ai/news-intel`.
- [x] Wire new actions in `api/v2/ai/[action].ts`.
- [x] Add frontend API client methods in `src/services/backend/aiApi.ts`.
- [x] Add frontend types in `src/types/index.ts`.
- [x] Add `getCommandCenter`, `getNewsIntel`, and `getAiRuntimeStatus` in `src/services/gemini.ts`.
- [x] Upgrade `src/pages/Dashboard.tsx` to render proactive command-center guidance.
- [x] Upgrade `src/pages/News.tsx` to render AI narrative/catalyst/risk intelligence.
- [x] Upgrade `src/components/AIChatDrawer.tsx` to mode-aware copilot UX with proactive panels and runtime visibility.
- [x] Add mode-aware chat request support in `api/_v2/ai/chat.ts`, `api/_lib/ai.ts`, `src/services/backend/aiApi.ts`, and `src/services/chatService.ts`.
- [x] Update canonical docs (`docs/API_RUNTIME_REFERENCE.md`, `docs/AI_PROJECT_GUIDE.md`, `docs/README.md`).
- [ ] Add backend integration tests for new AI endpoints.
- [ ] Add focused UI tests for command-center and news-intel rendering.

## Endpoint Contracts

- `GET /api/v2/ai/status`
- Returns provider configuration and runtime selection order.

- `GET /api/v2/ai/command-center`
- Returns proactive posture, prioritized actions, blockers, and opportunities.

- `GET /api/v2/ai/news-intel?category=all|crypto|forex|economy|general&limit=6..30`
- Returns narrative regime, catalysts, sector pulse, asset impacts, and risk checklist.

## Rollout Notes

- Feature set is backward-compatible with existing AI pages.
- Existing endpoints remain unchanged.
- Fallback behavior remains deterministic when providers fail.
- New cards degrade gracefully to local advisory copy when backend is unavailable.
