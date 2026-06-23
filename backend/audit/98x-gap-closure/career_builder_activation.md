# Phase 4 — Career Builder 2.0 Activation

**Task:** MX-98X-GAP-CLOSURE-IMPLEMENTATION · Phase 4
**Date:** 2026-06-23 · Additive / reversible / flag-gated. Evidence = live `count(*)` + memory `cgi-architecture.md`, `career-intelligence-phase4x-compose.md`.

## Target flow
```
Assessment → Competency Profile → Competency Gaps → Role Gaps → Career Paths
   → Learning Paths → Development Plans → Progress Tracking → Reassessment
```

## Current state (evidence)
- Career-graph **content** is seeded: `cg_roles` 200, `cg_role_edges` 500, `cg_skill_requirements` 711, `cg_tracks` 15, `cg_track_waypoints` 76, `cg_learning_resources` 76, `cg_skill_resource_map` 256, `cg_promotion_rules` 40, `cg_lateral_rules` 25, `cg_readiness_weights` 1.
- Every **user** table is empty: all `cg_user_*` = 0; `p4_growth_trajectories` 0 (engine exists; rows just need writing).
- Engines present: Role-Readiness-V2, gap analysis, `postCompletionHooks` pattern, M5 plan engines.
- So Career Builder **consumes** intelligence but does not yet **generate** per-user intelligence — purely an activation gap.

## Gap closure (additive, flag `FF_CAREER_BUILDER_ACTIVATION`, default OFF)
1. **Competency gap analysis** — per-user gaps from Phase-2 unified profile vs role requirements.
2. **Role readiness engine** — fire Role-Readiness-V2 per user → write `cg_user_role_readiness`.
3. **Career progression + path** — traverse `cg_role_edges`/`cg_promotion_rules`/`cg_lateral_rules` → `cg_user_career_path`.
4. **Development plan engine** — reuse M5 plan engine at user scope → development plan rows.
5. **Learning recommendation engine** — map gaps → `cg_skill_resource_map`/`cg_learning_resources` → `cg_user_learning_recs`.
6. **Progress intelligence + reassessment triggers** — activate trajectories from existing `p4_competency_history` (8,970) corpus; schedule reassessment reminders.

**Automation:** an assessment-completion hook (extending the existing `postCompletionHooks` pattern) materializes the `cg_user_*` rows. Fire-and-forget, never-throws.

## Architecture / Data / API impact
- **Architecture:** new `services/career-builder-activation.ts` composing existing engines + one completion hook. No edits to `CareerBuilderPage.tsx` / existing engines (constraint: additive only).
- **Data:** writes to existing-but-empty `cg_user_*` tables, stamped reversibly (e.g., `source='98x_phase4'` where a column exists, else tracked by user+generated_at). No DDL on existing tables; lazy ensure-schema only for any net-new table on its write path.
- **API:** additive `POST /api/v2/career-builder/activate/:userId`, `GET /api/v2/career-builder/intelligence/:userId` (flag-OFF 503). `resolveEffectiveUserId` IDOR guard at route level.

## Rollback strategy
- Flag OFF → routes 503, hook no-ops; Career Builder byte-identical. Data rollback: delete generated `cg_user_*` rows by provenance/user. Content tables untouched.

## Success metrics
- `cg_user_role_readiness` populated for activated users (0 → N).
- Gap→learning linkage resolves to real `cg_learning_resources` (no dangling recs).
- flag-OFF parity on all existing Career Builder routes.

## Expected maturity gain
- Career Builder activation: ~40% → ~75% (generation turned on; content already exists).

## Evidence ledger
- Counts → live `count(*)`, 2026-06-23. Engine availability → memory `cgi-architecture.md`, `career-intelligence-phase4x-compose.md`. Competency↔skill mapping table absence noted in Phase 5 (verify before building). Maturity = estimate.
