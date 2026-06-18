-- =====================================================================
-- Assessment Writers — bridges Competency Assessment → Phase 1-5 layer
-- Adds two new tables + a nullable FK column on p4_competency_history.
-- Backward compatible: no existing rows altered.
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_assessment_snapshots (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  org_id          TEXT,
  role_id         TEXT,
  assessment_version TEXT NOT NULL DEFAULT '1.0.0',
  source          TEXT NOT NULL DEFAULT 'assessment',
  taken_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  composite_score NUMERIC(6,2),
  n_competencies  INTEGER NOT NULL DEFAULT 0,
  reliability     NUMERIC(4,3) NOT NULL DEFAULT 0.78,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_user_assessment_snapshots_user_taken
  ON user_assessment_snapshots(user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS ix_user_assessment_snapshots_org
  ON user_assessment_snapshots(org_id) WHERE org_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_competency_scores (
  user_id        TEXT NOT NULL,
  competency_id  TEXT NOT NULL,
  score          NUMERIC(6,2) NOT NULL,
  reliability    NUMERIC(4,3) NOT NULL DEFAULT 0.78,
  source         TEXT NOT NULL DEFAULT 'assessment',
  snapshot_id    TEXT REFERENCES user_assessment_snapshots(id) ON DELETE SET NULL,
  assessed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, competency_id)
);

CREATE INDEX IF NOT EXISTS ix_user_competency_scores_competency
  ON user_competency_scores(competency_id);

-- Optional FK on history table (nullable, safe for existing rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'p4_competency_history' AND column_name = 'snapshot_id'
  ) THEN
    EXECUTE 'ALTER TABLE p4_competency_history ADD COLUMN snapshot_id TEXT';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_p4_competency_history_snapshot
  ON p4_competency_history(snapshot_id) WHERE snapshot_id IS NOT NULL;
