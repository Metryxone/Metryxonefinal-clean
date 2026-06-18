# Feature Flag Inventory — MetryxOne

**Date:** 2026-06-17
**Type:** Read-only audit. No code modified.
**Sources:** `backend/config/feature-flags.ts`, `.replit` (`[workflows]` + `[deployment]` + `[userenv]`), `backend/services/feature-flags.ts`, route-file `process.env.FF_*` reads.

---

## How flags resolve (mechanics)

There are **three distinct flag mechanisms** in this codebase:

1. **Registry (primary)** — `backend/config/feature-flags.ts`. **72 flags** (29 default `true`, 43 default `false`). Each is overridable by an env var named `FF_<UPPER_SNAKE_CASE(key)>` (e.g. `wc3Stage` → `FF_WC3_STAGE`, `aiGovernance` → `FF_AI_GOVERNANCE`). Resolution: `envOverride ?? registryDefault`. Accepted truthy: `true|1|yes|on`; falsy: `false|0|no|off`.
2. **Raw `process.env` gates (not in registry)** — four flags read directly in route files, with no registry default: `FF_CAREER_GRAPH`, `FF_LEARNING_INTELLIGENCE`, `FF_COMPETENCY_INTELLIGENCE`, `FF_FUTURE_READINESS`. **Absent env var = OFF (503).** No default-on fallback.
3. **DB table (`feature_flags` + `feature_flag_tenant_overrides`)** — `backend/services/feature-flags.ts`, in-memory cache. Gates signal ingest + some engine flags. **Table holds 10 rows, all `enabled=false`** (0 enabled); `feature_flag_tenant_overrides` holds 0 rows. So any consumer relying on it gets **no DB-enabled flag** (rows exist but none are on). Measured `select count(*) from feature_flags` = 10; `count(*) filter (where enabled)` = 0.

### The three environments
| Environment | What runs | Flag source |
|---|---|---|
| **Development** | `Backend API` workflow (`.replit [[workflows.workflow]]`) | Registry defaults **+ 28 `FF_*=1` overrides** baked into the workflow command |
| **Preview** | The webview pane proxies the **same dev workflow process** (no separate runtime/env) | **Identical to Development** |
| **Production** | `.replit [deployment].run` = `bash -c "cd backend && NODE_ENV=production npx tsx index.ts"` | Registry defaults **only** — **zero `FF_*` overrides** in the run command or in `[userenv.production]`/`[userenv.shared]` |

> ⚠️ **Verification caveat (honesty):** "Production sets no `FF_*`" is confirmed against **all visible configuration** (`.replit` run command + `[userenv]`). Replit **Deployment-pane** environment variables/secrets are *not* introspectable from the repository, so I cannot cryptographically prove none exist there. **Owner attestation required** to fully close this. The rest of this report assumes prod = registry defaults (the only state derivable from visible config).

### Dev workflow `FF_*` overrides (28 total)
23 of them flip **default-`false` registry flags ON**; 1 (`FF_MEMORY_INTELLIGENCE`) redundantly re-asserts a default-`true` flag; **4 are non-registry `process.env` gates** (`FF_CAREER_GRAPH`, `FF_LEARNING_INTELLIGENCE`, `FF_COMPETENCY_INTELLIGENCE`, `FF_FUTURE_READINESS`).

---

## A. Registry flags — DEFAULT TRUE (29) → ON in Dev/Preview/Prod

These are ON everywhere (no env override needed). **No parity gap.**

