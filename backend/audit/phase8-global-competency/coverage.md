# Phase 8 — Global Competency Coverage Evidence

- Version: `phase8-global-competency-1.0.0`
- Generated: 2026-06-24T00:49:32.152Z
- Default region: `IN` (== today; India-centric)

## 1. Per-region coverage (baseline)

Overlay table present: `true`

| Region | Default | Role Libraries | Benchmarks | Competency Models | Readiness Models | Demand Intelligence | Surfaces w/ content |
|---|---|---|---|---|---|---|---|
| IN (India) | yes | 5 | 15 | 419 | 4 | 81 | 5/5 |
| ME (Middle East) |  | 5 | 10 | 419 | 0 | 81 | 4/5 |
| EU (Europe) |  | 5 | 10 | 419 | 0 | 81 | 4/5 |
| US (United States) |  | 5 | 10 | 419 | 0 | 81 | 4/5 |
| APAC (Asia-Pacific) |  | 5 | 10 | 419 | 0 | 81 | 4/5 |

Interpretation: the **default region inherits the real global counts**; each **non-default priority region now carries curated content** on 4/5 surfaces (role libraries, competency models, benchmarks, demand intelligence) authored by the region-content seed. `readiness_models` stays at 0 for non-default regions by design (individual user snapshots are not regionalizable). `null` = backing table absent/unreadable (distinct from `0`).

## 2. Threadability + reversibility (assign → recount → rollback)

- Tagged ONE real `career_readiness_history` entity (`4`) to region `EU`, surface `readiness_models`.
- EU.readiness_models effective_content: **0 → 1** after assign (written=1).
- Rolled back (deleted=1); EU.readiness_models effective_content restored to **0**.

Result: **PASS** — the region dimension threads through additively and is fully reversible; no regional content was fabricated (only an existing entity was region-tagged, then untagged).

## 3. Honesty guard: nonexistent entities are rejected

- Submitted 2 nonexistent role refs → valid=0, rejected=2, written=0.
Result: **PASS** — refs that do not exist in the backing table are rejected, so coverage can never be inflated by fabricated entities.

## Honesty boundary

- The region-content seed authors **universal-inheritance curation**: existing region-agnostic entities (role definitions, the scientific competency genome, global/structural benchmark cohorts, global market signals) are region-tagged. It does **not** fabricate region-native statistics, benchmarks, demand figures, or roles.
- `readiness_models` is left empty for non-default regions on purpose — `career_readiness_history` holds subject-specific user snapshots, not regionalizable reference content. India-population statistical cohorts (`coh_role_*`) are also excluded from the benchmark overlay, making it an honest subset.
- The whole effect is reversible (delete by provenance `phase8_global_competency` or drop `global_region_content`); existing tables are never altered. Flag OFF → byte-identical incl. schema.