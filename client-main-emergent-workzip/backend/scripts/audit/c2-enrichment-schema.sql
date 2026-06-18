-- C-2 Question Semantic Enrichment — additive, reversible persistence.
-- Stores per-question Context + Archetype (the two dimensions C-1 found at 0% coverage).
-- ADDITIVE: original capadex_question_metadata and question text are never touched.
-- REVERSIBLE: DROP TABLE capadex_question_enrichment; -- fully reverts C-2.

CREATE TABLE IF NOT EXISTS capadex_question_enrichment (
  question_id          text PRIMARY KEY,
  master_bridge_tag    text,
  context_primary      text,         -- one of CONTEXTS or 'UNCLASSIFIED'
  context_secondary    text,         -- nullable
  context_confidence   numeric(4,3), -- 0 when UNCLASSIFIED
  context_source       text,         -- 'tag' | 'tag+text' | 'text' | 'none'
  archetype            text,         -- one of ARCHETYPES or 'UNCLASSIFIED'
  archetype_confidence numeric(4,3), -- 0 when UNCLASSIFIED
  archetype_source     text,         -- 'narrative_style' | 'narrative_style+text' | 'text' | 'response_type' | 'none'
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cqe_tag       ON capadex_question_enrichment (master_bridge_tag);
CREATE INDEX IF NOT EXISTS idx_cqe_archetype ON capadex_question_enrichment (archetype);
CREATE INDEX IF NOT EXISTS idx_cqe_context   ON capadex_question_enrichment (context_primary);
