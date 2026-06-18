-- CAPADEX progressive stage payments
CREATE TABLE IF NOT EXISTS capadex_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID REFERENCES capadex_sessions(id) ON DELETE SET NULL,
  email            TEXT NOT NULL,
  participant_name TEXT,
  concern_name     TEXT,
  stage_code       TEXT NOT NULL,
  stage_name       TEXT NOT NULL,
  amount_paise     INTEGER NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','failed','refunded')),
  notified_user    BOOLEAN NOT NULL DEFAULT FALSE,
  notified_admin   BOOLEAN NOT NULL DEFAULT FALSE,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capadex_payments_email      ON capadex_payments(email);
CREATE INDEX IF NOT EXISTS idx_capadex_payments_order_id   ON capadex_payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_capadex_payments_status     ON capadex_payments(status);
CREATE INDEX IF NOT EXISTS idx_capadex_payments_stage_code ON capadex_payments(stage_code);
