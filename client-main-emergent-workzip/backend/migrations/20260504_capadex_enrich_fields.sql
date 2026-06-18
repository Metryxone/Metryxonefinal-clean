-- Enrich sdi_items with full CAPADEX taxonomy fields
ALTER TABLE sdi_items
  ADD COLUMN IF NOT EXISTS anchor          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS domain          text,
  ADD COLUMN IF NOT EXISTS sub_domain_name text,
  ADD COLUMN IF NOT EXISTS dimension       text,
  ADD COLUMN IF NOT EXISTS logic           text,
  ADD COLUMN IF NOT EXISTS response_range  text,
  ADD COLUMN IF NOT EXISTS opt_a           text,
  ADD COLUMN IF NOT EXISTS opt_b           text,
  ADD COLUMN IF NOT EXISTS opt_c           text,
  ADD COLUMN IF NOT EXISTS opt_d           text,
  ADD COLUMN IF NOT EXISTS opt_e           text;

CREATE INDEX IF NOT EXISTS sdi_items_domain_idx     ON sdi_items(domain);
CREATE INDEX IF NOT EXISTS sdi_items_anchor_idx     ON sdi_items(anchor);
