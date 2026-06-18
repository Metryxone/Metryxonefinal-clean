-- LBI Domains and Subdomains Seed Script
-- Run this to set up the 19 domains and 97 subdomains for the LBI assessment system

-- Clear existing data (if re-seeding)
DELETE FROM metra_question_bank WHERE 1=1;
DELETE FROM metra_sub_modules WHERE 1=1;
DELETE FROM metra_modules WHERE 1=1;

-- Insert 19 Domains
INSERT INTO metra_modules (id, module_code, module_name, description, display_order, status) VALUES
('D01', 'D01', 'Academic & Cognitive Effectiveness', 'Measures learning efficiency, conceptual understanding, memory, and attention', 1, 'Active'),
('D02', 'D02', 'Thinking Quality Under Pressure', 'Assesses analytical thinking, decision quality, and exam strategy execution', 2, 'Active'),
('D03', 'D03', 'Examination Stress & Emotional Regulation', 'Evaluates stress reactivity, emotional regulation, and recovery speed', 3, 'Active'),
('D04', 'D04', 'Confidence, Self-Concept & Comparison', 'Measures academic self-confidence, self-concept clarity, and comparison sensitivity', 4, 'Active'),
('D05', 'D05', 'Adjustment & Coping Capacity', 'Core module assessing academic, emotional, social, and family adjustment', 5, 'Active'),
('D06', 'D06', 'Social & Emotional Intelligence (SQ & EQ)', 'Evaluates emotional regulation, relationships, trust, and inclusion', 6, 'Active'),
('D07', 'D07', 'Discipline, Habits & Consistency', 'Measures time management, accountability, and execution discipline', 7, 'Active'),
('D08', 'D08', 'Communication & Expression', 'Assesses listening, expression, influence, and conflict handling', 8, 'Active'),
('D09', 'D09', 'Motivation, Values & Responsibility', 'Evaluates drive, commitment stability, integrity, and effort persistence', 9, 'Active'),
('D10', 'D10', 'Lifestyle & Pressure Environment', 'Measures digital distraction, sleep, parental and institutional pressure', 10, 'Active'),
('D11', 'D11', 'Competitive Exam Readiness', 'Optional add-on for performance stability and pressure tolerance', 11, 'Active'),
('D12', 'D12', 'Integrated Root Cause Mapping', 'Cross-domain synthesis and clustering analysis', 12, 'Active'),
('D13', 'D13', 'Academic Planning & Recovery Intelligence', 'Measures planning realism, prioritization, and recovery capacity', 13, 'Active'),
('D14', 'D14', 'Metacognition & Self-Regulation', 'Assesses error awareness, strategy switching, and self-correction', 14, 'Active'),
('D15', 'D15', 'Help-Seeking & Support Utilization', 'Evaluates help-seeking hesitation and response to guidance', 15, 'Active'),
('D16', 'D16', 'Academic Identity & Meaning', 'Measures subject relevance perception and sense of agency', 16, 'Active'),
('D17', 'D17', 'Transition & Change Adaptability', 'Assesses flexibility, uncertainty tolerance, and adaptation speed', 17, 'Active'),
('D18', 'D18', 'Teacher-Student Interaction Sensitivity', 'Evaluates instruction responsiveness and feedback sensitivity', 18, 'Active'),
('D19', 'D19', 'Over-Compliance Risk', 'Measures excessive compliance and suppressed autonomy', 19, 'Active')
ON CONFLICT (id) DO UPDATE SET module_name = EXCLUDED.module_name, description = EXCLUDED.description;

-- Copy to psychopsis_modules for FK compatibility
INSERT INTO psychopsis_modules (id, module_code, module_name, description, display_order, status)
SELECT id, module_code, module_name, description, display_order, status FROM metra_modules
ON CONFLICT (id) DO UPDATE SET module_code = EXCLUDED.module_code, module_name = EXCLUDED.module_name;

