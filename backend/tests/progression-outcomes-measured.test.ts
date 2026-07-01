/**
 * Task #315 — VALIDATED PROGRESSION OUTCOMES flip: abstain (PARTIAL) → MEASURED.
 *
 * Proves that `composeProgressionOutcomes` (services/outcome-intelligence-engine.ts, Task #308)
 * does NOT silently misreport when real production data arrives: it ABSTAINS honestly below
 * k_min and flips to a real measured rate + a computed time-to-Mastery median ONLY once ≥ k_min
 * (=30) NON-DEMO subjects cross the milestones — while @example.com demo rows stay excluded from
 * every measured figure yet are counted in `demo_subjects_excluded`.
 *
 * Isolation contract (no prod pollution — a fixture "excluded from prod"):
 *   - The whole scenario runs inside a single connection + transaction that is ROLLED BACK.
 *   - We shadow the two real substrates with SESSION-LOCAL TEMP TABLES of the exact real shape,
 *     so all writes/reads are fully isolated from the shared dev DB (and rows model the writer's
 *     own output: outcome_type='learning', outcome_kind='milestone', detail.milestone, is_demo).
 *   - The engine's `tablePresent` probe hits `public.*` (the real permanent tables, which exist in
 *     dev) while the unqualified SELECTs resolve to the pg_temp shadows — so the REAL read SQL
 *     (the FILTERed cohort counts, the `is_demo=false` / `NOT LIKE '%@example.com'` demo exclusion,
 *     and the first-snapshot→first-Mastery-snapshot interval median) is exercised end to end.
 *
 * Run with:  cd backend && npx tsx --test tests/progression-outcomes-measured.test.ts
 */

process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '1'; // capture flag must be ON for the view to read

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { composeProgressionOutcomes, OI_K_MIN } from '../services/outcome-intelligence-engine';
import { captureProgressionOutcome } from '../services/capadex/progression-outcome-capture';

const HAS_DB = !!process.env.DATABASE_URL;
let pool: Pool | null = null;

before(() => {
  if (HAS_DB) pool = new Pool({ connectionString: process.env.DATABASE_URL });
});
after(async () => {
  if (pool) await pool.end();
});

/** Create pg_temp shadows of the two substrates, mirroring the real column shape. ON COMMIT DROP
 *  + the caller's ROLLBACK guarantees nothing survives the test. */
async function createTempShadows(client: PoolClient): Promise<void> {
  await client.query(`CREATE TEMP TABLE validation_loop_outcomes (
    id bigserial PRIMARY KEY, subject_email text NOT NULL, subject_user_id text,
    assessment_ref text, outcome_type text NOT NULL, outcome_kind text NOT NULL,
    outcome_value numeric NOT NULL, predicted_prob_at_decision numeric, predicted_basis text,
    decision_at timestamptz, observed_at timestamptz NOT NULL DEFAULT now(),
    source text NOT NULL, is_demo boolean NOT NULL DEFAULT false, ref_id text,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
  ) ON COMMIT DROP`);
  await client.query(`CREATE TEMP TABLE wc3_longitudinal_snapshots (
    id bigserial PRIMARY KEY, session_id uuid, user_email text, user_id uuid,
    concern_name text, stage_code text, canonical_stage text, score numeric,
    score_level text, csi_score numeric, csi_stage text,
    snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, captured_at timestamptz NOT NULL DEFAULT now()
  ) ON COMMIT DROP`);
}

/** Write one learning-type milestone row mirroring the progression writer's exact output shape. */
async function seedMilestone(
  client: PoolClient,
  email: string,
  milestone: 'stage_completion' | 'reached_mastery',
  isDemo: boolean,
  refPrefix: string,
  key: string,
): Promise<void> {
  await client.query(
    `INSERT INTO validation_loop_outcomes
       (subject_email, outcome_type, outcome_kind, outcome_value, source, is_demo, ref_id, detail)
     VALUES ($1,'learning','milestone',1,'capadex_progression',$2,$3,$4::jsonb)`,
    [email, isDemo, `${refPrefix}:${key}`, JSON.stringify({ milestone })],
  );
}

/** Append a snapshot. `daysAgo` sets captured_at relative to the transaction clock (now() is the
 *  txn-start timestamp in Postgres, so intervals within one txn are exact). */
async function seedSnapshot(
  client: PoolClient,
  email: string,
  canonicalStage: string,
  stageCode: string,
  daysAgo: number,
): Promise<void> {
  await client.query(
    `INSERT INTO wc3_longitudinal_snapshots (user_email, canonical_stage, stage_code, captured_at)
     VALUES ($1,$2,$3, now() - ($4 || ' days')::interval)`,
    [email, canonicalStage, stageCode, daysAgo],
  );
}

