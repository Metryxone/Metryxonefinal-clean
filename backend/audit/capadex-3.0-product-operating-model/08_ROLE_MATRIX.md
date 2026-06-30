# 08 · Role Matrix

System roles (authorization identities), distinct from market segments/personas (06/07). Evidence: `account_type`
column (default `'job_seeker'`), `staff_roles`, RBAC v2 (`governanceRbacV2`), super-admin seeding.

| Role | Auth identity | Scope | Status |
|---|---|---|---|
| job_seeker (default) | `account_type='job_seeker'` | self | **IMPLEMENTED** |
| student | `account_type='student'` | self | **IMPLEMENTED** |
| employer / recruiter | `account_type` flips on `/employer/register` | org (`employer_*`, tenant-scoped) | **IMPLEMENTED** |
| mentor | mentor account + `mentor_profiles` | mentees | **IMPLEMENTED** |
| parent | parent account + consent flow | linked child (consent-gated) | **IMPLEMENTED** |
| institute / university admin | `admin_user_id` OR `institute_staff`→`staff_roles` | tenant roster (k-anon) | **IMPLEMENTED** |
| faculty | `staff_roles` (batch-confined) | assigned batch (403 if out of scope) | **PARTIAL** (nested under institute) |
| super_admin | seeded (`support@metryxone.com`), always 2FA | platform | **IMPLEMENTED** |
| teacher / counsellor | survey identity | survey only | **PARTIAL** |
| coach | coach≈mentor mapping | mentees | **PARTIAL** |
| RBAC v2 custom roles | `governanceRbacV2` subsystem | configurable | **DORMANT (flag-gated)** |

## Authorization findings (security-relevant, read-only observations)
- **Self-registration cannot set `account_type`** (`schema.ts` comment: "must NEVER be client-settable") — a
  correct privilege-escalation guard.
- **Role scoping is enforced, not advisory:** faculty batch-confinement returns 403; institute reads are
  k-anon masked <30; employer detail reads are tenant-scoped (IDOR guarded per memory).
- **Super-admin is always 2FA-gated** (no password-only path; dev bypass removed).
- **RBAC v2** provides a richer custom-role engine but is **DORMANT** (default-OFF). Pre-launch, roles are the
  fixed set above — adequate for launch, not yet a configurable enterprise RBAC product.

## Verdict
Role architecture is **coherent and security-enforced** for the launch persona set. The enterprise-grade
configurable RBAC exists but is dormant (GAP-G1 in Governance). Faculty/teacher/counsellor/coach are the
partial roles to mature.
