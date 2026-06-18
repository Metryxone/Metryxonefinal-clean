-- Phase 3 seed — idempotent. Derives transferability and adjacency
-- programmatically from the Phase 1 ontology so the engine has data to read.

BEGIN;

-- ---- Capability maturity (5 levels for every competency) ------------------
INSERT INTO mobility_capability_maturity (competency_id, level, level_name, score_anchor, behavioural_anchors, est_weeks_from_prior)
SELECT c.id, lvl,
  CASE lvl WHEN 1 THEN 'Foundational' WHEN 2 THEN 'Developing'
           WHEN 3 THEN 'Proficient'   WHEN 4 THEN 'Advanced'
           ELSE 'Expert' END,
  CASE lvl WHEN 1 THEN 30 WHEN 2 THEN 50 WHEN 3 THEN 65 WHEN 4 THEN 80 ELSE 92 END,
  jsonb_build_array(
    CASE lvl WHEN 1 THEN 'Demonstrates basic awareness of ' || c.canonical_name
             WHEN 2 THEN 'Applies ' || c.canonical_name || ' in routine, guided contexts'
             WHEN 3 THEN 'Consistently applies ' || c.canonical_name || ' across familiar contexts'
             WHEN 4 THEN 'Adapts ' || c.canonical_name || ' to novel and ambiguous contexts'
             ELSE        'Coaches others; sets organisational standards for ' || c.canonical_name END
  ),
  CASE lvl WHEN 1 THEN 0 WHEN 2 THEN 6 WHEN 3 THEN 10 WHEN 4 THEN 16 ELSE 24 END
FROM onto_competencies c, generate_series(1,5) AS lvl
ON CONFLICT (competency_id, level) DO NOTHING;

-- ---- Transferability map (derived from family / domain proximity) ---------
-- Score rubric:
--   same id            → 1.00  identical
--   same family        → 0.85  direct
--   same domain        → 0.55  analogous
--   share stability    → 0.40  foundational
--   else               → 0.20  unrelated
INSERT INTO mobility_transferability_maps
  (source_competency_id, target_competency_id, transferability_score, transfer_type, rationale, basis)
SELECT a.id, b.id,
  CASE
    WHEN a.id = b.id                       THEN 1.00
    WHEN a.family_id = b.family_id         THEN 0.85
    WHEN a.domain_id = b.domain_id         THEN 0.55
    WHEN a.stability_level = b.stability_level THEN 0.40
    ELSE 0.20 END,
  CASE
    WHEN a.id = b.id                       THEN 'identical'
    WHEN a.family_id = b.family_id         THEN 'direct'
    WHEN a.domain_id = b.domain_id         THEN 'analogous'
    WHEN a.stability_level = b.stability_level THEN 'foundational'
    ELSE 'unrelated' END,
  CASE
    WHEN a.id = b.id                       THEN 'Identical competency'
    WHEN a.family_id = b.family_id         THEN 'Same family — strong direct transfer'
    WHEN a.domain_id = b.domain_id         THEN 'Same domain — analogous reasoning patterns'
    WHEN a.stability_level = b.stability_level THEN 'Similar trait stability profile'
    ELSE 'Distinct domain and stability profile' END,
  jsonb_build_object(
    'same_family', a.family_id = b.family_id,
    'same_domain', a.domain_id = b.domain_id,
    'complexity_delta', (b.complexity_level - a.complexity_level)
  )
FROM onto_competencies a CROSS JOIN onto_competencies b
ON CONFLICT (source_competency_id, target_competency_id) DO NOTHING;

-- ---- Role transitions (derived from ontology family/layer/seniority) -----
-- Seeded explicitly for the five canonical roles.
INSERT INTO mobility_role_transitions
  (from_role_id, to_role_id, transition_type, difficulty, typical_duration_months, frequency_band, notes)
VALUES
  ('role_be_eng',       'role_sr_be_eng',     'vertical',         'moderate',  18, 'common',   'IC growth within engineering ladder'),
  ('role_sr_be_eng',    'role_eng_manager',   'vertical',         'high',      24, 'common',   'IC to people-manager transition — leadership cluster opens'),
  ('role_be_eng',       'role_pm',            'cross_functional', 'high',      18, 'uncommon', 'Engineering to product — stakeholder & strategy gap'),
  ('role_sr_be_eng',    'role_pm',            'cross_functional', 'moderate',  12, 'common',   'Senior IC pivot to product is well-trodden'),
  ('role_eng_manager',  'role_pm',            'lateral',          'moderate',  9,  'common',   'Cross-functional move; leadership overlaps'),
  ('role_pm',           'role_eng_manager',   'cross_functional', 'high',      24, 'uncommon', 'PM to engineering management requires technical re-grounding'),
  ('role_credit_analyst','role_pm',           'cross_industry',   'intensive', 24, 'rare',     'Financial services to tech product — large industry gap'),
  ('role_be_eng',       'role_eng_manager',   'vertical',         'intensive', 36, 'uncommon', 'Skip-level leap; typically goes via Senior')
ON CONFLICT (from_role_id, to_role_id) DO NOTHING;

