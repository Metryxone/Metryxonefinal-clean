# Phase 5.8 — Candidate Comparison Engine · Reconciliation Audit

**Program:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION
**Date:** 2026-06-21
**Status:** Built · flag default OFF · smoke 31/31 · STOP for approval (no merge/deploy)

---

## 1. Scope

A `candidate_comparison_engine` that compares **two or more** `employer_candidates`
rows **for a single job** across **six developmental dimensions** by **composing**
existing read-only engines — nothing is re-scored. Saved views persist to
`comparison_dashboard`; generated reports persist to `comparison_reports`.

> **Output is a developmental comparison only — NEVER a hire / reject / suitability
> verdict.** Every comparison envelope carries the developmental disclaimer.

---

## 2. Deliverables

| Deliverable | Path | State |
|---|---|---|
| Engine service | `backend/services/candidate-comparison-engine.ts` (v5.8.0) | DONE |
| Routes | `backend/routes/candidate-comparison-engine.ts` (`/api/candidate-comparison-engine`) | DONE |
| Migration (canonical DDL) | `backend/migrations/20260621_candidate_comparison.sql` | DONE |
| Flag + accessor | `config/feature-flags.ts` — `candidateComparison:false` · `FF_CANDIDATE_COMPARISON` · `isCandidateComparisonEnabled()` | DONE |
| Wiring | `routes.ts` import + `registerCandidateComparisonEngineRoutes(app, concernsPool, requireAuth, requireSuperAdmin)` | DONE |
| Smoke | `backend/scripts/smoke-candidate-comparison-engine.ts` | DONE — **29/29** |
| Audit | `backend/audit/phase-5.8/01-reconciliation-audit.md` | this file |

---

## 3. Composition map (compose-never-recompute — read-only reuse)

| Dimension | Source | Recompute? | Gate | Absent → |
|---|---|---|---|---|
| Competencies | `employer_candidates.competency_profile` (JSONB) parse → normalized 0–100 | No | `to_regclass` probe only | unmeasured (null) |
| EI | `employer_candidates.ei_score` (canonical inline) | No | read-only | unmeasured (null) |
| Career Readiness | `buildCareerReadiness(pool, subject)` | No | `competencyRuntimeReady()` (DDL-risk) | unmeasured (null) |
| Signals | `buildCareerSignals(pool, subject)` | No | `competencyRuntimeReady()` | unmeasured (null) |
| Strengths | `discoverStrengths(pool, scope)` — CSI `positive_factors` canon | No | pure SELECT | empty (no fabrication) |
| Gaps | `buildCareerGap(pool, subject)` | No | `competencyRuntimeReady()` | unmeasured (null) |

**Subject/scope resolution** — `resolveCandidateSubject(pool, candidate)` →
best-effort `email || capadex_session_id`. The `users` table has **no email
column**, so most employer candidates do **not** resolve to a career-seeker
subject; those subject-keyed dimensions are then **honestly unmeasured** rather
than fabricated. (Confirmed in smoke: readiness / signals / gaps unmeasured for
freshly-seeded employer candidates — `measurable:false`, `score:null`.)

---

## 4. Contract compliance

