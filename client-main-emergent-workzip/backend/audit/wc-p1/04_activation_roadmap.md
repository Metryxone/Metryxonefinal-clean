# Deliverable 4 — Activation Roadmap

Ordered, **additive, flag-gated, no-schema** consumption work to close G1–G6. Every item
**reuses existing producers** — no new intelligence. PROPOSAL ONLY; requires approval.
Each lever is independently reversible (flag OFF → byte-identical legacy).

## Lever A — Activate the consumer chain (closes G1) — *do first, highest ROI*
Surface the already-built WC-7B/7C activation envelope in the live post-completion flow so
Growth/Mentor/Commercial actually run.
- **No new code paths** — read the existing `GET /api/capadex/session/:id/activation` from the live
  report/result surface and enable the existing flags. Gating is **two-level**, so ALL of these must
  be ON (not the orchestrator alone):
  - `decisionOrchestrator` (`FF_DECISION_ORCHESTRATOR`) — the envelope itself; AND
  - `journeyGrowthPlanBridge` (`FF_JOURNEY_GROWTH_PLAN_BRIDGE`) — else growthPlan = `bridge_disabled`;
  - `decisionMentorBridge` (`FF_DECISION_MENTOR_BRIDGE`) — else mentor = `bridge_disabled`;
  - `commercialActivation` (`FF_COMMERCIAL_ACTIVATION`) — for the commercial slots.
- Realizes existing coded depth: Growth 0→0.50, Mentor 0→0.33, Commercial 0→0.25 live.
- Risk: low — gates already return byte-identical legacy when OFF; bridges are read-only/never-500.

## Lever B — Persona + envelope injection (closes G2, G3)
Thread `canonical_persona`/sub-persona and the age-band/severity envelope (already in
`DecisionContext` / `personalization-wiring`) into the three bridges and into report/rec selection.
- Growth/Mentor/Commercial: branch templates on persona (parent vs student vs counselor) instead of
  collapsing to `outcome.models`; gate offer copy/intensity by age-band/severity.
- Reports/Recs: use sub-persona granularity + age-band already resolved upstream.
- Reuses `canonicalPersona`, `buildPersonalizationEnvelope`; no new producers.

## Lever C — WC-3 routing into Reports & Recs (closes G4)
Attach `getSessionStage` / `getSessionOutcomes` / `getSessionJourney` (all computed live today) to
the PIL report/rec composition as additive sections ("your stage", "your outcome trajectory",
"recommended next step/journey").
- Read-only composition; no change to archetype lineage; additive sections only.

## Lever D — Longitudinal consumption (closes G5, partially G6)
Consume the EXISTING longitudinal foundation (CSI positive-longitudinal + `wc3_longitudinal_snapshots`
already written) as a trend signal in reports/recs/growth — without adding the unused
`wc3_longitudinal_trends` writer beyond what's needed and **with no schema change**.
- First-session sessions degrade honestly to "no trend yet" (never fabricate a trajectory).
- Thread `deriveCareerBehaviorProfile` readiness into bridges to finish G6.

## Sequencing & dependencies
```
A (activation)  ──► B (persona/envelope) ──► D (longitudinal/behaviour)
                └─► C (WC-3 into reports/recs)
```
A is prerequisite for B/D on the bridge surfaces (they must run before they can consume more).
C is independent of A (operates on the already-live report/rec surfaces) and can land in parallel.

## Guardrails (unchanged conventions)
- Every lever behind its existing flag; flag OFF → byte-identical legacy.
- Honest degradation: missing persona/trend/stage → omit, never fabricate.
- No schema changes; no new tables; read-only composition over existing producers.
