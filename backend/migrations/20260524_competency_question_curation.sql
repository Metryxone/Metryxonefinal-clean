-- Competency Question Templates — admin curation layer
-- Adds status / source / reviewer columns so SuperAdmin can curate the bank:
-- generator inserts as status='draft', admin promotes to status='approved' before
-- it surfaces to users. Selector endpoint reads only WHERE status='approved'.
--
-- All ALTERs are idempotent so this migration is safe to re-run.

ALTER TABLE competency_question_templates
  ADD COLUMN IF NOT EXISTS status      TEXT        NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS source      TEXT        NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS notes       TEXT;

-- status ∈ {draft, approved, rejected, archived}
-- source ∈ {manual, generated, seed}
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cqt_status_chk') THEN
    ALTER TABLE competency_question_templates
      ADD CONSTRAINT cqt_status_chk CHECK (status IN ('draft','approved','rejected','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cqt_source_chk') THEN
    ALTER TABLE competency_question_templates
      ADD CONSTRAINT cqt_source_chk CHECK (source IN ('manual','generated','seed'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_cqt_status_competency
  ON competency_question_templates(status, competency_code);
CREATE INDEX IF NOT EXISTS idx_cqt_source ON competency_question_templates(source);
