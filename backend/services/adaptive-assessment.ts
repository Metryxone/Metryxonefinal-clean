/**
 * Adaptive Assessment Runtime — Phase 1 S7
 *
 * Replaces static question ordering with an evidence-driven selection engine.
 * At each step the engine asks: "What evidence is still missing?" and selects
 * the unanswered question that best fills the current gap.
 *
 * Signal sources (all read from existing tables — no new client instrumentation):
 *   • Hypotheses (S3)      — active construct_keys + their confidence levels
 *   • Confidence gaps (S4) — current confidence per hypothesis from DB
 *   • Cognitive load (S6)  — latest composite_load; filters out questions that
 *                            would push load past the overload ceiling
 *   • Contradictions (S5)  — unresolved contradiction events; boosts questions
 *                            that probe the contradicted constructs
 *
 * Scoring (per unanswered question):
 *   hypothesis_relevance      × 0.35
 *   confidence_gain_factor    × 0.25
 *   contradiction_probe       × 0.20
 *   base_priority_factor      × 0.10
 *   − cognitive_load_penalty  × 0.10
 *
 * Fatigue protection: questions whose cognitive_weight (adaptive_priority/5)
 * would push the session above the overload ceiling (0.65) are excluded.
 * When all remaining questions are excluded, the engine returns
 *   `{ done: true, reason: "cognitive_load_ceiling" }`.
 *
 * Feature-flag: `adaptive_questioning` — when disabled the caller should
 * fall back to static ordering (this service returns the disabled shape).
 *
 * State update: each selection is recorded in
 *   cognitive_runtime_state.adaptive_runtime_state via S1
 * and written to `adaptive_question_selections` for admin analytics.
 */

import type { Pool } from 'pg';
import { STAGE_CODE_TO_LABEL } from '../lib/lifecycle';
import { isEnabled }   from './feature-flags';
import { updateState } from './cognitive-state';
import { confidenceBand } from './confidence-engine';
import type { ConfidenceBand } from './confidence-engine';
import {
  classifyGovernance,
  type GovernanceRole,
} from './hypothesis-question-governance';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CandidateQuestion {
  id:                     number | string; // integer for SAQ, UUID string for SDI
  question_code:          string;
  question_text:          string;
  stage:                  string;
  age_band:               string | null;
  focus_area:             string | null;
  dimension:              string | null;
  layer:                  string | null;
  options:                Record<string, unknown> | null;
  polarity:               string | null;
  weight:                 string;
  adaptive_priority:      number;   // 1–5
  confidence_gain:        number;   // 0–1
  behavioural_constructs: string[]; // canonical construct keys
  evidence_objectives:    string[];
}

export interface ScoredQuestion extends CandidateQuestion {
  adaptive_score:         number;   // 0–1 composite
  adaptive_reason:        string;   // human-readable why
}

export type AdaptiveResult =
  | { done: false; question: ScoredQuestion }
  | { done: true;  reason: 'cognitive_load_ceiling' | 'no_questions_remaining' | 'flag_disabled' };

// ─── Constants ────────────────────────────────────────────────────────────────

/** composite_load level at which no new questions should be added (S6 shorten_flow). */
const COGNITIVE_LOAD_CEILING = 0.65;

/**
 * Estimated marginal load contribution per adaptive_priority unit (1–5).
 * A priority-5 question contributes 0.10 to the composite load estimate.
 */
const LOAD_PER_PRIORITY = 0.02;

/** Stage code → stage name — sourced from the single lifecycle source of truth. */
const STAGE_CODE_TO_NAME: Record<string, string> = STAGE_CODE_TO_LABEL;

// Scoring weights (must sum to 1 considering penalty is subtracted)
const W_HYPOTHESIS_RELEVANCE = 0.35;
const W_CONFIDENCE_GAIN      = 0.25;
const W_CONTRADICTION_PROBE  = 0.20;
const W_BASE_PRIORITY        = 0.10;
const W_LOAD_PENALTY         = 0.10;

