# Phase 5.13 — Employer Dashboards · Reconciliation Audit

**Engine version:** 5.13.0
**Date:** 2026-06-21
**Status:** COMPLETE — smoke 40/40 PASS · vite build PASS · flag-OFF 503 verified
**Contract:** additive · flag-gated (default OFF) · compose-never-recompute · GET-never-writes (PURE READ) · super-admin gated · IDOR employer-scoped · never-throws · honesty-first

---

## 1. Scope

A PURE read/compose layer that assembles **operator-recorded** employer evidence
(`employer_jobs` + `employer_candidates` + the Phase 5.12 workforce engines) into three
role-scoped dashboard payloads across **8 widgets**:

| Widget | Builder | Composition source |
| --- | --- | --- |
| Open Jobs | `buildOpenJobs` | job status map (`normJobStatus`) + applicant counts |
| Applications | `buildApplications` | `canonStage` bucketing of candidate stages |
| Hiring Funnel | `buildHiringFunnel` | stage counts → step conversions + outcomes |
| Talent Pool | `buildTalentPool` | `candidateReadiness` bands + supplied skills |
| Readiness | `buildReadiness` | `candidateReadiness` org composite + Coverage |
| Competency Analytics | `buildCompetencyAnalytics` | `computeTeamCompetencyProfileFromEvidence` |
| Assessment Analytics | `buildAssessmentAnalytics` | `scoreDistribution` over assess/ei/match/rating |
| Hiring Analytics | `buildHiringAnalytics` | hire/selection rates + coverage-gated quality-of-hire |

**Deliverables (dashboard composers):**
- `employer_dashboard` — open_jobs · applications · hiring_funnel · readiness · competency_analytics · assessment_analytics · hiring_analytics
- `recruiter_dashboard` — open_jobs · applications · hiring_funnel · talent_pool
- `talent_dashboard` — talent_pool · readiness · competency_analytics · assessment_analytics
- `overview` — all three from ONE evidence load

---

## 2. Files

| File | Role |
| --- | --- |
| `services/employer-dashboard-shared.ts` | VERSION/DISCLAIMER/PROVENANCE; `FUNNEL_STAGES`/`FUNNEL_ACTIVE`/`TERMINAL_STAGES`; `canonStage` (case-insensitive + synonyms); `normJobStatus`; `DashboardEvidence`; `resolveDashboardEvidence` (composes `resolveWorkforceEvidence` + job-status map + `loadSkillReference`); `scoreDistribution`; `rate` |
| `services/employer-dashboard-engine.ts` | 8 widget builders + 4 `*FromEvidence` composers + 4 pool wrappers (single evidence load) |
| `routes/employer-dashboards.ts` | base `/api/employer-dashboards`; GET-only; `_meta/status` + `/config` literal BEFORE `/employer/:employerId/{employer,recruiter,talent,overview}` |
| `config/feature-flags.ts` | `employerDashboards: false` + `isEmployerDashboardsEnabled()` |
| `routes.ts` | import + `registerEmployerDashboardsRoutes(app, concernsPool, requireAuth, requireSuperAdmin)` |
| `scripts/smoke-employer-dashboards.ts` | 40-assertion seeded smoke (self-cleaning) |

---

## 3. Contract reconciliation

