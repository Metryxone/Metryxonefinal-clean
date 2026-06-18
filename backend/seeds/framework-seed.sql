-- ============================================================
-- Framework Seed — LBI (19 domains / 97 subdomains),
--                  SDI (18 domains / 54 subdomains),
--                  Competency (10 domains / 50 competencies)
-- Safe to re-run: uses ON CONFLICT DO UPDATE
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- LBI DOMAINS  (lbi_domains table)
-- ────────────────────────────────────────────────────────────
INSERT INTO lbi_domains (domain_code, domain_name, description, display_order, status) VALUES
('D01','Academic & Cognitive Effectiveness','Measures learning efficiency, conceptual understanding, memory, and attention',1,'Active'),
('D02','Thinking Quality Under Pressure','Assesses analytical thinking, decision quality, and exam strategy execution',2,'Active'),
('D03','Examination Stress & Emotional Regulation','Evaluates stress reactivity, emotional regulation, and recovery speed',3,'Active'),
('D04','Confidence, Self-Concept & Comparison','Measures academic self-confidence, self-concept clarity, and comparison sensitivity',4,'Active'),
('D05','Adjustment & Coping Capacity','Core module assessing academic, emotional, social, and family adjustment',5,'Active'),
('D06','Social & Emotional Intelligence (SQ & EQ)','Evaluates emotional regulation, relationships, trust, and inclusion',6,'Active'),
('D07','Discipline, Habits & Consistency','Measures time management, accountability, and execution discipline',7,'Active'),
('D08','Communication & Expression','Assesses listening, expression, influence, and conflict handling',8,'Active'),
('D09','Motivation, Values & Responsibility','Evaluates drive, commitment stability, integrity, and effort persistence',9,'Active'),
('D10','Lifestyle & Pressure Environment','Measures digital distraction, sleep, parental and institutional pressure',10,'Active'),
('D11','Competitive Exam Readiness','Optional add-on for performance stability and pressure tolerance',11,'Active'),
('D12','Integrated Root Cause Mapping','Cross-domain synthesis and clustering analysis',12,'Active'),
('D13','Academic Planning & Recovery Intelligence','Measures planning realism, prioritization, and recovery capacity',13,'Active'),
('D14','Metacognition & Self-Regulation','Assesses error awareness, strategy switching, and self-correction',14,'Active'),
('D15','Help-Seeking & Support Utilization','Evaluates help-seeking hesitation and response to guidance',15,'Active'),
('D16','Academic Identity & Meaning','Measures subject relevance perception and sense of agency',16,'Active'),
('D17','Transition & Change Adaptability','Assesses flexibility, uncertainty tolerance, and adaptation speed',17,'Active'),
('D18','Teacher-Student Interaction Sensitivity','Evaluates instruction responsiveness and feedback sensitivity',18,'Active'),
('D19','Over-Compliance Risk','Measures excessive compliance and suppressed autonomy',19,'Active')
ON CONFLICT (domain_code) DO UPDATE
  SET domain_name=EXCLUDED.domain_name, description=EXCLUDED.description, status=EXCLUDED.status;

