-- ============================================================================
-- Phase 2 seed: cohort definitions + reproducible synthetic empirical
-- distributions so the benchmarking engines have data to operate on before
-- real submissions arrive. setseed() makes generation deterministic, and
-- per-(cohort, competency) means are derived from the ontology so the
-- distributions are scientifically plausible (e.g. leadership-heavy roles
-- score higher on leadership-relevant competencies).
-- Safe to re-run; existing rows preserved.
-- ============================================================================

-- 0. Bench methodology version pin -------------------------------------------
INSERT INTO bench_versions (id, version, methodology, pinned_ontology_version, snapshot, notes)
VALUES ('ver_bench_2_0_0', '2.0.0', 'empirical_percentile_v2', '1.0.0',
  jsonb_build_object(
    'percentile',    'empirical (count(samples<=x)/n)',
    'reliability',   'composite: consistency, reverse, contradiction, completion, anomaly',
    'weighting',     'role_dna * context_modifiers (industry, layer, seniority, maturity, scale, geography)',
    'tier_cutoffs',  jsonb_build_object('A',1000,'B',300,'C',100,'D',30),
    'k_min_default', 30
  ),
  'Phase 2 launch — empirical percentile, dynamic weighting, reliability, confidence, audit.')
ON CONFLICT (id) DO NOTHING;

-- 1. Cohort definitions (15 total) -------------------------------------------
INSERT INTO bench_cohorts (id, cohort_type, name, description, industry_id, function_id, role_id, layer_id, k_min) VALUES
  ('coh_global',            'global',   'Global Benchmark',           'All assessed individuals across all contexts', NULL, NULL, NULL, NULL, 30),
  ('coh_ind_it',            'industry', 'Technology — Industry',      'All assessments in Technology',                 'ind_it',        NULL, NULL, NULL, 30),
  ('coh_ind_financial',     'industry', 'Financial Services — Industry','All assessments in Financial Services',       'ind_financial', NULL, NULL, NULL, 30),
  ('coh_fn_engineering',    'function', 'Engineering — Function',     'All assessments in Engineering functions',      NULL, 'fn_it_engineering', NULL, NULL, 30),
  ('coh_fn_product',        'function', 'Product Management — Function','All assessments in Product Management',       NULL, 'fn_it_product',     NULL, NULL, 30),
  ('coh_fn_risk',           'function', 'Risk Management — Function', 'All assessments in Risk Management',            NULL, 'fn_fs_risk',        NULL, NULL, 30),
  ('coh_role_be_eng',       'role',     'Backend Engineer — Role',     'Backend Engineer cohort',                       NULL, NULL, 'role_be_eng',         NULL, 30),
  ('coh_role_sr_be_eng',    'role',     'Senior Backend Engineer — Role','Senior Backend Engineer cohort',              NULL, NULL, 'role_sr_be_eng',      NULL, 30),
  ('coh_role_eng_mgr',      'role',     'Engineering Manager — Role',  'Engineering Manager cohort',                    NULL, NULL, 'role_eng_manager',    NULL, 30),
  ('coh_role_pm',           'role',     'Product Manager — Role',      'Product Manager cohort',                        NULL, NULL, 'role_pm',             NULL, 30),
  ('coh_role_credit',       'role',     'Credit Risk Analyst — Role',  'Credit Risk Analyst cohort',                    NULL, NULL, 'role_credit_analyst', NULL, 30),
  ('coh_layer_executive',   'layer',    'Executive — Layer',           'All Executives',                                NULL, NULL, NULL, 'layer_executive',   30),
  ('coh_layer_managerial',  'layer',    'Managerial — Layer',          'All Managerial',                                NULL, NULL, NULL, 'layer_managerial',  30),
  ('coh_layer_leadership',  'layer',    'Senior Leadership — Layer',   'All Senior Leadership',                         NULL, NULL, NULL, 'layer_leadership',  30),
  ('coh_layer_strategic',   'layer',    'Strategic — Layer',           'All Strategic',                                 NULL, NULL, NULL, 'layer_strategic',   30)
ON CONFLICT (id) DO NOTHING;

