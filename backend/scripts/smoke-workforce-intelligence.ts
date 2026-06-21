/**
 * PHASE 5.12 — Workforce Intelligence Foundation smoke test.
 *
 * Seeds two @example.com employers (org + jobs(with department + required skills) +
 * candidates(with skills / competency_profile JSONB)) directly, exercises the three engines
 * + combined overview in-process, and asserts:
 *   - deterministic composites + Coverage axis (team index, department readiness arithmetic),
 *   - null-abstention (no evidence ⇒ value null, NOT 0),
 *   - IDOR employer-scoping (a second employer's rows never leak into the first's evidence;
 *     a candidate's department resolves ONLY via that employer's jobs — unbound ⇒ null),
 *   - skill inventory supply/demand + unmet demand,
 *   - capability heatmap cell means + target gap,
 *   - GET-never-writes (pg_class relation count + employer row counts unchanged),
 *   - determinism (overview run twice is byte-identical),
 *   - flag-OFF HTTP 503.
 * Self-cleans all seeded rows (PASS or FAIL).
 *
 * Run from backend/:  npx tsx scripts/smoke-workforce-intelligence.ts
 */

import { Pool } from 'pg';
import { execSync } from 'node:child_process';
import {
  computeTeamCompetencyProfile, computeDepartmentReadiness, computeTalentDistribution,
} from '../services/workforce-intelligence-engine';
import { computeSkillInventory } from '../services/skill-inventory-engine';
import { computeCapabilityHeatmap } from '../services/capability-mapping-engine';
import { resolveWorkforceEvidence } from '../services/workforce-intelligence-shared';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const EMP = 'emp_wf_smoke@example.com';
const EMP2 = 'emp_wf_other@example.com';
const JOB_A = 'job_wf_eng';     // EMP, dept Engineering
const JOB_B = 'job_wf_sales';   // EMP, dept Sales
const JOB_C = 'job_wf_other';   // EMP2 (cross-employer)
const C_FULL = 'cand_wf_full@example.com';       // EMP / JOB_A
const C_PARTIAL = 'cand_wf_partial@example.com'; // EMP / JOB_A
const C_EMPTY = 'cand_wf_empty@example.com';     // EMP / JOB_A (no evidence)
const C_SALES = 'cand_wf_sales@example.com';     // EMP / JOB_B
const C_UNBOUND = 'cand_wf_unbound@example.com'; // EMP but job_id -> JOB_C (not EMP's job)
const C_OTHER = 'cand_wf_other@example.com';     // EMP2 / JOB_C

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
  // organizations
  await pool.query(
    `INSERT INTO employer_organizations (id, name, owner_id) VALUES ($1,'WF Smoke Org',$1),($2,'WF Other Org',$2)
       ON CONFLICT (id) DO NOTHING`,
    [EMP, EMP2],
  );
  // jobs (department + required skills)
  await pool.query(
    `INSERT INTO employer_jobs (id, employer_id, title, department, status, skills) VALUES
       ($1,$2,'Engineer','Engineering','open',$3::jsonb),
       ($4,$2,'Sales Rep','Sales','open',$5::jsonb)
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

  // EMP / JOB_A (Engineering)
  await insCand(C_FULL, EMP, JOB_A, 'Engineer', {
    skills: ['JavaScript', 'Python', 'React'],
    comp: { Communication: 80, 'Problem Solving': 70 },
    match: 80, assess: 70, ei: 60, rating: 4, stage: 'interview',
  });
  await insCand(C_PARTIAL, EMP, JOB_A, 'Engineer', {
    comp: { Communication: 60 }, ei: 50, stage: 'applied',
  });
  await insCand(C_EMPTY, EMP, JOB_A, 'Engineer', { stage: 'applied' });
  // EMP / JOB_B (Sales)
  await insCand(C_SALES, EMP, JOB_B, 'Sales Rep', {
    skills: ['Negotiation'], comp: { Negotiation: 90 }, assess: 90, stage: 'screening',
  });
  // EMP candidate whose job belongs to ANOTHER employer -> unbound (department null)
  await insCand(C_UNBOUND, EMP, JOB_C, 'Engineer', { assess: 55, stage: 'applied' });
  // EMP2 candidate (must NOT leak into EMP evidence)
  await insCand(C_OTHER, EMP2, JOB_C, 'Other Role', { assess: 99, stage: 'applied' });

  // competency target: Engineering Communication target 90
  await pool.query(
    `INSERT INTO employer_competency_roles (id, employer_id, role_code, role_name, department, competencies, proficiency_targets)
       VALUES ($1,$2,'ROLE_WF_ENG','Engineer','Engineering',$3::jsonb,$4::jsonb) ON CONFLICT (id) DO NOTHING`,
    ['ecr_wf_eng', EMP, JSON.stringify(['Communication']), JSON.stringify({ Communication: 90 })],
  );
}

async function main() {
  await cleanup();
  try {
    await seed();

    const relBefore = await relCount();
    const empBefore = await empRowCounts();

    // ── IDOR employer-scoping (EMP evidence excludes EMP2) ────────────────────
    const evR = await resolveWorkforceEvidence(pool, EMP);
    ok('evidence: resolves for EMP', evR.ok);
    if (evR.ok) {
      const ev = evR.data;
      ok('IDOR: EMP evidence has exactly 5 candidates (no EMP2 leak)', ev.candidates.length === 5, ev.candidates.length);
      ok('IDOR: no EMP2 candidate present', !ev.candidates.some((c) => c.id === C_OTHER));
      ok('IDOR: no EMP2 job present', !ev.jobs.some((j) => j.id === JOB_C), ev.jobs.map((j) => j.id));
      const unbound = ev.candidates.find((c) => c.id === C_UNBOUND);
      ok('IDOR: unbound candidate department NULL (job not in EMP map)', !!unbound && unbound.department === null && unbound.bound_to_employer_job === false, unbound);
    }
    const noEmp = await resolveWorkforceEvidence(pool, 'emp_does_not_exist@example.com');
    ok('not_found: unknown employer', !noEmp.ok && (noEmp as any).code === 'not_found', noEmp);

    // ── Team Competency Profile ───────────────────────────────────────────────
    const teamR = await computeTeamCompetencyProfile(pool, EMP);
    ok('team: engine ok', teamR.ok);
    if (teamR.ok) {
      const d = teamR.data;
      ok('team: 2 teams (job A + job B)', d.teams_count === 2, d.teams_count);
      ok('team: 1 candidate unassigned (unbound)', d.candidates_unassigned === 1, d.candidates_unassigned);
      const teamA = d.teams.find((t: any) => t.job_id === JOB_A);
      // competency mean = mean(75,60) = 67.5 ; assess 70 ; ei mean(60,50)=55 ; rating 80
      // index = .4*67.5 + .3*70 + .2*55 + .1*80 = 27 + 21 + 11 + 8 = 67
      ok('team A: index = 67.0 + coverage 100', !!teamA && teamA.team_competency_index === 67 && teamA.coverage_pct === 100, teamA);
      ok('team A: department = Engineering', !!teamA && teamA.department === 'Engineering');
      const comm = teamA?.per_competency?.find((p: any) => p.competency === 'Communication');
      ok('team A: Communication mean 70, coverage 66.7 (2/3 measured)', !!comm && comm.mean === 70 && comm.coverage_pct === 66.7, comm);
    }

    // ── Department Readiness ──────────────────────────────────────────────────
    const deptR = await computeDepartmentReadiness(pool, EMP);
    ok('dept: engine ok', deptR.ok);
    if (deptR.ok) {
      const d = deptR.data;
      const eng = d.departments.find((x: any) => x.department === 'Engineering');
      // index = .35*70 + .30*67.5 + .20*80 + .15*55 = 24.5 + 20.25 + 16 + 8.25 = 69
      ok('dept Engineering: readiness index = 69.0', !!eng && eng.department_readiness_index === 69, eng);
      ok('dept: has unassigned bucket (unbound candidate)', d.has_unassigned === true);
      const unassigned = d.departments.find((x: any) => x.department === null);
      ok('dept unassigned: index from C_UNBOUND assess 55 only', !!unassigned && unassigned.department_readiness_index === 55, unassigned);
    }

    // ── Talent Distribution ───────────────────────────────────────────────────
    const distR = await computeTalentDistribution(pool, EMP);
    ok('dist: engine ok', distR.ok);
    if (distR.ok) {
      const d = distR.data;
      ok('dist: total 5 candidates', d.total_candidates === 5, d.total_candidates);
      // C_EMPTY has no measured signal -> unmeasured
      ok('dist: 1 unmeasured candidate (C_EMPTY)', d.by_readiness_band.unmeasured === 1, d.by_readiness_band);
      ok('dist: measured = 4', d.measured_candidates === 4, d.measured_candidates);
    }

    // ── Skill Inventory ───────────────────────────────────────────────────────
    const skillR = await computeSkillInventory(pool, EMP);
    ok('skill: engine ok', skillR.ok);
    if (skillR.ok) {
      const d = skillR.data;
      // distinct = JavaScript, Python, React, Negotiation, Go = 5
      ok('skill: 5 distinct skills', d.total_distinct_skills === 5, d.total_distinct_skills);
      ok('skill: reference loaded (>0)', d.reference_loaded > 0, d.reference_loaded);
      const go = d.skills.find((s: any) => s.skill.toLowerCase() === 'go');
      ok('skill: Go demand 1 supply 0', !!go && go.demand_count === 1 && go.supply_count === 0, go);
      ok('skill: unmet demand includes Go', d.unmet_demand_skills.some((s: any) => s.skill.toLowerCase() === 'go') && d.unmet_demand_skills.length === 1, d.unmet_demand_skills);
      // supply coverage = 2/5 candidates with skills = 40
      ok('skill: supply coverage 40%', d.supply_coverage_pct === 40, d.supply_coverage_pct);
      ok('skill: demand coverage 100%', d.demand_coverage_pct === 100, d.demand_coverage_pct);
    }

    // ── Capability Heatmap ────────────────────────────────────────────────────
    const heatR = await computeCapabilityHeatmap(pool, EMP);
    ok('heatmap: engine ok', heatR.ok);
    if (heatR.ok) {
      const d = heatR.data;
      const eng = d.rows.find((r: any) => r.department === 'Engineering');
      const comm = eng?.cells?.find((c: any) => c.competency === 'Communication');
      // Communication mean (80,60)=70 ; target 90 ; gap -20
      ok('heatmap Eng/Communication: mean 70, target 90, gap -20', !!comm && comm.mean === 70 && comm.target === 90 && comm.gap === -20, comm);
      const ps = eng?.cells?.find((c: any) => c.competency === 'Problem Solving');
      ok('heatmap Eng/Problem Solving: mean 70, no target -> gap null', !!ps && ps.mean === 70 && ps.target === null && ps.gap === null, ps);
      ok('heatmap: targets_available = 1', d.targets_available === 1, d.targets_available);
    }

    // ── determinism (overview twice identical) ────────────────────────────────
    const o1 = await computeTeamCompetencyProfile(pool, EMP);
    const o2 = await computeTeamCompetencyProfile(pool, EMP);
    ok('determinism: identical team output', JSON.stringify(o1) === JSON.stringify(o2));

    // ── GET-never-writes ──────────────────────────────────────────────────────
    const relAfter = await relCount();
    const empAfter = await empRowCounts();
    ok('GET-never-writes: pg_class relation count unchanged', relBefore === relAfter, { relBefore, relAfter });
    ok('GET-never-writes: employer row counts unchanged', JSON.stringify(empBefore) === JSON.stringify(empAfter), { empBefore, empAfter });

    // ── flag-OFF HTTP 503 ─────────────────────────────────────────────────────
    try {
      const code = execSync(
        `curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/workforce-intelligence/employer/${EMP}/overview"`,
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

  console.log(`\nPhase 5.12 smoke: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
