-- CAPADEX Phase 3 — Composite Signal Runtime + Pattern Synthesis Runtime.
--
-- Canonical DDL mirroring the lazy bootstrap in
--   backend/services/composite-signal-engine.ts  (ensureCompositeSchema)
--   backend/services/pattern-engine.ts           (ensurePatternSchema)
-- This repo has no migration runner; the engines bootstrap the schema
-- idempotently at runtime. This file is the canonical record of that schema.
--
-- Spine: Answers -> Evidence -> Signals -> Composites -> Patterns.

-- Part A — Composite signals synthesised from active atomic signals.
CREATE TABLE IF NOT EXISTS capadex_session_composites (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL,
  composite_key      VARCHAR(120) NOT NULL,
  label              TEXT,
  strength           NUMERIC(5,4) NOT NULL DEFAULT 0,
  confidence         NUMERIC(5,4) NOT NULL DEFAULT 0,
  required_signals   JSONB NOT NULL DEFAULT '[]',
  signal_refs        JSONB NOT NULL DEFAULT '[]',
  matched_count      INTEGER NOT NULL DEFAULT 0,
  minimum_count      INTEGER NOT NULL DEFAULT 0,
  minimum_strength   NUMERIC(5,4) NOT NULL DEFAULT 0,
  weighting_method   VARCHAR(60),
  confidence_formula VARCHAR(60),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capadex_composites_session ON capadex_session_composites (session_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_capadex_composites_session_key
  ON capadex_session_composites (session_id, composite_key);

-- Part B — Behavioural patterns synthesised from signals + composites +
-- contradictions + telemetry. Explainable via the *_refs columns.
CREATE TABLE IF NOT EXISTS capadex_session_patterns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL,
  pattern_key    VARCHAR(120) NOT NULL,
  label          TEXT,
  confidence     NUMERIC(5,4) NOT NULL DEFAULT 0,
  signal_refs    JSONB NOT NULL DEFAULT '[]',
  composite_refs JSONB NOT NULL DEFAULT '[]',
  evidence_refs  JSONB NOT NULL DEFAULT '[]',
  explanation    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capadex_patterns_session ON capadex_session_patterns (session_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_capadex_patterns_session_key
  ON capadex_session_patterns (session_id, pattern_key);