-- ────────────────────────────────────────────────────────────
-- LBI SUBDOMAINS  (lbi_subdomains — FK via domain_id)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  dom record;
BEGIN
  -- D01 — 6 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D01';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD01_01','Learning Efficiency','How effectively the student absorbs new information',1),
    (dom.id,'SD01_02','Conceptual Understanding','Depth of understanding core concepts',2),
    (dom.id,'SD01_03','Working & Retrieval Memory','Memory retention and recall ability',3),
    (dom.id,'SD01_04','Sustained Attention','Ability to maintain focus over time',4),
    (dom.id,'SD01_05','Learning Style','Preferred learning approach',5),
    (dom.id,'SD01_06','Processing Stability','Consistency in information processing',6)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D02 — 8 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D02';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD02_01','Analytical & Critical Thinking','Quality of analytical reasoning',1),
    (dom.id,'SD02_02','Decision Quality & Judgment','Quality of decisions under pressure',2),
    (dom.id,'SD02_03','Managing Complexity','Ability to handle complex problems',3),
    (dom.id,'SD02_04','Exam Strategy & Execution Skills','Strategic approach to exams',4),
    (dom.id,'SD02_05','Strategy Execution','Ability to execute planned strategies',5),
    (dom.id,'SD02_06','Complexity Tolerance','Tolerance for complex situations',6),
    (dom.id,'SD02_07','Error Handling & Adaptive Execution','Handling errors during execution',7),
    (dom.id,'SD02_08','Situational Judgment','Judgment under pressure',8)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D03 — 9 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D03';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD03_01','Stress Reactivity','Initial stress response',1),
    (dom.id,'SD03_02','Emotional Regulation Ability','Ability to regulate emotions',2),
    (dom.id,'SD03_03','Cognitive Control Under Stress','Maintaining cognitive function under stress',3),
    (dom.id,'SD03_04','Execution Stability','Stability of performance under stress',4),
    (dom.id,'SD03_05','Recovery & Reset Speed','Speed of recovery from stress',5),
    (dom.id,'SD03_06','Stress Spillover Control','Preventing stress from affecting other areas',6),
    (dom.id,'SD03_07','Anticipatory Stress Management','Managing stress before events',7),
    (dom.id,'SD03_08','Emotional Insight & Awareness','Awareness of emotional states',8),
    (dom.id,'SD03_09','Regulation Strategy Flexibility','Flexibility in using different strategies',9)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D04 — 9 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D04';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD04_01','Academic Self-Confidence','Confidence in academic abilities',1),
    (dom.id,'SD04_02','Confidence Stability','Consistency of confidence levels',2),
    (dom.id,'SD04_03','Self-Concept Clarity','Clear understanding of self',3),
    (dom.id,'SD04_04','Social Comparison Sensitivity','Tendency to compare with peers',4),
    (dom.id,'SD04_05','Fear of Negative Evaluation','Concern about others judgments',5),
    (dom.id,'SD04_06','Competence Attribution Style','How success/failure is attributed',6),
    (dom.id,'SD04_07','External Validation Dependence','Need for external approval',7),
    (dom.id,'SD04_08','Self-Doubt Intrusion','Frequency of self-doubt thoughts',8),
    (dom.id,'SD04_09','Confidence-Performance Alignment','Match between confidence and actual performance',9)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D05 — 4 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D05';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD05_01','Academic Adjustment','Adjustment to academic demands',1),
    (dom.id,'SD05_02','Emotional Adjustment','Emotional adaptation capacity',2),
    (dom.id,'SD05_03','Social Adjustment','Social adaptation ability',3),
    (dom.id,'SD05_04','Family Adjustment','Family relationship adjustment',4)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D06 — 4 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D06';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD06_01','Emotional Regulation','Ability to regulate emotions',1),
    (dom.id,'SD06_02','Relationship Quality','Quality of interpersonal relationships',2),
    (dom.id,'SD06_03','Trust Capacity','Level of trust in others',3),
    (dom.id,'SD06_04','Sense of Inclusion','Sense of belonging and inclusion',4)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D07 — 5 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D07';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD07_01','Time & Priority Management','Ability to manage time and priorities',1),
    (dom.id,'SD07_02','Accountability','Taking responsibility for actions',2),
    (dom.id,'SD07_03','Execution Discipline','Discipline in executing tasks',3),
    (dom.id,'SD07_04','Plan-Execution Alignment','Following through on plans',4),
    (dom.id,'SD07_05','Consistency','Maintaining consistent effort',5)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D08 — 5 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D08';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD08_01','Listening','Active listening skills',1),
    (dom.id,'SD08_02','Expression','Ability to express thoughts clearly',2),
    (dom.id,'SD08_03','Influence','Ability to influence others',3),
    (dom.id,'SD08_04','Conflict Handling','Managing conflicts effectively',4),
    (dom.id,'SD08_05','Instruction Comprehension','Understanding instructions',5)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D09 — 5 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D09';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD09_01','Drive','Internal motivation and drive',1),
    (dom.id,'SD09_02','Commitment Stability','Consistency of commitment',2),
    (dom.id,'SD09_03','Integrity','Adherence to values',3),
    (dom.id,'SD09_04','Ownership Patterns','Taking ownership of outcomes',4),
    (dom.id,'SD09_05','Effort Persistence','Sustaining effort over time',5)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D10 — 4 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D10';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD10_01','Digital Distraction','Impact of digital distractions',1),
    (dom.id,'SD10_02','Sleep Quality','Sleep quality and patterns',2),
    (dom.id,'SD10_03','Parental Pressure','Level of parental pressure',3),
    (dom.id,'SD10_04','Institutional Pressure','School/institution pressure',4)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D11 — 5 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D11';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD11_01','Performance Stability','Consistency in performance',1),
    (dom.id,'SD11_02','Pressure Tolerance','Ability to handle pressure',2),
    (dom.id,'SD11_03','Exam Consistency','Maintaining consistent results',3),
    (dom.id,'SD11_04','Performance Variance','Variation in performance levels',4),
    (dom.id,'SD11_05','Recovery Speed','Speed of recovery after setbacks',5)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D12 — 4 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D12';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD12_01','Cross-Domain Synthesis','Ability to connect across domains',1),
    (dom.id,'SD12_02','Cross-Module Clustering','Pattern recognition across modules',2),
    (dom.id,'SD12_03','Temporal Weighting','Time-based pattern analysis',3),
    (dom.id,'SD12_04','Human Confirmation Required','Need for expert validation',4)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D13 — 6 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D13';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD13_01','Planning Realism','Realistic planning ability',1),
    (dom.id,'SD13_02','Academic Prioritisation Intelligence','Smart prioritization of academics',2),
    (dom.id,'SD13_03','Recovery Capacity After Setbacks','Bouncing back from failures',3),
    (dom.id,'SD13_04','Strategy Correction Ability','Adjusting strategies when needed',4),
    (dom.id,'SD13_05','Execution Feasibility','Realistic execution assessment',5),
    (dom.id,'SD13_06','Short-Term Recovery Window','30-60 day recovery planning',6)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D14 — 3 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D14';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD14_01','Error Awareness','Awareness of own mistakes',1),
    (dom.id,'SD14_02','Strategy Switching','Ability to change strategies',2),
    (dom.id,'SD14_03','Self-Correction Timing','Timing of self-corrections',3)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D15 — 4 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D15';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD15_01','Help-Seeking Hesitation','Reluctance to seek help',1),
    (dom.id,'SD15_02','Trust in Authority','Trust in teachers and mentors',2),
    (dom.id,'SD15_03','Response to Guidance','How well guidance is received',3),
    (dom.id,'SD15_04','Silent Failure Prevention','Avoiding hidden struggles',4)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D16 — 4 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D16';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD16_01','Subject Relevance Perception','Seeing relevance of subjects',1),
    (dom.id,'SD16_02','Sense of Agency','Feeling in control of learning',2),
    (dom.id,'SD16_03','Identity Alignment','Academic goals align with identity',3),
    (dom.id,'SD16_04','Long-Term Engagement Risk','Risk of disengagement over time',4)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D17 — 6 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D17';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD17_01','Flexibility','Mental flexibility',1),
    (dom.id,'SD17_02','Uncertainty Tolerance','Comfort with uncertainty',2),
    (dom.id,'SD17_03','Adaptation Speed','Speed of adaptation to change',3),
    (dom.id,'SD17_04','Multi-Domain Instability','Instability across areas',4),
    (dom.id,'SD17_05','Persistence of Disengagement','Lasting disengagement patterns',5),
    (dom.id,'SD17_06','Recovery Delay','Delay in recovery process',6)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D18 — 3 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D18';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD18_01','Instruction Responsiveness','Response to teacher instructions',1),
    (dom.id,'SD18_02','Feedback Sensitivity','Sensitivity to feedback',2),
    (dom.id,'SD18_03','Authority Interaction Comfort','Comfort interacting with authority',3)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;

  -- D19 — 3 subdomains
  SELECT id INTO dom FROM lbi_domains WHERE domain_code='D19';
  INSERT INTO lbi_subdomains (domain_id,subdomain_code,subdomain_name,description,display_order) VALUES
    (dom.id,'SD19_01','Excessive Compliance','Overly compliant behavior',1),
    (dom.id,'SD19_02','Fear-Driven Obedience','Obedience based on fear',2),
    (dom.id,'SD19_03','Suppressed Autonomy','Suppressed independent thinking',3)
  ON CONFLICT (subdomain_code) DO UPDATE SET subdomain_name=EXCLUDED.subdomain_name;
