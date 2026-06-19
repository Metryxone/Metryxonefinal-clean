-- ============================================================================
-- Phase 3 — Competency Employability Intelligence Engine (CEI)
-- Transforms Phase 2 competency-runtime outputs (profile / role-readiness /
-- gap / signals / benchmark) into an employability-intelligence envelope.
--
-- Additive · flag-gated (competencyEi / FF_COMPETENCY_EI, default OFF) ·
-- COMPOSES already-computed competency data (never recomputes scores, never
-- fabricates). Flag OFF => routes 503 BEFORE any DB touch => byte-identical.
--
-- DISTINCT from the legacy profile-based Employability Index (ei_* tables,
-- /api/ei/*) — that engine scores static profile attributes and feeds the
-- Career Builder gauge. This layer is competency-anchored and read-only over
-- the Phase 2 chain. Lazy ensureCeiSchema() in
-- services/competency-employability-engine.ts mirrors this file (no runner).
--
-- Snapshots are APPEND-ONLY (one row per explicit POST capture); GET reads
-- never write.
-- ============================================================================

CREATE TABLE IF NOT EXISTS cei_employability_snapshots (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id         VARCHAR(160) NOT NULL,
  role_id            VARCHAR(160),
  ei_version         VARCHAR(40)  NOT NULL DEFAULT 'phase-3',
  weights_version    VARCHAR(40)  NOT NULL DEFAULT 'cei-w1',
  measurable         BOOLEAN      NOT NULL DEFAULT false,
  index_score        NUMERIC(6,2),                 -- 0..100, NULL when not measurable
  index_band         VARCHAR(40),                  -- developmental band, NULL when not measurable
  index_coverage_pct NUMERIC(6,2),                 -- available component weight / total (separate axis)
  confidence_score   NUMERIC(6,2),                 -- 0..100 (separate axis)
  confidence_band    VARCHAR(40),
  drivers            JSONB        NOT NULL DEFAULT '[]'::jsonb,
  strengths          JSONB        NOT NULL DEFAULT '[]'::jsonb,
  priorities         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  risks              JSONB        NOT NULL DEFAULT '[]'::jsonb,
  coverage           JSONB        NOT NULL DEFAULT '{}'::jsonb,
  confidence         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  composed_from      JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT chk_cei_index CHECK (index_score IS NULL OR (index_score >= 0 AND index_score <= 100))
);

CREATE INDEX IF NOT EXISTS idx_cei_subject ON cei_employability_snapshots (subject_id);
CREATE INDEX IF NOT EXISTS idx_cei_created ON cei_employability_snapshots (created_at);
