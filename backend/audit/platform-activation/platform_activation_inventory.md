# Platform Activation Inventory — MetryxOne

**Date:** 2026-06-17
**Type:** Read-only audit. No functionality was modified.
**Method:** Live DB introspection (`pg_stat_user_tables`, `to_regclass`), backend route/service file enumeration, frontend screen enumeration, feature-flag registry read, and per-product code mapping.

---

## 0. Ground-truth scale (what physically exists)

| Surface | Count |
|---|---|
| Backend route files (`backend/routes/*.ts`) | 228 |
| Top-level routes registered in `backend/routes.ts` | 471 |
| Backend service/engine files (`backend/services/*.ts` + subdirs) | ~250 |
| Frontend pages (`frontend/src/pages/*`) | ~70 |
| Frontend components (top-level) | 117 |
| SuperAdmin panels (`components/superadmin/*`) | ~170 |
| Database tables that exist (`pg_stat_user_tables`) | 224 |
| Feature flags in registry (`config/feature-flags.ts`) | 73 (29 default ON, 44 default OFF) |

> **Headline:** The platform is **structurally vast but operationally near-empty.** The code surface is enormous; the database holds only reference/config seeds plus a small, clearly-labelled SA-100X demo seed. There are **0 real registered users** (`users` table = 0 rows) and the **core runtime persistence tables do not exist yet** (see §7).

---

## 1. CAPADEX

**APIs (route files → base path):**
- `capadex.ts` → `/api/capadex`, `/api/assessment`, `/api/admin/capadex` (session start/respond/complete/report)
- `pragati.ts` → `/api/pragati` (conversational runtime)
- `signal-capture.ts` → `/api/signals`
- `capadex-enterprise.ts` → `/api/admin/capadex` (analytics, risk, interventions)
- Ontology/questions: `capadex-ontology.ts`, `capadex-ontology-hub.ts`, `capadex-questions.ts`, `capadex-question-registry.ts`, `capadex-clarity-questions.ts`, `capadex-concerns-master.ts`
- Intelligence: `capadex-concern-intelligence.ts`, `capadex-concern-signal-map.ts`, `capadex-coverage.ts`, `capadex-prediction.ts`, `capadex-payments.ts`, `capadex-pil-graph.ts`, `capadex-simulation.ts`
- PIL: `pil-archetypes.ts`, `pil-human-intelligence.ts`, `pil-search-intent.ts`, `pil-intervention-intelligence.ts`

**UI Screens:**
- Assessment flow: `FreeAssessmentModal.tsx`, `PragatiWorkspace.tsx`, `assessment/phases/CapadexReportPhase.tsx`
- Admin panels: `CapadexConcernsMasterPanel.tsx`, `CapadexClarityQuestionsPanel.tsx`, `CapadexReportsPanel.tsx`, `CapadexUsersPanel.tsx`, `CapadexPricingPanel.tsx`, `CapadexAnalyticsPanel.tsx`, `CapadexInterventionsPanel.tsx`, `SignalOntologyHubPanel.tsx`, `ConcernSignalMapPanel.tsx`, `UnifiedReportsPanel.tsx`

**Services:** `capadex-report-synthesis.ts`, `capadex-explainability-engine.ts`, `capadex-insight-explainer.ts`, `capadex-intervention-engine.ts`, `capadex-safety-breaker.ts`, `concern-resolver-engine.ts`, `concern-signal-mapping-engine.ts`, `concern-clarity-mapping-engine.ts`, `signal-activation-runtime.ts`, `signal-classifier.ts`, `bridge-tag-resolver.ts`, `clarity-bridge-classifier.ts`, `pil/*` (report-builder, archetype-intelligence, knowledge-graph, stakeholder-summary)

**Reports:** Student Development, Parent Guidance, Counselor Intelligence, Institution (cohort), Omega-X signal dump.

**Tables & data status:**
| Table | Rows | Status |
|---|---|---|
| `capadex_clarity_questions` | 360 | REFERENCE (config) |
| `capadex_question_registry` | 360 | REFERENCE (config) |
| `capadex_signal_profiles` | 40 | DEMO SEED |
| `capadex_linguistic_signals` | 40 | DEMO SEED |
| `capadex_session_telemetry` | 120 | DEMO SEED |
| `capadex_session_signals` | 40 | DEMO SEED |
| `capadex_stage_pricing` | 0 | EMPTY |
| `capadex_users` | 0 | EMPTY |
| `capadex_sessions` / `_responses` / `_reports` / `_otps` / `_runtime_sessions` | — | **TABLE DOES NOT EXIST** |
| `concerns_master` / `clarity_questions` / `question_registry` (bare) | — | **TABLE DOES NOT EXIST** |

