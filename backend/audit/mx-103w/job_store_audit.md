# MX-103W — Job Store Audit (Phase 1)

## Purpose
Audit the two employer job stores and the seam between them, then close the
write-side seam with an **additive, reversible, flag-gated projection layer** —
without merging the two bounded contexts.

## The two bounded contexts (retained, NOT merged)
| Store | Canonical role | Owner subsystem | Identity |
|---|---|---|---|
| `job_postings` | Authoring / publishing entity | job-posting-engine | created_by → users.id |
| `employer_jobs` | Hiring-funnel entity | recruiter-postings / employer-portal | id (TEXT) |

Per founder approval: **do not merge.** `job_postings` stays the authoring entity,
`employer_jobs` stays the canonical hiring-funnel entity. The seam is bridged with a
**one-directional** projection: `job_postings (published/approved) → employer_jobs`.

## Read-side seam (already closed before this task)
Follow-up **#98** merged `services/job-store-resolver.ts` `resolveJob` — a unified
READ that falls back `employer_jobs → job_postings`. The manual read bridge is gone.
This task does **not** touch the read path; it closes the **write** seam.

## Write-side seam (the gap this phase closes)
Before MX-103W: publishing a `job_postings` row created **no** `employer_jobs` row,
so the funnel (candidates, matching, interviews) had nothing to attach to unless an
operator manually created the funnel row. That manual step is the workaround MX-103V
flagged.

## Live schema divergence (verified against the live DB)
`employer_jobs` actual columns:
```
id, employer_id, title, department, location, type, status, description,
requirements, skills, salary_min, salary_max, currency, ei_min_score, share_token,
created_at, responsibilities, perks, deadline, hiring_manager, quota,
application_count, updated_at, matched_role_id, matched_role_source,
source_posting_id, source_status, projected_at, projected_by
```
Key divergences from `job_postings` that the projection mapping MUST honour:
- `employer_jobs` has **`type`**, not `employment_type`.
- `employer_jobs` has **`salary_min`/`salary_max`** — there is **no** `salary`,
  `work_mode`, or `experience` column. `job_postings.work_mode` is folded into the
  projected `description` (honest carry, not a fabricated column).
- `job_postings` has no structured `skills` / `location` / `ei_min_score` → projected
  as honest empty (`[]` / null / 0), never fabricated.

> ⚠️ Finding caught by the Phase-4 smoke: the first projection draft INSERTed
> `work_mode`/`experience`/`salary`, which **do not exist** on the live table — the
> INSERT 500'd. Fixed by mapping only to columns present in BOTH the canonical and
> the self-contained fallback shape. This is exactly why the smoke writes against the
> live DB.

## Projection-tracking columns (additive, IF NOT EXISTS)
`source_posting_id`, `source_status`, `projected_at`, `projected_by`,
`responsibilities`, `perks`, `updated_at` — all added via `ALTER ... ADD COLUMN IF
NOT EXISTS` (additive, never drops/alters). Audit table `job_projection_audit` is new.

## Flag
`employerJobStoreSync` (`FF_EMPLOYER_JOB_STORE_SYNC`), default **OFF**. Flag-OFF is
byte-identical incl. schema — `ensureProjectionSchema` runs only on the POST/hook
path, never from a GET; GET health uses a `to_regclass` probe.
