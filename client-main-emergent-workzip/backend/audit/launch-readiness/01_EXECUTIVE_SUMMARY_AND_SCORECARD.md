# 1 · Executive Summary  ·  3 · Readiness Scorecard  ·  12 · Go / No-Go

## Executive Summary

CAPADEX today is **two very different things stacked together**:

1. **A real, substantial knowledge foundation + a working free-assessment core.** The clarity-question
   bank (30,638), concern master (2,489), signal grounding (28,683), atomic signals (15,972), the
   concern→signal map (14,200) and the PIL knowledge graph (142k edges / 62k nodes) are genuinely
   built. A user can take the free assessment, get clarity questions, be routed to a concern, and
   receive a report — and 9 sessions have completed end-to-end with 39 reports persisted.

2. **An "intelligence platform" vision that is mostly unwired or unpopulated.** Everything downstream
   of the report — Outcome, Journey quality, Decision-driven Product/Growth/Mentor/Subscription
   activation, Commercial/Revenue, Forecast/Future, Enterprise/Institution, cohort personalization —
   is **broken at the keystone (Outcome = 0 rows), persisted nowhere, seeded-only, or has no live
   caller.** These are aspirations with schema, not shipping features.

On top of the wiring gaps is a **hard data-sufficiency ceiling**: 9 completed sessions, **only 2 users
with ≥2 sessions**, 4 platform users. Even the parts that work cannot produce statistically meaningful
trends, benchmarks, forecasts, or cohorts, because there is no population.

**Bottom line:** the *free assessment experience* is close to launchable as a standalone beta. The
*behavioural-intelligence platform* — the thing the architecture and marketing describe — is **not**.

## The decisive findings (all code/DB-grounded)

1. **Outcome chain is broken at the keystone.** `wc3_outcome_state` = **0 rows**. Root cause is a
   config trap, not a bug: `FF_WC3_OUTCOME` is ON, but `resolveSessionOutcomes` finds no constructs
   (the behavioural spine — `behavioural_hypotheses` / `capadex_session_patterns.construct_key` — is
   empty for these sessions) and is **prohibited from using the crosswalk fallback because
   `FF_WC3_OUTCOME_CROSSWALK` is OFF**. With no constructs, it returns `{unclassified, no_constructs}`
   and inserts nothing. Because Journey/Decision/Product/Mentor all derive from Outcome, the entire
   downstream chain runs on empty/degraded inputs.

2. **Activation & commercial layers persist (almost) nothing.** Of the whole activation chain, only
   **Decision Persistence** writes to a table (`wc7b_decision_state`, 9 rows). Product routing, Growth
   Plan, Mentor matching, Subscription, Offers and Revenue Intelligence are **runtime-only** — computed
   per request and discarded. `subscription_packages` and `student_subscriptions` are empty; the
   `wc7c_*` tables **do not exist**. Commercial readiness is effectively zero.

3. **The 30,638-row question-intelligence build is not wired to runtime.** L5A–L5D
   (`wc3_question_intelligence`, `wc3_question_context`) were produced by build scripts, but
   `wc3QuestionIntel` / `wc3ContextIntel` are OFF and **no live caller consumes them**. Significant
   work, currently dark.

4. **Forecast / Future is aspiration + seed.** `m4-predictive` exists but heuristic; AI Career
   Navigator / Future Skills Planner / Employability 2.0 / Entrepreneurship are documentation +
   mockups with no live navigator route. Forecast tables hold 1–4 rows.

5. **Enterprise / Institution is a stub.** `iil-core` generates identity/culture/emotional-climate via
   `rnd(min,max)` random values; there is **no live bridge** from real sessions to institution/cohort
   intelligence. Institution tables (67) are reference data.

6. **Longitudinal/Trend is the healthiest new subsystem but data-starved.** The trend engine is real
   with honest degradation, but `trendIntelligence` / `longitudinalAutomation` are OFF in the running
   workflow, and only **2 users** qualify for a trend at all.

