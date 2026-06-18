-- /app/scripts/seed-sdi-domains.sql
-- Student Development Index (SDI) — 18 DOMAINS
-- Displayed in Super Admin → Assessment Modules → Domains tab
-- Idempotent: ON CONFLICT updates.

CREATE TABLE IF NOT EXISTS sdi_domains (
  id              SERIAL PRIMARY KEY,
  domain_code     TEXT UNIQUE NOT NULL,
  domain_name     TEXT NOT NULL,
  description     TEXT,
  icon_key        TEXT NOT NULL DEFAULT 'Layers',
  color           TEXT NOT NULL DEFAULT '#344E86',
  category        TEXT,
  weightage       REAL NOT NULL DEFAULT 1,
  display_order   INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'Active',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sdi_domains_status ON sdi_domains(status);

INSERT INTO sdi_domains
  (domain_code, domain_name, description, icon_key, color, category, display_order, status, is_active) VALUES
  ('ACF-01','Focus & Attention Assessment',         'Measures attention span, focus regulation, and cognitive concentration', 'Brain',          '#2563EB','Cognitive',     1,'Active',true),
  ('APO-02','Academic Performance Assessment',      'Evaluates learning outcomes, marks, and academic consistency',           'GraduationCap',  '#0EA5E9','Academic',      2,'Active',true),
  ('BSM-03','Behavior & Discipline Assessment',     'Assesses behavioral discipline and self-management',                     'Shield',         '#10B981','Behavior',      3,'Active',true),
  ('EIR-04','Emotional Intelligence Assessment',    'Measures emotional intelligence and internal regulation',                'Heart',          '#F472B6','Emotional',     4,'Active',true),
  ('MHW-05','Mental Wellness Assessment',           'Evaluates mental health and psychological wellbeing',                    'HeartHandshake', '#8B5CF6','Mental Health', 5,'Active',true),
  ('DUD-06','Digital Behavior Assessment',          'Assesses digital usage patterns and screen dependency',                  'Smartphone',     '#06B6D4','Digital',       6,'Active',true),
  ('SCI-07','Social Skills Assessment',             'Evaluates social skills, communication, and peer interaction',           'Users',          '#F59E0B','Social',        7,'Active',true),
  ('HLD-08','Lifestyle & Habit Assessment',         'Measures daily habits, lifestyle, and personal discipline',              'Activity',       '#84CC16','Habits',        8,'Active',true),
  ('CAD-09','Career Readiness Assessment',          'Assesses career awareness, direction, and decision-making',              'Compass',        '#14B8A6','Career',        9,'Active',true),
  ('FED-10','Family Environment Assessment',        'Evaluates family environment and parent-child dynamics',                 'Home',           '#EF4444','Family',       10,'Active',true),
  ('LCR-11','Learning Ability Assessment',          'Measures learning ability, comprehension, and retention',                'BookOpen',       '#6366F1','Cognitive',    11,'Active',true),
  ('CHT-12','Cognitive Skills Assessment',          'Assesses cognitive processing and higher-order thinking skills',         'Lightbulb',      '#A855F7','Cognitive',    12,'Active',true),
  ('PAI-13','Parenting Effectiveness Assessment',   'Evaluates parenting approach, skills, and intervention quality',         'UserCheck',      '#EC4899','Family',       13,'Active',true),
  ('EEI-14','School Environment Assessment',        'Measures educational environment and external influences',               'Building',       '#0891B2','School',       14,'Active',true),
  ('PHB-15','Physical Health Assessment',           'Assesses physical health, energy, and biological factors',               'Dumbbell',       '#22C55E','Health',       15,'Active',true),
  ('FRC-16','Future Skills Assessment',             'Evaluates future readiness, creativity, and curiosity skills',           'Sparkles',       '#F97316','Future',       16,'Active',true),
  ('BES-17','Board Exam Readiness Assessment',      'Measures board exam performance and exam strategy management',           'ClipboardList',  '#DC2626','Academic',     17,'Active',true),
  ('IAR-18','Academic Recovery Assessment',         'Assesses improvement strategy and academic recovery planning',           'TrendingUp',     '#059669','Academic',     18,'Active',true)
ON CONFLICT (domain_code) DO UPDATE SET
  domain_name   = EXCLUDED.domain_name,
  description   = EXCLUDED.description,
  icon_key      = EXCLUDED.icon_key,
  color         = EXCLUDED.color,
  category      = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  status        = EXCLUDED.status,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();