| Contract clause | How satisfied | Evidence |
| --- | --- | --- |
| **Additive** | No edits to 5.12 engines; new files only + 2 single-line wiring inserts. | git diff |
| **Flag-gated, default OFF** | `employerDashboards:false`; `gate` mw returns 503 before any auth/DB touch. | live `503` on `_meta/status`; smoke `flag-OFF: HTTP overview 503` |
| **Compose-never-recompute** | Builders consume `resolveDashboardEvidence` (which wraps `resolveWorkforceEvidence`) + 5.12 `*FromEvidence`. No new scoring formulas beyond folds/rates. | engine imports |
| **GET-never-writes (PURE READ)** | No migration, no `ensure*Schema`, no POST. Reads use `resolveWorkforceEvidence` to_regclass probe + degrade. | smoke `pg_class count unchanged` + `employer row counts unchanged` |
| **Super-admin gated** | `guards = [gate, requireAuth, requireSuperAdmin]` on every route. | routes file |
| **IDOR employer-scoped** | Every read scoped by `employer_id` inside `resolveWorkforceEvidence`; candidate→department resolves ONLY via that employer's jobs (unbound ⇒ null). | smoke: EMP sees 8 cands / 2 jobs, no EMP2 leak; unbound dept null |
| **Never-throws EngineResult** | `compute*` return `EngineResult`; bad/unknown employer ⇒ `not_found` (404), never throws. | smoke `not_found: unknown employer` |
| **Honesty-first** | Coverage axis on every widget; `unmeasured = null` NOT 0 (`scoreDistribution` / `rate` abstain on empty); `provenance: operator_recorded_composite`; disclaimer on every payload. | smoke null-abstention (ei mean over 3 present; C_EMPTY unmeasured); provenance+disclaimer assertion |
| **Language policy** | Developmental/operational signals only — no hiring/promotion/suitability verdicts. Disclaimer states this. | `EMPLOYER_DASHBOARD_DISCLAIMER` |

---

## 4. Honesty axes — worked example (smoke fixture)

EMP fixture: 8 candidates / 2 jobs (1 open + 1 Closed) / 1 unbound (job belongs to EMP2).

- **Open Jobs** — total 2, open 1 (Closed correctly excluded via `normJobStatus`).
- **Applications** — total 8; raw lower-cased stages (`applied`,`interview`,`screening`) bucket correctly to canon (`Applied 3`, `Interview 1`, `Screened 1`, `Offer 1`, `Hired 1`, `Rejected 1`); `unbound_to_job 1`.
- **Hiring Funnel** — Applied conversion `null` (no prior); Screened `33.3` (1/3); Assessment count 0 ⇒ conversion `0`; Offer conversion `null` (prior Assessment empty — abstain, NOT divide-by-zero); outcomes hired 1 / rejected 1 / in_pipeline 6.
- **Readiness** — measured 7 / coverage 87.5% (C_EMPTY abstains); org index 68.1 band moderate.
- **Competency Analytics** — 3 competencies tracked; Communication org mean 76.7 over (80,60,90), coverage 37.5% (3/8 measured).
- **Assessment Analytics** — assessment_score mean 70 / coverage 75% (6/8); ei mean 60 over 3 present (null-abstention, not 0-fill).
- **Hiring Analytics** — hired 1; selection_rate 50% (1 of 2 decided); quality-of-hire computed over HIRED only (mean_match 88, mean_readiness 84.9).
- **Talent Pool** — available_pool 7 (Rejected excluded); available bands high 3 / moderate 3; full distribution surfaces developing 1 (Rejected) + unmeasured 1 (empty); top supplied skills includes JavaScript.

---

## 5. Verification

- **Smoke:** `npx tsx scripts/smoke-employer-dashboards.ts` → **40 passed, 0 failed** (IDOR, funnel abstention, null-abstention, GET-never-writes pg_class + row snapshot, determinism byte-identical, flag-OFF 503).
- **Build:** `cd frontend && npx vite build` → **built in 23.63s** (no errors).
- **Flag-OFF live:** `GET /api/employer-dashboards/_meta/status` → `503 {flag:'employerDashboards'}`.

---

## 6. Honest residuals / non-claims

- Dev substrate is empty by default; all numbers above are from the **self-seeded** `@example.com` fixture, removed on exit.
- Quality-of-hire is computed over the HIRED subset only and abstains (null) when zero hires — never inflated from the broader pool.
- Department resolution is strictly via the employer's own jobs; an unbound candidate is reported with `department: null`, never silently reattributed.
- This layer produces operational/developmental views only — NOT predictions, NOT hiring/promotion/suitability verdicts.
