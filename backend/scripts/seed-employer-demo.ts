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
import { generateRoleDNA } from '../services/role-dna-expansion-engine';

const ORG_ID = process.env.SEED_ORG_ID ?? 'f90128da-b44b-4db7-9734-d4f713758e2d';
const JOB_ID = 'demo-job-fullstack';
// MX-73X: title MUST resolve to a curated onto_* role so generateRoleDNA returns
// requirements (the competency-driven match needs requirement codes to overlap the
// candidate competency profile). 'Software Engineer' resolves (conf 0.85, 10 reqs);
// the '(DEMO)' suffix is tolerated by the resolver and preserved as an honesty marker.
const JOB_TITLE = 'Software Engineer (DEMO)';
const SOURCE = 'Demo Seed';
/** Source tag stamped on every demo competency run so it is purgeable + never mistaken for real. */
const COMPETENCY_RUN_SOURCE = 'demo_seed';

// MX-73X §9 — a demo CAREER-SEEKER login so the candidate-facing Hiring Readiness tab is
// exercisable end-to-end. Self-scoped: the candidate endpoint reads competency scores keyed
// by the logged-in user's OWN email, so this seeker's email gets a real competency run too.
const DEMO_SEEKER_EMAIL = 'demo.seeker@example.com';
const DEMO_SEEKER_PASSWORD = 'demo123';
const DEMO_SEEKER_NAME = 'Demo Seeker (DEMO)';

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

// ---------------------------------------------------------------------------
// MX-73X — competency profile seeding (canonical onto_competency_score_runs ledger).
//
// HONESTY: the per-competency normalized_score values below are SYNTHETIC demo INPUTS,
// clearly marked (source='demo_seed', subject_id is an @example.com address → purgeable).
// The competency-driven MATCH math (computeCompetencyDrivenMatch) still runs on the REAL
// engine over these inputs — we never write a fabricated match/fit number, only the raw
// competency inputs the engine reads. The requirement CODES are pulled live from the REAL
// generateRoleDNA for JOB_TITLE so the candidate keys always overlap the role requirements.
// ---------------------------------------------------------------------------
type ProfileTier = 'strong' | 'fit' | 'conditional' | 'development' | 'partial';
const SCORE_RANGE: Record<Exclude<ProfileTier, 'partial'>, [number, number]> = {
  strong: [78, 95],
  fit: [66, 82],
  conditional: [52, 70],
  development: [38, 56],
};
function levelOf(score: number): { level: number; label: string } {
  if (score >= 80) return { level: 4, label: 'Advanced' };
  if (score >= 60) return { level: 3, label: 'Proficient' };
  if (score >= 40) return { level: 2, label: 'Developing' };
  return { level: 1, label: 'Emerging' };
}

interface ReqLite { code: string; name: string }

/** Build a synthetic-but-real-shaped competency_scores array for one candidate + tier. */
function buildCompetencyScores(reqs: ReqLite[], tier: ProfileTier): any[] {
  // 'partial' demonstrates the coverage-thin path (headline fit band WITHHELD): only ~40%
  // of requirements scored, using a strong range so it is clearly a COVERAGE miss, not a gap.
  const range = SCORE_RANGE[tier === 'partial' ? 'strong' : tier];
  const used = tier === 'partial' ? reqs.slice(0, Math.max(1, Math.ceil(reqs.length * 0.4))) : reqs;
  return used.map((r) => {
    const score = rint(range[0], range[1]);
    const { level, label } = levelOf(score);
    return {
      competency_id: r.code,
      competency_name: r.name,
      normalized_score: score,
      level,
      level_label: label,
      level_status: 'measured',
    };
  });
}

