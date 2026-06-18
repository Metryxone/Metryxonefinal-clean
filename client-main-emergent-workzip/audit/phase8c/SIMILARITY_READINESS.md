# CAPADEX PIL — Phase 8C: Similarity Intelligence Readiness

Generated: 2026-06-03T17:46:51.497Z
Flag (FF_RUNTIME_INTELLIGENCE_ACTIVATION): ON

## Canonical graph (read-only)
- Nodes: 62,095
- Edges: 142,457
- Graph structure untouched: yes (only the derived pil_kg_similarity_index is written)

## Detect categories
- **concern** — 2487/2489 have a similar peer (99.9%); 24870 matches, explainable 100.0%, hub-only 97.3%
- **behavior** — 3000/3000 have a similar peer (100.0%) *(scanned 3000/8030)*; 6948 matches, explainable 100.0%, hub-only 0.0%
- **problem** — 66/993 have a similar peer (6.6%); 130 matches, explainable 100.0%, hub-only 100.0%
- **archetype** — 0/22 have a similar peer (0.0%); 0 matches, explainable 100.0%, hub-only 0.0%
- **intervention** — 794/800 have a similar peer (99.3%); 7086 matches, explainable 100.0%, hub-only 74.5%
- **recommendation** — 367/367 have a similar peer (100.0%); 3670 matches, explainable 100.0%, hub-only 0.0%

## Validations
- Similarity Coverage (mean across categories): **67.6%**
- Explainability Coverage: **100.0%**
- False Match Review — hub-only rate: **69.3%** (29597/42704 matches, degree ≥ 50)

## Persisted index
- Method: `category_jaccard` · rows written: **42,704**
  - concern: 24870
  - behavior: 6948
  - problem: 130
  - archetype: 0
  - intervention: 7086
  - recommendation: 3670

## Similarity Readiness Score: **73.2%**
(0.4*similarity_coverage + 0.4*explainability_coverage + 0.2*(1 - false_match_rate))

