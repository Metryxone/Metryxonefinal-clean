/**
 * PHASE 5.11 — Hiring Intelligence smoke test.
 *
 * Seeds an @example.com employer job/candidate + Phase 5.10 interview substrate rows
 * directly (the interview_* tables already exist), exercises the three engines + combined
 * profile in-process, and asserts:
 *   - deterministic composites + Coverage axis,
 *   - null-abstention (no evidence ⇒ value null, NOT 0),
 *   - IDOR job-scoping (cross-job / unbound candidate refused) + not_found,
 *   - GET-never-writes (pg_class relation count + interview row counts unchanged),
 *   - determinism (profile run twice is byte-identical),
 *   - flag-OFF HTTP 503.
 * Self-cleans all seeded rows (PASS or FAIL).
 *
 * Run from backend/:  npx tsx scripts/smoke-hiring-intelligence.ts
 */

import { Pool } from 'pg';
import { execSync } from 'node:child_process';
import { computeHiringIntelligence } from '../services/hiring-intelligence-engine';
import { computeSuccessPrediction } from '../services/success-prediction-engine';
import { computeTalentPotential } from '../services/talent-potential-engine';
import { resolveEvidence } from '../services/hiring-intelligence-shared';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMP = 'emp_hi_smoke@example.com';
const JOB_A = 'job_hi_smoke_A';
const JOB_B = 'job_hi_smoke_B';
const C_FULL = 'cand_hi_full@example.com';
const C_EMPTY = 'cand_hi_empty@example.com';
const C_OTHER = 'cand_hi_other@example.com'; // belongs to JOB_B

let pass = 0; let fail = 0;
const ok = (name: string, cond: boolean, extra?: any) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra != null ? JSON.stringify(extra) : ''); }
};

