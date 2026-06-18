-- Gap #2 — SLA escalation firing.
-- Adds escalation marker columns on wos_disputes so a sweeper can persist
-- breach state + escalation target idempotently. Additive, backwards-compatible.

ALTER TABLE wos_disputes ADD COLUMN IF NOT EXISTS escalated_at       TIMESTAMPTZ;
ALTER TABLE wos_disputes ADD COLUMN IF NOT EXISTS escalation_level   INT;
ALTER TABLE wos_disputes ADD COLUMN IF NOT EXISTS escalation_target  TEXT;
ALTER TABLE wos_disputes ADD COLUMN IF NOT EXISTS last_sla_check_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_wos_disp_escalated ON wos_disputes(escalated_at) WHERE escalated_at IS NOT NULL;
