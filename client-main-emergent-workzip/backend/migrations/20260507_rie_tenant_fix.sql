-- ============================================================
-- RIE Tenant Isolation Fix
-- Replaces single-column UNIQUE(user_email) with composite
-- (user_email, tenant_id) using a sentinel UUID for the public
-- namespace so ON CONFLICT works without nullable columns.
-- ============================================================

-- Backfill: set sentinel UUID where tenant_id is NULL
UPDATE rie_intervention_context
  SET tenant_id = '00000000-0000-0000-0000-000000000000'
  WHERE tenant_id IS NULL;

UPDATE rie_recovery_profiles
  SET tenant_id = '00000000-0000-0000-0000-000000000000'
  WHERE tenant_id IS NULL;

-- Set column defaults so all future inserts get the sentinel automatically
ALTER TABLE rie_intervention_context
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000000';

ALTER TABLE rie_recovery_profiles
  ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000000';

-- Make NOT NULL now that all rows are backfilled
ALTER TABLE rie_intervention_context ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE rie_recovery_profiles    ALTER COLUMN tenant_id SET NOT NULL;

-- Drop the old email-only unique constraints
ALTER TABLE rie_intervention_context
  DROP CONSTRAINT IF EXISTS rie_intervention_context_user_email_key;

ALTER TABLE rie_recovery_profiles
  DROP CONSTRAINT IF EXISTS rie_recovery_profiles_user_email_key;

-- Add composite unique indexes (true tenant isolation)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rie_ctx_tenant_email
  ON rie_intervention_context(user_email, tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rie_recovery_tenant_email
  ON rie_recovery_profiles(user_email, tenant_id);
