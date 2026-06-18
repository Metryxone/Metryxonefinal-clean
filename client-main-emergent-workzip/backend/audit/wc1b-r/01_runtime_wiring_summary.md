# WC-1B-R — Runtime Wiring Summary

**Date:** 2026-06-04
**Flag:** `FF_SIGNAL_GROUNDING_RUNTIME` (`config/feature-flags.ts` → `signalGroundingRuntime:false`, helper `isSignalGroundingRuntimeEnabled()`, env override read live at call-time)
**Contract:** strictly additive · flag-OFF = byte-identical legacy · every consumer try/catch-wrapped (never throws) · consumes existing WC-1B assets only (no new signals/concerns/tags, no ontology-definition edits).

## Assets consumed (read-only)
| Table | Rows | Provenance |
|---|---|---|
| `capadex_bridge_tag_signal_grounding` | 14,402 | 100% `wc1a_green` |
| `capadex_bridge_tag_family_grounding` | 351 | `wc1a_green` |

## Shared service (new, read-only)
`backend/services/signal-grounding-runtime.ts` — single source of truth imported by every consumer. 60s cache, never throws.
- `resolveBridgeTagForConcernPk(pool, pk)` / `resolveBridgeTagForConcernId(pool, concernId)` — concern → bridge tag.
- `loadGroundedSeedDefs(pool, tag, cap)` — ranked (similarity DESC), capped at `GROUNDED_SEED_CAP=8`, confidence = tag mean-similarity × 0.6 penalty, shaped as `ConcernSeedDef` with core-token `signal_key`.
- `loadGroundedRankTokens(pool, tag, n)` — grounded family/signal vocab tokens for the ranking nudge.
- `groundedSummary(pool, tag)` — `{bridge_tag, grounded, grounded_signal_count, grounded_family_count, mean_similarity}`.
- `loadGroundedLineage(pool, tag)` — families + signals for explainability.
- `groundingCoreToken(name)` — normaliser shared with consumers.

## Phases wired
| Phase | Surface | File | Behaviour (flag ON) | Flag OFF |
|---|---|---|---|---|
| **2 — Activation** | `runEvidenceRuntime` | `services/signal-activation-runtime.ts` (~L495–520) | Resolves the session concern's bridge tag, appends grounded seed defs that **fill the gap** left by curated Tier-3 seeds (dedup by `signal_key`, ≤ cap), feeds the combined set to the **existing** `buildSeedSignals → runActivation` path. No duplicate logic. | `seedDefs` unchanged → byte-identical activation |
| **3 — Resolver** | `/api/capadex/concern/analyze` | `routes/capadex-concern-intelligence.ts` (~L2685) | Attaches additive `signal_grounding` envelope + a **separate** `resolution_confidence_grounded` (only when a base `resolution.confidence` exists; never mutates the core score). | no `signal_grounding` / `resolution_confidence_grounded` keys |
| **4 — Ranking** | `pickQuestionsFromMaster` | `routes/capadex-concern-intelligence.ts` (~L1906) | Appends grounded rank tokens to `conceptStems`, feeding the **existing** clarity soft-rank — same pool/content, re-rank only. | `conceptStems` unchanged → byte-identical ordering |
| **5 — Explainability** | `GET /api/capadex/session/:id/grounding` | `routes/capadex.ts` (~L2642) | Read-only lineage: Concern → Bridge Tag → Grounded Families/Signals + session activation tie-in. Flag gate **before** the UUID guard. | `{enabled:false}` |

## Design-canon adherence
- **Over-activation control:** grounded atomic signals run avg **79.1** / max **200** per tag (see Ontology Health). Grounded seeds are therefore **capped (8)**, **ranked** (similarity DESC), **confidence-penalised** (×0.6, always below curated Tier-3), and **gap-fill only** (never displace curated seeds). They never force-activate — activation stays **evidence-gated** via `buildSeedSignals`.
- **Reuse, no duplication:** Phase 2 reuses `buildSeedSignals`/`runActivation`; Phase 3/4 reuse the existing envelope/soft-rank.

## Verification status
- Typecheck: clean for all changed files.
- Existing test `tests/adaptive-question-pipeline.test.ts`: **25/25 pass** (no regression).
- Flag-OFF byte-identical: confirmed at every surface (see Resolver / Ranking / Explainability deltas).
