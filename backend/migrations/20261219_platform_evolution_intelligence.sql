-- ============================================================================
-- MX-700 Phase 1.40 — Platform Evolution & Technical Debt Intelligence Engine
-- ----------------------------------------------------------------------------
-- ENHANCEMENT-ONLY. This phase COMPOSES the Phase 1.37 Foundation
-- (platform_lifecycle_registry / capability_catalog / relationships /
-- state_history), the Phase 1.38 Management ledgers (platform_lifecycle_
-- {deprecation,retirement,version_ledger,evolution}) and the Phase 1.39
-- Intelligence layer. It introduces NO duplicate debt/version/deprecation/
-- retirement/evolution registry and NO parallel engine — the version,
-- deprecation, retirement and evolution intelligence views READ the existing
-- 1.38 ledgers via their getters.
--
-- It adds only the three GENUINELY-NEW persistence surfaces that no prior phase
-- models:
--   1. platform_evolution_technical_debt  — a curated technical-debt registry
--      (TODO/FIXME/HACK/XXX repo markers are MEASURED read-only at request time,
--       never written here; this table is the human-tracked debt program).
--   2. platform_evolution_knowledge       — a knowledge-preservation registry of
--      engineering/architecture/historical/migration decisions + lessons learned
--      (the .agents/memory/* and docs/* stores are INDEXED read-only; this table
--       is the structured, queryable preservation layer).
--   3. platform_evolution_audit_snapshots — append-only continuous-evolution
--      audit snapshots (point-in-time MEASURED evolution metrics for drift).
--
-- Flag-gated: the backend NEVER runs this DDL unless `platformEvolutionIntelligence`
-- (FF_PLATFORM_EVOLUTION_INTELLIGENCE) is ON. Each table is mirrored by a lazy
-- ensure-schema in backend/services/platform-evolution-intelligence.ts that runs
-- ONLY on a flag-ON WRITE path, so with the flag OFF none of these tables are ever
-- created -> byte-identical legacy behaviour incl. schema. lifecycle_uid is a SOFT
-- reference to platform_lifecycle_registry.lifecycle_uid (no hard FK — registry
-- rows are re-derived by discovery and must not block evolution metadata).
--
-- HONESTY CONTRACT: Technical Debt ≠ Bug · Deprecated ≠ Removed · Retired ≠ Deleted
-- · Archived ≠ Forgotten · Version ≠ Release · Release ≠ Adoption · Knowledge
-- Exists ≠ Runtime Active · Coverage ≠ Confidence ≠ Evidence. Counts are MEASURED,
-- never estimated; null ≠ zero.
-- ============================================================================

-- PART 1 — Technical Debt Registry (curated, human-tracked debt program)
CREATE TABLE IF NOT EXISTS platform_evolution_technical_debt (
  debt_uid               TEXT PRIMARY KEY,
  title                  TEXT NOT NULL,
  debt_category          TEXT,                       -- e.g. architecture / code / data / dependency / documentation / test
  debt_type              TEXT,                       -- e.g. shortcut / workaround / deprecated_api / missing_coverage
  debt_owner             TEXT,                       -- honest-NULL when unassigned (never fabricated)
  priority               TEXT,                       -- low / medium / high / critical
  severity               TEXT,                       -- low / medium / high / critical
  impact                 TEXT,
  dependencies           TEXT[] NOT NULL DEFAULT '{}',
  status                 TEXT NOT NULL DEFAULT 'open',-- open / acknowledged / in_progress / resolved / accepted
  resolution_history     JSONB NOT NULL DEFAULT '[]',-- append-only [{status,note,actor,at}]
  evidence               TEXT,
  documentation_reference TEXT,
  repository_reference   TEXT,                        -- soft pointer to file[:line] in the repo SSOT
  lifecycle_uid          TEXT,                        -- soft ref to platform_lifecycle_registry (nullable)
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pev_debt_status ON platform_evolution_technical_debt (status, updated_at DESC);

-- PART 5 — Knowledge Preservation Registry (engineering/architecture/historical/migration decisions + lessons)
CREATE TABLE IF NOT EXISTS platform_evolution_knowledge (
  knowledge_uid          TEXT PRIMARY KEY,
  decision_type          TEXT NOT NULL,               -- engineering / architecture / historical / migration / lesson
  title                  TEXT NOT NULL,
  decision               TEXT,
  rationale              TEXT,
  lessons_learned        TEXT,
  documentation_links    TEXT[] NOT NULL DEFAULT '{}',
  repository_reference   TEXT,
  lifecycle_uid          TEXT,                        -- soft ref (nullable)
  preserved_by           TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pev_knowledge_type ON platform_evolution_knowledge (decision_type, created_at DESC);

-- PART 9 — Continuous Evolution Audit (append-only point-in-time MEASURED metrics for drift)
CREATE TABLE IF NOT EXISTS platform_evolution_audit_snapshots (
  id                     BIGSERIAL PRIMARY KEY,
  snapshot_uid           TEXT UNIQUE NOT NULL,
  -- Six SEPARATE measured scores (each independent; NEVER composited into one verdict). NULL when not measurable.
  technical_debt_health  NUMERIC,
  version_health         NUMERIC,
  repository_evolution   NUMERIC,
  knowledge_health       NUMERIC,
  migration_health       NUMERIC,
  architecture_stability NUMERIC,
  metrics                JSONB NOT NULL DEFAULT '{}', -- full measured payload captured verbatim for drift
  debt_indicators        JSONB NOT NULL DEFAULT '{}', -- measured repo marker + registry counts
  captured_by            TEXT,
  captured_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pev_audit_captured_at ON platform_evolution_audit_snapshots (captured_at DESC);
