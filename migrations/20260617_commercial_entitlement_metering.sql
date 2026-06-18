-- Task #7 — Commercial Monetization Spine · Entitlement, Metering & Revenue Intelligence
--
-- CANONICAL REFERENCE for the two NEW tables introduced this phase. This project has NO migration
-- runner (see replit.md "canonical migration + lazy ensure-schema"); these statements are mirrored
-- EXACTLY by the runtime lazy ensure-schema modules and are the source of truth for the shape:
--   - comm_entitlement_grants  ← services/commercial/entitlement-grants-schema.ts
--   - comm_usage_events        ← services/commercial/metering-schema.ts
--
-- ADDITIVE & FLAG-GATED. With FF_COMMERCIAL_ENTITLEMENT_CLASSES / FF_COMMERCIAL_USAGE_METERING OFF
-- (the defaults) the runtime never calls the ensure-schema and these tables are never created → the
-- live schema is byte-identical to before this phase. Both tables are idempotent (IF NOT EXISTS).

-- ── Manual entitlement grants (super-admin overrides, additive to ledger-derived entitlement) ──────
CREATE TABLE IF NOT EXISTS comm_entitlement_grants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  feature     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked')),
  reason      TEXT,
  granted_by  TEXT,
  expires_at  TIMESTAMPTZ,
  revoked_by  TEXT,
  revoked_at  TIMESTAMPTZ,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comm_ent_grants_email  ON comm_entitlement_grants(lower(email));
CREATE INDEX IF NOT EXISTS idx_comm_ent_grants_status ON comm_entitlement_grants(status);

-- ── Usage metering ledger (append-only; quotas evaluated by COUNT over the current period) ─────────
CREATE TABLE IF NOT EXISTS comm_usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT NOT NULL,
  subscription_id UUID,
  usage_type      TEXT NOT NULL
    CHECK (usage_type IN ('views','searches','unlocks','assessments','downloads','exports','api')),
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  metadata        JSONB,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comm_usage_email      ON comm_usage_events(lower(email));
CREATE INDEX IF NOT EXISTS idx_comm_usage_type       ON comm_usage_events(usage_type);
CREATE INDEX IF NOT EXISTS idx_comm_usage_occurred   ON comm_usage_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_comm_usage_email_type ON comm_usage_events(lower(email), usage_type);
