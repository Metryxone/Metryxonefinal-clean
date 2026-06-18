-- Task #6 — Invoice & GST Engine schema.
--
-- ADDITIVE ONLY · `inv_*` namespace, alongside (never touching) capadex_payments / comm_* .
-- There is no migration runner in this project (see replit.md "canonical migration + lazy
-- ensure-schema"); the runtime bootstrap in services/invoice/invoice-schema.ts mirrors this file
-- EXACTLY. Created/applied ONLY when the invoiceGstEngine flag is ON — flag-OFF leaves the schema
-- byte-identical to legacy.

-- ── Seller configuration (single active row; the GSTIN/state used on every document) ──
CREATE TABLE IF NOT EXISTS inv_seller_config (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name         TEXT NOT NULL DEFAULT 'MetryxOne',
  trade_name         TEXT,
  gstin              TEXT,
  state_code         TEXT,
  address_line1      TEXT,
  address_line2      TEXT,
  city               TEXT,
  state              TEXT,
  pincode            TEXT,
  email              TEXT,
  phone              TEXT,
  default_gst_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 18,
  hsn_sac            TEXT,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  metadata           JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Gap-free, collision-safe numbering counter (one row per doc_type + fiscal_year) ──
CREATE TABLE IF NOT EXISTS inv_number_sequence (
  doc_type     TEXT NOT NULL,
  fiscal_year  TEXT NOT NULL,
  next_value   INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_type, fiscal_year)
);

-- ── Invoice documents (all amounts integer paise) ──
CREATE TABLE IF NOT EXISTS inv_invoices (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number     TEXT NOT NULL UNIQUE,
  doc_type           TEXT NOT NULL
    CHECK (doc_type IN ('tax','proforma','credit_note','debit_note','payment_receipt','refund_receipt')),
  status             TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued','emailed','cancelled')),
  fiscal_year        TEXT NOT NULL,
  source_type        TEXT NOT NULL
    CHECK (source_type IN ('capadex_payment','comm_subscription','refund','manual')),
  source_id          TEXT,
  related_invoice_id UUID REFERENCES inv_invoices(id) ON DELETE SET NULL,
  customer_email     TEXT,
  customer_name      TEXT,
  buyer_gstin        TEXT,
  buyer_state_code   TEXT,
  place_of_supply    TEXT,
  supply_type        TEXT
    CHECK (supply_type IN ('intra_state','inter_state','undetermined')),
  currency           TEXT NOT NULL DEFAULT 'INR',
  subtotal_paise     INTEGER NOT NULL DEFAULT 0,
  discount_paise     INTEGER NOT NULL DEFAULT 0,
  taxable_paise      INTEGER NOT NULL DEFAULT 0,
  gst_rate_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,
  cgst_paise         INTEGER NOT NULL DEFAULT 0,
  sgst_paise         INTEGER NOT NULL DEFAULT 0,
  igst_paise         INTEGER NOT NULL DEFAULT 0,
  total_tax_paise    INTEGER NOT NULL DEFAULT 0,
  total_paise        INTEGER NOT NULL DEFAULT 0,
  seller_gstin       TEXT,
  seller_state_code  TEXT,
  notes              TEXT,
  pdf_path           TEXT,
  emailed_at         TIMESTAMPTZ,
  metadata           JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_invoices_doc_type ON inv_invoices(doc_type);
CREATE INDEX IF NOT EXISTS idx_inv_invoices_created_at ON inv_invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_inv_invoices_source ON inv_invoices(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_inv_invoices_email ON inv_invoices(customer_email);

-- ── Line items (per invoice) ──
CREATE TABLE IF NOT EXISTS inv_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES inv_invoices(id) ON DELETE CASCADE,
  line_no       INTEGER NOT NULL DEFAULT 1,
  description   TEXT NOT NULL,
  hsn_sac       TEXT,
  quantity      NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_paise    INTEGER NOT NULL DEFAULT 0,
  amount_paise  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_line_items_invoice ON inv_line_items(invoice_id);
