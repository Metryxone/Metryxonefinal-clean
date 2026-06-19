# Phase 2.1 — Assessment Blueprint Engine · Validation

**Scope:** `Role → Assessment Blueprint` with a 5-dimension % mix.
**Status:** Built · validated · **STOP for approval before merge/deploy** (no auto-deploy).
**Contract:** additive · flag-gated (`competencyRuntime`, default OFF → 503) · byte-identical when OFF · never fabricate · consumers untouched (Employability Index, Career Builder, Career Passport, Employer Intelligence, Learning Intelligence, Future Readiness).

## Deliverable mapping (requested → built)
| Requested | Built | Notes |
|---|---|---|
| `assessment_blueprints` | table **`onto_blueprint_dimension_mix`** | One row per existing `onto_assessment_blueprints`; 5 % columns + honest `coverage` JSONB. `onto_*`-namespaced to fit the Phase 1/2 competency framework and avoid colliding with the empty, unrelated `assessment_blueprints_v2`. |
| `blueprint_builder` | `deriveDimensionMix` / `buildBlueprint` (`services/blueprint-builder.ts`) | Derives an honest mix from real competency weights × type map, or authors an explicit mix. |
| `blueprint_validation` | `validateDimensionMix` (same file) | All 5 present · each 0–100 · sum = 100 (±0.5) · content-gap & concentration warnings. |

## Dimension axis (authoritative)
The 5 components **are** the Phase 1 competency types (`onto_competency_types.type_key`):
`behavioral · cognitive · functional · technical · future_skills`.
Derivation aggregates each blueprint competency's weight by its type via `onto_competency_type_map`.
- `technical` is sparse (2 competencies), `future_skills` is empty (0) in the genome — **honest content gaps**, surfaced as 0% / warnings, never fabricated.
- This axis is orthogonal to the Phase 2 scoring axis (5 onto-**domains**); that is intentional and documented.

## Architecture
- New table hangs off existing `onto_assessment_blueprints` (FK, `ON DELETE CASCADE`) — reuses, never duplicates, the role→blueprint header.
- Migration `migrations/20260619_blueprint_dimension_mix.sql` + lazy `ensureBlueprintDimensionSchema()` mirror each other. Lazy ensure is only reachable behind the flag-gated routes ⇒ **flag-OFF performs zero DDL**.
- CHECK constraints enforce each dim ∈ [0,100] and sum ∈ [99.5,100.5]; builder normalizes derived mixes to exactly 100 via largest-remainder rounding.
- Routes added to `routes/competency-runtime.ts` (gate → requireAuth → requireSuperAdmin → wrap):
  - `POST /api/competency-runtime/blueprints/dimension-mix/validate` (no persist; literal, registered before the `:param`)
  - `POST /api/competency-runtime/blueprints/:blueprintId/dimension-mix` (derive when no body `weights`, else author)
  - `GET  /api/competency-runtime/blueprints/:blueprintId/dimension-mix`

## Honesty / never-fabricate guarantees
- A blueprint with **no typed competencies** → `insufficient_typing` (HTTP 422), no row written — never a fabricated mix.
- Untyped competencies are excluded from the denominator and reported in `coverage.untyped_competencies` — not silently folded into a dimension.
- `dimensions_absent` + `notes` make 0% dimensions explicit and attributed to content gaps, not derivation error.

## Validation results
**Flag-OFF (running workflow has no `FF_COMPETENCY_RUNTIME`):**
- `POST …/blueprints/dimension-mix/validate` → `503 {"error":"feature_disabled","flag":"competencyRuntime"}`
- `GET  …/blueprints/blueprint_be_eng/dimension-mix` → `503`
- ⇒ routes registered (503, not "Cannot POST") AND byte-identical-OFF (gate fires before any DB touch).

**Flag-ON e2e** (`scripts/phase2_1-blueprint-smoke.ts`, direct service import, demo rows purged):
- **Derive (real, read-only)** `blueprint_be_eng` → `behavioral 55 / cognitive 15 / functional 0 / technical 30 / future_skills 0` (sum 100). Coverage: 6 typed, 0 untyped, weight-mode; `future_skills` 0% flagged as honest gap.
- **Author** Software Engineer example `behavioral 15 / cognitive 25 / functional 20 / technical 35 / future_skills 5` (sum 100) → valid, persisted `source='authored'`, with technical/future_skills content-gap warnings.
- **Read back** matches authored mix; validation valid.
- **Validate** good=valid; sum-90 → invalid (`dimensions sum to 90`); missing dims → invalid; out-of-range (120 / −20) → invalid.
- **Reject** author of an invalid mix (sum 50) → `invalid_mix`, nothing persisted.
- Demo blueprint deleted (cascades the mix row); shared dev/prod DB left clean.

## Not in scope (bridge points, deferred)
- Wiring the dimension mix into Phase 2 `generateAssessment` question allocation — deliberately deferred to avoid touching the working Phase 2 chain; this phase establishes the blueprint only.
- Authoring `future_skills` / additional `technical` competencies (genome content gap).
