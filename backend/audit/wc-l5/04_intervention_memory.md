# WC-L5 · Deliverable 4 — Intervention Memory
_Generated 2026-06-10T04:43:53.119Z. Read-only._

`intervention_memory` remembers what WC-L4 **persisted** — it reads the already-stored
`wcl4_interventions` rows, never a re-derivation. If WC-L4 has not been backfilled the source is absent
and intervention_memory is honestly **0** (reported here, never silently zeroed or fabricated).

| Metric | Value |
|---|---|
| Intervention memory rows | 6 |
| Sessions with ≥1 intervention memory | 4 |
| Coverage of completed sessions | 44.4% |

## Dependency & ordering
Intervention memory is bounded by the WC-L4 persistence layer (`wcl4_interventions`), which is itself
generator-bound (only sessions whose outcome models carry ≥1 library-backed action produce an
intervention). The WC-L5 backfill MUST run AFTER the WC-L4 backfill; a missing/empty WC-L4 source yields
zero intervention memory by design — a true upstream ceiling, not a WC-L5 defect.
