/**
 * Task #338 — Hiring & promotion outcomes must NEVER silently stop accruing.
 *
 * Task #262 locked in the interview (performance) and offer (retention) recorders. The SAME
 * validation-loop intake ALSO records HIRING and PROMOTION outcomes through the identical
 * fire-and-forget + never-throws path, so a regression in those mappings/recorders would be
 * invisible: rows would just stop appearing with no error, silently starving the validation
 * loop's Coverage axis. This test LOCKS IN both types.
 *
 * Honest scope note (verified against the code, not assumed):
 *   - HIRING is WIRED end-to-end. The employer-portal call site is `snapshotDecisionProb`
 *     (candidate pipeline stage → hiring outcome): stage 'Hired' → 1, 'Rejected' → 0, any
 *     non-terminal stage → skip (no row). Part C exercises that REAL call site end-to-end.
 *   - PROMOTION is WIRED end-to-end through `recordRealizedPromotionOutcome`
 *     (routes/talent-outcome-prediction.ts), exposed as the super-admin route
 *     POST /api/admin/talent/predictions/:email/promotion-outcome. A genuine promotion DECISION
 *     (promoted = 1 / passed-over = 0) snapshots the standing `promotion_probability`
 *     (ti_outcome_predictions) as the decision-time prediction and writes a durable
 *     validation_loop_outcomes row via `recordPromotionOutcome`. Part D exercises that REAL call
 *     site end-to-end. (The original finding expected the mapping in employer-portal.ts; the actual
 *     wired call site lives in the talent-outcome-prediction domain, where promotion_probability is
 *     computed — this is the honest correction.) Part A still exercises the underlying recorder
 *     directly for the input-guard / demo / null-prediction cases the mapping cannot itself produce.
 *
 * What is asserted for BOTH types:
 *   - status/verdict → {1, 0, skip} mapping (skip must write NOTHING, never a fabricated 0-outcome).
 *   - exactly one row of the correct outcome_type / outcome_value on a terminal decision.
 *   - idempotency on (outcome_type, ref_id): a re-run UPDATES in place, never a duplicate row.
 *   - @example.com subjects are recorded is_demo = true (excluded from realized calibration).
 *   - a null / out-of-range prediction is stored NULL (Coverage-only), never coerced to a fake 0.
 *
 * Isolation contract (no prod pollution) — identical to backend/tests/employer-outcome-capture.test.ts:
 *   - The whole scenario runs inside a single connection + transaction that is ROLLED BACK.
 *   - We shadow every substrate (employer_candidates / employer_jobs and validation_loop_outcomes)
 *     with SESSION-LOCAL TEMP TABLES of the real column shape, so the unqualified read/write SQL
 *     inside the recorders resolves to the shadows — the REAL code path (mapping, prediction
 *     derivation, demo flagging, ON CONFLICT idempotency) runs end to end while nothing touches the
 *     shared dev DB. The temp validation_loop_outcomes shadow carries the same partial unique index
 *     (outcome_type, ref_id) the migration defines so ON CONFLICT resolves.
 *
 * Run with:  cd backend && npx tsx --test tests/promotion-hiring-outcome-capture.test.ts
 */

process.env.FF_VALIDATION_LOOP = '1'; // recorders no-op unless the validation-loop flag is ON

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool, type PoolClient } from 'pg';
import { recordHiringOutcome, recordPromotionOutcome } from '../services/validation-loop-intake';
import { snapshotDecisionProb } from '../routes/employer-portal';
import { recordRealizedPromotionOutcome } from '../routes/talent-outcome-prediction';

const HAS_DB = !!process.env.DATABASE_URL;
let pool: Pool | null = null;

before(() => {
  if (HAS_DB) pool = new Pool({ connectionString: process.env.DATABASE_URL });
});
after(async () => {
  if (pool) await pool.end();
});

const EMPLOYER = '22222222-2222-2222-2222-222222222222';

