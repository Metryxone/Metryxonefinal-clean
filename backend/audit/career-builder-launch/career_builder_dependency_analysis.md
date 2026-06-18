# Career Builder — Dependency Analysis

**Date:** 2026-06-18
Career Builder is a **composition layer**: its intelligence quality is bounded by the upstream products that feed it. This file traces each input, its structural wiring, and whether it is **actually populated** in the live DB.

---

## Upstream inputs (what feeds Career Builder)

### 1. Competency Assessment → Career Builder
- **Wiring (Structural):** `competencyEngine`/`scoringEngine` runtime; `triggerMEIChain` (`mei-chain-trigger.ts`); contributes to EI breakdown.
- **Live data (Activation):** `competency_question_templates`=0, `competency_assessment_items`=0 → **assessment runs on the static fallback bank**, not live curated items. `p4_competency_history`=390 rows exist (some history), but no live item bank.
- **Verdict:** structurally wired, **activation-empty** at the question-bank level. (Cross-ref: competency-worldclass audit, same finding.)

### 2. Employability Index (MEI v2) → Career Builder
- **Wiring:** hierarchical scoring (`mei-scoring-engine.ts`), 5 dimensions, 93 insight rules (deterministic, no LLM).
- **Live data:** `mei_dimensions`=5, `mei_insight_rules`=93 (config seeded) but **`mei_scores`=0, `mei_competency_scores`=0, `mei_score_history`=0** → no computed EI for any user persisted.
- **Defect:** headline 6-dim `EIGauge` ≠ 8-dim breakdown modal → inconsistent EI number (critical trust gap).
- **Verdict:** engine + config real; **zero live output**; integrity defect.

### 3. CAPADEX behavioural signals → Career Builder
- **Wiring:** `career-behavior-adapter.ts` (Phase 4) maps the Unified Behavior Graph (signals/patterns/risks/growth/CSI) into a 5-score `CareerBehaviorProfile` via PENALTY/BOOST lexicons; consumed by `useCareerBrain`.
- **Live data:** `capadex_sessions`=58 exist; adoption is per-session (`session_id` non-null). Behavioural memory persistence empty (`career_memory_snapshots`=0).
- **Verdict:** real adapter + some upstream sessions; **thin live adoption**; degrades to null safely.

### 4. Career Graph (cg_*) → pathways/trajectory
- **Live data:** reference seeded — `cg_roles`=200, `cg_skill_requirements`=711. User-facing `cg_user_recommendations`=8 (vs 101 profiles).
- **Verdict:** **reference-ready, user-runtime thin.**

### 5. Future Readiness (frp_*) → future-map/future-readiness
- **Live data:** reference seeded — `frp_role_evolution`=1,680, `frp_skill_taxonomy`=27. Per-user `frp_user_readiness`=8.
- **Verdict:** **reference-ready, user-runtime thin.**

### 6. Market / labour-market → market-intel/jobs
- **Live data:** static `MARKET_CATALOG`; employer postings via `/api/career/recruiter-postings` (sparse). Fitment falls back to catalog "suggested openings".
- **Verdict:** **catalog-driven, not a live market feed.**

---

## Downstream consumers (what Career Builder is supposed to feed)

| Consumer | Feed exists (S)? | Live feed active (A)? | Blocking input |
|---|---|---|---|
| Employability Index | Yes | **No** | `mei_scores`=0 |
| Career Passport | Yes | Partial (on-demand snapshot) | depends on profile/assessment data |
| Future Readiness Platform | Yes | Thin | `frp_user_readiness`=8 |
| Employer Portal | Yes | **No** | `recruiter_interactions`=0; fitment uncalibrated |
| Recommendation Engine | Yes | **No** | `career_recommendations`=0 |
| Learning Behavior Intelligence | Yes | Thin | sparse LBI sessions |

---

## Dependency risk summary

- **Critical-path dependency:** the Employability Index. Until `mei_scores` is computed and persisted for the user base, Career Builder's headline value and every downstream consumer that reads EI are starved.
- **Shared empty substrate:** the same emptiness (question bank, outcomes, recommendations) that caps the Competency product also caps Career Builder — they fail and recover together.
- **No circular blockers:** inputs are acyclic; activating upstream (compute EI for existing 101 profiles, seed the live question bank, capture outcomes) directly lifts Career Builder without code changes.
- **Honest conclusion:** Career Builder's dependencies are **structurally connected but operationally unfed**. The fix is data activation + the EI-reconciliation defect, not re-architecture.
