/**
 * CAPADEX WC-3 Phase A — lazy ensure-schema (additive, reversible).
 *
 * Canonical mirror of `backend/migrations/20261205_wc3_phase_a.sql` (this repo has
 * no migration runner — see Global conventions in replit.md). Every table is
 * `wc3_*` namespaced, additive, and trivially reversible (`DROP TABLE wc3_*`).
 * No existing table is mutated; no ontology / signal / concern data is touched.
 *
 * Each ensure-fn caches a readiness flag so the DDL runs at most once per process.
 * All DDL is idempotent (`CREATE TABLE IF NOT EXISTS` / `ON CONFLICT DO NOTHING`).
 */
import type { Pool } from 'pg';
import {
  STORED_STAGE_ORDER,
  STORED_STAGE_WEIGHT,
  LIFECYCLE_STAGE_CODES,
  toCanonicalStoredStage,
} from '../../lib/lifecycle';

/**
 * WC-3-specific stage descriptions, keyed by the canonical stored label
 * (lib/lifecycle.ts STORED_STAGE_ORDER). Local copy — descriptions are WC-3 reference
 * copy, NOT part of the lifecycle canon (keys/order/weights ARE single-sourced from canon).
 */
const STAGE_DESCRIPTIONS: Record<string, string> = {
  Awareness: 'Becoming aware of the concern area',
  Curiosity: 'Actively exploring the concern',
  Clarity: 'Gaining clarity / insight',
  Growth: 'Developing and growing',
  Mastery: 'Demonstrating mastery',
};

let stageReady = false;
let personalizationReady = false;
let longitudinalReady = false;
let outcomeReady = false;
let journeyReady = false;
let questionIntelReady = false;
let questionContextReady = false;

/** L1 — Stage Intelligence: reference tables (seeded) + state + append-only log. */
export async function ensureWc3StageSchema(pool: Pool): Promise<void> {
  if (stageReady) return;
  await pool.query(`
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
    CREATE INDEX IF NOT EXISTS idx_wc3_stage_state_email ON wc3_stage_state(user_email);
    CREATE INDEX IF NOT EXISTS idx_wc3_stage_prog_email  ON wc3_stage_progression(user_email);
    CREATE INDEX IF NOT EXISTS idx_wc3_stage_prog_session ON wc3_stage_progression(session_id);
    CREATE INDEX IF NOT EXISTS idx_wc3_stage_prog_created ON wc3_stage_progression(created_at DESC);
  `);
  // Seed authored reference data (idempotent). Stage keys / order_index / weights are
  // single-sourced from the lifecycle canon (lib/lifecycle.ts: STORED_STAGE_ORDER +
  // STORED_STAGE_WEIGHT — the 5-element STORED PROJECTION Awareness→Curiosity→Clarity→
  // Growth→Mastery, where 'Clarity' is CAP_INS's display alias; never a competing canon).
  // Only the WC-3-specific descriptions are local copy. The CAP_* → stored-label entity map
  // is derived via toCanonicalStoredStage so it can never drift from the canon. Parameterized
  // values are byte-identical to the prior inline literal seed.
  const stageDefs = STORED_STAGE_ORDER.map((label, i) => ({
    key: label,
    order: i,
    weight: STORED_STAGE_WEIGHT[label],
    description: STAGE_DESCRIPTIONS[label] ?? null,
  }));
  await pool.query(
    `INSERT INTO wc3_stage_definitions (stage_key, order_index, weight, description) VALUES
       ${stageDefs.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(',\n       ')}
     ON CONFLICT (stage_key) DO NOTHING;`,
    stageDefs.flatMap((d) => [d.key, d.order, d.weight, d.description]),
  );
  const entityRows = LIFECYCLE_STAGE_CODES
    .map((code) => ({ code: code as string, canonical: toCanonicalStoredStage(code) }))
    .filter((r): r is { code: string; canonical: string } => r.canonical !== null);
  await pool.query(
    `INSERT INTO wc3_stage_entity_map (source_stage_code, canonical_stage) VALUES
       ${entityRows.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(',\n       ')}
     ON CONFLICT (source_stage_code) DO NOTHING;`,
    entityRows.flatMap((r) => [r.code, r.canonical]),
  );
  stageReady = true;
}

