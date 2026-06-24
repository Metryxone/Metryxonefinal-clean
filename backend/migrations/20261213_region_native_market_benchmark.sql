-- Task 75 — Region-native market & benchmark data (additive, idempotent, reversible).
--
-- Closes the remaining D12 global-readiness gap by allowing REAL region-native content to
-- live alongside the existing universal-inheritance overlay. Two additive, byte-safe changes:
--
--   1. bench_cohorts.geography  — nullable tag so a cohort can be scoped to a region
--                                 (NULL = region-agnostic, exactly as today).
--   2. cohort_type 'region'     — a new allowed value for market/wage benchmark cohorts that
--                                 represent a single region's labour market (e.g. BLS OEWS wages).
--                                 The CHECK is widened (superset) so every existing row still
--                                 validates; nothing is rewritten.
--
-- wos_market_signals already has a free-text `geography` column, so region-native demand signals
-- need no schema change there. The default region (IN) read path excludes these new region-native
-- rows in code (engine baseFilter), so flag-OFF / India behaviour stays byte-identical.
--
-- Reversible: DROP COLUMN bench_cohorts.geography and restore the prior CHECK; region rows are
-- removed by the seed's own provenance-scoped cleanup.

ALTER TABLE bench_cohorts ADD COLUMN IF NOT EXISTS geography text;

ALTER TABLE bench_cohorts DROP CONSTRAINT IF EXISTS bench_cohorts_cohort_type_check;
ALTER TABLE bench_cohorts ADD CONSTRAINT bench_cohorts_cohort_type_check
  CHECK (cohort_type = ANY (ARRAY[
    'global'::text, 'industry'::text, 'function'::text, 'role'::text,
    'layer'::text, 'aspirational'::text, 'region'::text
  ]));

CREATE INDEX IF NOT EXISTS idx_bench_cohorts_geography ON bench_cohorts (geography) WHERE geography IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_wos_market_geography ON wos_market_signals (geography, captured_at DESC);
