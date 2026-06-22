-- Ontology Hierarchy Completion (Task #51)
-- Canonical migration mirroring ensureHierarchySchema() in routes/ontology-taxonomy.ts.
-- Additive only. There is no migration runner here; the lazy ensureHierarchySchema()
-- (invoked only behind the ontologyHierarchyV2 flag) creates the same objects at runtime.
-- Flag-off the DDL never runs, so the schema is byte-identical to legacy.

-- (1) Sector entity — a parent grouping above industries.
CREATE TABLE IF NOT EXISTS ont_sectors (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nullable FK from industries to sectors. The legacy free-text parent_sector column
-- is retained; sector_id is an additive, structured link populated via the guarded
-- backfill route or manual assignment.
ALTER TABLE ont_industries
  ADD COLUMN IF NOT EXISTS sector_id INTEGER REFERENCES ont_sectors(id) ON DELETE SET NULL;

-- (2) Industry Segment level — a child below industries.
CREATE TABLE IF NOT EXISTS ont_industry_segments (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  industry_id INTEGER REFERENCES ont_industries(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (3) Persisted ont_* -> onto_* role crosswalk. One row per curated onto_role
-- (onto_role_id is TEXT and UNIQUE); ont_role_id is the integer O*NET library role.
-- match_method: manual | code | exact_title | alias | partial_title | unresolved.
CREATE TABLE IF NOT EXISTS map_ont_onto_role (
  id SERIAL PRIMARY KEY,
  onto_role_id TEXT NOT NULL UNIQUE,
  ont_role_id INTEGER REFERENCES ont_roles(id) ON DELETE SET NULL,
  ont_role_code VARCHAR(30),
  match_method VARCHAR(20) NOT NULL DEFAULT 'manual',
  confidence VARCHAR(10) NOT NULL DEFAULT 'medium',
  verified BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_map_ont_onto_role_ont ON map_ont_onto_role(ont_role_id);
