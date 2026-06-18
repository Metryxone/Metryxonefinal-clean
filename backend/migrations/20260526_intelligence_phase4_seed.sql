-- Phase 4 seed — deterministic demo history so dashboards render.
-- Uses setseed for repeatable randomness.

BEGIN;
SELECT setseed(0.4242);

-- trajectory models registry
INSERT INTO p4_trajectory_models (id, model_type, version, parameters, description) VALUES
  ('tm_linear_v1', 'linear', '4.0.0',
   '{"window_days":90,"smoothing":"none","band_pct":0.10}'::jsonb,
   'Linear least-squares fit over rolling 90-day window'),
  ('tm_ewma_v1', 'ewma', '4.0.0',
   '{"alpha":0.30,"horizon_months":6,"band_pct":0.12}'::jsonb,
   'Exponentially-weighted moving average with 0.30 alpha'),
  ('tm_conservative_v1', 'conservative_band', '4.0.0',
   '{"lower_pct":0.85,"upper_pct":1.10,"horizon_months":6}'::jsonb,
   'Conservative projection band (15% downside / 10% upside)')
ON CONFLICT (id) DO NOTHING;

-- demo users
WITH demo_users AS (
  SELECT unnest(ARRAY['demo_user_alpha','demo_user_beta','demo_user_gamma','demo_user_delta','demo_user_epsilon']) AS user_id
),
comp AS (SELECT id AS competency_id FROM onto_competencies),
-- generate 6 monthly snapshots per (user, competency)
periods AS (
  SELECT generate_series(0, 5) AS month_offset
),
hist AS (
  SELECT u.user_id, c.competency_id, p.month_offset,
         (now() - (p.month_offset || ' months')::interval) AS captured_at,
         GREATEST(20, LEAST(95,
           40 + 30 * random()                         -- baseline 40-70
              - p.month_offset * (3 + 5*random())     -- earlier months lower
              + 4 * (random() - 0.5)                  -- noise
         ))::numeric(5,2) AS score
    FROM demo_users u CROSS JOIN comp c CROSS JOIN periods p
)
INSERT INTO p4_competency_history (id, user_id, session_id, competency_id, score, source, captured_at)
SELECT
  'ph_' || md5(user_id || competency_id || month_offset::text),
  user_id,
  'sess_' || md5(user_id || month_offset::text),
  competency_id,
  score,
  CASE WHEN month_offset = 0 THEN 'capadex' WHEN month_offset % 2 = 0 THEN 'benchmark' ELSE 'pragati' END,
  captured_at
FROM hist
ON CONFLICT (id) DO NOTHING;

-- benchmark trends per cohort × competency for last 6 months
INSERT INTO p4_benchmark_trends
  (id, cohort_id, competency_id, period, mean_score, median_score, p25, p75, p90, sample_size, delta_vs_prior)
SELECT
  'bt_' || md5(bc.id || c.id || (gs)::text),
  bc.id,
  c.id,
  (date_trunc('month', now() - (gs || ' months')::interval))::date,
  GREATEST(35, LEAST(85, 55 + 12*(random()-0.5) - gs*1.5))::numeric(5,2),
  GREATEST(34, LEAST(85, 55 + 10*(random()-0.5) - gs*1.5))::numeric(5,2),
  GREATEST(20, LEAST(75, 45 + 10*(random()-0.5) - gs*1.5))::numeric(5,2),
  GREATEST(50, LEAST(92, 65 + 10*(random()-0.5) - gs*1.0))::numeric(5,2),
  GREATEST(60, LEAST(98, 78 + 8*(random()-0.5) - gs*0.5))::numeric(5,2),
  120,
  CASE WHEN gs = 5 THEN NULL ELSE (1.5*(random()-0.3))::numeric(6,2) END
FROM bench_cohorts bc
CROSS JOIN onto_competencies c
CROSS JOIN generate_series(0,5) gs
ON CONFLICT (cohort_id, competency_id, period) DO NOTHING;

-- organizational heatmaps — one row per layer × competency
INSERT INTO p4_organizational_heatmaps
  (id, tenant_id, layer_id, function_id, competency_id, mean_score, sample_size, maturity_distribution, intensity)
SELECT
  'oh_' || md5(l.id || c.id),
  'global',
  l.id,
  NULL,
  c.id,
  GREATEST(35, LEAST(85, 50 + 18*(random()-0.5) + l.display_order*2))::numeric(5,2),
  (60 + (random()*180)::int),
  jsonb_build_object(
    'level_1', (10 + (random()*15)::int),
    'level_2', (20 + (random()*15)::int),
    'level_3', (25 + (random()*15)::int),
    'level_4', (15 + (random()*15)::int),
    'level_5', (5  + (random()*10)::int)
  ),
  (random()*100)::numeric(5,2)
FROM onto_layers l
CROSS JOIN onto_competencies c
ON CONFLICT (id) DO NOTHING;

-- workforce analytics rollups
INSERT INTO p4_workforce_analytics
  (id, tenant_id, metric_name, metric_value, dimensions, period_start, period_end, sample_size)
VALUES
  ('wa_global_leadership_readiness', 'global', 'leadership_pipeline_readiness', 62.4,
   '{"layer":"all"}'::jsonb, (now()-interval '30 days')::date, now()::date, 540),
  ('wa_global_avg_capability', 'global', 'avg_capability_index', 58.9,
   '{}'::jsonb, (now()-interval '30 days')::date, now()::date, 540),
  ('wa_global_mobility_index', 'global', 'cross_role_mobility_index', 41.7,
   '{}'::jsonb, (now()-interval '30 days')::date, now()::date, 540),
  ('wa_global_strategic_capability', 'global', 'strategic_capability_density', 47.2,
   '{}'::jsonb, (now()-interval '30 days')::date, now()::date, 540),
  ('wa_global_succession_coverage', 'global', 'succession_coverage_pct', 38.6,
   '{}'::jsonb, (now()-interval '30 days')::date, now()::date, 540)
ON CONFLICT (id) DO NOTHING;

COMMIT;
