-- Cognitive Load Engine — Phase 1 S6
-- Stores per-question-boundary load snapshots for every CAPADEX session.

CREATE TABLE IF NOT EXISTS cognitive_load_snapshots (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          TEXT         NOT NULL,
  question_index      INT          NOT NULL,
  fatigue_score       NUMERIC(6,4) NOT NULL DEFAULT 0,
  overload_score      NUMERIC(6,4) NOT NULL DEFAULT 0,
  hesitation_score    NUMERIC(6,4) NOT NULL DEFAULT 0,
  disengagement_score NUMERIC(6,4) NOT NULL DEFAULT 0,
  composite_load      NUMERIC(6,4) NOT NULL DEFAULT 0,
  recommended_action  TEXT         NOT NULL
    CHECK (recommended_action IN (
      'continue_normal',
      'reduce_pacing',
      'simplify_language',
      'offer_break',
      'shorten_flow',
      'end_gracefully'
    )),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, question_index)
);

CREATE INDEX IF NOT EXISTS idx_cls_session    ON cognitive_load_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_cls_action     ON cognitive_load_snapshots(recommended_action);
CREATE INDEX IF NOT EXISTS idx_cls_composite  ON cognitive_load_snapshots(composite_load);
