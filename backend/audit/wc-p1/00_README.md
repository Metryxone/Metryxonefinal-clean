# WC-P1 — Personalization Consumption Audit

**Type:** Audit only. No implementation, no schema changes. All roadmap/plan items below
are PROPOSALS that require approval before any build.

**Objective:** Raise *consumed* Personalization Intelligence toward 90%+ by closing
**consumption / activation** gaps over the EXISTING personalization stack — not by building
new intelligence.

## Scope — the 8 existing subsystems audited
| # | Subsystem (producer) | Primary file | Public entry |
|---|----------------------|--------------|--------------|
| 1 | Personalization Engine (envelope + persona) | `services/wc3/personalization-wiring.ts` | `buildPersonalizationEnvelope`, `logPersonalizationDecision` |
| 2 | Behaviour Adapters | `services/career-behavior-adapter.ts` | `deriveCareerBehaviorProfile` |
| 3 | Stage Intelligence | `services/wc3/stage-intelligence.ts` | `getSessionStage` |
| 4 | Outcome Intelligence | `services/wc3/outcome-intelligence.ts` | `getSessionOutcomes` |
| 5 | Journey Intelligence | `services/wc3/journey-intelligence.ts` | `getSessionJourney` |
| 6 | Growth Plans | `services/wc7b/growth-plan-bridge.ts` | `deriveGrowthPlanActivation` |
| 7 | Mentor Intelligence | `services/wc7b/mentor-bridge.ts` | `deriveMentorActivation` |
| 8 | Commercial Intelligence | `services/wc7c/{subscription-engine,offer-engine}.ts` | `deriveSubscriptionActivation`, `deriveOfferActivation` |

The 5 **consumption surfaces** measured: Reports, Recommendations, Growth Plan, Mentor,
Commercial Offer.

## Methodology (honest, reproducible — NOT telemetry)
There is no personalization-consumption telemetry in the codebase, so every number below is
**derived from reading the code** (which dimensions each surface actually consumes) and from
the **runtime feature-flag state** of the running `Backend API` workflow. Numbers are
estimates with an explicit rubric; they are not measured from production traffic.

**Personalization dimensions (the columns of the matrix):**
`P` Persona/sub-persona · `S` Stage · `O` Outcome model · `J` Journey route ·
`B` Behaviour profile · `L` Longitudinal trend · `E` Age-band/Severity envelope.

**Cell rubric:** `✓`=1.0 consumed · `◑`=0.5 partial · `✗`=0.0 not consumed ·
`N/A`=dimension not meaningfully applicable to that surface (excluded from denominator).

**Two coverage metrics are reported separately (this is the whole story):**
- **Coded depth** = mean cell score over a surface's applicable dimensions — *what the code
  would consume if it ran.*
- **Live PCI (Personalization Consumption Index)** = coded depth × **activation** (1.0 if the
  surface runs in the default runtime workflow, 0 if flag-gated OFF) — *what a real session
  gets today.*

## Headline findings (grounded)
- **Production capability is mature (~80%, prior WC scoring — not re-measured here); CONSUMPTION
  is the gap.** Coded depth ≈ **37%**; **Live PCI ≈ 16%**.
- **Dominant cause = flag-gated activation (two-level).** 3 of 5 surfaces (Growth, Mentor, Commercial)
  consume Stage/Outcome/Journey but ride the WC-7B activation envelope gated by
  `isDecisionOrchestratorEnabled()` AND each bridge's own gate (`journeyGrowthPlanBridge`,
  `decisionMentorBridge`, `commercialActivation` — all **OFF** and absent from the running workflow).
  Turning on the orchestrator alone leaves each slot `bridge_disabled`. **Activation rate = 2/5 (40%).**
- **Persona is under-consumed:** only the two content surfaces (Reports, Recs) use it; the three
  bridges collapse persona into `outcome.models` and ignore the 3-track × 11-sub-persona model
  and `canonical_persona`.
- **The personalization envelope (age-band/severity) is consumed by ZERO surfaces** — it is
  provenance-only (`buildPersonalizationEnvelope` attaches a marker; selection stays
  byte-identical) and consumed in exactly one place (`routes/capadex-concern-intelligence.ts`).
- **Longitudinal is nearly unused (~10%):** `wc3_longitudinal_trends` is created by schema but
  never written/consumed; only report strengths read CSI positive-longitudinal.
- **Outcome Intelligence is the best-consumed dimension (~70%)** — the wiring pattern to copy.

## Deliverables in this folder
1. `01_consumption_matrix.{md,csv}` — Personalization Consumption Matrix
2. `02_runtime_usage_report.md` — Runtime Usage Report (flags / routes / live state)
3. `03_personalization_gap_report.md` — Gap Report (G1…G6, severity, evidence)
4. `04_activation_roadmap.md` — Activation Roadmap (ordered, additive, flag-gated, no schema)
5. `05_90pct_personalization_plan.md` — 90%+ Plan (target matrix + expected lift)