// ─── Data loaders ─────────────────────────────────────────────────────────────

interface SessionCtx {
  concern_name: string;
  age_band:     string;
  stage_code:   string;
}

interface HypothesisRow {
  id:             string;
  construct_key:  string;
  confidence:     string;
  lifecycle_state: string;
}

interface ContradictionRow {
  affected_hypothesis_ids: string[];
  contradiction_type:      string;
}

async function loadSessionCtx(pool: Pool, sessionId: string): Promise<SessionCtx | null> {
  const { rows } = await pool.query<SessionCtx>(
    `SELECT concern_name, age_band, stage_code
     FROM capadex_sessions
     WHERE id = $1`,
    [sessionId]
  );
  return rows[0] ?? null;
}

async function loadActiveHypotheses(pool: Pool, sessionId: string): Promise<HypothesisRow[]> {
  try {
    const { rows } = await pool.query<HypothesisRow>(
      `SELECT id, construct_key, confidence::text, lifecycle_state
       FROM behavioural_hypotheses
       WHERE session_id = $1
         AND lifecycle_state IN ('active', 'reactivated', 'weakened')
       ORDER BY confidence DESC`,
      [sessionId]
    );
    return rows;
  } catch {
    return [];
  }
}

async function loadCurrentLoad(pool: Pool, sessionId: string): Promise<number> {
  try {
    const { rows } = await pool.query<{ composite_load: string }>(
      `SELECT composite_load::text
       FROM cognitive_load_snapshots
       WHERE session_id = $1
       ORDER BY question_index DESC
       LIMIT 1`,
      [sessionId]
    );
    return rows.length > 0 ? Number(rows[0].composite_load) : 0;
  } catch {
    return 0;
  }
}

async function loadActiveContradictions(pool: Pool, sessionId: string): Promise<ContradictionRow[]> {
  try {
    const { rows } = await pool.query<ContradictionRow>(
      `SELECT affected_hypothesis_ids, contradiction_type
       FROM contradiction_events
       WHERE session_id = $1
         AND resolved = FALSE`,
      [sessionId]
    );
    return rows;
  } catch {
    return [];
  }
}

async function loadAnsweredIds(pool: Pool, sessionId: string): Promise<Set<string>> {
  try {
    const { rows } = await pool.query<{ item_id: string }>(
      `SELECT item_id FROM capadex_responses WHERE session_id = $1`,
      [sessionId]
    );
    // Store raw item_id strings — SAQ ids are digit-strings ("42"), SDI ids are UUIDs.
    return new Set(rows.map(r => r.item_id));
  } catch {
    return new Set();
  }
}

interface CandidateRow {
  id:                     string;  // text: digit-string for SAQ, UUID for SDI
  question_code:          string;
  question_text:          string;
  stage:                  string;
  age_band:               string | null;
  focus_area:             string | null;
  dimension:              string | null;
  layer:                  string | null;
  options:                Record<string, unknown> | null;
  polarity:               string | null;
  weight:                 string;
  adaptive_priority:      number;
  confidence_gain:        number;
  behavioural_constructs: unknown;
  evidence_objectives:    unknown;
}

function mapCandidateRow(r: CandidateRow): CandidateQuestion {
  return {
    id:                     /^\d+$/.test(r.id) ? parseInt(r.id, 10) : r.id,
    question_code:          r.question_code,
    question_text:          r.question_text,
    stage:                  r.stage,
    age_band:               r.age_band,
    focus_area:             r.focus_area,
    dimension:              r.dimension,
    layer:                  r.layer,
    options:                r.options,
    polarity:               r.polarity,
    weight:                 r.weight,
    adaptive_priority:      Number(r.adaptive_priority),
    confidence_gain:        Number(r.confidence_gain),
    behavioural_constructs: Array.isArray(r.behavioural_constructs)
                              ? (r.behavioural_constructs as string[])
                              : [],
    evidence_objectives:    Array.isArray(r.evidence_objectives)
                              ? (r.evidence_objectives as string[])
                              : [],
  };
}

