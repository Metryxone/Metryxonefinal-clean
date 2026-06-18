# WC-L5 · Deliverable 2 — Memory Types
_Generated 2026-06-10T04:43:53.119Z. Read-only._

The registry defines an EXACT closed set of **7** memory types. WC-L1 Trend has no dedicated type — it is
folded into `behaviour_memory` (one `trend:<metric>` row per trend) alongside the WC-L0 user snapshot
(`user_intelligence`), so "User Memory" and "Trend Memory" stay directly queryable without a new type.

## Rows & sessions by memory type
| memory_type | source layer | rows | sessions |
|---|---|---|---|
| stage_memory | WC-L1 Stage Intelligence | 9 | 9 |
| outcome_memory | WC-L2 Outcome Intelligence | 14 | 6 |
| journey_memory | WC-L3 Journey Intelligence | 9 | 9 |
| decision_memory | WC-11 Decision Orchestration | 9 | 9 |
| behaviour_memory | WC-L0 User Intelligence + WC-L1 Trend (folded) | 35 | 9 |
| forecast_memory | WC-L2 Forecast Intelligence | 12 | 4 |
| intervention_memory | WC-L4 Intervention Intelligence | 6 | 4 |

## behaviour_memory split (WC-L0 user snapshot vs WC-L1 trend fold)
| Sub-stream | rows | distinct users |
|---|---|---|
| user_intelligence (WC-L0) | 9 | 3 |
| trend:<metric> (WC-L1 fold) | 26 | 2 |

## Degraded is remembered, but bucketed separately (factual, never inflated)
| Type | Real | Degraded (remembered, flagged) |
|---|---|---|
| journey_memory | 3 | 6 |
| decision_memory | 0 | 9 |

Degraded journey/decision routes are a routing **guarantee**, not evidence of progression — they are
remembered as fact but reported apart from real routes so nothing is over-claimed.
