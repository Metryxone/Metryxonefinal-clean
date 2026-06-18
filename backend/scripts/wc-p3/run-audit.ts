/**
 * WC-P3 Career Builder Readiness Audit
 * Read-only. Generates 14 deliverables → backend/audit/wc-p3/
 *
 * Dimensions:
 *   D01  Career Discovery (job board, fitment, EI engine)
 *   D02  Career Mapping   (competency assessment, profile, skills)
 *   D03  Career Recommendation (next-actions, recommendation engine)
 *   D04  Growth Planning  (M5 growth plans, IDP)
 *   D05  Career Pathway   (M3 mobility, career paths)
 *   D06  Outcome Intelligence (attribution, outcome models)
 *   D07  Longitudinal     (snapshots, progress ledger, career memory)
 *   D08  Report           (stage guidance, career reports)
 *   D09  Personalization  (Career Brain, behaviour adapter)
 *   D10  Commercial       (mentors, job marketplace, subscriptions)
 *
 * Coverage  = structural element score (routes + schema + implementation quality)
 * Confidence = real user-keyed data activation score
 * These are SEPARATE axes and must NOT be merged.
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const { Pool } = pg;
const OUT = path.resolve('backend/audit/wc-p3');
fs.mkdirSync(OUT, { recursive: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/* ── helpers ─────────────────────────────────────────────── */
function mask(email: string): string {
  return 'user_' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 10);
}
function pct(n: number, d: number): string {
  if (d === 0) return '0%';
  return Math.round((n / d) * 100) + '%';
}
function write(filename: string, content: string) {
  fs.writeFileSync(path.join(OUT, filename), content, 'utf8');
  console.log('  wrote', filename);
}
function now(): string { return new Date().toISOString(); }

/* ── 1. DB row counts ─────────────────────────────────────── */
const CAREER_TABLES = [
  // core profiles
  'career_seeker_profiles', 'career_profiles',
  // job & employer
  'job_postings', 'job_applications', 'employer_jobs', 'employer_profiles',
  // mentors
  'mentors', 'mentor_profiles', 'mentorship_sessions',
  // goals
  'career_seeker_goals', 'career_goal_milestones', 'career_goal_progress',
  // growth plans (M5)
  'm5_career_growth_plans', 'career_growth_plan_actions',
  // behaviour / memory (DB-backed)
  'behavioural_memory', 'career_interventions_log',
  // trajectory / benchmarks / longitudinal
  'career_trajectory_history', 'career_benchmarks_history',
  'career_memory_snapshots', 'career_growth_patterns',
  'career_learning_milestones',
  // competency
  'user_competency_scores', 'user_assessment_snapshots',
  // market intelligence (M3)
  'm3_market_roles', 'm3_market_competencies', 'm3_market_role_aliases',
  'm3_market_velocity_scores', 'm3_role_market_scores',
  'm3_competency_market_scores', 'm3_career_paths',
  // mobility
  'mobility_career_paths', 'mobility_development_pathways', 'occupation_pathways',
  // PIL pathways
  'pil_growth_pathways',
  // recommendations (CAPADEX session-keyed)
  'career_recommendations',
  // WOS / market signals
  'wos_market_signals', 'wos_v2_market_forecasts', 'market_demand_models',
  // other
  'employer_talent_pools', 'employer_assessments',
];

async function getTableCounts(client: pg.PoolClient): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const t of CAREER_TABLES) {
    try {
      const r = await client.query(`SELECT COUNT(*) AS n FROM ${t}`);
      counts.set(t, Number(r.rows[0].n));
    } catch {
      counts.set(t, -1); // table does not exist
    }
  }
  return counts;
}

/* ── 2. User activation data ─────────────────────────────── */
async function getUserActivation(client: pg.PoolClient) {
  const r = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM career_seeker_profiles) AS career_profiles,
      (SELECT COUNT(*) FROM career_seeker_profiles WHERE completeness > 0) AS completed_profiles,
      (SELECT COUNT(*) FROM user_competency_scores) AS competency_users,
      (SELECT COUNT(*) FROM user_assessment_snapshots) AS assessment_snapshots,
      (SELECT COUNT(*) FROM career_recommendations) AS capadex_career_recs,
      (SELECT COUNT(DISTINCT session_id) FROM career_recommendations) AS capadex_sessions_with_recs,
      (SELECT COUNT(*) FROM behavioural_memory) AS behavioural_memory_rows,
      (SELECT COUNT(*) FROM mentors) AS mentors,
      (SELECT COUNT(*) FROM job_postings) AS job_postings,
      (SELECT COUNT(*) FROM employer_jobs) AS employer_jobs,
      (SELECT COUNT(*) FROM m5_career_growth_plans) AS growth_plans,
      (SELECT COUNT(*) FROM career_trajectory_history) AS trajectory_snapshots,
      (SELECT COUNT(*) FROM career_memory_snapshots) AS memory_snapshots,
      (SELECT COUNT(*) FROM pil_growth_pathways) AS pil_pathways,
      (SELECT COUNT(*) FROM m3_career_paths) AS m3_career_paths,
      (SELECT COUNT(*) FROM wos_market_signals) AS wos_signals
  `);
  return r.rows[0];
}

/* ── 3. Source analysis (static-vs-DB evidence) ──────────── */
interface RouteAnalysis {
  file: string;
  hasRequireAuth: boolean;
  isStaticData: boolean;
  isInMemory: boolean;
  dbBacked: boolean;
  notes: string;
}

function analyseRoute(filePath: string): RouteAnalysis {
  let src = '';
  try { src = fs.readFileSync(filePath, 'utf8'); } catch { return { file: filePath, hasRequireAuth: false, isStaticData: false, isInMemory: false, dbBacked: false, notes: 'FILE NOT FOUND' }; }

  const hasRequireAuth = /requireAuth/.test(src);
  const isStaticData   = /const\s+(GENOME|FUTURE|WORKFORCE_CATALOG|SKILL_SIGNALS|AI_DISRUPTION|EMERGING_ROLES|CLUSTERS|LEADERSHIP_LEVELS)\s*[=:]/.test(src);
  const isInMemory     = /new Map<string,|snapshotStore|interventionStore/.test(src);
  const dbBacked       = /pool\.query|db\.select|db\.insert|\.query\(`SELECT/.test(src);

  let notes = '';
  if (isStaticData) notes += 'ALL_STATIC_DATA; ';
  if (isInMemory) notes += 'IN_MEMORY_STORE; ';
  if (!hasRequireAuth) notes += 'NO_AUTH_GUARD; ';
  if (!dbBacked && !isStaticData && !isInMemory) notes += 'HEURISTIC_ONLY; ';
  if (!notes) notes = 'OK';
  return { file: path.basename(filePath), hasRequireAuth, isStaticData, isInMemory, dbBacked, notes: notes.trim() };
}

