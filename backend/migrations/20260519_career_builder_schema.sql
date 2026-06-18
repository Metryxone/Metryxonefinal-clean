-- ============================================================
-- MetryxOne — Career Builder Normalised Schema
-- Migration: 20260519_career_builder_schema.sql
-- ============================================================

-- ── User Profiles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id                 SERIAL        PRIMARY KEY,
  user_id            INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               TEXT,
  location           TEXT,
  phone              TEXT,
  linkedin_url       TEXT,
  github_url         TEXT,
  website_url        TEXT,
  summary            TEXT,
  completeness       NUMERIC(5,2)  DEFAULT 0,
  ei_score           INTEGER       DEFAULT 0,
  visibility_score   INTEGER       DEFAULT 0,
  is_open_to_work    BOOLEAN       DEFAULT FALSE,
  target_role_id     TEXT,
  created_at         TIMESTAMPTZ   DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── User Skills ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_skills (
  id         SERIAL      PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill      TEXT        NOT NULL,
  category   TEXT        NOT NULL CHECK (category IN ('technical','soft','tool','language')),
  proficiency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);

-- ── Competency Scores ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competency_scores (
  id               SERIAL      PRIMARY KEY,
  user_id          INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  competency_code  TEXT        NOT NULL,
  competency_label TEXT        NOT NULL,
  domain           TEXT        NOT NULL,
  raw_score        NUMERIC(5,2) DEFAULT 0,
  normalised_score NUMERIC(5,2) DEFAULT 0,
  confidence       NUMERIC(4,3) DEFAULT 0,
  source           TEXT        NOT NULL CHECK (source IN ('self_assessment','inferred','external')),
  assessed_at      TIMESTAMPTZ DEFAULT NOW(),
  session_id       UUID
);
CREATE INDEX IF NOT EXISTS idx_competency_user ON competency_scores(user_id);

-- ── Benchmark Profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS benchmark_profiles (
  id            SERIAL      PRIMARY KEY,
  role_id       TEXT        NOT NULL,
  role_title    TEXT        NOT NULL,
  skill         TEXT        NOT NULL,
  benchmark_pct INTEGER     NOT NULL,
  region        TEXT        DEFAULT 'IN',
  source        TEXT        DEFAULT 'metryx',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_benchmark_role ON benchmark_profiles(role_id);

-- ── Intervention Plans (IDP) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS intervention_plans (
  id                 SERIAL      PRIMARY KEY,
  user_id            INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role_id     TEXT        NOT NULL,
  intervention_id    TEXT        NOT NULL,
  intervention_title TEXT        NOT NULL,
  type               TEXT,
  hours              INTEGER,
  ei_lift            INTEGER,
  gap_competency_id  TEXT,
  rank               INTEGER,
  status             TEXT        DEFAULT 'pending' CHECK (status IN ('pending','in-progress','done')),
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_idp_user ON intervention_plans(user_id);

-- ── Workforce Signals ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workforce_signals (
  id               SERIAL      PRIMARY KEY,
  role_id          TEXT        NOT NULL,
  role_title       TEXT        NOT NULL,
  demand_score     INTEGER     DEFAULT 50,
  automation_risk  INTEGER     DEFAULT 30,
  growth_36mo      INTEGER     DEFAULT 10,
  openings_index   INTEGER     DEFAULT 50,
  region           TEXT        DEFAULT 'IN',
  recorded_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Simulation Sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS simulation_sessions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario_id     TEXT        NOT NULL,
  base_ei_score   INTEGER,
  projected_score INTEGER,
  score_delta     INTEGER,
  profile_snapshot JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_simulation_user ON simulation_sessions(user_id);

-- ── Behavioural Signals (career context) ─────────────────────
CREATE TABLE IF NOT EXISTS career_behavioural_signals (
  id         SERIAL      PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_key TEXT        NOT NULL,
  value      JSONB,
  source     TEXT,
  captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Recruiter Visibility ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS recruiter_visibility (
  id                  SERIAL      PRIMARY KEY,
  user_id             INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility_score    INTEGER     DEFAULT 0,
  band                TEXT        DEFAULT 'hidden',
  driver_breakdown    JSONB,
  estimated_views_wk  INTEGER     DEFAULT 0,
  view_trend          TEXT        DEFAULT 'flat',
  is_open_to_work     BOOLEAN     DEFAULT FALSE,
  computed_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── Transformation History ────────────────────────────────────
CREATE TABLE IF NOT EXISTS transformation_history (
  id          SERIAL      PRIMARY KEY,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL,
  payload     JSONB,
  ei_before   INTEGER,
  ei_after    INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transform_user ON transformation_history(user_id);

-- ── Career Trajectory ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_trajectory (
  id             SERIAL      PRIMARY KEY,
  user_id        INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_role_id TEXT,
  target_role_id  TEXT,
  switchability   INTEGER,
  fit_score       INTEGER,
  eta_months      INTEGER,
  idp_item_count  INTEGER,
  snapshot_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trajectory_user ON career_trajectory(user_id);

-- ── Role Catalog ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_catalog (
  id              TEXT        PRIMARY KEY,
  title           TEXT        NOT NULL,
  family          TEXT,
  demand_score    INTEGER     DEFAULT 50,
  automation_risk INTEGER     DEFAULT 30,
  growth_36mo     INTEGER     DEFAULT 10,
  skills          JSONB,
  competencies    JSONB,
  adjacent_roles  JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Competency Catalog ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competency_catalog (
  id          TEXT        PRIMARY KEY,
  label       TEXT        NOT NULL,
  category    TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_competency_catalog_category ON competency_catalog(category);
CREATE INDEX IF NOT EXISTS idx_role_catalog_family         ON role_catalog(family);
CREATE INDEX IF NOT EXISTS idx_role_catalog_demand         ON role_catalog(demand_score DESC);
