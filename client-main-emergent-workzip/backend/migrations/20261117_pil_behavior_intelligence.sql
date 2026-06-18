-- CAPADEX PIL — Phase 1.6: Behavioral Intelligence Layer (ADDITIVE ONLY).
-- Canonical DDL; mirrors the lazy ensureSchema() bootstrap in
-- backend/scripts/pil/run-behavior-intelligence.ts (no migration runner).
-- Reads only Phase-1.5 extension tables; never modifies existing CAPADEX data.

-- 1.6B — the eight behavior categories.
CREATE TABLE IF NOT EXISTS behavior_categories (
  category_id    SERIAL PRIMARY KEY,
  category_name  TEXT NOT NULL UNIQUE
                   CHECK (category_name IN ('Academic','Career','Social','Emotional',
                                            'Cognitive','Leadership','Self-Management','Learning')),
  description    TEXT NOT NULL DEFAULT '',
  behavior_count INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.6A — base observable behaviors (one row per concern × behavior).
CREATE TABLE IF NOT EXISTS behavior_library (
  behavior_id        SERIAL PRIMARY KEY,
  concern_id         TEXT NOT NULL,
  concern_name       TEXT NOT NULL DEFAULT '',
  canonical_type     TEXT NOT NULL DEFAULT '',
  behavior_statement TEXT NOT NULL,
  behavior_category  TEXT NOT NULL
                       CHECK (behavior_category IN ('Academic','Career','Social','Emotional',
                                                    'Cognitive','Leadership','Self-Management','Learning')),
  frame_id           TEXT NOT NULL DEFAULT '',
  source             TEXT NOT NULL DEFAULT 'curated'
                       CHECK (source IN ('curated','generic_fallback')),
  quality_total      INTEGER NOT NULL DEFAULT 0,
  accepted           BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (concern_id, behavior_statement)
);

-- 1.6F — per-behavior quality scores (each sub-score 1..5; reject total < 15).
CREATE TABLE IF NOT EXISTS behavior_quality_scores (
  score_id        SERIAL PRIMARY KEY,
  behavior_id     INTEGER NOT NULL REFERENCES behavior_library(behavior_id) ON DELETE CASCADE,
  observability   INTEGER NOT NULL CHECK (observability   BETWEEN 1 AND 5),
  human_realism   INTEGER NOT NULL CHECK (human_realism   BETWEEN 1 AND 5),
  distinctiveness INTEGER NOT NULL CHECK (distinctiveness BETWEEN 1 AND 5),
  actionability   INTEGER NOT NULL CHECK (actionability   BETWEEN 1 AND 5),
  total_score     INTEGER NOT NULL CHECK (total_score BETWEEN 4 AND 20),
  accepted        BOOLEAN NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (behavior_id)
);

-- 1.6E — the foundational explainability table (capability ↔ problem ↔ behavior),
-- expanded across severity × age band.
CREATE TABLE IF NOT EXISTS capability_problem_behavior_map (
  mapping_id         SERIAL PRIMARY KEY,
  capability_id      TEXT NOT NULL,
  capability_name    TEXT NOT NULL DEFAULT '',
  problem_id         TEXT NOT NULL,
  problem_name       TEXT NOT NULL DEFAULT '',
  behavior_id        INTEGER NOT NULL REFERENCES behavior_library(behavior_id) ON DELETE CASCADE,
  behavior_statement TEXT NOT NULL,
  behavior_category  TEXT NOT NULL,
  severity           TEXT NOT NULL CHECK (severity IN ('Mild','Moderate','Significant')),
  age_band           TEXT NOT NULL CHECK (age_band IN ('10-13','14-18','19-25','26-40','40+')),
  confidence_score   NUMERIC(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (behavior_id, severity, age_band)
);
CREATE INDEX IF NOT EXISTS idx_cpb_map_capability ON capability_problem_behavior_map(capability_id);
CREATE INDEX IF NOT EXISTS idx_cpb_map_problem    ON capability_problem_behavior_map(problem_id);

-- 1.6G — flagged near-duplicate behaviors for human review.
CREATE TABLE IF NOT EXISTS behavior_duplicate_review (
  review_id   SERIAL PRIMARY KEY,
  concern_id  TEXT NOT NULL,
  behavior_a  TEXT NOT NULL,
  behavior_b  TEXT NOT NULL,
  reason      TEXT NOT NULL CHECK (reason IN ('identical','semantic')),
  overlap     NUMERIC(5,3) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1.6H — behavior coverage per concern family.
CREATE TABLE IF NOT EXISTS family_behavior_coverage (
  coverage_id        SERIAL PRIMARY KEY,
  family_name        TEXT NOT NULL UNIQUE,
  concern_count      INTEGER NOT NULL,
  concerns_covered   INTEGER NOT NULL,
  coverage_pct       NUMERIC(5,2) NOT NULL,
  avg_behaviors      NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
