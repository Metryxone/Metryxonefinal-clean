# WC-L3 Deliverable 4 — Linkage Loss Funnel
_Generated 2026-06-09T16:54:53.564Z_

Flags at run: `FF_WC3_OUTCOME`=ON, `FF_WC3_OUTCOME_CROSSWALK`=ON. Audit is READ-ONLY (no writes).

Two columns: **Stored today** vs **Achievable by re-resolving EXISTING data with the EXISTING resolver**
(re_master ∪ re_pck, crosswalk-on). Outcome reachability is MEASURED by mirroring the engine's construct
resolver against each outcome model's construct vocabulary. Journey is reported in TWO honest rows: "routed"
(structurally 9/9 — the engine's Mentoring fallback guarantees a route) vs "confident/non-fallback" (requires
an activated outcome model → mirrors outcome). Both are DERIVED from the journey-engine contract, not measured here.

| Layer | Stored today | Achievable (re-resolve, existing data) |
|---|---|---|
| Completed sessions | 9 | 9 |
| Concern linked (`master_concern_pk`) | 1 (11.1%) | **9 (100.0%)** |
| Construct linked (`primary_construct_key`) | 2 (22.2%) | 5 (55.6%) |
| Outcome reachable | 3 (33.3%) | **9 (100.0%)** |
| Journey routed — incl. Mentoring fallback (DERIVED, engine contract) | 9 (100.0%) | 9 (100.0%) |
| Journey confident — non-fallback / outcome-backed (DERIVED, mirrors outcome) | 3 (33.3%) | 9 (100.0%) |
| Forecast reachable (eligible owners, ≥2 sessions) | 0/2 (0.0%) | **2/2 (100.0%)** |

## Per-session reachability (achievable)
| Session | Owned | re_master | bridge tag | resolved constructs | outcome models | outcome reachable |
|---|---|---|---|---|---|---|
| 0731f92c | yes | 65 | EXAMINATION_STRESS | EXAM_STRESS | exam_readiness | yes |
| b883418d | yes | 705 | EMOTIONAL_REGULATION | STRESS_MANAGEMENT, EMOTIONAL_REGULATION | confidence_stability, exam_readiness, holistic_wellbeing | yes |
| 7828d7a3 | yes | 705 | EMOTIONAL_REGULATION | STRESS_MANAGEMENT, EMOTIONAL_REGULATION | confidence_stability, exam_readiness, holistic_wellbeing | yes |
| 4349237c | no | 705 | EMOTIONAL_REGULATION | STRESS_MANAGEMENT, EMOTIONAL_REGULATION | confidence_stability, exam_readiness, holistic_wellbeing | yes |
| 4c9b6c0b | no | 705 | EMOTIONAL_REGULATION | STRESS_MANAGEMENT, EMOTIONAL_REGULATION | confidence_stability, exam_readiness, holistic_wellbeing | yes |
| d0f54fc4 | no | 430 | EMOTIONAL_REGULATION | EMOTIONAL_REGULATION | confidence_stability | yes |
| a0924499 | no | 430 | EMOTIONAL_REGULATION | EMOTIONAL_REGULATION | confidence_stability | yes |
| 11111111 | yes | 1297 | EMOTIONAL_REGULATION | EXAM_PERFORMANCE, EMOTIONAL_REGULATION | confidence_stability, exam_readiness | yes |
| 1cd9ca07 | yes | 65 | EXAMINATION_STRESS | EXAM_STRESS | exam_readiness | yes |

**Honest finding:** the single biggest drop is at the FIRST hop — **8** sessions lose concern
linkage today, yet **8** of those are recoverable from data already on disk. Once concern
linkage is restored, outcome reachability rises from 3 to 9/9 and forecast from
0 to 2/2 eligible owners — with no new capture.

> **Caveat — "reachable" is STRUCTURAL, not evidence quality.** Outcome reachability means the construct→model
> chain ROUTES (the engine would emit outcome state), not that rich behaviour was scored. **3** of the
> 9 reachable sessions have **0 responses** — they route to a model purely via concern linkage with no
> behavioural evidence. They are correctly EXCLUDED from forecast (anon and/or single-session); the forecast
> 2/2 rests only on the 4-session owned cohort, every one of which has responses.
