CREATE TABLE IF NOT EXISTS lde_seed_log (
  seed_type TEXT PRIMARY KEY,
  last_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_count INTEGER NOT NULL DEFAULT 1,
  last_result JSONB
);
