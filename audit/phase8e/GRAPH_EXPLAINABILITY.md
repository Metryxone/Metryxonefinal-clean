# CAPADEX PIL — Phase 8E: Graph Explainability

Generated: 2026-06-03T18:26:48.321Z
Flag (FF_RUNTIME_INTELLIGENCE_ACTIVATION): ON

## Canonical graph (read-only)
- Nodes: 62,095
- Edges: 142,457
- Graph structure untouched: yes (only the append-only pil_kg_audit summary row written)

## What "explainable" means here (two honest layers)
1. **Local support** — a statement has ≥1 real grounding edge (out-degree ≥ 1). This is the
   *No Unsupported Statements* guarantee.
2. **Source-traceability** — the statement chains over real edges to a grounding source
   (concern / question).

## Coverage Report (statement layer)
| Category | Total | Locally supported | Source-traceable |
| --- | --- | --- | --- |
| intervention | 800 | 800 (100.0%) | 660 (82.5%) |
| recommendation | 367 | 367 (100.0%) | 0 (0.0%) |
| **All statements** | **1,167** | **1,167 (100.0%)** | **660 (56.6%)** |

## Validations (hard)
- ✅ **No Unsupported Statements** — 0 unsupported / 1167 statements
- All validations passed: **YES**

## Graph Explainability Score
### **82.6%** — MODERATE

| Component | Value | Weight |
| --- | --- | --- |
| Local support | 100.0% | 0.6 |
| Source-traceability | 56.6% | 0.4 |

## Honest findings
- **Interventions are fully traceable** to a grounding source: `intervention → problem →
  archetype → concern → bridge_tag ← clarity_question`.
- **Recommendations anchor on a `construct`, which is a graph sink** (no outgoing edges),
  so they are *locally supported* by their construct anchor but do **NOT** chain to a
  concern/question. This is reported as-is — the missing hop is never fabricated. Closing
  it would require a real construct→concern edge layer (a deliberate future-phase decision).

> Weights & bands are fixed a priori. The score reflects the graph; the graph is never
> massaged to hit a score.

