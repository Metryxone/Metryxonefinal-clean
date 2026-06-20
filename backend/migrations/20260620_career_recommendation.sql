-- PHASE 4.7 — Career Recommendation engine schema (additive, flag-gated).
--
-- Mirrors the lazy ensureCareerRecommendationSchema() in
-- services/career-recommendation-aggregator.ts (no migration runner — the lazy
-- ensure is the live path; this file is the canonical record). All DDL is reached
-- ONLY behind the `careerRecommendation` flag (admin seed / CRUD / snapshot POST);
-- with the flag OFF none of these tables are created (byte-identical legacy).
--
-- · career_recommendation_library — config-as-data copy templates per rec_type.
-- · career_recommendation_rules   — config-as-data firing + ranking weights.
-- · career_recommendation_history — append-only snapshot of composed envelopes.
--
-- Names are namespaced into the career-* 4.x chain to avoid colliding with the
-- pre-existing CGI engine (services/career-recommendation-engine.ts → cg_user_
-- recommendations) and the Phase-3.9 code-defined recommendation-library/rules.

CREATE TABLE IF NOT EXISTS career_recommendation_library (
  id          BIGSERIAL PRIMARY KEY,
  rec_key     TEXT NOT NULL UNIQUE,
  rec_type    TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  action      TEXT NOT NULL DEFAULT '',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_recommendation_rules (
  id            BIGSERIAL PRIMARY KEY,
  rule_key      TEXT NOT NULL UNIQUE,
  rec_type      TEXT NOT NULL,
  signal        TEXT NOT NULL,
  params        JSONB NOT NULL DEFAULT '{}'::jsonb,
  base_priority TEXT NOT NULL DEFAULT 'medium',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_recommendation_history (
  id                    BIGSERIAL PRIMARY KEY,
  subject_id            TEXT NOT NULL,
  role_id               TEXT,
  role_title            TEXT,
  measurable            BOOLEAN NOT NULL DEFAULT FALSE,
  total_recommendations INTEGER NOT NULL DEFAULT 0,
  by_type               JSONB NOT NULL DEFAULT '{}'::jsonb,
  snapshot              JSONB NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_recommendation_history_subject
  ON career_recommendation_history (subject_id, created_at DESC);