-- 2. Generate synthetic empirical distributions ------------------------------
-- Only seed when bench_competency_benchmarks is empty (idempotent guard).
DO $seed$
DECLARE
  v_count INT;
  c_row   RECORD;
  k_row   RECORD;
  v_n     INT;
  v_mean  NUMERIC;
  v_sd    NUMERIC := 11.0;
  v_role_boost NUMERIC;
BEGIN
  SELECT COUNT(*) INTO v_count FROM bench_competency_benchmarks;
  IF v_count > 0 THEN
    RAISE NOTICE 'bench_competency_benchmarks already populated (% rows) — skipping synthetic seed', v_count;
    RETURN;
  END IF;

  PERFORM setseed(0.4242);

  -- Scratch table for samples
  CREATE TEMP TABLE _bench_seed_samples (
    cohort_id     TEXT NOT NULL,
    competency_id TEXT NOT NULL,
    score         NUMERIC(7,4) NOT NULL
  ) ON COMMIT DROP;

  -- Sample-count tier by cohort_type
  FOR c_row IN SELECT id, cohort_type, role_id, layer_id, industry_id FROM bench_cohorts WHERE is_active LOOP
    v_n := CASE c_row.cohort_type
             WHEN 'global'   THEN 1200
             WHEN 'industry' THEN  550
             WHEN 'function' THEN  340
             WHEN 'layer'    THEN  260
             WHEN 'role'     THEN  170
             ELSE 60
           END;

    FOR k_row IN SELECT id, leadership_relevance, complexity_level FROM onto_competencies LOOP
      -- Context-derived mean: base 50 + leadership-relevance lift + cohort-type lift
      v_mean := 50.0
              + (k_row.leadership_relevance * 18.0)
              + CASE c_row.cohort_type
                  WHEN 'role'  THEN 7.0
                  WHEN 'layer' THEN 5.0
                  WHEN 'function' THEN 3.0
                  ELSE 0.0
                END;

      -- Role-specific tilt: managerial/leadership roles score higher on leadership-relevant
      v_role_boost := 0;
      IF c_row.role_id IN ('role_eng_manager','role_pm') THEN
        v_role_boost := k_row.leadership_relevance * 8.0;
      ELSIF c_row.role_id IN ('role_sr_be_eng','role_credit_analyst') THEN
        v_role_boost := (k_row.complexity_level::NUMERIC / 5.0) * 5.0;
      END IF;
      IF c_row.layer_id IN ('layer_leadership','layer_executive','layer_strategic') THEN
        v_role_boost := v_role_boost + k_row.leadership_relevance * 6.0;
      END IF;
      v_mean := LEAST(95.0, v_mean + v_role_boost);

      INSERT INTO _bench_seed_samples (cohort_id, competency_id, score)
      SELECT c_row.id, k_row.id,
             GREATEST(0, LEAST(100,
               v_mean + v_sd * sqrt(-2 * ln(random())) * cos(2 * pi() * random())
             ))::NUMERIC(7,4)
      FROM generate_series(1, v_n);
    END LOOP;
  END LOOP;

  -- Materialise into bench_competency_benchmarks (aggregates + sorted samples)
  INSERT INTO bench_competency_benchmarks
    (cohort_id, competency_id, n_samples, mean, stddev, median,
     p10, p25, p50, p75, p90, p95, p99, min_score, max_score, sorted_samples, version)
  SELECT
    s.cohort_id, s.competency_id, COUNT(*),
    ROUND(AVG(s.score)::NUMERIC, 4),
    ROUND(COALESCE(STDDEV_SAMP(s.score), 0)::NUMERIC, 4),
    ROUND(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY s.score)::NUMERIC, 4),
    ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY s.score)::NUMERIC, 4),
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY s.score)::NUMERIC, 4),
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY s.score)::NUMERIC, 4),
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY s.score)::NUMERIC, 4),
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY s.score)::NUMERIC, 4),
    ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY s.score)::NUMERIC, 4),
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY s.score)::NUMERIC, 4),
    MIN(s.score), MAX(s.score),
    (SELECT jsonb_agg(x ORDER BY x)
       FROM (SELECT ROUND(score::NUMERIC, 4) AS x
               FROM _bench_seed_samples s2
              WHERE s2.cohort_id = s.cohort_id AND s2.competency_id = s.competency_id) q),
    '2.0.0'
  FROM _bench_seed_samples s
  GROUP BY s.cohort_id, s.competency_id;

  -- Histograms (bucket=5)
  INSERT INTO bench_percentile_distributions (cohort_id, competency_id, bucket_size, histogram, n, version)
  SELECT
    s.cohort_id, s.competency_id, 5,
    (SELECT jsonb_agg(jsonb_build_object('bucket', bucket, 'count', cnt) ORDER BY bucket)
       FROM (
         SELECT (FLOOR(s2.score::NUMERIC / 5) * 5)::INT AS bucket, COUNT(*)::INT AS cnt
           FROM _bench_seed_samples s2
          WHERE s2.cohort_id = s.cohort_id AND s2.competency_id = s.competency_id
          GROUP BY 1
       ) h),
    COUNT(*), '2.0.0'
  FROM _bench_seed_samples s
  GROUP BY s.cohort_id, s.competency_id;
