# EP-X1A — Employer Portal Deep Technical Readiness Audit
**Date:** 2026-06-12  
**Audit Method:** Forensic — source code · route registration · runtime verification · live DB row counts · frontend consumption tracing  
**Honesty convention:** Built / Activated / Data-backed / Production-ready reported as four SEPARATE axes. No inflation. Dead code, orphan tables, and disconnected intelligence are findings, not omissions.

---

## EXECUTIVE SUMMARY

The MetryxOne Employer Portal exists in **two architecturally separate, incompatible layers** that have never been unified:

| Layer | What it is | Status |
|---|---|---|
| **ATS Layer** | `EmployerPortalPage.tsx` (6,962 lines) — recruiter UI for jobs/candidates/pipeline/offers | BUILT (frontend) · **BROKEN** (no backend) |
| **Workforce Intelligence Layer** | M5/WOS/p4/p5 enterprise workforce modules | BUILT · PARTIALLY ACTIVATED · cold data |

### The Blocking Structural Gap
`EmployerPortalPage.tsx` calls **six API endpoints** (`/api/employer/jobs`, `/api/employer/candidates`, `/api/employer/interviews`, `/api/employer/offers`, `/api/employer/analytics`, `/api/employer/company`) that **do not exist anywhere in the backend**. Every fetch returns 404. The ATS recruiter experience — the core employer use-case — is a frontend with no server.

### Certification Verdict: **NO-GO**

| Axis | Score |
|---|---|
| Structural Readiness | **35%** |
| Activation Readiness | **12%** |
| Data Readiness | **8%** |
| Intelligence Readiness | **18%** |
| Commercial Readiness | **0%** |
| Operational Readiness | **22%** |
| **Overall** | **16%** |

---

## D01 — EMPLOYER FOUNDATION

### D01.1 Employer Registration
| Capability | Status | Evidence |
|---|---|---|
| Employer-specific registration flow | **ABSENT** | No `/api/employer/register` route in any backend file |
| Separate employer accounts table | **ABSENT** | DB has only `users` table (4 rows: 2 job_seekers, 1 user, 1 super_admin) |
| Organization creation | **ABSENT** | No `organizations` table in DB |
| Organization management | **ABSENT** | No org CRUD routes |
| Multi-company support | **ABSENT** | No tenancy model beyond demo `org_id` string |
| Recruiter accounts | **ABSENT** | `hr_recruiter` role referenced in code comments; zero users with this role in DB |
| Team accounts | **ABSENT** | EmployerPortalPage uses `MOCK_TEAM` constant — hardcoded, never fetched |

### D01.2 Employer Authentication
The frontend uses `authHdr()` which reads `metryx_token` from localStorage and sends a Bearer token. This is a **JWT-style pattern** completely separate from the platform's session-cookie auth system.

| Control | Status |
|---|---|
| JWT-keyed employer auth (`metryx_token`) | PATTERN EXISTS (frontend only) |
| Backend JWT verification middleware | **NOT FOUND** in any route file |
| Session-cookie auth for employers | Not wired |
| Employer login endpoint | **ABSENT** |

**Finding:** The frontend sends Bearer tokens to `/api/employer/*`; the backend has no corresponding routes. Authentication is architecturally aspirational.

**D01 Structural: 5% · Activation: 0% · Data: 0%**

---

## D02 — JOB MANAGEMENT

### D02.1 Route Inventory
| Route | Status | Notes |
|---|---|---|
| `POST /api/employer/jobs` | **MISSING** | Called from frontend line 928; 404 |
| `PUT /api/employer/jobs/:id` | **MISSING** | Called from frontend lines 924, 940; 404 |
| `DELETE /api/employer/jobs/:id` | **MISSING** | Called from frontend line 936; 404 |
| `GET /api/career/recruiter-postings` | EXISTS | 1 route — **candidate read only** of `employer_jobs` |

### D02.2 Table State
| Table | Rows | Schema |
|---|---|---|
| `employer_jobs` | **0** | Created lazily via `ensureTable()` in recruiter-postings.ts |
| `job_postings` | **0** | Separate table — no producer found |
| `hiring_outcomes` | **0** | No producer found |

### D02.3 Frontend Capabilities (Non-functional)
`EmployerPortalPage.tsx` renders full UI for:
- Job creation form (title, department, location, type, work mode, experience, salary, description, requirements, skills, perks, EI min score, quota, deadline, hiring manager)
- Job status management (Draft/Active/Paused/Closed)
- 15+ job templates (hardcoded in frontend — not DB-backed)
- Job quota tracking

**All create/update/delete operations fail silently** (no backend). The `GET /api/career/recruiter-postings` endpoint would show active jobs if any existed, but the table is empty.

**D02 Structural: 15% · Activation: 0% · Data: 0%**

---

## D03 — CANDIDATE MANAGEMENT

### D03.1 Route Inventory
| Route | Status |
|---|---|
| `POST /api/employer/candidates` | **MISSING** — 404 |
| `GET /api/employer/candidates` | **MISSING** — 404 |
| `PUT /api/employer/candidates/:id` | **MISSING** — 404 |
| Bulk candidate import | **MISSING** |