interface Scenario {
  completion: number;          // # non-demo subjects with a stage_completion milestone
  mastery: number;             // subset of completion who also reached Mastery (milestone + snapshot)
  demo: number;                // # @example.com subjects (completion + mastery + snapshot)
  /** days-to-Mastery per mastery subject, by index (first snapshot backdated this many days). */
  masteryDaysAgo?: (i: number) => number;
}

/** Seed a scenario into temp shadows, compose the view, and ROLL BACK — nothing persists. */
async function runScenario(s: Scenario): Promise<any> {
  const client = await pool!.connect();
  const composePool: any = { query: (...a: any[]) => (client as any).query(...a) };
  try {
    await client.query('BEGIN');
    await createTempShadows(client);
    const daysAgo = s.masteryDaysAgo ?? (() => 10);

    for (let i = 0; i < s.completion; i++) {
      const email = `progtest+${i}@fixture.test`;
      await seedMilestone(client, email, 'stage_completion', false, 'capadex_progression', `sess-${i}`);
      if (i < s.mastery) {
        // earlier stage snapshot (backdated) → later Mastery snapshot (txn now()): interval is exact.
        await seedSnapshot(client, email, 'Growth', 'CAP_GRW', daysAgo(i));
        await seedSnapshot(client, email, 'Mastery', 'CAP_MAS', 0);
        await seedMilestone(client, email, 'reached_mastery', false, 'capadex_mastery', `sess-${i}`);
      } else {
        await seedSnapshot(client, email, 'Growth', 'CAP_GRW', 5); // completion-only: never reaches Mastery
      }
    }
    for (let i = 0; i < s.demo; i++) {
      const email = `demo+${i}@example.com`;
      await seedMilestone(client, email, 'stage_completion', true, 'capadex_progression', `demo-${i}`);
      await seedMilestone(client, email, 'reached_mastery', true, 'capadex_mastery', `demo-${i}`);
      await seedSnapshot(client, email, 'Mastery', 'CAP_MAS', 0);
    }

    return await composeProgressionOutcomes(composePool);
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

test('k_min is the validation-loop precedent (30) — the flip threshold under test', () => {
  assert.equal(OI_K_MIN, 30);
});

test('BELOW k_min: view ABSTAINS honestly (measured=false, value=null) — no fabricated rate', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  // 29 completions (< k_min) and 15 who reached Mastery (< k_min) — both metrics must abstain,
  // yet Coverage still counts the real subjects (Coverage ⟂ Confidence).
  const r = await runScenario({ completion: 29, mastery: 15 });

  assert.equal(r.capture_enabled, true);
  // Coverage (data axis) is populated even below k_min.
  assert.equal(r.coverage.completion_cohort, 29);
  assert.equal(r.coverage.reached_mastery, 15);

  // Confidence axis abstains — never a coerced number.
  assert.equal(r.progression_rate.measured, false);
  assert.equal(r.progression_rate.value, null);
  assert.equal(r.progression_rate.abstained, true);
  assert.equal(r.time_to_mastery.measured, false);
  assert.equal(r.time_to_mastery.median_days, null);
  assert.equal(r.time_to_mastery.mean_days, null);
  assert.match(r.verdict, /^PARTIAL/);
});

test('AT/ABOVE k_min: view FLIPS to MEASURED with a correct rate + computed time-to-Mastery', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  const COMPLETION = 40;
  const MASTERY = 32;
  const DEMO = 5;
  // Deterministic dwell distribution: 30 subjects at 10 days, 2 at 210 days.
  //   median(32 values) = avg(16th,17th) = 10 ;  mean = (30*10 + 2*210)/32 = 22.5
  const masteryDaysAgo = (i: number) => (i < 30 ? 10 : 210);
  const r = await runScenario({ completion: COMPLETION, mastery: MASTERY, demo: DEMO, masteryDaysAgo });

  assert.equal(r.capture_enabled, true);

  // ── progression_rate: measured, correct value, demo-excluded ──────────────────────────────
  assert.equal(r.progression_rate.measured, true, 'rate must flip to measured at/above k_min');
  assert.equal(r.progression_rate.abstained, false);
  assert.equal(r.progression_rate.completion_cohort, COMPLETION, 'cohort counts non-demo only (40, not 45)');
  assert.equal(r.progression_rate.reached_mastery, MASTERY);
  assert.ok(Math.abs(r.progression_rate.value - MASTERY / COMPLETION) < 1e-9, 'value = 32/40 = 0.8');

  // ── time_to_mastery: measured, median + mean computed over the real interval ───────────────
  assert.equal(r.time_to_mastery.measured, true, 'dwell must flip to measured at/above k_min');
  assert.equal(r.time_to_mastery.sample_size, MASTERY);
  assert.equal(r.time_to_mastery.median_days, 10, 'median dwell days');
  assert.ok(Math.abs(r.time_to_mastery.mean_days - 22.5) < 1e-9, 'mean dwell days = 22.5 (≠ median → real median)');
  assert.equal(r.time_to_mastery.longitudinal_subjects, COMPLETION, 'every non-demo subject has ≥1 snapshot');

  assert.match(r.verdict, /^MEASURED/);
});

