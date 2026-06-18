-- Phase 1 S1: Cognitive Runtime State Engine
-- Creates the centralised behavioural runtime state tables

CREATE TABLE IF NOT EXISTS cognitive_runtime_state (
  session_id        UUID PRIMARY KEY REFERENCES capadex_sessions(id) ON DELETE CASCADE,
  state             JSONB NOT NULL DEFAULT '{}',
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cognitive_state_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES capadex_sessions(id) ON DELETE CASCADE,
  state             JSONB NOT NULL DEFAULT '{}',
  snapshot_reason   TEXT,
  version           INTEGER NOT NULL DEFAULT 1,
  actor             TEXT NOT NULL DEFAULT 'system',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_csh_session_id     ON cognitive_state_history(session_id);
CREATE INDEX IF NOT EXISTS idx_csh_created_at     ON cognitive_state_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crs_updated_at     ON cognitive_runtime_state(updated_at DESC);
