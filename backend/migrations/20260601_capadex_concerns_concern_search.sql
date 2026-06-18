-- 2026-06-01 — Concern Search phrase for CAPADEX concerns
--
-- Adds `concern_search TEXT` (nullable) to `capadex_concerns_master`. This is
-- the user-facing natural-language search phrase supplied in the audited CSV
-- (e.g. "Difficulty adjusting to college", "How to study on my own"). It is
-- carried through CSV import/export and editable in the CapadexConcernsMasterPanel.
-- Routing keys (concern_cluster / domain / relational_bridge_tag) are unchanged.
--
-- Mirrors the lazy `ensureTable()` bootstrap in
-- backend/routes/capadex-concerns-master.ts (no migration runner).

ALTER TABLE capadex_concerns_master
  ADD COLUMN IF NOT EXISTS concern_search TEXT;
