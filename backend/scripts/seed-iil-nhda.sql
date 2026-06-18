-- Seed script for IIL and NHDA demo data
-- Idempotent: uses WHERE NOT EXISTS checks on natural keys so re-runs are safe.

-- ── NHDA: Regions ─────────────────────────────────────────────────────────────

INSERT INTO nhda_regions (region_name, region_type, country, population, metadata)
SELECT v.region_name, v.region_type, v.country, v.population::BIGINT, v.metadata::jsonb
FROM (VALUES
  ('India',       'national', 'IN', '1400000000', '{"tier":"sovereign","description":"National sovereign region"}'),
  ('Maharashtra', 'state',    'IN', '112374333',  '{"capital":"Mumbai","gdp_rank":1}'),
  ('Tamil Nadu',  'state',    'IN', '77841267',   '{"capital":"Chennai","gdp_rank":2}'),
  ('Karnataka',   'state',    'IN', '67562686',   '{"capital":"Bengaluru","gdp_rank":3}'),
  ('Delhi',       'state',    'IN', '16787941',   '{"capital":"New Delhi","type":"NCT"}'),
  ('Gujarat',     'state',    'IN', '60439692',   '{"capital":"Gandhinagar","gdp_rank":4}'),
  ('Telangana',   'state',    'IN', '35003674',   '{"capital":"Hyderabad","founded":2014}')
) AS v(region_name, region_type, country, population, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM nhda_regions r WHERE r.region_name = v.region_name AND r.country = v.country
);

-- ── IIL: Institutions ────────────────────────────────────────────────────────

INSERT INTO iil_institutions (name, institution_type, tier, country, region, city, metadata)
SELECT v.name, v.institution_type, v.tier, v.country, v.region, v.city, v.metadata::jsonb
FROM (VALUES
  ('Delhi Public School R.K. Puram',        'school',     'flagship',     'IN', 'Delhi',       'New Delhi',  '{"student_count":3200,"founded":1972}'),
  ('IIT Bombay',                             'university', 'flagship',     'IN', 'Maharashtra', 'Mumbai',     '{"student_count":10000,"founded":1958}'),
  ('Tata Consultancy Services Pune Hub',     'enterprise', 'enterprise',   'IN', 'Maharashtra', 'Pune',       '{"employee_count":8500,"industry":"IT Services"}'),
  ('National Institute of Mental Health',   'government', 'professional', 'IN', 'Karnataka',   'Bengaluru',  '{"beds":750,"specialization":"Psychiatry"}'),
  ('Teach For India',                        'ngo',        'standard',     'IN', 'Maharashtra', 'Mumbai',     '{"fellows":1100,"focus":"Education equity"}'),
  ('NIIT Skill Development Centre',          'skilling',   'professional', 'IN', 'Delhi',       'New Delhi',  '{"learners":2400,"programs":18}'),
  ('The Cathedral John Connon School',       'school',     'flagship',     'IN', 'Maharashtra', 'Mumbai',     '{"student_count":1850,"founded":1860}'),
  ('IIM Ahmedabad',                          'university', 'flagship',     'IN', 'Gujarat',     'Ahmedabad',  '{"student_count":1200,"founded":1961}'),
  ('Infosys Learning and Development',       'enterprise', 'flagship',     'IN', 'Karnataka',   'Bengaluru',  '{"employee_count":12000,"focus":"Tech upskilling"}'),
  ('CBSE Board Regional Office South',       'government', 'enterprise',   'IN', 'Tamil Nadu',  'Chennai',    '{"schools_under":3800,"region":"Southern India"}')
) AS v(name, institution_type, tier, country, region, city, metadata)
WHERE NOT EXISTS (
  SELECT 1 FROM iil_institutions i WHERE i.name = v.name AND i.country = v.country AND i.city = v.city
);

-- ── IIL: DNA Profiles ─────────────────────────────────────────────────────────

