# O*NET Role DNA Generation (capabilities 2–4 of 5)

Covers **OnetRoleIntelligenceEngine**, **OnetCompetencyInheritanceEngine**, and **OnetRoleDnaGenerator** — the resolution → inheritance → DNA chain.

## 2) Role Intelligence — `GET /api/v2/onet-activation/role-intelligence/:roleInput`
`getRoleIntelligence` composes `resolveBestOntRole` (ranked match: code > exact_title > alias > partial_title) + `scoreRoleMatch` (confidence) + **O*NET hierarchy context**.

Net-new value = `getOntHierarchyContext`: joins `ont_roles → ont_role_families → ont_departments → ont_functions` to surface `family / careerTrackArchetype / department / function / crossIndustryFunction`. Unresolved input → honest `resolved:false`, `hierarchy.available:false` (never fabricated).

## 3) Competency Inheritance — `GET /api/v2/onet-activation/inheritance/:roleInput`
`getCompetencyInheritance` composes `getRoleCompetencies` (O*NET `map_role_competency`) and groups by `importanceTier` and `source`. Invariant: `Σ byTier == total`. Unresolved → `total:0`, empty groups (never fabricated). Curated `onto_*` requirements take precedence **downstream in the full DNA**, not here (this layer is the raw inherited view).

## 4) Role DNA Generator — `GET /api/v2/onet-activation/role-dna/:roleInput`
`getRoleDna` composes the existing `generateRoleDNA` (curated-over-inherited composition) + hierarchy context.

**Curated precedence:** where a `map_ont_onto_role` bridge exists, curated `onto_role_competency_profiles` requirements win; otherwise O*NET inherited requirements fill in. The `curatedPrecedence` flag is true only when curated requirements were actually applied.

**Invariant (smoke-enforced):** `competencyCount == curatedRequirementCount + inheritedRequirementCount` for every shape (resolved, bridged, and bogus).

## Materialization
`materializeRoleDNA` persists DNA profiles to the additive `role_dna_expansion_snapshots` (provenance `98x_phase1_expansion`). The activation run materialized **600** profiles (top-by-competency-coverage), 0 skipped. Per-request HTTP routes never write — materialization is offline-only (`scripts/activate-onet-role-dna.ts`).

## Rollback
`--rollback` deletes all provenance-stamped snapshots (reversible, derived reference data, no PII).
