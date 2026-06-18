# Scoring Methodology & Evidence Ledger
_Added so every numeric score is reproducible from stated inputs, and every major claim maps to a code/DB
anchor. This is the answer to "where does the number come from?"_

## Scoring formula (identical for all 7 scores + domain sub-scores)

Each readiness score is a weighted blend of three 0–100 component axes:

```
Score = round( 0.40·Wiring + 0.30·Persistence + 0.30·DataConfidence )
```

- **Wiring (W)** — is the capability implemented AND invoked in a live runtime path (under the flags
  actually set in the running `Backend API` workflow)? 0 = no live caller; 100 = fully wired & flag-on.
- **Persistence (P)** — does it write durable state to a table (vs runtime-only/ephemeral)? 0 = nothing
  persisted; 100 = complete durable state.
- **DataConfidence (D)** — is there sufficient, trustworthy data? Anchored to the population reality
  (9 completed sessions, 2 multi-session users, 4 platform users). With n this small, D is capped low
  for anything statistical/temporal/comparative — this is the honest ceiling, not pessimism.

Weights favour Wiring (a thing must run) then split Persistence/Data evenly (it must both stick and be
real). Composite platform-vision score = simple mean of the 7.

## Component inputs → computed scores (fully reproducible)

| Score | W | P | D | Computed = 0.40W+0.30P+0.30D |
|---|---:|---:|---:|---:|
| Platform Readiness | 60 | 55 | 18 | **46** |
| Intelligence Readiness | 50 | 42 | 12 | **36** |
| Activation Readiness | 60 | 15 | 12 | **32** |
| Commercial Readiness | 35 | 5 | 8 | **18** |
| Longitudinal Readiness | 38 | 45 | 8 | **31** |
| Future Readiness | 22 | 8 | 6 | **13** |
| Enterprise Readiness | 15 | 6 | 4 | **9** |
| **Composite (mean of 7)** | | | | **26** |

**Component rationale (why each W/P/D):**
- *Platform* W60 (read path runs end-to-end), P55 (sessions/reports/runtime sessions persist), D18 (4 users).
- *Intelligence* W50 (stage/decision live; outcome/context/question-intel dark), P42 (stage/decision
  persist, outcome 0), D12.
- *Activation* W60 (all bridges wired & flag-on), P15 (only Decision persists), D12.
- *Commercial* W35 (engines run on request), P5 (nothing persisted, no `wc7c_*`, packages 0), D8 (6 payments).
- *Longitudinal* W38 (engine real but trend/automation flags OFF in workflow), P45 (snapshots persist), D8 (2 eligible users).
- *Future* W22 (heuristic engine, no navigator route), P8 (seed tables), D6.
- *Enterprise* W15 (routes exist), P6 (rnd() stubs, no real bridge), D4.

## "Core-assessment-only" sub-score (reproducible, replaces the earlier ≈60)
Scope = assessment → clarity → concern → Stage → report **only** (excludes all downstream intelligence).
W75 (all four steps run), P70 (sessions, reports, runtime sessions persist), D20 (4 users):
`0.40·75 + 0.30·70 + 0.30·20 = 30 + 21 + 6 = ` **57 / 100**. This is the only sub-experience near launch.

## Domain sub-scores (same formula)
| Domain (deliverable) | W | P | D | Score |
|---|---:|---:|---:|---:|
| Revenue (6) = Commercial | 35 | 5 | 8 | **18** |
| Product (7) | 55 | 45 | 15 | **40** |
| Personalization (8) | 40 | 35 | 12 | **30** |
| Longitudinal (9) | 38 | 45 | 8 | **31** |
| Future (10) | 22 | 8 | 6 | **13** |
| Enterprise (11) | 15 | 6 | 4 | **9** |

## Evidence ledger (claim → anchor)
| Claim | Anchor (file / table / query) | Value |
|---|---|---|
| 449 non-empty / 980 tables | exact `COUNT(*)` via `query_to_xml` over `pg_stat_user_tables` | 449 / 980 |
| 27 sessions, 9 completed | `select status,count(*) from capadex_sessions group by status` | 9 / 10 / 8 |
| 2 multi-session users | `…where status='completed' and guest_email is not null group by guest_email` | harvalt43(2), lakshman.vema(2) |
| Outcome empty + cause | `services/wc3/outcome-intelligence.ts` `resolveSessionOutcomes`/`loadSessionConstructs`; `isWc3OutcomeCrosswalkEnabled()` gate | `wc3_outcome_state`=0 |
| Journey degraded | `wc3_journey_state` all conf 0.2; `journey-intelligence.ts` consumes outcome | 9 rows |
| Decision persists | `wc7b/decision-persistence.ts` in `postCompletionHooks` | `wc7b_decision_state`=9 |
| Growth not persisted | `wc7b/growth-plan-bridge.ts` `coach.growthPlan(…, persist=false)` | no write |
| Subscription/Revenue runtime-only | `wc7c/subscription-engine.ts`, `wc7c/revenue-intelligence.ts` | no write |
| No commercial substrate | `subscription_packages`=0; `wc7c_*` tables absent; `capadex_payments`=6 | — |
| IIL stubbed | `routes/iil-core.ts` `rnd(min,max)` for identity/culture/climate | random |
| Forecast seed-level | `m4_future_readiness_scores`=3, `m3_future_skill_forecasts`=4, most `*_forecasts`=0 | seed |
| Question-intel dark | `wc3_question_intelligence`/`wc3_question_context`=30,638 each; flags OFF; build scripts only | no live caller |
| Flag reality | `config/feature-flags.ts` + `Backend API` workflow env + `feature_flags` DB table | see §02 |

> All counts are exact, from the **dev/workspace DB**. Production figures must be measured separately
> (read-only) before a production Go/No-Go.
