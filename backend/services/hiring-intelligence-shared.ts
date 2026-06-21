/**
 * PHASE 5.11 — Hiring Intelligence: shared composition util.
 *
 * This module is the deterministic, coverage-gated, honesty-first CORE shared by the
 * three Phase 5.11 engines (hiring_intelligence_engine, success_prediction_engine,
 * talent_potential_engine). It defines:
 *   - the typed EngineResult + ok/err helpers,
 *   - a to_regclass relExists probe (reads NEVER run DDL),
 *   - resolveEvidence(): a single READ-ONLY, never-throws load of all the OPERATOR-RECORDED
 *     evidence for a (job, candidate): the employer_candidates operator columns plus the
 *     Phase 5.10 interview substrate (schedules / scores / feedback / decisions),
 *   - composite(): the ONLY scoring primitive — a weighted mean over the contributors that
 *     are actually PRESENT, with an explicit Coverage axis. Absent evidence ⇒ value = null
 *     (NEVER 0); band = null. This is arithmetic over operator inputs, NOT a prediction.
 *
 * Design contract (mirrors the program):
 *   - PURE READ / compose-never-recompute. Phase 5.11 creates NO tables and writes NO rows;
 *     it folds already-recorded evidence on demand. There is no POST and no ensure-schema.
 *   - Every index is a DEVELOPMENTAL / DIRECTIONAL indicator. The labels "Hiring Probability",
 *     "Hiring Risk", "Success / Retention / Leadership / Growth Potential" name composites of
 *     operator-recorded evidence — they are NOT hiring/promotion/suitability predictions and
 *     NOT an algorithmic hire/reject verdict. Every output carries the disclaimer + provenance.
 *   - IDOR-safe: a candidate is actionable for a job ONLY when its job_id strictly matches;
 *     cross-job / unbound (null job_id) candidates are refused.
 *   - never-throws: typed EngineResult; absent data degrades to honest null/empty, never fabricated.
 */

import type { Pool } from 'pg';

export const HIRING_INTELLIGENCE_VERSION = '5.11.0';

export const HIRING_INTELLIGENCE_DISCLAIMER =
  'Developmental indicators composed from OPERATOR-RECORDED evidence (interview scores, ' +
  'panel feedback, decisions, and operator-entered candidate fields). Values are deterministic, ' +
  'coverage-gated folds of human inputs — they are directional development signals, NOT ' +
  'predictions of hiring outcomes and NOT an algorithmic hiring/promotion/suitability verdict. ' +
  'Unmeasured signals abstain (null), never 0.';

export const PROVENANCE = 'operator_recorded_composite' as const;

// ── EngineResult ────────────────────────────────────────────────────────────
export type EngineResult<T = any> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'invalid_input' | 'conflict'; message: string };

export const ok = <T>(data: T): EngineResult<T> => ({ ok: true, data });
export const err = (
  code: 'not_found' | 'invalid_input' | 'conflict',
  message: string,
): EngineResult => ({ ok: false, code, message });

export const round1 = (n: number): number => Math.round(n * 10) / 10;

// ── infra: to_regclass probe (reads degrade; NEVER run DDL) ─────────────────
export async function relExists(pool: Pool, rel: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS reg', [`public.${rel}`]);
    return r.rows?.[0]?.reg != null;
  } catch {
    return false;
  }
}

// ── banding (magnitude bands; the FIELD NAME conveys polarity) ───────────────
export type Band = 'high' | 'moderate' | 'developing' | 'low';
export function bandFor(value: number | null): Band | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 75) return 'high';
  if (value >= 50) return 'moderate';
  if (value >= 25) return 'developing';
  return 'low';
}

// ── composite: the ONLY scoring primitive ───────────────────────────────────
// A contributor is a normalized 0..100 signal with a weight. `present:false` (value null)
// contributors are EXCLUDED from the mean and reduce Coverage. Empty present-set ⇒ null.
export interface Contributor {
  key: string;
  label: string;
  weight: number;
  value: number | null; // 0..100 when present, null when unmeasured
  source: string;
}

