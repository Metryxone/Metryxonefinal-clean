/**
 * DEMO / DEV SEED — populates ONE employer org with a job + realistic demo
 * candidates so the P2 "Job Fit & Predictions" UI and the success-probability
 * CALIBRATION badge can be seen working end-to-end.
 *
 * HONESTY: every assessment + calibration value is COMPUTED by the REAL engines
 * (runHiringAnalysis + buildTIGForOrg) from the seeded candidate fields — no
 * fabricated outputs. Only the candidate INPUTS are synthetic, and they are
 * clearly marked as demo data: source = 'Demo Seed', a 'demo' tag, "(DEMO)" in
 * the job/candidate titles, and @example.com emails (RFC-2606 reserved). The
 * realized hire outcomes used for calibration are drawn Bernoulli(predicted) so
 * they are consistent with — not hand-tuned against — the engine's predictions.
 *
 * Idempotent: re-running deletes and re-creates the demo rows for the org.
 *
 *   Run:  cd backend && npx tsx scripts/seed-employer-demo.ts
 *   Org:  override target employer with SEED_ORG_ID=<employer user id>
 */
import { Pool } from 'pg';
import { buildTIGForOrg, computeSuccessProbability } from '../routes/employer-tig';
import { runHiringAnalysis } from '../routes/employer-hiring-intelligence';

const ORG_ID = process.env.SEED_ORG_ID ?? 'f90128da-b44b-4db7-9734-d4f713758e2d';
const JOB_ID = 'demo-job-fullstack';
const JOB_TITLE = 'Senior Full-Stack Engineer (DEMO)';
const SOURCE = 'Demo Seed';

if (!process.env.DATABASE_URL) {
  console.error('[seed] DATABASE_URL is not set — aborting.');
  process.exit(1);
}
// Safety: never auto-seed demo data into a production database by accident.
if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_CONFIRM !== '1') {
  console.error('[seed] Refusing to seed demo data with NODE_ENV=production. Set DEMO_SEED_CONFIRM=1 to override.');
  process.exit(1);
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Deterministic PRNG (mulberry32) so re-runs produce stable demo data.
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260613);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;
const rint = (lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));
const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => rng() - 0.5);

const JOB_SKILLS = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'REST APIs', 'System Design'];
const EXTRA_SKILLS = ['GraphQL', 'Redis', 'Kubernetes', 'Python', 'CI/CD', 'Jest', 'Tailwind', 'Microservices', 'Kafka', 'Terraform'];

const FIRST = ['Aarav', 'Diya', 'Vivaan', 'Ananya', 'Aditya', 'Ishita', 'Kabir', 'Meera', 'Rohan', 'Sara', 'Arjun', 'Nisha', 'Karan', 'Priya', 'Dev', 'Tara', 'Yash', 'Riya', 'Neel', 'Anjali', 'Veer', 'Pooja', 'Aryan', 'Sneha', 'Manav', 'Kavya', 'Rahul', 'Isha', 'Siddharth', 'Aisha', 'Nikhil', 'Divya', 'Varun', 'Tanvi', 'Aman', 'Ira', 'Raj', 'Mira', 'Sahil', 'Zoya'];
const LAST = ['Sharma', 'Patel', 'Reddy', 'Iyer', 'Nair', 'Gupta', 'Mehta', 'Rao', 'Verma', 'Singh', 'Kapoor', 'Joshi', 'Desai', 'Menon', 'Bose', 'Chopra', 'Pillai', 'Shetty', 'Banerjee', 'Kulkarni'];

const ACTIVE_STAGES = ['Applied', 'Screened', 'Interview', 'Assessment', 'Offer', 'Applied'];
const N_TERMINAL = 34; // ≥30 realized outcomes → calibration flips to 'calibrated' (CALIB_MIN_OUTCOMES=30)

interface Cand {
  id: string; name: string; email: string; skills: string[];
  match: number; ei: number; assess: number; expYears: number;
  stage: string; predicted: number | null; decisionAt: Date | null;
}

function makeSkills(overlap: number): string[] {
  const have = shuffle(JOB_SKILLS).slice(0, overlap);
  const extras = shuffle(EXTRA_SKILLS).slice(0, rint(1, 3));
  return [...have, ...extras];
}
function makeIdentity(i: number): { name: string; email: string } {
  const f = FIRST[i % FIRST.length]!;
  const l = pick(LAST);
  return { name: `${f} ${l}`, email: `${f}.${l}.${i}@example.com`.toLowerCase() };
}

const candidates: Cand[] = [];

// Terminal candidates → realized hire outcomes (the calibration training set).
for (let i = 0; i < N_TERMINAL; i++) {
  const skills = makeSkills(rint(2, JOB_SKILLS.length));
  const match = rint(45, 95);
  const predicted = computeSuccessProbability(skills, match, JOB_SKILLS); // REAL engine, 0..1
  const hired = rng() < predicted; // Bernoulli(predicted) — outcome consistent with prediction
  const { name, email } = makeIdentity(i);
  candidates.push({
    id: `demo-cand-${i}`, name, email, skills,
    match, ei: rint(55, 92), assess: rint(45, 95), expYears: rint(2, 12),
    stage: hired ? 'Hired' : 'Rejected', predicted,
    decisionAt: new Date(Date.now() - rint(7, 180) * 86_400_000),
  });
}