| # | Flag | Env Var | Default | Dev | Preview | Prod |
|---|---|---|---|---|---|---|
| 1 | advancedCompetencyRuntimeV2 | FF_ADVANCED_COMPETENCY_RUNTIME_V2 | true | ON | ON | ON |
| 2 | adaptiveAssessmentRuntimeV2 | FF_ADAPTIVE_ASSESSMENT_RUNTIME_V2 | true | ON | ON | ON |
| 3 | contextualScoringV2 | FF_CONTEXTUAL_SCORING_V2 | true | ON | ON | ON |
| 4 | workforceOSV2 | FF_WORKFORCE_O_S_V2 | true | ON | ON | ON |
| 5 | adaptiveOrchestrationV2 | FF_ADAPTIVE_ORCHESTRATION_V2 | true | ON | ON | ON |
| 6 | aiInferenceV2 | FF_AI_INFERENCE_V2 | true | ON | ON | ON |
| 7 | predictiveIntelligenceV2 | FF_PREDICTIVE_INTELLIGENCE_V2 | true | ON | ON | ON |
| 8 | governanceScienceV2 | FF_GOVERNANCE_SCIENCE_V2 | true | ON | ON | ON |
| 9 | enterpriseWorkforceOSV2 | FF_ENTERPRISE_WORKFORCE_O_S_V2 | true | ON | ON | ON |
| 10 | ucipEnabled | FF_UCIP_ENABLED | true | ON | ON | ON |
| 11 | ucipShadowMode | FF_UCIP_SHADOW_MODE | true | ON | ON | ON |
| 12 | adaptiveIntelligenceFoundation | FF_ADAPTIVE_INTELLIGENCE_FOUNDATION | true | ON | ON | ON |
| 13 | roleDNARuntimeEnabled | FF_ROLE_D_N_A_RUNTIME_ENABLED | true | ON | ON | ON |
| 14 | functionalCompetencySeeding | FF_FUNCTIONAL_COMPETENCY_SEEDING | true | ON | ON | ON |
| 15 | contextualCompetencyResolution | FF_CONTEXTUAL_COMPETENCY_RESOLUTION | true | ON | ON | ON |
| 16 | competencyGraphRuntime | FF_COMPETENCY_GRAPH_RUNTIME | true | ON | ON | ON |
| 17 | adaptiveBlueprintRuntime | FF_ADAPTIVE_BLUEPRINT_RUNTIME | true | ON | ON | ON |
| 18 | competencyPropagation | FF_COMPETENCY_PROPAGATION | true | ON | ON | ON |
| 19 | dynamicQuestionGeneration | FF_DYNAMIC_QUESTION_GENERATION | true | ON | ON | ON |
| 20 | adaptiveQuestionBranching | FF_ADAPTIVE_QUESTION_BRANCHING | true | ON | ON | ON |
| 21 | cognitiveRuntimeEnabled | FF_COGNITIVE_RUNTIME_ENABLED | true | ON | ON | ON |
| 22 | adaptiveRuntimeAuthority | FF_ADAPTIVE_RUNTIME_AUTHORITY | true | ON | ON | ON |
| 23 | competencyFusionEnabled | FF_COMPETENCY_FUSION_ENABLED | true | ON | ON | ON |
| 24 | contextualScoringAuthority | FF_CONTEXTUAL_SCORING_AUTHORITY | true | ON | ON | ON |
| 25 | intelligenceNarratives | FF_INTELLIGENCE_NARRATIVES | true | ON | ON | ON |
| 26 | continuousCompetencyMemory | FF_CONTINUOUS_COMPETENCY_MEMORY | true | ON | ON | ON |
| 27 | employabilityPassport | FF_EMPLOYABILITY_PASSPORT | true | ON | ON | ON |
| 28 | adaptiveQuestioning | FF_ADAPTIVE_QUESTIONING | true | ON | ON | ON |
| 29 | memoryIntelligence | FF_MEMORY_INTELLIGENCE | true | ON (also re-set =1) | ON | ON |

> Note: the env-var column reflects the literal `replace(/([A-Z])/g,'_$1')` algorithm — hence `FF_WORKFORCE_O_S_V2`, `FF_ROLE_D_N_A_RUNTIME_ENABLED` (acronyms get per-letter underscores). These are the actual names that would override them.

---

## B. Registry flags — DEFAULT FALSE, flipped ON in Dev/Preview only (23) → **PARITY GAP**

**ON in Dev & Preview (via workflow `FF_*=1`), but OFF in Production (no override).** This is the core production-parity gap.

