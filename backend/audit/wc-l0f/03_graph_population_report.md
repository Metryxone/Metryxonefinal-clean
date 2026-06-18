# WC-L0F · Deliverable 3 — Graph Population Report
_Generated 2026-06-10T02:58:51.179Z._

- Sessions with a materialized behaviour graph (`capadex_behavior_graph`): **7/9 = 77.8%** (before: 7/9).
- Graph-gap sessions WITH responses (the only honest backfill target): 0 → 0 after run.
- Un-backfillable 0-response sessions (no graph, no evidence): 2 → **honest population ceiling = 7/9** (all response-bearing sessions graphed).
- Re-persist idempotency check (VALUE-level, per-dim before/after): 9/9 sessions re-projected to BYTE-IDENTICAL dim values (no regression) — zero drift, namespace alignment preserved the deficit dims (none silently reverted to NULL).
