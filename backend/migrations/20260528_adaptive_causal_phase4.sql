-- ════════════════════════════════════════════════════════════════════════════
-- Phase 4 — Adaptive Causal Intelligence
--
-- Self-improving recommendation engine: tracks recommendation → action →
-- behavioural change → competency delta → EI delta → trajectory shift.
--
-- Namespace: learn_*  (kept distinct from longitudinal p4_*)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Intervention catalog ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learn_interventions (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL CHECK (kind IN ('course','mentor','practice','assessment','reflection','project','feedback_loop')),
  title           TEXT NOT NULL,
  description     TEXT,
  target_competency_id TEXT REFERENCES onto_competencies(id) ON DELETE SET NULL,
  effort_hours    NUMERIC(6,2),
  prerequisites   JSONB DEFAULT '[]'::jsonb,
  default_priority TEXT CHECK (default_priority IN ('high','medium','low')) DEFAULT 'medium',
  metadata        JSONB DEFAULT '{}'::jsonb,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_learn_int_comp ON learn_interventions(target_competency_id);
CREATE INDEX IF NOT EXISTS ix_learn_int_kind ON learn_interventions(kind);

-- ── 2. Intervention events (append-only) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS learn_intervention_events (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  intervention_id TEXT NOT NULL REFERENCES learn_interventions(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN ('recommended','viewed','started','completed','dismissed','abandoned')),
  recommendation_id TEXT,         -- correlates back to a learn_recommendations row
  profile_segment TEXT,           -- denormalised at event time (layer/seniority/etc)
  context         JSONB DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_learn_evt_user ON learn_intervention_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_learn_evt_int  ON learn_intervention_events(intervention_id, event_type);
CREATE INDEX IF NOT EXISTS ix_learn_evt_rec  ON learn_intervention_events(recommendation_id);

-- ── 3. Outcomes — observed deltas tied to an intervention ──────────────────
CREATE TABLE IF NOT EXISTS learn_outcomes (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT NOT NULL,
  intervention_id TEXT NOT NULL REFERENCES learn_interventions(id) ON DELETE CASCADE,
  competency_id   TEXT REFERENCES onto_competencies(id) ON DELETE SET NULL,
  -- Deltas captured between baseline (recommended_at) and follow-up (measured_at)
  competency_delta NUMERIC(6,3),       -- points on 0..100
  ei_delta         NUMERIC(6,3),
  trajectory_shift TEXT CHECK (trajectory_shift IN ('accelerating','stabilizing','flat','declining','recovering')),
  effort_hours_observed NUMERIC(6,2),
  baseline_score   NUMERIC(6,3),
  followup_score   NUMERIC(6,3),
  baseline_at      TIMESTAMPTZ,
  measured_at      TIMESTAMPTZ DEFAULT NOW(),
  evidence_source  TEXT CHECK (evidence_source IN ('history_diff','self_report','manager_feedback','assessment','synthetic_seed')),
  profile_segment  TEXT,
  context          JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ix_learn_out_user ON learn_outcomes(user_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS ix_learn_out_int  ON learn_outcomes(intervention_id);
CREATE INDEX IF NOT EXISTS ix_learn_out_seg  ON learn_outcomes(profile_segment);

-- ── 4. Effectiveness rollup (refreshable view-as-table) ────────────────────
CREATE TABLE IF NOT EXISTS learn_effectiveness (
  intervention_id  TEXT NOT NULL REFERENCES learn_interventions(id) ON DELETE CASCADE,
  competency_id    TEXT,
  profile_segment  TEXT NOT NULL DEFAULT 'global',
  n_observations   INT NOT NULL DEFAULT 0,
  mean_competency_delta NUMERIC(6,3),
  mean_ei_delta         NUMERIC(6,3),
  mean_effort_hours     NUMERIC(6,2),
  roi_score             NUMERIC(10,4),    -- mean_competency_delta / max(effort_hours, 0.5)
  completion_rate       NUMERIC(5,4),
  confidence_tier       TEXT CHECK (confidence_tier IN ('A','B','C','D','provisional')) DEFAULT 'provisional',
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
-- Expression-based unique index lets us use ON CONFLICT with NULL competency_id
CREATE UNIQUE INDEX IF NOT EXISTS ux_learn_eff_key
  ON learn_effectiveness (intervention_id, COALESCE(competency_id,'_any'), profile_segment);

-- ── 5. Competency transfer graph (directed edges) ──────────────────────────
CREATE TABLE IF NOT EXISTS learn_transfer_edges (
  id              BIGSERIAL PRIMARY KEY,
  source_competency_id TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  target_competency_id TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  transfer_strength   NUMERIC(4,3) NOT NULL CHECK (transfer_strength BETWEEN 0 AND 1),
  transfer_type       TEXT CHECK (transfer_type IN ('foundational','adjacent','reinforces','enables','unlocks')),
  evidence_basis      TEXT,               -- 'seeded' | 'derived_from_relationships' | 'observed_from_outcomes'
  n_supporting_observations INT DEFAULT 0,
  last_updated        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (source_competency_id, target_competency_id, transfer_type)
);
CREATE INDEX IF NOT EXISTS ix_learn_xfer_src ON learn_transfer_edges(source_competency_id);
CREATE INDEX IF NOT EXISTS ix_learn_xfer_tgt ON learn_transfer_edges(target_competency_id);

-- ── 6. Sequential dependencies (prereq DAG) ────────────────────────────────
CREATE TABLE IF NOT EXISTS learn_dependencies (
  id              BIGSERIAL PRIMARY KEY,
  prereq_competency_id  TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  unlocks_competency_id TEXT NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
  dependency_strength   NUMERIC(4,3) DEFAULT 0.7 CHECK (dependency_strength BETWEEN 0 AND 1),
  min_prereq_level      INT DEFAULT 2 CHECK (min_prereq_level BETWEEN 1 AND 5),
  rationale             TEXT,
  evidence_basis        TEXT,
  UNIQUE (prereq_competency_id, unlocks_competency_id)
);
CREATE INDEX IF NOT EXISTS ix_learn_dep_prereq  ON learn_dependencies(prereq_competency_id);
CREATE INDEX IF NOT EXISTS ix_learn_dep_unlocks ON learn_dependencies(unlocks_competency_id);

-- ── 7. Recommendation snapshots (causal-ranked, per request) ───────────────
CREATE TABLE IF NOT EXISTS learn_recommendations (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  target_role_id     TEXT,
  intervention_id    TEXT NOT NULL REFERENCES learn_interventions(id) ON DELETE CASCADE,
  competency_id      TEXT REFERENCES onto_competencies(id) ON DELETE SET NULL,
  rank               INT NOT NULL,
  causal_score       NUMERIC(10,4),
  expected_ei_lift   NUMERIC(6,3),
  expected_ei_lift_lower NUMERIC(6,3),
  expected_ei_lift_upper NUMERIC(6,3),
  effort_hours       NUMERIC(6,2),
  roi_score          NUMERIC(8,4),
  confidence_tier    TEXT,
  sequence_position  INT,                        -- ordering from dependency-sequencer
  rationale          JSONB DEFAULT '{}'::jsonb,
  transfer_cascade   JSONB DEFAULT '[]'::jsonb,  -- downstream competencies that benefit
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_learn_rec_user ON learn_recommendations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_learn_rec_role ON learn_recommendations(target_role_id);
CREATE INDEX IF NOT EXISTS ix_learn_rec_int  ON learn_recommendations(intervention_id);

-- ── 8. Audit log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learn_audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  user_id         TEXT,
  endpoint        TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('ok','fallback','error')),
  request_id      TEXT,
  detail          JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_learn_audit_user ON learn_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_learn_audit_ep   ON learn_audit_logs(endpoint, created_at DESC);

-- ════════════════════════════════════════════════════════════════════════════
-- SEEDS — interventions + transfer edges (derived) + dependencies (derived)
-- + 90 days of synthetic outcomes for 3 demo users
-- ════════════════════════════════════════════════════════════════════════════

-- Interventions: 2 per available competency (course + practice), capped at 30
INSERT INTO learn_interventions
  (id, kind, title, description, target_competency_id, effort_hours, default_priority)
SELECT
  'int_course_' || c.id,
  'course',
  'Structured course: ' || c.canonical_name,
  'Curated learning sequence targeting ' || c.canonical_name,
  c.id, 12.0, 'medium'
FROM onto_competencies c
ORDER BY c.id
LIMIT 30
ON CONFLICT (id) DO NOTHING;

INSERT INTO learn_interventions
  (id, kind, title, description, target_competency_id, effort_hours, default_priority)
SELECT
  'int_practice_' || c.id,
  'practice',
  'Applied practice: ' || c.canonical_name,
  'Real-world practice loop with feedback on ' || c.canonical_name,
  c.id, 6.0, 'high'
FROM onto_competencies c
ORDER BY c.id
LIMIT 30
ON CONFLICT (id) DO NOTHING;

-- Mentor intervention (one global)
INSERT INTO learn_interventions (id, kind, title, description, effort_hours, default_priority)
VALUES ('int_mentor_general','mentor','Career mentor sessions',
        'Bi-weekly mentor pairing for development guidance', 8.0, 'medium')
ON CONFLICT (id) DO NOTHING;

-- Transfer edges derived from existing onto_competency_relationships (reinforces/depends_on)
INSERT INTO learn_transfer_edges
  (source_competency_id, target_competency_id, transfer_strength, transfer_type, evidence_basis)
SELECT r.source_id, r.target_id,
  CASE r.relationship_type
    WHEN 'reinforces' THEN 0.75
    WHEN 'depends_on' THEN 0.85
    WHEN 'prerequisite_of' THEN 0.80
    ELSE 0.50
  END,
  CASE r.relationship_type
    WHEN 'reinforces' THEN 'reinforces'
    WHEN 'depends_on' THEN 'foundational'
    WHEN 'prerequisite_of' THEN 'enables'
    ELSE 'adjacent'
  END,
  'derived_from_relationships'
FROM onto_relationships r
WHERE r.relationship_type IN ('reinforces','depends_on','prerequisite_of','related_to')
ON CONFLICT (source_competency_id, target_competency_id, transfer_type) DO NOTHING;

-- Dependencies derived from prerequisite_of / depends_on
INSERT INTO learn_dependencies
  (prereq_competency_id, unlocks_competency_id, dependency_strength, min_prereq_level, rationale, evidence_basis)
SELECT
  CASE r.relationship_type WHEN 'prerequisite_of' THEN r.source_id ELSE r.target_id END,
  CASE r.relationship_type WHEN 'prerequisite_of' THEN r.target_id ELSE r.source_id END,
  0.8, 2,
  'Derived from ontology relationship: ' || r.relationship_type,
  'derived_from_relationships'
FROM onto_relationships r
WHERE r.relationship_type IN ('prerequisite_of','depends_on')
ON CONFLICT (prereq_competency_id, unlocks_competency_id) DO NOTHING;

-- Synthetic outcomes: 3 demo users × ~6 completed interventions each
DO $$
DECLARE
  u TEXT;
  rec RECORD;
  i INT;
  delta NUMERIC;
  ei NUMERIC;
  hours NUMERIC;
BEGIN
  FOR u IN SELECT unnest(ARRAY['demo_user_alpha','demo_user_beta','demo_user_gamma']) LOOP
    i := 0;
    FOR rec IN
      SELECT id, target_competency_id, effort_hours
        FROM learn_interventions
       WHERE target_competency_id IS NOT NULL
       ORDER BY id LIMIT 6
    LOOP
      i := i + 1;
      -- deterministic seeded pseudo-random
      delta := 2.0 + ((abs(hashtext(u || rec.id)) % 800) / 100.0);   -- 2.0..10.0 pts
      ei    := delta * 0.6;
      hours := rec.effort_hours + ((abs(hashtext(u || rec.id || 'h')) % 400) / 100.0);

      INSERT INTO learn_intervention_events
        (user_id, intervention_id, event_type, profile_segment, occurred_at)
      VALUES (u, rec.id, 'recommended', 'global', NOW() - (i * 14 || ' days')::interval);
      INSERT INTO learn_intervention_events
        (user_id, intervention_id, event_type, profile_segment, occurred_at)
      VALUES (u, rec.id, 'completed',   'global', NOW() - (i * 14 - 10 || ' days')::interval);

      INSERT INTO learn_outcomes
        (user_id, intervention_id, competency_id, competency_delta, ei_delta,
         trajectory_shift, effort_hours_observed, baseline_score, followup_score,
         baseline_at, measured_at, evidence_source, profile_segment)
      VALUES (u, rec.id, rec.target_competency_id, delta, ei,
              CASE WHEN delta > 6 THEN 'accelerating' WHEN delta > 3 THEN 'stabilizing' ELSE 'flat' END,
              hours, 55.0, 55.0 + delta,
              NOW() - (i * 14 || ' days')::interval,
              NOW() - (i * 14 - 10 || ' days')::interval,
              'synthetic_seed', 'global');
    END LOOP;
  END LOOP;
END$$;

-- Initial effectiveness rollup from seeded outcomes
INSERT INTO learn_effectiveness
  (intervention_id, competency_id, profile_segment, n_observations,
   mean_competency_delta, mean_ei_delta, mean_effort_hours, roi_score,
   completion_rate, confidence_tier)
SELECT
  o.intervention_id,
  o.competency_id,
  COALESCE(o.profile_segment,'global'),
  COUNT(*),
  AVG(o.competency_delta),
  AVG(o.ei_delta),
  AVG(o.effort_hours_observed),
  AVG(o.competency_delta) / GREATEST(AVG(o.effort_hours_observed), 0.5),
  1.0,
  CASE
    WHEN COUNT(*) >= 100 THEN 'A'
    WHEN COUNT(*) >= 30  THEN 'B'
    WHEN COUNT(*) >= 10  THEN 'C'
    WHEN COUNT(*) >= 3   THEN 'D'
    ELSE 'provisional'
  END
FROM learn_outcomes o
GROUP BY o.intervention_id, o.competency_id, COALESCE(o.profile_segment,'global')
ON CONFLICT (intervention_id, COALESCE(competency_id,'_any'), profile_segment) DO NOTHING;
