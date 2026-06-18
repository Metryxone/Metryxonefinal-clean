-- ============================================================================
-- capadex_clarity_questions
-- ----------------------------------------------------------------------------
-- Clarity question pool sourced from attached_assets/Clarity_Questions_*.csv
-- and laundered through `scripts/audit_clarity_questions.py`. Each row is
-- one assessment item; rows join into `capadex_concerns_master` via
-- `master_bridge_tag` → `capadex_concerns_master.relational_bridge_tag`
-- (logical join — many master concerns share a bucket). The original
-- `concern_id` (CAREER_001, COMP_001…) is preserved as a legacy lookup key.
-- ============================================================================

CREATE TABLE IF NOT EXISTS capadex_clarity_questions (
  id                  SERIAL PRIMARY KEY,
  question_id         TEXT NOT NULL UNIQUE,
  concern_id          TEXT NOT NULL,
  concern_id_prefix   TEXT NOT NULL,
  master_bridge_tag   TEXT NOT NULL DEFAULT 'UNMAPPED',
  text_bridge_tag     TEXT,                -- diagnostic: first-2-tokens of `concern`
  concern             TEXT NOT NULL,
  stage               TEXT,
  question_type       TEXT,
  narrative_style     TEXT,
  question            TEXT NOT NULL,
  response_type       TEXT NOT NULL DEFAULT 'frequency',
  option_a            TEXT, option_b TEXT, option_c TEXT, option_d TEXT, option_e TEXT,
  option_a_score      INT  NOT NULL DEFAULT 0,
  option_b_score      INT  NOT NULL DEFAULT 0,
  option_c_score      INT  NOT NULL DEFAULT 0,
  option_d_score      INT  NOT NULL DEFAULT 0,
  option_e_score      INT  NOT NULL DEFAULT 0,
  polarity            TEXT NOT NULL DEFAULT 'negative',
  reverse_score       TEXT NOT NULL DEFAULT 'no',
  question_weight     NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  low_score_anchor    TEXT,
  high_score_anchor   TEXT,
  source_row_index    INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clarity_q_concern_id        ON capadex_clarity_questions(concern_id);
CREATE INDEX IF NOT EXISTS idx_clarity_q_prefix            ON capadex_clarity_questions(concern_id_prefix);
CREATE INDEX IF NOT EXISTS idx_clarity_q_master_bridge     ON capadex_clarity_questions(master_bridge_tag);
CREATE INDEX IF NOT EXISTS idx_clarity_q_polarity          ON capadex_clarity_questions(polarity);
CREATE INDEX IF NOT EXISTS idx_clarity_q_response_type     ON capadex_clarity_questions(response_type);
CREATE INDEX IF NOT EXISTS idx_clarity_q_question_type     ON capadex_clarity_questions(question_type);
