-- WC-1B: Signal Grounding Implementation (ADDITIVE, non-destructive).
-- Records REUSE relationships between existing bridge tags and existing atomic signals
-- (via signal families), using the WC-1A approved GREEN mappings. Mirrors the lazy
-- ensure* bootstrap in backend/scripts/audit/wc1b-signal-grounding-impl.ts.
--
-- Guarantees (enforced by the implementation script + constraints below):
--   * No new signals          (only references existing capadex_atomic_signals rows)
--   * No new concerns         (capadex_concerns_master untouched)
--   * No new bridge tags      (references existing bridge-tag strings only)
--   * No ontology restructuring (no ALTER of signal/concern/tag tables)
--   * No signal duplication   (UNIQUE per bridge_tag)
-- Reversible: DELETE FROM ... WHERE provenance='wc1a_green'  OR  DROP TABLE ...

CREATE TABLE IF NOT EXISTS capadex_bridge_tag_family_grounding (
  id                 BIGSERIAL PRIMARY KEY,
  bridge_tag         TEXT NOT NULL,
  signal_family      TEXT NOT NULL,
  domain_name        TEXT,
  similarity         NUMERIC(6,4),
  atomic_signal_count INTEGER NOT NULL DEFAULT 0,
  evidence_strength  TEXT,
  provenance         TEXT NOT NULL DEFAULT 'wc1a_green',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bridge_tag, signal_family)
);

CREATE TABLE IF NOT EXISTS capadex_bridge_tag_signal_grounding (
  id                 BIGSERIAL PRIMARY KEY,
  bridge_tag         TEXT NOT NULL,
  signal_family      TEXT NOT NULL,
  domain_name        TEXT,
  atomic_signal_id   TEXT NOT NULL,
  atomic_signal_name TEXT,
  similarity         NUMERIC(6,4),
  evidence_strength  TEXT,
  provenance         TEXT NOT NULL DEFAULT 'wc1a_green',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bridge_tag, atomic_signal_id)
);

CREATE INDEX IF NOT EXISTS idx_btsg_bridge_tag ON capadex_bridge_tag_signal_grounding (bridge_tag);
CREATE INDEX IF NOT EXISTS idx_btsg_atomic     ON capadex_bridge_tag_signal_grounding (atomic_signal_id);
CREATE INDEX IF NOT EXISTS idx_btsg_family     ON capadex_bridge_tag_signal_grounding (signal_family);
CREATE INDEX IF NOT EXISTS idx_btfg_bridge_tag ON capadex_bridge_tag_family_grounding (bridge_tag);
