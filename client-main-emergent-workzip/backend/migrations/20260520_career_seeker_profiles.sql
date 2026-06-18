-- ============================================================
-- Career Seeker — JSONB-backed profile, jobs, goals
-- Migration: 20260520_career_seeker_profiles.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS career_seeker_profiles (
  user_id       VARCHAR     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  completeness  INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_seeker_jobs (
  id          VARCHAR     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT        NOT NULL DEFAULT 'Saved',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_csj_user ON career_seeker_jobs(user_id);

CREATE TABLE IF NOT EXISTS career_seeker_goals (
  id          VARCHAR     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     VARCHAR     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  completed   BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_csg_user ON career_seeker_goals(user_id);