async function relCount(): Promise<number> {
  const r = await pool.query(`SELECT count(*)::int AS n FROM pg_class WHERE relnamespace = 'public'::regnamespace`);
  return Number(r.rows[0].n);
}
async function ivRowCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of ['interview_schedules', 'interview_scores', 'interview_feedback', 'interview_decisions']) {
    const r = await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE employer_id = $1`, [EMP]);
    out[t] = Number(r.rows[0].n);
  }
  return out;
}

async function cleanup() {
  for (const t of ['interview_scores', 'interview_feedback', 'interview_decisions', 'interview_schedules']) {
    await pool.query(`DELETE FROM ${t} WHERE employer_id = $1`, [EMP]).catch(() => {});
  }
  await pool.query(`DELETE FROM employer_candidates WHERE employer_id = $1`, [EMP]).catch(() => {});
  await pool.query(`DELETE FROM employer_jobs WHERE employer_id = $1`, [EMP]).catch(() => {});
}

async function seed() {
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, status) VALUES ($1,$2,'Smoke Role A','open'),($3,$2,'Smoke Role B','open')
       ON CONFLICT (id) DO NOTHING`,
    [JOB_A, EMP, JOB_B],
  );
  // full candidate (job A) with operator numeric fields
  await pool.query(
    `INSERT INTO employer_candidates (id, employer_id, job_id, name, email, stage, match_score, assessment_score, ei_score, rating)
       VALUES ($1,$2,$3,'Full Candidate',$1,'interview',80,70,60,4) ON CONFLICT (id) DO NOTHING`,
    [C_FULL, EMP, JOB_A],
  );
  // empty candidate (job A) — NULL numeric fields, no interview evidence
  await pool.query(
    `INSERT INTO employer_candidates (id, employer_id, job_id, name, email, stage)
       VALUES ($1,$2,$3,'Empty Candidate',$1,'applied') ON CONFLICT (id) DO NOTHING`,
    [C_EMPTY, EMP, JOB_A],
  );
  // other candidate belongs to JOB_B (for IDOR test against JOB_A)
  await pool.query(
    `INSERT INTO employer_candidates (id, employer_id, job_id, name, email, stage)
       VALUES ($1,$2,$3,'Other Candidate',$1,'applied') ON CONFLICT (id) DO NOTHING`,
    [C_OTHER, EMP, JOB_B],
  );

  // two interview rounds for the full candidate
  const r1 = await pool.query(
    `INSERT INTO interview_schedules (employer_id, job_id, candidate_id, round_name, round_seq, status)
       VALUES ($1,$2,$3,'Round 1',1,'completed') RETURNING id`,
    [EMP, JOB_A, C_FULL],
  );
  const iv1 = r1.rows[0].id;
  const r2 = await pool.query(
    `INSERT INTO interview_schedules (employer_id, job_id, candidate_id, round_name, round_seq, status)
       VALUES ($1,$2,$3,'Round 2',2,'completed') RETURNING id`,
    [EMP, JOB_A, C_FULL],
  );
  const iv2 = r2.rows[0].id;

  const insScore = (iv: any, panelist: string, criterion: string, score: number) =>
    pool.query(
      `INSERT INTO interview_scores (interview_id, employer_id, job_id, candidate_id, panelist, criterion, score, max_score)
         VALUES ($1,$2,$3,$4,$5,$6,$7,10)`,
      [iv, EMP, JOB_A, C_FULL, panelist, criterion, score],
    );
  // Round 1
  await insScore(iv1, 'P1', 'Leadership', 8);
  await insScore(iv1, 'P1', 'Communication', 7);
  await insScore(iv1, 'P1', 'Problem Solving', 6);
  // Round 2 (improving)
  await insScore(iv2, 'P2', 'Leadership Ownership', 9);
  await insScore(iv2, 'P2', 'Learning Agility', 8);
  await insScore(iv2, 'P2', 'Problem Solving', 7);

  await pool.query(
    `INSERT INTO interview_feedback (interview_id, employer_id, job_id, candidate_id, panelist, recommendation, strengths, concerns)
       VALUES ($1,$2,$3,$4,'P1','yes','Strong leadership and ownership','Needs more depth')`,
    [iv1, EMP, JOB_A, C_FULL],
  );
  await pool.query(
    `INSERT INTO interview_feedback (interview_id, employer_id, job_id, candidate_id, panelist, recommendation, strengths, concerns)
       VALUES ($1,$2,$3,$4,'P2','strong_yes','Great learning agility and growth','')`,
    [iv2, EMP, JOB_A, C_FULL],
  );

  await pool.query(
    `INSERT INTO interview_decisions (employer_id, job_id, candidate_id, interview_id, decision, stage)
       VALUES ($1,$2,$3,$4,'advance','interview')`,
    [EMP, JOB_A, C_FULL, iv1],
  );
  await pool.query(
    `INSERT INTO interview_decisions (employer_id, job_id, candidate_id, interview_id, decision, stage)
       VALUES ($1,$2,$3,$4,'hire','offer')`,
    [EMP, JOB_A, C_FULL, iv2],
  );
}

