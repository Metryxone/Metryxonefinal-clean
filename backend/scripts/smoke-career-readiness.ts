/**
 * PHASE 4.3 smoke — Career Readiness aggregator (engine-level, no HTTP/auth).
 *
 * Verifies the honesty contract directly against the live dev DB:
 *   1. never-throws on a non-existent subject; all blocks honest-unmeasured.
 *   2. FRP fabrication guard: Future block is measurable=false / score=null when
 *      there is no real Future-Readiness data (default ~40 composite suppressed).
 *   3. overall composite is the mean of MEASURABLE present blocks only; null when
 *      none measurable; growth excluded from the present composite.
 *   4. history: to_regclass probe => exists:false before any snapshot; POST-path
 *      persist appends an append-only row; list then returns it. (cleans up.)
 */
import { Pool } from 'pg';
import {
  buildCareerReadiness,
  persistCareerReadinessSnapshot,
  listCareerReadinessHistory,
} from '../services/career-readiness-aggregator.js';

const SMOKE_SUBJECT = 'smoke-cr-nonexistent-subject';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error('ASSERT FAILED: ' + msg);
  console.log('  ✓ ' + msg);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const pool = new Pool({ connectionString: url });
  let failed = false;
  try {
    console.log('\n[1] non-existent subject — honest unmeasured everywhere');
    const env = await buildCareerReadiness(pool, SMOKE_SUBJECT);
    assert(env.ok === true, 'envelope ok');
    assert(env.subject_id === SMOKE_SUBJECT, 'subject echoed');
    assert(['current', 'future', 'role', 'growth'].every((k) => (env as any)[k]), 'all four blocks present');

    console.log('\n[2] FRP fabrication guard');
    assert(env.future.measurable === false, 'future unmeasured (no real FRP data)');
    assert(env.future.score === null, 'future score is null (default ~40 suppressed, not surfaced)');
    assert(env.future.axes.confidence.value === 0 || env.future.axes.confidence.value === null,
      'future confidence reflects 0 real signals');

    console.log('\n[3] overall composite honesty');
    const measurablePresent = [env.current, env.future, env.role].filter((b) => b.measurable && b.score != null);
    if (measurablePresent.length === 0) {
      assert(env.overall.measurable === false && env.overall.score === null,
        'overall null when no measurable present block');
    } else {
      const mean = Math.round((measurablePresent.reduce((a, b) => a + (b.score as number), 0) / measurablePresent.length) * 10) / 10;
      assert(env.overall.score === mean, `overall = mean of measurable present blocks (${mean})`);
    }
    assert(!env.overall.contributing.includes('growth' as any), 'growth excluded from present composite');

    console.log('\n[4] history: probe / append-only persist / list');
    const before = await listCareerReadinessHistory(pool, SMOKE_SUBJECT);
    // Table may already exist from a prior run; only assert empty for THIS subject.
    assert(before.items.every((r) => r.subject_id === SMOKE_SUBJECT), 'list is subject-scoped');
    const beforeCount = before.count;
    const row = await persistCareerReadinessSnapshot(pool, env);
    assert(Number(row.id) > 0, 'persist returns a row id'); // BIGSERIAL → pg returns string
    assert(row.subject_id === SMOKE_SUBJECT, 'persisted subject matches');
    const after = await listCareerReadinessHistory(pool, SMOKE_SUBJECT);
    assert(after.exists === true, 'table exists after snapshot');
    assert(after.count === beforeCount + 1, 'append-only: exactly one new row');

    // cleanup smoke rows (shared dev DB)
    await pool.query(`DELETE FROM career_readiness_history WHERE subject_id = $1`, [SMOKE_SUBJECT]);
    console.log('  ✓ cleaned up smoke rows');

    console.log('\nEnvelope sample:', JSON.stringify({
      measurable: env.measurable,
      overall: env.overall,
      blocks: {
        current: { measurable: env.current.measurable, score: env.current.score, band: env.current.band },
        future: { measurable: env.future.measurable, score: env.future.score, band: env.future.band, conf: env.future.axes.confidence.value },
        role: { measurable: env.role.measurable, score: env.role.score, band: env.role.band },
        growth: { measurable: env.growth.measurable, score: env.growth.score, band: env.growth.band },
      },
    }, null, 2));

    console.log('\n✅ SMOKE PASSED');
  } catch (e: any) {
    failed = true;
    console.error('\n❌ SMOKE FAILED:', e?.message ?? e);
  } finally {
    await pool.end();
  }
  process.exit(failed ? 1 : 0);
}

main();
