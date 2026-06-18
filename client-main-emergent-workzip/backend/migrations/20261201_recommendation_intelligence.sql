-- CAPADEX Phase 7 — Recommendation Intelligence Layer.
--
-- COMPOSES existing intelligence (archetypes · interventions · 6C reports · runtime
-- pipeline · capabilities · behaviors) into personalized, fully-explainable
-- recommendations across four categories — Career / Learning / Project / Development.
-- NO new scoring, NO new archetypes. Every recommendation traces the full chain:
--   Concern → Capability → Problem → Behavior → Archetype → Intervention → Recommendation
--
-- Canonical mirror of the lazy ensureRecommendationSchema() bootstrap (this repo has
-- no migration runner) — kept in lockstep so a fresh DB and a running process converge
-- on the same DDL. Read-only of intelligence; the per-category tables persist the
-- composed output idempotently (delete-by-(session,stakeholder) + insert).

-- ── Catalog (authored reference data; the only table we seed) ────────────────────
CREATE TABLE IF NOT EXISTS recommendation_library (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_key VARCHAR(160) NOT NULL,
  category           VARCHAR(20)  NOT NULL,   -- career | learning | project | development
  sub_type           VARCHAR(40)  NOT NULL,   -- e.g. cluster | pathway | exploration | course ...
  anchor_construct   VARCHAR(120) NOT NULL,   -- behavioural-construct key the rec derives from
  stakeholder        VARCHAR(20)  NOT NULL,   -- student | parent | counselor | institution
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  rationale          TEXT NOT NULL,
  effort             VARCHAR(20),
  duration           VARCHAR(40),
  horizon            VARCHAR(40),
  priority           INTEGER NOT NULL DEFAULT 2,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_recommendation_library_key
  ON recommendation_library (recommendation_key, stakeholder);
CREATE INDEX IF NOT EXISTS idx_recommendation_library_lookup
  ON recommendation_library (anchor_construct, category, stakeholder) WHERE is_active;

-- ── Session-scoped generated recommendations (one table per category) ────────────
-- Shared shape. recommendation_key is the catalog key; (session_id, stakeholder,
-- recommendation_key) is the idempotent upsert target.
CREATE TABLE IF NOT EXISTS career_recommendations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL,
  stakeholder        VARCHAR(20)  NOT NULL,
  recommendation_key VARCHAR(160) NOT NULL,
  sub_type           VARCHAR(40)  NOT NULL,
  anchor_construct   VARCHAR(120) NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  rationale          TEXT NOT NULL,
  rank               INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_career_recs_session ON career_recommendations (session_id, stakeholder);
CREATE UNIQUE INDEX IF NOT EXISTS uq_career_recs_key ON career_recommendations (session_id, stakeholder, recommendation_key);

CREATE TABLE IF NOT EXISTS learning_recommendations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL,
  stakeholder        VARCHAR(20)  NOT NULL,
  recommendation_key VARCHAR(160) NOT NULL,
  sub_type           VARCHAR(40)  NOT NULL,
  anchor_construct   VARCHAR(120) NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  rationale          TEXT NOT NULL,
  rank               INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_learning_recs_session ON learning_recommendations (session_id, stakeholder);
CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_recs_key ON learning_recommendations (session_id, stakeholder, recommendation_key);

CREATE TABLE IF NOT EXISTS project_recommendations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL,
  stakeholder        VARCHAR(20)  NOT NULL,
  recommendation_key VARCHAR(160) NOT NULL,
  sub_type           VARCHAR(40)  NOT NULL,
  anchor_construct   VARCHAR(120) NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  rationale          TEXT NOT NULL,
  rank               INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_recs_session ON project_recommendations (session_id, stakeholder);
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_recs_key ON project_recommendations (session_id, stakeholder, recommendation_key);

CREATE TABLE IF NOT EXISTS development_recommendations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL,
  stakeholder        VARCHAR(20)  NOT NULL,
  recommendation_key VARCHAR(160) NOT NULL,
  sub_type           VARCHAR(40)  NOT NULL,
  anchor_construct   VARCHAR(120) NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL,
  rationale          TEXT NOT NULL,
  rank               INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_development_recs_session ON development_recommendations (session_id, stakeholder);
CREATE UNIQUE INDEX IF NOT EXISTS uq_development_recs_key ON development_recommendations (session_id, stakeholder, recommendation_key);

-- ── Per-recommendation explainability (the full traced lineage) ──────────────────
CREATE TABLE IF NOT EXISTS recommendation_explainability (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL,
  stakeholder        VARCHAR(20)  NOT NULL,
  category           VARCHAR(20)  NOT NULL,
  recommendation_key VARCHAR(160) NOT NULL,
  anchor_construct   VARCHAR(120) NOT NULL,
  trace              JSONB NOT NULL DEFAULT '[]',  -- ordered Concern→…→Recommendation nodes
  traced             BOOLEAN NOT NULL DEFAULT FALSE,
  chain_complete     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rec_explain_session ON recommendation_explainability (session_id, stakeholder);
CREATE UNIQUE INDEX IF NOT EXISTS uq_rec_explain_key
  ON recommendation_explainability (session_id, stakeholder, category, recommendation_key);