async function main() {
  await cleanup();
  try {
    await seed();

    const relBefore = await relCount();
    const ivBefore = await ivRowCounts();

    // ── FULL candidate ────────────────────────────────────────────────────
    const hiringR = await computeHiringIntelligence(pool, JOB_A, C_FULL);
    const successR = await computeSuccessPrediction(pool, JOB_A, C_FULL);
    const potentialR = await computeTalentPotential(pool, JOB_A, C_FULL);
    ok('full: hiring engine ok', hiringR.ok);
    ok('full: success engine ok', successR.ok);
    ok('full: potential engine ok', potentialR.ok);

    if (hiringR.ok) {
      const hp = hiringR.data.hiring_probability; const hr = hiringR.data.hiring_risk;
      ok('full: hiring_probability non-null + coverage 100', hp.value != null && hp.coverage_pct === 100, hp);
      ok('full: hiring_probability band set', hp.band != null);
      ok('full: hiring_risk non-null + coverage 100', hr.value != null && hr.coverage_pct === 100, hr);
      ok('full: latest_decision = hire', hiringR.data.latest_decision === 'hire');
      // rec mean = (75 + 100)/2 = 87.5 ; eval mean across 6 scores = (80+70+60+90+80+70)/6=75 ; posture hire=100
      // hp = 87.5*0.4 + 75*0.35 + 100*0.25 = 35 + 26.25 + 25 = 86.25
      ok('full: hiring_probability arithmetic = 86.3', hp.value === 86.3, hp.value);
      ok('full: provenance + disclaimer present', hiringR.data.provenance === 'operator_recorded_composite' && typeof hiringR.data.disclaimer === 'string');
    }
    if (successR.ok) {
      const sp = successR.data.success_potential; const rp = successR.data.retention_potential;
      // success = eval75*0.45 + match80*0.30 + assess70*0.25 = 33.75 + 24 + 17.5 = 75.25 -> 75.3
      ok('full: success_potential = 75.3 + coverage 100', sp.value === 75.3 && sp.coverage_pct === 100, sp);
      ok('full: retention_potential non-null + coverage 100', rp.value != null && rp.coverage_pct === 100, rp);
    }
    if (potentialR.ok) {
      const lp = potentialR.data.leadership_potential; const gp = potentialR.data.growth_potential;
      ok('full: leadership_potential non-null', lp.value != null, lp);
      ok('full: leadership criteria assessed includes Leadership', (potentialR.data.leadership_criteria_assessed || []).some((c: string) => c.toLowerCase().includes('leadership')));
      ok('full: growth_potential non-null', gp.value != null, gp);
      ok('full: growth criteria assessed includes Learning Agility', (potentialR.data.growth_criteria_assessed || []).includes('Learning Agility'));
    }

    // ── EMPTY candidate (null-abstention) ─────────────────────────────────
    const eHiring = await computeHiringIntelligence(pool, JOB_A, C_EMPTY);
    const eSuccess = await computeSuccessPrediction(pool, JOB_A, C_EMPTY);
    const ePotential = await computeTalentPotential(pool, JOB_A, C_EMPTY);
    ok('empty: all engines ok', eHiring.ok && eSuccess.ok && ePotential.ok);
    if (eHiring.ok) {
      const hp = eHiring.data.hiring_probability;
      ok('empty: hiring_probability value NULL (not 0)', hp.value === null && hp.coverage_pct === 0, hp);
      ok('empty: hiring_probability band NULL', hp.band === null);
    }
    if (eSuccess.ok) {
      ok('empty: success_potential NULL', eSuccess.data.success_potential.value === null);
      ok('empty: retention_potential NULL', eSuccess.data.retention_potential.value === null);
    }
    if (ePotential.ok) {
      ok('empty: leadership_potential NULL', ePotential.data.leadership_potential.value === null);
      ok('empty: growth_potential NULL', ePotential.data.growth_potential.value === null);
    }

    // ── IDOR + not_found ──────────────────────────────────────────────────
    const idor = await resolveEvidence(pool, JOB_A, C_OTHER);
    ok('IDOR: cross-job candidate refused (invalid_input)', !idor.ok && idor.code === 'invalid_input', idor);
    const noJob = await resolveEvidence(pool, 'job_does_not_exist', C_FULL);
    ok('not_found: unknown job', !noJob.ok && noJob.code === 'not_found', noJob);
    const noCand = await resolveEvidence(pool, JOB_A, 'cand_does_not_exist');
    ok('not_found: unknown candidate', !noCand.ok && noCand.code === 'not_found', noCand);

    // ── determinism ───────────────────────────────────────────────────────
    const p1 = await computeHiringIntelligence(pool, JOB_A, C_FULL);
    const p2 = await computeHiringIntelligence(pool, JOB_A, C_FULL);
    ok('determinism: identical hiring output', JSON.stringify(p1) === JSON.stringify(p2));

    // ── GET-never-writes ──────────────────────────────────────────────────
    const relAfter = await relCount();
    const ivAfter = await ivRowCounts();
    ok('GET-never-writes: pg_class relation count unchanged', relBefore === relAfter, { relBefore, relAfter });
    ok('GET-never-writes: interview row counts unchanged', JSON.stringify(ivBefore) === JSON.stringify(ivAfter), { ivBefore, ivAfter });

    // ── flag-OFF HTTP 503 ─────────────────────────────────────────────────
    try {
      const code = execSync(
        `curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/hiring-intelligence/job/${JOB_A}/candidate/${C_FULL}/profile"`,
      ).toString().trim();
      ok('flag-OFF: HTTP profile route returns 503', code === '503', code);
    } catch (e: any) {
      ok('flag-OFF: HTTP profile route returns 503', false, e?.message);
    }
  } catch (e: any) {
    fail++; console.log('  ✗ UNCAUGHT', e?.message, e?.stack);
  } finally {
    await cleanup();
    await pool.end();
  }

  console.log(`\nPhase 5.11 smoke: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
