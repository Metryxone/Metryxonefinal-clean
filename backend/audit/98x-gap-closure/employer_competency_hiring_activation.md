# Phase 3 — Employer Competency Hiring Activation

**Task:** MX-98X-GAP-CLOSURE-IMPLEMENTATION · Phase 3
**Date:** 2026-06-23 · Additive / reversible / flag-gated. Evidence = live `count(*)` + explorer trace of employer hiring/TIG services + `.agents/memory/employer-portal.md`, `employer-tig-architecture.md`.

## Target flow
```
Candidate Assessment → Competency Profile → Role Fit → Competency Match → Readiness Score → Hiring Recommendation
```

## Current state (evidence)
- Employer hiring suggests competencies from **hardcoded** `DEPT_BEHAVIORAL_PROFILES` + employer-entered skills; reads `onto_role_competency_profiles` only when a standard role is linked.
- Candidate competency read from `lbi_scores` / `cra_scores` = **0** (isolated heuristic path).
- `generateInterviewBlueprint` produces an **interview** blueprint, not a scored competency assessment.
- TIG hiring intelligence + calibration (Brier/ECE/isotonic/beta-binomial) is **built**, but 0 realized outcomes (`tig_*` 0) → cannot calibrate yet.
- `onto_competency_profiles` (38) / `onto_competency_score_runs` (2) / `onto_assessment_blueprints` (6) exist but are not the employer's source.

## Gap closure (additive, flag `FF_EMPLOYER_COMPETENCY_HIRING`, default OFF)
1. **Competency score + profile integration** — employer candidate match reads the Phase-2 `resolveUnifiedCompetencyProfile` (canonical `onto_*`) instead of `lbi_scores`/`cra_scores`; heuristic kept only as explicit fallback when no competency profile exists.
2. **Competency match engine** — competency-vector match (candidate profile vs role requirements from Phase-1 Role DNA / `map_role_competency`).
3. **Role fit + skill gap engine** — reuse Role-Readiness-V2 + gap analysis at candidate scope.
4. **Interview blueprint** — keep `generateInterviewBlueprint`, additionally route the candidate through `onto_assessment_blueprints` so the scored assessment is the platform's.
5. **Hiring recommendation engine** — grounded in competency match + (when ≥30 outcomes) calibrated probability; until then surface **uncalibrated/provisional** explicitly. Reads fail **closed** (no recommendation on absent evidence), never fabricate a score.

## Architecture / Data / API impact
- **Architecture:** new `services/employer-competency-hiring.ts` composing Phase-1 DNA + Phase-2 profile + existing Role-Readiness-V2/TIG. No edits to existing employer engines.
- **Data:** read-only over `onto_*`; outcome capture (for calibration) is a **separate explicit write** (Phase 6), not here. Zero DDL in this phase.
- **API:** additive `GET /api/v2/employer/competency-match/:candidateId/:jobId` (flag-OFF 503). Existing employer routes unchanged; IDOR via session scope per memory.

## Rollback strategy
- Flag OFF → new route 503, employer keeps current heuristic path byte-identical. Delete module to remove. No data to undo.

## Success metrics
- % candidate matches backed by a real `onto_*` competency profile (vs heuristic fallback).
- Recommendation honesty: 0% fabricated scores; calibration state labelled (`uncalibrated` until ≥30 outcomes).
- Coverage vs Confidence reported separately (Coverage=domains assessed; Confidence=calibration state).

## Expected maturity gain
- Employer competency hiring: ~25% → ~65% (connects real scoring; full 98% needs realized outcomes from Phase 6).

## Evidence ledger
- Counts → live `count(*)`, 2026-06-23. Hiring internals + calibration → explorer trace `employer-hiring-intelligence.ts`/`employer-tig.ts`, memory `employer-portal.md`/`employer-tig-architecture.md`, prior `employer_customization_readiness.md` (`da07dd93`). Maturity = estimate.
