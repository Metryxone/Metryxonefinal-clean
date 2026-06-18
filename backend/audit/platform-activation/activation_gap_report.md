# Activation Gap Report — MetryxOne

**Date:** 2026-06-17
**Type:** Read-only audit. No functionality was modified.
**Companion to:** `platform_activation_inventory.md`

> **Bottom line:** MetryxOne is **structurally complete and operationally dormant.** The gap is not "missing code" — it's missing *activation*: no real users, no real assessments, core runtime tables un-materialized, ~60% of features flag-gated OFF in production, and the only per-user data present is a labelled demo seed.

---

## 1. Dead / un-activated routes (feature-flag gating)

`backend/config/feature-flags.ts` declares **73 flags: 29 default ON, 44 default OFF.** Flag-OFF routes return 503 and their UI panels hide (this is intended additive discipline — not a bug).

**Flags defaulting OFF (44)** include the entire WC-3 longitudinal chain, runtime intelligence pipeline, commercial layer, and several intelligence modules:
`hypothesisDrivenClarity`, `simulationHarness`, `runtimeIntelligenceActivation`, `runtimeIntelligencePipeline`, `signalGroundingRuntime`, `runtimeMetadataActivation`, `wc3Stage`, `wc3Personalization`, `wc3Longitudinal`, `wc3Outcome`, `wc3Journey`, `wc3QuestionIntel`, `wc3ContextIntel`, `wc3OutcomeCrosswalk`, `decisionOrchestrator`, `journeyGrowthPlanBridge`, `decisionMentorBridge`, `runtimeIntelligenceConsumption`, `longitudinalAutomation`, `commercialActivation`, `decisionPersistence`, `userIntelligenceFoundation`, `trendIntelligence`, `behaviourTrendIntelligence`, `behaviourNamespaceAlignment`, `behaviourSignalBackfill`, `revenueIntelligence`, `commercialEntitlement`, `commercialEntitlementEnforcement`, `commercialRenewal`, `commercialUpsell`, `commercialLifecycleState`, `commercialForecastInputs`, `wc3ReportPersonalization`, `wc3RecPersonalization`, `wc3LongitudinalConsumption`, `forecastIntelligence`, `interventionIntelligence`, `careerPassport`, `reportFactory`, `enterpriseAnalytics`, `aiGovernance`, `eiosWorldClassVerifiedV2`.

### ⚠️ CRITICAL: dev workflow ≠ production deployment
- The **dev `Backend API` workflow** command sets ~28 `FF_*=1` env overrides, so most of the above are ON *in development only*.
- The **production run command** in `.replit` `[deployment]` is:
  `bash -c "cd backend && NODE_ENV=production npx tsx index.ts"` — it sets **zero `FF_*` variables.**
- **Consequence:** in a published deployment, all 44 default-OFF flags are OFF. Features that work in the dev preview (Report Factory, Enterprise Analytics, AI Governance, Career Passport, Forecast Intelligence, the WC-3 chain, commercial layer, EIOS World-Class V2) would be **503/hidden in production.** This is the single largest "looks-activated-but-isn't" gap.

**Recommendation (not actioned — audit only):** either move production-ready flags' defaults to ON in the registry, or add the `FF_*` set to the deployment run command, so dev and prod behave identically.

---

## 2. Empty / unused tables

Of 224 tables, the large majority hold **0 rows**. Grouped by namespace:

| Namespace | Tables | State |
|---|---|---|
| `anl_*` (analytics warehouse) | 13 | **ALL EMPTY** — every analytics rollup/fact/dim is unpopulated |
| `ont_*` (competency ontology) | ~20 | **ALL EMPTY** — entire ontology graph unseeded |
| `lip_*` (learning intelligence) | ~24 | EMPTY except `lip_user_courses`=3 |
| `ti_*` (talent intelligence) | ~25 | EMPTY except 3 demo fact tables (8–10 rows) |
| `rie_*` (runtime intervention engine) | 8 | ALL EMPTY |
| `map_*` (ontology mappings) | 8 | ALL EMPTY |
| `cg_*` config (roles/tracks/edges/requirements) | ~12 | EMPTY (only `cg_user_*` demo rows) |
| `rf_*` (report factory) | 4 | ALL EMPTY |
| `tdt_*` (digital twin) | 3 | ALL EMPTY |
| `mei_*` runtime (scores/history/narratives/benchmarks) | ~6 | EMPTY (reference layer is seeded) |
| Misc: `notifications`, `platform_settings`, `subscription_packages`, `capadex_stage_pricing`, `capadex_users`, `feature_flags`, `users`, `question_bank`, `question_options`, `cra_*`, `cb_*`, `talent_gaps`, `talent_role_scores`, `permission_definitions`, `role_definitions`, `role_permissions` | many | EMPTY |

