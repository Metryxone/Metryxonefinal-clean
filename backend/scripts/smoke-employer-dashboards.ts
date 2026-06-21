/**
 * PHASE 5.13 — Employer Dashboards smoke test.
 *
 * Seeds two @example.com employers (org + jobs(department/status/skills) + candidates across the
 * full funnel(applied..Hired/Rejected) with operator scores/competency/skills) directly, exercises
 * the three dashboards + overview in-process, and asserts:
 *   - open jobs counts (open vs closed) + applicant counts,
 *   - applications by canonical stage (case-insensitive bucketing of lower-cased raw stages),
 *   - hiring funnel step conversions (abstain when prior stage empty) + outcomes,
 *   - readiness composite + Coverage, competency analytics per-competency means,
 *   - assessment analytics distributions (mean/coverage/null-abstention),
 *   - hiring analytics hire/selection rate + coverage-gated quality-of-hire,
 *   - talent pool available-pool (excludes Rejected) + band spread + supplied skills,
 *   - IDOR employer-scoping (EMP2 rows never leak; unbound candidate department null),
 *   - GET-never-writes (pg_class relation count + employer row counts unchanged),
 *   - determinism (overview run twice byte-identical),
 *   - flag-OFF HTTP 503.
 * Self-cleans all seeded rows (PASS or FAIL).
 *
 * Run from backend/:  npx tsx scripts/smoke-employer-dashboards.ts
 */

import { Pool } from 'pg';
import { execSync } from 'node:child_process';
import {
  computeEmployerDashboard, computeRecruiterDashboard, computeTalentDashboard, computeDashboardOverview,
} from '../services/employer-dashboard-engine';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMP = 'emp_dash_smoke@example.com';
const EMP2 = 'emp_dash_other@example.com';
const JOB_A = 'job_dash_eng';    // EMP, Engineering, status open
const JOB_B = 'job_dash_sales';  // EMP, Sales, status Closed
const JOB_C = 'job_dash_other';  // EMP2 (cross-employer)
const C_FULL = 'cand_dash_full@example.com';         // EMP/JOB_A interview
const C_PARTIAL = 'cand_dash_partial@example.com';   // EMP/JOB_A applied
const C_EMPTY = 'cand_dash_empty@example.com';       // EMP/JOB_A applied (no evidence)
const C_SALES = 'cand_dash_sales@example.com';       // EMP/JOB_B screening
const C_HIRED = 'cand_dash_hired@example.com';       // EMP/JOB_A Hired
const C_REJECTED = 'cand_dash_rejected@example.com'; // EMP/JOB_A Rejected
const C_OFFER = 'cand_dash_offer@example.com';       // EMP/JOB_B Offer
const C_UNBOUND = 'cand_dash_unbound@example.com';   // EMP, job -> JOB_C (not EMP's) -> dept null
const C_OTHER = 'cand_dash_otheremp@example.com';    // EMP2/JOB_C (must NOT leak)

let pass = 0; let fail = 0;
const ok = (name: string, cond: boolean, extra?: any) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, extra != null ? JSON.stringify(extra) : ''); }
};

