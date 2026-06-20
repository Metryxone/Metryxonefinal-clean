/**
 * PHASE 4.2 smoke — Career Match engine (engine-level, no HTTP/auth).
 *
 * Verifies the honesty contract directly against the live dev DB:
 *   1. never-throws on a non-existent subject; not measurable; zero matches; no
 *      fabricated role / number / requirement; anchor honestly empty.
 *   2. GET-never-writes: the read path creates NO schema (career_matching_rules +
 *      career_match_history + every transitive competency-runtime relation
 *      unchanged before/after a buildCareerMatch + dashboard + per-role read).
 *   3. config-as-data: getMatchingRules returns the inline DEFAULTS when no table/
 *      row exists; weights/caps/thresholds/templates are present; loader probes.
 *   4. per-role fit: buildCareerMatchForRole on a non-existent subject is honest
 *      (role_fit null OR not measurable; never a fabricated match).
 *   5. Match% vs Confidence are SEPARATE axes; not-measurable => confidence None.
 *   6. history: to_regclass probe => exists:false before any snapshot for THIS
 *      subject; POST-path persist appends one append-only row; list returns it.
 *      (cleans up.)
 */
import { Pool } from 'pg';
import {
  buildCareerMatch,
  buildCareerMatchForRole,
  buildCareerMatchDashboard,
  getMatchingRules,
  persistCareerMatchSnapshot,
  listCareerMatchHistory,
  DEFAULT_MATCHING_RULES,
} from '../services/career-match-engine.js';
import { FIT_COMPONENT_ORDER } from '../services/career-fit-engine.js';
import { COMPETENCY_RUNTIME_RELATIONS } from '../services/career-gap-engine.js';

const SMOKE_SUBJECT = 'smoke-cm-nonexistent-subject';

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
    const env = await buildCareerMatch(pool, SMOKE_SUBJECT);
    assert(env.ok === true, 'envelope ok');
    assert(env.subject_id === SMOKE_SUBJECT, 'subject echoed');
    assert(env.measurable === false, 'not measurable (no competency/readiness/EI signal)');
    assert(env.matches.length === 0, 'zero matches for non-existent subject');
    assert(env.summary.matches_returned === 0, 'summary matches_returned zero');
    assert(env.summary.top_match === null, 'no top match fabricated');
    assert(env.anchor.role_title === null, 'no anchor role fabricated');
    assert(env.anchor.competency_fit_score === null, 'no anchor requirement fit fabricated');

    console.log('\n[1b] GET-never-writes: read path creates NO schema (DDL)');
    const regclass = async (t: string): Promise<string | null> => {
      const r = await pool.query(`SELECT to_regclass($1) AS t`, [t]).catch(() => ({ rows: [{ t: null }] }));
      return (r.rows[0]?.t as string | null) ?? null;
    };
    const WATCHED = [
      'public.career_matching_rules',
      'public.career_match_history',
      ...COMPETENCY_RUNTIME_RELATIONS.map((r) => `public.${r}`),
    ];
    const snap = async () => {
      const out: Record<string, string | null> = {};
      for (const t of WATCHED) out[t] = await regclass(t);
      return out;
    };
    const schemaBefore = await snap();
    const env2 = await buildCareerMatch(pool, SMOKE_SUBJECT);
    buildCareerMatchDashboard(env2);
    await buildCareerMatchForRole(pool, SMOKE_SUBJECT, 1);
    await getMatchingRules(pool);
    const schemaAfter = await snap();
    assert(
      WATCHED.every((t) => schemaBefore[t] === schemaAfter[t]),
      'GET created NO schema — career_matching_rules + career_match_history + all transitive competency-runtime tables unchanged',
    );

    console.log('\n[2] config-as-data: defaults fallback + shape');
    const rules = await getMatchingRules(pool);
    assert(rules.rules.weights != null && rules.rules.caps != null, 'rules expose weights + caps');
    assert(rules.rules.thresholds != null && rules.rules.templates != null, 'rules expose thresholds + templates');
    assert(
      FIT_COMPONENT_ORDER.every((k) => typeof rules.rules.weights[k] === 'number'),
      'every fit component has a weight',
    );
    assert(
      typeof DEFAULT_MATCHING_RULES.caps.top_n === 'number' && DEFAULT_MATCHING_RULES.caps.top_n > 0,
      'default top_n is a positive number',
    );
    assert(
      DEFAULT_MATCHING_RULES.caps.max_non_anchor_confidence === 'Provisional',
      'non-anchor confidence ceiling is Provisional (honest)',
    );

    console.log('\n[3] per-role fit honesty (non-existent subject)');
    const single = await buildCareerMatchForRole(pool, SMOKE_SUBJECT, 1);
    assert(
      single.role_fit === null || single.role_fit.measurable === false,
      'per-role fit is honest (null or not measurable) — no fabricated match',
    );
    assert(single.envelope_summary.measurable === false, 'per-role summary not measurable');

    console.log('\n[4] Match% vs Confidence are SEPARATE axes');
    assert(env.axes.confidence.band === 'None', 'confidence axis None when not measurable');
    assert(env.axes.coverage.measurable === false, 'coverage axis honest-unmeasured');
    assert(env.summary.requirement_backed_count === 0, 'no requirement-backed matches fabricated');

    console.log('\n[5] history: probe / append-only persist / list');
    const before = await listCareerMatchHistory(pool, SMOKE_SUBJECT);
    assert(before.items.every((r) => r.subject_id === SMOKE_SUBJECT), 'list is subject-scoped');
    const beforeCount = before.count;
    const row = await persistCareerMatchSnapshot(pool, env);
    assert(Number(row.id) > 0, 'persist returns a row id');
    assert(row.subject_id === SMOKE_SUBJECT, 'persisted subject matches');
    assert(Number(row.matches_returned) === 0, 'persisted matches_returned matches envelope');
    const after = await listCareerMatchHistory(pool, SMOKE_SUBJECT);
    assert(after.exists === true, 'table exists after snapshot');
    assert(after.count === beforeCount + 1, 'append-only: exactly one new row');

    // cleanup smoke rows (shared dev DB)
    await pool.query(`DELETE FROM career_match_history WHERE subject_id = $1`, [SMOKE_SUBJECT]);
    console.log('  ✓ cleaned up smoke rows');

    console.log('\nEnvelope sample:', JSON.stringify({
      measurable: env.measurable,
      anchor: env.anchor,
      summary: env.summary,
      coverage: env.axes.coverage,
      confidence: env.axes.confidence,
      config: env.config,
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
