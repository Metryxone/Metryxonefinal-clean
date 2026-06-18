# CAPADEX Phase 8 — Knowledge Graph Overview

Generated: 2026-06-03T16:06:48.369Z

The Knowledge Graph unifies every CAPADEX intelligence asset into ONE directed graph of
typed nodes and **provenance-stamped edges**. Every edge is backed by a real DB linkage
row (its source table is recorded on the edge) — nothing is fabricated. The graph is
deterministic for a given database state.

## 1. Scale
- **Nodes:** 62095
- **Edges:** 142457
- **Connected components:** 341
- **Orphan nodes (no edges):** 299

## 2. Nodes by type
| type | count |
|------|------:|
| clarity_question | 30638 |
| atomic_signal | 15972 |
| behavior | 8030 |
| concern | 2489 |
| capability | 905 |
| problem_framing | 905 |
| intervention | 660 |
| search_intent | 550 |
| family | 400 |
| recommendation | 367 |
| bridge_tag | 331 |
| competency | 299 |
| emotion | 220 |
| runtime_intervention | 140 |
| problem | 88 |
| construct | 39 |
| archetype | 22 |
| domain | 20 |
| signal | 20 |

## 3. Edges by relation
| relation | count |
|----------|------:|
| tagged_with | 49539 |
| problem_manifests_behavior | 29730 |
| atomic_belongs_to_family | 15972 |
| atomic_belongs_to_domain | 15972 |
| concern_resolves_clarity | 9760 |
| behavior_indicates_concern | 8030 |
| concern_activates_signal | 5858 |
| archetype_covers_concern | 2151 |
| concern_framed_as_capability | 905 |
| capability_addresses_problem | 905 |
| intervention_for_archetype | 660 |
| intervention_for_problem | 660 |
| intent_for_archetype | 550 |
| intent_for_problem | 550 |
| family_belongs_to_domain | 400 |
| recommendation_anchored_on_construct | 367 |
| emotion_belongs_to_archetype | 220 |
| runtime_intervention_for_construct | 140 |
| problem_belongs_to_archetype | 88 |

## 4. Edge provenance (source table)
Every edge records the real table it was derived from.
| provenance table | edges |
|------------------|------:|
| capadex_atomic_signals | 47916 |
| capadex_clarity_questions | 30638 |
| capability_problem_behavior_map | 29730 |
| capadex_concern_clarity_map | 9760 |
| behavior_library | 8030 |
| capadex_concern_signal_map | 5858 |
| capadex_concerns_master | 2489 |
| archetype_concern_map | 2151 |
| capability_problem_map | 1810 |
| pil_intervention_library | 1320 |
| search_intents | 1100 |
| capadex_families | 800 |
| recommendation_library | 367 |
| human_emotion_library | 220 |
| intervention_library | 140 |
| human_problem_library | 88 |
| capadex_domains | 20 |
| capadex_signals | 20 |

## 5. Largest components (top 10)
| component | size | dominant type |
|-----------|-----:|---------------|
| 0 | 61158 | clarity_question |
| 1 | 47 | clarity_question |
| 2 | 45 | clarity_question |
| 3 | 20 | recommendation |
| 4 | 18 | recommendation |
| 5 | 18 | recommendation |
| 6 | 18 | recommendation |
| 7 | 18 | recommendation |
| 8 | 18 | recommendation |
| 9 | 18 | recommendation |

## 6. Top hubs (top 15)
| type | label | degree |
|------|-------|-------:|
| bridge_tag | STRENGTH_SIGNAL | 8970 |
| bridge_tag | ADJUSTMENT_COPING | 4173 |
| bridge_tag | CAREER_READINESS | 3160 |
| bridge_tag | DISCIPLINE_HABITS | 2077 |
| bridge_tag | EMOTIONAL_REGULATION | 1952 |
| bridge_tag | CONFIDENCE_SELF | 1796 |
| bridge_tag | SOCIAL_EMOTIONAL | 1548 |
| bridge_tag | EMPLOYABILITY | 1507 |
| bridge_tag | EXAMINATION_STRESS | 1411 |
| bridge_tag | MOTIVATION_VALUES | 1391 |
| bridge_tag | COMPETENCY_DEVELOPMENT | 1353 |
| bridge_tag | EMOTIONAL_RECOVERY | 1258 |
| bridge_tag | ACADEMIC_COGNITIVE | 1119 |
| bridge_tag | THINKING_QUALITY | 1087 |
| bridge_tag | WORKPLACE_ADAPTATION | 1022 |

## 7. Orphans by type (statically-disconnected assets)
These assets have no DB linkage row joining them into the graph today. They are reported,
never force-connected.
| type | count |
|------|------:|
| competency | 299 |

## 8. Honest connectivity findings
- The **bridge tag** is the central hub joining domains, families, atomic signals, signals,
  concerns and clarity questions — it carries the bulk of edges.
- The **construct** region (recommendation_library + recommendation runtime constructs +
  runtime intervention library) forms a runtime-bound component anchored on construct hubs;
  it joins the concern core only where a real linkage row exists.
- **Competency** nodes (`onto_competencies`) are statically disconnected — there is no DB
  linkage row tying them to concerns/signals today, so they surface as their own
  component/orphans (a real finding, not a bug).
- Concern → signal edges use Tier-3 mappings only; composite/atomic/orphan map rows are
  intentionally not promoted to edges here.

## 9. Outputs in this directory
- `graph_summary.json` — machine-readable stats (counts, components, hubs, orphans).
- `components.csv` — every connected component with its type breakdown.
- `hubs.csv` — top 50 hubs by degree.
- `sample_paths.json` — provenance-traced example paths + one session subgraph (1cd9ca07-4659-42c4-83fd-229e5e8f21f2).
- `graph_export.graphml` — induced 2-hop subgraph around a sample concern (anchor=concern:CONCERN_DOM_1 (Adapting to College Academic Structure) · 600 nodes / 1142 edges).
