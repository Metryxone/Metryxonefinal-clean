# WC-L5 · Deliverable 5 — Forecast & Trend Memory
_Generated 2026-06-10T04:43:53.119Z. Read-only._

Forecast memory snapshots `computeUserForecasts` (WC-L2 has no table of its own — memory is its only
persisted home); trend memory is the WC-L1 fold inside `behaviour_memory`. Both are user-level and
**email-keyed**, so their denominator is the **2** longitudinal users (≥2 sessions), never the
9 completed sessions.

## Forecast memory
| Metric | Value |
|---|---|
| Forecast memory rows | 12 |
| Users with ≥1 forecast memory | 2 / 2 |

| Forecast kind · projected direction | rows |
|---|---|
| growth stable | 4 |
| outcome stable | 4 |
| journey improving | 2 |
| journey stable | 2 |

## Trend memory (WC-L1 fold)
| Metric | Value |
|---|---|
| Trend memory rows | 26 |
| Users with ≥1 trend memory | 2 / 2 |

| Trend metric · direction | rows |
|---|---|
| decision stable | 4 |
| outcome stable | 4 |
| stage stable | 4 |
| behaviour_confidence declining | 2 |
| behaviour_engagement declining | 2 |
| behaviour_motivation declining | 2 |
| journey improving | 2 |
| behaviour_confidence stable | 2 |
| behaviour_engagement stable | 2 |
| journey stable | 2 |

## Honest ceiling + flag dependency
A trend (and therefore a forecast) exists only where a user has ≥2 sessions — **2** users today.
Forecasts also require `FF_FORECAST_INTELLIGENCE` ON when the engine runs; the default Backend API
workflow does not enable it, so in current production forecast memory would be **absent** until that flag
is on. The backfill enabled it to snapshot forecasts wherever the data supports them — never to invent them.

> **Backfill-time anachronism (honest caveat):** trend/forecast are USER-level state, so the backfill
> writes the same backfill-time value into each of a user's historical sessions — these rows are **not**
> point-in-time-of-session snapshots. The live post-completion hook records point-in-time state going
> forward; the historical duplication is a backfill artefact, disclosed here rather than hidden.
