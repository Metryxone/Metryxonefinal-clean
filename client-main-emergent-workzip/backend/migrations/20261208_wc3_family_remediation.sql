-- WC-3 Route Coverage Remediation (user-approved follow-up to the WC-3 audit).
-- Closes the FAMILY_DYNAMICS coverage gap identified in
-- backend/audit/wc-3/WC3_ROUTE_COVERAGE_AUDIT.md.
--
-- Strictly additive + idempotent. Mirrors the seeds in
-- services/wc3/wc3-schema.ts (ensureWc3OutcomeSchema / ensureWc3JourneySchema).
-- No existing model/route row is destructively mutated; the only UPDATE merges a
-- single new affinity key into the universal Mentoring fallback. All effects are
-- gated behind FF_WC3_OUTCOME / FF_WC3_JOURNEY at read time → byte-identical when OFF.

-- 1) New outcome model: Family Wellbeing.
--    construct_keys=[FAMILY_DYNAMICS], which has real intervention_library rows, so
--    the model both activates AND supplies library-backed actions (never fabricated).
INSERT INTO wc3_outcome_models (model_key, display_label, anchor, construct_keys, gated, description, composition_spec) VALUES
  ('family_wellbeing', 'Family Wellbeing', 'l1_stage',
    ARRAY['FAMILY_DYNAMICS'],
    false, 'Quality of family communication, parenting patterns, and home environment.',
    '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}')
ON CONFLICT (model_key) DO NOTHING;

-- 2) New journey route: Family & Parenting Support.
--    No standalone family/parenting product exists, so this maps to the EXISTING,
--    ready Mentoring product (/mentors) as its real destination — no new product
--    is invented. is_fallback=false so FAMILY_DYNAMICS now routes to a real
--    (non-degraded) pathway instead of the universal fallback.
INSERT INTO wc3_journey_routes
  (route_key, display_label, product_key, product_label, product_path, model_affinities, corpus_status, is_fallback, fallback_priority, description) VALUES
  ('family_support', 'Family & Parenting Support', 'mentoring', 'Mentoring', '/mentors',
    '{"family_wellbeing":0.90}'::jsonb,
    'ready', false, 25, 'Family communication & parenting support pathway, served by the Mentoring product.')
ON CONFLICT (route_key) DO NOTHING;

-- 3) Let the universal Mentoring fallback acknowledge the new family model
--    (additive key merge; idempotent — only applied when the key is absent).
UPDATE wc3_journey_routes
   SET model_affinities = model_affinities || '{"family_wellbeing":0.40}'::jsonb
 WHERE route_key = 'mentoring'
   AND NOT (model_affinities ? 'family_wellbeing');
