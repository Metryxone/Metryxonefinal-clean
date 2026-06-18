---
name: PIL Graph Explainability (Phase 8E)
description: Two-layer honest explainability over the canonical PIL graph; statement→source traceability and its real-graph ceiling.
---

# PIL Graph Explainability (Phase 8E)

Make statement nodes (`recommendation`/`intervention`) graph-traceable back toward a grounding
SOURCE (`concern` → `question`) over the canonical materialized graph (`pil_kg_nodes`/`pil_kg_edges`).
Read-only of graph; only append-only `pil_kg_audit` summary row written. Flag-gated by
`isRuntimeIntelligenceActivationEnabled()`.

## Explainability is TWO honest layers — do not conflate them
1. **Local support** — statement has ≥1 grounding out-edge (out-degree ≥ 1). This is the
   *"No Unsupported Statements"* guarantee → 100% on the real graph (no orphan recs/interventions).
2. **Source-traceability** — statement chains over real edges to a `concern`/`question`.

**Why they differ:** the real edge topology is
`intervention→problem→archetype→concern→bridge_tag←clarity_question` (interventions ARE
source-traceable), but `recommendation→construct` and `runtime_intervention→construct` where
**`construct` is a graph SINK** (no outgoing edges). So recommendations/runtime_interventions are
locally supported by their construct anchor but NEVER reach a concern/question.

**How to apply:** report the construct-anchor limit as-is — NEVER fabricate the missing
construct→concern hop. Closing it is a deliberate future-phase edge layer, not a bug to patch.
Real-graph numbers (don't tune to force a pass): 1167 statements, support 100%, source-trace ≈56.6%,
score 0.826 moderate (fixed a-priori weights support 0.6 + source_trace 0.4).

## Gotchas
- **Audit row counts mean GRAPH counts.** `recordGraphAudit.node_count/edge_count` must be the
  actual graph size (`indexSummary(index)`), NOT statement/coverage counts — an early version set
  `edge_count = totals.statements` and corrupted audit metadata semantics. Mirror the 8D pattern.
- Reuse `getTraversalIndex`/`indexSummary`/`TraversalIndex` from `graph-traversal-engine.ts` — do
  NOT build a second index. `nodeStep` there is private, so fixture tests replicate a tiny local
  `step()` helper.
- `nearestSources` BFS must stay bounded + cycle-safe (`seen`, `maxHops`, `maxExpand`, `stopOnFirst`
  for bulk coverage) and never-throws past the async orchestrator.
- Routes mirror the existing `capadex-pil-graph.ts` contract: flag gate → validId → degraded-200 on
  engine failure → 404 when `found=false`. Restart Backend API before smoke-testing new routes.
