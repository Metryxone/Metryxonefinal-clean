# Deliverable 1 — Personalization Consumption Matrix

Rows = the 5 consumption surfaces. Columns = personalization dimensions.
`✓`=1.0 consumed · `◑`=0.5 partial · `✗`=0.0 not · `N/A`=not applicable (excluded from denom).
See `00_README.md` for the rubric. All ratings are **code-derived** (cited), not telemetry.

Dimensions: **P** Persona/sub-persona · **S** Stage · **O** Outcome · **J** Journey ·
**B** Behaviour profile · **L** Longitudinal trend · **E** Age-band/Severity envelope.

| Surface | P | S | O | J | B | L | E | Coded depth | Live? | Live PCI |
|---------|---|---|---|---|---|---|---|-------------|-------|----------|
| **Report** | ✓ | ✗ | ✗ | ✗ | ✓ | ◑ | ✗ | **0.36** | LIVE | **0.36** |
| **Recommendation** | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | **0.43** | LIVE | **0.43** |
| **Growth Plan** | ✗ | ✓ | ✓ | ✓ | ◑ | ✗ | ✗ | **0.50** | 🔒 GATED | **0.00** |
| **Mentor** | ✗ | ◑ | ✓ | N/A | ◑ | ✗ | ✗ | **0.33** | 🔒 GATED | **0.00** |
| **Commercial Offer** | ✗ | ✓ | ◑ | ✗ | ✗ | N/A | ✗ | **0.25** | 🔒 GATED | **0.00** |

- **Coded-depth average (all 5): ≈ 0.37 (37%)** — what the code would consume if every surface ran.
- **Live PCI average (all 5): ≈ 0.16 (16%)** — what a real session gets today.
- **Activation rate: 2 / 5 (40%)** surfaces run in the default `Backend API` workflow.

### Column utilization (how widely each dimension is consumed, coded)
| Dim | Utilization | Note |
|-----|-------------|------|
| **O** Outcome | **~70%** | Best-consumed — the wiring pattern to replicate. |
| **B** Behaviour | ~60% | Reports/Recs via signals/constructs; bridges only partial. |
| **S** Stage | ~50% | Growth/Commercial full, Mentor partial; Reports/Recs ignore it. |
| **P** Persona | ~40% | Only Reports + Recs; the 3 bridges collapse persona into `outcome.models`. |
| **J** Journey | ~20% | Only Growth consumes the journey route. |
| **L** Longitudinal | ~10% | Only report strengths (CSI positive-longitudinal). |
| **E** Envelope (age/severity) | **0%** | Provenance-only; consumed by ZERO surfaces. |

## Per-cell evidence (grounded)

### Report — `services/pil/report-section-engine.ts`, `report-builder.ts`
- **P ✓** `mapStakeholder` (runtime-guidance-engine) converts actor persona/relationship into
  Student/Parent/Counselor lenses; `build{Student,Parent,Counselor}ReportSections`.
- **B ✓** "Emotional Indicators" / signals sections consume session `allSignals` + resolved archetype.
- **L ◑** strengths come from CSI positive-longitudinal only (`strength-discovery-engine.ts`,
  `report-section-engine.ts` L107) — partial, strengths-only.
- **S/O/J ✗** report runs off the **archetype/guidance lineage**, NOT the WC-3
  `getSessionStage`/`getSessionOutcomes`/`getSessionJourney`. No WC-3 routing reaches the report.
- **E ✗** age-band/severity envelope never reaches the report composer.

### Recommendation — `services/pil/recommendation-generator.ts::generateRecommendations`
- **P ✓** filters catalog by `RecStakeholder`. **O ✓** selects only where `anchor_construct ∈
  activeConstructs`. **B ✓** anchored on active constructs.
- **S/J/L/E ✗** no stage/journey/longitudinal/envelope input.

### Growth Plan — `services/wc7b/growth-plan-bridge.ts::deriveGrowthPlanActivation`
- **S/O ✓** maps `ctx.outcome.models` (canonical stages → scores). **J ✓** uses
  `ctx.journey.primary_route.route_key` as target role. **B ◑** merges real `user_competency_scores`.
- **P ✗** persona present in `DecisionContext` but unused. **L/E ✗**.

### Mentor — `services/wc7b/mentor-bridge.ts::deriveMentorActivation`
- **O ✓** `OUTCOME_MENTOR_MAP` (e.g. career_clarity → performance_coach). **S ◑** stage influences
  only indirectly. **B ◑** `CONCERN_KEYWORD_MAP` regex fallback on `ctx.concern_name`.
- **P ✗** persona unused. **J N/A** (mentor type isn't a product route). **L/E ✗**.

### Commercial Offer — `services/wc7c/{subscription-engine,offer-engine}.ts`
- **S ✓** `input.decision.stage.canonical_stage` selects the ladder rung. **O ◑** confidence/ambiguity
  gate (`HIGH_CONFIDENCE` 0.7). Safety override suppresses commerce on `crisis_escalation`.
- **P/B/E ✗** no persona/behaviour/envelope tailoring. **J ✗** offer not tied to journey product.
  **L N/A** point-in-time offer. `LADDER`/`STAGE_PRICES` are static maps (selection is personalized,
  catalog is not).

Machine-readable copy: `01_consumption_matrix.csv`.
