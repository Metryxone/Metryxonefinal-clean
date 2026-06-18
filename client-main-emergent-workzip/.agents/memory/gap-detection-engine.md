---
name: PIL gap-detection / integrity-audit engine (Phase 8D)
description: How graph-completeness gaps are defined over the canonical PIL KG, and the non-obvious "honest finding" calls behind them.
---

# Gap detection over the canonical PIL graph

GraphGapEngine + IntegrityAuditEngine audit completeness of pil_kg_nodes/pil_kg_edges
(read-only of structure; the only writes are the derived pil_kg_gap_analysis snapshot +
append-only pil_kg_audit rows). Built on the Phase-8B traversal index — never a new index.

## The five gap definitions (and why)
- **orphan** = undirected degree 0.
- **weakly_connected** = undirected degree 1, RESTRICTED to CORE node_types (concern, behavior,
  problem, problem_framing, archetype, intervention, recommendation, construct). Leaf node_types
  (clarity_question, atomic_signal, bridge_tag, domain, family, emotion, search_intent, capability,
  signal) are degree-1 BY DESIGN — flagging them is pure noise.
- **unused_construct** = node_type 'construct' with 0 incoming edges.
- **missing_relationship** = a node missing an EXPECTED outgoing relation for its node_type
  (declarative MISSING_RELATIONSHIP_RULES, mode all|any). Grounded in the live relation catalog.
- **dead_end** = node with degree>0 but 0 outgoing, ONLY if its node_type is source-capable.
  **Why source-capable must be DERIVED from the live edge set (deriveSourceCapableTypes), never
  hardcoded:** target-only types (bridge_tag, construct, problem_framing-as-target) are intended
  terminals — hardcoding a terminal list would either false-flag them or silently miss real
  dead-ends when the schema grows.

## Honest findings on the real graph (don't "fix" these — they're correct)
- Orphans are ONLY the ~299 competency nodes — competency has no link rows (known class). Reported, not hidden.
- 0 unused constructs (all referenced); recommendations/interventions/archetypes have 0 orphans → all 3 hard validations PASS.
- problem_framing IS source-capable via problem_manifests_behavior; the subset with no outgoing behavior
  are genuine dead-ends (~113). Real gap, not a bug.
- ~half of CORE nodes are degree-1 (mostly behaviors → 1 concern) → weak-node-health component is honestly low (~48%); overall health still strong (~95%).

## Gotchas
- Gap classes intentionally OVERLAP (a node with no out-edge can be weak + missing_rel + dead_end).
  That's correct, not double-counting; downstream analytics should treat each class independently.
  sum(by_type) === rows.length holds because each detector emits its OWN row per node.
- recordGraphAudit's event_type union is a closed TS union — adding a new audit event type (gap_analysis,
  integrity_audit) requires EXTENDING that union in knowledge-graph-maturation.ts or the call won't typecheck.
- Health score weights/bands are fixed a priori; never tune them to hit a target. A low component is a finding.
- architect() with includeGitDiff:true FAILS when untracked files exist (UNKNOWN_NOT_GIT) — call WITHOUT it.