/** Create pg_temp shadows of every substrate the recorders + hiring call site touch, mirroring the
 *  real column shape. ON COMMIT DROP + the caller's ROLLBACK guarantee nothing survives the test.
 *  The validation shadow carries the SAME partial unique index the migration defines so the
 *  recorder's ON CONFLICT resolves. */
async function createTempShadows(client: PoolClient): Promise<void> {
  // employer_candidates: superset used by snapshotDecisionProb (SELECT *). The extra columns
  // (stage / job_id / skills / decision_at / candidate_user_id / user_id) mirror the real table.
  await client.query(`CREATE TEMP TABLE employer_candidates (
    id text PRIMARY KEY, employer_id text NOT NULL, email text,
    match_score numeric, predicted_prob_at_decision numeric, decision_at timestamptz,
    job_id text, stage text, skills text, capadex_session_id text,
    candidate_user_id text, user_id text
  ) ON COMMIT DROP`);
  await client.query(`CREATE TEMP TABLE employer_jobs (
    id text PRIMARY KEY, employer_id text NOT NULL, skills text
  ) ON COMMIT DROP`);
  await client.query(`CREATE TEMP TABLE validation_loop_outcomes (
    id bigserial PRIMARY KEY, subject_email text NOT NULL, subject_user_id text,
    assessment_ref text, outcome_type text NOT NULL, outcome_kind text NOT NULL DEFAULT 'binary',
    outcome_value numeric NOT NULL, predicted_prob_at_decision numeric, predicted_basis text,
    decision_at timestamptz, observed_at timestamptz NOT NULL DEFAULT now(),
    source text NOT NULL DEFAULT 'manual', is_demo boolean NOT NULL DEFAULT false, ref_id text,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
  ) ON COMMIT DROP`);
  await client.query(`CREATE UNIQUE INDEX uq_vlo_type_ref
    ON validation_loop_outcomes (outcome_type, ref_id) WHERE ref_id IS NOT NULL`);
  // ti_outcome_predictions: the promotion PREDICTION substrate recordRealizedPromotionOutcome reads
  // (it snapshots the standing promotion_probability as the decision-time prediction). Columns
  // mirror the real table's shape for the fields the helper selects.
  await client.query(`CREATE TEMP TABLE ti_outcome_predictions (
    id bigserial PRIMARY KEY, user_email text NOT NULL, rf_id integer, rf_name text,
    blueprint_key text, promotion_probability numeric, predicted_at timestamptz DEFAULT now(),
    UNIQUE(user_email, rf_id)
  ) ON COMMIT DROP`);
}

/** Seed a standing promotion prediction (the decision-time snapshot recordRealizedPromotionOutcome reads). */
async function seedPrediction(
  client: PoolClient,
  opts: { email: string; rfId: number; rfName?: string; promotionProbability: number | null },
): Promise<void> {
  await client.query(
    `INSERT INTO ti_outcome_predictions (user_email, rf_id, rf_name, promotion_probability)
     VALUES ($1,$2,$3,$4)`,
    [opts.email.toLowerCase(), opts.rfId, opts.rfName ?? `Role ${opts.rfId}`, opts.promotionProbability],
  );
}