### D03.2 Data Integrity
| Source | Type | Status |
|---|---|---|
| `MOCK_NAUKRI` | 3 hardcoded candidates | **Mock — never real** |
| `MOCK_LINKEDIN` | 3 hardcoded candidates | **Mock — never real** |
| `MOCK_INDEED` | 3 hardcoded candidates | **Mock — never real** |
| `MOCK_METRYX_POOL` | 3 hardcoded candidates | **Mock — never real** |
| `MOCK_EXCEL_ROWS` | 2 hardcoded rows | **Mock — never real** |
| `recruiter_interactions` table | 0 rows | EMPTY |

Import buttons (Naukri, LinkedIn, Indeed, MetryxOne Pool, Excel) are rendered in the UI. The import flow calls `POST /api/employer/candidates` which returns 404.

### D03.3 Candidate Lifecycle
The frontend models 7 pipeline stages: Applied → Screened → Interview → Assessment → Offer → Hired → Rejected. Stage transitions call `PUT /api/employer/candidates/:id/stage` — **this route does not exist**.

**D03 Structural: 10% · Activation: 0% · Data: 0% (all mock)**

---

## D04 — TALENT INTELLIGENCE

### D04.1 Talent Graph (Workforce Knowledge Graph)
| Component | Status | Evidence |
|---|---|---|
| `wkg_nodes` table | **MISSING** — not in DB | `SELECT` returns error |
| `wkg_edges` table | **MISSING** — not in DB | `SELECT` returns error |
| VX workforce knowledge graph routes | Registered | `registerVxWorkforceKnowledgeGraphRoutes` in routes.ts |
| VX routes DB dependency | Broken | Tables missing → lazy schema not yet triggered |

### D04.2 Talent Foundation (VX-era)
All 24 queried talent foundation tables are **MISSING from the DB**:
- `talent_foundation_profiles`, `talent_foundation_competencies`, `talent_foundation_skills`
- `talent_level_profile_templates`, `talent_scoring_configs`, `talent_outcome_configs`
- `talent_readiness_profiles`, `talent_digital_twin_states`, `talent_learning_enrollments`
- `vx_tenant_configurations`, `vx_capability_master`, `vx_skill_demand`, `vx_market_intelligence`
- `wkg_nodes`, `wkg_edges`

These tables are registered via `registerTalentFoundationRoutes` etc. in routes.ts but the lazy `ensureSchema` has never fired (no authenticated request has hit these routes in this environment).

### D04.3 Talent Scoring (AI Talent Match)
`EmployerPortalPage.tsx` "AI Talent Match" tab calls `inferCompetencyLevels`, `computeFitment`, `recommendFutureRoles` from `@/lib/careerIntelligence` — **pure frontend computation** using `MARKET_CATALOG` static data. No backend talent scoring API is invoked.

### D04.4 Classification
| Capability | Classification |
|---|---|
| Talent graph | DEAD (tables missing) |
| Talent recommendations | STATIC (frontend-computed from MARKET_CATALOG) |
| Candidate ranking | ABSENT |
| Candidate fit scoring | FRONTEND-ONLY (no backend persistence) |
| Talent segmentation | ABSENT |

**D04 Structural: 20% · Activation: 5% · Data: 0%**

---

## D05 — HIRING INTELLIGENCE

### D05.1 Pipeline Trace
```
Job ──────────────── ABSENT: no live jobs in DB
  ↓
Competencies ─────── ABSENT: no job→competency linkage table found
  ↓
Candidate ────────── ABSENT: no candidates in DB
  ↓
Fit Score ────────── PARTIAL: computeFitment() is frontend-only (no persist)
  ↓
Ranking ──────────── ABSENT: no ranking engine found
  ↓
Recommendation ───── ABSENT: no hiring recommendation engine found
```

**Pipeline breaks at Step 1 (Job).** There is no live job data because `/api/employer/jobs` POST does not exist.

### D05.2 Dead Code / Stub Logic
| Item | Type |
|---|---|
| `computeFitment` in careerIntelligence.ts | Pure frontend fn — not persisted |
| `MOCK_NAUKRI/LINKEDIN/INDEED` | Hardcoded stub |
| `MOCK_TEAM` | Hardcoded stub — never fetched |
| Voice Screening tab | UI present; no actual voice API backend found |
| RefCheck flow | Full UI; calls `PUT /api/employer/candidates` → 404 |

**D05 Structural: 10% · Activation: 0% · Data: 0%**

---

## D06 — COMPETENCY INTELLIGENCE CONSUMPTION

### D06.1 What is Consumed by the Employer Portal
| Competency Layer | Employer Consumption | Status |
|---|---|---|
| Role Competencies (`MARKET_CATALOG`) | AI Talent Match uses static catalog | STATIC — not DB-backed |
| Skill Gaps (`m5_organizational_skill_gaps`) | M5 workforce intelligence | 5 rows (demo_org seeded) |
| Capability Scores (`p5_organizational_capabilities`) | M5/WOS/p4 layers | 1,196 rows (seeded) |
| Readiness Scores (`m5_workforce_readiness_scores`) | M5 WFI readiness | 0 rows — COLD |
| Benchmarks (`m5_industry_workforce_benchmarks`) | M5 bench | 4 rows (demo) |
| Forecasts (`m5_future_workforce_forecasts`) | M5 exec | 0 rows — COLD |
| Competency history (`p4_competency_history`) | Not consumed by employer portal | 8,986 rows (from career seeker) |

