-- Phase 3 — Career Mobility & Pathway Intelligence
-- Namespaced `mobility_*`. Reads Phase 1 (`onto_*`) and Phase 2 (`bench_*`).
-- Idempotent.

BEGIN;

-- 1. Curated career paths (multi-step role-family progressions) -------------
CREATE TABLE IF NOT EXISTS mobility_career_paths (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT,
  -- ordered list of role_family_ids; supports branches as nested arrays.
  sequence            JSONB NOT NULL DEFAULT '[]'::jsonb,
  typical_duration_months INTEGER,
  difficulty          TEXT CHECK (difficulty IN ('low','moderate','high','intensive')),
  version             TEXT NOT NULL DEFAULT '3.0.0',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Directed transitions between roles ------------------------------------
CREATE TABLE IF NOT EXISTS mobility_role_transitions (
  id                  BIGSERIAL PRIMARY KEY,
  from_role_id        TEXT NOT NULL REFERENCES onto_roles(id),
  to_role_id          TEXT NOT NULL REFERENCES onto_roles(id),
  transition_type     TEXT NOT NULL CHECK (transition_type IN
                        ('lateral','vertical','cross_functional','cross_industry','foundational')),
  difficulty          TEXT NOT NULL CHECK (difficulty IN ('low','moderate','high','intensive')),
  typical_duration_months INTEGER NOT NULL DEFAULT 12,
  frequency_band      TEXT CHECK (frequency_band IN ('rare','uncommon','common','frequent')),
  notes               TEXT,
  version             TEXT NOT NULL DEFAULT '3.0.0',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_role_id, to_role_id)
);
CREATE INDEX IF NOT EXISTS idx_mob_trans_from ON mobility_role_transitions(from_role_id);
CREATE INDEX IF NOT EXISTS idx_mob_trans_to   ON mobility_role_transitions(to_role_id);

-- 3. Pairwise competency transferability ------------------------------------
CREATE TABLE IF NOT EXISTS mobility_transferability_maps (
  id                  BIGSERIAL PRIMARY KEY,
  source_competency_id TEXT NOT NULL REFERENCES onto_competencies(id),
  target_competency_id TEXT NOT NULL REFERENCES onto_competencies(id),
  transferability_score NUMERIC(3,2) NOT NULL CHECK (transferability_score >= 0 AND transferability_score <= 1),
  transfer_type       TEXT NOT NULL CHECK (transfer_type IN ('identical','direct','analogous','foundational','unrelated')),
  rationale           TEXT,
  basis               JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {same_family:bool, same_domain:bool, complexity_delta:int}
  version             TEXT NOT NULL DEFAULT '3.0.0',
  UNIQUE (source_competency_id, target_competency_id)
);
CREATE INDEX IF NOT EXISTS idx_mob_xfer_src ON mobility_transferability_maps(source_competency_id);

-- 4. Cached competency gap profile (optional cache layer) -------------------
CREATE TABLE IF NOT EXISTS mobility_competency_gaps (
  id                  BIGSERIAL PRIMARY KEY,
  from_role_id        TEXT NOT NULL REFERENCES onto_roles(id),
  to_role_id          TEXT NOT NULL REFERENCES onto_roles(id),
  gaps                JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_gap_score     NUMERIC(5,2),
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version             TEXT NOT NULL DEFAULT '3.0.0',
  UNIQUE (from_role_id, to_role_id)
);