/**
 * Loads candidate questions from BOTH question banks for the given session
 * context — mirrors the resolution order used in capadex.ts:
 *  1. short_assessment_questions (SAQ) — indexed by concern_area (name), stage label.
 *  2. sdi_items with age_band filter — indexed by concern_name, stage_code.
 *  3. sdi_items without age_band filter — fallback when step 2 is empty.
 *
 * SDI items get default adaptive_priority=3, confidence_gain=0.10,
 * behavioural_constructs=[], evidence_objectives=[] since those columns only
 * exist on short_assessment_questions.
 */
async function loadCandidateQuestions(
  pool:        Pool,
  concernName: string,
  ageBand:     string,
  stageName:   string,
  stageCode:   string,
): Promise<CandidateQuestion[]> {
  const results: CandidateQuestion[] = [];

  // ── 1. SAQ — primary bank (matched by concern_area name + stage label) ─────
  try {
    const { rows } = await pool.query<CandidateRow>(
      `SELECT
         saq.id::text, saq.question_code, saq.question_text, saq.stage,
         saq.age_band, saq.focus_area, saq.dimension, saq.layer,
         saq.options, saq.polarity, saq.weight::text AS weight,
         COALESCE(saq.adaptive_priority, 3)::int       AS adaptive_priority,
         COALESCE(saq.confidence_gain, 0.10)::float8   AS confidence_gain,
         COALESCE(saq.behavioural_constructs, '[]'::jsonb) AS behavioural_constructs,
         COALESCE(saq.evidence_objectives, '[]'::jsonb)    AS evidence_objectives
       FROM short_assessment_questions saq
       JOIN concern_areas ca ON ca.id = saq.concern_area_id
       WHERE LOWER(ca.concern_area) = LOWER($1)
         AND (saq.age_band = $2 OR saq.age_band IS NULL)
         AND saq.stage = $3
         AND saq.is_active = TRUE
       ORDER BY saq.is_anchor DESC NULLS LAST,
                saq.weight::numeric DESC,
                saq.sort_order ASC, saq.id ASC`,
      [concernName, ageBand, stageName]
    );
    results.push(...rows.map(mapCandidateRow));
  } catch (err: unknown) {
    // SAQ table or concern_areas may not exist in env — log and fall through to SDI
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[adaptive-assessment] SAQ query failed (${concernName}/${stageName}): ${msg}`);
  }

  // ── 2. SDI items with age_band filter ─────────────────────────────────────
  if (results.length < 3) {
    try {
      const { rows } = await pool.query<CandidateRow>(
        `SELECT
           i.id::text, i.item_code AS question_code, i.question AS question_text,
           i.stage_code AS stage, i.age_band, i.focus_area, i.dimension,
           i.layer_tag AS layer,
           COALESCE(
             json_agg(json_build_object(
               'id', o.id, 'option_text', o.text,
               'score_value', o.score_value, 'display_order', o.display_order
             ) ORDER BY o.display_order) FILTER (WHERE o.id IS NOT NULL),
             '[]'::json
           )::jsonb AS options,
           i.polarity, i.weight::text AS weight,
           3::int       AS adaptive_priority,
           0.10::float8 AS confidence_gain,
           '[]'::jsonb  AS behavioural_constructs,
           '[]'::jsonb  AS evidence_objectives
         FROM sdi_items i
         LEFT JOIN sdi_item_options o ON o.item_id = i.id
         WHERE LOWER(i.concern_name) = LOWER($1)
           AND i.stage_code = $2
           AND i.age_band = ANY($3::text[])
           AND i.is_active = TRUE
         GROUP BY i.id
         ORDER BY i.anchor DESC NULLS LAST, i.weight::numeric DESC, i.id`,
        [concernName, stageCode, [ageBand]]
      );
      if (rows.length > results.length) {
        results.length = 0;
        results.push(...rows.map(mapCandidateRow));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[adaptive-assessment] SDI age-band query failed (${concernName}/${stageCode}): ${msg}`);
    }
  }

  // ── 3. SDI items without age_band filter (fallback) ───────────────────────
  if (results.length < 3) {
    try {
      const { rows } = await pool.query<CandidateRow>(
        `SELECT
           i.id::text, i.item_code AS question_code, i.question AS question_text,
           i.stage_code AS stage, i.age_band, i.focus_area, i.dimension,
           i.layer_tag AS layer,
           COALESCE(
             json_agg(json_build_object(
               'id', o.id, 'option_text', o.text,
               'score_value', o.score_value, 'display_order', o.display_order
             ) ORDER BY o.display_order) FILTER (WHERE o.id IS NOT NULL),
             '[]'::json
           )::jsonb AS options,
           i.polarity, i.weight::text AS weight,
           3::int       AS adaptive_priority,
           0.10::float8 AS confidence_gain,
           '[]'::jsonb  AS behavioural_constructs,
           '[]'::jsonb  AS evidence_objectives
         FROM sdi_items i
         LEFT JOIN sdi_item_options o ON o.item_id = i.id
         WHERE LOWER(i.concern_name) = LOWER($1)
           AND i.stage_code = $2
           AND i.is_active = TRUE
         GROUP BY i.id
         ORDER BY i.anchor DESC NULLS LAST, i.weight::numeric DESC, i.id`,
        [concernName, stageCode]
      );
      if (rows.length > results.length) {
        results.length = 0;
        results.push(...rows.map(mapCandidateRow));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[adaptive-assessment] SDI no-age-band fallback failed (${concernName}/${stageCode}): ${msg}`);
    }
  }

  return results;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function clamp(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/**
 * Returns the fraction of the question's constructs that overlap with an active
 * hypothesis construct key (case-insensitive substring match).
 */
function hypothesisRelevance(
  questionConstructs: string[],
  hypotheses:         HypothesisRow[],
): { relevance: number; matchedKey: string | null; minConfidence: number } {
  if (questionConstructs.length === 0 || hypotheses.length === 0) {
    return { relevance: 0, matchedKey: null, minConfidence: 0.5 };
  }

  let matches  = 0;
  let matchKey: string | null = null;
  let minConf  = 1;

  for (const qk of questionConstructs) {
    const qkLower = qk.toLowerCase();
    for (const h of hypotheses) {
      const hkLower = h.construct_key.toLowerCase();
      if (qkLower === hkLower || qkLower.includes(hkLower) || hkLower.includes(qkLower)) {
        matches++;
        matchKey = h.construct_key;
        const conf = Number(h.confidence);
        if (conf < minConf) minConf = conf;
        break;
      }
    }
  }

  return {
    relevance:     clamp(matches / questionConstructs.length),
    matchedKey:    matchKey,
    minConfidence: minConf,
  };
}

/**
 * Returns a [0–1] score representing how much this question might reveal about
 * contradicted constructs. 1.0 when the question directly probes a construct
 * implicated in an unresolved contradiction.
 */
function contradictionProbeScore(
  questionConstructs: string[],
  contradictions:     ContradictionRow[],
  hypotheses:         HypothesisRow[],
): number {
  if (contradictions.length === 0 || questionConstructs.length === 0) return 0;

  // Build set of hypothesis IDs involved in any unresolved contradiction
  const contraHypIds = new Set<string>();
  for (const c of contradictions) {
    for (const id of c.affected_hypothesis_ids) {
      contraHypIds.add(String(id));
    }
  }

  // Map those hypothesis IDs to construct_keys
  const contraConstructs = new Set<string>();
  for (const h of hypotheses) {
    if (contraHypIds.has(h.id)) {
      contraConstructs.add(h.construct_key.toLowerCase());
    }
  }

  if (contraConstructs.size === 0) return 0;

  let probeMatches = 0;
  for (const qk of questionConstructs) {
    const qkLower = qk.toLowerCase();
    for (const ck of contraConstructs) {
      if (qkLower === ck || qkLower.includes(ck) || ck.includes(qkLower)) {
        probeMatches++;
        break;
      }
    }
  }
  return clamp(probeMatches / questionConstructs.length);
}

/**
 * Build the human-readable adaptive_reason string.
 */
function buildReason(opts: {
  hypothesisRelevance:  number;
  matchedKey:           string | null;
  minConfidence:        number;
  contradictionProbe:   number;
  confidenceGain:       number;
  evidenceObjectives:   string[];
  isAnchor:             boolean;
}): string {
  const parts: string[] = [];

  if (opts.contradictionProbe >= 0.5 && opts.matchedKey) {
    parts.push(`Probing contradiction in construct '${opts.matchedKey}'`);
  } else if (opts.hypothesisRelevance >= 0.7 && opts.matchedKey) {
    const confPct = Math.round(opts.minConfidence * 100);
    parts.push(`Targeting '${opts.matchedKey}' hypothesis (current confidence: ${confPct}%)`);
  } else if (opts.hypothesisRelevance > 0 && opts.matchedKey) {
    parts.push(`Related to active hypothesis '${opts.matchedKey}'`);
  } else if (opts.evidenceObjectives.length > 0) {
    const obj = opts.evidenceObjectives[0].replace(/_/g, ' ');
    parts.push(`Collecting ${obj}`);
  }

  if (opts.isAnchor) {
    parts.push('anchor question');
  }

  if (opts.confidenceGain >= 0.15) {
    parts.push('high evidence yield');
  }

  return parts.length > 0 ? parts.join('; ') : 'standard evidence collection';
}

// ─── Scoring core (shared by selection + ranking) ───────────────────────────────

/** Per-session signals the scorer reads; identical for every candidate in a pass. */
interface ScoreContext {
  hypotheses:              HypothesisRow[];
  contradictions:          ContradictionRow[];
  currentLoad:             number;
  minHypothesisConfidence: number;
}

/** Full numeric breakdown for one candidate — superset of what ScoredQuestion needs. */
interface ScoreBreakdown {
  relevance:            number;
  matchedKey:           string | null;
  minConfidence:        number;
  probeScore:           number;
  confidenceGainFactor: number;
  adaptive_score:       number;
  adaptive_reason:      string;
}

/**
 * Pure scoring of a single candidate against the session context. Extracted
 * verbatim from selectNextQuestion's inline map so selection behaviour is
 * byte-identical; rankCandidateQuestions reuses the same breakdown.
 */
function computeScoreBreakdown(q: CandidateQuestion, ctx: ScoreContext): ScoreBreakdown {
  const { relevance, matchedKey, minConfidence } = hypothesisRelevance(
    q.behavioural_constructs, ctx.hypotheses
  );

  // confidence_gain_factor: weight the question's gain by the current gap.
  // When confidence is already high (0.9) there is less urgency → scale down.
  const confidenceGap        = clamp(1 - ctx.minHypothesisConfidence);
  const confidenceGainFactor = clamp(q.confidence_gain * (0.5 + confidenceGap * 0.5));

  const probeScore = contradictionProbeScore(
    q.behavioural_constructs, ctx.contradictions, ctx.hypotheses
  );

  // basePriorityFactor: prefer middle-priority questions (3) early, let
  // higher-priority ones emerge as confidence builds.
  const basePriority = clamp(1 - Math.abs(q.adaptive_priority - 3) / 4);

  // loadPenalty: the higher the current load, the more we penalise heavy questions.
  const loadPenalty = clamp(ctx.currentLoad * (q.adaptive_priority / 5));

  const adaptive_score = clamp(
    relevance          * W_HYPOTHESIS_RELEVANCE +
    confidenceGainFactor * W_CONFIDENCE_GAIN     +
    probeScore         * W_CONTRADICTION_PROBE   +
    basePriority       * W_BASE_PRIORITY         -
    loadPenalty        * W_LOAD_PENALTY
  );

  const adaptive_reason = buildReason({
    hypothesisRelevance: relevance,
    matchedKey,
    minConfidence,
    contradictionProbe:  probeScore,
    confidenceGain:      q.confidence_gain,
    evidenceObjectives:  q.evidence_objectives,
    isAnchor:            q.evidence_objectives.includes('construct_anchor'),
  });

  return { relevance, matchedKey, minConfidence, probeScore, confidenceGainFactor, adaptive_score, adaptive_reason };
}

/** Project a breakdown onto the ScoredQuestion shape selectNextQuestion expects. */
function scoreCandidate(q: CandidateQuestion, ctx: ScoreContext): ScoredQuestion {
  const b = computeScoreBreakdown(q, ctx);
  return { ...q, adaptive_score: b.adaptive_score, adaptive_reason: b.adaptive_reason };
}

// ─── Main engine ──────────────────────────────────────────────────────────────

/**
 * Select the next best question for the given session.
 *
 * @param pool      — PG connection pool
 * @param sessionId — CAPADEX session ID
 * @param tenantId  — optional tenant for feature-flag resolution
 */
export async function selectNextQuestion(
  pool:      Pool,
  sessionId: string,
  tenantId?: string,
): Promise<AdaptiveResult> {
  if (!isEnabled('adaptive_questioning', tenantId)) {
    return { done: true, reason: 'flag_disabled' };
  }

  // ── Load all context in parallel ─────────────────────────────────────────
  const [session, hypotheses, currentLoad, contradictions, answeredIds] =
    await Promise.all([
      loadSessionCtx(pool, sessionId),
      loadActiveHypotheses(pool, sessionId),
      loadCurrentLoad(pool, sessionId),
      loadActiveContradictions(pool, sessionId),
      loadAnsweredIds(pool, sessionId),
    ]);

  if (!session) return { done: true, reason: 'no_questions_remaining' };

  const stageName = STAGE_CODE_TO_NAME[session.stage_code] ?? 'Curiosity';

  const allCandidates = await loadCandidateQuestions(
    pool, session.concern_name, session.age_band, stageName, session.stage_code
  );

  // Filter out already-answered questions (compare as strings — SAQ ids are "42", SDI are UUIDs)
  const unanswered = allCandidates.filter(q => !answeredIds.has(String(q.id)));

  if (unanswered.length === 0) {
    return { done: true, reason: 'no_questions_remaining' };
  }

  // ── Cognitive load ceiling filter ─────────────────────────────────────────
  // Exclude questions whose marginal load contribution would breach the ceiling.
  const eligible = unanswered.filter(q => {
    const marginalLoad = q.adaptive_priority * LOAD_PER_PRIORITY;
    return (currentLoad + marginalLoad) <= COGNITIVE_LOAD_CEILING;
  });

  if (eligible.length === 0) {
    return { done: true, reason: 'cognitive_load_ceiling' };
  }

  // ── Min confidence across active hypotheses ───────────────────────────────
  const minHypothesisConfidence = hypotheses.length > 0
    ? Math.min(...hypotheses.map(h => Number(h.confidence)))
    : 0.5;

  // ── Score each eligible question ──────────────────────────────────────────
  const scoreCtx: ScoreContext = {
    hypotheses,
    contradictions,
    currentLoad,
    minHypothesisConfidence,
  };
  const scored: ScoredQuestion[] = eligible.map(q => scoreCandidate(q, scoreCtx));

  // Sort descending by score; use adaptive_priority ascending as tiebreaker
  // (prefer lighter questions when scores are equal).
  scored.sort((a, b) =>
    b.adaptive_score - a.adaptive_score ||
    a.adaptive_priority - b.adaptive_priority
  );

  const best = scored[0];

  // ── Persist selection record (non-blocking) ────────────────────────────────
  pool.query(
    `INSERT INTO adaptive_question_selections
       (session_id, question_id, question_code, selection_reason, adaptive_score, confidence_gain, hypothesis_keys)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      sessionId,
      String(best.id),
      best.question_code,
      best.adaptive_reason,
      best.adaptive_score.toFixed(4),
      best.confidence_gain.toFixed(4),
      JSON.stringify(hypotheses.map(h => h.construct_key)),
    ]
  ).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[adaptive-assessment] selection record error for q${best.id}: ${msg}`);
  });

  // ── Update adaptive_runtime_state via S1 (non-blocking) ───────────────────
  updateState(pool, sessionId, {
    adaptive_runtime_state: {
      last_question_id:      String(best.id),
      last_selection_reason: best.adaptive_reason,
      questions_selected:    [...answeredIds].concat([String(best.id)]),
      evidence_gaps:         hypotheses
        .filter(h => Number(h.confidence) < 0.4)
        .map(h => h.construct_key),
    },
  }, `adaptive_select:q${best.id}`)
    .catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[adaptive-assessment] state update error for session ${sessionId}: ${msg}`);
    });

  return { done: false, question: best };
}

