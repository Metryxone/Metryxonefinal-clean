# Phase 5.9 — Shortlisting Engine · Reconciliation Audit

**Date:** 2026-06-21
**Status:** IMPLEMENTED — flag OFF (awaiting activation approval). DO NOT merge/deploy without sign-off.
**Smoke:** `scripts/smoke-shortlisting-engine.ts` → **48 passed / 0 failed** (`FF_SHORTLISTING=1`), incl. concurrency/atomicity checks.
**Launch gate:** `cd frontend && npx vite build` → PASS.

## 1. Scope & deliverables
Operator-driven candidate hiring pipeline over `employer_candidates`, scoped to a single job.
The engine **records and tracks human hiring-workflow decisions** and enforces valid
transitions via a workflow state-machine. It produces **no algorithmic shortlisting,
ranking, or suitability verdict** — statuses are operator-recorded ground truth.

| Deliverable | Artifact |
|---|---|
| `shortlisting_engine` | `backend/services/shortlisting-engine.ts` (v5.9.0) |
| `candidate_pipeline` (table) | current status per (job, candidate) — Status Management |
| `workflow_engine` | in-service FSM (entry/transition/funnel rules) + `workflow_transitions` table (append-only Workflow Tracking) |
| Routes | `backend/routes/shortlisting-engine.ts` — base `/api/shortlisting-engine` |
| Migration | `backend/migrations/20260621_shortlisting_engine.sql` (mirrors lazy ensure-schema) |
| Flag | `shortlisting:false` + `FF_SHORTLISTING` + `isShortlistingEnabled()` |
| Wiring | `routes.ts` import + `registerShortlistingEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin)` |

## 2. Workflow state-machine (workflow_engine)
- **Statuses (7):** review · shortlist · hold · interview · offer · hire · reject.
- **Funnel stage_order:** review 1 · shortlist 2 · interview 3 · offer 4 · hire 5. `hold`/`reject` are off-funnel side states (`stage_order = null`).
- **Entry statuses** (first action when not yet in pipeline): review, shortlist, hold, reject. A candidate **cannot** be interviewed/offered/hired without progressing → `conflict`.
- **Transitions:** review→{shortlist,interview,hold,reject}; shortlist→{interview,hold,reject,review}; hold→{review,shortlist,interview,reject}; interview→{offer,hold,reject,shortlist}; offer→{hire,hold,reject,interview}; hire→{reject} (rescind); reject→{review} (reopen).
- **Same-status set** → `conflict` (no no-op transition recorded). **Unknown status** → `invalid_input`.

## 3. Contract reconciliation
| Invariant | Evidence |
|---|---|
| Additive / flag-gated default OFF | `shortlisting:false`; OFF → every route **503** before auth/DB/DDL (verified live + smoke). |
| compose-never-recompute | Engine reads existing job/candidate substrate and records operator decisions; computes no intelligence/verdict. |
| GET-never-writes | All read ops use `to_regclass` probe + degrade; `pg_class` snapshot before AND after writes → **ZERO** relations created by reads (smoke). DDL only inside `ensurePipelineSchema()` on the POST path. |
| super-admin gated | `gate → requireAuth → requireSuperAdmin` on every route. |
| IDOR strict job-scoping | `candidateInJob` strict equality; cross-job AND unbound (`job_id null`) candidates are **non-actionable → invalid_input** (smoke). |
| never-throws | Every op returns typed `EngineResult`; write path try/caught → `invalid_input` on error. |
| honesty-first | Coverage = pipeline penetration (`in_pipeline / total_candidates`); null denominator stays `null` (never fabricated 0); `provenance = operator_recorded`. |
| developmental-only language | `OPERATOR_DISCLAIMER` on every payload: records human decisions, **NOT** an algorithmic shortlisting/ranking/suitability verdict. |
| append-only history | `workflow_transitions` insert-only; rejected transitions are **not** recorded (A=5 rows for 5 accepted moves; B=3). |
| atomic state + history | `setPipelineStatus` runs the lock→validate→update/insert→history-append inside ONE transaction (`BEGIN`/`COMMIT`/`ROLLBACK`) with `SELECT … FOR UPDATE` on the pipeline row; new-entry races are caught by `ON CONFLICT (job_id,candidate_id) DO NOTHING` → `conflict`. Status can never mutate without its matching transition row. Concurrency smoke: parallel identical entry/transition requests → **exactly one** succeeds, history appends **exactly once** (4 checks). |

## 4. Honesty notes
- **Statuses are operator ground truth, not predictions** → the dual-axis here is Coverage (pipeline penetration) + provenance, not a Confidence/accuracy estimate. The engine never asserts a candidate *should* be shortlisted/hired.
- **Coverage denominator** is the job's `employer_candidates` count; if that table is absent the denominator is `null` (unmeasured), never coerced to 0.
- **`hire` is not a hard-terminal state** — a single rescind edge (`hire→reject`) exists so an operator can correct a mistake; no automated un-hire.

## 5. Activation (when approved)
Set `FF_SHORTLISTING=1` (or `shortlisting:true`) in the Backend API workflow command, restart, and apply `20260621_shortlisting_engine.sql` to any environment lacking the tables (lazy ensure-schema also creates them on first write).

## 6. Verdict
All Phase 5.9 contract invariants satisfied; flag remains OFF pending activation approval. **STOP for approval — no merge/deploy.** Phase 6 NOT built.
