# WC-11 — Report 1: Decision Intelligence

**Layer 4 = Journey → Decision → Activation.** The Decision layer composes the three already-derived
WC-3 layers into ONE unified decision (stage + primary outcome + route + unified confidence +
ambiguity + grounded `why[]`), which then drives all four activations.

## Decision Intelligence (3-layer composite) — PRIMARY success metric
`Decision Intelligence = mean(L1 Stage coverage, L2 Outcome coverage, L3 Journey coverage)` over the
**30638**-question clarity bank, resolved through the SAME engines the runtime uses.

| Layer | Coverage |
|-------|----------|
| L1 Stage (primary_stage resolved) | 30638 (100%) |
| L2 Outcome (reaches an outcome model) | 26233 (85.6%) |
| L3 Journey (reaches a non-degraded route) | 26233 (85.6%) |
| **Decision Intelligence (mean)** | **90.4%** |

- Target: **Decision Intelligence > 90%**. Achieved: **90.4%** — ✅ exceeds 90%.
- This sits at the construct-reachability ceiling: with L1 at 100% and L2/L3 each capped at the
  construct ceiling (85.6%), the maximum composite = (100 + 85.6 + 85.6) / 3 = **90.4%**.
  Exceeding it requires reducing the UNMAPPED bridge-tag set — a separate, approval-gated crosswalk
  phase, **explicitly OUT OF SCOPE** ("no new ontology / constructs / journey routes").

## What WC-11 actually built (honest attribution)
- Components #1–#4 (Runtime Decision Object `UnifiedDecision`, weighted-blend Decision Confidence,
  `composeDecision`/`buildActivationEnvelope` Composition, grounded `why[]` Explainability) ALREADY
  existed in WC-7B/WC-7C and were **read-only / flag-OFF by default**. WC-11 **activated** them by
  setting their flags in the Backend API workflow ENV (`FF_DECISION_ORCHESTRATOR=1`,
  `FF_JOURNEY_GROWTH_PLAN_BRIDGE=1`, `FF_DECISION_MENTOR_BRIDGE=1`, `FF_COMMERCIAL_ACTIVATION=1`) —
  the code-level defaults in `feature-flags.ts` remain OFF (reversible: drop the env to revert). WC-11
  added the one genuinely-new component:
- **#5 Decision Persistence** — `services/wc7b/decision-persistence.ts` + lazy `wc7b_decision_state`
  (one row/session) wired non-blocking into `postCompletionHooks` behind `FF_DECISION_PERSISTENCE`.
  The orchestrator stays byte-identical (read-only); persistence is a separate write step that
  snapshots the already-composed decision (mirrors `resolveSessionOutcomes`).

## Measurement context (runtime flag state when this report was generated)
`decisionOrchestrator=ON, journeyGrowthPlanBridge=ON, decisionMentorBridge=ON, commercialActivation=ON, decisionPersistence=ON`
- The bank-level Decision Intelligence (90.4%) is flag-INDEPENDENT — it resolves the clarity bank
  directly through `projectOutcome`/`projectJourney`, so it is identical regardless of flags.
- The **session-level** activation numbers (Reports 4–6) come from the flag-gated bridges inside
  `buildActivationEnvelope`. They reflect the ACTIVATED runtime only when the bridges are ON
  (✅ all bridges ON for this run). Run via the Backend API workflow env to reproduce the activated state.

Discipline: additive, reversible, flag-gated, read-only measurement (no DATA writes / no migrations /
no new ontology; the shared WC-3 getters run only idempotent ensure-schema DDL, a no-op on the live DB).
Nothing fabricated.
