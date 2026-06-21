# Phase 5.3 — Job Posting Engine · Reconciliation Audit & Build Record

**Program:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION
**Contract:** additive · flag-gated (default OFF) · compose/consume-never-recompute · GET-never-writes · IDOR-guarded (super-admin) · never-throws · honesty-first · STOP for approval before merge/deploy.

## 1. Deliverables requested
- `job_posting_engine` — Create Job · Edit Job · Publish Job
- `job_management_engine` — Pause Job · Close Job · Archive Job · Job Visibility Controls
- `job_workflows` — Job Approval Workflow (HR → Legal → Leadership)

## 2. Reconciliation findings (audit BEFORE build)

### 2.1 Deliverable names — no collision
`job_posting_engine`, `job_management_engine`, `job_workflows` do **not** exist as
tables, views, files, or exports (`to_regclass` → NULL for all three; no source match).
They are **engine/module** names, not schema objects.

### 2.2 The data substrate ALREADY EXISTS but was UNUSED
A lifecycle/approval spine is defined in `shared/schema.ts` (drizzle baseline) and
present in the DB, but **no route or service consumed it** — 0 rows, and the only
references were the schema definition + the drizzle migration. The existing
`employer-portal.ts` job CRUD operates on a *different* table (`employer_jobs`), not
this spine.

| Table | Role for Phase 5.3 | Consumed by | Rows (pre-build) |
|---|---|---|---|
| `job_postings` | Core posting; `status` (default `draft`), `visibility`, `published_at`, `closed_at`, `hr_review_*`/`legal_review_*`/`leadership_approval_*`, `hiring_quota`, `created_by` | all three engines | 0 |
| `job_approval_logs` | Workflow audit (`from_status`→`to_status`, `action`, `actor_id`, `actor_role`, `comments`) | every transition (atomic) | 0 |
| `job_distributions` | External channel distribution (posted/unpublished per channel) | job_management_engine (`distribute`/`unpublish_channel`/`getDistributions`) | 0 |

**Conclusion:** Phase 5.3 = build the three engines that *consume* this existing spine
(**all three tables are now consumed**). **No new tables** were created — only one
additive column (`visibility`) + indexes (incl. a unique `(job_id, channel)` index on
`job_distributions` for idempotent channel upserts).

## 3. What was built (additive only)

| Artifact | Purpose |
|---|---|
| `config/feature-flags.ts` → `jobPostingEngine` (env `FF_JOB_POSTING_ENGINE`, default OFF) + `isJobPostingEngineEnabled()` | single flag gating all three engines |
| `migrations/20260620_phase53_job_posting_engine.sql` | additive: `ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private'` + 3 indexes. No CREATE/DROP TABLE, no seed. |
| `services/job-posting-engine.ts` | the three engines + a single validated state machine + append-only audit logging + read-only probes |
| `routes/job-posting-engine.ts` | `/api/job-posting-engine/*` — gate → requireAuth → requireSuperAdmin |
| `routes.ts` | import + `registerJobPostingEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin)` |
| `scripts/smoke-job-posting-engine.ts` | 27 assertions; self-cleans all demo rows |

## 4. State machine (single source of truth)

```
create → draft
draft|rejected → (edit)            [content edits only here]
draft|rejected → (submit) → hr_review
hr_review → (hr approve) → legal_review        | (hr reject) → rejected
legal_review → (legal approve) → leadership_approval | (reject) → rejected
leadership_approval → (leadership approve) → approved | (reject) → rejected
approved → (publish) → published
published → (pause) → paused
paused → (publish) → published                 [resume]
published|paused → (close) → closed
draft|rejected|closed → (archive) → archived   [terminal]
visibility: private|internal|public (any non-archived status)
```
- Illegal transition → **409** (`invalid_transition`), never a throw, never a mutation.
- Every successful transition appends **one** `job_approval_logs` row, written in the
  **same transaction** as the state mutation (`withTxn` → BEGIN/COMMIT, ROLLBACK on any
  error). Audit history can never silently drift from job state — if the log fails, the
  transition fails and rolls back.
- `from_status` is NOT NULL in the DB → the initial `create` transition coerces null → `''` (honest "no prior state").

### 4.1 Distribution channels (job_distributions)
External-channel visibility, distinct from `job_postings.visibility` (access scope):
- `distribute(id, channels[])` — only when **published**; upserts one row per channel
  (`status='posted'`), idempotent via the unique `(job_id, channel)` index. Unknown
  channels → 400 (`invalid_input`). Canonical set: `linkedin, indeed, naukri,
  internshala, google_jobs, metryx_careers`.
- `unpublish_channel(id, channel)` — sets that channel `status='unpublished'`; no row → 404.
- `getDistributions(id)` / `getJob(id)` embed the live channel states (read-only).
- Each distribute/unpublish also appends one `job_approval_logs` row (same atomic path).

## 5. Contract compliance
- **Additive / byte-identical OFF:** flag default OFF → all `/api/job-posting-engine/*` return **503 before any auth/DB touch** (verified over HTTP). No DDL, no read, no write when OFF.
- **GET-never-writes:** read routes (`/jobs`, `/jobs/:id`, `/jobs/:id/workflow`, `/_meta/status`) use `to_regclass` probes only; the lazy `ensure*Schema` (DDL) runs **only** on write paths.
- **IDOR-guarded:** super-admin gated; `created_by`/`actor_id` are stamped from the authenticated principal (valid FK to `users.id`), never client-supplied.
- **Never-throws:** engine returns typed results; routes map to 200/201/400/404/409.
- **Honesty-first:** no fabricated rows; empty/absent reads degrade to empty + a `note`; audit trail reflects exactly what happened.
- **Route order:** literal `/_meta/status` and `/jobs/:id/workflow` registered before `/jobs/:id`.

## 6. Verification
- Smoke: **34/34 PASS** (`FF_JOB_POSTING_ENGINE=1 npx tsx scripts/smoke-job-posting-engine.ts`) — full lifecycle, rejection path, illegal-transition guards, visibility guards, **channel distribution lifecycle (distribute/idempotent re-distribute/unknown-channel/unpublish/not-found/embed)**, audit-trail completeness + actor stamping, HTTP flag-OFF 503. All demo rows cleaned up (DB left at 0 rows).
- Frontend `vite build`: PASS (the real launch gate; backend runs on tsx).
- The two `mockup-sandbox` workflow failures are the known canvas Vite port-squat — unrelated.

## 7. STOP — awaiting approval
Per standing rule: no merge/deploy without approval. Backend-only (no frontend UI), consistent with Phases 5.1/5.2.
