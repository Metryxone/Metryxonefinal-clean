-- Phase 1 follow-up: normalise institution_accreditations.valid_from so the
-- unique constraint (institution_id, accreditation_authority, valid_from)
-- behaves idempotently. Postgres treats NULLs as distinct under UNIQUE, which
-- caused duplicate rows on re-seed. We collapse NULL → fixed sentinel and
-- set the column DEFAULT so future inserts inherit the same behaviour.

BEGIN;

-- 1) Drop duplicates created by mixing NULL + '1900-01-01' for same key.
DELETE FROM institution_accreditations a
 WHERE a.valid_from = DATE '1900-01-01'
   AND EXISTS (
     SELECT 1 FROM institution_accreditations b
      WHERE b.institution_id = a.institution_id
        AND b.accreditation_authority = a.accreditation_authority
        AND b.valid_from IS NULL
   );

-- 2) Collapse remaining NULLs to sentinel.
UPDATE institution_accreditations
   SET valid_from = DATE '1900-01-01'
 WHERE valid_from IS NULL;

-- 3) Lock in the default + NOT NULL so application code can omit valid_from safely.
ALTER TABLE institution_accreditations
  ALTER COLUMN valid_from SET DEFAULT DATE '1900-01-01',
  ALTER COLUMN valid_from SET NOT NULL;

COMMIT;
