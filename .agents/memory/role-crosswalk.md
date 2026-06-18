---
name: Role crosswalk (app role → ont_roles)
description: How app-facing role identifiers bridge to the O*NET-backed ontology role library so recommendations consume the big library.
---

# Role crosswalk: app role identifiers → `ont_roles.code`

`backend/services/role-crosswalk.ts` bridges the THREE disjoint ways the app
names a role to a canonical `ont_roles.code`, so the imported library (O*NET
`ONET_<soc>` + curated starter `ROLE_*`) is actually consumed:

1. free-text profile labels (`cra_profiles.target_role_label` / `current_role_label`)
2. legacy career-intelligence catalog ids (`'swe'`, `'ml-eng'`, `'pm'`, `'eng-mgr'`, … in `routes/career-intelligence.ts`)
3. ontology codes already (`ROLE_*` seeded, `ONET_*` onet)

**Why a separate endpoint, not ROLE_PRIORITIES:** the legacy competency runtime
hard-codes only ~10 role labels in `competency-assessment-runtime.ts`
`ROLE_PRIORITIES`, and those use short competency codes (`COG01`…) that are a
DISJOINT namespace from ontology comps (`C_*` / `ONET_*`). So feeding the
crosswalk into ROLE_PRIORITIES would cross namespaces — instead exposed a new
read endpoint `GET /api/competency/role-library/:userId` (IDOR-guarded; `?role=`
override) returning `requiredCompetencies` from `getRoleCompetencies`
(`map_role_competency ⋈ ont_competencies`).

**Honesty rules (do not break):**
- unresolved role → `resolved: null` + note; never fabricate a fallback role.
- resolved-but-no-ratings (O*NET aggregate occupations w/ no element rows) →
  empty competency list + note; never fabricate requirements.
- resolver biases toward the candidate WITH competencies within a rank tier, so a
  match is useful, not an empty shell.

**Env reality:** `ont_*` tables ship EMPTY (merges carry code + DDL, not rows —
see merged-task-data-not-in-live-db). In dev, only the starter `runOntologySeed`
(~24 `ROLE_*`, 262 links) is present, so non-starter titles (e.g. "Registered
Nurse") legitimately return no match here. Prod gets 1016 occupations via
`POST /api/ontology/overview/import-onet` (`runOnetImport`); crosswalk works there
unchanged because resolution is title/code-based, not seed-specific.
onetcenter.org times out from this env, so O*NET cannot be imported locally.