> **Activation reality:** No real assessment has ever been persisted — the session/response/report tables are not even created. The only CAPADEX data is reference question banks + the SA-100X demo seed.

---

## 2. Competency Intelligence

**APIs:** `mei-v2.ts` (`/api/mei`, `/api/admin/mei`), `competency-assessment-runtime.ts` (`/api/competency`), `competency-cohorts.ts`, `competency-graph-runtime.ts` (`/api/v2/competency-graph`), `competency-intelligence-engine.ts` (`/api/competency/intelligence`), `competency-ontology.ts` (`/api/ontology`), `competency-questions.ts`, `competency-runtime-v2.ts` (`/api/v2/competency`), `scientific-competency.ts` (`/api/sci`), `sdi.ts` (`/api/sdi`), `framework-parity.ts`, `unified-competency-profile.ts` (`/api/v2/ucip`)

**UI Screens:** `CompetencyIntelligencePage.tsx`, `CompetencyAdminPage.tsx`, `StudentCompetencyPage.tsx`, `ScientificCompetencyPage.tsx`, `CompetencyDashboard.tsx`, `GapAnalysisPage.tsx`; SuperAdmin: `CompetencyIntelligenceAdminPanel.tsx`, `CompetencyCorePanel.tsx`, `CompetencyBlueprintPanel.tsx`, `CompetencyQuestionsPanel.tsx`, `CompetencyLevelsPanel.tsx`, `MEIDesignPanel.tsx`

**Services:** `competency-intelligence.ts`, `competency-graph-engine.ts` (+`-v2`), `mei-scoring-engine.ts`, `mei-narrative-engine.ts`, `mei-benchmark-engine.ts`, `mei-recommendation-engine.ts`, `mei-chain-trigger.ts`, `competency-confidence-engine.ts`, `competency-resolution-engine.ts`, `unified-competency-profile-engine.ts`, `ucip-builder-pipeline.ts`

**Reports:** MEI Narrative, Competency Gap Analysis, Scientific Competency Audit, Unified Competency Profile (UCIP).

**Tables & data status:**
| Table | Rows | Status |
|---|---|---|
| `mei_competencies` | 45 | REFERENCE |
| `mei_industry_calibration` | 50 | REFERENCE |
| `mei_role_calibration` | 30 | REFERENCE |
| `mei_dimensions` / `mei_subdimensions` | 5 / 15 | REFERENCE |
| `mei_insight_rules` / `mei_recommendation_master` | 31 / 15 | REFERENCE |
| `mei_scores` / `mei_score_history` / `mei_competency_scores` | 0 | EMPTY (no runtime scoring) |
| `mei_user_recommendations` / `mei_narratives` / `mei_benchmarks` | 0 | EMPTY |

> **Activation reality:** Full reference/calibration layer is seeded; **zero user-generated competency scores or narratives.**

---

## 3. LBI (Learning Behaviour Index)

**APIs:** `lbi-engine.ts`, `lbi-intelligence.ts` (both `/api/lbi`, `/api/admin/lbi`)

**UI Screens:** `LBIProductPage.tsx`, `LBIAdminPage.tsx`, `LBIEducationCorrelation.tsx`, `LbiAssessmentPlayer.tsx`, `SubjectLBIReport.tsx`, `ShareLBIReport.tsx`, SuperAdmin `LBIPanel.tsx`, `ParentLbiScreen.tsx`

**Services:** `lbi-unifier.ts`, `lbi-profile-builder.ts`, `lbi-risk-engine.ts`, `lbi-trend-engine.ts`, `lbi-longitudinal-engine.ts`, `lbi-recommendation-engine.ts`, `lbi-report-generator.ts`, `lbi-stakeholder-report.ts`

**Reports:** Standard LBI Report; Stakeholder variants (Learner / Parent / Counselor / Employer); LBI Trend/Forecast.

**Tables & data status:**
| Table | Rows | Status |
|---|---|---|
| `lbi_score_history` | 8 | DEMO SEED |
| `lbi_report_types` | 0 | EMPTY |

> **Activation reality:** Engine and report generators exist; only 8 demo score-history rows, no report-type config.

---

## 4. Employability Intelligence / Index (EI)

**APIs:** `ei-admin.ts`, `ei-intelligence.ts`, `ei-governance.ts`, `ei-resolution.ts`, `employability-passport.ts` (`/api/career/passport`, `/api/public/passport`), `employability-graph.ts` (`/api/employability`, `/api/admin/kg`)

