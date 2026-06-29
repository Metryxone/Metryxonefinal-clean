-- MX-700 Phase 1.39 — Platform Lifecycle Intelligence Engine
-- ADDITIVE, flag-gated (platformLifecycleIntelligence / FF_PLATFORM_LIFECYCLE_INTELLIGENCE).
--
-- The Intelligence Engine is a READ-ONLY measurement/validation/explainability layer that
-- COMPOSES the Phase 1.37 Foundation + Phase 1.38 Management tables (registry / catalog /
-- relationships / version-ledger / evolution). It introduces NO parallel registry and changes
-- NO business logic. The ONLY write path is the Lifecycle Audit Engine, which appends an
-- immutable point-in-time intelligence snapshot used for drift detection (Part 8).
--
-- This migration is mirrored by a lazy ensure-schema in
-- backend/services/platform-lifecycle-intelligence.ts that runs ONLY on the flag-ON audit
-- capture path, so with the flag OFF this table is never created -> byte-identical incl. schema.

CREATE TABLE IF NOT EXISTS platform_lifecycle_intelligence_snapshots (
  id                       BIGSERIAL PRIMARY KEY,
  snapshot_uid             TEXT UNIQUE NOT NULL,
  -- Measured scores (each independent; never composited into one verdict). NULL when not measurable.
  lifecycle_health_score   NUMERIC,
  repository_health_score  NUMERIC,
  compatibility_score      NUMERIC,
  evidence_score           NUMERIC,
  confidence_score         NUMERIC,
  architecture_stability   NUMERIC,
  -- Full measured payloads (evidence/confidence/health/repository-health/compatibility/
  -- validation/metrics/tech-debt indicators) captured verbatim for drift comparison.
  metrics                  JSONB NOT NULL DEFAULT '{}',
  tech_debt_indicators     JSONB NOT NULL DEFAULT '{}',
  registry_total           INTEGER,
  captured_by              TEXT,
  captured_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pli_snapshots_captured_at
  ON platform_lifecycle_intelligence_snapshots (captured_at DESC);
