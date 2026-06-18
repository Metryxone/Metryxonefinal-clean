-- Short Assessment Age Bands
CREATE TABLE IF NOT EXISTS short_assessment_age_bands (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  ages TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

INSERT INTO short_assessment_age_bands (code, ages, is_active, sort_order) VALUES
  ('A', '6-10',  TRUE, 1),
  ('B', '11-14', TRUE, 2),
  ('C', '15-18', TRUE, 3)
ON CONFLICT (code) DO NOTHING;

-- Short Assessment Questions
CREATE TABLE IF NOT EXISTS short_assessment_questions (
  id SERIAL PRIMARY KEY,
  concern_area_id INTEGER NOT NULL REFERENCES concern_areas(id) ON DELETE CASCADE,
  question_code TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'Curiosity',
  age_band TEXT,
  is_anchor BOOLEAN NOT NULL DEFAULT FALSE,
  focus_area TEXT,
  layer TEXT,
  dimension TEXT,
  question_text TEXT NOT NULL,
  response_options TEXT,
  polarity TEXT,
  weight TEXT DEFAULT '1',
  logic TEXT,
  options JSONB,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS saq_concern_stage_idx ON short_assessment_questions(concern_area_id, stage);
CREATE INDEX IF NOT EXISTS saq_stage_idx ON short_assessment_questions(stage);
CREATE INDEX IF NOT EXISTS saq_age_band_idx ON short_assessment_questions(age_band);