export interface CompositeResult {
  value: number | null;
  band: Band | null;
  coverage_pct: number; // share of declared weight that is PRESENT (0 when nothing measured)
  weight_present: number;
  weight_total: number;
  contributors: Array<{
    key: string; label: string; weight: number;
    value: number | null; present: boolean; source: string;
  }>;
}

const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

export function composite(contributors: Contributor[]): CompositeResult {
  let weightTotal = 0;
  let weightPresent = 0;
  let acc = 0;
  const shaped = contributors.map((c) => {
    const present = c.value != null && Number.isFinite(c.value as number);
    weightTotal += c.weight;
    if (present) {
      const v = clamp100(c.value as number);
      weightPresent += c.weight;
      acc += c.weight * v;
    }
    return {
      key: c.key, label: c.label, weight: c.weight,
      value: present ? clamp100(c.value as number) : null,
      present, source: c.source,
    };
  });
  const value = weightPresent > 0 ? round1(acc / weightPresent) : null;
  const coverage = weightTotal > 0 ? round1((weightPresent / weightTotal) * 100) : 0;
  return {
    value,
    band: bandFor(value),
    coverage_pct: coverage,
    weight_present: round1(weightPresent),
    weight_total: round1(weightTotal),
    contributors: shaped,
  };
}

// ── operator-recorded vocab maps ────────────────────────────────────────────
// Mirrors Phase 5.10 recommendation + decision vocabularies.
const RECOMMENDATION_PCT: Record<string, number> = {
  strong_yes: 100, yes: 75, neutral: 50, no: 25, strong_no: 0,
};
// Hiring posture (positive direction): how favourable the latest operator decision is.
const DECISION_POSTURE_PCT: Record<string, number> = {
  hire: 100, advance: 75, hold: 40, reject: 0,
};
// Hiring risk (negative direction): how unfavourable the latest operator decision is.
const DECISION_RISK_PCT: Record<string, number> = {
  reject: 100, hold: 60, advance: 20, hire: 0,
};

export function recommendationToPct(rec: unknown): number | null {
  if (typeof rec !== 'string') return null;
  return rec in RECOMMENDATION_PCT ? RECOMMENDATION_PCT[rec] : null;
}
export function decisionPostureToPct(dec: unknown): number | null {
  if (typeof dec !== 'string') return null;
  return dec in DECISION_POSTURE_PCT ? DECISION_POSTURE_PCT[dec] : null;
}
export function decisionRiskToPct(dec: unknown): number | null {
  if (typeof dec !== 'string') return null;
  return dec in DECISION_RISK_PCT ? DECISION_RISK_PCT[dec] : null;
}

// ── criterion / strengths lexicons (for criterion-name tagging; coverage discloses
//    how much was actually assessed — absent tags ⇒ the index abstains) ──────
export const LEADERSHIP_TERMS = [
  'leadership', 'lead', 'ownership', 'influence', 'mentor', 'mentoring', 'strategic',
  'strategy', 'vision', 'decision', 'decisive', 'accountab', 'stakeholder', 'initiative',
  'drive', 'direction',
];
export const GROWTH_TERMS = [
  'growth', 'learning', 'learn', 'adaptab', 'adapt', 'curios', 'curious', 'coachab',
  'coach', 'potential', 'improv', 'develop', 'feedback', 'agil', 'upskill',
];

function matchesAny(text: string, terms: string[]): boolean {
  const t = text.toLowerCase();
  return terms.some((term) => t.includes(term));
}

// ── normalization for operator-entered candidate numeric fields ─────────────
// match_score / assessment_score / ei_score are operator/system integers presumed 0..100.
export function normalize0to100(n: unknown): number | null {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return clamp100(v);
}
// rating is an operator 1..5 star value → 0..100. 0/absent ⇒ unmeasured (null).
export function normalizeRating(n: unknown): number | null {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return clamp100((v / 5) * 100);
}