const ROUTE_FILES = [
  'backend/routes/career-genome.ts',
  'backend/routes/career-workforce.ts',
  'backend/routes/career-simulations.ts',
  'backend/routes/career-success.ts',
  'backend/routes/career-memory.ts',
  'backend/routes/career-velocity.ts',
  'backend/routes/career-trajectory.ts',
  'backend/routes/career-profile.ts',
  'backend/routes/career-stage-guidance.ts',
  'backend/routes/career-seeker.ts',
  'backend/routes/behavioural-memory.ts',
  'backend/routes/m3-market-intelligence.ts',
  'backend/routes/career-benchmark.ts',
  'backend/routes/career-intelligence.ts',
  'backend/routes/recruiter-postings.ts',
];

/* ── 4. Dimension scoring ─────────────────────────────────── */
interface DimScore {
  id: string; label: string;
  coverage: number;   // 0-100 structural completeness
  confidence: number; // 0-100 real-data activation
  verdict: 'READY' | 'PARTIAL' | 'STUB' | 'EMPTY';
  coverageRationale: string;
  confidenceRationale: string;
  gaps: string[];
}

function deriveScores(ua: Record<string, number>): DimScore[] {
  // pg COUNT() returns strings; Number() coerce to avoid strict-eq bugs (e.g. '0' === 0 → false)
  const competencyUsers    = Number(ua.competency_users);
  const careerProfiles     = Number(ua.career_profiles);
  const growthPlans        = Number(ua.growth_plans);
  const behaviouralMemory  = Number(ua.behavioural_memory_rows);
  const mentors            = Number(ua.mentors);
  const jobPostings        = Number(ua.job_postings);
  const employerJobs       = Number(ua.employer_jobs);
  const m3Paths            = Number(ua.m3_career_paths);
  const memorySnapshots    = Number(ua.memory_snapshots);
  const trajSnapshots      = Number(ua.trajectory_snapshots);
  const pilPathways        = Number(ua.pil_pathways);
  const capadexRecs        = Number(ua.capadex_career_recs);
  const capSessions        = Number(ua.capadex_sessions_with_recs);
  const wosSignals         = Number(ua.wos_signals);

  return [
    {
      id: 'D01', label: 'Career Discovery',
      coverage: 40,
      confidence: competencyUsers > 0 ? 20 : 0,
      verdict: jobPostings === 0 && employerJobs === 0 ? 'STUB' : 'PARTIAL',
      coverageRationale: 'Routes for profile (CV), jobs, goals exist; EI engine real; fitment engine exists. Job board routes present but empty (0 job_postings, 0 employer_jobs). Recruiter-postings route exists (lazy employer_jobs).',
      confidenceRationale: `job_postings=${jobPostings}, employer_jobs=${employerJobs} → job board fully empty. EI engine computes for ${competencyUsers} users but discovery surface (job matching) inactive.`,
      gaps: [
        'job_postings: 0 rows — entire job board inoperable',
        'employer_jobs: 0 rows — recruiter-postings returns empty',
        'Fitment engine (FitmentInsightsPanel) active but nothing to rank against',
        'No employer onboarding / posting flow',
      ],
    },
    {
      id: 'D02', label: 'Career Mapping',
      coverage: 75,
      confidence: competencyUsers > 10 ? 70 : competencyUsers > 0 ? 35 : 0,
      verdict: competencyUsers > 0 ? 'PARTIAL' : 'STUB',
      coverageRationale: 'Competency assessment (V2 adaptive, 63 items) real and functional. Profile CRUD (career_seeker_profiles) real. Gap analysis engine real. Competency scoring pipeline real. Skills Lab heuristic overlay over competency scores.',
      confidenceRationale: `user_competency_scores=${competencyUsers} real users. career_seeker_profiles=${careerProfiles} (completeness not verified per-row). Assessment runtime fully operational.`,
      gaps: [
        'career_seeker_profiles: only 2 rows (2 users have career profile)',
        'Completeness field populated but passport field absent on both (0 passports)',
        'Skills Lab tab relies on competency scores; V2 contextual DNA behind feature flag',
        'EI computation table does not exist as user_employability_scores (computed via ei-engine.ts at query time)',
      ],
    },
    {
      id: 'D03', label: 'Career Recommendation',
      coverage: 35,
      confidence: capadexRecs > 0 && capSessions > 0 ? 15 : 0,
      verdict: 'PARTIAL',
      coverageRationale: 'career_recommendations table exists with 24 rows. PIL Recommendation Intelligence (Phase 7) populates it. Recommendation engine (frontend + backend) exists. Next-actions route (behavioural-memory.ts) exists. HOWEVER: recommendations are CAPADEX session-keyed (session_id), not career-profile-keyed (user_id). A resolution bridge exists (career-behavior-adapter.ts resolves user_id → session_id via behavioural-memory time-series) but no Career Builder route or consumer queries career_recommendations by that path.',
      confidenceRationale: `career_recommendations=${capadexRecs} rows from ${capSessions} CAPADEX session(s). No user_id column → rows not directly queryable by career profile. The user→session bridge exists architecturally but is data-starved (behaviouralMemory=${behaviouralMemory} rows). next-actions endpoint returns [] for all users.`,
      gaps: [
        'career_recommendations keyed on session_id not user_id — no Career Builder consumer queries it by user',
        'Resolution bridge (behavior-adapter user_id→session_id) exists but inactive: behavioural_memory=0 rows',
        'behavioural_memory: 0 rows → next-actions endpoint returns []',
        'Recommendation engine heuristic (regex/keyword), not graph-backed',
        'PIL library recommendations (capadex_intervention_recommendations) not surfaced in Career Builder UI',
      ],
    },
    {
      id: 'D04', label: 'Growth Planning',
      coverage: 30,
      confidence: growthPlans > 0 ? 30 : 0,
      verdict: growthPlans === 0 ? 'STUB' : 'PARTIAL',
      coverageRationale: 'M5 AI coach service (createAICoach) exists. Growth-plan-bridge service exists (composes M5 growthPlan with persist=false). IDP engine (adaptiveIDPEngine) exists as frontend heuristic. Development Plan tab exists. pil_growth_pathways=110 rows (PIL pathway catalog). m5_career_growth_plans table exists. CRITICAL: growth-plan-bridge always calls persist=false — never writes to m5_career_growth_plans.',
      confidenceRationale: `m5_career_growth_plans=${growthPlans} rows. growth-plan-bridge never persists. pil_growth_pathways=${pilPathways} rows are CATALOG rows, not user growth plans. No user has an active growth plan.`,
      gaps: [
        'm5_career_growth_plans: 0 rows — growth-plan-bridge always calls persist=false',
        'No persistence trigger in any career builder flow to write growth plans',
        'IDP engine (Development Plan tab) is a frontend heuristic, not DB-backed',
        'pil_growth_pathways (110) is a PIL catalog — not user growth plans',
        'No career-growth-plan CRUD route for users',
      ],
    },
    {
      id: 'D05', label: 'Career Pathway',
      coverage: 45,
      confidence: m3Paths > 0 ? 20 : 0,
      verdict: m3Paths > 0 ? 'PARTIAL' : 'STUB',
      coverageRationale: 'M3 market intelligence routes (30+ endpoints) real, with data-availability checks in handlers (NOT auth-gating — data checks prevent 500s, not unauthorised access). mobility_career_paths(3), m3_career_paths(3), occupation_pathways(3), mobility_development_pathways(5) exist with seed data. pathway-engine service exists. Pathway tab (PathwaysTab) exists. pil_growth_pathways(110) is a rich PIL catalog. WOS market forecasts(3).',
      confidenceRationale: `m3_career_paths=${m3Paths} (seed data only). No user-specific pathway assignments. No pathway recommendations personalized per user. wos_market_signals=${wosSignals} real signal rows (not personalized).`,
      gaps: [
        'm3_career_paths: 3 rows (seed data only, not user-personalized)',
        'No pathway assignment → user link',
        'PathwaysTab displays static/seed content only',
        'PIL growth pathways (110) disconnected from CareerBuilder pathway surface',
        'WOS market forecasts: only 3 rows',
      ],
    },
    {
      id: 'D06', label: 'Outcome Intelligence',
      coverage: 25,
      confidence: 0,
      verdict: 'STUB',
      coverageRationale: 'outcomeAttributionEngine (pure function) exists in frontend/src/lib/intelligence/. Stage guidance orchestrator (career-stage-guidance.ts) is real and composes 4 phases of intelligence. Outcome models referenced in outcome-model tables. HOWEVER: attribution engine requires snapshot history (≥2 snapshots). No snapshot tables populated.',
      confidenceRationale: `behavioural_memory=${behaviouralMemory}, career_memory_snapshots=${memorySnapshots} → attribution engine has no data to process. Returns [] for all users. Stage guidance works for users with loaded profiles but no outcome tracking.`,
      gaps: [
        'outcomeAttributionEngine needs ≥2 snapshots — currently 0 for all users',
        'career_interventions_log: 0 rows — no intervention tracking',
        'No outcome realization tracking (action → metric movement unverified)',
        'Stage guidance works but no outcome feedback loop',
        'Outcome model tables empty (no user-specific outcome data)',
      ],
    },
    {
      id: 'D07', label: 'Longitudinal Intelligence',
      coverage: 15,
      confidence: 0,
      verdict: 'EMPTY',
      coverageRationale: 'progressLedger pure function exists. behavioural-memory route (DB-backed) exists with requireAuth ✅. career_memory_snapshots and career_trajectory_history tables exist in schema. CRITICAL: career-memory.ts uses an IN-MEMORY Map<string, Snapshot[]> — data resets on every server restart. Career memory snapshots never written to DB. trajectory/benchmarks history tables all 0.',
      confidenceRationale: `career_memory_snapshots=${memorySnapshots}, career_trajectory_history=${trajSnapshots}, career_benchmarks_history=0, career_growth_patterns=0. behavioural_memory=${behaviouralMemory}. All longitudinal tables empty. progressLedger returns null for all users (needs ≥2 snapshots). Career Memory tab shows in-memory data only.`,
      gaps: [
        'CRITICAL: career-memory.ts uses in-memory Map — data lost on every server restart',
        'career_memory_snapshots: 0 rows (DB table exists but is never written)',
        'progressLedger requires ≥2 DB snapshots — currently 0 for all users',
        'career_trajectory_history: 0 rows',
        'career_benchmarks_history: 0 rows',
        'career_growth_patterns: 0 rows',
        'No snapshot-write trigger anywhere in career builder flows',
      ],
    },
    {
      id: 'D08', label: 'Report Intelligence',
      coverage: 35,
      confidence: careerProfiles > 0 ? 15 : 0,
      verdict: 'PARTIAL',
      coverageRationale: 'career-stage-guidance.ts is real: calls loadProfileSnapshot() + buildStageGuidance() (4-phase orchestrator). Stage guidance route has inline IDOR guard (not requireAuth middleware). No dedicated career report surface (/api/career/reports). Competency reports accessible via admin panel. No PDF/export career report.',
      confidenceRationale: `career_seeker_profiles=${careerProfiles} users have profiles. Stage guidance works for these users. No report export or scheduled report generation. Admin-only competency report panel.`,
      gaps: [
        'No dedicated career report surface for end users',
        'Stage guidance route lacks requireAuth middleware (IDOR guard is inline only)',
        'No PDF / email export of career report',
        'No scheduled or triggered report generation on completion',
        'Competency reports only accessible to super admins',
      ],
    },
    {
      id: 'D09', label: 'Personalization',
      coverage: 55,
      confidence: competencyUsers > 0 ? 25 : 0,
      verdict: 'PARTIAL',
      coverageRationale: 'useCareerBrain hook is real (5 API calls: competency/score, behavioural-memory, behavior-profile, behavior-graph, next-actions). career-behavior-adapter (CAPADEX→Career bridge) is real — pure transformer. Behavior graph service is real (getBehaviorGraph). Constraint engine (P3), Unified Action Engine (P4) pure functions exist. Well-architected degradation — never throws.',
      confidenceRationale: `behaviouralMemory=${behaviouralMemory} → behavior graph dims empty for all users. next-actions returns [] (no behavioural_memory). CareerBrain activates but degrades heavily: behaviorGraph=null, bestNextActions=[], constraintEngine fires on heuristics only. ${competencyUsers} users have competency data (real personalization partial).`,
      gaps: [
        'behavior graph empty → behavior-based personalization degraded for all users',
        'bestNextActions returns [] (behavioural_memory=0)',
        'Constraint engine fires on heuristic rules only (no graph backing)',
        'CAPADEX session → career bridge requires non-null session_id on profile',
        'Personalization mostly heuristic; data-driven path blocked by empty behaviour tables',
      ],
    },
    {
      id: 'D10', label: 'Commercial',
      coverage: 10,
      confidence: 0,
      verdict: 'EMPTY',
      coverageRationale: 'Mentor routes exist (admin CRUD only, no consumer browse/book route). Recruiter-postings route exists (lazy employer_jobs). No subscription model specific to Career Builder. No payment integration for career features. Mentor marketplace UI tab (MentorsTab) exists but backed by 0 rows. Interview Prep, Simulations tabs have no commercial gate.',
      confidenceRationale: `mentors=${mentors}, job_postings=${jobPostings}, employer_jobs=${employerJobs}. No career-specific subscription table. No payment route for mentor booking. No employer onboarding flow. 0 commercial transactions possible.`,
      gaps: [
        'mentors: 0 rows — mentor marketplace is decorative',
        'job_postings: 0 rows — no job board supply side',
        'No mentor booking / payment route',
        'No employer onboarding / posting workflow',
        'No career builder subscription tier',
        'Recruiter-postings route stub (employer_jobs empty)',
      ],
    },
  ];
}

