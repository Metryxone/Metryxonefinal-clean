---
name: kg_nodes/kg_edges table-name collision (PIL graph vs Employability graph)
description: Two unrelated subsystems both claim kg_edges; PIL Phase-8 graph collides with the live Employability graph and its materialize is destructive.
---

# kg_edges is owned by the Employability graph, NOT the PIL graph

`kg_edges` (and the `kg_` prefix) was first claimed by the **Employability Knowledge
Graph**: `migrations/20260522_employability_knowledge_graph.sql` creates `kg_edges` as a
UUID-based edge table (`id, from_type, from_id, to_type, to_id, edge_type, weight,
confidence, source_authority, source_url, evidence_ref, dataset_version, is_active, …`).
It is **live and populated** (≈60 rows) and read/written by `services/knowledge-graph.ts`
and `routes/capadex.ts` (plus the wider ei-*/reference-intelligence/nhda ecosystem). There
is **no `kg_nodes` table** — the employability graph stores everything in `kg_edges`
+ sibling tables (role_families, occupation_skills, skill_adjacency, …).

The **PIL Phase-8 Knowledge Graph** (`services/pil/knowledge-graph-*.ts`,
`migrations/20261202_knowledge_graph.sql`) independently defined a *different*
`kg_nodes`/`kg_edges` schema (`node_id/edge_id/source_id/target_id/relation/provenance`).

**Why this bites:**
- `ensureKnowledgeGraphSchema` does `CREATE TABLE IF NOT EXISTS kg_edges (...)` → no-op
  against the existing table → then `CREATE INDEX ... ON kg_edges (source_id)` **throws**
  (`column "source_id" does not exist`). So the PIL lazy bootstrap fails in any env where
  the employability graph exists.
- `materializeKnowledgeGraph` runs `DELETE FROM kg_edges; DELETE FROM kg_nodes;` then bulk
  insert → it would **wipe the employability graph's rows** and then fail on the column
  mismatch. Latent data-loss bug in the merged PIL Phase 8.

**RESOLVED (canonical now):** the PIL graph was re-namespaced to `pil_kg_nodes` /
`pil_kg_edges` (indexes `idx_pil_kg_*`) across all PIL files (services/pil/*, migration
20261202 + 20261203, phase8/phase8a audit scripts, tests, the `routes/capadex.ts` comment).
The employability `kg_edges` stays put (live consumers `services/knowledge-graph.ts` +
employability routes). Phase 8A maturation tables (`pil_kg_node_types`,
`pil_kg_relationship_types`, `pil_kg_metadata`, `pil_kg_similarity_index`, `pil_kg_audit`)
read/derive from `pil_kg_*` only.

**How to apply (going forward):** two graphs, two namespaces — **bare `kg_*` = employability,
`pil_kg_*` = PIL (the WHOLE PIL graph + its maturation layer)**. The user mandated the PIL
graph be a fully independent, fully `pil_`-namespaced intelligence graph:
`pil_kg_nodes`, `pil_kg_edges`, `pil_kg_node_types`, `pil_kg_relationship_types`,
`pil_kg_metadata`, `pil_kg_similarity_index`, `pil_kg_audit`. Never point any PIL SQL at
bare `kg_*`, never run the PIL materialize (DELETE+INSERT) against bare `kg_edges` (would
wipe employability rows), and no cross-domain coupling — future interop only via explicit
graph bridges, never by reusing employability tables.
