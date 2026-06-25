/**
 * Competency Assessment Runtime
 *
 * Implements the 7 endpoints the AssessmentTab in CareerBuilderPage.tsx
 * was calling against — all of which previously returned 404, silently
 * discarding every submission. Pure persistence + derived analytics; no
 * Phase 1–5 ontology coupling (Phase 1 ontology is read-only and richer
 * but the assessment question bank uses its own short codes COGxx / COMxx
 * / LEAxx / EXExx / ADPxx / TECxx / EIQxx).
 *
 * Endpoints (all under /api/competency/):
 *   POST profile/:userId           — upsert role/target/industry/stage
 *   POST run-assessment            — body: { userId, scores: [...] }
 *   GET  compute-score/:userId     — aggregated overall + per-domain
 *   GET  get-percentile/:userId    — per-competency percentile vs cohort
 *   GET  gap-analysis/:userId      — gaps vs anchors + strengths
 *   GET  role-fit/:userId          — fit % + readiness + top gaps
 *   GET  interventions/:userId     — learning recs per gap
 *
 * Storage: two append-tolerant tables auto-created on registration:
 *   cra_profiles  (1 row per user)
 *   cra_scores    (append-only; latest row per (user, comp) = current)
 *
 * Bridges into Phase 1–5: the existing /api/career/assessment/snapshot
 * is invoked client-side immediately after run-assessment, so longitudinal
 * + benchmark dashboards continue to receive the same scoreMap. This file
 * is intentionally not coupled to that pipeline.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isAdaptiveDifficultyActivationEnabled } from '../config/feature-flags';
import {
  DEFAULT_READINESS_BANDS,
  levelAwareReadinessBands,
  classifyReadiness,
} from '../services/adaptive-difficulty-activation';
import { resolveBestOntRole, getRoleCompetencies } from '../services/role-crosswalk.js';
import { isCompetencyRuntimeEnabled } from '../config/feature-flags.js';
import { resolveUnifiedCompetencyProfile } from '../services/competency-intelligence-contracts.js';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSION = '1.0.0';
const VALID_STAGES = new Set(['junior', 'mid', 'senior', 'lead', 'director']);

/**
 * Resolve the authenticated caller's id. Frontends pass `userId` in the
 * URL/body but the *only* source of truth is the session — this prevents
 * IDOR (any logged-in user reading/writing another user's competency data).
 */
function callerId(req: Request): string | null {
  const u = (req as any).user;
  if (!u) return null;
  return String(u.id ?? u.userId ?? u.sub ?? '') || null;
}

const COMPETENCY_META: Record<string, { name: string; domainCode: string; domainName: string }> = {
  COG01: { name: 'Critical Thinking',       domainCode: 'COG', domainName: 'Cognitive & Analytical' },
  COG02: { name: 'Problem Solving',         domainCode: 'COG', domainName: 'Cognitive & Analytical' },
  COG03: { name: 'Analytical Reasoning',    domainCode: 'COG', domainName: 'Cognitive & Analytical' },
  COG04: { name: 'Decision Making',         domainCode: 'COG', domainName: 'Cognitive & Analytical' },
  COM01: { name: 'Verbal Communication',    domainCode: 'COM', domainName: 'Communication' },
  COM02: { name: 'Written Communication',   domainCode: 'COM', domainName: 'Communication' },
  COM04: { name: 'Active Listening',        domainCode: 'COM', domainName: 'Communication' },
  LEA01: { name: 'Team Leadership',         domainCode: 'LEA', domainName: 'Leadership & Initiative' },
  LEA03: { name: 'Coaching & Mentoring',    domainCode: 'LEA', domainName: 'Leadership & Initiative' },
  LEA05: { name: 'Change Leadership',       domainCode: 'LEA', domainName: 'Leadership & Initiative' },
  EXE01: { name: 'Project Management',      domainCode: 'EXE', domainName: 'Execution & Delivery' },
  EXE02: { name: 'Accountability',          domainCode: 'EXE', domainName: 'Execution & Delivery' },
  ADP01: { name: 'Learning Agility',        domainCode: 'ADP', domainName: 'Adaptability & Growth' },
  ADP02: { name: 'Resilience',              domainCode: 'ADP', domainName: 'Adaptability & Growth' },
  ADP03: { name: 'Innovation Mindset',      domainCode: 'ADP', domainName: 'Adaptability & Growth' },
  TEC01: { name: 'Technical Expertise',     domainCode: 'TEC', domainName: 'Technical & Domain' },
  TEC02: { name: 'Digital Fluency',         domainCode: 'TEC', domainName: 'Technical & Domain' },
  EIQ01: { name: 'Self-Awareness',          domainCode: 'EIQ', domainName: 'Emotional & Social Intelligence' },
  EIQ02: { name: 'Self-Regulation',         domainCode: 'EIQ', domainName: 'Emotional & Social Intelligence' },
  EIQ05: { name: 'Conflict Resolution',     domainCode: 'EIQ', domainName: 'Emotional & Social Intelligence' },
};

const metaFor = (code: string) =>
  COMPETENCY_META[code] ?? { name: code, domainCode: code.slice(0, 3), domainName: 'Other' };

// Real (non-fabricated) taxonomy denominators for the Coverage axis.
const TAXONOMY_TOTAL_COMPETENCIES = Object.keys(COMPETENCY_META).length;
const TAXONOMY_TOTAL_DOMAINS = new Set(Object.values(COMPETENCY_META).map((m) => m.domainCode)).size;

