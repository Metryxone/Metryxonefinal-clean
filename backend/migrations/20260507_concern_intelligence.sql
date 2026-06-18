-- ─── CAPADEX Concern Intelligence Engine — DB-backed rule tables ──────────────
-- Migrates all hardcoded constants from capadex-concern-intelligence.ts into
-- editable, admin-manageable database tables.

CREATE TABLE IF NOT EXISTS ci_categories (
  id           SERIAL PRIMARY KEY,
  cat_key      VARCHAR(50) UNIQUE NOT NULL,
  label        VARCHAR(100) NOT NULL,
  keywords     TEXT NOT NULL DEFAULT '',
  severity_high TEXT DEFAULT NULL,
  severity_low  TEXT DEFAULT NULL,
  default_signals   JSONB NOT NULL DEFAULT '[]',
  patterns          JSONB NOT NULL DEFAULT '[]',
  subdomains        JSONB NOT NULL DEFAULT '[]',
  preview_templates JSONB NOT NULL DEFAULT '[]',
  mirror_templates  JSONB NOT NULL DEFAULT '[]',
  sort_order   INT DEFAULT 0,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ci_clarification_questions (
  id           SERIAL PRIMARY KEY,
  question_key VARCHAR(120) UNIQUE NOT NULL,
  category     VARCHAR(50) NOT NULL,
  persona      VARCHAR(50) DEFAULT NULL,
  sort_order   INT DEFAULT 0,
  question     TEXT NOT NULL,
  options      JSONB NOT NULL DEFAULT '[]',
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Seed Categories ──────────────────────────────────────────────────────────
INSERT INTO ci_categories (cat_key, label, keywords, default_signals, patterns, subdomains, preview_templates, mirror_templates, sort_order) VALUES
('digital', 'Digital & Screen', 'screen|phone|gaming|social.?media|digital|internet|device|app\b|online|tiktok|youtube|instagram|whatsapp|netflix|scroll|reels|video|addicted to (phone|screen|device|social)',
  '["Compulsive urges","Restlessness","Withdrawal discomfort"]',
  '["Digital Dependency Pattern","Attention Fragmentation","Reward-Loop Dysregulation"]',
  '["Digital Self-Regulation","Attention Control","Habit Architecture","Impulse Management"]',
  '["Possible Digital Behaviour Pattern Detected","Attention Fragmentation Indicators Present","Strong Recovery & Re-regulation Potential"]',
  '["Feel a strong pull to check devices even when you don''t want to","Notice time disappearing while browsing or watching content","Find it harder to focus on non-digital tasks over time","Feel restless or irritable when away from screens"]',
  1),
('academic', 'Academic & Study', 'study|exam|homework|academic|school|grade|learning|class|marks|syllabus|university|college|test|assignment|project|tuition|cbse|board|concentrate while study|focus (while|during|for) study|retention',
  '["Performance anxiety","Self-doubt","Overwhelm"]',
  '["Focus Inconsistency","Cognitive Load Imbalance","Performance Anxiety Loop"]',
  '["Focus & Concentration","Cognitive Retention","Study Consistency","Exam Readiness"]',
  '["Possible Focus Inconsistency Pattern Detected","Cognitive Load & Fatigue Indicators Present","High Learning Recovery Readiness Identified"]',
  '["Sit down to study but feel the mind drifting after a few minutes","Read the same paragraph multiple times without it registering","Feel frustrated after long study sessions with little to show","Experience inconsistent focus — sharp sometimes, scattered others"]',
  2),
('emotional', 'Emotional & Mental Health', 'anxi|stress|emotion|mood|depress|worry|fear|lonel|mental health|wellbeing|sad|overwhelm|burnout|exhaust|frustrat|hopeless|panic|breakdown|crying|low mood',
  '["Emotional load","Mental fatigue","Vulnerability"]',
  '["Emotional Regulation Challenge","Stress Response Sensitivity","Resilience Depletion"]',
  '["Emotional Regulation","Resilience Capacity","Stress Tolerance","Emotional Awareness"]',
  '["Possible Emotional Regulation Challenge Detected","Elevated Stress Response Indicators","Strong Emotional Resilience Potential Identified"]',
  '["Feel mentally overloaded even without obvious reasons","Find emotional reactions stronger or less predictable than before","Struggle to switch off even during rest or leisure","Feel like resilience reserves are lower than they used to be"]',
  3),
('behavioural', 'Behavioural & Habits', 'focus|attent|distract|concentrat|procrastin|impulsiv|hyperactiv|restless|fidget|habit|discipline|routine|motivat|lazy|productiv|time.?management|self.?control',
  '["Frustration","Low motivation","Self-criticism"]',
  '["Attention Dysregulation","Habit Resistance Pattern","Motivation Depletion Loop"]',
  '["Behavioural Discipline","Habit Formation","Self-Motivation","Goal Consistency"]',
  '["Possible Attention Dysregulation Pattern Detected","Habit Resistance & Motivation Indicators","High Behavioural Growth Readiness Detected"]',
  '["Start tasks with good intentions but find focus slipping quickly","Build routines that work briefly then seem to fall apart","Feel frustrated by the gap between knowing what to do and doing it","Experience low energy and motivation for previously enjoyable activities"]',
  4),
('social', 'Social & Interpersonal', 'social|peer|friend|relation|communicat|conflict|bully|shy|introvert|isolat|loneli|awkward|interacting|crowd|public speaking|group|team',
  '["Social anxiety","Loneliness","Self-consciousness"]',
  '["Social Avoidance Pattern","Self-Presentation Anxiety","Peer Relation Strain"]',
  '["Interpersonal Skills","Social Confidence","Communication Clarity","Peer Integration"]',
  '["Possible Social Avoidance Pattern Detected","Interpersonal Anxiety & Confidence Indicators","Strong Social Growth Potential Identified"]',
  '["Feel more comfortable alone than in group settings","Overthink interactions before, during, or after they happen","Struggle to initiate or sustain conversations naturally","Experience relief when social obligations are cancelled"]',
  5),
('career', 'Career & Direction', 'career|job|employ|skill|workplace|interview|professional|future|path|direction|purpose|passion|calling|industry|internship',
  '["Uncertainty","Confusion","Pressure"]',
  '["Direction Ambiguity","Identity-Role Mismatch","Decision Paralysis"]',
  '["Career Clarity","Skill Mapping","Professional Identity","Decision Intelligence"]',
  '["Possible Career Direction Ambiguity Detected","Identity-Role Mismatch Indicators Present","Strong Purposeful Action Readiness Detected"]',
  '["Feel unclear about the direction that truly fits","Compare progress with peers and feel behind or lost","Start exploring paths but lose confidence or interest quickly","Feel pressure to decide without having enough self-clarity"]',
  6),
('wellness', 'Wellness & Health', 'sleep|eat|health|tired|fatigue|energy|wellness|exercise|weight|nutrition|diet|headache|physical|body|pain',
  '["Physical fatigue","Low energy","Discomfort"]',
  '["Energy Regulation Imbalance","Recovery Deficit Pattern","Physical-Mental Fatigue Loop"]',
  '["Energy Management","Sleep Quality","Physical Discipline","Recovery Systems"]',
  '["Possible Energy Regulation Imbalance Detected","Physical-Mental Fatigue Indicators Present","Strong Recovery & Renewal Potential Identified"]',
  '["Feel physical energy not matching what''s needed for the day","Notice that rest doesn''t feel as restorative as it should","Find physical symptoms affecting mental focus and mood","Feel caught in cycles of low energy despite wanting to feel better"]',
  7),
('general', 'General', '',
  '["Worry","Uncertainty","Stress"]',
  '["Adaptive Strain Pattern","Coping Mechanism Overload","Growth Readiness Signal"]',
  '["Behavioural Awareness","Adaptive Thinking","Growth Orientation","Self-Regulation"]',
  '["Possible Adaptive Strain Pattern Detected","Coping System Overload Indicators","Significant Growth Readiness Identified"]',
  '["Feel like something is off without being able to name it clearly","Experience inconsistency in ability to manage day-to-day demands","Notice growing gap between how things are and how you''d like them to be","Feel ready for change but uncertain where to start"]',
  8)
ON CONFLICT (cat_key) DO NOTHING;

-- ─── Seed Base Clarification Questions ────────────────────────────────────────
INSERT INTO ci_clarification_questions (question_key, category, persona, sort_order, question, options) VALUES
-- Digital (base)
('digital_duration', 'digital', NULL, 1, 'How many hours per day do you typically spend on screens outside of work or study?', '["Less than 2 hours","2–4 hours","4–6 hours","More than 6 hours"]'),
('digital_trigger',  'digital', NULL, 2, 'When does the urge to use your device feel strongest?', '["When bored or idle","While trying to study or work","Late at night","During social situations"]'),
('digital_impact',   'digital', NULL, 3, 'How much is this affecting your daily life right now?', '["Mildly — I can manage it","Moderately — causing some disruption","Significantly — hard to function","Severely — it''s taking over"]'),
-- Academic (base)
('academic_when',     'academic', NULL, 1, 'When does this concern show up most often for you?', '["During study sessions","Before or during exams","When working on projects","Throughout the whole day"]'),
('academic_feel',     'academic', NULL, 2, 'Which best describes what you experience in those moments?', '["Mind goes blank or wanders","Feel mentally tired and heavy","Feel anxious or under pressure","Feel bored or unmotivated"]'),
('academic_duration', 'academic', NULL, 3, 'How long has this been affecting you?', '["Just recently (a few days)","A few weeks","Several months","Over a year"]'),
-- Emotional (base)
('emotional_frequency', 'emotional', NULL, 1, 'How often do you experience this?', '["Occasionally","A few times a week","Almost every day","Constantly — it''s always there"]'),
('emotional_impact',    'emotional', NULL, 2, 'Does it affect your work, studies, or relationships?', '["Not much yet","Sometimes","Frequently","Almost always"]'),
('emotional_intensity', 'emotional', NULL, 3, 'How would you describe its intensity right now?', '["Mild — manageable","Moderate — draining","Significant — affecting daily life","Severe — hard to cope"]'),
-- Behavioural (base)
('behavioural_trigger',  'behavioural', NULL, 1, 'What tends to trigger this pattern most?', '["Being tired or low energy","Facing difficult or boring tasks","External distractions","Feeling overwhelmed by the size of the task"]'),
('behavioural_duration', 'behavioural', NULL, 2, 'How long have you noticed this pattern?', '["Recently (days to weeks)","A few months","Most of this year","For as long as I can remember"]'),
('behavioural_tried',    'behavioural', NULL, 3, 'What have you tried so far to address it?', '["Nothing yet — just noticed it","A few tips or habits, didn''t stick","Sought advice or help","Tried many things with limited success"]'),
-- Social (base)
('social_situation', 'social', NULL, 1, 'Which social situations feel most challenging?', '["Large groups or events","One-on-one conversations","Meeting new people","Speaking up in class or meetings"]'),
('social_feeling',   'social', NULL, 2, 'What do you feel most strongly in those moments?', '["Anxiety or nervousness","A strong urge to escape","Self-consciousness or embarrassment","Confusion about what to say"]'),
('social_impact',    'social', NULL, 3, 'How much is this limiting your life?', '["Mildly — occasional discomfort","Moderately — avoiding some situations","Significantly — missing opportunities","Severely — very isolated"]'),
-- Career (base)
('career_stage',    'career', NULL, 1, 'Where are you in your career or education journey?', '["Still in school/college","Just starting out","Mid-career, feeling stuck","Considering a change"]'),
('career_challenge','career', NULL, 2, 'What feels most uncertain right now?', '["I don''t know what I want","I know what I want but don''t know how","I''m comparing myself to others","External pressure is guiding my choices"]'),
('career_duration', 'career', NULL, 3, 'How long have you felt this way?', '["Just recently","A few months","Over a year","Most of my life"]'),
-- Wellness (base)
('wellness_type',     'wellness', NULL, 1, 'Which area feels most out of balance?', '["Sleep and rest","Physical energy and exercise","Eating habits and nutrition","Overall health routines"]'),
('wellness_impact',   'wellness', NULL, 2, 'How does it affect your mental performance?', '["Mildly — minor tiredness","Moderately — lower focus","Significantly — hard to function","Severely — affecting everything"]'),
('wellness_duration', 'wellness', NULL, 3, 'How long has this been a concern?', '["Just recently","A few weeks","Several months","Over a year"]'),
-- General (base)
('general_when',     'general', NULL, 1, 'When does this concern affect you most?', '["During study or work","In social situations","Late evenings or mornings","Throughout the whole day"]'),
('general_duration', 'general', NULL, 2, 'How long has this been affecting you?', '["Just noticed it (days)","A few weeks","Several months","Over a year"]'),
('general_impact',   'general', NULL, 3, 'How much is it impacting your daily life?', '["Mildly — still managing","Moderately — some disruption","Significantly — hard to function","Severely — taking over"]'),

-- ─── Persona: parent ──────────────────────────────────────────────────────────
('par_acad_when',     'academic',   'parent', 1, 'When does your child''s concern show up most?', '["During homework or self-study","Before or during exams","In online classes or school sessions","Throughout the whole school day"]'),
('par_acad_feel',     'academic',   'parent', 2, 'What does your child most commonly experience?', '["Gets distracted and loses focus easily","Feels overwhelmed or mentally tired","Gets anxious about performance","Loses interest and motivation quickly"]'),
('par_acad_duration', 'academic',   'parent', 3, 'How long has your child been facing this?', '["Just recently (a few days)","A few weeks","Several months","Over a year"]'),
('par_digital_duration','digital',  'parent', 1, 'How many hours per day does your child spend on screens beyond schoolwork?', '["Less than 2 hours","2–4 hours","4–6 hours","More than 6 hours"]'),
('par_digital_trigger', 'digital',  'parent', 2, 'When does screen use become most problematic?', '["During study or homework time","At mealtimes or family time","Late at night — affecting sleep","Whenever a device is within reach"]'),
('par_digital_impact',  'digital',  'parent', 3, 'How is it affecting your child''s daily life?', '["Mildly — still manageable","Moderately — causing some conflict","Significantly — affecting school and health","Severely — it''s a major concern"]'),
('par_beh_trigger',     'behavioural','parent',1,'When does this behaviour pattern appear most?', '["During homework or study time","When asked to follow routines","In social situations with peers","At home, throughout the day"]'),
('par_beh_duration',    'behavioural','parent',2,'How long have you observed this pattern?', '["Recently (days to weeks)","A few months","Most of this year","For as long as I can remember"]'),
('par_beh_tried',       'behavioural','parent',3,'What approaches have you tried so far?', '["Just noticed it — haven''t acted yet","Set rules or structure at home","Spoken to the school or a counsellor","Tried many things with limited success"]'),
('par_social_situation','social',   'parent', 1, 'Which situations seem hardest for your child?', '["Making or keeping friends","Group activities or team situations","Speaking up in class or public","Managing conflicts with peers"]'),
('par_social_feeling',  'social',   'parent', 2, 'What do you most notice in your child?', '["Withdraws or avoids social situations","Gets anxious before social events","Struggles to communicate clearly","Gets upset or aggressive with peers"]'),
('par_social_impact',   'social',   'parent', 3, 'How much is this affecting their daily life?', '["Mildly — occasional difficulty","Moderately — some avoidance","Significantly — missing out on activities","Severely — very isolated"]'),
('par_emo_frequency',   'emotional','parent', 1, 'How often do you notice this in your child?', '["Occasionally","A few times a week","Almost every day","Constantly — it''s always present"]'),
('par_emo_impact',      'emotional','parent', 2, 'How is it affecting their school and home life?', '["Mild — still functioning well","Moderate — some disruption","Significant — affecting daily routine","Severe — very hard to manage"]'),
('par_emo_intensity',   'emotional','parent', 3, 'How would you describe its intensity right now?', '["Mild — passes quickly","Moderate — lingers and drains","Significant — affecting school life","Severe — hard to cope with"]'),

-- ─── Persona: professional ────────────────────────────────────────────────────
('pro_academic_when',     'academic',   'professional', 1, 'When does this concern affect your work performance most?', '["During meetings or presentations","While working independently on tasks","Under tight deadlines or high pressure","Throughout the entire workday"]'),
('pro_academic_feel',     'academic',   'professional', 2, 'What do you experience most in those moments?', '["Mind wanders or loses focus","Feel mentally drained and sluggish","Feel anxious or overwhelmed","Feel disengaged or unmotivated"]'),
('pro_academic_duration', 'academic',   'professional', 3, 'How long has this been affecting your work?', '["Just recently (a few days)","A few weeks","Several months","Over a year"]'),
('pro_beh_trigger',       'behavioural','professional', 1, 'What tends to trigger this pattern most at work?', '["Work overload or unclear priorities","Tedious or repetitive tasks","Workplace distractions","Feeling undervalued or stuck"]'),
('pro_beh_duration',      'behavioural','professional', 2, 'How long have you noticed this pattern?', '["Recently (days to weeks)","A few months","Most of this year","For as long as I can remember"]'),
('pro_beh_tried',         'behavioural','professional', 3, 'What have you tried so far to address it?', '["Nothing yet — just noticed it","A few strategies, didn''t stick","Sought coaching or advice","Tried many approaches with limited success"]'),
('pro_social_situation',  'social',     'professional', 1, 'Which professional situations feel most challenging?', '["Team meetings or group discussions","Client or stakeholder interactions","Networking or professional events","Managing or presenting to others"]'),
('pro_social_feeling',    'social',     'professional', 2, 'What do you feel most strongly in those moments?', '["Anxiety or self-consciousness","A strong urge to avoid or withdraw","Difficulty finding the right words","Fear of being judged or evaluated"]'),
('pro_social_impact',     'social',     'professional', 3, 'How much is this limiting your career or relationships?', '["Mildly — occasional discomfort","Moderately — avoiding some situations","Significantly — missing opportunities","Severely — it''s holding me back"]'),
('pro_career_stage',      'career',     'professional', 1, 'Where are you in your professional journey right now?', '["Early career — finding my footing","Mid-career — feeling stuck or restless","Considering a major career change","Leadership level — questioning direction"]'),
('pro_career_challenge',  'career',     'professional', 2, 'What feels most uncertain right now?', '["I don''t know what truly fulfils me","I know what I want but don''t know how to get there","Comparing myself to peers and feeling behind","External expectations are driving my choices"]'),
('pro_career_duration',   'career',     'professional', 3, 'How long have you felt this way?', '["Just recently","A few months","Over a year","Most of my career"]'),
('pro_digital_duration',  'digital',    'professional', 1, 'How many hours per day are you on screens outside of core work tasks?', '["Less than 1 hour","1–3 hours","3–5 hours","More than 5 hours"]'),
('pro_digital_trigger',   'digital',    'professional', 2, 'When does the urge to check devices or social media feel strongest at work?', '["During focused or difficult tasks","In meetings or calls","During breaks — hard to disconnect","Late evenings after work"]'),
('pro_digital_impact',    'digital',    'professional', 3, 'How much is this affecting your work output?', '["Mildly — I can manage it","Moderately — reducing productivity","Significantly — affecting deliverables","Severely — it''s taking over work time"]'),

-- ─── Persona: campus ──────────────────────────────────────────────────────────
('campus_career_stage',    'career',  'campus', 1, 'Where are you in your campus journey?', '["First or second year — exploring options","Pre-final year — building my profile","Final year — actively placed/seeking","Recently graduated — searching now"]'),
('campus_career_challenge','career',  'campus', 2, 'What feels most unclear right now?', '["Which roles or industries suit me","How to build the right skills","Standing out in campus placements","Balancing academics and preparation"]'),
('campus_career_duration', 'career',  'campus', 3, 'How long has this been weighing on you?', '["Just recently","A few months","Most of this academic year","Since I started college"]'),
('campus_acad_when',       'academic','campus', 1, 'When does this concern show up most for you?', '["During lectures or self-study","Before or during exams","When working on assignments or projects","While preparing for placement tests"]'),
('campus_acad_feel',       'academic','campus', 2, 'What do you experience in those moments?', '["Mind drifts or goes blank","Feel mentally exhausted","Feel anxious about performance","Feel unmotivated or disengaged"]'),
('campus_acad_duration',   'academic','campus', 3, 'How long has this been affecting you?', '["Just recently","A few weeks","Several months","Over a year"]'),

-- ─── Persona: jobseeker ───────────────────────────────────────────────────────
('js_career_stage',    'career', 'jobseeker', 1, 'Where are you in your job search right now?', '["Just started looking","Actively applying — not getting responses","Getting interviews but not offers","Considering changing my target role or field"]'),
('js_career_challenge','career', 'jobseeker', 2, 'What feels hardest right now?', '["Knowing which direction to take","Building the right skills or profile","Getting past rejections and staying motivated","Pressure from family or financial situation"]'),
('js_career_duration', 'career', 'jobseeker', 3, 'How long have you been in this situation?', '["Just started (days to weeks)","A few months","Over 6 months","More than a year"]'),

-- ─── Persona: teacher ─────────────────────────────────────────────────────────
('tch_acad_when',      'academic',   'teacher', 1, 'When does this concern show up most in your students?', '["During direct instruction or lectures","During independent or group tasks","Before or during assessments","Consistently throughout the day"]'),
('tch_acad_feel',      'academic',   'teacher', 2, 'What do you observe most in affected students?', '["Frequent distraction and off-task behaviour","Signs of mental fatigue or low energy","Anxiety or avoidance around performance","Disengagement and low participation"]'),
('tch_acad_duration',  'academic',   'teacher', 3, 'How long have you been observing this?', '["Just recently (this week)","A few weeks","Most of this term","For most of the school year"]'),
('tch_beh_trigger',    'behavioural','teacher', 1, 'What seems to trigger this pattern most in your classroom?', '["Challenging or demanding tasks","Transition times or unstructured periods","Peer dynamics and social pressure","Environmental factors (noise, seating, etc.)"]'),
('tch_beh_duration',   'behavioural','teacher', 2, 'How long have you observed this in your students?', '["Just recently (this week)","A few weeks","Most of this term","Throughout the school year"]'),
('tch_beh_tried',      'behavioural','teacher', 3, 'What strategies have you tried so far?', '["Just observing — haven''t intervened yet","Classroom management adjustments","Parent communication or referral","Specialist support engaged"]'),
('tch_social_situation','social',    'teacher', 1, 'Which classroom situations seem hardest for your students?', '["Group work or collaborative tasks","Class discussions or presentations","Break times and unstructured social time","Peer conflicts and group dynamics"]'),
('tch_social_feeling',  'social',    'teacher', 2, 'What do you observe most in affected students?', '["Withdrawal or avoidance","Anxiety before or during social tasks","Difficulty communicating with peers","Disruptive behaviour in social settings"]'),
('tch_social_impact',   'social',    'teacher', 3, 'How much is this affecting classroom functioning?', '["Mildly — occasional difficulty","Moderately — some disruption","Significantly — affecting group cohesion","Severely — student is very isolated"]'),
('tch_digital_duration','digital',   'teacher', 1, 'How much of class time is affected by device-related distractions?', '["Minimal — occasional distraction","Moderate — regular interruptions","Significant — majority of lesson time affected","Severe — devices dominate student attention"]'),
('tch_digital_trigger', 'digital',   'teacher', 2, 'When does this show up most in the classroom?', '["During independent work time","When instruction is less engaging","Throughout the day regardless of activity","Specific to certain subjects or tasks"]'),
('tch_digital_impact',  'digital',   'teacher', 3, 'How is it impacting student performance?', '["Mildly — minor distraction","Moderately — reduced task completion","Significantly — affecting learning outcomes","Severely — a major classroom management issue"]')
ON CONFLICT (question_key) DO NOTHING;
