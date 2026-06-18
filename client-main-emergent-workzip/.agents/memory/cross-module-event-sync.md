---
name: Cross-module event-driven sync
description: An adaptive event bus already exists; connect to it. Watch the BIGINT-vs-UUID identity-space trap when wiring career-seeker writes.
---

# Cross-module event-driven synchronization

**An event-driven sync system already exists — connect to it, never rebuild.**
The adaptive event bus (singleton EventEmitter that persists events) plus the
orchestrator's refresh-state tracker already implement "module X affects
intelligence targets Y." Add new module events + a propagation matrix entry;
do NOT introduce a new bus/store/table/engine.

## The identity-space trap (the non-obvious part)

The adaptive orchestration subsystem was built around **numeric (BIGINT) user
ids** (the assessment/CAPADEX space). The career-seeker module uses
**varchar UUID** `users.id`. They are different identity spaces.

**Why it matters:** the two persistence sinks disagree on id type —
- the event log's `user_id` column is **BIGINT** (rejects UUIDs; `Number(uuid)` = NaN), but
- the staleness tracker's `scope_id` column is **TEXT** (holds UUIDs natively).

So a naive `Number(userId)` coercion at the call site silently NaNs and drops
propagation for every UUID user.

**How to apply (rule):**
- Pass the **raw** user id (no numeric coercion) from career-seeker handlers.
- When emitting, attach a numeric `user_id` only when the id is actually numeric;
  otherwise persist NULL and carry the raw id in the event payload for
  traceability. The TEXT staleness row is the signal that works for both spaces.
- Wire propagation as fire-and-forget AFTER the primary DB write
  (`void propagate(...).catch(()=>{})`) so it can never fail the user request.
- Frontend needs no change: the Career brain already recomputes its read-time
  engines from page state on every mutation; the backend event is the
  system-level record other consumers/sessions read.

## Two-backend boundary

The in-process bus lives in the main `backend/` only. Learning and Mentor live
in the SEPARATE `frontend/server/src` Express process (also a guardrailed dir) —
they cannot reach the in-process emitter and need a backend ingest endpoint to
bridge in. Deferred for that reason.

Integration map: `docs/integration-map.md`.
