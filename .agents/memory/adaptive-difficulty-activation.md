---
name: Adaptive Assessment Activation (MX-100X Phase 4)
description: Role/seniority → difficulty + level-aware readiness bands, flag-gated; honest single-band-bank ceiling and the Role-DNA read path.
---

# Adaptive Assessment Activation (MX-100X Phase 4)

Flag `adaptiveDifficultyActivation` (default OFF). Pure engine `services/adaptive-difficulty-activation.ts`
consumed by THREE flag-gated surfaces: `/api/competency/questions/select` (difficulty-bias + `difficulty_plan`
envelope), role-fit readiness bands in `competency-assessment-runtime.ts` (level-aware vs `DEFAULT_READINESS_BANDS`),
and new GET `/api/competency/assessment/difficulty-plan`. OFF = byte-identical incl. zero DDL (read-only).

## Unified vocabulary + activation
- The difficulty bank now uses ONE 3-tier ladder **foundational / intermediate / advanced** (legacy
  easy/medium/hard normalized; column DEFAULT now `intermediate`). `DifficultyBand` collapsed to these three;
  `difficultyRank`/`proficiencyToDifficulty` are now ranks **1–3** (legacy still aliased for stragglers).
  ⚠️ A SEPARATE adaptive runtime FSM (`adaptive-assessment-engine.ts` + `assessment-runtime-orchestrator.ts`)
  keeps its OWN local `DifficultyBand='easy'|'medium'|'hard'` — its `bp.difficulty_band` comes from the blueprint
  generator, NOT from `competency_question_templates`, so the bank normalization does NOT touch it. Don't unify it.
- Each served domain (COG/COM/LEA/EXE/ADP/TEC/EIQ) now carries a foundational + advanced variant alongside its
  intermediate stock → **SERVED difficulty CAN shift by level**. Pools are shallow (1 harder/1 easier per domain):
  enough to bias selection, not a deep per-domain ladder (honest residual; D5 = PASS ~88, not 100).
- Senior level-aware bands == the legacy fixed ladder (85/72/58/45) BY DESIGN, so flag-ON for a senior subject
  is byte-identical to flag-OFF. Junior lowers the bar, director raises it (monotonic).

## Role-DNA expected_level read path
- `lookupRoleDnaAnchor(pool, role)` is READ-ONLY: chain `role (title|id) → onto_roles → role_dna_profiles_v2
  (is_active, **UUID**) → competency_runtime_weights (role_dna_id UUID) → AVG(expected_level)`, every table
  `to_regclass`-probed. NOTE the v2 chain — there is NO `onto_dna_profiles.is_current` hop here; that older join
  was wrong for the runtime weights table (weights key on the v2 UUID).
- **Now populated** by `services/adaptive-assessment-seed.ts` (auto-runs fire-and-forget at
  `registerCompetencyQuestionRoutes`, idempotent, so it survives merge-to-prod which carries code+DDL not rows):
  44 weights across 5 role DNAs sourced from curated `onto_role_weights`. Role-differentiated anchors
  (level×20): PM 48 · Backend Eng 57 · Credit Analyst 66 · Sr Backend 71 · Eng Manager 80. Roles WITHOUT a
  curated DNA snapshot still fall back to the stage anchor (honest).
- **Scale:** curated `onto_role_weights.expected_level` is a **1–5 ordinal** (`onto_proficiency_levels`); the seed
  converts to the 0–100 scale `competency_runtime_weights.expected_level` uses (`level/5*100`). The engine still
  REJECTS an AVG outside [0,100] to null (never coerces). `map_role_competency` is a disjoint `ont_*` INTEGER
  namespace — don't confuse it with the curated `onto_*` source.
- Precedence in `buildDifficultyPlan`: explicit `opts.expectedLevel` > Role-DNA lookup > stage anchor. Provenance
  surfaced via `proficiency_source` (`role_dna_expected_level` vs `seniority_anchor`) + `honest_notes`.
- Seed idempotency: Part A guards via a `metadata.seed_source` marker on `role_dna_profiles_v2` + a per-DNA
  `count==0` insert guard on weights (never clobbers runtime-generated rows); Part B is `ON CONFLICT(template_key)
  DO NOTHING` + value-stable UPDATEs. Re-run = 0 writes.

## Test discipline
- Smoke asserts the flag-OFF HTTP contract (difficulty-plan **503 before auth**), so the flag MUST stay OFF in
  the `Backend API` workflow command. Evidence runs the engine/service directly (no HTTP).
- A single-band no-op test must PROVE ordering is preserved (uniform bonus across all rows can't re-rank), not
  just compare a bonus to itself (tautology).
