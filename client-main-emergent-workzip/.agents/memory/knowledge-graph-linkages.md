---
name: CAPADEX knowledge-graph linkage map
description: Which DB columns are REAL edges between CAPADEX intelligence assets, and which "obvious" joins are traps (Phase 8 graph).
---

# CAPADEX asset linkage map (verified against live DB)

Use only REAL linkage rows for graph edges; provenance-stamp each. Confirmed joins:

- `capadex_families.domain_id` → `capadex_domains.domain_id` (400/400).
- `capadex_atomic_signals.family_id` → families (15972), `.domain_id` → domains (15972).
- **bridge_tag hub**: `relational_bridge_tag` on domains/families/atomic/signals/concerns,
  and `master_bridge_tag` on clarity_questions — this is the production join hub
  (concern.relational_bridge_tag = clarity.master_bridge_tag). ~328 distinct tags.
- `capadex_concern_signal_map`: `concern_pk`→`capadex_concerns_master.id`; `signal_ref`
  joins `capadex_signals.signal_id` ONLY for `signal_tier='tier3'` (5858). **composite /
  atomic / orphan tiers do NOT join any real signal node** (atomic refs are bridge-tag
  catch-alls like GENERAL_CONCERN; composite refs are runtime cluster names) → DROP them.
- `behavior_library.concern_id` → master.concern_id (8030, all rows).
- `archetype_concern_map` → master.concern_id AND archetype_library.archetype_key (2151 both).
- `human_problem_library.archetype_key` → archetype_library (88).
- `human_emotion_library.archetype_key` → archetype_library (220).
- `search_intents.archetype_key`→archlib (550) AND `.problem_id`→human_problem_library.problem_id (550, integer).
- `pil_intervention_library.archetype_key`→archlib (660) AND `.problem_id`→human_problem_library (660).
- `capability_problem_map.capability_concern_id`/`problem_concern_id` are **concern_id strings**
  (capability_concern_id == problem_concern_id per row); capability_name/problem_name are
  derived strength/deficit FRAMINGS of that concern. This is what pipeline-resolver uses.
  → graph: concern→capability (`concern_framed_as_capability`) AND capability→problem_framing
  (`capability_addresses_problem`). `problem_framing` is a node type keyed by problem_concern_id.
- `capability_problem_behavior_map` (29730 rows) IS a real edge after all: `capability_id ==
  problem_id == concern_id` text on every row; `behavior_id` INT → `behavior_library` (all join).
  → graph: problem_framing→behavior (`problem_manifests_behavior`), completing
  concern→capability→problem→behavior. (Earlier note called this a trap — only the
  capability_id↔competency join is a trap; the behavior_id join is real.)
- `capadex_concern_clarity_map` (9760 rows): `master_concern_id`→concern + `relational_bridge_tag`;
  `clarity_concern` is bucket-level free-text/`__orphan__` and does NOT join question_ids.
  → graph: concern→bridge_tag (`concern_resolves_clarity`), a HARD scored link distinct from the
  structural `tagged_with`. Skip null/`__orphan__` bridge tags.

## Edge cardinality + session subgraph (contract = "one edge per real linkage row")
- **Never dedup edges by `(relation, source, target)`** — that silently collapses real
  rows (concern_clarity_map 9760→2489, cpbm 29730→1982). Make the edge id row-unique by
  appending the provenance ref (the source row PK). Each real linkage row → its own edge;
  total still never exceeds real rows. Multi-FK rows (atomic: family+domain+tag) legitimately
  emit several edges, one per real non-null link column — that is NOT fabrication.
- **Session subgraph must be the lineage slice, NOT a k-hop ball.** A blind
  `neighborhood(anchor, depth)` drags in the giant bridge-tag hub + unrelated concerns.
  Induce the subgraph over the RESOLVED hops of the existing pipeline lineage
  (`buildPipelineForSession` → `pipeline.hops`); concern/capability/problem_framing are all
  keyed by the SAME concern_id, archetype by key. Unresolved hops contribute nothing →
  degrade to anchor-only + honest `partial_chain`. Reuse the lineage; don't re-derive it.

## TRAPS (joins that look right but are wrong)
- `onto_competencies` (299 "competencies") uses its OWN `dom_*/fam_*` taxonomy →
  ZERO join to capadex_domains/families and ZERO join to concerns. It is a separate,
  statically-disconnected competency library. **Do not fabricate concern↔competency edges.**
  Surface it as an isolated component (honest "not wired in" finding).
- `capability_problem_behavior_map.capability_id`/`problem_id` are **concern_id strings**
  (NOT onto_competencies / NOT human_problem_library); only `behavior_id`→behavior_library
  joins. human_problem_library.problem_id is INTEGER; cpbm.problem_id is TEXT → type-mismatch.
  (The behavior_id join itself IS real — see the linkage entry above; only the
  capability_id↔competency and problem_id↔human_problem_library joins are the traps.)
- `recommendation_library.anchor_construct` ∪ `intervention_library.construct_key` form a
  construct namespace (ANXIETY, RESILIENCE, …) that does NOT join the ontology or archetypes
  statically. Recommendations bind to the ontology ONLY at runtime (per-session pipeline).
  Represent as its own component (construct ← recommendation, construct ← intervention_library).

## Sizes (for materialization budgeting)
domains 20 · families 400 · signals 20 · atomic 15972 · concerns 2489 · clarity 30638 ·
caps(onto) 299 · problems 88 · behaviors 8030 · archetypes 22 · emotions 220 ·
search_intents 550 · pil_interventions 660 · recommendations 1468 · intervention_library 140.
clarity+atomic dominate node count; cpbm (~30k) + concern_clarity_map (~10k) dominate edge
count once one-edge-per-row holds → chunk materialization. (Exact node/edge totals are
run-specific — read them from audit/phase8/graph_summary.json, don't hardcode here.)
