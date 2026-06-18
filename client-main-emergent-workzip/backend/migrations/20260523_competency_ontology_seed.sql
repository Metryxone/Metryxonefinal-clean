-- ============================================================================
-- Phase 1 seed — canonical scientific reference data. Idempotent via
-- ON CONFLICT DO NOTHING so re-running is safe.
-- ============================================================================

-- ---- Capability Domains ----------------------------------------------------
INSERT INTO onto_domains (id, name, scientific_type, description, display_order) VALUES
  ('dom_cognitive',     'Cognitive Capabilities',                   'cognitive',     'Mental processing, reasoning, learning, judgment, and problem-solving capabilities.', 1),
  ('dom_behavioral',    'Behavioral Capabilities',                  'behavioral',    'Habitual patterns of conduct, self-regulation, resilience, and execution discipline.', 2),
  ('dom_interpersonal', 'Interpersonal & Leadership Capabilities',  'interpersonal', 'Interactional, influence, coaching, and people-leadership capabilities.', 3),
  ('dom_functional',    'Functional & Execution Capabilities',      'functional',    'Domain-specific delivery capabilities that operationalise work in a role.', 4),
  ('dom_strategic',     'Strategic & Organizational Capabilities',  'strategic',     'Enterprise-level visioning, systems thinking, and organisational alignment capabilities.', 5)
ON CONFLICT (id) DO NOTHING;

-- ---- Competency Families ---------------------------------------------------
INSERT INTO onto_families (id, domain_id, name, description, display_order) VALUES
  ('fam_communication',          'dom_interpersonal', 'Communication Family',           'Conveying, listening, and adapting information across audiences.', 1),
  ('fam_leadership',             'dom_interpersonal', 'Leadership Family',              'Directing, inspiring, and developing others toward shared goals.', 2),
  ('fam_execution',              'dom_behavioral',    'Execution Family',               'Translating intent into reliable, on-time delivery.', 3),
  ('fam_innovation',             'dom_cognitive',     'Innovation Family',              'Generating novel ideas and reframing problems.', 4),
  ('fam_strategic_reasoning',    'dom_strategic',     'Strategic Reasoning Family',     'Systems-level analysis, foresight, and option generation.', 5),
  ('fam_relationship_management','dom_interpersonal', 'Relationship Management Family', 'Building, sustaining, and repairing professional relationships.', 6),
  ('fam_learning_agility',       'dom_cognitive',     'Learning Agility Family',        'Acquiring, transferring, and applying new knowledge under change.', 7),
  ('fam_operational_excellence', 'dom_functional',    'Operational Excellence Family',  'Process discipline, quality, and continuous improvement.', 8),
  ('fam_governance_ethics',      'dom_strategic',     'Governance & Ethics Family',     'Integrity, accountability, and responsible stewardship.', 9),
  ('fam_stakeholder_influence',  'dom_interpersonal', 'Stakeholder Influence Family',   'Persuasion, alignment, and navigation across stakeholders.', 10)
ON CONFLICT (id) DO NOTHING;

-- ---- Proficiency Levels ----------------------------------------------------
INSERT INTO onto_proficiency_levels (level, label, description, behavioral_indicators_hint, complexity_expectation, role_applicability, developmental_expectation) VALUES
  (1, 'Awareness',                 'Recognises the competency exists and its basic meaning.',                  'Can describe; needs prompting to apply.',          'Low complexity, structured tasks.',         'Entry-level, learners.',                 'Build vocabulary and observation.'),
  (2, 'Basic Application',         'Applies the competency in routine, supervised situations.',                'Acts with guidance; replicates examples.',         'Moderate complexity, supported tasks.',     'Junior roles, supervised work.',         'Gain reps under coaching.'),
  (3, 'Independent Application',   'Applies the competency reliably without supervision.',                     'Acts independently; adapts to context.',           'Standard role complexity.',                 'Mid-level professional roles.',          'Deepen judgment via varied cases.'),
  (4, 'Advanced Application',      'Applies in ambiguous or high-stakes contexts; coaches others.',            'Models, coaches, adapts under pressure.',          'High complexity, cross-functional scope.',  'Senior individual contributors / managers.', 'Develop systems perspective.'),
  (5, 'Expert / Strategic Application', 'Shapes organisational practice; sets standards; teaches the field.', 'Sets standards, mentors at scale, defines norms.', 'Enterprise / multi-system complexity.',     'Leadership and strategic layers.',       'Influence the discipline itself.')
