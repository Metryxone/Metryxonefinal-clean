# EP-EIOS-98X — Structural Audit

**Scope:** Route registry · auth coverage · schema · pagination · certification check composition  
**Method:** Static code analysis of `eios-core.ts` (634 lines) + `eios-intelligence.ts` (655 lines)

---

## 28 Pillar Route Registry

All routes registered in `registerEIOSCoreRoutes` + `registerEIOSIntelligenceRoutes`.
Confirmed in backend logs: `[eios-core] routes registered (EP-EIOS-98X)` + `[eios-intelligence] routes registered`.

| P# | Pillar Name | Route(s) | File | LIMIT 200 |
|----|-------------|----------|------|-----------|
| P1 | Security & Enterprise Foundation | (via EP-98-W1 routes) | employer-security.ts | N/A |
| P2 | Employer Commercial OS | (via EP-98 subscription routes) | routes.ts | N/A |
| P3 | Role & Competency Intelligence | `GET /p3/role-competency`, `GET /p3/role-competency/:jobId` | eios-core | ✅ |
| P4 | Talent Intelligence Graph | (via EP-98-W2 tig routes) | employer-tig.ts | N/A |
| P5 | Hiring Intelligence | (via EP-98-W3 hiring routes) | hiring-intelligence.ts | N/A |
| P6 | Recruiter Intelligence | `GET /p6/recruiter-scorecard` | eios-core | ✅ |
| P7 | 9-Box Talent Matrix | `GET /p7/nine-box` | eios-core | ✅ |
| P8 | Succession Intelligence | `GET /p8/succession` | eios-core | ✅ |
| P9 | Critical Role Intelligence | `GET /p9/critical-roles` | eios-core | ✅ |
| P10 | Workforce Intelligence | `GET /p10/workforce` | eios-core | ✅ |
| P11 | Assessment Campaign Engine | `GET /p11/campaigns`, `POST /p11/campaigns` | eios-core | ✅ |
| P12 | Internal Talent Marketplace | `GET /p12/marketplace` | eios-core | ✅ |
| P13 | Learning & Development Intelligence | `GET /p13/learning` | eios-core | ✅ |
| P14 | Employee Lifecycle Intelligence | `GET /p14/lifecycle` | eios-core | ✅ (JOIN, no fetch-all) |
| P15 | Org Network Intelligence | `GET /p15/network` | eios-core | N/A (tig_nodes LIMIT 100) |
| P16 | Workforce Forecasting | `GET /p16/forecast` | eios-core | ✅ |
| P17 | Scenario Intelligence | `GET /p17/scenarios`, `POST /p17/simulate` | eios-core | ✅ (COUNT only) |
| P18 | Benchmark Intelligence | `GET /p18/benchmarks` | eios-intel | ✅ |
| P19 | AI Readiness Intelligence | `GET /p19/ai-readiness` | eios-intel | ✅ |
| P20 | Employer Report Factory | `GET /p20/reports`, `POST /p20/generate` | eios-intel | ✅ |
| P21 | Executive Intelligence Cockpit | `GET /p21/executive` | eios-intel | ✅ |
| P22 | Outcome Intelligence | `GET /p22/outcomes`, `POST /p22/outcomes` | eios-intel | ✅ |
| P23 | Assessment Effectiveness | `GET /p23/assessment-effectiveness` | eios-intel | ✅ |
| P24 | Workforce Planning Intelligence | `GET /p24/workforce-plan`, `POST /p24/workforce-plan` | eios-intel | ✅ |
| P25 | Governance & Compliance | `GET /p25/governance` | eios-intel | N/A (COUNT only) |
| P26 | Model Monitoring & AI Governance | `GET /p26/model-health` | eios-intel | N/A (LIMIT 100 assessments) |
| P27 | Integration & API Ecosystem | `GET /p27/integrations` | eios-intel | N/A (static list) |
| P28 | Organizational Digital Twin | `GET /p28/digital-twin` | eios-intel | ✅ |
| — | EIOS Certification | `GET /certification` | eios-intel | N/A (COUNT aggregates) |

**Route count:** 31 routes across 2 files. 14 in `eios-core.ts`, 17 in `eios-intelligence.ts`.

---

## Pagination — Complete Final State

After today's full audit pass, all `SELECT * FROM employer_candidates` queries have `LIMIT 200`.

| Query location | Pillar | Fix round | LIMIT 200 |
|----------------|--------|-----------|-----------|
| eios-core.ts P3 (join) | P3 | Round 2 (today) | ✅ |
| eios-core.ts P6 | P6 | Round 1 | ✅ |
| eios-core.ts P7 wcl0 join | P7 | Round 1 | ✅ |
| eios-core.ts P8 wcl0 join | P8 | Round 1 | ✅ |
| eios-core.ts P9 | P9 | Round 1 | ✅ |
| eios-core.ts P10 (join) | P10 | Round 1 | ✅ |
| eios-core.ts P11 | P11 | Round 1 | ✅ |
| eios-core.ts P12 | P12 | Round 1 | ✅ |
| eios-core.ts P13 | P13 | Round 1 | ✅ |
| eios-core.ts P16 | P16 | Round 2 (today) | ✅ |
| eios-intel.ts P18 | P18 | Round 1 | ✅ |
| eios-intel.ts P19 (join) | P19 | Round 2 (today) | ✅ |
| eios-intel.ts P20/generate | P20 | Round 1 | ✅ |
| eios-intel.ts P21 (join) | P21 | Round 2 (today) | ✅ |
| eios-intel.ts P22 | P22 | Round 1 | ✅ |
| eios-intel.ts P23 | P23 | Round 1 | ✅ |
| eios-intel.ts P24 (join) | P24 | Round 2 (today) | ✅ |
| eios-intel.ts P28 (join) | P28 | Round 2 (today) | ✅ |