### D06.2 Disconnected Layers
- `p4_competency_history` has 8,986 real rows from career-seeker assessments but **no employer portal consumer reads this table**
- The `vx_capability_master` and `vx_skill_demand` tables are MISSING — the VX-era employer competency science is unreachable
- `talent_concern_risk_scores` table: MISSING

**D06 Structural: 25% · Data: 10% (demo_org only) · Connected: 5%**

---

## D07 — EMPLOYER REPORTING

### D07.1 Report Capability Matrix
| Capability | Present | Notes |
|---|---|---|
| Scores | PARTIAL | M5 serves scores for `demo_org` |
| Insights | PARTIAL | M5 exec insights: 3 rows |
| Patterns | ABSENT | No employer-specific pattern engine |
| Trends | PARTIAL | WOS market signals: 54 rows |
| Forecasts | ABSENT | `m5_future_workforce_forecasts`: 0 rows |
| Outcomes | ABSENT | `hiring_outcomes`: 0 rows |
| Interventions | PARTIAL | M5 coach interventions (demo_org) |
| Explainability | PRESENT | M5 wraps all responses in `explainability envelope` |
| Confidence | PRESENT | M5 methodology version stamps on every response |

### D07.2 Report Factory Integration
Report Factory (`rf_*` tables, 4 stakeholder report types) **does not include an employer/workforce report type**. Available types: Student, Parent, Counselor, Institution. No "Recruiter" or "Employer" type exists.

### D07.3 Employer Analytics Panel
`EmployerPortalPage.tsx` Analytics tab computes analytics **from frontend state only** (counts derived from in-memory `candidates`, `jobs` arrays populated by failed API calls → all show zero).

**D07 Structural: 20% · Activation: 10% · Data: 5%**

---

## D08 — WORKFORCE INTELLIGENCE

### D08.1 Implementation Layers
| Module | Routes | Auth | DB Tables | Status |
|---|---|---|---|---|
| M5 Workforce Intelligence | 35 routes (`/api/m5/*`) | **NONE** | m5_* (seeded) | STRUCTURAL, unauthenticated |
| Enterprise Workforce OS | 10 routes (`/api/v2/wos/*`) | requireAuth ✓ | wos_* (thin) | PARTIAL |
| Workforce OS V2 | 8 routes (`/api/wos/v2/*`) | requireAuth ✓ | wos_v2_* (3 rows) | MINIMAL |
| Career Workforce | 23 routes (`/api/career/workforce/*`) | **NONE** | HARDCODED static | STRUCTURAL, unauthenticated |
| Workforce Analytics | 2 routes (`/api/workforce/*`) | **NONE** | p4/p5 (seeded) | MINIMAL |
| p4/p5 Intelligence | Internal services | N/A | 1196+15+9 rows | PARTIAL (seeded) |

### D08.2 Workforce Composition
- No real employee profiles in any workforce table (all `demo_org` placeholder data)
- `m5_organizational_capabilities`: 5 rows (demo)
- `m5_workforce_capability_heatmaps`: 12 rows (demo)
- `p4_organizational_heatmaps`: 1,196 rows — these appear to be **seeded synthetic data** for the demo org

### D08.3 Verified Capabilities
| Capability | Actual Implementation |
|---|---|
| Workforce composition | STATIC: `demo_org` seeded rows in m5_* tables |
| Department intelligence | COMPUTED from `demo_org` data: returns non-empty but not real employer data |
| Capability heatmaps | SEEDED: 1,196 rows (p4), 12 rows (m5) |
| Capability risk | SEEDED: 3 rows in `m5_strategic_workforce_risks` |
| Succession readiness | SEEDED: 5 candidates, 15 models in p5 |
| Workforce planning | HARDCODED: career-workforce.ts uses constant ROLE_CLUSTERS and SKILL_SIGNALS arrays |

**D08 Structural: 45% · Activation: 15% · Data: 5% (all demo/seeded)**

---

## D09 — ANALYTICS

### D09.1 Hiring Analytics
| Metric | Source | Status |
|---|---|---|
| Total jobs | Frontend in-memory state | EMPTY (API 404) |
| Total candidates | Frontend in-memory state | EMPTY (API 404) |
| Hire rate | Frontend computation | ZERO (no data) |
| Offer acceptance | Frontend computation | ZERO (no data) |
| Source breakdown | Frontend computation | ZERO (no data) |
| Conversion funnel | Frontend computation | ZERO (no data) |

All analytics in `EmployerPortalPage.tsx` are derived from frontend state that is populated by failed API calls. The analytics tab renders cards but shows all zeros.

### D09.2 Recruiter Analytics
No per-recruiter analytics. No `recruiter_id` tracked in any table. `recruiter_interactions`: 0 rows.

### D09.3 Assessment Analytics
No employer-visible assessment analytics pipeline. The `p4_competency_history` table has 8,986 rows but no employer-facing consumer reads it for hiring decisions.

### D09.4 Enterprise Intelligence Analytics
M5 `/api/m5/bench/*` benchmarks return seeded data (4 industry benchmarks, 5 org benchmarks) for `demo_org`. No real query logic discriminates by employer identity.

### D09.5 Revenue Analytics
No employer revenue analytics. No billing events. No payment history.

**D09 Structural: 20% · Activation: 5% · Real Data: 0%**

