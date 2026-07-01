/**
 * Task #262 — Interview & offer decisions must NEVER silently fail to record their outcomes.
 *
 * The performance (interviewer verdict) and retention (offer status) outcome capture is
 * fire-and-forget + never-throws by design, so a regression in the MAPPING or the RECORDER would
 * be invisible: outcomes would just stop accruing with no error, silently starving the validation
 * loop's Coverage axis. This test LOCKS IN:
 *   1. Pure mapping (`recommendationToOutcome`, `offerStatusToRetention`) — the exact verdict → {0,1,skip}
 *      taxonomy, including the "skip" cases that must NOT record a row.
 *   2. The end-to-end recorders (`recordInterviewPerformanceOutcome`, `recordOfferRetentionOutcome`)
 *      exercised through their REAL read SQL, proving: skip verdicts write nothing; terminal verdicts
 *      write exactly one row of the correct outcome_type/value; idempotency on (outcome_type, ref_id)
 *      (re-run UPDATES in place — never a duplicate row); @example.com subjects are is_demo=true; and a
 *      null / out-of-range prediction is stored NULL (Coverage-only), never coerced to a fake 0.
 *
 * Isolation contract (no prod pollution):
 *   - The whole scenario runs inside a single connection + transaction that is ROLLED BACK.
 *   - We shadow every substrate (employer_interviews / employer_offers / employer_candidates and
 *     validation_loop_outcomes) with SESSION-LOCAL TEMP TABLES of the real column shape, so the
 *     unqualified read/write SQL inside the recorders resolves to the shadows — the REAL code path
 *     (mapping, prediction derivation, demo flagging, ON CONFLICT idempotency) runs end to end while
 *     nothing touches the shared dev DB. The temp validation_loop_outcomes shadow carries the same
 *     partial unique index (outcome_type, ref_id) the migration defines so ON CONFLICT resolves.
 *
 * Run with:  cd backend && npx tsx --test tests/employer-outcome-capture.test.ts
 */

process.env.FF_VALIDATION_LOOP = '1'; // recorders no-op unless the validation-loop flag is ON

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool, type PoolClient } from 'pg';
import {
  recommendationToOutcome,
  offerStatusToRetention,
  recordInterviewPerformanceOutcome,
  recordOfferRetentionOutcome,
} from '../routes/employer-portal';

const HAS_DB = !!process.env.DATABASE_URL;
let pool: Pool | null = null;

before(() => {
  if (HAS_DB) pool = new Pool({ connectionString: process.env.DATABASE_URL });
});
after(async () => {
  if (pool) await pool.end();
});

const EMPLOYER = '11111111-1111-1111-1111-111111111111';

/** Create pg_temp shadows of every substrate the recorders touch, mirroring the real column shape.
 *  ON COMMIT DROP + the caller's ROLLBACK guarantee nothing survives the test. The validation shadow
 *  carries the SAME partial unique index the migration defines so the recorder's ON CONFLICT resolves. */
async function createTempShadows(client: PoolClient): Promise<void> {
  await client.query(`CREATE TEMP TABLE employer_candidates (
    id text PRIMARY KEY, employer_id text NOT NULL, email text,
    match_score numeric, predicted_prob_at_decision numeric, capadex_session_id text
  ) ON COMMIT DROP`);
  await client.query(`CREATE TEMP TABLE employer_interviews (
    id text PRIMARY KEY, employer_id text NOT NULL, candidate_id text,
    job_id text, recommendation text, rating numeric
  ) ON COMMIT DROP`);
  await client.query(`CREATE TEMP TABLE employer_offers (
    id text PRIMARY KEY, employer_id text NOT NULL, candidate_id text,
    job_id text, status text
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
}

async function seedCandidate(
  client: PoolClient,
  id: string,
  email: string | null,
  matchScore: number | null,
  predictedProb: number | null = null,
): Promise<void> {
  await client.query(
    `INSERT INTO employer_candidates (id, employer_id, email, match_score, predicted_prob_at_decision, capadex_session_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, EMPLOYER, email, matchScore, predictedProb, `sess-${id}`],
  );
}

