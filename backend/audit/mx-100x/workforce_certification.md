# Section 11 — Workforce & Enterprise Intelligence Certification

**Verdict: PARTIAL (surfaces activated on demo single-org; deep forecasting DORMANT; no outcomes).**

The workforce/enterprise layer (`m5_*` 48 tables, EIOS 8, mobility 11, capability 7) is the broadest
single domain by table count and, per the prior MX-77X work, has activated employer/employee workforce
surfaces. In the live DB it is **single-org demo data**: descriptive workforce tables carry seed rows,
but the **forecasting, simulation-accuracy, succession-readiness, and scenario** tables are empty.

## 11.1 Evidence — activated (seed, 1 org)
| Table | Count | Table | Count |
|---|---:|---|---:|
| m5_succession_candidates | 5 | m5_critical_role_successors | 5 |
| m5_organizational_capabilities | 5 | m5_organizational_skill_gaps | 5 |
| m5_enterprise_capability_indices | 5 | m5_department_capability_scores | 4 |
| m5_executive_recommendations | 3 | m5_organizational_simulations | 3 |
| m5_strategic_workforce_risks | 3 | eios_competency_roles | 6 |

## 11.2 Evidence — DORMANT (empty)
| Table | Count | Table | Count |
|---|---:|---|---:|
| m5_succession_readiness | 0 | m5_workforce_readiness_scores | 0 |
| m5_workforce_transformation_scenarios | 0 | m5_future_capability_forecasts | 0 |
| m5_organizational_forecast_accuracy | 0 | m5_simulation_accuracy_tracking | 0 |
| eios_campaigns / _scenarios / _workforce_plans / _employee_profiles / _outcome_tracking | 0 | mobility_role_mobility_scores / _competency_gaps | 0 |

## 11.3 Descriptive workforce intelligence — PARTIAL (demo)
- Succession candidates, org capabilities, skill gaps, capability indices, and executive
  recommendations are populated for **one org** with seed rows. This proves the descriptive pipeline
  but is not multi-org enterprise activation.

## 11.4 Predictive / forecasting — DORMANT
- Every forward-looking table (future capability forecasts, transformation scenarios, workforce
  readiness scores, succession readiness) is **empty**, and both accuracy-tracking tables are **0** —
  consistent with the Validation Loop (Section 9): **no workforce forecast accuracy is claimed.**
- The back-half forecasting pipeline EXISTS structurally (model_key-seeded constructs, no DDL needed),
  so it is **day-1 reachable** once fed — but it is not fed today.

## 11.5 Mobility — PARTIAL
- `mobility_role_transitions` (8) and `mobility_career_paths` (3) are seeded, but `mobility_role_
  mobility_scores` and `mobility_competency_gaps` are 0 — scoring is reachable but unexercised.

## 11.6 Confidence vs Coverage
- **Coverage:** descriptive workforce surfaces reachable (1 org). **Confidence:** no forecasting, no
  accuracy, single-org seed — directional only.

## 11.7 Certification table
| Sub-area | Verdict | Evidence |
|---|---|---|
| Descriptive workforce (succession, capability, exec recs) | PARTIAL | seed rows, 1 org |
| Predictive workforce (forecasts, scenarios, readiness) | DORMANT | all 0 |
| Forecast accuracy | NONE (correct) | accuracy tables 0 |
| Mobility scoring | PARTIAL | transitions seeded, scores 0 |
| EIOS campaigns | DORMANT | all 0 except competency_roles 6 |

**Net: PARTIAL.** The broadest domain by architecture, demonstrated on single-org demo data, with all
predictive surfaces dormant. Certification requires multi-org activation plus realized workforce
outcomes to feed the forecasting back-half.
