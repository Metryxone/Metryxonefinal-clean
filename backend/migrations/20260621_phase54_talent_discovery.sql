-- PHASE 5.4 — Talent Discovery Engine (canonical additive schema)
-- Backs the curation surfaces (Talent Pools / Shortlists / Saved Searches).
-- Candidate search/filter/segmentation read from the EXISTING employer_candidates
-- table and require NO schema change. These tables are created lazily at runtime
-- by ensureTalentDiscoverySchema() on the first WRITE (flag-gated); this file is
-- the canonical record for deploy. All additive — flag-OFF is byte-identical.

CREATE TABLE IF NOT EXISTS talent_pools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  segment_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talent_pool_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id uuid NOT NULL REFERENCES talent_pools(id) ON DELETE CASCADE,
  candidate_id text NOT NULL REFERENCES employer_candidates(id) ON DELETE CASCADE,
  note text,
  added_by text NOT NULL REFERENCES users(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pool_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS talent_shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  job_id text,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS talent_shortlist_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id uuid NOT NULL REFERENCES talent_shortlists(id) ON DELETE CASCADE,
  candidate_id text NOT NULL REFERENCES employer_candidates(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'shortlisted',
  note text,
  added_by text NOT NULL REFERENCES users(id),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shortlist_id, candidate_id)
);

CREATE TABLE IF NOT EXISTS talent_saved_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_talent_pool_members_pool ON talent_pool_members (pool_id);
CREATE INDEX IF NOT EXISTS idx_talent_pool_members_cand ON talent_pool_members (candidate_id);
CREATE INDEX IF NOT EXISTS idx_talent_shortlist_members_sl ON talent_shortlist_members (shortlist_id);
CREATE INDEX IF NOT EXISTS idx_talent_shortlist_members_cand ON talent_shortlist_members (candidate_id);
