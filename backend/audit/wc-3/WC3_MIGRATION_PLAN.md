# WC-3 · Output 4 — Migration Plan

> Design only. No migrations are run in this phase. Defines the additive, reversible migration set for
> all 7 layers, following the canonical-migration + lazy-ensure-schema convention.

## Principles

- **Additive only** — `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (all
  new columns nullable). No drops, no renames, no type changes on existing columns.
- **Canonical file + lazy mirror** — each migration has a `migrations/<date>_wc3_*.sql` file AND a lazy
  `ensure<Layer>Schema()` that mirrors it exactly (no migration runner in prod).
- **Idempotent** — every statement guarded (`IF NOT EXISTS`); a second run is a no-op (avoids the
  42703/duplicate-object traps seen in PIL Phase 2).
- **Reversible** — each migration ships a documented down-path (`DROP TABLE wc3_*`), which fully
  reverts the layer (the WC-2/pilot sandbox-revert pattern).
- **Flag-decoupled** — schema can exist with the flag OFF (nullable columns never read) → safe to
  migrate ahead of enabling.

## Migration set (ordered by dependency)

| # | Migration file (proposed) | Creates | Depends on |
|---|---|---|---|
| M1 | `<date>_wc3_question_intelligence_v2.sql` | `capadex_question_metadata.qis_v2`, `qis_v2_components`; `wc3_question_quality_matrix` | none |
| M2 | `<date>_wc3_personalization.sql` | `wc3_personalization_profile`, `wc3_personalization_decisions` | M1 (reads qis_v2 optionally) |
| M3 | `<date>_wc3_stage.sql` | `wc3_stage_definitions` (+seed), `wc3_stage_entity_map`, `wc3_stage_state`, `wc3_stage_progression` | none |
| M4 | `<date>_wc3_outcome.sql` | `wc3_outcome_models` (+seed), `wc3_outcome_state`, `wc3_outcome_actions` | M3 |
| M5 | `<date>_wc3_journey.sql` | `wc3_journey_pathways` (+seed), `wc3_journey_state`, `wc3_routing_decisions` | M3, M4 |
| M6 | `<date>_wc3_longitudinal.sql` | `wc3_longitudinal_snapshots`, `wc3_longitudinal_trends` | none |
| M7 | `<date>_wc3_outcome_validation.sql` | `wc3_outcome_predictions`, `wc3_outcome_observations`, `wc3_outcome_validation_runs` | M4, M6 |

> M1, M3, M6 have **no dependencies** and can land first/parallel. M2→M5 form the stage→outcome→journey
> chain. M7 is last (needs predictions + observations).

## Seed data (idempotent, design-time constants only)

- `wc3_stage_definitions`: 5 rows (Awareness/Curiosity/Clarity/Growth/Mastery + weights).
- `wc3_outcome_models`: 6 rows (composition specs reference existing engines, not new data).
- `wc3_journey_pathways`: 4 rows (Learning/Career/Employability/Exam + destination + trigger spec).

No row references invented ontology/signal/concern data — seeds are framework constants only.

## Production parity (per database skill)

- Dev → prod applies the **same** canonical SQL (additive, idempotent) via the documented prod-push
  path; nullable columns mean prod can migrate ahead of flag-enable with zero risk to live traffic.
- No backfill of existing rows in the migration (backfills, e.g. QIS-V2 computation, are separate
  gated jobs, not migrations).

## Reversibility matrix

| Layer | Down-path | Data loss on revert |
|---|---|---|
| L5 | `ALTER ... DROP COLUMN qis_v2*`; `DROP MATERIALIZED VIEW wc3_question_quality_matrix` | derived only (recomputable) |
| L1–L4, L6, L7 | `DROP TABLE wc3_*` | derived/append-only logs only; no source data touched |

Because every layer is additive and derived, **revert = drop**; no existing CAPADEX data is ever at
risk.
