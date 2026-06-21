/**
 * PHASE 5.6 — Employability Matching Engine smoke test.
 *
 * Run: cd backend && FF_EMPLOYABILITY_MATCHING=1 npx tsx scripts/smoke-employability-matching-engine.ts
 *
 * Covers:
 *   1. The three PURE derivation engines over synthetic PassportContexts:
 *        - Hiring Readiness: prefers the readiness composite; falls back to EI;
 *          honest-unmeasured when neither exists.
 *        - Job Readiness: role-specific; unmeasured with no anchor role.
 *        - Employer Fit: directional EI×role mean, provisional confidence ceiling,
 *          band capped DOWN by a high-severity EI critical risk.
 *   2. Integration buildEmployabilityMatch against a REAL @example.com subject
 *      (seeded career_seeker_profiles row) — never-throws, well-formed, honest
 *      inputs provenance; a pre/post pg_class snapshot proves ZERO DDL.
 *   3. HTTP flag-OFF 503 on the running server.
 *
 * Self-cleans the seeded @example.com row.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import {
  buildEmployabilityMatch,
  computeHiringReadiness,
  computeJobReadiness,
  computeEmployerFit,
} from '../services/employability-matching-engine';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

// subject = a real users.id (uuid); career_seeker_profiles.user_id has an FK to users.id.
const SUBJECT = randomUUID();
const SUBJECT_EMAIL = `emp-match-smoke-${SUBJECT}@example.com`;

// --- synthetic substrate builders (cast to PassportContext; tsx is untyped) ---
function ctx(parts: any): any {
  return {
    subject_id: 'synthetic',
    runtimeReady: true,
    competencyProfile: null,
    eiProfile: null,
    readiness: null,
    careerProfile: { exists: false, data: null },
    journeyEvents: [],
    notes: [],
    ...parts,
  };
}

function ei(overallScore: number | null, opts: any = {}): any {
  const measurable = overallScore != null;
  return {
    ok: true,
    overall_ei: {
      measurable,
      ei_score: overallScore,
      band: overallScore != null && overallScore >= 80 ? 'Advanced' : 'Proficient',
      coverage_pct: opts.coverage_pct ?? 90,
      confidence: { band: opts.conf ?? 'High' },
    },
    coverage: { dimensions_total: 8, dimensions_measurable: opts.dims ?? 7, coverage_pct: opts.coverage_pct ?? 90 },
    critical_risks: opts.critical_risks ?? [],
    language_policy: { allowed: [], disallowed: [] },
  };
}

function roleBlock(score: number | null): any {
  const measurable = score != null;
  return {
    type: 'role',
    label: 'Role Readiness',
    measurable,
    score,
    band: measurable ? 'Proficient' : 'Unmeasured',
    axes: {
      coverage: { measurable, coverage_pct: measurable ? 80 : null, detail: 'role coverage' },
      confidence: { band: measurable ? 'Moderate' : 'None', value: measurable ? 0.6 : null, basis: 'role conf', caps: [] },
    },
    detail: { role_title: 'Backend Engineer' },
    notes: [],
  };
}

function readiness(overallScore: number | null, role: any, contributing: string[]): any {
  const measurable = overallScore != null;
  return {
    ok: true,
    measurable: measurable || !!role?.measurable,
    overall: {
      measurable,
      score: overallScore,
      band: 'Proficient',
      contributing,
      basis: `mean of ${contributing.length} measurable present-readiness block(s)`,
    },
    current: { type: 'current', measurable: true, score: overallScore ?? 70 },
    future: { type: 'future', measurable: true, score: overallScore ?? 70 },
    role,
    growth: { type: 'growth', measurable: false, score: null },
  };
}

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('\n=== PHASE 5.6 — Employability Matching Engine smoke ===\n');
    console.log('— pure derivation engines (synthetic contexts) —');

    // Scenario A: full measurable, strong.
    const A = ctx({
      eiProfile: ei(82),
      readiness: readiness(78, roleBlock(75), ['current', 'future', 'role']),
      careerProfile: { exists: true, data: { target_occupation: 'Senior Backend Engineer' } },
    });
    const hA = computeHiringReadiness(A);
    check('A hiring uses readiness composite (78)', hA.measurable && hA.score === 78, `score ${hA.score}`);
    check('A hiring coverage 100% (3/3 blocks)', hA.axes.coverage.coverage_pct === 100);
    check('A hiring 3 drivers', hA.drivers.length === 3);
    const jA = computeJobReadiness(A);
    check('A job readiness from role block (75)', jA.measurable && jA.score === 75, `score ${jA.score}`);
    const fA = computeEmployerFit(A);
    check('A employer fit = mean(82,75)=78.5', fA.measurable && fA.score === 78.5, `score ${fA.score}`);
    check('A employer fit confidence ceiling Moderate (EI High capped)', fA.axes.confidence.band === 'Moderate');
    check('A employer fit always-provisional cap present', fA.axes.confidence.caps.some((c) => c.includes('provisional')));
    check('A employer fit NOT critical-capped (no high risk)', fA.band === 'Proficient');

    // Scenario B: high-severity critical risk caps Employer Fit band DOWN.
    const B = ctx({
      eiProfile: ei(82, { critical_risks: [{ type: 'low_readiness', severity: 'high', dimension_name: 'Resilience' }] }),
      readiness: readiness(78, roleBlock(75), ['current', 'future', 'role']),
    });
    const fB = computeEmployerFit(B);
    check('B employer fit raw still 78.5', fB.score === 78.5, `score ${fB.score}`);
    check('B employer fit band capped to Developing by high risk', fB.band === 'Developing', `band ${fB.band}`);
    check('B employer fit cap reason names the risk count', fB.axes.confidence.caps.some((c) => c.includes('high-severity')));

    // Scenario C: readiness composite NOT measurable -> Hiring falls back to EI.
    const C = ctx({
      eiProfile: ei(65),
      readiness: readiness(null, roleBlock(null), []),
    });
    const hC = computeHiringReadiness(C);
    check('C hiring falls back to EI overall (65)', hC.measurable && hC.score === 65, `score ${hC.score}`);
    check('C hiring fallback cap noted', hC.axes.confidence.caps.some((c) => c.includes('fallback')));
    const jC = computeJobReadiness(C);
    check('C job readiness unmeasured (no role)', !jC.measurable && jC.score === null);
    const fC = computeEmployerFit(C);
    check('C employer fit unmeasured (role missing)', !fC.measurable && fC.score === null);

    // Scenario D: nothing measurable -> all three honest-unmeasured.
    const D = ctx({ eiProfile: null, readiness: null });
    check('D hiring unmeasured', !computeHiringReadiness(D).measurable);
    check('D job unmeasured', !computeJobReadiness(D).measurable);
    check('D employer fit unmeasured', !computeEmployerFit(D).measurable);

    // Scenario E: career target propagation in Job Readiness notes (role present).
    const E = ctx({
      eiProfile: ei(70),
      readiness: readiness(72, roleBlock(70), ['current', 'role']),
      careerProfile: { exists: true, data: { targetOccupation: 'QA Lead' } },
    });
    const jE = computeJobReadiness(E);
    check('E job readiness notes carry career target', jE.notes.some((n) => n.includes('QA Lead')));

    console.log('\n— integration: buildEmployabilityMatch on a real @example.com subject —');

    // Seed the parent users row (career_seeker_profiles.user_id FK -> users.id),
    // then a real career_seeker_profiles row (NOT NULL: user_id, data; rest default).
    await pool.query(
      `INSERT INTO users (id, username, password, email, account_type)
       VALUES ($1, $2, $3, $2, 'job_seeker') ON CONFLICT (id) DO NOTHING`,
      [SUBJECT, SUBJECT_EMAIL, 'x'],
    );
    await pool.query(`DELETE FROM career_seeker_profiles WHERE user_id = $1`, [SUBJECT]);
    await pool.query(
      `INSERT INTO career_seeker_profiles (user_id, data) VALUES ($1, $2::jsonb)`,
      [SUBJECT, JSON.stringify({ target_occupation: 'Platform Engineer' })],
    );

    // GET-never-writes guard: relation count must not change across the read path.
    const relCount = async (): Promise<number> =>
      Number((await pool.query(`SELECT count(*)::int AS n FROM pg_class WHERE relkind IN ('r','i')`)).rows[0].n);
    const relBefore = await relCount();

    const res = await buildEmployabilityMatch(pool, SUBJECT);
    check('integration ok', res.ok);
    if (res.ok) {
      const d = res.data;
      check('envelope has all three metrics', !!d.hiring_readiness && !!d.job_readiness && !!d.employer_fit);
      check('metric keys correct', d.hiring_readiness.key === 'hiring_readiness' && d.job_readiness.key === 'job_readiness' && d.employer_fit.key === 'employer_fit');
      check('each metric has dual axes', ['hiring_readiness', 'job_readiness', 'employer_fit'].every((k) => {
        const m = (d as any)[k];
        return m.axes && m.axes.coverage && m.axes.confidence;
      }));
      check('career profile read path picked up real row', d.inputs.career_profile === true);
      check('target_occupation surfaced from real JSONB', d.inputs.target_occupation === 'Platform Engineer', `got ${d.inputs.target_occupation}`);
      check('language_policy present', !!d.language_policy);
      // In dev this subject has no scored competency runtime -> honest unmeasured.
      check('no fabricated score when substrate absent', d.measurable === false ? (d.hiring_readiness.score === null) : true);
    }

    const relAfter = await relCount();
    check('read path created ZERO relations (no DDL)', relAfter === relBefore, `before ${relBefore}, after ${relAfter}`);

    // Invalid input.
    const bad = await buildEmployabilityMatch(pool, '   ');
    check('blank subject -> invalid_input', !bad.ok && bad.code === 'invalid_input');

    console.log('\n— HTTP flag gate (server flag OFF) —');
    const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:8080';
    try {
      const r1 = await fetch(`${base}/api/employability-matching-engine/_meta/status`);
      check('HTTP /_meta/status flag-gated 503', r1.status === 503, `got ${r1.status}`);
      const r2 = await fetch(`${base}/api/employability-matching-engine/subject/${encodeURIComponent(SUBJECT)}`);
      check('HTTP /subject/:id flag-gated 503', r2.status === 503, `got ${r2.status}`);
    } catch (e: any) {
      check('HTTP reachable', false, e?.message ?? 'fetch failed');
    }

    // Completeness guard: every section above must have executed. If any section
    // threw early, the total check count drops below EXPECTED and we FAIL — so a
    // skipped section can never masquerade as a clean pass.
    const EXPECTED_CHECKS = 31;
    check(`all ${EXPECTED_CHECKS} checks executed (no section skipped by exception)`, passed + failed === EXPECTED_CHECKS, `ran ${passed + failed}`);
  } catch (e: any) {
    failed++;
    console.log(`  FAIL smoke threw before completion — ${e?.message ?? e}`);
  } finally {
    await pool.query(`DELETE FROM career_seeker_profiles WHERE user_id = $1`, [SUBJECT]).catch(() => {});
    await pool.query(`DELETE FROM users WHERE id = $1`, [SUBJECT]).catch(() => {});
    console.log('  cleanup: removed demo career_seeker_profiles + users rows');
    await pool.end();
    console.log(`\nResult: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

run();