// ─── Ranked selection surface (read-only, governance-annotated) ──────────────────

export interface RankedQuestion extends ScoredQuestion {
  /** Active hypothesis construct this question targets, or null. */
  target_construct:     string | null;
  /** Confidence band of the targeted hypothesis, or null when no target. */
  target_band:          ConfidenceBand | null;
  /** Investigative role this question plays against the current hypothesis set. */
  governance_role:      GovernanceRole;
  /** Non-generic explanation of the role. */
  governance_rationale: string;
}

/**
 * Rank ALL eligible candidates for a session (not just the single best) and
 * annotate each with its confidence band + investigative governance role. Pure
 * read: NO selection record, NO state write — it never mutates the runtime, so
 * it is safe to call repeatedly from an admin/inspection surface.
 *
 * Returns [] when the flag is off, the session is unknown, or nothing remains
 * eligible — the caller decides how to present an empty list.
 */
export async function rankCandidateQuestions(
  pool:      Pool,
  sessionId: string,
  tenantId?: string,
): Promise<RankedQuestion[]> {
  if (!isEnabled('adaptive_questioning', tenantId)) return [];

  const [session, hypotheses, currentLoad, contradictions, answeredIds] =
    await Promise.all([
      loadSessionCtx(pool, sessionId),
      loadActiveHypotheses(pool, sessionId),
      loadCurrentLoad(pool, sessionId),
      loadActiveContradictions(pool, sessionId),
      loadAnsweredIds(pool, sessionId),
    ]);

  if (!session) return [];

  const stageName = STAGE_CODE_TO_NAME[session.stage_code] ?? 'Curiosity';

  const allCandidates = await loadCandidateQuestions(
    pool, session.concern_name, session.age_band, stageName, session.stage_code
  );

  const unanswered = allCandidates.filter(q => !answeredIds.has(String(q.id)));
  const eligible = unanswered.filter(q => {
    const marginalLoad = q.adaptive_priority * LOAD_PER_PRIORITY;
    return (currentLoad + marginalLoad) <= COGNITIVE_LOAD_CEILING;
  });
  if (eligible.length === 0) return [];

  const minHypothesisConfidence = hypotheses.length > 0
    ? Math.min(...hypotheses.map(h => Number(h.confidence)))
    : 0.5;

  const ctx: ScoreContext = { hypotheses, contradictions, currentLoad, minHypothesisConfidence };

  const ranked: RankedQuestion[] = eligible.map(q => {
    const b = computeScoreBreakdown(q, ctx);
    const target_band = b.matchedKey ? confidenceBand(b.minConfidence) : null;
    const { role, rationale } = classifyGovernance({
      targetConstruct:    b.matchedKey,
      band:               target_band,
      relevance:          b.relevance,
      contradictionProbe: b.probeScore,
      confidenceGain:     b.confidenceGainFactor,
    });
    return {
      ...q,
      adaptive_score:       b.adaptive_score,
      adaptive_reason:      b.adaptive_reason,
      target_construct:     b.matchedKey,
      target_band,
      governance_role:      role,
      governance_rationale: rationale,
    };
  });

  ranked.sort((a, b) =>
    b.adaptive_score - a.adaptive_score ||
    a.adaptive_priority - b.adaptive_priority
  );

  return ranked;
}