/** L4 — Personalization Wiring: latest profile (upsert) + append-only decisions. */
export async function ensureWc3PersonalizationSchema(pool: Pool): Promise<void> {
  if (personalizationReady) return;
  await pool.query(`
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
  `);
  personalizationReady = true;
}

/**
 * L6 — Longitudinal Foundation: append-only snapshots (history capture).
 * `wc3_longitudinal_trends` is created for forward-compatibility but is NEVER
 * written in Phase A (storage only — no progression analytics yet).
 */
export async function ensureWc3LongitudinalSchema(pool: Pool): Promise<void> {
  if (longitudinalReady) return;
  await pool.query(`
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
    -- Created but intentionally UNPOPULATED in Phase A (no analytics yet).
    CREATE TABLE IF NOT EXISTS wc3_longitudinal_trends (
      id                bigserial PRIMARY KEY,
      user_email        text,
      metric            text,
      direction         text,
      delta             numeric,
      window_label      text,
      computed_at       timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wc3_longitudinal_snap_email   ON wc3_longitudinal_snapshots(user_email);
    CREATE INDEX IF NOT EXISTS idx_wc3_longitudinal_snap_user    ON wc3_longitudinal_snapshots(user_id);
    CREATE INDEX IF NOT EXISTS idx_wc3_longitudinal_snap_session ON wc3_longitudinal_snapshots(session_id);
    CREATE INDEX IF NOT EXISTS idx_wc3_longitudinal_snap_captured ON wc3_longitudinal_snapshots(captured_at ASC);
  `);
  longitudinalReady = true;
}

/**
 * L2 — Outcome Intelligence (Phase B): outcome-model catalog (seeded framework
 * constants) + per-session/model outcome state + LIBRARY-BACKED actions.
 *
 * `wc3_outcome_actions.intervention_id` is a hard FK into `intervention_library`
 * — actions can ONLY ever be governed library entries, never generic text. The
 * model catalog's `construct_keys` are grounded in the REAL `intervention_library`
 * construct vocabulary (no invented constructs). Current/desired/gap are composed
 * from L1 Stage Intelligence; no scores are recomputed.
 */
