-- Phase 5 seed — governance workflows + methodology registry + succession + capability rollups
BEGIN;
SELECT setseed(0.7373);

-- governance workflows
INSERT INTO gov_workflows (id, name, entity_type, steps) VALUES
  ('wf_ontology_competency', 'Competency Add/Modify Review', 'ontology_competency',
    '[{"step":"propose","required_role":"author"},{"step":"science_review","required_role":"science_lead"},{"step":"governance_approval","required_role":"governance"},{"step":"publish","required_role":"governance"}]'::jsonb),
  ('wf_ontology_role', 'Role Definition Review', 'ontology_role',
    '[{"step":"propose","required_role":"author"},{"step":"role_council","required_role":"role_council"},{"step":"governance_approval","required_role":"governance"}]'::jsonb),
  ('wf_benchmark_methodology', 'Benchmark Methodology Change Review', 'benchmark_methodology',
    '[{"step":"propose","required_role":"science"},{"step":"validation","required_role":"science_lead"},{"step":"governance_approval","required_role":"governance"}]'::jsonb),
  ('wf_role_dna', 'Role DNA Weighting Update', 'role_dna',
    '[{"step":"propose","required_role":"science"},{"step":"calibration_review","required_role":"calibration"},{"step":"governance_approval","required_role":"governance"}]'::jsonb),
  ('wf_weighting_policy', 'Weighting Policy Update', 'weighting_policy',
    '[{"step":"propose","required_role":"science"},{"step":"impact_analysis","required_role":"science_lead"},{"step":"governance_approval","required_role":"governance"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- methodology versions registry
INSERT INTO gov_methodology_versions (id, methodology_name, version, change_summary, approved_by, approved_at, references_doc) VALUES
  ('mv_ontology_1', 'ontology', '1.0.0', 'Baseline competency ontology (Phase 1)', 'governance', now() - interval '60 days', 'docs/methodology/ontology_v1.md'),
  ('mv_benchmark_2', 'benchmark', '2.0.0', 'Empirical percentile + Wilson 95% CI (Phase 2)', 'governance', now() - interval '45 days', 'docs/methodology/benchmark_v2.md'),
  ('mv_weighting_2', 'weighting', '2.0.0', 'Context-modifier weighting (Phase 2)', 'governance', now() - interval '45 days', 'docs/methodology/weighting_v2.md'),
  ('mv_mobility_3', 'mobility', '3.0.0', 'Mobility composite + transferability matrix (Phase 3)', 'governance', now() - interval '20 days', 'docs/methodology/mobility_v3.md'),
  ('mv_trajectory_4', 'trajectory', '4.0.0', 'Conservative trajectory bands + EWMA velocity (Phase 4)', 'governance', now() - interval '5 days', 'docs/methodology/trajectory_v4.md'),
  ('mv_recommendation_4', 'recommendation', '4.0.0', 'Adaptive recommendation engine (Phase 4)', 'governance', now() - interval '5 days', 'docs/methodology/recommendation_v4.md'),
  ('mv_explainability_5', 'explainability', '5.0.0', 'Per-score contributor decomposition (Phase 5)', 'governance', now(), 'docs/methodology/explainability_v5.md')
ON CONFLICT (id) DO NOTHING;

-- sample pending ontology review
INSERT INTO gov_ontology_reviews (id, workflow_id, entity_type, entity_id, proposer, status, change_diff, rationale) VALUES
  ('rev_001', 'wf_ontology_competency', 'ontology_competency', 'comp_coaching', 'demo_author',
   'pending', '{"field":"weight_modifier","old":1.0,"new":1.15}'::jsonb,
   'Coaching weight increase reflects emerging leadership pipeline emphasis'),
  ('rev_002', 'wf_role_dna', 'role_dna', 'role_eng_manager', 'demo_science',
   'pending', '{"weights":{"comp_systems_thinking":"+0.05","comp_coaching":"+0.03"}}'::jsonb,
   'Calibration drift detected in Q1 benchmark snapshot')
ON CONFLICT (id) DO NOTHING;

-- workforce intelligence rollups by layer
INSERT INTO p5_workforce_intelligence (id, tenant_id, dimension, metric, value, band, period)
SELECT
  'wi_layer_' || l.id || '_cap',
  'global',
  'layer',
  'capability_density',
  GREATEST(35, LEAST(85, 50 + l.display_order*3 + 8*(random()-0.5)))::numeric(12,3),
  CASE WHEN l.display_order >= 4 THEN 'strategic'
       WHEN l.display_order >= 2 THEN 'operational'
       ELSE 'foundational' END,
  now()::date
FROM onto_layers l
ON CONFLICT (id) DO NOTHING;

INSERT INTO p5_workforce_intelligence (id, tenant_id, dimension, metric, value, band, period) VALUES
  ('wi_leadership_pipeline', 'global', 'enterprise', 'leadership_pipeline_health', 64.2, 'developing', now()::date),
  ('wi_succession_coverage', 'global', 'enterprise', 'succession_coverage_pct', 41.8, 'progressing', now()::date),
  ('wi_strategic_capability', 'global', 'enterprise', 'strategic_capability_density', 49.5, 'progressing', now()::date),
  ('wi_mobility_velocity', 'global', 'enterprise', 'mobility_velocity_index', 38.7, 'developing', now()::date),
  ('wi_capability_freshness', 'global', 'enterprise', 'capability_data_freshness_days', 7, 'aligned', now()::date)
ON CONFLICT (id) DO NOTHING;

-- organizational capabilities — capability index per layer × competency
INSERT INTO p5_organizational_capabilities
  (id, tenant_id, layer_id, function_id, competency_id, capability_index, maturity_distribution, gap_indicator)
SELECT
  'oc_' || md5(l.id || c.id),
  'global',
  l.id,
  NULL,
  c.id,
  GREATEST(30, LEAST(90, 48 + l.display_order*4 + 10*(random()-0.5)))::numeric(5,2),
  jsonb_build_object(
    'level_1', (8 + (random()*10)::int),
    'level_2', (18 + (random()*12)::int),
    'level_3', (28 + (random()*12)::int),
    'level_4', (18 + (random()*12)::int),
    'level_5', (8 + (random()*10)::int)
  ),
  CASE WHEN random() < 0.25 THEN 'strategic_gap'
       WHEN random() < 0.55 THEN 'development_opportunity'
       ELSE 'aligned' END
FROM onto_layers l CROSS JOIN onto_competencies c
ON CONFLICT (id) DO NOTHING;

-- enterprise analytics snapshot
INSERT INTO p5_enterprise_analytics (id, tenant_id, snapshot_name, payload, freshness_days) VALUES
  ('ea_global_overview', 'global', 'enterprise_overview',
   '{"headline":{"workforce_size":540,"data_freshness_days":7,"capability_data_completeness":0.91},"top_strengths":[{"competency":"Systems Thinking","index":68},{"competency":"Stakeholder Management","index":64}],"top_gaps":[{"competency":"Strategic Storytelling","index":42},{"competency":"Capital Allocation","index":39}],"trend":{"capability_index_30d":1.8,"succession_coverage_30d":2.4}}'::jsonb,
   2)
ON CONFLICT (id) DO NOTHING;

-- succession models — sample developmental readiness rows for 5 demo users × 3 target roles
WITH du AS (SELECT unnest(ARRAY['demo_user_alpha','demo_user_beta','demo_user_gamma','demo_user_delta','demo_user_epsilon']) AS user_id),
     tr AS (SELECT id AS role_id FROM onto_roles WHERE id IN ('role_eng_manager','role_sr_be_eng','role_pm'))
INSERT INTO p5_succession_models
  (id, user_id, target_role_id, readiness_band, readiness_score, contributing_strengths, development_gaps, recommended_horizon_months)
SELECT
  'sm_' || md5(du.user_id || tr.role_id),
  du.user_id,
  tr.role_id,
  CASE WHEN s.s >= 75 THEN 'developmentally_ready'
       WHEN s.s >= 60 THEN 'aligned'
       WHEN s.s >= 45 THEN 'progressing'
       ELSE 'developing' END,
  s.s,
  '[{"competency":"Systems Thinking"},{"competency":"Stakeholder Management"}]'::jsonb,
  '[{"competency":"Strategic Storytelling","gap":18},{"competency":"Capital Allocation","gap":14}]'::jsonb,
  CASE WHEN s.s >= 70 THEN 6 WHEN s.s >= 55 THEN 12 ELSE 18 END
FROM du CROSS JOIN tr
CROSS JOIN LATERAL (SELECT (35 + random()*55)::numeric(5,2) AS s) s
ON CONFLICT (id) DO NOTHING;

COMMIT;
