-- MX-RUNTIME-01 WS4: Candidate Master (additive, read-only backfill).
-- Unifies identity across 5 systems by the universal join key = normalized email.
-- CAPADEX keys on guest_email; Career/Competency key on user_id -> users.email;
-- Employer keys on employer_candidates.email. EI (employability) is derived from
-- competency presence (no standalone realized-outcome store in dev).
-- Idempotent: tables created-if-absent, then TRUNCATE + reinsert from live rows.
-- NEVER fabricates: every row traces to a real source record.

CREATE TABLE IF NOT EXISTS candidate_master (
  candidate_key   TEXT PRIMARY KEY,          -- lower(trim(email))
  user_id         TEXT,                       -- present only if registered (users.id is varchar)
  full_name       TEXT,
  is_demo         BOOLEAN DEFAULT false,
  first_seen      TIMESTAMPTZ,
  last_activity   TIMESTAMPTZ,
  systems_present INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidate_source_registry (
  candidate_key TEXT NOT NULL,
  source_system TEXT NOT NULL,               -- career_builder|capadex|competency|employer|ei
  present       BOOLEAN DEFAULT false,
  record_count  INTEGER DEFAULT 0,
  last_seen     TIMESTAMPTZ,
  PRIMARY KEY (candidate_key, source_system)
);

CREATE TABLE IF NOT EXISTS candidate_activation_history (
  id            BIGSERIAL PRIMARY KEY,
  candidate_key TEXT NOT NULL,
  source_system TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  occurred_at   TIMESTAMPTZ,
  detail        JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS candidate_profile_completion (
  candidate_key   TEXT PRIMARY KEY,
  has_career      BOOLEAN DEFAULT false,
  has_capadex     BOOLEAN DEFAULT false,
  has_competency  BOOLEAN DEFAULT false,
  has_employer    BOOLEAN DEFAULT false,
  has_ei          BOOLEAN DEFAULT false,
  systems_present INTEGER DEFAULT 0,
  systems_total   INTEGER DEFAULT 5,
  completion_pct  NUMERIC(5,1) DEFAULT 0
);

TRUNCATE candidate_master, candidate_source_registry, candidate_activation_history, candidate_profile_completion;

-- ── universe of candidate emails from all 5 systems ─────────────────────────
WITH emails AS (
  SELECT lower(trim(u.email)) AS k, u.id::text AS user_id, u.full_name, u.created_at AS seen
    FROM users u WHERE u.email IS NOT NULL AND u.email <> ''
  UNION ALL
  SELECT lower(trim(cs.guest_email)) AS k, NULL::text, NULL, cs.created_at
    FROM capadex_sessions cs WHERE cs.guest_email IS NOT NULL AND cs.guest_email <> ''
  UNION ALL
  SELECT lower(trim(ec.email)) AS k, NULL::text, ec.name, ec.created_at
    FROM employer_candidates ec WHERE ec.email IS NOT NULL AND ec.email <> ''
)
INSERT INTO candidate_master (candidate_key, user_id, full_name, is_demo, first_seen, last_activity)
SELECT k,
       max(user_id),
       max(full_name),
       bool_or(k LIKE '%@example.com'),
       min(seen),
       max(seen)
  FROM emails
 WHERE k <> ''
 GROUP BY k;

-- ── source registry: career_builder ────────────────────────────────────────
INSERT INTO candidate_source_registry (candidate_key, source_system, present, record_count, last_seen)
SELECT lower(trim(u.email)), 'career_builder', true, count(*)::int, max(p.updated_at)
  FROM career_seeker_profiles p
  JOIN users u ON u.id = p.user_id
 WHERE u.email IS NOT NULL AND u.email <> ''
 GROUP BY 1
ON CONFLICT (candidate_key, source_system) DO UPDATE
  SET present = true, record_count = EXCLUDED.record_count, last_seen = EXCLUDED.last_seen;

-- ── source registry: capadex ───────────────────────────────────────────────
INSERT INTO candidate_source_registry (candidate_key, source_system, present, record_count, last_seen)
SELECT lower(trim(cs.guest_email)), 'capadex', true, count(*)::int, max(cs.updated_at)
  FROM capadex_sessions cs
 WHERE cs.guest_email IS NOT NULL AND cs.guest_email <> '' AND cs.status = 'completed'
 GROUP BY 1
ON CONFLICT (candidate_key, source_system) DO UPDATE
  SET present = true, record_count = EXCLUDED.record_count, last_seen = EXCLUDED.last_seen;

-- ── source registry: competency ────────────────────────────────────────────
INSERT INTO candidate_source_registry (candidate_key, source_system, present, record_count, last_seen)
SELECT lower(trim(u.email)), 'competency', true, count(*)::int, max(s.created_at)
  FROM cra_scores s
  JOIN users u ON u.id::text = s.user_id::text
 WHERE u.email IS NOT NULL AND u.email <> ''
 GROUP BY 1
ON CONFLICT (candidate_key, source_system) DO UPDATE
  SET present = true, record_count = EXCLUDED.record_count, last_seen = EXCLUDED.last_seen;

-- ── source registry: employer ──────────────────────────────────────────────
INSERT INTO candidate_source_registry (candidate_key, source_system, present, record_count, last_seen)
SELECT lower(trim(ec.email)), 'employer', true, count(*)::int, max(ec.created_at)
  FROM employer_candidates ec
 WHERE ec.email IS NOT NULL AND ec.email <> ''
 GROUP BY 1
ON CONFLICT (candidate_key, source_system) DO UPDATE
  SET present = true, record_count = EXCLUDED.record_count, last_seen = EXCLUDED.last_seen;

-- ── source registry: EI (derived from competency profile presence) ─────────
INSERT INTO candidate_source_registry (candidate_key, source_system, present, record_count, last_seen)
SELECT lower(trim(u.email)), 'ei', true, count(*)::int, max(cp.updated_at)
  FROM cra_profiles cp
  JOIN users u ON u.id::text = cp.user_id::text
 WHERE u.email IS NOT NULL AND u.email <> ''
 GROUP BY 1
ON CONFLICT (candidate_key, source_system) DO UPDATE
  SET present = true, record_count = EXCLUDED.record_count, last_seen = EXCLUDED.last_seen;

-- ── activation history: one event per (candidate, system) presence ─────────
INSERT INTO candidate_activation_history (candidate_key, source_system, event_type, occurred_at, detail)
SELECT candidate_key, source_system, 'system_activated', last_seen,
       jsonb_build_object('record_count', record_count)
  FROM candidate_source_registry WHERE present = true;

-- ── profile completion rollup ──────────────────────────────────────────────
INSERT INTO candidate_profile_completion
  (candidate_key, has_career, has_capadex, has_competency, has_employer, has_ei, systems_present, systems_total, completion_pct)
SELECT m.candidate_key,
       coalesce(bool_or(r.source_system = 'career_builder'), false),
       coalesce(bool_or(r.source_system = 'capadex'), false),
       coalesce(bool_or(r.source_system = 'competency'), false),
       coalesce(bool_or(r.source_system = 'employer'), false),
       coalesce(bool_or(r.source_system = 'ei'), false),
       count(r.source_system)::int,
       5,
       round(count(r.source_system)::numeric * 100 / 5, 1)
  FROM candidate_master m
  LEFT JOIN candidate_source_registry r ON r.candidate_key = m.candidate_key AND r.present = true
 GROUP BY m.candidate_key;

-- keep master.systems_present in sync
UPDATE candidate_master m
   SET systems_present = c.systems_present
  FROM candidate_profile_completion c
 WHERE c.candidate_key = m.candidate_key;