END $$;

-- ────────────────────────────────────────────────────────────
-- SDI DOMAINS  (18 domains for K-12 holistic profiling)
-- ────────────────────────────────────────────────────────────
INSERT INTO sdi_domains (domain_code, domain_name, category, description, display_order, is_active) VALUES
('SDI_COG','Cognitive Development','Academic','Measures thinking, problem-solving, and reasoning capacities',1,true),
('SDI_EMO','Emotional Intelligence','Social-Emotional','Evaluates emotional awareness, empathy, and self-regulation',2,true),
('SDI_SOC','Social Skills','Social-Emotional','Assesses peer relationships, collaboration, and communication',3,true),
('SDI_PHY','Physical & Health Awareness','Wellness','Measures health habits, motor skills, and physical well-being',4,true),
('SDI_LNG','Language & Communication','Academic','Evaluates verbal, written, and expressive language skills',5,true),
('SDI_CRE','Creative & Artistic Expression','Enrichment','Assesses creativity, imagination, and artistic engagement',6,true),
('SDI_MTH','Mathematical Reasoning','Academic','Measures numerical, logical, and spatial reasoning',7,true),
('SDI_SCI','Scientific Curiosity','Academic','Evaluates inquiry, observation, and scientific thinking',8,true),
('SDI_LFS','Life Skills & Adaptability','Personal Development','Measures practical decision-making, resilience, and independence',9,true),
('SDI_VAL','Values & Character','Character','Assesses integrity, respect, and ethical behavior',10,true),
('SDI_LED','Leadership & Teamwork','Social-Emotional','Evaluates initiative, cooperation, and team contributions',11,true),
('SDI_DIG','Digital Literacy','Technology','Measures responsible technology use and digital citizenship',12,true),
('SDI_HWB','Health & Well-Being','Wellness','Evaluates mental health, sleep, nutrition, and wellness habits',13,true),
('SDI_CUL','Cultural Awareness','Global Citizenship','Assesses multicultural sensitivity and global perspective',14,true),
('SDI_ENT','Entrepreneurial Thinking','Career Readiness','Measures initiative, risk-taking, and innovation mindset',15,true),
('SDI_CAR','Career Readiness','Career Readiness','Evaluates career exploration, goal-setting, and work ethic',16,true),
('SDI_CIV','Civic Responsibility','Character','Assesses community participation and social responsibility',17,true),
('SDI_ACH','Academic Achievement','Academic','Overall academic performance, study skills, and learning habits',18,true)
ON CONFLICT (domain_code) DO UPDATE
  SET domain_name=EXCLUDED.domain_name, category=EXCLUDED.category, description=EXCLUDED.description, is_active=EXCLUDED.is_active;

