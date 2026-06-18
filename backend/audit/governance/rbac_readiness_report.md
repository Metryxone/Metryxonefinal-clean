# RBAC Readiness Report

_Generated: 2026-06-18T04:01:39.872Z · flag FF_GOVERNANCE_RBAC_V2=ON_

> **Honesty contract.** Structural (code/table/route exists) and Activation (real
> config rows present) are reported as separate axes. RBAC roles/permissions/grants/
> hierarchy are canonical **SYSTEM CONFIGURATION** (not demo/usage data), so seeding
> them legitimately closes Critical Gap #2 (`role_definitions` was empty).

## Headline

| Axis | Score |
|---|---|
| **RBAC Readiness** | ████████████████████ 100% |

**Verdict: GO** — target ≥95%.

## Canonical config — expected vs actual (Activation)

| Element | Expected (canon) | Actual (DB) | Status |
|---|---|---|---|
| System roles | 10 | 10 | ✅ |
| Permissions | 44 | 44 | ✅ |
| Role→permission grants | 144 | 144 | ✅ |
| Permission groups | 8 | 8 | ✅ |
| Group members | >0 | 41 | ✅ |
| Hierarchy edges | 9 | 9 | ✅ |

Seed result this run (idempotent, ON CONFLICT — 0 new on a re-run is expected):
```json
{
  "roles": 10,
  "permissions": 44,
  "groups": 8,
  "groupMembers": 0,
  "grants": 0,
  "hierarchyEdges": 0
}
```

## The 10 canonical roles

| Role | Level | Description |
|---|---|---|
| `super_admin` | 100 | Unrestricted platform owner. Holds every permission. |
| `platform_admin` | 90 | Operates the platform: users, billing, content, configuration. |
| `institution_admin` | 70 | Administers a single institution: its faculty, students and assessments. |
| `employer_admin` | 70 | Administers a single employer: recruiters, jobs and candidates. |
| `recruiter` | 50 | Manages job postings and reviews candidates. |
| `faculty` | 50 | Manages cohorts and reviews student assessments. |
| `assessor` | 40 | Administers and scores assessments. |
| `counselor` | 40 | Guides students/candidates; reads reports, no destructive actions. |
| `student` | 10 | End user taking assessments and viewing their own results. |
| `candidate` | 10 | Job seeker maintaining a profile and applying to roles. |

## Structural

- Base RBAC tables present: 4/4 (role_definitions, permission_definitions, role_permissions, admin_audit_logs).
- Service/route/migration files present: 10/10.
- Effective-permission resolution = direct ∪ inherited (via `rbac_role_hierarchies`); engine read-only never-throws, grant/revoke fail-closed + audited.

## Honest notes

- Flag-OFF is byte-identical: `ensureGovernanceSchema` is only called behind the flag, so flag-OFF creates **no tables** and the routes 503 before any DB work.
- Grant/revoke are wired and audited but RBAC is **not yet the live authorization gate** — the production access check remains `requireSuperAdmin`. This RBAC model is the canonical config + management surface; enforcement wiring is a separate, deliberate follow-up (reported, not hidden).