// ── evidence bundle ─────────────────────────────────────────────────────────
export interface CandidateFields {
  match_score: number | null;
  assessment_score: number | null;
  ei_score: number | null;
  rating: number | null;
  stage: string | null;
  name: string | null;
  email: string | null;
}
export interface ScoreRow {
  interview_id: string; panelist: string | null; criterion: string;
  score: number; max_score: number;
}
export interface FeedbackRow {
  interview_id: string; panelist: string | null;
  recommendation: string | null; strengths: string | null; concerns: string | null;
}
export interface DecisionRow {
  decision: string; created_at: any;
}
export interface Evidence {
  job_id: string;
  candidate_id: string;
  candidate: CandidateFields;
  interviews_count: number;
  /** Interview ids in canonical CHRONOLOGICAL order (round_seq asc, then created_at, then id).
   *  Trajectory folds use this so direction never depends on raw id sort. */
  interview_order: string[];
  scores: ScoreRow[];
  feedback: FeedbackRow[];
  decisions: DecisionRow[]; // chronological (created_at ASC)
}

// resolveEvidence — single READ-ONLY load + IDOR job-scope guard. Returns the evidence
// bundle, or a typed error (not_found / invalid_input) so every engine + the combined
// profile share ONE guard and ONE load (compose-never-recompute across engines).
export async function resolveEvidence(
  pool: Pool,
  jobIdRaw: string,
  candidateIdRaw: string,
): Promise<EngineResult<Evidence>> {
  const jobId = String(jobIdRaw ?? '').trim();
  const candidateId = String(candidateIdRaw ?? '').trim();
  if (!jobId || !candidateId) return err('invalid_input', 'jobId and candidateId are required');

  // Job must exist.
  if (!(await relExists(pool, 'employer_jobs'))) return err('not_found', `job ${jobId} not found`);
  let jobRow: any = null;
  try {
    const r = await pool.query(`SELECT id FROM employer_jobs WHERE id = $1`, [jobId]);
    jobRow = r.rows[0] ?? null;
  } catch { jobRow = null; }
  if (!jobRow) return err('not_found', `job ${jobId} not found`);

  // Candidate must exist AND strictly belong to the job (IDOR job-scoping).
  if (!(await relExists(pool, 'employer_candidates'))) {
    return err('not_found', `candidate ${candidateId} not found`);
  }
  let cand: any = null;
  try {
    const r = await pool.query(
      `SELECT id, job_id, name, email, stage, match_score, assessment_score, ei_score, rating
         FROM employer_candidates WHERE id = $1`,
      [candidateId],
    );
    cand = r.rows[0] ?? null;
  } catch { cand = null; }
  if (!cand) return err('not_found', `candidate ${candidateId} not found`);
  if (cand.job_id == null || String(cand.job_id) !== jobId) {
    return err('invalid_input', `candidate ${candidateId} does not belong to job ${jobId}`);
  }

  const candidate: CandidateFields = {
    match_score: normalize0to100(cand.match_score),
    assessment_score: normalize0to100(cand.assessment_score),
    ei_score: normalize0to100(cand.ei_score),
    rating: normalizeRating(cand.rating),
    stage: cand.stage ?? null,
    name: cand.name ?? null,
    email: cand.email ?? null,
  };

  // Interview substrate (Phase 5.10). Each read is independently probed + degrades.
  // Load interview ids in CHRONOLOGICAL order (round_seq, then created_at, then id) so
  // trajectory folds never depend on raw id sort.
  const interviewOrder: string[] = [];
  if (await relExists(pool, 'interview_schedules')) {
    try {
      const r = await pool.query(
        `SELECT id FROM interview_schedules WHERE job_id = $1 AND candidate_id = $2
          ORDER BY round_seq ASC NULLS LAST, created_at ASC NULLS LAST, id ASC`,
        [jobId, candidateId],
      );
      for (const row of r.rows) interviewOrder.push(String(row.id));
    } catch { /* degrade to empty */ }
  }
  const interviewsCount = interviewOrder.length;

  const scores: ScoreRow[] = [];
  if (await relExists(pool, 'interview_scores')) {
    try {
      const r = await pool.query(
        `SELECT interview_id, panelist, criterion, score, max_score
           FROM interview_scores WHERE job_id = $1 AND candidate_id = $2`,
        [jobId, candidateId],
      );
      for (const row of r.rows) {
        const score = Number(row.score);
        const max = Number(row.max_score);
        if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0) continue;
        scores.push({
          interview_id: String(row.interview_id),
          panelist: row.panelist ?? null,
          criterion: String(row.criterion),
          score, max_score: max,
        });
      }
    } catch { /* degrade to empty */ }
  }

  const feedback: FeedbackRow[] = [];
  if (await relExists(pool, 'interview_feedback')) {
    try {
      const r = await pool.query(
        `SELECT interview_id, panelist, recommendation, strengths, concerns
           FROM interview_feedback WHERE job_id = $1 AND candidate_id = $2`,
        [jobId, candidateId],
      );
      for (const row of r.rows) {
        feedback.push({
          interview_id: String(row.interview_id),
          panelist: row.panelist ?? null,
          recommendation: row.recommendation ?? null,
          strengths: row.strengths ?? null,
          concerns: row.concerns ?? null,
        });
      }
    } catch { /* degrade */ }
  }

  const decisions: DecisionRow[] = [];
  if (await relExists(pool, 'interview_decisions')) {
    try {
      const r = await pool.query(
        `SELECT decision, created_at FROM interview_decisions
          WHERE job_id = $1 AND candidate_id = $2 ORDER BY created_at ASC, id ASC`,
        [jobId, candidateId],
      );
      for (const row of r.rows) decisions.push({ decision: String(row.decision), created_at: row.created_at });
    } catch { /* degrade */ }
  }

  return ok({ job_id: jobId, candidate_id: candidateId, candidate, interviews_count: interviewsCount, interview_order: interviewOrder, scores, feedback, decisions });
}