// T8 — end-user honesty axes. Coverage (breadth measured) and Confidence
// (trustworthiness) are SEPARATE axes (never composited). Both are derived
// honestly from real data; nothing is fabricated. NULL/unmeasured is never 0.
function buildReliability(scores: ScoreRow[]) {
  const competenciesScored = scores.length;
  const domainsCovered = new Set(scores.map((s) => metaFor(s.competency_code).domainCode)).size;
  const coveragePct = TAXONOMY_TOTAL_COMPETENCIES > 0
    ? Math.round((competenciesScored / TAXONOMY_TOTAL_COMPETENCIES) * 100)
    : 0;
  const meanConfidence = competenciesScored > 0
    ? Math.round(
        (scores.reduce((a, s) => a + (Number.isFinite(s.confidence) ? s.confidence : 0), 0) /
          competenciesScored) * 100,
      ) / 100
    : null; // null = not measured (never 0)
  let confidenceBand: 'high' | 'moderate' | 'low' | 'unmeasured' = 'unmeasured';
  if (meanConfidence != null) {
    confidenceBand = meanConfidence >= 0.8 ? 'high' : meanConfidence >= 0.6 ? 'moderate' : 'low';
  }
  return {
    coverage: {
      competencies_scored: competenciesScored,
      total_competencies: TAXONOMY_TOTAL_COMPETENCIES,
      domains_covered: domainsCovered,
      total_domains: TAXONOMY_TOTAL_DOMAINS,
      coverage_pct: coveragePct,
      label: 'How much of the competency framework your assessment actually measured.',
    },
    confidence: {
      mean: meanConfidence,
      band: confidenceBand,
      basis: 'response_confidence_captured_at_submission',
      label: 'How trustworthy those measurements are.',
      note: meanConfidence == null
        ? 'No competencies measured yet — confidence is unmeasured, not zero.'
        : 'Confidence reflects response confidence captured during the assessment, not external psychometric validation.',
    },
  };
}

// Per-stage anchor — what a competent person at this stage typically scores.
const STAGE_ANCHOR: Record<string, number> = {
  junior: 55, mid: 65, senior: 75, lead: 80, director: 85,
};

// Per-role critical competencies (uses our short codes). Anything not listed
// gets default weight 1.0; listed codes get weight 1.5 so gaps there are
// flagged louder.
const ROLE_PRIORITIES: Record<string, string[]> = {
  'Software Engineer':   ['COG02', 'TEC01', 'TEC02', 'EXE01', 'ADP01'],
  'Product Manager':     ['COG04', 'COM01', 'COM02', 'LEA05', 'EIQ01'],
  'Data Analyst':        ['COG01', 'COG03', 'TEC02', 'COM02'],
  'Team Lead':           ['LEA01', 'LEA03', 'EIQ05', 'EXE01', 'COM01'],
  'Director':            ['LEA01', 'LEA05', 'EIQ01', 'COG04', 'COM01'],
  'Consultant':          ['COG01', 'COG04', 'COM01', 'COM02', 'EIQ05'],
  'Business Analyst':    ['COG01', 'COG03', 'COM02', 'EXE02'],
  'UX Designer':         ['ADP03', 'COM01', 'EIQ01', 'COG02'],
  'DevOps Engineer':     ['TEC01', 'TEC02', 'EXE02', 'COG02'],
  'Marketing Manager':   ['COM01', 'COM02', 'ADP03', 'LEA01', 'COG04'],
};

// ── Task #136 — candidate CRA → competency-granularity ledger bridge ─────────
// Precise per-competency scores only surface once a subject has a
// competency-tagged run in `onto_competency_score_runs`. The candidate-facing
// assessment writes ONLY domain-grained CRA rows (cra_scores), so that section
// stayed hidden for live candidates. This crosswalk lets the genuinely-measured
// per-competency CRA scores become real genome-competency (comp_*) scores.
//
// HONESTY RULE: a CRA code is mapped ONLY when its competency is unambiguously
// the SAME construct as a real `onto_competencies` row. Two kinds of mappings
// qualify, both verified by hand against the live genome:
//   1. EXACT name match modulo hyphenation/case (the original 12).
//   2. CURATED synonym match — a different name for the SAME construct (Task #143;
//      e.g. "Analytical Reasoning" == genome "Analytical Thinking"). These are
//      human-verified, not lexical guesses, and the comp_* is re-verified to exist
//      at write time so a stale mapping is silently skipped rather than fabricated.
//
// DOCUMENTED OMISSIONS (Task #143) — three CRA codes are intentionally NOT mapped
// because the genome has no genuine equivalent, only broader-or-different
// constructs that mapping would misrepresent. They still appear in the domain
// breakdown but are never CLAIMED as a precise competency measurement:
//   • COM01 Verbal Communication — genome has only the umbrella "Communication"
//     (broader) and channel-specific "Written Communication"; there is no verbal/
//     oral competency, so a map would conflate a channel with the umbrella.
//   • LEA05 Change Leadership — genome has "Change Management" and "Change
//     Advocacy", which are distinct constructs (leading vs. implementing change).
//   • TEC02 Digital Fluency — genome has only "Technology Adoption" (embracing new
//     tech), a different construct from fluency/proficiency with digital tools.
const CRA_CODE_TO_COMP: Record<string, string> = {
  // ── Exact name matches (original 12) ──────────────────────────────────────
  COG01: 'comp_critical_thinking',      // Critical Thinking
  COG02: 'comp_problem_solving',        // Problem Solving  == genome "Problem-Solving"
  COG04: 'comp_decision_making',        // Decision Making  == genome "Decision-Making"
  COM02: 'comp_written_communication',  // Written Communication
  COM04: 'comp_active_listening',       // Active Listening
  LEA01: 'comp_team_leadership',        // Team Leadership
  EXE01: 'comp_project_management',     // Project Management
  EXE02: 'comp_accountability',         // Accountability
  ADP01: 'comp_learning_agility',       // Learning Agility
  ADP02: 'comp_resilience',             // Resilience
  EIQ01: 'comp_self_awareness',         // Self-Awareness
  EIQ05: 'comp_conflict_resolution',    // Conflict Resolution
  // ── Curated synonym matches (Task #143) — same construct, different name ───
  COG03: 'comp_analytical_thinking',    // Analytical Reasoning == genome "Analytical Thinking"
  ADP03: 'comp_innovation',             // Innovation Mindset   == genome "Innovation"
  EIQ02: 'comp_emotional_regulation',   // Self-Regulation      == genome "Emotional Regulation" (Goleman EI)
  TEC01: 'comp_technical_competence',   // Technical Expertise  == genome "Technical Competence"
  LEA03: 'comp_coaching',               // Coaching & Mentoring == genome "Coaching" (dominant construct)
};