-- ---- Adjacent role mappings (programmatic, both directions) ---------------
INSERT INTO mobility_adjacent_role_mappings (role_id, adjacent_role_id, adjacency_score, basis)
SELECT r1.id, r2.id,
  ROUND((
      (CASE WHEN r1.role_family_id = r2.role_family_id THEN 0.45 ELSE 0 END)
    + (CASE WHEN r1.layer_id       = r2.layer_id       THEN 0.25 ELSE 0 END)
    + (CASE WHEN r1.seniority      = r2.seniority      THEN 0.15 ELSE 0 END)
    + 0.15  -- baseline ontology connectedness
  )::numeric, 2),
  jsonb_build_object(
    'same_role_family', r1.role_family_id = r2.role_family_id,
    'same_layer',       r1.layer_id = r2.layer_id,
    'same_seniority',   r1.seniority IS NOT DISTINCT FROM r2.seniority
  )
FROM onto_roles r1 CROSS JOIN onto_roles r2
WHERE r1.id <> r2.id
ON CONFLICT (role_id, adjacent_role_id) DO NOTHING;

-- ---- Development pathways + learning sequences ---------------------------
INSERT INTO mobility_development_pathways (id, name, description, terminal_competency_id, total_weeks, difficulty, category) VALUES
  ('path_leadership_presence', 'Leadership Presence',
   'From self-regulation to inspiring conflict-positive teams.',
   'comp_coaching', 32, 'high', 'leadership'),
  ('path_strategic_alignment', 'Strategic Alignment',
   'From systemic awareness to organisation-wide strategic thinking.',
   'comp_strategic_thinking', 28, 'high', 'strategic'),
  ('path_execution_resilience', 'Execution Resilience',
   'From accountability to composed delivery under pressure.',
   'comp_emotional_regulation', 20, 'moderate', 'execution'),
  ('path_stakeholder_influence', 'Stakeholder Influence',
   'From listening to multi-stakeholder persuasion.',
   'comp_persuasion', 24, 'moderate', 'interpersonal'),
  ('path_learning_engine',     'Adaptive Learning Engine',
   'From adaptability to strategic learning agility.',
   'comp_learning_agility', 22, 'moderate', 'cognitive')
ON CONFLICT (id) DO NOTHING;

INSERT INTO mobility_learning_sequences (pathway_id, position, competency_id, action, est_weeks, resource_type, target_level) VALUES
  ('path_leadership_presence', 1, 'comp_emotional_regulation', 'Build daily emotional check-ins; recognise triggers', 8,  'reflection', 3),
  ('path_leadership_presence', 2, 'comp_active_listening',     'Practice reflective listening in 1:1s; reduce interruption rate', 6, 'practice',   3),
  ('path_leadership_presence', 3, 'comp_conflict_resolution',  'Facilitate 3 team disagreements without prescribing outcome',     10,'coaching',   3),
  ('path_leadership_presence', 4, 'comp_coaching',             'Hold 6 coaching conversations with developmental framing',        8, 'practice',   4),

  ('path_strategic_alignment', 1, 'comp_systems_thinking',     'Map the systems your role participates in; identify leverage points', 8, 'reflection', 3),
  ('path_strategic_alignment', 2, 'comp_stakeholder_mgmt',     'Identify and align with 5 strategic stakeholders quarterly',         8, 'practice',   3),
  ('path_strategic_alignment', 3, 'comp_strategic_thinking',   'Propose a 12-month strategic narrative tied to organisational goals',12, 'project',    4),

  ('path_execution_resilience',1, 'comp_accountability',       'Set weekly outcome commitments with public review',                  4, 'practice',   3),
  ('path_execution_resilience',2, 'comp_adaptability',         'Run 2 retros on plan changes; capture what shifted and why',         6, 'reflection', 3),
  ('path_execution_resilience',3, 'comp_emotional_regulation', 'Apply pre-meeting regulation rituals for 8 weeks',                  10, 'practice',   3),

  ('path_stakeholder_influence',1,'comp_active_listening',      'Capture stakeholder concerns verbatim before responding',           6, 'practice',   3),
  ('path_stakeholder_influence',2,'comp_stakeholder_mgmt',      'Build a stakeholder map with cadence and influence vectors',        8, 'project',    3),
  ('path_stakeholder_influence',3,'comp_persuasion',            'Run 3 cross-team alignment cycles; document approach + outcome',   10, 'coaching',   4),

  ('path_learning_engine',     1, 'comp_adaptability',          'Adopt one new operating tool monthly; reflect on integration',      6, 'practice',   3),
  ('path_learning_engine',     2, 'comp_learning_agility',      'Run quarterly skill audit + 1 stretch project outside your domain',16, 'project',    4)
ON CONFLICT (pathway_id, position) DO NOTHING;

-- ---- Curated career paths ------------------------------------------------
INSERT INTO mobility_career_paths (id, name, description, sequence, typical_duration_months, difficulty) VALUES
  ('cp_eng_leadership',  'Engineering Leadership Track',
   'IC engineering → Senior IC → Engineering Manager.',
   '["rf_backend_engineer","rf_backend_engineer","rf_backend_engineer"]'::jsonb, 42, 'high'),
  ('cp_eng_to_product',  'Engineering to Product Track',
   'Engineering IC → Product Manager via cross-functional stretch.',
   '["rf_backend_engineer","rf_product_manager"]'::jsonb, 18, 'moderate'),
  ('cp_finance_to_tech', 'Finance to Tech Product Track',
   'Financial services analyst → Tech PM via strategic + stakeholder uplift.',
   '["rf_credit_analyst","rf_product_manager"]'::jsonb, 30, 'intensive')
ON CONFLICT (id) DO NOTHING;

COMMIT;
