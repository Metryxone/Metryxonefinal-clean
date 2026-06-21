-- Phase 6.5 — Usage Metering · widen the metered usage-type vocabulary to the eight business
-- dimensions (adds candidates / jobs / employers / institutions / storage to the existing
-- views/searches/unlocks/assessments/downloads/exports/api). Credits is a consumable balance handled
-- by the credit ledger (comm_credit_ledger) and needs no usage_type.
--
-- ADDITIVE + IDEMPOTENT: only widens the comm_usage_events.usage_type CHECK constraint when the new
-- vocabulary is not yet present. Mirrors services/commercial/metering-schema.ts (the runtime bootstrap).
-- No-op when comm_usage_events does not exist (flag-OFF deployments never created it).

DO $$
BEGIN
  IF to_regclass('comm_usage_events') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
        WHERE conrelid = 'comm_usage_events'::regclass
          AND conname  = 'comm_usage_events_usage_type_check'
          AND pg_get_constraintdef(oid) LIKE '%institutions%'
     )
  THEN
    ALTER TABLE comm_usage_events DROP CONSTRAINT IF EXISTS comm_usage_events_usage_type_check;
    ALTER TABLE comm_usage_events ADD CONSTRAINT comm_usage_events_usage_type_check
      CHECK (usage_type IN ('views','searches','unlocks','assessments','downloads','exports','api',
                            'candidates','jobs','employers','institutions','storage'));
  END IF;
END $$;
