---
name: Adaptive Assessment Activation (MX-100X Phase 4)
description: Role/seniority → difficulty + level-aware readiness bands, flag-gated; honest single-band-bank ceiling and the Role-DNA read path.
---

# Adaptive Assessment Activation (MX-100X Phase 4)

Flag `adaptiveDifficultyActivation` (default OFF). Pure engine `services/adaptive-difficulty-activation.ts`
consumed by THREE flag-gated surfaces: `/api/competency/questions/select` (difficulty-bias + `difficulty_plan`
envelope), role-fit readiness bands in `competency-assessment-runtime.ts` (level-aware vs `DEFAULT_READINESS_BANDS`),
and new GET `/api/competency/assessment/difficulty-plan`. OFF = byte-identical incl. zero DDL (read-only).

## Honest ceilings (do not pad)
- The LIVE served bank (`competency_question_templates` status=approved, codes COG/COM/LEA/EXE/ADP/TEC/EIQ)
  is **100% `medium`** → SERVED difficulty CANNOT shift by role level. Target difficulty + readiness/scoring
  thresholds DO shift; **bank content is the ceiling**. The non-medium bands in the bank-wide set belong to a
  DISJOINT genome `comp_*` namespace `/select` never serves — use only to PROVE the band-matcher discriminates.
- Senior level-aware bands == the legacy fixed ladder (85/72/58/45) BY DESIGN, so flag-ON for a senior subject
  is byte-identical to flag-OFF. Junior lowers the bar, director raises it (monotonic).

## Role-DNA expected_level read path
- `lookupRoleDnaAnchor(pool, role)` is READ-ONLY: chain `role (title|id) → onto_roles → onto_dna_profiles
  (is_current) → competency_runtime_weights → AVG(expected_level)`, every table `to_regclass`-probed.
- **Why the table matters:** `competency_runtime_weights.expected_level` is the runtime Role-DNA signal, but it
  is **EMPTY (0 rows)** so the lookup returns null today → byte-identical fallback to the career-stage anchor
  (`seniority_anchor`). The path is wired so the claim "consumes expected_level when present" is TRUE in prod
  once populated — not aspirational.
- **Scale guard:** `expected_level` is treated as 0–100; an AVG outside [0,100] is REJECTED to null (reason
  stamped), never silently coerced. When real data lands, CONFIRM the scale before trusting the anchor —
  `map_role_competency` proficiency is ordinal strings in a disjoint `ont_*` INTEGER namespace, so don't assume.
- Precedence in `buildDifficultyPlan`: explicit `opts.expectedLevel` > Role-DNA lookup > stage anchor. Provenance
  surfaced via `proficiency_source` (`role_dna_expected_level` vs `seniority_anchor`) + `honest_notes`.

## Test discipline
- Smoke asserts the flag-OFF HTTP contract (difficulty-plan **503 before auth**), so the flag MUST stay OFF in
  the `Backend API` workflow command. Evidence runs the engine/service directly (no HTTP).
- A single-band no-op test must PROVE ordering is preserved (uniform bonus across all rows can't re-rank), not
  just compare a bonus to itself (tautology).
