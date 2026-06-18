-- ============================================================================
-- Phase 2 — Adaptive Benchmarking, Empirical Percentile, Reliability,
-- Confidence Tiers, Audit. Namespaced `bench_*`. Existing peer_benchmark_*
-- tables and code are UNTOUCHED.
-- ============================================================================

-- 1. bench_cohorts -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS bench_cohorts (
  id              TEXT PRIMARY KEY,
  cohort_type     TEXT NOT NULL CHECK (cohort_type IN
                    ('global','industry','function','role','layer','aspirational')),
  name            TEXT NOT NULL,
  description     TEXT,
  industry_id     TEXT REFERENCES onto_industries(id)             ON DELETE SET NULL,
  function_id     TEXT REFERENCES onto_functions(id)              ON DELETE SET NULL,
  role_id         TEXT REFERENCES onto_roles(id)                  ON DELETE SET NULL,
  layer_id        TEXT REFERENCES onto_layers(id)                 ON DELETE SET NULL,
  filters         JSONB NOT NULL DEFAULT '{}'::jsonb,
  k_min           INT  NOT NULL DEFAULT 30,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bench_cohorts_type     ON bench_cohorts(cohort_type) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_bench_cohorts_industry ON bench_cohorts(industry_id);
CREATE INDEX IF NOT EXISTS idx_bench_cohorts_role     ON bench_cohorts(role_id);

-- 2. bench_competency_benchmarks --------------------------------------------
-- One row per (cohort, competency, version): empirical aggregates + sorted
-- sample array for empirical percentile lookup. NEVER stores raw user IDs.
CREATE TABLE IF NOT EXISTS bench_competency_benchmarks (
  id              BIGSERIAL PRIMARY KEY,
  cohort_id       TEXT NOT NULL REFERENCES bench_cohorts(id)   ON DELETE CASCADE,
  competency_id   TEXT NOT NULL REFERENCES onto_competencies(id),
  n_samples       INT  NOT NULL CHECK (n_samples >= 0),
  mean            NUMERIC(7,4) NOT NULL,
  stddev          NUMERIC(7,4) NOT NULL,
  median          NUMERIC(7,4) NOT NULL,
  p10  NUMERIC(7,4), p25 NUMERIC(7,4), p50 NUMERIC(7,4),
  p75  NUMERIC(7,4), p90 NUMERIC(7,4), p95 NUMERIC(7,4), p99 NUMERIC(7,4),
  min_score NUMERIC(7,4), max_score NUMERIC(7,4),
  sorted_samples  JSONB NOT NULL, -- ascending numeric array
  version         TEXT NOT NULL DEFAULT '2.0.0',
  refreshed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, competency_id, version)
);
CREATE INDEX IF NOT EXISTS idx_bench_comp_cohort ON bench_competency_benchmarks(cohort_id);
CREATE INDEX IF NOT EXISTS idx_bench_comp_comp   ON bench_competency_benchmarks(competency_id);