async function relCount(): Promise<number> {
  const r = await pool.query(`SELECT count(*)::int AS n FROM pg_class WHERE relnamespace = 'public'::regnamespace`);
  return Number(r.rows[0].n);
}
async function empRowCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of ['employer_jobs', 'employer_candidates', 'employer_competency_roles', 'employer_organizations']) {
    const col = t === 'employer_organizations' ? 'id' : 'employer_id';
    const r = await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE ${col} = ANY($1)`, [[EMP, EMP2]]);
    out[t] = Number(r.rows[0].n);
  }
  return out;
}

async function cleanup() {
  await pool.query(`DELETE FROM employer_candidates WHERE employer_id = ANY($1)`, [[EMP, EMP2]]).catch(() => {});
  await pool.query(`DELETE FROM employer_competency_roles WHERE employer_id = ANY($1)`, [[EMP, EMP2]]).catch(() => {});
  await pool.query(`DELETE FROM employer_jobs WHERE employer_id = ANY($1)`, [[EMP, EMP2]]).catch(() => {});
  await pool.query(`DELETE FROM employer_organizations WHERE id = ANY($1)`, [[EMP, EMP2]]).catch(() => {});
}

async function seed() {
  await pool.query(
    `INSERT INTO employer_organizations (id, name, owner_id) VALUES ($1,'Dash Smoke Org',$1),($2,'Dash Other Org',$2)
       ON CONFLICT (id) DO NOTHING`,
    [EMP, EMP2],
  );
  // jobs: JOB_A open, JOB_B Closed (mixed-case to exercise normJobStatus); JOB_C belongs to EMP2.
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, department, status, skills) VALUES
       ($1,$2,'Engineer','Engineering','open',$3::jsonb),
       ($4,$2,'Sales Rep','Sales','Closed',$5::jsonb)
       ON CONFLICT (id) DO NOTHING`,
    [JOB_A, EMP, JSON.stringify(['JavaScript', 'Python', 'Go']), JOB_B, JSON.stringify(['Negotiation'])],
  );
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, department, status, skills) VALUES
       ($1,$2,'Other Role','Other','open',$3::jsonb) ON CONFLICT (id) DO NOTHING`,
    [JOB_C, EMP2, JSON.stringify(['Leadership'])],
  );

  const insCand = (id: string, employer: string, jobId: string, role: string, fields: {
    skills?: any; comp?: any; match?: number | null; assess?: number | null; ei?: number | null; rating?: number | null; stage?: string;
  }) =>
    pool.query(
      `INSERT INTO employer_candidates
         (id, employer_id, job_id, name, email, candidate_role, stage, match_score, assessment_score, ei_score, rating, skills, competency_profile)
       VALUES ($1,$2,$3,$4,$1,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        id, employer, jobId, role.replace(/@.*/, ''), role,
        fields.stage ?? 'applied',
        fields.match ?? null, fields.assess ?? null, fields.ei ?? null, fields.rating ?? null,
        JSON.stringify(fields.skills ?? []), JSON.stringify(fields.comp ?? {}),
      ],
    );

  // EMP / JOB_A (Engineering) — raw stages are LOWER-CASED to exercise canonStage.
  await insCand(C_FULL, EMP, JOB_A, 'Engineer', {
    skills: ['JavaScript', 'Python', 'React'], comp: { Communication: 80, 'Problem Solving': 70 },
    match: 80, assess: 70, ei: 60, rating: 4, stage: 'interview',
  });
  await insCand(C_PARTIAL, EMP, JOB_A, 'Engineer', { comp: { Communication: 60 }, ei: 50, stage: 'applied' });
  await insCand(C_EMPTY, EMP, JOB_A, 'Engineer', { stage: 'applied' });
  await insCand(C_HIRED, EMP, JOB_A, 'Engineer', {
    comp: { Communication: 90 }, match: 88, assess: 85, ei: 70, stage: 'Hired',
  });
  await insCand(C_REJECTED, EMP, JOB_A, 'Engineer', { match: 40, assess: 45, stage: 'Rejected' });
  // EMP / JOB_B (Sales)
  await insCand(C_SALES, EMP, JOB_B, 'Sales Rep', { skills: ['Negotiation'], comp: { Negotiation: 90 }, assess: 90, stage: 'screening' });
  await insCand(C_OFFER, EMP, JOB_B, 'Sales Rep', { assess: 75, stage: 'Offer' });
  // EMP candidate whose job belongs to ANOTHER employer -> unbound (department null)
  await insCand(C_UNBOUND, EMP, JOB_C, 'Engineer', { assess: 55, stage: 'applied' });
  // EMP2 candidate (must NOT leak into EMP)
  await insCand(C_OTHER, EMP2, JOB_C, 'Other Role', { assess: 99, stage: 'applied' });

  // competency target: Engineering Communication target 90
  await pool.query(
    `INSERT INTO employer_competency_roles (id, employer_id, role_code, role_name, department, competencies, proficiency_targets)
       VALUES ($1,$2,'ROLE_DASH_ENG','Engineer','Engineering',$3::jsonb,$4::jsonb) ON CONFLICT (id) DO NOTHING`,
    ['ecr_dash_eng', EMP, JSON.stringify(['Communication']), JSON.stringify({ Communication: 90 })],
  );
}

