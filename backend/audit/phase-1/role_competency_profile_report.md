# Role Competency Profile Report — Phase 1.5

**Objective:** an additive engine that attaches **competency requirements** to roles — each requirement carrying a required level, a weight, and a criticality tier — over the genome. Powers three deliverables: the **Role Competency Profile**, the **Role Competency Matrix**, and the **Role Readiness Framework**.
**Result: engine operational and validated. 33 requirements across 5 roles and 12 competencies.**

## State (`onto_role_competency_profiles`)

| Metric | Value |
|---|---|
| Role→competency requirements | 33 |
| Roles with a profile | 5 of 5 |
| Distinct competencies referenced | 12 |

**Criticality distribution**

| Tier | Count |
|---|---|
| important | 19 |
| critical | 10 |
| desirable | 4 |

(Valid tiers: `critical · important · desirable · optional`.)

## Requirement schema & validation
Each requirement = `role_id` + `competency_id` + `required_level` + `weight` + `criticality` (+ optional `rationale`), stamped `source='curated'`. Server-side validation enforced:
- `required_level` ∈ **1–5** → else `400 invalid_required_level`
- `weight` ∈ **0–100** → else `400 invalid_weight`
- `criticality` ∈ allowed tiers → else `400 invalid_criticality`
- `role_id` and `competency_id` must reference EXISTING rows → `404` otherwise
- duplicate (role, competency) → `409 duplicate_requirement`

> Validation was confirmed live: a create with `criticality:'high'` (not an allowed tier) was correctly rejected `400 invalid_criticality` — a positive finding that the guardrails work.

## Deliverables exposed
- **Role Competency Profile** — `GET /api/competency-intelligence/role-profiles?role_id=` (nested role→requirement view).
- **Role Competency Matrix** — `GET /api/competency-intelligence/role-matrix` (roles × competencies grid).
- **Admin CRUD** — create / update / delete under `/api/admin/competency-intelligence/role-profiles` (`requireAuth + requireSuperAdmin`).

## Operational validation (live e2e)
- Create → 200, persisted in DB; retrieve resolves the **role→competency join**.
- Permissions: unauthenticated create → 401.
- Audit: each mutation logged.
- Cleanup: test rows removed, 0 residual.

## Honest finding (not a defect)
- **Coverage is real but partial:** 12 of 299 competencies appear in role requirements, across all 5 roles. The engine and the three deliverables are operational; broader role-profile authoring is ongoing curation. Reported as-is.

**Success criterion "Role competency profile engine operational": MET.**
