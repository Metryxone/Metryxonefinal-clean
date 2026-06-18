-- ============================================================================
-- Phase 2 — Evidence Runtime + Signal Activation Runtime
--
-- Part A: capadex_evidence — normalised evidence objects derived from answers,
--         telemetry, mutations and response-time anomalies. Append-only.
-- Part B: additive lifecycle columns on capadex_session_signals so the Signal
--         Activation Runtime can persist signal lifecycle state.
--
-- Rule: Answers -> Evidence -> Signals. Signals never activate from answers
-- directly. Evidence is the only input to the activation runtime.
--
-- This repo has no migration runner; the engine bootstraps the same DDL lazily
-- (see backend/services/evidence-engine.ts ensureEvidenceRuntimeSchema). This
-- file is the canonical, idempotent record of that schema.
-- ============================================================================

CREATE TABLE IF NOT EXISTS capadex_evidence (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL,
  source_type  VARCHAR(40)  NOT NULL,
  source_id    VARCHAR(255),
  answer_value TEXT,
  evidence_key VARCHAR(120) NOT NULL,
  strength     NUMERIC(5,4) NOT NULL DEFAULT 0,
  confidence   NUMERIC(5,4) NOT NULL DEFAULT 0,
  metadata     JSONB        NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_capadex_evidence_session ON capadex_evidence (session_id);
CREATE INDEX IF NOT EXISTS idx_capadex_evidence_key     ON capadex_evidence (evidence_key);

-- Idempotency key: one evidence row per logical event (session × item × source ×
-- signal). /respond is upsert-based and may be retried/replayed with identical
-- payloads; evidence is upserted on this key so replays refresh-in-place instead
-- of inflating evidence volume.
CREATE UNIQUE INDEX IF NOT EXISTS uq_capadex_evidence_event
  ON capadex_evidence (session_id, source_id, source_type, evidence_key);

-- ─── Additive lifecycle columns on capadex_session_signals ──────────────────
ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS lifecycle_state   VARCHAR(20);
ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS strength          NUMERIC(5,4);
ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS activation_count  INTEGER DEFAULT 0;
ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS evidence_count    INTEGER DEFAULT 0;
ALTER TABLE capadex_session_signals ADD COLUMN IF NOT EXISTS last_activated_at TIMESTAMPTZ;

-- Activation-runtime rows (lifecycle_state set) upsert by (session_id, signal_key).
-- Classifier-written rows (signal-capture.ts) leave lifecycle_state NULL and are
-- unaffected — they may legitimately repeat per detection, so the index is partial.
CREATE UNIQUE INDEX IF NOT EXISTS uq_capadex_session_signals_activation
  ON capadex_session_signals (session_id, signal_key)
  WHERE lifecycle_state IS NOT NULL;
