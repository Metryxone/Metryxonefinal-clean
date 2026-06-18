-- Crisis Alert Inbox: add acknowledged_at + admin_notified_at to rie_escalations
ALTER TABLE rie_escalations
  ADD COLUMN IF NOT EXISTS acknowledged_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by  TEXT,
  ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_rie_esc_ack
  ON rie_escalations(acknowledged_at)
  WHERE mandatory_human_review = TRUE;
