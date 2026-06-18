# Deliverable 3 — Historical Coverage Report
_Generated 2026-06-08T16:54:03.604Z_

## Session inventory
| Metric | Value |
|---|---|
| Total sessions | 27 |
| Completed sessions | 9 |
| Completed with email (user-linkable) | 5 |
| Distinct users with ≥2 completed (trend-eligible) | 2 |
| Completed-session window (`updated_at`) | 2026-05-17T16:45:27.342Z → 2026-06-01T09:51:56.734Z |
| Time since newest completion | 7 days |

## State capture per intelligence layer (over 9 completed)
| Layer | Table | Rows | Coverage | How it got there |
|---|---|---|---|---|
| L1 Stage | wc3_stage_state | 0 | 0% | no backfill; live hook produced none |
| L6 Longitudinal | wc3_longitudinal_snapshots | 9 | 100.0% | **backfill** (2026-06-08T16:10:16.633Z) |
| L2 Outcome | wc3_outcome_state | 0 | 0% | no backfill; empty spine |
| L3 Journey | wc3_journey_state | 0 | 0% | no backfill |
| WC-11 Decision | wc7b_decision_state | 9 | 100.0% | **backfill** (WC-11) |
| WC-L1 Trends | wc3_longitudinal_trends | 4 | — | **backfill** (WC-L1) |

## Historical continuity
- Trend/forecast continuity requires ≥2 completed sessions per user. Only **2** users
  qualify; the rest have a single completed session or are anonymous (no cross-session identity).
- **Pattern:** every populated state table was filled by an explicit **backfill script**, not by the
  live completion hook. Stage, Outcome, and Journey are exactly the three layers that **lack a backfill
  script** — which is why they read 0, independent of whether the live hook has fired.

## Conclusion
Historical coverage is gated by (1) a backfill script per layer, and (2) for Outcome, the upstream
behavioural spine. Continuity for genuinely longitudinal analysis is inherently small here
(2 eligible users) regardless of layer wiring.