-- SDI SUBDOMAINS (3 per domain = 54 total)
INSERT INTO sdi_subdomains (domain_code, subdomain_code, subdomain_name, description, display_order, is_active) VALUES
('SDI_COG','SDI_COG_01','Critical Thinking','Ability to analyse, evaluate, and synthesise information',1,true),
('SDI_COG','SDI_COG_02','Problem Solving','Applying strategies to overcome academic challenges',2,true),
('SDI_COG','SDI_COG_03','Working Memory','Retaining and using information while performing tasks',3,true),

('SDI_EMO','SDI_EMO_01','Self-Awareness','Recognising one''s own emotions and their triggers',1,true),
('SDI_EMO','SDI_EMO_02','Empathy','Understanding and sharing the feelings of others',2,true),
('SDI_EMO','SDI_EMO_03','Emotional Self-Regulation','Managing and expressing emotions appropriately',3,true),

('SDI_SOC','SDI_SOC_01','Peer Relationships','Building and maintaining positive friendships',1,true),
('SDI_SOC','SDI_SOC_02','Collaboration','Working effectively as part of a team',2,true),
('SDI_SOC','SDI_SOC_03','Conflict Resolution','Handling disagreements constructively',3,true),

('SDI_PHY','SDI_PHY_01','Physical Activity Habits','Frequency and quality of physical exercise',1,true),
('SDI_PHY','SDI_PHY_02','Body Awareness','Understanding physical signals and health needs',2,true),
('SDI_PHY','SDI_PHY_03','Motor Coordination','Fine and gross motor skill development',3,true),