async function seedInterview(client: PoolClient, id: string, candidateId: string | null, recommendation: string): Promise<void> {
  await client.query(
    `INSERT INTO employer_interviews (id, employer_id, candidate_id, recommendation) VALUES ($1,$2,$3,$4)`,
    [id, EMPLOYER, candidateId, recommendation],
  );
}

async function seedOffer(client: PoolClient, id: string, candidateId: string | null, status: string): Promise<void> {
  await client.query(
    `INSERT INTO employer_offers (id, employer_id, candidate_id, status) VALUES ($1,$2,$3,$4)`,
    [id, EMPLOYER, candidateId, status],
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

// ── 1. Pure mapping: recommendation verdict → {1, 0, skip} ──────────────────────────────────────
test('recommendationToOutcome: Strong Hire / Hire → 1, No Hire → 0, Maybe / blank / unknown → skip (null)', () => {
  assert.equal(recommendationToOutcome('Strong Hire'), 1);
  assert.equal(recommendationToOutcome('Hire'), 1);
  assert.equal(recommendationToOutcome('  strong hire  '), 1, 'trim + case-insensitive');
  assert.equal(recommendationToOutcome('HIRE'), 1);
  assert.equal(recommendationToOutcome('No Hire'), 0);
  assert.equal(recommendationToOutcome('no hire'), 0);
  assert.equal(recommendationToOutcome('Maybe'), null, 'Maybe carries no binary verdict');
  assert.equal(recommendationToOutcome(''), null, 'blank → skip');
  assert.equal(recommendationToOutcome('   '), null, 'whitespace → skip');
  assert.equal(recommendationToOutcome('Pending'), null, 'unknown → skip');
});

// ── 2. Pure mapping: offer status → {1, 0, skip} ────────────────────────────────────────────────
test('offerStatusToRetention: Accepted → 1, Declined/Withdrawn/Expired → 0, Draft/Sent/Negotiating → skip (null)', () => {
  assert.equal(offerStatusToRetention('Accepted'), 1);
  assert.equal(offerStatusToRetention('accepted'), 1);
  assert.equal(offerStatusToRetention('Declined'), 0);
  assert.equal(offerStatusToRetention('Withdrawn'), 0);
  assert.equal(offerStatusToRetention('Expired'), 0);
  assert.equal(offerStatusToRetention('Draft'), null, 'non-terminal → skip');
  assert.equal(offerStatusToRetention('Sent'), null, 'non-terminal → skip');
  assert.equal(offerStatusToRetention('Negotiating'), null, 'non-terminal → skip');
  assert.equal(offerStatusToRetention('pending_approval'), null, 'non-terminal → skip');
  assert.equal(offerStatusToRetention(''), null, 'blank → skip');
});

// ── 3. Interview recorder: terminal verdict records ONE performance row of the correct value ─────
test('recordInterviewPerformanceOutcome: Hire records ONE performance row (value 1, pred = match/100)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-1', 'alice@corp.test', 80);
    await seedInterview(client, 'iv-1', 'cand-1', 'Hire');
    await recordInterviewPerformanceOutcome(shadowPool, EMPLOYER, 'iv-1');

    const rows = await readRows(client, 'performance', 'employer_interview:iv-1');
    assert.equal(rows.length, 1, 'exactly one row recorded');
    assert.equal(Number(rows[0].outcome_value), 1);
    assert.equal(rows[0].subject_email, 'alice@corp.test');
    assert.equal(Number(rows[0].predicted_prob_at_decision), 0.8, 'match_score 80 → 0.8');
    assert.equal(rows[0].is_demo, false);
  });
});

test('recordInterviewPerformanceOutcome: No Hire records value 0', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-2', 'bob@corp.test', 40);
    await seedInterview(client, 'iv-2', 'cand-2', 'No Hire');
    await recordInterviewPerformanceOutcome(shadowPool, EMPLOYER, 'iv-2');

    const rows = await readRows(client, 'performance', 'employer_interview:iv-2');
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].outcome_value), 0);
  });
});