/* ── 5. Tab readiness matrix ──────────────────────────────── */
interface TabReadiness {
  tabId: string; label: string;
  backend: 'REAL' | 'PARTIAL' | 'STATIC' | 'IN_MEMORY' | 'EMPTY';
  dataState: string; authGuard: boolean; notes: string;
}

function buildTabMatrix(ua: Record<string, number>): TabReadiness[] {
  return [
    { tabId:'dashboard',       label:'Dashboard',           backend:'REAL',      dataState:'EI+competency scores real',          authGuard:true,  notes:'EI gauge + career stats functional' },
    { tabId:'profile',         label:'My Profile',          backend:'REAL',      dataState:`${ua.career_profiles} profiles in DB`, authGuard:true, notes:'CRUD real; 2 profiles; 0 passports' },
    { tabId:'skills',          label:'Skills Lab',          backend:'PARTIAL',   dataState:`${ua.competency_users} comp scores`,  authGuard:true,  notes:'Competency-backed; V2 behind flag' },
    { tabId:'resume',          label:'Resume Studio',       backend:'REAL',      dataState:'CV CRUD real',                       authGuard:true,  notes:'ResumeStudio pure + CV routes real' },
    { tabId:'assessment',      label:'Competency Assessment',backend:'REAL',     dataState:`${ua.competency_users} users assessed`,authGuard:true, notes:'Full runtime V2 operational' },
    { tabId:'jobs',            label:'Job Tracker',         backend:'PARTIAL',   dataState:`0 job_postings, 0 employer_jobs`,    authGuard:true,  notes:'Routes real; job board supply=0' },
    { tabId:'interview',       label:'Interview Prep',      backend:'STATIC',    dataState:'Static catalog (interview-questions.ts)', authGuard:true, notes:'No DB; static question bank only' },
    { tabId:'learning',        label:'Learning Hub',        backend:'STATIC',    dataState:'Static courses catalog',             authGuard:true,  notes:'courses.ts catalog; no DB' },
    { tabId:'pathways',        label:'Career Pathways',     backend:'PARTIAL',   dataState:`${ua.m3_career_paths} m3_career_paths (seed)`, authGuard:true, notes:'M3 routes real; thin seed data' },
    { tabId:'mentors',         label:'Mentor Connect',      backend:'EMPTY',     dataState:`${ua.mentors} mentors in DB`,        authGuard:true,  notes:'UI tab exists; 0 mentor rows' },
    { tabId:'goals',           label:'Goals',               backend:'PARTIAL',   dataState:'career_seeker_goals: 0 rows',        authGuard:true,  notes:'Routes real; no user goals yet' },
    { tabId:'development',     label:'Development Plan',    backend:'PARTIAL',   dataState:`${ua.growth_plans} growth plans (0)`, authGuard:true, notes:'IDP engine heuristic; M5 bridge never persists' },
    { tabId:'future-map',      label:'Future Map',          backend:'STATIC',    dataState:'career-genome.ts ALL hardcoded',     authGuard:false, notes:'NO requireAuth; pure static GENOME constants' },
    { tabId:'simulations',     label:'AI Simulations',      backend:'PARTIAL',   dataState:'Simulation logic exists',            authGuard:false, notes:'NO requireAuth on simulation routes' },
    { tabId:'market-intel',    label:'Market Intelligence', backend:'PARTIAL',   dataState:`${ua.wos_signals} wos_signals; 5 m3 roles`, authGuard:true, notes:'M3 routes real; minimal seed' },
    { tabId:'velocity',        label:'Career Velocity',     backend:'PARTIAL',   dataState:'learningVelocityEngine heuristic',   authGuard:false, notes:'NO requireAuth on velocity routes' },
    { tabId:'workforce',       label:'Workforce Intel',     backend:'STATIC',    dataState:'career-workforce.ts ALL hardcoded',  authGuard:false, notes:'NO requireAuth; pure static constants' },
    { tabId:'visibility',      label:'Recruiter Visibility',backend:'PARTIAL',   dataState:'visibilityEngine heuristic',         authGuard:true,  notes:'Heuristic scoring over profile data' },
    { tabId:'fresher-hub',     label:'Fresher Hub',         backend:'PARTIAL',   dataState:'Fresher-specific static content',    authGuard:true,  notes:'Static/heuristic; no dedicated DB' },
    { tabId:'weekly-plan',     label:"This Week's Plan",    backend:'PARTIAL',   dataState:'weeklyActionEngine heuristic',       authGuard:true,  notes:'Pure heuristic; no DB backing' },
    { tabId:'next-actions',    label:'Next Best Actions',   backend:'PARTIAL',   dataState:`${ua.behavioural_memory_rows} behavioural_memory rows (0)`, authGuard:true, notes:'Route real; returns [] (no data)' },
    { tabId:'behavioral-growth',label:'Behavioural Growth', backend:'PARTIAL',   dataState:`${ua.behavioural_memory_rows} behaviour dims (0)`, authGuard:true, notes:'Behavior adapter real; graph empty' },
    { tabId:'career-memory',   label:'Career Memory',       backend:'IN_MEMORY', dataState:`${ua.memory_snapshots} DB snapshots (0)`, authGuard:true, notes:'career-memory.ts uses in-memory Map; resets on restart' },
  ];
}