// Task #160 — competencies measured in the broader (domain-grained) CRA
// assessment but NOT yet available on the precise (per-competency) scale,
// because the genome has no genuine equivalent (see DOCUMENTED OMISSIONS above).
// Derived from the crosswalk so the count is always honest and self-updating:
// any COMPETENCY_META code without a CRA_CODE_TO_COMP entry is, by definition,
// measured by the assessment yet absent from the precise ledger. Currently
// COM01 (Verbal Communication), LEA05 (Change Leadership), TEC02 (Digital
// Fluency). Surfaced to the candidate as an honest note so the 17/20 precise
// section never looks like data is missing or broken.
const NOT_ON_PRECISE_SCALE: Array<{ code: string; name: string; domainName: string }> =
  Object.entries(COMPETENCY_META)
    .filter(([code]) => !(code in CRA_CODE_TO_COMP))
    .map(([code, meta]) => ({ code, name: meta.name, domainName: meta.domainName }));

// Canonical proficiency labels (onto_proficiency_levels) — derived from the
// deterministic 0..100 → 1..5 band below. Used only to label measured scores.
const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Awareness',
  2: 'Basic Application',
  3: 'Independent Application',
  4: 'Advanced Application',
  5: 'Expert / Strategic Application',
};

// 0..100 score → 1..5 level band. Mirrors competency-runtime.scoreToLevel
// EXACTLY; kept local so this module stays decoupled from the Phase-2 engine.
function scoreToLevel(score: number): number {
  if (score >= 80) return 5;
  if (score >= 60) return 4;
  if (score >= 40) return 3;
  if (score >= 20) return 2;
  return 1;
}

/**
 * Resolve the subject key used by the competency ledgers (the caller's EMAIL).
 * The onto_* ledgers key a subject by email; the session `username` is the email
 * in this system, with a DB lookup fallback. This is the SAME resolution the
 * precise-scores read endpoint uses, so the write subject and the read subject
 * always match (no silent split-brain where the candidate can't see their run).
 */
async function resolveSubjectEmail(pool: Pool, req: Request, auth: string): Promise<string | null> {
  let subject: string | null = ((req as any).user?.username as string | undefined) ?? null;
  if (!subject || !subject.includes('@')) {
    const u = await pool
      .query<{ email: string | null; username: string | null }>(
        `SELECT email, username FROM users WHERE id = $1 LIMIT 1`,
        [auth],
      )
      .catch(() => ({ rows: [] as { email: string | null; username: string | null }[] }));
    subject = u.rows[0]?.email ?? u.rows[0]?.username ?? subject;
  }
  return subject;
}

/**
 * Task #136 — write the genuinely-measured per-competency CRA scores to the
 * competency-granularity ledger (`onto_competency_score_runs`) as ONE append-only
 * run keyed by the subject's email, so resolveUnifiedCompetencyProfile surfaces
 * them and the candidate sees the Precise Competency Scores section WITHOUT any
 * manual seeding.
 *
 *   • Honesty — a precise score is written ONLY for a competency the candidate
 *     genuinely answered AND that exists in onto_competencies (re-verified here).
 *     Unmapped/absent competencies are skipped; nothing is fabricated and no
 *     value is coerced to 0.
 *   • Additive + reversible — one new run row (the resolver reads the LATEST per
 *     subject, mirroring the rich scorer's one-row-per-scoring convention). No
 *     existing rows are mutated; deleting the row restores prior behaviour.
 *   • Flag-gated by the CALLER (competencyRuntime) so flag-OFF is byte-identical.
 */
async function writeCandidatePreciseRun(
  pool: Pool,
  subject: string,
  measured: Array<{ code: string; raw: number }>,
): Promise<{ written: boolean; competencies: number }> {
  // CRA code → genome comp_* (verified crosswalk). Last write wins per comp.
  const byComp = new Map<string, number>();
  for (const m of measured) {
    const compId = CRA_CODE_TO_COMP[m.code];
    if (!compId) continue;
    byComp.set(compId, m.raw);
  }
  if (byComp.size === 0) return { written: false, competencies: 0 };

  // Re-verify each comp_* exists in the genome NOW and pull its canonical name.
  // Only verified competencies are written (guards against crosswalk drift).
  const ids = [...byComp.keys()];
  const nameRes = await pool.query<{ id: string; canonical_name: string }>(
    `SELECT id, canonical_name FROM onto_competencies WHERE id = ANY($1::text[])`,
    [ids],
  );
  const nameById = new Map(nameRes.rows.map((r) => [r.id, r.canonical_name]));

  const runComps: Array<Record<string, unknown>> = [];
  for (const [compId, raw] of byComp) {
    const name = nameById.get(compId);
    if (!name) continue; // not in genome anymore → skip (never fabricate)
    const score = Math.round(raw * 10) / 10;
    const level = scoreToLevel(score);
    runComps.push({
      competency_id: compId,
      competency_name: name,
      normalized_score: score,
      normalization_basis: 'cra_option_score',
      level,
      level_label: PROFICIENCY_LABELS[level] ?? null,
      level_status: 'measured',
      item_count: 1,
      measurement: 'precise',
    });
  }
  if (runComps.length === 0) return { written: false, competencies: 0 };

  const overallScore =
    Math.round((runComps.reduce((s, c) => s + (c.normalized_score as number), 0) / runComps.length) * 10) / 10;
  const overallLevel = scoreToLevel(overallScore);

  await pool.query(
    `INSERT INTO onto_competency_score_runs
       (assessment_id, blueprint_id, subject_id, total_questions, scored_questions,
        competency_scores, overall, normalization, status, source)
     VALUES (NULL, NULL, $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, 'scored', 'candidate_cra_crosswalk')`,
    [
      subject,
      measured.length,
      runComps.length,
      JSON.stringify(runComps),
      JSON.stringify({
        overall_score: overallScore,
        overall_level: overallLevel,
        competencies_scored: runComps.length,
        measurement: 'precise',
      }),
      JSON.stringify({
        basis: 'cra_option_score',
        note:
          'Per-competency scores from the candidate CRA assessment, mapped to genome ' +
          'competencies via a verified exact-name crosswalk (authored option scores).',
      }),
    ],
  );
  return { written: true, competencies: runComps.length };
}

