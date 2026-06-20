---
name: Industry Readiness Engine (Phase 3.6)
description: How industry-level competency readiness is derived in competency-ei when the O*NET industry namespace is empty; the aggregation method and its honesty caveats.
---

# Industry Readiness Engine (competency-ei Phase 3.6)

Extends role-level readiness to the INDUSTRY level for one subject. Three deliverables under `backend/services/`: `industry-readiness-engine.ts` (orchestrator + `deriveIndustryRequirements`), `industry-fit-engine.ts`, `industry-gap-engine.ts`. Two read-only routes under `/api/competency-ei/industry-readiness/...`. Flag `competencyEi` / `FF_COMPETENCY_EI`. NO new table — purely read-only composition, zero DDL.

## The core constraint: no industry→competency source exists
The O*NET `ont_*` industry namespace is EMPTY (map_industry_competency / ont_industries / ont_competencies all 0 rows). The ONLY traversable industry path is the curated `onto_*` taxonomy: `onto_industries → onto_functions → onto_subfunctions → onto_role_families → onto_roles → onto_role_competency_profiles`.

**So industry requirements are DERIVED by aggregating ROLE competency profiles across the industry's roles** — there is no authoritative direct industry weighting. The derivation is stamped `requirement_source:'role_aggregation'` and a note names `map_industry_competency` (O*NET) as the future authoritative source. Do NOT fabricate a half-bridge to the int-id `ont_*` namespace — it is empty and untestable here.

**Why:** honesty contract — the derived demand must be transparently labelled, never presented as a first-class industry taxonomy that doesn't exist.

## Aggregation method (deriveIndustryRequirements)
Per competency across the industry's roles:
- `required_level = MAX` across roles (the industry bar).
- `weight = Σ(role weight for the competency) / total industry roles` — prevalence-weighted: a competency every role needs keeps full weight, a niche one is proportionally lighter. NOT auto-normalised to 100 (reported honestly via weight_total).
- `criticality = highest tier` any role assigns (critical>important>desirable>optional).

LEFT JOIN onto_role_competency_profiles so an industry with roles-but-no-profiles still reports its role_count honestly and yields an empty requirements list (→ `available:false`, not a fabricated row). In dev only IT roles have profiles, so Financial Services correctly returns `available:false`.

## Subject actuals = domain-proxy (same as role gap analysis)
competency → `onto_competencies.domain_id` → subject's measured domain level from `getProfile().domain_scores`, gated by `MEASURABLE_ONTO_DOMAINS`. Competencies whose domain is unmeasured are an unassessed Coverage gap, never a fabricated score. `competencyDomains` is PRIVATE in competency-runtime — replicate the 2-line `SELECT id, domain_id FROM onto_competencies WHERE id = ANY($1::text[])`.

## Reuse, don't recompute
Build a `ReadinessResult`-shaped object (role_id=industry_id, role_title=industry_name) and feed it through the EXISTING `roleFit` + `readinessBand` from role-competency-profile.ts, then `assessIndustryFit` / `assessIndustryGaps`. The readiness math mirrors `getRoleReadiness` exactly (weighted attainment over assessed weight, blocking = critical & gap>0). Coverage (assessed weight share) and readiness score stay SEPARATE axes — a 92% readiness can still be "Partial Fit" capped by one blocking critical gap at 58% coverage.

## Route order
Register the two-segment `/industry-readiness/:subject/:industry` BEFORE the one-segment `/industry-readiness/:subject` (literal/specific-before-param discipline). Both go through `gate → requireAuth → requireSuperAdmin`; subject is operator-supplied so the super-admin gate is the IDOR guard.
