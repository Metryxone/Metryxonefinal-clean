---
name: WC-1 ontology coverage audit
description: Structural facts + measurement rules for auditing CAPADEX construct coverage per bridge tag (read-only).
---

# WC-1 — Construct Coverage & Ontology Audit

Read-only audit of construct completeness per bridge tag. Script `backend/scripts/audit/wc1-ontology-audit.ts` → `audit/wc1/`. NEVER modify the ontology in this phase.

## Durable structural findings (live DB at audit time)
- **Signal grounding has two layers — report BOTH.** Native `capadex_signals` coverage: only **25/328** concern bridge tags (7.6%) carry native atomic signals. But `capadex_bridge_tag_signal_grounding` (the additive provenance-stamped linkage table from WC-1B) has **28,683 rows covering 303/328 bridge tags = 92%**. Union (native OR grounding table) = 92%. The 7.6% headline is native-only baseline, accurate only before WC-1B grounding work. Always report both axes — native and union — or you misrepresent the true coverage state.
- **No marketed construct is first-class.** None of the 10 marketed constructs has dedicated atomic signals under a dedicated bridge tag → GREEN is unreachable; the systemic block is the missing construct→signal binding.
- **Interventions/recommendations are a SEPARATE namespace, not bridge tags.** `recommendation_library.anchor_construct` (33 vals) / `intervention_library.construct_key` (38 vals) are a compact construct vocabulary (ANXIETY, CAREER_CLARITY…) bound to the ontology ONLY at runtime. There is NO stored bridge-tag↔construct edge → any per-tag recommendation/intervention-construct coverage is a **lexical proxy**, must be labelled as such, never as a real edge.
- **Capability == Problem.** `capability_problem_map` stores a strength-framing and deficit-framing of the SAME concern_id per row → capability and problem coverage are identical and are NOT two independent health signals.
- Behaviour coverage is universal (every concern has ≥1 `behavior_library` row); archetype/intervention(archetype-grounded via `pil_intervention_library.archetype_key`) ~86%.

## Measurement rules (so a re-run stays honest)
- Per bridge tag, coverage layers are concern-volume-weighted; presence layers are % of tags. Health = unweighted mean of the 8 layer scores.
- **Signal reconciliation must be emitted** (total_tagged_atomic, distinct_atomic_tags, atomic_tags_overlapping_concern_tags, atomic_signals_under_concern_tags) — the matrix `signal_count` column only counts signals under concern-tags (summed 6,761), which is NOT the 15,972 total; stating "15,972 in 28 tags" without this reconciliation reads as a fabricated/mismatched headline (architect will FAIL it).
- **RAG must discriminate.** RED = no first-class presence at all (no dedicated tag AND no questions AND no rec/intervention construct). A lenient RED rule collapses everything to YELLOW and hides that Leadership/Decision Making/Future Readiness/Entrepreneurship have no first-class home.
- Overlap = top similarity pairs from `construct_similarity_map`; consolidation = its `recommended_group` clusters ranked by member_count × avg_similarity. These are pre-computed — use them, don't re-cluster.
