# Deliverable 1 — Outcome State Capture
_Generated 2026-06-09T13:38:24.983Z_

`wc3_outcome_state` was **0 rows** before this activation. The backfill replays
`resolveSessionOutcomes` (the exact engine the post-completion hook uses) over every completed
session, with the existing clarity-bank crosswalk enabled. Nothing new is computed — outcomes are
built from already-resolved constructs / concerns and the existing 8 outcome models.

## Coverage (over 9 completed sessions)
| Metric | Value | Definition |
|---|---|---|
| Sessions with outcome state | **3/9 (33.3%)** | distinct `session_id` in `wc3_outcome_state` |
| Outcome model rows | **7** | one row per (session, matched model) |
| Mean confidence | **0.66** | per-model WC-3 calibration (stage·0.5 + action·0.3 + overlap·0.2) |

## Why 6/9 sessions are unclassified (honest, not a bug)
The behavioural spine (composites / patterns / behavioural_hypotheses) is **empty for every
completed session**, so `loadSessionConstructs` only resolves anything via the crosswalk, which
needs a `primary_construct_key` or a mapped concern bridge tag.

Anchor viability is judged with the SAME join the crosswalk uses (`primary_construct_key` UNION
`master_concern_pk` → `capadex_concerns_master.relational_bridge_tag`) — not a bare
`master_concern_pk IS NULL` proxy.

| Unclassified bucket | Count | Meaning |
|---|---|---|
| No anchor at all | **6/9** | no `primary_construct_key` AND no resolvable bridge tag → `loadSessionConstructs` returns `[]` → `unclassified (no_constructs)` |
| Anchor present, no outcome | **0/9** | an anchor exists (construct or bridge tag) but the crosswalk still produced no outcome (tag not mapped by `resolveConstructForBridgeTag`, or no overlapping model). The finer split lives inside the engine's crosswalk fn — not re-derived here, to avoid fidelity drift |

Both buckets **write nothing**. This is the honest, additive contract: absent or unmappable data ⇒ no
state, never a fabricated one.

> Coverage and Confidence are independent axes. The coverage here reflects exactly the sessions whose
> already-computed data supports an outcome — it is never padded to a target.