INSERT INTO iil_dna_profiles (institution_id, identity_score, personality, resilience_dna, culture_dna, leadership_dna, genome_version)
SELECT
  id,
  ROUND((60 + RANDOM() * 28)::NUMERIC, 2),
  jsonb_build_object(
    'openness',          ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
    'conscientiousness', ROUND((60 + RANDOM() * 25)::NUMERIC, 2),
    'resilience',        ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
    'innovativeness',    ROUND((45 + RANDOM() * 40)::NUMERIC, 2),
    'empathy',           ROUND((55 + RANDOM() * 30)::NUMERIC, 2)
  ),
  ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
  jsonb_build_object(
    'collaboration', ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
    'trust',         ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
    'learning',      ROUND((60 + RANDOM() * 25)::NUMERIC, 2),
    'innovation',    ROUND((45 + RANDOM() * 40)::NUMERIC, 2)
  ),
  jsonb_build_object(
    'effectiveness', ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
    'adaptability',  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
    'influence',     ROUND((45 + RANDOM() * 40)::NUMERIC, 2)
  ),
  1
FROM iil_institutions
ON CONFLICT (institution_id) DO NOTHING;

-- ── IIL: Culture Profiles ─────────────────────────────────────────────────────

INSERT INTO iil_culture_profiles (institution_id, collaboration, innovation, resilience, trust, learning, composite_score, toxic_formation_risk, disengagement_risk, innovation_acceleration, resilience_breakdown)
SELECT
  id,
  ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((45 + RANDOM() * 40)::NUMERIC, 2),
  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((60 + RANDOM() * 25)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 28)::NUMERIC, 2),
  ROUND((0.05 + RANDOM() * 0.25)::NUMERIC, 4),
  ROUND((0.05 + RANDOM() * 0.20)::NUMERIC, 4),
  ROUND((0.05 + RANDOM() * 0.30)::NUMERIC, 4),
  ROUND((0.02 + RANDOM() * 0.15)::NUMERIC, 4)
FROM iil_institutions
ON CONFLICT (institution_id) DO NOTHING;

-- ── IIL: Health Index (last 7 days) ──────────────────────────────────────────

INSERT INTO iil_health_index (institution_id, period_date, engagement_score, resilience_score, emotional_stability, trust_score, developmental_growth, workforce_readiness, health_index, ecosystem_stability, health_grade)
SELECT
  i.id,
  CURRENT_DATE - (s.day || ' days')::INTERVAL,
  ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 28)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 30)::NUMERIC, 2),
  CASE WHEN RANDOM() > 0.65 THEN 'Thriving' WHEN RANDOM() > 0.35 THEN 'Stable' ELSE 'Developing' END
FROM iil_institutions i
CROSS JOIN (SELECT generate_series(0, 6) AS day) s
ON CONFLICT (institution_id, period_date) DO NOTHING;

-- ── IIL: Emotional Climate (last 7 days) ─────────────────────────────────────

