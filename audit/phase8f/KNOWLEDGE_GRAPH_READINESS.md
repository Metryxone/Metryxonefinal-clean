# CAPADEX PIL — Phase 8F: Knowledge Graph Readiness

Generated: 2026-06-03T18:47:08.746Z
Flag (FF_RUNTIME_INTELLIGENCE_ACTIVATION): ON

## Final recommendation: **READY FOR PHASE 9**

- All hard certification gates passed.
- Informational: source-traceability is 0.565553 — recommendations/runtime_interventions anchor on the construct sink (a documented architectural limit, not a blocker).

## Canonical graph (read-only)
- Nodes: 62,095
- Edges: 142,457
- Graph structure untouched: yes (only the append-only pil_kg_audit `readiness_audit` row written)

## Readiness score
### **95.3%** — STRONG

| Component | Value | Weight |
| --- | --- | --- |
| Graph health | 94.6% | 0.3 |
| Structure (node + relationship) | 99.8% | 0.2 |
| Traversal | 99.8% | 0.15 |
| Explainability support | 100.0% | 0.15 |
| Gap-clean | 88.9% | 0.1 |
| Similarity | 81.6% | 0.1 |

## Coverage (seven dimensions)
| Dimension | Rate | Band |
| --- | --- | --- |
| Node (connectivity) | 99.5% | strong |
| Edge (verbs present) | 100.0% | strong |
| Relationship (relations realised) | 100.0% | strong |
| Traversal (non-dead-end) | 99.8% | strong |
| Similarity (same-category match) | 81.6% | moderate |
| Gap-clean | 88.9% | strong |
| Explainability (local support) | 100.0% | strong |

## Hard certification gates
- ✅ Graph viability (non-empty nodes/edges/statements)
- ✅ Graph Integrity (no orphan statements)
- ✅ Lineage Integrity (no unsupported statements)
- ✅ Determinism
- ✅ Performance
- ✅ Readiness band ≥ moderate
- All hard gates passed: **YES**

## Verifications
- ✅ **Graph Integrity** — All structural validations passed (no orphan recommendations/interventions/archetypes).
- ✅ **Lineage Integrity** — No unsupported statements — every recommendation/intervention has a real grounding edge.
- ✅ **Determinism** — Identical certification payload across two independent re-runs.
- ✅ **Performance** — Validation completed in 7299ms (budget 30000ms).

## Honest findings
- **Explainability source-traceability = 56.6%** is an architectural
  limit: recommendations / runtime_interventions anchor on the `construct` sink, so they are
  *locally supported* but do not chain to a concern/question. This is an INFORMATIONAL
  sub-metric, **not** a hard gate — the missing hop is never fabricated.
- Hard gates are the production blockers: structural integrity (no orphan statements),
  lineage integrity (no unsupported statements), determinism, performance, and a readiness
  band of at least *moderate*.

> Weights, bands and gates are fixed a priori. The verdict reflects the graph; the graph is
> never massaged to hit a score.