export async function ensureWc3OutcomeSchema(pool: Pool): Promise<void> {
  if (outcomeReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wc3_outcome_models (
      model_key        text PRIMARY KEY,
      display_label    text NOT NULL,
      anchor           text NOT NULL DEFAULT 'l1_stage',
      construct_keys   text[] NOT NULL DEFAULT '{}',
      gated            boolean NOT NULL DEFAULT false,
      description      text,
      composition_spec jsonb NOT NULL DEFAULT '{}',
      created_at       timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS wc3_outcome_state (
      id                 bigserial PRIMARY KEY,
      session_id         uuid NOT NULL,
      user_email         text,
      user_id            uuid,
      model_key          text NOT NULL REFERENCES wc3_outcome_models(model_key),
      current_stage      text,
      current_order      integer NOT NULL DEFAULT 0,
      desired_stage      text,
      desired_order      integer NOT NULL DEFAULT 0,
      gap                integer NOT NULL DEFAULT 0,
      gap_normalized     numeric NOT NULL DEFAULT 0,
      confidence         numeric NOT NULL DEFAULT 0,
      action_count       integer NOT NULL DEFAULT 0,
      explainable        boolean NOT NULL DEFAULT false,
      matched_constructs text[] NOT NULL DEFAULT '{}',
      status             text NOT NULL DEFAULT 'resolved',
      resolved_at        timestamptz NOT NULL DEFAULT now(),
      updated_at         timestamptz NOT NULL DEFAULT now(),
      UNIQUE (session_id, model_key)
    );
    CREATE TABLE IF NOT EXISTS wc3_outcome_actions (
      id               bigserial PRIMARY KEY,
      outcome_state_id bigint NOT NULL REFERENCES wc3_outcome_state(id) ON DELETE CASCADE,
      session_id       uuid NOT NULL,
      model_key        text NOT NULL,
      intervention_id  uuid NOT NULL REFERENCES intervention_library(id) ON DELETE CASCADE,
      construct_key    text NOT NULL,
      safety_level     text,
      rank             integer NOT NULL DEFAULT 0,
      created_at       timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wc3_outcome_state_session ON wc3_outcome_state(session_id);
    CREATE INDEX IF NOT EXISTS idx_wc3_outcome_state_email   ON wc3_outcome_state(user_email);
    CREATE INDEX IF NOT EXISTS idx_wc3_outcome_actions_state ON wc3_outcome_actions(outcome_state_id);
    CREATE INDEX IF NOT EXISTS idx_wc3_outcome_actions_sess  ON wc3_outcome_actions(session_id);
  `);
  // Seed the 6 framework outcome models (idempotent). construct_keys are grounded
  // in the live intervention_library construct vocabulary so model activation +
  // library-backed actions are real, never fabricated. `gated` flags an outcome
  // whose corpus is not yet broad enough to assert readiness (Exam Readiness).
  await pool.query(`
    INSERT INTO wc3_outcome_models (model_key, display_label, anchor, construct_keys, gated, description, composition_spec) VALUES
      ('career_clarity', 'Career Clarity', 'l1_stage',
        ARRAY['CAREER_CLARITY','CAREER_READINESS','SKILL_AWARENESS','GOAL_ORIENTATION','COLLEGE_ADAPT','CAREER_GROWTH'],
        false, 'Clarity of career direction and next-step orientation.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
      ('learning_effectiveness', 'Learning Effectiveness', 'l1_stage',
        ARRAY['LEARNING_APPROACH','LEARNING_DRIVE','ACADEMIC_RECOVERY','CRITICAL_THINKING','WORKING_MEMORY','PROCESSING_SPEED','ATTENTION_REGULATION','EXECUTIVE_FUNCTION'],
        false, 'Effectiveness of the learning approach and cognitive supports.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
      ('employability_readiness', 'Employability Readiness', 'l1_stage',
        ARRAY['SKILL_AWARENESS','COMMUNICATION','SOCIAL_CONFIDENCE','CAREER_READINESS','CREATIVITY'],
        false, 'Readiness of employability-facing skills and self-presentation.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
      ('exam_readiness', 'Exam Readiness', 'l1_stage',
        ARRAY['EXAM_READINESS','EXAM_PERFORMANCE','EXAM_STRESS','STRESS_MANAGEMENT','ACADEMIC_RECOVERY'],
        true, 'Readiness for exam performance under load (corpus-gated).',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key","note":"gated: exam corpus not yet broad enough to assert readiness"}'),
      ('confidence_stability', 'Confidence Stability', 'l1_stage',
        ARRAY['SELF_ESTEEM','SOCIAL_CONFIDENCE','RESILIENCE','EMOTIONAL_REGULATION','ANXIETY','MENTAL_HEALTH','STRESS_MANAGEMENT','PEER_RELATIONS'],
        false, 'Stability of confidence and emotional regulation.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
      ('decision_quality', 'Decision Quality', 'l1_stage',
        ARRAY['CRITICAL_THINKING','IMPULSE_CONTROL','GOAL_ORIENTATION','INTRINSIC_MOTIVATION','EXECUTIVE_FUNCTION','HABIT_FORMATION','DIGITAL_DISCIPLINE','PROCRASTINATION','DIGITAL_DEPENDENCY'],
        false, 'Quality of decision-making and follow-through.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
      -- WC-3 Route Coverage Remediation: closes the FAMILY_DYNAMICS coverage gap.
      -- FAMILY_DYNAMICS is grounded in intervention_library (real actions), so this
      -- model activates + supplies library-backed actions, never fabricated.
      ('family_wellbeing', 'Family Wellbeing', 'l1_stage',
        ARRAY['FAMILY_DYNAMICS'],
        false, 'Quality of family communication, parenting patterns, and home environment.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
      -- WC-10 Lever 3: new holistic_wellbeing model recovers the largest construct-reachable
      -- residual (PHYSICAL_WELLBEING). MENTAL_HEALTH + STRESS_MANAGEMENT are library-backed
      -- (a construct may serve >1 model); PHYSICAL_WELLBEING is library-backed too, so this
      -- model activates AND supplies real library actions, never fabricated. SAFETY_THREATS
      -- stays intentionally UNMAPPED (safeguarding ≠ a developmental outcome — not forced).
      ('holistic_wellbeing', 'Holistic Wellbeing', 'l1_stage',
        ARRAY['PHYSICAL_WELLBEING','MENTAL_HEALTH','STRESS_MANAGEMENT'],
        false, 'Physical, mental and stress-management wellbeing as a whole-person foundation.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}')
    ON CONFLICT (model_key) DO NOTHING;
  `);

  // FRP outcome models — 4 future-readiness models, all drawing from the EXISTING
  // construct vocabulary so they activate against today's signals (zero new signal
  // engineering). entrepreneurship_readiness is gated (OPPORTUNITY_RECOGNITION deferred).
  await pool.query(`
    INSERT INTO wc3_outcome_models (model_key, display_label, anchor, construct_keys, gated, description, composition_spec) VALUES
      ('ai_career_readiness', 'AI Career Readiness', 'l1_stage',
        ARRAY['SKILL_AWARENESS','CRITICAL_THINKING','LEARNING_DRIVE','CAREER_READINESS','INTRINSIC_MOTIVATION'],
        false, 'Readiness to navigate AI-driven career changes: digital proficiency, critical evaluation, and adaptive learning.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
      ('career_transition_readiness', 'Career Transition Readiness', 'l1_stage',
        ARRAY['CAREER_CLARITY','CAREER_READINESS','RESILIENCE','GOAL_ORIENTATION','SKILL_AWARENESS'],
        false, 'Readiness to pivot roles effectively: clarity of direction, resilience under change, and durable skill portfolio.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
      ('future_skills_readiness', 'Future Skills Readiness', 'l1_stage',
        ARRAY['LEARNING_DRIVE','SKILL_AWARENESS','CRITICAL_THINKING','INTRINSIC_MOTIVATION','CAREER_GROWTH'],
        false, 'Readiness to build and maintain durable future-proof skills: learning velocity, self-awareness, and growth drive.',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'),
      ('entrepreneurship_readiness', 'Entrepreneurship Readiness', 'l1_stage',
        ARRAY['INTRINSIC_MOTIVATION','CREATIVITY','SOCIAL_CONFIDENCE','GOAL_ORIENTATION','OPPORTUNITY_RECOGNITION'],
        false, 'Entrepreneurial potential: drive, creative thinking, and initiative (OPPORTUNITY_RECOGNITION active).',
        '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}')
    ON CONFLICT (model_key) DO NOTHING;
  `);

  // ── FRP Intervention Library seeds ────────────────────────────────────────
  // Seeds CAREER_READINESS, CAREER_GROWTH, and OPPORTUNITY_RECOGNITION interventions so
  // the FRP outcome models produce library-backed actions. Each uses a WHERE NOT EXISTS
  // guard (idempotent — uuid PK never self-conflicts). Persona='student' is the WC-3
  // persona-priority fallback so all sessions reach these interventions.
  const seedFRPIntervention = async (
    construct_key: string, confidence_band: string, emotional_load_band: string,
    persona: string, intervention_text: string, rationale: string, safety_level: string,
  ) => {
    await pool.query(`
      INSERT INTO intervention_library
        (construct_key, confidence_band, emotional_load_band, persona, intervention_text, rationale, safety_level)
      SELECT $1,$2,$3,$4,$5,$6,$7
      WHERE NOT EXISTS (
        SELECT 1 FROM intervention_library WHERE construct_key=$1 AND persona=$4 LIMIT 1
      )
    `, [construct_key, confidence_band, emotional_load_band, persona, intervention_text, rationale, safety_level]);
  };

  await seedFRPIntervention('CAREER_READINESS','moderate','moderate','student',
    'Identify 3 roles that genuinely excite you and map the concrete skills each requires. Schedule one informational interview this week — real conversations reveal what job descriptions hide.',
    'Career readiness improves fastest through direct exposure; informational interviews collapse the gap between aspiration and reality.',
    'informational');
  await seedFRPIntervention('CAREER_READINESS','moderate','moderate','counsellor',
    'This individual shows developing career readiness. Facilitate a structured career mapping exercise: list top-3 role aspirations, identify 2–3 skill gaps per role, and commit to one tangible next step within 7 days.',
    'Structured goal-setting with a committed next step significantly accelerates career readiness progression.',
    'supportive');

  await seedFRPIntervention('CAREER_GROWTH','moderate','low','student',
    'Set a "growth experiment" for the next 30 days: pick one new skill from your Future Readiness plan, build one small deliverable with it, and document what you learned. Growth compounds when made visible.',
    'Intentional skill experimentation builds both competence and confidence faster than passive learning.',
    'informational');
  await seedFRPIntervention('CAREER_GROWTH','moderate','low','counsellor',
    'Support this individual in articulating a personal growth narrative. Help them identify one durable skill to develop this quarter, tie it to a tangible output, and review progress fortnightly.',
    'Externalising growth goals with a structured review cadence creates accountability and sustained momentum.',
    'supportive');

  await seedFRPIntervention('OPPORTUNITY_RECOGNITION','moderate','low','student',
    'Practice "opportunity spotting" daily: read one industry brief and write down one problem you notice that does not yet have a good solution. Entrepreneurial instinct develops through deliberate observation, not inspiration.',
    'Structured observation habit trains the pattern-recognition skills that underlie opportunity identification.',
    'informational');
  await seedFRPIntervention('OPPORTUNITY_RECOGNITION','moderate','low','counsellor',
    'Introduce this individual to problem-framing exercises — take a current market shift and co-explore: who is affected, what do they currently do about it, and where does the friction remain. Entrepreneurial readiness grows from structured curiosity.',
    'Problem-framing exercises build the opportunity-recognition cognitive scaffolding most effectively when facilitated.',
    'supportive');

  // Ungate entrepreneurship_readiness now that OPPORTUNITY_RECOGNITION has library-backed
  // interventions. Idempotent — only fires when still gated AND construct key missing.
  await pool.query(`
    UPDATE wc3_outcome_models
       SET gated = false,
           construct_keys = (SELECT ARRAY(
             SELECT DISTINCT k FROM unnest(construct_keys || ARRAY['OPPORTUNITY_RECOGNITION']::text[]) AS k ORDER BY k
           )),
           description = 'Entrepreneurial potential: drive, creative thinking, and initiative (OPPORTUNITY_RECOGNITION active).',
           composition_spec = '{"anchor":"l1_stage","desired_rule":"next_stage_up","actions":"intervention_library.construct_key"}'::jsonb
     WHERE model_key = 'entrepreneurship_readiness'
       AND (gated = true OR NOT (construct_keys @> ARRAY['OPPORTUNITY_RECOGNITION']::text[]));
  `);

  // WC-10 Lever 2 — reversible outcome-model FOLDS. The seed above uses ON CONFLICT DO
  // NOTHING, so EXISTING rows are untouched by seed edits. Apply the folds idempotently
  // here via an array-UNION (only appends keys not already present, so re-running is a
  // no-op). Each fold lands a construct-reachable residual onto a model whose semantics it
  // already shares — closing coverage WITHOUT a new model. Confidence per WC-10 Report 4:
  //   • career_clarity      += CAREER_GROWTH        (HIGH — growth orientation is career direction)
  //   • decision_quality    += DIGITAL_DISCIPLINE   (HIGH — self-regulation of digital habits)
  //   • decision_quality    += PROCRASTINATION      (HIGH — follow-through / impulse control)
  //   • decision_quality    += DIGITAL_DEPENDENCY   (MODERATE — habit-driven decision quality)
  //   • confidence_stability+= PEER_RELATIONS       (MODERATE — social confidence ↔ peer relations)
  // CAREER_GROWTH now HAS intervention_library rows (seeded above) → activates career_clarity
  // with real library-backed actions. Honest improvement, not gamed.
  // Each UPDATE is a strict write-no-op once applied: the `@>` containment guard skips the
  // row entirely when every folded key is already present (no row churn on restart), and the
  // ORDER BY makes the rebuilt array deterministic.
  const applyFold = async (modelKey: string, adds: string[]) => {
    await pool.query(`
      UPDATE wc3_outcome_models SET construct_keys = (
        SELECT ARRAY(SELECT DISTINCT k FROM unnest(construct_keys || $1::text[]) AS k ORDER BY k)
      ) WHERE model_key = $2 AND NOT (construct_keys @> $1::text[]);
    `, [adds, modelKey]);
  };
  await applyFold('career_clarity', ['CAREER_GROWTH']);
  await applyFold('decision_quality', ['DIGITAL_DISCIPLINE', 'PROCRASTINATION', 'DIGITAL_DEPENDENCY']);
  await applyFold('confidence_stability', ['PEER_RELATIONS']);

  outcomeReady = true;
}

/**
 * L3 — Journey Intelligence (Phase C): supported-route catalog (seeded) +
 * per-session route state + ranked route candidates.
 *
 * Composes L1 Stage + L2 Outcome into a Primary/Secondary route across the
 * supported products. Two business invariants are enforced here:
 *   • `wc3_journey_state.primary_route` is NOT NULL → a session can NEVER be
 *     persisted without a route ("no concern terminates without a route").
 *   • the Competitive Exam route ships `corpus_status='corpus_pending'` so it can
 *     still be routed to under a LOW_CONFIDENCE / CORPUS_PENDING band.
 * No score is recomputed; no ontology / signal / concern data is touched.
 */
export async function ensureWc3JourneySchema(pool: Pool): Promise<void> {
  if (journeyReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wc3_journey_routes (
      route_key        text PRIMARY KEY,
      display_label    text NOT NULL,
      product_key      text NOT NULL,
      product_label    text NOT NULL,
      product_path     text,
      model_affinities jsonb NOT NULL DEFAULT '{}',
      corpus_status    text NOT NULL DEFAULT 'ready',
      is_fallback      boolean NOT NULL DEFAULT false,
      fallback_priority integer NOT NULL DEFAULT 100,
      description      text,
      created_at       timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS wc3_journey_state (
      id                          bigserial PRIMARY KEY,
      session_id                  uuid NOT NULL,
      user_email                  text,
      user_id                     uuid,
      primary_route               text NOT NULL REFERENCES wc3_journey_routes(route_key),
      secondary_route             text REFERENCES wc3_journey_routes(route_key),
      route_confidence            numeric NOT NULL DEFAULT 0,
      confidence_band             text NOT NULL DEFAULT 'LOW_CONFIDENCE',
      route_reason                text,
      expected_outcome_key        text,
      expected_outcome            text,
      expected_stage_current      text,
      expected_stage_desired      text,
      expected_stage_advancement  text,
      product_key                 text NOT NULL,
      product_label               text,
      product_path                text,
      contributing_models         text[] NOT NULL DEFAULT '{}',
      degraded                    boolean NOT NULL DEFAULT false,
      status                      text NOT NULL DEFAULT 'routed',
      resolved_at                 timestamptz NOT NULL DEFAULT now(),
      updated_at                  timestamptz NOT NULL DEFAULT now(),
      UNIQUE (session_id)
    );
    CREATE TABLE IF NOT EXISTS wc3_journey_candidates (
      id                  bigserial PRIMARY KEY,
      journey_state_id    bigint NOT NULL REFERENCES wc3_journey_state(id) ON DELETE CASCADE,
      session_id          uuid NOT NULL,
      route_key           text NOT NULL REFERENCES wc3_journey_routes(route_key),
      fit_score           numeric NOT NULL DEFAULT 0,
      corpus_status       text,
      contributing_models text[] NOT NULL DEFAULT '{}',
      rank                integer NOT NULL DEFAULT 0,
      created_at          timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wc3_journey_state_session ON wc3_journey_state(session_id);
    CREATE INDEX IF NOT EXISTS idx_wc3_journey_state_email   ON wc3_journey_state(user_email);
    CREATE INDEX IF NOT EXISTS idx_wc3_journey_cand_state    ON wc3_journey_candidates(journey_state_id);
    CREATE INDEX IF NOT EXISTS idx_wc3_journey_cand_session  ON wc3_journey_candidates(session_id);
  `);
  // Seed the 5 supported routes (idempotent). model_affinities are grounded in the
  // L2 outcome-model vocabulary (wc3_outcome_models.model_key) so route fit derives
  // only from REAL activated outcome models. Competitive Exam is corpus_pending;
  // Mentoring is the deterministic universal fallback (lowest fallback_priority) so
  // a session is never left without a route.
  await pool.query(`
    INSERT INTO wc3_journey_routes
      (route_key, display_label, product_key, product_label, product_path, model_affinities, corpus_status, is_fallback, fallback_priority, description) VALUES
      ('lbi', 'LBI', 'lbi', 'LBI Behavioural Intelligence', '/lbi',
        '{"confidence_stability":0.85,"decision_quality":0.75,"career_clarity":0.30,"learning_effectiveness":0.30,"holistic_wellbeing":0.60}'::jsonb,
        'ready', false, 30, 'Behavioural / life intelligence development pathway.'),
      ('career_builder', 'Career Builder', 'career_builder', 'Career Builder', '/career-builder',
        '{"career_clarity":0.90,"employability_readiness":0.70,"decision_quality":0.50,"learning_effectiveness":0.40}'::jsonb,
        'ready', false, 20, 'Career direction, planning and next-step building pathway.'),
      ('employability_index', 'Employability Index', 'employability_index', 'Employability Index', '/employability-index',
        '{"employability_readiness":0.90,"career_clarity":0.50,"confidence_stability":0.30}'::jsonb,
        'ready', false, 40, 'Employability skills and readiness measurement pathway.'),
      ('competitive_exam', 'Competitive Exam Intelligence', 'competitive_exam', 'Competitive Exam Intelligence', '/exam-intelligence',
        '{"exam_readiness":0.90,"learning_effectiveness":0.70,"confidence_stability":0.30}'::jsonb,
        'corpus_pending', false, 50, 'Competitive-exam preparation pathway (corpus expanding).'),
      ('mentoring', 'Mentoring', 'mentoring', 'Mentoring', '/mentors',
        '{"confidence_stability":0.60,"career_clarity":0.40,"decision_quality":0.40,"employability_readiness":0.40,"learning_effectiveness":0.40,"exam_readiness":0.40,"family_wellbeing":0.40,"holistic_wellbeing":0.40}'::jsonb,
        'ready', true, 0, 'Universal human-mentoring pathway — the deterministic fallback so no concern terminates without a route.'),
      -- WC-3 Route Coverage Remediation: dedicated non-fallback pathway for the
      -- family domain. No standalone family/parenting product exists, so it maps to
      -- the EXISTING, ready Mentoring product (/mentors) as its real destination.
      ('family_support', 'Family & Parenting Support', 'mentoring', 'Mentoring', '/mentors',
        '{"family_wellbeing":0.90}'::jsonb,
        'ready', false, 25, 'Family communication & parenting support pathway, served by the Mentoring product.')
    ON CONFLICT (route_key) DO NOTHING;
  `);

  // FRP journey route — routes future-readiness outcome models to the Future Readiness
  // Platform tab in Career Builder. Idempotent via ON CONFLICT DO NOTHING.
  // entrepreneurship_readiness affinity included at 0.40 (gated, won't surface actions
  // until corpus lands, but the routing itself is non-degraded). Mentoring fallback
  // coverage added for all 4 FRP models below.
  await pool.query(`
    INSERT INTO wc3_journey_routes
      (route_key, display_label, product_key, product_label, product_path, model_affinities, corpus_status, is_fallback, fallback_priority, description) VALUES
      ('future_readiness', 'Future Readiness Platform', 'future_readiness', 'Future Readiness Platform', '/career-builder?tab=future-readiness',
        '{"ai_career_readiness":0.90,"future_skills_readiness":0.80,"career_transition_readiness":0.75,"entrepreneurship_readiness":0.40}'::jsonb,
        'ready', false, 15, 'Future readiness intelligence: AI career navigation, skill planning, transition planning, and emerging careers.')
    ON CONFLICT (route_key) DO NOTHING;
  `);

  // Extend mentoring fallback to cover the 4 new FRP outcome models (idempotent guards).
  await pool.query(`
    UPDATE wc3_journey_routes
       SET model_affinities = model_affinities
         || '{"ai_career_readiness":0.40,"career_transition_readiness":0.40,"future_skills_readiness":0.40,"entrepreneurship_readiness":0.30}'::jsonb
     WHERE route_key = 'mentoring'
       AND NOT (model_affinities ? 'ai_career_readiness');
  `);

  // WC-10 Lever 3 — give the new holistic_wellbeing outcome model a real, non-degraded
  // route home on EXISTING rows (seed above is DO NOTHING). Idempotent + guarded: only
  // adds the affinity when the route does not already carry it, so a future manual tune is
  // never clobbered and re-running is a no-op. LBI (behavioural / life intelligence) is the
  // primary destination (0.60); Mentoring (universal fallback) carries it (0.40) so a
  // wellbeing-led session routes non-degraded instead of falling through.
  await pool.query(`
    UPDATE wc3_journey_routes
       SET model_affinities = model_affinities || '{"holistic_wellbeing":0.60}'::jsonb
     WHERE route_key = 'lbi' AND NOT (model_affinities ? 'holistic_wellbeing');
  `);
  await pool.query(`
    UPDATE wc3_journey_routes
       SET model_affinities = model_affinities || '{"holistic_wellbeing":0.40}'::jsonb
     WHERE route_key = 'mentoring' AND NOT (model_affinities ? 'holistic_wellbeing');
  `);

  journeyReady = true;
}

/**
 * L5A — Question Stage Intelligence (Question Intelligence 2.0, Phase 1).
 *
 * Canonical mirror of `backend/migrations/20261209_wc3_l5a_question_stage.sql`. A single
 * additive sidecar index keyed by the clarity SERIAL `id` (NOT `question_id`, which is
 * reused across different questions). Forward-compatible: later L5 phases ALTER ADD the
 * remaining intelligence dimensions (outcome/journey/persona/context/capability/signal/
 * qis). No existing table is mutated; reversible via `DROP TABLE wc3_question_intelligence`.
 */
export async function ensureWc3QuestionIntelSchema(pool: Pool): Promise<void> {
  if (questionIntelReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wc3_question_intelligence (
      clarity_id         integer PRIMARY KEY,
      question_id        text,
      source             text NOT NULL DEFAULT 'clarity',
      primary_stage      text,
      secondary_stage    text,
      stage_confidence   numeric NOT NULL DEFAULT 0,
      stage_band         text NOT NULL DEFAULT 'UNRESOLVED',
      coverage           numeric NOT NULL DEFAULT 0,
      stage_distribution jsonb NOT NULL DEFAULT '{}',
      signals_used       jsonb NOT NULL DEFAULT '{}',
      computed_at        timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wc3_qi_primary_stage ON wc3_question_intelligence (primary_stage);
    CREATE INDEX IF NOT EXISTS idx_wc3_qi_band ON wc3_question_intelligence (stage_band);
  `);
  questionIntelReady = true;
}

/**
 * WC-3 L5B — Question Context Intelligence sidecar (Question Intelligence 2.0, Phase 2).
 *
 * Canonical mirror of `backend/migrations/20261210_wc3_l5b_question_context.sql`. A single
 * additive sidecar index keyed by the clarity SERIAL `id` (NOT `question_id`, which is
 * reused across different questions). Stamps each clarity question with a derived life-
 * CONTEXT axis (Primary + Secondary context + confidence + `context_explicit` +
 * relevance_risk). No existing table is mutated; reversible via
 * `DROP TABLE wc3_question_context`.
 */
export async function ensureWc3QuestionContextSchema(pool: Pool): Promise<void> {
  if (questionContextReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wc3_question_context (
      clarity_id           integer PRIMARY KEY,
      question_id          text,
      source               text NOT NULL DEFAULT 'clarity',
      primary_context      text,
      secondary_context    text,
      context_confidence   numeric NOT NULL DEFAULT 0,
      context_band         text NOT NULL DEFAULT 'GENERAL',
      context_explicit     boolean NOT NULL DEFAULT false,
      relevance_risk       text NOT NULL DEFAULT 'NONE',
      coverage             numeric NOT NULL DEFAULT 0,
      context_distribution jsonb NOT NULL DEFAULT '{}',
      signals_used         jsonb NOT NULL DEFAULT '{}',
      computed_at          timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_wc3_qc_primary_context ON wc3_question_context (primary_context);
    CREATE INDEX IF NOT EXISTS idx_wc3_qc_band ON wc3_question_context (context_band);
    CREATE INDEX IF NOT EXISTS idx_wc3_qc_risk ON wc3_question_context (relevance_risk);
  `);
  questionContextReady = true;
}
