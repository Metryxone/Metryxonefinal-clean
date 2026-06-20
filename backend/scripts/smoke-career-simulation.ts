/**
 * PHASE 4.8 smoke — Career Simulation engine (engine-level, no HTTP/auth).
 *
 * Verifies the honesty contract directly against the live dev DB:
 *   1. never-throws on a non-existent subject; not measurable; no roles
 *      unlocked/improved/regressed; no fabricated levels; axes honest-None.
 *   2. GET-never-writes: the read composition path creates NO schema — neither
 *      this phase's own career_simulation_runs nor any transitively-composed
 *      competency-runtime OR role-profile table/index.
 *   3. Future projection fabrication guard: with < 2 snapshots nothing is
 *      projectable, projected_levels is empty, and the trajectory simulation
 *      equals baseline (no forward level invented).
 *   4. Scenario set: all four preset scenarios present; deterministic; with no
 *      measured baseline they are honestly not-applicable / unmeasurable; best
 *      is null when nothing improves.
 *   5. history: to_regclass probe => honest empty before any snapshot for THIS
 *      subject; POST-path persist appends one append-only row; list returns it.
 *      (cleans up.)
 */
import { Pool } from 'pg';
import {
  buildCareerSimulation,
  loadSimulationContext,
  ROLE_PROFILE_RELATIONS,
} from '../services/career-simulation-engine.js';
import {
  buildFutureProjection,
  simulateFutureTrajectory,
} from '../services/future-projection-engine.js';
import {
  buildScenarioSet,
  persistWhatIfRun,
  listSimulationHistory,
} from '../services/scenario-engine.js';
import { COMPETENCY_RUNTIME_RELATIONS } from '../services/career-gap-engine.js';