('SDI_LNG','SDI_LNG_01','Verbal Expression','Clarity and confidence in spoken communication',1,true),
('SDI_LNG','SDI_LNG_02','Written Communication','Ability to express ideas effectively in writing',2,true),
('SDI_LNG','SDI_LNG_03','Active Listening','Comprehension and retention of spoken information',3,true),

('SDI_CRE','SDI_CRE_01','Creative Thinking','Generating novel ideas and solutions',1,true),
('SDI_CRE','SDI_CRE_02','Artistic Engagement','Participation and interest in arts and creative activities',2,true),
('SDI_CRE','SDI_CRE_03','Imaginative Play','Using imagination in learning and exploration',3,true),

('SDI_MTH','SDI_MTH_01','Number Sense','Understanding quantity, operations, and relationships',1,true),
('SDI_MTH','SDI_MTH_02','Logical Reasoning','Identifying patterns and drawing logical conclusions',2,true),
('SDI_MTH','SDI_MTH_03','Spatial Awareness','Visualising and manipulating objects in space',3,true),

('SDI_SCI','SDI_SCI_01','Scientific Inquiry','Asking questions and designing investigations',1,true),
('SDI_SCI','SDI_SCI_02','Observation Skills','Accurate and detailed observation of the world',2,true),
('SDI_SCI','SDI_SCI_03','Environmental Curiosity','Interest in nature and the physical world',3,true),

('SDI_LFS','SDI_LFS_01','Decision Making','Making thoughtful and responsible choices',1,true),
('SDI_LFS','SDI_LFS_02','Resilience','Bouncing back from setbacks and challenges',2,true),
('SDI_LFS','SDI_LFS_03','Self-Management','Organising personal tasks and responsibilities',3,true),

('SDI_VAL','SDI_VAL_01','Integrity','Honesty and adherence to moral principles',1,true),
('SDI_VAL','SDI_VAL_02','Respect','Treating others with dignity and consideration',2,true),
('SDI_VAL','SDI_VAL_03','Responsibility','Taking ownership of actions and commitments',3,true),

('SDI_LED','SDI_LED_01','Initiative','Volunteering and taking proactive steps',1,true),
('SDI_LED','SDI_LED_02','Team Contribution','Adding value and supporting team success',2,true),
('SDI_LED','SDI_LED_03','Influence & Inspiration','Motivating peers through example and guidance',3,true),