async function main() {
  await cleanup();
  try {
    await seed();
    const relBefore = await relCount();
    const empBefore = await empRowCounts();

    // ── employer_dashboard ────────────────────────────────────────────────────
    const empR = await computeEmployerDashboard(pool, EMP);
    ok('employer_dashboard: engine ok', empR.ok);
    if (empR.ok) {
      const s = (empR.data as any).sections;

      // open jobs
      ok('open_jobs: total 2, open 1 (JOB_B Closed)', s.open_jobs.total_jobs === 2 && s.open_jobs.open_jobs === 1, s.open_jobs.by_status);
      ok('open_jobs: by_status closed 1', s.open_jobs.by_status.closed === 1, s.open_jobs.by_status);
      const jobA = s.open_jobs.jobs.find((j: any) => j.job_id === JOB_A);
      ok('open_jobs: JOB_A has 5 applicants', !!jobA && jobA.applicant_count === 5, jobA);

      // applications (lower-cased raw stages bucket into canon)
      ok('applications: total 8', s.applications.total_applications === 8, s.applications.total_applications);
      ok('applications: Applied 3 (applied x3)', s.applications.by_stage.Applied === 3, s.applications.by_stage);
      ok('applications: Interview 1, Screened 1, Offer 1, Hired 1, Rejected 1',
        s.applications.by_stage.Interview === 1 && s.applications.by_stage.Screened === 1 &&
        s.applications.by_stage.Offer === 1 && s.applications.by_stage.Hired === 1 && s.applications.by_stage.Rejected === 1,
        s.applications.by_stage);
      ok('applications: unbound_to_job 1', s.applications.unbound_to_job === 1, s.applications.unbound_to_job);

      // hiring funnel conversions
      const f = s.hiring_funnel;
      const applied = f.stages.find((x: any) => x.stage === 'Applied');
      const screened = f.stages.find((x: any) => x.stage === 'Screened');
      const assessment = f.stages.find((x: any) => x.stage === 'Assessment');
      const offer = f.stages.find((x: any) => x.stage === 'Offer');
      ok('funnel: Applied conversion null (no prior)', applied.conversion_from_prev_pct === null, applied);
      ok('funnel: Screened conversion 33.3 (1/3)', screened.conversion_from_prev_pct === 33.3, screened);
      ok('funnel: Assessment count 0 -> conversion 0 (1->0)', assessment.count === 0 && assessment.conversion_from_prev_pct === 0, assessment);
      ok('funnel: Offer conversion null (prior Assessment empty)', offer.conversion_from_prev_pct === null, offer);
      ok('funnel: outcomes hired 1 rejected 1 in_pipeline 6', f.outcomes.hired === 1 && f.outcomes.rejected === 1 && f.outcomes.in_pipeline === 6, f.outcomes);

      // readiness
      ok('readiness: measured 7, coverage 87.5', s.readiness.measured_candidates === 7 && s.readiness.coverage_pct === 87.5, s.readiness);
      ok('readiness: org index 68.1, band moderate', s.readiness.org_readiness_index === 68.1 && s.readiness.org_band === 'moderate', s.readiness.org_readiness_index);

      // competency analytics
      ok('competency: 3 competencies tracked', s.competency_analytics.competencies_tracked === 3, s.competency_analytics.competencies_tracked);
      const comm = s.competency_analytics.per_competency.find((p: any) => p.competency === 'Communication');
      ok('competency: Communication org mean 76.7 (80,60,90), coverage 37.5', !!comm && comm.mean === 76.7 && comm.coverage_pct === 37.5, comm);

      // assessment analytics
      ok('assessment: assessment_score mean 70, coverage 75', s.assessment_analytics.assessment_score.mean === 70 && s.assessment_analytics.assessment_score.coverage_pct === 75, s.assessment_analytics.assessment_score);
      ok('assessment: candidates_with_any_score 7', s.assessment_analytics.candidates_with_any_score === 7, s.assessment_analytics.candidates_with_any_score);
      ok('assessment: ei null-abstention (mean over 3 present = 60)', s.assessment_analytics.ei_score.mean === 60 && s.assessment_analytics.ei_score.measured === 3, s.assessment_analytics.ei_score);

      // hiring analytics
      const ha = s.hiring_analytics;
      ok('hiring_analytics: hired 1, selection_rate 50 (1/2 decided)', ha.hired === 1 && ha.selection_rate_pct === 50, ha);
      ok('hiring_analytics: quality_of_hire mean_match 88 (hired only)', ha.quality_of_hire.mean_match_score === 88, ha.quality_of_hire);
      ok('hiring_analytics: quality mean_readiness 84.9', ha.quality_of_hire.mean_readiness_index === 84.9, ha.quality_of_hire);

      ok('employer_dashboard: provenance + disclaimer present', (empR.data as any).provenance === 'operator_recorded_composite' && typeof (empR.data as any).disclaimer === 'string');
    }

    // ── recruiter_dashboard (talent pool) ─────────────────────────────────────
    const recR = await computeRecruiterDashboard(pool, EMP);
    ok('recruiter_dashboard: engine ok', recR.ok);
    if (recR.ok) {
      const tp = (recR.data as any).sections.talent_pool;
      ok('talent_pool: available_pool 7 (excludes Rejected)', tp.available_pool === 7, tp.available_pool);
      ok('talent_pool: available bands high 3 moderate 3', tp.available_by_readiness_band.high === 3 && tp.available_by_readiness_band.moderate === 3, tp.available_by_readiness_band);
      ok('talent_pool: by_readiness_band developing 1 (Rejected), unmeasured 1 (empty)', tp.by_readiness_band.developing === 1 && tp.by_readiness_band.unmeasured === 1, tp.by_readiness_band);
      ok('talent_pool: top_supplied_skills includes JavaScript', tp.top_supplied_skills.some((x: any) => x.skill.toLowerCase() === 'javascript'), tp.top_supplied_skills);
    }

    // ── talent_dashboard sections ─────────────────────────────────────────────
    const talR = await computeTalentDashboard(pool, EMP);
    ok('talent_dashboard: engine ok + has readiness + competency + assessment', talR.ok &&
      !!(talR.data as any).sections.readiness && !!(talR.data as any).sections.competency_analytics && !!(talR.data as any).sections.assessment_analytics);

    // ── IDOR employer-scoping ─────────────────────────────────────────────────
    const ovR = await computeDashboardOverview(pool, EMP);
    ok('overview: engine ok', ovR.ok);
    if (ovR.ok) {
      const ev = (ovR.data as any).evidence;
      ok('IDOR: EMP has exactly 8 candidates (no EMP2 leak)', ev.candidates === 8, ev.candidates);
      ok('IDOR: EMP has 2 jobs (JOB_C excluded)', ev.jobs === 2, ev.jobs);
      ok('IDOR: 1 unbound candidate (unbound dept resolution)', ev.candidates_unbound_to_employer_job === 1, ev.candidates_unbound_to_employer_job);
      const empDash = (ovR.data as any).employer_dashboard;
      const otherLeak = JSON.stringify(empDash).includes(C_OTHER);
      ok('IDOR: EMP2 candidate id never appears in EMP dashboard', !otherLeak);
    }

    // ── not_found ─────────────────────────────────────────────────────────────
    const nf = await computeEmployerDashboard(pool, 'emp_dash_missing@example.com');
    ok('not_found: unknown employer', !nf.ok && (nf as any).code === 'not_found', nf);

    // ── determinism ───────────────────────────────────────────────────────────
    const o1 = await computeDashboardOverview(pool, EMP);
    const o2 = await computeDashboardOverview(pool, EMP);
    ok('determinism: overview byte-identical across runs', JSON.stringify(o1) === JSON.stringify(o2));

    // ── GET-never-writes ──────────────────────────────────────────────────────
    const relAfter = await relCount();
    const empAfter = await empRowCounts();
    ok('GET-never-writes: pg_class relation count unchanged', relBefore === relAfter, { relBefore, relAfter });
    ok('GET-never-writes: employer row counts unchanged', JSON.stringify(empBefore) === JSON.stringify(empAfter), { empBefore, empAfter });

    // ── flag-OFF HTTP 503 ─────────────────────────────────────────────────────
    try {
      const code = execSync(
        `curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/employer-dashboards/employer/${EMP}/overview"`,
      ).toString().trim();
      ok('flag-OFF: HTTP overview route returns 503', code === '503', code);
    } catch (e: any) {
      ok('flag-OFF: HTTP overview route returns 503', false, e?.message);
    }
  } catch (e: any) {
    fail++; console.log('  ✗ UNCAUGHT', e?.message, e?.stack);
  } finally {
    await cleanup();
    await pool.end();
  }

  console.log(`\nPhase 5.13 smoke: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