ON CONFLICT (level) DO NOTHING;

-- ---- Organizational Layers -------------------------------------------------
INSERT INTO onto_layers (id, name, display_order, capability_expectations, cognitive_complexity, behavioral_expectations, strategic_expectations, decision_scope, ambiguity_tolerance, leadership_accountability, minimum_score, median_score, high_performer_score, exceptional_score) VALUES
  ('layer_executive',  'Executive Layer',  1, 'Reliable task execution and procedural mastery.', 'Concrete, near-term.',  'Self-management, dependability, follow-through.', 'Apply standards to defined work.',          'Task and shift level.',          'Low — bounded ambiguity.',  'Self-accountable.',                       45, 58, 70, 82),
  ('layer_managerial', 'Managerial Layer', 2, 'Coordinate teams and processes across functions.', 'Multi-variable, monthly to quarterly.', 'Conflict handling, prioritisation, coaching.',    'Optimise team outcomes within strategy.',   'Team and process level.',        'Moderate — operational ambiguity.', 'Accountable for team outcomes.',        55, 65, 76, 86),
  ('layer_leadership', 'Leadership Layer', 3, 'Set direction, align teams, develop leaders.',     'Systems-level, annual horizon.',        'Influence, narrative, organisational empathy.',   'Shape function-wide priorities and bets.',  'Function / business unit level.','High — strategic ambiguity.', 'Accountable for function outcomes.',    65, 73, 82, 90),
  ('layer_strategic',  'Strategic Layer',  4, 'Shape enterprise direction and capability bets.',  'Enterprise, multi-year horizon.',       'Stewardship, governance, principled judgment.',   'Define enterprise strategy and posture.',   'Enterprise / market level.',     'Very high — open-ended ambiguity.', 'Accountable for enterprise outcomes.', 72, 80, 88, 94)
ON CONFLICT (id) DO NOTHING;

