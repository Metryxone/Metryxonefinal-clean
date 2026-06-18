-- CAPADEX WC-3 Phase A — additive, reversible schema.
-- Canonical mirror of backend/services/wc3/wc3-schema.ts (no migration runner in
-- this repo — the lazy ensure*Schema() functions create these at runtime). Every
-- table is wc3_* namespaced and additive; no existing table is mutated and no
-- ontology / signal / concern data is touched.
--
-- Layers:
--   L1 Stage Intelligence       — wc3_stage_definitions, wc3_stage_entity_map,
--                                 wc3_stage_state, wc3_stage_progression
--   L4 Personalization Wiring   — wc3_personalization_profile, wc3_personalization_decisions
--   L6 Longitudinal Foundation  — wc3_longitudinal_snapshots (history capture),
--                                 wc3_longitudinal_trends (created but UNPOPULATED
--                                 in Phase A — storage only, no analytics)
--
-- Reversal (full): DROP TABLE IF EXISTS
--   wc3_stage_progression, wc3_stage_state, wc3_stage_entity_map, wc3_stage_definitions,
--   wc3_personalization_decisions, wc3_personalization_profile,
--   wc3_longitudinal_trends, wc3_longitudinal_snapshots CASCADE;

-- ── L1: Stage Intelligence ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wc3_stage_definitions (
  stage_key     text PRIMARY KEY,
  order_index   integer NOT NULL,
  weight        numeric NOT NULL,
  description   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wc3_stage_entity_map (
  source_stage_code text PRIMARY KEY,
  canonical_stage   text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wc3_stage_state (
  session_id        uuid PRIMARY KEY,
  user_email        text,
  user_id           uuid,
  source_stage_code text,
  canonical_stage   text NOT NULL,
  stage_order_index integer NOT NULL DEFAULT 0,
  stage_weight      numeric,
  score             numeric,
  score_level       text,
  csi_score         numeric,
  csi_stage         text,
  confidence        numeric NOT NULL DEFAULT 0,
  resolved_at       timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wc3_stage_progression (
  id                bigserial PRIMARY KEY,
  session_id        uuid,
  user_email        text,
  canonical_stage   text NOT NULL,
  stage_order_index integer NOT NULL DEFAULT 0,
  score             numeric,
  csi_score         numeric,
  csi_stage         text,
  trigger           text NOT NULL DEFAULT 'session_complete',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc3_stage_state_email   ON wc3_stage_state(user_email);
CREATE INDEX IF NOT EXISTS idx_wc3_stage_prog_email    ON wc3_stage_progression(user_email);
CREATE INDEX IF NOT EXISTS idx_wc3_stage_prog_session  ON wc3_stage_progression(session_id);
CREATE INDEX IF NOT EXISTS idx_wc3_stage_prog_created  ON wc3_stage_progression(created_at DESC);

-- Seed authored reference data (idempotent). Canonical 5-stage progression:
-- Awareness(0.25) → Curiosity(0.50) → Clarity(0.75) → Growth(1.00) → Mastery(1.25).
INSERT INTO wc3_stage_definitions (stage_key, order_index, weight, description) VALUES
  ('Awareness', 0, 0.25, 'Becoming aware of the concern area'),
  ('Curiosity', 1, 0.50, 'Actively exploring the concern'),
  ('Clarity',   2, 0.75, 'Gaining clarity / insight'),
  ('Growth',    3, 1.00, 'Developing and growing'),
  ('Mastery',   4, 1.25, 'Demonstrating mastery')
ON CONFLICT (stage_key) DO NOTHING;

-- Insight is aliased to Clarity by design.
INSERT INTO wc3_stage_entity_map (source_stage_code, canonical_stage) VALUES
  ('CAP_CUR', 'Curiosity'),
  ('CAP_INS', 'Clarity'),
  ('CAP_GRW', 'Growth'),
  ('CAP_MAS', 'Mastery')
ON CONFLICT (source_stage_code) DO NOTHING;

-- ── L4: Personalization Wiring ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wc3_personalization_profile (
  user_email        text PRIMARY KEY,
  last_age          integer,
  last_age_band     text,
  last_persona      text,
  last_construct    text,
  dims_used         jsonb DEFAULT '{}',
  decisions_count   integer NOT NULL DEFAULT 0,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wc3_personalization_decisions (
  id                bigserial PRIMARY KEY,
  session_id        uuid,
  user_email        text,
  master_concern_id text,
  construct_key     text,
  clarity_source    text,
  age               integer,
  age_band          text,
  canonical_persona text,
  is_proxy          boolean,
  severity          text,
  question_count    integer,
  dims_used         jsonb DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc3_personalization_dec_email   ON wc3_personalization_decisions(user_email);
CREATE INDEX IF NOT EXISTS idx_wc3_personalization_dec_created ON wc3_personalization_decisions(created_at DESC);

-- ── L6: Longitudinal Foundation (storage + history capture ONLY) ─────────────
CREATE TABLE IF NOT EXISTS wc3_longitudinal_snapshots (
  id                bigserial PRIMARY KEY,
  session_id        uuid,
  user_email        text,
  user_id           uuid,
  concern_name      text,
  stage_code        text,
  canonical_stage   text,
  score             numeric,
  score_level       text,
  csi_score         numeric,
  csi_stage         text,
  snapshot          jsonb NOT NULL DEFAULT '{}',
  captured_at       timestamptz NOT NULL DEFAULT now()
);

-- Created for forward-compatibility but intentionally UNPOPULATED in Phase A
-- (no progression analytics / trend computation yet).
CREATE TABLE IF NOT EXISTS wc3_longitudinal_trends (
  id                bigserial PRIMARY KEY,
  user_email        text,
  metric            text,
  direction         text,
  delta             numeric,
  window_label      text,
  computed_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wc3_longitudinal_snap_email    ON wc3_longitudinal_snapshots(user_email);
CREATE INDEX IF NOT EXISTS idx_wc3_longitudinal_snap_user     ON wc3_longitudinal_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_wc3_longitudinal_snap_session  ON wc3_longitudinal_snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_wc3_longitudinal_snap_captured ON wc3_longitudinal_snapshots(captured_at ASC);
