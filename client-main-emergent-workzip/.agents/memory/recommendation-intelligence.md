---
name: Recommendation Intelligence (Phase 7)
description: How CAPADEX composes existing intelligence into per-stakeholder recommendations; anchoring, honest explainability, and the route-collision trap.
---

# Recommendation Intelligence layer (PIL Phase 7)

COMPOSES existing intelligence (archetypes · interventions · 6C reports · pipeline
lineage · capabilities · behaviours) into 4 recommendation categories
(Career/Learning/Project/Development) per stakeholder (Student/Parent/Counselor/
Institution). NO new scoring/archetypes — additive, read-only of intelligence,
flag-gated (`isRuntimeIntelligenceActivationEnabled`), deterministic, never throws.

## Anchor = behavioural CONSTRUCT (no orphans)
A rec fires ONLY for a construct ACTIVE in the session. Active constructs derived as:
PRIMARY = `capadex_session_interventions.construct_key` (deepest trace, source
`intervention`, anchors at `archetype_to_intervention`); FALLBACK (only when zero
interventions) = concern→construct via `lookupConstruct(concern_area)` after looking up
`concern_area` from `capadex_concerns_master` by the pipeline's `resolution.concern_id`
(source `concern`, anchors at `signal_to_concern`). Catalog rows keyed
(category, sub_type, anchor_construct, stakeholder); selecting only active constructs is
what guarantees no orphan/no generic copy.

**Why:** the spec demands every rec trace back to a real resolved construct; anchoring on
the construct (not the concern text) reuses the 33-construct vocabulary the whole PIL
already speaks.

## Honest explainability (the 6C lesson, repeated)
8th node `intervention_to_recommendation` appended to `chainTo(lineage, anchor_hop)`.
- `traced` = trace has ≥1 REAL resolved lineage hop (NOT just the rec node).
- `chain_complete` is reported SEPARATELY (all 7 hops resolved) — coverage can be 100%
  while `chain_complete_count` is 0 and `unresolved_hops` > 0. Never let coverage
  overclaim a complete chain.
- Readiness band is CAPPED at `partial` when degraded, and an EMPTY set is forced to
  `thin` with its explainability component zeroed (vacuous coverage=1 must not inflate
  readiness for a cohort/session with no composed recs).

**How to apply:** reuse `HOP_ORDER`/`chainTo` from `report-explainability-engine` (both
exported there); `deepestResolvedHop(lineage, preferred)` caps the anchor at the deepest
resolved hop ≤ preferred so the trace never cites an unresolved hop.

## Route-collision trap (caught in review)
A legacy RIE route `GET /api/capadex/session/:id/recommendations` already exists
(`registerCapadexRecommendationsRoute`, returns `{recommendations, has_escalation}` from
`rie_recommendations`). It is registered AFTER `registerCapadexRoutes` in `routes.ts`, so
a new `/recommendations` handler inside `registerCapadexRoutes` SHADOWS it (Express
first-match) → silent breaking contract change. Phase 7 therefore lives on a distinct
path: `/session/:id/recommendation-intelligence` + `/institution/recommendation-intelligence`.

**Why:** "additive" means additive at the ROUTE level too. Before adding a route inside an
early-registered router, grep the whole file (and other routers) for the same path —
two registrations of the same method+path do not error, the first wins.
