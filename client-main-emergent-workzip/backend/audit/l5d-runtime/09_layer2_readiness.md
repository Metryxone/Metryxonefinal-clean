# L5D Runtime — Report 9: Layer-2 Readiness

## Question Intelligence completeness
Every question now carries Stage (L5A, 100%), Context (L5B, 100%), Outcome (L5C, 80.3%), and Journey (L5D, 80.3%).

| View | Value |
|------|-------|
| 3-layer completeness (pre-L5D: stage+context+outcome)/3 | **93.4%** |
| 4-layer completeness (stage+context+outcome+journey)/4 | **90.1%** |
| Journey-layer effectiveness (journey coverage among outcome-covered) | **100.0%** |

### Honest note on the target
The simple 4-layer mean (90.1%) is **below** the 3-layer mean because the journey layer is strictly DOWNSTREAM of outcome: a question with no outcome cannot have a journey, so the journey layer inherits the outcome ceiling (80.3%) and cannot raise a per-question average above it. Where the layer CAN apply, it applies almost completely (**100.0%** of outcome-bearing questions reach a journey). The honest readiness gain is "every outcome-bearing question now also knows its product journey," not a higher arithmetic mean. The 95%+ target is only reachable by lifting the upstream outcome ceiling (more HIGH crosswalk mappings / outcome-model coverage) — out of scope here and NOT forced.

## Readiness summary
- ✅ Deterministic per-tag journey projection over all 325 bridge tags (cached; engine is pure).
- ✅ 24588 / 30638 questions (80.3%) carry a Primary Journey; 21185 (69.1%) on a specialised (non-fallback) route.
- ✅ Stage × Journey, Context × Journey, Outcome × Journey matrices populated.
- ⚠️ 80.3% of questions are journey-ambiguous (secondary present) — the mentoring fallback shares affinity with all outcomes; L5E/product layers must keep both primary + secondary.
- ⚠️ Dormant journeys: Family & Parenting Support (reachable only via unreached/under-reached outcomes). competitive_exam is corpus_pending by design.
- ⛔ 19.7% reach no journey (honest no-outcome orphans). Downstream layers must not fabricate a journey for these.

## Methodology notes (honest approximations)
- The Competitive Exam guard mirrors the live `journey-intelligence.ts` resolver, but dedicated-exam evidence here is **crosswalk-derived** (an EXAM_*-prefixed construct in the exam_readiness model) rather than per-session activated matched-constructs. This is the faithful offline proxy for a question-level projection; runtime activation may differ per session.
- Journey confidence is intentionally low-banded (no HIGH) because the mentoring fallback shares affinity with every outcome model, diluting concentration. This is a real property of the route catalog, not a defect — reported, not smoothed.

## Discipline held
No new routes / products / journey models / outcome models / constructs / ontology / crosswalks. Engine additive + not wired into any live path. STOP — awaiting approval before the next phase.
