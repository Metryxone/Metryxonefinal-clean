---
name: Career Builder first outcome evidence loop
description: How the score->real-outcome->validated-claim loop is captured and validated honestly on Career Builder
---

The keystone "prove scores predict real outcomes" loop lives in `career_outcomes`
(capture) + `services/career-evidence-engine.ts` (pure stats) + `routes/career-evidence.ts`
(routes, flag `careerOutcomeEvidence`). SuperAdmin panel id `career-evidence`.

- **All seed data on this platform is demo** — career_seeker_goals (101) are all
  `completed=false` + `source:"Demo Seed"`; cg_user_role_readiness (8) are `demo-user-N`;
  ti_outcome_predictions are `[DEMO]`. So REAL outcomes are genuinely 0. Any "first
  evidence loop" must report n=0 / INSUFFICIENT_EVIDENCE honestly, not fabricate a result.
- **Demo can never validate.** `computeEvidence(pairs, kind, isReal)` only flips
  `validated=true` when isReal && n>=MIN_VALIDATION_N (30) && both outcome groups
  populated (binary) && p<0.05. Caller passes is_demo split; the engine, not the route,
  enforces the gate.
- **The control group must exclude demo identities.** For binary goal_achieved the
  non-achiever control is drawn from cg_user_role_readiness; filter `user_id NOT ILIKE
  'demo%'` and `NOT ILIKE '%@example.com'` or demo-user-N rows leak into the "real" cohort.
- **Capture is idempotent on (outcome_type, ref_id)** (partial unique index). The goal
  completion hook (`onGoalCompleted` in career-evidence, called from career-seeker goal
  create/update on transition into completed) and the admin backfill both key on goal id.
- **Stats:** point-biserial == Pearson with a 0/1 variable; p-value + 95% CI via Fisher-z
  with normal approximation (honest approximation, not exact t). r null when no variance.

**Why:** the audit's #1 finding is realized outcomes=0 (Validity floor ~20). The honest
deliverable is the *mechanism* + an honest validation that abstains until real data accrues,
plus a clearly-labelled synthetic demo cohort to demonstrate the pipeline — never presented
as evidence.
