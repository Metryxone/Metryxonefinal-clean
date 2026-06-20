# Career Architecture Report — Phase 4 (MX-COMPETENCY-FRAMEWORK-TRANSFORMATION)

**Phase:** 4 — Career Intelligence Layer
**Date:** 2026-06-20
**Subject of record (smoke/e2e):** `demo_subj_pm`
**Status:** Engine/API layer operational (flag-gated). Frontend surfacing minimal. Not deployed.

> Honesty contract (carried from Phase 3, non-negotiable): additive and flag-gated — flag-off path is byte-identical to today. **Coverage** (data exists) and **Confidence** (trustworthy/sufficient) are reported as separate axes, never composited. Absent data is reported as absent, never fabricated or zero-filled. Outputs are developmental signals only — never hiring/promotion/suitability predictions.

---

## 1. What Phase 4 is

Phase 4 transforms the Phase-3 Employability/EI intelligence into a **Career Intelligence** layer: one additive, flag-gated family of engines that **compose** already-computed Phase-3/Phase-4 data (EI profile, competency runtime, role/industry/function readiness, FRP future-readiness, signals, recommendations, history) into career-facing surfaces. It **does not** rebuild any existing infrastructure (`cg_*` career graph, pathway intelligence, M5 growth plans, `career_seeker_goals`).

Core architectural contract, enforced per engine:
- **Additive & flag-gated** — each engine has its own flag, default **OFF**. Flag-OFF → route returns 503 and **no** DB writes / no DDL (byte-identical to legacy).
- **Compose, never recompute** — engines read upstream engine outputs; they never re-derive an upstream score.
- **GET-never-writes** — read endpoints create no schema. Lazy `ensure*Schema()` DDL lives only on POST/admin paths; GETs use a `to_regclass` probe and degrade (empty/zeroed/gap) when tables are absent.
- **IDOR-guarded** — `resolveEffectiveUserId`; cross-subject reads require super-admin.
- **Never-throws** — aggregators return an honest degraded envelope rather than 500.
- **Append-only history** — `*_history` snapshot tables are written only via explicit snapshot paths, never mutated in place.

---

## 2. Sub-phase map (4.1 – 4.12)

| Sub-phase | Engine | Flag (default OFF) | Route | Migration / tables | Smoke |
|---|---|---|---|---|---|
| 4.1 | Career Intelligence bridge | `careerIntelligence` | `routes/career-intelligence.ts` | (composes; no new history table) | `smoke-career-intelligence.ts` |
| 4.2 | Career Match | `careerMatch` | `routes/career-match.ts` | `20260620_career_match.sql` (`career_match_history`, `career_matching_rules`) | `smoke-career-match.ts` |
| 4.3 | Career Readiness | `careerReadiness` | `routes/career-readiness.ts` | `20260620_career_readiness_history.sql` | `smoke-career-readiness.ts` |
| 4.4 | Career Gap | `careerGap` | `routes/career-gap.ts` | `20260620_career_gap_history.sql` | `smoke-career-gap.ts` |
| 4.5 | Career Roadmap | `careerRoadmap` | `routes/career-roadmap.ts` | `20260620_career_roadmap_history.sql` | `smoke-career-roadmap.ts` |
| 4.6 | Career Development | `careerDevelopment` | `routes/career-development.ts` | `20260620_career_development_history.sql` | `smoke-career-development.ts` |
| 4.7 | Career Recommendation | `careerRecommendation` | `routes/career-recommendation.ts` | `20260620_career_recommendation.sql` (`career_recommendation_library/rules/history`) | `smoke-career-recommendation.ts` |
| 4.8 | Career Simulation | `careerSimulation` | `routes/career-simulation.ts` | `20260620_career_simulation_runs.sql` | `smoke-career-simulation.ts` |
| 4.9 | Career Passport Foundation | `careerPassportFoundation` | `routes/career-passport-foundation.ts` | `20260620_career_passport_snapshots.sql` | `smoke-career-passport-foundation.ts` |
| 4.10 | Career Signal | `careerSignal` | `routes/career-signal.ts` | `20260620_career_signal.sql` (`career_signal_library/rules` + history) | `smoke-career-signal.ts` |
| 4.11 | Career Progression | `careerProgression` | `routes/career-progression.ts` | `20260620_career_progression.sql` (`growth_tracking`, `career_history`) | `smoke-career-progression.ts` |
| 4.12 | Super-Admin Validation | `careerValidation` | `routes/career-validation.ts` | (read-only harness; no migration) | `smoke-career-validation.ts` |

