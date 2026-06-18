---
name: WC-3 L3 Journey Intelligence routing
description: How WC-3 composes a per-session product route, and the two business invariants future WC-3 phases must keep.
---

# WC-3 L3 Journey Intelligence (Phase C)

Compose-only route recommendation per session: ranks the seeded `wc3_journey_routes`
catalog (LBI, Career Builder, Employability Index, Competitive Exam, Mentoring) by
`fit = Σ(route.model_affinity[model] × L2_model.confidence)` over ACTIVATED L2 outcome
models only. Reads L1 stage + L2 outcome via their read-only getters
(`getSessionStage` / `getSessionOutcomes`) — L2 getter works even when the L2 flag is
OFF, so L3 needs only its own flag (`wc3Journey` / `FF_WC3_JOURNEY`).

## Two invariants (keep these in every future WC-3 route/phase)
1. **Never terminate without a route.** When no L2 model activates (UNCLASSIFIED /
   empty spine), DETERMINISTICALLY route to the `is_fallback` route (Mentoring,
   `fallback_priority=0`) with `degraded:true` + honest floor confidence (0.2) +
   `LOW_CONFIDENCE`. Enforced again at the DB: `wc3_journey_state.primary_route` is
   `NOT NULL`.
   **Why:** business rule — a concern must always get a next step, never a dead end.

2. **Gated pathways stay supported, not dropped.** A route with
   `corpus_status='corpus_pending'` (Competitive Exam) still wins on fit; its band is
   forced to `CORPUS_PENDING` (not suppressed). `bandFor()` checks corpus_status
   BEFORE the numeric thresholds.
   **Why:** the exam corpus is still expanding but the pathway must be routable now.

## How to apply
- Route affinities reference the REAL L2 `wc3_outcome_models.model_key` vocabulary —
  never invent model keys. Contributing models in `route_reason` must be the actual
  activated ones (no fabrication; fallback says so honestly).
- Mirror the L1/L2 contract exactly: resolver/reader never throw; GET route returns
  `{ok:true,enabled:false}` BEFORE the uuid check when the flag is OFF (byte-identical).
- Detail lives in `backend/audit/wc-3/WC3_PHASE_C_DELTAS.md`.
