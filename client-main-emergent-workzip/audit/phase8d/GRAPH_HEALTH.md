# CAPADEX PIL — Phase 8D: Graph Health & Gap Detection

Generated: 2026-06-03T18:02:53.433Z
Flag (FF_RUNTIME_INTELLIGENCE_ACTIVATION): ON

## Canonical graph (read-only)
- Nodes: 62,095
- Edges: 142,457
- Graph structure untouched: yes (only derived pil_kg_gap_analysis + append-only pil_kg_audit written)

## Gap Report
- **orphan_node** — 299 (competency:299)
- **weakly_connected** — 6,594 (behavior:6048, recommendation:367, problem_framing:113, problem:60, construct:6)
- **unused_construct** — 0
- **missing_relationship** — 3 (concern:3)
- **dead_end** — 113 (problem_framing:113)
- Gap rows persisted to `pil_kg_gap_analysis`: **7,009**

## Integrity Report (hard validations)
- ✅ **No Orphan Recommendations** — 0 orphan / 367 total
- ✅ **No Orphan Interventions** — 0 orphan / 660 total
- ✅ **No Orphan Archetypes** — 0 orphan / 22 total
- All validations passed: **YES**

## Coverage Report (connectivity by category)
- **archetype** — 22/22 connected (100.0%)
- **behavior** — 8030/8030 connected (100.0%)
- **bridge_tag** — 331/331 connected (100.0%)
- **capability** — 905/1204 connected (75.2%)
- **concern** — 2489/2489 connected (100.0%)
- **domain** — 20/20 connected (100.0%)
- **emotion** — 220/220 connected (100.0%)
- **intervention** — 800/800 connected (100.0%)
- **problem** — 993/993 connected (100.0%)
- **question** — 30638/30638 connected (100.0%)
- **recommendation** — 367/367 connected (100.0%)
- **search_intent** — 550/550 connected (100.0%)
- **signal** — 16431/16431 connected (100.0%)

## Graph Health Score
### **94.6%** — STRONG

| Component | Value | Weight |
| --- | --- | --- |
| Connectivity | 99.5% | 0.3 |
| Validations | 100.0% | 0.25 |
| Traversal (no dead-ends) | 99.8% | 0.2 |
| Relationships (no missing) | 100.0% | 0.15 |
| Weak-node health | 47.7% | 0.1 |

> Weights & bands are fixed a priori. Honest findings (the known competency orphan
> class, by-design single-anchor recommendations) are reported as-is, never tuned.

