-- /app/scripts/seed-sdi-extras.sql
-- SDI subdomains, items, options, scoring norms — wires SDI to a real question bank
-- Idempotent.

BEGIN;

-- ─── SDI Subdomains ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sdi_subdomains (
  id              SERIAL PRIMARY KEY,
  domain_code     TEXT NOT NULL REFERENCES sdi_domains(domain_code) ON DELETE CASCADE,
  subdomain_code  TEXT UNIQUE NOT NULL,
  subdomain_name  TEXT NOT NULL,
  description     TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sdi_sub_domain ON sdi_subdomains(domain_code);

-- 4–6 starter subdomains per SDI domain (54 total).
INSERT INTO sdi_subdomains (domain_code, subdomain_code, subdomain_name, description, display_order) VALUES
  -- ACF-01 Focus & Attention
  ('ACF-01','ACF_S1','Sustained Attention',     'Ability to maintain focus over long periods',1),
  ('ACF-01','ACF_S2','Selective Attention',     'Filtering distractions while focusing',2),
  ('ACF-01','ACF_S3','Concentration Quality',   'Depth of focus during cognitive tasks',3),
  -- APO-02 Academic Performance
  ('APO-02','APO_S1','Subject Mastery',         'Depth of subject-matter understanding',1),
  ('APO-02','APO_S2','Exam Performance',        'Performance under timed evaluation',2),
  ('APO-02','APO_S3','Consistency Across Subjects','Performance stability across subjects',3),
  -- BSM-03 Behavior & Discipline
  ('BSM-03','BSM_S1','Self-Discipline',         'Personal discipline and rule-following',1),
  ('BSM-03','BSM_S2','Class Behavior',          'Behavior in academic settings',2),
  ('BSM-03','BSM_S3','Impulse Control',         'Ability to control impulsive behavior',3),
  -- EIR-04 Emotional Intelligence
  ('EIR-04','EIR_S1','Emotional Awareness',     'Awareness of own emotional states',1),
  ('EIR-04','EIR_S2','Emotional Regulation',    'Managing emotional responses',2),
  ('EIR-04','EIR_S3','Empathy',                 'Understanding others emotions',3),
  -- MHW-05 Mental Wellness
  ('MHW-05','MHW_S1','Stress Management',       'Coping with stress and pressure',1),
  ('MHW-05','MHW_S2','Anxiety Levels',          'General anxiety and worry patterns',2),
  ('MHW-05','MHW_S3','Mood Stability',          'Emotional and mood consistency',3),
  -- DUD-06 Digital Behavior
  ('DUD-06','DUD_S1','Screen Time Patterns',    'Daily screen usage patterns',1),
  ('DUD-06','DUD_S2','Digital Self-Regulation', 'Self-control with digital devices',2),
  ('DUD-06','DUD_S3','Online Safety Awareness', 'Awareness of digital safety',3),
  -- SCI-07 Social Skills
  ('SCI-07','SCI_S1','Peer Interaction',        'Quality of peer relationships',1),
  ('SCI-07','SCI_S2','Communication',           'Effective communication with others',2),
  ('SCI-07','SCI_S3','Collaboration',           'Working effectively in groups',3),
  -- HLD-08 Lifestyle & Habit
  ('HLD-08','HLD_S1','Sleep Quality',           'Sleep patterns and quality',1),
  ('HLD-08','HLD_S2','Daily Routine',           'Consistency of daily habits',2),
  ('HLD-08','HLD_S3','Time Management',         'Effective use of time',3),
  -- CAD-09 Career Readiness
  ('CAD-09','CAD_S1','Career Awareness',        'Understanding of career options',1),
  ('CAD-09','CAD_S2','Goal Clarity',            'Clarity on career goals',2),
  ('CAD-09','CAD_S3','Decision Making',         'Career-related decision-making ability',3),
  -- FED-10 Family Environment
  ('FED-10','FED_S1','Parent Relationship',     'Quality of parent-child relationship',1),
  ('FED-10','FED_S2','Family Support',          'Perceived family emotional support',2),
  ('FED-10','FED_S3','Home Environment',        'Quality of home learning environment',3),
  -- LCR-11 Learning Ability
  ('LCR-11','LCR_S1','Learning Speed',          'Speed of new information acquisition',1),
  ('LCR-11','LCR_S2','Comprehension',           'Understanding what is learned',2),
  ('LCR-11','LCR_S3','Retention',               'Long-term memory retention',3),
  -- CHT-12 Cognitive Skills
  ('CHT-12','CHT_S1','Critical Thinking',       'Analyzing and evaluating ideas',1),
  ('CHT-12','CHT_S2','Problem Solving',         'Approach to complex problems',2),
  ('CHT-12','CHT_S3','Creativity',              'Creative thinking and idea generation',3),
  -- PAI-13 Parenting Effectiveness
  ('PAI-13','PAI_S1','Parental Involvement',    'Engagement in child education',1),
  ('PAI-13','PAI_S2','Discipline Style',        'Approach to discipline',2),
  ('PAI-13','PAI_S3','Communication with Child','Quality of parent-child communication',3),
  -- EEI-14 School Environment
  ('EEI-14','EEI_S1','Teacher Quality',         'Quality of teaching and instruction',1),
  ('EEI-14','EEI_S2','School Climate',          'Overall school atmosphere',2),
  ('EEI-14','EEI_S3','Peer Environment',        'Peer environment at school',3),
  -- PHB-15 Physical Health
  ('PHB-15','PHB_S1','Physical Activity',       'Regular physical activity levels',1),
  ('PHB-15','PHB_S2','Nutrition',               'Quality of diet and nutrition',2),
  ('PHB-15','PHB_S3','Energy Levels',           'Daily energy and stamina',3),
  -- FRC-16 Future Skills
  ('FRC-16','FRC_S1','Adaptability',            'Adapting to new situations',1),
  ('FRC-16','FRC_S2','Innovation',              'Creative problem-solving',2),
  ('FRC-16','FRC_S3','Curiosity',               'Drive to learn new things',3),
  -- BES-17 Board Exam Readiness
  ('BES-17','BES_S1','Exam Strategy',           'Effective exam-taking strategies',1),
  ('BES-17','BES_S2','Time Management',         'Managing time during exams',2),
  ('BES-17','BES_S3','Stress Under Pressure',   'Handling exam pressure',3),
  -- IAR-18 Academic Recovery
  ('IAR-18','IAR_S1','Learning Gap Recovery',   'Recovering from learning gaps',1),
  ('IAR-18','IAR_S2','Improvement Strategy',    'Strategy for academic improvement',2),
  ('IAR-18','IAR_S3','Persistence',             'Persistence after setbacks',3)
ON CONFLICT (subdomain_code) DO UPDATE SET
  subdomain_name = EXCLUDED.subdomain_name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ─── SDI Assessment Items (question bank) ────────────────────────────────
CREATE TABLE IF NOT EXISTS sdi_items (
  id              SERIAL PRIMARY KEY,
  subdomain_code  TEXT NOT NULL REFERENCES sdi_subdomains(subdomain_code) ON DELETE CASCADE,
  item_code       TEXT UNIQUE NOT NULL,
  item_type       TEXT NOT NULL DEFAULT 'likert5',  -- likert5 / mcq / scenario / behavioral
  difficulty      INTEGER NOT NULL DEFAULT 3,
  question        TEXT NOT NULL,
  expected_time   INTEGER NOT NULL DEFAULT 30,      -- seconds
  scoring_type    TEXT NOT NULL DEFAULT 'auto',
  language_code   TEXT NOT NULL DEFAULT 'en',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sdi_items_subdomain ON sdi_items(subdomain_code);
CREATE INDEX IF NOT EXISTS idx_sdi_items_active ON sdi_items(is_active);

CREATE TABLE IF NOT EXISTS sdi_item_options (
  id              SERIAL PRIMARY KEY,
  item_id         INTEGER NOT NULL REFERENCES sdi_items(id) ON DELETE CASCADE,
  option_text     TEXT NOT NULL,
  score_value     REAL NOT NULL DEFAULT 0,
  display_order   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sdi_options_item ON sdi_item_options(item_id);

COMMIT;