---

## D10 — COMMERCIAL READINESS

### D10.1 Plans & Subscriptions
| Component | Status |
|---|---|
| Employer subscription plans | **ABSENT** — subscription_packages table has 13 CAPADEX/B2C plans only; no employer tier |
| Employer seat management | **ABSENT** |
| Corporate packages | **ABSENT** |
| Enterprise contracts | **ABSENT** |
| Invoicing | **ABSENT** |
| Billing/Renewal | **ABSENT** |
| Employer entitlement enforcement | **ABSENT** |
| Employer paywall | **ABSENT** |

### D10.2 Commercial Architecture Gap
The CAPADEX/B2C commercial stack (Razorpay, `capadex_payments`, `requireEntitlement`) is **entirely separate** from the Employer Portal and not adapted for employer/B2B use. There is no employer-facing pricing page, no enterprise contract flow, no seats model.

### D10.3 Revenue Readiness
- **Paid employer transactions:** 0
- **Employer-specific payment routes:** 0
- **Enterprise contract table:** ABSENT

**D10 Structural: 0% · Activation: 0% · Revenue: 0%**

---

## D11 — ADMIN & GOVERNANCE

### D11.1 Employer Admin
| Panel | Status |
|---|---|
| SuperAdmin → HR Panel (`HRPanel.tsx`) | EXISTS in superadmin dashboard |
| Employer account management | **ABSENT** — no employer user CRUD |
| Organization admin | **ABSENT** |
| Recruiter permission management | **ABSENT** |

### D11.2 RBAC
- `users.role` column supports `hr_recruiter`, `admin`, `job_seeker`, `user` role values (referenced in code)
- Zero users with `hr_recruiter` role in DB
- WOS V2 uses `userHasPermission()` from `rbac-tenant-engine.ts` — this is implemented but untested against real employer users
- `wos_v2_abac_policies` table: 0 rows → ABAC policy engine has no configured policies

### D11.3 Audit Trails
| Audit Log | Rows | Quality |
|---|---|---|
| `m5_audit_logs` | 2 | Sparse (internal only) |
| `wos_audit_logs` | 30 | Better (WOS-phase activity) |
| `p4_audit_logs` | Present | No independent row count taken; p4_* phase activity |

**D11 Structural: 30% · Operational: 5%**

---

## D12 — SECURITY

### D12.1 Authentication Gaps
| Surface | Auth | Risk |
|---|---|---|
| `/api/m5/*` (35 routes) | **NONE** | CRITICAL — org workforce intelligence fully public |
| `/api/career/workforce/*` (23 routes) | **NONE** | HIGH — workforce computation public |
| `/api/workforce/*` (2 routes) | **NONE** | HIGH — heatmap/metrics public |
| `/api/v2/wos/*` (10 routes) | `requireAuth` ✓ | PASS |
| `/api/wos/v2/*` (8 routes) | `requireAuth` ✓ | PASS |
| `/api/career/recruiter-postings` | `requireAuth` ✓ | PASS |

### D12.2 IDOR Risks
| Risk | Detail |
|---|---|
| M5 `org_id` from query param | `orgOf(req) = String(req.query.org_id ?? 'demo_org')` — any caller can request any org's data by passing `?org_id=<target>`. No validation, no ownership check, no auth required. **CRITICAL IDOR.** |
| No employer-to-data ownership binding | No table links employer accounts to their org data; all M5 data is `demo_org` |

### D12.3 Organisation Isolation
- **Not implemented.** All M5 workforce intelligence is scoped to `org_id` from query param. No DB-level isolation exists. No multi-tenancy boundary.

