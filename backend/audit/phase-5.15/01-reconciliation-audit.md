# Phase 5.15 — Super Admin Validation · Reconciliation Audit

**Engine version:** 5.15.0
**Date:** 2026-06-21
**Status:** COMPLETE — smoke ALL PASS · flag-OFF 503 verified · vite build PASS
**Contract:** additive · flag-gated (default OFF) · compose-never-recompute · GET-never-writes (ZERO DDL: `to_regclass` probe + pure SELECT) · super-admin gated · IDOR employer-scoped · never-throws (per-area try/catch → FAIL that area only) · honesty-first (WARN = honest absence, never a fail; FAIL = real invariant break; Coverage vs Confidence separate; null ≠ 0)

---

## 1. Scope

The **employer analog of Phase 4.12** (`super-admin-career-validation-engine`). A super-admin runs
this for **ONE employer subject** to obtain a read-only honesty/invariant report across **fourteen
areas**. It re-reads already-recorded employer/talent data and **composes** the two 0-DDL pure
engines (Notifications 5.14, Workforce 5.12). It performs **no new scoring**, **sends nothing**, and
**writes nothing**. Mirrors the 4.12 three-status model (PASS / WARN / FAIL) exactly.

| # | Area | Scope | Primary source | Representative invariants |
| --- | --- | --- | --- | --- |
| 1 | Employer Setup | subject | `employer_organizations` (+ `employer_company_profiles`) | org exists; `approval_threshold`/`max_sessions` ≥ 0; company-profile Coverage |
| 2 | Organization Setup | platform | `tenants` (+ `employer_organizations`) | `active_users ≤ max_users`; seats ≥ 0; org threshold ≥ 0 |
| 3 | Job Architecture | platform | `role_families` (+ `onto_role_competency_profiles`) | no self-parent; parent resolves; `required_level`/`weight` ≥ 0 |
| 4 | Job Posting | subject | `employer_jobs` (+ `job_distributions`) | status ∈ `JOB_STATUS`; `salary_min ≤ salary_max`; counts ≥ 0; distributions resolve; channel ∈ `CHANNELS` (catalog WARN) |
| 5 | Talent Search | platform | `talent_pools` / `talent_shortlists` / `talent_saved_searches` | members resolve to their pool/shortlist |
| 6 | Matching | subject | `employer_candidates.match_score` | `match_score`/`ei_score` ∈ [0,100]; match Coverage; requirement-backing Confidence |
| 7 | Assessments | subject | `employer_candidates.assessment_*` | `assessment_score` ∈ [0,100]; a score implies sent |
| 8 | Shortlisting | subject | `candidate_pipeline` (+ `workflow_transitions`) | status ∈ `PIPELINE_STATUSES`; `stage_order` ≥ 0; **transitions resolve** to a pipeline entry; transition states canonical |
| 9 | Interviewing | subject | `interview_schedules` / `_scores` / `_decisions` | status ∈ `INTERVIEW_STATUSES`; mode ∈ `INTERVIEW_MODES`; **score ∈ [0,max_score]**; decision ∈ `DECISION_TYPES` |
| 10 | Hiring | subject | `employer_offers` (+ `interview_decisions`) | CTC components ≥ 0; `total_ctc ≥ ctc_fixed` (WARN); hire decisions Coverage |
| 11 | Workforce Intelligence | subject | **COMPOSE** `computeTalentDistribution` / `computeDepartmentReadiness` (5.12) | composed engines return well-formed `EngineResult` |
| 12 | Notifications | subject | **COMPOSE** `computeNotifications` / `WorkflowNotifications` / `Communications` (5.14) | well-formed results; **never delivered**; **no candidate PII** in previews |
| 13 | Permissions | platform | `wos_roles` / `role_definitions` (+ assignments/permissions) | assignments & permissions resolve; expiry after grant (WARN) |
| 14 | Audit Logs | platform + subject | `platform_audit_log` / `admin_audit_logs` / `capadex_audit_events` / `employer_audit_logs` | every audit row timestamped; `risk_score` ∈ [0,100]; subject-scoped Coverage |

---

## 2. Files

| File | Role |
| --- | --- |
| `services/super-admin-employer-validation-engine.ts` | `VERSION 5.15.0`; 4.12 result types (`ValidationStatus`/`Check`/`Area` + `EmployerValidationResult` + summary); helpers `worst`/`check`/`area`/`failArea`/`notProvisionedArea`/`tableExists`(to_regclass)/`num`; `runArea` wrapper; 14 area fns; `runSuperAdminEmployerValidation` + `employerValidationCatalog()`. Imports canonical enums `JOB_STATUS`/`CHANNELS`/`PIPELINE_STATUSES`/`INTERVIEW_STATUSES`/`INTERVIEW_MODES`/`DECISION_TYPES` (const-only) + composes the two pure engines |
| `routes/employer-validation.ts` | base `/api/employer-validation`; GET-only; flag-gate FIRST (503); `requireAuth`+`requireSuperAdmin`; literal `_meta/status` + `/catalog` BEFORE `/:employerId`; `wrap()` 500-safe |
| `config/feature-flags.ts` | `employerValidation: false` + `isEmployerValidationEnabled()` |
| `routes.ts` | import + `registerEmployerValidationRoutes(app, concernsPool, requireAuth, requireSuperAdmin)` (after career-validation) |
| `scripts/smoke-employer-validation-engine.ts` | seeded GOOD/BAD/unknown `@example.com` smoke (self-cleaning) |

