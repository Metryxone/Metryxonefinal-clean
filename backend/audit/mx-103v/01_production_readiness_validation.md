# MX-103V — Employer Ecosystem · Production-Readiness Validation

_Validation date 2026-06-24 · evidence: `scripts/mx103x-smoke.ts` (E2E) + `services/employer-ecosystem-audit-engine.ts` (audit, k_min=30) · read-only · no deploy_

> **This is a validation, not a build.** Nothing in the funnel was changed. Every figure below is
> measured live: the journey is driven through the REAL stage handlers, and per-stage status comes
> from the read-only audit engine. **Coverage** (the stage is exercisable end-to-end) and
> **Confidence** (the data behind it is real + calibrated) are reported as SEPARATE axes and never
> composited. Demo rows (`@example.com` / `validation_loop_outcomes.is_demo`) are excluded from the
> Confidence axis. No figure is inflated; PARTIAL is the honest pre-launch state.

---

## Section 1 — End-to-End Employer Journey (executed)

One employer was walked through the complete 9-stage funnel via each stage's real API
(`mx103x-smoke.ts`, throwaway app, demo-marked + purged). **All 19 assertions PASS**, including the
byte-identical-OFF (503) gate. Every step below is a real handler response, not a mock.

| Step | Stage | Real route exercised | Result |
|------|-------|----------------------|:------:|
| 1 | Employer Onboarding | `POST /api/admin/employers` | ✅ org created (200, orgId returned) |
| 2 | Create Job | `POST /api/job-posting-engine/jobs` | ✅ job created (201) |
| 3 | Role DNA | `POST /api/v2/role-dna/resolve` | ✅ competency profile resolved (200) |
| 4 | Competencies | `GET /api/ontology/curated/competencies` | ✅ genome reachable (200) |
| 5 | Assessment | `POST /api/hiring-assessment-engine/invites` | ✅ invite handler reached (200) |
| 6 | Candidate Match | `GET /api/talent-matching-engine/role/role_be_eng/candidates` | ✅ ranked against a real Role-DNA role (200) |
| 7 | Interview | `POST /api/interview-intelligence/.../interviews` | ✅ interview scheduled (200) |
| 8 | Hiring Decision | `POST /api/interview-intelligence/.../decisions` | ✅ `hire` decision recorded, IDOR-checked (200) |
| 9 | Outcome Tracking | `POST /api/validation-loop/outcomes` | ✅ recorded `is_demo:true` (200) |

**OFF-path**: with the gating flags absent, the governance routes AND representative stage gates
(`job-posting`, `validation-loop`) return **503** — byte-identical to legacy.

- **Journey coverage: 9/9 (100%)** — every stage reachable end-to-end.
- **Broken links: 0 · Missing dependencies: 0.**
- **Manual workaround: 1 (documented, not papered over)** — see "Job-store split" below. This is the
  one honest blemish against the "0 manual workarounds" success criterion.

### Honest finding — the funnel's job-store is SPLIT
`POST /api/job-posting-engine/jobs` writes the `job_postings` table, but the downstream assessment +
interview engines resolve jobs from a DIFFERENT table, `employer_jobs` (TEXT id, owned by
`recruiter-postings`). A job created via the posting engine is therefore INVISIBLE to assessment/
interview (`readJob` → 404). The E2E smoke bridges this by inserting the demo job into `employer_jobs`
under the same demo org — which is exactly why this is a **wiring gap**, surfaced and reported, never
counted as activated. Production launch requires unifying the two job stores (or a write-through
bridge) so a real posted job flows to assessment/interview without manual intervention.

---

## Section 2 — Role DNA Validation

| Check | Evidence | Verdict |
|-------|----------|:-------:|
| Role resolution | `POST /api/v2/role-dna/resolve` returns a profile (200) | ✅ operational |
| Role benchmarks / DNA profiles | `onto_role_competency_profiles` — `role_be_eng` carries a real profile; match ran against it | ✅ real |
| Role competencies | `map_role_competency` = **52,362** role→competency links across **1,021** roles | ✅ real (reference data) |
| Crosswalk coverage | `onto_roles` present; the demo free-text role title has NO persisted profile so match used a real curated role id | ⚠️ partial — see note |

**Status: OPERATIONAL (real data).** Role DNA is one of only two stages backed by real, non-demo data.
**Honest ceiling:** a job's free-text role title does not auto-resolve to a Role-DNA profile; matching
requires a role that exists in `onto_role_competency_profiles`. Closing this needs a title→curated-role
crosswalk at job-creation time (today the smoke selects a real role id explicitly).

---

## Section 3 — Assessment Validation

