-- Migration: 20260524_orchestration_context_core.sql
--
-- Orchestration Context Core — per-session runtime context for CAPADEX
-- behavioural assessments. Captures the *actor → target* persona pairing
-- (e.g. self-reflection vs. third-party rating), the relationship type
-- between them, and the two-axis truth-resolution metrics used downstream
-- by the reliability calibrator. `behavioral_reliability_index` is the
-- composite single-number trust score (0..1, default 1.00 = unmasked).
--
-- Append-only by design — every session creates a fresh context row;
-- mutations land in sibling tables, not here.

CREATE TABLE IF NOT EXISTS capadex_runtime_contexts (
    id BIGSERIAL PRIMARY KEY,
    session_id UUID REFERENCES capadex_sessions(id) ON DELETE CASCADE,
    actor_persona VARCHAR(50) NOT NULL,
    target_persona VARCHAR(50) NOT NULL,
    relationship_type VARCHAR(50) DEFAULT 'direct',
    truth_resolution_metrics JSONB NOT NULL DEFAULT '{"aspirational_skew": 0.0, "self_masking_index": 0.0}',
    behavioral_reliability_index NUMERIC(3,2) DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capadex_runtime_contexts_session_id
    ON capadex_runtime_contexts(session_id);
