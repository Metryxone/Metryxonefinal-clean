-- Provenance column for user-facing Role-DNA weights.
--
-- onto_role_weights historically carried only hand-curated rows, so getRoleDNA /
-- getRoleVector hard-coded `'curated'::text AS source`. To make the provenance
-- badges on OntologyExplorerPage / CareerMobilityPage actually fire, real O*NET
-- weights (map_role_competency.source in 'onet' / 'onet_derived') are bridged into
-- this table by services/onet-onto-weight-bridge.ts. Each row now records its
-- genuine provenance instead of an SQL literal.
--
--   'curated'      — hand-authored Role-DNA weight (default; unchanged behaviour).
--   'onet'         — NATIVE weight, rated directly by O*NET for an occupation this
--                    role resolves to ("Verified from O*NET"; higher confidence).
--   'onet_derived' — ESTIMATED weight inherited from a related O*NET occupation.
--
-- Precedence: curated > 'onet' (native) > 'onet_derived' (estimated). VARCHAR(20)
-- already fits the 'onet' value, so no DDL change is needed for it.
--
-- Mirrored by a lazy ensureOntoRoleWeightSourceColumn() (no migration runner).
ALTER TABLE onto_role_weights
  ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'curated';
