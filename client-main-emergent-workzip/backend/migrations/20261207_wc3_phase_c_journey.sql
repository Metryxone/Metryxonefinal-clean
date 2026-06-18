-- CAPADEX WC-3 Phase C — L3 Journey Intelligence (canonical migration).
--
-- Strictly ADDITIVE + REVERSIBLE. Mirrors the lazy `ensureWc3JourneySchema()` in
-- backend/services/wc3/wc3-schema.ts (this repo has no migration runner). Composes
-- L1 Stage + L2 Outcome into a per-session ROUTE recommendation across the supported
-- products (LBI, Career Builder, Employability Index, Competitive Exam Intelligence,
-- Mentoring). No existing table is mutated; no ontology / signal / concern data is
-- touched; no score is recomputed.
--
-- Business invariants enforced in the schema:
--   • wc3_journey_state.primary_route NOT NULL → a session is never persisted
--     without a route ("no concern terminates without a route").
--   • the Competitive Exam route ships corpus_status='corpus_pending' so it can still
--     be routed under a LOW_CONFIDENCE / CORPUS_PENDING band.
--
-- Reverse (full removal, no residue in existing tables):
--   DROP TABLE IF EXISTS wc3_journey_candidates;
--   DROP TABLE IF EXISTS wc3_journey_state;
--   DROP TABLE IF EXISTS wc3_journey_routes;

CREATE TABLE IF NOT EXISTS wc3_journey_routes (
  route_key        text PRIMARY KEY,
  display_label    text NOT NULL,
  product_key      text NOT NULL,
  product_label    text NOT NULL,
  product_path     text,
  model_affinities jsonb NOT NULL DEFAULT '{}',
  corpus_status    text NOT NULL DEFAULT 'ready',
  is_fallback      boolean NOT NULL DEFAULT false,
  fallback_priority integer NOT NULL DEFAULT 100,
  description      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wc3_journey_state (
  id                          bigserial PRIMARY KEY,
  session_id                  uuid NOT NULL,
  user_email                  text,
  user_id                     uuid,
  primary_route               text NOT NULL REFERENCES wc3_journey_routes(route_key),
  secondary_route             text REFERENCES wc3_journey_routes(route_key),
  route_confidence            numeric NOT NULL DEFAULT 0,
  confidence_band             text NOT NULL DEFAULT 'LOW_CONFIDENCE',
  route_reason                text,
  expected_outcome_key        text,
  expected_outcome            text,
  expected_stage_current      text,
  expected_stage_desired      text,
  expected_stage_advancement  text,
  product_key                 text NOT NULL,
  product_label               text,
  product_path                text,
  contributing_models         text[] NOT NULL DEFAULT '{}',
  degraded                    boolean NOT NULL DEFAULT false,
  status                      text NOT NULL DEFAULT 'routed',
  resolved_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS wc3_journey_candidates (
  id                  bigserial PRIMARY KEY,
  journey_state_id    bigint NOT NULL REFERENCES wc3_journey_state(id) ON DELETE CASCADE,
  session_id          uuid NOT NULL,
  route_key           text NOT NULL REFERENCES wc3_journey_routes(route_key),
  fit_score           numeric NOT NULL DEFAULT 0,
  corpus_status       text,
  contributing_models text[] NOT NULL DEFAULT '{}',
  rank                integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc3_journey_state_session ON wc3_journey_state(session_id);
CREATE INDEX IF NOT EXISTS idx_wc3_journey_state_email   ON wc3_journey_state(user_email);
CREATE INDEX IF NOT EXISTS idx_wc3_journey_cand_state    ON wc3_journey_candidates(journey_state_id);
CREATE INDEX IF NOT EXISTS idx_wc3_journey_cand_session  ON wc3_journey_candidates(session_id);

-- Seed the 5 supported routes. model_affinities reference the L2 outcome-model
-- vocabulary (wc3_outcome_models.model_key) so route fit derives only from REAL
-- activated outcome models. Competitive Exam is corpus_pending; Mentoring is the
-- deterministic universal fallback (lowest fallback_priority).
INSERT INTO wc3_journey_routes
  (route_key, display_label, product_key, product_label, product_path, model_affinities, corpus_status, is_fallback, fallback_priority, description) VALUES
  ('lbi', 'LBI', 'lbi', 'LBI Behavioural Intelligence', '/lbi',
    '{"confidence_stability":0.85,"decision_quality":0.75,"career_clarity":0.30,"learning_effectiveness":0.30}'::jsonb,
    'ready', false, 30, 'Behavioural / life intelligence development pathway.'),
  ('career_builder', 'Career Builder', 'career_builder', 'Career Builder', '/career-builder',
    '{"career_clarity":0.90,"employability_readiness":0.70,"decision_quality":0.50,"learning_effectiveness":0.40}'::jsonb,
    'ready', false, 20, 'Career direction, planning and next-step building pathway.'),
  ('employability_index', 'Employability Index', 'employability_index', 'Employability Index', '/employability-index',
    '{"employability_readiness":0.90,"career_clarity":0.50,"confidence_stability":0.30}'::jsonb,
    'ready', false, 40, 'Employability skills and readiness measurement pathway.'),
  ('competitive_exam', 'Competitive Exam Intelligence', 'competitive_exam', 'Competitive Exam Intelligence', '/exam-intelligence',
    '{"exam_readiness":0.90,"learning_effectiveness":0.70,"confidence_stability":0.30}'::jsonb,
    'corpus_pending', false, 50, 'Competitive-exam preparation pathway (corpus expanding).'),
  ('mentoring', 'Mentoring', 'mentoring', 'Mentoring', '/mentors',
    '{"confidence_stability":0.60,"career_clarity":0.40,"decision_quality":0.40,"employability_readiness":0.40,"learning_effectiveness":0.40,"exam_readiness":0.40}'::jsonb,
    'ready', true, 0, 'Universal human-mentoring pathway — the deterministic fallback so no concern terminates without a route.')
ON CONFLICT (route_key) DO NOTHING;