INSERT INTO iil_emotional_climate (institution_id, period_date, ecosystem_stability, institutional_anxiety, burnout_propagation, emotional_resilience, ecosystem_morale, contagion_risk, fatigue_index, collapse_risk, hidden_instability)
SELECT
  i.id,
  CURRENT_DATE - (s.day || ' days')::INTERVAL,
  ROUND((55 + RANDOM() * 28)::NUMERIC, 2),
  ROUND((15 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((10 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 28)::NUMERIC, 2),
  ROUND((0.05 + RANDOM() * 0.25)::NUMERIC, 4),
  ROUND((20 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((0.02 + RANDOM() * 0.18)::NUMERIC, 4),
  FALSE
FROM iil_institutions i
CROSS JOIN (SELECT generate_series(0, 6) AS day) s
ON CONFLICT (institution_id, period_date) DO NOTHING;

-- ── IIL: Cognitive Load (last 7 days) ────────────────────────────────────────

INSERT INTO iil_cognitive_load (institution_id, period_date, academic_overload, teacher_overload, cognitive_fragmentation, decision_fatigue, coordination_overload, overload_cascade_risk, collapse_risk, attention_fragmentation)
SELECT
  i.id,
  CURRENT_DATE - (s.day || ' days')::INTERVAL,
  ROUND((25 + RANDOM() * 40)::NUMERIC, 2),
  ROUND((20 + RANDOM() * 40)::NUMERIC, 2),
  ROUND((15 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((20 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((15 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((0.05 + RANDOM() * 0.25)::NUMERIC, 4),
  ROUND((0.02 + RANDOM() * 0.15)::NUMERIC, 4),
  ROUND((0.08 + RANDOM() * 0.30)::NUMERIC, 4)
FROM iil_institutions i
CROSS JOIN (SELECT generate_series(0, 6) AS day) s
ON CONFLICT (institution_id, period_date) DO NOTHING;

-- ── IIL: Resilience Profiles ──────────────────────────────────────────────────

INSERT INTO iil_resilience_profiles (institution_id, recovery_capability, adaptability, ecosystem_recovery, burnout_recovery, sustainability, resilience_score, collapse_risk, fragility_index, volatility_index)
SELECT
  id,
  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((0.05 + RANDOM() * 0.20)::NUMERIC, 4),
  ROUND((0.05 + RANDOM() * 0.20)::NUMERIC, 4),
  ROUND((0.05 + RANDOM() * 0.20)::NUMERIC, 4)
FROM iil_institutions
ON CONFLICT (institution_id) DO NOTHING;

-- ── IIL: Signals (5 signal types × all institutions) ─────────────────────────
-- Uses NOT EXISTS to avoid inserting duplicate seed signals on re-runs.

INSERT INTO iil_signals (institution_id, signal_type, source_entity, signal_data, anomaly_score, confidence, weak_signal, is_systemic)
SELECT
  i.id,
  sig.signal_type,
  'student',
  jsonb_build_object('source', 'seed', 'note', 'Demo signal'),
  ROUND((RANDOM() * 0.35)::NUMERIC, 4),
  ROUND((0.70 + RANDOM() * 0.25)::NUMERIC, 4),
  FALSE,
  FALSE
FROM iil_institutions i
CROSS JOIN (VALUES
  ('student_behavioural'), ('teacher'), ('emotional_ecosystem'),
  ('resilience'), ('interaction')
) AS sig(signal_type)
WHERE NOT EXISTS (
  SELECT 1 FROM iil_signals s
  WHERE s.institution_id = i.id AND s.signal_type = sig.signal_type
    AND s.signal_data->>'source' = 'seed'
);

-- ── NHDA: Genome Profiles ─────────────────────────────────────────────────────

INSERT INTO nhda_genome_profiles (region_id, workforce_dna, resilience_dna, innovation_dna, leadership_dna, learning_adaptability, innovation_emergence, genome_version)
SELECT
  id,
  jsonb_build_object(
    'productivity',   ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
    'adaptability',   ROUND((45 + RANDOM() * 40)::NUMERIC, 2),
    'specialization', ROUND((40 + RANDOM() * 45)::NUMERIC, 2),
    'collaboration',  ROUND((50 + RANDOM() * 35)::NUMERIC, 2)
  ),
  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((45 + RANDOM() * 40)::NUMERIC, 2),
  jsonb_build_object(
    'effectiveness', ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
    'emergence',     ROUND((40 + RANDOM() * 45)::NUMERIC, 2),
    'distribution',  ROUND((45 + RANDOM() * 40)::NUMERIC, 2)
  ),
  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
  (RANDOM() > 0.5),
  1
FROM nhda_regions
ON CONFLICT (region_id) DO NOTHING;

-- ── NHDA: HDI (last 7 days) ───────────────────────────────────────────────────

INSERT INTO nhda_hdi (region_id, period_date, education_score, employability_score, resilience_score, innovation_score, emotional_stability, leadership_capacity, cognitive_capability, nhdi_score, nhdi_grade)
SELECT
  r.id,
  CURRENT_DATE - (s.day || ' days')::INTERVAL,
  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((48 + RANDOM() * 38)::NUMERIC, 2),
  ROUND((50 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((42 + RANDOM() * 40)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((45 + RANDOM() * 38)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((50 + RANDOM() * 30)::NUMERIC, 2),
  CASE WHEN RANDOM() > 0.65 THEN 'Thriving' WHEN RANDOM() > 0.35 THEN 'Stable' ELSE 'Developing' END
FROM nhda_regions r
CROSS JOIN (SELECT generate_series(0, 6) AS day) s
ON CONFLICT (region_id, period_date) DO NOTHING;

-- ── NHDA: Behavioural Climate (last 7 days) ───────────────────────────────────

INSERT INTO nhda_behavioural_climate (region_id, period_date, engagement_climate, productivity_climate, innovation_climate, collaboration_climate, resilience_climate, composite_climate, disengagement_risk, instability_risk, productivity_decline, hidden_deterioration)
SELECT
  r.id,
  CURRENT_DATE - (s.day || ' days')::INTERVAL,
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((45 + RANDOM() * 38)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 33)::NUMERIC, 2),
  ROUND((52 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((0.05 + RANDOM() * 0.20)::NUMERIC, 4),
  ROUND((0.03 + RANDOM() * 0.18)::NUMERIC, 4),
  ROUND((0.02 + RANDOM() * 0.15)::NUMERIC, 4),
  FALSE
FROM nhda_regions r
CROSS JOIN (SELECT generate_series(0, 6) AS day) s
ON CONFLICT (region_id, period_date) DO NOTHING;

-- ── NHDA: Emotional Climate (last 7 days) ─────────────────────────────────────

INSERT INTO nhda_emotional_climate (region_id, period_date, ecosystem_stability, societal_anxiety, burnout_propagation, ecosystem_morale, resilience_sustainability, emotional_contagion_risk, societal_fatigue, collapse_risk, hidden_instability)
SELECT
  r.id,
  CURRENT_DATE - (s.day || ' days')::INTERVAL,
  ROUND((55 + RANDOM() * 28)::NUMERIC, 2),
  ROUND((15 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((12 + RANDOM() * 28)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 28)::NUMERIC, 2),
  ROUND((55 + RANDOM() * 28)::NUMERIC, 2),
  ROUND((0.05 + RANDOM() * 0.20)::NUMERIC, 4),
  ROUND((20 + RANDOM() * 25)::NUMERIC, 2),
  ROUND((0.02 + RANDOM() * 0.15)::NUMERIC, 4),
  FALSE
FROM nhda_regions r
CROSS JOIN (SELECT generate_series(0, 6) AS day) s
ON CONFLICT (region_id, period_date) DO NOTHING;

-- ── NHDA: Cognitive Capacity (last 7 days) ────────────────────────────────────

INSERT INTO nhda_cognitive_capacity (region_id, period_date, learning_capacity, innovation_capability, strategic_adaptability, abstraction_capability, problem_solving_maturity, cognitive_fragmentation, learning_overload, innovation_stagnation, capability_collapse_risk)
SELECT
  r.id,
  CURRENT_DATE - (s.day || ' days')::INTERVAL,
  ROUND((52 + RANDOM() * 30)::NUMERIC, 2),
  ROUND((48 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((50 + RANDOM() * 32)::NUMERIC, 2),
  ROUND((48 + RANDOM() * 35)::NUMERIC, 2),
  ROUND((50 + RANDOM() * 32)::NUMERIC, 2),
  ROUND((0.05 + RANDOM() * 0.20)::NUMERIC, 4),
  ROUND((0.03 + RANDOM() * 0.18)::NUMERIC, 4),
  FALSE,
  ROUND((0.02 + RANDOM() * 0.12)::NUMERIC, 4)
FROM nhda_regions r
CROSS JOIN (SELECT generate_series(0, 6) AS day) s
ON CONFLICT (region_id, period_date) DO NOTHING;

-- ── NHDA: Population Signals ──────────────────────────────────────────────────
-- Uses NOT EXISTS to avoid inserting duplicate seed signals on re-runs.

INSERT INTO nhda_population_signals (region_id, signal_type, cohort_segment, signal_data, anomaly_score, confidence, weak_signal, is_systemic, population_size)
SELECT
  r.id,
  sig.signal_type,
  seg.segment,
  jsonb_build_object('source', 'seed', 'note', 'Demo population signal'),
  ROUND((RANDOM() * 0.30)::NUMERIC, 4),
  ROUND((0.72 + RANDOM() * 0.23)::NUMERIC, 4),
  FALSE,
  FALSE,
  (50000 + (RANDOM() * 500000)::BIGINT)
FROM nhda_regions r
CROSS JOIN (VALUES ('behavioural'), ('emotional'), ('cognitive'), ('workforce'), ('educational')) AS sig(signal_type)
CROSS JOIN (VALUES ('youth'), ('working_age')) AS seg(segment)
WHERE NOT EXISTS (
  SELECT 1 FROM nhda_population_signals p
  WHERE p.region_id = r.id AND p.signal_type = sig.signal_type
    AND p.cohort_segment = seg.segment AND p.signal_data->>'source' = 'seed'
);
