---
name: Competency Runtime (Phase 2) activation
description: How the live competency chain (generate→score→profile→gap) is grounded, why scores are a domain-proxy, and why it's super-admin gated.
---

# Competency Runtime — Phase 2

Flag `competencyRuntime` (default OFF → 503 before any DB/auth). Engine in
`services/competency-runtime.ts`, routes in `routes/competency-runtime.ts`,
tables `onto_assessment_instances/responses/competency_scores/competency_profiles`
(profile append-only).

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
