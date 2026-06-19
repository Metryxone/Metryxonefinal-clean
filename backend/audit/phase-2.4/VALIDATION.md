# Phase 2.4 — Competency Scoring Engine — VALIDATION

**Scope.** Additive scoring framework over the chain
`Question → Raw Score → Competency Score → Normalized Score → Competency Level`,
behind the existing `competencyRuntime` flag (no new flag). Distinct from Phase 2
domain-proxy `scoreAssessment` (untouched). Reuses `onto_*` tables. Never fabricates.

## Deliverables
| Deliverable | Function | File |
|---|---|---|
| competency_scoring_engine | `computeCompetencyScores()` | `services/competency-scoring.ts` |
| score_normalization_engine | `normalizeScore()` | same |
| competency_level_calculator | `calculateCompetencyLevel()` | same |
| (support) Question→Raw | `deriveRawScore()` | same |
| (support) orchestrator + persist/read | `scoreAssessmentRun()`, `getScoreRun()` | same |

## Design summary
- **Raw Score (0..100)** per response: explicit `raw_score`/`score` (clamped) → `correct` bool (100/0)
  → `selected_index` via authored options (best=100 / adjacent=60 / else=20) or canonical Likert
  ladder (0/25/50/75/100). Nothing scoreable → `null` (response not counted).
- **Type classification routes through the shared `validateQuestionType`** so the CANONICAL Phase 2.2
  keys (`likert`/`multiple_choice`/`situational_judgment`/`scenario_based`/`case_study`/`behavioral`/
  `forced_choice`) AND their legacy aliases (`mcq`, `sjt`, `scenario`, `case`, …) all resolve. Only
  `likert` (or an unrecognized type) is scored on the rating ladder; every other resolvable type is
  best-answer scored. *(Fixes a cross-phase defect found in architect review where canonical non-Likert
  keys were mis-scored as Likert.)*
- **Competency Score** = difficulty-weighted: `achieved = Σ(ordinal·raw)`, `max = Σ(ordinal·100)`,
  ordinal from `DIFFICULTY_SEED` (foundational=1 … expert=5; unknown→1, never 0). `raw_mean` kept
  separately as the simple mean (distinct axis).
- **Normalized Score** default = `difficulty_weighted_percent` = `achieved/max·100`. Cohort-referenced
  T-score (`50+10·z`, clamped) used **only** when a real cohort `{mean, sd>0, n≥30}` supplied —
  otherwise honest note `cohort_ignored_below_k_or_invalid`. `max=0` → `null` (`unmeasurable`).
- **Level** bands mirror Phase 2 `scoreToLevel` (≥80→5, ≥60→4, ≥40→3, ≥20→2, else 1). Labels from
  `onto_proficiency_levels`, canonical fallback otherwise. `null` normalized → `null` level
  (`unmeasurable`) — never floored to 1.
- **Overall** = item-count-weighted mean of measured per-competency normalized scores → level.
- **Orchestrator** resolves `question_id` → competency/difficulty/type/options via
  `onto_question_competency_mapping` JOIN `competency_question_templates` (status='approved')
  LEFT JOIN `onto_competencies`. Never throws; empty/unresolvable → `status='scoring_empty'`.

## Schema (T001)
`migrations/20260619_competency_scoring_engine.sql` + idempotent `ensureScoringSchema()` mirror:
table `onto_competency_score_runs` (id UUID PK, assessment_id UUID NULL FK
`onto_assembled_assessments` ON DELETE SET NULL, blueprint_id, subject_id, total/scored counts,
competency_scores/overall/normalization JSONB, status, source, created_at; CHECK counts ≥ 0;
indexes on assessment/blueprint/subject). DDL runs only when reached (flag gate is before any DB touch).

## Routes (T003) — `routes/competency-runtime.ts` #20–22
All `gate → requireAuth → requireSuperAdmin`; literal paths before `:param`:
- `POST /api/competency-runtime/score` — compute + persist
- `POST /api/competency-runtime/score-preview` — compute, no persist
- `GET  /api/competency-runtime/score-runs/:runId` — read (404 when absent)

## Flag-OFF verification (byte-identical / 503)
Backend API runs **without** `FF_COMPETENCY_RUNTIME` → flag default OFF. Gate runs first:
```
POST /api/competency-runtime/score        → 503  {"ok":false,"error":"feature_disabled","flag":"competencyRuntime"}
GET  /api/competency-runtime/score-runs/x → 503
```
No DB / DDL touched when OFF (gate precedes `ensureScoringSchema`).

## e2e smoke (T004) — `scripts/phase2_4-competency-scoring-smoke.ts`
**42/42 PASS, 0 fail.** Self-contained: seeds isolated demo competency-mapped+approved questions
across difficulties (`source='phase24-smoke'`), runs scoring, purges all demo rows in `finally`.
Coverage:
- `deriveRawScore`: explicit passthrough/clamp, correct bool, Likert ladder, MCQ best/adjacent/distant,
  null-when-nothing-scoreable.
- **Canonical-type regression**: `multiple_choice`/`situational_judgment`/`scenario_based`/`case_study`
  best-answer scored (pure + DB-resolved `multiple_choice` → 60 not Likert 25); `likert` stays on ladder.
- `computeCompetencyScores`: per-competency grouping (sorted), **difficulty-weighted achieved/max
  (500/600)** vs naive mean (50) — weighting proven distinct; item_count + difficulty_breakdown.
- `normalizeScore`: default weighted percent (83.3); `max=0`→null/unmeasurable; cohort-referenced
  when n≥30 & sd>0; cohort **below k_min ignored** (honest note); sd≤0 rejected.
- `calculateCompetencyLevel`: bands; 83.3→L5 measured; **null→null level (not floored)**; supplied
  labels preferred.
- Orchestrator (DB-resolved): 3-response chain scored; C1 difficulty-weighted 83.3→L5; competency_name
  resolved; C2 MCQ-best 100→L5; level_label populated; overall item-weighted.
- Persistence: run_id returned; `getScoreRun` returns stored run; counts match.
- Preview (`persist:false`) → run_id null (no write).
- Empty honesty: unmapped question → `scoring_empty`, null overall; zero responses → `scoring_empty`.
- Inline items (no DB) scored (66.7→L4); cohort path through orchestrator → `cohort_referenced`.

**Residue scan after run:** `score_runs 0 · mappings 0 · questions 0` (clean teardown).

## Typecheck note
Backend has no local `tsc` and prod runs on **tsx** (never compiled) — the only build gate is the
frontend vite build, unaffected by these backend-only changes. Both new/edited files are validated at
runtime: the smoke (tsx) imports and exercises the engine, and the Backend API workflow restarted and
served requests successfully (routes file loaded without import errors).

## Honesty / contract compliance
- Additive; flag OFF → 503 + no DDL; does not touch Phase 2 scoring, `onto_*` Phase-2 score tables,
  or consumers.
- No fabrication: empty/unmapped → honest `scoring_empty`; cohort never invented; null score → null
  level.

**Status: COMPLETE — pending approval (STOP for approval before merge/deploy).**
