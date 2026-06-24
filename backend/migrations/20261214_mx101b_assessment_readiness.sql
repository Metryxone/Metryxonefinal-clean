-- MX-101B — Assessment Readiness Acceleration.
-- Mirrors the lazy ensure-schema in:
--   services/question-certification.ts  (question_certifications)
--   services/review-workbench.ts        (qf_review_audit)
--   services/assessment-readiness.ts    (qf_coverage_snapshots)
-- ADDITIVE & reversible. With the `assessmentReadiness` flag OFF the lazy ensure-schema is never
-- reached, so applying this migration is OPTIONAL — it only pre-creates the same tables. The
-- application path never depends on this file having run (there is no migration runner).

CREATE TABLE IF NOT EXISTS question_certifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id      uuid NOT NULL,
  competency_id    varchar(80),
  cert_version     text NOT NULL,
  cert_score       numeric NOT NULL,
  cert_status      text NOT NULL,
  structural_score numeric NOT NULL,
  heuristic_score  numeric NOT NULL,
  dimensions       jsonb NOT NULL DEFAULT '{}'::jsonb,
  certified_by     text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qcert_question ON question_certifications (question_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qcert_status ON question_certifications (cert_status);
CREATE INDEX IF NOT EXISTS idx_qcert_competency ON question_certifications (competency_id);

CREATE TABLE IF NOT EXISTS qf_review_audit (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           uuid,
  question_id        uuid NOT NULL,
  competency_id      varchar(80),
  action             text NOT NULL,
  prev_status        text,
  prev_review_status text,
  new_status         text,
  new_review_status  text,
  cert_status        text,
  reviewer_id        text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qfra_reviewer ON qf_review_audit (reviewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qfra_batch ON qf_review_audit (batch_id);
CREATE INDEX IF NOT EXISTS idx_qfra_question ON qf_review_audit (question_id, created_at DESC);

CREATE TABLE IF NOT EXISTS qf_coverage_snapshots (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at                   timestamptz NOT NULL DEFAULT now(),
  label                         text,
  total_competencies            int NOT NULL DEFAULT 0,
  draft_competencies            int NOT NULL DEFAULT 0,
  approved_competencies         int NOT NULL DEFAULT 0,
  base_ready_competencies       int NOT NULL DEFAULT 0,
  quality_assured_competencies  int NOT NULL DEFAULT 0,
  approved_questions            int NOT NULL DEFAULT 0,
  draft_questions               int NOT NULL DEFAULT 0,
  certified_questions           int NOT NULL DEFAULT 0,
  metrics                       jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_qfsnap_time ON qf_coverage_snapshots (captured_at);