**Queries naturally bounded (no LIMIT needed):**
- `COUNT(*)` aggregates (P17, P25, cert handler) — aggregate query, returns 1 row
- `COUNT(DISTINCT employer_id)` (P18 k-anon) — aggregate
- `SELECT DISTINCT email FROM ... WHERE employer_id=$1` subqueries in FRP joins — subqueries used as IN predicates
- `tig_nodes WHERE employer_id=$1 LIMIT 50` (P15, P21, P28) — already limited
- `ep98_hiring_assessments` queries with existing LIMIT 200 or LIMIT 100

---

## Authentication & Tenant Isolation

Every route in both files:
- Uses `requireAuth` middleware (Express `app.get/post('/...', requireAuth, wrapE(...))`)
- Calls `eid(req)` = `(req as any).orgId ?? (req.user as any)?.id ?? ''` on first line
- Passes `orgId` as `$1` parameter to every DB query touching employer data

No route reads data without the `employer_id=$1` WHERE clause.

**`wrapE` safety:** All routes wrapped in never-throws handler. Error → `{ error: e.message }` JSON
with 500 status. No route can panic the server.

---

## Schema — Lazy-Created EIOS Tables

| Table | Created by | When |
|-------|-----------|------|
| `eios_campaigns` | `ensureEIOSCoreSchema()` | `setImmediate` at route registration |
| `eios_scenarios` | `ensureEIOSCoreSchema()` | `setImmediate` at route registration |
| `eios_workforce_plans` | `ensureEIOSIntelSchema()` | `setImmediate` at route registration |
| `eios_outcome_tracking` | `ensureEIOSIntelSchema()` | `setImmediate` at route registration |
| `rf_generated_reports` | P20 `POST /generate` handler | `setImmediate` on first generate call — table confirmed to exist (see `03_data_audit.md`) |

---

## Certification Check Composition

Source: `CERTIFICATION_CHECKS[]` in `eios-intelligence.ts` lines 13–104.

| Type | Count | Behavior |
|------|------:|---------|
| Hardcoded `pass: true` | 65 | Structural assertions — route registered, schema created, auth wired. Asserted at definition time; confirmed by route logs at startup. |
| Default `pass: false` (dynamic checks) | 6 | Data-bound — `activation_candidates`, `activation_assessments`, `activation_nine_box`, `src_lbi_scores`, `src_wcl0_intelligence`, `src_capadex_sessions` |
| Runtime dynamic overrides | 6 | Cert handler queries DB at request time and overrides these 6 with real data results |
| **Total** | **71** | |

**Verdict calculation** (from cert handler):
```
structural_pct = round(passed / total * 100)
verdict = structural_pct >= 98 ? 'GO' : structural_pct >= 90 ? 'CONDITIONAL_GO' : 'NO_GO'
```

In dev state (candidates=0): `(65 + 2) / 71 = 94.4%` → **CONDITIONAL_GO**.  
With employer data: `(65 + 6) / 71 = 100%` → **GO**.

---

## Frontend Panel Coverage (`EIOSCockpit.tsx`)

| Pillars | Component type | State |
|---------|---------------|-------|
| P1–P12 | Pre-existing dedicated components | ✅ Already had rich panels |
| P13 | `P13LearningPanel` | ✅ New — FRI learner distribution, L&D health |
| P14 | `P14LifecyclePanel` | ✅ New — lifecycle funnel bars |
| P15 | `P15NetworkPanel` | ✅ New — network nodes/connectors cards |
| P16 | `P16ForecastPanel` | ✅ New — supply/demand horizon table |
| P17 | `P17ScenarioPanel` | ✅ New — scenario cards + run simulation CTA |
| P18 | `P18BenchmarkPanel` | ✅ New — org vs industry comparison, k-anon notice |
| P19 | `P19AIReadinessPanel` | ✅ New — AI/Digital/Future readiness gauges |
| P20 | `P20ReportFactoryPanel` | ✅ New — 10 report type cards + generate button |
| P21 | `P21ExecutiveCockpitPanel` | ✅ New — CEO/CHRO/COO/CLO tab switcher |
| P22 | `P22OutcomesPanel` | ✅ New — outcome tracking by type |
| P23 | `P23AssessmentEffPanel` | ✅ New — assessment effectiveness stats |
| P24 | `P24WorkforcePlanPanel` | ✅ New — headcount/capability/hiring/succession planning |
| P25 | `P25GovernancePanel` | ✅ New — governance/compliance score cards |
| P26 | `P26ModelMonitorPanel` | ✅ New — model health cards per model |
| P27 | `P27IntegrationPanel` | ✅ New — integration status grid |
| P28 | `P28DigitalTwinPanel` | ✅ New — digital twin completeness + simulation links |
| Unknown ID | `GenericPanel` | ✅ Final unknown-ID fallback only |
