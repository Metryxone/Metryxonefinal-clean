-- Role Library Expansion — broaden the curated role library so more free-text
-- job titles crosswalk to a matchable curated role (talent matching).
--
-- Candidate matching can only rank against a role that exists in onto_roles AND
-- carries an ACTIVE, weight-bearing profile in onto_role_competency_profiles
-- (services/role-title-crosswalk.ts → getMatchableCuratedRoles requires
-- COUNT(active) > 0). This adds a curated set of common roles + their taxonomy
-- chain + weight-balanced (sum = 100) competency profiles referencing EXISTING
-- competencies.
--
-- Strictly additive + idempotent (ON CONFLICT DO NOTHING). Reversible by
-- deleting the listed ids / the profile rows WHERE source = 'library_expansion'.
-- Mirrored at runtime by services/role-library-expansion.ts (no migration
-- runner in this project — see replit.md "canonical migration + lazy ensure").

-- ---- Function (Data & Analytics) -------------------------------------------
INSERT INTO onto_functions (id, industry_id, name, description, display_order) VALUES
  ('fn_it_data', 'ind_it', 'Data & Analytics', 'Turning data into decisions, models, and insight.', 3)
ON CONFLICT (id) DO NOTHING;

-- ---- Subfunctions ----------------------------------------------------------
INSERT INTO onto_subfunctions (id, function_id, name, description, display_order) VALUES
  ('sfn_software_eng',      'fn_it_engineering', 'Software Engineering',  'General-purpose software design and delivery.', 3),
  ('sfn_fullstack_eng',     'fn_it_engineering', 'Full-Stack Engineering','End-to-end client and server development.',     4),
  ('sfn_devops_eng',        'fn_it_engineering', 'DevOps & Reliability',  'Build, deploy, and operate reliable systems.',  5),
  ('sfn_quality_eng',       'fn_it_engineering', 'Quality Engineering',   'Test strategy and software quality assurance.', 6),
  ('sfn_data_analytics',    'fn_it_data',        'Data Analytics',        'Descriptive and diagnostic data analysis.',     1),
  ('sfn_data_science',      'fn_it_data',        'Data Science',          'Statistical modelling and machine learning.',   2),
  ('sfn_business_analysis', 'fn_it_product',     'Business Analysis',     'Bridging business needs and solution design.',  2),
  ('sfn_project_mgmt',      'fn_it_product',     'Project Management',    'Planning and delivering scoped initiatives.',   3)
ON CONFLICT (id) DO NOTHING;

-- ---- Role families ---------------------------------------------------------
INSERT INTO onto_role_families (id, subfunction_id, name, description, display_order) VALUES
  ('rf_software_engineer',  'sfn_software_eng',      'Software Engineer',   'Designs and builds software across the stack.', 1),
  ('rf_fullstack_engineer', 'sfn_fullstack_eng',     'Full Stack Engineer', 'Builds both client and server systems.',        1),
  ('rf_devops_engineer',    'sfn_devops_eng',        'DevOps Engineer',     'Automates delivery and operates infrastructure.', 1),
  ('rf_qa_engineer',        'sfn_quality_eng',       'QA Engineer',         'Designs tests and safeguards software quality.', 1),
  ('rf_data_analyst',       'sfn_data_analytics',    'Data Analyst',        'Analyses data to inform decisions.',            1),
  ('rf_data_scientist',     'sfn_data_science',      'Data Scientist',      'Builds models and statistical insight.',        1),
  ('rf_business_analyst',   'sfn_business_analysis', 'Business Analyst',    'Translates business needs into requirements.',  1),
  ('rf_project_manager',    'sfn_project_mgmt',      'Project Manager',     'Plans and delivers scoped projects.',           1)
ON CONFLICT (id) DO NOTHING;

