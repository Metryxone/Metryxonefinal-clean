# Deliverable 5 — Trend Intelligence (Consolidated)
_Generated 2026-06-08T16:35:30.858Z_

One view of the four lever directions per eligible user, composed from the persisted trends. This is
a re-shape of already-computed state — no new construct, no recomputed score.

## Coverage × Confidence by lever (eligible users, N=2)
| Lever | Coverage | Confidence | Directions | Source |
|---|---|---|---|---|
| Stage | 100.0% | 0.33 | improving 0 · stable 2 · declining 0 | wc3_longitudinal_snapshots.canonical_stage |
| Outcome | 0.0% | 0.00 | improving 0 · stable 0 · declining 0 | wc3_outcome_state.current_order |
| Journey | 0.0% | 0.00 | improving 0 · stable 0 · declining 0 | wc3_journey_state.route_confidence |
| Decision | 100.0% | 0.33 | improving 0 · stable 2 · declining 0 | wc7b_decision_state.confidence |

## Per-user trend matrix
- `user_65454b2b8b` → Stage: stable(0.33) · Outcome: — · Journey: — · Decision: stable(0.33)
- `user_4b262cc8a5` → Stage: stable(0.33) · Outcome: — · Journey: — · Decision: stable(0.33)

## What "Stable" means here
Most current trends read **stable** because both comparable sessions land at the same lever value
(e.g. both at the Curiosity stage; decision confidence 0.6→0.6). That is the HONEST reading of the
data — not an absence of measurement. Direction will move to improving/declining as values change.