| # | Flag | Env Var (set in dev workflow) | Default | Dev | Preview | Prod |
|---|---|---|---|---|---|---|
| 1 | runtimeIntelligenceActivation | FF_RUNTIME_INTELLIGENCE_ACTIVATION | false | **ON** | **ON** | **OFF** |
| 2 | runtimeIntelligencePipeline | FF_RUNTIME_INTELLIGENCE_PIPELINE | false | **ON** | **ON** | **OFF** |
| 3 | wc3Stage | FF_WC3_STAGE | false | **ON** | **ON** | **OFF** |
| 4 | wc3Personalization | FF_WC3_PERSONALIZATION | false | **ON** | **ON** | **OFF** |
| 5 | wc3Longitudinal | FF_WC3_LONGITUDINAL | false | **ON** | **ON** | **OFF** |
| 6 | wc3Outcome | FF_WC3_OUTCOME | false | **ON** | **ON** | **OFF** |
| 7 | wc3Journey | FF_WC3_JOURNEY | false | **ON** | **ON** | **OFF** |
| 8 | decisionOrchestrator | FF_DECISION_ORCHESTRATOR | false | **ON** | **ON** | **OFF** |
| 9 | journeyGrowthPlanBridge | FF_JOURNEY_GROWTH_PLAN_BRIDGE | false | **ON** | **ON** | **OFF** |
| 10 | decisionMentorBridge | FF_DECISION_MENTOR_BRIDGE | false | **ON** | **ON** | **OFF** |
| 11 | commercialActivation | FF_COMMERCIAL_ACTIVATION | false | **ON** | **ON** | **OFF** |
| 12 | commercialEntitlementEnforcement | FF_COMMERCIAL_ENTITLEMENT_ENFORCEMENT | false | **ON** | **ON** | **OFF** |
| 13 | decisionPersistence | FF_DECISION_PERSISTENCE | false | **ON** | **ON** | **OFF** |
| 14 | behaviourNamespaceAlignment | FF_BEHAVIOUR_NAMESPACE_ALIGNMENT | false | **ON** | **ON** | **OFF** |
| 15 | userIntelligenceFoundation | FF_USER_INTELLIGENCE_FOUNDATION | false | **ON** | **ON** | **OFF** |
| 16 | trendIntelligence | FF_TREND_INTELLIGENCE | false | **ON** | **ON** | **OFF** |
| 17 | behaviourTrendIntelligence | FF_BEHAVIOUR_TREND_INTELLIGENCE | false | **ON** | **ON** | **OFF** |
| 18 | forecastIntelligence | FF_FORECAST_INTELLIGENCE | false | **ON** | **ON** | **OFF** |
| 19 | careerPassport | FF_CAREER_PASSPORT | false | **ON** | **ON** | **OFF** |
| 20 | reportFactory | FF_REPORT_FACTORY | false | **ON** | **ON** | **OFF** |
| 21 | enterpriseAnalytics | FF_ENTERPRISE_ANALYTICS | false | **ON** | **ON** | **OFF** |
| 22 | aiGovernance | FF_AI_GOVERNANCE | false | **ON** | **ON** | **OFF** |
| 23 | eiosWorldClassVerifiedV2 | FF_EIOS_WORLD_CLASS_VERIFIED_V2 | false | **ON** | **ON** | **OFF** |

---

## C. Registry flags — DEFAULT FALSE, OFF everywhere (20)

Not set by any environment → OFF in Dev, Preview, and Prod (consistent — **no parity gap**, but dormant features).

