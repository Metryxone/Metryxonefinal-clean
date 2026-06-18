# Deliverable 3 — Personalization Gap Report

Gaps are **honest findings** grounded in code. Severity reflects Live-PCI impact.
None require new intelligence or schema changes to close (see Roadmap).

| ID | Gap | Severity | Live-PCI impact |
|----|-----|----------|-----------------|
| G1 | Consumer chain gated OFF | **Critical** | Growth+Mentor+Commercial all 0 live |
| G2 | Persona under-consumed | **High** | 3 surfaces ignore persona/sub-persona |
| G3 | Envelope (age/severity) consumed by nobody | **High** | column utilization 0% |
| G4 | Reports/Recs bypass WC-3 routing | **High** | S/O/J unread by live surfaces |
| G5 | Longitudinal trend never written/consumed | **Medium** | column utilization ~10% |
| G6 | Behaviour adapter not threaded into surfaces | **Medium** | bridges only partial behaviour |

## G1 — Consumer chain gated OFF *(Critical)*
**Evidence:** `routes/wc7b-activation.ts` returns `{enabled:false}` unless
`isDecisionOrchestratorEnabled()`; commerce additionally needs `isCommercialActivationEnabled()`
(`routes/wc7c-commercial.ts`). Neither flag is in the `Backend API` workflow.
**Effect:** Growth/Mentor/Commercial — the surfaces that DO consume Stage/Outcome/Journey — never
execute in the live flow. Stage & Journey intelligence are produced every session but have **no
live reader**.

## G2 — Persona under-consumed *(High)*
**Evidence:** `growth-plan-bridge.ts`, `mentor-bridge.ts`, `subscription-engine.ts` receive persona
in `DecisionContext` (`decision-orchestrator.ts::loadSessionCore`) but key off `outcome.models` /
concern keywords and never branch on it. `canonicalPersona` (`personalization-wiring.ts`) and the
3-track × 11-sub-persona model are unused downstream of question selection.
**Effect:** identical growth plan / mentor type / offer regardless of parent vs student vs counselor.

## G3 — Personalization envelope consumed by nobody *(High)*
**Evidence:** `buildPersonalizationEnvelope` is imported in exactly one file
(`routes/capadex-concern-intelligence.ts`), where it attaches a provenance marker;
`logPersonalizationDecision` writes append-only tables that no surface reads. The envelope notes
itself that selection is byte-identical.
**Effect:** age-band and severity — the most basic personalization axes — tune nothing downstream.

## G4 — Reports/Recs bypass WC-3 routing *(High)*
**Evidence:** the PIL report/rec path (`report-section-engine.ts`, `recommendation-generator.ts`)
runs off the archetype/guidance lineage and never calls `getSessionStage`/`getSessionOutcomes`/
`getSessionJourney`.
**Effect:** the two LIVE surfaces are personalized on content (archetype/persona/signals) but carry
no stage band, outcome trajectory, or "recommended next product/journey" — the WC-3 producers that
run every session are invisible to the user-facing output.

## G5 — Longitudinal trend never written/consumed *(Medium)*
**Evidence:** `wc3_longitudinal_trends` is created by `wc3-schema.ts` but
`longitudinal-foundation.ts` explicitly does NOT write it; only report strengths read CSI
positive-longitudinal (`strength-discovery-engine.ts`).
**Effect:** no surface tailors by "improving/declining/stable" trajectory across sessions.

## G6 — Behaviour adapter not threaded into surfaces *(Medium)*
**Evidence:** `deriveCareerBehaviorProfile` (`career-behavior-adapter.ts`) reshapes the unified
behaviour graph into readiness dimensions, but the bridges merge raw competency scores instead and
reports/recs use signals directly.
**Effect:** the richest behaviour reshape (PENALTY/BOOST readiness) doesn't reach growth/mentor/
commercial personalization.