('SDI_DIG','SDI_DIG_01','Digital Safety','Safe and responsible online behaviour',1,true),
('SDI_DIG','SDI_DIG_02','Technology Use','Purposeful and effective use of digital tools',2,true),
('SDI_DIG','SDI_DIG_03','Information Literacy','Evaluating online sources critically',3,true),

('SDI_HWB','SDI_HWB_01','Mental Well-Being','Emotional health, positivity, and stress management',1,true),
('SDI_HWB','SDI_HWB_02','Sleep & Recovery','Quality and consistency of rest and sleep',2,true),
('SDI_HWB','SDI_HWB_03','Nutrition Awareness','Understanding and practicing healthy eating habits',3,true),

('SDI_CUL','SDI_CUL_01','Cultural Sensitivity','Respect and openness toward diverse cultures',1,true),
('SDI_CUL','SDI_CUL_02','Global Awareness','Understanding global issues and interconnectedness',2,true),
('SDI_CUL','SDI_CUL_03','Inclusive Mindset','Embracing diversity and opposing discrimination',3,true),

('SDI_ENT','SDI_ENT_01','Innovation Mindset','Thinking creatively to create new solutions',1,true),
('SDI_ENT','SDI_ENT_02','Risk-Taking Appetite','Comfort with reasonable risk in pursuit of goals',2,true),
('SDI_ENT','SDI_ENT_03','Initiative & Drive','Self-starting behaviour and goal pursuit',3,true),

('SDI_CAR','SDI_CAR_01','Career Exploration','Awareness of career options and interests',1,true),
('SDI_CAR','SDI_CAR_02','Goal Setting','Defining and working toward short and long-term goals',2,true),
('SDI_CAR','SDI_CAR_03','Work Ethic','Diligence, punctuality, and commitment to quality',3,true),

('SDI_CIV','SDI_CIV_01','Community Engagement','Active participation in school and community life',1,true),
('SDI_CIV','SDI_CIV_02','Social Responsibility','Awareness and action on social and environmental issues',2,true),
('SDI_CIV','SDI_CIV_03','Civic Participation','Understanding and exercising democratic rights',3,true),

('SDI_ACH','SDI_ACH_01','Study Skills','Effective techniques for studying and revision',1,true),
('SDI_ACH','SDI_ACH_02','Academic Engagement','Active participation and motivation in learning',2,true),
('SDI_ACH','SDI_ACH_03','Performance Consistency','Stability and reliability of academic output',3,true)
ON CONFLICT (subdomain_code) DO UPDATE
  SET subdomain_name=EXCLUDED.subdomain_name, description=EXCLUDED.description, is_active=EXCLUDED.is_active;

-- ────────────────────────────────────────────────────────────
-- COMPETENCY DOMAINS  (10 professional competency domains)
-- ────────────────────────────────────────────────────────────
INSERT INTO competency_domains (code, name, description, color, weight, display_order, is_active) VALUES
('LEAD','Leadership & Management','Ability to inspire, guide, and develop individuals and teams toward shared goals','#6366f1',1.2,1,true),
('COMM','Communication','Clear, confident, and purposeful expression across written, verbal, and digital channels','#0ea5e9',1.1,2,true),
('PROB','Problem Solving & Decision Making','Structured analysis, creative solutions, and sound judgment under uncertainty','#f59e0b',1.2,3,true),
('TEAM','Teamwork & Collaboration','Building trust, contributing effectively, and achieving outcomes as part of a group','#10b981',1.0,4,true),
('TECH','Technical Proficiency','Domain expertise and mastery of tools, methodologies, and technical frameworks','#8b5cf6',1.0,5,true),
('CUST','Customer & Stakeholder Focus','Understanding needs, building relationships, and delivering value to stakeholders','#f43f5e',1.0,6,true),
('INNO','Innovation & Creativity','Generating novel ideas, challenging assumptions, and driving continuous improvement','#f97316',0.9,7,true),
('LRND','Learning & Development','Growth mindset, self-directed learning, and knowledge transfer to others','#0d9488',0.9,8,true),
('STRT','Strategic Thinking','Long-range planning, systems thinking, and aligning actions with organisational vision','#344E86',1.1,9,true),
('INTG','Integrity & Ethics','Principled behaviour, accountability, transparency, and ethical decision-making','#64748b',1.0,10,true)
ON CONFLICT (code) DO UPDATE
  SET name=EXCLUDED.name, description=EXCLUDED.description, color=EXCLUDED.color,
      weight=EXCLUDED.weight, display_order=EXCLUDED.display_order, is_active=EXCLUDED.is_active;

