/**
 * Competency Intelligence Engine — CI-1.0.0
 *
 * Transforms Assessment → Score into the full intelligence chain:
 *   Score → Trend → Forecast → Outcome → Intervention
 *
 * Deliverables:
 *   D1  Competency trends          GET /api/competency/intelligence/trends
 *   D2  Competency velocity        GET /api/competency/intelligence/velocity
 *   D3  Competency forecast        GET /api/competency/intelligence/forecast
 *   D4  Growth trajectory          (included in forecast response)
 *   D5  Outcome projection         GET /api/competency/intelligence/outcomes
 *   D6  Gap prioritization         GET /api/competency/intelligence/gap-priority
 *   D7  Readiness projection       (included in outcomes response)
 *   D8  Competency interventions   GET /api/competency/intelligence/interventions
 *   D9  Admin intelligence         GET /api/admin/competency-intelligence/overview
 *   D10 Explainability             _explain envelope on every response
 *
 * Constraints:
 *   - Additive, flag-gated (FF_COMPETENCY_INTELLIGENCE), never-throws
 *   - Composes from cra_scores time series — no duplicate engine logic
 *   - Pure math imported from longitudinal-engine.ts
 *   - All projections are RANGES with confidence bands — never point predictions
 *   - Language policy: developmental readiness only, never hiring/promotion assertions
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import {
  computeVelocity,
  computeTrajectory,
  type HistoryPoint,
} from '../services/longitudinal-engine';

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

const CI_VERSION = 'CI-1.0.0';
const FLAG = 'FF_COMPETENCY_INTELLIGENCE';

function flagEnabled(): boolean {
  return process.env[FLAG] === '1' || process.env[FLAG] === 'true';
}

function flagGate(res: Response): boolean {
  if (!flagEnabled()) {
    res.status(503).json({ error: 'Competency Intelligence Engine not enabled', flag: FLAG });
    return false;
  }
  return true;
}

function callerId(req: Request): string | null {
  const u = (req as any).user;
  if (!u) return null;
  return String(u.id ?? u.userId ?? u.sub ?? '') || null;
}

// ── Competency metadata ──────────────────────────────────────────────────────

const DOMAIN_META: Record<string, { name: string; domain: string }> = {
  COG01: { name: 'Critical Thinking',       domain: 'COG' },
  COG02: { name: 'Problem Solving',         domain: 'COG' },
  COG03: { name: 'Analytical Reasoning',    domain: 'COG' },
  COG04: { name: 'Decision Making',         domain: 'COG' },
  COM01: { name: 'Verbal Communication',    domain: 'COM' },
  COM02: { name: 'Written Communication',   domain: 'COM' },
  COM04: { name: 'Active Listening',        domain: 'COM' },
  LEA01: { name: 'Team Leadership',         domain: 'LEA' },
  LEA03: { name: 'Coaching & Mentoring',    domain: 'LEA' },
  LEA05: { name: 'Change Leadership',       domain: 'LEA' },
  EXE01: { name: 'Project Management',      domain: 'EXE' },
  EXE02: { name: 'Accountability',          domain: 'EXE' },
  ADP01: { name: 'Learning Agility',        domain: 'ADP' },
  ADP02: { name: 'Resilience',              domain: 'ADP' },
  ADP03: { name: 'Innovation Mindset',      domain: 'ADP' },
  TEC01: { name: 'Technical Expertise',     domain: 'TEC' },
  TEC02: { name: 'Digital Fluency',         domain: 'TEC' },
  EIQ01: { name: 'Self-Awareness',          domain: 'EIQ' },
  EIQ02: { name: 'Self-Regulation',         domain: 'EIQ' },
  EIQ05: { name: 'Conflict Resolution',     domain: 'EIQ' },
};

const DOMAIN_NAMES: Record<string, string> = {
  COG: 'Cognitive & Analytical',
  COM: 'Communication & Influence',
  LEA: 'Leadership & People',
  EXE: 'Execution & Delivery',
  ADP: 'Adaptability & Growth',
  TEC: 'Technical & Domain',
  EIQ: 'Emotional & Social Intelligence',
};

const STAGE_ANCHOR: Record<string, number> = {
  junior: 55, mid: 65, senior: 75, lead: 80, director: 85,
};

const CRITICAL_WEIGHT = 1.5;
const ROLE_CRITICAL: Record<string, string[]> = {
  // Engineering & Technical
  'software engineer':    ['COG01', 'COG03', 'TEC01', 'TEC02'],
  'software developer':   ['COG01', 'COG03', 'TEC01', 'TEC02'],
  'frontend engineer':    ['COG01', 'TEC01', 'TEC02', 'COM02'],
  'backend engineer':     ['COG01', 'COG03', 'TEC01', 'EXE02'],
  'full stack':           ['COG01', 'TEC01', 'TEC02', 'ADP01'],
  'devops':               ['TEC01', 'TEC02', 'EXE01', 'ADP02'],
  'ml engineer':          ['COG01', 'COG03', 'TEC01', 'TEC02'],
  'machine learning':     ['COG01', 'COG03', 'TEC01', 'ADP01'],
  // Data & Analytics
  'data scientist':       ['COG01', 'COG03', 'TEC01', 'ADP01'],
  'data analyst':         ['COG01', 'COG03', 'TEC02', 'COM02'],
  'data engineer':        ['COG01', 'TEC01', 'TEC02', 'EXE01'],
  'business analyst':     ['COG01', 'COG03', 'COM01', 'COM02'],
  // Product & Design
  'product manager':      ['COG01', 'COM01', 'EXE01', 'LEA01'],
  'product owner':        ['COG01', 'COM01', 'EXE01', 'LEA01'],
  'ux designer':          ['COG02', 'COM01', 'ADP03', 'EIQ01'],
  'ui designer':          ['COG02', 'COM01', 'ADP03', 'TEC02'],
  'designer':             ['COG02', 'COM01', 'ADP03', 'EIQ01'],
  // Marketing & Growth
  'marketing manager':    ['COM01', 'COM02', 'ADP01', 'EXE01'],
  'marketing':            ['COM01', 'COM02', 'ADP03', 'ADP01'],
  'content':              ['COM01', 'COM02', 'ADP03', 'COG01'],
  'growth':               ['COG03', 'ADP03', 'EXE01', 'COM01'],
  // Finance
  'finance':              ['COG01', 'COG03', 'COG04', 'COM02'],
  'accountant':           ['COG01', 'COG03', 'EXE02', 'COM02'],
  'financial analyst':    ['COG01', 'COG03', 'TEC02', 'COM02'],
  // Sales & Business Development
  'sales manager':        ['COM01', 'LEA01', 'EXE02', 'EIQ05'],
  'sales':                ['COM01', 'EIQ05', 'ADP02', 'EXE02'],
  'business development': ['COM01', 'LEA01', 'ADP02', 'COG04'],
  'account manager':      ['COM01', 'EIQ05', 'EXE02', 'ADP02'],
  'consultant':           ['COG01', 'COG03', 'COM01', 'EXE01'],
  'strategy':             ['COG01', 'COG04', 'COM01', 'EXE01'],
  // Leadership & Management
  'manager':              ['LEA01', 'EXE01', 'COM01', 'EIQ01'],
  'director':             ['LEA01', 'LEA05', 'EXE01', 'COG04'],
  'head of':              ['LEA01', 'LEA05', 'EXE01', 'COG04'],
  'vp ':                  ['LEA01', 'LEA05', 'COG04', 'EXE01'],
  'chief':                ['LEA01', 'LEA05', 'COG04', 'EIQ01'],
  'ceo':                  ['LEA01', 'LEA05', 'COG04', 'EIQ01'],
  // People & HR
  'hr manager':           ['COM01', 'LEA03', 'EIQ01', 'EIQ05'],
  'hr ':                  ['EIQ01', 'EIQ05', 'COM01', 'LEA03'],
  'recruiter':            ['COM01', 'EIQ01', 'EIQ05', 'COG04'],
  'talent':               ['EIQ01', 'COM01', 'LEA03', 'COG04'],
  // Operations & Project
  'operations':           ['EXE01', 'EXE02', 'COG03', 'COM01'],
  'project manager':      ['EXE01', 'EXE02', 'COM01', 'LEA01'],
  'program manager':      ['EXE01', 'EXE02', 'COM01', 'LEA01'],
  'scrum master':         ['EXE01', 'EXE02', 'COM01', 'ADP02'],
};

function resolveCritical(roleKey: string): string[] {
  if (!roleKey) return [];
  const entry = Object.entries(ROLE_CRITICAL).find(([k]) => roleKey.includes(k));
  return entry?.[1] ?? [];
}

// ── D8: Domain intervention library ─────────────────────────────────────────

type GapLevel = 'critical' | 'high' | 'medium' | 'low';

const DOMAIN_INTERVENTIONS: Record<string, Record<GapLevel, { action: string; type: string; horizon_weeks: number }[]>> = {
  COG: {
    critical: [
      { action: 'Enrol in a structured analytical reasoning course (Coursera Systems Thinking or equivalent)', type: 'course', horizon_weeks: 8 },
      { action: 'Complete daily structured problem-decomposition practice using MECE framework for 30 days', type: 'practice', horizon_weeks: 4 },
    ],
    high: [
      { action: 'Work through 3 decision-making case studies per week with documented rationale', type: 'practice', horizon_weeks: 6 },
      { action: 'Pair with a senior colleague on ambiguous problems — seek structured debrief after each', type: 'mentoring', horizon_weeks: 8 },
    ],
    medium: [
      { action: 'Complete one data-interpretation module per week (Khan Academy Statistics or equivalent)', type: 'course', horizon_weeks: 6 },
    ],
    low: [
      { action: 'Join or start a technical book club focused on decision science or analytical frameworks', type: 'self-directed', horizon_weeks: 12 },
    ],
  },
  COM: {
    critical: [
      { action: 'Enrol in a structured communication skills programme (Toastmasters or Dale Carnegie)', type: 'course', horizon_weeks: 12 },
      { action: 'Practise daily 5-minute structured presentations; seek written feedback from a mentor after each', type: 'practice', horizon_weeks: 6 },
    ],
    high: [
      { action: 'Draft and refine one professional communication per day using the PREP framework', type: 'practice', horizon_weeks: 4 },
      { action: 'Request monthly 360 micro-feedback on communication clarity from 2–3 peers', type: 'feedback', horizon_weeks: 8 },
    ],
    medium: [
      { action: 'Shadow a colleague known for strong stakeholder communication in 3 meetings; document observations', type: 'mentoring', horizon_weeks: 4 },
    ],
    low: [
      { action: 'Read one communication/influence book per quarter (eg. Crucial Conversations, Never Split the Difference)', type: 'self-directed', horizon_weeks: 12 },
    ],
  },
  LEA: {
    critical: [
      { action: 'Volunteer to lead a cross-functional initiative; establish a weekly debrief with a senior sponsor', type: 'stretch', horizon_weeks: 12 },
      { action: 'Enrol in a leadership development programme or begin structured executive coaching', type: 'course', horizon_weeks: 16 },
    ],
    high: [
      { action: 'Lead team retrospectives and weekly standups; practise giving structured developmental feedback', type: 'practice', horizon_weeks: 8 },
      { action: 'Shadow a leader you admire for 2 hours per week; document one leadership lesson per session', type: 'mentoring', horizon_weeks: 8 },
    ],
    medium: [
      { action: 'Complete an online leadership fundamentals course (LinkedIn Learning, Coursera Leadership track)', type: 'course', horizon_weeks: 6 },
    ],
    low: [
      { action: 'Read one leadership-focused book per quarter (eg. The Manager\'s Path, Leaders Eat Last)', type: 'self-directed', horizon_weeks: 12 },
    ],
  },
  EXE: {
    critical: [
      { action: 'Implement a daily prioritisation system (OKR alignment or Eisenhower matrix) and review weekly for 8 weeks', type: 'practice', horizon_weeks: 8 },
      { action: 'Complete a project management certification (PMP, PMI-ACP, PRINCE2 or equivalent)', type: 'course', horizon_weeks: 20 },
    ],
    high: [
      { action: 'Track one key accountability metric weekly; review with manager at each 1:1', type: 'practice', horizon_weeks: 6 },
      { action: 'Use a structured planning template (weekly/sprint) for every project for the next 60 days', type: 'practice', horizon_weeks: 8 },
    ],
    medium: [
      { action: 'Establish a personal weekly review ritual: review goals, blockers, and wins every Friday for 30 days', type: 'habit', horizon_weeks: 4 },
    ],
    low: [
      { action: 'Read one execution-focused book per quarter (eg. Getting Things Done, Measure What Matters)', type: 'self-directed', horizon_weeks: 12 },
    ],
  },
  ADP: {
    critical: [
      { action: 'Deliberately take on one stretch assignment outside your comfort zone each sprint for 3 months', type: 'stretch', horizon_weeks: 12 },
      { action: 'Enrol in a learning agility workshop; maintain a structured learning journal reflecting on each new experience', type: 'course', horizon_weeks: 8 },
    ],
    high: [
      { action: 'Commit to building one new skill per month; share learnings with your team at the end of each month', type: 'habit', horizon_weeks: 12 },
      { action: 'Practise structured failure reflection: after any setback, write a 3-point "what I learned" log within 24h', type: 'practice', horizon_weeks: 6 },
    ],
    medium: [
      { action: 'Subscribe to a cross-domain newsletter; spend 20 minutes exploring one new adjacent tool or concept weekly', type: 'self-directed', horizon_weeks: 8 },
    ],
    low: [
      { action: 'Set a goal to try one new approach or process per quarter; document the outcome', type: 'habit', horizon_weeks: 12 },
    ],
  },
  TEC: {
    critical: [
      { action: 'Enrol in a role-specific technical certification path immediately (relevant to your target role)', type: 'course', horizon_weeks: 16 },
      { action: 'Identify your top 2 technical skill gaps; complete a 3-month intensive course in the highest-priority gap', type: 'course', horizon_weeks: 12 },
    ],
    high: [
      { action: 'Dedicate 1 structured hour per day to technical skill building for 60 days with weekly progress check-ins', type: 'practice', horizon_weeks: 8 },
      { action: 'Complete a hands-on project that directly exercises the target technical competency', type: 'project', horizon_weeks: 10 },
    ],
    medium: [
      { action: 'Follow 3 industry-leading technical blogs; complete one structured tutorial per week for 6 weeks', type: 'self-directed', horizon_weeks: 6 },
    ],
    low: [
      { action: 'Attend one technical webinar or workshop per month in your target skill area', type: 'event', horizon_weeks: 12 },
    ],
  },
  EIQ: {
    critical: [
      { action: 'Begin a structured EQ coaching programme with a certified coach; commit to weekly sessions for 3 months', type: 'coaching', horizon_weeks: 12 },
      { action: 'Maintain a daily self-reflection journal (5 minutes): document one emotional response and its impact each day', type: 'habit', horizon_weeks: 8 },
    ],
    high: [
      { action: 'Complete an EQ/EI debrief assessment with a certified practitioner; build a 90-day behavioural action plan', type: 'assessment', horizon_weeks: 4 },
      { action: 'Practise active listening in every 1:1 meeting: no device, paraphrase before responding, note what you heard', type: 'practice', horizon_weeks: 6 },
    ],
    medium: [
      { action: 'Request monthly 360 micro-feedback from 2 trusted colleagues on one specific EQ behaviour', type: 'feedback', horizon_weeks: 8 },
    ],
    low: [
      { action: 'Read one EQ-focused book per quarter (eg. Emotional Intelligence by Daniel Goleman, Permission to Feel)', type: 'self-directed', horizon_weeks: 12 },
    ],
  },
};

function gapLevel(severity: number): GapLevel {
  if (severity >= 25) return 'critical';
  if (severity >= 15) return 'high';
  if (severity >= 7) return 'medium';
  return 'low';
}

// ── Data access helpers ──────────────────────────────────────────────────────

interface CraScoreRow {
  competency_code: string;
  raw_score: number;
  confidence: number;
  created_at: string;
}

async function getTimeSeries(pool: Pool, userId: string): Promise<Map<string, HistoryPoint[]>> {
  const { rows } = await pool.query<CraScoreRow>(
    `SELECT competency_code, raw_score, confidence, created_at
     FROM cra_scores WHERE user_id = $1
     ORDER BY competency_code, created_at ASC`,
    [userId]
  );
  const series = new Map<string, HistoryPoint[]>();
  for (const row of rows) {
    if (!series.has(row.competency_code)) series.set(row.competency_code, []);
    series.get(row.competency_code)!.push({
      captured_at: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
      score: Number(row.raw_score),
      source: 'competency_assessment',
      session_id: null,
    });
  }
  return series;
}

interface CraProfile {
  current_role_label: string | null;
  target_role_label: string | null;
  industry: string | null;
  career_stage: string | null;
  experience_years: number | null;
}

async function getProfile(pool: Pool, userId: string): Promise<CraProfile | null> {
  const { rows } = await pool.query<CraProfile>(
    `SELECT current_role_label, target_role_label, industry, career_stage, experience_years
     FROM cra_profiles WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function getLatestScores(pool: Pool, userId: string): Promise<Map<string, number>> {
  const { rows } = await pool.query<{ competency_code: string; raw_score: number }>(
    `SELECT DISTINCT ON (competency_code) competency_code, raw_score
     FROM cra_scores WHERE user_id = $1
     ORDER BY competency_code, created_at DESC`,
    [userId]
  );
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.competency_code, Number(r.raw_score));
  return m;
}

// ── D10: Explainability envelope ─────────────────────────────────────────────

function explainEnvelope(sessionCount: number, hasForecast: boolean) {
  return {
    methodology_version: CI_VERSION,
    data_sources: ['cra_scores', 'cra_profiles'],
    sessions_used: sessionCount,
    confidence_note: sessionCount < 2
      ? 'Single session — velocity/forecast requires ≥2 assessments'
      : sessionCount < 5
      ? 'Limited history — projections are directional, not precise'
      : 'Sufficient history for trend analysis',
    forecast_available: hasForecast,
    language_policy: 'developmental_readiness_only — never hiring/promotion/suitability assertions',
    limitations: [
      'Projections are ranges, not point estimates',
      'Confidence bands widen with fewer sessions and inconsistent pacing',
      'Role fit is a developmental proxy, not a selection instrument',
    ],
  };
}

// ── D1+D2: Trend + velocity computation ─────────────────────────────────────

function buildTrends(series: Map<string, HistoryPoint[]>) {
  const trends: any[] = [];
  for (const [code, points] of series) {
    const meta = DOMAIN_META[code];
    const velocity = computeVelocity(points);
    trends.push({
      competency_code: code,
      competency_name: meta?.name ?? code,
      domain_code: meta?.domain ?? code.slice(0, 3),
      domain_name: DOMAIN_NAMES[meta?.domain ?? ''] ?? 'Other',
      points: points.map(p => ({ score: p.score, captured_at: p.captured_at })),
      current_score: points.length ? points[points.length - 1].score : null,
      baseline_score: points.length ? points[0].score : null,
      observation_count: points.length,
      velocity: velocity ? {
        delta_score: velocity.delta_score,
        velocity_pts_per_30d: velocity.velocity_pts_per_30d,
        trend: velocity.trend,
        momentum_score: velocity.momentum_score,
        consistency: velocity.consistency,
      } : null,
      has_sufficient_data: points.length >= 2,
    });
  }
  return trends.sort((a, b) => (b.current_score ?? 0) - (a.current_score ?? 0));
}

// ── D3+D4: Forecast + growth trajectory ─────────────────────────────────────

function buildForecasts(series: Map<string, HistoryPoint[]>, horizonMonths = 6) {
  const forecasts: any[] = [];
  for (const [code, points] of series) {
    if (points.length < 2) continue;
    const meta = DOMAIN_META[code];
    const traj = computeTrajectory(points, horizonMonths);
    if (!traj) continue;
    const velocity = computeVelocity(points)!;
    forecasts.push({
      competency_code: code,
      competency_name: meta?.name ?? code,
      domain_code: meta?.domain ?? code.slice(0, 3),
      current_score: traj.current,
      baseline_score: traj.baseline,
      horizon_months: horizonMonths,
      forecast_lower: traj.projection_lower,
      forecast_upper: traj.projection_upper,
      forecast_midpoint: Math.round((traj.projection_lower + traj.projection_upper) / 2 * 10) / 10,
      trajectory_type: traj.trajectory_type,
      confidence_band: traj.confidence_band,
      observation_count: traj.observation_count,
      velocity_pts_per_30d: velocity.velocity_pts_per_30d,
      growth_direction: velocity.velocity_pts_per_30d > 0.4 ? 'improving'
        : velocity.velocity_pts_per_30d < -0.4 ? 'declining' : 'stable',
    });
  }
  return forecasts.sort((a, b) =>
    (b.forecast_midpoint - b.current_score) - (a.forecast_midpoint - a.current_score)
  );
}

// ── D5+D6+D7: Outcomes, gap priority, readiness projection ──────────────────

function buildOutcomes(
  series: Map<string, HistoryPoint[]>,
  latestScores: Map<string, number>,
  profile: CraProfile | null,
  targetRoleCritical: string[]
) {
  const stage = profile?.career_stage?.toLowerCase() ?? 'mid';
  const anchor = STAGE_ANCHOR[stage] ?? 65;

  const gaps: any[] = [];
  const readiness: any[] = [];

  for (const [code, points] of series) {
    const current = latestScores.get(code) ?? (points.length ? points[points.length - 1].score : 0);
    const meta = DOMAIN_META[code];
    const isCritical = targetRoleCritical.includes(code);
    const weight = isCritical ? CRITICAL_WEIGHT : 1.0;

    const severity = Math.max(0, anchor - current);
    const level = gapLevel(severity);

    // Velocity for decline penalty
    const velocity = points.length >= 2 ? computeVelocity(points) : null;
    const velocityPts = velocity?.velocity_pts_per_30d ?? 0;
    const declinePenalty = velocityPts < 0 ? Math.abs(velocityPts) / 10 : 0;
    const priorityScore = severity * weight * (1 + declinePenalty);

    gaps.push({
      competency_code: code,
      competency_name: meta?.name ?? code,
      domain_code: meta?.domain ?? code.slice(0, 3),
      current_score: Math.round(current * 10) / 10,
      target_score: anchor,
      severity: Math.round(severity * 10) / 10,
      gap_level: level,
      is_role_critical: isCritical,
      velocity_pts_per_30d: Math.round(velocityPts * 1000) / 1000,
      trend: velocity?.trend ?? 'insufficient_data',
      priority_score: Math.round(priorityScore * 100) / 100,
    });

    // Readiness projection
    if (current >= anchor) {
      readiness.push({
        competency_code: code,
        competency_name: meta?.name ?? code,
        current_score: Math.round(current * 10) / 10,
        target_score: anchor,
        months_to_target: 0,
        readiness_status: 'above_target',
        velocity_pts_per_30d: Math.round(velocityPts * 1000) / 1000,
        confidence: 'sufficient',
      });
    } else if (velocity && velocityPts > 0) {
      const monthsRaw = (anchor - current) / velocityPts;
      const months = Math.min(36, Math.round(monthsRaw * 10) / 10);
      readiness.push({
        competency_code: code,
        competency_name: meta?.name ?? code,
        current_score: Math.round(current * 10) / 10,
        target_score: anchor,
        months_to_target: months,
        readiness_status: months <= 3 ? 'near_ready' : months <= 6 ? 'on_track' : months <= 12 ? 'developing' : 'long_term',
        velocity_pts_per_30d: Math.round(velocityPts * 1000) / 1000,
        confidence: points.length >= 5 ? 'high' : points.length >= 3 ? 'medium' : 'low',
      });
    } else {
      readiness.push({
        competency_code: code,
        competency_name: meta?.name ?? code,
        current_score: Math.round(current * 10) / 10,
        target_score: anchor,
        months_to_target: null,
        readiness_status: velocityPts < 0 ? 'declining' : 'insufficient_data',
        velocity_pts_per_30d: Math.round(velocityPts * 1000) / 1000,
        confidence: 'insufficient',
      });
    }
  }

  // Outcome projection: weighted readiness across all assessed competencies
  const assessed = gaps.filter(g => latestScores.has(g.competency_code));
  const totalWeight = assessed.reduce((s, g) => s + (g.is_role_critical ? CRITICAL_WEIGHT : 1.0), 0) || 1;
  const weightedReadiness = assessed.reduce((s, g) => {
    const w = g.is_role_critical ? CRITICAL_WEIGHT : 1.0;
    return s + (Math.min(g.current_score, g.target_score) / g.target_score) * w;
  }, 0) / totalWeight;

  const outcomePct = Math.round(Math.min(1, weightedReadiness) * 100);
  const outcomeLabel = outcomePct >= 85 ? 'role_ready'
    : outcomePct >= 70 ? 'near_ready'
    : outcomePct >= 50 ? 'developing'
    : 'early_stage';

  return {
    gap_priority: gaps.sort((a, b) => b.priority_score - a.priority_score),
    readiness_projection: readiness.sort((a, b) =>
      (a.months_to_target ?? 999) - (b.months_to_target ?? 999)
    ),
    outcome_projection: {
      overall_readiness_pct: outcomePct,
      outcome_label: outcomeLabel,
      assessed_competencies: assessed.length,
      total_assessed: gaps.length,
      stage_anchor: anchor,
      role_critical_count: assessed.filter(g => g.is_role_critical).length,
    },
  };
}

// ── D8: Intervention engine ──────────────────────────────────────────────────

async function buildInterventions(
  pool: Pool,
  gapPriority: any[],
  topN = 10
): Promise<any[]> {
  const topGaps = gapPriority.slice(0, topN);
  const interventions: any[] = [];

  for (const gap of topGaps) {
    if (gap.gap_level === 'low' && gap.priority_score < 3) continue;
    const domain = (gap.domain_code ?? gap.competency_code.slice(0, 3)) as string;
    const level = gap.gap_level as GapLevel;
    const domainMap = DOMAIN_INTERVENTIONS[domain];
    if (!domainMap) continue;
    const actions = domainMap[level] ?? domainMap['medium'] ?? [];

    for (const action of actions) {
      interventions.push({
        competency_code: gap.competency_code,
        competency_name: gap.competency_name,
        domain_code: domain,
        domain_name: DOMAIN_NAMES[domain] ?? domain,
        gap_level: level,
        gap_severity: gap.severity,
        is_role_critical: gap.is_role_critical,
        action: action.action,
        intervention_type: action.type,
        horizon_weeks: action.horizon_weeks,
        priority: gap.priority_score,
      });
    }
  }

  // Optionally enrich with PIL intervention_library if available
  try {
    const { rows: libRows } = await pool.query<{ intervention_text: string; construct_key: string; rationale: string }>(
      `SELECT il.intervention_text, il.construct_key, il.rationale
       FROM intervention_library il
       WHERE il.is_active = true AND il.safety_level = 'safe'
       LIMIT 5`
    );
    for (const row of libRows) {
      if (row.intervention_text && !interventions.find(i => i.action === row.intervention_text)) {
        interventions.push({
          competency_code: row.construct_key ?? 'general',
          competency_name: row.construct_key ?? 'General',
          domain_code: 'PIL',
          domain_name: 'Behavioural Intelligence',
          gap_level: 'medium',
          gap_severity: 0,
          is_role_critical: false,
          action: row.intervention_text,
          intervention_type: 'pil_library',
          horizon_weeks: 8,
          priority: 0,
          rationale: row.rationale,
        });
      }
    }
  } catch {
    // intervention_library not available — continue with curated map only
  }

  return interventions.sort((a, b) => b.priority - a.priority);
}

// ── Snapshot persistence (fire-and-forget) ───────────────────────────────────

async function persistSnapshots(
  pool: Pool,
  userId: string,
  series: Map<string, HistoryPoint[]>
): Promise<void> {
  for (const [code, points] of series) {
    if (points.length < 2) continue;
    const velocity = computeVelocity(points);
    if (!velocity) continue;
    const traj = computeTrajectory(points, 6);

    const now = new Date().toISOString();
    const velId = `pv_${userId}_${code}_${Date.now()}`;

    // p4_development_velocity snapshot
    await pool.query(
      `INSERT INTO p4_development_velocity
         (id, user_id, competency_id, period_start, period_end, start_score, end_score,
          delta_score, velocity_pts_per_30d, trend, momentum_score, consistency,
          sample_count, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT DO NOTHING`,
      [velId, userId, code,
       points[0].captured_at.slice(0, 10),
       points[points.length - 1].captured_at.slice(0, 10),
       velocity.start_score, velocity.end_score,
       velocity.delta_score, velocity.velocity_pts_per_30d,
       velocity.trend, velocity.momentum_score, velocity.consistency,
       velocity.sample_count, now]
    ).catch(() => {});

    // competency_forecasts snapshot
    if (traj) {
      const midpoint = (traj.projection_lower + traj.projection_upper) / 2;
      await pool.query(
        `INSERT INTO competency_forecasts
           (id, user_id, competency_key, horizon_months, predicted_level, confidence, method, inputs, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())`,
        [userId, code, 6, Math.round(midpoint * 10) / 10,
         traj.confidence_band === 'A' ? 0.9 : traj.confidence_band === 'B' ? 0.75
           : traj.confidence_band === 'C' ? 0.6 : 0.4,
         'ewma_trajectory',
         JSON.stringify({ lower: traj.projection_lower, upper: traj.projection_upper,
                          trajectory_type: traj.trajectory_type })]
      ).catch(() => {});
    }
  }
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerCompetencyIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: AuthMiddleware,
  requireSuperAdmin: AuthMiddleware,
): void {

  // ── D1+D2: Trends + Velocity ─────────────────────────────────────────────
  app.get('/api/competency/intelligence/trends', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const series = await getTimeSeries(pool, userId);
      const trends = buildTrends(series);
      const sessionCount = series.size > 0
        ? Math.max(...Array.from(series.values()).map(p => p.length)) : 0;
      res.json({
        trends,
        total_competencies: trends.length,
        has_velocity_data: trends.some(t => t.velocity !== null),
        _explain: explainEnvelope(sessionCount, false),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Trend computation failed', detail: err?.message });
    }
  });

  // ── D3+D4: Forecast + Growth Trajectory ─────────────────────────────────
  app.get('/api/competency/intelligence/forecast', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const horizon = Math.min(24, Math.max(1, parseInt(String(req.query.horizon ?? '6'))));
    try {
      const series = await getTimeSeries(pool, userId);
      const forecasts = buildForecasts(series, horizon);
      const sessionCount = series.size > 0
        ? Math.max(...Array.from(series.values()).map(p => p.length)) : 0;
      // Persist snapshots fire-and-forget
      persistSnapshots(pool, userId, series).catch(() => {});
      res.json({
        forecasts,
        horizon_months: horizon,
        forecastable_competencies: forecasts.length,
        insufficient_data_count: series.size - forecasts.length,
        _explain: explainEnvelope(sessionCount, forecasts.length > 0),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Forecast computation failed', detail: err?.message });
    }
  });

  // ── D5+D6+D7: Outcomes + Gap Priority + Readiness Projection ────────────
  app.get('/api/competency/intelligence/outcomes', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [series, profile, latestScores] = await Promise.all([
        getTimeSeries(pool, userId),
        getProfile(pool, userId),
        getLatestScores(pool, userId),
      ]);
      const roleKey = profile?.target_role_label?.toLowerCase().trim() ?? '';
      const targetCritical = resolveCritical(roleKey);
      const outcomes = buildOutcomes(series, latestScores, profile, targetCritical);
      const sessionCount = latestScores.size;
      res.json({
        ...outcomes,
        profile_context: {
          career_stage: profile?.career_stage ?? null,
          target_role: profile?.target_role_label ?? null,
          role_critical_competencies: targetCritical,
        },
        _explain: explainEnvelope(sessionCount, false),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Outcome computation failed', detail: err?.message });
    }
  });

  // ── D6 standalone: Gap Priority ─────────────────────────────────────────
  app.get('/api/competency/intelligence/gap-priority', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [series, profile, latestScores] = await Promise.all([
        getTimeSeries(pool, userId),
        getProfile(pool, userId),
        getLatestScores(pool, userId),
      ]);
      const roleKey = profile?.target_role_label?.toLowerCase().trim() ?? '';
      const targetCritical = resolveCritical(roleKey);
      const { gap_priority } = buildOutcomes(series, latestScores, profile, targetCritical);
      res.json({
        gaps: gap_priority,
        total_gaps: gap_priority.length,
        critical_count: gap_priority.filter((g: any) => g.gap_level === 'critical').length,
        high_count: gap_priority.filter((g: any) => g.gap_level === 'high').length,
        _explain: explainEnvelope(latestScores.size, false),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Gap priority computation failed', detail: err?.message });
    }
  });

  // ── D8: Competency Interventions ─────────────────────────────────────────
  app.get('/api/competency/intelligence/interventions', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [series, profile, latestScores] = await Promise.all([
        getTimeSeries(pool, userId),
        getProfile(pool, userId),
        getLatestScores(pool, userId),
      ]);
      const roleKey = profile?.target_role_label?.toLowerCase().trim() ?? '';
      const targetCritical = resolveCritical(roleKey);
      const { gap_priority } = buildOutcomes(series, latestScores, profile, targetCritical);
      const interventions = await buildInterventions(pool, gap_priority);
      res.json({
        interventions,
        total: interventions.length,
        addressed_competencies: [...new Set(interventions.map((i: any) => i.competency_code))].length,
        _explain: explainEnvelope(latestScores.size, false),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Intervention computation failed', detail: err?.message });
    }
  });

  // ── All deliverables: Summary endpoint ──────────────────────────────────
  app.get('/api/competency/intelligence/summary', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [series, profile, latestScores] = await Promise.all([
        getTimeSeries(pool, userId),
        getProfile(pool, userId),
        getLatestScores(pool, userId),
      ]);
      const roleKey = profile?.target_role_label?.toLowerCase().trim() ?? '';
      const targetCritical = resolveCritical(roleKey);
      const sessionCount = latestScores.size;
      const horizon = 6;

      const trends = buildTrends(series);
      const forecasts = buildForecasts(series, horizon);
      const outcomes = buildOutcomes(series, latestScores, profile, targetCritical);
      const interventions = await buildInterventions(pool, outcomes.gap_priority);

      // Persist snapshots fire-and-forget
      persistSnapshots(pool, userId, series).catch(() => {});

      res.json({
        meta: {
          user_id: userId,
          assessed_competencies: sessionCount,
          has_trend_data: trends.some(t => t.has_sufficient_data),
          has_forecast_data: forecasts.length > 0,
          generated_at: new Date().toISOString(),
        },
        profile_context: {
          career_stage: profile?.career_stage ?? null,
          target_role: profile?.target_role_label ?? null,
          current_role: profile?.current_role_label ?? null,
          industry: profile?.industry ?? null,
          role_critical_competencies: targetCritical,
        },
        trends,
        forecasts,
        ...outcomes,
        interventions,
        _explain: explainEnvelope(sessionCount, forecasts.length > 0),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Summary computation failed', detail: err?.message });
    }
  });

  // ── D9: Admin intelligence overview ─────────────────────────────────────
  app.get('/api/admin/competency-intelligence/overview', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    if (!flagGate(res)) return;
    try {
      const [userCount, scoreStats, trendDist, topGaps, forecastStats] = await Promise.all([
        // Users with competency data
        pool.query<{ total_users: string; total_scores: string }>(
          `SELECT COUNT(DISTINCT user_id) as total_users, COUNT(*) as total_scores FROM cra_scores`
        ),
        // Per-competency score stats
        pool.query<{ competency_code: string; avg_score: string; min_score: string; max_score: string; user_count: string }>(
          `SELECT competency_code,
                  ROUND(AVG(raw_score)::numeric, 1) as avg_score,
                  MIN(raw_score) as min_score,
                  MAX(raw_score) as max_score,
                  COUNT(DISTINCT user_id) as user_count
           FROM (SELECT DISTINCT ON (user_id, competency_code) user_id, competency_code, raw_score
                 FROM cra_scores ORDER BY user_id, competency_code, created_at DESC) latest
           GROUP BY competency_code
           ORDER BY avg_score ASC`
        ),
        // Velocity trend distribution from p4_development_velocity
        pool.query<{ trend: string; cnt: string }>(
          `SELECT trend, COUNT(*) as cnt FROM p4_development_velocity
           GROUP BY trend ORDER BY cnt DESC`
        ).catch(() => ({ rows: [] })),
        // Top gaps: competencies with lowest avg scores
        pool.query<{ competency_code: string; avg_score: string; gap_count: string }>(
          `SELECT competency_code,
                  ROUND(AVG(raw_score)::numeric, 1) as avg_score,
                  COUNT(DISTINCT user_id) as gap_count
           FROM (SELECT DISTINCT ON (user_id, competency_code) user_id, competency_code, raw_score
                 FROM cra_scores ORDER BY user_id, competency_code, created_at DESC) latest
           WHERE raw_score < 65
           GROUP BY competency_code
           ORDER BY avg_score ASC
           LIMIT 5`
        ),
        // Forecast coverage
        pool.query<{ competencies_forecasted: string; users_forecasted: string }>(
          `SELECT COUNT(DISTINCT competency_key) as competencies_forecasted,
                  COUNT(DISTINCT user_id) as users_forecasted
           FROM competency_forecasts`
        ).catch(() => ({ rows: [{ competencies_forecasted: '0', users_forecasted: '0' }] })),
      ]);

      // Domain rollup
      const domainMap = new Map<string, { total_score: number; count: number; name: string }>();
      for (const row of scoreStats.rows) {
        const domain = row.competency_code.slice(0, 3);
        const existing = domainMap.get(domain) ?? { total_score: 0, count: 0, name: DOMAIN_NAMES[domain] ?? domain };
        existing.total_score += Number(row.avg_score);
        existing.count += 1;
        domainMap.set(domain, existing);
      }
      const domainSummary = Array.from(domainMap.entries()).map(([code, d]) => ({
        domain_code: code,
        domain_name: d.name,
        avg_score: Math.round((d.total_score / d.count) * 10) / 10,
      })).sort((a, b) => a.avg_score - b.avg_score);

      res.json({
        kpi: {
          total_users: parseInt(userCount.rows[0]?.total_users ?? '0'),
          total_scores: parseInt(userCount.rows[0]?.total_scores ?? '0'),
          competencies_forecasted: parseInt(forecastStats.rows[0]?.competencies_forecasted ?? '0'),
          users_forecasted: parseInt(forecastStats.rows[0]?.users_forecasted ?? '0'),
        },
        competency_scores: scoreStats.rows.map(r => ({
          ...r,
          competency_name: DOMAIN_META[r.competency_code]?.name ?? r.competency_code,
          domain_code: r.competency_code.slice(0, 3),
          avg_score: Number(r.avg_score),
          user_count: Number(r.user_count),
        })),
        domain_summary: domainSummary,
        trend_distribution: trendDist.rows.map(r => ({ trend: r.trend, count: Number(r.cnt) })),
        top_gaps: topGaps.rows.map(r => ({
          ...r,
          competency_name: DOMAIN_META[r.competency_code]?.name ?? r.competency_code,
          avg_score: Number(r.avg_score),
          gap_count: Number(r.gap_count),
        })),
        generated_at: new Date().toISOString(),
        _version: CI_VERSION,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Admin overview failed', detail: err?.message });
    }
  });

  // ── D9: Admin per-user intelligence lookup ───────────────────────────────
  app.get('/api/admin/competency-intelligence/user/:userId', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    try {
      const [series, profile, latestScores] = await Promise.all([
        getTimeSeries(pool, userId),
        getProfile(pool, userId),
        getLatestScores(pool, userId),
      ]);
      const roleKey = profile?.target_role_label?.toLowerCase().trim() ?? '';
      const targetCritical = resolveCritical(roleKey);
      const trends = buildTrends(series);
      const forecasts = buildForecasts(series, 6);
      const outcomes = buildOutcomes(series, latestScores, profile, targetCritical);
      res.json({
        user_id: userId,
        profile,
        trends: trends.slice(0, 10),
        forecasts: forecasts.slice(0, 10),
        ...outcomes,
        _explain: explainEnvelope(latestScores.size, forecasts.length > 0),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'User intelligence lookup failed', detail: err?.message });
    }
  });

  // ── E5: Per-competency percentile ranks ────────────────────────────────────
  app.get('/api/competency/intelligence/percentiles', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const latestScores = await getLatestScores(pool, userId);
      if (latestScores.size === 0) return res.json({ percentiles: [], note: 'no_assessment_data' });

      const { rows } = await pool.query<{ competency_code: string; scores: number[] }>(
        `SELECT competency_code,
                array_agg(raw_score ORDER BY raw_score) AS scores
         FROM (
           SELECT DISTINCT ON (user_id, competency_code)
                  user_id, competency_code, raw_score
           FROM cra_scores
           ORDER BY user_id, competency_code, created_at DESC
         ) latest
         WHERE user_id != $1
         GROUP BY competency_code`,
        [userId]
      );
      const allByCode = new Map(rows.map(r => [r.competency_code, r.scores]));

      const percentiles = Array.from(latestScores.entries()).map(([code, score]) => {
        const others = allByCode.get(code) ?? [];
        if (others.length < 2) {
          return { competency_code: code, score, percentile: null,
                   percentile_label: 'Insufficient peers', sample_size: others.length };
        }
        const below = others.filter(s => s < score).length;
        const pct = Math.round((below / others.length) * 100);
        const label = pct >= 90 ? 'Top 10%' : pct >= 75 ? 'Top 25%' : pct >= 50 ? 'Above median' : pct >= 25 ? 'Below median' : 'Bottom 25%';
        return { competency_code: code, score, percentile: pct, percentile_label: label, sample_size: others.length };
      });

      res.json({ percentiles, _explain: explainEnvelope(latestScores.size, false) });
    } catch (err: any) {
      res.status(500).json({ error: 'Percentile computation failed', detail: err?.message });
    }
  });

  // ── E3: Push top gaps to career goals ──────────────────────────────────────
  app.post('/api/competency/intelligence/push-to-goals', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const [series, profile, latestScores] = await Promise.all([
        getTimeSeries(pool, userId),
        getProfile(pool, userId),
        getLatestScores(pool, userId),
      ]);
      const roleKey = profile?.target_role_label?.toLowerCase().trim() ?? '';
      const targetCritical = resolveCritical(roleKey);
      const { gap_priority } = buildOutcomes(series, latestScores, profile, targetCritical);
      const topGaps = (gap_priority as any[]).slice(0, 3).filter((g: any) => g.gap_level !== 'low');

      if (topGaps.length === 0) {
        return res.json({ pushed: 0, message: 'No significant gaps to push to goals' });
      }

      const inserted: string[] = [];
      for (const gap of topGaps) {
        const goalId = `ci_${userId}_${gap.competency_code}`;
        const horizonDays = gap.gap_level === 'critical' ? 60 : gap.gap_level === 'high' ? 90 : 120;
        const targetDate = new Date(Date.now() + horizonDays * 86400000).toISOString().slice(0, 10);
        const goalData = {
          title: `Develop ${gap.competency_name}`,
          description: `Competency Intelligence: ${gap.competency_name} is a ${gap.gap_level.toUpperCase()} gap (current: ${gap.current_score}, target: ${gap.target_score}). Close this ${Math.round(gap.severity)}-pt gap in ${horizonDays} days.`,
          category: 'competency',
          priority: gap.gap_level === 'critical' ? 'high' : gap.gap_level === 'high' ? 'medium' : 'low',
          targetDate,
          source: 'competency_intelligence',
          competency_code: gap.competency_code,
        };
        await pool.query(
          `INSERT INTO career_seeker_goals (id, user_id, data, completed, created_at, updated_at)
           VALUES ($1, $2, $3::jsonb, false, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET data = $3::jsonb, updated_at = NOW()`,
          [goalId, userId, JSON.stringify(goalData)]
        );
        inserted.push(gap.competency_name);
      }
      res.json({
        pushed: inserted.length,
        goals: inserted,
        message: `${inserted.length} competency development goal${inserted.length !== 1 ? 's' : ''} added to your Goals tab`,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Goal push failed', detail: err?.message });
    }
  });

  // ── E1: Reassessment scheduling ────────────────────────────────────────────
  let _reassessSchemaReady: Promise<void> | null = null;
  const ensureReassessSchema = () => {
    if (!_reassessSchemaReady) {
      _reassessSchemaReady = pool.query(`
        CREATE TABLE IF NOT EXISTS competency_reassessment_reminders (
          user_id TEXT PRIMARY KEY,
          scheduled_date DATE NOT NULL,
          email_sent   BOOLEAN DEFAULT false,
          created_at   TIMESTAMPTZ DEFAULT NOW(),
          updated_at   TIMESTAMPTZ DEFAULT NOW()
        )
      `).then(() => {}).catch(() => {});
    }
    return _reassessSchemaReady;
  };

  app.get('/api/competency/intelligence/reassessment-status', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await ensureReassessSchema();
      const [reminder, series] = await Promise.all([
        pool.query(`SELECT scheduled_date, email_sent FROM competency_reassessment_reminders WHERE user_id = $1`, [userId]),
        getTimeSeries(pool, userId),
      ]);
      const maxObs = series.size > 0 ? Math.max(...Array.from(series.values()).map(pts => pts.length)) : 0;
      const suggested = new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10);
      res.json({
        has_reminder: reminder.rows.length > 0,
        scheduled_date: reminder.rows[0]?.scheduled_date ?? null,
        email_sent: reminder.rows[0]?.email_sent ?? false,
        needs_reassessment: maxObs <= 1,
        max_observations: maxObs,
        suggested_date: suggested,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Status check failed', detail: err?.message });
    }
  });

  app.post('/api/competency/intelligence/schedule-reassessment', requireAuth, async (req: Request, res: Response) => {
    if (!flagGate(res)) return;
    const userId = callerId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
      await ensureReassessSchema();
      const weeksAhead = Math.min(16, Math.max(2, parseInt(String(req.body?.weeks_ahead ?? '6'))));
      const scheduledDate = new Date(Date.now() + weeksAhead * 7 * 86400000).toISOString().slice(0, 10);

      await pool.query(
        `INSERT INTO competency_reassessment_reminders (user_id, scheduled_date, email_sent, updated_at)
         VALUES ($1, $2, false, NOW())
         ON CONFLICT (user_id) DO UPDATE SET scheduled_date = $2, email_sent = false, updated_at = NOW()`,
        [userId, scheduledDate]
      );

      let emailSent = false;
      try {
        const userRow = await pool.query(
          `SELECT email, full_name FROM users WHERE id::text = $1 LIMIT 1`,
          [userId]
        );
        const toEmail = userRow.rows[0]?.email;
        if (toEmail && process.env.ZOHO_EMAIL && process.env.ZOHO_APP_PASSWORD) {
          const nodemailer = (await import('nodemailer')).default;
          const transporter = nodemailer.createTransport({
            host: 'smtppro.zoho.in', port: 465, secure: true,
            auth: { user: process.env.ZOHO_EMAIL, pass: process.env.ZOHO_APP_PASSWORD },
          });
          const firstName = (userRow.rows[0].full_name || 'there').split(' ')[0];
          await transporter.sendMail({
            from: `"MetryxOne Intelligence" <${process.env.ZOHO_EMAIL}>`,
            to: toEmail,
            subject: `Your Competency Reassessment is Scheduled — ${scheduledDate}`,
            html: `<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;color:#1f2937">
              <div style="background:#1D3E8B;padding:28px 32px;border-radius:12px 12px 0 0">
                <h1 style="color:#fff;font-size:20px;margin:0">Competency Reassessment Scheduled</h1>
                <p style="color:#93c5fd;font-size:13px;margin:8px 0 0">MetryxOne · Competency Intelligence</p>
              </div>
              <div style="background:#fff;padding:28px 32px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
                <p style="font-size:15px;margin:0 0 16px">Hi ${firstName},</p>
                <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px">
                  Your competency reassessment is scheduled for <strong>${scheduledDate}</strong>.
                  A second assessment unlocks trend analysis, velocity tracking, and 6-month forecasting.
                </p>
                <div style="background:#f0f4ff;border-radius:8px;padding:16px;margin:0 0 24px">
                  <p style="font-size:12px;color:#6366f1;font-weight:600;margin:0 0 8px;text-transform:uppercase">What unlocks after reassessment</p>
                  <ul style="font-size:13px;color:#374151;margin:0;padding-left:16px;line-height:1.9">
                    <li>Development velocity per competency</li>
                    <li>6-month score forecast with confidence bands</li>
                    <li>Readiness timeline to your target role</li>
                    <li>Trend classification (accelerating / plateau / declining)</li>
                  </ul>
                </div>
                <p style="font-size:11px;color:#9ca3af;margin:20px 0 0">
                  You set this reminder via Competency Intelligence. Go to Career Builder → Competency Assessment to retake it.
                </p>
              </div>
            </div>`,
          });
          await pool.query(
            `UPDATE competency_reassessment_reminders SET email_sent = true WHERE user_id = $1`,
            [userId]
          );
          emailSent = true;
        }
      } catch { /* email is best-effort — never fail the request */ }

      res.json({ scheduled_date: scheduledDate, weeks_ahead: weeksAhead, email_sent: emailSent,
                 message: `Reassessment reminder set for ${scheduledDate}` });
    } catch (err: any) {
      res.status(500).json({ error: 'Schedule failed', detail: err?.message });
    }
  });

  console.log('[competency-intelligence-engine] CI-1.0.0 routes registered — D1-D10 + E1-E5 (flag: FF_COMPETENCY_INTELLIGENCE)');
}
