---
name: Competency Runtime (Phase 2) activation
description: How the live competency chain (generate→score→profile→gap) is grounded, why scores are a domain-proxy, and why it's super-admin gated.
---

# Competency Runtime — Phase 2

Flag `competencyRuntime` (default OFF → 503 before any DB/auth). Engine in
`services/competency-runtime.ts`, routes in `routes/competency-runtime.ts`,
tables `onto_assessment_instances/responses/competency_scores/competency_profiles`
(profile append-only).

## Phase 2.4 Competency Scoring Engine — shares Phase 2.3's substrate
`services/competency-scoring.ts` (version `phase-2.4`) depends on the EXACT same substrate as Phase 2.3 assembly: `onto_question_competency_mapping`, `competency_question_templates.status='approved'`, and the `competencyRuntime` flag (env `FF_COMPETENCY_RUNTIME`). Once 2.3 was activated, 2.4 needed ZERO new fixes.
Chain: deriveRawScore (Q→raw; correct→100/0, or Likert ladder) → computeCompetencyScores (difficulty-weighted sum, ordinal foundational=1..expert=5) → normalizeScore (weighted %, or cohort T-score ONLY when real cohort n≥30, never fabricated) → calculateCompetencyLevel (≥80/60/40/20 → L5..L2 else L1; null→unmeasurable, never floored to 1). Empty/unscoreable responses → status `scoring_empty` + null overall. Persists to `onto_competency_score_runs`; reads level labels from `onto_proficiency_levels` (5 rows). Routes: POST /score, POST /score-preview (run_id null = not persisted), GET /score-runs/:runId.

## Domain-proxy measurement (the honesty crux)
- Question bank `competency_question_templates` is keyed by **7 codes**
  (COG/COM/LEA/EXE/ADP/TEC/EIQ); the genome taxonomy has **5 onto-domains**.
  `onto_competency_question_map` is **0 rows**, so a competency cannot be scored
  by its own questions yet.
- Curated inert `DOMAIN_CODE_TO_ONTO` crosswalk maps the 7 codes DOWN to the 5
  onto-domains; a competency inherits its **onto-domain** score →
  `measurement: "domain_proxy"`. **Auto-upgrades** to per-competency precision the
  moment `onto_competency_question_map` is populated — no code change.
- `dom_strategic` has **no bank code** → its competencies are reported
  `unmeasurable` (reason string), excluded from scores and coverage numerator.
  **Never** fabricate a score for them.
- Coverage (measurable vs total) is a SEPARATE axis from score. Bank empty (0
  approved templates) → generation honestly yields 0 questions.

## Scoring deviation
Mirrors bank `option.score` (0–100), NOT the CAF/IRT engine (wrong data shape).
`scoreToLevel`: ≥80→5, ≥60→4, ≥40→3, ≥20→2, else 1. Likert/no-option questions
default to a 5-point 0/25/50/75/100 scale (see competency-questions.ts rowToQuestion).

## Access control
`subject_id` is an OPERATOR-supplied identifier for any assessed person (not the
caller's own identity). All five routes are `gate → requireAuth → requireSuperAdmin`.
A `requireAuth`-only version is an IDOR (any user reads/scores any subject) — a code
review caught exactly this. Reuses `getRoleReadiness` for gap analysis.

## Testing
No UI/HTTP-ON path in dev (workflow leaves flag OFF). Exercise the engine via a
tsx script that sets `process.env.FF_COMPETENCY_RUNTIME='1'`, seeds demo `approved`
templates (`template_key LIKE 'demo_phase2_%'`) against `blueprint_pm`, runs the
chain, then DELETEs every demo row (shared dev/prod DB → must be purgeable).
