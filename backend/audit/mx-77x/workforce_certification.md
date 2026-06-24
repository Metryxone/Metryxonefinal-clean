# MX-77X · Section 14 — Enterprise Workforce Intelligence Certification

**Verdict: PARTIAL-PASS (honest activation).** The Enterprise Workforce Intelligence stack is
ACTIVATED and SURFACED — not rebuilt. The backend composer + 8 read-only GET routes already
existed (`enterprise-workforce-console` v9.0.0, flag `enterpriseWorkforceConsole`); this phase
proved them live, wired the missing SuperAdmin surface, and certified honestly per REAL evidence.

## Certification method
- Direct service smoke (composer fn-level) + route-layer harness smoke (flag gate) + frontend build.
- All counts are live `COUNT(*)` on the SHARED DB (NOT `pg_stat` `n_live_tup`, a stale estimator
  that falsely reported the stack dormant in the first pass — corrected in Section 1).

## Per-capability certification (REAL activation state, demo_org)
| Capability | View | State | Coverage | Confidence |
|---|---|---|---|---|
| Talent Intelligence Graph | `/api/employer/tig` | **PASS** | 72 nodes / 1680 edges / 40 intel | calibration uncalibrated (<30 outcomes) |
| Skill-Gap | `skill-gap` | **PASS** | org gaps 5 · obsolescence 325 | org-gaps seed; obsolescence market-derived |
| Succession | `succession` | **PASS** | cand 5 · critical 5 · bench 3 · gap-risk 3 | seed, n<30 → bands developmental only |
| Internal Mobility | `mobility` | **PASS (derived)** | 5 derived from succession | derived provenance stamped; n<30 cohort suppressed |
| Workforce Planning | `workforce-planning` | **PARTIAL** | scenarios 3 · capability proj active | transformation/EIOS plans abstain (0) |
| Org Readiness | `readiness-forecasting` | **PARTIAL** | cap indices 5 · subject trend 1 | enterprise roll-up abstains (departments 0) |
| Predictive Workforce | `talent-risk` + `talent-forecasting` | **PASS (no accuracy)** | risk 60 · ai 340 · obs 325 · mkt 94 · 3 trends | direction only; accuracy NOT claimed |
| Capability Intelligence | (composed) | **PARTIAL** | org capability 5 / indices 5 | department decomposition 0 → abstains |

## Honesty invariants verified
- ✅ **Flag-OFF byte-identical** — harness: OFF → 503 before auth/DB on every route (`_meta/status`,
  `overview`, `skill-gap` all 503); ON → 200 honest envelope.
- ✅ **GET never writes** — views are to_regclass-probed; ensure-schema is POST-only (no DDL on GET).
- ✅ **Compose-never-recompute** — every view delegates to an existing engine; no metric re-derived.
- ✅ **null = missing** — enterprise readiness `null` (not 0) when departments absent; coverage `null`
  rendered literally in the panel.
- ✅ **Coverage ⟂ Confidence** — reported on separate axes per view and in the panel.
- ✅ **Prediction ⟂ Confidence ⟂ Evidence ⟂ Coverage** — predictive views emit direction +
  forecast_next, abstain <2 points, stamp provenance, and **claim NO accuracy** (no realized
  outcomes; Validation Loop ≥30 non-demo not met).
- ✅ **k-anonymity k≥30** — cohort statistics suppressed below 30 distinct subjects.
- ✅ **No fabrication** — abstentions (transformation scenarios, EIOS plans, department roll-ups,
  enterprise readiness) reported as honest gaps, never filled with synthetic data.

## What is genuinely DORMANT (0 rows, honestly reported)
`eios_*` (campaigns/scenarios/workforce_plans), `m5_workforce_transformation_scenarios`,
`m5_future_capability_forecasts`, `m5_workforce_readiness_scores`, `m5_succession_readiness`,
`m5_department_capability_scores`, `m5_organizational_capability_maps`. These are structurally
reachable but UNFED — surfaced as "Insufficient Evidence", not activated with fake data.

## Drift from session plan (disclosed)
- **T003** said "new flag + new composer + 8 routes". Building those would DUPLICATE the existing
  `enterpriseWorkforceConsole` composer/routes/flag → a direct violation of the "NO rebuild" mandate.
  **Decision:** activate the existing console; the genuine gap was the absent SuperAdmin surface,
  which this phase built. No parallel composer or flag was created.
- **T004** built the SuperAdmin panel only (Section 10). Employer/Employee UIs (Sections 11–12) are
  documented as design, not built — consistent with the SuperAdmin-activation scope.

## Production safety
- Default flag OFF → zero behavioural change in production until `FF_ENTERPRISE_WORKFORCE_CONSOLE=1`.
- Fully reversible: remove the flag → tab disappears (byte-identical), routes 503.
- STOP before merge/deploy (per user preference — audits/additive phases halt for approval).
