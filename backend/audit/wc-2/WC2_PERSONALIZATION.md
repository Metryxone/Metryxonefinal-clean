# WC-2 · Output 2 — Personalization Readiness Report

> Design + honest measurement. No enrichment; no new dimensions created in data — this defines the
> personalization contract and scores current readiness.

## Scorecard

| Field | Value |
|---|---|
| **Current Score** | **55 / 100** |
| **Stated WC-2 Target** | > 90 |
| **Realistic Target Band** | **78–85** (repo-wide) |
| **Gap (to realistic band)** | ~23–30 points |
| **Evidence** | Coverage is high (age 99.6%, persona 96.9%, stage 100%, capability 100%, behaviour 99.9%; context + archetype shipped prior C-2). **Precision is low**: because per-question metadata is flat within a tag, two different users routed to the same tag receive a near-identical journey. |
| **Root Cause** | **Coverage ≠ precision.** Personalization needs *within-tag* differentiation to actually diverge journeys; that is the same flat-metadata ceiling as Question Intelligence. |
| **Estimated Effort** | Medium. Two parts: (a) **wire** the shipped context+archetype into the runtime picker score (design/routing, no data change); (b) **enrich** capability/behaviour for true within-tag precision (C-2 waves). |
| **Expected Impact** | Wiring context+archetype into routing yielded **+39 to +87 pp** routing precision in the pilot across 4 of 5 contexts — the single biggest near-term personalization lift with **no enrichment**. |

### Ceiling note
**> 90** repo-wide is gated by within-tag differentiability (~0.55 ceiling). Realistic band
**78–85**; specific enriched cohorts can exceed it.

## Phase 1 — Personalization dimensions (contract)

| Dimension | Source (existing) | State |
|---|---|---|
| Age | `age_band` / `age_min/max` | Covered (99.6%), low ceiling |
| Persona | `persona_primary` + `personas` jsonb | Covered (96.9%) |
| Context | shipped C-2 (enrichment layer) | Routing-valuable; corpus gap on Academic/Competitive |
| Concern Severity | `resolveMasterConcernIdFromText` confidence + signal magnitude | **Derivable but not yet a first-class routing input** |
| Archetype | shipped C-2 (enrichment layer) | Highest-yield differentiator |
| Behaviour Pattern | `primary/secondary_behavior` | Covered but **flat** (within-tag 0) |
| Capability Pattern | `primary/secondary_capability` | Covered but **flat** |
| Signal Pattern | `signal_family` + grounding | **55.8% coverage**; 44.2% blind |

## Phase 2 — `personalization_readiness_report` (measured)

| Metric | Definition | Current | Realistic target |
|---|---|---|---|
| **Personalization Coverage** | % users for whom all routing dimensions resolve | **High (~90%+)** on age/persona/context/archetype; capped by signal 55.8% | 85–92 |
| **Personalization Precision** | within-tag journey divergence between distinct users | **Low (~0.10)** — flat metadata | 0.30–0.45 (Diversity-Standards) |
| **Personalization Confidence** | mean of per-dimension `*_confidence` where present | **Moderate** | raise via enrichment confidence |

**Headline:** personalization is **coverage-rich but precision-poor** — the runtime can *identify*
the user well but cannot yet *differentiate the journey* within a tag.

## Smallest set of changes toward world-class

1. **Wire context + archetype into the runtime picker scoring (QRS)** — the data is already shipped;
   this is the highest-impact, no-enrichment change (pilot: +39–87 pp).
2. **Promote Concern Severity to a first-class routing input** (compose from existing resolver
   confidence + signal magnitude; read-only).
3. **Capability Wave 2 enrichment** for genuine within-tag precision (the only path past the
   precision floor).

Lift estimate: steps 1–2 (no enrichment) move Personalization **55 → ~70**; step 3 reaches the
78–85 band.
