-- ─────────────────────────────────────────────────────────────────────────
-- Phase 2 — Behavioural Micro-Signal persistence (namespaced `bsig_*`)
-- Read-only against ontology / benchmarks. NEVER asserts hiring outcomes.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bsig_signal_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  signal_key      TEXT NOT NULL,
  competency_id   TEXT NOT NULL,
  frequency       INTEGER NOT NULL DEFAULT 0,
  confidence      NUMERIC(5,3) NOT NULL DEFAULT 0,
  evidence_count  INTEGER NOT NULL DEFAULT 0,
  recency_weight  NUMERIC(5,3) NOT NULL DEFAULT 0,
  behavioural_strength NUMERIC(5,3) NOT NULL DEFAULT 0,
  snapshot_ts     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_hash     TEXT,                                  -- sha256 of normalised sources for dedup
  bsig_version    TEXT NOT NULL DEFAULT '2.0.0'
);
CREATE INDEX IF NOT EXISTS idx_bsig_snap_user_ts     ON bsig_signal_snapshots(user_id, snapshot_ts DESC);
CREATE INDEX IF NOT EXISTS idx_bsig_snap_user_signal ON bsig_signal_snapshots(user_id, signal_key, snapshot_ts DESC);

CREATE TABLE IF NOT EXISTS bsig_evidence (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  signal_key      TEXT NOT NULL,
  source_type     TEXT NOT NULL,
  source_id       TEXT,
  snippet         TEXT NOT NULL,
  match_strength  NUMERIC(5,3) NOT NULL DEFAULT 0,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  extracted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bsig_evidence_user_signal ON bsig_evidence(user_id, signal_key, occurred_at DESC);

CREATE TABLE IF NOT EXISTS bsig_contradiction_history (
  id                   BIGSERIAL PRIMARY KEY,
  user_id              TEXT NOT NULL,
  contradiction_score  NUMERIC(5,3) NOT NULL DEFAULT 0,
  rule_id              TEXT NOT NULL,
  severity             TEXT NOT NULL,
  title                TEXT NOT NULL,
  detail               TEXT NOT NULL,
  source_ids           JSONB NOT NULL DEFAULT '[]'::jsonb,
  detected_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bsig_contradiction_user ON bsig_contradiction_history(user_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS bsig_audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT,
  event_type   TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bsig_audit_user_ts ON bsig_audit_logs(user_id, created_at DESC);