## 3 · Readiness Scorecard (7 scores)

Scores are 0–100, computed from an explicit formula — `0.40·Wiring + 0.30·Persistence +
0.30·DataConfidence` — with all component inputs and the rationale published in
`06_SCORING_METHODOLOGY_AND_EVIDENCE.md`. They are deliberately *not* inflated; a working engine over an
empty/2-user base scores low because launch readiness requires wiring, persistence, **and** real data.

| # | Score | Rating | Basis (grounded; components in §06) |
|---|---|---:|---|
| 1 | **Platform Readiness** | **46 / 100** | Free assessment→stage→report core works (9 completed, 39 reports). But only 4 platform users, outcome chain broken, 531/980 tables empty. Core is demoable, not scaled. (W60/P55/D18) |
| 2 | **Intelligence Readiness** | **36 / 100** | Stage ✅(9), Decision persists ✅(9) — but Outcome **0** (keystone broken), Journey 100% **degraded** (conf 0.2), question-intel layers dark (no live caller). (W50/P42/D12) |
| 3 | **Activation Readiness** | **32 / 100** | Decision/Product/Growth/Mentor/Subscription all wired & flag-ON, but **only Decision persists**; the rest are runtime-only and derive from the empty Outcome/degraded Journey. (W60/P15/D12) |
| 4 | **Commercial Readiness** | **18 / 100** | Runtime-only revenue/offer aggregation over 6 payments; `subscription_packages`=0; no `wc7c_*` tables; no entitlement/renewal/upsell state persisted. (W35/P5/D8) |
| 5 | **Longitudinal Readiness** | **31 / 100** | Real engine + honest degradation, snapshots 9, but trends flag OFF in workflow, only **2** trend-eligible users → no statistical basis. (W38/P45/D8) |
| 6 | **Future Readiness** | **13 / 100** | Heuristic forecasts + seed tables (1–4 rows); WC-8/WC-9 products are docs/mockups; no live navigator route; needs ≥2 trajectory snapshots that don't exist. (W22/P8/D6) |
| 7 | **Enterprise Readiness** | **9 / 100** | IIL identity/culture/climate are `rnd()` stubs; no live session→institution bridge; m5 demo/seed; no multi-user B2B reporting from real data. (W15/P6/D4) |

**Composite platform-vision readiness = 26 / 100** (mean of the 7).  **Core-assessment-only readiness =
57 / 100** (assessment→clarity→concern→stage→report subset; computation in §06).

## 12 · Go / No-Go Recommendation

### ❌ NO-GO — for the full "behavioural intelligence platform" launch.
The end-to-end value chain the platform advertises (assessment → outcome → journey → decision →
product/growth/mentor → subscription/revenue → longitudinal/forecast → enterprise) **cannot be
delivered today**: the keystone (Outcome) is empty, the activation/commercial layers persist nothing,
forecast/enterprise are seed/stub, and there is no user population to make any longitudinal or
comparative claim honest. Launching on these claims would be selling intelligence the system does not
produce.

### ✅ CONDITIONAL GO — for a narrowly-scoped **Free Assessment Beta**.
A defensible, honest launch is possible **if scope is cut to what verifiably works**:
- Free assessment → clarity questions → concern resolution → **Stage** + report.
- Framed explicitly as a **beta / early preview**; no outcome/journey/forecast/benchmark/"intelligence"
  claims; no paid tiers (commercial layer isn't real).
- Treat it as a **data-collection launch** whose primary goal is to grow the session base past the
  thresholds that unlock the rest (see roadmaps).

**Recommended decision:** proceed with the Conditional-Go beta **only after** Critical Blocker #1
(Outcome chain) is resolved or the Outcome/Journey surfaces are explicitly hidden from users, so the
product never displays degraded/empty intelligence as if it were real. Details in
`03_BLOCKERS_AND_GAPS.md` and `05_ROADMAP_30_60_90.md`.
