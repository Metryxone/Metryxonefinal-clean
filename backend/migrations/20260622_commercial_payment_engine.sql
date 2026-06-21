-- Phase 6.3 — Payment Engine (additive, flag-gated by commercial flags).
-- Mirrors the lazy ensure-schema in services/commercial/catalog-schema.ts (no migration runner;
-- ensureCommercialSchema is the live bootstrap). Idempotent (CREATE TABLE IF NOT EXISTS).
--
-- A: subscription refund ledger (comm_subscriptions carry no refund evidence on their own).
-- B: append-only customer credit wallet (balance is DERIVED, never a stored mutable column).

CREATE TABLE IF NOT EXISTS comm_refunds (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id     UUID NOT NULL REFERENCES comm_subscriptions(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES comm_customers(id)     ON DELETE CASCADE,
  amount_paise        INTEGER NOT NULL CHECK (amount_paise > 0),
  currency            TEXT NOT NULL DEFAULT 'INR',
  reason              TEXT,
  status              TEXT NOT NULL DEFAULT 'processed'
    CHECK (status IN ('processed','pending','failed')),
  razorpay_payment_id TEXT,
  razorpay_refund_id  TEXT,
  is_demo             BOOLEAN NOT NULL DEFAULT FALSE,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comm_credit_ledger (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID NOT NULL REFERENCES comm_customers(id) ON DELETE CASCADE,
  entry_type          TEXT NOT NULL CHECK (entry_type IN ('credit','debit')),
  amount_paise        INTEGER NOT NULL CHECK (amount_paise > 0),
  currency            TEXT NOT NULL DEFAULT 'INR',
  reason              TEXT,
  ref_type            TEXT,
  ref_id              TEXT,
  balance_after_paise INTEGER NOT NULL,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_refunds_sub            ON comm_refunds(subscription_id);
CREATE INDEX IF NOT EXISTS idx_comm_refunds_customer       ON comm_refunds(customer_id);
CREATE INDEX IF NOT EXISTS idx_comm_credit_ledger_customer ON comm_credit_ledger(customer_id, created_at);