// Active candidates → currently in pipeline, for live Job-Fit viewing in the drawer.
for (let j = 0; j < ACTIVE_STAGES.length; j++) {
  const i = N_TERMINAL + j;
  const { name, email } = makeIdentity(i);
  candidates.push({
    id: `demo-cand-${i}`, name, email, skills: makeSkills(rint(3, JOB_SKILLS.length)),
    match: rint(55, 95), ei: rint(60, 92), assess: rint(55, 95), expYears: rint(3, 11),
    stage: ACTIVE_STAGES[j]!, predicted: null, decisionAt: null,
  });
}

async function main(): Promise<void> {
  console.log(`[seed] org=${ORG_ID} job=${JOB_ID} candidates=${candidates.length} (terminal=${N_TERMINAL}, active=${ACTIVE_STAGES.length})`);

  // Idempotent cleanup of any prior demo rows for this org.
  await pool.query(`DELETE FROM ep98_hiring_assessments WHERE org_id=$1 AND job_id=$2`, [ORG_ID, JOB_ID]).catch(() => {});
  // Scoped to THIS demo job (not all 'Demo Seed' rows org-wide) so co-existing demo datasets are untouched.
  await pool.query(`DELETE FROM employer_candidates WHERE employer_id=$1 AND job_id=$2 AND source=$3`, [ORG_ID, JOB_ID, SOURCE]).catch(() => {});
  await pool.query(`DELETE FROM employer_jobs WHERE id=$1 AND employer_id=$2`, [JOB_ID, ORG_ID]).catch(() => {});

  const activeCount = candidates.filter(c => c.stage !== 'Hired' && c.stage !== 'Rejected').length;

  // Job
  await pool.query(
    `INSERT INTO employer_jobs
       (id, employer_id, title, department, location, type, work_mode, experience, salary,
        description, skills, requirements, ei_min_score, status, responsibilities, perks,
        hiring_manager, quota, application_count, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW())`,
    [JOB_ID, ORG_ID, JOB_TITLE, 'Engineering', 'Bengaluru, IN', 'Full-time', 'Hybrid', '5+ years', '₹28L – ₹42L',
     'Demo role seeded to showcase Job Fit & calibration. Build and scale the product across the stack.',
     JSON.stringify(JOB_SKILLS),
     JSON.stringify(['5+ years full-stack', 'Strong system design', 'Cloud (AWS)']),
     60, 'Active',
     JSON.stringify(['Own features end to end', 'Mentor juniors', 'Drive architecture']),
     JSON.stringify(['Health cover', 'Learning budget', 'Hybrid']),
     'Hiring Team', activeCount, candidates.length],
  );

  // Candidates
  for (const c of candidates) {
    await pool.query(
      `INSERT INTO employer_candidates
         (id, employer_id, job_id, job_title, name, email, location, candidate_role, experience,
          skills, education, ei_score, match_score, source, stage, rating, tags,
          assessment_sent, assessment_score, pooled, predicted_prob_at_decision, decision_at,
          applied_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW(),NOW())`,
      [c.id, ORG_ID, JOB_ID, JOB_TITLE, c.name, c.email, 'Bengaluru, IN', 'Full-Stack Engineer',
       `${c.expYears} years`, JSON.stringify(c.skills), 'B.Tech Computer Science', c.ei, c.match, SOURCE, c.stage,
       rint(3, 5), JSON.stringify(['demo']), c.stage !== 'Applied', c.assess, false,
       c.predicted, c.decisionAt],
    );
  }
  console.log(`[seed] inserted job + ${candidates.length} candidates`);

  // Run the REAL hiring engine for every candidate (6 dims + 7 predictions → ep98_hiring_assessments).
  const analysis = await runHiringAnalysis(pool, ORG_ID, JOB_ID);
  console.log('[seed] hiring analysis:', JSON.stringify(analysis).slice(0, 160));

  // Run the REAL TIG build → learns + persists empirical calibration from terminal-stage outcomes.
  const tig = await buildTIGForOrg(pool, ORG_ID);
  console.log('[seed] TIG build:', tig);

  // Report the resulting state honestly.
  const hired = candidates.filter(c => c.stage === 'Hired').length;
  const rejected = candidates.filter(c => c.stage === 'Rejected').length;
  const calib = await pool.query(
    `SELECT status, total_outcomes, method, brier, ece FROM tig_calibration WHERE org_id=$1 ORDER BY band_min LIMIT 1`, [ORG_ID]);
  const asmt = await pool.query(
    `SELECT COUNT(*)::int AS n FROM ep98_hiring_assessments WHERE org_id=$1 AND job_id=$2`, [ORG_ID, JOB_ID]);

  console.log(`[seed] realized outcomes: ${hired} Hired / ${rejected} Rejected (total ${hired + rejected})`);
  console.log('[seed] calibration row:', calib.rows[0] ?? '(none)');
  console.log(`[seed] assessments stored: ${asmt.rows[0]?.n ?? 0}`);
  console.log('[seed] DONE — log in as the employer, open a candidate → Intelligence tab to see Job Fit + calibration badge.');
  await pool.end();
}

main().catch((e) => { console.error('[seed] FAILED', e); process.exit(1); });
