/**
 * MX-100X PHASE 9 — Enterprise Workforce Console smoke test.
 *
 * Two axes:
 *   A) Pure-engine contract (flag-independent): every view never throws and returns the honest
 *      envelope shape; trends abstain below MIN_TREND_POINTS (no fabricated slope); cohort
 *      aggregates suppress below k=30; abstained views carry a reason and never fabricate.
 *   B) HTTP flag-OFF contract: the Backend API workflow runs with `enterpriseWorkforceConsole` OFF,
 *      so each route must return one of {401, 403, 503} (never 200/500). Flag gate fires first → 503.
 *
 * Run: cd backend && npx tsx scripts/smoke-enterprise-workforce-console.ts
 */
import { Pool } from 'pg';
import {
  MIN_TREND_POINTS,
  K_MIN,
  DEFAULT_ORG_ID,
  consoleOverview,
  skillGapView,
  successionView,
  mobilityView,
  workforcePlanningView,
  talentRiskView,
  talentForecastingView,
  readinessForecastingView,
  type ConsoleView,
} from '../services/enterprise-workforce-console';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:8080';
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function httpStatus(method: string, path: string): Promise<number> {
  try {
    const res = await fetch(`${BASE}${path}`, { method });
    return res.status;
  } catch {
    return 0;
  }
}

function isEnvelope(v: ConsoleView): boolean {
  return (
    typeof v === 'object' && v != null &&
    typeof v.view === 'string' &&
    typeof v.available === 'boolean' &&
    typeof v.abstained === 'boolean' &&
    (v.reason === null || typeof v.reason === 'string') &&
    typeof v.provenance === 'object' && Array.isArray(v.provenance.engines) && Array.isArray(v.provenance.tables) &&
    'data' in v
  );
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('\n[A] Pure-engine contract (flag-independent)');

    const skillGap = await skillGapView(pool, DEFAULT_ORG_ID);
    const succession = await successionView(pool, DEFAULT_ORG_ID);
    const mobility = await mobilityView(pool, DEFAULT_ORG_ID);
    const planning = await workforcePlanningView(pool, DEFAULT_ORG_ID);
    const risk = await talentRiskView(pool, DEFAULT_ORG_ID);
    const talentFc = await talentForecastingView(pool);
    const readinessFc = await readinessForecastingView(pool, DEFAULT_ORG_ID);
    const all: Array<[string, ConsoleView]> = [
      ['skill-gap', skillGap], ['succession', succession], ['internal-mobility', mobility],
      ['workforce-planning', planning], ['talent-risk', risk],
      ['talent-forecasting', talentFc], ['readiness-forecasting', readinessFc],
    ];

    for (const [name, v] of all) {
      check(`${name} returns honest envelope`, isEnvelope(v), JSON.stringify(Object.keys(v)));
      check(`${name} consistency (available XOR abstained)`, v.available !== v.abstained);
      if (v.abstained) check(`${name} abstained carries a reason`, typeof v.reason === 'string' && v.reason.length > 0);
    }

    // Overview folds all 7.
    const overview = await consoleOverview(pool, DEFAULT_ORG_ID);
    check('overview folds exactly 7 views', Object.keys(overview.views).length === 7, JSON.stringify(Object.keys(overview.views)));
    check('overview summary totals add up', overview.summary.available + overview.summary.abstained === overview.summary.total_views);
    check('overview carries developmental-signal disclaimer', /NOT a hiring/.test(overview.disclaimer));

    // Forecast honesty: every emitted trend has >= MIN_TREND_POINTS; every abstained one has no slope.
    const tf = talentFc.data as any;
    const trends = Object.values(tf.trends) as any[];
    check('talent-forecasting: available trends all have >= MIN_TREND_POINTS',
      trends.filter((t) => t.available).every((t) => t.points >= MIN_TREND_POINTS),
      JSON.stringify(trends.map((t) => ({ p: t.points, a: t.available }))));
    check('talent-forecasting: abstained trends emit NO slope (no fabrication)',
      trends.filter((t) => t.abstained).every((t) => t.slope === null && t.direction === null && t.forecast_next === null));

    const rf = readinessFc.data as any;
    check('readiness-forecasting: available subject trends all have >= MIN_TREND_POINTS',
      (rf.subject_trends as any[]).filter((t) => t.available).every((t) => t.points >= MIN_TREND_POINTS));
    check('readiness-forecasting: abstained subject trends emit NO slope',
      (rf.subject_trends as any[]).filter((t) => t.abstained).every((t) => t.slope === null && t.forecast_next === null));

    // k-anonymity: with < k=30 distinct people, the cohort aggregate MUST be suppressed.
    const mob = mobility.data as any;
    if (mob.distinct_people < K_MIN) {
      check('internal-mobility cohort suppressed below k=30', mob.cohort_suppressed === true && mob.cohort_avg_mobility_alignment === null);
    }
    if (rf.distinct_subjects < K_MIN) {
      check('readiness-forecasting cohort suppressed below k=30', rf.cohort_suppressed === true && rf.cohort_latest_readiness_avg === null);
    }

    // HONESTY regression: m5 readiness() returns readiness_score:0 + departments:[] when no dept rows.
    // The console must NOT surface that fabricated 0 — enterprise_readiness is null unless dept evidence exists.
    const entMeasurable = rf.enterprise_readiness_measurable === true;
    const entVal = rf.enterprise_readiness;
    check('readiness-forecasting: enterprise readiness null unless department evidence exists',
      entMeasurable ? entVal != null : entVal === null,
      JSON.stringify({ measurable: entMeasurable, value: entVal }));
    check('readiness-forecasting: never surfaces a fabricated 0 readiness',
      !(entVal != null && (entVal.readiness_score === 0 || entVal.readiness_score == null) && (!Array.isArray(entVal.departments) || entVal.departments.length === 0)),
      JSON.stringify(entVal));

    console.log('\n[B] HTTP flag-OFF contract (expect 401/403/503, never 200/500)');
    const ok = new Set([401, 403, 503]);
    const endpoints: Array<[string, string]> = [
      ['GET', '/api/enterprise-workforce/_meta/status'],
      ['GET', '/api/enterprise-workforce/overview'],
      ['GET', '/api/enterprise-workforce/skill-gap'],
      ['GET', '/api/enterprise-workforce/succession'],
      ['GET', '/api/enterprise-workforce/mobility'],
      ['GET', '/api/enterprise-workforce/workforce-planning'],
      ['GET', '/api/enterprise-workforce/talent-risk'],
      ['GET', '/api/enterprise-workforce/talent-forecasting'],
      ['GET', '/api/enterprise-workforce/readiness-forecasting'],
    ];
    for (const [m, p] of endpoints) {
      const s = await httpStatus(m, p);
      check(`${m} ${p} gated`, ok.has(s), `got ${s}`);
    }

    console.log(`\n[smoke] ${passed} passed, ${failed} failed`);
    process.exitCode = failed === 0 ? 0 : 1;
  } catch (err) {
    console.error('[smoke] FATAL:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main();
