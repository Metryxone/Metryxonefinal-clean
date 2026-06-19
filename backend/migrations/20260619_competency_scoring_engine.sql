-- ============================================================================
-- Phase 2.4 — Competency Scoring Engine
-- Chain: Question -> Raw Score -> Competency Score -> Normalized Score -> Level
-- Additive · flag-gated (competencyRuntime) · never fabricate.
-- Distinct from Phase 2 domain-proxy scoring (onto_competency_scores /
-- onto_competency_profiles) — this layer is competency-centric and
-- difficulty-weighted. Lazy ensureScoringSchema() in services/competency-scoring.ts
-- mirrors this file (no migration runner).
-- ============================================================================

CREATE TABLE IF NOT EXISTS onto_competency_score_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id     UUID         REFERENCES onto_assembled_assessments(id) ON DELETE SET NULL,
  blueprint_id      VARCHAR(120),
  subject_id        VARCHAR(160),
  total_questions   INTEGER      NOT NULL DEFAULT 0,
  scored_questions  INTEGER      NOT NULL DEFAULT 0,
  competency_scores JSONB        NOT NULL DEFAULT '[]'::jsonb,
  overall           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  normalization     JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status            VARCHAR(40)  NOT NULL DEFAULT 'scored',
  source            VARCHAR(30)  NOT NULL DEFAULT 'runtime',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_csr_total  CHECK (total_questions  >= 0),
  CONSTRAINT chk_csr_scored CHECK (scored_questions >= 0)
);

CREATE INDEX IF NOT EXISTS idx_csr_assessment ON onto_competency_score_runs (assessment_id);
CREATE INDEX IF NOT EXISTS idx_csr_blueprint  ON onto_competency_score_runs (blueprint_id);
CREATE INDEX IF NOT EXISTS idx_csr_subject    ON onto_competency_score_runs (subject_id);
