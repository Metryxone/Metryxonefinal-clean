# WC-3 · Output 2 — Data Model

> Design only. Defines the **additive** schema for all 7 layers. No tables are created in this phase.
> Every table is `wc3_*` namespaced, has a canonical migration + lazy `ensure*Schema()` mirror, and
> history tables are **append-only**. Existing tables are extended additively (new nullable columns).

## Namespace & conventions

- All new tables: `wc3_*`. Never reuse `kg_*` (live Employability graph) or bare PIL names.
- Reuse, don't duplicate: `csi_profiles/trajectory`, `capadex_behavior_graph`, `intervention_library`,
  `career_memory_snapshots`, `capadex_behavioural_memory`, `capadex_question_metadata/registry`.
- Every additive column is **nullable** (flag-off → never read → byte-identical legacy).
- History/audit tables: append-only, `created_at` immutable, no UPDATE/DELETE in runtime path.

## L1 — Stage Intelligence

| Table | Key columns | Notes |
|---|---|---|
| `wc3_stage_definitions` | `stage_key` (PK), `display_label`, `weight` (numeric), `ordinal` | Seed: Awareness 0.25 / Curiosity 0.5 / Clarity 0.75 / Growth 1.0 / Mastery 1.25 |
| `wc3_stage_entity_map` | `entity_type`, `entity_id`, `stage_key`, `confidence`, `evidence_ref` | Maps questions/concerns/behaviours/capabilities/interventions/recs to stages |
| `wc3_stage_state` | `user_id`, `session_id`, `stage_key`, `confidence`, `resolved_at` | Current stage per user/session |
| `wc3_stage_progression` | `id`, `user_id`, `from_stage`, `to_stage`, `reason`, `created_at` | **Append-only** transition history |

## L2 — Outcome Intelligence

| Table | Key columns | Notes |
|---|---|---|
| `wc3_outcome_models` | `model_key` (PK), `display_label`, `composition_spec` jsonb | Career Clarity / Learning Effectiveness / Employability Readiness / Exam Readiness / Confidence Stability / Decision Quality |
| `wc3_outcome_state` | `user_id`, `session_id`, `model_key`, `current_state`, `desired_state`, `gap`, `confidence` | "Desired" binds to L1 stage target |
| `wc3_outcome_actions` | `id`, `outcome_state_id` (FK), `intervention_id`, `rank` | **Library-backed only** (FK to `intervention_library`); no generic actions |

## L3 — Journey Intelligence

| Table | Key columns | Notes |
|---|---|---|
| `wc3_journey_pathways` | `pathway_key` (PK), `display_label`, `trigger_spec` jsonb, `destination` | LBI / Career Builder / Employability / Exam Intelligence |
| `wc3_journey_state` | `user_id`, `session_id`, `pathway_key`, `stage_within_pathway`, `confidence` | Stage-within-pathway |
| `wc3_routing_decisions` | `id`, `user_id`, `session_id`, `pathway_key`, `score`, `suppressed` bool, `created_at` | **Append-only** routing audit |

## L4 — Dynamic Personalization

| Table | Key columns | Notes |
|---|---|---|
| `wc3_personalization_profile` | `user_id` (PK), `dims` jsonb (age/persona/context/archetype/severity), `confidences` jsonb | Resolved per user |
| `wc3_personalization_decisions` | `id`, `user_id`, `session_id`, `tag`, `selected_question_ids` jsonb, `divergence_score`, `created_at` | **Append-only**; proves journey divergence |

> No rewrite of `capadex_question_metadata` here — within-tag enrichment is a **gated dependency**
> (C-2 capability Wave 2), tracked in the roadmap, not part of L4's own schema.

## L5 — Question Intelligence 2.0

| Change | Detail |
|---|---|
| Extend `capadex_question_metadata` | **Additive nullable** columns `qis_v2` numeric, `qis_v2_components` jsonb |
| `wc3_question_quality_matrix` | **MATERIALIZED VIEW**: `question_id · bridge_tag · relevance · specificity · context_fit · persona_fit · stage_fit · composite_quality` (refreshed by the QIS-V2 job) |
| `capadex_question_registry` | Status promotion fields for QIS-V2 lifecycle (human-governed, never auto-deprecated) |

## L6 — Longitudinal Intelligence

| Table | Key columns | Notes |
|---|---|---|
| `wc3_longitudinal_snapshots` | `id`, `user_id`, `session_id`, `vector` jsonb, `created_at` | **Append-only** per-session vector; reuses `career_memory_snapshots` where present |
| `wc3_longitudinal_trends` | `user_id` (PK), `slope`, `drift`, `resilience`, `stage_velocity`, `updated_at` | Derived; recomputed forward-only (never rewrites past snapshots) |

## L7 — Outcome Validation

| Table | Key columns | Notes |
|---|---|---|
| `wc3_outcome_predictions` | `id`, `user_id`, `session_id`, `model_key`, `predicted` jsonb, `created_at` | Snapshot at prediction time |
| `wc3_outcome_observations` | `id`, `prediction_id` (FK), `observed` jsonb, `observed_at` | Later real observation only |
| `wc3_outcome_validation_runs` | `id`, `cohort`, `model_key`, `accuracy`, `calibration`, `n`, `created_at` | Metrics on **real pairs only**; harness allowed to fail |

## Entity-relationship summary

```
capadex_question_metadata ──(qis_v2)──► wc3_question_quality_matrix ──► L4 picker score
                                                                         │
csi_profiles/trajectory ─┐                                               ▼
capadex_behavior_graph  ─┼──► wc3_stage_state ──► wc3_outcome_state ──► wc3_journey_state
intervention_library  ───┘            │                  │                    │
                                      ▼                  ▼                    ▼
                            wc3_stage_progression  wc3_outcome_actions  wc3_routing_decisions
                                      │                  │
career_memory_snapshots ──► wc3_longitudinal_snapshots ──► wc3_longitudinal_trends
                                                              │
wc3_outcome_predictions ──► wc3_outcome_observations ──► wc3_outcome_validation_runs
```

All FKs point **into** existing canonical tables or within `wc3_*`; nothing mutates existing rows.