/* ── main ─────────────────────────────────────────────────── */
async function main() {
  console.log('[WC-P3] Career Builder Readiness Audit — ' + now());
  const client = await pool.connect();

  let dbCounts: Map<string, number>;
  let ua: Record<string, number>;
  try {
    dbCounts = await getTableCounts(client);
    ua       = await getUserActivation(client);
  } finally {
    client.release();
  }

  const routeAnalyses = ROUTE_FILES.map(f => analyseRoute(f));
  const dims          = deriveScores(ua);
  const tabs          = buildTabMatrix(ua);

  // Overall scores
  const coverageAvg    = Math.round(dims.reduce((s, d) => s + d.coverage, 0) / dims.length);
  const confidenceAvg  = Math.round(dims.reduce((s, d) => s + d.confidence, 0) / dims.length);
  const readyCount     = dims.filter(d => d.verdict === 'READY').length;
  const partialCount   = dims.filter(d => d.verdict === 'PARTIAL').length;
  const stubCount      = dims.filter(d => d.verdict === 'STUB').length;
  const emptyCount     = dims.filter(d => d.verdict === 'EMPTY').length;

  const overallVerdict =
    coverageAvg >= 70 && confidenceAvg >= 50 ? 'GO' :
    coverageAvg >= 50 || confidenceAvg >= 30 ? 'CONDITIONAL GO' :
    'NO-GO';

  // Auth surface
  const noAuthRoutes = routeAnalyses.filter(r => !r.hasRequireAuth && r.notes !== 'FILE NOT FOUND');
  const staticRoutes = routeAnalyses.filter(r => r.isStaticData);
  const inMemRoutes  = routeAnalyses.filter(r => r.isInMemory);

  // Tables
  const missingTables = Array.from(dbCounts.entries()).filter(([,v]) => v === -1).map(([k]) => k);
  const emptyTables   = Array.from(dbCounts.entries()).filter(([,v]) => v === 0).map(([k]) => k);
  const populatedTables = Array.from(dbCounts.entries()).filter(([,v]) => v > 0);

  // ── FILE 00: Scorecard ────────────────────────────────────────────────────
  write('00_readiness_scorecard.md', `# WC-P3 Career Builder Readiness Audit — Scorecard

> Generated: ${now()}  
> Scope: read-only structural + activation measurement, 10 dimensions, 23 tabs.  
> Coverage = structural element quality (routes + schema + implementation fidelity).  
> Confidence = real user-keyed data activation (separate axis, never merged with Coverage).

---

## Overall Verdict: ${overallVerdict}

| Axis | Score |
|------|-------|
| **Structural Coverage** | **${coverageAvg}%** |
| **Activation Confidence** | **${confidenceAvg}%** |

> Interpretation: ${coverageAvg}% of the Career Builder's architecture is structurally implemented.  
> Only ${confidenceAvg}% of dimensions are producing real user-keyed outputs today.  
> **Confidence score method**: gated on real DB row counts; magnitude values are expert-calibrated estimates, not statistically measured. Report as directional, not precise.

---

## Dimension Summary

| # | Dimension | Coverage | Confidence | Verdict |
|---|-----------|----------|------------|---------|
${dims.map(d => `| ${d.id} | ${d.label} | ${d.coverage}% | ${d.confidence}% | ${d.verdict} |`).join('\n')}
| | **AVERAGE** | **${coverageAvg}%** | **${confidenceAvg}%** | |

**Verdict distribution:** READY=${readyCount} · PARTIAL=${partialCount} · STUB=${stubCount} · EMPTY=${emptyCount}

---

## Critical Findings

1. **D07 Longitudinal — in-memory store** \`career-memory.ts\` uses a server-process \`Map<string,Snapshot[]>\` — all data lost on every restart. DB tables exist but are never written.
2. **D10 Commercial — zero supply** Mentor (0 rows), job board (0 postings), employer jobs (0) — entire commercial surface is decorative.
3. **D03 Recommendation bridge inactive** \`career_recommendations\` (24 rows) are CAPADEX session-keyed (no user_id column). A user→session bridge exists in \`career-behavior-adapter.ts\` but no Career Builder consumer queries recommendations via it; bridge is also data-starved (behavioural_memory=0).
4. **D04 Growth plans never persist** \`growth-plan-bridge.ts\` calls \`persist=false\` unconditionally — \`m5_career_growth_plans\` has 0 rows.
5. **Unauthenticated routes** ${noAuthRoutes.length} of ${routeAnalyses.length} audited route files lack \`requireAuth\`. Key risks: \`career-memory.ts\` has no auth and accepts userId from query/body (IDOR pattern — low blast radius today, critical before DB migration); \`career-stage-guidance.ts\` has inline IDOR guard only (no middleware). Static-data routes (\`career-genome.ts\`, \`career-workforce.ts\`, \`career-success.ts\`) have no user data but inconsistent auth surface.
6. **Static data masquerading as intelligence** Future Map, Workforce Intel, Career Success all return hardcoded arrays with no DB reads.

---

## DB State Snapshot

| Status | Count |
|--------|-------|
| Tables checked | ${CAREER_TABLES.length} |
| Tables in schema (exist) | ${CAREER_TABLES.length - missingTables.length} |
| Tables with data | ${populatedTables.length} |
| Empty tables (exist, 0 rows) | ${emptyTables.length} |
| Tables missing from schema | ${missingTables.length} |

Total career domain rows: ${Array.from(dbCounts.values()).filter(v => v > 0).reduce((s,v) => s+v, 0)}

Missing tables: ${missingTables.map(t => `\`${t}\``).join(', ')}
`);

  // ── FILE 01: Capability Inventory ─────────────────────────────────────────
  const tableRows = Array.from(dbCounts.entries()).map(([t, n]) => {
    const status = n === -1 ? '⚠ MISSING' : n === 0 ? '○ EMPTY' : `✓ ${n} rows`;
    return `| \`${t}\` | ${status} |`;
  }).join('\n');

  const routeRows = routeAnalyses.map(r =>
    `| \`${r.file}\` | ${r.hasRequireAuth ? '✓' : '✗'} | ${r.isStaticData ? 'STATIC' : r.isInMemory ? 'IN_MEM' : r.dbBacked ? 'DB' : 'HEURISTIC'} | ${r.notes} |`
  ).join('\n');

  write('01_career_builder_capability_inventory.md', `# WC-P3 D00 — Career Builder Capability Inventory

> Generated: ${now()}

## DB Table State (${CAREER_TABLES.length} tables)

| Table | Status |
|-------|--------|
${tableRows}

## Route File Analysis

| File | requireAuth | Data Source | Notes |
|------|-------------|-------------|-------|
${routeRows}

## Auth Surface Issues

**Routes missing \`requireAuth\` middleware (${noAuthRoutes.length} files):**
${noAuthRoutes.map(r => `- \`${r.file}\` — ${r.notes}`).join('\n')}