-- ---- Roles (rf_frontend_engineer already exists from the seed migration) ----
INSERT INTO onto_roles (id, role_family_id, layer_id, title, seniority, description, display_order) VALUES
  ('role_software_eng',    'rf_software_engineer',  'layer_executive',  'Software Engineer',        'mid',    'Designs, builds, and maintains software systems.',      1),
  ('role_sr_software_eng', 'rf_software_engineer',  'layer_managerial', 'Senior Software Engineer', 'senior', 'Senior software engineer; owns design and mentors.',   2),
  ('role_fe_eng',          'rf_frontend_engineer',  'layer_executive',  'Frontend Engineer',        'mid',    'Builds user-facing client applications.',              1),
  ('role_fullstack_eng',   'rf_fullstack_engineer', 'layer_executive',  'Full Stack Engineer',      'mid',    'Builds both client and server systems end-to-end.',   1),
  ('role_devops_eng',      'rf_devops_engineer',    'layer_executive',  'DevOps Engineer',          'mid',    'Automates delivery and operates reliable infrastructure.', 1),
  ('role_qa_eng',          'rf_qa_engineer',        'layer_executive',  'QA Engineer',              'mid',    'Designs tests and safeguards software quality.',      1),
  ('role_data_analyst',    'rf_data_analyst',       'layer_executive',  'Data Analyst',             'mid',    'Analyses data to inform business decisions.',         1),
  ('role_data_scientist',  'rf_data_scientist',     'layer_managerial', 'Data Scientist',           'mid',    'Builds statistical models and machine-learning insight.', 1),
  ('role_business_analyst','rf_business_analyst',   'layer_executive',  'Business Analyst',         'mid',    'Translates business needs into solution requirements.', 1),
  ('role_project_manager', 'rf_project_manager',    'layer_managerial', 'Project Manager',          'mid',    'Plans and delivers scoped projects on time.',         1)
ON CONFLICT (role_family_id, title, seniority) DO NOTHING;

