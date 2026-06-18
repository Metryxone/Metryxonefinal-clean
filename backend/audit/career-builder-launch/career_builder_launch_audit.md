# Career Builder — Launch Readiness Audit

**Product:** MetryxOne Career Builder (`CareerBuilderPage.tsx` monolith + Career Operating System + Employability Passport + Resume Studio + Jobs/Fitment + Competency/Adaptive Intelligence tabs)
**Audit type:** Evidence-based launch readiness — customer-value & launch-readiness, NOT a route/code-volume audit.
**Date:** 2026-06-18
**Honesty contract (replit.md):** Three axes — **Structural** (code exists), **Activation** (real data in the LIVE shared DB), **Validity** (empirically validated) — reported **SEPARATELY and NEVER composited**. `null`/absent ≠ 0. seeded ≠ computed ≠ validated. Evidence only; no inflation.

---

## 0. How to read this report

The three honesty axes answer three different questions and must never be averaged into one number:

| Axis | Question it answers | This product |
|---|---|---|
| **Structural** | Does the capability exist as working code? | **High — customer-value axis mean ~69; feature-surface completeness ~82** |
| **Activation** | Is it producing real outputs from real data in the live shared DB today? | **Low (~16)** |
| **Validity** | Has the intelligence been empirically validated / proven to improve outcomes? | **Very low (~10)** |

> The product triple used throughout is **(S ~69 / A ~16 / V ~10)** — the customer-value axis means from the scorecard. The higher **~82** is *feature-surface structural completeness* (breadth of working tabs/engines), reported as a separate, narrower measure so it is never confused with the axis mean.

**Gating rule (explicit policy, not a composite):** the *self-serve* Launch ceiling requires **all** critical axes to reach the Launch band; the weakest axis caps that ceiling. Here Activation/Validity are in the Not-Ready band, so self-serve Launch is blocked — but the product floor stays **Beta** because the software runs end-to-end and a concierge cohort can use it today. Great code with no live data = **Beta (demonstrable)**, not Launch, and not Not-Ready. (Full policy: scorecard §C.)

---

## 1. Evidence base (authoritative LIVE counts)

All counts are exact `count(*)` against the live shared PostgreSQL on 2026-06-18 (pg_stat estimates were discarded as unreliable — they reported 0 for tables that exactly count 101).

**User population**
- `users` = **103**
- `career_seeker_profiles` = **101**, `career_seeker_goals` = **101**
- `capadex_sessions` = **58** (behavioural upstream)
- `p4_competency_history` = **390** (append-only competency history rows)

**Reference / seed data present (enables capability; is NOT user activation)**
- `cg_roles` = **200**, `cg_skill_requirements` = **711** (Career Graph reference)
- `frp_role_evolution` = **1,680**, `frp_skill_taxonomy` = **27** (Future Readiness reference)
- `mei_dimensions` = **5**, `mei_insight_rules` = **93** (Employability Index config)
- `competency_readiness_models` = **9**, `competency_norm_contexts` = **1**

**User-runtime intelligence tables — EMPTY (the core finding)**
- `mei_scores` = **0**, `mei_competency_scores` = **0**, `mei_score_history` = **0**, `mei_user_recommendations` = **0**
- `competency_question_templates` = **0**, `competency_assessment_items` = **0**, `competency_assessment_options` = **0**
- `career_recommendations` = **0**, `career_outcomes` = **0**, `benchmark_profiles` = **0**, `workforce_signals` = **0**
- `career_memory_snapshots` = **0**, `career_memory_interventions` = **0**, `recruiter_interactions` = **0**

**Thin activation (exists but tiny)**
- `cg_user_recommendations` = **8**, `frp_user_readiness` = **8**

> **Interpretation.** The platform is *engine-complete and reference-seeded* but *user-runtime-empty*. The headline Employability Index has computed **zero** scores in the live DB; the competency question bank is **empty**; there are **zero** realised career outcomes and **zero** stored recommendations. 101 seeker profiles exist as containers, but the intelligence that is the product's reason to exist has not been run/persisted at population scale.

---

## 2. Feature surface (Structural)

Career Builder exposes ~25 tabs, almost all backed by real engines (not placeholders):

| Tab | Engine/Source | Structural | Activation reality |
|---|---|---|---|
| dashboard | employabilityEngine, benchmarkEngine, useHybridEI | Real | EI computed client-side from profile; `mei_scores`=0 server-side |
| assessment | competencyEngine, scoringEngine, competencyRuntimeStore | Real | Falls back to static `ADAPTIVE_QUESTION_BANK_V2`; live `competency_question_templates`=0 |
| future-map | futureMapEngine, careerTrajectoryEngine | Real | Uses seeded `frp_*` reference; per-user `frp_user_readiness`=8 |
| development | idpEngine, adaptiveIDPEngine, idpStore | Real | Generates plans on demand; no persisted population |
| profile / skills | profileStore, profileIntelligenceEngine | Real | Backed by 101 seeker profiles |
| resume | ResumeStudio, resumeIntelligenceEngine, cv-parser | Real | Seeds from profile; persists to **localStorage**, not server |
| jobs | fitmentEngine, rankJobsForUser | Real | Real employer postings when present; falls back to `MARKET_CATALOG` |
| interview / simulations | simulationStore, AI Copilot | Real | On-demand; no persisted outcome data |
| learning | static `COURSE_RECS` catalog | **Hybrid** | Curated static catalog (not a live LMS feed) |
| pathways | careerTrajectoryEngine, recommendationEngine | Real | Uses `cg_*` reference (200 roles / 711 skill reqs) |
| market-intel | MARKET_CATALOG, workforceEngine | Real (catalog-driven) | Static market catalog, not a live labour-market feed |
| velocity / behavioral-growth / career-memory | learningVelocityEngine, behaviorGraph, progressLedger | Real | Degrade to empty when <2 snapshots; `career_memory_snapshots`=0 |
| learning-intel / lbi / future-readiness / career-passport | api/lip, api/lbi, api/frp, employabilityEngine | Real | Backends exist; user-runtime sparse/empty |
| intelligence-hub | aggregator of lib/intelligence | Real | Composes the above; quality bounded by their data |
| workforce | workforceEngine, workforceStore (admin) | Real | `workforce_signals`=0 |

