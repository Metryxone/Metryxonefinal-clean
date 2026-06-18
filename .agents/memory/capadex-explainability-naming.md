---
name: CAPADEX explainability — three distinct engines + read-only explain contract
description: Why the report-insight explainer is a separate file, and the stored-only/no-recompute rule for the /explain GET route.
---

# Three distinct "explainability" engines (do NOT merge or clobber)

CAPADEX has THREE separately-named services that all sound alike. Keep them apart:

1. `explainability-engine.ts` — Phase-5 score-envelope `wrap()` decomposition. Governance/score envelope. DO NOT clobber.
2. `capadex-explainability-engine.ts` — the behavioural-SPINE lineage reader (`getSessionExplanation` → `{lineage: PatternLineage[]}`, each node carries `evidence[]`). Read-only.
3. `capadex-insight-explainer.ts` — the report-INSIGHT aggregator (`explainSession`). Sits ON TOP of #2 + the Unified Behavior Graph + Phase-2 recommendations.

**Why a new file (not overwrite #1):** the literal task said "build the Explainability Engine" but two engines already owned that name. Overwriting #1 would have broken Phase-5 `wrap()`. New non-colliding file = correct call (architect confirmed).

# /explain route invariants

**Rule:** `GET /api/capadex/session/:id/explain` must be STRICTLY read-only — stored intelligence only, NO AI, NO recompute, NO writes.

**Why:** an earlier version had `explainSession` fall back to `buildBehaviorGraph()` when the persisted graph row was missing. That is a recompute + write side-effect on a GET, which fails the stored-only contract (architect FAIL → fixed by removing the fallback).

**How to apply:**
- `explainSession` reads via `getBehaviorGraph` / `getSessionExplanation` / `getInterventionRecommendations` only. Never call `buildBehaviorGraph` here.
- Graph backfill lives ONLY in the session-completion path. A missing graph row → return the grounded empty-state (`finding.statement` = "No stored intelligence…", `sources: []`), never fabricate.
- The route is ADDITIVE: it still returns the original `lineage[]` alongside the new `{finding, evidence, signals, patterns, recommendations, omega, pragati, csi, sources}`. No frontend consumed the old `/explain` shape, but keep `lineage` for backward-compat.
- `finding.statement` is a deterministic template; every number/label must come from stored data (no LLM, no invented values).
