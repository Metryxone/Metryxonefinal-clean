# WC-2 · Output 4 — Outcome Intelligence Framework

> Design + honest measurement. Defines outcome models as compositions over **existing** intelligence
> (CSI, behaviour graph, readiness, recommendations). No new engines built; no enrichment.

## Scorecard

| Field | Value |
|---|---|
| **Current Score** | **42 / 100** |
| **Stated WC-2 Target** | > 85 |
| **Realistic Target Band** | **82–88** (design-reachable — composes existing intelligence) |
| **Gap (to realistic band)** | ~40–46 points |
| **Evidence** | CAPADEX produces scores, CSI, patterns, library-backed interventions, and explainability lineage — but **not** formal outcome models with current-state → desired-state → gap → expected-progression. Outcomes today are *implicit in scores*, not first-class. |
| **Root Cause** | The platform is **score-centric, not outcome-centric**. The intelligence to compose outcomes exists; the outcome *layer* does not. |
| **Estimated Effort** | Medium (compose-only over existing signals; "Exam Readiness" partially blocked by the context-corpus gap). |
| **Expected Impact** | Converts diagnostics into actionable, explainable trajectories — the core of "world-class development platform" vs "diagnostic engine". |

### Ceiling note
**> 85** is honestly reachable for 5 of 6 outcome models because they compose existing intelligence.
**Exam Readiness is gated** by the Academic/Competitive context-corpus gap (routes 0 today) — its
realistic near-term band is **60–70** until the corpus is authored (Wave 4).

## Phase 1 — Outcome models (definitions, composed from existing signals)

| Outcome model | Composed from (existing) | Current readiness |
|---|---|---|
| **Career Clarity** | CSI + behaviour graph + career-behavior-adapter | Good (Career Builder consumes it) |
| **Learning Effectiveness** | signals/patterns + longitudinal memory | Moderate (LBI not yet integrated) |
| **Employability Readiness** | readiness signals + passport | Moderate |
| **Exam Readiness** | exam context + behaviour | **Low — corpus gap** |
| **Confidence Stability** | CONFIDENCE_SELF signals + longitudinal drift/resilience | Moderate |
| **Decision Quality** | THINKING_QUALITY + overthinking/indecisiveness composites | Moderate |

## Phase 2 — `outcome_intelligence_framework` (per-outcome contract)

Each outcome resolves to a five-part structure (compose-only, read-only):

```
Current State    ← stored scores / CSI / patterns (no recompute)
Desired State    ← stage_framework target (Mastery band) per outcome
Gap              ← Desired − Current, with confidence band
Recommended Actions ← library-backed interventions (NEVER generic)
Expected Progression ← stage_progression_engine trajectory (Awareness→Mastery)
```

No outcome is emitted when its spine is empty (honest UNCLASSIFIED, never fabricated).

## Phase 3 — `outcome_quality_report` (measured)

| Metric | Definition | Current | Realistic target |
|---|---|---|---|
| **Outcome Explainability** | % outcomes with full lineage to evidence | Moderate (explainability engine exists) | ≥ 85 |
| **Outcome Confidence** | mean confidence across composing signals | Moderate; capped by signal 55.8% coverage | ≥ 80 |
| **Outcome Actionability** | % outcomes with ≥1 library-backed action | Good where intervention library matches | ≥ 85 |

## Smallest set of changes toward world-class

1. **Specify the `outcome_intelligence_framework`** as a compose-only read layer over CSI + behaviour
   graph + intervention library (no new tables).
2. **Bind outcomes to the `stage_framework`** so "Desired State" is the stage target, not a magic
   number.
3. **Defer Exam Readiness** to Wave 4 (context corpus) — flag it honestly as gated rather than
   shipping a low-confidence model.

Lift estimate: steps 1–2 move Outcome Intelligence **42 → ~80**; the 82–88 band follows once signal
coverage rises (Wave 3).
