-- ============================================================
-- MetryxOne — Verification Infrastructure (Phase 3 of EI)
-- Migration: 20260520_verification_infrastructure.sql
--
-- Adds verification + trust-scoring layer on top of Phase 1/2:
--   * verification_providers      — provider registry (Credly, DigiLocker, ICAI, …)
--   * credential_verifications    — user-owned verification attempts/results
--   * verification_events         — full audit trail (request/success/fail/revoke)
--   * verification_consents       — explicit consent ledger w/ revocation
--   * trust_score_components      — explainable trust-score breakdown per user
--
-- Constraints honoured:
--   - Additive only. No existing table altered.
--   - Verification is OPTIONAL. Users w/o verifications keep current EI behaviour.
--   - All verification actions are auditable.
--   - Consent is explicit, revocable, and logged.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Verification Providers ───────────────────────────────────
-- Registry of external authorities we can verify credentials against.
-- `integration_type` describes how we reach the provider:
--   'oauth'   — user-authorised OAuth (Credly, Accredible)
--   'lookup'  — server-side ID lookup (ICAI/ICSI/ICMAI membership #)
--   'doc'     — document-locker pull (DigiLocker, NAD) — readiness only
--   'manual'  — admin-evidenced override (uploaded certificate, etc.)
CREATE TABLE IF NOT EXISTS verification_providers (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_code      TEXT NOT NULL UNIQUE,             -- 'CREDLY' | 'ACCREDIBLE' | 'DIGILOCKER' | 'NAD' | 'ICAI' | 'ICSI' | 'ICMAI' | 'MANUAL'
  provider_name      TEXT NOT NULL,
  provider_category  TEXT NOT NULL,                    -- 'badge' | 'credential' | 'doc_locker' | 'professional_body' | 'admin'
  integration_type   TEXT NOT NULL,                    -- 'oauth' | 'lookup' | 'doc' | 'manual'
  authority_country  TEXT,                              -- 'IN' | 'GLOBAL'
  authority_url      TEXT,
  default_trust_weight NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (default_trust_weight BETWEEN 0 AND 2),
  status             TEXT NOT NULL DEFAULT 'available', -- 'available' | 'beta' | 'readiness' | 'disabled'
  config             JSONB NOT NULL DEFAULT '{}'::jsonb, -- oauth client id (NEVER secret), endpoint, scopes
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verprov_category ON verification_providers(provider_category);
CREATE INDEX IF NOT EXISTS idx_verprov_status   ON verification_providers(status);

-- ── Credential Verifications ─────────────────────────────────
-- One row per (user, credential) verification attempt or success.
-- `subject_*` references the canonical reference-intelligence row IF resolved;
-- raw_input preserved for unresolved cases (rare). `external_id` is the
-- provider-side identifier (badge URN, certificate id, membership #).
CREATE TABLE IF NOT EXISTS credential_verifications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             TEXT NOT NULL,                    -- profile owner (any auth id)
  provider_id         UUID NOT NULL REFERENCES verification_providers(id) ON DELETE RESTRICT,
  provider_code       TEXT NOT NULL,                    -- denormalised for fast scoring lookups
  subject_type        TEXT NOT NULL,                    -- 'certification' | 'qualification' | 'institution' | 'skill' | 'occupation'
  subject_id          UUID,                              -- FK into canonical table (nullable if raw)
  subject_canonical   TEXT,                              -- canonical name snapshot
  raw_input           TEXT,                              -- what the user submitted
  external_id         TEXT,                              -- provider-side identifier
  external_url        TEXT,                              -- public verification URL
  evidence            JSONB NOT NULL DEFAULT '{}'::jsonb, -- raw payload from provider
  status              TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'verified' | 'failed' | 'revoked' | 'expired'
  confidence_score    NUMERIC(4,3) NOT NULL DEFAULT 0.700 CHECK (confidence_score BETWEEN 0 AND 1),
  trust_weight        NUMERIC(4,3) NOT NULL DEFAULT 1.000 CHECK (trust_weight BETWEEN 0 AND 2),
  verified_at         TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  revoked_reason      TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
-- UNIQUE on a COALESCE expression must be a unique INDEX, not a table constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_credver_user_subject
  ON credential_verifications (user_id, provider_code, subject_type, (COALESCE(external_id, '')));
CREATE INDEX IF NOT EXISTS idx_credver_user        ON credential_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_credver_user_active ON credential_verifications(user_id) WHERE status = 'verified';
CREATE INDEX IF NOT EXISTS idx_credver_subject     ON credential_verifications(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_credver_provider    ON credential_verifications(provider_id);

-- ── Verification Events (audit trail) ────────────────────────
-- Append-only log of every action: request, callback, success, fail, revoke,
-- consent_grant, consent_revoke, admin_override. Drives compliance/audit UI.
CREATE TABLE IF NOT EXISTS verification_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             TEXT,
  verification_id     UUID REFERENCES credential_verifications(id) ON DELETE SET NULL,
  provider_code       TEXT,
  event_type          TEXT NOT NULL,                    -- 'request' | 'callback' | 'verified' | 'failed' | 'revoked' | 'expired' | 'consent_grant' | 'consent_revoke' | 'admin_override' | 'lookup'
  actor_type          TEXT NOT NULL DEFAULT 'user',     -- 'user' | 'system' | 'admin' | 'provider'
  actor_id            TEXT,
  ip_address          TEXT,
  user_agent          TEXT,
  payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome             TEXT,                              -- 'success' | 'error' | 'noop'
  error_code          TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verevent_user        ON verification_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verevent_verif       ON verification_events(verification_id);
CREATE INDEX IF NOT EXISTS idx_verevent_provider    ON verification_events(provider_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verevent_type        ON verification_events(event_type, created_at DESC);

-- ── Verification Consents ────────────────────────────────────
-- Explicit, revocable consent records. One row per (user, provider, scope)
-- grant. `revoked_at` set when revoked — historical row is preserved for audit.
CREATE TABLE IF NOT EXISTS verification_consents (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             TEXT NOT NULL,
  provider_id         UUID NOT NULL REFERENCES verification_providers(id) ON DELETE RESTRICT,
  provider_code       TEXT NOT NULL,
  scope               TEXT NOT NULL,                    -- 'read_badges' | 'read_credentials' | 'lookup_membership' | 'read_documents'
  consent_text        TEXT NOT NULL,                    -- exact text shown to user (preserved verbatim)
  consent_version     TEXT NOT NULL DEFAULT 'v1',
  ip_address          TEXT,
  user_agent          TEXT,
  granted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at          TIMESTAMPTZ,
  revoked_reason      TEXT,
  expires_at          TIMESTAMPTZ,                      -- optional expiry (e.g. 12-month re-consent)
  -- `active` is computed in queries (NOW() is not immutable so it can't be a generated column).
  -- Use: revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_verconsent_user      ON verification_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_verconsent_active    ON verification_consents(user_id, provider_code) WHERE revoked_at IS NULL;

-- ── Trust Score Components ───────────────────────────────────
-- Cached, explainable breakdown of each user's trust score. Recomputed
-- whenever verifications change. Drives the "Trust Indicator" UI without
-- requiring a recompute on every render.
CREATE TABLE IF NOT EXISTS trust_score_components (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             TEXT NOT NULL,
  capability_score    NUMERIC(5,2) NOT NULL DEFAULT 0,  -- raw EI (no trust mult), 0..99
  trust_score         NUMERIC(5,2) NOT NULL DEFAULT 0,  -- 0..100 trust composite
  trust_multiplier    NUMERIC(4,3) NOT NULL DEFAULT 1.000, -- effective applied multiplier 0.5..1.3
  verified_count      INTEGER NOT NULL DEFAULT 0,
  pending_count       INTEGER NOT NULL DEFAULT 0,
  revoked_count       INTEGER NOT NULL DEFAULT 0,
  components          JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{credential, provider, weight, contribution, basis}]
  computed_at         TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_trust_user UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_trust_user ON trust_score_components(user_id);

-- ── Seed: built-in providers ─────────────────────────────────
-- Trust weights reflect verifiability strength:
--   1.20 verified-by-issuer (Credly OAuth, Accredible, DigiLocker, NAD)
--   1.15 govt professional body lookups (ICAI/ICSI/ICMAI)
--   0.85 manual admin-evidenced override (verifiable but human-mediated)
INSERT INTO verification_providers
  (provider_code, provider_name, provider_category, integration_type, authority_country, authority_url, default_trust_weight, status, config, notes)
VALUES
  ('CREDLY',     'Credly (Acclaim)',                     'badge',              'oauth',  'GLOBAL', 'https://www.credly.com',             1.200, 'beta',      '{"oauth_endpoint":"https://api.credly.com/v1/oauth/authorize","scopes":["read"]}'::jsonb, 'OAuth — user authorises read of their badges'),
  ('ACCREDIBLE', 'Accredible',                           'credential',         'oauth',  'GLOBAL', 'https://www.accredible.com',         1.200, 'beta',      '{"oauth_endpoint":"https://accredible.com/oauth/authorize","scopes":["credentials:read"]}'::jsonb, 'OAuth + recipient API'),
  ('DIGILOCKER', 'DigiLocker (Govt of India)',           'doc_locker',         'doc',    'IN',     'https://www.digilocker.gov.in',      1.200, 'readiness', '{"issuer":"NeGD","doc_types":["10TH","12TH","DEGREE","PAN"]}'::jsonb, 'Readiness — integration awaiting empanelment'),
  ('NAD',        'National Academic Depository',         'doc_locker',         'doc',    'IN',     'https://nad.digitallocker.gov.in',   1.200, 'readiness', '{"issuer":"NAD","scope":"academic_awards"}'::jsonb, 'Readiness — integration awaiting onboarding'),
  ('ICAI',       'Institute of Chartered Accountants of India', 'professional_body', 'lookup', 'IN', 'https://www.icai.org',          1.150, 'available', '{"lookup_field":"membership_number","format":"6-7 digit"}'::jsonb, 'Membership-number lookup'),
  ('ICSI',       'Institute of Company Secretaries of India',   'professional_body', 'lookup', 'IN', 'https://www.icsi.edu',          1.150, 'available', '{"lookup_field":"membership_number","format":"ACS/FCS NNNN"}'::jsonb, 'Membership-number lookup'),
  ('ICMAI',      'Institute of Cost Accountants of India',      'professional_body', 'lookup', 'IN', 'https://icmai.in',              1.150, 'available', '{"lookup_field":"membership_number","format":"ACMA/FCMA NNNN"}'::jsonb, 'Membership-number lookup'),
  ('MANUAL',     'Manual Admin Verification',            'admin',              'manual', 'GLOBAL', NULL,                                 0.850, 'available', '{}'::jsonb, 'Admin uploads/attests evidence — lower trust weight than direct issuer')
ON CONFLICT (provider_code) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  authority_url = EXCLUDED.authority_url,
  status        = EXCLUDED.status,
  config        = EXCLUDED.config,
  notes         = EXCLUDED.notes,
  updated_at    = NOW();
