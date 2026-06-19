---
name: Assessment Assembly Engine (competency-runtime Phase 2.3)
description: Durable design decisions + table-constraint traps for the onto_* assessment assembly engine (blueprint → questions).
---

# Assessment Assembly Engine

Generates an assessment from a blueprint: Role → Blueprint → Question Selection → Assessment Generation.
Lives behind the EXISTING `competencyRuntime` flag (no new flag); writes only `onto_assembled_assessments`.

## Disjoint-assignment dedup (the core guarantee)
Each mapped+approved question is assigned to exactly ONE competency — highest blueprint weight, tie → `competency_id` asc — BEFORE any selection.
**Why:** the same question can be mapped to multiple competencies in `onto_question_competency_mapping`. Selecting per-competency from overlapping pools would emit duplicates and make per-competency caps unstable. Disjoint assignment makes duplicate `question_id` emission structurally impossible and gives each competency a fixed cap (= its disjoint pool size).
**How to apply:** any future per-competency selection over a many-to-many question map must dedup at assignment time, not after selection. Allocation is largest-remainder by weight, capped by disjoint pool size, overflow redistributed; total clamped to `Σ caps` and `MAX_TOTAL`.

## Honesty
Empty mapped+approved pool → empty assessment, validator emits `assessment_empty` + uncovered competencies with reason `no_mapped_questions`. Never synthesize questions. Weight-0 / question-less competencies are honestly reported uncovered, never filled.

## Table-constraint traps (bite seed/smoke scripts)
`competency_question_templates` has CHECK constraints: `source ∈ {manual, generated, seed}` and `status ∈ {draft, approved, rejected, archived}`. A demo/seed insert with an arbitrary `source` (e.g. a phase tag) 23514s — use `'seed'` and tag rows via `template_key` prefix instead.
`onto_question_blueprints` is keyed by `competency_id` (real FK to `onto_competencies`) — a smoke that sets a difficulty distribution for a real competency must SNAPSHOT and RESTORE the prior row (or it pollutes live data); there are no fake competency ids to use (FK).
`onto_blueprint_competency_map` / `onto_assembled_assessments` cascade off the blueprint row, so deleting the demo `onto_assessment_blueprints` row cleans them up.

## Activation gaps found (2026-06-19) and how each was fixed
1. `competency_question_templates.status` column MISSING — the assembly engine queries `WHERE t.status = 'approved'` but the column didn't exist. Fixed: `ALTER TABLE competency_question_templates ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' CHECK (...)`.
2. `onto_question_competency_mapping` table MISSING — lazy schema in `question-blueprint.ts::ensureSchema` was never triggered (no route had been hit). Fixed: created directly via SQL matching the service schema exactly.
3. `FF_COMPETENCY_RUNTIME=1` missing from the Backend API workflow command — flag is read from env as `FF_COMPETENCY_RUNTIME` (camelCase `competencyRuntime` → snake_UPPER). Fixed: added to workflow command and restarted.
4. Zero rows in blueprints/questions/mapping — fixed by seeding 3 blueprints, 23 approved questions, 14 competency weights, 7 question blueprints, 23 mappings. All @example.com-free (no emails = no purge target).
5. Correct `onto_blueprint_competency_map` column names are `weight` (numeric) + `criticality` + `required_level` — NOT `weight_pct`/`question_count`.

## Live smoke test results (2026-06-19)
All 3 deliverables confirmed against running backend:
- `POST /blueprints/:id/assemble` → 20 questions, 6/6 competencies, 0% weight deviation, `valid:true`, `persisted:true` ✅
- `GET /assembled-assessments/:id` → correct fetch ✅
- `POST /assembled-assessments/:id/validate` → `ok:true` ✅
- `POST /blueprints/:id/assessment-preview` → 20 questions, `valid:true`, `persisted:false` (correct) ✅
- `GET /question-difficulty-framework` → 5 levels returned ✅