-- COMPETENCIES  (5 per domain = 50 competencies; references domain via FK)
DO $$
DECLARE
  d_lead uuid; d_comm uuid; d_prob uuid; d_team uuid; d_tech uuid;
  d_cust uuid; d_inno uuid; d_lrnd uuid; d_strt uuid; d_intg uuid;
BEGIN
  SELECT id INTO d_lead FROM competency_domains WHERE code='LEAD';
  SELECT id INTO d_comm FROM competency_domains WHERE code='COMM';
  SELECT id INTO d_prob FROM competency_domains WHERE code='PROB';
  SELECT id INTO d_team FROM competency_domains WHERE code='TEAM';
  SELECT id INTO d_tech FROM competency_domains WHERE code='TECH';
  SELECT id INTO d_cust FROM competency_domains WHERE code='CUST';
  SELECT id INTO d_inno FROM competency_domains WHERE code='INNO';
  SELECT id INTO d_lrnd FROM competency_domains WHERE code='LRND';
  SELECT id INTO d_strt FROM competency_domains WHERE code='STRT';
  SELECT id INTO d_intg FROM competency_domains WHERE code='INTG';

  -- LEAD
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_lead,'LEAD_01','Visionary Leadership','Setting a compelling vision and rallying others to achieve it','leadership',1),
    (d_lead,'LEAD_02','People Development','Mentoring, coaching, and growing team members','leadership',2),
    (d_lead,'LEAD_03','Change Management','Leading teams through transitions and uncertainty','leadership',3),
    (d_lead,'LEAD_04','Performance Management','Setting goals, monitoring progress, and providing feedback','leadership',4),
    (d_lead,'LEAD_05','Inclusive Leadership','Creating diverse, equitable, and psychologically safe environments','leadership',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

  -- COMM
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_comm,'COMM_01','Verbal Communication','Clear, concise, and persuasive spoken communication','core',1),
    (d_comm,'COMM_02','Written Communication','Professional and effective business writing','core',2),
    (d_comm,'COMM_03','Active Listening','Attentive listening and accurate interpretation of messages','core',3),
    (d_comm,'COMM_04','Presentation Skills','Engaging and structured delivery to audiences','functional',4),
    (d_comm,'COMM_05','Interpersonal Influence','Persuading and building rapport with stakeholders','behavioral',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

  -- PROB
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_prob,'PROB_01','Analytical Thinking','Breaking down complex problems into manageable components','core',1),
    (d_prob,'PROB_02','Creative Problem Solving','Generating innovative approaches to challenges','core',2),
    (d_prob,'PROB_03','Data-Driven Decision Making','Using evidence and data to inform choices','technical',3),
    (d_prob,'PROB_04','Risk Assessment','Identifying and mitigating potential risks','functional',4),
    (d_prob,'PROB_05','Judgment Under Pressure','Making sound decisions in high-stakes situations','behavioral',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

  -- TEAM
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_team,'TEAM_01','Collaboration','Working cooperatively to achieve shared objectives','core',1),
    (d_team,'TEAM_02','Conflict Resolution','Addressing disagreements constructively','behavioral',2),
    (d_team,'TEAM_03','Trust Building','Earning and maintaining trust with colleagues','behavioral',3),
    (d_team,'TEAM_04','Cross-Functional Coordination','Aligning efforts across departments','functional',4),
    (d_team,'TEAM_05','Accountability','Taking ownership of individual and team commitments','core',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

  -- TECH
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_tech,'TECH_01','Domain Expertise','Deep knowledge in core professional field','technical',1),
    (d_tech,'TECH_02','Tool Mastery','Proficiency with relevant software and technical tools','technical',2),
    (d_tech,'TECH_03','Quality Standards','Adherence to best practices and quality frameworks','technical',3),
    (d_tech,'TECH_04','Technical Communication','Explaining technical concepts to non-experts','functional',4),
    (d_tech,'TECH_05','Systems Thinking','Understanding interdependencies in complex systems','functional',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

  -- CUST
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_cust,'CUST_01','Customer Empathy','Understanding and anticipating customer needs','behavioral',1),
    (d_cust,'CUST_02','Relationship Management','Building long-term partnerships with clients','functional',2),
    (d_cust,'CUST_03','Service Excellence','Consistently exceeding stakeholder expectations','core',3),
    (d_cust,'CUST_04','Needs Analysis','Identifying explicit and latent customer requirements','functional',4),
    (d_cust,'CUST_05','Stakeholder Communication','Tailoring messages to diverse stakeholder groups','functional',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

  -- INNO
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_inno,'INNO_01','Ideation','Generating a high volume of diverse ideas','core',1),
    (d_inno,'INNO_02','Experimentation','Designing and running rapid tests of new concepts','functional',2),
    (d_inno,'INNO_03','Agile Thinking','Adapting quickly to new information and changing conditions','behavioral',3),
    (d_inno,'INNO_04','Process Improvement','Identifying and implementing efficiency gains','functional',4),
    (d_inno,'INNO_05','Challenge Assumptions','Questioning the status quo to drive change','behavioral',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

  -- LRND
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_lrnd,'LRND_01','Growth Mindset','Embracing challenges as opportunities to improve','behavioral',1),
    (d_lrnd,'LRND_02','Self-Directed Learning','Proactively seeking new knowledge and skills','core',2),
    (d_lrnd,'LRND_03','Knowledge Sharing','Transferring expertise and learning to others','functional',3),
    (d_lrnd,'LRND_04','Feedback Receptivity','Actively soliciting and acting on constructive feedback','behavioral',4),
    (d_lrnd,'LRND_05','Adaptability','Adjusting effectively to new roles and environments','core',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

  -- STRT
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_strt,'STRT_01','Vision & Goal Setting','Defining clear long-term objectives and roadmaps','leadership',1),
    (d_strt,'STRT_02','Market & Environmental Analysis','Scanning external factors affecting strategy','functional',2),
    (d_strt,'STRT_03','Resource Prioritisation','Allocating time, talent, and capital to highest-impact areas','functional',3),
    (d_strt,'STRT_04','Systems & Complexity Thinking','Understanding second-order effects and interdependencies','core',4),
    (d_strt,'STRT_05','Scenario Planning','Preparing for multiple potential futures','functional',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;

  -- INTG
  INSERT INTO competencies (domain_id,code,name,description,competency_type,display_order) VALUES
    (d_intg,'INTG_01','Ethical Decision Making','Applying principled reasoning to moral dilemmas','core',1),
    (d_intg,'INTG_02','Transparency','Communicating openly and honestly with stakeholders','behavioral',2),
    (d_intg,'INTG_03','Accountability & Ownership','Taking responsibility for outcomes and commitments','core',3),
    (d_intg,'INTG_04','Compliance Awareness','Understanding and adhering to regulatory requirements','functional',4),
    (d_intg,'INTG_05','Professional Conduct','Demonstrating consistent, respectful workplace behaviour','behavioral',5)
  ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description;
END $$;
