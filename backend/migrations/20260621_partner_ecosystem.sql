-- Phase 6.12 — Partner Ecosystem · additive lifecycle extensions over the Phase 6.11 substrate.
--
-- ADDITIVE ONLY. This builds on migrations/20260621_multi_tenant_architecture.sql (the four
-- relationship tables) and:
--   1. widens tenant_partner_agreements.status to add the 'draft' state required by the lifecycle
--      (draft → active → suspended → terminated; legacy 'pending'/'expired' retained for compat), and
--   2. adds an APPEND-ONLY lifecycle event log (tenant_partner_agreement_events).
--
-- Mirrored by the lazy ensurePartnerEcosystemSchema() which runs ONLY on the explicit partner-ecosystem
-- setup / write POST paths (never on a GET). With the partnerEcosystem flag OFF no partner route runs,
-- so this DDL is never triggered → byte-identical legacy. tenants.id is INTEGER.

-- 1. Widen the agreement status CHECK to add 'draft' (drop-then-add is idempotent).
ALTER TABLE tenant_partner_agreements
  DROP CONSTRAINT IF EXISTS tenant_partner_agreements_status_check;
ALTER TABLE tenant_partner_agreements
  ADD CONSTRAINT tenant_partner_agreements_status_check
  CHECK (status IN ('draft','active','suspended','expired','terminated','pending'));

-- 2. Append-only agreement lifecycle event log (never mutated in place).
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
