# MX-103X — Live Employer Ecosystem Activation · Founder Report

_Generated 2026-06-24T12:02:39.687Z · engine vmx-103x-1.0.0 · k_min=30_

## Verdict: **PARTIAL**

- 4 stage(s) exercisable on DEMO data only — no real (non-demo) rows yet.
- Outcome confidence abstains: fewer than k_min=30 realized non-demo outcomes, so calibration is not trusted.

## Funnel rollup

| Metric | Value |
|--------|------:|
| Funnel stages | 9 |
| Operational (real data) | 2 |
| Demo-only (exercisable, no real rows) | 4 |
| Gated (flag OFF → 503) | 0 |
| Gap (substrate missing) | 0 |
| Empty (reachable, no rows) | 3 |
| Coverage reachable (axis 1) | 9 / 9 |
| Stages with real data (axis 2) | 2 / 9 |
| Outcome confidence calibrated | no (abstained) |

> **Coverage ⟂ Confidence**: a stage can be fully reachable (Coverage) while its data is demo-only
> (Confidence abstains). High coverage with demo-only confidence is the honest pre-launch state —
> never inflated to OPERATIONAL until real non-demo outcomes accrue and calibration trusts them.

## Success-criteria certification (8 stages)

| # | Stage | Criterion | Status |
|---|-------|-----------|:------:|
| 1 | Employer Onboarding | An employer org can be created/verified and members attached. | **empty** |
| 2 | Create Job | A job/requisition can be created with role, skills and requirements. | **demo_only** |
| 3 | Role DNA | A role resolves to a competency requirement profile (Role DNA). | **operational** |
| 4 | Competencies | The competency genome is queryable and joins to roles + candidates. | **operational** |
| 5 | Assessment | A candidate can be invited to and complete a hiring assessment that scores them. | **demo_only** |
| 6 | Candidate Match | Candidates are ranked against a job via competency + behaviour match. | **demo_only** |
| 7 | Interview Intelligence | An interview blueprint/scorecard is generated and interviews can be recorded. | **empty** |
| 8 | Hiring Decision | A decision-support hiring recommendation is produced and a Hired/Rejected outcome can be recorded. | **demo_only** |
| 9 | Outcome Tracking | Realized hire/perf outcomes are captured and feed calibration (≥30 → calibrated confidence). | **empty** |

## Demo transparency

Demo rows are sourced from the @example.com candidate seed (and validation_loop_outcomes.is_demo). They are exercisable substrate proving the path runs, but are EXCLUDED from the real-data / confidence axis and from calibration. All scores are computed by the real hiring + calibration engines, never fabricated.

---

**Honesty contract**: read-only composition; Coverage and Confidence are separate axes; demo rows
are excluded from the real-data / calibration axis; absent substrate degrades to null (never 0);
outcome confidence ABSTAINS until ≥ 30 realized non-demo outcomes. PARTIAL is the honest
state pre-deployment, not a defect — and never inflated to look complete.