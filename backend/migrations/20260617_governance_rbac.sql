-- ============================================================
-- Governance / RBAC — canonical migration (Critical Gaps #2 & #3)
-- ------------------------------------------------------------
-- Canonical reference for the additive governance tables. There is NO migration
-- runner in this project — these statements are mirrored by the lazy
-- ensureGovernanceSchema() in backend/services/governance/rbac-schema.ts, which
-- is the live source of truth at runtime. Keep the two in lockstep.
--
-- The base RBAC + audit tables (role_definitions / permission_definitions /
-- role_permissions / admin_audit_logs) are created by security-center.ts
-- (ensureSecuritySchema). This file documents only the genuinely-new governance
-- tables, PLUS the uniqueness index that makes role_permissions idempotently
-- seedable.
--
-- All statements are additive and IF NOT EXISTS — applying this file on an
-- already-bootstrapped DB is a no-op. The whole subsystem is gated by the
-- governanceRbacV2 flag (FF_GOVERNANCE_RBAC_V2); flag-OFF creates NO tables.
-- ============================================================

-- Make role→permission grants idempotently seedable.
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_permissions_pair
  ON role_permissions (role_id, permission_id);

-- Role hierarchy edges (parent inherits child's permissions).
CREATE TABLE IF NOT EXISTS rbac_role_hierarchies (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_role_id varchar NOT NULL,
  child_role_id varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (parent_role_id, child_role_id)
);

-- Permission groups (logical bundles for readability / curation).
CREATE TABLE IF NOT EXISTS rbac_permission_groups (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  group_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rbac_permission_group_members (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id varchar NOT NULL,
  permission_id varchar NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (group_id, permission_id)
);

-- Admin lifecycle status (advisory; does NOT change the live super_admin gate).
CREATE TABLE IF NOT EXISTS rbac_admin_status (
  admin_user_id varchar PRIMARY KEY,
  status text NOT NULL DEFAULT 'active',
  reason text,
  changed_by varchar,
  changed_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);

-- Generalized approval workflow requests.
CREATE TABLE IF NOT EXISTS rbac_approval_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL,
  target_ref text,
  target_label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  requested_by varchar,
  requested_by_email text,
  decided_by varchar,
  decision_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  decided_at timestamp
);
CREATE INDEX IF NOT EXISTS idx_rbac_approvals_status
  ON rbac_approval_requests (status, created_at DESC);

-- Failed-login attempts (suspicious-activity / security center).
CREATE TABLE IF NOT EXISTS rbac_failed_logins (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  ip_address text,
  reason text,
  user_agent text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rbac_failed_logins_created_at
  ON rbac_failed_logins (created_at DESC);

-- Feature-flag change log.
CREATE TABLE IF NOT EXISTS rbac_flag_change_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key text NOT NULL,
  old_value text,
  new_value text,
  changed_by varchar,
  changed_by_email text,
  note text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rbac_flag_change_log_created_at
  ON rbac_flag_change_log (created_at DESC);
