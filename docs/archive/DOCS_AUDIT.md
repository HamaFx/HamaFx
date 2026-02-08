# Documentation Audit (False / Extra / Missing)

Audit target: all Markdown docs under `docs/` plus `llm.txt`.

## 1) Executive Findings

The documentation set had significant drift caused by rapid V1 -> V2 evolution:

- False statements existed (for example: "no backend", "future V2 migration", Gemini-only architecture).
- Extra historical planning docs remained presented as current status.
- Missing canonical entrypoint for AI agents caused conflicting guidance.

This audit establishes canonical docs and marks historical files accordingly.

## 2) File-by-File Status

| File | Status | False/Extra/Missing Summary |
|---|---|---|
| `llm.txt` | Rewritten | Previously claimed React 18, no backend, old file map, Gemini-only. |
| `docs/PROJECT_PLAN.md` | Legacy | Mixes current and historical assumptions; not decision-safe for implementation. |
| `docs/IMPLEMENTATION_PHASES.md` | Legacy | Historical milestone log presented as current implementation spec. |
| `docs/ARCHITECTURE_DECISIONS.md` | Legacy | ADRs assume future backend swap; V2 already exists. |
| `docs/BACKEND_MIGRATION_GUIDE.md` | Legacy | Entirely pre-V2 migration framing. |
| `docs/UX_UPGRADE_PLAN.md` | Legacy | Contains speculative and superseded UI implementation script. |
| `docs/UI_UX_UPGRADES.md` | Legacy snapshot | Useful as history, not as current source of truth. |
| `docs/FEATURE_IMPLEMENTATION_ORDER.md` | Legacy snapshot | Old sequence docs, now mostly historical. |
| `docs/FEATURE_AI_CHAT.md` | Partially stale | Describes Gemini-first local model; backend AI orchestration now exists. |
| `docs/API_INTEGRATIONS.md` | Partially stale | Mixes backend AI provider reality with older Gemini key assumptions. |
| `docs/DATABASE_SCHEMA.md` | Partially stale | Mentions future backend while backend tables are active. |
| `docs/UI_UX_DESIGN.md` | Partially stale | Some style claims and counts are historical snapshots. |
| `docs/API_V2.md` | Mostly current | Endpoint list is still useful but lacks envelope/auth nuance. |
| `docs/V2_BACKEND_SETUP.md` | Mostly current | Good setup doc, but not full runtime contract. |
| `docs/CODEBASE_AUDIT.md` | Historical audit | Valuable context, but date-bounded snapshot. |
| `docs/DEPLOYMENT_HARDENING.md` | Current | Operationally relevant and still aligned. |
| `docs/V1_BACKUP_RESTORE.md` | Current | Accurate backup/restore steps. |
| `docs/FEATURE_RISK_DASHBOARD.md` | Mostly current | High-level feature summary remains accurate. |
| `docs/FEATURE_MULTI_CHART.md` | Mostly current | High-level feature summary remains accurate. |
| `docs/FEATURE_HEATMAP.md` | Mostly current | High-level feature summary remains accurate. |

## 3) Missing Documentation That Is Now Added

New canonical docs added:

- `docs/README.md` (single entrypoint + legacy map)
- `docs/AI_PROJECT_GUIDE.md` (architecture + data flow truth)
- `docs/API_RUNTIME_REFERENCE.md` (runtime/API/env contracts)
- `docs/AI_CUSTOMIZATION_GUIDE.md` (implementation playbook for AI agents)

## 4) Usage Policy Going Forward

1. Treat code as primary truth.
2. Treat canonical docs as maintained truth layer.
3. Treat legacy docs as historical context only.
4. Update canonical docs in the same PR whenever contracts change.

## 5) Docs Debt Remaining

- Optional: progressively annotate legacy files with top-level "Historical" banners.
- Optional: condense overlapping feature docs into one features catalog.
- Optional: auto-generate endpoint table from `api/_v2` handlers to reduce drift.