-- Insert all Subdomains
-- D01: Academic & Cognitive Effectiveness (6 subdomains)
INSERT INTO metra_sub_modules (id, module_id, sub_module_code, sub_module_name, question_type, description, display_order, status) VALUES
('SD01_01', 'D01', 'SD01_01', 'Learning Efficiency', 'likert', 'How effectively the student absorbs new information', 1, 'Active'),
('SD01_02', 'D01', 'SD01_02', 'Conceptual Understanding', 'likert', 'Depth of understanding core concepts', 2, 'Active'),
('SD01_03', 'D01', 'SD01_03', 'Working & Retrieval Memory', 'likert', 'Memory retention and recall ability', 3, 'Active'),
('SD01_04', 'D01', 'SD01_04', 'Sustained Attention', 'likert', 'Ability to maintain focus over time', 4, 'Active'),
('SD01_05', 'D01', 'SD01_05', 'Learning Style', 'likert', 'Preferred learning approach', 5, 'Active'),
('SD01_06', 'D01', 'SD01_06', 'Processing Stability', 'likert', 'Consistency in information processing', 6, 'Active'),
-- D02: Thinking Quality Under Pressure (8 subdomains)
('SD02_01', 'D02', 'SD02_01', 'Analytical & Critical Thinking', 'likert', 'Quality of analytical reasoning', 1, 'Active'),
('SD02_02', 'D02', 'SD02_02', 'Decision Quality & Judgment', 'likert', 'Quality of decisions under pressure', 2, 'Active'),
('SD02_03', 'D02', 'SD02_03', 'Managing Complexity', 'likert', 'Ability to handle complex problems', 3, 'Active'),
('SD02_04', 'D02', 'SD02_04', 'Exam Strategy & Execution Skills', 'likert', 'Strategic approach to exams', 4, 'Active'),
('SD02_05', 'D02', 'SD02_05', 'Strategy Execution', 'likert', 'Ability to execute planned strategies', 5, 'Active'),
('SD02_06', 'D02', 'SD02_06', 'Complexity Tolerance', 'likert', 'Tolerance for complex situations', 6, 'Active'),
('SD02_07', 'D02', 'SD02_07', 'Error Handling & Adaptive Execution', 'likert', 'Handling errors during execution', 7, 'Active'),
('SD02_08', 'D02', 'SD02_08', 'Situational Judgment', 'likert', 'Judgment under pressure', 8, 'Active'),
-- D03: Examination Stress & Emotional Regulation (9 subdomains)
('SD03_01', 'D03', 'SD03_01', 'Stress Reactivity', 'likert', 'Initial stress response', 1, 'Active'),
('SD03_02', 'D03', 'SD03_02', 'Emotional Regulation Ability', 'likert', 'Ability to regulate emotions', 2, 'Active'),
('SD03_03', 'D03', 'SD03_03', 'Cognitive Control Under Stress', 'likert', 'Maintaining cognitive function under stress', 3, 'Active'),
('SD03_04', 'D03', 'SD03_04', 'Execution Stability', 'likert', 'Stability of performance under stress', 4, 'Active'),
('SD03_05', 'D03', 'SD03_05', 'Recovery & Reset Speed', 'likert', 'Speed of recovery from stress', 5, 'Active'),
('SD03_06', 'D03', 'SD03_06', 'Stress Spillover Control', 'likert', 'Preventing stress from affecting other areas', 6, 'Active'),
('SD03_07', 'D03', 'SD03_07', 'Anticipatory Stress Management', 'likert', 'Managing stress before events', 7, 'Active'),
('SD03_08', 'D03', 'SD03_08', 'Emotional Insight & Awareness', 'likert', 'Awareness of emotional states', 8, 'Active'),
('SD03_09', 'D03', 'SD03_09', 'Regulation Strategy Flexibility', 'likert', 'Flexibility in using different strategies', 9, 'Active'),
-- D04: Confidence, Self-Concept & Comparison (9 subdomains)
('SD04_01', 'D04', 'SD04_01', 'Academic Self-Confidence', 'likert', 'Confidence in academic abilities', 1, 'Active'),
('SD04_02', 'D04', 'SD04_02', 'Confidence Stability', 'likert', 'Consistency of confidence levels', 2, 'Active'),
('SD04_03', 'D04', 'SD04_03', 'Self-Concept Clarity', 'likert', 'Clear understanding of self', 3, 'Active'),
('SD04_04', 'D04', 'SD04_04', 'Social Comparison Sensitivity', 'likert', 'Tendency to compare with peers', 4, 'Active'),
('SD04_05', 'D04', 'SD04_05', 'Fear of Negative Evaluation', 'likert', 'Concern about others judgments', 5, 'Active'),
('SD04_06', 'D04', 'SD04_06', 'Competence Attribution Style', 'likert', 'How success/failure is attributed', 6, 'Active'),
('SD04_07', 'D04', 'SD04_07', 'External Validation Dependence', 'likert', 'Need for external approval', 7, 'Active'),
('SD04_08', 'D04', 'SD04_08', 'Self-Doubt Intrusion', 'likert', 'Frequency of self-doubt thoughts', 8, 'Active'),
('SD04_09', 'D04', 'SD04_09', 'Confidence-Performance Alignment', 'likert', 'Match between confidence and actual performance', 9, 'Active'),
-- D05: Adjustment & Coping Capacity (4 subdomains)
('SD05_01', 'D05', 'SD05_01', 'Academic Adjustment', 'likert', 'Adjustment to academic demands', 1, 'Active'),
('SD05_02', 'D05', 'SD05_02', 'Emotional Adjustment', 'likert', 'Emotional adaptation capacity', 2, 'Active'),
('SD05_03', 'D05', 'SD05_03', 'Social Adjustment', 'likert', 'Social adaptation ability', 3, 'Active'),
('SD05_04', 'D05', 'SD05_04', 'Family Adjustment', 'likert', 'Family relationship adjustment', 4, 'Active'),
-- D06: Social & Emotional Intelligence (4 subdomains)
('SD06_01', 'D06', 'SD06_01', 'Emotional Regulation', 'likert', 'Ability to regulate emotions', 1, 'Active'),
('SD06_02', 'D06', 'SD06_02', 'Relationships', 'likert', 'Quality of interpersonal relationships', 2, 'Active'),
('SD06_03', 'D06', 'SD06_03', 'Trust', 'likert', 'Level of trust in others', 3, 'Active'),
('SD06_04', 'D06', 'SD06_04', 'Inclusion', 'likert', 'Sense of belonging and inclusion', 4, 'Active'),
-- D07: Discipline, Habits & Consistency (5 subdomains)
('SD07_01', 'D07', 'SD07_01', 'Time & Priority Management', 'likert', 'Ability to manage time and priorities', 1, 'Active'),
('SD07_02', 'D07', 'SD07_02', 'Accountability', 'likert', 'Taking responsibility for actions', 2, 'Active'),
('SD07_03', 'D07', 'SD07_03', 'Execution Discipline', 'likert', 'Discipline in executing tasks', 3, 'Active'),
('SD07_04', 'D07', 'SD07_04', 'Plan-Execution Alignment', 'likert', 'Following through on plans', 4, 'Active'),
('SD07_05', 'D07', 'SD07_05', 'Consistency', 'likert', 'Maintaining consistent effort', 5, 'Active'),
-- D08: Communication & Expression (5 subdomains)
('SD08_01', 'D08', 'SD08_01', 'Listening', 'likert', 'Active listening skills', 1, 'Active'),
('SD08_02', 'D08', 'SD08_02', 'Expression', 'likert', 'Ability to express thoughts clearly', 2, 'Active'),
('SD08_03', 'D08', 'SD08_03', 'Influence', 'likert', 'Ability to influence others', 3, 'Active'),
('SD08_04', 'D08', 'SD08_04', 'Conflict Handling', 'likert', 'Managing conflicts effectively', 4, 'Active'),
('SD08_05', 'D08', 'SD08_05', 'Instruction Comprehension', 'likert', 'Understanding instructions', 5, 'Active'),
-- D09: Motivation, Values & Responsibility (5 subdomains)
('SD09_01', 'D09', 'SD09_01', 'Drive', 'likert', 'Internal motivation and drive', 1, 'Active'),
('SD09_02', 'D09', 'SD09_02', 'Commitment Stability', 'likert', 'Consistency of commitment', 2, 'Active'),
('SD09_03', 'D09', 'SD09_03', 'Integrity', 'likert', 'Adherence to values', 3, 'Active'),
('SD09_04', 'D09', 'SD09_04', 'Ownership Patterns', 'likert', 'Taking ownership of outcomes', 4, 'Active'),
('SD09_05', 'D09', 'SD09_05', 'Effort Persistence', 'likert', 'Sustaining effort over time', 5, 'Active'),
-- D10: Lifestyle & Pressure Environment (4 subdomains)
('SD10_01', 'D10', 'SD10_01', 'Digital Distraction', 'likert', 'Impact of digital distractions', 1, 'Active'),
('SD10_02', 'D10', 'SD10_02', 'Sleep', 'likert', 'Sleep quality and patterns', 2, 'Active'),
('SD10_03', 'D10', 'SD10_03', 'Parental Pressure', 'likert', 'Level of parental pressure', 3, 'Active'),
('SD10_04', 'D10', 'SD10_04', 'Institutional Pressure', 'likert', 'School/institution pressure', 4, 'Active'),
-- D11: Competitive Exam Readiness (5 subdomains)
('SD11_01', 'D11', 'SD11_01', 'Performance Stability', 'likert', 'Consistency in performance', 1, 'Active'),
('SD11_02', 'D11', 'SD11_02', 'Pressure Tolerance', 'likert', 'Ability to handle pressure', 2, 'Active'),
('SD11_03', 'D11', 'SD11_03', 'Consistency', 'likert', 'Maintaining consistent results', 3, 'Active'),
('SD11_04', 'D11', 'SD11_04', 'Performance Variance', 'likert', 'Variation in performance levels', 4, 'Active'),
('SD11_05', 'D11', 'SD11_05', 'Recovery Speed', 'likert', 'Speed of recovery after setbacks', 5, 'Active'),
-- D12: Integrated Root Cause Mapping (4 subdomains)
('SD12_01', 'D12', 'SD12_01', 'Cross-Domain Synthesis', 'likert', 'Ability to connect across domains', 1, 'Active'),
('SD12_02', 'D12', 'SD12_02', 'Cross-Module Clustering', 'likert', 'Pattern recognition across modules', 2, 'Active'),
('SD12_03', 'D12', 'SD12_03', 'Temporal Weighting', 'likert', 'Time-based pattern analysis', 3, 'Active'),
('SD12_04', 'D12', 'SD12_04', 'Human Confirmation Required', 'likert', 'Need for expert validation', 4, 'Active'),
-- D13: Academic Planning & Recovery Intelligence (6 subdomains)
('SD13_01', 'D13', 'SD13_01', 'Planning Realism', 'likert', 'Realistic planning ability', 1, 'Active'),
('SD13_02', 'D13', 'SD13_02', 'Academic Prioritisation Intelligence', 'likert', 'Smart prioritization of academics', 2, 'Active'),
('SD13_03', 'D13', 'SD13_03', 'Recovery Capacity After Setbacks', 'likert', 'Bouncing back from failures', 3, 'Active'),
('SD13_04', 'D13', 'SD13_04', 'Strategy Correction Ability', 'likert', 'Adjusting strategies when needed', 4, 'Active'),
('SD13_05', 'D13', 'SD13_05', 'Execution Feasibility', 'likert', 'Realistic execution assessment', 5, 'Active'),
('SD13_06', 'D13', 'SD13_06', 'Short-Term Recovery Window', 'likert', '30-60 day recovery planning', 6, 'Active'),
-- D14: Metacognition & Self-Regulation (3 subdomains)
('SD14_01', 'D14', 'SD14_01', 'Error Awareness', 'likert', 'Awareness of own mistakes', 1, 'Active'),
('SD14_02', 'D14', 'SD14_02', 'Strategy Switching', 'likert', 'Ability to change strategies', 2, 'Active'),
('SD14_03', 'D14', 'SD14_03', 'Self-Correction Timing', 'likert', 'Timing of self-corrections', 3, 'Active'),
-- D15: Help-Seeking & Support Utilization (4 subdomains)
('SD15_01', 'D15', 'SD15_01', 'Help-Seeking Hesitation', 'likert', 'Reluctance to seek help', 1, 'Active'),
('SD15_02', 'D15', 'SD15_02', 'Trust in Authority', 'likert', 'Trust in teachers and mentors', 2, 'Active'),
('SD15_03', 'D15', 'SD15_03', 'Response to Guidance', 'likert', 'How well guidance is received', 3, 'Active'),
('SD15_04', 'D15', 'SD15_04', 'Silent Failure Prevention', 'likert', 'Avoiding hidden struggles', 4, 'Active'),
-- D16: Academic Identity & Meaning (4 subdomains)
('SD16_01', 'D16', 'SD16_01', 'Subject Relevance Perception', 'likert', 'Seeing relevance of subjects', 1, 'Active'),
('SD16_02', 'D16', 'SD16_02', 'Sense of Agency', 'likert', 'Feeling in control of learning', 2, 'Active'),
('SD16_03', 'D16', 'SD16_03', 'Identity Alignment', 'likert', 'Academic goals align with identity', 3, 'Active'),
('SD16_04', 'D16', 'SD16_04', 'Long-Term Engagement Risk', 'likert', 'Risk of disengagement over time', 4, 'Active'),
-- D17: Transition & Change Adaptability (6 subdomains)
('SD17_01', 'D17', 'SD17_01', 'Flexibility', 'likert', 'Mental flexibility', 1, 'Active'),
('SD17_02', 'D17', 'SD17_02', 'Uncertainty Tolerance', 'likert', 'Comfort with uncertainty', 2, 'Active'),
('SD17_03', 'D17', 'SD17_03', 'Adaptation Speed', 'likert', 'Speed of adaptation to change', 3, 'Active'),
('SD17_04', 'D17', 'SD17_04', 'Multi-Domain Instability', 'likert', 'Instability across areas', 4, 'Active'),
('SD17_05', 'D17', 'SD17_05', 'Persistence of Disengagement', 'likert', 'Lasting disengagement patterns', 5, 'Active'),
('SD17_06', 'D17', 'SD17_06', 'Recovery Delay', 'likert', 'Delay in recovery process', 6, 'Active'),
-- D18: Teacher-Student Interaction Sensitivity (3 subdomains)
('SD18_01', 'D18', 'SD18_01', 'Instruction Responsiveness', 'likert', 'Response to teacher instructions', 1, 'Active'),
('SD18_02', 'D18', 'SD18_02', 'Feedback Sensitivity', 'likert', 'Sensitivity to feedback', 2, 'Active'),
('SD18_03', 'D18', 'SD18_03', 'Authority Interaction Comfort', 'likert', 'Comfort interacting with authority', 3, 'Active'),
-- D19: Over-Compliance Risk (3 subdomains)
('SD19_01', 'D19', 'SD19_01', 'Excessive Compliance', 'likert', 'Overly compliant behavior', 1, 'Active'),
('SD19_02', 'D19', 'SD19_02', 'Fear-Driven Obedience', 'likert', 'Obedience based on fear', 2, 'Active'),
('SD19_03', 'D19', 'SD19_03', 'Suppressed Autonomy', 'likert', 'Suppressed independent thinking', 3, 'Active')
ON CONFLICT (id) DO UPDATE SET sub_module_name = EXCLUDED.sub_module_name, description = EXCLUDED.description;

-- Ensure age groups exist
INSERT INTO metra_age_groups (id, group_code, group_name, min_age, max_age, difficulty_level, status) VALUES
('age-a', 'A', 'Age Band A (6-10)', 6, 10, 1, 'Active'),
('age-b', 'B', 'Age Band B (11-14)', 11, 14, 2, 'Active'),
('age-c', 'C', 'Age Band C (15-18)', 15, 18, 3, 'Active')
ON CONFLICT (id) DO UPDATE SET group_name = EXCLUDED.group_name;

-- Copy age groups to psychopsis_age_groups for FK compatibility
INSERT INTO psychopsis_age_groups (id, group_code, group_name, min_age, max_age, difficulty_level, status)
SELECT id, group_code, group_name, min_age, max_age, difficulty_level, status FROM metra_age_groups
ON CONFLICT (id) DO UPDATE SET group_name = EXCLUDED.group_name;
