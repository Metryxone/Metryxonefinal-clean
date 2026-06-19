---
name: Employability Scoring Engine (Phase 3.3)
description: How the competency→dimension→EI scoring chain is wired and why 3.2 delegates to the same pure engines (anti-drift).
---

# Employability Scoring Engine (Phase 3.3)

The explicit chain is **competency scores → dimension scores → EI score**, split
into three pure, traceable units plus an audit ledger:

- `competency-ei-scoring-shared.ts` — leaf primitives (clamp/round1/bandFor,
  `dimensionConfidence`/`emptyConfidence`, `LANGUAGE_POLICY`,
  `DEFAULT_BAND_THRESHOLDS`, shared types). No sibling-engine imports.
- `dimension-scoring-engine.ts` — `scoreDimension(rule, components, measurement)`,
  weighted mean over MEASURED components only, full `DimensionScoreTrace`.
- `ei-calculation-engine.ts` — `calculateEi(dims, {measurement, confidence_cap, band_thresholds})`,
  weighted roll-up over MEASURABLE dimensions only, full `EiCalculationTrace`.
- `employability-scoring-engine.ts` — orchestrator + append-only audit ledger
  (`employability_scoring_runs`, full artifact in `trace` JSONB).

## Anti-drift rule (the important decision)
Phase 3.2's `computeEmployabilityDimensions` was REFACTORED to delegate to the
SAME `scoreDimension`/`calculateEi` via a shared `loadScoringInputs(pool, subjectId)`
(exported from `competency-ei-dimensions.ts`). The 3.2 dimensions endpoint and
the 3.3 scoring endpoint therefore compute identical numbers by construction.

**Why:** two parallel implementations of the same weighted-mean/band/confidence
math WILL silently diverge over time. Keep ONE implementation.

**How to apply:** never re-implement the dimension/EI arithmetic anywhere else;
import the engines. The parity invariant (3.2 == 3.3 per-dimension + overall) is
the regression check — for demo_subj_swe both give ei=75/Strong, coverage 80%,
confidence 60 Moderate.

## Module DAG (no cycles — do not break)
shared (leaf) ← dimension-engine, ei-engine ←
  competency-ei-dimensions (also imports competency-runtime) ←
  employability-scoring-engine (imports `loadScoringInputs` + `DEFAULT_DOMAIN_PROXY_CONFIDENCE_CAP`
  from competency-ei-dimensions; never the reverse).
NEVER make competency-ei-dimensions import employability-scoring-engine.

## Discipline carried over
- Coverage vs Confidence are SEPARATE axes; unmeasured = null + reason, never imputed.
- Tier-1 competency coverage (per-competency) ≠ dimension coverage (per-dimension) —
  different denominators, both honest (e.g. 26.9% vs 80%).
- Flag-gated on `competencyEi`/FF_COMPETENCY_EI: flag-OFF = zero DDL (boot
  ensure-schema only when ON); GET never writes (to_regclass probe + degrade);
  only POST `/scoring/:subject/run` writes.
- Routes: GET `/scoring/:subject`, POST `/scoring/:subject/run`, GET
  `/scoring/:subject/runs`, GET `/admin/scoring/runs/:runId`.
