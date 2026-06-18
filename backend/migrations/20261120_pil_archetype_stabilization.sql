-- CAPADEX Problem Intelligence Layer (PIL) — Phase 2.3: Behavioral Grounding &
-- Archetype Stabilization. Strictly ADDITIVE. Adds three honest, read-only quality
-- fields to archetype_validation; never alters existing tables/data or any other phase.
-- Canonical DDL — mirrors the lazy ensureSchema() ALTERs in
-- backend/services/pil/archetype-pipeline.ts. No migration runner is used.
--
--   grounding_ceiling            : share of an archetype's members with ANY relationship
--                                  path to behavioral evidence (direct framing/behavior OR
--                                  propagated) = the MAX grounding achievable without
--                                  fabricating evidence. achieved == ceiling ⇒ at data ceiling.
--   weak_reason                  : why a WEAK archetype is weak — 'underpopulated' |
--                                  'low_distinctiveness' | 'missing_behavioral_evidence' | ''.
--                                  Distinguishes "merge candidate" from "needs authored evidence".
--   stabilization_recommendation : read-only suggestion for the HUMAN governance layer —
--                                  'merge:<key>' | 'author_behavioral_evidence' |
--                                  'review_*' | 'none'. NEVER auto-applied.

ALTER TABLE archetype_validation
  ADD COLUMN IF NOT EXISTS grounding_ceiling NUMERIC(5,4) NOT NULL DEFAULT 0;
ALTER TABLE archetype_validation
  ADD COLUMN IF NOT EXISTS weak_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE archetype_validation
  ADD COLUMN IF NOT EXISTS stabilization_recommendation TEXT NOT NULL DEFAULT 'none';
