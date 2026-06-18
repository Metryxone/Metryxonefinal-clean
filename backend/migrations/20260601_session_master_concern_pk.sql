-- CAPADEX session master-concern resolution (Task #19).
-- Persist the resolved master concern PK once at /start so the concern→signal
-- seeding (concern-signal-seeding.ts) no longer re-resolves the session's
-- concern_name text on every /respond call. Additive + nullable: in-flight
-- sessions (column NULL) fall back to text resolution unchanged.
--
-- No migration runner in this project — this mirrors the inline ALTER in the
-- capadex_sessions bootstrap in routes/capadex.ts; both must stay in sync.
-- The value references capadex_concerns_master.id (SERIAL/INTEGER), the same
-- key joined as capadex_concern_signal_map.concern_pk.

ALTER TABLE capadex_sessions
  ADD COLUMN IF NOT EXISTS master_concern_pk INTEGER;
