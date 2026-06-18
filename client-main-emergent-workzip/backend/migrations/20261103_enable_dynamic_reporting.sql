-- Enable Dynamic Reporting by default.
--
-- The CAPADEX report email rebuild relies on `dynamic_reporting` being ON so that
-- personalised narrative reports render in emails and previews by default; when the
-- flag is off, send/preview fall back to the static narrative. The original Phase-1
-- seed (20260509_feature_flags.sql) created every flag disabled (`enabled = FALSE`),
-- which left dynamic narratives off in any environment initialised from migrations.
--
-- Idempotent: upserts the row to `enabled = TRUE` whether or not it already exists,
-- so re-running is safe and live environments (already TRUE) are unaffected.
INSERT INTO feature_flags (flag_key, label, description, enabled, rollout_pct, phase)
VALUES (
  'dynamic_reporting',
  'Dynamic Reporting',
  'Generates personalised narrative reports driven by live cognitive runtime state',
  TRUE, 100, 'phase1'
)
ON CONFLICT (flag_key) DO UPDATE SET enabled = TRUE, updated_at = NOW();
