-- Behavioral Signal Ingestion Buffer (Advanced Enhancement #1)
-- Per-question interaction telemetry: hesitation, backtracks, text edits.
-- Distinct from `capadex_session_signals` (content/linguistic signals) — this
-- table captures implicit *interaction* metrics from the assessment UI.
--
-- Ownership: session_id is the canonical anonymous identifier for the free
-- CAPADEX funnel; question_id is the item identifier (string to accommodate
-- both numeric sdi_items.id and SAQ short-assessment item ids).

CREATE TABLE IF NOT EXISTS capadex_session_telemetry (
  id              SERIAL       PRIMARY KEY,
  session_id      VARCHAR(100) NOT NULL,
  question_id     VARCHAR(50)  NOT NULL,
  hesitation_ms   INTEGER      NOT NULL DEFAULT 0,
  backtrack_count INTEGER      NOT NULL DEFAULT 0,
  text_edit_count INTEGER      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint required for ON CONFLICT upsert (one row per question per session)
ALTER TABLE capadex_session_telemetry
  DROP CONSTRAINT IF EXISTS capadex_session_telemetry_session_question_uniq;
ALTER TABLE capadex_session_telemetry
  ADD  CONSTRAINT capadex_session_telemetry_session_question_uniq
       UNIQUE (session_id, question_id);

-- Composite index for high-perf report-time lookups by session
-- (the UNIQUE constraint already creates an index on the same columns, so this
-- is redundant on most postgres versions — included per spec for clarity)
CREATE INDEX IF NOT EXISTS idx_capadex_session_telemetry_session_question
  ON capadex_session_telemetry (session_id, question_id);

-- Sanity sentinel for sanity_check_after_apply scripts
COMMENT ON TABLE capadex_session_telemetry IS
  'Implicit interaction telemetry per assessment question. Upserted by POST /api/signals/telemetry; consumed by completion-time signal aggregation.';
