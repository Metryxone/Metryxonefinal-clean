-- ============================================================
-- Platform Admin Foundation
-- 1. platform_audit_log    — who changed what and when
-- 2. platform_approval_requests — review queue for all ontology modules
-- ============================================================

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      VARCHAR(120) NOT NULL,
  actor_email   VARCHAR(200),
  actor_role    VARCHAR(40)  NOT NULL DEFAULT 'superadmin',
  action        VARCHAR(40)  NOT NULL,  -- create|update|archive|delete|import|export|submit_review|approve|reject
  entity_type   VARCHAR(60)  NOT NULL,  -- industry|function|department|role|career-track|...
  entity_id     VARCHAR(40),
  entity_label  VARCHAR(250),
  before_state  JSONB,
  after_state   JSONB,
  metadata      JSONB,
  ip_address    VARCHAR(60),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pal_actor      ON platform_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_pal_entity     ON platform_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pal_action     ON platform_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_pal_created    ON platform_audit_log(created_at DESC);

-- ── Approval requests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_approval_requests (
  id               BIGSERIAL   PRIMARY KEY,
  entity_type      VARCHAR(60) NOT NULL,
  entity_id        VARCHAR(40) NOT NULL,
  entity_label     VARCHAR(250),
  change_summary   TEXT        NOT NULL,
  submitter_id     VARCHAR(120) NOT NULL,
  submitter_email  VARCHAR(200),
  reviewer_id      VARCHAR(120),
  reviewer_email   VARCHAR(200),
  status           VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending|approved|rejected|cancelled
  reviewer_comment TEXT,
  priority         VARCHAR(20) NOT NULL DEFAULT 'normal',   -- low|normal|high|critical
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at       TIMESTAMPTZ,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_par_status     ON platform_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_par_entity     ON platform_approval_requests(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_par_submitter  ON platform_approval_requests(submitter_id);
CREATE INDEX IF NOT EXISTS idx_par_created    ON platform_approval_requests(created_at DESC);
