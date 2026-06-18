-- Phase 1 ontology integrity fix.
--
-- Code review (architect, 2026-05-20) flagged that the schema allowed a
-- competency to point at a family belonging to a *different* domain, and that
-- two seed rows already violated this invariant. We:
--   1. Re-align the offending seed rows so each competency.domain_id matches
--      its family's domain_id.
--   2. Add a composite UNIQUE on onto_families (id, domain_id) so it can be
--      referenced by a composite FK.
--   3. Add a composite FK on onto_competencies (family_id, domain_id) ->
--      onto_families (id, domain_id), making divergence impossible going
--      forward.
--
-- Idempotent and reversible-safe (only adds constraints + updates data).

BEGIN;

-- 1. Realign existing data ---------------------------------------------------
-- comp_systems_thinking: family is fam_strategic_reasoning (dom_strategic),
-- so promote its domain to dom_strategic (systems thinking is, in fact, a
-- strategic-reasoning competency in our ontology — scientific_type stays
-- 'cognitive', which is a separate axis).
UPDATE onto_competencies
   SET domain_id = 'dom_strategic'
 WHERE id = 'comp_systems_thinking'
   AND domain_id <> 'dom_strategic';

-- comp_adaptability: family is fam_learning_agility (dom_cognitive). Move
-- domain to dom_cognitive to match. (Scientific_type stays 'behavioral'.)
UPDATE onto_competencies
   SET domain_id = 'dom_cognitive'
 WHERE id = 'comp_adaptability'
   AND domain_id <> 'dom_cognitive';

-- 2. Composite UNIQUE on onto_families (id, domain_id) ----------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'onto_families_id_domain_uniq'
  ) THEN
    ALTER TABLE onto_families
      ADD CONSTRAINT onto_families_id_domain_uniq UNIQUE (id, domain_id);
  END IF;
END $$;

-- 3. Composite FK enforcing family.domain_id == competency.domain_id --------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'onto_competencies_family_domain_fk'
  ) THEN
    ALTER TABLE onto_competencies
      ADD CONSTRAINT onto_competencies_family_domain_fk
      FOREIGN KEY (family_id, domain_id)
      REFERENCES onto_families (id, domain_id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- 4. Verification ------------------------------------------------------------
DO $$
DECLARE
  bad_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bad_count
    FROM onto_competencies c
    JOIN onto_families f ON f.id = c.family_id
   WHERE c.domain_id <> f.domain_id;

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'Ontology integrity check failed: % competencies have domain_id != family.domain_id',
      bad_count;
  END IF;
END $$;

COMMIT;