**Routes with static hardcoded data (${staticRoutes.length} files):**
${staticRoutes.map(r => `- \`${r.file}\``).join('\n')}

**Routes with in-memory stores (${inMemRoutes.length} files):**
${inMemRoutes.map(r => `- \`${r.file}\` — data resets on server restart`).join('\n')}

## Tab Readiness Matrix (${tabs.length} tabs)

| Tab ID | Label | Backend | Auth | Data State | Notes |
|--------|-------|---------|------|------------|-------|
${tabs.map(t => `| \`${t.tabId}\` | ${t.label} | ${t.backend} | ${t.authGuard ? '✓' : '✗ MISSING'} | ${t.dataState} | ${t.notes} |`).join('\n')}

**Tab backend distribution:**
${['REAL','PARTIAL','STATIC','IN_MEMORY','EMPTY'].map(s => `- ${s}: ${tabs.filter(t=>t.backend===s).length}`).join('\n')}
`);

  // ── FILES 02–11: Per-dimension deliverables ───────────────────────────────
  for (const dim of dims) {
    const slug = dim.id.toLowerCase() + '_' + dim.label.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
    const gapList = dim.gaps.map(g => `- [ ] ${g}`).join('\n');
    write(`${String(dims.indexOf(dim)+2).padStart(2,'0')}_${slug}.md`,
`# WC-P3 ${dim.id} — ${dim.label} Readiness

