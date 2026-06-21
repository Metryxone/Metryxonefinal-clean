-- Task #29 — Guard against duplicate store credit from retried refund webhooks.
-- Mirrors the lazy ensure-schema in services/commercial/catalog-schema.ts (no migration runner;
-- ensureCommercialSchema is the live bootstrap). Idempotent / additive.
--
-- A retried refund-to-credit (same gateway refund id) must grant store value AT MOST ONCE. We add a
-- nullable dedup key + a PARTIAL unique index on (customer_id, idempotency_key). Nullable + partial
-- means existing rows and key-less callers are unaffected (byte-identical append-only behaviour).

ALTER TABLE comm_credit_ledger ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comm_credit_ledger_idem
  ON comm_credit_ledger(customer_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