-- ---- Competencies (canonical, illustrative seed set) -----------------------
INSERT INTO onto_competencies (id, canonical_name, slug, domain_id, family_id, scientific_type, definition, trainability, stability_level, complexity_level, leadership_relevance, role_relevance, scoring_metadata, benchmark_metadata, legal_classification, version) VALUES
  ('comp_active_listening',    'Active Listening',     'active-listening',     'dom_interpersonal', 'fam_communication',           'behavioral', 'Fully concentrating, understanding, and reflecting back what is being said.',                       'high',     'state_like', 2, 0.70, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_accountability',      'Accountability',       'accountability',       'dom_behavioral',    'fam_execution',               'behavioral', 'Owning outcomes — both successes and failures — and following through on commitments.',             'moderate', 'trait_like', 2, 0.80, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_collaboration',       'Collaboration',        'collaboration',        'dom_interpersonal', 'fam_relationship_management', 'behavioral', 'Working effectively with others toward a shared outcome.',                                           'high',     'state_like', 2, 0.65, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_strategic_thinking',  'Strategic Thinking',   'strategic-thinking',   'dom_strategic',     'fam_strategic_reasoning',     'cognitive',  'Seeing the wider picture, anticipating implications, and choosing high-leverage paths.',            'moderate', 'trait_like', 4, 0.92, '{"leadership":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_persuasion',          'Persuasion',           'persuasion',           'dom_interpersonal', 'fam_stakeholder_influence',   'behavioral', 'Moving others to a position or action through evidence, narrative, and credibility.',                'moderate', 'state_like', 3, 0.78, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_emotional_regulation','Emotional Regulation', 'emotional-regulation', 'dom_behavioral',    'fam_execution',               'behavioral', 'Managing one''s own emotional responses, especially under pressure.',                                'moderate', 'trait_like', 3, 0.74, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_conflict_resolution', 'Conflict Resolution',  'conflict-resolution',  'dom_interpersonal', 'fam_leadership',              'behavioral', 'Constructively surfacing and resolving disagreements between people or groups.',                     'high',     'state_like', 3, 0.82, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_systems_thinking',    'Systems Thinking',     'systems-thinking',     'dom_strategic',     'fam_strategic_reasoning',     'cognitive',  'Understanding how parts interact across time to produce system-level behaviour.',                    'moderate', 'trait_like', 4, 0.88, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_learning_agility',    'Learning Agility',     'learning-agility',     'dom_cognitive',     'fam_learning_agility',        'cognitive',  'Acquiring, transferring, and applying new knowledge effectively under changing conditions.',         'moderate', 'trait_like', 3, 0.70, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_adaptability',        'Adaptability',         'adaptability',         'dom_cognitive',     'fam_learning_agility',        'behavioral', 'Adjusting behaviour and approach in response to changing context.',                                 'moderate', 'state_like', 3, 0.66, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_coaching',            'Coaching',             'coaching',             'dom_interpersonal', 'fam_leadership',              'behavioral', 'Developing others through structured feedback, questioning, and goal-setting.',                      'high',     'state_like', 3, 0.85, '{"leadership":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_stakeholder_mgmt',    'Stakeholder Management','stakeholder-management','dom_interpersonal','fam_stakeholder_influence',   'behavioral', 'Identifying, aligning, and sustaining productive relationships with stakeholders.',                  'moderate', 'state_like', 3, 0.80, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0'),
  ('comp_integrity',           'Integrity',            'integrity',            'dom_strategic',     'fam_governance_ethics',       'behavioral', 'Consistent alignment of words, actions, and stated values, especially under pressure.',              'low',      'trait_like', 4, 0.88, '{"all":1.0}'::jsonb, '{"scale":"0-100","reverse":false}'::jsonb, '{"k_anonymity_min":30}'::jsonb, 'developmental_aggregate', '1.0.0')
ON CONFLICT (id) DO NOTHING;

-- ---- Aliases (normalisation) -----------------------------------------------
INSERT INTO onto_aliases (competency_id, alias, alias_normalized, source) VALUES
  ('comp_active_listening',    'Listening Skills',          'listening skills',          'seed'),
  ('comp_active_listening',    'Careful Listening',         'careful listening',         'seed'),
  ('comp_accountability',      'Personal Accountability',   'personal accountability',   'seed'),
  ('comp_accountability',      'Ownership',                 'ownership',                 'seed'),
  ('comp_collaboration',       'Teamwork',                  'teamwork',                  'seed'),
  ('comp_collaboration',       'Team Collaboration',        'team collaboration',        'seed'),
  ('comp_strategic_thinking',  'Visionary Thinking',        'visionary thinking',        'seed'),
  ('comp_strategic_thinking',  'Big Picture Thinking',      'big picture thinking',      'seed'),
  ('comp_persuasion',          'Persuasion Skills',         'persuasion skills',         'seed'),
  ('comp_persuasion',          'Influencing',               'influencing',               'seed'),
  ('comp_emotional_regulation','Self Regulation',           'self regulation',           'seed'),
  ('comp_conflict_resolution', 'Conflict Management',       'conflict management',       'seed'),
  ('comp_systems_thinking',    'Holistic Thinking',         'holistic thinking',         'seed'),
  ('comp_learning_agility',    'Learning Aptitude',         'learning aptitude',         'seed'),
  ('comp_adaptability',        'Flexibility',               'flexibility',               'seed'),
  ('comp_coaching',            'Mentoring',                 'mentoring',                 'seed'),
  ('comp_stakeholder_mgmt',    'Stakeholder Engagement',    'stakeholder engagement',    'seed'),
  ('comp_integrity',           'Ethical Conduct',           'ethical conduct',           'seed')
ON CONFLICT (competency_id, alias_normalized) DO NOTHING;

-- ---- Behavioral Indicators (representative) --------------------------------
INSERT INTO onto_indicators (competency_id, indicator, proficiency_level, display_order) VALUES
  ('comp_active_listening',    'Paraphrases what was said before responding.',                   3, 1),
  ('comp_active_listening',    'Asks clarifying questions before reacting.',                     3, 2),
  ('comp_active_listening',    'Suspends judgment until the speaker is fully heard.',            4, 3),
  ('comp_accountability',      'Owns outcomes — both successes and failures — without blame.',   3, 1),
  ('comp_accountability',      'Surfaces risks early instead of hiding them.',                   4, 2),
  ('comp_collaboration',       'Shares context proactively with cross-functional partners.',     3, 1),
  ('comp_collaboration',       'Resolves friction without escalating prematurely.',              4, 2),
  ('comp_strategic_thinking',  'Connects daily decisions to long-term outcomes.',                3, 1),
  ('comp_strategic_thinking',  'Anticipates second- and third-order effects of choices.',        4, 2),
  ('comp_strategic_thinking',  'Reframes problems to reveal higher-leverage options.',           5, 3),
  ('comp_persuasion',          'Tailors evidence and framing to the audience.',                  3, 1),
  ('comp_persuasion',          'Builds coalitions before key decisions, not after.',             4, 2),
  ('comp_emotional_regulation','Pauses before responding when triggered.',                       3, 1),
  ('comp_emotional_regulation','Names own emotional state accurately under pressure.',           4, 2),
  ('comp_conflict_resolution', 'Surfaces disagreements early rather than letting them fester.',  3, 1),
  ('comp_conflict_resolution', 'Mediates between parties without taking sides prematurely.',     4, 2),
  ('comp_systems_thinking',    'Maps how decisions ripple across teams and time.',               4, 1),
  ('comp_learning_agility',    'Extracts transferable lessons from each new context.',           3, 1),
  ('comp_adaptability',        'Adjusts plan when new information invalidates the prior plan.',  3, 1),
  ('comp_coaching',            'Asks questions that unlock another person''s own insight.',      4, 1),
  ('comp_stakeholder_mgmt',    'Maps stakeholder interests before key decisions.',               3, 1),
  ('comp_integrity',           'Holds the line on principles under commercial pressure.',        5, 1)
ON CONFLICT DO NOTHING;

-- ---- Complexity calibration (by layer) -------------------------------------
INSERT INTO onto_complexity_models (competency_id, layer_id, expectation_summary, expected_min_level, expected_target) VALUES
  ('comp_active_listening', 'layer_executive',  'Hears and acknowledges task-level instructions accurately.',                 2, 3),
  ('comp_active_listening', 'layer_managerial', 'Coordinates across teams by reflecting and aligning what was heard.',        3, 4),
  ('comp_active_listening', 'layer_leadership', 'Listens for what is NOT said; reads organisational subtext.',                4, 4),
  ('comp_active_listening', 'layer_strategic',  'Synthesises listening across constituencies into enterprise narrative.',     4, 5),
  ('comp_strategic_thinking', 'layer_executive',  'Connects own work to immediate team goals.',                                 1, 2),
  ('comp_strategic_thinking', 'layer_managerial', 'Plans across quarters and balances trade-offs across the team.',            2, 3),
  ('comp_strategic_thinking', 'layer_leadership', 'Sets multi-year direction for a function and aligns bets accordingly.',     4, 5),
  ('comp_strategic_thinking', 'layer_strategic',  'Shapes enterprise strategy and category-level posture.',                    5, 5)
ON CONFLICT (competency_id, layer_id) DO NOTHING;

-- ---- Competency Relationships ----------------------------------------------
INSERT INTO onto_relationships (source_id, target_id, relationship_type, strength, notes) VALUES
  ('comp_emotional_regulation','comp_conflict_resolution','prerequisite_of', 0.80, 'Regulating self precedes resolving others'' conflicts.'),
  ('comp_conflict_resolution', 'comp_coaching',           'reinforces',      0.65, 'Coaches frequently handle interpersonal frictions.'),
  ('comp_systems_thinking',    'comp_strategic_thinking', 'prerequisite_of', 0.78, 'Systems perspective underpins strategic reframing.'),
  ('comp_learning_agility',    'comp_adaptability',       'reinforces',      0.70, 'Agile learners adapt faster in flux.'),
  ('comp_active_listening',    'comp_persuasion',         'depends_on',      0.72, 'Persuasion fails without accurate listening.'),
  ('comp_accountability',      'comp_integrity',          'reinforces',      0.66, 'Ownership and integrity co-vary.'),
  ('comp_stakeholder_mgmt',    'comp_persuasion',         'related_to',      0.68, 'Stakeholder management is persuasion at scale.')
ON CONFLICT (source_id, target_id, relationship_type) DO NOTHING;

-- ---- Workforce Taxonomy (sample IT → Engineering → Backend → Backend Eng) --
INSERT INTO onto_industries (id, name, description, display_order) VALUES
  ('ind_it',        'Information Technology', 'Software, infrastructure, and digital services industry.', 1),
  ('ind_financial', 'Financial Services',     'Banking, capital markets, insurance, and fintech.',        2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO onto_functions (id, industry_id, name, description, display_order) VALUES
  ('fn_it_engineering', 'ind_it',        'Engineering', 'Building and operating software systems.',        1),
  ('fn_it_product',     'ind_it',        'Product',     'Defining what to build and why.',                 2),
  ('fn_fs_risk',        'ind_financial', 'Risk',        'Risk identification, measurement, and control.',  1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO onto_subfunctions (id, function_id, name, description, display_order) VALUES
  ('sfn_backend_eng',    'fn_it_engineering', 'Backend Engineering',     'Server-side systems and APIs.',          1),
  ('sfn_frontend_eng',   'fn_it_engineering', 'Frontend Engineering',    'User-facing client applications.',       2),
  ('sfn_product_mgmt',   'fn_it_product',     'Product Management',      'Defining and shipping product outcomes.',1),
  ('sfn_credit_risk',    'fn_fs_risk',        'Credit Risk',             'Counterparty and portfolio credit risk.',1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO onto_role_families (id, subfunction_id, name, description, display_order) VALUES
  ('rf_backend_engineer',  'sfn_backend_eng',  'Backend Engineer',  'Designs and builds backend systems.',      1),
  ('rf_frontend_engineer', 'sfn_frontend_eng', 'Frontend Engineer', 'Designs and builds frontend systems.',     1),
  ('rf_product_manager',   'sfn_product_mgmt', 'Product Manager',   'Owns product outcomes end-to-end.',        1),
  ('rf_credit_analyst',    'sfn_credit_risk',  'Credit Analyst',    'Analyses credit risk on counterparties.',  1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO onto_roles (id, role_family_id, layer_id, title, seniority, description, display_order) VALUES
  ('role_be_eng',       'rf_backend_engineer',  'layer_executive',  'Backend Engineer',         'mid',    'Builds and maintains backend services.',                      1),
  ('role_sr_be_eng',    'rf_backend_engineer',  'layer_managerial', 'Senior Backend Engineer',  'senior', 'Senior backend engineer; mentors and owns subsystems.',       2),
  ('role_eng_manager',  'rf_backend_engineer',  'layer_leadership', 'Engineering Manager',      'lead',   'Leads a backend engineering team and outcomes.',              3),
  ('role_pm',           'rf_product_manager',   'layer_managerial', 'Product Manager',          'mid',    'Owns product area outcomes and roadmap.',                     1),
  ('role_credit_analyst','rf_credit_analyst',   'layer_executive',  'Credit Analyst',           'mid',    'Performs counterparty credit assessment and monitoring.',     1)
ON CONFLICT (role_family_id, title, seniority) DO NOTHING;

-- ---- Role DNA Profiles (one current per role) ------------------------------
INSERT INTO onto_dna_profiles (id, role_id, version, is_current, notes) VALUES
  ('dna_be_eng_v1',        'role_be_eng',         '1.0.0', TRUE, 'Initial DNA for Backend Engineer.'),
  ('dna_sr_be_eng_v1',     'role_sr_be_eng',      '1.0.0', TRUE, 'Initial DNA for Senior Backend Engineer.'),
  ('dna_eng_manager_v1',   'role_eng_manager',    '1.0.0', TRUE, 'Initial DNA for Engineering Manager.'),
  ('dna_pm_v1',            'role_pm',             '1.0.0', TRUE, 'Initial DNA for Product Manager.'),
  ('dna_credit_v1',        'role_credit_analyst', '1.0.0', TRUE, 'Initial DNA for Credit Analyst.')
ON CONFLICT (role_id, version) DO NOTHING;

-- ---- Role Competency Weights (normalised, sum target ≈ 1.0 within role) ----
INSERT INTO onto_role_weights (dna_profile_id, competency_id, weight, expected_level, rationale) VALUES
  ('dna_be_eng_v1',      'comp_systems_thinking',    0.20, 3, 'Backend work is system-shaped.'),
  ('dna_be_eng_v1',      'comp_collaboration',       0.18, 3, 'Cross-team API design and reviews.'),
  ('dna_be_eng_v1',      'comp_learning_agility',    0.16, 3, 'Tech stack evolves quickly.'),
  ('dna_be_eng_v1',      'comp_accountability',      0.16, 3, 'Owns on-call and incidents.'),
  ('dna_be_eng_v1',      'comp_active_listening',    0.12, 2, 'Requirements clarification.'),
  ('dna_be_eng_v1',      'comp_adaptability',        0.10, 3, 'Shifting priorities.'),
  ('dna_be_eng_v1',      'comp_emotional_regulation',0.08, 3, 'Incident calm under pressure.'),

  ('dna_sr_be_eng_v1',   'comp_systems_thinking',    0.22, 4, 'Subsystem ownership.'),
  ('dna_sr_be_eng_v1',   'comp_coaching',            0.18, 3, 'Mentors juniors.'),
  ('dna_sr_be_eng_v1',   'comp_collaboration',       0.16, 4, 'Cross-team alignment.'),
  ('dna_sr_be_eng_v1',   'comp_accountability',      0.14, 4, 'Owns critical paths.'),
  ('dna_sr_be_eng_v1',   'comp_strategic_thinking',  0.12, 3, 'Quarter-level planning.'),
  ('dna_sr_be_eng_v1',   'comp_persuasion',          0.10, 3, 'Tech direction proposals.'),
  ('dna_sr_be_eng_v1',   'comp_emotional_regulation',0.08, 4, 'Calm under incidents.'),

  ('dna_eng_manager_v1', 'comp_strategic_thinking',  0.22, 4, 'Function-level direction.'),
  ('dna_eng_manager_v1', 'comp_coaching',            0.20, 4, 'Develops engineers.'),
  ('dna_eng_manager_v1', 'comp_stakeholder_mgmt',    0.16, 4, 'Cross-functional partner.'),
  ('dna_eng_manager_v1', 'comp_conflict_resolution', 0.12, 4, 'Team frictions.'),
  ('dna_eng_manager_v1', 'comp_systems_thinking',    0.12, 4, 'Architectural choices.'),
  ('dna_eng_manager_v1', 'comp_integrity',           0.10, 4, 'Hard people decisions.'),
  ('dna_eng_manager_v1', 'comp_persuasion',          0.08, 4, 'Roadmap defense.'),

  ('dna_pm_v1',          'comp_stakeholder_mgmt',    0.22, 4, 'Central to PM craft.'),
  ('dna_pm_v1',          'comp_strategic_thinking',  0.20, 4, 'Roadmap prioritisation.'),
  ('dna_pm_v1',          'comp_persuasion',          0.18, 4, 'Selling the why.'),
  ('dna_pm_v1',          'comp_active_listening',    0.14, 4, 'Customer discovery.'),
  ('dna_pm_v1',          'comp_systems_thinking',    0.12, 3, 'Cross-system impact.'),
  ('dna_pm_v1',          'comp_collaboration',       0.08, 3, 'Engineering partnership.'),
  ('dna_pm_v1',          'comp_accountability',      0.06, 3, 'Outcome ownership.'),

  ('dna_credit_v1',      'comp_systems_thinking',    0.22, 3, 'Portfolio-level effects.'),
  ('dna_credit_v1',      'comp_integrity',           0.20, 4, 'Risk discipline.'),
  ('dna_credit_v1',      'comp_accountability',      0.18, 4, 'Decision ownership.'),
  ('dna_credit_v1',      'comp_active_listening',    0.12, 3, 'Counterparty diligence.'),
  ('dna_credit_v1',      'comp_collaboration',       0.10, 3, 'Cross-desk coordination.'),
  ('dna_credit_v1',      'comp_learning_agility',    0.10, 3, 'Evolving macro signals.'),
  ('dna_credit_v1',      'comp_persuasion',          0.08, 3, 'Defending credit views.')
ON CONFLICT (dna_profile_id, competency_id) DO NOTHING;

-- ---- Capability Models (named bundles) -------------------------------------
INSERT INTO onto_capability_models (id, name, description, version, domain_ids, family_ids, competency_ids) VALUES
  ('cm_engineering_leadership', 'Engineering Leadership Model', 'Capability bundle for engineering leaders.', '1.0.0',
   '["dom_strategic","dom_interpersonal","dom_cognitive"]'::jsonb,
   '["fam_leadership","fam_strategic_reasoning","fam_stakeholder_influence"]'::jsonb,
   '["comp_strategic_thinking","comp_coaching","comp_stakeholder_mgmt","comp_conflict_resolution","comp_systems_thinking","comp_integrity"]'::jsonb),
  ('cm_product_excellence',     'Product Excellence Model',     'Capability bundle for product managers.',     '1.0.0',
   '["dom_strategic","dom_interpersonal","dom_cognitive"]'::jsonb,
   '["fam_strategic_reasoning","fam_stakeholder_influence","fam_communication"]'::jsonb,
   '["comp_stakeholder_mgmt","comp_strategic_thinking","comp_persuasion","comp_active_listening","comp_systems_thinking"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
