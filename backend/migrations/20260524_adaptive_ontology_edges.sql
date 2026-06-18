-- Adaptive Ontology Edges — concern-bucket correlation matrix.
-- Powers the OR-join in `pickQuestionsFromDB` so a user with primary concern
-- bucket X also surfaces approved questions from highly-correlated target
-- buckets (weight >= 0.60, status = 'approved').
--
-- Column default for `status` is 'approved' so seed/manual SQL is immediately
-- live; the admin POST endpoint explicitly inserts 'draft' (Draft → Approved
-- workflow, same pattern as competency_question_templates and
-- adaptive_question_bank).

CREATE TABLE IF NOT EXISTS adaptive_ontology_edges (
  id              SERIAL PRIMARY KEY,
  source_bucket   VARCHAR(50)  NOT NULL,
  target_bucket   VARCHAR(50)  NOT NULL,
  weight          NUMERIC(3,2) NOT NULL DEFAULT 0.50,
  status          VARCHAR(20)  NOT NULL DEFAULT 'approved',
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT adaptive_ontology_edges_weight_range CHECK (weight >= 0.00 AND weight <= 1.00),
  CONSTRAINT adaptive_ontology_edges_no_self_loop CHECK (source_bucket <> target_bucket)
);

CREATE INDEX IF NOT EXISTS idx_adaptive_ontology_edges_source
  ON adaptive_ontology_edges (source_bucket);

-- Composite index for the runtime join: filters on (source, status, weight).
CREATE INDEX IF NOT EXISTS idx_adaptive_ontology_edges_runtime
  ON adaptive_ontology_edges (source_bucket, status, weight);
