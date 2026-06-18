# 2 · End-to-End Architecture Status

Status legend: ✅ working & persisted · ⚠️ runs but runtime-only / degraded / data-starved ·
❌ broken / empty / no live caller · 🌱 seed/stub/demo only.

## The pipeline, stage by stage

| # | Stage | Status | Grounded evidence |
|---|---|:--:|---|
| 1 | **Question Intelligence (L5A–L5D)** | ❌ | `wc3_question_intelligence`/`wc3_question_context` built (30,638 each) by `scripts/wc3/build-*`, but **no live caller**; flags `wc3QuestionIntel`/`wc3ContextIntel` OFF. Outcome/Journey projection services are pure, used only by build/audit scripts. |
| 2 | **Stage Intelligence** | ⚠️ | `stage-intelligence.ts` runs in `postCompletionHooks`; `FF_WC3_STAGE` ON; persists `wc3_stage_state` = **9/9** completed sessions. Coverage 100%, confidence low (9-session base). |
| 3 | **Context Intelligence** | ❌ | `question-context-intelligence.ts` has no runtime caller; `wc3ContextIntel` OFF. |
| 4 | **Outcome Intelligence** | ❌ | `FF_WC3_OUTCOME` ON but `wc3_outcome_state` = **0**. `resolveSessionOutcomes`→`loadSessionConstructs` returns `[]` (empty spine) and crosswalk fallback blocked by `FF_WC3_OUTCOME_CROSSWALK` OFF → `{no_constructs}`, no insert. **Chain keystone broken.** |
| 5 | **Journey Intelligence** | ⚠️ | `journey-intelligence.ts` runs; `FF_WC3_JOURNEY` ON; `wc3_journey_state` = **9** but **100% degraded (conf 0.2)** because it consumes the empty Outcome. Coverage 100% / confidence ~0. |
| 6 | **Decision Intelligence** | ✅⚠️ | Orchestrator (`wc7b/decision-orchestrator.ts`) stitches stage+outcome+journey into a transient envelope; **Decision Persistence** writes `wc7b_decision_state` = **9** (`FF_DECISION_*` ON). Persists ✅ but inputs are degraded ⚠️. |
| 7 | **Product Activation** | ⚠️ | Derived in orchestrator from `wc3_journey_state.product_mapping`; **runtime-only, no persistence**; depends on degraded journey. |
| 8 | **Growth Plan Activation** | ⚠️ | `wc7b/growth-plan-bridge.ts`, `FF_JOURNEY_GROWTH_PLAN_BRIDGE` ON, but calls `coach.growthPlan(..., persist=false)` → **nothing written**. |
| 9 | **Mentor Activation** | ⚠️ | `wc7b/mentor-bridge.ts`, `FF_DECISION_MENTOR_BRIDGE` ON, pure derivation → **ephemeral, no DB write**. |
| 10 | **Subscription Intelligence** | ⚠️ | `wc7c/subscription-engine.ts`, `FF_COMMERCIAL_ACTIVATION` ON; reads `capadex_payments` for entitlements but **writes no state**; `subscription_packages`=0. |
| 11 | **Commercial / Revenue** | ⚠️🌱 | `wc7c/offer-engine.ts` + `revenue-intelligence.ts` aggregate live but **persist nothing**; over **6** payments; `wc7c_*` tables don't exist. Crisis safety-suppression present (good). |
| 12 | **User Intelligence Foundation** | ⚠️ | `user-intelligence-foundation.ts` → `wcl0_user_intelligence` = **9**, but gating flag `userIntelligenceFoundation` is **OFF** in the workflow (rows are from prior backfill, not a live flagged path). |
| 13 | **Longitudinal Intelligence** | ⚠️ | `wc3_longitudinal_snapshots` = **9**; `wc3_longitudinal_trends` = **4**; engine real w/ honest degradation; `trendIntelligence`/`longitudinalAutomation` OFF in workflow. |
| 14 | **Forecast Intelligence** | 🌱 | `m4-predictive.ts` heuristic; needs ≥2 `m4_capability_trajectories` snapshots; forecast tables 1–4 rows. |
| 15 | **Future Readiness (WC-8/WC-9)** | 🌱 | AI Career Navigator / Future Skills Planner / Employability 2.0 / Entrepreneurship = docs (`audit/wc-9/*`) + frontend mockups; no live navigator backend route. |
| 16 | **Enterprise / Institution** | 🌱 | `iil-core.ts` uses `rnd()` for identity/culture/emotional-climate; no live session→institution bridge; m5 demo/seed; institutions(67) are reference. |
| 17 | **Data Quality** | ❌ | 531/980 tables empty (54%); runtime-to-persistence gaps across activation/commercial; orphaned build artifacts (question-intel); `pg_stat` estimates unreliable (ANALYZE never run). |
| 18 | **Personalization** | ⚠️ | `personalization-wiring.ts` → `wc3_personalization_decisions` = **11**; `FF_WC3_PERSONALIZATION` ON; but report/rec personalization flags (`wc3ReportPersonalization`/`wc3RecPersonalization`) OFF; no cohort base. |

## Flag reality (running `Backend API` workflow)

**ON via workflow env:** runtime-intelligence activation + pipeline; WC-3 stage/outcome/journey/
personalization/longitudinal; decision orchestrator + persistence; journey→growth-plan bridge;
decision→mentor bridge; commercial activation.
**ON via registry default:** competency-V2 suite, adaptive runtime/branching, UCIP, employability
passport, adaptive questioning.
**OFF (key gaps):** `wc3OutcomeCrosswalk` (⛔ this is what strands Outcome), `wc3QuestionIntel`,
`wc3ContextIntel`, `userIntelligenceFoundation`, `trendIntelligence`, `longitudinalAutomation`,
`revenueIntelligence`, `runtimeIntelligenceConsumption`, `signalGroundingRuntime`,
`wc3ReportPersonalization`, `wc3RecPersonalization`, `wc3LongitudinalConsumption`.
**DB `feature_flags` table:** only `signal_intelligence` + `dynamic_reporting` ON.

## Architectural read
- The **read path** (assessment, clarity questions, concern resolution, report) is solid and backed by
  real ontology.
- The **write/persistence path for intelligence** is the systemic weakness: most engines compute on
  demand and discard, so there is no accumulating intelligence asset — which also starves longitudinal/
  forecast/enterprise of the very history they need.
- The **Outcome config trap** (`FF_WC3_OUTCOME` ON while `FF_WC3_OUTCOME_CROSSWALK` OFF and spine
  empty) is a single high-leverage break: fixing the construct supply unblocks Journey→Decision→
  Product/Mentor quality in one move.
