# MX-77X · Section 7 — Workforce Planning Intelligence

**Status:** PARTIAL on demo_org seed.
**View:** `/api/enterprise-workforce/workforce-planning` (`workforcePlanningView`).
**Engine:** `m5-workforce-simulation` (scenarios / transformationScenarios / futureForecast).
**Tables (live):** `m5_organizational_simulations` 3 · `m5_organizational_capabilities` 5 ·
(`m5_workforce_transformation_scenarios` 0 · `m5_future_capability_forecasts` 0 ·
`eios_workforce_plans` 0 · `eios_scenarios` 0).

## Forecast dimensions (task-required)
```
Demand · Supply · Skill · Role · Capability forecasting
```
- **Scenario library** — `m5_organizational_simulations` (3) → demand/supply what-if scenarios.
- **Capability projection** — `futureForecast(org, horizon)` GATED: runs ONLY when ≥1 real
  `m5_organizational_capabilities` row exists (5 present → projection runs). Below that it ABSTAINS
  rather than surfacing the engine's hardcoded-average fallback (no fabricated baseline).

## Outputs
- Scenario library (3), capability projection (active, 5 capability rows, horizon 18m).
- Transformation scenarios **abstain** (0 rows). EIOS workforce-plan tables **abstain** (0 rows).

## Honesty guard
- Deterministic what-if (`predictive-workforce-v2.simulateScenario`) needs an explicit
  headcount/attrition baseline the platform does NOT record → it is NOT auto-run (no fabricated baseline).

## Coverage ⟂ Confidence
- **Coverage:** scenarios + capability projection present; transformation + EIOS plans empty.
- **Confidence:** projection is least-squares over seed capability rows → directional; no
  demand/supply ground truth (headcount) → demand/supply forecasting is structurally reachable but unfed.

## Honest gaps
- True demand/supply forecasting needs a headcount/attrition baseline feed — absent. Disclosed, not faked.