// ── shared folds over the evidence (deterministic, null-abstaining) ─────────

/** Overall normalized mean (%) of ALL operator-entered interview scores. null if none. */
export function evaluationMeanPct(scores: ScoreRow[]): { mean: number | null; n: number } {
  let sum = 0; let n = 0;
  for (const s of scores) { sum += (s.score / s.max_score) * 100; n += 1; }
  return { mean: n > 0 ? round1(sum / n) : null, n };
}

/** Mean (%) of operator panel recommendations across feedback rows. null if none recorded. */
export function meanRecommendationPct(feedback: FeedbackRow[]): { mean: number | null; n: number } {
  let sum = 0; let n = 0;
  for (const f of feedback) {
    const p = recommendationToPct(f.recommendation);
    if (p != null) { sum += p; n += 1; }
  }
  return { mean: n > 0 ? round1(sum / n) : null, n };
}

/** Fraction (%) of submitted feedback rows that carry a non-empty operator concern. null if no feedback. */
export function concernDensityPct(feedback: FeedbackRow[]): { pct: number | null; n: number } {
  if (feedback.length === 0) return { pct: null, n: 0 };
  let withConcern = 0;
  for (const f of feedback) {
    if (typeof f.concerns === 'string' && f.concerns.trim() !== '') withConcern += 1;
  }
  return { pct: round1((withConcern / feedback.length) * 100), n: feedback.length };
}

/** Latest (most recent) operator decision, or null. decisions are chronological ASC. */
export function latestDecision(decisions: DecisionRow[]): string | null {
  if (decisions.length === 0) return null;
  return decisions[decisions.length - 1].decision;
}

/**
 * Per-interview overall mean (%) keyed by interview. When `order` (canonical chronological
 * interview ids from resolveEvidence) is supplied, means follow that order; otherwise they
 * fall back to numeric-then-lexical id sort. Chronological order matters for trajectory.
 */
