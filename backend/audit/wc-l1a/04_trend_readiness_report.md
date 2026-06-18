# Deliverable 4 — Trend Readiness Report
_Generated 2026-06-08T16:54:03.604Z_

Readiness of each lever to feed **WC-L1 Trend Intelligence** (direction needs ≥2 readable, varying
points per user). Numbers below are the ACTUAL persisted WC-L1 computations (`wc3_longitudinal_trends`,
metrics present: decision, stage), not estimates.

| Lever | Source state | Source rows | Trend readiness |
|---|---|---|---|
| Stage | wc3_longitudinal_snapshots | 9 | ✅ computed (stable, 2pt, conf 0.33, 25→25) |
| Outcome | wc3_outcome_state | 0 | ❌ blocked — no source rows (empty spine) |
| Journey | wc3_journey_state | 0 | ❌ blocked — no source rows; even backfilled it is degraded-constant (~0.2) → trivially "stable", no real direction |
| Decision | wc7b_decision_state | 9 | ✅ computed (stable, 2pt, conf 0.33, 60→60) |

## Persisted trend rows (authoritative WC-L1 output)
| Metric | User | Direction | Points | Slope/session | Confidence | First→Last |
|---|---|---|---|---|---|---|
| decision | harv… | stable | 2 | 0 | 0.33 | 60→60 |
| decision | laks… | stable | 2 | 0 | 0.33 | 60→60 |
| stage | harv… | stable | 2 | 0 | 0.33 | 25→25 |
| stage | laks… | stable | 2 | 0 | 0.33 | 25→25 |

## Why Outcome/Journey trend = 0% (and would stay low even after a journey backfill)
- **Outcome**: no rows to trend; backfill yields 0 rows (UNCLASSIFIED) → remains 0%.
- **Journey**: a backfill yields rows, but with `route_confidence ≈ 0.2` on every session the trend
  would read "stable" at a meaningless floor — coverage would rise but the signal carries no
  information until Outcome (its scoring input) is populated.

## Verdict
Trend Intelligence is **2/4 levers populated** (decision, stage) — matching WC-L1.
Outcome and Journey are blocked on capture, not on trend math. Note the populated levers are flat
(slope 0, "stable") at only 2 points — coverage exists but directional confidence
is honestly low (0.33).
