# Selective Dormant Engine Activation — Ledger (Task #294)

**Date:** 2026-06-30 · **Scope:** dev/workspace runtime only (`[userenv.development]`); **production stays OFF**
until separately approved.

## What this is (and is NOT)
"Dormant" = built-but-OFF. It is **not** missing and **not** debt. Activation moves an engine from *built →
running* (its routes answer instead of 503). It does **not** create runtime data and does **not** lift maturity
above Managed/L3. Each activation here is **reversible** (flag back OFF) and changes **no business logic**.

This is a **selective** activation, not a blanket switch-on. Of **87 effectively-OFF flags**, **29** were turned
ON — all of them **read-only, GET-only / probe-only, super-admin-gated, additive admin composers** that are
byte-identical-OFF and recompute nothing. The remaining **58** stay OFF with an honest reason each.

## How activation was applied + verified
- Activation method: `setEnvVars({ environment: "development" })` writes `FF_*=1` into the `[userenv.development]`
  block. The Backend API workflow (and any shell) inherits this; the production deploy (`[userenv.production]` +
  `[userenv.shared]`) does **not** — so prod remains OFF. Reverse with `deleteEnvVars` + restart.
- Verified after `restart Backend API`:
  - Backend boots clean — all route modules registered, `Server listening on 8080`, no errors.
  - Effective flag count moved **87 OFF → 58 OFF** (`listFlags()` under the live env): exactly the 29 below flipped.
  - Running process genuinely sees the flags — ungated `GET /api/global-intel/enabled` → `{"enabled":true}`.
  - Activated `/api/admin/*` routes are mounted (return **401** auth-gate unauth, not 404/500); they sit behind
    the global `/api/admin` auth gate, so authenticated super-admins now get data instead of 503.
  - No regression — baseline `/api/health` and `/api/csrf-token` still return **200**.

---

## ACTIVATE-NOW — turned ON (29)
All read-only, super-admin-gated, compose-never-recompute, no DDL on read (writes, where any, are explicit POST
that own their own ensure-schema). Byte-identical-OFF contract preserved for every untouched path.

### MX-700 Platform Lifecycle read-only tiers (6)
| Flag | Why ready |
|---|---|
| platformLifecycleManagement | Read-only mgmt tier composing the (already-ON) 1.37 Foundation; writes only via explicit POST. |
| platformLifecycleIntelligence | Read-only intelligence tier; only write is POST `/audit/capture`. |
| platformEvolutionIntelligence | Read-only evolution/debt tier; GET never writes (to_regclass probes). |
| platformLifecycleAutomation | Read-only continuous-governance checks; writes own ensure-schema. |
| platformLifecycleOperations | Frontend-exposure console; probe-only backend, zero persistence. |
| platformLifecycleCertification | Read-only certification composer; zero persistence. |

### MX-800 Intelligence engines (13)
| Flag | Why ready |
|---|---|
| platformIntelligenceRegistry | Canonical read-only registry over existing engines; flag-gate at route + service write layer. |
| engineeringIntelligence | Read-only composer (memoised repo scans); 6 separate metrics, no composite. |
| runtimeIntelligenceEngine | Read-only composer over health-aggregator + live process/OS/pg. |
| knowledgeIntelligenceEngine | Read-only knowledge-graph computed on read; proven no-write. |
| decisionIntelligenceEngine | Read-only decision-support catalog; never decides, human approval mandatory. |
| predictiveIntelligenceEngine | Read-only catalog of existing prediction caps; never invokes engines. |
| recommendationIntelligenceEngine | Read-only catalog of recommendation caps; recommend-only. |
| continuousLearningIntelligenceEngine | Read-only catalog of learning caps; learn-only, never adapts. |
| enterpriseIntelligencePlatform | Read-only capstone; memo-dedup guards fan-out, reads never write. |
| platformIntelligenceOperations | Frontend-exposure console; probe-only backend. |
| intelligenceAutomationGovernance | Read-only composer; automation_safety decides/executes = false. |
| enterpriseIntelligenceIntegration | Read-only composer integrating 14 services into one view (memoised). |
| enterpriseIntelligenceCertification | Read-only final-phase composer; production-confidence withheld by design. |

