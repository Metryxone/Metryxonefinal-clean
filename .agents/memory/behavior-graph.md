---
name: Unified Behavior Graph
description: How the CAPADEX behavior graph aggregator is wired and why it is read-only/best-effort
---

# Unified Behavior Graph

`backend/services/behavior-graph-service.ts` aggregates EVERY existing CAPADEX intelligence
system's per-session output into one persisted graph. It creates **no** new ontology or signals —
it only reads what the runtime already persisted.

**Rule:** every external subsystem read (signals/patterns/interventions, contradictions, risk flags,
OMEGA-X longitudinal memory, CSI profile, Pragati, OMEGA quality) is wrapped in try/catch and is
best-effort; persistence is best-effort too; generation is wired non-blocking on session completion.

**Why:** the source tables are frequently empty in dev (higher-order runtime / feature flags gate
them), and the spec demands "do not break existing functionality". A missing subsystem must degrade
the graph gracefully, never throw, and never interrupt session completion.

**How to apply:** when extending it, keep new sources behind the same wrapped/best-effort pattern;
keep "one graph per session" via the `session_id` PK + absolute upsert (`ON CONFLICT (session_id)`);
keep the lazy `ensureBehaviorGraphSchema()` in lockstep with `migrations/20260530_behavior_graph.sql`.

**Gotcha:** `capadex_behavior_graph` has NO `id` column (PK is `session_id`). Delete/lookup by
`session_id` only — a stray `OR id=...` clause errors and silently no-ops under a `.catch`.