**UI Screens:** `EIHealthPanel.tsx`, `EIOperationsPanel.tsx`, `EmployabilityPassport.tsx`, `CareerPassportTab.tsx`, `FitmentInsightsPanel.tsx`, EI surfacing inside `CareerBuilderPage.tsx`

**Services:** `ei-engine.ts`, `ei-resolver.ts`, `ei-confidence.ts`, `ei-rules-loader.ts`, `ei-snapshots.ts`, `career-readiness-engine.ts`, `career-skill-gap-engine.ts`, `market-intelligence-engine.ts`

**Reports:** Employability Passport, EI Intelligence Report, Role-Fitment Analysis, Market Intelligence Forecast.

**Tables & data status:** (EI shares `ti_*` and `frp_*` substrates)
| Table | Rows | Status |
|---|---|---|
| `ti_fact_readiness` | 10 | DEMO SEED |
| `ti_fact_assessments` | 8 | DEMO SEED |
| `ti_outcome_predictions` | 8 | DEMO SEED |
| `ei_events` | 0 | EMPTY |
| `ti_signal_master` / `ti_*` (benchmarks, weights, norms, etc.) | 0 | EMPTY (~20 tables) |
| `kg_*` employability graph | (live, ~60 edges per memory) | small/real |

> **Activation reality:** EI runtime fed only by SA-100X demo facts; `ei_events` (the runtime event log) is empty.

---

## 5. Career Builder

**APIs:** `career-*.ts` (benchmark, genome, graph, intelligence-hub, intelligence, memory, passport, pathways-intelligence, profile, seeker, simulations, stage-guidance, success, trajectory, velocity, workforce), plus `frp.ts`, `lip.ts`, `cv-parser.ts`, `peer-benchmark.ts`, `career-graph.ts`

**UI Screens:** `CareerBuilderPage.tsx` (monolith, 19+ tabs: dashboard/profile/skills/resume/jobs/interview/learning/pathways/mentors/goals/assessment/future-map/development), extracted tabs `CareerVelocityTab/MarketIntelTab/WorkforceTab/FresherHubTab/SimulationsTab`, `ResumeStudio.tsx`, `FitmentInsightsPanel.tsx`, `CareerPassportTab.tsx`; SuperAdmin `CareerGraphPanel.tsx`, `CareerPathsPanel.tsx`, `CareerTracksPanel.tsx`, `CareerPathwayAnalyticsPanel.tsx`

**Services:** `career-behavior-adapter.ts`, `career-graph-engine.ts`, `career-learning-rec-engine.ts`, `career-passport-bridge.ts`, `career-readiness-engine.ts`, `career-recommendation-engine.ts`, `career-skill-gap-engine.ts`; FRP: `frp-readiness-engine.ts`, `frp-recommendation-engine.ts`, `frp-skill-bridge.ts`; LIP: `lip-*-engine.ts`; longitudinal `wc3/*`, `wc7b/*`

**Reports:** Career Velocity, Employability Passport, Growth Plan / Roadmap, Omega Report, Trajectory Analysis.

**Tables & data status:**
| Table | Rows | Status |
|---|---|---|
| `frp_role_evolution` | 1225 | REFERENCE |
| `frp_skill_taxonomy` | 27 | REFERENCE |
| `frp_user_readiness` / `frp_user_skill_profile` | 8 / 8 | DEMO SEED |
| `cg_user_recommendations` / `cg_user_role_readiness` | 8 / 8 | DEMO SEED |
| `cg_user_skill_gaps` / `cg_user_career_path` | 6 / 1 | DEMO SEED |
| `cg_roles` / `cg_tracks` / `cg_role_edges` / `cg_skill_requirements` | 0 | EMPTY (graph config not seeded) |
| `lip_*` (paths, courses, mentors, projects, certs) | 0 | EMPTY (~24 tables); only `lip_user_courses`=3 |
| `career_seeker_profiles` / `children` / `students` / `career_seeker_goals` / `student_subscriptions` | — | **TABLE DOES NOT EXIST** |
| `cp_passport` / `passport_snapshots` | — | **TABLE DOES NOT EXIST** |

> **Activation reality:** Rich FRP reference taxonomy exists, but the **core candidate profile store (`career_seeker_profiles`) and the entire LIP learning catalog are absent/empty.** No real candidate profiles.

---

## 6. Employer OS (EIOS)

