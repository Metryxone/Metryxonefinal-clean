# Phase 2.2 — Question Blueprint Engine · Validation

**Status:** BUILT + VALIDATED. NOT merged/deployed (stop for approval).
**Flag:** `competencyRuntime` (reused; default OFF). **Date:** 2026-06-19.

## Scope (requested → delivered)

Relationships materialized:
- **Competency → Question Pool** — `getQuestionPool` + `onto_question_blueprints`.
- **Question → Competency** — `onto_question_competency_mapping` (+ synced canonical `onto_competency_question_map`).
- **Question → Micro Competency** — `micro_competency_id` FK → `onto_competency_hierarchy` (validated as a child of the competency).
- **Question → Difficulty Level** — validated against `onto_question_difficulty_framework`.
- **Question → Question Type** — validated against the 7 supported types.

Supported question types: likert · situational_judgment · behavioral · case_study · scenario_based · multiple_choice · forced_choice (alias-normalized, e.g. `sjt`→situational_judgment, `mcq`→multiple_choice).

Deliverables (user names → tables):
- `question_difficulty_framework` → **onto_question_difficulty_framework** (reference ladder; 5 levels seeded).
- `question_competency_mapping` → **onto_question_competency_mapping**.
- `question_blueprints` → **onto_question_blueprints** (per-competency pool target + honest coverage).

## Honesty posture
- The competency question bank (`competency_question_templates`) is **EMPTY (0 rows)**. Pools/mappings are therefore legitimately empty until real questions exist — surfaced as coverage notes, **never fabricated**.
- Only the difficulty ladder (reference/config) is seeded. No questions, mappings, or blueprints are seeded.
- A derived blueprint **mirrors the actual pool** (descriptive); an authored blueprint reports the actual-vs-target **shortfall** honestly.
- Micro competency must be a child of its competency, else `micro_competency_mismatch` (422).

## Flag-OFF (byte-identical) — curl, workflow has NO FF_COMPETENCY_RUNTIME
```
GET  /api/competency-runtime/question-difficulty-framework            → 503 feature_disabled
GET  /api/competency-runtime/competencies/comp_communication/question-pool → 503 feature_disabled
POST /api/competency-runtime/question-blueprints/validate             → 503 feature_disabled
```
Gate is the first statement → no DB/auth touch when OFF. Lazy `ensureQuestionBlueprintSchema` is only reachable behind the gate → flag-OFF = no DDL.

## Flag-ON e2e smoke (`scripts/phase2_2-question-blueprint-smoke.ts`) — PASS
- Framework: 5 difficulty levels + 7 question types; `sjt`→situational_judgment; `banana` rejected.
- Insert 1 demo bank question (COM/likert/medium, status approved, source seed).
- Map → competency `comp_communication` + micro `Active Listening` (id 1); inherited difficulty=medium, type=likert; **`onto_competency_question_map` synced**.
- Guards: micro from another competency → `micro_competency_mismatch`; `banana` type → `invalid_question_type`; `impossible` difficulty → `invalid_difficulty`.
- Pool: size 1, by_difficulty {medium:1}, by_type {likert:1}.
- Blueprint derived → source derived, pool_target 1 (mirrors pool).
- Blueprint authored (target 10) → coverage pool_actual 1 / pool_target 10, "9 short", per-level/type gaps.
- Validate: good valid; bad keys (`nope`/`banana`) rejected; invalid author not persisted.
- Unknown competency/question → not-found.
- All demo rows purged (question delete CASCADEs mapping + bare edge; blueprint deleted).

## Deviations
- Tables namespaced `onto_*` (not the bare deliverable names) for framework consistency / collision-avoidance (matches Phase 2 / 2.1).
- Supported question types live as an engine constant + the framework read endpoint (the 3 deliverable tables are exactly difficulty/mapping/blueprints).
- NOT wired into Phase 2 `generateAssessment` selection yet (deferred to keep the working chain untouched).

## Files
- backend/services/question-blueprint.ts
- backend/migrations/20260619_question_blueprint_engine.sql
- backend/routes/competency-runtime.ts (routes 9–15)
- backend/scripts/phase2_2-question-blueprint-smoke.ts