interface ScoreRow {
  competency_code: string;
  raw_score: number;
  confidence: number;
}

interface ProfileRow {
  current_role: string | null;
  target_role: string | null;
  industry: string | null;
  career_stage: string | null;
  experience_years: number | null;
}

async function ensureSchema(pool: Pool) {
  // NOTE: `current_role` / `target_role` are PostgreSQL reserved keywords
  // (CURRENT_ROLE is a session-function). We use `current_role_label` /
  // `target_role_label` to sidestep parse errors entirely.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cra_profiles (
      user_id            TEXT PRIMARY KEY,
      current_role_label TEXT,
      target_role_label  TEXT,
      industry           TEXT,
      career_stage       TEXT,
      experience_years   INTEGER,
      updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // Additive context fields (Phase 2/6/7/8 inputs). All nullable.
  const addCols: Array<[string, string]> = [
    ['org_layer',                 'TEXT'],
    ['org_maturity',              'TEXT'],
    ['team_size_band',            'TEXT'],
    ['work_arrangement',          'TEXT'],
    ['tenure_months',             'INTEGER'],
    ['geography',                 'TEXT'],
    ['age_band',                  'TEXT'],
    ['gender',                    'TEXT'],
    ['education_level',           'TEXT'],
    ['current_department',        'TEXT'],
    ['current_sub_department',    'TEXT'],
    ['target_department',         'TEXT'],
    ['target_sub_department',     'TEXT'],
    ['target_timeline',           'TEXT'],
    ['current_responsibilities',  'TEXT'],
    ['target_responsibilities',   'TEXT'],
    ['primary_skills',            'TEXT'],
  ];
  for (const [name, type] of addCols) {
    await pool.query(`ALTER TABLE cra_profiles ADD COLUMN IF NOT EXISTS ${name} ${type}`);
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cra_scores (
      id               BIGSERIAL PRIMARY KEY,
      user_id          TEXT NOT NULL,
      competency_code  TEXT NOT NULL,
      raw_score        INTEGER NOT NULL,
      confidence       REAL NOT NULL DEFAULT 1.0,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cra_scores_user_comp ON cra_scores (user_id, competency_code, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_cra_scores_comp ON cra_scores (competency_code)`);
}

async function getProfile(pool: Pool, userId: string): Promise<ProfileRow> {
  const r = await pool.query<{ current_role_label: string | null; target_role_label: string | null; industry: string | null; career_stage: string | null; experience_years: number | null }>(
    `SELECT current_role_label, target_role_label, industry, career_stage, experience_years
       FROM cra_profiles WHERE user_id = $1`,
    [userId],
  );
  const row = r.rows[0];
  if (!row) {
    return { current_role: null, target_role: null, industry: null, career_stage: 'mid', experience_years: null };
  }
  return {
    current_role: row.current_role_label,
    target_role: row.target_role_label,
    industry: row.industry,
    career_stage: row.career_stage,
    experience_years: row.experience_years,
  };
}

async function getLatestScores(pool: Pool, userId: string): Promise<ScoreRow[]> {
  const r = await pool.query<ScoreRow>(
    `SELECT DISTINCT ON (competency_code)
            competency_code, raw_score, confidence
       FROM cra_scores
      WHERE user_id = $1
      ORDER BY competency_code, created_at DESC`,
    [userId],
  );
  return r.rows;
}

function envelope(data: unknown, extra: Record<string, unknown> = {}) {
  return { success: true, data, version: VERSION, ...extra };
}

export function registerCompetencyAssessmentRuntime(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;
  // Init schema synchronously-as-promise; log success/failure visibly.
  let schemaReady: Promise<void> = ensureSchema(pool)
    .then(() => console.log('[cra] schema ready (cra_profiles, cra_scores)'))
    .catch(err => { console.error('[cra] schema init FAILED:', err?.message ?? err); throw err; });
  // Gate every request on schema readiness (re-tries on failure).
  const gate = async () => {
    try { await schemaReady; }
    catch { schemaReady = ensureSchema(pool); await schemaReady; }
  };

  // ── POST /api/competency/profile/:userId ─────────────────────────────────
  // Note: path `:userId` is accepted for backward compatibility with the
  // existing frontend, but it MUST equal the authenticated caller — the
  // request acts on the session user, never the URL user.
  app.post('/api/competency/profile/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      await gate();
      const auth = callerId(req);
      if (!auth) return res.status(401).json({ success: false, error: 'unauthenticated' });
      if (req.params.userId && req.params.userId !== auth) {
        return res.status(403).json({ success: false, error: 'cannot write another user\u2019s profile' });
      }
      const userId = auth;
      const b = req.body ?? {};
      const { currentRole, targetRole, industry, careerStage, experienceYears } = b;
      const stage = careerStage && VALID_STAGES.has(String(careerStage)) ? String(careerStage) : null;
      const expYears = Number.isFinite(+experienceYears) ? Math.max(0, Math.min(80, Math.round(+experienceYears))) : null;
      const safeStr = (v: unknown, max = 120) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
      const tenureMonths = Number.isFinite(+b.tenureMonths) ? Math.max(0, Math.min(720, Math.round(+b.tenureMonths))) : null;
      await pool.query(
        `INSERT INTO cra_profiles
           (user_id, current_role_label, target_role_label, industry, career_stage, experience_years,
            org_layer, org_maturity, team_size_band, work_arrangement, tenure_months,
            geography, age_band, gender, education_level,
            current_department, current_sub_department, target_department, target_sub_department,
            target_timeline, current_responsibilities, target_responsibilities, primary_skills,
            updated_at)
         VALUES ($1,$2,$3,$4,$5,$6, $7,$8,$9,$10,$11, $12,$13,$14,$15, $16,$17,$18,$19, $20,$21,$22,$23, now())
         ON CONFLICT (user_id) DO UPDATE SET
           current_role_label       = EXCLUDED.current_role_label,
           target_role_label        = EXCLUDED.target_role_label,
           industry                 = EXCLUDED.industry,
           career_stage             = EXCLUDED.career_stage,
           experience_years         = EXCLUDED.experience_years,
           org_layer                = EXCLUDED.org_layer,
           org_maturity             = EXCLUDED.org_maturity,
           team_size_band           = EXCLUDED.team_size_band,
           work_arrangement         = EXCLUDED.work_arrangement,
           tenure_months            = EXCLUDED.tenure_months,
           geography                = EXCLUDED.geography,
           age_band                 = EXCLUDED.age_band,
           gender                   = EXCLUDED.gender,
           education_level          = EXCLUDED.education_level,
           current_department       = EXCLUDED.current_department,
           current_sub_department   = EXCLUDED.current_sub_department,
           target_department        = EXCLUDED.target_department,
           target_sub_department    = EXCLUDED.target_sub_department,
           target_timeline          = EXCLUDED.target_timeline,
           current_responsibilities = EXCLUDED.current_responsibilities,
           target_responsibilities  = EXCLUDED.target_responsibilities,
           primary_skills           = EXCLUDED.primary_skills,
           updated_at               = now()`,
        [
          userId, safeStr(currentRole), safeStr(targetRole), safeStr(industry), stage, expYears,
          safeStr(b.orgLayer, 40), safeStr(b.orgMaturity, 40), safeStr(b.teamSize, 40), safeStr(b.workArrangement, 40), tenureMonths,
          safeStr(b.geography, 60), safeStr(b.ageBand, 20), safeStr(b.gender, 40), safeStr(b.educationLevel, 60),
          safeStr(b.currentDepartment, 120), safeStr(b.currentSubDepartment, 120), safeStr(b.targetDepartment, 120), safeStr(b.targetSubDepartment, 120),
          safeStr(b.targetTimeline, 40), safeStr(b.currentResponsibilities, 2000), safeStr(b.targetResponsibilities, 2000), safeStr(b.primarySkills, 1000),
        ],
      );
      res.json(envelope({ saved: true }));
    } catch (e: any) {
      console.error('[cra] profile save failed:', e);
      res.status(500).json({ success: false, error: e?.message ?? 'profile_save_failed' });
    }
  });

  // ── POST /api/competency/run-assessment ──────────────────────────────────
  app.post('/api/competency/run-assessment', requireAuth, async (req: Request, res: Response) => {
    try {
      await gate();
      const auth = callerId(req);
      if (!auth) return res.status(401).json({ success: false, error: 'unauthenticated' });
      const { userId: bodyUserId, scores } = req.body ?? {};
      if (bodyUserId && String(bodyUserId) !== auth) {
        return res.status(403).json({ success: false, error: 'cannot submit scores for another user' });
      }
      const userId = auth;
      if (!Array.isArray(scores) || scores.length === 0 || scores.length > 200) {
        return res.status(400).json({ success: false, error: 'scores[] required (1..200 items)' });
      }
      const attemptAt = new Date();
      const values: string[] = [];
      const params: unknown[] = [];
      const validated: Array<{ code: string; raw: number }> = [];
      let p = 1;
      let skipped = 0;
      for (const s of scores) {
        const code = String(s?.competencyCode ?? s?.code ?? '').trim().toUpperCase();
        const rawNum = Number(s?.rawScore ?? s?.score);
        const confNum = Number(s?.confidence ?? 1);
        // Allowlist: known codes from assessment-questions.ts only.
        if (!code || !(code in COMPETENCY_META)) { skipped++; continue; }
        if (!Number.isFinite(rawNum) || rawNum < 0 || rawNum > 100) { skipped++; continue; }
        const raw = Math.round(rawNum);
        const conf = Math.max(0, Math.min(1, Number.isFinite(confNum) ? confNum : 1));
        values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
        params.push(userId, code, raw, conf, attemptAt);
        validated.push({ code, raw });
      }
      if (params.length === 0) {
        return res.status(400).json({ success: false, error: 'no valid scores (unknown codes or out-of-range values)' });
      }
      await pool.query(
        `INSERT INTO cra_scores (user_id, competency_code, raw_score, confidence, created_at)
         VALUES ${values.join(', ')}`,
        params,
      );

      // Task #136 — additively bridge the genuinely-measured per-competency CRA
      // scores into the competency-granularity ledger so the candidate sees the
      // Precise Competency Scores section without manual seeding. Flag-gated
      // (mirrors the precise-scores read endpoint) so flag-OFF stays
      // byte-identical (the `precise` field is omitted entirely), and
      // never-throws: a failure here must NOT fail the candidate's submission
      // (cra_scores are already persisted above).
      let precise: { written: boolean; competencies: number } | undefined;
      if (isCompetencyRuntimeEnabled()) {
        precise = { written: false, competencies: 0 };
        try {
          const subject = await resolveSubjectEmail(pool, req, auth);
          if (subject) {
            precise = await writeCandidatePreciseRun(pool, subject, validated);
          }
        } catch (e: any) {
          console.error('[cra] precise-run bridge failed (non-fatal):', e?.message ?? e);
        }
      }

      res.json(envelope({
        saved: params.length / 5,
        skipped,
        attemptAt: attemptAt.toISOString(),
        ...(precise ? { precise } : {}),
      }));
    } catch (e: any) {
      console.error('[cra] run-assessment failed:', e);
      res.status(500).json({ success: false, error: e?.message ?? 'run_assessment_failed' });
    }
  });

  // ── GET /api/competency/compute-score/:userId ────────────────────────────
  app.get('/api/competency/compute-score/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      await gate();
      const auth = callerId(req);
      if (!auth) return res.status(401).json({ success: false, error: 'unauthenticated' });
      if (req.params.userId && req.params.userId !== auth) {
        return res.status(403).json({ success: false, error: 'forbidden' });
      }
      const userId = auth;
      const [profile, scores] = await Promise.all([getProfile(pool, userId), getLatestScores(pool, userId)]);

      const profileCamel = {
        currentRole: profile.current_role,
        targetRole: profile.target_role,
        careerStage: profile.career_stage,
        industry: profile.industry,
      };
      // T8 — flag-gated honesty axes (Coverage vs Confidence). Flag OFF =>
      // field omitted entirely => byte-identical legacy payload.
      const reliability = isCompetencyRuntimeEnabled() ? buildReliability(scores) : undefined;
      if (scores.length === 0) {
        return res.json({
          overallScore: 0,
          totalCompetencies: 0,
          profile: profileCamel,
          domains: [],
          ...(reliability ? { reliability } : {}),
        });
      }

      // Group by domain
      const byDomain = new Map<string, { domainCode: string; domainName: string; scores: number[]; comps: any[] }>();
      for (const s of scores) {
        const m = metaFor(s.competency_code);
        if (!byDomain.has(m.domainCode)) {
          byDomain.set(m.domainCode, { domainCode: m.domainCode, domainName: m.domainName, scores: [], comps: [] });
        }
        const d = byDomain.get(m.domainCode)!;
        d.scores.push(s.raw_score);
        d.comps.push({
          competencyCode: s.competency_code,
          competencyName: m.name,
          finalScore: s.raw_score,
          confidence: s.confidence,
        });
      }

      const domains = Array.from(byDomain.values()).map(d => ({
        domainCode: d.domainCode,
        domainName: d.domainName,
        avgScore: Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length),
        competencies: d.comps,
      }));

      const overall = Math.round(scores.reduce((a, b) => a + b.raw_score, 0) / scores.length);

      res.json({
        overallScore: overall,
        totalCompetencies: scores.length,
        profile: profileCamel,
        domains,
        ...(reliability ? { reliability } : {}),
      });
    } catch (e: any) {
      console.error('[cra] compute-score failed:', e);
      res.status(500).json({ success: false, error: e?.message ?? 'compute_score_failed' });
    }
  });

  // ── GET /api/competency/precise-scores ───────────────────────────────────
  // Task #131 — surface PRECISE per-competency scores to the candidate.
  // The candidate's domain-level scores already render in compute-score (CRA
  // bank). When a competency-tagged scoring run exists for this subject
  // (onto_competency_score_runs comp_*), the unified profile resolver also
  // carries precise per-competency scores; this endpoint exposes them so the
  // candidate sees them with an explicit precise-vs-domain-proxy label.
  //
  //   • Read-only — composes resolveUnifiedCompetencyProfile, no scoring math.
  //   • Self-only — subject derived from the SESSION (no :userId param → no
  //     IDOR). onto ledgers key the subject by EMAIL (== users.username here).
  //   • Flag-gated (competencyRuntime) — OFF → { enabled:false } so the
  //     frontend hides the section → byte-identical legacy behaviour.
  //   • Never fabricates — only MEASURED competencies appear; null = unmeasured
  //     (never a fabricated 0); empty → honest "no precise scores yet".
  app.get('/api/competency/precise-scores', requireAuth, async (req: Request, res: Response) => {
    try {
      const auth = callerId(req);
      if (!auth) return res.status(401).json({ success: false, error: 'unauthenticated' });
      if (!isCompetencyRuntimeEnabled()) {
        return res.json({ enabled: false, hasPrecise: false, precise: [], domains: [] });
      }
      // Resolve the caller's email server-side (onto subject key) using the SAME
      // resolution the candidate assessment write uses, so the read and write
      // subjects always match.
      const subject = await resolveSubjectEmail(pool, req, auth);
      if (!subject) {
        return res.json({ enabled: true, available: true, resolved: false, hasPrecise: false, precise: [], domains: [] });
      }

      const unified = await resolveUnifiedCompetencyProfile(pool, subject);
      const precise = unified.scores
        .filter((s) => s.granularity === 'competency' && s.score != null)
        .map((s) => ({
          code: s.key,
          name: s.label,
          score: s.score,
          level: s.level,
          levelLabel: s.levelLabel,
          status: s.status,
          measurement: 'precise' as const,
        }));
      const domains = unified.scores
        .filter((s) => s.granularity === 'domain' && s.score != null)
        .map((s) => ({
          code: s.key,
          name: s.label,
          score: s.score,
          level: s.level,
          measurement: 'domain_proxy' as const,
        }));

      return res.json({
        enabled: true,
        available: unified.available,
        resolved: unified.resolved,
        hasPrecise: precise.length > 0,
        precise,
        domains,
        // Task #160 — honestly disclose the competencies measured in the broader
        // assessment that have no genuine genome equivalent yet, so the precise
        // section doesn't look like data is missing. Never fabricated: names are
        // derived from the crosswalk gap, never given a score.
        notOnPreciseScale: NOT_ON_PRECISE_SCALE,
        notOnPreciseScaleCount: NOT_ON_PRECISE_SCALE.length,
        overall: unified.overallScore,
        overallSource: unified.overallSource,
        note: precise.length > 0
          ? 'Precise per-competency scores from your latest competency-tagged assessment. Only measured competencies are shown.'
          : 'No precise per-competency scores yet — domain-level (proxy) scores apply. Precise scores appear once a competency-tagged assessment is scored.',
        version: VERSION,
      });
    } catch (e: any) {
      console.error('[cra] precise-scores failed:', e);
      res.status(500).json({ success: false, error: e?.message ?? 'precise_scores_failed' });
    }
  });

  // ── GET /api/competency/get-percentile/:userId ───────────────────────────
  app.get('/api/competency/get-percentile/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      await gate();
      const auth = callerId(req);
      if (!auth) return res.status(401).json({ success: false, error: 'unauthenticated' });
      if (req.params.userId && req.params.userId !== auth) {
        return res.status(403).json({ success: false, error: 'forbidden' });
      }
      const userId = auth;
      const scores = await getLatestScores(pool, userId);
      if (scores.length === 0) return res.json({ overallPercentile: 0, percentiles: [] });

      // For each competency, compute the user's empirical percentile across
      // the latest score of every other user. Fallback to score-based pct
      // when cohort < 3 (still gives a deterministic, useful number).
      const percentiles = await Promise.all(scores.map(async (s) => {
        const m = metaFor(s.competency_code);
        const cohort = await pool.query<{ raw_score: number }>(
          `SELECT DISTINCT ON (user_id) raw_score
             FROM cra_scores
            WHERE competency_code = $1 AND user_id <> $2
            ORDER BY user_id, created_at DESC`,
          [s.competency_code, userId],
        );
        const samples = cohort.rows.map(r => r.raw_score);
        let pct: number;
        if (samples.length < 3) {
          // Score-based — 50 = P50, 75 = ~P78, 90 = ~P92
          pct = Math.max(1, Math.min(99, Math.round(s.raw_score)));
        } else {
          const below = samples.filter(x => x < s.raw_score).length;
          pct = Math.round((below / samples.length) * 100);
          pct = Math.max(1, Math.min(99, pct));
        }
        const label = pct >= 90 ? 'Top decile'
                    : pct >= 75 ? 'Top quartile'
                    : pct >= 50 ? 'Above median'
                    : pct >= 25 ? 'Below median'
                    : 'Developing';
        return {
          competencyCode: s.competency_code,
          competencyName: m.name,
          percentile: pct,
          percentileLabel: label,
          sampleSize: samples.length,
        };
      }));

      const overallPercentile = Math.round(
        percentiles.reduce((a, p) => a + p.percentile, 0) / percentiles.length,
      );
      res.json({ overallPercentile, percentiles });
    } catch (e: any) {
      console.error('[cra] get-percentile failed:', e);
      res.status(500).json({ success: false, error: e?.message ?? 'percentile_failed' });
    }
  });

  // ── GET /api/competency/gap-analysis/:userId ─────────────────────────────
  app.get('/api/competency/gap-analysis/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      await gate();
      const auth = callerId(req);
      if (!auth) return res.status(401).json({ success: false, error: 'unauthenticated' });
      if (req.params.userId && req.params.userId !== auth) {
        return res.status(403).json({ success: false, error: 'forbidden' });
      }
      const userId = auth;
      const [profile, scores] = await Promise.all([getProfile(pool, userId), getLatestScores(pool, userId)]);
      if (scores.length === 0) return res.json({ gaps: [], strengths: [], summary: { criticalCount: 0, highCount: 0, mediumCount: 0 } });

      const anchor = STAGE_ANCHOR[String(profile.career_stage ?? 'mid')] ?? 65;
      const priorityCodes = new Set(ROLE_PRIORITIES[String(profile.target_role ?? '')] ?? []);

      const enriched = scores.map(s => {
        const m = metaFor(s.competency_code);
        const isPriority = priorityCodes.has(s.competency_code);
        const targetAnchor = isPriority ? anchor + 8 : anchor;
        const gap = targetAnchor - s.raw_score;
        let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';
        if (gap >= 25) priority = 'critical';
        else if (gap >= 15) priority = 'high';
        else if (gap >= 5) priority = 'medium';
        return {
          competencyCode: s.competency_code,
          competencyName: m.name,
          domainName: m.domainName,
          finalScore: s.raw_score,
          userScore: s.raw_score,
          targetScore: targetAnchor,
          gap: Math.max(0, gap),
          priority,
          isRolePriority: isPriority,
        };
      });

      const gaps = enriched
        .filter(e => e.gap > 0)
        .sort((a, b) => b.gap - a.gap);
      const strengths = enriched
        .filter(e => e.finalScore >= anchor + 5)
        .sort((a, b) => b.finalScore - a.finalScore);

      const summary = {
        criticalCount: gaps.filter(g => g.priority === 'critical').length,
        highCount:     gaps.filter(g => g.priority === 'high').length,
        mediumCount:   gaps.filter(g => g.priority === 'medium').length,
      };

      res.json({ gaps, strengths, summary });
    } catch (e: any) {
      console.error('[cra] gap-analysis failed:', e);
      res.status(500).json({ success: false, error: e?.message ?? 'gap_analysis_failed' });
    }
  });

  // ── GET /api/competency/role-fit/:userId ─────────────────────────────────
  app.get('/api/competency/role-fit/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      await gate();
      const auth = callerId(req);
      if (!auth) return res.status(401).json({ success: false, error: 'unauthenticated' });
      if (req.params.userId && req.params.userId !== auth) {
        return res.status(403).json({ success: false, error: 'forbidden' });
      }
      const userId = auth;
      const [profile, scores] = await Promise.all([getProfile(pool, userId), getLatestScores(pool, userId)]);
      if (scores.length === 0) {
        return res.json({ roleFitProbability: 0, readinessLevel: 'No data', targetRole: profile.target_role, transition: null });
      }
      const target = String(profile.target_role ?? '');
      const priorityCodes = new Set(ROLE_PRIORITIES[target] ?? []);
      const anchor = STAGE_ANCHOR[String(profile.career_stage ?? 'mid')] ?? 65;

      // Weight priority competencies 1.5×, others 1.0
      let num = 0, den = 0;
      for (const s of scores) {
        const w = priorityCodes.has(s.competency_code) ? 1.5 : 1.0;
        num += s.raw_score * w;
        den += w;
      }
      const weighted = den > 0 ? num / den : 0;
      const fit = Math.max(0, Math.min(1, weighted / 100));

      // Adaptive Difficulty Activation (flag-gated): make the readiness ladder
      // level-aware so the SAME weighted score classifies differently by seniority
      // (junior gets a lower bar, director a higher one). Calibrated so senior
      // (anchor 75) reproduces the legacy fixed ladder exactly → flag-OFF, and
      // flag-ON for a senior, are byte-identical. OFF → DEFAULT_READINESS_BANDS
      // (85/72/58/45), identical to the prior literal cascade.
      const adaptiveOn = isAdaptiveDifficultyActivationEnabled();
      const readinessBands = adaptiveOn ? levelAwareReadinessBands(anchor) : DEFAULT_READINESS_BANDS;
      const readinessLevel = classifyReadiness(weighted, readinessBands);

      const topGaps = scores
        .map(s => ({ s, m: metaFor(s.competency_code), isPri: priorityCodes.has(s.competency_code) }))
        .filter(x => (x.isPri ? anchor + 8 : anchor) - x.s.raw_score > 0)
        .map(x => ({
          competencyCode: x.s.competency_code,
          competencyName: x.m.name,
          gap: (x.isPri ? anchor + 8 : anchor) - x.s.raw_score,
        }))
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 5);

      res.json({
        roleFitProbability: fit,
        readinessLevel,
        targetRole: profile.target_role,
        transition: {
          readinessScore: Math.round(weighted),
          topGaps,
        },
      });
    } catch (e: any) {
      console.error('[cra] role-fit failed:', e);
      res.status(500).json({ success: false, error: e?.message ?? 'role_fit_failed' });
    }
  });

  // ── GET /api/competency/interventions/:userId ────────────────────────────
  app.get('/api/competency/interventions/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      await gate();
      const auth = callerId(req);
      if (!auth) return res.status(401).json({ success: false, error: 'unauthenticated' });
      if (req.params.userId && req.params.userId !== auth) {
        return res.status(403).json({ success: false, error: 'forbidden' });
      }
      const userId = auth;
      const [profile, scores] = await Promise.all([getProfile(pool, userId), getLatestScores(pool, userId)]);
      if (scores.length === 0) return res.json({ interventions: [] });

      const anchor = STAGE_ANCHOR[String(profile.career_stage ?? 'mid')] ?? 65;
      const priorityCodes = new Set(ROLE_PRIORITIES[String(profile.target_role ?? '')] ?? []);

      const TYPE_BY_DOMAIN: Record<string, 'course' | 'practice' | 'project'> = {
        COG: 'course', COM: 'practice', LEA: 'practice',
        EXE: 'project', ADP: 'practice', TEC: 'course', EIQ: 'practice',
      };

      const interventions = scores
        .map(s => {
          const m = metaFor(s.competency_code);
          const isPri = priorityCodes.has(s.competency_code);
          const target = isPri ? anchor + 8 : anchor;
          const gap = target - s.raw_score;
          const gapLevel: 'critical' | 'high' | 'medium' | 'low' =
            gap >= 25 ? 'critical' : gap >= 15 ? 'high' : gap >= 5 ? 'medium' : 'low';
          return { s, m, gap, gapLevel, isPri };
        })
        .filter(x => x.gap >= 5)
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 8)
        .map(x => {
          const type = TYPE_BY_DOMAIN[x.m.domainCode] ?? 'course';
          const duration = x.gap >= 25 ? 8 : x.gap >= 15 ? 6 : 4;
          const verb = type === 'course' ? 'Master' : type === 'practice' ? 'Practice' : 'Apply';
          return {
            title: `${verb} ${x.m.name} — ${x.gapLevel} priority`,
            competency_name: x.m.name,
            competencyName: x.m.name,
            type,
            interventionType: type,
            duration_weeks: duration,
            durationWeeks: duration,
            gap_level: x.gapLevel,
            gapLevel: x.gapLevel,
            isRolePriority: x.isPri,
          };
        });

      res.json({ interventions });
    } catch (e: any) {
      console.error('[cra] interventions failed:', e);
      res.status(500).json({ success: false, error: e?.message ?? 'interventions_failed' });
    }
  });

  // ── GET /api/competency/role-library/:userId ─────────────────────────────
  // Crosswalk surface: resolve the caller's target role (or ?role= override) to
  // the shared ontology role library (ont_roles) and return the competencies it
  // requires, sourced from O*NET / curated starter rows via map_role_competency.
  //
  // The legacy ROLE_PRIORITIES map above only covers 10 hardcoded role labels;
  // every other target role previously surfaced ZERO role-specific competencies.
  // This endpoint draws competencies straight from the bigger imported library
  // (1016 O*NET occupations + curated starter roles) so any resolvable role —
  // not just the hardcoded ten — gets a real competency profile. Read-only and
  // honest: an unresolved role returns resolved:null; a rated-gap role returns
  // an empty competency list rather than fabricated requirements.
  app.get('/api/competency/role-library/:userId', requireAuth, async (req: Request, res: Response) => {
    try {
      await gate();
      const auth = callerId(req);
      if (!auth) return res.status(401).json({ success: false, error: 'unauthenticated' });
      if (req.params.userId && req.params.userId !== auth) {
        return res.status(403).json({ success: false, error: 'forbidden' });
      }
      const userId = auth;

      // Role to resolve: explicit ?role= wins, else profile target, else current.
      const queryRole = typeof req.query.role === 'string' ? req.query.role.trim() : '';
      const profile = await getProfile(pool, userId);
      const requestedRole = queryRole || profile.target_role || profile.current_role || '';

      if (!requestedRole) {
        return res.json(envelope({
          requestedRole: null,
          resolved: null,
          requiredCompetencies: [],
          counts: { total: 0, core: 0, secondary: 0 },
          note: 'No target/current role on profile and no ?role= provided.',
        }));
      }

      const match = await resolveBestOntRole(pool, requestedRole);
      if (!match) {
        return res.json(envelope({
          requestedRole,
          resolved: null,
          requiredCompetencies: [],
          counts: { total: 0, core: 0, secondary: 0 },
          note: 'Role did not resolve to any role in the ontology library.',
        }));
      }

      const competencies = await getRoleCompetencies(pool, match.code);
      const core = competencies.filter(c => c.importanceTier === 'core').length;

      res.json(envelope({
        requestedRole,
        resolved: {
          code: match.code,
          title: match.title,
          matchType: match.matchType,
          source: match.source,
        },
        requiredCompetencies: competencies,
        counts: { total: competencies.length, core, secondary: competencies.length - core },
        note: competencies.length === 0
          ? 'Role resolved but carries no competency ratings in the library (O*NET coverage gap).'
          : undefined,
      }));
    } catch (e: any) {
      console.error('[cra] role-library failed:', e);
      res.status(500).json({ success: false, error: e?.message ?? 'role_library_failed' });
    }
  });
}
