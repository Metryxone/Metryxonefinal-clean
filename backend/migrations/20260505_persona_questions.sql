-- Add persona targeting to assessment question tables
ALTER TABLE sdi_items ADD COLUMN IF NOT EXISTS target_personas TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE short_assessment_questions ADD COLUMN IF NOT EXISTS target_personas TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS sdi_items_personas_gin ON sdi_items USING GIN(target_personas);
CREATE INDEX IF NOT EXISTS saq_personas_gin ON short_assessment_questions USING GIN(target_personas);
