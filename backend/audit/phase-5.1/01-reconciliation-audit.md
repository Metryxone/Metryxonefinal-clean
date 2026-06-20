# Phase 5.1 — Employer Foundation · Reconciliation Audit

**Date:** 2026-06-20
**Contract:** additive · flag-gated · compose-never-recompute · honesty-first (Coverage ≠ Confidence) · never fabricate/duplicate · STOP for approval before merge/deploy.

## Verdict

**The Employer Foundation already exists.** Every requested capability is backed by a
live, already-created table — under a different name than the deliverables list. The
four named deliverables (`employer_master`, `organization_master`, `employer_rbac`,
`employer_profiles`) did **not** exist physically. Building them as net-new tables would
duplicate live infrastructure and create two competing sources of truth (split-brain),
violating the standing contract.

**Resolution applied:** expose the deliverable names as **read-only compatibility VIEWS**
over the canonical source tables. No data is copied; `DROP VIEW` fully reverses it.
Migration: `backend/migrations/20260620_phase51_52_canonical_foundation.sql`.

## Requested → Existing mapping

| Requested deliverable / capability | Canonical source (live) | Rows (2026-06-20) | Delivered as |
|---|---|---|---|
| `employer_master` (Employer/tenant) | `employer_organizations` | 0 | VIEW `employer_master` |
| `organization_master` (Org → Business Unit → Dept → Function) | `employer_business_units` (self-hierarchy via `parent_id`) | 0 | VIEW `organization_master` |
| `employer_rbac` (Roles + Permissions) | `role_definitions` × `role_permissions` × `permission_definitions` | 144 (joined) | VIEW `employer_rbac` |
| `employer_profiles` (Company profile) | `employer_company_profiles` | 0 | VIEW `employer_profiles` |
| Employer Registration / Verification | `routes/employer-admin.ts` + `employer_approvals` | — | exists |
| Org / Dept / Role / Team / User setup | `routes/employer-security.ts` (ROLE_RANK), `employer_team_members`, `employer_members` | — | exists |
| Employer Roles (employer_admin, recruiter) | seeded in `role_definitions` | 10 | exists |
| Permissions | `permission_definitions` | 44 | exists |

## Honesty notes

- **Coverage ≠ data.** The *schema* coverage is complete; operational *data* is empty
  (`employer_organizations`/`members`/`business_units`/`company_profiles` = 0 rows). The
  populated views (`employer_rbac` = 144) reflect seeded RBAC reference data only.
- **No separate "Employer above Organization" entity exists.** The platform models a
  single tenant (`employer_organizations`); organizational depth (BU → Dept → Function)
  is the self-referential `employer_business_units.parent_id` chain. `organization_master`
  exposes that chain rather than inventing a second tenant level.
- **RBAC assignment vs catalogue.** `employer_rbac` is the global role→permission
  *catalogue*. Org-scoped role *assignment* stays in `employer_members.role` and is not
  duplicated.
- **Reversibility.** All four deliverables are views — zero data risk, `DROP VIEW` reverts.

## What was NOT built (and why)

- No duplicate `_master` tables — would split the source of truth. Equivalent live tables
  already serve every field.
