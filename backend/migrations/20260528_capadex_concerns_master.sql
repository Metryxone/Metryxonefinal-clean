-- ─────────────────────────────────────────────────────────────────────────────
--  Migration: capadex_concerns_master
--  Date:      2026-05-28
--  Purpose:   Persist the richer CAPADEX concerns catalogue (~2,500 rows)
--             produced by `scripts/audit_capadex_concerns.py`. Distinct from
--             the legacy `concern_areas` table (LBI persona-tagged keyword
--             buckets) — this is the structured behavioural-intelligence
--             taxonomy with relational bridge tags + age bounds + routing
--             slots used by the BIOS / OMEGA-X scoring pipeline.
--  Notes:
--   * `concern_id` is NOT unique — the source contains 17 collisions across
--     2,505 rows (different domains can mint the same `CONCERN_*_n` token),
--     so we surrogate-PK on SERIAL and index `concern_id` for lookups.
--   * Routing slots (assessment_dimension, root_cause_group, intervention_lens,
--     capability_mapping) are NOT NULL — the audit script fortifies blanks
--     with the deterministic `UNASSIGNED_ROUTING_NODE` token.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capadex_concerns_master (
  id                       SERIAL PRIMARY KEY,
  concern_id               TEXT NOT NULL,
  domain                   TEXT NOT NULL,
  concern_cluster          TEXT NOT NULL,
  relevance_in_india       TEXT,
  parent_anxiety_level     TEXT,
  growth_trend             TEXT,
  severity                 TEXT,
  capadex_priority         TEXT,
  common_indian_context    TEXT,
  primary_persona          TEXT,
  contextual_modifier      TEXT,
  concern_category         TEXT,
  intelligence_layer       TEXT,
  signal_cluster           TEXT,
  assessment_dimension     TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  root_cause_group         TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  intervention_lens        TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  capability_mapping       TEXT NOT NULL DEFAULT 'UNASSIGNED_ROUTING_NODE',
  relational_bridge_tag    TEXT NOT NULL,
  age_min                  INTEGER,
  age_max                  INTEGER,
  source_row_index         INTEGER,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS capadex_concerns_master_concern_id_idx
  ON capadex_concerns_master(concern_id);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_domain_idx
  ON capadex_concerns_master(domain);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_bridge_idx
  ON capadex_concerns_master(relational_bridge_tag);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_persona_idx
  ON capadex_concerns_master(primary_persona);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_age_idx
  ON capadex_concerns_master(age_min, age_max);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_severity_idx
  ON capadex_concerns_master(severity);
CREATE INDEX IF NOT EXISTS capadex_concerns_master_priority_idx
  ON capadex_concerns_master(capadex_priority);
