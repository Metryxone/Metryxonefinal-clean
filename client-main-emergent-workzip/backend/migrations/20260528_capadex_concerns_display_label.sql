-- 2026-05-28 — Curated user-facing label for CAPADEX concerns
--
-- Adds `display_label TEXT` (nullable) to `capadex_concerns_master`. This is
-- the canonical short, human-readable phrase shown to end users in the
-- IntroPhase typeahead dropdown rows and the "Mapped to" pill. The
-- existing `concern_cluster` / `domain` columns remain the internal
-- scientific taxonomy and continue to drive routing.
--
-- Backfill pass: derive a first-draft label from `concern_cluster` by
-- stripping common clinical prefixes ("Weak Ability to", "Difficulty
-- Managing", "Inability to", etc.). Admins can override per row via the
-- CapadexConcernsMasterPanel; the fallback chain on read is:
--   display_label  ->  concern_cluster  ->  domain
-- so UI never shows NULL.

ALTER TABLE capadex_concerns_master
  ADD COLUMN IF NOT EXISTS display_label TEXT;

UPDATE capadex_concerns_master
SET display_label = NULLIF(btrim(regexp_replace(
        concern_cluster,
        '^(Weak Ability to|Difficulty Managing|Difficulty Maintaining|Difficulty Handling|Difficulty Monitoring|Difficulty Measuring|Difficulty in|Difficulty|Weak Ability|Weak Confidence in|Weak Confidence During|Weak|Inability to|Lack of|Low Ability to|Low|Limited Ability to|Limited|Poor Ability to|Poor)\s+',
        '',
        'i'
      )), '')
WHERE (display_label IS NULL OR display_label = '')
  AND concern_cluster IS NOT NULL;

CREATE INDEX IF NOT EXISTS capadex_concerns_master_display_label_idx
  ON capadex_concerns_master(display_label);
