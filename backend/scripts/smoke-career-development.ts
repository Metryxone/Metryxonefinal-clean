/**
 * PHASE 4.6 smoke — Career Development engine (engine-level, no HTTP/auth).
 *
 * Verifies the honesty contract directly against the live dev DB:
 *   1. never-throws on a non-existent subject; not measurable; five development
 *      streams always present (empty), no fabricated competencies or actions.
 *   2. GET-never-writes: exercising every read composition path creates NO schema
 *      — this phase's own history table + every transitively-composed
 *      competency-runtime relation are unchanged (reuse the engine lockstep list).
 *   3. streams: exactly the five canonical competency TYPES, requested order; NO
 *      standalone "leadership" stream; taxonomy_note discloses the divergence.
 *   4. tracking: insufficient_history (no baseline) before any snapshot; honest
 *      zeroed gap-points; never fabricates a trend.
 *   5. history: to_regclass probe => exists:false before any snapshot for THIS
 *      subject; POST-path persist appends one append-only row; a SECOND snapshot
 *      establishes a baseline so tracking reports a real (stable) trend. (cleans up.)
 */
import { Pool } from 'pg';
import {
  buildCareerDevelopment,
  generateDevelopmentPlan,
  trackDevelopment,
  persistCareerDevelopmentSnapshot,
  listCareerDevelopmentHistory,
  DEV_STREAM_ORDER,
  DEV_STREAM_LABELS,
  TAXONOMY_NOTE,
} from '../services/career-development-engine.js';
import { buildCareerRoadmap } from '../services/career-roadmap-engine.js';
import { COMPETENCY_RUNTIME_RELATIONS } from '../services/career-gap-engine.js';

