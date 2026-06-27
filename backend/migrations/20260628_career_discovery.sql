-- ============================================================
-- MX-302B — Career Discovery & AI Guidance
-- Migration: 20260628_career_discovery.sql
-- ============================================================
-- Adds a single results table for the Career Discovery experience that runs
-- BEFORE Career Builder. One user = one record. The discovery experience is an
-- additive, flag-gated (careerDiscovery / FF_CAREER_DISCOVERY) orchestration
-- layer that COMPOSES existing engines; the only net-new captured data is a
-- light Values inventory plus the aggregated discovery profile snapshot.
--
-- Additive & reversible: this table is only ever created on the flag-ON code
-- path (a lazy ensure-schema mirror lives in
-- backend/services/career-discovery-orchestrator.ts -> ensureCareerDiscoverySchema),
-- so absent / flag-OFF environments are byte-identical to today incl. schema.
--
-- The per-user `hasCompletedDiscovery` flag is DERIVED from
-- (status = 'completed' OR status = 'skipped'); it is not a separate column on
-- the users table, so legacy rows / flag-OFF remain untouched.
-- ============================================================

CREATE TABLE IF NOT EXISTS career_discovery_results (
  user_id             VARCHAR     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Aggregated, composed discovery profile snapshot (read-only over existing engines).
  profile             JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- Net-new Values inventory raw responses + scored dimensions.
  values_responses    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  values_scores       JSONB,
  -- Overall career-compatibility score (0-100) when derivable from the match
  -- engine; NULL (never 0) when no measurable signal exists yet.
  compatibility_score INTEGER,
  -- in_progress | completed | skipped
  status              TEXT        NOT NULL DEFAULT 'in_progress',
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cdr_status ON career_discovery_results(status);
