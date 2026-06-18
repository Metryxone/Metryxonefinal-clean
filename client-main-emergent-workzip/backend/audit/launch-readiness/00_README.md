# CAPADEX End-to-End Launch Readiness Audit
_Read-only audit. No source, flag, schema, or data changes were made. STOP for approval._

## Scope & method (how every number here was obtained)
- **Environment:** the **development / workspace** PostgreSQL database (`DATABASE_URL`) and the running
  `Backend API` workflow configuration. This is NOT the production deployment DB — production figures
  would have to be measured separately (read-only) against the deployed database.
- **Data:** exact `COUNT(*)` over **all 980 user tables** via `query_to_xml` (estimates from
  `pg_stat_user_tables` were found unreliable — e.g. they reported `capadex_sessions`=0 while the real
  count is 27 — so every figure below is an exact count, not an estimate).
- **Flags:** the file registry `config/feature-flags.ts`, the env overrides in the `Backend API`
  workflow command, and the `feature_flags` DB table.
- **Wiring:** code-grounded tracing of `postCompletionHooks` (`routes/capadex-enterprise.ts`),
  `services/wc3/*`, `services/wc7b/*`, `services/wc7c/*`, and the activation/commercial routes.
- **Honesty rule:** nothing is assumed or fabricated. "Coverage" (does data exist) and "Confidence"
  (is it statistically/qualitatively trustworthy) are reported as **separate axes** — high coverage on
  a tiny base is NOT readiness.

## The one-paragraph truth
The platform has a **large, genuinely-built knowledge/ontology foundation** (clarity-question bank,
concern master, signal grounding, PIL knowledge graph, archetype + intervention libraries) and a
**working free-assessment → stage → report core**. Everything *downstream of that core* — Outcome,
Journey quality, Decision-driven Product/Growth/Mentor/Subscription activation, Commercial/Revenue,
Forecast/Future, Enterprise/Institution, Longitudinal trends, cohort personalization — is either
**unpopulated, runtime-only with no persistence, seed/stub data, or has no live caller**. On top of the
wiring gaps sits a hard **data-sufficiency ceiling**: 9 completed sessions, **2** users with ≥2
sessions, 4 platform users. There is no population to support trends, benchmarks, forecasts, or cohorts.

## Ground-truth census (exact counts, dev DB)
| Layer | Representative tables (exact rows) | Verdict |
|---|---|---|
| **Seeded ontology / knowledge** | clarity_questions **30,638**; concerns_master **2,489**; bridge_tag_signal_grounding **28,683**; atomic_signals **15,972**; concern_signal_map **14,200**; concern_clarity_map **9,760**; pil_kg_edges **142,457** / nodes **62,095**; recommendation_library **1,468**; intervention_library **140** + pil_intervention_library **660** | **Built / substantial** (static knowledge, not user data) |
| **Assessment runtime (real users)** | capadex_sessions **27** (completed **9**, in_progress 10, replaced 8); capadex_users **12**; capadex_reports **39**; capadex_runtime_sessions **287**; pragati_sessions **30**; platform users **4**; career_seeker_profiles **2** | **Tiny / pre-launch** |
| **WC-3 intelligence chain** | stage_state **9**; outcome_state **0** ❌; journey_state **9** (all degraded); longitudinal_snapshots **9**; longitudinal_trends **4**; personalization_decisions **11**; wc7b_decision_state **9**; wcl0_user_intelligence **9** | **Partial; keystone (Outcome) broken** |
| **Commercial** | capadex_payments **6**; subscription_packages **0**; student_subscriptions **0**; `wc7c_*` tables **do not exist** | **Not persisted** |
| **Forecast / Future** | m4_future_readiness_scores **3**; m4_future_capability_gaps **2**; m3_future_skill_forecasts **4**; competency_forecasts **1**; most `*_forecasts` **0** | **Seed-only** |
| **Enterprise / Institution** | institutions **67** (reference); all `iil_*` runtime **0** (identity/culture/climate are `rnd()` stubs); m5_* 1–15 (demo) | **Stub / seed** |
| **DB totals** | **449 non-empty / 980 tables → 531 empty (54%)** | Enormous unused schema surface |

## Deliverable index
| # | Deliverable | File |
|---|---|---|
| 1, 3, 12 | Executive Summary · Readiness Scorecard (7 scores) · Go/No-Go | `01_EXECUTIVE_SUMMARY_AND_SCORECARD.md` |
| 2 | End-to-End Architecture Status (all 18 areas) | `02_ARCHITECTURE_STATUS.md` |
| 4, 5 | Critical Blockers · High-Priority Gaps | `03_BLOCKERS_AND_GAPS.md` |
| 6–11 | Revenue · Product · Personalization · Longitudinal · Future · Enterprise readiness | `04_DOMAIN_READINESS_REPORTS.md` |
| 13, 14, 15 | 30 / 60 / 90-Day Roadmaps | `05_ROADMAP_30_60_90.md` |
| — | Scoring methodology (formula + components) · evidence ledger (claim→anchor) | `06_SCORING_METHODOLOGY_AND_EVIDENCE.md` |

## How to read the scores
Every numeric score is computed from a single published formula —
`0.40·Wiring + 0.30·Persistence + 0.30·DataConfidence`, each component 0–100 — with all inputs, rationale,
and a claim→code/DB evidence ledger in `06_SCORING_METHODOLOGY_AND_EVIDENCE.md`. Nothing is eyeballed.
