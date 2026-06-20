---
name: Talent Foundation deliverable-name reconciliation (Phase 5.1/5.2)
description: How to deliver requested table-name deliverables that already exist under other names, across disjoint role spines.
---

# Talent Foundation reconciliation (Employer Foundation + Job Architecture)

When a phase spec lists **deliverable TABLE NAMES** that don't physically exist but
functionally-equivalent, already-populated tables do, expose the requested names as
**read-only compatibility VIEWS over ONE canonical source each** — never build duplicate
`_master`/`_framework` tables (that splits the source of truth). Build a thin additive
REAL table ONLY for a genuine gap (no source at all).

**Why:** the contract is additive / compose-never-recompute / never-duplicate. Duplicate
master tables create split-brain. Views are zero-data, reversible (`DROP VIEW`), single
source of truth. This satisfies the literal deliverable names AND the honesty contract.

**How to apply:**
- Deliverable→source map (migration `20260620_phase51_52_canonical_foundation.sql`):
  employer_master→employer_organizations; organization_master→employer_business_units
  (self-hierarchy via parent_id); employer_rbac→role_definitions×role_permissions×
  permission_definitions; employer_profiles→employer_company_profiles;
  job_architecture→cg_roles; job_role_framework→onto_role_competency_profiles;
  job_templates→NEW thin table (genuine gap).
- **Competing role spines are DISJOINT** (`cg_*` richest=200 roles, `onto_*` only
  populated competency profiles=14, `ont_*`/`gro_*` empty in dev, `role_families` uuid).
  Their ids do NOT interoperate — NEVER join them in a view (fabricates Role↔Competency).
  Surface `job_architecture` (cg_*) and `job_role_framework` (onto_*) SEPARATELY, each
  stamped with `source_authority`. A unified Role↔Competency link needs a deliberate
  crosswalk, not a guess.
- **Job Category == Job Family** in the populated data (no separate category dimension);
  alias `function_area` and disclose, don't invent a taxonomy.
- Surface read-only behind flag `talentFoundation` (env `FF_TALENT_FOUNDATION`, default
  OFF) via the Phase-5 route template (gate→auth→superadmin, literal-before-param,
  to_regclass-probed never-throws aggregator). Empty source ⇒ honest `absent` + rows 0,
  never coerced/fabricated.
- The Phase-5 `talent-intelligence-aggregator` `buildJobArchitecture` probes
  `ep98_role_intelligence`/`employer_jobs`, NOT a literal `job_architecture` relation, so
  the new view does NOT change its output.

## File/export collision trap (caused a real regression)
`routes/talent-foundation.ts` ALREADY EXISTS — it owns the legacy `/api/talent/*` +
`/api/admin/talent/*` role-family/blueprint/mapping CRUD consumed by live Super Admin
panels (RoleFamilyPanel, CompetencyBlueprintPanel, BlueprintMappingPanel,
LevelProfilePanel), and is already imported+registered in `routes.ts` as
`registerTalentFoundationRoutes`. Writing a "new" file at that path CLOBBERS it (the write
tool says "File **rewritten**" — a tell), and re-importing the same export name creates a
DUPLICATE import/registration.
**Why:** the contract is byte-identical-additive; silently replacing an existing route
surface is a functional regression even if the new code is otherwise correct.
**How to apply:** before creating any `routes/*.ts` / service file, grep the path + intended
export name first; put NEW phase work in a DISTINCTLY-named file (`*-v52.ts`) with a
DISTINCT export (`registerTalentFoundationV52Routes`) under its OWN `/api/...` namespace.
The new Phase 5.1/5.2 rollup lives in `routes/talent-foundation-v52.ts` (`/api/talent-foundation/*`),
SEPARATE from the legacy `routes/talent-foundation.ts` (`/api/talent/*`).
