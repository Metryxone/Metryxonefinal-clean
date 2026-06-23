# Phase 5 — Competency → Skill Intelligence

**Task:** MX-98X-GAP-CLOSURE-IMPLEMENTATION · Phase 5
**Date:** 2026-06-23 · Additive / reversible / flag-gated.

## Target chain
```
Competency → Skills → Learning Assets → Certifications → Roles → Career Paths
```

## Current state (evidence)
- Competencies: `onto_competencies` 419 (canonical genome).
- Skill requirements live in the career graph: `cg_skill_requirements` 711, `cg_skill_resource_map` 256, `cg_learning_resources` 76.
- **No observed mapping table** between `onto_competencies` and `cg_skill_requirements` (competency↔skill vocabulary gap). ⚠️ Asserted as *absence* from this session's trace — must be re-verified before building (if a table exists, surface it instead of creating one).
- Certifications: no dedicated certification entity observed → certification→role link is a net-new (small) surface.

## Gap closure (additive, flag `FF_COMPETENCY_SKILL_INTELLIGENCE`, default OFF)
1. **Competency→Skill mapping** — additive crosswalk table `comp_skill_map` (competency_id ↔ skill id/name), seeded by name/synonym match (confidence-scored, `UNCLASSIFIED` where no match — never fabricate).
2. **Skill→Learning mapping** — reuse existing `cg_skill_resource_map` (256) / `cg_learning_resources`.
3. **Learning→Certification mapping** — additive `learning_certification_map`.
4. **Certification→Role mapping** — additive `certification_role_map`.
5. **Role→Career mapping** — reuse `cg_role_edges` (500).

## Architecture / Data / API impact
- **Architecture:** new `services/competency-skill-intelligence.ts` composing existing graph + new crosswalk tables. No edits to genome or graph content.
- **Data:** **new additive tables only** (`comp_skill_map`, `learning_certification_map`, `certification_role_map`), lazy ensure-schema on write path. Seeds confidence-scored + reversible by provenance. Existing tables untouched.
- **API:** additive `GET /api/v2/competency-skill/chain/:competencyId` (flag-OFF 503).

## Rollback strategy
- Flag OFF → routes 503. Drop the 3 new tables to fully remove. No existing data touched.

## Success metrics
- % `onto_competencies` with ≥1 confidence-scored skill mapping (honest ceiling = name-matchable competencies).
- Chain resolves competency→skill→learning→cert→role→career with no fabricated hop (UNCLASSIFIED surfaced honestly).

## Expected maturity gain
- Competency→skill intelligence: ~15% → ~55% (first real crosswalk; depth grows with curation).

## Evidence ledger
- Counts → live `count(*)`, 2026-06-23. Competency↔skill mapping **absence** is asserted from trace — flagged for re-verification before implementation. Maturity = estimate.
