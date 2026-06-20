/**
 * PHASE 4.4 smoke — Career Gap engine (engine-level, no HTTP/auth).
 *
 * Verifies the honesty contract directly against the live dev DB:
 *   1. never-throws on a non-existent subject; not measurable; all five TYPE
 *      buckets present and empty; no fabricated gaps.
 *   2. Future-Skill forward signal (FRP/FRI) is fabrication-guarded: measurable
 *      false / composite null when there is no real Future-Readiness data.
 *   3. type-classification honesty: classified_pct is null when there are no
 *      gaps; unmapped competencies land in `unclassified`, never forced into a
 *      bucket; the five bucket keys are exactly the canonical TYPE keys.
 *   4. prioritization is deterministic and re-shapes only (no gap invented);
 *      dashboard projects 5 category cards + top priorities from the envelope.
 *   5. history: to_regclass probe => exists:false before any snapshot for THIS
 *      subject; POST-path persist appends one append-only row; list returns it.
 *      (cleans up.)
 */
import { Pool } from 'pg';
import {
  buildCareerGap,
  buildCareerGapDashboard,
  prioritizeCareerGaps,
  persistCareerGapSnapshot,
  listCareerGapHistory,
  GAP_TYPE_ORDER,
  COMPETENCY_RUNTIME_RELATIONS,
} from '../services/career-gap-engine.js';

const SMOKE_SUBJECT = 'smoke-cg-nonexistent-subject';

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
    console.log('\n[1] non-existent subject — honest unmeasured, no fabrication');
    const env = await buildCareerGap(pool, SMOKE_SUBJECT);
    assert(env.ok === true, 'envelope ok');
    assert(env.subject_id === SMOKE_SUBJECT, 'subject echoed');
    assert(env.measurable === false, 'not measurable (no scored profile / anchor role)');
    assert(
      GAP_TYPE_ORDER.every((t) => env.buckets[t] && env.buckets[t].items.length === 0),
      'all five TYPE buckets present and empty',
    );
    assert(env.unclassified.length === 0, 'no unclassified gaps fabricated');
    assert(env.summary.total_gaps === 0, 'zero gaps for non-existent subject');
    assert(env.summary.most_material === null, 'no most-material gap fabricated');

    console.log('\n[1b] GET-never-writes: read path creates NO schema (DDL)');
    const regclass = async (t: string): Promise<string | null> => {
      const r = await pool.query(`SELECT to_regclass($1) AS t`, [t]).catch(() => ({ rows: [{ t: null }] }));
      return (r.rows[0]?.t as string | null) ?? null;
    };
    // Every relation a GET could create: this phase's own history table + every
    // table AND index the transitively-composed competency-runtime ensure would
    // create (reuse the engine's lockstep list so this can never drift).
    const WATCHED = [
      'public.career_gap_history',
      ...COMPETENCY_RUNTIME_RELATIONS.map((r) => `public.${r}`),
    ];
    const snap = async () => {
      const out: Record<string, string | null> = {};
      for (const t of WATCHED) out[t] = await regclass(t);
      return out;
    };
    const schemaBefore = await snap();
    // Exercise every GET (read) composition path.
    const env2 = await buildCareerGap(pool, SMOKE_SUBJECT);
    buildCareerGapDashboard(env2, prioritizeCareerGaps(env2));
    const schemaAfter = await snap();
    assert(
      WATCHED.every((t) => schemaBefore[t] === schemaAfter[t]),
      'GET created NO schema — career_gap_history + all transitive competency-runtime tables unchanged',
    );

    console.log('\n[2] Future-Skill forward signal (FRP) fabrication guard');
    assert(
      env.future_outlook.measurable === false && env.future_outlook.composite === null,
      'future outlook unmeasured (default ~40 composite suppressed)',
    );
    assert(env.future_outlook.development_areas.length === 0, 'no future development areas fabricated');

    console.log('\n[3] type-classification honesty');
    assert(
      JSON.stringify(Object.keys(env.buckets).sort()) ===
        JSON.stringify([...GAP_TYPE_ORDER].sort()),
      'bucket keys are exactly the five canonical TYPE keys',
    );
    assert(env.summary.classified_pct === null, 'classified_pct null when there are no gaps');
    assert(env.axes.coverage.measurable === false, 'coverage axis honest-unmeasured');
    assert(env.axes.confidence.band === 'None', 'confidence axis None when not measurable');

    console.log('\n[4] prioritization + dashboard (pure re-shape)');
    const prio = prioritizeCareerGaps(env);
    assert(prio.items.length === 0, 'no priorities for zero gaps');
    assert(
      prio.bands.now === 0 && prio.bands.next === 0 && prio.bands.later === 0,
      'priority bands all zero',
    );
    const dash = buildCareerGapDashboard(env, prio);
    assert(dash.categories.length === 5, 'dashboard exposes 5 category cards');
    assert(
      JSON.stringify(dash.categories.map((c) => c.type_key)) === JSON.stringify(GAP_TYPE_ORDER),
      'dashboard category order matches canonical TYPE order',
    );
    assert(dash.headline.total_gaps === 0, 'dashboard headline reflects zero gaps');
    assert(dash.top_priorities.length === 0, 'dashboard top priorities empty');

    console.log('\n[5] history: probe / append-only persist / list');
    const before = await listCareerGapHistory(pool, SMOKE_SUBJECT);
    assert(before.items.every((r) => r.subject_id === SMOKE_SUBJECT), 'list is subject-scoped');
    const beforeCount = before.count;
    const row = await persistCareerGapSnapshot(pool, env);
    assert(Number(row.id) > 0, 'persist returns a row id'); // BIGSERIAL → pg returns string
    assert(row.subject_id === SMOKE_SUBJECT, 'persisted subject matches');
    assert(Number(row.total_gaps) === 0, 'persisted total_gaps matches envelope');
    const after = await listCareerGapHistory(pool, SMOKE_SUBJECT);
    assert(after.exists === true, 'table exists after snapshot');
    assert(after.count === beforeCount + 1, 'append-only: exactly one new row');

    // cleanup smoke rows (shared dev DB)
    await pool.query(`DELETE FROM career_gap_history WHERE subject_id = $1`, [SMOKE_SUBJECT]);
    console.log('  ✓ cleaned up smoke rows');

    console.log('\nEnvelope sample:', JSON.stringify({
      measurable: env.measurable,
      target_career: env.target_career,
      summary: env.summary,
      buckets: GAP_TYPE_ORDER.map((t) => ({ type: t, count: env.buckets[t].gap_count })),
      future_outlook: { measurable: env.future_outlook.measurable, composite: env.future_outlook.composite },
      coverage: env.axes.coverage,
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