// ── 4. Interview recorder: skip verdict records NOTHING ─────────────────────────────────────────
test('recordInterviewPerformanceOutcome: Maybe / blank record NO row (skip is honest absence, not 0)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-3', 'carol@corp.test', 70);
    await seedInterview(client, 'iv-maybe', 'cand-3', 'Maybe');
    await seedInterview(client, 'iv-blank', 'cand-3', '');
    await recordInterviewPerformanceOutcome(shadowPool, EMPLOYER, 'iv-maybe');
    await recordInterviewPerformanceOutcome(shadowPool, EMPLOYER, 'iv-blank');

    const all = await client.query(`SELECT count(*)::int AS n FROM validation_loop_outcomes`);
    assert.equal(all.rows[0].n, 0, 'no verdict → no row (never a fabricated 0-outcome)');
  });
});

// ── 5. Idempotency: re-running the SAME interview UPDATES in place, never duplicates ─────────────
test('recordInterviewPerformanceOutcome: re-run on (outcome_type, ref_id) UPDATES, no duplicate row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-4', 'dan@corp.test', 60);
    await seedInterview(client, 'iv-idem', 'cand-4', 'Hire');
    await recordInterviewPerformanceOutcome(shadowPool, EMPLOYER, 'iv-idem');

    let rows = await readRows(client, 'performance', 'employer_interview:iv-idem');
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].outcome_value), 1);
    const firstId = rows[0].id;

    // The interviewer flips the verdict to No Hire and it is reprocessed.
    await client.query(`UPDATE employer_interviews SET recommendation = 'No Hire' WHERE id = 'iv-idem'`);
    await recordInterviewPerformanceOutcome(shadowPool, EMPLOYER, 'iv-idem');

    rows = await readRows(client, 'performance', 'employer_interview:iv-idem');
    assert.equal(rows.length, 1, 're-run must UPDATE in place — never a second row');
    assert.equal(rows[0].id, firstId, 'same row id (ON CONFLICT UPDATE, not a fresh insert)');
    assert.equal(Number(rows[0].outcome_value), 0, 'value updated to the new verdict');
  });
});

// ── 6. Demo flagging: @example.com subject is recorded is_demo = true ────────────────────────────
test('recordInterviewPerformanceOutcome: @example.com subject → is_demo = true', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-5', 'demo@example.com', 90);
    await seedInterview(client, 'iv-demo', 'cand-5', 'Strong Hire');
    await recordInterviewPerformanceOutcome(shadowPool, EMPLOYER, 'iv-demo');

    const rows = await readRows(client, 'performance', 'employer_interview:iv-demo');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_demo, true, '@example.com → demo row (excluded from realized calibration)');
    assert.equal(Number(rows[0].outcome_value), 1);
  });
});

// ── 7. Prediction NULL (Coverage-only), never coerced to 0 ───────────────────────────────────────
test('recordInterviewPerformanceOutcome: match_score 0 → prediction stored NULL (never a fake 0-pair)', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-6', 'erin@corp.test', 0);
    await seedInterview(client, 'iv-nopred', 'cand-6', 'Hire');
    await recordInterviewPerformanceOutcome(shadowPool, EMPLOYER, 'iv-nopred');

    const rows = await readRows(client, 'performance', 'employer_interview:iv-nopred');
    assert.equal(rows.length, 1, 'outcome still recorded (Coverage) even with no prediction');
    assert.equal(Number(rows[0].outcome_value), 1);
    assert.equal(rows[0].predicted_prob_at_decision, null, 'match_score 0 → prediction NULL, not 0');
  });
});

// ── 8. Offer recorder: terminal status records ONE retention row; prefers predicted_prob_at_decision
test('recordOfferRetentionOutcome: Accepted → value 1, uses candidate predicted_prob_at_decision', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-7', 'fay@corp.test', 50, 0.73);
    await seedOffer(client, 'of-1', 'cand-7', 'Accepted');
    await recordOfferRetentionOutcome(shadowPool, EMPLOYER, 'of-1');

    const rows = await readRows(client, 'retention', 'employer_offer:of-1');
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].outcome_value), 1);
    assert.equal(Number(rows[0].predicted_prob_at_decision), 0.73, 'prefers stored decision-time prob over match score');
  });
});