async function seedCandidate(
  client: PoolClient,
  opts: { id: string; email: string | null; matchScore?: number | null; jobId?: string | null; stage?: string | null; skills?: string | null },
): Promise<void> {
  await client.query(
    `INSERT INTO employer_candidates (id, employer_id, email, match_score, job_id, stage, skills, capadex_session_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [opts.id, EMPLOYER, opts.email, opts.matchScore ?? null, opts.jobId ?? null, opts.stage ?? null, opts.skills ?? null, `sess-${opts.id}`],
  );
}

/** Read back the recorded outcome rows for one (outcome_type, ref_id). */
async function readRows(client: PoolClient, outcomeType: string, refId: string): Promise<any[]> {
  const r = await client.query(
    `SELECT * FROM validation_loop_outcomes WHERE outcome_type = $1 AND ref_id = $2 ORDER BY id`,
    [outcomeType, refId],
  );
  return r.rows;
}

async function countAll(client: PoolClient): Promise<number> {
  const r = await client.query(`SELECT count(*)::int AS n FROM validation_loop_outcomes`);
  return r.rows[0].n;
}

/** Run a scenario inside a rolled-back transaction with a shadow-backed pool. */
async function withScenario(fn: (client: PoolClient, shadowPool: any) => Promise<void>): Promise<void> {
  const client = await pool!.connect();
  const shadowPool: any = { query: (...a: any[]) => (client as any).query(...a) };
  try {
    await client.query('BEGIN');
    await createTempShadows(client);
    await fn(client, shadowPool);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// PART A — PROMOTION recorder (recordPromotionOutcome). This is the low-level recorder that the wired
// call site (recordRealizedPromotionOutcome, exercised in Part D) depends on. outcomeValue is the
// realized verdict: 1 = promoted, 0 = passed-over; anything else must be REJECTED (skip), never written.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── A1. promoted (1) records ONE 'promotion' row of value 1 ─────────────────────────────────────
test('recordPromotionOutcome: promoted → ONE promotion row (value 1)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    const res = await recordPromotionOutcome(shadowPool, {
      subjectEmail: 'alice@corp.test', outcomeValue: 1, predictedProb: 0.7,
      refId: 'employee_review:er-1', detail: { review_id: 'er-1' },
    });
    assert.equal(res.recorded, true);
    const rows = await readRows(client, 'promotion', 'employee_review:er-1');
    assert.equal(rows.length, 1, 'exactly one promotion row recorded');
    assert.equal(rows[0].outcome_type, 'promotion');
    assert.equal(Number(rows[0].outcome_value), 1);
    assert.equal(rows[0].subject_email, 'alice@corp.test');
    assert.equal(Number(rows[0].predicted_prob_at_decision), 0.7);
    assert.equal(rows[0].is_demo, false);
  });
});

// ── A2. passed-over (0) records value 0 ─────────────────────────────────────────────────────────
test('recordPromotionOutcome: passed-over → value 0', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await recordPromotionOutcome(shadowPool, {
      subjectEmail: 'bob@corp.test', outcomeValue: 0, refId: 'employee_review:er-2',
    });
    const rows = await readRows(client, 'promotion', 'employee_review:er-2');
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].outcome_value), 0);
  });
});

// ── A3. invalid verdict → skip (records NOTHING, never a fabricated 0-outcome) ───────────────────
test('recordPromotionOutcome: out-of-domain outcomeValue → skip, NO row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    const r2 = await recordPromotionOutcome(shadowPool, { subjectEmail: 'c@corp.test', outcomeValue: 2 as any, refId: 'r-a' });
    const rNull = await recordPromotionOutcome(shadowPool, { subjectEmail: 'c@corp.test', outcomeValue: null as any, refId: 'r-b' });
    assert.equal(r2.recorded, false);
    assert.equal(r2.reason, 'outcome_value_must_be_0_or_1');
    assert.equal(rNull.recorded, false);
    assert.equal(await countAll(client), 0, 'invalid verdict → no row (never fabricated)');
  });
});

// ── A4. missing subject / ref_id → skip (guards that would silently stall a wired call site) ─────
test('recordPromotionOutcome: missing subject_email or ref_id → skip, NO row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    const noEmail = await recordPromotionOutcome(shadowPool, { subjectEmail: '', outcomeValue: 1, refId: 'r-c' });
    const noRef = await recordPromotionOutcome(shadowPool, { subjectEmail: 'd@corp.test', outcomeValue: 1, refId: '' });
    assert.equal(noEmail.recorded, false);
    assert.equal(noEmail.reason, 'subject_email_required');
    assert.equal(noRef.recorded, false);
    assert.equal(noRef.reason, 'ref_id_required');
    assert.equal(await countAll(client), 0);
  });
});

// ── A5. idempotency on (outcome_type, ref_id): re-run UPDATES in place, never duplicates ─────────
test('recordPromotionOutcome: re-run on (promotion, ref_id) UPDATES, no duplicate row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await recordPromotionOutcome(shadowPool, { subjectEmail: 'ivy@corp.test', outcomeValue: 1, refId: 'employee_review:er-idem' });
    let rows = await readRows(client, 'promotion', 'employee_review:er-idem');
    assert.equal(rows.length, 1);
    const firstId = rows[0].id;

    // The review decision is corrected to passed-over and reprocessed.
    await recordPromotionOutcome(shadowPool, { subjectEmail: 'ivy@corp.test', outcomeValue: 0, refId: 'employee_review:er-idem' });
    rows = await readRows(client, 'promotion', 'employee_review:er-idem');
    assert.equal(rows.length, 1, 're-run must UPDATE in place — never a second row');
    assert.equal(rows[0].id, firstId, 'same row id (ON CONFLICT UPDATE, not a fresh insert)');
    assert.equal(Number(rows[0].outcome_value), 0, 'value updated to the corrected verdict');
  });
});

// ── A6. @example.com subject → is_demo = true ───────────────────────────────────────────────────
test('recordPromotionOutcome: @example.com subject → is_demo = true', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await recordPromotionOutcome(shadowPool, { subjectEmail: 'demo@example.com', outcomeValue: 1, refId: 'employee_review:er-demo' });
    const rows = await readRows(client, 'promotion', 'employee_review:er-demo');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_demo, true, '@example.com → demo row (excluded from realized calibration)');
  });
});

// ── A7. null / out-of-range prediction stored NULL, never coerced to a fake pair ─────────────────
test('recordPromotionOutcome: null and out-of-range predictions stored NULL (valid one kept)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await recordPromotionOutcome(shadowPool, { subjectEmail: 'e@corp.test', outcomeValue: 1, predictedProb: null, refId: 'r-null' });
    await recordPromotionOutcome(shadowPool, { subjectEmail: 'f@corp.test', outcomeValue: 1, predictedProb: 1.5, refId: 'r-oob' });
    await recordPromotionOutcome(shadowPool, { subjectEmail: 'g@corp.test', outcomeValue: 0, predictedProb: 0.42, refId: 'r-ok' });

    const nullRow = await readRows(client, 'promotion', 'r-null');
    const oobRow = await readRows(client, 'promotion', 'r-oob');
    const okRow = await readRows(client, 'promotion', 'r-ok');
    assert.equal(nullRow[0].predicted_prob_at_decision, null, 'null prediction → NULL, outcome still recorded (Coverage)');
    assert.equal(Number(nullRow[0].outcome_value), 1);
    assert.equal(oobRow[0].predicted_prob_at_decision, null, 'out-of-range (>1) prediction → NULL, never clamped/coerced');
    assert.equal(Number(okRow[0].predicted_prob_at_decision), 0.42, 'a valid probability is kept as-is');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// PART B — HIRING recorder (recordHiringOutcome). Proves the hiring type honors the SAME honesty
// contract as promotion / performance / retention (identical fire-and-forget path). This complements
// Part C (the wired mapping) with the null/out-of-range prediction cases the mapping can't produce.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── B1. hired (1) / rejected (0) each record ONE 'hiring' row of the correct value ───────────────
test('recordHiringOutcome: hired → value 1, rejected → value 0 (correct outcome_type)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await recordHiringOutcome(shadowPool, { subjectEmail: 'h1@corp.test', outcomeValue: 1, predictedProb: 0.8, refId: 'employer_candidate:c-1' });
    await recordHiringOutcome(shadowPool, { subjectEmail: 'h2@corp.test', outcomeValue: 0, predictedProb: 0.3, refId: 'employer_candidate:c-2' });

    const hired = await readRows(client, 'hiring', 'employer_candidate:c-1');
    const rej = await readRows(client, 'hiring', 'employer_candidate:c-2');
    assert.equal(hired.length, 1);
    assert.equal(hired[0].outcome_type, 'hiring');
    assert.equal(Number(hired[0].outcome_value), 1);
    assert.equal(Number(hired[0].predicted_prob_at_decision), 0.8);
    assert.equal(rej.length, 1);
    assert.equal(Number(rej[0].outcome_value), 0);
  });
});

// ── B2. invalid verdict → skip, NO row ──────────────────────────────────────────────────────────
test('recordHiringOutcome: out-of-domain outcomeValue → skip, NO row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    const res = await recordHiringOutcome(shadowPool, { subjectEmail: 'h3@corp.test', outcomeValue: 5 as any, refId: 'employer_candidate:c-3' });
    assert.equal(res.recorded, false);
    assert.equal(res.reason, 'outcome_value_must_be_0_or_1');
    assert.equal(await countAll(client), 0);
  });
});

// ── B3. idempotency on (outcome_type, ref_id) ───────────────────────────────────────────────────
test('recordHiringOutcome: re-run UPDATES in place, no duplicate row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await recordHiringOutcome(shadowPool, { subjectEmail: 'h4@corp.test', outcomeValue: 1, refId: 'employer_candidate:c-idem' });
    let rows = await readRows(client, 'hiring', 'employer_candidate:c-idem');
    const firstId = rows[0].id;
    await recordHiringOutcome(shadowPool, { subjectEmail: 'h4@corp.test', outcomeValue: 0, refId: 'employer_candidate:c-idem' });
    rows = await readRows(client, 'hiring', 'employer_candidate:c-idem');
    assert.equal(rows.length, 1, 're-run must UPDATE, never duplicate');
    assert.equal(rows[0].id, firstId);
    assert.equal(Number(rows[0].outcome_value), 0);
  });
});

// ── B4. @example.com subject → is_demo = true ───────────────────────────────────────────────────
test('recordHiringOutcome: @example.com subject → is_demo = true', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await recordHiringOutcome(shadowPool, { subjectEmail: 'demo@example.com', outcomeValue: 1, refId: 'employer_candidate:c-demo' });
    const rows = await readRows(client, 'hiring', 'employer_candidate:c-demo');
    assert.equal(rows[0].is_demo, true);
  });
});

// ── B5. null / out-of-range prediction stored NULL ──────────────────────────────────────────────
test('recordHiringOutcome: null and out-of-range predictions stored NULL, outcome still recorded', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await recordHiringOutcome(shadowPool, { subjectEmail: 'h5@corp.test', outcomeValue: 1, predictedProb: null, refId: 'employer_candidate:c-null' });
    await recordHiringOutcome(shadowPool, { subjectEmail: 'h6@corp.test', outcomeValue: 0, predictedProb: -0.2, refId: 'employer_candidate:c-neg' });

    const nullRow = await readRows(client, 'hiring', 'employer_candidate:c-null');
    const negRow = await readRows(client, 'hiring', 'employer_candidate:c-neg');
    assert.equal(nullRow[0].predicted_prob_at_decision, null);
    assert.equal(Number(nullRow[0].outcome_value), 1, 'outcome recorded (Coverage) even with no prediction');
    assert.equal(negRow[0].predicted_prob_at_decision, null, 'out-of-range (<0) → NULL, never coerced to 0');
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// PART C — HIRING call site (snapshotDecisionProb), the REAL wired employer-portal path that maps a
// candidate pipeline STAGE → hiring outcome. This is the mapping a regression would silently stall.
// With no employer_jobs row, computeSuccessProbability returns match_score/100 so the predicted prob
// is deterministic and assertable.
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── C1. stage 'Hired' → ONE hiring row value 1, prediction = match_score/100 ─────────────────────
test('snapshotDecisionProb: stage Hired → hiring row value 1 (pred = match/100)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, { id: 'cand-hire', email: 'nina@corp.test', matchScore: 80, jobId: 'job-1', stage: 'Hired' });
    await snapshotDecisionProb(shadowPool, EMPLOYER, 'cand-hire');

    const rows = await readRows(client, 'hiring', 'employer_candidate:cand-hire');
    assert.equal(rows.length, 1, 'exactly one hiring row recorded');
    assert.equal(Number(rows[0].outcome_value), 1);
    assert.equal(rows[0].subject_email, 'nina@corp.test');
    assert.equal(Number(rows[0].predicted_prob_at_decision), 0.8, 'match_score 80 → 0.8');
    assert.equal(rows[0].is_demo, false);
    // The candidate row's decision-time snapshot is persisted too.
    const cand = await client.query(`SELECT predicted_prob_at_decision FROM employer_candidates WHERE id = 'cand-hire'`);
    assert.equal(Number(cand.rows[0].predicted_prob_at_decision), 0.8);
  });
});

// ── C2. stage 'Rejected' → value 0 ──────────────────────────────────────────────────────────────
test('snapshotDecisionProb: stage Rejected → hiring row value 0', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, { id: 'cand-rej', email: 'omar@corp.test', matchScore: 40, jobId: 'job-1', stage: 'Rejected' });
    await snapshotDecisionProb(shadowPool, EMPLOYER, 'cand-rej');

    const rows = await readRows(client, 'hiring', 'employer_candidate:cand-rej');
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].outcome_value), 0);
    assert.equal(Number(rows[0].predicted_prob_at_decision), 0.4);
  });
});

// ── C3. non-terminal stage → NO row (mapping skip; the outcome is not realized yet) ──────────────
test('snapshotDecisionProb: non-terminal stage records NO hiring row (skip)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, { id: 'cand-iv', email: 'pia@corp.test', matchScore: 70, jobId: 'job-1', stage: 'Interview' });
    await snapshotDecisionProb(shadowPool, EMPLOYER, 'cand-iv');
    assert.equal(await countAll(client), 0, 'non-terminal stage → no realized hiring outcome');
  });
});

// ── C4. missing job_id → NO row (guard: cannot compute a decision-time prediction) ──────────────
test('snapshotDecisionProb: candidate with no job_id records NO row (guard)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, { id: 'cand-nojob', email: 'quinn@corp.test', matchScore: 90, jobId: null, stage: 'Hired' });
    await snapshotDecisionProb(shadowPool, EMPLOYER, 'cand-nojob');
    assert.equal(await countAll(client), 0, 'no job_id → snapshot guard fires, no row');
  });
});

// ── C5. @example.com subject → is_demo = true ───────────────────────────────────────────────────
test('snapshotDecisionProb: @example.com candidate → is_demo = true', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, { id: 'cand-demo', email: 'demo@example.com', matchScore: 90, jobId: 'job-1', stage: 'Hired' });
    await snapshotDecisionProb(shadowPool, EMPLOYER, 'cand-demo');
    const rows = await readRows(client, 'hiring', 'employer_candidate:cand-demo');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_demo, true);
  });
});

// ── C6. idempotency: re-run is a guarded no-op (predicted_prob_at_decision already set) ──────────
test('snapshotDecisionProb: re-run does NOT record a second row (decision snapshot is write-once)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, { id: 'cand-once', email: 'rex@corp.test', matchScore: 60, jobId: 'job-1', stage: 'Hired' });
    await snapshotDecisionProb(shadowPool, EMPLOYER, 'cand-once');
    let rows = await readRows(client, 'hiring', 'employer_candidate:cand-once');
    assert.equal(rows.length, 1);
    const firstId = rows[0].id;

    // A second landing on the terminal stage must NOT double-record: the guard sees
    // predicted_prob_at_decision is already set and returns early (write-once snapshot).
    await snapshotDecisionProb(shadowPool, EMPLOYER, 'cand-once');
    rows = await readRows(client, 'hiring', 'employer_candidate:cand-once');
    assert.equal(rows.length, 1, 'write-once: re-run records no second row');
    assert.equal(rows[0].id, firstId);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// PART D — PROMOTION call site (recordRealizedPromotionOutcome), the REAL wired talent-outcome-
// prediction path that turns a genuine promotion DECISION (promoted=1 / passed-over=0) into a durable
// promotion outcome, snapshotting the standing promotion_probability (ti_outcome_predictions) as the
// decision-time prediction. This is the mapping a regression would silently stall — before this
// wiring existed, the promotion calibration axis could only ever ABSTAIN. The refId is
// `ti_promotion:<email>:<rf_id|na>:<decision_ref>`, keyed per promotion CYCLE so recurring cycles
// stay distinct rows (never collapse into a silent under-count).
// ════════════════════════════════════════════════════════════════════════════════════════════════

// ── D1. promoted (1) WITH a standing prediction → ONE promotion row snapshotting that prediction ──
test('recordRealizedPromotionOutcome: promoted → ONE promotion row, snapshots standing prediction', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedPrediction(client, { email: 'sara@corp.test', rfId: 501, promotionProbability: 0.73 });
    const res = await recordRealizedPromotionOutcome(shadowPool, {
      email: 'sara@corp.test', rfId: 501, outcome: 1, decisionRef: 'cycle-2026-h1',
    });
    assert.equal(res.recorded, true);
    assert.equal(res.rf_id, 501);
    assert.equal(res.predicted_prob, 0.73, 'standing promotion_probability snapshotted as the decision-time prediction');
    const refId = 'ti_promotion:sara@corp.test:501:cycle-2026-h1';
    assert.equal(res.ref_id, refId, 'refId keyed per (email, rf_id, decision cycle)');
    const rows = await readRows(client, 'promotion', refId);
    assert.equal(rows.length, 1, 'exactly one promotion row recorded');
    assert.equal(rows[0].outcome_type, 'promotion');
    assert.equal(Number(rows[0].outcome_value), 1);
    assert.equal(rows[0].subject_email, 'sara@corp.test');
    assert.equal(Number(rows[0].predicted_prob_at_decision), 0.73, 'prediction persisted on the outcome row');
    assert.equal(rows[0].is_demo, false);
    assert.equal(rows[0].source, 'talent_promotion_decision');
  });
});

// ── D2. passed-over (0) → value 0 (a realized negative decision is a real pair, not a skip) ───────
test('recordRealizedPromotionOutcome: passed-over → promotion row value 0', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedPrediction(client, { email: 'tom@corp.test', rfId: 502, promotionProbability: 0.41 });
    const res = await recordRealizedPromotionOutcome(shadowPool, {
      email: 'tom@corp.test', rfId: 502, outcome: 0, decisionRef: 'cycle-2026-h1',
    });
    assert.equal(res.recorded, true);
    const rows = await readRows(client, 'promotion', 'ti_promotion:tom@corp.test:502:cycle-2026-h1');
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].outcome_value), 0);
    assert.equal(Number(rows[0].predicted_prob_at_decision), 0.41);
  });
});

// ── D3. no standing prediction → Coverage-only row with NULL prediction (never fabricated) ────────
test('recordRealizedPromotionOutcome: no prediction row → NULL prediction (Coverage-only, not coerced)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    // No seedPrediction: the talent has no standing promotion_probability.
    const res = await recordRealizedPromotionOutcome(shadowPool, {
      email: 'una@corp.test', outcome: 1, decisionRef: 'cycle-x',
    });
    assert.equal(res.recorded, true, 'outcome still recorded (Coverage) even with no prediction');
    assert.equal(res.predicted_prob, null);
    assert.equal(res.rf_id, null);
    const rows = await readRows(client, 'promotion', 'ti_promotion:una@corp.test:na:cycle-x');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].predicted_prob_at_decision, null, 'NULL prediction, never coerced to a fake pair');
    assert.equal(Number(rows[0].outcome_value), 1);
  });
});

// ── D4. idempotency per cycle: same decision_ref UPDATES in place; a new cycle is a distinct row ──
test('recordRealizedPromotionOutcome: same cycle UPDATES, new decision_ref is a separate row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedPrediction(client, { email: 'vic@corp.test', rfId: 504, promotionProbability: 0.6 });
    await recordRealizedPromotionOutcome(shadowPool, { email: 'vic@corp.test', rfId: 504, outcome: 1, decisionRef: 'cycle-2026-h1' });
    let rows = await readRows(client, 'promotion', 'ti_promotion:vic@corp.test:504:cycle-2026-h1');
    assert.equal(rows.length, 1);
    const firstId = rows[0].id;

    // Re-recording the SAME cycle (e.g. a correction) UPDATES in place, never a duplicate.
    await recordRealizedPromotionOutcome(shadowPool, { email: 'vic@corp.test', rfId: 504, outcome: 0, decisionRef: 'cycle-2026-h1' });
    rows = await readRows(client, 'promotion', 'ti_promotion:vic@corp.test:504:cycle-2026-h1');
    assert.equal(rows.length, 1, 'same cycle → UPDATE in place, no duplicate row');
    assert.equal(rows[0].id, firstId);
    assert.equal(Number(rows[0].outcome_value), 0, 'corrected verdict applied');

    // A NEW promotion cycle (distinct decision_ref) is a genuinely separate realized outcome.
    await recordRealizedPromotionOutcome(shadowPool, { email: 'vic@corp.test', rfId: 504, outcome: 1, decisionRef: 'cycle-2026-h2' });
    const all = await client.query(
      `SELECT count(*)::int AS n FROM validation_loop_outcomes WHERE outcome_type='promotion' AND subject_email='vic@corp.test'`,
    );
    assert.equal(all.rows[0].n, 2, 'two cycles → two distinct promotion rows (no silent under-count)');
  });
});

// ── D5. input guards: bad outcome / missing decision_ref → skip, NO row (never a fabricated 0/1) ──
test('recordRealizedPromotionOutcome: invalid outcome and missing decision_ref → skip, NO row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    const badOutcome = await recordRealizedPromotionOutcome(shadowPool, { email: 'w@corp.test', outcome: 2 as any, decisionRef: 'cycle' });
    const noRef = await recordRealizedPromotionOutcome(shadowPool, { email: 'w@corp.test', outcome: 1, decisionRef: '' });
    const noEmail = await recordRealizedPromotionOutcome(shadowPool, { email: '', outcome: 1, decisionRef: 'cycle' });
    assert.equal(badOutcome.recorded, false);
    assert.equal(badOutcome.reason, 'outcome_must_be_0_or_1');
    assert.equal(noRef.recorded, false);
    assert.equal(noRef.reason, 'decision_ref_required', 'per-cycle marker required on every call path');
    assert.equal(noEmail.recorded, false);
    assert.equal(noEmail.reason, 'subject_email_required');
    assert.equal(await countAll(client), 0, 'no fabricated rows from rejected inputs');
  });
});

// ── D6. @example.com subject → is_demo = true (excluded from realized calibration) ────────────────
test('recordRealizedPromotionOutcome: @example.com subject → is_demo = true', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedPrediction(client, { email: 'demo@example.com', rfId: 506, promotionProbability: 0.9 });
    await recordRealizedPromotionOutcome(shadowPool, { email: 'demo@example.com', rfId: 506, outcome: 1, decisionRef: 'cycle-demo' });
    const rows = await readRows(client, 'promotion', 'ti_promotion:demo@example.com:506:cycle-demo');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_demo, true, '@example.com → demo row (excluded from realized calibration)');
  });
});