All 12 are registered in `backend/routes.ts` (≈ lines 13463–13474).

---

## 3. Composition graph (dependency order)

```
Phase-3 substrate
  ├─ competency runtime (getProfile, onto_competency_*)
  ├─ EI profile engine (buildEiProfile, growth_potential)
  ├─ role-readiness-v2 (computeRoleReadinessV2, gap_areas)
  ├─ industry / function readiness
  └─ FRP / FRI future-readiness
        │
        ▼
4.3 Readiness ──┐
4.2 Match ──────┤ (consumes 4.3 + competency + EI)
4.4 Gap ────────┤ (consumes role-readiness gaps + onto type map + FRP)
                ▼
4.5 Roadmap · 4.6 Development · 4.7 Recommendation · 4.8 Simulation
                │
                ▼
4.10 Signal (composes getProfile + EI + 4.3 + 4.4 → 7 developmental signals)
4.11 Progression (longitudinal Δ over 4.3 history ∪ growth_tracking/career_history)
4.9 Passport Foundation (publishable snapshot; contact NEVER published)
4.1 Bridge (admin-surfaced envelope tying the surfaces together)
4.12 Validation (read-only honesty harness over all of the above)
```

---

## 4. Operational evidence (2026-06-20 smoke run, in-process, dev DB)

All 12 smoke scripts exited 0:

| Sub-phase | Result |
|---|---|
| 4.3 Readiness | ✅ PASS (append-only: exactly one new row; cleaned up) |
| 4.2 Match | ✅ PASS (append-only: one new row; cleaned up) |
| 4.4 Gap | ✅ PASS (append-only: one new row; cleaned up) |
| 4.5 Roadmap | ✅ PASS (append-only: one new row; cleaned up) |
| 4.6 Development | ✅ PASS (trend stable vs identical baseline; cleaned up) |
| 4.7 Recommendation | ✅ 22 passed / 0 failed (append-only count=2; tables dropped → DB pristine) |
| 4.8 Simulation | ✅ PASS (honest note: 0/4 measurable onto-domains have a measured baseline) |
| 4.9 Passport Foundation | ✅ PASS (no raw free-text body; contact redacted) |
| 4.10 Signal | ✅ 25 passed / 0 failed (library/rules source=defaults) |
| 4.11 Progression | ✅ 24 passed / 0 failed (unknown subject ⇒ empty, no fabrication) |
| 4.12 Validation | ✅ 22 passed / 0 failed → harness: 6 PASS · 7 WARN · 0 FAIL (`runtime_provisioned=true`) |
| 4.1 Bridge | ✅ PASS (7 areas; 5 surface tiles tied together) |

12-stage end-to-end candidate journey (`scripts/e2e-candidate-journey.ts`): all stages GENERATE; the 7 persistable stages prove a fresh row via strict before/after delta; `EXIT=0`.

---

## 5. Honest status by axis

| Axis | Status | Notes |
|---|---|---|
| **Backend engines built & registered** | **12/12 (~100%)** | service + route + flag + migration + smoke present for every sub-phase |
| **Backend smoke-verified (this run)** | **12/12 PASS** | 0 FAIL across all smokes; validation harness 0 FAIL / 7 WARN |
| **Frontend surfacing (user-facing)** | **~8% (1/12)** | only `/api/career-intelligence` (4.1) is consumed — by the super-admin `CareerIntelligencePanel`. The other 11 endpoints are not wired into any user-facing UI. |
| **Deployment** | **0% (by design)** | all flags default OFF; stopped for approval; no merge/deploy |

**Phase 4 as specified end-to-end (engines + the six user-facing surfaces + validation surface):** the engine + validation layer is essentially complete; the consumer/surfacing layer is the bulk of what remains → **~45–50% complete end-to-end**.

---

## 6. Remaining gap (honest)

The largest gap is **frontend surfacing**: Steps 2–5 of the plan (Career Readiness / Pathways / Planning / Growth / Development surfaces + Career Builder cohesion) are backend-built and smoke-verified but **not** consumed by the user-facing UI. The WARN findings in the 4.12 validation harness reflect honest data-absence (e.g., no measured onto-domain baselines for the demo subject), **not** broken engines.
