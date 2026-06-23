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
      }
      if (params.length === 0) {
        return res.status(400).json({ success: false, error: 'no valid scores (unknown codes or out-of-range values)' });
      }
      await pool.query(
        `INSERT INTO cra_scores (user_id, competency_code, raw_score, confidence, created_at)
         VALUES ${values.join(', ')}`,
        params,
      );
      res.json(envelope({ saved: params.length / 5, skipped, attemptAt: attemptAt.toISOString() }));
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
