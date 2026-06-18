-- Career Operating System — Behavioural Memory (Phase 5 — Part D).
--
-- Longitudinal memory for the Career Brain. Two append-only, per-user tables:
--
--   capadex_behavioural_memory   one row per tracked element (signal / pattern /
--                                intervention / outcome) at a point in time. The
--                                raw time-series the growth deltas are computed from.
--
--   career_memory_snapshots      a point-in-time snapshot of the aggregated Career
--                                Brain state (stage, readiness, top signals/patterns).
--
-- Canonical mirror of the lazy ensureCareerMemorySchema() bootstrap in
-- backend/routes/career-memory.ts (this repo has no migration runner) — kept in
-- lockstep so a fresh database and a running process converge on the same DDL.
--
-- k-anonymity: both tables are strictly per-user (the user's own history). No
-- cohort aggregation happens here, so peer-benchmark k-anonymity is untouched.

CREATE TABLE IF NOT EXISTS capadex_behavioural_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  session_id  UUID,
  entry_type  VARCHAR(20) NOT NULL,          -- signal | pattern | intervention | outcome
  entry_key   VARCHAR(160) NOT NULL,
  label       TEXT,
  strength    NUMERIC(6,4) NOT NULL DEFAULT 0,
  confidence  NUMERIC(6,4) NOT NULL DEFAULT 0,
  status      VARCHAR(40),
  meta        JSONB NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbm_user        ON capadex_behavioural_memory (user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_cbm_user_type   ON capadex_behavioural_memory (user_id, entry_type);

CREATE TABLE IF NOT EXISTS career_memory_snapshots (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                TEXT NOT NULL,
  snapshot_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ei_score               NUMERIC(6,2),
  current_stage          TEXT,
  target_role            TEXT,
  transition_probability NUMERIC(6,4),
  core_bottleneck        TEXT,
  market_readiness       NUMERIC(6,2),
  interview_readiness    NUMERIC(6,2),
  signals                JSONB NOT NULL DEFAULT '[]',
  patterns               JSONB NOT NULL DEFAULT '[]',
  interventions          JSONB NOT NULL DEFAULT '[]',
  outcomes               JSONB NOT NULL DEFAULT '[]',
  brain                  JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_cms_user ON career_memory_snapshots (user_id, snapshot_at DESC);
