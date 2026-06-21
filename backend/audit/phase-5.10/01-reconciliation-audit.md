# Phase 5.10 — Interview Intelligence · Reconciliation Audit

**Program:** MX-COMPETENCY-FRAMEWORK-TRANSFORMATION
**Scope:** Operator-driven interview management over `employer_jobs` / `employer_candidates` for a job.
**Status:** Built · flag default-OFF · smoke 70/70 · STOP for approval (no merge/deploy).

---

## 1. What shipped

Three additive, flag-gated engines + one routes file, all behind `interviewIntelligence`
(`FF_INTERVIEW_INTELLIGENCE`, default OFF):

| Engine (service) | Capabilities | Tables (write-path only) |
|---|---|---|
| `interview-engine.ts` | Interview Scheduling · interview lifecycle FSM · Decision Tracking | `interview_schedules`, `interview_decisions` |
| `interview-feedback-engine.ts` | Interview Feedback (upsert) · Panel Reviews (compose) | `interview_feedback` |
| `evaluation-engine.ts` | Interview Scoring (upsert) · Interview Evaluation (compose) | `interview_scores` |

Routes: `backend/routes/interview-intelligence.ts`, base `/api/interview-intelligence`.
Migration: `backend/migrations/20260621_interview_intelligence.sql` (mirrors the three lazy ensure-schemas).
Wiring: `feature-flags.ts` (`interviewIntelligence:false` + `isInterviewIntelligenceEnabled()`),
`routes.ts` (import + `registerInterviewIntelligenceRoutes(app, concernsPool, requireAuth, requireSuperAdmin)`).

---

## 2. Contract reconciliation (program invariants)

| Invariant | How it is honoured | Evidence |
|---|---|---|
| **Additive** | New files + 2 new flag exports + 2 routes.ts lines; zero edits to existing handlers. | git diff |
| **Flag-gated default OFF** | `interviewIntelligence:false`; `gate` returns 503 BEFORE auth/DB/DDL. | smoke HTTP 503 ×3 |
| **compose-never-recompute** | Panel review / evaluation are deterministic FOLDS of operator inputs (distribution, modal, per-criterion mean, overall mean). No model, no verdict. | `panelReview`, `evaluationSummary`, `candidateEvaluation` |
| **operator-recorded provenance NEVER algorithmic verdict** | Every write + aggregate carries the disclaimer; aggregates stamp `provenance:'operator_recorded'`; modal is "most-entered", tie ⇒ null. | smoke "NOT a verdict" + tie⇒null checks |
| **GET-never-writes** | All reads use a `to_regclass` probe + degrade; ensure-schema only on POST paths. | smoke `pg_class` snapshot = ZERO new relations, before AND after writes |
| **super-admin gated** | `gate → requireAuth → requireSuperAdmin` on every route. | routes file |
| **IDOR strict job-scoping** | `candidateInJob` STRICT equality (null `job_id` non-actionable); feedback/scores scoped to a valid interview via `readInterview`; decisions citing another candidate's interview refused. | smoke cross-job/unbound/cross-interview rejects |
| **never-throws** | Typed `EngineResult`; not_found→404, conflict→409, invalid_input→400; all DB reads wrapped. | smoke negative paths |
| **honesty-first** | Coverage = candidates_interviewed / job candidate pool; unmeasured denom ⇒ `null` (not 0); panel coverage null when panel size unknown. | `interviewSummary`, `panelReview` |

---

## 3. Lifecycle FSM (interview)

`scheduled` (entry) → `completed`* / `cancelled`* / `no_show` / `rescheduled`;
`no_show` → `rescheduled`; `rescheduled` → `scheduled`/`completed`/`cancelled`/`no_show`.
(*) terminal. Same-status is a conflict, not a transition. `updateInterviewStatus` is the only
atomic op (`BEGIN` + `SELECT … FOR UPDATE` + validate + `UPDATE` + `COMMIT`), so concurrent
status changes from the same prior state serialize — verified by the 3-way race (exactly one wins).

Schedule / decision are plain inserts; feedback / scores are DB-atomic `ON CONFLICT` upserts
(UNIQUE `interview_id+panelist` and `interview_id+panelist+criterion`).

---

## 4. Coverage / honesty axes

- **Interview Coverage** = distinct candidates with ≥1 interview / job's candidate pool;
  pool absent ⇒ `coverage_pct = null`.
- **Panel Coverage** = panelists who submitted / recorded panel size; recorded size unknown ⇒ `null`.
- **Evaluation** = arithmetic mean of per-criterion normalized scores (score/max×100); no scores ⇒
  `overall_mean_pct = null`, empty `criteria[]`.
- **Modal recommendation** describes the panel's most-entered value; a tie ⇒ `null` (no synthesized consensus).

None of these are predictions. All are folds of operator ground truth.

---

## 5. Verification

- **Smoke:** `backend/scripts/smoke-interview-intelligence.ts` — **70/70 PASS** over a real
  `@example.com` substrate (self-cleaning). Covers FSM purity, GET-never-writes (`pg_class`
  snapshot before & after writes), scheduling + bad-mode/IDOR rejects, lifecycle conflicts,
  atomic concurrency, decision append-only + interview-scope IDOR, feedback upsert + panel
  review (tie⇒null, coverage), scoring range-guard + upsert, evaluation math, candidate eval
  across interviews, summary, and HTTP flag-OFF 503 ×3.
- **Flag-OFF byte-identical:** server runs WITHOUT `FF_INTERVIEW_INTELLIGENCE`; every route 503;
  no tables created (smoke confirms zero relations created by reads).

---

## 6. Residual / honest gaps

- Tables are unpopulated until the first POST under flag-ON (by design; no backfill — this is a
  net-new operator surface, no legacy rows to migrate).
- No frontend surface in this phase (backend + routes only), consistent with 5.8/5.9.
- `total_candidates` counts the job's `employer_candidates` rows; if a job has none, coverage is
  honestly `null` rather than a fabricated 0/0=0.

**Decision:** STOP for approval. No merge, no deploy.
