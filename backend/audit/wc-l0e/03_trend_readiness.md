# WC-L0E Deliverable 3 — Trend / Longitudinal Readiness (before → after)
_Generated 2026-06-09T15:19:15.380Z_

A behaviour trend needs the SAME user to have **≥2 sessions each carrying a readable dimension**
(never fabricated). Reusing the existing trend math (`leastSquaresSlope` / `directionOf`).

| Measure | Before | After | Target | Met? |
|---|---|---|---|---|
| Trend-eligible users (≥2 completed) | 2 | 2 | — | — |
| Users with a usable behaviour trend | 0/2 (0.0%) | 2/2 (100.0%) | ≥50% | ✅ |
| Mean trend confidence | 0.00 | 0.33 | (informative) | — |

## Honest reading
Trend readiness is gated by **returning users with ≥2 graphed sessions**, not by the projection. The
backfill activates historical graphs, but a behaviour trend only appears once the SAME user accrues two
graphed sessions for the same dimension. Where the live base has no such user, trend readiness stays at
its true ceiling — not modelled up.
