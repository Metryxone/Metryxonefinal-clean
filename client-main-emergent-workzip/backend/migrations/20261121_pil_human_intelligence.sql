-- CAPADEX PIL — Phase 3: Human Intelligence Layer (canonical schema).
-- Mirrors the lazy ensureSchema() bootstrap in run-human-intelligence.ts so the
-- three Phase-3 tables exist identically whether created by the runner or by a
-- migration runner. Strictly additive — reads no existing data, depends on no
-- existing table. Drops nothing.

-- Plain-language problem statements per archetype (student / professional / general voice).
CREATE TABLE IF NOT EXISTS human_problem_library (
  problem_id        SERIAL PRIMARY KEY,
  archetype_key     TEXT NOT NULL,
  archetype_name    TEXT NOT NULL DEFAULT '',
  voice             TEXT NOT NULL DEFAULT 'general' CHECK (voice IN ('student','professional','general')),
  problem_statement TEXT NOT NULL,
  realism_pass      BOOLEAN NOT NULL DEFAULT true,
  aligned           BOOLEAN NOT NULL DEFAULT true,
  is_duplicate      BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (archetype_key, problem_statement)
);
CREATE INDEX IF NOT EXISTS idx_human_problem_archetype ON human_problem_library(archetype_key);

-- Emotion sets per archetype: frustration / fear / motivation / growth_signal / success_indicator.
CREATE TABLE IF NOT EXISTS human_emotion_library (
  emotion_id     SERIAL PRIMARY KEY,
  archetype_key  TEXT NOT NULL,
  archetype_name TEXT NOT NULL DEFAULT '',
  emotion_type   TEXT NOT NULL CHECK (emotion_type IN ('frustration','fear','motivation','growth_signal','success_indicator')),
  statement      TEXT NOT NULL,
  realism_pass   BOOLEAN NOT NULL DEFAULT true,
  aligned        BOOLEAN NOT NULL DEFAULT true,
  is_duplicate   BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (archetype_key, emotion_type, statement)
);
CREATE INDEX IF NOT EXISTS idx_human_emotion_archetype ON human_emotion_library(archetype_key);

-- The SAME archetype expressed through five stakeholder lenses.
CREATE TABLE IF NOT EXISTS stakeholder_narratives (
  narrative_id   SERIAL PRIMARY KEY,
  archetype_key  TEXT NOT NULL,
  archetype_name TEXT NOT NULL DEFAULT '',
  stakeholder    TEXT NOT NULL CHECK (stakeholder IN ('student','parent','teacher','counselor','professional')),
  narrative      TEXT NOT NULL,
  realism_pass   BOOLEAN NOT NULL DEFAULT true,
  aligned        BOOLEAN NOT NULL DEFAULT true,
  is_duplicate   BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (archetype_key, stakeholder, narrative)
);
CREATE INDEX IF NOT EXISTS idx_stakeholder_narr_archetype ON stakeholder_narratives(archetype_key);