const SMOKE_SUBJECT = 'smoke-development-nonexistent-subject';

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
    const env = await buildCareerDevelopment(pool, SMOKE_SUBJECT);
    assert(env.ok === true, 'envelope ok');
    assert(env.subject_id === SMOKE_SUBJECT, 'subject echoed');
    assert(env.measurable === false, 'not measurable (no scored profile / anchor role)');
    assert(env.development_plan.streams.length === 5, 'five development streams always present');
    assert(env.development_plan.streams.every((s) => s.competency_count === 0), 'no fabricated stream competencies');
    assert(env.development_plan.unclassified.length === 0, 'no unclassified items fabricated');
    assert(env.summary.total_competencies === 0, 'zero competencies for non-existent subject');
    assert(env.summary.most_material_stream === null, 'no most-material stream fabricated');

    console.log('\n[1b] GET-never-writes: read path creates NO schema (DDL)');
    const regclass = async (t: string): Promise<string | null> => {
      const r = await pool.query(`SELECT to_regclass($1) AS t`, [t]).catch(() => ({ rows: [{ t: null }] }));
      return (r.rows[0]?.t as string | null) ?? null;
    };
    // Every relation a GET could create: this phase's own history table + every
    // table AND index the transitively-composed competency-runtime ensure would
    // create (reuse the engine's lockstep list so this can never drift).
    const WATCHED = [
      'public.career_development_history',
      'public.career_roadmap_history',
      ...COMPETENCY_RUNTIME_RELATIONS.map((r) => `public.${r}`),
    ];
    const snap = async () => {
      const out: Record<string, string | null> = {};
      for (const t of WATCHED) out[t] = await regclass(t);
      return out;
    };
    const schemaBefore = await snap();
    // Exercise every GET (read) composition path.
    const roadmap = await buildCareerRoadmap(pool, SMOKE_SUBJECT);
    generateDevelopmentPlan(roadmap);
    await buildCareerDevelopment(pool, SMOKE_SUBJECT);
    const schemaAfter = await snap();
    assert(
      WATCHED.every((t) => schemaBefore[t] === schemaAfter[t]),
      'GET created NO schema — career_development_history + all transitive competency-runtime tables unchanged',
    );

    console.log('\n[3] streams = the five canonical TYPES, no fabricated Leadership stream');
    assert(
      JSON.stringify(env.development_plan.streams.map((s) => s.type_key)) === JSON.stringify(DEV_STREAM_ORDER),
      'stream order matches DEV_STREAM_ORDER (behavioral, technical, functional, cognitive, future_skills)',
    );
    assert(
      env.development_plan.streams.every((s) => s.label === DEV_STREAM_LABELS[s.type_key]),
      'each stream carries its canonical development label',
    );
    assert(
      !env.development_plan.streams.some((s) => String(s.type_key) === 'leadership'),
      'NO standalone "leadership" stream fabricated',
    );
    assert(env.taxonomy_note === TAXONOMY_NOTE, 'taxonomy_note discloses the Leadership-vs-ontology divergence');
    assert(/Leadership/i.test(env.taxonomy_note), 'taxonomy_note explicitly addresses Leadership');

    console.log('\n[4] tracking honesty — insufficient_history with no baseline');
    assert(env.tracking.has_baseline === false, 'no baseline before any snapshot');
    assert(
      env.tracking.streams.every((s) => s.trend === 'insufficient_history' && s.prior_gap_points === null),
      'every stream trend is insufficient_history (no prior)',
    );
    assert(env.tracking.overall.trend === 'insufficient_history', 'overall trend insufficient_history');
    assert(env.tracking.overall.delta_gap_points === null, 'no fabricated overall delta');

    console.log('\n[4b] trackDevelopment is pure: a synthetic prior baseline yields a real trend');
    const plan = generateDevelopmentPlan(roadmap);
    const synthPrior = { measurable: false, streams: {} as Record<string, number> };
    for (const s of plan.streams) synthPrior.streams[s.type_key] = s.total_gap_points; // identical => stable
    const tracked = trackDevelopment(plan, synthPrior);
    assert(tracked.has_baseline === true, 'baseline present with a prior');
    assert(
      tracked.streams.every((s) => s.trend === 'stable' && s.delta_gap_points === 0),
      'identical prior => every stream stable, delta 0',
    );

    console.log('\n[5] coverage/confidence axes inherited honestly');
    assert(env.axes.coverage.measurable === false, 'coverage axis honest-unmeasured');
    assert(env.axes.confidence.band === 'None', 'confidence axis None when not measurable');
    assert(env.future_outlook.measurable === false, 'future outlook unmeasured (FRP default suppressed)');
    assert(env.timeline.measurable === false, 'timeline unmeasured (no gaps)');
    assert(/NOT a prediction/i.test(env.timeline.disclaimer), 'timeline carries a not-a-prediction disclaimer');

    console.log('\n[6] history: probe / append-only persist / baseline tracking');
    const before = await listCareerDevelopmentHistory(pool, SMOKE_SUBJECT);
    assert(before.items.every((r) => r.subject_id === SMOKE_SUBJECT), 'list is subject-scoped');
    const beforeCount = before.count;
    const row = await persistCareerDevelopmentSnapshot(pool, env);
    assert(Number(row.id) > 0, 'persist returns a row id'); // BIGSERIAL → pg returns string
    assert(row.subject_id === SMOKE_SUBJECT, 'persisted subject matches');
    assert(Number(row.total_competencies) === 0, 'persisted total_competencies matches envelope');
    const after = await listCareerDevelopmentHistory(pool, SMOKE_SUBJECT);
    assert(after.exists === true, 'table exists after snapshot');
    assert(after.count === beforeCount + 1, 'append-only: exactly one new row');

    // After a snapshot exists, a fresh build reads the baseline => real (stable) trend.
    const env2 = await buildCareerDevelopment(pool, SMOKE_SUBJECT);
    assert(env2.tracking.has_baseline === true, 'baseline read from persisted snapshot');
    assert(env2.tracking.overall.trend === 'stable', 'overall trend stable vs identical baseline');

    // cleanup smoke rows (shared dev DB)
    await pool.query(`DELETE FROM career_development_history WHERE subject_id = $1`, [SMOKE_SUBJECT]);
    console.log('  ✓ cleaned up smoke rows');

    console.log('\nEnvelope sample:', JSON.stringify({
      measurable: env.measurable,
      target_role: env.target_role,
      summary: env.summary,
      streams: env.development_plan.streams.map((s) => ({ type: s.type_key, count: s.competency_count, weeks: s.estimated_weeks })),
      tracking: { has_baseline: env.tracking.has_baseline, overall: env.tracking.overall.trend },
      taxonomy_note: env.taxonomy_note.slice(0, 60) + '…',
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
