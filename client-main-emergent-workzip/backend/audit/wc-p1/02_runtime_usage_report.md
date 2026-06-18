# Deliverable 2 — Runtime Usage Report

What actually runs in the **default `Backend API` workflow**, which flags gate each surface, and
which route invokes it. Flags are read from `config/feature-flags.ts`; runtime state is the env
set in the `Backend API` workflow command.

## Running-workflow flag state
The `Backend API` workflow sets ON:
`FF_RUNTIME_INTELLIGENCE_ACTIVATION`, `FF_RUNTIME_INTELLIGENCE_PIPELINE`, `FF_WC3_STAGE`,
`FF_WC3_OUTCOME`, `FF_WC3_JOURNEY`, `FF_WC3_PERSONALIZATION`, `FF_WC3_LONGITUDINAL`.

**NOT set (default OFF):** `FF_DECISION_ORCHESTRATOR` (`decisionOrchestrator`),
`FF_COMMERCIAL_ACTIVATION` (`commercialActivation`), `FF_JOURNEY_GROWTH_PLAN_BRIDGE`
(`journeyGrowthPlanBridge`), `FF_DECISION_MENTOR_BRIDGE` (`decisionMentorBridge`),
`FF_WC3_OUTCOME_CROSSWALK`, `FF_WC3_QUESTION_INTEL`, `FF_WC3_CONTEXT_INTEL`.

> **Two-level gating (important):** the activation envelope as a whole is gated by
> `isDecisionOrchestratorEnabled()`, AND each consuming bridge has its OWN independent gate.
> With the orchestrator ON but a bridge flag OFF, `decision-orchestrator.ts` emits an honest
> `{ready:false, reason:'bridge_disabled'}` for that slot (growthPlan L240, mentor L250). So
> turning on the orchestrator alone does **not** make Growth/Mentor live.

## Per-surface runtime usage
| Surface | Invoking route | Gate(s) | Live in workflow? |
|---------|----------------|---------|-------------------|
| Report | `GET /api/capadex/session/:id/report` (`routes/capadex.ts`, `report-builder.ts`) | `isRuntimeIntelligenceActivationEnabled()` | **YES** (flag ON) |
| Recommendation | `recommendation-builder.ts` via runtime pipeline (`routes/capadex.ts`) | `isRuntimeIntelligenceActivationEnabled()` | **YES** (flag ON) |
| Growth Plan | `GET /api/capadex/session/:id/activation` (`routes/wc7b-activation.ts`) → `deriveGrowthPlanActivation` | `isDecisionOrchestratorEnabled()` **AND** `isJourneyGrowthPlanBridgeEnabled()` | **NO** (both OFF; OFF→`bridge_disabled`) |
| Mentor | same activation envelope → `deriveMentorActivation` | `isDecisionOrchestratorEnabled()` **AND** `isDecisionMentorBridgeEnabled()` | **NO** (both OFF; OFF→`bridge_disabled`) |
| Commercial | rides the **same** activation envelope `GET /api/capadex/session/:id/activation` (commercial slots layered on by `routes/wc7c-commercial.ts`; no separate offer/subscription route) | `isDecisionOrchestratorEnabled()` **AND** `isCommercialActivationEnabled()` | **NO** (both OFF) |

## Runtime usage of the 8 producers
| Producer | Written at runtime? | Read at runtime? |
|----------|--------------------|--------------------|
| Personalization Engine | YES — `logPersonalizationDecision` writes `wc3_personalization_decisions/_profile` | **Provenance only** — read by no surface; selection stays byte-identical |
| Behaviour Adapter (`career-behavior-adapter`) | derived on demand | Read by career-builder consumers; **not** by reports/recs/bridges directly |
| Stage Intelligence | YES (`FF_WC3_STAGE` ON) | Read **only** by the gated decision-orchestrator → effectively unread live |
| Outcome Intelligence | YES (`FF_WC3_OUTCOME` ON) | Read by the gated bridges; recs use construct anchors (parallel path) |
| Journey Intelligence | YES (`FF_WC3_JOURNEY` ON) | Read **only** by the gated decision-orchestrator → effectively unread live |
| Growth/Mentor/Commercial bridges | — | Gated OFF — not invoked in the live flow |
| Longitudinal | snapshots written (`FF_WC3_LONGITUDINAL` ON); `wc3_longitudinal_trends` **never written** | only report strengths read CSI positive-longitudinal |

## Single most important runtime fact
The WC-3 Stage/Outcome/Journey producers are **computed and persisted every session** (their flags
are ON), but their only live reader — the decision-orchestrator — is **gated OFF**, and even with it
ON each bridge has a **second independent gate** (`journeyGrowthPlanBridge`, `decisionMentorBridge`,
`commercialActivation`, all OFF). So the data is **produced-but-not-consumed**: the three richest
consuming surfaces (Growth, Mentor, Commercial) never run, and the two live surfaces (Report, Recs)
don't read the WC-3 producers at all. This is why Live PCI (16%) is far below coded depth (37%) and
below production capability (~80%). **Activation therefore requires turning on BOTH the orchestrator
AND each per-bridge flag — not the orchestrator alone.**