> Empty is not always "dead" — these are lazy-populated runtime tables waiting for real activity. But as of now they back **empty dashboards** (see §6).

---

## 3. Missing core runtime tables (not even created)

18 of 19 expected persistence tables do **not exist** (`to_regclass` = null) — see inventory §7. Most consequential:
- **CAPADEX:** `capadex_sessions`, `capadex_responses`, `capadex_reports`, `capadex_otps` → no assessment can have ever completed here.
- **Career Builder:** `career_seeker_profiles` (the candidate profile store), `children`, `students`, `career_seeker_goals`, `student_subscriptions`.
- **Career Passport:** `cp_passport`, `passport_snapshots`.
- **CAPADEX ontology master:** bare `concerns_master` / `clarity_questions` / `question_registry` (the namespaced `capadex_*` variants exist with 360 rows).

These are created on first real use via `ensure*Schema()`. Their absence is definitive evidence that **the live product runtime has never been exercised with real data in this environment.**

---

## 4. Duplicate functionality (v1 / v2 coexistence)

Multiple subsystems ship both a legacy and a "v2" implementation, registered side-by-side:

| Domain | v1 | v2 |
|---|---|---|
| Workforce OS (routes) | `workforce-os.ts` | `workforce-os-v2.ts` |
| Predictive workforce (svc) | `predictive-workforce-engine.ts` | `predictive-workforce-engine-v2.ts` |
| Adaptive assessment (routes) | `adaptive-assessment.ts` | `adaptive-assessment-v2.ts` |
| Competency runtime (routes) | `competency-assessment-runtime.ts` | `competency-runtime-v2.ts` |
| Competency graph (svc) | `competency-graph-engine.ts` | `competency-graph-engine-v2.ts` |
| Governance (routes) | `governance.ts` | `governance-v2.ts` |
| Market intelligence (svc) | `market-intelligence-engine.ts` | `market-intelligence-engine-v2.ts` |
| Fairness monitoring (svc) | `fairness-monitoring-engine.ts` | `fairness-monitoring-engine-v2.ts` |
| Dispute/override (svc) | `dispute-override-engine.ts` | `dispute-override-engine-v2.ts` |
| RBAC tenant (svc) | `rbac-tenant-engine.ts` | `rbac-tenant-engine-v2.ts` |
| Learning ROI (svc) | `learning-roi-engine.ts` | `learning-roi-engine-v2.ts` |
| AI governance (svc) | `ai-governance.ts` family | `ai-governance-v2.ts` |
| Predictive intelligence (routes) | `predictive-intelligence.ts` | `predictive-intelligence-v2.ts` |
| Contextual benchmark (routes) | (implicit v1) | `contextual-benchmark-v2.ts` |

> Many v2 engines use different logic (graph-based vs keyword/regex). This is migration debt, not necessarily duplication-to-delete — but it doubles maintenance surface and obscures which path is authoritative at runtime. Recommend documenting the canonical path per domain.

---

## 5. Mock / placeholder / fabricated data

### 5a. Runtime `Math.random()` — fabricated metrics generated at request time (highest concern)
These routes/services synthesize numbers per-request rather than computing from real data:
- `backend/routes/roie-risk.ts` — random risk scores + random labels (`'high_anxiety'`, `'low_resilience'`)
- `backend/routes/paie-forecasting.ts` — random trend strings (`'accelerating'`, `'volatile'`)
- `backend/routes/nhda-intelligence.ts` — synthetic 16-dim embeddings via `Math.random()`
- `backend/routes/lde-temporal.ts` — synthetic vectors / noise for evolution charts
- `backend/routes/vx-report-intelligence.ts` — fabricated `generation_ms`, `file_size_kb`
- `backend/services/m3-*` and `m4-*` and `m5-*` families — multiple `Math.random()` usages (simulation, observability, predictive, fairness)
- `frontend/server/src/routes/career.ts` — base scores via `Math.random() * 25`

> These should be flagged to the user: any dashboard reading from these endpoints displays **non-deterministic synthetic numbers**, not real intelligence. Honesty policy requires they be either backed by real computation or visibly labelled simulated.

