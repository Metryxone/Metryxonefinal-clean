-- Confidence & Reasoning Engine — Phase 1 S4
-- Records every confidence update with full reasoning breakdown and trigger event.

CREATE TABLE IF NOT EXISTS confidence_traces (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         TEXT        NOT NULL,
  hypothesis_id      UUID        REFERENCES behavioural_hypotheses(id) ON DELETE SET NULL,
  trigger_event      TEXT        NOT NULL, -- new_answer | signal_detected | contradiction_detected | longitudinal_match | manual_override
  confidence_before  NUMERIC(5,4) NOT NULL CHECK (confidence_before  BETWEEN 0 AND 1),
  confidence_after   NUMERIC(5,4) NOT NULL CHECK (confidence_after   BETWEEN 0 AND 1),
  uncertainty_before NUMERIC(5,4) NOT NULL CHECK (uncertainty_before BETWEEN 0 AND 1),
  uncertainty_after  NUMERIC(5,4) NOT NULL CHECK (uncertainty_after  BETWEEN 0 AND 1),
  evidence_depth     NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (evidence_depth    BETWEEN 0 AND 1),
  signal_reliability NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (signal_reliability BETWEEN 0 AND 1),
  longitudinal_consistency NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (longitudinal_consistency BETWEEN 0 AND 1),
  contradiction_weighting  NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (contradiction_weighting  BETWEEN 0 AND 1),
  reason_why         TEXT        NOT NULL,
  trace_detail       JSONB       NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ct_session    ON confidence_traces(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ct_hypothesis ON confidence_traces(hypothesis_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ct_trigger    ON confidence_traces(trigger_event);
