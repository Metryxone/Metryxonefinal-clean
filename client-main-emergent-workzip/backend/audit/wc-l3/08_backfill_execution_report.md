# WC-L3 Deliverable 8 — Concern Linkage Backfill Execution
_Generated 2026-06-09T17:05:33.498Z_

Mode: **APPLY (writes committed)**. Flags: `FF_FORECAST_INTELLIGENCE`=ON, `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON.

Executes the approved WC-L3 recommendation: re-resolve & persist the stale concern/construct linkage with
the EXISTING resolvers (additive, never-overwrite), then activate outcomes/trends via the EXISTING WC-L2B
engine. Outcome backfill is gated to sessions with ≥1 response (no evidence-free rows).

## Coverage before → after
| Metric | Before | After |
|---|---|---|
| Concern linked (`master_concern_pk`) | 1/9 (11.1%) | 9/9 (100.0%) |
| Construct linked (`primary_construct_key`) | 2/9 (22.2%) | 5/9 (55.6%) |
| Outcome-state sessions (total) | 3 | 6 |
| — owned / anon | 1 / 2 | 4 / 2 |
| Eligible owners (≥2 sessions) | 2 | 2 |
| Eligible owners WITH outcome trend | 0 (0.0%) | 2 (100.0%) |
| Eligible owners WITH outcome forecast | 0 (0.0%) | 2 (100.0%) |

Writes this run: master_concern_pk **8**, primary_construct_key **3**, outcome rows **3**, withheld (0-response) **3**, trend recomputes **2**.

## Per-session ledger
| Session | Owned | resp | concern | had master | had pck | re_master | re_pck | master written | pck written | outcome |
|---|---|---|---|---|---|---|---|---|---|---|
| 0731f92c | yes | 10 | Career Anxiety | no | no | 65 | — | yes | no | **exam_readiness** |
| b883418d | yes | 10 | Anxiety & Overthinking | no | no | 705 | STRESS_MANAGEMENT | yes | yes | **confidence_stability, exam_readiness, holistic_wellbeing** |
| 7828d7a3 | yes | 10 | Anxiety & Overthinking | no | no | 705 | STRESS_MANAGEMENT | yes | yes | **confidence_stability, exam_readiness, holistic_wellbeing** |
| 4349237c | no | 3 | Anxiety & Overthinking | no | yes | 705 | — | yes | no | skipped — existing outcome state (never-overwrite) |
| 4c9b6c0b | no | 3 | Anxiety & Overthinking | no | yes | 705 | — | yes | no | skipped — existing outcome state (never-overwrite) |
| d0f54fc4 | no | 0 | Work Stress | no | no | 430 | — | yes | no | WITHHELD — 0 responses (linkage filled, but no behavioural evidence; excluded to avoid evidence-free outcome) |
| a0924499 | no | 0 | Work Stress | no | no | 430 | — | yes | no | WITHHELD — 0 responses (linkage filled, but no behavioural evidence; excluded to avoid evidence-free outcome) |
| 11111111 | yes | 0 | Exam stress | no | no | 1297 | EXAM_PERFORMANCE | yes | yes | WITHHELD — 0 responses (linkage filled, but no behavioural evidence; excluded to avoid evidence-free outcome) |
| 1cd9ca07 | yes | 10 | Career Anxiety | yes | no | — | — | no | no | skipped — existing outcome state (never-overwrite) |

## Per eligible owner (after)
| Owner | Sessions | Outcome-bearing | Trend points | Has trend | Forecastable | Confidence | Band |
|---|---|---|---|---|---|---|---|
| user_65454b2b8b | 2 | 2 | 2 | yes | yes | 0.33 | low |
| user_4b262cc8a5 | 2 | 2 | 2 | yes | yes | 0.33 | low |

**Honest notes:** linkage writes are guarded `WHERE <col> IS NULL` (never overwrite). 3 zero-response
session(s) had linkage filled but outcome WITHHELD (no behavioural evidence — would be an evidence-free row).
Forecast confidence at a 2-point series is the WC-L2 `low` (0.33) floor by construction; reaching moderate/high
needs 3–4 outcome-bearing sessions per owner (data-accumulation ceiling, not a linkage defect).