> Generated: ${now()}  
> Verdict: **${dim.verdict}**

## Scores

| Axis | Score |
|------|-------|
| Structural Coverage | **${dim.coverage}%** |
| Activation Confidence | **${dim.confidence}%** |

### Coverage Rationale
${dim.coverageRationale}

### Confidence Rationale
${dim.confidenceRationale}

## Gaps

${gapList || '- None identified'}

---
*Coverage = structural completeness; Confidence = real data activation (separate axes).*
`);
  }

  // ── FILE 12: Executive Gap Analysis ───────────────────────────────────────
  const criticalGaps = dims
    .filter(d => d.verdict === 'EMPTY' || d.verdict === 'STUB')
    .flatMap(d => d.gaps.map(g => `**[${d.id}]** ${g}`));
  const highGaps = dims
    .filter(d => d.verdict === 'PARTIAL' && d.confidence < 20)
    .flatMap(d => d.gaps.slice(0, 2).map(g => `**[${d.id}]** ${g}`));

  write('12_executive_gap_analysis.md', `# WC-P3 — Executive Gap Analysis

> Generated: ${now()}  
> Career Builder structural coverage: **${coverageAvg}%** | Activation confidence: **${confidenceAvg}%**  
> Verdict: **${overallVerdict}**

---

## Tier 1 — Critical Gaps (EMPTY / STUB dimensions)

