-- OMEGA-X Composite Payload Storage (Adv. consolidation pass)
-- Stores the 8-layer composite payload (demographic / identity / behavioural /
-- cognitive / emotional / capability / risk / longitudinal) emitted by the
-- CAPADEX /complete handler. Read by downstream dashboard cards.
--
-- Spec referenced `assessment_sessions`; the actual CAPADEX sessions table is
-- `capadex_sessions` — adding the column there to avoid creating a phantom
-- second sessions registry.

ALTER TABLE capadex_sessions
  ADD COLUMN IF NOT EXISTS omega_x_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN capadex_sessions.omega_x_payload IS
  '8-layer composite profile (demographic/identity/behavioural/cognitive/emotional/capability/risk/longitudinal). Written by /api/capadex/session/:id/complete after scoring + telemetry calibration. Defaults applied; only telemetry-driven fields (overthinking, indecisiveness, perfectionism) are computed today.';