**Career Operating System** (`useCareerBrain.ts`) fuses profile/resume/competency/CAPADEX/market into a decision-ready picture and **degrades to deterministic local heuristics** when behavioural data is absent — a genuine engineering strength (never shows hollow states), but it also means the UI looks "full" even when the live intelligence substrate is empty. **This is exactly why Activation must be measured at the DB, not at the screen.**

Intelligence engines (`lib/intelligence/*`) are read-only, deterministic-first, and degrade honestly: behaviorGraph→null without a CAPADEX session, constraintEngine→brain bottlenecks, unifiedActionEngine→weekly-ROI-only without library actions, outcomeAttributionEngine→[] without history, AI Copilot→"truthful empty state". Security: `resolveEffectiveUserId` IDOR guard in both memory routes; cross-module sync via the existing `adaptive-event-bus`.

---

## 3. Axis findings

### 3.1 Structural — ~69 customer-value axis mean (feature-surface completeness ~82) (High)
- ~25 tabs, ~30 pure engines, full Career OS aggregator, passport, resume studio, jobs/fitment, behavioural memory, event bus — all real, degradation-safe code.
- Reference data seeded for Career Graph, FRP and MEI config.
- Deductions: `learning`/`market-intel` are static catalogs (not live feeds); resume persists only to localStorage; EI headline vs breakdown dimensional mismatch is a structural defect (see 3.3).

### 3.2 Activation — ~16 (Low)
- 101 seeker profiles and 58 CAPADEX sessions exist, but the **core intelligence runtime tables are empty**: `mei_scores`=0, `competency_question_templates`=0, `career_recommendations`=0, `career_outcomes`=0, `benchmark_profiles`=0.
- Only `cg_user_recommendations`=8 and `frp_user_readiness`=8 show any per-user computed output — both negligible vs 101 profiles.
- No scheduler/cron to compute EI snapshots → `mei_score_history`/`ei_snapshot_versions` stay empty even as profiles accrue.
- **Consequence:** the product *can* compute intelligence per-request in the browser, but the live system has not produced or persisted that intelligence at population scale. Benchmarks, longitudinal trends, and outcome attribution are mathematically unavailable (k-anonymity floor + zero history).

### 3.3 Validity — ~10 (Very low)
- No empirical validation of any score (employability, fitment, hire-probability, readiness) against real outcomes; `career_outcomes`=0 means **no outcome to validate against by construction**.
- **EI integrity defect:** the headline `EIGauge` (6-dim) does not match the EI breakdown modal (which credits assessment 25pts) — same product surfaces two different employability numbers → direct user-trust risk.
- Fitment/hire-probability are deterministic heuristics (45% skill / 40% competency / 15% experience; logistic blend) never calibrated against actual placements.
- Benchmarks suppressed below k=30 and, with near-zero computed scores, cannot be populated.

---

## 4. Launch readiness by product configuration

| Configuration | Verdict | Why (gated by weakest critical axis) |
|---|---|---|
| **Standalone consumer product** | **Beta Ready** | Engines real + degrade gracefully, but no live intelligence persisted, no validation, EI number inconsistent. Usable demo, not a trustworthy self-serve product. |
| **Student product** | **Beta → Pilot (concierge)** | Strong UX surface; works for a guided cohort if profiles + assessments are actively seeded and EI computed for that cohort. |
| **Professional product** | **Beta** | Same engine strength; professionals expect validated benchmarks/outcomes which are absent. |
| **Institution product** | **Pilot Ready (concierge only)** | Viable for a single managed cohort with manual data activation + human interpretation; not self-serve. |
| **Employer product** | **Not Ready (gated)** | Depends on candidate pools, calibrated fitment, recruiter postings; `recruiter_interactions`=0, fitment unvalidated. |
| **Enterprise product** | **Not Ready** | Requires validity evidence, scheduled snapshots, populated benchmarks, audit/calibration — none present. |

### As the **foundational intelligence layer** (Career Builder feeds Career Passport / Employability Index / FRP / Employer Portal / Recommendation Engine)
- **Structurally:** the adapters and aggregators exist (`career-behavior-adapter`, `useCareerBrain`, MEI chain).
- **In activation terms:** it is **not yet a live feed** — it emits zero persisted EI scores and zero recommendations, so downstream consumers currently receive empty/degraded inputs. Foundational-layer readiness = **structurally yes, operationally no**.

---

## 5. Final verdict

> **Career Builder is BETA READY overall — engine-complete and reference-seeded, but user-runtime-empty and empirically unvalidated.**
> - **PILOT READY** for a **concierge Institution/Student cohort** with manual data activation and human interpretation.
> - **NOT LAUNCH READY** as a self-serve consumer/professional product.
> - **NOT READY** as an Employer/Enterprise product or as a scientific instrument.
> - **NOT WORLD CLASS.**

The gap to Launch is overwhelmingly **Activation + Validity** (run and persist the intelligence at population scale; reconcile the EI number; capture real outcomes and validate), **not** Structural. The codebase is largely already there; the live data and proof are not.

Axes are reported separately by design. The single most important honest sentence: **the live Employability Index has computed zero scores, the competency question bank is empty, and there are zero realised career outcomes — so the intelligence that defines this product is built but not yet running on real users at scale.**
