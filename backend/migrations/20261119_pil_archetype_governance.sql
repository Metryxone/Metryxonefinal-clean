-- CAPADEX Problem Intelligence Layer (PIL) — Phase 2.2: Archetype Governance.
-- Strictly ADDITIVE. The Phase-2 runner TRUNCATEs and rebuilds all six archetype
-- tables every run; human review decisions therefore live in THIS durable table,
-- which the runner NEVER truncates, and are re-applied as an override layer on top
-- of the deterministic pass. Deterministic algorithm stays byte-identical; the human
-- decision wins; decisions survive re-runs.
-- This DDL is canonical and mirrors the lazy ensureGovernanceSchema() bootstrap in
-- backend/services/pil/archetype-governance.ts. No migration runner is used.

-- 2.2 archetype_governance_decisions — durable human overrides (never truncated).
CREATE TABLE IF NOT EXISTS archetype_governance_decisions (
  decision_id          SERIAL PRIMARY KEY,
  concern_id           TEXT NOT NULL UNIQUE,
  decision_type        TEXT NOT NULL
    CHECK (decision_type IN ('reassign','reject','resolve_unmatched','approve')),
  target_archetype_key TEXT,
  rationale            TEXT NOT NULL DEFAULT '',
  decided_by           TEXT NOT NULL DEFAULT 'superadmin',
  active               BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS archetype_governance_active_idx
  ON archetype_governance_decisions(active);

-- Additive override provenance on the existing concern map (idempotent).
ALTER TABLE archetype_concern_map
  ADD COLUMN IF NOT EXISTS governed BOOLEAN NOT NULL DEFAULT false;

-- Widen assignment_method to allow 'human_override' (drop the auto-named inline CHECK
-- from the Phase-2 table, then install a named 3-value CHECK).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'archetype_concern_map_assignment_method_check') THEN
    ALTER TABLE archetype_concern_map
      DROP CONSTRAINT archetype_concern_map_assignment_method_check;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'archetype_concern_method_chk') THEN
    ALTER TABLE archetype_concern_map ADD CONSTRAINT archetype_concern_method_chk
      CHECK (assignment_method IN ('signature','signature+behavior','human_override'));
  END IF;
END $$;
