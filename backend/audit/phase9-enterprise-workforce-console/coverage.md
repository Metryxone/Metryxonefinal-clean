# Phase 9 — Enterprise Workforce Intelligence Console: Coverage Evidence

- Version: `9.0.0`
- Generated: 2026-06-23T20:31:06.783Z
- Org: `demo_org`
- Forecast abstention threshold: `2` points · k-anonymity: `k=30`

Composes the EXISTING predictive-workforce (Phase 5) + M5 enterprise engines. Read-only:
no recompute, no DDL, no writes. Unmeasured → null/abstain, never fabricated 0.

## 1. Overview — view availability

| View | Available | Abstained | Reason |
|------|-----------|-----------|--------|
| skill-gap | true | false | — |
| succession | true | false | — |
| internal-mobility | true | false | — |
| workforce-planning | true | false | — |
| talent-risk | true | false | — |
| talent-forecasting | true | false | — |
| readiness-forecasting | true | false | — |

Summary: 7/7 views available, 0 abstained.

## 2. Per-view coverage + provenance

### skill-gap

- available: `true` · abstained: `false`
- engines: `m5-workforce-intelligence.skillGaps`, `predictive-workforce-engine.listObsolescence`
- tables: `m5_organizational_skill_gaps`, `wos_skill_obsolescence`
- coverage: `{"org_skill_gaps":5,"competency_obsolescence":25}`

### succession

- available: `true` · abstained: `false`
- engines: `m5-succession.{successionSummary,candidates,criticalRoles,benchStrength,leadershipGapRisks}`
- tables: `m5_succession_candidates`, `m5_critical_role_successors`, `m5_bench_strength_scores`, `m5_leadership_gap_risks`
- coverage: `{"candidates":5,"critical_roles":5,"bench_strength":3,"leadership_gap_risks":3}`

### internal-mobility

- available: `true` · abstained: `false`
- engines: `m5-succession.candidates`
- tables: `m5_succession_candidates`
- coverage: `{"mobility_candidates":5}`
- note: No dedicated internal-mobility population exists; mobility readiness is DERIVED from the succession candidates' mobility_alignment dimension (provenance=succession_candidates).

### workforce-planning

- available: `true` · abstained: `false`
- engines: `m5-workforce-simulation.{scenarios,transformationScenarios,futureForecast}`
- tables: `m5_organizational_simulations`, `m5_workforce_transformation_scenarios`, `m5_organizational_capabilities`
- coverage: `{"scenario_library":3,"transformation_scenarios":0,"capability_rows":5}`
- note: Deterministic what-if simulation (predictive-workforce-v2.simulateScenario) requires an explicit headcount/attrition baseline which the platform does not record — it is NOT auto-run here (no fabricated baseline).

### talent-risk

- available: `true` · abstained: `false`
- engines: `predictive-workforce-engine.{listWorkforceRisk,aiExposure}`, `m5-executive-intelligence.strategicRisks`
- tables: `wos_workforce_risk`, `wos_ai_exposure`, `m5_strategic_workforce_risks`
- coverage: `{"workforce_risk":50,"strategic_risks":3,"ai_exposure":25}`

### talent-forecasting

- available: `true` · abstained: `false`
- engines: `predictive-workforce-engine.listEmergingRoles`, `wc3/longitudinal-consumption.{leastSquaresSlope,directionOf}`
- tables: `wos_workforce_risk`, `wos_skill_obsolescence`, `wos_market_signals`, `wos_role_emergence`
- coverage: `{"trends_available":3,"trends_abstained":0,"emerging_roles":6}`
- note: Forecasts are least-squares projections over per-date snapshot averages; any series with < 2 points abstains (no fabricated slope). Emerging roles are a forward indicator, not a trend.

### readiness-forecasting

- available: `true` · abstained: `false`
- engines: `m5-workforce-intelligence.readiness`, `wc3/longitudinal-consumption.{leastSquaresSlope,directionOf}`
- tables: `career_readiness_history`, `m5_department_capability_scores`
- coverage: `{"subject_trends_available":1,"subject_trends_abstained":0}`
- note: Per-subject readiness trends require >= 2 measurable points (else abstain). The cohort-average is k-anonymity suppressed below k=30 distinct subjects.

## 3. Forecast honesty (>=2 points or abstain — no fabricated slope)

- talent-forecasting · workforce_risk: points=2, available=true, abstained=false, direction=stable, slope=0.07, forecast_next=0.66
- talent-forecasting · skill_obsolescence: points=2, available=true, abstained=false, direction=stable, slope=-0.02, forecast_next=0.49
- talent-forecasting · market_signal: points=12, available=true, abstained=false, direction=declining, slope=-7.67, forecast_next=0.23
- readiness-forecasting · distinct_subjects=1, cohort_suppressed=true (k-anonymity: cohort n=1 < k_min=30)
  - subject demo_subj_pm: points=4, available=true, direction=stable, forecast_next=83.5

## 4. k-anonymity (cohort aggregates suppressed below k=30)

- internal-mobility cohort avg mobility_alignment: distinct_people=5, suppressed=true (k-anonymity: cohort n=5 < k_min=30)
- readiness-forecasting cohort latest readiness avg: distinct_subjects=1, suppressed=true (k-anonymity: cohort n=1 < k_min=30)

---
All view outputs above are composed from existing engine reads + read-only snapshot SELECTs.
No rows were written and no DDL was run by this evidence pass.
