-- Add tagging columns to sdi_items for stage, age-band, concern and scoring metadata
ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;
ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS age_band    text;
ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS stage_code  text;
ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS concern_name text;
ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS weight      numeric DEFAULT 1.0;
ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS polarity    text;
ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS focus_area  text;
ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS layer_tag   text;

CREATE INDEX IF NOT EXISTS sdi_items_stage_idx      ON sdi_items(stage_code);
CREATE INDEX IF NOT EXISTS sdi_items_age_band_idx   ON sdi_items(age_band);
CREATE INDEX IF NOT EXISTS sdi_items_concern_idx    ON sdi_items(concern_name);