| Check | Evidence | Verdict |
|-------|----------|:-------:|
| Assessment generation | `ep98_hiring_assessments` = 40 stored blueprints (all demo) | ⚠️ demo_only |
| Question selection / difficulty | engine reachable behind `hiringAssessment`; invite handler returns 200 | ✅ exercisable |
| Competency coverage | composes the 419-competency genome (Section 4) | ✅ backing present |
| Adaptive logic | gated by `hiringAssessment`; exercised, no real completions | ⚠️ demo_only |
| Real invites | `assessment_invites` real = **0** (demo = 40) | ❌ no real data |

**Status: DEMO-ONLY (exercisable, Confidence abstains).** The generation/scoring path runs, but no real
candidate has completed a hiring assessment. Confidence cannot rise until real (non-demo) invites are
issued and scored.

---

## Section 4 — Matching Validation

| Check | Evidence | Verdict |
|-------|----------|:-------:|
| Candidate match | `GET /api/talent-matching-engine/role/:roleId/candidates` → 200 against `role_be_eng` | ✅ exercisable |
| Competency match | `employerCompetencyHiring` engine composes `computeCompetencyDrivenMatch` (decision-SUPPORT only) | ✅ present |
| Role match / gap analysis | ranked against a real Role-DNA profile; gap derived from competency profile | ✅ mechanism real |
| Hiring recommendation | advisory only — never a hire/no-hire verdict | ✅ by design |
| Real candidates | `employer_candidates` real = **0** (demo = 40); `tig_intelligence` = 40 (demo) | ❌ no real data |

**Status: DEMO-ONLY.** The ranking engine works and is competency-grounded, but every candidate row is
demo. k≥30 Role-DNA benchmark fails CLOSED on an unknown cohort (by design — never fabricates a
benchmark). Real adoption is the only lever.

---

## Section 5 — Outcome Validation

| Check | Evidence | Verdict |
|-------|----------|:-------:|
| Hire outcome recording | `POST /api/validation-loop/outcomes` (`hiring`) → 200, recorded `is_demo:true` | ✅ exercisable |
| Performance / promotion / retention | same intake supports these `outcome_type`s; none realized | ⚠️ exercisable, unrealized |
| Realized non-demo outcomes | `validation_loop_outcomes` real = **0** | ❌ none |
| Calibration | `tig_calibration` cold_start; **abstains** (< k_min=30 real outcomes) | ⚠️ honest abstain |

**Status: EMPTY / ABSTAINING.** The intake path works; calibration correctly REFUSES to claim trust
until ≥30 realized non-demo outcomes accrue. This is the keystone gap — and it can only be filled by
real-world hiring outcomes over time, never seeded.

---

## Section 6 — Super-Admin Dashboard Validation

| Spec dashboard | Surfacing reality | Verdict |
|----------------|-------------------|:-------:|
| Audit Dashboard | `EmployerEcosystemPanel` (nav `employer-ecosystem`) — per-stage status + Coverage⟂Confidence + cert verdict; probe-gated on `/api/admin/employer-ecosystem/enabled`, hidden when OFF | ✅ present |
| Outcome Dashboard | `OutcomeIntelligencePanel` (nav `outcome-intelligence`) + `OutcomeValidationPanel`; probe-gated on `/api/outcome-intelligence/enabled` | ✅ present |
| Calibration Dashboard | surfaced via validation-loop status + outcome panels (calibration abstains, shown honestly) | ✅ present (abstaining) |
| Employer Dashboard | employer-scoped panels: `CompetencyHiringPanel`, `TalentIntelligenceGraphPanel`, `HiringValidationPanel`, `EIOSCockpit` | ⚠️ employer-portal, not a unified super-admin view |
| Job Dashboard | no dedicated single super-admin "Job" console — jobs visible via the audit panel's Create-Job stage + employer portal | ⚠️ gap (covered indirectly) |
| Assessment Dashboard | no dedicated super-admin "Assessment" console — surfaced via the audit panel's Assessment stage + employer portal | ⚠️ gap (covered indirectly) |

**Status: PARTIAL.** The validation/audit/outcome super-admin surfaces exist and are correctly flag-
gated (byte-identical hidden when OFF). There is no single consolidated super-admin "Job" or
"Assessment" operational dashboard — those funnel stages are observable through the unified
EmployerEcosystemPanel audit and through employer-scoped portal panels, not a dedicated admin console.
Honest note, not a blocker for the funnel's correctness.

---

## Success-Criteria Scorecard

| Criterion | Result |
|-----------|:------:|
| 100% Journey Coverage | ✅ 9/9 stages reachable end-to-end |
| 100% Feature Coverage | ✅ all subsystems present & exercisable |
| 0 Broken Links | ✅ |
| 0 Missing Dependencies | ✅ all required tables present |
| 0 Manual Workarounds | ❌ **1** — job-store split (`job_postings` ⟂ `employer_jobs`) bridged in E2E |
| Documented Production Readiness | ✅ this document + `mx-103x/01,02` |
| Honest Calibration Status | ✅ abstains < k_min=30 (never inflated) |
| No Artificial Confidence Claims | ✅ Coverage⟂Confidence kept separate; demo excluded |