| Contract clause | How satisfied | Evidence |
|---|---|---|
| **Additive** | New service/route/table/flag only; no existing file behaviour changed beyond import+register+flag append | diff |
| **Flag-gated (default OFF)** | `candidateComparison:false`; route `gate` returns 503 before any auth/DB/DDL touch | HTTP `/_meta/status` + `/compare` → **503** while server flag OFF |
| **Compose-never-recompute** | Each dimension reads an existing engine/column; no re-scoring | §3 |
| **GET-never-writes** | Reads use `relExists` (`to_regclass`) + degrade; DDL only in `ensureComparisonSchema()` on POST write path | `pg_class` snapshot around READ paths created **ZERO** relations |
| **DDL-risky composes gated** | readiness/signals/gaps wrapped behind `competencyRuntimeReady()` | §3; smoke unmeasured-honesty checks |
| **Super-admin gated (IDOR-safe)** | `gate → requireAuth → requireSuperAdmin`; comparison is **strictly job-scoped** (`candidateInJob` = strict `job_id` equality; cross-job AND unbound/null `job_id` are non-comparable), client identity never trusted | cross-job + unbound candidates omitted into `wrong_job[]` |
| **Never-throws** | Every compose wrapped; all entry points return `EngineResult` | engine `ok/err`; smoke harness completed |
| **Honesty-first (dual axes)** | Per-dimension `coverage` + `confidence` objects; `unmeasured=null` not 0 | smoke: every dim dual-axes; unmeasured dims `score===null` |
| **Developmental language only** | Comparison envelope ships `DEVELOPMENTAL_DISCLAIMER` / `language_policy` declaring NOT a hire/suitability verdict | smoke regex `/NOT a hir/i` |
| **STOP for approval** | No merge, no deploy; flag stays OFF | this audit |

---

## 5. API surface (`/api/candidate-comparison-engine`)

| Method | Path | Kind |
|---|---|---|
| GET | `/_meta/status` | meta |
| GET | `/job/:jobId/compare?candidates=A,B` | read-only |
| POST | `/job/:jobId/dashboard` | **write** (ensure-schema) |
| GET | `/job/:jobId/dashboards` | read-only |
| GET | `/dashboard/:dashboardId` | read-only |
| POST | `/job/:jobId/report` | **write** (ensure-schema) |
| GET | `/job/:jobId/reports` | read-only |
| GET | `/report/:reportId` | read-only |

Literal/more-specific sub-paths registered before param routes (`/_meta/status`,
`/job/...` before `/dashboard/:id`, `/report/:id`).

---

## 6. Schema (mirrors lazy `ensureComparisonSchema()` exactly)

- `comparison_dashboard` — `id BIGSERIAL PK`, `employer_id`, `job_id NOT NULL`,
  `name`, `candidate_ids JSONB`, `snapshot JSONB`, `created_by`, `created_at`,
  `updated_at`; index on `job_id`.
- `comparison_reports` — `id BIGSERIAL PK`, `dashboard_id`, `employer_id`,
  `job_id NOT NULL`, `candidate_ids JSONB`, `format`, `report JSONB`,
  `generated_by`, `created_at`; indexes on `job_id`, `dashboard_id`.

BIGSERIAL PKs return as **strings** (pg) — asserted via `Number()` in smoke.

---

## 7. Smoke evidence — `31 passed, 0 failed`

- GET-never-writes: read paths created **0** relations.
- Comparison: 2 candidates, all 6 dims present, competencies + EI measurable with
  correct leaders (A 80 > B 50/60).
- Dual axes on **every** dimension; subject-keyed dims **unmeasured** (null, never 0).
- Developmental language declared.
- Job-scoping (strict): cross-job AND unbound (null `job_id`) candidates omitted
  into `wrong_job[]`; a set with only one bound candidate → `invalid_input`.
- `<2` comparable → `invalid_input`.
- Persistence: dashboard + report write & round-trip (BIGSERIAL string ids).
- HTTP flag-OFF: `/_meta/status` + `/compare` → **503**.

---

## 8. Honest limitations (not defects)

- **Subject-keyed dimensions mostly unmeasured for employer candidates.** No
  `users.email` bridge means readiness/signals/gaps rarely resolve a career-seeker
  subject; reported unmeasured by design (Coverage axis), never fabricated. They
  light up only for candidates whose email/session maps to real career-seeker data.
- **Strengths** surface only from CSI `positive_factors` (canon) — never from
  signal magnitude — so a candidate with no CSI profile shows empty strengths.
- Flag is **OFF** in all environments; activation is an explicit later decision.

---

## 9. Verdict

Phase 5.8 is **structurally complete and honesty-compliant**. The engine composes
six dimensions read-only, reports dual Coverage/Confidence axes per dimension, never
fabricates an unmeasured value, scopes by job (IDOR-safe), and is byte-identical
legacy when the flag is OFF. **STOP for approval — no merge, no deploy.**
