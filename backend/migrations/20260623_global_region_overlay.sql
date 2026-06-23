-- PHASE 8 — Global Competency (structural framework). Additive, reversible, flag-gated.
--
-- ONE additive overlay table that threads a REGION dimension through the five
-- global-deployability surfaces (role libraries · benchmarks · competency models ·
-- readiness models · demand intelligence) WITHOUT mutating any existing table.
--
-- A row tags an EXISTING entity (entity_ref, in its surface's own id/code space) to a
-- region. The DEFAULT region (IN/India) inherits today's real global content directly
-- from the backing tables; non-default regions are populated ONLY by rows here, so they
-- are honestly empty until curated content is assigned. Nothing existing is altered; the
-- whole phase is reversible by deleting rows with this provenance (or dropping the table).
--
-- This migration is applied LAZILY (ensure-schema) ONLY on the flag-gated POST path, so
-- when `globalCompetency` is OFF the table is never created → byte-identical incl. schema.

CREATE TABLE IF NOT EXISTS global_region_content (
  id           BIGSERIAL PRIMARY KEY,
  surface      TEXT NOT NULL,
  region_code  TEXT NOT NULL,
  entity_ref   TEXT NOT NULL,
  provenance   TEXT NOT NULL DEFAULT 'phase8_global_competency',
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One assignment per (surface, region, entity) — idempotent ON CONFLICT target.
CREATE UNIQUE INDEX IF NOT EXISTS uq_grc_surface_region_entity
  ON global_region_content (surface, region_code, entity_ref);

CREATE INDEX IF NOT EXISTS idx_grc_region ON global_region_content (region_code);
CREATE INDEX IF NOT EXISTS idx_grc_surface ON global_region_content (surface);
CREATE INDEX IF NOT EXISTS idx_grc_provenance ON global_region_content (provenance);