These gaps make entire product areas non-functional today:

${criticalGaps.map(g => `- ${g}`).join('\n')}

---

## Tier 2 — High-Priority Gaps (PARTIAL, low confidence)

These areas have structural scaffolding but produce no real user-keyed outputs:

${highGaps.map(g => `- ${g}`).join('\n')}

---

## Tier 3 — Infrastructure Gaps

| Gap | Impact |
|-----|--------|
| \`career-memory.ts\` in-memory store | All career memory lost on server restart |
| 5 routes missing \`requireAuth\` | Inconsistent auth surface; static data exposed unauthenticated |
| \`growth-plan-bridge.ts\` never persists | No user growth plans ever created |
| \`career_recommendations\` missing \`user_id\` | Career recs unqueryable from Career Builder context |
| EI table \`user_employability_scores\` does not exist | EI computed at query time only, no persistence |

---

## Dimension Health Table

| Dimension | Coverage | Confidence | Blocker |
|-----------|----------|------------|---------|
${dims.map(d => `| ${d.label} | ${d.coverage}% | ${d.confidence}% | ${d.gaps[0] || 'None'} |`).join('\n')}

---

## Key Honesty Flags

- **career_recommendations (24 rows)**: These are CAPADEX session-scoped recs. They are NOT accessible via Career Builder user queries (no user_id column). The 24 rows represent **1 CAPADEX user session**, not career recommendations for career builder users.
- **pil_growth_pathways (110 rows)**: This is a PIL curation catalog, not user growth plan instances.
- **wos_market_signals (54 rows)**: Real signal data; small dataset, not personalized per user.
- **Static routes are NOT intelligence**: Future Map, Workforce Intel, and Career Success return hardcoded arrays. They look like AI/data products but are compiled constants.
- **Career OS (useCareerBrain) degrades to near-empty**: With 0 behavioural_memory rows and 0 career_memory_snapshots, all four Career OS pillars (Constraint Engine, Action Engine, Progress Ledger, Outcome Attribution) return null / [] / heuristic-only output.
`);

  // ── FILE 13: 95% Completion Roadmap ───────────────────────────────────────
  write('13_95pct_completion_roadmap.md', `# WC-P3 — 95% Completion Roadmap

> Generated: ${now()}  
> Starting point: ${coverageAvg}% structural coverage, ${confidenceAvg}% activation confidence.  
> Target: 95% structural coverage, ≥60% activation confidence.

---

## Phase 1 — Foundation Repairs (Required before any data activation)

These are blocking issues that must be fixed before confidence can grow:

| # | Task | Dimension | Effort |
|---|------|-----------|--------|
| 1 | Migrate \`career-memory.ts\` from in-memory Map to DB writes (career_memory_snapshots table) | D07 | Medium |
| 2 | Add snapshot-write trigger on assessment completion / profile update | D07 | Small |
| 3 | Add \`user_id\` column to \`career_recommendations\` + bridge CAPADEX session → career profile | D03 | Medium |
| 4 | Set \`persist=true\` (or add a persisted path) in \`growth-plan-bridge.ts\` | D04 | Small |
| 5 | Add \`requireAuth\` to \`career-genome.ts\`, \`career-workforce.ts\`, \`career-simulations.ts\`, \`career-success.ts\` | All | Small |

---

## Phase 2 — Data Supply (Commercial + Discovery)

| # | Task | Dimension | Effort |
|---|------|-----------|--------|
| 6 | Employer onboarding + job posting flow | D01, D10 | Large |
| 7 | Mentor onboarding + mentor profile creation | D10 | Large |
| 8 | Mentor booking + availability routing | D10 | Medium |
| 9 | Job application pipeline (user → job → employer) | D01 | Medium |
| 10 | Employer-jobs route activation (recruiter-postings.ts → real data) | D01 | Small |

---

## Phase 3 — Intelligence Activation

| # | Task | Dimension | Effort |
|---|------|-----------|--------|
| 11 | Wire career_recommendations to career profile (user_id bridge) | D03 | Medium |
| 12 | Surface PIL intervention library in Career Builder next-actions | D03, D09 | Medium |
| 13 | Activate behavioural memory snapshots → progressLedger → career-memory UI | D07, D09 | Medium |
| 14 | Wire outcome attribution engine to real snapshot history | D06 | Medium |
| 15 | Replace static genome/workforce/success data with DB-backed sources | D01, D09 | Large |

---

## Phase 4 — Enrichment (Coverage 95% target)

| # | Task | Dimension | Effort |
|---|------|-----------|--------|
| 16 | Add career report export (PDF / email) surface for users | D08 | Medium |
| 17 | Expand M3 market data beyond 5 seed roles | D05 | Large |
| 18 | Persist EI scores (create user_employability_scores table) | D02, D08 | Small |
| 19 | IDP engine → DB-backed (career_growth_plan_actions persistence) | D04 | Medium |
| 20 | Competency V2 contextual DNA flag-on (default users) | D02 | Small |

---

## Coverage Projection by Phase

| After Phase | Estimated Coverage | Estimated Confidence |
|-------------|-------------------|---------------------|
| Baseline now | ${coverageAvg}% | ${confidenceAvg}% |
| After Phase 1 (repairs) | ~50% | ~25% |
| After Phase 2 (supply) | ~60% | ~40% |
| After Phase 3 (intelligence) | ~78% | ~55% |
| After Phase 4 (enrichment) | ~93% | ~65% |

> Note: Coverage projections are DIRECTIONAL estimates based on structural gap count,  
> not guaranteed outcomes. Each phase's ceiling depends on preceding phases being complete.

---

## Out-of-Scope for this Roadmap
- CAPADEX engine improvements (covered by WC-P1/P2/P3 series)
- PIL knowledge graph expansion (covered by Phase 8 follow-up task)
- A/B test framework / rollout strategy
- Third-party integrations (LinkedIn, GitHub inference — see §8.2 of docs/CAREER_BUILDER.md)
`);

  console.log('\n[WC-P3] All files written to backend/audit/wc-p3/');
  console.log(`  Structural Coverage: ${coverageAvg}%`);
  console.log(`  Activation Confidence: ${confidenceAvg}%`);
  console.log(`  Overall Verdict: ${overallVerdict}`);
  console.log(`  Dimensions: READY=${readyCount} PARTIAL=${partialCount} STUB=${stubCount} EMPTY=${emptyCount}`);
  console.log(`  DB tables with data: ${populatedTables.length}/${CAREER_TABLES.length}`);
  console.log(`  Auth surface issues: ${noAuthRoutes.length} routes missing requireAuth`);
  await pool.end();
}

main().catch(e => { console.error('[WC-P3] FATAL:', e); process.exit(1); });