export function perInterviewMeans(
  scores: ScoreRow[],
  order?: string[],
): Array<{ interview_id: string; mean: number }> {
  const byIv = new Map<string, { sum: number; n: number }>();
  for (const s of scores) {
    const pct = (s.score / s.max_score) * 100;
    if (!byIv.has(s.interview_id)) byIv.set(s.interview_id, { sum: 0, n: 0 });
    const a = byIv.get(s.interview_id)!;
    a.sum += pct; a.n += 1;
  }
  const rows = Array.from(byIv.entries()).map(([interview_id, a]) => ({ interview_id, mean: round1(a.sum / a.n) }));
  if (order && order.length) {
    const rank = new Map(order.map((id, i) => [id, i]));
    const fallback = order.length; // ids not present in order go last, stable by id
    return rows.sort((x, y) => {
      const rx = rank.has(x.interview_id) ? rank.get(x.interview_id)! : fallback;
      const ry = rank.has(y.interview_id) ? rank.get(y.interview_id)! : fallback;
      if (rx !== ry) return rx - ry;
      return x.interview_id.localeCompare(y.interview_id);
    });
  }
  return rows.sort((x, y) => {
    const nx = Number(x.interview_id); const ny = Number(y.interview_id);
    if (Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny;
    return x.interview_id.localeCompare(y.interview_id);
  });
}

/**
 * Evaluation CONSISTENCY (%) across scored interviews: 100 - normalized stddev of the
 * per-interview overall means. Requires >= 2 scored interviews, else null (unmeasured).
 * Higher = more stable operator-observed performance across rounds.
 */
export function evaluationConsistencyPct(scores: ScoreRow[], order?: string[]): number | null {
  const means = perInterviewMeans(scores, order).map((m) => m.mean);
  if (means.length < 2) return null;
  const avg = means.reduce((a, b) => a + b, 0) / means.length;
  const variance = means.reduce((a, b) => a + (b - avg) * (b - avg), 0) / means.length;
  const std = Math.sqrt(variance); // 0..~50 in practice; cap at 50 so consistency stays >= 0
  return round1(clamp100(100 - Math.min(std, 50) * 2));
}

/**
 * Improvement TRAJECTORY (%) across scored interviews: maps the slope (last - first) of the
 * per-interview means from [-100, +100] onto [0, 100] (50 = flat). Requires >= 2 scored
 * interviews, else null. Higher = operator-observed improvement across rounds.
 */
export function improvementTrajectoryPct(scores: ScoreRow[], order?: string[]): number | null {
  const means = perInterviewMeans(scores, order).map((m) => m.mean);
  if (means.length < 2) return null;
  const delta = means[means.length - 1] - means[0]; // -100..+100
  return round1(clamp100(50 + delta / 2));
}

/**
 * Mean (%) of operator scores whose CRITERION name matches a lexicon (e.g. leadership/growth).
 * Coverage discloses how much of that theme was actually assessed; no match ⇒ null (abstain).
 */
export function criterionMeanPctMatching(
  scores: ScoreRow[],
  terms: string[],
): { mean: number | null; matched_scores: number; matched_criteria: string[] } {
  let sum = 0; let n = 0;
  const crits = new Set<string>();
  for (const s of scores) {
    if (matchesAny(s.criterion, terms)) {
      sum += (s.score / s.max_score) * 100;
      n += 1;
      crits.add(s.criterion);
    }
  }
  return {
    mean: n > 0 ? round1(sum / n) : null,
    matched_scores: n,
    matched_criteria: Array.from(crits).sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Fraction (%) of submitted feedback rows whose STRENGTHS text mentions a lexicon term.
 * null when no feedback rows exist (unmeasured), 0 when feedback exists but none mention it.
 */
export function strengthsMentionPct(
  feedback: FeedbackRow[],
  terms: string[],
): { pct: number | null; mentions: number; n: number } {
  if (feedback.length === 0) return { pct: null, mentions: 0, n: 0 };
  let mentions = 0;
  for (const f of feedback) {
    if (typeof f.strengths === 'string' && f.strengths.trim() !== '' && matchesAny(f.strengths, terms)) {
      mentions += 1;
    }
  }
  return { pct: round1((mentions / feedback.length) * 100), mentions, n: feedback.length };
}

/** Compact evidence summary echoed on every engine output (Coverage transparency). */
export function evidenceSummary(ev: Evidence) {
  return {
    interviews: ev.interviews_count,
    scores: ev.scores.length,
    feedback: ev.feedback.length,
    decisions: ev.decisions.length,
    candidate_fields: {
      match_score: ev.candidate.match_score,
      assessment_score: ev.candidate.assessment_score,
      ei_score: ev.candidate.ei_score,
      rating: ev.candidate.rating,
      stage: ev.candidate.stage,
    },
  };
}