END
$seed$;

-- 3. Cohort rollup statistics + confidence tiers -----------------------------
INSERT INTO bench_cohort_statistics (cohort_id, n_total, k_anonymous, confidence_tier, competency_count)
SELECT
  b.cohort_id,
  MAX(b.n_samples),
  MAX(b.n_samples) >= COALESCE(c.k_min, 30),
  CASE
    WHEN MAX(b.n_samples) >= 1000 THEN 'A'
    WHEN MAX(b.n_samples) >=  300 THEN 'B'
    WHEN MAX(b.n_samples) >=  100 THEN 'C'
    WHEN MAX(b.n_samples) >=   30 THEN 'D'
    ELSE 'provisional'
  END,
  COUNT(DISTINCT b.competency_id)
FROM bench_competency_benchmarks b
JOIN bench_cohorts c ON c.id = b.cohort_id
GROUP BY b.cohort_id, c.k_min
ON CONFLICT (cohort_id) DO UPDATE
  SET n_total = EXCLUDED.n_total,
      k_anonymous = EXCLUDED.k_anonymous,
      confidence_tier = EXCLUDED.confidence_tier,
      competency_count = EXCLUDED.competency_count,
      last_refreshed = NOW();

INSERT INTO bench_confidence (cohort_id, competency_id, n, tier, ci_low, ci_high, freshness_days, reasoning)
SELECT
  b.cohort_id, b.competency_id, b.n_samples,
  CASE
    WHEN b.n_samples >= 1000 THEN 'A'
    WHEN b.n_samples >=  300 THEN 'B'
    WHEN b.n_samples >=  100 THEN 'C'
    WHEN b.n_samples >=   30 THEN 'D'
    ELSE 'provisional'
  END,
  -- 95% normal-approx CI for the mean (diagnostic only)
  ROUND((b.mean - 1.96 * b.stddev / NULLIF(SQRT(b.n_samples), 0))::NUMERIC, 4),
  ROUND((b.mean + 1.96 * b.stddev / NULLIF(SQRT(b.n_samples), 0))::NUMERIC, 4),
  0,
  CASE
    WHEN b.n_samples >= 1000 THEN 'Tier A — n≥1000; high confidence; CI tight.'
    WHEN b.n_samples >=  300 THEN 'Tier B — n≥300; robust; report with confidence.'
    WHEN b.n_samples >=  100 THEN 'Tier C — n≥100; moderate; interpret with care.'
    WHEN b.n_samples >=   30 THEN 'Tier D — n≥30; k-anonymous but provisional.'
    ELSE 'Provisional — n<30; below k-anonymity threshold.'
  END
FROM bench_competency_benchmarks b
ON CONFLICT (cohort_id, competency_id) DO UPDATE
  SET n = EXCLUDED.n, tier = EXCLUDED.tier,
      ci_low = EXCLUDED.ci_low, ci_high = EXCLUDED.ci_high,
      reasoning = EXCLUDED.reasoning, computed_at = NOW();
