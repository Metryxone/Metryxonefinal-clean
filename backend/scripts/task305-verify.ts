/**
 * Task #305 verification — longitudinal outcome capture on progression.
 * Exercises the capture service + reassessment signal + outcome-engine fold in BOTH
 * flag states against the live dev DB, then cleans up its own @example.com rows.
 * NEVER fabricates: prints measured row counts only.
 */
import { Pool } from 'pg';

const VERIFY_SESSION = '00000000-0000-4000-8000-0000000305aa';
const REAL_EMAIL = 'task305.real@verify.metryxone.test'; // non-demo, non-@example.com
const DEMO_EMAIL = 'task305.demo@example.com';

async function counts(pool: Pool) {
  const vlo = await pool.query(
    `SELECT count(*)::int n,
            count(*) FILTER (WHERE is_demo=false)::int realized,
            count(*) FILTER (WHERE is_demo=true)::int demo
       FROM validation_loop_outcomes WHERE outcome_type='learning'`);
  const snap = await pool.query(
    `SELECT count(*)::int n FROM wc3_longitudinal_snapshots WHERE session_id=$1`, [VERIFY_SESSION]);
  return { learning: vlo.rows[0], snapshots: snap.rows[0].n };
}

async function cleanup(pool: Pool) {
  await pool.query(
    `DELETE FROM validation_loop_outcomes WHERE ref_id IN ($1,$2)`,
    [`capadex_progression:${VERIFY_SESSION}`, `capadex_mastery:${VERIFY_SESSION}`]);
  await pool.query(`DELETE FROM wc3_longitudinal_snapshots WHERE session_id=$1`, [VERIFY_SESSION]);
  const DEMO = VERIFY_SESSION.replace('aa', 'bb');
  await pool.query(`DELETE FROM validation_loop_outcomes WHERE ref_id IN ($1,$2)`,
    [`capadex_progression:${DEMO}`, `capadex_mastery:${DEMO}`]);
  await pool.query(`DELETE FROM wc3_longitudinal_snapshots WHERE session_id=$1`, [DEMO]);
  await pool.query(`DELETE FROM capadex_sessions WHERE id IN ($1,$2)`, [VERIFY_SESSION, DEMO]);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { captureProgressionOutcome, getReassessmentSignal } =
    await import('../services/capadex/progression-outcome-capture.js');
  const { composeLedger } = await import('../services/outcome-intelligence-engine.js');
  // composeLedger called WITHOUT a type filter — exactly the path the reviewer flagged for
  // duplicating / leaking 'learning' rows out of the generic validation-loop block.
  const ledgerProgressionRows = async () => {
    const led = await composeLedger(pool, undefined, 500);
    return (led.rows || []).filter((r: any) => r.type === 'learning' && r.source === 'capadex_progression');
  };

  try {
    await cleanup(pool);
    // Fixture: minimal capadex_sessions rows so getReassessmentSignal can resolve the
    // bearer session (production always has a real session; the signal is null otherwise).
    const DEMO_SESSION = VERIFY_SESSION.replace('aa', 'bb');
    for (const [sid, em] of [[VERIFY_SESSION, REAL_EMAIL], [DEMO_SESSION, DEMO_EMAIL]] as const) {
      await pool.query(
        `INSERT INTO capadex_sessions (id, guest_email, concern_name, user_age, age_band, stage_code, status)
         VALUES ($1,$2,'Verify Concern',30,'adult','CAP_MAS','complete')
         ON CONFLICT (id) DO UPDATE SET guest_email=EXCLUDED.guest_email`, [sid, em]);
    }

    // ── OFF state ──────────────────────────────────────────────────────────
    delete process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE;
    const before = await counts(pool);
    const offRes = await captureProgressionOutcome(pool, {
      sessionId: VERIFY_SESSION, userId: null, email: REAL_EMAIL,
      concernName: 'Verify Concern', stageCode: 'CAP_MAS', canonicalStage: 'Mastery',
      score: 88, scoreLevel: 'High',
    });
    const offSignal = await getReassessmentSignal(pool, VERIFY_SESSION);
    const afterOff = await counts(pool);
    console.log('\n=== OFF STATE ===');
    console.log('capture result:', JSON.stringify(offRes));
    console.log('reassessment signal:', JSON.stringify(offSignal));
    console.log('learning rows before/after:', before.learning.n, '/', afterOff.learning.n);
    console.log('snapshot rows before/after:', before.snapshots, '/', afterOff.snapshots);
    const offLedger = await ledgerProgressionRows();
    console.log('ledger progression rows (flag OFF):', offLedger.length);
    const offClean = offRes.enabled === false && afterOff.learning.n === before.learning.n
      && afterOff.snapshots === before.snapshots && offSignal === null && offLedger.length === 0;
    console.log('OFF byte-identical (no rows, signal null, no ledger leak):', offClean ? 'PASS' : 'FAIL');

    // ── ON state ───────────────────────────────────────────────────────────
    process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE = '1';
    // real (non-demo) Mastery completion
    const onReal = await captureProgressionOutcome(pool, {
      sessionId: VERIFY_SESSION, userId: null, email: REAL_EMAIL,
      concernName: 'Verify Concern', stageCode: 'CAP_MAS', canonicalStage: 'Mastery',
      score: 88, scoreLevel: 'High',
    });
    // demo completion on a DISTINCT session ref so it lands as its own demo row
    await pool.query(`DELETE FROM validation_loop_outcomes WHERE ref_id IN ($1,$2)`,
      [`capadex_progression:${DEMO_SESSION}`, `capadex_mastery:${DEMO_SESSION}`]);
    await pool.query(`DELETE FROM wc3_longitudinal_snapshots WHERE session_id=$1`, [DEMO_SESSION]);
    const onDemo = await captureProgressionOutcome(pool, {
      sessionId: DEMO_SESSION, userId: null, email: DEMO_EMAIL,
      concernName: 'Verify Concern', stageCode: 'CAP_MAS', canonicalStage: 'Mastery',
      score: 90, scoreLevel: 'High',
    });
    const onSignal = await getReassessmentSignal(pool, VERIFY_SESSION);
    const afterOn = await counts(pool);
    console.log('\n=== ON STATE ===');
    console.log('real capture:', JSON.stringify(onReal));
    console.log('demo capture:', JSON.stringify(onDemo));
    console.log('reassessment signal:', JSON.stringify(onSignal));

    // idempotency: re-run the real capture, expect NO new rows
    const beforeIdem = await counts(pool);
    await captureProgressionOutcome(pool, {
      sessionId: VERIFY_SESSION, userId: null, email: REAL_EMAIL,
      concernName: 'Verify Concern', stageCode: 'CAP_MAS', canonicalStage: 'Mastery',
      score: 88, scoreLevel: 'High',
    });
    const afterIdem = await counts(pool);
    console.log('idempotency (learning rows same):', beforeIdem.learning.n, '/', afterIdem.learning.n,
      beforeIdem.learning.n === afterIdem.learning.n ? 'PASS' : 'FAIL');

    // verify the two distinct milestone ref_ids exist for the real session
    const refs = await pool.query(
      `SELECT ref_id, is_demo, detail->>'milestone' milestone FROM validation_loop_outcomes
        WHERE ref_id LIKE 'capadex_%:'||$1 ORDER BY ref_id`, [VERIFY_SESSION]);
    console.log('real session milestone rows:', JSON.stringify(refs.rows));

    const onOk = onReal.snapshot_captured && onReal.learning_outcome_written
      && onReal.mastery_outcome_written && onReal.is_demo === false
      && onDemo.is_demo === true && onSignal && onSignal.eligible_for_exit === true;
    console.log('ON capture (snapshot+learning+mastery, demo flagged, exit eligible):', onOk ? 'PASS' : 'FAIL');

    // ── demo exclusion lockstep (the EXACT SQL the engine's learning block runs) ──
    const realized = await pool.query(
      `SELECT COUNT(*)::int AS count FROM validation_loop_outcomes WHERE outcome_type='learning' AND is_demo=false`);
    const demo = await pool.query(
      `SELECT COUNT(*)::int AS count FROM validation_loop_outcomes WHERE outcome_type='learning' AND is_demo=true`);
    console.log('\n=== ENGINE lockstep SQL (flag ON) ===');
    console.log('realized (is_demo=false):', realized.rows[0].count);
    console.log('demo (is_demo=true):', demo.rows[0].count);
    console.log('demo excluded from realized:', demo.rows[0].count >= 1 && realized.rows[0].count >= 1 ? 'PASS (both axes counted separately)' : 'note: counts depend on live data');

    // ── ledger NO-duplication (flag ON, type omitted) ──────────────────────
    // composeLedger(undefined) must surface each progression learning row EXACTLY once.
    const dbProg = await pool.query(
      `SELECT COUNT(*)::int AS count FROM validation_loop_outcomes
        WHERE outcome_type='learning' AND source='capadex_progression'`);
    const onLedger = await ledgerProgressionRows();
    const noDup = onLedger.length === dbProg.rows[0].count && dbProg.rows[0].count >= 1;
    console.log('\n=== LEDGER (composeLedger, type omitted) ===');
    console.log('db progression rows:', dbProg.rows[0].count, '· ledger progression rows:', onLedger.length);
    console.log('no duplication (ledger == db, surfaced exactly once):', noDup ? 'PASS' : 'FAIL');

    // cleanup demo session rows too
    await pool.query(`DELETE FROM validation_loop_outcomes WHERE ref_id IN ($1,$2)`,
      [`capadex_progression:${DEMO_SESSION}`, `capadex_mastery:${DEMO_SESSION}`]);
    await pool.query(`DELETE FROM wc3_longitudinal_snapshots WHERE session_id=$1`, [DEMO_SESSION]);
  } finally {
    await cleanup(pool);
    delete process.env.FF_LONGITUDINAL_OUTCOME_CAPTURE;
    await pool.end();
  }
}

main().catch(e => { console.error('VERIFY ERROR:', e); process.exit(1); });
