-- CAPADEX PIL — Phase 4: Search Intent Intelligence Layer (canonical schema).
-- Mirrors the lazy ensureSchema() in backend/scripts/pil/run-search-intent.ts.
-- Strictly ADDITIVE: reads existing PIL tables, writes ONLY these four NEW tables.

-- 1) Generated search intents (archetype × stakeholder × intent type), each
--    linked to a real human_problem_library row (problem_id) — no orphans.
CREATE TABLE IF NOT EXISTS search_intents (
  intent_id        SERIAL PRIMARY KEY,
  archetype_key    TEXT NOT NULL,
  archetype_name   TEXT NOT NULL DEFAULT '',
  problem_id       INTEGER NOT NULL,
  stakeholder_type TEXT NOT NULL CHECK (stakeholder_type IN ('student','parent','teacher','counselor','professional')),
  intent_type      TEXT NOT NULL CHECK (intent_type IN ('informational','diagnostic','emotional','help_seeking','future_planning')),
  search_phrase    TEXT NOT NULL,
  realism_pass     BOOLEAN NOT NULL DEFAULT true,
  aligned          BOOLEAN NOT NULL DEFAULT true,
  intent_clear     BOOLEAN NOT NULL DEFAULT true,
  is_duplicate     BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (archetype_key, stakeholder_type, intent_type, search_phrase)
);
CREATE INDEX IF NOT EXISTS idx_search_intents_archetype   ON search_intents(archetype_key);
CREATE INDEX IF NOT EXISTS idx_search_intents_stakeholder ON search_intents(stakeholder_type);
CREATE INDEX IF NOT EXISTS idx_search_intents_intent      ON search_intents(intent_type);
CREATE INDEX IF NOT EXISTS idx_search_intents_problem     ON search_intents(problem_id);

-- 2) Four quality scores (1..5) + composite, one row per intent.
CREATE TABLE IF NOT EXISTS search_intent_quality_scores (
  score_id            SERIAL PRIMARY KEY,
  intent_id           INTEGER NOT NULL REFERENCES search_intents(intent_id) ON DELETE CASCADE,
  archetype_key       TEXT NOT NULL,
  stakeholder_type    TEXT NOT NULL,
  intent_type         TEXT NOT NULL,
  search_realism      SMALLINT NOT NULL CHECK (search_realism BETWEEN 1 AND 5),
  human_language      SMALLINT NOT NULL CHECK (human_language BETWEEN 1 AND 5),
  archetype_alignment SMALLINT NOT NULL CHECK (archetype_alignment BETWEEN 1 AND 5),
  intent_clarity      SMALLINT NOT NULL CHECK (intent_clarity BETWEEN 1 AND 5),
  composite           NUMERIC(4,2) NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (intent_id)
);
CREATE INDEX IF NOT EXISTS idx_siqs_archetype ON search_intent_quality_scores(archetype_key);

-- 3) Duplicate review (exact / semantic-same-audience / cross-stakeholder).
--    `redundant` rows are the ones counted in the headline duplicate rate.
CREATE TABLE IF NOT EXISTS search_intent_duplicate_review (
  dup_id          SERIAL PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('identical','semantic','stakeholder')),
  redundant       BOOLEAN NOT NULL DEFAULT false,
  phrase_a        TEXT NOT NULL,
  phrase_b        TEXT NOT NULL,
  overlap         NUMERIC(5,3) NOT NULL DEFAULT 0,
  archetype_a     TEXT NOT NULL DEFAULT '',
  archetype_b     TEXT NOT NULL DEFAULT '',
  stakeholder_a   TEXT NOT NULL DEFAULT '',
  stakeholder_b   TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Search clusters (archetype × intent type demand groupings) for analytics.
CREATE TABLE IF NOT EXISTS search_intent_clusters (
  cluster_id     SERIAL PRIMARY KEY,
  cluster_key    TEXT NOT NULL,
  cluster_label  TEXT NOT NULL,
  archetype_key  TEXT NOT NULL,
  archetype_name TEXT NOT NULL DEFAULT '',
  intent_type    TEXT NOT NULL,
  member_count   INTEGER NOT NULL DEFAULT 0,
  avg_composite  NUMERIC(4,2) NOT NULL DEFAULT 0,
  sample_phrase  TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cluster_key)
);
CREATE INDEX IF NOT EXISTS idx_sic_archetype ON search_intent_clusters(archetype_key);