-- 3. bench_cohort_statistics -------------------------------------------------
CREATE TABLE IF NOT EXISTS bench_cohort_statistics (
  cohort_id        TEXT PRIMARY KEY REFERENCES bench_cohorts(id) ON DELETE CASCADE,
  n_total          INT  NOT NULL,
  k_anonymous      BOOLEAN NOT NULL,
  confidence_tier  TEXT NOT NULL CHECK (confidence_tier IN ('A','B','C','D','provisional')),
  competency_count INT  NOT NULL,
  last_refreshed   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. bench_role_alignment_scores --------------------------------------------
CREATE TABLE IF NOT EXISTS bench_role_alignment_scores (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               TEXT,
  session_id            TEXT,
  role_id               TEXT NOT NULL REFERENCES onto_roles(id),
  alignment_score       NUMERIC(6,3) NOT NULL CHECK (alignment_score BETWEEN 0 AND 100),
  fit_band              TEXT NOT NULL CHECK (fit_band IN ('high','moderate','developing','low')),
  competency_breakdown  JSONB NOT NULL,
  cohort_id             TEXT REFERENCES bench_cohorts(id) ON DELETE SET NULL,
  weighting_version     TEXT NOT NULL,
  methodology_version   TEXT NOT NULL,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bench_role_align_session ON bench_role_alignment_scores(session_id);
CREATE INDEX IF NOT EXISTS idx_bench_role_align_role    ON bench_role_alignment_scores(role_id);

-- 5. bench_confidence --------------------------------------------------------
CREATE TABLE IF NOT EXISTS bench_confidence (
  id              BIGSERIAL PRIMARY KEY,
  cohort_id       TEXT NOT NULL REFERENCES bench_cohorts(id) ON DELETE CASCADE,
  competency_id   TEXT REFERENCES onto_competencies(id),
  n               INT  NOT NULL,
  tier            TEXT NOT NULL CHECK (tier IN ('A','B','C','D','provisional')),
  ci_low          NUMERIC(7,4),
  ci_high         NUMERIC(7,4),
  freshness_days  INT,
  reasoning       TEXT,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, competency_id)
);

-- 6. bench_psychometric_reliability -----------------------------------------
CREATE TABLE IF NOT EXISTS bench_psychometric_reliability (
  id                     BIGSERIAL PRIMARY KEY,
  session_id             TEXT NOT NULL,
  user_id                TEXT,
  response_consistency   NUMERIC(5,4),
  reverse_item_validity  NUMERIC(5,4),
  contradiction_count    INT NOT NULL DEFAULT 0,
  confidence_score       NUMERIC(5,4),
  reliability_index      NUMERIC(5,4),
  completion_quality     NUMERIC(5,4),
  anomaly_flags          JSONB NOT NULL DEFAULT '[]'::jsonb,
  stability_score        NUMERIC(5,4),
  computed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bench_rel_session ON bench_psychometric_reliability(session_id);

-- 7. bench_assessment_quality_metrics ---------------------------------------
CREATE TABLE IF NOT EXISTS bench_assessment_quality_metrics (
  id                  BIGSERIAL PRIMARY KEY,
  session_id          TEXT NOT NULL,
  total_items         INT NOT NULL,
  answered_items      INT NOT NULL,
  completion_rate     NUMERIC(5,4),
  avg_response_ms     INT,
  median_response_ms  INT,
  fast_response_pct   NUMERIC(5,4),
  straightline_pct    NUMERIC(5,4),
  quality_tier        TEXT,
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bench_quality_session ON bench_assessment_quality_metrics(session_id);

-- 8. bench_percentile_distributions -----------------------------------------
CREATE TABLE IF NOT EXISTS bench_percentile_distributions (
  id              BIGSERIAL PRIMARY KEY,
  cohort_id       TEXT NOT NULL REFERENCES bench_cohorts(id) ON DELETE CASCADE,
  competency_id   TEXT NOT NULL REFERENCES onto_competencies(id),
  bucket_size     NUMERIC(4,2) NOT NULL DEFAULT 5,
  histogram       JSONB NOT NULL,
  n               INT  NOT NULL,
  version         TEXT NOT NULL DEFAULT '2.0.0',
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, competency_id, version)
);
CREATE INDEX IF NOT EXISTS idx_bench_dist_cohort ON bench_percentile_distributions(cohort_id);

-- 9. bench_versions ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS bench_versions (
  id                       TEXT PRIMARY KEY,
  version                  TEXT NOT NULL UNIQUE,
  methodology              TEXT NOT NULL,
  pinned_ontology_version  TEXT NOT NULL,
  snapshot                 JSONB NOT NULL,
  notes                    TEXT,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. bench_audit_logs ------------------------------------------------------
CREATE TABLE IF NOT EXISTS bench_audit_logs (
  id                BIGSERIAL PRIMARY KEY,
  event_type        TEXT NOT NULL,
  user_id           TEXT,
  session_id        TEXT,
  cohort_id         TEXT,
  endpoint          TEXT,
  request_summary   JSONB,
  response_summary  JSONB,
  k_check_passed    BOOLEAN,
  version           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bench_audit_event   ON bench_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_bench_audit_session ON bench_audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_bench_audit_time    ON bench_audit_logs(created_at DESC);
