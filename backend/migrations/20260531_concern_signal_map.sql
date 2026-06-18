-- CAPADEX Concern → Signal Mapping (Task #16, 2026-05-31)
--
-- Bridges the two previously-disconnected data islands — the Concerns Master
-- (`capadex_concerns_master`, ~2,488 concerns) and the Signal Ontology
-- (`capadex_signals` Tier-3, `capadex_atomic_signals` Tier-4, and the dynamically
-- derived composite clusters) — by recording, for every concern, the signals that
-- should be monitored when that concern is raised.
--
-- Each row is one (concern, signal-tier, signal-ref) mapping carrying the
-- resolution method, a confidence score (0..1) and its strength band. Concerns
-- that resolve to no signal are recorded as an explicit `orphan` row so none ever
-- silently fall through — quality over coverage: orphans are flagged for review,
-- never filled with fabricated signals.
--
-- Canonical migration; mirrored by the lazy `ensureConcernSignalMapSchema()`
-- bootstrap in `backend/services/concern-signal-mapping-engine.ts`.

CREATE TABLE IF NOT EXISTS capadex_concern_signal_map (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concern_pk            INTEGER NOT NULL,            -- capadex_concerns_master.id
  concern_id            TEXT,                        -- routing key (NOT unique)
  relational_bridge_tag TEXT,
  signal_tier           VARCHAR(16) NOT NULL,        -- tier3 | atomic | composite | orphan
  signal_ref            TEXT NOT NULL,               -- signal_id | bridge-tag | composite_key | __orphan__
  signal_name           TEXT,
  domain                TEXT,
  match_method          VARCHAR(32) NOT NULL,        -- bridge_exact | token_semantic | domain_category | cluster_match | bridge_fallback | composite_derived | atomic_bridge | orphan
  score                 NUMERIC(8,4) NOT NULL DEFAULT 0,  -- raw resolution score (explainability)
  confidence            NUMERIC(5,4) NOT NULL DEFAULT 0,  -- 0..1
  confidence_band       VARCHAR(12) NOT NULL DEFAULT 'weak', -- strong | moderate | weak | none
  severity_weight       NUMERIC(5,4),                -- ontology severity of the target signal
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_concern_signal_map
  ON capadex_concern_signal_map (concern_pk, signal_tier, signal_ref);
CREATE INDEX IF NOT EXISTS idx_concern_signal_map_concern ON capadex_concern_signal_map (concern_pk);
CREATE INDEX IF NOT EXISTS idx_concern_signal_map_tier    ON capadex_concern_signal_map (signal_tier);
CREATE INDEX IF NOT EXISTS idx_concern_signal_map_band    ON capadex_concern_signal_map (confidence_band);
CREATE INDEX IF NOT EXISTS idx_concern_signal_map_method  ON capadex_concern_signal_map (match_method);
CREATE INDEX IF NOT EXISTS idx_concern_signal_map_bridge  ON capadex_concern_signal_map (relational_bridge_tag);
