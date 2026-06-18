-- /app/scripts/seed-lbi-data.sql
-- LBI Behavioural Framework — permanent seed (idempotent, safe to re-run)
-- Schema: lbi_domains, lbi_subdomains, lbi_age_bands
-- Run by: bootstrap.sh after drizzle-kit push.

-- ─── 19 LBI Domains ───────────────────────────────────────────────────────
INSERT INTO lbi_domains (id, domain_code, domain_name, description, weightage, display_order, status) VALUES
('D01','D01','Academic & Cognitive Effectiveness','Measures learning efficiency, conceptual understanding, memory, and attention',12,1,'Active'),
('D02','D02','Thinking Quality Under Pressure','Assesses analytical thinking, decision quality, and exam strategy execution',10,2,'Active'),
('D03','D03','Examination Stress & Emotional Regulation','Evaluates stress reactivity, emotional regulation, and recovery speed',10,3,'Active'),
('D04','D04','Confidence, Self-Concept & Comparison','Measures academic self-confidence, self-concept clarity, and comparison sensitivity',8,4,'Active'),
('D05','D05','Adjustment & Coping Capacity','Core module assessing academic, emotional, social, and family adjustment',7,5,'Active'),
('D06','D06','Social & Emotional Intelligence (SQ & EQ)','Evaluates emotional regulation, relationships, trust, and inclusion',5,6,'Active'),
('D07','D07','Discipline, Habits & Consistency','Measures time management, accountability, and execution discipline',8,7,'Active'),
('D08','D08','Communication & Expression','Assesses listening, expression, influence, and conflict handling',5,8,'Active'),
('D09','D09','Motivation, Values & Responsibility','Evaluates drive, commitment stability, integrity, and effort persistence',6,9,'Active'),
('D10','D10','Lifestyle & Pressure Environment','Measures digital distraction, sleep, parental and institutional pressure',5,10,'Active'),
('D11','D11','Competitive Exam Readiness','Optional add-on for performance stability and pressure tolerance',5,11,'Active'),
('D12','D12','Integrated Root Cause Mapping','Cross-domain synthesis and clustering analysis',0,12,'Active'),
('D13','D13','Academic Planning & Recovery Intelligence','Measures planning realism, prioritization, and recovery capacity',7,13,'Active'),
('D14','D14','Metacognition & Self-Regulation','Assesses error awareness, strategy switching, and self-correction',6,14,'Active'),
('D15','D15','Help-Seeking & Support Utilization','Evaluates help-seeking hesitation and response to guidance',4,15,'Active'),
('D16','D16','Academic Identity & Meaning','Measures subject relevance perception and sense of agency',3,16,'Active'),
('D17','D17','Transition & Change Adaptability','Assesses flexibility, uncertainty tolerance, and adaptation speed',3,17,'Active'),
('D18','D18','Teacher-Student Interaction Sensitivity','Evaluates instruction responsiveness and feedback sensitivity',2,18,'Active'),
('D19','D19','Over-Compliance Risk','Measures excessive compliance and suppressed autonomy',2,19,'Active')
ON CONFLICT (domain_code) DO UPDATE SET
  domain_name = EXCLUDED.domain_name,
  description = EXCLUDED.description,
  weightage = EXCLUDED.weightage,
  display_order = EXCLUDED.display_order,
  status = EXCLUDED.status;