test('capture flag OFF: view is inert — capture_enabled=false and both metrics abstain', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  const prev = process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE;
  process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '0';
  try {
    // Even with a full at/above-k_min fixture seeded, an OFF capture flag means NO learning-milestone
    // reads happen — the view abstains identically to the empty state (byte-identical when OFF).
    const r = await runScenario({ completion: 40, mastery: 32, demo: 5 });
    assert.equal(r.capture_enabled, false);
    assert.equal(r.progression_rate.measured, false);
    assert.equal(r.progression_rate.value, null);
    assert.equal(r.progression_rate.completion_cohort, null, 'no substrate reads while OFF (null≠0)');
    assert.equal(r.time_to_mastery.measured, false);
    assert.equal(r.time_to_mastery.median_days, null);
  } finally {
    process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = prev;
  }
});

test('DEMO (@example.com) rows are excluded from measured figures but counted in demo_subjects_excluded', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  const COMPLETION = 35;
  const MASTERY = 32;
  const DEMO = 12;
  const r = await runScenario({ completion: COMPLETION, mastery: MASTERY, demo: DEMO });

  // Demo subjects are counted ONLY on the exclusion axis, never in any measured figure.
  assert.equal(r.coverage.demo_subjects_excluded, DEMO, 'demo subjects counted separately');
  assert.equal(r.coverage.completion_cohort, COMPLETION, 'demo NOT folded into the cohort (35, not 47)');
  assert.equal(r.progression_rate.completion_cohort, COMPLETION);
  assert.equal(r.progression_rate.reached_mastery, MASTERY);
  // If demo were (incorrectly) counted, the rate would be 44/47 ≈ 0.936 — it must be 32/35.
  assert.ok(Math.abs(r.progression_rate.value - MASTERY / COMPLETION) < 1e-9, 'measured rate uses non-demo subjects only');
  // Time-to-Mastery sample must also exclude demo Mastery snapshots (32 non-demo, not 44).
  assert.equal(r.time_to_mastery.sample_size, MASTERY);
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// WRITER ↔ VIEW DRIFT GUARD (Task #336)
//
// The scenarios above seed the writer's *output shape* directly (temp shadows) so they can backdate
// captured_at and prove the k_min flip + demo exclusion. That is deliberate — the real writer stamps
// snapshots at now() and can't backdate. But it leaves ONE gap: if the REAL capture writer
// (`captureProgressionOutcome`) ever changes its output columns, its `detail.milestone` keys, or its
// `outcome_type`, the view (`composeProgressionOutcomes`) could silently stop counting real subjects
// and no test above would catch it.
//
// These two tests close that gap by driving a NON-DEMO subject through the REAL writer end to end and
// confirming the view counts it. Isolation: real permanent tables (confirmed present + empty of
// learning milestones in dev) inside a single connection + transaction that is ROLLED BACK — so the
// writer's own ensure-schema paths (`ensureValidationLoopSchema` incl. the ON CONFLICT partial unique
// index, `ensureWc3LongitudinalSchema`) run against the real shape and nothing persists. We assert on
// the DELTA vs a baseline compose so the guard is robust to any pre-existing dev rows.
// ─────────────────────────────────────────────────────────────────────────────────────────────

test('WRITER↔VIEW drift guard: a subject driven through the REAL captureProgressionOutcome is counted by the view', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '1'; // capture must be ON for the writer to write + view to read

  const client = await pool!.connect();
  const txnPool: any = { query: (...a: any[]) => (client as any).query(...a) };
  try {
    await client.query('BEGIN');

    // Baseline: compose against the real committed state BEFORE seeding, so the guard is a DELTA
    // (robust to any pre-existing dev rows — the learning-milestone substrate is confirmed empty).
    const before = await composeProgressionOutcomes(txnPool);
    const beforeCompletion = before.coverage.completion_cohort ?? 0;
    const beforeMastery = before.coverage.reached_mastery ?? 0;
    const beforeLongitudinal = before.coverage.longitudinal_subjects ?? 0;

    // Drive ONE non-demo subject through the REAL writer: Growth stage → then Mastery stage. This
    // exercises stage_completion + reached_mastery milestones AND a Mastery longitudinal snapshot.
    // The subject email is randomised so the delta assertion is collision-proof even against any
    // pre-existing dev data (rollback also guarantees no self-pollution).
    const sessionId = randomUUID();
    const email = `writer-drift-guard+${randomUUID()}@fixture.test`;

    const growth = await captureProgressionOutcome(txnPool, {
      sessionId, email, stageCode: 'CAP_GRW', canonicalStage: 'Growth',
    });
    assert.equal(growth.enabled, true, 'writer active while flag ON');
    assert.equal(growth.learning_outcome_written, true, 'stage_completion milestone written');
    assert.equal(growth.snapshot_captured, true, 'Growth longitudinal snapshot written');
    assert.equal(growth.mastery_outcome_written, false, 'Growth is not Mastery — no mastery milestone yet');

    const mastery = await captureProgressionOutcome(txnPool, {
      sessionId, email, stageCode: 'CAP_MAS', canonicalStage: 'Mastery',
    });
    assert.equal(mastery.enabled, true);
    assert.equal(mastery.learning_outcome_written, true, 'stage_completion milestone (idempotent per session)');
    assert.equal(mastery.mastery_outcome_written, true, 'reached_mastery milestone written by the REAL writer');
    assert.equal(mastery.snapshot_captured, true, 'Mastery longitudinal snapshot written');
    assert.equal(mastery.is_demo, false, 'non-demo subject');

    // ── The drift guard itself: the view MUST count the real-writer subject. ────────────────────
    // If the writer's detail.milestone keys / outcome_type / columns drift away from what
    // composeProgressionOutcomes FILTERs on, these deltas go to 0 and the test fails loudly.
    const after = await composeProgressionOutcomes(txnPool);
    assert.equal(after.capture_enabled, true);
    assert.equal(
      (after.coverage.completion_cohort ?? 0) - beforeCompletion, 1,
      'stage_completion milestone from the REAL writer is counted (detail.milestone/outcome_type contract holds)',
    );
    assert.equal(
      (after.coverage.reached_mastery ?? 0) - beforeMastery, 1,
      'reached_mastery milestone from the REAL writer is counted',
    );
    assert.equal(
      (after.coverage.longitudinal_subjects ?? 0) - beforeLongitudinal, 1,
      'the REAL longitudinal snapshot subject is counted',
    );
    // progression_rate mirrors read the SAME substrate — they must move in lockstep with coverage.
    assert.equal((after.progression_rate.completion_cohort ?? 0) - beforeCompletion, 1);
    assert.equal((after.progression_rate.reached_mastery ?? 0) - beforeMastery, 1);

    // One subject is below k_min → Confidence axis still ABSTAINS honestly (Coverage counts it).
    assert.equal(after.progression_rate.measured, false, 'below k_min → rate abstains (Coverage ⟂ Confidence)');
    assert.equal(after.time_to_mastery.measured, false, 'below k_min → dwell abstains');
  } finally {
    await client.query('ROLLBACK'); // nothing persists — the fixture never touches committed dev data
    client.release();
  }
});

