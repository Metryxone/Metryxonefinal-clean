-- CAPADEX WC-3 L5A — Question Stage Intelligence (Question Intelligence 2.0, Phase 1).
--
-- Additive, reversible. A single sidecar index that stamps each clarity question with a
-- derived canonical developmental STAGE (Primary + Secondary + confidence), computed from
-- existing metadata (question_type, response_type, polarity, narrative_style). No existing
-- table is mutated; no ontology / signal / concern data is touched. Populating this table
-- changes NO runtime behaviour (nothing reads it yet) so the app is byte-identical whether
-- the `wc3QuestionIntel` flag is ON or OFF.
--
-- Keyed by the clarity SERIAL `id` (NOT `question_id`, which is reused across different
-- questions). Forward-compatible: later L5 phases ALTER ADD the remaining intelligence
-- dimensions. Reversible: `DROP TABLE wc3_question_intelligence;`
--
-- This file is the canonical mirror of `ensureWc3QuestionIntelSchema()` in
-- `backend/services/wc3/wc3-schema.ts` (this repo has no migration runner).

CREATE TABLE IF NOT EXISTS wc3_question_intelligence (
  clarity_id         integer PRIMARY KEY,
  question_id        text,
  source             text NOT NULL DEFAULT 'clarity',
  primary_stage      text,
  secondary_stage    text,
  stage_confidence   numeric NOT NULL DEFAULT 0,
  stage_band         text NOT NULL DEFAULT 'UNRESOLVED',
  coverage           numeric NOT NULL DEFAULT 0,
  stage_distribution jsonb NOT NULL DEFAULT '{}',
  signals_used       jsonb NOT NULL DEFAULT '{}',
  computed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc3_qi_primary_stage ON wc3_question_intelligence (primary_stage);
CREATE INDEX IF NOT EXISTS idx_wc3_qi_band ON wc3_question_intelligence (stage_band);
