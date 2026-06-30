# 10 · Duplicate & Conflict Register

Every duplicate concept and terminology/definition conflict found during consolidation, with a canonical
resolution. **Resolutions are documentation/naming decisions only — no code is renamed in this phase.**

## Conflicts (terminology / definition)
| # | Conflict | Where | Canonical resolution | Severity |
|---|---|---|---|---|
| C1 | **CAP_INS labeled "Insight" AND "Clarity"** | routes.ts/report vs clarity-mapping engine | Canonical = **Insight**; "Clarity" = display alias of SAME stage | **HIGH** |
| C2 | **5-stage narrative vs 4 coded stages** (Awareness uncoded) | docs/CAPADEX.md & narrative vs engine | Claim **4 coded stages**; Awareness = conceptual pre-stage, not active | **HIGH** |
| C3 | **"Outcome" = Growth/Development/result** conflation | recommendation/career docs | Outcome = **realized + measured only**; Growth=stage, Development=process | **HIGH** |
| C4 | **"Capability" = product-function AND competency** | mixed | "Capability"=product function; competency stays "Competency" | **MEDIUM** |
| C5 | **Concern/Signal/Behaviour/Construct** blurred | assessment docs | four distinct subjects (04 §B); document boundaries | **MEDIUM** |
| C6 | **Concern/Signal/Behavioural Intelligence** boundary loose | engineering constitution | three layered scopes (04 §D); Behaviour=pattern over Signals | **MEDIUM** |
| C7 | **"Phase" = lifecycle stage AND build phase** | everywhere | "Stage"=lifecycle; "Phase"=engineering build | **LOW** |
| C8 | **Brand vs product naming** (MetryxOne vs CAPADEX) | replit.md vs CAPADEX.md | MetryxOne (platform) ⊃ CAPADEX (product) | **LOW** |
| C9 | **Mentor vs Coach** as separate personas | persona matrix vs code | ONE substrate, two market labels | **MEDIUM** |

## Duplicates (concept / flow)
| # | Apparent duplicate | Verdict | Action |
|---|---|---|---|
| Dpe1 | Mentor & Coach personas | **TRUE duplicate substrate** | treat as one (C9) |
| Dpe2 | LBI `lbi_*` vs Competency `onto_*` assessment | **NOT a duplicate** (intentional 2 products) | keep separate; do not bridge |
| Dpe3 | Multiple Career-Builder entrances | **NOT duplicate flows** (multi-entry, one flow) | keep all entrances |
| Dpe4 | `-v2` engine files (11 flagged in constitution) | **REVIEW CANDIDATES** (candidate≠redundant) | review individually in a later phase; do NOT delete now |
| Dpe5 | Concern-diagnostic vs Behaviour-signal inputs | **overlap, not duplicate** | document boundary (C5), keep both |
| Dpe6 | Teacher + Counsellor surfaces | **near-duplicate (survey-only)** | consolidate as one partial surface (06) |

## Resolution discipline (carried from constitution + memory)
- **Reuse-first / never-duplicate** remains the standing rule; this register *records* duplicates for future
  cleanup, it does **not** authorize deletions now.
- `-v2` files are **candidates**, never assumed redundant (memory: false-flagged duplicate scans have bitten
  prior phases — the `-v2` predictive files belong to an older system).
- All HIGH conflicts (C1–C3) are **labeling/definition** issues fixable in docs without code change; they are the
  top consolidation actions for the Blueprint.

## Summary
**9 conflicts (3 HIGH, 4 MEDIUM, 2 LOW) + 6 apparent duplicates (1 true substrate-duplicate, 1 near-duplicate,
4 not-duplicates).** The HIGH conflicts are all stage/outcome terminology — resolved canonically in 04/05 and
adopted by the Blueprint (12).
