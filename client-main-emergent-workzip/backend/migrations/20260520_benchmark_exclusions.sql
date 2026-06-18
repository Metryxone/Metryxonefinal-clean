-- Peer Benchmark — user opt-out registry.
-- Any user_id present here is excluded from the cohort used by
-- /api/ei/peer-benchmark. This makes the methodology endpoint's opt-out
-- claim enforceable rather than aspirational.
CREATE TABLE IF NOT EXISTS benchmark_exclusions (
  user_id      text PRIMARY KEY,
  reason       text,
  excluded_at  timestamptz NOT NULL DEFAULT now()
);
