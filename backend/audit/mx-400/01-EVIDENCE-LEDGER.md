# MX-400 — Evidence Ledger
Generated 2026-06-26T03:58:51.665Z. All values are first-hand reads. Missing relation/column → `n/a` (never fabricated as 0).

## Live database probes
| Metric | Value | Source |
|---|---|---|
| `users_total` | 4 | live DB SELECT |
| `users_demo` | 3 | live DB SELECT |
| `employer_candidates_total` | 41 | live DB SELECT |
| `employer_candidates_nondemo` | 0 | live DB SELECT |
| `career_seeker_profiles` | 2 | live DB SELECT |
| `capadex_sessions` | 0 | live DB SELECT |
| `capadex_responses` | 0 | live DB SELECT |
| `lbi_sessions` | 0 | live DB SELECT |
| `student_assessment_sessions` | 0 | live DB SELECT |
| `subscription_packages` | 0 | live DB SELECT |
| `capadex_payments_paid` | 0 | live DB SELECT |
| `wc3_outcome_state` | 0 | live DB SELECT |
| `validation_loop_outcomes` | 0 | live DB SELECT |
| `validation_loop_outcomes_real` | 0 | live DB SELECT |
| `onto_competencies` | 422 | live DB SELECT |
| `onto_indicators` | 66 | live DB SELECT |
| `comps_with_indicator` | 13 | live DB SELECT |
| `cqt_total` | 2665 | live DB SELECT |
| `cqt_approved` | 120 | live DB SELECT |
| `total_tables` | 1397 | live DB SELECT |

## Derived metrics
| Metric | Value | Source |
|---|---|---|
| `users_real` | 1 | derived |
| `real_assessment_activity` | 0 | derived |
| `knowledge_coverage_pct` | 3.1 | derived |
| `assessment_approval_pct` | 28.4 | derived |

## Environment / secrets
| Secret | Status |
|---|---|
| `DATABASE_URL` | present |
| `OPENAI_API_KEY` | ABSENT |
| `ZOHO_EMAIL` | ABSENT |
| `ZOHO_APP_PASSWORD` | ABSENT |
| `MONGODB_URI` | ABSENT |

## Build & workflow
- frontend build artifact present: **true** (built 2026-06-26T03:32:26.935Z)
- feature flags enabled in live workflow (.replit): **60**
- FF_WC3_OUTCOME_CROSSWALK enabled: **false**
- database reachable: **true**

## Prior audit deliverables (cited, not trusted as verdicts)
| Audit | Present |
|---|---|
| launch-readiness | present |
| mx-301j | present |
| wc-c10 | present |
| wc-c8b | present |
| mx-301e | present |
