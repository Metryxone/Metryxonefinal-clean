---
name: Employer job-store projection (MX-103W)
description: Projecting job_postings → employer_jobs; the CREATE-TABLE-vs-live-schema divergence trap and the /api/admin probe gate.
---

# Employer job-store projection (MX-103W)

Flag-gated (`employerJobStoreSync`, `roleAutoResolution`) additive layer bridging the
TWO retained employer job stores: `job_postings` (authoring/publishing, owned by
job-posting-engine) and `employer_jobs` (canonical hiring-funnel, owned by
recruiter-postings/employer-portal). One-directional projection on publish/approve;
read-side already bridged by job-store-resolver (resolveJob). Both contexts stay
separate — never merge.

## The trap: CREATE TABLE IF NOT EXISTS does NOT reconcile a divergent live table
A projection service that ships its own `CREATE TABLE IF NOT EXISTS employer_jobs (…)`
fallback shape will be a **no-op** against the live DB, because `employer_jobs`
already exists with the canonical (different) shape. So the INSERT must map to the
**live** columns, NOT the fallback CREATE shape.

**Why:** the first INSERT draft wrote `work_mode`/`experience`/`salary` (from the
fallback CREATE shape) → `column "work_mode" of relation "employer_jobs" does not
exist` (500). The live table has `type` (not `employment_type`), `salary_min`/
`salary_max` (no `salary`), and NO `work_mode`/`experience` at all.

**How to apply:** when projecting into an existing table owned by another subsystem,
query `information_schema.columns` for the REAL shape first; map only to columns
present in BOTH the live table and your fallback; fold orphan source fields into a
real column (e.g. `work_mode` → appended to `description`) — honest carry, never a
fabricated column. Project the 1:1 link by reusing the source id (employer_jobs.id =
posting id, TEXT). Reversible = status='inactive' (never DELETE); idempotent =
`ON CONFLICT (id) DO UPDATE`.

## /enabled probe under /api/admin is authenticated-only
A global `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate fronts the
router, so an intended "unauthenticated" `/enabled` probe returns 401 to an
uncredentialed caller. Fine here because the panel renders only in the super-admin
shell (credentialed fetch passes); don't claim it's public. (Same pattern noted in
platform-intelligence-console.md.)

## Readiness ≠ Adoption (honesty)
`deriveReadiness` scores STRUCTURAL presence (can the spine run): 8 substrate checks
→ 100% on the live DB. Adoption is separately, honestly 0 (0 published postings → 0
projected jobs; 0 resolution decisions). Never inflate adoption to dress up readiness.
