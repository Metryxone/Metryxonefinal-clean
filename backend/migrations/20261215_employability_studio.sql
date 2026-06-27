-- MX-302F — Resume, Portfolio & Interview Studio (net-new substrate).
--
-- Strictly additive + flag-gated (employabilityStudio / FF_EMPLOYABILITY_STUDIO,
-- default OFF). These tables are created ONLY on the flag-ON path: the route
-- handlers call ensureEmployabilityStudioSchema AFTER the flagGate passes. With
-- the flag OFF the DDL is never reached, so the database is byte-identical to
-- legacy (no new tables).
--
-- Honesty / isolation contracts encoded here:
--   - Every row is USER-SCOPED via user_id (varchar, mirrors users.id). Reads /
--     writes are IDOR-guarded server-side (a user only ever sees their own rows).
--   - Resume versions store the full ResumeData JSON snapshot (data jsonb) so the
--     localStorage single-draft model becomes durable, multi-version persistence.
--   - Portfolio entries are STRUCTURED (kind = 'research' | 'publication') with
--     explicit columns for venue / role / dates / links rather than free-text.
--   - Interview attempts capture REAL submitted answers + scores; AI feedback is
--     stored only when an LLM actually produced it (ai_feedback_source records
--     'ai' vs 'rule-based' so a rule-based result is never mislabelled as AI).

-- ── Resume versions (durable multi-draft persistence) ───────────────────────
CREATE TABLE IF NOT EXISTS career_resume_versions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  label         TEXT NOT NULL DEFAULT 'Untitled',
  data          JSONB NOT NULL,              -- full ResumeData snapshot
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  source        TEXT DEFAULT 'manual',       -- manual / imported-local
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_resume_versions_user ON career_resume_versions(user_id);

-- ── Portfolio entries (structured research & publications) ──────────────────
CREATE TABLE IF NOT EXISTS career_portfolio_entries (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  kind          TEXT NOT NULL,               -- 'research' | 'publication'
  title         TEXT NOT NULL,
  authors       TEXT,                         -- comma-separated; NULL = unknown
  venue         TEXT,                         -- journal / conference / lab
  role          TEXT,                         -- e.g. First Author / Research Assistant
  abstract      TEXT,
  link          TEXT,                         -- DOI / arXiv / project URL
  doi           TEXT,
  status        TEXT DEFAULT 'published',     -- published / under-review / in-progress
  published_on  DATE,                         -- NULL = unknown (never fabricated)
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_entries_user ON career_portfolio_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_entries_kind ON career_portfolio_entries(user_id, kind);

-- ── Interview attempts (coding assessment / group discussion / Q&A practice) ─
CREATE TABLE IF NOT EXISTS employability_interview_attempts (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  mode               TEXT NOT NULL,           -- 'coding' | 'group-discussion' | 'qa'
  reference_id       TEXT,                    -- curated question/topic id
  question           TEXT,                    -- prompt text (denormalised for history)
  answer             TEXT,                    -- the user's submitted free-text / selection
  score              REAL,                    -- NULL when not auto-scorable (null ≠ 0)
  max_score          REAL,
  self_review        JSONB,                   -- structured self-assessment payload
  ai_feedback        TEXT,                    -- feedback text (AI or rule-based)
  ai_feedback_source TEXT,                    -- 'ai' | 'rule-based' (never mislabel)
  created_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_user ON employability_interview_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_attempts_mode ON employability_interview_attempts(user_id, mode);
