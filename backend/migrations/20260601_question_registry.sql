-- CAPADEX Question Registry & Governance (Phase 5 — long-term maintainability, 2026-06-01).
--
-- Canonical DDL. This repo has NO migration runner; the service bootstraps the
-- identical DDL lazily (see backend/services/question-registry-service.ts
-- ensureQuestionRegistrySchema). Keep the two in lockstep.
--
-- Purpose: lifecycle-track every clarity question so the bank can scale to
-- 20,000+ items under human governance. One registry row per
-- capadex_clarity_questions.question_id. Metrics (usage / signal / report
-- impact / quality / nearest duplicate) are SNAPSHOTTED by a bulk refresh job —
-- the registry is read fast at request time. Status is HUMAN-ONLY: no job ever
-- transitions lifecycle state automatically.

CREATE TABLE IF NOT EXISTS capadex_question_registry (
  question_id        TEXT PRIMARY KEY,
  version            INTEGER       NOT NULL DEFAULT 1,
  status             TEXT          NOT NULL DEFAULT 'active',
  -- Curatorial quality score (0..1), composite heuristic. Human-overridable;
  -- refresh skips rows where quality_overridden = true.
  quality_score      NUMERIC(5,4),
  quality_overridden BOOLEAN       NOT NULL DEFAULT FALSE,
  -- Real usage telemetry (capadex_responses).
  usage_count        INTEGER       NOT NULL DEFAULT 0,
  last_used_at       TIMESTAMPTZ,
  -- Derived behavioural metrics. NULL = no traceable evidence yet (NEVER a
  -- fabricated neutral value — absence is distinct from "low").
  signal_value       NUMERIC(5,4),
  report_impact      NUMERIC(5,4),
  -- Nearest semantic duplicate within the same bridge-tag bucket (informational).
  duplicate_of       TEXT,
  duplicate_score    NUMERIC(5,4),
  metrics_computed_at TIMESTAMPTZ,
  -- Human review audit trail (status transitions are human-only).
  status_changed_at  TIMESTAMPTZ,
  status_changed_by  TEXT,
  review_notes       TEXT,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT capadex_question_registry_status_chk CHECK (
    status IN ('draft','testing','active','candidate_for_retirement','deprecated','archived')
  )
);

-- Indexes sized for a 20k+ bank: governance buckets filter/sort by these.
CREATE INDEX IF NOT EXISTS idx_cqr_status        ON capadex_question_registry (status);
CREATE INDEX IF NOT EXISTS idx_cqr_quality       ON capadex_question_registry (quality_score);
CREATE INDEX IF NOT EXISTS idx_cqr_usage         ON capadex_question_registry (usage_count);
CREATE INDEX IF NOT EXISTS idx_cqr_signal        ON capadex_question_registry (signal_value);
CREATE INDEX IF NOT EXISTS idx_cqr_duplicate     ON capadex_question_registry (duplicate_score);