---

## 3. Contract reconciliation

| Contract clause | How satisfied | Evidence |
| --- | --- | --- |
| **Additive** | New files only + 2 single-line wiring inserts + 1 flag + 1 helper. No edits to 5.12/5.14 engines. | git diff |
| **Flag-gated, default OFF** | `employerValidation:false`; `gate` returns 503 before any auth/DB touch. | live `503` on `_meta/status`, `/catalog`, `/:employerId`; smoke `flag-OFF 503` |
| **Compose-never-recompute** | Areas re-read existing columns + compose `computeTalentDistribution`/`DepartmentReadiness` (5.12) and `computeNotifications`/`WorkflowNotifications`/`Communications` (5.14). No new scoring. | engine imports |
| **GET-never-writes (ZERO DDL)** | Every table probed by `to_regclass` before read (absent ⇒ WARN, no read); only 0-DDL pure engines composed; DDL-bearing engines (job-posting/discovery/shortlisting/interview/assessment) provide **enum CONSTS only**, never their read fns. | smoke `pg_class count unchanged (1292→1292)` + `no row counts changed` |
| **Super-admin gated** | `guards = [gate, requireAuth, requireSuperAdmin]` on every route. | routes file |
| **IDOR employer-scoped** | Subject = operator-supplied `employerId`; every subject read scoped by `employer_id` (org by `id`, audit by `org_id`). | engine queries |
| **Never-throws** | Each area in its own try/catch via `runArea`; a thrown probe/engine error ⇒ `failArea` (FAIL for THAT area only); orchestrator returns `ok:true`. | smoke `orchestrator never throws (ok=true even with FAILs)` |
| **Honesty-first** | WARN = honest absence / not measurable (absent table, no subject rows); FAIL = real break (out-of-bounds score, orphan FK, score>max). Coverage (data exists) and Confidence (requirement backing) reported separately. `measurable` flag distinct from status. null ≠ 0 (e.g. match Coverage states "null is not 0"). Disclaimer on every payload. | smoke honesty + measurable assertions |
| **Determinism** | Same DB state ⇒ byte-identical output sans `generated_at`. | smoke `two GOOD runs byte-identical` |

---

## 4. Honesty axes — worked example (smoke fixture)

Three subjects, all `@example.com`, removed on exit:

- **GOOD** (`smoke515-good-org`) — clean org + company profile + 1 published job (coherent salary band) + 1 candidate (match 82, ei 75, assessment sent+scored 68) + pipeline with a **resolving** transition + interview schedule with an **in-bounds** score (7/10) + hire decision + sent offer + audit row.
  → **14 areas, ZERO failing areas**; subject areas measurable; matching/interviewing/shortlisting invariants PASS; notifications composed with **all previews `delivered:false`** and **no candidate email** leaked.
- **BAD** (`smoke515-bad-org`) — three injected violations:
  - `match_score = 150` ⇒ **Matching `match_score_bounds` FAIL** (out-of-bounds, fabricated).
  - `workflow_transitions.pipeline_id = -999999` ⇒ **Shortlisting `transitions_resolve` FAIL** (orphan FK).
  - `interview_scores.score = 99 > max_score = 10` ⇒ **Interviewing `scores_within_max` FAIL**.
  → `summary.fail = 3`; orchestrator still `ok:true` (never-throws).
- **UNKNOWN** (`smoke515-does-not-exist`) — all **subject** areas `measurable:false`; **ZERO** data-integrity FAILs (honest absence is WARN, never a failure).

GET-never-writes verified by a `pg_class` table-count + per-table row-count snapshot taken before/after
running all three subjects twice: **no tables created, no row counts changed**.

---

## 5. Verification

- **Smoke:** `cd backend && npx tsx scripts/smoke-employer-validation-engine.ts` → **ALL PASS** (14 areas present, GOOD no-fail, BAD three specific FAILs, unknown-subject honest absence, never-throws, determinism, GET-never-writes pg_class + row snapshot, notifications never-sends + no PII, flag-OFF 503).
- **Build:** `cd frontend && npx vite build` → PASS.
- **Flag-OFF live:** `GET /api/employer-validation/_meta/status` · `/catalog` · `/:employerId` → `503 {ok:false, error:'feature_disabled', flag:'employerValidation'}` before any DB touch.

---

## 6. Honest residuals / non-claims

- Dev substrate is sparse; all numbers above are from the **self-seeded** `@example.com` fixture, removed on exit (even on failure).
- Areas whose tables are absent in this environment (`talent_role_families`, `onto_role_profiles`, `hiring_assessment_*`, dedicated `interviews`) degrade to **WARN** via `to_regclass` — an honest absence, never a failure. Assessment state is read from `employer_candidates` with a disclosing note.
- This layer **re-reads** operator-recorded data and **composes** existing read-only engines; it introduces no new persisted state, no scoring model, and **sends nothing** (composed communication previews are `delivered:false`).
- `measurable` (Coverage: does subject data exist) is reported independently of `status` (Confidence: is what exists valid). A WARN area can be perfectly valid yet simply unprovisioned for the subject.
- Outputs are honesty/invariant diagnostics for a super-admin — NOT predictions, NOT hiring/promotion/suitability verdicts.
