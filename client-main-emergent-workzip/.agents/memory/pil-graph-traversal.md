---
name: PIL graph traversal engine (Phase 8B)
description: Read-only traversal layer over the materialized PIL knowledge graph — determinism, bounding, and flag-gating rules.
---

# PIL graph traversal (read-only over the materialized graph)

The traversal engine reads ONLY the canonical materialized graph
(`pil_kg_nodes`/`pil_kg_edges` + catalogs `pil_kg_node_types`/`pil_kg_relationship_types`).
It never creates or mutates graph nodes/structure. 4 pure resolvers (shortest-path,
related, lineage, dependencies) + cached orchestrator wrappers; routes flag-gated by
`isRuntimeIntelligenceActivationEnabled()` (OFF → `{enabled:false}`), never 500.

**Determinism is a hard requirement, and adjacency order is the trap.**
The resolvers are all CAPPED (maxPerStage / limit / maxNodes), so any tie or
truncation makes the *output depend on traversal order*. Postgres returns rows in
no guaranteed order, so without sorting, identical data can yield different
paths/related-sets/lineage across runs (and flaky audits/tests).
**Why:** architect flagged this as the only real defect in 8B — the feature was
correct, read-only, and bounded, but not actually deterministic as the canon claims.
**How to apply:** (1) `ORDER BY node_id` / `ORDER BY edge_id` on the load SQL, and
(2) sort every adjacency list (`out` by to+edge.id, `in` by from+edge.id,
`undirected` by neighbor+edge.id) right after building the index — BOTH are needed;
SQL order alone is lost once edges are bucketed into adjacency maps. Guard it with a
shuffled-input regression test: same fixture shuffled must produce byte-identical
resolver output.

**No-broken-paths guarantee** comes from `buildTraversalIndex` dropping any edge whose
endpoint isn't in `byId` — so traversals can never reference a missing node.
**Lineage is honestly partial:** the spine
`concern→capability→problem→behavior→archetype→intervention→recommendation` reports
`reached:false` for unreachable stages rather than fabricating; ~0.857 coverage is
expected (recommendation stage not reachable from concern anchors), not a bug.