### 5b. Demo seed scripts (clearly-labelled, acceptable per policy)
- `backend/scripts/sa-100x/seed.ts` — SA-100X mass demo seed (8–12 row tables; marked `source='Demo Seed'` / `@example.com`)
- `backend/scripts/seed-employer-demo.ts` — employer demo seed
- `backend/routes/ei-demo-seed.ts` + `backend/services/ei-demo-seed.ts` — EI demo seed
- `backend/services/capadex-signals-seeder.ts` — CAPADEX signal seed

### 5c. Frontend placeholders
- `frontend/src/pages/EmployerPortalPage.tsx` — hardcoded `jane.doe@example.com`, "Demo address" notice
- `frontend/src/components/superadmin/SimulatedDataBanner.tsx` — **good practice**: a UI banner that warns when synthetic data is shown (should be wired onto every panel in §6)
- `exam-ready/pages/LoginPage.tsx` — `parent@example.com` placeholders
- Highest `TODO/FIXME/placeholder/mock` density: `admin/AdminDialogs.tsx`, `superadmin/PricingPanel.tsx`, `career/CareerPassportTab.tsx`, `assessment/phases/IntroPhase.tsx`, `superadmin/ReportFactoryPanel.tsx`, `career/ResumeStudio.tsx`

---

## 6. Empty dashboards (panels with no data behind them)

Panels that render but whose backing tables are empty (data-starved UI):
- **Analytics:** `EnterpriseAnalyticsPanel`, `TalentAnalyticsWarehousePanel`, `ForecastAnalyticsPanel`, `TransitionAnalyticsPanel`, `CareerPathwayAnalyticsPanel`, `OccupationAnalyticsPanel`, `RecommendationAnalyticsPanel` → all `anl_*` / `ti_*` empty
- **Ontology:** `OntologyOverviewPanel`, `OntologyMatrixPanel`, `RolesPanel`, `RoleFamiliesPanel`, `IndustriesPanel`, `FunctionsPanel`, `DepartmentsPanel`, `IndicatorsPanel`, `LearningPathsOntologyPanel` → all `ont_*` / `map_*` empty
- **RIE:** `RIEDashboardPanel`, `RIEEscalationsPanel`, `RIEInterventionsPanel`, `RIEOpportunityPanel`, `RIERecommendationsPanel`, `RIERecoveryPanel` → all `rie_*` empty
- **Report Factory:** `ReportFactoryPanel` → `rf_*` empty
- **Digital Twin:** `DigitalTwinPanel`, `TalentDigitalTwinAdminPanel` → `tdt_*` empty
- **Learning:** `LearningPathsOntologyPanel`, `LearningPlansPanel`, `TalentLearningCatalogPanel` → `lip_*` empty
- **Commercial:** `PricingPanel`, `FinancialsPanel`, `CapadexPricingPanel` → `subscription_packages` / `capadex_stage_pricing` empty
- **Users/Access:** `UserMgmtPanel`, `AccessControlPanel` → `users` / `role_definitions` / `permission_definitions` empty

> Best-populated panels (real demo data): `CapadexConcernsMasterPanel`, `CapadexClarityQuestionsPanel`, `SignalOntologyHubPanel` (reference banks), the Employer/Talent panels (demo seed), `AiGovernancePanel` (`aig_*` has real monitoring rows: 2352 metrics, 296 filters, 55 alerts).

---

## 7. Prioritized gap summary (findings only — no remediation performed)

| # | Gap | Severity | Why it matters |
|---|---|---|---|
| 1 | Production deployment sets **no `FF_*` flags** → 44 features OFF in prod though ON in dev | **Critical** | Published app silently differs from the preview; "activated" features 503 |
| 2 | **0 real users / 0 real assessments**; core runtime tables not created | **Critical** | No genuine operational activity exists; all per-user data is demo |
| 3 | Runtime `Math.random()` metrics in `roie-*`, `paie-*`, `nhda-*`, `lde-*`, `m3/m4/m5/*` | **High** | Violates honesty policy — dashboards show fabricated numbers |
| 4 | ~80% of tables empty (`anl_*`, `ont_*`, `rie_*`, `lip_*`, `ti_*` namespaces) | **High** | Large swaths of UI are data-starved empty dashboards |
| 5 | v1/v2 duplicate engines (14+ pairs) | **Medium** | Maintenance debt; ambiguous authoritative path |
| 6 | Demo data must stay visibly labelled + disclosed | **Medium** | Currently labelled (`Demo Seed`, `SimulatedDataBanner`) — keep enforcing |

---

## 8. Scope note

This is an **audit only.** No routes, services, tables, flags, or UI were modified. Findings above are honest observations of the current state (Coverage = data exists vs Confidence/Activation = real usage, reported as separate axes). Demo data is clearly distinguished from real reference/config data throughout.
