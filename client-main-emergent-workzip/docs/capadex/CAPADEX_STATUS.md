# CAPADEX — Status Report

> Consolidation snapshot. No new audits or changes; this records the current state.

## Current State

CAPADEX is a **production-capable behavioural intelligence runtime** with a fully operational
ontology, assessment flow, scoring stack, and additive intelligence engines. The question-metadata
layer is **fully populated but flat** (per-question differentiation is the open work). Two of the
deferred question dimensions — **Context and Archetype** — are **shipped repository-wide and
validated**; the remaining three (capability/behaviour/signal) are **architected, piloted, approved
with modifications, and deferred** behind coverage/grounding gates.

## Completed Work

| Milestone | Outcome |
|---|---|
| **AQ-1** | Metadata coverage audit — established coverage baselines per dimension |
| **AQ-2** | Metadata reconstruction — lifted coverage to ≥99% on 5 of 6 legacy dims (at tag granularity) |
| **AQ-2R** | Runtime wiring audit + shared scorer — proved the ceiling is a *data* ceiling, not a wiring ceiling |
| **C-1 QSIL** | Question Signal Intelligence audit — measured repository differentiability **0.096**; identified flat/tag-level root cause |
| **C-1A QDA** | Question Differentiation Architecture — designed Context + Archetype, Diversity Standards, QIS V2, C-2 blueprint |
| **C-1A Pilot** | Sandbox validation on 10 worst tags — coverage-weighted differentiability **+145%**; signal "cheapest-first" assumption overturned |
| **C-1AR** | Rollout strategy — re-sequenced, coverage/grounding-gated 4-wave plan; GO with modifications |
| **Runtime engines** | Signal capture, composite/pattern (OMEGA-X), intervention, CSI, behaviour graph, PIL recommendation/knowledge-graph — all additive & flag-gated |
| **C-2 (prior)** | **Context + Archetype enrichment shipped repository-wide** (325 tags) |

## Approved Work (gated, not yet executed)

- **C-2 Wave 1 verification** — AQ-2R measurement of shipped Context + Archetype (measurement only).
- **C-2 Wave 2 — Capability** — coverage-gated (≥60%), evidence-broadened. *Approved with modifications.*
- **C-2 Wave 3 — Signal** — grounding-conditional: 119 weak-grounded tags low-confidence; WC-class
  grounding expansion for 25 ungrounded tags first. *Approved with modifications.*
- **C-2 Wave 4 — Behaviour (curated) + context-corpus** — curated authoring. *Behaviour not approved
  as text-only auto-enrichment.*

## Deferred Work

Signal grounding expansion (25 ungrounded tags incl. flagship pools); capability evidence beyond
question text; curated behaviour sets; Academic/Competitive context-corpus authoring. See
`CAPADEX_DEFERRED_BACKLOG.md`.

## Known Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Mechanical enrichment → semantically incoherent metadata | High | Evidence-derive; quality gate rejects generic fallbacks; UNCLASSIFIED when no evidence |
| Signal backfill on ungrounded flagship pools = fabrication | High | Two-key rule (tag grounding **and** per-question evidence); grounding-first sequencing |
| Low coverage masquerading as differentiation | Medium | Report/gate on **coverage-weighted** metric, never raw-where-present |
| Unverifiable gains | Medium | Mandatory AQ-2R before/after measurement gate per wave |
| Context/Archetype taxonomy churn after data exists | Medium | Taxonomies locked in C-1A; verify in Wave 1 |
| Over-investment in low-ceiling dims (age/persona/stage) | Low | Frozen; weighted low in QIS V2 |

## Known Gaps

- Repository differentiability below the **0.30 minimum** Diversity Standard until Waves 2–4.
- Capability coverage ceiling ~49% (text-only); behaviour ~10%; signal ~1.2% per-question evidence
  on flagship pools.
- Context-corpus gap: Competitive Exam Readiness routes 0 in the generic pools.

## Production Readiness

**Production-capable for the assessment + intelligence runtime.** The flow never 404s, never
fabricates, and every engine is flag-gated and reversible. The *open* item is question-level
differentiation data, which improves quality but is not a runtime blocker.

## Version Recommendation

### CAPADEX **v0.9** (recommended now)
Operational runtime + ontology + scoring + shipped Context/Archetype; per-question differentiation
(Waves 2–4) deferred. This is an honest "production-capable, not data-complete" milestone.

### CAPADEX **v1.0** (gated)
Cut v1.0 when Waves 2–4 have rolled out under the coverage/grounding gates **and** the AQ-2R
measurement gate confirms repository differentiability ≥ 0.30 (Diversity-Standards minimum) with no
fabrication.

## Go / No-Go Status

**GO (with modifications)** for the re-sequenced, coverage/grounding-gated C-2 rollout
(Archetype/Context shipped → Capability gated → Signal grounding-conditional → Behaviour curated).
**NO-GO** on: flagship signal mass-backfill, text-only behaviour auto-enrichment, unmeasured gain
claims, and age/persona/stage investment.