**APIs:** `employer-portal.ts` (57 endpoints), `employer-admin.ts`, `employer-hiring-intelligence.ts`, `employer-security.ts`, `employer-tig.ts`, `eios-core.ts`, `eios-intelligence.ts`, `eios-workforce.ts`, `ep98` (within employer routes), `talent-*.ts` (~17 files), `workforce-os.ts` (+`-v2`), `recruiter-postings.ts`, `m5-enterprise-workforce.ts`

**UI Screens:** `EmployerPortalPage.tsx`, `EmployerDashboardPage.tsx`, `EnterpriseWorkforceOSPage.tsx`, `WorkforceOSPage.tsx`, `EnterpriseHiringPage.tsx`, `WorkforceAnalyticsPage.tsx`, `WorkforceInsightsPage.tsx`; SuperAdmin `EmployerOnboardingPanel.tsx`, `TalentPipelinePanel.tsx`, `TalentAnalyticsWarehousePanel.tsx`, `TalentGapPanel.tsx`, `TalentReadinessEnginePanel.tsx`, `TalentOutcomePredictionPanel.tsx`, `TalentDigitalTwinAdminPanel.tsx`, + ~12 more Talent* panels

**Services:** `enterprise-intelligence.ts`, `enterprise-workforce-os-engine.ts`, `workforce-analytics.ts`, `workforce-simulation-v2.ts`, `m5-*` (ai-coaching, executive-intelligence, org-graph, succession, workforce-intelligence, workforce-simulation), TIG (`employer-tig` route)

**Reports:** Hiring Intelligence, Workforce Analytics Executive Summary, Talent Readiness, Benchmarking.

**Tables & data status:**
| Table | Rows | Status |
|---|---|---|
| `employer_organizations` | 3 | DEMO SEED |
| `employer_members` | 6 | DEMO SEED |
| `employer_competency_roles` | 8 | REFERENCE |
| `employer_risk_events` | 10 | DEMO SEED |
| `ep98_hiring_assessments` | 10 | DEMO SEED |
| `eios_campaigns` / `eios_employee_profiles` / `eios_workforce_plans` | 4 / 8 / 3 | DEMO SEED |
| `eios_competency_roles` | 8 | REFERENCE |
| `tig_nodes` / `tig_clusters` | 12 / 3 | DEMO SEED |
| `tig_edges` / `tig_intelligence` / `tig_calibration` | 0 | EMPTY |
| `employer_sessions` / `_approvals` / `_business_units` / `_sso_configs` / `_audit_logs` | 0 | EMPTY |
| `ep98_role_intelligence` | 0 | EMPTY |

> **Activation reality:** Best-populated product by demo data (orgs, members, hiring assessments, risk events, TIG nodes) — but all of it is SA-100X demo seed; no real employer activity, empty session/approval/audit logs.

---

## 7. Core runtime tables — existence check (CRITICAL)

Queried via `to_regclass`:

| Expected core table | Exists? |
|---|---|
| `users` | ✅ (0 rows) |
| `employer_organizations` | ✅ |
| `feature_flags` | ✅ (0 rows) |
| `subscription_packages` | ✅ (0 rows) |
| `capadex_sessions`, `_responses`, `_reports`, `_otps`, `_runtime_sessions` | ❌ NOT CREATED |
| `concerns_master`, `clarity_questions`, `question_registry` (bare) | ❌ NOT CREATED |
| `career_seeker_profiles`, `children`, `students`, `career_seeker_goals`, `student_subscriptions` | ❌ NOT CREATED |
| `cp_passport`, `passport_snapshots` | ❌ NOT CREATED |

**18 of 19 expected runtime/persistence tables are not materialized.** These are created lazily (`ensure*Schema()`) on first real use — their absence means those code paths have **never been exercised with real data** in this environment.

---

## 8. Per-product activation summary (honest, dual-axis)

| Product | Structural (code exists) | Data/Activation (real usage) |
|---|---|---|
| CAPADEX | Very high | **~0** (no session tables; demo-only) |
| Competency Intelligence | Very high | **~0** (reference only; 0 scores) |
| LBI | High | **~0** (8 demo rows) |
| Employability (EI) | High | **~0** (demo facts only; `ei_events`=0) |
| Career Builder | Very high | **~0** (no profile table; demo `cg_*` only) |
| Employer OS | Very high | **Low (demo)** (best-seeded, but all demo) |

> Reference/config data is REAL (question banks, calibrations, FRP taxonomy, role libraries). All per-user runtime rows present are the **SA-100X demo seed** (8–12 row tables). There are **0 real platform users and 0 real assessment completions.**
