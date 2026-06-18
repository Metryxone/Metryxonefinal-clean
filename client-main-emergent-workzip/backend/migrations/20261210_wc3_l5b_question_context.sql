-- CAPADEX WC-3 L5B — Question Context Intelligence (Question Intelligence 2.0, Phase 2).
--
-- Additive, reversible. A single sidecar index that stamps each clarity question with a
-- derived life-CONTEXT axis (Primary + Secondary context + confidence + an explicitness
-- flag + a relevance-risk flag), computed from existing data only: a tightened, sense-
-- disambiguated question lexicon corroborated by the joined concern `domain`, the bridge
-- tag, and the `common_indian_context` phrase. No existing table is mutated; no ontology /
-- signal / concern data is touched. Populating this table changes NO runtime behaviour
-- (nothing reads it yet) so the app is byte-identical whether the `wc3ContextIntel` flag
-- is ON or OFF.
--
-- Honesty contract (mirrors the approved audit WC3_L5B_CONTEXT_INTELLIGENCE.md): ~80% of
-- the clarity bank is legitimately context-neutral and is stamped `GENERAL` rather than
-- force-tagged; genuinely ambiguous / low-signal rows are stamped `UNRESOLVED`. Context is
-- NEVER fabricated.
--
-- Keyed by the clarity SERIAL `id` (NOT `question_id`, which is reused across different
-- questions — see clarity-xlsx-import-quality lesson). Reversible:
-- `DROP TABLE wc3_question_context;`
--
-- This file is the canonical mirror of `ensureWc3QuestionContextSchema()` in
-- `backend/services/wc3/wc3-schema.ts` (this repo has no migration runner).

CREATE TABLE IF NOT EXISTS wc3_question_context (
  clarity_id           integer PRIMARY KEY,
  question_id          text,
  source               text NOT NULL DEFAULT 'clarity',
  primary_context      text,
  secondary_context    text,
  context_confidence   numeric NOT NULL DEFAULT 0,
  context_band         text NOT NULL DEFAULT 'GENERAL',
  context_explicit     boolean NOT NULL DEFAULT false,
  relevance_risk       text NOT NULL DEFAULT 'NONE',
  coverage             numeric NOT NULL DEFAULT 0,
  context_distribution jsonb NOT NULL DEFAULT '{}',
  signals_used         jsonb NOT NULL DEFAULT '{}',
  computed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc3_qc_primary_context ON wc3_question_context (primary_context);
CREATE INDEX IF NOT EXISTS idx_wc3_qc_band ON wc3_question_context (context_band);
CREATE INDEX IF NOT EXISTS idx_wc3_qc_risk ON wc3_question_context (relevance_risk);
