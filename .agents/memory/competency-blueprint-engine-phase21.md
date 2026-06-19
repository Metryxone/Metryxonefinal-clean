---
name: Competency Assessment Blueprint Engine (Phase 2.1)
description: How the role→5-dimension blueprint mix is grounded, namespaced, and kept honest.
---

# Assessment Blueprint Engine (Phase 2.1)

`Role → Assessment Blueprint` where a blueprint carries a 5-dimension % mix that sums to 100.

## The 5 dimensions are TYPES, not domains
The components (behavioral / cognitive / functional / technical / future_skills) are the Phase 1
**`onto_competency_types.type_key`** set — NOT the 5 onto-DOMAINs (which are
cognitive/interpersonal/behavioral/functional/strategic). The two 5-sets differ (technical+future_skills
vs interpersonal+strategic) and are orthogonal classification axes of a competency.
**Why:** Phase 2 SCORING aggregates by onto-domain; Phase 2.1 blueprint MIX is by competency-type. Don't
conflate them or try to make one drive the other.

## Derivation grounding (never fabricate)
Mix is derived from real data: `onto_blueprint_competency_map` (per-competency weight) LEFT JOIN
`onto_competency_type_map` (competency→type), aggregate weight per type, normalize to 100
(largest-remainder). Denominator = typed weight; fall back to competency COUNT if weights are 0.
- `technical` is sparse (~2 competencies) and `future_skills` is EMPTY (0) in the genome → they derive to
  0% / earn warnings. These are honest content gaps, surfaced in `coverage.notes`/`dimensions_absent`, never
  auto-filled.
- A blueprint with zero typed competencies → `insufficient_typing`, no row written (never a fabricated mix).
- Untyped competencies are excluded from the denominator and reported separately, not folded into a dim.

## Namespacing / no-collision
New table is **`onto_blueprint_dimension_mix`** (the "assessment_blueprints" deliverable), keyed 1:1 to the
existing `onto_assessment_blueprints` (FK ON DELETE CASCADE). Named `onto_*` to fit the Phase 1/2 framework
and avoid the empty, unrelated `assessment_blueprints_v2` / `assessment_blueprint_competencies` (do NOT
touch those). Plain `assessment_blueprints` does not exist.

## Builder/validation/routes
`services/blueprint-builder.ts`: `deriveDimensionMix` (read-only), `buildBlueprint` (derive OR author
explicit `weights`), `validateDimensionMix` (all-5-present · 0–100 · sum=100±0.5 · gap/concentration
warnings), `getDimensionMix`. Routes live in `routes/competency-runtime.ts` behind the SAME
`competencyRuntime` flag (no new flag): `POST …/blueprints/dimension-mix/validate` (literal, before the
`:param`), `POST …/blueprints/:id/dimension-mix`, `GET …/blueprints/:id/dimension-mix`.
Lazy `ensureBlueprintDimensionSchema` only runs behind the flag gate ⇒ flag-OFF = zero DDL.

## Bridge point (deferred)
NOT wired into Phase 2 `generateAssessment` allocation yet — deliberately, to not disturb the working chain.
That wiring is the natural next phase.
