# Phase 8 — Global Competency Coverage Evidence

- Version: `phase8-global-competency-1.0.0`
- Generated: 2026-06-23T20:13:23.912Z
- Default region: `IN` (== today; India-centric)

## 1. Per-region coverage (baseline)

Overlay table present: `true`

| Region | Default | Role Libraries | Benchmarks | Competency Models | Readiness Models | Demand Intelligence | Surfaces w/ content |
|---|---|---|---|---|---|---|---|
| IN (India) | yes | 5 | 15 | 419 | 4 | 81 | 5/5 |
| ME (Middle East) |  | 0 | 0 | 0 | 0 | 0 | 0/5 |
| EU (Europe) |  | 0 | 0 | 0 | 0 | 0 | 0/5 |
| US (United States) |  | 0 | 0 | 0 | 0 | 0 | 0/5 |
| APAC (Asia-Pacific) |  | 0 | 0 | 0 | 0 | 0 | 0/5 |

Interpretation: the **default region inherits the real global counts**; every **non-default region is honestly empty** (no regional content has been authored — this phase delivers the framework, not the data). `null` = backing table absent/unreadable (distinct from `0`).

## 2. Threadability + reversibility (assign → recount → rollback)

- Tagged ONE real `onto_roles` entity (`role_be_eng`) to region `EU`, surface `role_library`.
- EU.role_library effective_content: **0 → 1** after assign (written=1).
- Rolled back (deleted=1); EU.role_library effective_content restored to **0**.

Result: **PASS** — the region dimension threads through additively and is fully reversible; no regional content was fabricated (only an existing entity was region-tagged, then untagged).

## 3. Honesty guard: nonexistent entities are rejected

- Submitted 2 nonexistent role refs → valid=0, rejected=2, written=0.
Result: **PASS** — refs that do not exist in the backing table are rejected, so coverage can never be inflated by fabricated entities.

## Honesty boundary

- Phase 8 delivers a **structural framework + per-region coverage reporting only**. No regional benchmarks, roles, competency models, readiness models, or demand content were authored.
- Non-default regions reporting zero is the **honest finding**, not a defect.
- The whole phase is reversible (drop `global_region_content` or delete by provenance); existing tables are never altered. Flag OFF → byte-identical incl. schema.