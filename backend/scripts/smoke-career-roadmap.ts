/**
 * PHASE 4.5 smoke — Career Roadmap engine (engine-level, no HTTP/auth).
 *
 * Verifies the honesty contract directly against the live dev DB:
 *   1. never-throws on a non-existent subject; not measurable; empty milestones,
 *      empty development plan, no fabricated competencies.
 *   2. GET-never-writes: exercising every read composition path creates NO schema
 *      — this phase's own history table + every transitively-composed
 *      competency-runtime relation are unchanged (reuse the engine lockstep list).
 *   3. milestones always present (3 phased bands); timeline is an unmeasured,
 *      fully-disclosed estimate (null weeks) with a "not a prediction" disclaimer.
 *   4. progression honesty: unmeasured (null progression_pct), next_step null when
 *      there are no gaps; the timeline heuristic is the published constant.
 *   5. history: to_regclass probe => exists:false before any snapshot for THIS
 *      subject; POST-path persist appends one append-only row; list returns it.
 *      (cleans up.)
 */
import { Pool } from 'pg';
import {
  buildCareerRoadmap,
  generateRoadmap,
  assessCareerProgression,
  persistCareerRoadmapSnapshot,
  listCareerRoadmapHistory,
  MILESTONE_BANDS,
  WEEKS_PER_GAP_LEVEL,
} from '../services/career-roadmap-engine.js';
import {
  buildCareerGap,
  prioritizeCareerGaps,
  COMPETENCY_RUNTIME_RELATIONS,
} from '../services/career-gap-engine.js';

const SMOKE_SUBJECT = 'smoke-roadmap-nonexistent-subject';

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
    const env = await buildCareerRoadmap(pool, SMOKE_SUBJECT);
    assert(env.ok === true, 'envelope ok');
    assert(env.subject_id === SMOKE_SUBJECT, 'subject echoed');
    assert(env.measurable === false, 'not measurable (no scored profile / anchor role)');
    assert(env.milestones.length === 3, 'three phased milestones always present');
    assert(
      JSON.stringify(env.milestones.map((m) => m.band)) === JSON.stringify(MILESTONE_BANDS),
      'milestone bands in canonical now/next/later order',
    );
    assert(env.milestones.every((m) => m.competency_count === 0), 'no fabricated milestone competencies');
    assert(env.development_plan.length === 0, 'development plan empty (no gaps)');
    assert(env.summary.total_competencies === 0, 'zero competencies for non-existent subject');
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
    const env2 = await buildCareerRoadmap(pool, SMOKE_SUBJECT);
    const gapEnv = await buildCareerGap(pool, SMOKE_SUBJECT);
    generateRoadmap(gapEnv, prioritizeCareerGaps(gapEnv));
    assessCareerProgression(gapEnv, prioritizeCareerGaps(gapEnv), null, env2.timeline);
    const schemaAfter = await snap();
    assert(
      WATCHED.every((t) => schemaBefore[t] === schemaAfter[t]),
      'GET created NO schema — career_roadmap_history + all transitive competency-runtime tables unchanged',
    );

    console.log('\n[2] timeline is an unmeasured, fully-disclosed estimate');
    assert(env.timeline.measurable === false, 'timeline unmeasured (no gaps)');
    assert(env.timeline.total_estimated_weeks === null, 'no fabricated weeks');
    assert(env.timeline.total_estimated_months === null, 'no fabricated months');
    assert(/NOT a prediction/i.test(env.timeline.disclaimer), 'timeline carries a not-a-prediction disclaimer');
    assert(env.timeline.basis.includes(String(WEEKS_PER_GAP_LEVEL)), 'timeline basis discloses the heuristic constant');

    console.log('\n[3] progression honesty');
    assert(env.progression.measurable === false, 'progression unmeasured');
    assert(env.progression.progression_pct === null, 'progression_pct null (no scored role readiness)');
    assert(env.progression.stage === 'Unmeasured', 'stage Unmeasured');
    assert(env.progression.next_step === null, 'next_step null when no gaps');
    assert(
      env.progression.estimated_time_to_target.weeks === null,
      'time-to-target weeks null (unmeasured)',
    );

    console.log('\n[4] coverage/confidence axes inherited honestly');
    assert(env.axes.coverage.measurable === false, 'coverage axis honest-unmeasured');
    assert(env.axes.confidence.band === 'None', 'confidence axis None when not measurable');
    assert(env.future_outlook.measurable === false, 'future outlook unmeasured (FRP default suppressed)');

    console.log('\n[5] history: probe / append-only persist / list');
    const before = await listCareerRoadmapHistory(pool, SMOKE_SUBJECT);
    assert(before.items.every((r) => r.subject_id === SMOKE_SUBJECT), 'list is subject-scoped');
    const beforeCount = before.count;
    const row = await persistCareerRoadmapSnapshot(pool, env);
    assert(Number(row.id) > 0, 'persist returns a row id'); // BIGSERIAL → pg returns string
    assert(row.subject_id === SMOKE_SUBJECT, 'persisted subject matches');
    assert(Number(row.total_competencies) === 0, 'persisted total_competencies matches envelope');
    const after = await listCareerRoadmapHistory(pool, SMOKE_SUBJECT);
    assert(after.exists === true, 'table exists after snapshot');
    assert(after.count === beforeCount + 1, 'append-only: exactly one new row');

    // cleanup smoke rows (shared dev DB)
    await pool.query(`DELETE FROM career_roadmap_history WHERE subject_id = $1`, [SMOKE_SUBJECT]);
    console.log('  ✓ cleaned up smoke rows');

    console.log('\nEnvelope sample:', JSON.stringify({
      measurable: env.measurable,
      target_role: env.target_role,
      summary: env.summary,
      milestones: env.milestones.map((m) => ({ band: m.band, count: m.competency_count, weeks: m.estimated_weeks })),
      timeline: { measurable: env.timeline.measurable, weeks: env.timeline.total_estimated_weeks },
      progression: { measurable: env.progression.measurable, pct: env.progression.progression_pct, stage: env.progression.stage },
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
