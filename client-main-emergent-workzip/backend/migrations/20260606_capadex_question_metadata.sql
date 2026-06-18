-- CAPADEX AQ-2 — Assessment Metadata Reconstruction (ADDITIVE, reversible).
--
-- A reconstructed metadata-intelligence layer over the live question bank
-- `capadex_clarity_questions`. One row per question_id. NOTHING in the runtime
-- reads this table yet (deliberate follow-up) — it does not regenerate questions,
-- change scoring, or alter reports. Provenance-stamped 'aq2_reconstruction'.
--
-- Reversibility: DELETE FROM capadex_question_metadata WHERE provenance='aq2_reconstruction';
--                (or DROP TABLE capadex_question_metadata;)

CREATE TABLE IF NOT EXISTS capadex_question_metadata (
  id                          BIGSERIAL PRIMARY KEY,
  question_id                 TEXT NOT NULL UNIQUE,
  master_bridge_tag           TEXT,

  -- Phase 1: canonical age model (11-13 / 14-17 / 18-24 / 25-45 / 46+)
  age_min                     INTEGER,
  age_max                     INTEGER,
  age_band                    TEXT,
  age_confidence              NUMERIC(4,3),

  -- Phase 2: persona layer (multiple allowed; relevance score per persona)
  personas                    JSONB,          -- { "Student": 0.82, "Parent": 0.30, ... }
  persona_primary             TEXT,
  persona_confidence          NUMERIC(4,3),

  -- Phase 3: development stage (Awareness / Curiosity / Clarity / Growth / Mastery)
  dev_stage                   TEXT,
  dev_stage_confidence        NUMERIC(4,3),

  -- Phase 4: behavior layer
  primary_behavior            TEXT,
  secondary_behavior          TEXT,
  behavior_confidence         NUMERIC(4,3),

  -- Phase 5: capability layer
  primary_capability          TEXT,
  secondary_capability        TEXT,
  capability_confidence       NUMERIC(4,3),

  -- Phase 6: signal layer (WC-1B runtime grounding)
  signal_family               TEXT,
  signal_strength             TEXT,
  signal_confidence           NUMERIC(4,3),

  -- composite
  question_intelligence_score NUMERIC(5,2),
  provenance                  TEXT NOT NULL DEFAULT 'aq2_reconstruction',
  derivation                  JSONB,          -- per-dimension source/method notes
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cqm_bridge_tag ON capadex_question_metadata(master_bridge_tag);
CREATE INDEX IF NOT EXISTS idx_cqm_age_band   ON capadex_question_metadata(age_band);
CREATE INDEX IF NOT EXISTS idx_cqm_dev_stage  ON capadex_question_metadata(dev_stage);
CREATE INDEX IF NOT EXISTS idx_cqm_provenance ON capadex_question_metadata(provenance);
