# CAPADEX Phase 9 — Predictive & Outcome Intelligence

Generated: 2026-06-03T19:12:15.235Z · flag ON

Descriptive → **Predictive**, by COMPOSITION (no black box). Every prediction traces the 7-hop spine
`Concern → Capability → Problem → Behavior → Archetype → Intervention → Recommendation`.

## Inputs
- Real sessions with active signals: **2** (of 2 candidates).
- KG archetype profiles (structural breadth): **8**.

## Validation
- Internal consistency: **6/6** invariants — internally valid.
- Prediction coverage: **100.0%** (10/10; 10 degraded).
- Explainability coverage: **100.0%** (51/51 predictions traced).
- **Prediction Explainability Score: 100.0%**.
- Outcome coverage: **0.0%** — No realized-outcome records exist (no longitudinal follow-up captured) — honestly 0%.

> Empirical accuracy is **not claimed**: no realized longitudinal outcomes exist yet, so predicted-vs-actual is not measurable. Validity rests on internal-consistency invariants + full explainability until outcomes are captured.

## Platform Completion
- Completion score: **85.7%** (6/7 layers present).
- Descriptive complete: **true** · Predictive valid: **true**.
  - [present] Evidence → Signal (runtime) — Signal activation runtime persists session signals.
  - [present] Signal → Concept spine (KG) — 7-hop lineage materialized in pil_kg_*.
  - [present] Descriptive reports — Stakeholder + institution reports with readiness.
  - [present] Recommendations — Active-construct-anchored, chain-traced.
  - [present] Predictive readiness — 4 dimensions, deterministic + traced.
  - [present] Intervention impact prediction — Library expected_impact × confidence × severity.
  - [absent] Outcome attribution (realized) — No realized longitudinal outcomes captured yet — empirical calibration pending.

### Honest gaps
- No realized outcomes → empirical accuracy not yet measurable.
- 10 session(s) degraded (partial chain) — predictions emitted at lower confidence.

## Outputs
- `future_readiness_examples.json` · `career_readiness_examples.json`
- `risk_forecast_examples.json` · `intervention_impact_examples.json`
- `prediction_explainability.json` · `platform_completion.json` · `validation.json`

