# WC-L1A — Outcome & Journey State Capture Audit
_Generated 2026-06-08T16:54:03.604Z · SELECT-only, no writes, no new models/ontology/constructs._

Audits why **`wc3_outcome_state`** and **`wc3_journey_state`** hold **0 rows** (surfaced by WC-L1),
and measures coverage, continuity, and trend/forecast readiness for the Outcome (L2) and Journey (L3)
intelligence levers. **Audit first — STOP for approval before any remediation.**

## TL;DR — root cause (two layers)
1. **The persistence path exists and is wired, but has produced no rows for any existing session.**
   The hooks DO exist and ARE wired into `postCompletionHooks` (`capadex-enterprise.ts`), gated by
   `FF_WC3_OUTCOME` / `FF_WC3_JOURNEY` — both **ON** in the Backend API workflow. Two explanations
   are **observationally indistinguishable** from the data alone, because `postCompletionHooks` is
   fire-and-forget and never-throws (it swallows errors):
   - (i) **no session has completed since the hook/flags were activated** — the newest completion
     (`updated_at`) is **7 days old** (window 2026-05-17T16:45:27.342Z → 2026-06-01T09:51:56.734Z); or
   - (ii) the hook **ran but wrote nothing / failed silently**.
   A single live completion (Remediation R1) disambiguates. In EITHER case the existing sessions carry
   no state and there is **no backfill script** for these layers — the remediation is the same. (The
   state that DOES exist — snapshots, decision, trends — came from dedicated **backfill scripts**; the
   snapshots were all written 2026-06-08T16:10:16.633Z by backfill, not at completion.)
2. **Even a backfill cannot meaningfully populate Outcome today — there is no source spine.** The
   Outcome resolver needs ACTIVE behavioural constructs (`loadSessionConstructs`):
   tier-1 `behavioural_hypotheses` (**0 rows system-wide**), tier-2
   `capadex_session_patterns.construct_key` (**column absent** → unavailable), tier-3 (flag
   `FF_WC3_OUTCOME_CROSSWALK`, currently **OFF**) unions a session's
   `primary_construct_key` (**2/9**) and its concern bridge tag
   (**1/9** non-UNMAPPED). So under current flags **0/9** sessions
   are classifiable; even with the crosswalk enabled the upper bound is **3/9**
   (contingent on the bridge tag resolving to a construct). Every other session resolves to an honest
   **UNCLASSIFIED** and writes nothing — never fabricated.

## Population
- Total sessions: **27** · Completed: **9** · Completed w/ email: **5** · Users with ≥2 completed: **2**
- Completed-session window (by `updated_at`): **2026-05-17T16:45:27.342Z → 2026-06-01T09:51:56.734Z** · newest **7d** ago (now 2026-06-08T16:54:03.584Z)

## State-table coverage (over 9 completed sessions)
| Table | Rows | Distinct sessions | Coverage | Origin |
|---|---|---|---|---|
| wc3_longitudinal_snapshots | 9 | — | — | backfill (written 2026-06-08T16:10:16.633Z) |
| wc7b_decision_state | 9 | — | — | backfill (WC-11) |
| wc3_longitudinal_trends | 4 | — | — | backfill (WC-L1) |
| wc3_stage_state | 0 | — | 0% | no backfill; live hook produced none |
| **wc3_outcome_state** | **0** | 0 | **0.0%** | no backfill + empty spine |
| **wc3_journey_state** | **0** | 0 | **0.0%** | no backfill (backfillable, but degraded) |

## Corpus readiness (compute prerequisites — all seeded)
- `wc3_outcome_models`: **8** · `wc3_journey_routes`: **6** · `intervention_library`: **140**
> Corpora are present, so compute is NOT blocked by missing reference data — it is blocked by the live
> hook producing nothing for existing sessions and by the empty per-session behavioural spine.

## Success criteria — honest status
| Target | Result | Met? |
|---|---|---|
| Outcome State Coverage > 90% | 0.0% | ❌ |
| Journey State Coverage > 90% | 0.0% | ❌ |
| Outcome backfillable from existing intelligence | 0/9 now (≤3/9 w/ crosswalk) | ❌ (spine empty) |
| Journey backfillable from existing intelligence | 9/9 routable | ⚠️ yes, but all DEGRADED |

## Reports
1. `01_outcome_state_audit.md`  2. `02_journey_state_audit.md`  3. `03_historical_coverage_report.md`
4. `04_trend_readiness_report.md`  5. `05_forecast_readiness_report.md`  6. `06_remediation_roadmap.md`
