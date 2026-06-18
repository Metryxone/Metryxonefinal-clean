-- Orchestration Context: allow capadex_runtime_sessions to be inserted BEFORE
-- a capadex_sessions row exists. The analyze endpoint derives actor/target
-- persona + relationship_type from (persona, assesseeType, age) and persists
-- a runtime envelope at the start of the funnel — the session row is created
-- later when the user begins the assessment. The UNIQUE constraint on
-- session_id is preserved (Postgres treats multiple NULLs as distinct in
-- unique indexes), so concurrent pre-session inserts remain safe; once a
-- session is created, the linking row carries the real uuid.
ALTER TABLE capadex_runtime_sessions
  ALTER COLUMN session_id DROP NOT NULL;
