# Phase 2.3 — Assessment Assembly Engine · Validation

**Date:** 2026-06-19
**Flag:** `competencyRuntime` (reused, no new flag) — default **OFF**
**Scope:** additive · reuse existing `onto_*` tables · never fabricate · byte-identical when flag OFF

## What shipped

| Deliverable | Where | Role |
|---|---|---|
| `assessment_builder` | `buildAssessment()` in `services/assessment-assembly.ts` | selection + dedup + difficulty balance + randomization (no persist) |
| `assessment_validator` | `validateAssessment()` | duplicate / competency-coverage / blueprint-coverage / difficulty-balance checks (self-contained; recomputes mapped pool from DB) |
| `assessment_generator` | `generateAssembledAssessment()` | build → validate → persist |
| read | `getAssembledAssessment()` | fetch a stored assembly; never throws |
| schema | `migrations/20260619_assessment_assembly_engine.sql` + lazy `ensureAssessmentAssemblySchema()` | table `onto_assembled_assessments` |
| routes | `routes/competency-runtime.ts` #16–#19 | assemble · assessment-preview · read · re-validate |

## Pipeline
`Role → Blueprint (onto_assessment_blueprints + onto_blueprint_competency_map) → Question Selection (onto_question_competency_mapping ⋈ competency_question_templates status='approved', composed per onto_question_blueprints.difficulty_distribution) → Assessment Generation (onto_assembled_assessments)`

## Design guarantees
- **No duplicate questions** — each mapped+approved question is assigned to exactly ONE competency (highest blueprint weight; tie → `competency_id` asc). Disjoint assignment makes duplicates structurally impossible and per-competency caps stable.
- **Allocation** — total split across competencies by weight (largest-remainder), capped by each disjoint pool size, overflow redistributed to competencies with spare capacity. `total = opts.total ?? Σ pool_target(>0) ?? Σ caps`, clamped to `Σ caps` and `MAX_TOTAL=200`.
- **Difficulty balancing** — per competency, target counts from `onto_question_blueprints.difficulty_distribution` (scaled) else even across levels present; drawn from a seeded-shuffled bucket per level, remainder filled from leftover.
- **Randomization** — seeded `mulberry32` + Fisher–Yates → deterministic when a seed is supplied.
- **Honesty** — empty bank → empty assessment (validator flags `assessment_empty` + uncovered competencies with reason `no_mapped_questions`); never fabricated. Unknown blueprint → `blueprint_not_found`.

## Validation results

### Flag-OFF byte-identical (workflow has no `FF_COMPETENCY_RUNTIME`)
```
POST /api/competency-runtime/blueprints/any/assemble
→ 503 {"ok":false,"error":"feature_disabled","flag":"competencyRuntime"}
```
Gate is the first statement; no DB touch when OFF.

### e2e smoke — `scripts/phase2_3-assessment-assembly-smoke.ts`
Isolated demo blueprint (C1 `comp_adaptability` w70, C2 `comp_accountability` w30, C3 `comp_personal_credibility` w0/no questions) + mapped+approved questions across all five difficulty levels, incl. one question shared by C1 & C2.

**25 passed, 0 failed.** Highlights:
- `total_questions == 12`; persisted with an id; `role_id` resolved from blueprint.
- **No duplicate question_ids**; validator `duplicate_check.ok == true`.
- Shared question appears **at most once**, assigned to higher-weight competency (C1).
- Competency coverage: C1 & C2 covered; **C3 honestly uncovered (`no_mapped_questions`)**.
- Weight-proportional: C1 (w70) got 8, C2 (w30) got 4; blueprint_coverage `max_deviation 3.3pts`.
- Difficulty balancing: C1 spans foundational→expert, medium-weighted.
- **Determinism**: same seed → identical order; different seed → reordered; both dupe-free.
- Stored assessment readable (12 q) and re-validates clean.
- **Empty-pool honesty**: empty-pool blueprint → 0 questions, `valid == false`, validator flags `assessment_empty`.
- Unknown blueprint → `blueprint_not_found`.

### Cleanliness
All demo rows purged in `finally`; `onto_question_blueprints` snapshot-and-restored for the real competency ids touched. Post-run residue scan: **CLEAN** across templates / mapping / blueprint / bcm / assembled / question-blueprints.

## Non-regression
- Phase 2 `generateAssessment` / `onto_assessment_instances` untouched (new engine writes only `onto_assembled_assessments`).
- Consumers (Employability Index, Career Builder, Career Passport, Employer Intelligence, Learning Intelligence, Future Readiness) untouched.
- `tsc --noEmit` clean for the new files.

## Status
PASS — awaiting approval before merge/deploy (no auto-deploy per project policy).