test('WRITER byte-identical OFF: the REAL writer writes nothing and the view stays inert while the flag is OFF', async (t) => {
  if (!HAS_DB) return t.skip('DATABASE_URL not set');
  const prev = process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE;
  process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '0';

  const client = await pool!.connect();
  const txnPool: any = { query: (...a: any[]) => (client as any).query(...a) };
  try {
    await client.query('BEGIN');
    const before = await composeProgressionOutcomes(txnPool);

    // Even a full Mastery-stage input is a no-op while OFF: no snapshot, no ledger row, no DDL.
    const res = await captureProgressionOutcome(txnPool, {
      sessionId: randomUUID(), email: 'off-writer@fixture.test', stageCode: 'CAP_MAS', canonicalStage: 'Mastery',
    });
    assert.equal(res.enabled, false, 'writer inert while flag OFF');
    assert.equal(res.snapshot_captured, false);
    assert.equal(res.learning_outcome_written, false);
    assert.equal(res.mastery_outcome_written, false);
    assert.equal(res.skipped_reason, 'flag_off');

    // View is inert too — capture_enabled=false and no substrate reads (byte-identical to empty).
    const after = await composeProgressionOutcomes(txnPool);
    assert.equal(after.capture_enabled, false);
    assert.equal(after.coverage.completion_cohort, before.coverage.completion_cohort);
    assert.equal(after.coverage.reached_mastery, before.coverage.reached_mastery);
    assert.equal(after.progression_rate.measured, false);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = prev;
  }
});