-- ─── 97 Subdomains ────────────────────────────────────────────────────────
INSERT INTO lbi_subdomains (id, domain_id, subdomain_code, subdomain_name, description, weightage, display_order, status) VALUES
-- D01: Academic & Cognitive Effectiveness (6)
('SD01_01','D01','SD01_01','Learning Efficiency','How effectively the student absorbs new information',1,1,'Active'),
('SD01_02','D01','SD01_02','Conceptual Understanding','Depth of understanding core concepts',1,2,'Active'),
('SD01_03','D01','SD01_03','Working & Retrieval Memory','Memory retention and recall ability',1,3,'Active'),
('SD01_04','D01','SD01_04','Sustained Attention','Ability to maintain focus over time',1,4,'Active'),
('SD01_05','D01','SD01_05','Learning Style','Preferred learning approach',1,5,'Active'),
('SD01_06','D01','SD01_06','Processing Stability','Consistency in information processing',1,6,'Active'),
-- D02: Thinking Quality Under Pressure (8)
('SD02_01','D02','SD02_01','Analytical & Critical Thinking','Quality of analytical reasoning',1,1,'Active'),
('SD02_02','D02','SD02_02','Decision Quality & Judgment','Quality of decisions under pressure',1,2,'Active'),
('SD02_03','D02','SD02_03','Managing Complexity','Ability to handle complex problems',1,3,'Active'),
('SD02_04','D02','SD02_04','Exam Strategy & Execution Skills','Strategic approach to exams',1,4,'Active'),
('SD02_05','D02','SD02_05','Strategy Execution','Ability to execute planned strategies',1,5,'Active'),
('SD02_06','D02','SD02_06','Complexity Tolerance','Tolerance for complex situations',1,6,'Active'),
('SD02_07','D02','SD02_07','Error Handling & Adaptive Execution','Handling errors during execution',1,7,'Active'),
('SD02_08','D02','SD02_08','Situational Judgment','Judgment under pressure',1,8,'Active'),
-- D03: Examination Stress & Emotional Regulation (9)
('SD03_01','D03','SD03_01','Stress Reactivity','Initial stress response',1,1,'Active'),
('SD03_02','D03','SD03_02','Emotional Regulation Ability','Ability to regulate emotions',1,2,'Active'),
('SD03_03','D03','SD03_03','Cognitive Control Under Stress','Maintaining cognitive function under stress',1,3,'Active'),
('SD03_04','D03','SD03_04','Execution Stability','Stability of performance under stress',1,4,'Active'),
('SD03_05','D03','SD03_05','Recovery & Reset Speed','Speed of recovery from stress',1,5,'Active'),
('SD03_06','D03','SD03_06','Stress Spillover Control','Preventing stress from affecting other areas',1,6,'Active'),
('SD03_07','D03','SD03_07','Anticipatory Stress Management','Managing stress before events',1,7,'Active'),
('SD03_08','D03','SD03_08','Emotional Insight & Awareness','Awareness of emotional states',1,8,'Active'),
('SD03_09','D03','SD03_09','Regulation Strategy Flexibility','Flexibility in using different strategies',1,9,'Active'),
-- D04: Confidence, Self-Concept & Comparison (9)
('SD04_01','D04','SD04_01','Academic Self-Confidence','Confidence in academic abilities',1,1,'Active'),
('SD04_02','D04','SD04_02','Confidence Stability','Consistency of confidence levels',1,2,'Active'),
('SD04_03','D04','SD04_03','Self-Concept Clarity','Clear understanding of self',1,3,'Active'),
('SD04_04','D04','SD04_04','Social Comparison Sensitivity','Tendency to compare with peers',1,4,'Active'),
('SD04_05','D04','SD04_05','Fear of Negative Evaluation','Concern about others judgments',1,5,'Active'),
('SD04_06','D04','SD04_06','Competence Attribution Style','How success/failure is attributed',1,6,'Active'),
('SD04_07','D04','SD04_07','External Validation Dependence','Need for external approval',1,7,'Active'),
('SD04_08','D04','SD04_08','Self-Doubt Intrusion','Frequency of self-doubt thoughts',1,8,'Active'),
('SD04_09','D04','SD04_09','Confidence-Performance Alignment','Match between confidence and actual performance',1,9,'Active'),
-- D05: Adjustment & Coping Capacity (4)
('SD05_01','D05','SD05_01','Academic Adjustment','Adjustment to academic demands',1,1,'Active'),
('SD05_02','D05','SD05_02','Emotional Adjustment','Emotional adaptation capacity',1,2,'Active'),
('SD05_03','D05','SD05_03','Social Adjustment','Social adaptation ability',1,3,'Active'),
('SD05_04','D05','SD05_04','Family Adjustment','Family relationship adjustment',1,4,'Active'),
-- D06: Social & Emotional Intelligence (4)
('SD06_01','D06','SD06_01','Emotional Regulation','Ability to regulate emotions',1,1,'Active'),
('SD06_02','D06','SD06_02','Relationships','Quality of interpersonal relationships',1,2,'Active'),
('SD06_03','D06','SD06_03','Trust','Level of trust in others',1,3,'Active'),
('SD06_04','D06','SD06_04','Inclusion','Sense of belonging and inclusion',1,4,'Active'),
-- D07: Discipline, Habits & Consistency (5)
('SD07_01','D07','SD07_01','Time & Priority Management','Ability to manage time and priorities',1,1,'Active'),
('SD07_02','D07','SD07_02','Accountability','Taking responsibility for actions',1,2,'Active'),
('SD07_03','D07','SD07_03','Execution Discipline','Discipline in executing tasks',1,3,'Active'),
('SD07_04','D07','SD07_04','Plan-Execution Alignment','Following through on plans',1,4,'Active'),
('SD07_05','D07','SD07_05','Consistency','Maintaining consistent effort',1,5,'Active'),
-- D08: Communication & Expression (5)
('SD08_01','D08','SD08_01','Listening','Active listening skills',1,1,'Active'),
('SD08_02','D08','SD08_02','Expression','Ability to express thoughts clearly',1,2,'Active'),
('SD08_03','D08','SD08_03','Influence','Ability to influence others',1,3,'Active'),
('SD08_04','D08','SD08_04','Conflict Handling','Managing conflicts effectively',1,4,'Active'),
('SD08_05','D08','SD08_05','Instruction Comprehension','Understanding instructions',1,5,'Active'),
-- D09: Motivation, Values & Responsibility (5)
('SD09_01','D09','SD09_01','Drive','Internal motivation and drive',1,1,'Active'),
('SD09_02','D09','SD09_02','Commitment Stability','Consistency of commitment',1,2,'Active'),
('SD09_03','D09','SD09_03','Integrity','Adherence to values',1,3,'Active'),
('SD09_04','D09','SD09_04','Ownership Patterns','Taking ownership of outcomes',1,4,'Active'),
('SD09_05','D09','SD09_05','Effort Persistence','Sustaining effort over time',1,5,'Active'),
-- D10: Lifestyle & Pressure Environment (4)
('SD10_01','D10','SD10_01','Digital Distraction','Impact of digital distractions',1,1,'Active'),
('SD10_02','D10','SD10_02','Sleep','Sleep quality and patterns',1,2,'Active'),
('SD10_03','D10','SD10_03','Parental Pressure','Level of parental pressure',1,3,'Active'),
('SD10_04','D10','SD10_04','Institutional Pressure','School/institution pressure',1,4,'Active'),
-- D11: Competitive Exam Readiness (5)
('SD11_01','D11','SD11_01','Performance Stability','Consistency in performance',1,1,'Active'),
('SD11_02','D11','SD11_02','Pressure Tolerance','Ability to handle pressure',1,2,'Active'),
('SD11_03','D11','SD11_03','Consistency','Maintaining consistent results',1,3,'Active'),
('SD11_04','D11','SD11_04','Performance Variance','Variation in performance levels',1,4,'Active'),
('SD11_05','D11','SD11_05','Recovery Speed','Speed of recovery after setbacks',1,5,'Active'),
-- D12: Integrated Root Cause Mapping (4)
('SD12_01','D12','SD12_01','Cross-Domain Synthesis','Ability to connect across domains',1,1,'Active'),
('SD12_02','D12','SD12_02','Cross-Module Clustering','Pattern recognition across modules',1,2,'Active'),
('SD12_03','D12','SD12_03','Temporal Weighting','Time-based pattern analysis',1,3,'Active'),
('SD12_04','D12','SD12_04','Human Confirmation Required','Need for expert validation',1,4,'Active'),
-- D13: Academic Planning & Recovery Intelligence (6)
('SD13_01','D13','SD13_01','Planning Realism','Realistic planning ability',1,1,'Active'),
('SD13_02','D13','SD13_02','Academic Prioritisation Intelligence','Smart prioritization of academics',1,2,'Active'),
('SD13_03','D13','SD13_03','Recovery Capacity After Setbacks','Bouncing back from failures',1,3,'Active'),
('SD13_04','D13','SD13_04','Strategy Correction Ability','Adjusting strategies when needed',1,4,'Active'),
('SD13_05','D13','SD13_05','Execution Feasibility','Realistic execution assessment',1,5,'Active'),
('SD13_06','D13','SD13_06','Short-Term Recovery Window','30-60 day recovery planning',1,6,'Active'),
-- D14: Metacognition & Self-Regulation (3)
('SD14_01','D14','SD14_01','Error Awareness','Awareness of own mistakes',1,1,'Active'),
('SD14_02','D14','SD14_02','Strategy Switching','Ability to change strategies',1,2,'Active'),
('SD14_03','D14','SD14_03','Self-Correction Timing','Timing of self-corrections',1,3,'Active'),
-- D15: Help-Seeking & Support Utilization (4)
('SD15_01','D15','SD15_01','Help-Seeking Hesitation','Reluctance to seek help',1,1,'Active'),
('SD15_02','D15','SD15_02','Trust in Authority','Trust in teachers and mentors',1,2,'Active'),
('SD15_03','D15','SD15_03','Response to Guidance','How well guidance is received',1,3,'Active'),
('SD15_04','D15','SD15_04','Silent Failure Prevention','Avoiding hidden struggles',1,4,'Active'),
-- D16: Academic Identity & Meaning (4)
('SD16_01','D16','SD16_01','Subject Relevance Perception','Seeing relevance of subjects',1,1,'Active'),
('SD16_02','D16','SD16_02','Sense of Agency','Feeling in control of learning',1,2,'Active'),
('SD16_03','D16','SD16_03','Identity Alignment','Academic goals align with identity',1,3,'Active'),
('SD16_04','D16','SD16_04','Long-Term Engagement Risk','Risk of disengagement over time',1,4,'Active'),
-- D17: Transition & Change Adaptability (6)
('SD17_01','D17','SD17_01','Flexibility','Mental flexibility',1,1,'Active'),
('SD17_02','D17','SD17_02','Uncertainty Tolerance','Comfort with uncertainty',1,2,'Active'),
('SD17_03','D17','SD17_03','Adaptation Speed','Speed of adaptation to change',1,3,'Active'),
('SD17_04','D17','SD17_04','Multi-Domain Instability','Instability across areas',1,4,'Active'),
('SD17_05','D17','SD17_05','Persistence of Disengagement','Lasting disengagement patterns',1,5,'Active'),
('SD17_06','D17','SD17_06','Recovery Delay','Delay in recovery process',1,6,'Active'),
-- D18: Teacher-Student Interaction Sensitivity (3)
('SD18_01','D18','SD18_01','Instruction Responsiveness','Response to teacher instructions',1,1,'Active'),
('SD18_02','D18','SD18_02','Feedback Sensitivity','Sensitivity to feedback',1,2,'Active'),
('SD18_03','D18','SD18_03','Authority Interaction Comfort','Comfort interacting with authority',1,3,'Active'),
-- D19: Over-Compliance Risk (3)
('SD19_01','D19','SD19_01','Excessive Compliance','Overly compliant behavior',1,1,'Active'),
('SD19_02','D19','SD19_02','Fear-Driven Obedience','Obedience based on fear',1,2,'Active'),
('SD19_03','D19','SD19_03','Suppressed Autonomy','Suppressed independent thinking',1,3,'Active')
ON CONFLICT (subdomain_code) DO UPDATE SET
  subdomain_name = EXCLUDED.subdomain_name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  status = EXCLUDED.status;

