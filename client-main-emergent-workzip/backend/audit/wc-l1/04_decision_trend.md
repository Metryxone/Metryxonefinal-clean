# Deliverable 4 — Lever 4: Decision Trend
_Generated 2026-06-08T16:35:30.858Z_

Direction of **decision progression** across each user's session history,
computed by the REUSED longitudinal trend math over existing state (`wc7b_decision_state.confidence`),
normalised to a shared 0..100 progression scale. A user needs ≥2 readable points or gets no trend
(never fabricated).

## Metrics (trend-eligible users, N=2)
| Metric | Value | Definition |
|---|---|---|
| Coverage | **2/2 (100.0%)** | eligible users with a decision trend row |
| Confidence (mean) | **0.33** | scales with #comparable sessions (2=min≈0.33 · 4+=1.0) |
| Directions | improving 0 · stable 2 · declining 0 | distribution across covered users |

## Source state
- `wc7b_decision_state.confidence` — table has **9 rows across 9 sessions**.

## Per-user decision trends
- `user_65454b2b8b` — **stable** (Δ0, 2 sessions, confidence 0.33)
- `user_4b262cc8a5` — **stable** (Δ0, 2 sessions, confidence 0.33)

> Coverage and Confidence are INDEPENDENT axes and never merged. Confidence is honestly low at 2 comparable sessions and rises only as users return; it is never tuned to a target.