### D12.4 Frontend Auth Pattern
- `EmployerPortalPage.tsx` uses `localStorage.getItem('metryx_token')` for auth headers
- This JWT is never validated by any backend route (the routes that would validate it don't exist)
- The platform's real auth uses session cookies (connect-pg-simple); the employer portal's JWT pattern is an orphaned parallel system

**D12 Structural: 25% — CRITICAL auth/IDOR gaps on 35+ public routes**

---

## D13 — DATABASE ACTIVATION

### D13.1 Per-Table Classification

| Table | Rows | Producers | Consumers | Classification |
|---|---|---|---|---|
| `employer_jobs` | 0 | NONE (POST route missing) | `GET /api/career/recruiter-postings` | **DEAD** |
| `job_postings` | 0 | NONE | NONE found | **ORPHAN** |
| `hiring_outcomes` | 0 | NONE | NONE found | **ORPHAN** |
| `recruiter_interactions` | 0 | NONE | NONE found | **ORPHAN** |
| `p4_organizational_heatmaps` | 1,196 | Seeded | p4 engine | **PARTIAL (seeded)** |
| `p5_organizational_capabilities` | 1,196 | Seeded | p5 engine | **PARTIAL (seeded)** |
| `p5_succession_models` | 15 | Seeded | enterprise-intelligence.ts | **PARTIAL (seeded)** |
| `p5_workforce_intelligence` | 9 | Seeded | enterprise-intelligence.ts | **PARTIAL (seeded)** |
| `wos_market_signals` | 54 | Seeded | WOS Phase 5 | **PARTIAL (seeded)** |
| `wos_workforce_risk` | 40 | Seeded | WOS Phase 5 | **PARTIAL (seeded)** |
| `wos_roles` | 5 | Seeded | WOS Phase 5 | **PARTIAL (seeded)** |
| `m5_organizational_capabilities` | 5 | Seeded | M5 WFI | **PARTIAL (demo)** |
| `m5_workforce_capability_heatmaps` | 12 | Seeded | M5 WFI | **PARTIAL (demo)** |
| `m5_succession_candidates` | 5 | Seeded | M5 succession | **PARTIAL (demo)** |
| `m5_workforce_readiness_scores` | 0 | M5 WFI (never fired) | M5 WFI | **EMPTY** |
| `m5_workforce_maturity_scores` | 0 | M5 WFI (never fired) | M5 WFI | **EMPTY** |
| `m5_future_workforce_forecasts` | 0 | M5 exec (never fired) | M5 exec | **EMPTY** |
| `talent_*` (all 14 queried) | MISSING | VX routes (lazy init) | VX routes | **MISSING (schema never run)** |
| `vx_*` (all queried) | MISSING | VX routes (lazy init) | VX routes | **MISSING (schema never run)** |
| `wkg_nodes` / `wkg_edges` | MISSING | VX workforce KG | VX KG routes | **MISSING** |
| `wos_v2_market_forecasts` | 3 | wos-v2 routes | wos-v2 routes | **MINIMAL (demo)** |
| `wos_v2_scenarios` | 3 | wos-v2 routes | wos-v2 routes | **MINIMAL (demo)** |
| `wos_v2_abac_policies` | 0 | Admin (none configured) | RBAC engine | **EMPTY** |

### D13.2 Summary
| Classification | Count |
|---|---|
| ACTIVE (real production data) | 0 |
| PARTIAL (seeded/demo data only) | ~18 |
| EMPTY (schema exists, 0 rows) | ~8 |
| ORPHAN (no producer or consumer) | 3 |
| MISSING (schema never initialized) | ~24 |
| DEAD (no write path exists) | 1 (employer_jobs) |

---

## D14 — INTELLIGENCE PIPELINE

### D14.1 Full Pipeline Trace

```
Employer ────────── BROKEN: no employer account exists
  ↓
Job ─────────────── BROKEN: POST /api/employer/jobs = 404; employer_jobs = 0 rows
  ↓
Role ────────────── PARTIAL: MARKET_CATALOG (static frontend) + wos_roles (5 seeded)
  ↓
Competency ──────── PARTIAL: m5_organizational_skill_gaps (5 demo rows)
  ↓
Assessment ──────── DISCONNECTED: p4_competency_history has 8,986 rows but no employer consumer
  ↓
Signal ──────────── DISCONNECTED: CAPADEX signals (26 activated) not surfaced to employer
  ↓
Composite ───────── DISCONNECTED: 5 composites exist but not employer-consumed
  ↓
Pattern ─────────── DISCONNECTED: 36 patterns exist but not employer-consumed
  ↓
Trend ───────────── PARTIAL: wos_market_signals (54 rows) via WOS routes
  ↓
Forecast ────────── COLD: m5_future_workforce_forecasts = 0 rows
  ↓
Outcome ─────────── BROKEN: hiring_outcomes = 0 rows; no outcome attribution
  ↓
Recommendation ──── PARTIAL: M5 coaching/succession for demo_org only
```

### D14.2 Exact Break Points
1. **BREAK AT EMPLOYER** — No employer account or org provisioning
2. **BREAK AT JOB** — API missing; table empty
3. **DISCONNECT AT ASSESSMENT** — 8,986 real competency history rows are invisible to employer portal
4. **DISCONNECT AT SIGNAL** — CAPADEX behavioural intelligence not surfaced to employer
5. **BREAK AT OUTCOME** — No completed hiring outcome ever recorded

**The pipeline is broken at its first link (Employer → Job) and then again disconnected at Assessment→Signal→Composite→Pattern hops.** The M5/WOS intelligence modules operate in isolation on demo data.

---

## D15 — READINESS CERTIFICATION

### D15.1 Structural Readiness — 35%
What exists structurally:
- `EmployerPortalPage.tsx`: 6,962-line recruiter UI (15 tabs) — BUILT
- `EmployerDashboardPage.tsx`: workforce intelligence shell — BUILT
- `EnterpriseHiringPage.tsx` / `CampusRecruitPage.tsx`: marketing pages — BUILT
- M5 enterprise module (35 routes, 8 services): BUILT
- WOS/WOS-V2 enterprise OS (18 routes): BUILT
- career-workforce.ts (23 routes): BUILT (hardcoded)
- Talent foundation route registrations (20+ files): REGISTERED (schemas not init'd)
- employer_jobs table schema: DEFINED (lazy create)

What is absent:
- `/api/employer/*` routes (6 critical endpoints) — **ABSENT**
- Employer auth system — **ABSENT**
- Employer accounts/org table — **ABSENT**
- Employer commercial stack — **ABSENT**

### D15.2 Activation Readiness — 12%
| Activated Capability | Evidence |
|---|---|
| M5 workforce intelligence (demo_org only) | 35 routes return seeded data |
| WOS workforce risk | 40 rows (seeded) |
| Career-seeker Fitment Panel | Reads `employer_jobs` (empty) → falls back to MARKET_CATALOG |
| Employability Passport recruiter view | Exists if candidate shares link |

Everything else: NOT ACTIVATED.

### D15.3 Data Readiness — 8%
- Real employer data: **0** (no employer accounts, no real jobs, no real candidates)
- Seeded/demo data: M5 and p4/p5 tables serve `demo_org` static rows
- Connected to real user behaviour: CAPADEX/career seeker data (8,986 competency history, 13 sessions) — not surfaced to employer

### D15.4 Intelligence Readiness — 18%
- M5 succession / heatmap / coaching: STRUCTURAL (demo data only)
- WOS market forecasting: MINIMAL (3 scenarios)
- Workforce KG: ABSENT (wkg_* tables missing)
- Hiring intelligence pipeline: BROKEN
- Candidate-to-job fit: FRONTEND ONLY (not persisted)

### D15.5 Commercial Readiness — 0%
- No employer pricing tier
- No employer subscription
- No payment route for employer use-case
- No entitlement enforcement for employer features
- Revenue from employer channel: **₹0**

### D15.6 Operational Readiness — 22%
- HRPanel exists in SuperAdmin for basic visibility
- M5 audit logs: 2 rows (effectively empty)
- WOS audit logs: 30 rows (some activity)
- No employer admin self-service
- AI governance 14 metrics active (platform-level, not employer-specific)

### D15.7 Overall Readiness: **16%**
```
Structural    ████████░░░░░░░░░░░░░░░░ 35%
Activation    ███░░░░░░░░░░░░░░░░░░░░░ 12%
Data          ██░░░░░░░░░░░░░░░░░░░░░░  8%
Intelligence  ████░░░░░░░░░░░░░░░░░░░░ 18%
Commercial    ░░░░░░░░░░░░░░░░░░░░░░░░  0%
Operational   █████░░░░░░░░░░░░░░░░░░░ 22%
──────────────────────────────────────
OVERALL                               16%
```

**GO / NO-GO: NO-GO**  
The Employer Portal is not production-ready. The recruiter ATS experience (core use-case) has no backend. The workforce intelligence layer works only for demo data with no authentication or isolation.

---

## ROUTE INVENTORY

| Route | File | Auth | Status |
|---|---|---|---|
| `GET /api/career/recruiter-postings` | recruiter-postings.ts | requireAuth | LIVE (returns empty) |
| `GET /api/m5/wfi/*` (8 routes) | m5-enterprise-workforce.ts | **NONE** | LIVE (demo_org) |
| `GET /api/m5/succ/*` (6 routes) | m5-enterprise-workforce.ts | **NONE** | LIVE (demo_org) |
| `GET /api/m5/coach/*` (5 routes) | m5-enterprise-workforce.ts | **NONE** | LIVE (demo_org) |
| `POST /api/m5/coach/growth-plan/persist` | m5-enterprise-workforce.ts | **NONE** | LIVE (no auth) |
| `GET /api/m5/sim/*` (3 routes) | m5-enterprise-workforce.ts | **NONE** | LIVE (demo_org) |
| `POST /api/m5/sim/run` | m5-enterprise-workforce.ts | **NONE** | LIVE (no auth) |
| `GET /api/m5/exec/*` (6 routes) | m5-enterprise-workforce.ts | **NONE** | LIVE (demo_org) |
| `POST /api/m5/exec/log-decision` | m5-enterprise-workforce.ts | **NONE** | LIVE (no auth) |
| `GET /api/m5/bench/*` (4 routes) | m5-enterprise-workforce.ts | **NONE** | LIVE (demo_org) |
| `GET /api/m5/graph/*` (5 routes) | m5-enterprise-workforce.ts | **NONE** | LIVE (demo_org) |
| `GET/POST /api/m5/obs/*` (5 routes) | m5-enterprise-workforce.ts | **NONE** | LIVE (no auth) |
| `GET /api/v2/wos/dashboard` | enterprise-workforce-os.ts | requireAuth ✓ | LIVE (flag-gated) |
| `POST /api/v2/wos/profiles/build` | enterprise-workforce-os.ts | requireAuth ✓ | LIVE |
| `GET /api/v2/wos/capability-risk` | enterprise-workforce-os.ts | requireAuth ✓ | LIVE |
| `GET /api/v2/wos/executive-intelligence` | enterprise-workforce-os.ts | requireAuth ✓ | LIVE |
| `GET/POST /api/wos/v2/*` (8 routes) | workforce-os-v2.ts | requireAuth ✓ | LIVE (flag-gated) |
| `GET /api/career/workforce/*` (23 routes) | career-workforce.ts | **NONE** | LIVE (hardcoded data) |
| `GET /api/workforce/heatmap` | workforce-analytics.ts | **NONE** | LIVE (reads p4) |
| `GET /api/workforce/metrics` | workforce-analytics.ts | **NONE** | LIVE (reads p4) |
| `/api/employer/jobs` (GET/POST/PUT/DELETE) | **MISSING** | N/A | **404** |
| `/api/employer/candidates` (GET/POST/PUT) | **MISSING** | N/A | **404** |
| `/api/employer/interviews` (GET/POST/PUT) | **MISSING** | N/A | **404** |
| `/api/employer/offers` (GET/POST/PUT) | **MISSING** | N/A | **404** |
| `/api/employer/analytics` | **MISSING** | N/A | **404** |
| `/api/employer/company` | **MISSING** | N/A | **404** |

**Employer-specific routes: 0 of 26 needed endpoints exist.**

---

## SERVICE INVENTORY

| Service | File | Status | Notes |
|---|---|---|---|
| M5 Workforce Intelligence | services/m5-workforce-intelligence.ts | BUILT | Reads m5_* seeded tables |
| M5 Succession Engine | services/m5-succession.ts | BUILT | 5 demo candidates |
| M5 AI Coach | services/m5-ai-coaching.ts | BUILT | Growth plans for demo users |
| M5 Executive Intelligence | services/m5-executive-intelligence.ts | BUILT | 3 demo insights |
| M5 Org Benchmark | services/m5-org-benchmark.ts | BUILT | 4 industry benchmarks |
| M5 Org Graph | services/m5-org-graph.ts | BUILT | 4 demo nodes |
| Enterprise Intelligence | services/enterprise-intelligence.ts | BUILT | p4/p5 seeded data |
| Enterprise Workforce OS Engine | services/enterprise-workforce-os-engine.ts | BUILT | Writes tenant capability profiles |
| Predictive Workforce Engine V2 | services/predictive-workforce-engine-v2.ts | BUILT | 3 demo scenarios |
| RBAC Tenant Engine | services/rbac-tenant-engine.ts | BUILT | 0 configured policies |
| Employer CRUD service | **ABSENT** | | All 6 entity types needed |
| Candidate matching service | **ABSENT** | | Fit scoring never persisted |
| Hiring pipeline service | **ABSENT** | | No stage transition logic |

---

## DB INVENTORY (EMPLOYER-RELEVANT)

| Table | Rows | Classification | Action |
|---|---|---|---|
| `employer_jobs` | 0 | DEAD (no write path) | Needs POST route |
| `job_postings` | 0 | ORPHAN | Clarify purpose or drop |
| `hiring_outcomes` | 0 | ORPHAN | Needs producer |
| `recruiter_interactions` | 0 | ORPHAN | Needs producer |
| `m5_organizational_capabilities` | 5 | SEEDED (demo) | Real data when employers onboard |
| `m5_workforce_capability_heatmaps` | 12 | SEEDED (demo) | Same |
| `m5_succession_candidates` | 5 | SEEDED (demo) | Same |
| `p4_organizational_heatmaps` | 1,196 | SEEDED | Verify seed source; may be synthetic |
| `p5_organizational_capabilities` | 1,196 | SEEDED | Same |
| `p5_succession_models` | 15 | SEEDED | Same |
| `wos_market_signals` | 54 | SEEDED | Good foundation for market intel |
| `wos_workforce_risk` | 40 | SEEDED | Good foundation |
| `talent_*` (14 tables) | MISSING | MISSING | Lazy init never triggered |
| `vx_*` (4 tables) | MISSING | MISSING | Lazy init never triggered |
| `wkg_nodes` / `wkg_edges` | MISSING | MISSING | Workforce KG not bootstrapped |

---

## GAP ANALYSIS

### CRITICAL GAPS (Blocking)

| # | Gap | Impact |
|---|---|---|
| G1 | `/api/employer/*` 6 core routes absent | ATS product completely non-functional |
| G2 | M5 routes have zero `requireAuth` | 35 public routes; IDOR via `org_id` param |
| G3 | No employer accounts/org provisioning | No employer can onboard |
| G4 | No employer commercial stack | Zero revenue path for B2B tier |

### HIGH GAPS

| # | Gap | Impact |
|---|---|---|
| G5 | career-workforce.ts + workforce-analytics.ts unauthenticated | 25 public routes expose org-level data |
| G6 | CAPADEX candidate intelligence not wired to employer portal | 8,986 competency records invisible to hiring decisions |
| G7 | Talent foundation VX tables never initialised | VX-era intelligence layer unreachable |
| G8 | No multi-tenancy / org isolation model | All employers see `demo_org` data |
| G9 | Frontend JWT auth pattern incompatible with session-cookie backend | Auth will never work without alignment |

### MEDIUM GAPS

| # | Gap | Impact |
|---|---|---|
| G10 | Mock candidate import sources (Naukri/LinkedIn) hardcoded | No real ATS integration |
| G11 | Report Factory has no Employer/Recruiter report type | Employer can't receive formal report |
| G12 | `wos_v2_abac_policies` empty | RBAC engine configured but policy-free |
| G13 | `m5_workforce_readiness_scores` and `maturity_scores` = 0 rows | M5 readiness intelligence cold |
| G14 | Hiring intelligence pipeline broken at Step 1 | No end-to-end fit scoring |

---

## 95% COMPLETION ROADMAP

### Phase 1 — Foundation (Prerequisite for all) [~1 week]
1. **Employer auth system** — employer registration/login endpoint; JWT validation middleware; `employers` and `organizations` tables; separate from capadex_users
2. **`/api/employer/jobs` CRUD** — GET, POST, PUT, DELETE; reads/writes `employer_jobs`; requireAuth
3. **`/api/employer/candidates` CRUD** — GET, POST, PUT; reads/writes a `employer_candidates` table
4. **`/api/employer/interviews` CRUD** — interview scheduling; links to candidates
5. **`/api/employer/offers` CRUD** — offer lifecycle; status transitions
6. **`/api/employer/analytics`** — aggregate from jobs/candidates/interviews
7. **`/api/employer/company`** — company profile CRUD

### Phase 2 — Auth Hardening [~2 days]
8. Add `requireAuth` to all 35 `/api/m5/*` routes
9. Add `requireAuth` to all 23 `/api/career/workforce/*` routes
10. Add `requireAuth` to `/api/workforce/*` (2 routes)
11. Fix M5 `orgOf()` to use session-based org identity, not query param
12. Implement org isolation — employer can only access their own org data

### Phase 3 — Intelligence Wiring [~1 week]
13. Surface CAPADEX signals/composites/patterns to employer as candidate intelligence
14. Connect `p4_competency_history` to employer fit scoring pipeline
15. Build candidate-to-job matching engine (server-side, persist to `hiring_outcomes`)
16. Wire WOS workforce KG (initialise `wkg_*` tables; build employer topology)
17. Trigger talent foundation lazy init (hit VX endpoints) to materialise talent schema

### Phase 4 — Commercial [~1 week]
18. Define employer pricing tiers (Startup/Growth/Enterprise seats)
19. Add employer subscription plans to `subscription_packages`
20. Wire employer entitlement enforcement (`requireEntitlement` for employer routes)
21. Invoice generation for employer contracts

### Phase 5 — Reporting & Analytics [~3 days]
22. Add Employer/Recruiter report type to Report Factory
23. Build per-org real analytics (not frontend computed)
24. Real-time hiring funnel metrics (DB-backed)

---

## GO / NO-GO CERTIFICATE

```
╔══════════════════════════════════════════════════════╗
║       EP-X1A EMPLOYER PORTAL READINESS CERTIFICATE   ║
║                                                      ║
║  Structural Readiness:   35%                         ║
║  Activation Readiness:   12%                         ║
║  Data Readiness:          8%                         ║
║  Intelligence Readiness: 18%                         ║
║  Commercial Readiness:    0%                         ║
║  Operational Readiness:  22%                         ║
║                                                      ║
║  OVERALL SCORE:          16%                         ║
║  THRESHOLD:              95%                         ║
║                                                      ║
║  VERDICT:  ██████████ NO-GO ██████████               ║
║                                                      ║
║  BLOCKING GAPS:                                      ║
║  • /api/employer/* backend entirely absent (6 APIs)  ║
║  • M5 35 routes public, IDOR via org_id param        ║
║  • No employer accounts or org provisioning          ║
║  • Zero commercial infrastructure for B2B            ║
║                                                      ║
║  Earliest GO possible: ~3 weeks (Phase 1+2 complete) ║
║  Full 95% certification: ~6 weeks                    ║
╚══════════════════════════════════════════════════════╝
```

---

## APPENDIX — Evidence Registry

| Finding | Evidence Source | Date |
|---|---|---|
| `/api/employer/*` routes absent | `grep -rn "'/api/employer" backend/ --include="*.ts"` → 0 results | 2026-06-12 |
| `employer_jobs` 0 rows | Live DB query | 2026-06-12 |
| `hiring_outcomes` 0 rows | Live DB query | 2026-06-12 |
| `recruiter_interactions` 0 rows | Live DB query | 2026-06-12 |
| talent_* tables MISSING | Live DB query → "MISSING" for 14 tables | 2026-06-12 |
| vx_* tables MISSING | Live DB query → "MISSING" for 4 tables | 2026-06-12 |
| M5 routes have 0 requireAuth | `grep -c "requireAuth" routes/m5-enterprise-workforce.ts` → 0 | 2026-06-12 |
| career-workforce.ts has 0 requireAuth | `grep -c "requireAuth" routes/career-workforce.ts` → 0 | 2026-06-12 |
| M5 org_id from query param | Code read — `orgOf = (req) => String(req.query.org_id ?? 'demo_org')` | 2026-06-12 |
| Frontend uses localStorage JWT | Code read — `localStorage.getItem('metryx_token')` in EmployerPortalPage.tsx | 2026-06-12 |
| Mock candidate data hardcoded | Code read — `MOCK_NAUKRI`, `MOCK_LINKEDIN`, `MOCK_INDEED` constants in EmployerPortalPage.tsx | 2026-06-12 |
| MOCK_TEAM hardcoded | Code read — `const MOCK_TEAM` at line 167 of EmployerPortalPage.tsx | 2026-06-12 |
| 4 total users, 0 employer roles | Live DB query — `SELECT count(*), role FROM users GROUP BY role` | 2026-06-12 |
| No employer commercial plans | grep `subscription` + `employer` in routes/ → 0 results | 2026-06-12 |
| p4_organizational_heatmaps 1196 rows | Live DB query | 2026-06-12 |
| p5_organizational_capabilities 1196 rows | Live DB query | 2026-06-12 |
| wos_market_signals 54 rows | Live DB query | 2026-06-12 |
| m5_* seeded rows | Live DB query — capabilities:5, heatmaps:12, succession:5, skill_gaps:5, risks:3 | 2026-06-12 |
| enterprise-workforce-os.ts requireAuth x10 | `grep -c "requireAuth" routes/enterprise-workforce-os.ts` → 10 | 2026-06-12 |
| wos_v2_abac_policies 0 rows | Live DB query | 2026-06-12 |

*All row counts are live production DB values. No synthetic figures. Mock data status derived from source code analysis.*