-- 5. Development pathways (sequenced competency progressions) ---------------
CREATE TABLE IF NOT EXISTS mobility_development_pathways (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT,
  terminal_competency_id TEXT NOT NULL REFERENCES onto_competencies(id),
  total_weeks         INTEGER NOT NULL DEFAULT 24,
  difficulty          TEXT CHECK (difficulty IN ('low','moderate','high','intensive')),
  category            TEXT,   -- 'leadership' | 'strategic' | 'execution' | 'interpersonal' | ...
  version             TEXT NOT NULL DEFAULT '3.0.0',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Capability maturity model (5-level per competency) ---------------------
CREATE TABLE IF NOT EXISTS mobility_capability_maturity (
  id                  BIGSERIAL PRIMARY KEY,
  competency_id       TEXT NOT NULL REFERENCES onto_competencies(id),
  level               INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  level_name          TEXT NOT NULL,
  score_anchor        NUMERIC(5,2) NOT NULL,                    -- 0..100 anchor
  behavioural_anchors JSONB NOT NULL DEFAULT '[]'::jsonb,
  est_weeks_from_prior INTEGER NOT NULL DEFAULT 0,
  version             TEXT NOT NULL DEFAULT '3.0.0',
  UNIQUE (competency_id, level)
);
CREATE INDEX IF NOT EXISTS idx_mob_mat_comp ON mobility_capability_maturity(competency_id);

-- 7. Precomputed role mobility scores ---------------------------------------
CREATE TABLE IF NOT EXISTS mobility_role_mobility_scores (
  id                  BIGSERIAL PRIMARY KEY,
  from_role_id        TEXT NOT NULL REFERENCES onto_roles(id),
  to_role_id          TEXT NOT NULL REFERENCES onto_roles(id),
  overlap_score       NUMERIC(5,2) NOT NULL,   -- 0..100 weighted overlap of role DNAs
  transferability_score NUMERIC(5,2) NOT NULL, -- 0..100 strength-weighted transfer
  gap_size_score      NUMERIC(5,2) NOT NULL,   -- 0..100 (100 = no gap)
  mobility_score      NUMERIC(5,2) NOT NULL,   -- composite 0..100
  computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version             TEXT NOT NULL DEFAULT '3.0.0',
  UNIQUE (from_role_id, to_role_id)
);

-- 8. Learning sequences (concrete ordered steps within a pathway) ----------
CREATE TABLE IF NOT EXISTS mobility_learning_sequences (
  id                  BIGSERIAL PRIMARY KEY,
  pathway_id          TEXT NOT NULL REFERENCES mobility_development_pathways(id) ON DELETE CASCADE,
  position            INTEGER NOT NULL,
  competency_id       TEXT NOT NULL REFERENCES onto_competencies(id),
  action              TEXT NOT NULL,
  est_weeks           INTEGER NOT NULL DEFAULT 4,
  resource_type       TEXT CHECK (resource_type IN ('reflection','practice','coaching','course','project','feedback')),
  target_level        INTEGER CHECK (target_level BETWEEN 1 AND 5),
  UNIQUE (pathway_id, position)
);

-- 9. User aspiration profiles ----------------------------------------------
CREATE TABLE IF NOT EXISTS mobility_aspiration_profiles (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT,
  session_id          TEXT,
  target_role_id      TEXT NOT NULL REFERENCES onto_roles(id),
  motivation_notes    TEXT,
  horizon_months      INTEGER DEFAULT 18,
  captured_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mob_asp_user ON mobility_aspiration_profiles(user_id);

-- 10. Adjacent role mappings -----------------------------------------------
CREATE TABLE IF NOT EXISTS mobility_adjacent_role_mappings (
  id                  BIGSERIAL PRIMARY KEY,
  role_id             TEXT NOT NULL REFERENCES onto_roles(id),
  adjacent_role_id    TEXT NOT NULL REFERENCES onto_roles(id),
  adjacency_score     NUMERIC(3,2) NOT NULL CHECK (adjacency_score >= 0 AND adjacency_score <= 1),
  basis               JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {same_family,same_layer,domain_overlap,competency_overlap}
  version             TEXT NOT NULL DEFAULT '3.0.0',
  UNIQUE (role_id, adjacent_role_id)
);
CREATE INDEX IF NOT EXISTS idx_mob_adj_role ON mobility_adjacent_role_mappings(role_id);

-- Audit log ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mobility_audit_logs (
  id                  BIGSERIAL PRIMARY KEY,
  event_type          TEXT NOT NULL,
  endpoint            TEXT NOT NULL,
  user_id             TEXT, session_id TEXT,
  from_role_id        TEXT, to_role_id TEXT,
  request_summary     JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_summary    JSONB NOT NULL DEFAULT '{}'::jsonb,
  version             TEXT NOT NULL DEFAULT '3.0.0',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mob_audit_evt ON mobility_audit_logs(event_type, created_at DESC);

COMMIT;
