-- ============================================================================
-- Adaptive Runtime V2 — Phase 2 gap-fill migration (additive)
-- ============================================================================
-- Most Phase 2 spec tables already exist:
--   20260705_assessment_blueprint_v2.sql:
--     assessment_blueprints_v2, assessment_blueprint_competencies,
--     adaptive_question_pools, competency_question_templates,
--     assessment_branching_rules, assessment_runtime_sessions_v2,
--     competency_signal_capture, behavioral_assessment_signals,
--     assessment_explainability_logs
--   20260710_contextual_scoring_v2.sql:
--     competency_norm_contexts, contextual_benchmark_cohorts,
--     competency_percentile_distributions_v2, competency_readiness_models,
--     competency_growth_velocity, competency_confidence_profiles,
--     competency_reliability_history, scoring_explainability_v2
--   20260720_ai_inference_v2.sql:
--     ai_reasoning_chains, ai_inferred_competencies,
--     behavioral_inference_profiles, inference_confidence_models,
--     ai_assessment_memory
--
-- This migration adds the two tables that have NO existing equivalent:
--   1. dynamic_question_generation_logs — per-question generation lineage
--                                         (which template / pool / branching
--                                         rule produced each question, and why)
--   2. ai_report_generations           — per-report generation audit (graph
--                                         nodes used, sections produced,
--                                         engine versions, latency)
--
-- Both are idempotent and append-only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS dynamic_question_generation_logs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               UUID NULL,             -- assessment_runtime_sessions_v2.id
  user_id                  TEXT NOT NULL,
  question_index           INTEGER NULL,          -- ordinal within the session
  -- the generated question payload (text, options, scale, mode)
  question_payload         JSONB NOT NULL,
  -- which competency / sub-competency this probe targets
  target_competency_code   TEXT NULL,
  target_subcompetency     TEXT NULL,
  -- which generation source produced this question
  generation_source        TEXT NULL,             -- 'template' | 'pool' | 'branching' | 'graph' | 'ai'
  generation_inputs        JSONB NULL,            -- snapshot of inputs used
  generation_rationale     TEXT NULL,             -- human-readable "why this question now"
  difficulty_level         NUMERIC(5,2) NULL,
  confidence_target        NUMERIC(5,2) NULL,
  engine_versions          JSONB NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dqgl_session
  ON dynamic_question_generation_logs (session_id, question_index);
CREATE INDEX IF NOT EXISTS idx_dqgl_user_created
  ON dynamic_question_generation_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dqgl_competency
  ON dynamic_question_generation_logs (target_competency_code);


CREATE TABLE IF NOT EXISTS ai_report_generations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id               UUID NULL,
  user_id                  TEXT NOT NULL,
  report_type              TEXT NOT NULL,         -- 'intelligence' | 'benchmark' | 'readiness' | 'mobility' | 'leadership' | 'workforce'
  -- the full generated report (sections, narratives, charts payloads)
  report_payload           JSONB NOT NULL,
  -- which graph nodes / edges contributed (lineage for explainability)
  source_graph_nodes       JSONB NULL,            -- [competency_code, ...]
  source_data_points       JSONB NULL,            -- [{table, id, contribution_weight}, ...]
  sections_produced        TEXT[] NULL,
  confidence_score         NUMERIC(5,2) NULL,
  generation_latency_ms    INTEGER NULL,
  engine_versions          JSONB NULL,
  language_policy_snapshot JSONB NULL,            -- snapshot of allowed/disallowed terms in effect
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arg_user_created
  ON ai_report_generations (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arg_session
  ON ai_report_generations (session_id);
CREATE INDEX IF NOT EXISTS idx_arg_type_created
  ON ai_report_generations (report_type, created_at DESC);
