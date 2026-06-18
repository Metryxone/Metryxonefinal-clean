# Deliverable 5 — Personalization Impact
_Generated 2026-06-08T16:14:33.115Z_

What this foundation unlocks for the already-built consumption layers (WC-P2) and beyond.

| Foundation lever | Now persisted | Downstream consumer it unblocks |
|---|---|---|
| Persona / segment / context | 9/9 sessions | Report personalization (WC-P2 Lever B), persona-keyed copy, commercial segmentation |
| Behaviour (6 dims) | 2/9 sessions | Behaviour-aware recommendations, risk surfacing, future-readiness forecasting |
| Longitudinal snapshot | 9/9 sessions | Trend/forecast (WC-P2 Lever D), longitudinal trajectory, re-assessment timing |

## Honest impact statement
- **Persona** moves from ~0% queryable (all NULL on the session row) to 100.0%
  persisted — but as DERIVED values; report personalization should weight by `persona_confidence`.
- **Snapshot** moves from 0 rows to a guaranteed-per-session substrate, enabling longitudinal
  consumption the moment a user completes a second assessment.
- **Behaviour** impact is currently limited to signal-bearing sessions; the foundation is wired so
  impact grows automatically as behavioural capture coverage grows. No metric was tuned to a target.
