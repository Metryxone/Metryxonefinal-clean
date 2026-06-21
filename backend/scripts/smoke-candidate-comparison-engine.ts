/**
 * PHASE 5.8 — Candidate Comparison Engine smoke test.
 *
 * Run: cd backend && FF_CANDIDATE_COMPARISON=1 npx tsx scripts/smoke-candidate-comparison-engine.ts
 *
 * Covers the full lifecycle over a REAL @example.com substrate:
 *   1. compareCandidates — composes 6 dims; score dims (competencies/EI) measurable
 *      with a leader; subject-keyed dims (readiness/signals/gaps) honestly unmeasured
 *      for employer candidates (no career-seeker substrate) — null, NEVER 0.
 *   2. Dual axes — every dimension carries a coverage AND a confidence object.
 *   3. Developmental language — comparison declares it is NOT a hire/suitability verdict.
 *   4. Job-scoping (IDOR) — a cross-job candidate is omitted into wrong_job, never mixed.
 *   5. <2 comparable -> invalid_input.
 *   6. GET-never-writes — pg_class snapshot around the READ paths proves ZERO DDL.
 *   7. Persistence — save dashboard (write) + reads, generate report (write) + reads;
 *      BIGSERIAL ids string-coerced.
 *   8. HTTP flag-OFF 503 on the running server.
 *
 * Fail-safe harness + completeness guard. Self-cleans all seeded rows.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  compareCandidates,
  saveComparisonDashboard,
  getComparisonDashboard,
  listComparisonDashboards,
  generateComparisonReport,
  getComparisonReport,
  listComparisonReports,
} from '../services/candidate-comparison-engine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`); }
}

const EMPLOYER = randomUUID();
const EMPLOYER_EMAIL = `cmp-smoke-${EMPLOYER}@example.com`;
const JOB_ID = `job_cmp_smoke_${EMPLOYER.slice(0, 8)}`;
const OTHER_JOB_ID = `job_cmp_smoke_other_${EMPLOYER.slice(0, 8)}`;
const CAND_A = `cand_cmp_A_${EMPLOYER.slice(0, 8)}`;
const CAND_B = `cand_cmp_B_${EMPLOYER.slice(0, 8)}`;
const CAND_X = `cand_cmp_X_${EMPLOYER.slice(0, 8)}`; // belongs to OTHER_JOB
const CAND_U = `cand_cmp_U_${EMPLOYER.slice(0, 8)}`; // unbound (null job_id)

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('\n=== PHASE 5.8 — Candidate Comparison smoke ===\n');

    // ── seed real substrate ───────────────────────────────────────────────────
    await pool.query(
      `INSERT INTO users (id, username, password, email, account_type)
       VALUES ($1, $2, $3, $2, 'employer') ON CONFLICT (id) DO NOTHING`,
      [EMPLOYER, EMPLOYER_EMAIL, 'x'],
    );
    await pool.query(
      `INSERT INTO employer_jobs (id, employer_id, title, status)
       VALUES ($1,$2,'Backend Engineer','open'), ($3,$2,'QA Engineer','open')
       ON CONFLICT (id) DO NOTHING`,
      [JOB_ID, EMPLOYER, OTHER_JOB_ID],
    );
    const profileA = JSON.stringify({ communication: 4, problem_solving: 5, teamwork: 3 }); // 4/5 -> 80
    const profileB = JSON.stringify({ communication: 3, leadership: 2 });                    // 2.5/5 -> 50
    const seedCand = async (id: string, job: string, name: string, ei: number | null, profile: string | null) => {
      await pool.query(
        `INSERT INTO employer_candidates (id, employer_id, job_id, name, email, ei_score, assessment_score, competency_profile)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT (id) DO NOTHING`,
        [id, EMPLOYER, job, name, `${id}@example.com`, ei, null, profile],
      );
    };
    await seedCand(CAND_A, JOB_ID, 'Alice', 80, profileA);
    await seedCand(CAND_B, JOB_ID, 'Bob', 60, profileB);
    await seedCand(CAND_X, OTHER_JOB_ID, 'Xavier', 90, profileA);
    // CAND_U: unbound (null job_id) — must NOT be comparable under any job.
    await pool.query(
      `INSERT INTO employer_candidates (id, employer_id, job_id, name, email, ei_score, assessment_score, competency_profile)
       VALUES ($1,$2,NULL,'Uma',$3,75,NULL,$4::jsonb) ON CONFLICT (id) DO NOTHING`,
      [CAND_U, EMPLOYER, `${CAND_U}@example.com`, profileA],
    );

    // ── 6. GET-never-writes guard — BEFORE any write (comparison tables absent) ─
    console.log('— GET-never-writes guard —');
    const relCount = async (): Promise<number> =>
      Number((await pool.query(`SELECT count(*)::int AS n FROM pg_class WHERE relkind IN ('r','i')`)).rows[0].n);
    const relBefore = await relCount();
    await compareCandidates(pool, JOB_ID, [CAND_A, CAND_B]);
    await listComparisonDashboards(pool, JOB_ID);
    await getComparisonDashboard(pool, '1');
    await listComparisonReports(pool, JOB_ID);
    await getComparisonReport(pool, '1');
    const relAfter = await relCount();
    check('READ paths created ZERO relations (GET-never-writes)', relAfter === relBefore, `before ${relBefore}, after ${relAfter}`);

    // ── 1. Comparison core ─────────────────────────────────────────────────────
    console.log('— Comparison —');
    const cmp = await compareCandidates(pool, JOB_ID, [CAND_A, CAND_B]);
    check('compare returns 2 candidates', cmp.ok && cmp.data.candidate_count === 2);
    if (cmp.ok) {
      const a = cmp.data.candidates.find((c) => c.candidate_id === CAND_A)!;
      const dims = a.dimensions;
      check('each candidate has all 6 dimensions', Object.keys(dims).length === 6);
      check('competencies measurable for both', cmp.data.candidates.every((c) => c.dimensions.competencies.measurable));
      check('competencies leader = A (80 > 50)', cmp.data.leaders.competencies === CAND_A);
      check('EI measurable + leader = A (80 > 60)', a.dimensions.ei.measurable && cmp.data.leaders.ei === CAND_A);

      // 2. dual axes on EVERY dimension
      const allDualAxes = (Object.values(dims) as any[]).every((d) =>
        d.coverage && typeof d.coverage.measurable === 'boolean' &&
        d.confidence && typeof d.confidence.band === 'string');
      check('every dimension carries dual axes (coverage + confidence)', allDualAxes);

      // honesty: subject-keyed dims unmeasured for employer candidates, score NEVER 0
      check('career_readiness unmeasured (measurable false, score null)', dims.career_readiness.measurable === false && dims.career_readiness.score === null);
      check('signals unmeasured (measurable false)', dims.signals.measurable === false);
      check('gaps unmeasured (measurable false)', dims.gaps.measurable === false);
      check('unmeasured dims NEVER scored 0 (score === null)', [dims.career_readiness, dims.signals, dims.gaps].every((d) => d.score === null));

      // 3. developmental language
      check('comparison declares NOT a hire/suitability verdict', /NOT a hir/i.test(cmp.data.language_policy));
      check('measurable_summary covers all 6 dimensions', cmp.data.measurable_summary.length === 6);
    }

    // ── 5. invalid input ───────────────────────────────────────────────────────
    console.log('— Invalid input —');
    const cmpOne = await compareCandidates(pool, JOB_ID, [CAND_A]);
    check('compare with <2 ids -> invalid_input', !cmpOne.ok && cmpOne.code === 'invalid_input');
    const cmpMissing = await compareCandidates(pool, JOB_ID, [CAND_A, `missing_${EMPLOYER.slice(0, 6)}`]);
    check('compare with only 1 resolvable -> invalid_input', !cmpMissing.ok && cmpMissing.code === 'invalid_input');

    // ── 4. Job-scoping (IDOR) ──────────────────────────────────────────────────
    console.log('— Job-scoping guard —');
    const cmpX = await compareCandidates(pool, JOB_ID, [CAND_A, CAND_B, CAND_X]);
    check('cross-job candidate omitted (2 remain)', cmpX.ok && cmpX.data.candidate_count === 2 && cmpX.data.candidates.every((c) => c.candidate_id !== CAND_X));
    check('cross-job candidate listed in wrong_job', cmpX.ok && cmpX.data.wrong_job.includes(CAND_X));
    const cmpU = await compareCandidates(pool, JOB_ID, [CAND_A, CAND_B, CAND_U]);
    check('unbound (null job_id) candidate omitted + in wrong_job', cmpU.ok && cmpU.data.candidate_count === 2 && cmpU.data.candidates.every((c) => c.candidate_id !== CAND_U) && cmpU.data.wrong_job.includes(CAND_U));
    const cmpUonly = await compareCandidates(pool, JOB_ID, [CAND_A, CAND_U]);
    check('only-1-bound (other unbound) -> invalid_input', !cmpUonly.ok && cmpUonly.code === 'invalid_input');

    // ── 7. Persistence: dashboard (WRITE) + reads ──────────────────────────────
    console.log('— Dashboard (write) —');
    const dash = await saveComparisonDashboard(pool, { jobId: JOB_ID, candidateIds: [CAND_A, CAND_B], name: 'A vs B', createdBy: EMPLOYER_EMAIL });
    let dashId = '';
    check('dashboard saved (numeric BIGSERIAL id, string-coerced)', dash.ok && typeof dash.data.id === 'string' && Number.isFinite(Number(dash.data.id)));
    if (dash.ok) {
      dashId = dash.data.id;
      check('dashboard returns the comparison snapshot', !!dash.data.comparison && dash.data.comparison.candidate_count === 2);
      const ld = await listComparisonDashboards(pool, JOB_ID);
      check('list dashboards includes the saved row', ld.ok && ld.data.dashboards.some((d: any) => d.id === dashId));
      const gd = await getComparisonDashboard(pool, dashId);
      check('get dashboard round-trips', gd.ok && gd.data.id === dashId && gd.data.job_id === JOB_ID);
    }

    // ── 7. Persistence: report (WRITE) + reads ─────────────────────────────────
    console.log('— Report (write) —');
    const rep = await generateComparisonReport(pool, { jobId: JOB_ID, candidateIds: [CAND_A, CAND_B], dashboardId: dashId || null, generatedBy: EMPLOYER_EMAIL });
    let repId = '';
    check('report generated (numeric BIGSERIAL id)', rep.ok && typeof rep.data.id === 'string' && Number.isFinite(Number(rep.data.id)));
    if (rep.ok) {
      repId = rep.data.id;
      check('report body covers all 6 dimensions', Array.isArray(rep.data.report.dimensions) && rep.data.report.dimensions.length === 6);
      check('report links its dashboard id', rep.data.dashboard_id === (dashId || null));
      const lr = await listComparisonReports(pool, JOB_ID);
      check('list reports includes the generated row', lr.ok && lr.data.reports.some((r: any) => r.id === repId));
      const gr = await getComparisonReport(pool, repId);
      check('get report round-trips', gr.ok && gr.data.id === repId && gr.data.job_id === JOB_ID);
    }

    // ── 8. HTTP flag gate (server flag OFF) ────────────────────────────────────
    console.log('— HTTP flag gate (server flag OFF) —');
    const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
    try {
      const r1 = await fetch(`${base}/api/candidate-comparison-engine/_meta/status`);
      check('HTTP /_meta/status flag-gated 503', r1.status === 503, `got ${r1.status}`);
      const r2 = await fetch(`${base}/api/candidate-comparison-engine/job/${encodeURIComponent(JOB_ID)}/compare?candidates=${CAND_A},${CAND_B}`);
      check('HTTP /job/:id/compare flag-gated 503', r2.status === 503, `got ${r2.status}`);
    } catch (e: any) {
      check('HTTP reachable', false, e?.message ?? 'fetch failed');
    }

    // Completeness guard.
    const EXPECTED_CHECKS = 30;
    check(`all ${EXPECTED_CHECKS} checks executed (no section skipped by exception)`, passed + failed === EXPECTED_CHECKS, `ran ${passed + failed}`);
  } catch (e: any) {
    failed++;
    console.log(`  FAIL smoke threw before completion — ${e?.message ?? e}`);
  } finally {
    await pool.query(`DELETE FROM comparison_reports WHERE job_id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM comparison_dashboard WHERE job_id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM employer_candidates WHERE id = ANY($1)`, [[CAND_A, CAND_B, CAND_X, CAND_U]]).catch(() => {});
    await pool.query(`DELETE FROM employer_jobs WHERE id IN ($1,$2)`, [JOB_ID, OTHER_JOB_ID]).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id = $1`, [EMPLOYER]).catch(() => {});
    console.log('  cleanup: removed demo reports/dashboards/candidates/jobs/users rows');
    await pool.end();
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
