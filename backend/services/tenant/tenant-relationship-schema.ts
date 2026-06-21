/**
 * Phase 6.11 — Multi-Tenant Architecture · lazy ensure-schema for the additive relationship models.
 *
 * WRITE-PATH ONLY. This mirrors migrations/20260621_multi_tenant_architecture.sql and is invoked ONLY
 * from the explicit console setup / enforcement-arm POST handlers — never from a GET. With the
 * tenantManagementConsole flag OFF no console route runs, so this DDL never executes → byte-identical
 * legacy. tenants.id is INTEGER.
 */
import pg from 'pg';

let ensured = false;

export async function ensureTenantRelationshipSchema(pool: pg.Pool): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_category_assignments (
      id            SERIAL PRIMARY KEY,
      tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      category      TEXT NOT NULL CHECK (category IN ('institution','employer','partner','franchise','channel_partner')),
      is_primary    BOOLEAN NOT NULL DEFAULT false,
      metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, category)
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_category_assignments_tenant ON tenant_category_assignments(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_category_assignments_category ON tenant_category_assignments(category);

    CREATE TABLE IF NOT EXISTS tenant_relationships (
      id                 SERIAL PRIMARY KEY,
      parent_tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      child_tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      relationship_type  TEXT NOT NULL CHECK (relationship_type IN ('franchise','channel','partner','subsidiary')),
      status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','terminated','pending')),
      metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
      CHECK (parent_tenant_id <> child_tenant_id),
      UNIQUE (parent_tenant_id, child_tenant_id, relationship_type)
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_relationships_parent ON tenant_relationships(parent_tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_relationships_child ON tenant_relationships(child_tenant_id);

    CREATE TABLE IF NOT EXISTS tenant_partner_agreements (
      id              SERIAL PRIMARY KEY,
      tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      partner_type    TEXT NOT NULL CHECK (partner_type IN ('training','certification','assessment','hiring','counseling','channel','franchise','other')),
      agreement_code  TEXT NOT NULL,
      status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','expired','terminated','pending')),
      commission_pct  NUMERIC(5,2) CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100)),
      start_date      DATE,
      end_date        DATE,
      terms           JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, agreement_code)
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_partner_agreements_tenant ON tenant_partner_agreements(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_partner_agreements_type ON tenant_partner_agreements(partner_type);

    CREATE TABLE IF NOT EXISTS tenant_channel_referrals (
      id                         SERIAL PRIMARY KEY,
      channel_partner_tenant_id  INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      referred_tenant_id         INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
      referral_code              TEXT NOT NULL,
      status                     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','converted','expired','rejected')),
      commission_pct             NUMERIC(5,2) CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100)),
      commission_amount          NUMERIC(14,2) CHECK (commission_amount IS NULL OR commission_amount >= 0),
      currency                   TEXT NOT NULL DEFAULT 'INR',
      referred_at                TIMESTAMP NOT NULL DEFAULT NOW(),
      converted_at               TIMESTAMP,
      metadata                   JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (channel_partner_tenant_id, referral_code)
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_channel_referrals_partner ON tenant_channel_referrals(channel_partner_tenant_id);
    CREATE INDEX IF NOT EXISTS idx_tenant_channel_referrals_referred ON tenant_channel_referrals(referred_tenant_id);
  `);
  ensured = true;
}

/** The four additive relationship tables this phase owns (used by status/seed/enforcement helpers). */
export const TENANT_RELATIONSHIP_TABLES = [
  'tenant_category_assignments',
  'tenant_relationships',
  'tenant_partner_agreements',
  'tenant_channel_referrals',
] as const;