### Top-level read-only composers / consoles (10)
| Flag | Why ready |
|---|---|
| enterpriseCertification (MX-105X) | Read-only enterprise-cert composer; four axes never composited. |
| goLiveCertification (MX-106X) | Read-only go-live composer (superset of MX-105X). |
| platformCompletion (MX-108) | Read-only completion-cert + founder report composer. |
| enterpriseWorkforceConsole (MX-100X P9) | Read-only workforce-intelligence console; developmental signals only. |
| globalIntelligence (MX-76X) | Read-only global/region composer; zero DDL; honest empties. |
| competencyMatchIntelligence | Read-only competency-crosswalk composer; precise⟂operational separated. |
| competencyCoverageMatrices | Purely read-only coverage matrices; honest gaps, no DDL. |
| enterpriseGovernanceConsole | Read-only console over governance subsystem (distinct from the write subsystem governanceRbacV2). |
| tenantManagementConsole | Read-only multi-tenant architecture console; no DDL on read. |
| founderControlCenter | Read-only executive console; compose-never-recompute, GET-never-writes. |

---

## KEEP-OFF — intentionally dormant (36) — dependency / scope / risk
| Flag | Why OFF |
|---|---|
| closeTheLoop | **Owned by the Close-the-Loop Outcome Core task — explicit boundary.** |
| wc3OutcomeCrosswalk | Outcome-surface adjacent + alters live runtime; close-the-loop boundary. |
| revenueIntelligence | Commercial subsystem — business logic; owner sign-off + overlapping commercial tasks. |
| commercialEntitlement | Live entitlement enforcement — owned by "Connect entitlement framework to enforcement" task. |
| moduleAccessControl | Changes access control (business logic) — owned by access-control/entitlement tasks. |
| commercialRenewal | Commercial/renewal logic; owner sign-off. |
| commercialUpsell | Commercial/upsell logic; owner sign-off. |
| commercialLifecycleState | Commercial subscription lifecycle; owner sign-off. |
| commercialForecastInputs | Commercial forecasting; owner sign-off. |
| commercialCatalog | Product/SKU catalog — owned by "admin screen to manage products/plans/SKUs" task. |
| commercialSubscriptions | Subscription write subsystem; owner sign-off. |
| commercialRazorpayRecurring | **Payment integration** — requires owner sign-off; never auto-flip. |
| invoiceGstEngine | **Billing/GST documents** — financial/compliance; owner sign-off. |
| commercialEntitlementClasses | Entitlement model — owned by entitlement-framework task. |
| commercialUsageMetering | Quota/metering enforcement — owned by usage-limit tasks. |
| commercialRecurringRevenue | Commercial revenue; owner sign-off. |
| commercialRevenueIntelligence | Commercial revenue; owner sign-off. |
| commercialCustomerSuccess | Commercial subsystem; owner sign-off. |
| commercialValidation | Commercial-cert composer; gated with the commercial subsystem it certifies. |
| commercialArchitecture | Commercial-architecture composer; gated with the commercial subsystem. |
| tenantIsolationEnforcement | **Arms/disarms RLS + rewrites query paths** — access-control change; owner sign-off. |
| automationEngine | Autonomous action — out of scope (maturity ceiling is Managed; no unreviewed autonomy). |
| automationExecution | Autonomous execution — out of scope; risk. |
| ecosystemCommunity | Consumer-facing (forums/groups/mentorship) + new persistence — needs product/QA, not admin-read. |
| journeyTailCompletion | Owned by Task #293; consumer-facing persona journeys. |
| partnerEcosystem | Writes partner agreements/referrals — overlaps partner-export tasks; not read-only. |
| talentIntelligence | Employer-facing runtime + overlaps "hiring insights to employers" task. |
| talentFoundation | Employer talent runtime; overlaps employer tasks. |
| talentDiscovery | Employer talent discovery runtime; overlaps employer tasks. |
| employabilityMatching | Employer matching runtime; overlaps employer tasks. |
| candidateComparison | Employer-facing runtime; overlaps employer tasks. |
| shortlisting | Employer-facing runtime; overlaps employer tasks. |
| workforceIntelligence | Employer-scoped workforce runtime (distinct from the admin console activated above). |
| employerValidation | Employer-cert composer; gated with the employer subsystem it certifies. |
| employerJobStoreSync | **Writes/maps job rows** (job_postings → employer_jobs) — data mutation, not read-only. |
| notificationEngine | Sends notifications — side-effecting; needs channel config + QA. |

