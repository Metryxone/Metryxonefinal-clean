-- ============================================================================
-- Competency Runtime V2 — Core gap-fill migration (additive)
-- ============================================================================
-- This migration is the gap-fill for Phase 1 of the V2 Dynamic Competency
-- Intelligence Runtime spec. Most Phase 1 tables already exist in:
--   - 20260630_competency_runtime_v2.sql
--       (competency_runtime_contexts, role_dna_profiles_v2,
--        competency_runtime_weights, competency_context_modifiers,
--        competency_resolution_history)
--   - 20260715_adaptive_orchestration_v2.sql
--       (competency_intelligence_profiles, competency_graph_nodes,
--        competency_graph_edges, adaptive_intelligence_events,
--        intelligence_orchestration_logs)
--
-- This migration adds the two tables that were NOT in those migrations:
--   1. runtime_explainability_logs   — per-resolution explainability snapshot
--   2. competency_profile_versions   — append-only versioning of the single
--                                       source-of-truth intelligence profile
--
-- Both are idempotent (CREATE TABLE IF NOT EXISTS) and append-only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS runtime_explainability_logs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                TEXT NOT NULL,
  resolution_history_id  UUID NULL,
  role_dna_id            UUID NULL,
  runtime_context_id     UUID NULL,
  -- structured explainability payload (rationale / confidence / lineage)
  explainability         JSONB NOT NULL,
  -- inputs that produced this explanation (kept for audit replay)
  inputs_snapshot        JSONB NULL,
  -- versions of the engines that produced it
  engine_versions        JSONB NULL,
  confidence_score       NUMERIC(5,2) NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rt_explain_user_created
  ON runtime_explainability_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rt_explain_dna
  ON runtime_explainability_logs (role_dna_id);


CREATE TABLE IF NOT EXISTS competency_profile_versions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT NOT NULL,
  -- monotonic per-user version counter (set by inserter, no enforcement here)
  version_number           INTEGER NOT NULL,
  -- the full snapshot at this version (mirrors competency_intelligence_profiles row)
  profile_snapshot         JSONB NOT NULL,
  -- which orchestration / resolution / event triggered the version bump
  triggered_by             TEXT NULL,        -- e.g. 'assessment.completed', 'manual.rebuild', 'dna.resolved'
  source_event_id          UUID NULL,        -- FK-shaped pointer into adaptive_intelligence_events
  resolution_history_id    UUID NULL,
  -- methodology versions in effect when this snapshot was taken
  engine_versions          JSONB NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_versions_user
  ON competency_profile_versions (user_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_profile_versions_user_created
  ON competency_profile_versions (user_id, created_at DESC);
