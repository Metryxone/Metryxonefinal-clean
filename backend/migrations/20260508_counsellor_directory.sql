-- Counsellor Directory: named registry for easier assignment in RIE crisis inbox
CREATE TABLE IF NOT EXISTS counsellors (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  specialisation  TEXT,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counsellors_active ON counsellors(active);
CREATE INDEX IF NOT EXISTS idx_counsellors_email  ON counsellors(email);
