-- CAPADEX Intervention Intelligence — Best Next Actions (canonical migration).
-- Phase 2: re-ranks the library-backed (NEVER generic) interventions produced by
-- capadex-intervention-engine.ts using the Unified Behavior Graph signals/patterns/
-- risk flags + CSI + Pragati outcomes, and persists the TOP 5 per session.
-- Mirrored by the lazy ensureInterventionRecommendationsSchema() bootstrap in
-- backend/services/intervention-intelligence.ts (no migration runner in this project).

CREATE TABLE IF NOT EXISTS capadex_intervention_recommendations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id                UUID NOT NULL,
  intervention_key          TEXT NOT NULL,
  construct_key             TEXT,
  intervention              TEXT NOT NULL,
  description               TEXT,
  reason                    TEXT NOT NULL,
  expected_impact           NUMERIC(6,4) NOT NULL DEFAULT 0,
  confidence                NUMERIC(6,4) NOT NULL DEFAULT 0,
  review_window             TEXT,
  severity                  NUMERIC(6,4) NOT NULL DEFAULT 0,
  signal_frequency          NUMERIC(6,4) NOT NULL DEFAULT 0,
  pattern_strength          NUMERIC(6,4) NOT NULL DEFAULT 0,
  historical_effectiveness  NUMERIC(6,4) NOT NULL DEFAULT 0,
  score                     NUMERIC(7,4) NOT NULL DEFAULT 0,
  rank                      INTEGER NOT NULL DEFAULT 0,
  signal_refs               JSONB NOT NULL DEFAULT '[]',
  pattern_refs              JSONB NOT NULL DEFAULT '[]',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, intervention_key)
);

CREATE INDEX IF NOT EXISTS idx_cir_session ON capadex_intervention_recommendations (session_id, rank);