test('recordOfferRetentionOutcome: Declined → value 0; falls back to match/100 when no stored prob', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-8', 'gus@corp.test', 55, null);
    await seedOffer(client, 'of-2', 'cand-8', 'Declined');
    await recordOfferRetentionOutcome(shadowPool, EMPLOYER, 'of-2');

    const rows = await readRows(client, 'retention', 'employer_offer:of-2');
    assert.equal(rows.length, 1);
    assert.equal(Number(rows[0].outcome_value), 0);
    assert.equal(Number(rows[0].predicted_prob_at_decision), 0.55, 'no stored prob → match_score/100');
  });
});

// ── 9. Offer recorder: non-terminal status records NOTHING ──────────────────────────────────────
test('recordOfferRetentionOutcome: Draft / Sent / Negotiating record NO row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-9', 'hana@corp.test', 65);
    await seedOffer(client, 'of-draft', 'cand-9', 'Draft');
    await seedOffer(client, 'of-sent', 'cand-9', 'Sent');
    await seedOffer(client, 'of-nego', 'cand-9', 'Negotiating');
    await recordOfferRetentionOutcome(shadowPool, EMPLOYER, 'of-draft');
    await recordOfferRetentionOutcome(shadowPool, EMPLOYER, 'of-sent');
    await recordOfferRetentionOutcome(shadowPool, EMPLOYER, 'of-nego');

    const all = await client.query(`SELECT count(*)::int AS n FROM validation_loop_outcomes`);
    assert.equal(all.rows[0].n, 0, 'non-terminal offer → no realized outcome');
  });
});

// ── 10. Offer recorder: idempotency on (outcome_type, ref_id) ───────────────────────────────────
test('recordOfferRetentionOutcome: re-run UPDATES in place, no duplicate row', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    await seedCandidate(client, 'cand-10', 'ivy@corp.test', 50);
    await seedOffer(client, 'of-idem', 'cand-10', 'Accepted');
    await recordOfferRetentionOutcome(shadowPool, EMPLOYER, 'of-idem');

    let rows = await readRows(client, 'retention', 'employer_offer:of-idem');
    assert.equal(rows.length, 1);
    const firstId = rows[0].id;

    await client.query(`UPDATE employer_offers SET status = 'Declined' WHERE id = 'of-idem'`);
    await recordOfferRetentionOutcome(shadowPool, EMPLOYER, 'of-idem');

    rows = await readRows(client, 'retention', 'employer_offer:of-idem');
    assert.equal(rows.length, 1, 're-run must UPDATE, never duplicate');
    assert.equal(rows[0].id, firstId);
    assert.equal(Number(rows[0].outcome_value), 0, 'value reflects the new terminal status');
  });
});

// ── 11. Offer recorder: out-of-range prediction stored NULL, never coerced ───────────────────────
test('recordOfferRetentionOutcome: out-of-range prediction (>1) stored NULL, never coerced to 0', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  await withScenario(async (client, shadowPool) => {
    // A corrupt match_score of 150 would derive 1.5 — out of [0,1]; the recorder must store NULL.
    await seedCandidate(client, 'cand-11', 'jack@corp.test', 150, null);
    await seedOffer(client, 'of-oob', 'cand-11', 'Accepted');
    await recordOfferRetentionOutcome(shadowPool, EMPLOYER, 'of-oob');

    const rows = await readRows(client, 'retention', 'employer_offer:of-oob');
    assert.equal(rows.length, 1, 'outcome still recorded (Coverage) even with an invalid prediction');
    assert.equal(Number(rows[0].outcome_value), 1);
    assert.equal(rows[0].predicted_prob_at_decision, null, 'out-of-range prob → NULL, not clamped or 0');
  });
});
