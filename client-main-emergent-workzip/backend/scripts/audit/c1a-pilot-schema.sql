-- C-1A PILOT — sandbox-only persistence. SANDBOX, NOT production.
-- Holds per-question pilot enrichment for the 10-tag pilot subset only.
-- Combines reused C-2 dims (context, archetype) with the C-2-deferred dims
-- (capability facet, behavior facet, signal backfill) for measurement.
-- REVERSIBLE: DROP TABLE pilot_c1a_enrichment; -- fully reverts the pilot.
-- Touches NO production table; original metadata/question text untouched.

CREATE TABLE IF NOT EXISTS pilot_c1a_enrichment (
  question_id                 text PRIMARY KEY,
  master_bridge_tag           text,
  -- reused, validated C-2 dimensions
  context_primary             text,
  archetype                   text,
  -- C-2-deferred dimensions under pilot test
  capability_facet            text,
  capability_facet_secondary  text,
  capability_confidence       numeric(4,3),
  behavior_facet              text,
  behavior_facet_secondary    text,
  behavior_confidence         numeric(4,3),
  signal_family_backfill      text,
  signal_confidence           numeric(4,3),
  signal_source               text,
  created_at                  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pce_tag ON pilot_c1a_enrichment (master_bridge_tag);
