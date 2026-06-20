---
name: Function Readiness Engine (Phase 3.7)
description: Function-level competency readiness for the competency-ei chain — how it derives requirements and the never-throws/DDL traps shared with the industry engine.
---

# Function Readiness Engine (competency-ei Phase 3.7)

Structural MIRROR of the Industry Readiness engine (Phase 3.6) at the FUNCTION taxonomy level — one fewer hop. Same honesty-first / compose-never-recompute / flag-gated (`competencyEi`/`FF_COMPETENCY_EI`) contract.

## Taxonomy traversal (one hop shorter than industry)
`onto_functions` → `onto_subfunctions(function_id)` → `onto_role_families(subfunction_id)` → `onto_roles(role_family_id, deprecated=FALSE)` → `onto_role_competency_profiles(role_id, active)`.
(Industry adds `onto_industries → onto_functions` on top of this; function starts one level down.)

## Requirement derivation (identical method to industry)
No dedicated function→competency source exists, so demand is DERIVED by aggregating role competency profiles across the function's roles: `required_level = MAX`, `weight = prevalence Σ(role weight)/total function roles` (NOT auto-normalised to 100), `criticality = highest tier`. `requirement_source='role_aggregation'`. Subject actual = domain-PROXY (competency→onto_domain→subject domain level, gated by `MEASURABLE_ONTO_DOMAINS`). Reuses `roleFit/readinessBand/ReadinessResult/ReadinessGap` from `role-competency-profile.ts`.

## Honesty states (never fabricate)
- Function not in taxonomy → `available:false`, `requirement_source:'none'` (unavailable).
- Function exists but 0 role competency profiles → `available:false` (e.g. `fn_fs_risk` Risk: 1 role/0 profiles).
- No subject scores covering the demand → `measurable:false` (unmeasured, not 0).
- Coverage (assessed weight share) and readiness score are SEPARATE axes.

## Two traps the architect flags (BOTH shared with the approved 3.6 industry engine — not 3.7-specific)
1. **getProfile → DDL.** `getProfile` (competency-runtime.ts) calls `ensureCompetencyRuntimeSchema` (`CREATE TABLE IF NOT EXISTS`). So the readiness GET path *can* run idempotent DDL when the flag is ON. This is acceptable here because the **flag gate returns 503 BEFORE the handler**, so flag-OFF reaches zero DDL → the byte-identical-OFF contract still holds, and the DDL is a no-op in the activated env where tables exist. Do NOT diverge only one engine to bypass it — keeps 3.5/3.6/3.7 consistent.
2. **never-throws.** The shipped industry engine only wraps `deriveIndustryRequirements` in try/catch; `getProfile`/domain queries past it can throw → 500. Phase 3.7 hardened this: `computeFunctionReadiness` wraps the profile/domain fetch in try/catch (degrades to unavailable), and `listFunctionReadiness` isolates per-function failures. Consider backporting to industry if touched.

## Routes (in routes/competency-ei.ts, after industry routes)
`GET /api/competency-ei/function-readiness/:subject/:function` registered BEFORE `/:subject` (2-seg param before 1-seg). Both `gate → requireAuth → requireSuperAdmin → wrap`.

## Dev data reality (live shared DB)
onto_functions(3): `fn_it_engineering`(Engineering, 3 roles/6 comp, measurable), `fn_it_product`(Product, 1 role/6 comp, measurable), `fn_fs_risk`(Risk, 1 role/0 comp → available:false). Of the canonical HR/Finance/Sales/Operations/Engineering example set, only Engineering is seeded — the rest honestly report unavailable.
