-- /app/scripts/seed-competency-framework.sql
-- Auto-generated. Idempotent. Recreates tables used by routes.ts that are NOT in drizzle schema.
-- Source: /app/frontend/attached_assets/Pasted--Domain-Subdomain-Micro-Competenc-...txt

BEGIN;

-- ─── DDL (CREATE TABLE IF NOT EXISTS — safe to re-run) ─────────────
CREATE TABLE IF NOT EXISTS competency_domains (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  name          text NOT NULL,
  description   text,
  color         text,
  weight        real NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competencies (
  id                 varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id          varchar NOT NULL REFERENCES competency_domains(id) ON DELETE CASCADE,
  code               text UNIQUE NOT NULL,
  name               text NOT NULL,
  description        text,
  competency_type    text NOT NULL DEFAULT 'behavioral',
  proficiency_levels jsonb NOT NULL DEFAULT '{"1":"Basic awareness","2":"Guided execution","3":"Independent execution","4":"Advanced application","5":"Strategic mastery"}'::jsonb,
  display_order      integer NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  created_at         timestamp NOT NULL DEFAULT now(),
  updated_at         timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_competencies_domain ON competencies(domain_id);

CREATE TABLE IF NOT EXISTS competency_clusters (
  id          varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competency_cluster_map (
  cluster_id    varchar NOT NULL REFERENCES competency_clusters(id) ON DELETE CASCADE,
  competency_id varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  PRIMARY KEY (cluster_id, competency_id)
);

CREATE TABLE IF NOT EXISTS stage_competency_norms (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_code    text NOT NULL,
  competency_id varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  min_score     real NOT NULL DEFAULT 0,
  median_score  real NOT NULL DEFAULT 50,
  top10_score   real NOT NULL DEFAULT 100,
  UNIQUE(stage_code, competency_id)
);
CREATE INDEX IF NOT EXISTS idx_stage_norms_stage ON stage_competency_norms(stage_code);

CREATE TABLE IF NOT EXISTS scoring_configs (
  id         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text UNIQUE NOT NULL,
  value      real NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competency_assessment_items (
  id             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id  varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  code           text UNIQUE NOT NULL,
  item_type      text NOT NULL DEFAULT 'mcq',
  difficulty     integer NOT NULL DEFAULT 3,
  level          integer NOT NULL DEFAULT 3,
  question       text NOT NULL,
  expected_time  integer NOT NULL DEFAULT 60,
  scoring_type   text NOT NULL DEFAULT 'auto',
  industry       text,
  role_tag       text,
  language_code  text NOT NULL DEFAULT 'en',
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_items_competency ON competency_assessment_items(competency_id);
CREATE INDEX IF NOT EXISTS idx_items_lang ON competency_assessment_items(language_code);

CREATE TABLE IF NOT EXISTS competency_assessment_options (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       varchar NOT NULL REFERENCES competency_assessment_items(id) ON DELETE CASCADE,
  text          text NOT NULL,
  score_value   real NOT NULL DEFAULT 0,
  display_order integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_options_item ON competency_assessment_options(item_id);

CREATE TABLE IF NOT EXISTS role_competency_weights (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code     text NOT NULL,
  role_name     text NOT NULL,
  competency_id varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  weight        real NOT NULL DEFAULT 1,
  weight_type   text NOT NULL DEFAULT 'core',
  UNIQUE(role_code, competency_id)
);
CREATE INDEX IF NOT EXISTS idx_role_weights_role ON role_competency_weights(role_code);

CREATE TABLE IF NOT EXISTS learning_mappings (
  id             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id  varchar NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  level          integer NOT NULL DEFAULT 3,
  action_type    text,
  title          text,
  resource_link  text,
  created_at     timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competency_user_responses (
  id             varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        varchar NOT NULL,
  item_id        varchar NOT NULL REFERENCES competency_assessment_items(id) ON DELETE CASCADE,
  option_id      varchar REFERENCES competency_assessment_options(id) ON DELETE SET NULL,
  score_obtained real,
  time_taken     integer,
  created_at     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_resp_user ON competency_user_responses(user_id);

-- Add language_code column on existing items table (idempotent)
ALTER TABLE competency_assessment_items
  ADD COLUMN IF NOT EXISTS language_code text NOT NULL DEFAULT 'en';

-- ─── 12 Competency Domains ─────────────────────────────────
INSERT INTO competency_domains (code, name, color, weight, display_order, is_active) VALUES
('CGN','Cognitive & Analytical Intelligence','#2563EB',1,1,true),
('COM','Communication & Expression','#10B981',1,2,true),
('PER','Personal Effectiveness & Self-Management','#EC4899',1,3,true),
('SOC','Social & Interpersonal Intelligence','#F59E0B',1,4,true),
('LEA','Leadership & Influence','#8B5CF6',1,5,true),
('EXE','Execution, Operations & Productivity','#0EA5E9',1,6,true),
('CAR','Career & Professional Readiness','#14B8A6',1,7,true),
('DIG','Digital, Data & Technology Skills','#6366F1',1,8,true),
('INN','Innovation, Entrepreneurship & Value Creation','#F97316',1,9,true),
('ETH','Ethics, Governance & Responsibility','#EF4444',1,10,true),
('HEA','Health, Wellbeing & Sustainability','#84CC16',1,11,true),
('GLO','Global & Future Readiness','#06B6D4',1,12,true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, color = EXCLUDED.color,
  display_order = EXCLUDED.display_order, is_active = EXCLUDED.is_active,
  updated_at = now();

-- ─── 101 Competencies (one per subdomain) ──────────────────
INSERT INTO competencies (domain_id, code, name, description, competency_type, display_order, is_active) VALUES
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_01','Numerical Aptitude','Number sense, arithmetic accuracy, quantitative reasoning, estimation accuracy, proportional reasoning, financial numeracy','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_02','Logical Reasoning','Deductive reasoning, inductive reasoning, abductive reasoning, syllogistic reasoning, analogy mapping, sequence logic','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_03','Critical Thinking','Assumption identification, argument evaluation, bias detection, logical consistency, evidence validation, fallacy detection','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_04','Analytical Thinking','Problem decomposition, root cause analysis, variable isolation, structured thinking, prioritization, causal analysis','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_05','Problem Solving','Problem identification, hypothesis generation, solution ideation, alternative evaluation, feasibility analysis, iterative refinement','behavioral',5,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_06','Decision Making','Risk assessment, trade-off evaluation, cost-benefit analysis, probabilistic thinking, judgment accuracy, speed-quality balance','behavioral',6,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_07','Systems Thinking','Interdependency mapping, feedback loop understanding, holistic reasoning, complexity handling, system dynamics','behavioral',7,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_08','Conceptual Thinking','Abstraction, generalization, theoretical modeling, principle application','behavioral',8,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_09','Research & Data Analysis','Data sourcing, hypothesis testing, statistical reasoning, data interpretation, synthesis, insight extraction','behavioral',9,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_10','Creativity & Innovation','Idea fluency, originality, divergent thinking, lateral thinking, recombination ability, experimentation mindset','behavioral',10,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_11','Spatial Intelligence','Visualization, mental rotation, spatial reasoning, diagrammatic interpretation','behavioral',11,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_12','Mechanical Reasoning','Cause-effect understanding, system functionality, physical reasoning, troubleshooting','behavioral',12,true),
((SELECT id FROM competency_domains WHERE code='CGN'),'CGN_13','Metacognition','Self-monitoring, strategy selection, cognitive flexibility, error awareness, learning regulation','behavioral',13,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_01','Verbal Communication','Clarity, articulation, fluency, pronunciation, tone modulation, vocabulary depth','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_02','Written Communication','Grammar accuracy, syntax control, clarity, conciseness, coherence, structured writing','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_03','Business Communication','Email etiquette, formal writing, professional tone, structured documentation, clarity of intent','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_04','Presentation Skills','Structuring content, audience engagement, storytelling, visual communication, delivery confidence','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_05','Active Listening','Attention, interpretation, paraphrasing, questioning, response relevance','behavioral',5,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_06','Persuasion & Influence','Argument framing, influencing strategies, objection handling, negotiation framing','behavioral',6,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_07','Assertiveness','Boundary setting, confident communication, respectful disagreement','behavioral',7,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_08','Public Speaking','Stage presence, voice control, audience interaction, confidence under pressure','behavioral',8,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_09','Storytelling','Narrative structuring, emotional appeal, audience connection','behavioral',9,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_10','Cross-functional Communication','Adaptability across audiences, clarity in diverse teams','behavioral',10,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_11','Feedback Communication','Constructive feedback delivery, receptiveness, feedback framing','behavioral',11,true),
((SELECT id FROM competency_domains WHERE code='COM'),'COM_12','Digital Communication','Email/chat clarity, asynchronous communication, brevity, tone appropriateness','behavioral',12,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_01','Self-Motivation','Initiative, drive, goal orientation, proactiveness','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_02','Discipline','Consistency, habit formation, focus maintenance, self-control','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_03','Resilience','Stress tolerance, recovery ability, persistence, adversity handling','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_04','Adaptability','Flexibility, openness to change, situational adjustment','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_05','Integrity & Ethics','Honesty, ethical reasoning, transparency, fairness','behavioral',5,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_06','Accountability','Ownership, responsibility, follow-through, reliability','behavioral',6,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_07','Self-Awareness','Strength/weakness identification, reflective thinking, emotional awareness','behavioral',7,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_08','Emotional Regulation','Emotional control, composure, impulse management','behavioral',8,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_09','Learning Agility','Curiosity, speed of learning, knowledge transfer, experimentation','behavioral',9,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_10','Growth Mindset','Openness to feedback, continuous improvement orientation','behavioral',10,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_11','Energy Management','Sustained performance, fatigue management, burnout prevention','behavioral',11,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_12','Time Management','Prioritization, scheduling, deadline adherence, time estimation','behavioral',12,true),
((SELECT id FROM competency_domains WHERE code='PER'),'PER_13','Stress Management','Performance under pressure, coping strategies','behavioral',13,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_01','Interpersonal Skills','Rapport building, relationship management, empathy in interaction','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_02','Emotional Intelligence','Empathy, emotional awareness, emotional regulation in social context','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_03','Teamwork & Collaboration','Cooperation, contribution, coordination, mutual support','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_04','Conflict Resolution','Mediation, negotiation, de-escalation strategies','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_05','Cultural Intelligence','Diversity sensitivity, inclusion, cross-cultural adaptability','behavioral',5,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_06','Networking','Relationship building, maintaining professional networks','behavioral',6,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_07','Stakeholder Management','Expectation alignment, communication clarity, influence management','behavioral',7,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_08','Customer Orientation','Service mindset, empathy, responsiveness','behavioral',8,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_09','Trust Building','Credibility, consistency, transparency','behavioral',9,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_10','Social Awareness','Group dynamics understanding, situational awareness','behavioral',10,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_11','Influence Without Authority','Persuasion, alignment building','behavioral',11,true),
((SELECT id FROM competency_domains WHERE code='SOC'),'SOC_12','Collaboration Across Teams','Cross-functional coordination, integration','behavioral',12,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_01','Leadership Skills','Vision setting, direction, alignment','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_02','People Management','Delegation, mentoring, coaching, performance management','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_03','Strategic Thinking','Long-term planning, foresight, scenario analysis','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_04','Decision Leadership','Decisiveness, accountability in decisions','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_05','Change Management','Leading change, adaptability, transition management','behavioral',5,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_06','Coaching & Mentoring','Developing others, feedback guidance','behavioral',6,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_07','Execution Leadership','Driving results, ensuring outcomes','behavioral',7,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_08','Team Building','Structuring teams, synergy creation','behavioral',8,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_09','Inspirational Leadership','Motivation, influence, engagement','behavioral',9,true),
((SELECT id FROM competency_domains WHERE code='LEA'),'LEA_10','Entrepreneurial Mindset','Opportunity recognition, calculated risk-taking','behavioral',10,true),
((SELECT id FROM competency_domains WHERE code='EXE'),'EXE_01','Task Execution','Ownership, closure, quality of execution','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='EXE'),'EXE_02','Project Management','Planning, execution, monitoring, risk tracking','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='EXE'),'EXE_03','Process Management','Workflow design, process optimization','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='EXE'),'EXE_04','Operational Efficiency','Resource optimization, output maximization','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='EXE'),'EXE_05','Attention to Detail','Accuracy, precision, quality control','behavioral',5,true),
((SELECT id FROM competency_domains WHERE code='EXE'),'EXE_06','Multitasking','Managing multiple priorities effectively','behavioral',6,true),
((SELECT id FROM competency_domains WHERE code='EXE'),'EXE_07','Resource Management','Efficient utilization of time, tools, people','behavioral',7,true),
((SELECT id FROM competency_domains WHERE code='EXE'),'EXE_08','Goal Execution','Outcome delivery, milestone tracking','behavioral',8,true),
((SELECT id FROM competency_domains WHERE code='EXE'),'EXE_09','Performance Tracking','Monitoring metrics, feedback loops','behavioral',9,true),
((SELECT id FROM competency_domains WHERE code='CAR'),'CAR_01','Career Awareness','Goal clarity, career mapping','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='CAR'),'CAR_02','Professionalism','Workplace etiquette, behavior standards','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='CAR'),'CAR_03','Employability Skills','Readiness for job roles, workplace adaptability','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='CAR'),'CAR_04','Interview Skills','Communication, confidence, structured responses','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='CAR'),'CAR_05','Resume & Profile Building','Achievement articulation, structuring','behavioral',5,true),
((SELECT id FROM competency_domains WHERE code='CAR'),'CAR_06','Personal Branding','Self-positioning, visibility','behavioral',6,true),
((SELECT id FROM competency_domains WHERE code='CAR'),'CAR_07','Organizational Awareness','Workplace structure, dynamics understanding','behavioral',7,true),
((SELECT id FROM competency_domains WHERE code='CAR'),'CAR_08','Industry Awareness','Market trends, domain knowledge','behavioral',8,true),
((SELECT id FROM competency_domains WHERE code='DIG'),'DIG_01','Digital Literacy','Basic computing, internet usage','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='DIG'),'DIG_02','Data Literacy','Data interpretation, visualization, basic analytics','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='DIG'),'DIG_03','Technical Skills','Domain-specific technical knowledge','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='DIG'),'DIG_04','Digital Communication Tools','Email, collaboration tools, remote work tools','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='DIG'),'DIG_05','Technology Adaptability','Learning new tools, tech agility','behavioral',5,true),
((SELECT id FROM competency_domains WHERE code='DIG'),'DIG_06','Automation Awareness','Understanding tools for efficiency','behavioral',6,true),
((SELECT id FROM competency_domains WHERE code='DIG'),'DIG_07','Cyber Awareness','Data privacy, basic cybersecurity hygiene','behavioral',7,true),
((SELECT id FROM competency_domains WHERE code='INN'),'INN_01','Innovation Skills','Idea validation, prototyping, experimentation','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='INN'),'INN_02','Entrepreneurial Skills','Opportunity spotting, resourcefulness','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='INN'),'INN_03','Business Acumen','Market understanding, value creation logic','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='INN'),'INN_04','Financial Literacy','Budgeting, cost understanding, ROI thinking','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='INN'),'INN_05','Design Thinking','User empathy, ideation, prototyping','behavioral',5,true),
((SELECT id FROM competency_domains WHERE code='ETH'),'ETH_01','Ethical Reasoning','Moral judgment, fairness, integrity','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='ETH'),'ETH_02','Compliance Awareness','Rules, regulations understanding','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='ETH'),'ETH_03','Social Responsibility','Sustainability awareness, ethical impact','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='ETH'),'ETH_04','Accountability Systems','Transparency, reporting responsibility','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='HEA'),'HEA_01','Physical Wellbeing','Energy levels, health maintenance awareness','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='HEA'),'HEA_02','Mental Wellbeing','Stress balance, emotional health awareness','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='HEA'),'HEA_03','Work-Life Balance','Balance management, sustainability','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='HEA'),'HEA_04','Occupational Health Awareness','Safe work practices','behavioral',4,true),
((SELECT id FROM competency_domains WHERE code='GLO'),'GLO_01','Global Awareness','Geopolitical awareness, global trends','behavioral',1,true),
((SELECT id FROM competency_domains WHERE code='GLO'),'GLO_02','Future Skills Orientation','AI awareness, adaptability to future roles','behavioral',2,true),
((SELECT id FROM competency_domains WHERE code='GLO'),'GLO_03','Lifelong Learning Orientation','Continuous upskilling mindset','behavioral',3,true),
((SELECT id FROM competency_domains WHERE code='GLO'),'GLO_04','Remote Work Readiness','Virtual collaboration, self-management','behavioral',4,true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  display_order = EXCLUDED.display_order, is_active = EXCLUDED.is_active,
  updated_at = now();

-- ─── Scoring Configs ────────────────────────────────────────
INSERT INTO scoring_configs (name, value) VALUES
  ('normalisation_top_pct', 90),
  ('weighted_score_floor', 0),
  ('benchmark_top10_pct', 10),
  ('proficiency_pass_threshold', 60),
  ('idp_top_n_gaps', 5)
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ─── Stage Norms (5 stages × 101 competencies = 505 rows) ──
INSERT INTO stage_competency_norms (stage_code, competency_id, min_score, median_score, top10_score)
SELECT s.stage, c.id,
       CASE s.stage WHEN 'FRESHER' THEN 25 WHEN 'JR' THEN 35 WHEN 'MID' THEN 45 WHEN 'SR' THEN 55 ELSE 60 END,
       CASE s.stage WHEN 'FRESHER' THEN 45 WHEN 'JR' THEN 55 WHEN 'MID' THEN 65 WHEN 'SR' THEN 72 ELSE 78 END,
       CASE s.stage WHEN 'FRESHER' THEN 75 WHEN 'JR' THEN 82 WHEN 'MID' THEN 88 WHEN 'SR' THEN 92 ELSE 95 END
FROM competencies c, (VALUES ('FRESHER'),('JR'),('MID'),('SR'),('EXEC')) AS s(stage)
ON CONFLICT (stage_code, competency_id) DO NOTHING;

-- ─── 7 Default Hiring Roles × 101 Competencies ─────────────
INSERT INTO role_competency_weights (role_code, role_name, competency_id, weight, weight_type)
SELECT r.code, r.name, c.id, 1, 'core'
FROM competencies c, (VALUES ('SDE','Software Engineer'),
('PM','Product Manager'),
('DA','Data Analyst'),
('TL','Team Lead'),
('DIR','Director'),
('CONS','Consultant'),
('SALES','Sales / BD')) AS r(code, name)
ON CONFLICT (role_code, competency_id) DO NOTHING;

COMMIT;