const SMOKE_SUBJECT = 'smoke-csim-nonexistent-subject';
const SCENARIO_KEYS = ['close_top_gap', 'all_domains_plus_one', 'reach_proficient', 'trajectory_continues'];

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
    const env = await buildCareerSimulation(pool, SMOKE_SUBJECT);
    assert(env.ok === true, 'envelope ok');
    assert(env.subject_id === SMOKE_SUBJECT, 'subject echoed');
    assert(env.measurable === false, 'not measurable (no scored profile)');
    assert(env.summary.unlocked_count === 0, 'no roles unlocked');
    assert(env.summary.improved_count === 0, 'no roles improved');
    assert(env.summary.regressed_count === 0, 'no roles regressed');
    assert(env.summary.mean_readiness_delta === null, 'no mean delta fabricated');
    assert(env.changes_applied.length === 0, 'no changes applied (none requested)');
    assert(env.axes.coverage.measurable === false, 'coverage axis honest-unmeasured');
    assert(env.axes.confidence.band === 'None', 'confidence axis None when not measurable');

    console.log('\n[1b] GET-never-writes: read path creates NO schema (DDL)');
    const regclass = async (t: string): Promise<string | null> => {
      const r = await pool.query(`SELECT to_regclass($1) AS t`, [t]).catch(() => ({ rows: [{ t: null }] }));
      return (r.rows[0]?.t as string | null) ?? null;
    };
    // Every relation a GET could create: this phase's own runs table + every
    // table AND index the transitively-composed competency-runtime ensure would
    // create + the role-profile relations the simulation probes (reuse the
    // engines' lockstep lists so this can never drift).
    const WATCHED = [
      'public.career_simulation_runs',
      ...COMPETENCY_RUNTIME_RELATIONS.map((r) => `public.${r}`),
      ...ROLE_PROFILE_RELATIONS.map((r) => `public.${r}`),
    ];
    const snap = async () => {
      const out: Record<string, string | null> = {};
      for (const t of WATCHED) out[t] = await regclass(t);
      return out;
    };
    const schemaBefore = await snap();
    // Exercise every GET (read) composition path.
    await buildCareerSimulation(pool, SMOKE_SUBJECT, [{ target: 'dom_cognitive', to_level: 5 }]);
    await loadSimulationContext(pool, SMOKE_SUBJECT);
    await buildFutureProjection(pool, SMOKE_SUBJECT);
    await simulateFutureTrajectory(pool, SMOKE_SUBJECT);
    await buildScenarioSet(pool, SMOKE_SUBJECT);
    await listSimulationHistory(pool, SMOKE_SUBJECT);
    const schemaAfter = await snap();
    assert(
      WATCHED.every((t) => schemaBefore[t] === schemaAfter[t]),
      'GET created NO schema — runs table + all transitive competency-runtime & role-profile relations unchanged',
    );

    console.log('\n[2] future projection fabrication guard (< 2 snapshots)');
    const proj = await buildFutureProjection(pool, SMOKE_SUBJECT);
    assert(proj.ok === true, 'projection never-throws');
    assert(proj.measurable === false, 'projection not measurable for non-existent subject');
    assert(Object.keys(proj.projected_levels).length === 0, 'no projected levels fabricated');
    assert(
      proj.domains.every((d) => d.projectable === false && d.projected_level === null),
      'no domain projectable; no forward level invented',
    );
    const traj = await simulateFutureTrajectory(pool, SMOKE_SUBJECT);
    assert(traj.simulation.changes_applied.length === 0, 'trajectory simulation equals baseline (no changes)');
    assert(traj.simulation.summary.unlocked_count === 0, 'trajectory unlocks nothing on empty baseline');

    console.log('\n[3] scenario set — all presets present, deterministic, honest');
    const set = await buildScenarioSet(pool, SMOKE_SUBJECT);
    assert(set.ok === true, 'scenario set never-throws');
    assert(set.measurable === false, 'scenario set not measurable (no baseline)');
    assert(
      JSON.stringify(set.scenarios.map((s) => s.key).sort()) === JSON.stringify([...SCENARIO_KEYS].sort()),
      'all four preset scenarios present',
    );
    assert(
      set.scenarios.every((s) => s.unlocked_count === 0 && (s.mean_readiness_delta === null || s.mean_readiness_delta === 0)),
      'no scenario unlocks/improves anything on empty baseline',
    );
    assert(set.best === null, 'best scenario null when nothing improves');
    assert(set.baseline.measured_domains === 0, 'baseline reports zero measured domains');
    // determinism: same input => identical ranking + counts
    const set2 = await buildScenarioSet(pool, SMOKE_SUBJECT);
    assert(
      JSON.stringify(set.scenarios.map((s) => [s.key, s.unlocked_count])) ===
        JSON.stringify(set2.scenarios.map((s) => [s.key, s.unlocked_count])),
      'scenario ranking is deterministic',
    );

    console.log('\n[4] history: probe / append-only persist / list');
    const before = await listSimulationHistory(pool, SMOKE_SUBJECT);
    assert(before.items.every((r) => r.subject_id === SMOKE_SUBJECT), 'list is subject-scoped');
    const beforeCount = before.count;
    const row = await persistWhatIfRun(pool, env);
    assert(Number(row.id) > 0, 'persist returns a row id'); // BIGSERIAL → pg returns string
    assert(row.subject_id === SMOKE_SUBJECT, 'persisted subject matches');
    assert(row.kind === 'what_if', 'persisted kind is what_if');
    assert(Number(row.unlocked_count) === 0, 'persisted unlocked_count matches envelope');
    const after = await listSimulationHistory(pool, SMOKE_SUBJECT);
    assert(after.exists === true, 'table exists after snapshot');
    assert(after.count === beforeCount + 1, 'append-only: exactly one new row');

    // cleanup smoke rows (shared dev DB)
    await pool.query(`DELETE FROM career_simulation_runs WHERE subject_id = $1`, [SMOKE_SUBJECT]);
    console.log('  ✓ cleaned up smoke rows');

    console.log('\nEnvelope sample:', JSON.stringify({
      measurable: env.measurable,
      roles_evaluated: env.roles_evaluated,
      summary: env.summary,
      coverage: env.axes.coverage,
      scenarios: set.scenarios.map((s) => ({ key: s.key, applicable: s.applicable, unlocked: s.unlocked_count })),
      projection: { measurable: proj.measurable, projected: Object.keys(proj.projected_levels).length },
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