-- ---- Competency profiles (weights sum to 100 per role; source provenance) ----
INSERT INTO onto_role_competency_profiles (role_id, competency_id, required_level, weight, criticality, source, active) VALUES
  -- Software Engineer
  ('role_software_eng', 'comp_technical_competence', 4, 30, 'critical',  'library_expansion', true),
  ('role_software_eng', 'comp_problem_solving',      4, 25, 'critical',  'library_expansion', true),
  ('role_software_eng', 'comp_collaboration',        3, 15, 'important', 'library_expansion', true),
  ('role_software_eng', 'comp_communication',        3, 10, 'important', 'library_expansion', true),
  ('role_software_eng', 'comp_adaptability',         3, 10, 'important', 'library_expansion', true),
  ('role_software_eng', 'comp_attention_to_detail',  3, 10, 'desirable', 'library_expansion', true),
  -- Senior Software Engineer
  ('role_sr_software_eng', 'comp_technical_competence', 5, 30, 'critical',  'library_expansion', true),
  ('role_sr_software_eng', 'comp_problem_solving',      5, 20, 'critical',  'library_expansion', true),
  ('role_sr_software_eng', 'comp_decision_quality',     4, 15, 'important', 'library_expansion', true),
  ('role_sr_software_eng', 'comp_collaboration',        4, 10, 'important', 'library_expansion', true),
  ('role_sr_software_eng', 'comp_communication',        4, 10, 'important', 'library_expansion', true),
  ('role_sr_software_eng', 'comp_leadership',           3, 10, 'important', 'library_expansion', true),
  ('role_sr_software_eng', 'comp_adaptability',         3,  5, 'desirable', 'library_expansion', true),
  -- Frontend Engineer
  ('role_fe_eng', 'comp_technical_competence', 4, 30, 'critical',  'library_expansion', true),
  ('role_fe_eng', 'comp_problem_solving',      3, 20, 'critical',  'library_expansion', true),
  ('role_fe_eng', 'comp_design_thinking',      3, 15, 'important', 'library_expansion', true),
  ('role_fe_eng', 'comp_attention_to_detail',  3, 15, 'important', 'library_expansion', true),
  ('role_fe_eng', 'comp_collaboration',        3, 10, 'important', 'library_expansion', true),
  ('role_fe_eng', 'comp_communication',        3, 10, 'important', 'library_expansion', true),
  -- Full Stack Engineer
  ('role_fullstack_eng', 'comp_technical_competence', 4, 30, 'critical',  'library_expansion', true),
  ('role_fullstack_eng', 'comp_problem_solving',      4, 25, 'critical',  'library_expansion', true),
  ('role_fullstack_eng', 'comp_adaptability',         3, 15, 'important', 'library_expansion', true),
  ('role_fullstack_eng', 'comp_collaboration',        3, 15, 'important', 'library_expansion', true),
  ('role_fullstack_eng', 'comp_communication',        3, 10, 'important', 'library_expansion', true),
  ('role_fullstack_eng', 'comp_attention_to_detail',  2,  5, 'desirable', 'library_expansion', true),
  -- DevOps Engineer
  ('role_devops_eng', 'comp_technical_competence', 4, 30, 'critical',  'library_expansion', true),
  ('role_devops_eng', 'comp_problem_solving',      4, 20, 'critical',  'library_expansion', true),
  ('role_devops_eng', 'comp_quality_focus',        4, 15, 'important', 'library_expansion', true),
  ('role_devops_eng', 'comp_decision_quality',     3, 10, 'important', 'library_expansion', true),
  ('role_devops_eng', 'comp_collaboration',        3, 10, 'important', 'library_expansion', true),
  ('role_devops_eng', 'comp_communication',        3, 10, 'important', 'library_expansion', true),
  ('role_devops_eng', 'comp_adaptability',         2,  5, 'desirable', 'library_expansion', true),
  -- QA Engineer
  ('role_qa_eng', 'comp_quality_assurance',   4, 30, 'critical',  'library_expansion', true),
  ('role_qa_eng', 'comp_attention_to_detail', 4, 25, 'critical',  'library_expansion', true),
  ('role_qa_eng', 'comp_problem_solving',     3, 15, 'important', 'library_expansion', true),
  ('role_qa_eng', 'comp_analytical_thinking', 3, 10, 'important', 'library_expansion', true),
  ('role_qa_eng', 'comp_communication',       3, 10, 'important', 'library_expansion', true),
  ('role_qa_eng', 'comp_collaboration',       3, 10, 'important', 'library_expansion', true),
  -- Data Analyst
  ('role_data_analyst', 'comp_analytical_thinking',         4, 30, 'critical',  'library_expansion', true),
  ('role_data_analyst', 'comp_data_driven_decision_making', 4, 25, 'critical',  'library_expansion', true),
  ('role_data_analyst', 'comp_attention_to_detail',         3, 15, 'important', 'library_expansion', true),
  ('role_data_analyst', 'comp_communication',               3, 15, 'important', 'library_expansion', true),
  ('role_data_analyst', 'comp_problem_solving',             3, 10, 'important', 'library_expansion', true),
  ('role_data_analyst', 'comp_quality_focus',               2,  5, 'desirable', 'library_expansion', true),
  -- Data Scientist
  ('role_data_scientist', 'comp_analytical_thinking',         4, 25, 'critical',  'library_expansion', true),
  ('role_data_scientist', 'comp_data_driven_decision_making', 4, 20, 'critical',  'library_expansion', true),
  ('role_data_scientist', 'comp_problem_solving',             4, 20, 'critical',  'library_expansion', true),
  ('role_data_scientist', 'comp_technical_competence',        4, 15, 'important', 'library_expansion', true),
  ('role_data_scientist', 'comp_critical_thinking',           3, 10, 'important', 'library_expansion', true),
  ('role_data_scientist', 'comp_communication',               3, 10, 'important', 'library_expansion', true),
  -- Business Analyst
  ('role_business_analyst', 'comp_analytical_thinking', 4, 25, 'critical',  'library_expansion', true),
  ('role_business_analyst', 'comp_stakeholder_mgmt',    3, 20, 'critical',  'library_expansion', true),
  ('role_business_analyst', 'comp_communication',       4, 15, 'important', 'library_expansion', true),
  ('role_business_analyst', 'comp_business_acumen',     3, 15, 'important', 'library_expansion', true),
  ('role_business_analyst', 'comp_problem_solving',     3, 15, 'important', 'library_expansion', true),
  ('role_business_analyst', 'comp_critical_thinking',   3, 10, 'desirable', 'library_expansion', true),
  -- Project Manager
  ('role_project_manager', 'comp_project_management',      4, 25, 'critical',  'library_expansion', true),
  ('role_project_manager', 'comp_planning_and_organizing', 4, 20, 'critical',  'library_expansion', true),
  ('role_project_manager', 'comp_stakeholder_mgmt',        3, 15, 'important', 'library_expansion', true),
  ('role_project_manager', 'comp_communication',           4, 15, 'important', 'library_expansion', true),
  ('role_project_manager', 'comp_prioritization',          3, 15, 'important', 'library_expansion', true),
  ('role_project_manager', 'comp_decision_quality',        3, 10, 'desirable', 'library_expansion', true)
ON CONFLICT (role_id, competency_id) DO NOTHING;
