-- Phase 3 — Psychometric Inference + Stability persistence.
-- Namespaced `psy_*`. Append-only — supports longitudinal explainability.

CREATE TABLE IF NOT EXISTS psy_signal_inferences (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             TEXT        NOT NULL,
  signal_key          TEXT        NOT NULL,
  competency_id       TEXT        NOT NULL,
  alpha               NUMERIC(10,4) NOT NULL,
  beta                NUMERIC(10,4) NOT NULL,
  probability_mastery NUMERIC(6,4)  NOT NULL,
  uncertainty         NUMERIC(6,4)  NOT NULL,
  evidence_strength   NUMERIC(10,4) NOT NULL,
  ci_lower            NUMERIC(6,4)  NOT NULL,
  ci_upper            NUMERIC(6,4)  NOT NULL,
  reliability_composite NUMERIC(6,4),
  prior_alpha         NUMERIC(6,2)  NOT NULL DEFAULT 2,
  prior_beta          NUMERIC(6,2)  NOT NULL DEFAULT 2,
  methodology_version TEXT        NOT NULL DEFAULT '3.0.0',
  inferred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psy_signal_user_ts
  ON psy_signal_inferences (user_id, inferred_at DESC);
CREATE INDEX IF NOT EXISTS idx_psy_signal_user_key
  ON psy_signal_inferences (user_id, signal_key, inferred_at DESC);

CREATE TABLE IF NOT EXISTS psy_competency_inferences (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             TEXT        NOT NULL,
  competency_id       TEXT        NOT NULL,
  signal_count        INTEGER     NOT NULL,
  probability_mastery NUMERIC(6,4) NOT NULL,
  uncertainty         NUMERIC(6,4) NOT NULL,
  evidence_strength   NUMERIC(10,4) NOT NULL,
  ci_lower            NUMERIC(6,4) NOT NULL,
  ci_upper            NUMERIC(6,4) NOT NULL,
  methodology_version TEXT        NOT NULL DEFAULT '3.0.0',
  inferred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psy_competency_user_ts
  ON psy_competency_inferences (user_id, inferred_at DESC);

CREATE TABLE IF NOT EXISTS psy_stability_flags (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             TEXT        NOT NULL,
  rule_id             TEXT        NOT NULL,
  signal_key          TEXT,
  severity            TEXT        NOT NULL,
  stability_index     NUMERIC(6,4) NOT NULL,
  evidence            JSONB       NOT NULL DEFAULT '{}'::jsonb,
  developmental_action TEXT,
  flagged_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psy_stability_user_ts
  ON psy_stability_flags (user_id, flagged_at DESC);

CREATE TABLE IF NOT EXISTS psy_audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  user_id      TEXT,
  endpoint     TEXT NOT NULL,
  status       TEXT NOT NULL,           -- ok | fallback | error
  payload_hash TEXT,
  detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psy_audit_user_ts
  ON psy_audit_logs (user_id, created_at DESC);
