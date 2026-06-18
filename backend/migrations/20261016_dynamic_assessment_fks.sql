-- Phase 4 follow-up — add FKs that were missed in 20261015. Idempotent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crp_session_fk') THEN
    ALTER TABLE cognitive_runtime_profiles
      ADD CONSTRAINT crp_session_fk FOREIGN KEY (session_id)
      REFERENCES dynamic_question_sessions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'aqb_from_question_fk') THEN
    ALTER TABLE adaptive_question_branches
      ADD CONSTRAINT aqb_from_question_fk FOREIGN KEY (from_question_id)
      REFERENCES dynamic_question_generations(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bcl_session_fk') THEN
    ALTER TABLE behavioral_contradiction_logs
      ADD CONSTRAINT bcl_session_fk FOREIGN KEY (session_id)
      REFERENCES dynamic_question_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;
