# WC-2 · Output 3 — Stage Intelligence Framework

> Design + honest measurement. Defines the MetryxOne progression framework and maps existing entities
> to stages. No new data, no taxonomy rewrite executed.

## Scorecard

| Field | Value |
|---|---|
| **Current Score** | **45 / 100** |
| **Stated WC-2 Target** | > 90 |
| **Realistic Target Band** | **88–92** (largely **design-reachable** — fewest data ceilings of all tracks) |
| **Gap (to realistic band)** | ~43–47 points |
| **Evidence** | A 4-weight stage model already exists in CSI (Curiosity `CAP_CUR` 0.5 · Insight `CAP_INS` 0.75 · Growth `CAP_GRW` 1.0 · Mastery `CAP_MAS` 1.25). But there is **no Awareness stage**, the `dev_stage` taxonomy **collapsed to a single "Clarity"** value, and there are **no formal stage advancement / transition / completion rules** spanning questions, concerns, behaviours, capabilities, interventions, recommendations. |
| **Root Cause** | Stage logic exists only as **CSI scoring weights**, not as a **cross-entity progression framework**. This is a *design* gap, not a data ceiling. |
| **Estimated Effort** | Medium (design-heavy; mapping reuses existing entities). |
| **Expected Impact** | Establishes the progression backbone every downstream system needs; unlocks Outcome + Growth-Journey tracks. |

### Ceiling note
This is the **most reachable** track — **88–92** is honest because it is design + mapping over data
that already exists. Full 90+ is feasible here.

## Phase 1 — `stage_framework` (design)

The MetryxOne 5-stage progression:

| Stage | Definition | Maps to existing |
|---|---|---|
| **Awareness** | User recognises a concern exists | *New* — precedes CSI; today's intro/concern-resolution phase |
| **Curiosity** | User explores the concern via assessment | CSI `CAP_CUR` (0.5); FreeAssessmentModal "Curiosity" question stage |
| **Clarity** | User understands patterns/drivers | CSI `CAP_INS` (Insight, 0.75); the collapsed `dev_stage="Clarity"` |
| **Growth** | User acts on interventions/recommendations | CSI `CAP_GRW` (1.0); intervention + recommendation runtime |
| **Mastery** | User sustains improvement longitudinally | CSI `CAP_MAS` (1.25); longitudinal-memory resilience/drift |

> **Reconciliation note (honest):** WC-2 introduces **Awareness** and renames **Insight → Clarity**.
> The existing CSI uses 4 stages (Curiosity/Insight/Growth/Mastery). The framework above is the
> **target taxonomy**; adopting it requires a *design reconciliation* with CSI weights (not executed
> here). Recommended weight extension: Awareness 0.25.

## Phase 2 — `stage_mapping_matrix` (design)

Each entity type is mapped to the stage(s) it serves:

| Entity | Awareness | Curiosity | Clarity | Growth | Mastery |
|---|---|---|---|---|---|
| Questions | concern-surface | clarity bank (assessment) | pattern-reveal | — | — |
| Concerns | recognised | explored | understood | addressed | resolved |
| Behaviours | — | observed | composited | targeted | sustained |
| Capabilities | — | probed | profiled | developed | mastered |
| Interventions | — | — | suggested | active | maintained |
| Recommendations | — | — | surfaced | ranked/acted | longitudinal |

Matrix shape: `entity_type · entity_id · stage · confidence · evidence_ref`. Mapping reuses existing
join keys (bridge tag, signal map, intervention library) — **no new entities**.

## Phase 3 — `stage_progression_engine` (design spec only)

- **Stage Advancement Logic** — advance when stage-completion threshold met (composition of CSI
  stage_score + intervention engagement + longitudinal trend).
- **Stage Confidence** — mean of contributing `*_confidence` + sample sufficiency (k-anonymity ≥ 30
  for cohort-relative signals).
- **Stage Completion** — per-stage exit criteria (e.g., Clarity complete when ≥1 pattern explained
  with confidence ≥ band).
- **Stage Transition Rules** — monotonic by default; regression allowed on drift (longitudinal-memory
  declining slope < −2). Append-only stage history.

> Spec only — **no engine is built this phase**.

## Smallest set of changes toward world-class

1. **Adopt the 5-stage `stage_framework`** and reconcile it with CSI weights (add Awareness 0.25;
   alias Insight→Clarity) — pure config/design.
2. **Materialise the `stage_mapping_matrix`** as a read-only view over existing entities.
3. **Specify (not build) the `stage_progression_engine`** as a compose-only layer over CSI +
   longitudinal memory.

Lift estimate: steps 1–2 move Stage Intelligence **45 → ~78**; the full spec'd engine reaches 88–92.
