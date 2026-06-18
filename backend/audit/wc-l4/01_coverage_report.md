# WC-L4 · Deliverable 1 — Coverage Report
_Generated 2026-06-10T04:02:53.569Z. Read-only; no DB writes. Emails one-way sha256-masked._

## Session coverage (raw vs real-source)
| Metric | Value |
|---|---|
| Completed sessions (base) | 9 |
| Sessions with outcome state (generator pre-req) | 6 |
| Sessions with ≥1 persisted intervention | 4 |
| **Coverage of completed sessions** | **44.4%** (4/9) |
| **Coverage of outcome-state sessions** | **66.7%** (4/6) |
| Total interventions persisted | 6 |

## Honest ceiling
An intervention can ONLY be generated from a library-backed outcome action (`wc3_outcome_actions` →
`intervention_library`). The generator's pre-requisite is a resolved outcome model carrying ≥1 active
library action; a session with an empty / UNCLASSIFIED behavioural spine, or whose resolved models carry
no library action, produces **zero** interventions (fail-closed). The real coverage ceiling is therefore
the count of sessions with library-backed outcome actions — **not** the completed-session total. Coverage
below 100% of completed sessions is an honest reflection of the upstream spine, not a wiring gap.
