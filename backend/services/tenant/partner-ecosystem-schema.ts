/**
 * Phase 6.12 — Partner Ecosystem · lazy ensure-schema for the additive lifecycle extensions.
 *
 * WRITE-PATH ONLY. This mirrors migrations/20260621_partner_ecosystem.sql and is invoked ONLY from the
 * explicit partner-ecosystem setup / write POST handlers — never from a GET. With the partnerEcosystem
 * flag OFF no partner route runs, so this DDL never executes → byte-identical legacy.
 *
 * It (1) ensures the Phase 6.11 relationship substrate, (2) widens the tenant_partner_agreements status
 * CHECK to add the 'draft' state required by the lifecycle (draft → active → suspended → terminated),
 * and (3) creates an APPEND-ONLY lifecycle event log. tenants.id is INTEGER.
 */
import pg from 'pg';
import { ensureTenantRelationshipSchema } from './tenant-relationship-schema';

let ensured = false;

/** The agreement status values supported AFTER this schema runs (legacy values retained for compat). */
export const AGREEMENT_STATUS_VALUES = [
  'draft', 'active', 'suspended', 'expired', 'terminated', 'pending',
] as const;

export async function ensurePartnerEcosystemSchema(pool: pg.Pool): Promise<void> {
  if (ensured) return;
  // Base relationship tables (idempotent; mirrors the 6.11 migration).
  await ensureTenantRelationshipSchema(pool);

  // Widen the agreement status CHECK to add 'draft'. The original constraint was defined inline in the
  // CREATE TABLE, so Postgres auto-named it tenant_partner_agreements_status_check. Drop-then-add is
  // idempotent: the drop is IF EXISTS and the add recreates the (now-wider) constraint each run.
  await pool.query(`
    ALTER TABLE tenant_partner_agreements
      DROP CONSTRAINT IF EXISTS tenant_partner_agreements_status_check;
    ALTER TABLE tenant_partner_agreements
      ADD CONSTRAINT tenant_partner_agreements_status_check
      CHECK (status IN ('draft','active','suspended','expired','terminated','pending'));
  `);

  // Append-only lifecycle event log (never mutated in place).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_partner_agreement_events (
      id            SERIAL PRIMARY KEY,
      agreement_id  INTEGER NOT NULL REFERENCES tenant_partner_agreements(id) ON DELETE CASCADE,
      from_status   TEXT,
      to_status     TEXT NOT NULL,
      note          TEXT,
      actor         TEXT,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tenant_partner_agreement_events_agreement
      ON tenant_partner_agreement_events(agreement_id);
  `);

  // Deal-value capture on a converted referral so a payout can be computed as commission_pct × deal_value
  // (instead of requiring a manually-typed commission_amount). All additive + nullable → legacy rows and
  // the flag-OFF path are byte-identical. deal_value is in CURRENCY UNITS (rupees), matching commission_amount.
  //   • deal_value              — the real deal/transaction value the commission is computed against.
  //   • deal_value_source       — provenance ('manual' | 'comm_subscriptions' | 'capadex_payments' |
  //                               'linked_ledger'); honest about where the value came from, never fabricated.
  //   • commission_amount_source — 'explicit' (operator typed it) | 'derived' (pct × deal_value).
  await pool.query(`
    ALTER TABLE tenant_channel_referrals
      ADD COLUMN IF NOT EXISTS deal_value NUMERIC(14,2)
        CHECK (deal_value IS NULL OR deal_value >= 0);
    ALTER TABLE tenant_channel_referrals
      ADD COLUMN IF NOT EXISTS deal_value_source TEXT;
    ALTER TABLE tenant_channel_referrals
      ADD COLUMN IF NOT EXISTS commission_amount_source TEXT;
  `);

  ensured = true;
}

/** Tables/extensions this phase owns on top of the 6.11 substrate. */
export const PARTNER_ECOSYSTEM_TABLES = [
  'tenant_partner_agreements',
  'tenant_partner_agreement_events',
  'tenant_channel_referrals',
] as const;
