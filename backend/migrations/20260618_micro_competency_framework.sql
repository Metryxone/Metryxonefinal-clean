-- Phase 1.4 — Micro Competency Framework (parent-child structure).
--
-- ADDITIVE parent-child relationship layer over the canonical competency genome
-- (onto_competencies). A "micro competency" is a granular child skill grouped
-- under a parent competency (e.g. Communication -> Active Listening / Written
-- Communication / Presentation Skills).
--
-- Honesty contract (mirrors the rest of Competency Framework Intelligence):
--   - Strictly ADDITIVE: never mutates onto_competencies. The hierarchy lives in
--     this table only; dropping it restores byte-identical prior behaviour.
--   - NEVER fabricates competencies: a child is EITHER a real existing competency
--     (child_competency_id FK) OR a named micro item (micro_label only) that has
--     no canonical competency row yet. Named-only children are honestly flagged
--     (not silently promoted into the genome).
--   - Reversible + idempotent: the seed only inserts missing relationships
--     (ON CONFLICT DO NOTHING) and never overwrites admin-curated rows.

CREATE TABLE IF NOT EXISTS onto_competency_hierarchy (
  id                    SERIAL PRIMARY KEY,
  parent_competency_id  VARCHAR(80)  NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  child_competency_id   VARCHAR(80)           REFERENCES onto_competencies(id) ON DELETE CASCADE,
  micro_label           VARCHAR(160) NOT NULL,
  micro_slug            VARCHAR(180) NOT NULL,
  sort_order            INT          NOT NULL DEFAULT 0,
  source                VARCHAR(30)  NOT NULL DEFAULT 'default',
  active                BOOLEAN      NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- a competency cannot be its own micro-competency
  CONSTRAINT chk_hier_no_self CHECK (child_competency_id IS DISTINCT FROM parent_competency_id)
);

-- One micro label per parent (covers both linked + named-only children).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hier_parent_slug
  ON onto_competency_hierarchy (parent_competency_id, micro_slug);

-- One link to a given existing competency per parent (linked children only).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hier_parent_child
  ON onto_competency_hierarchy (parent_competency_id, child_competency_id)
  WHERE child_competency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hier_parent ON onto_competency_hierarchy (parent_competency_id);
CREATE INDEX IF NOT EXISTS idx_hier_child  ON onto_competency_hierarchy (child_competency_id);
CREATE INDEX IF NOT EXISTS idx_hier_source ON onto_competency_hierarchy (source);
