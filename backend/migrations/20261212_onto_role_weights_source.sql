-- Provenance column for user-facing Role-DNA weights.
--
-- onto_role_weights historically carried only hand-curated rows, so getRoleDNA /
-- getRoleVector hard-coded `'curated'::text AS source`. To make the "Estimated /
-- inherited" honesty badge on OntologyExplorerPage / CareerMobilityPage actually
-- fire, real O*NET-derived weights (source='onet_derived' in map_role_competency)
-- are bridged into this table by services/onet-onto-weight-bridge.ts. Each row now
-- records its genuine provenance instead of an SQL literal.
--
--   'curated'      — hand-authored Role-DNA weight (default; unchanged behaviour).
--   'onet_derived' — estimated weight inherited from a related O*NET occupation.
--
-- Mirrored by a lazy ensureOntoRoleWeightSourceColumn() (no migration runner).
ALTER TABLE onto_role_weights
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'curated';
