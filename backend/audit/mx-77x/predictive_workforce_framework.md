# MX-77X · Section 9 — Predictive Workforce Intelligence

**Status:** WORKING (trends) on demo_org seed; accuracy NOT claimed.
**Views:** `/api/enterprise-workforce/talent-risk` + `/talent-forecasting`.
**Engines:** `predictive-workforce-engine` (listWorkforceRisk / aiExposure / listObsolescence /
listEmergingRoles), `m5-executive-intelligence.strategicRisks`, `wc3/longitudinal-consumption` (slope).
**Tables (live):** `wos_workforce_risk` 60 · `wos_ai_exposure` 340 · `wos_skill_obsolescence` 325 ·
`wos_market_signals` 94 · `wos_role_emergence` 6 · `m5_strategic_workforce_risks` 3.

## Prediction dimensions (task-required)
```
Attrition · Promotion · Capability Risk · Leadership Readiness · Succession
```
- **Capability / attrition risk** — `wos_workforce_risk` (60) + strategic risks (3).
- **AI-exposure risk** — `wos_ai_exposure` (340, richest signal).
- **Leadership readiness / succession prediction** — bench + gap risks (Section 5) + readiness trends.
- **Forecasts** — least-squares slope over per-date snapshot averages of workforce_risk /
  obsolescence / market_signal → **3 trends available** (each has ≥2 points); emerging roles (6) as a
  forward indicator.

## MANDATORY separation (Prediction ⟂ Confidence ⟂ Evidence ⟂ Coverage)
| Axis | How it is reported | Today |
|---|---|---|
| **Prediction** | trend direction + `forecast_next` (clamped 0..100) | emitted for 3 trends |
| **Confidence** | abstains < 2 points; slope only when measurable | 3 measurable |
| **Evidence** | provenance.tables + point counts | stamped per view |
| **Coverage** | row counts per signal | risk 60 / ai 340 / obs 325 / market 94 |
- **NO accuracy / hit-rate is claimed** — there are no realized outcomes to validate against
  (the Validation Loop, MX-75X, requires ≥30 realized non-demo outcomes; not met). Fabricating
  accuracy is explicitly forbidden and avoided.

## Coverage ⟂ Confidence
- **Coverage:** high for market-derived signals (risk/ai/obsolescence/market all populated).
- **Confidence:** trends are short (per-date averages, few dates) → directional projections, not
  validated predictions; emerging roles are an indicator, not a trend.

## Honest gaps
- No realized-outcome backtest → predictive *accuracy* is unmeasured (reported as such, never invented).