-- ─── 6 Age Bands ──────────────────────────────────────────────────────────
INSERT INTO lbi_age_bands (id, band_code, band_name, min_age, max_age, grade_range, status) VALUES
('ab1','AB1','Early Primary (6-8)',6,8,'Grades 1-3','Active'),
('ab2','AB2','Late Primary (9-11)',9,11,'Grades 4-6','Active'),
('ab3','AB3','Middle School (12-14)',12,14,'Grades 7-9','Active'),
('ab4','AB4','High School (15-17)',15,17,'Grades 10-12','Active'),
('ab5','AB5','College (18-21)',18,21,'UG','Active'),
('ab6','AB6','Working Professional (22+)',22,99,'Career','Active')
ON CONFLICT (band_code) DO UPDATE SET
  band_name = EXCLUDED.band_name,
  min_age = EXCLUDED.min_age,
  max_age = EXCLUDED.max_age,
  grade_range = EXCLUDED.grade_range,
  status = EXCLUDED.status;

-- ─── Mirror to lbi_modules / lbi_sub_modules (Super Admin UI tables) ──────
INSERT INTO lbi_modules (id, module_code, module_name, description, display_order, status)
SELECT id, domain_code, domain_name, description, display_order, status FROM lbi_domains
ON CONFLICT (module_code) DO UPDATE SET
  module_name = EXCLUDED.module_name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  status = EXCLUDED.status;

INSERT INTO lbi_sub_modules (id, module_id, sub_module_code, sub_module_name, question_type, description, display_order, status)
SELECT id, domain_id, subdomain_code, subdomain_name, 'likert', description, display_order, status FROM lbi_subdomains
ON CONFLICT (sub_module_code) DO UPDATE SET
  sub_module_name = EXCLUDED.sub_module_name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  status = EXCLUDED.status;

-- ─── Mirror age bands to lbi_age_groups ────────────────────────────────────
INSERT INTO lbi_age_groups (id, group_code, group_name, min_age, max_age, difficulty_level, status) VALUES
('age-a','A','Age Band A (6-10)',6,10,1,'Active'),
('age-b','B','Age Band B (11-14)',11,14,2,'Active'),
('age-c','C','Age Band C (15-18)',15,18,3,'Active'),
('age-d','D','Age Band D (18-21)',18,21,4,'Active'),
('age-e','E','Age Band E (22+)',22,99,5,'Active')
ON CONFLICT (group_code) DO UPDATE SET
  group_name = EXCLUDED.group_name,
  min_age = EXCLUDED.min_age,
  max_age = EXCLUDED.max_age,
  status = EXCLUDED.status;
