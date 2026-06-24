-- MX-101X — Question Factory (Competency Assessment Coverage Expansion)
--
-- Strictly ADDITIVE & REVERSIBLE. Adds provenance / confidence / quality-review
-- metadata to the existing competency question bank and a generation ledger.
-- No existing column or row is dropped or rewritten. The lazy
-- `ensureQuestionFactorySchema()` in backend/services/question-factory.ts mirrors
-- this file and is reached ONLY on the flag-ON write path, so with the
-- `questionFactory` flag OFF the schema is byte-identical to legacy.
--
-- Provenance vocabulary: human_authored | ai_generated | template_generated | imported
-- Quality-review vocabulary: pending_review | in_review | needs_revision | approved | rejected

ALTER TABLE competency_question_templates
  ADD COLUMN IF NOT EXISTS provenance            text,
  ADD COLUMN IF NOT EXISTS confidence_score      numeric,
  ADD COLUMN IF NOT EXISTS quality_review_status text;

CREATE INDEX IF NOT EXISTS idx_cqt_quality_review ON competency_question_templates (quality_review_status);
CREATE INDEX IF NOT EXISTS idx_cqt_provenance     ON competency_question_templates (provenance);

-- Factory batch ledger — one row per generate/import invocation (audit + reversibility).
CREATE TABLE IF NOT EXISTS question_factory_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id varchar(80),
  mode          text    NOT NULL,                 -- template | ai | import
  provenance    text    NOT NULL,
  requested     integer NOT NULL DEFAULT 0,
  generated     integer NOT NULL DEFAULT 0,
  question_ids  jsonb   NOT NULL DEFAULT '[]'::jsonb,
  note          text,
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qfb_competency ON question_factory_batches (competency_id);
CREATE INDEX IF NOT EXISTS idx_qfb_created_at ON question_factory_batches (created_at DESC);

-- Conservative one-time provenance backfill for pre-existing rows (additive metadata only;
-- never touches question content). Re-runnable: only fills NULLs.
UPDATE competency_question_templates SET provenance =
  CASE source
    WHEN 'manual'    THEN 'human_authored'
    WHEN 'seed'      THEN 'imported'
    WHEN 'generated' THEN 'template_generated'
    ELSE 'human_authored'
  END
WHERE provenance IS NULL;

-- Pre-existing rows already have a lifecycle `status`; mirror it onto quality_review_status so
-- the review dashboard is complete (approved→approved, draft→pending_review, etc.).
UPDATE competency_question_templates SET quality_review_status =
  CASE status
    WHEN 'approved' THEN 'approved'
    WHEN 'rejected' THEN 'rejected'
    WHEN 'archived' THEN 'rejected'
    ELSE 'pending_review'
  END
WHERE quality_review_status IS NULL;
