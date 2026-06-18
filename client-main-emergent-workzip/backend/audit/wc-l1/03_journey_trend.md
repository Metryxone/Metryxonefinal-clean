# Deliverable 3 — Lever 3: Journey Trend
_Generated 2026-06-08T16:35:30.858Z_

Direction of **journey progression** across each user's session history,
computed by the REUSED longitudinal trend math over existing state (`wc3_journey_state.route_confidence`),
normalised to a shared 0..100 progression scale. A user needs ≥2 readable points or gets no trend
(never fabricated).

## Metrics (trend-eligible users, N=2)
| Metric | Value | Definition |
|---|---|---|
| Coverage | **0/2 (0.0%)** | eligible users with a journey trend row |
| Confidence (mean) | **0.00** | scales with #comparable sessions (2=min≈0.33 · 4+=1.0) |
| Directions | improving 0 · stable 0 · declining 0 | distribution across covered users |

## Source state
- `wc3_journey_state.route_confidence` — table has **0 rows (0 rows — journey state never persisted for any session)**.

## Per-user journey trends
- (none — no eligible user has two readable points for this lever)

> Coverage and Confidence are INDEPENDENT axes and never merged. This lever has **no source state persisted**, so its coverage is honestly 0% — nothing is invented to fill it.
