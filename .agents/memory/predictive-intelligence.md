---
name: Predictive & Outcome Intelligence (Phase 9)
description: How CAPADEX turns descriptive layers into EXPLAINABLE predictions by composition; the honesty invariants that must never regress.
---

# Predictive & Outcome Intelligence (Phase 9)

Predictions are a deterministic, a-priori-weighted COMPOSITION of the existing descriptive
engines (runtime pipeline-resolver, recommendation-builder, strength-discovery, KG
traversal/explainability) — never a trained/black-box model. `readiness = clamp(0.5 +
strengths − risks)`; `expected = readiness + Σ traced intervention uplift`; `confidence =
chainCompleteness × evidenceVolume`. Every contributing term carries the 7-hop trace
Concern→Capability→Problem→Behavior→Archetype→Intervention→Recommendation.

## Honesty invariants (do NOT regress — the architect will fail the build on these)
- **No fabricated lineage.** Archetype-example interventions must come ONLY from the
  archetype's resolved KG lineage intervention-stage nodes, filtered against
  `intervention_library` by title/key — NEVER a global `LIMIT N` of top rows. No lineage
  match ⇒ attach no levers (honest), never a global fallback.
- **Mitigation is earned, not assumed.** A future-risk is `mitigable` ONLY when an
  intervention shares a real DIMENSION_LEXICON term with the signal. Do NOT add an
  "empty-dims ⇒ auto-match" fallback — unmatched risks stay `persistent` with null lever.
- **No empirical accuracy claim.** No realized longitudinal outcomes exist, so
  `empirical_accuracy_available:false`, `outcome_coverage=0` (reported honestly), and
  validity rests on internal-consistency invariants (determinism, risk/strength
  monotonicity, neutral baseline, confidence-tracks-chain, expected≥current) + full
  explainability. Never tune metrics to claim accuracy.
- **Degraded ⇒ lower confidence, never fabricate.** Partial chains lower confidence and set
  `degraded:true`; they are surfaced, never patched with invented evidence.

## Route discipline
- All 5 routes flag-gated by `isRuntimeIntelligenceActivationEnabled()` (OFF →
  `{enabled:false}`), strict-UUID (400 on bad id), and **strictly never-500**: outer
  `catch` returns degraded JSON `{ok:true,enabled:true,degraded:true,reason:'unexpected_error'}`
  — do NOT use `next(err)` (that reaches Express error middleware → 500).

## Read-only
Only write is the lazy append-only `capadex_prediction_audit` row (best-effort, never breaks
a read path). All domain tables are read-only.
