---
name: Behaviour trend / longitudinal behaviour intelligence
description: Where behaviour dims live, how to trend them, and the honest empty-spine ceiling
---

# Behaviour persistence + trend (WC-L0 / WC-L0B)

Per-session behaviour dimensions are ALREADY persisted by the WC-L0 User Intelligence Foundation into
`wcl0_user_intelligence` (one row per completed session, projected from the Unified Behavior Graph).
The existing NUMERIC dims are: `motivation`, `confidence`, `risk`, `engagement`, `adaptability`.
`learning_style` is CATEGORICAL (text) → never numerically trended, only surfaced.

**Spec dims that do NOT exist** (report as not-available, never fabricate): Curiosity, Consistency,
Self-Regulation. "Persistence" is folded into the `motivation` projection (its regex absorbs
persist/drive/goal tokens) — there is no standalone persistence dimension.

## Trending behaviour
Reuse the WC-L1 trend stack verbatim — do NOT reimplement math:
- `leastSquaresSlope` / `directionOf` / `STABLE_DEADBAND` from `services/wc3/longitudinal-consumption.ts`
- `ensureTrendIntelligenceSchema` + table `wc3_longitudinal_trends` (UPSERT keyed `user_email, metric`).
- Behaviour trends use metric `behaviour_<dim>` alongside the WC-L1 stage/outcome/journey/decision metrics.
- A NULL dim is MISSING (never coerce to 0 — 0 is a real low value). A dim needs ≥2 readable points
  for the SAME user or NO trend row is written. Order history by `capadex_sessions.created_at` (canonical
  chronology), not the persist time.

**Why:** the honest empty-spine ceiling — on the current base, row-persistence is ~100% but the Behavior
Graph projects an actual dimension for only ~22% of completed sessions (mostly `risk`); NO returning user
has 2 readable points for any dim → behaviour-trend coverage is genuinely 0%. The highest-leverage fix is
upstream signal capture, NOT this layer. Report Coverage (state exists) and Confidence (trustworthy enough
to trend) as SEPARATE axes; never inflate to the >80/70/90/85% targets.

**How to apply:** behaviour persistence/trend hooks are postCompletionHooks items 16 (persist) + 18 (trend,
behind `FF_BEHAVIOUR_TREND_INTELLIGENCE`, default OFF → byte-identical when off). Audit artifacts in
`backend/audit/wc-l0b/`. `capadex_sessions` has NO product column → per-product breakdown is not-tracked,
report as such.
