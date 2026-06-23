# §5 — Adaptive Assessment Activation Report

**Date:** 2026-06-23 · Updated after MX-100X Phase 4 activation · Read-only verification

## Verdict: ⚠️ PARTIAL PASS — adaptive activation is wired and live; served-difficulty shift is capped by bank content (honest ceiling)

The adaptive flow is now **active at runtime** behind the default-OFF flag
`adaptiveDifficultyActivation` (`FF_ADAPTIVE_DIFFICULTY_ACTIVATION`). Role/seniority now drives
target proficiency → target difficulty → selection bias → **level-aware scoring/readiness
thresholds**. The one axis that cannot fully activate is the *served* question difficulty
distribution — because the live 7-domain bank is 100% `medium`. That is a **bank-content ceiling**,
surfaced explicitly, never padded.

## Required flow vs reality (flag ON)

Required: `Role Level → Required Proficiency → Difficulty → Question Complexity → Scoring Threshold`

| Stage | Status | Evidence |
|---|---|---|
| Role Level → Required Proficiency | ✅ active | `resolveSeniorityProfile(stage, expected_level?)` → anchor (junior 55 / mid 65 / senior 75 / lead 80 / director 85), monotonic; consumes `competency_runtime_weights.expected_level` when present, else stage anchor (provenance stamped) |
| Required Proficiency → Difficulty | ✅ active | `proficiencyToDifficulty(anchor)` → target band+rank (monotonic: junior intermediate → senior+ advanced) |
| Difficulty → Question Complexity (served) | ⚠️ capped | `difficultyAffinityBonus` re-ranks selection by target band, BUT live 7 served domains hold only `medium` → no served shift. Matcher proven to discriminate where variety exists (advanced→0.6 > medium→0.3 > easy→0) |
| Question Complexity → Scoring Threshold | ✅ active | role-fit readiness bands now `levelAwareReadinessBands(anchor)`: junior 65/… director 95/…; same weighted score classifies differently by level (80 → junior Ready, senior Near-Ready, director Developing) |

## Role-level difficulty distribution test
- **Target difficulty + scoring/readiness thresholds DO differ by role level** (junior < mid < senior ≤ lead ≤ director), proven monotonic in the evidence run.
- **Served difficulty distribution does NOT differ** — the live `competency_question_templates` (status=approved) for the 7 served domains COG/COM/LEA/EXE/ADP/TEC/EIQ is **100% `medium`** (20 rows). The non-`medium` bands present in the bank-wide set (`advanced/foundational/intermediate`) belong to disjoint genome `comp_*` codes that `/select` never serves. This is an honest content ceiling, not a wiring gap.

## Assessment
| Axis | Verdict |
|---|---|
| Target difficulty by role level | ✅ active (monotonic) |
| Scoring / readiness threshold by level | ✅ active (level-aware bands) |
| Selection bias by target difficulty | ✅ wired (no-op on single-band bank; proven to discriminate on variety) |
| Served difficulty distribution by level | ⚠️ uniform — bank-content ceiling (100% medium), surfaced via per-domain `coverage_gap` |
| Flag-OFF byte-identical | ✅ verified (503 on new route; no `difficulty_plan` leak; senior bands == legacy 85/72/58/45) |

## What activates this
- Flag `adaptiveDifficultyActivation` (default OFF) — `backend/config/feature-flags.ts`.
- Engine `backend/services/adaptive-difficulty-activation.ts` (pure, read-only, zero DDL).
- Surfaces (flag-gated): `GET /api/competency/questions/select` (bias + `difficulty_plan` envelope), role-fit readiness bands in `competency-assessment-runtime.ts`, new `GET /api/competency/assessment/difficulty-plan`.
- Evidence: `adaptive_assessment_activation_evidence.md` (9/9). Smoke: `scripts/smoke-adaptive-difficulty-activation.ts` (11/11, flag-OFF HTTP contract + service guarantees).

## Remaining work to reach FULL PASS (content, not wiring)
1. Author/approve `easy` + `hard` difficulty variants for the 7 served domains so the served distribution can actually shift by level (the matcher is already wired and proven).
2. Populate `competency_runtime_weights.expected_level` (Role DNA) so the anchor is Role-DNA-driven rather than stage-derived.
3. (Follow-up) surface the `difficulty_plan` in the assessment UI; today it flows through the existing role-fit readiness UI only.

**The wiring gap from the prior FAIL is closed. The residual is bank content + Role-DNA population — tracked as follow-ups, not fabricated away.**