| # | Flag | Env Var | Default | Dev | Preview | Prod |
|---|---|---|---|---|---|---|
| 1 | hypothesisDrivenClarity | FF_HYPOTHESIS_DRIVEN_CLARITY | false | OFF | OFF | OFF |
| 2 | simulationHarness | FF_SIMULATION_HARNESS | false | OFF | OFF | OFF |
| 3 | signalGroundingRuntime | FF_SIGNAL_GROUNDING_RUNTIME | false | OFF | OFF | OFF |
| 4 | runtimeMetadataActivation | FF_RUNTIME_METADATA_ACTIVATION | false | OFF | OFF | OFF |
| 5 | wc3QuestionIntel | FF_WC3_QUESTION_INTEL | false | OFF | OFF | OFF |
| 6 | wc3ContextIntel | FF_WC3_CONTEXT_INTEL | false | OFF | OFF | OFF |
| 7 | wc3OutcomeCrosswalk | FF_WC3_OUTCOME_CROSSWALK | false | OFF | OFF | OFF |
| 8 | runtimeIntelligenceConsumption | FF_RUNTIME_INTELLIGENCE_CONSUMPTION | false | OFF | OFF | OFF |
| 9 | longitudinalAutomation | FF_LONGITUDINAL_AUTOMATION | false | OFF | OFF | OFF |
| 10 | behaviourSignalBackfill | FF_BEHAVIOUR_SIGNAL_BACKFILL | false | OFF | OFF | OFF |
| 11 | revenueIntelligence | FF_REVENUE_INTELLIGENCE | false | OFF | OFF | OFF |
| 12 | commercialEntitlement | FF_COMMERCIAL_ENTITLEMENT | false | OFF | OFF | OFF |
| 13 | commercialRenewal | FF_COMMERCIAL_RENEWAL | false | OFF | OFF | OFF |
| 14 | commercialUpsell | FF_COMMERCIAL_UPSELL | false | OFF | OFF | OFF |
| 15 | commercialLifecycleState | FF_COMMERCIAL_LIFECYCLE_STATE | false | OFF | OFF | OFF |
| 16 | commercialForecastInputs | FF_COMMERCIAL_FORECAST_INPUTS | false | OFF | OFF | OFF |
| 17 | wc3ReportPersonalization | FF_WC3_REPORT_PERSONALIZATION | false | OFF | OFF | OFF |
| 18 | wc3RecPersonalization | FF_WC3_REC_PERSONALIZATION | false | OFF | OFF | OFF |
| 19 | wc3LongitudinalConsumption | FF_WC3_LONGITUDINAL_CONSUMPTION | false | OFF | OFF | OFF |
| 20 | interventionIntelligence | FF_INTERVENTION_INTELLIGENCE | false | OFF | OFF | OFF |

---

## D. Non-registry `process.env` gates (4) → **PARITY GAP**

Read directly in route files (no registry default; **absent = OFF/503**). Set `=1` in the dev workflow, absent in prod.

| # | Env Var | Gated surfaces (examples) | Dev | Preview | Prod |
|---|---|---|---|---|---|
| 1 | FF_CAREER_GRAPH | `career-graph.ts`, `career-pathways-intelligence.ts`, `vx-workforce-knowledge-graph.ts`, and ~8 `talent-*.ts` (digital-twin, signal-master, scoring, concern-intelligence, readiness-engine, competency-dna…) | **ON** | **ON** | **OFF (503)** |
| 2 | FF_LEARNING_INTELLIGENCE | `lbi-intelligence.ts`, `lip.ts`, `lbi-unifier.ts` | **ON** | **ON** | **OFF (503)** |
| 3 | FF_COMPETENCY_INTELLIGENCE | `competency-intelligence-engine.ts` (D1–D10 + E1–E5) | **ON** | **ON** | **OFF (503)** |
| 4 | FF_FUTURE_READINESS | `frp.ts` (Future Readiness Platform) | **ON** | **ON** | **OFF (503)** |

---

## E. DB flag system (`feature_flags` table)

- Service: `backend/services/feature-flags.ts` (in-memory cache, 30s-ish refresh).
- Table `feature_flags`: **10 rows, all `enabled=false`** (0 enabled); `feature_flag_tenant_overrides`: 0 rows. The 10 keys (all phase1, all OFF): `adaptive_questioning`, `cognitive_load_engine`, `confidence_engine`, `contradiction_detection`, `dynamic_reporting`, `hypothesis_engine`, `interventions`, `longitudinal_memory`, `signal_intelligence`, `websocket_runtime`.
- Consumers (e.g. `POST /api/signals/ingest` `signal_intelligence`, engine flags) get **no DB-enabled flag** in any environment (rows exist but none are on) → identical (empty) behaviour Dev/Preview/Prod. **No parity gap** (consistent), but also nothing activated here.

---

## Totals

| Category | Count | Parity status |
|---|---|---|
| Registry flags | 72 (29 true / 43 false) | — |
| ON everywhere (default-true) | 29 | ✅ consistent |
| ON Dev+Preview / OFF Prod (default-false, dev-overridden) | 23 | ❌ **divergent** |
| OFF everywhere (default-false, no override) | 20 | ✅ consistent (dormant) |
| Non-registry `process.env` gates | 4 | ❌ **divergent** |
| DB-table flags (rows / enabled) | 10 rows / **0 enabled** | ✅ consistent (none active) |

**27 flag-controlled feature sets (23 registry + 4 process.env) behave differently in Production than in Dev/Preview.** Detail and per-product impact in `feature_activation_matrix.md` and `production_parity_report.md`.