/** Insert one demo competency run per selected candidate, keyed by candidate.email. */
async function seedCompetencyProfiles(emails: string[]): Promise<number> {
  const dna = await generateRoleDNA(pool, JOB_TITLE);
  const reqs: ReqLite[] = (dna.requirements ?? []).map((r: any) => ({ code: r.code, name: r.name }));
  if (!reqs.length) {
    console.warn(`[seed] WARN role DNA for "${JOB_TITLE}" resolved 0 requirements — competency match cannot be exercised. Skipping competency seed.`);
    return 0;
  }
  // Idempotent cleanup — only the demo runs for THESE subjects (never touches real scores).
  await pool.query(
    `DELETE FROM onto_competency_score_runs WHERE source=$1 AND subject_id = ANY($2::text[])`,
    [COMPETENCY_RUN_SOURCE, emails],
  ).catch(() => {});

  // Deterministic tier spread so the demo shows the full range of fit signals.
  const TIER_CYCLE: ProfileTier[] = ['strong', 'fit', 'conditional', 'development', 'strong', 'partial'];
  let inserted = 0;
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i]!;
    const tier = TIER_CYCLE[i % TIER_CYCLE.length]!;
    const scores = buildCompetencyScores(reqs, tier);
    const measured = scores.map((s) => s.normalized_score);
    const overallScore = Math.round(measured.reduce((a, b) => a + b, 0) / measured.length);
    const overall = { overall_score: overallScore, overall_level: levelOf(overallScore).level };
    await pool.query(
      `INSERT INTO onto_competency_score_runs
         (subject_id, total_questions, scored_questions, competency_scores, overall, normalization, status, source, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
      [
        email,
        scores.length * 3,
        scores.length * 3,
        JSON.stringify(scores),
        JSON.stringify(overall),
        JSON.stringify({ method: 'demo_seed', note: 'Synthetic demo inputs — real match math runs over them.' }),
        'measured',
        COMPETENCY_RUN_SOURCE,
      ],
    );
    inserted++;
  }
  console.log(`[seed] competency runs inserted: ${inserted} (role="${dna.roleTitle}", reqs=${reqs.length})`);
  return inserted;
}

/**
 * Seed a demo career-seeker LOGIN (+ profile + own competency run) so the §9
 * candidate Hiring Readiness tab can be exercised. Idempotent + @example.com-purgeable.
 * Returns the demo seeker's email (the competency subject) or null on skip.
 */
async function seedDemoSeeker(): Promise<string | null> {
  const { scrypt, randomBytes } = await import('crypto');
  const { promisify } = await import('util');
  const scryptAsync = promisify(scrypt);
  const hashPassword = async (pw: string) => {
    const salt = randomBytes(16).toString('hex');
    const buf = (await scryptAsync(pw, salt, 64)) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
  };

  const password = await hashPassword(DEMO_SEEKER_PASSWORD);
  // Upsert the login (username == email is the platform convention).
  const upserted = await pool.query(
    `INSERT INTO users (username, password, full_name, role, roles, email, account_type)
       VALUES ($1,$2,$3,'job_seeker',ARRAY['job_seeker']::text[],$1,'job_seeker')
     ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, full_name = EXCLUDED.full_name
     RETURNING id`,
    [DEMO_SEEKER_EMAIL, password, DEMO_SEEKER_NAME],
  ).catch((e) => { console.warn('[seed] WARN demo seeker user upsert failed:', e.message); return null; });
  if (!upserted || !upserted.rows[0]) return null;
  const userId = String(upserted.rows[0].id);

  // Career seeker profile (JSONB), keyed by user_id (PK). Minimal but real-shaped.
  const profile = {
    exists: true,
    email: DEMO_SEEKER_EMAIL,
    personal: { name: DEMO_SEEKER_NAME, email: DEMO_SEEKER_EMAIL, location: 'Bengaluru, IN' },
    targetRole: 'Software Engineer',
    assessmentScore: 72,
  };
  await pool.query(
    `INSERT INTO career_seeker_profiles (user_id, data, completeness, created_at, updated_at)
       VALUES ($1,$2::jsonb,$3,NOW(),NOW())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [userId, JSON.stringify(profile), 60],
  ).catch((e) => console.warn('[seed] WARN demo seeker profile upsert failed:', e.message));

  // Own competency run (subject_id == email) so the self-scoped readiness endpoint is non-null.
  await seedCompetencyProfiles([DEMO_SEEKER_EMAIL]);
  console.log(`[seed] demo career-seeker login ready: ${DEMO_SEEKER_EMAIL} / ${DEMO_SEEKER_PASSWORD}`);
  return DEMO_SEEKER_EMAIL;
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
       (id, employer_id, title, department, location, type, salary_min, salary_max, currency,
        description, skills, requirements, ei_min_score, status, responsibilities, perks,
        hiring_manager, quota, application_count, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,NOW(),NOW())`,
    [JOB_ID, ORG_ID, JOB_TITLE, 'Engineering', 'Bengaluru, IN', 'Full-time', 2800000, 4200000, 'INR',
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

  // MX-73X: seed competency profiles (canonical onto_competency_score_runs) so the
  // competency-driven hiring flow is exercisable end-to-end. We give profiles to every
  // ACTIVE (in-pipeline) candidate — those viewed in the Intelligence drawer — plus the
  // first 14 terminal candidates so the admin governance distribution has real spread.
  const activeEmails = candidates.filter(c => c.predicted == null).map(c => c.email);
  const terminalEmails = candidates.filter(c => c.predicted != null).slice(0, 14).map(c => c.email);
  const competencyRuns = await seedCompetencyProfiles([...activeEmails, ...terminalEmails]);

  // §9 candidate persona — demo career-seeker login with its OWN competency profile.
  const seekerEmail = await seedDemoSeeker();

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
  console.log(`[seed] competency runs (demo_seed): ${competencyRuns}`);
  console.log(`[seed] demo career-seeker subject: ${seekerEmail ?? '(skipped)'}`);
  console.log('[seed] DONE — employer: open a candidate → Competency Hiring tab. Candidate: log in as the demo seeker → Hiring Readiness tab.');
  await pool.end();
}

main().catch((e) => { console.error('[seed] FAILED', e); process.exit(1); });
