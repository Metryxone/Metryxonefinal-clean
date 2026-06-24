# MX-103W — Job Store Unification Plan (Phase 1)

> "Unification" here means **seam closure via projection**, NOT a table merge.
> Both bounded contexts are retained per founder approval.

## Design
```
job_postings (status = published / approved)
        │   publishJob() / decideStage(approve)
        ▼
  Projection Layer  (services/job-store-projection.ts, flag employerJobStoreSync)
        │   idempotent upsert keyed on id (employer_jobs.id = job_postings.id)
        ▼
employer_jobs (source_posting_id = posting id, status = active)
        │
        ▼
  job_projection_audit  (append-only: project | reproject | unproject)
```

## Properties (all verified by smoke — see job_store_validation.md)
- **Additive** — only `CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT
  EXISTS`. Never drops/alters an existing column.
- **Reversible** — `unprojectJob()` sets `status='inactive'`, preserves the row
  (no DELETE). Re-projecting reactivates it.
- **Idempotent** — `ON CONFLICT (id) DO UPDATE`. A second project of the same posting
  is a `reproject` and leaves **exactly one** row.
- **Flag-gated** — OFF byte-identical incl. schema (ensure-schema POST/hook-only).
- **Never-throws** — the hook in `job-posting-engine.ts` fires fire-and-forget; a
  projection failure never breaks publish/approve.
- **No data loss** — projection writes a NEW funnel row; it never mutates
  `job_postings`.
- **Audit-logged** — every project/reproject/unproject appends a `job_projection_audit`
  row with before/after status + actor.
- **IDs as strings** — `employer_jobs.id` is TEXT; the posting id is reused verbatim
  for a 1:1 link.

## Hook points (flag-gated, never-throws)
- `job-posting-engine.ts` `publishJob` → project on publish.
- `job-posting-engine.ts` `decideStage` → project on approve, unproject on a
  withdraw/reject transition.

## Schema-divergence mapping (canonical employer_jobs)
| job_postings | → employer_jobs | Note |
|---|---|---|
| id | id | 1:1 link (string) |
| title | title | |
| role_category | department | |
| employment_type | type | column is `type`, not `employment_type` |
| eligibility + qualifications | requirements (JSONB) | |
| responsibilities | responsibilities (JSONB) | |
| work_mode | (folded into description) | no `work_mode` column — honest carry |
| (none) | location / skills / ei_min_score | honest empty (null/[]/0) |
| status | source_status | provenance |
| — | source_posting_id, projected_at, projected_by | provenance |

## What this phase does NOT touch
- `role-title-crosswalk.ts`, `talent-matching-engine.ts`, matching tests
  (#102/#103/#104 own them) — composed only.
- The read path (`job-store-resolver.ts`, #98) — unchanged.