---

## NEEDS-WORK-FIRST — additive but activation alone is insufficient (22)
Activation would expose a pipe, but the engine needs **data / content / keys** or **targeted QA on a live
user-facing path** before a flip is meaningful or safe. Flag-flip alone never seeds data.

### Alters live candidate/report runtime — needs targeted QA before flip (12)
| Flag | Why not yet |
|---|---|
| hypothesisDrivenClarity | Changes the `/analyze` response on the live assessment path. |
| signalGroundingRuntime | Adds grounded signals to the live resolver/scoring evidence. |
| runtimeMetadataActivation | Re-ranks live clarity-question selection ordering. |
| simulationHarness | Admin harness that drives the live pipeline with simulated personas (can write). |
| wc3QuestionIntel | WC-3 runtime metadata layer on the assessment path. |
| wc3ContextIntel | WC-3 runtime context layer on the assessment path. |
| wc3ReportPersonalization | Personalises the live report output. |
| wc3RecPersonalization | Personalises live recommendations. |
| wc3LongitudinalConsumption | Consumes longitudinal data into live surfaces. |
| runtimeIntelligenceConsumption | Threads runtime intelligence into live consumption surfaces. |
| interventionIntelligence | Surfaces interventions into the live report path. |
| richBehavioralSignals | Changes the behavioral-signal substrate feeding live scoring. |

### Needs data / content / import / scheduling first (10)
| Flag | Why not yet |
|---|---|
| globalCompetency | Structural framework; creates a region overlay table but needs curated regional content (non-IN regions are honest zeros). globalIntelligence (read-only) is activated instead. |
| mx203KnowledgePopulation | Needs `OPENAI_API_KEY`/SME content to populate knowledge — no machine source to invent it. |
| onetActivation | Needs O*NET/ESCO bulk import, not a manual seed. |
| behaviourSignalBackfill | A backfill job that writes data — needs an explicit, reviewed run. |
| longitudinalAutomation | Automation needing longitudinal data + scheduling. |
| roleDnaExpansion | Needs expanded Role-DNA data rows. |
| competencySkillIntelligence | Needs skill-intelligence content/substrate. |
| competencySpineContracts | Needs contract definitions + verification. |
| careerBuilderActivation | Activation touches the consumer Career Builder path — needs QA. |
| assessmentReadiness | Needs readiness substrate/data to be meaningful. |

---

## Reversibility
- Per-flag: `deleteEnvVars({ keys: ["FF_<NAME>"], environment: "development" })` + restart Backend API → 503 again.
- The whole set lives in `[userenv.development]`; removing those lines restores the prior 87-OFF state byte-identically.

## Honest summary
- **29 ON** (read-only admin intelligence/governance/lifecycle composers) · **36 KEEP-OFF** (boundary / commercial /
  payment / enforcement / autonomous / consumer / employer-runtime / other-task) · **22 NEEDS-WORK-FIRST** (live-path
  QA or data/content/keys required). 29 + 36 + 22 = **87**.
- No outcome / KPI / re-measurement engine was touched (Close-the-Loop boundary kept clean).
- No fabricated "all green": activation exposes pipes; data, adoption, and maturity are unchanged.
