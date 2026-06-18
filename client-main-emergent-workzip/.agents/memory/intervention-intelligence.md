---
name: Intervention Intelligence (Best Next Actions)
description: Top-5 per-session action ranker — how it stays non-generic and how it's ranked/persisted.
---

# Intervention Intelligence — Best Next Actions

The "non-generic recommendations" requirement is satisfied **structurally**, not by
copy-checking: candidates come ONLY from the existing library-backed
`generateInterventions()` engine, which emits nothing unless an ontology signal maps
(via `SIGNAL_CONSTRUCT_MAP`) to a real `intervention_library` row. The intelligence
layer (`generateInterventionIntelligence`) NEVER fabricates a candidate — it only
re-ranks and trims to Top-5. If no candidate maps, it persists an empty set.

**Why:** the spec forbade generic advice; reusing the library engine as the sole
candidate source makes "generic" structurally impossible rather than relying on
post-hoc filtering.

**How to apply:** never add a fallback/default action path here. If you need new
recommendation copy, add it to `intervention_library` + the ontology→construct map,
not to this ranker.

## Ranking + provenance invariants
- `score = 0.30·severity + 0.25·signalFrequency + 0.25·patternStrength + 0.20·historicalEffectiveness` (weights sum to 1).
- Persistence invariant matches the rest of the runtime: one set per session, absolute upsert on `(session_id, intervention_key)` + reconcile-delete of stale keys → stable, idempotent reruns.
- Pragati drift/escalation is read **directly from `pragati_sessions`**, NOT from the Unified Behavior Graph — the graph lists Pragati only as a contributor and does not persist `drift_direction`. Don't "fix" this to read from the graph; the graph payload lacks the field.
- All external reads are best-effort/wrapped; a missing subsystem degrades ranking and never throws (wired non-blocking on completion).
