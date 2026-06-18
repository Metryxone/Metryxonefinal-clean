/**
 * Confidence & Reasoning Engine — Phase 1 S4
 *
 * Computes and evolves confidence scores for behavioural hypotheses using a
 * deterministic weighted formula. Every update is persisted as a trace row
 * so the full confidence evolution is explainable to admins and auditors.
 *
 * Formula (all constants are named and inspectable):
 *   raw = BASE_WEIGHT × evidence_depth_factor × signal_reliability_factor
 *         × longitudinal_factor × (1 − contradiction_penalty)
 *   confidence = clamp(raw, CONFIDENCE_MIN, CONFIDENCE_MAX)
 *   uncertainty = clamp(1 − confidence + UNCERTAINTY_FLOOR_BUFFER, UNCERTAINTY_MIN, 1)
 *
 * Feature-flag: `confidence_engine` — when disabled callers receive the
 * hypothesis's existing static confidence without writing any trace.
 */

import type { Pool } from 'pg';
import { isEnabled } from './feature-flags';
import { updateState } from './cognitive-state';
import { broadcastToSession } from './ws-broadcast';

// ─── Named weight constants (governable) ─────────────────────────────────────

/** Multiplier applied to the base hypothesis confidence at formula entry. */
const BASE_WEIGHT = 1.0;

/** Scales how strongly evidence depth contributes. Range 0–1 scales linearly. */
const EVIDENCE_DEPTH_SCALE = 0.30;

/** Scales how strongly signal reliability contributes. */
const SIGNAL_RELIABILITY_SCALE = 0.25;

/** Scales how strongly cross-session longitudinal consistency contributes. */
const LONGITUDINAL_CONSISTENCY_SCALE = 0.20;

/** Maximum penalty applied when full contradiction (contradiction_weighting = 1). */
const CONTRADICTION_MAX_PENALTY = 0.40;

/** Absolute floor for computed confidence (never 0 — hypothesis is never disproven). */
const CONFIDENCE_MIN = 0.05;

/** Absolute ceiling for computed confidence (never 1 — preserve epistemic humility). */
const CONFIDENCE_MAX = 0.95;

/** Floor added to (1 − confidence) when deriving uncertainty (accounts for model uncertainty). */
const UNCERTAINTY_FLOOR_BUFFER = 0.05;

/** Absolute floor for computed uncertainty. */
const UNCERTAINTY_MIN = 0.05;

/** Confidence boost per low-scoring answer when trigger is new_answer (score < 33 %). */
const NEW_ANSWER_LOW_BOOST = 0.05;

/** Confidence boost per signal event scaled to signal strength. */
const SIGNAL_STRENGTH_BOOST_SCALE = 0.08;

/** Contradiction penalty step per detected contradiction event. */
const CONTRADICTION_PENALTY_STEP = 0.10;

/** Confidence boost per longitudinal match event. */
const LONGITUDINAL_MATCH_BOOST = 0.06;

// ─── Confidence bands ─────────────────────────────────────────────────────────

/**
 * Qualitative band a numeric confidence falls into. Bands make the engine's
 * numeric output human-legible (and drive question governance in T2):
 *   weak     — confidence ≤ 0.40 (hypothesis poorly supported; candidate for elimination)
 *   moderate — 0.40 < confidence ≤ 0.70 (needs strengthening evidence)
 *   strong   — confidence > 0.70 (well supported)
 */
export type ConfidenceBand = 'weak' | 'moderate' | 'strong';

/** Upper bounds (inclusive) for the weak and moderate bands. */
export const CONFIDENCE_BAND_THRESHOLDS = {
  weak_max:     0.40,
  moderate_max: 0.70,
} as const;

/** Pure mapping from a numeric confidence (0–1) to its qualitative band. */
export function confidenceBand(score: number): ConfidenceBand {
  if (score <= CONFIDENCE_BAND_THRESHOLDS.weak_max)     return 'weak';
  if (score <= CONFIDENCE_BAND_THRESHOLDS.moderate_max) return 'moderate';
  return 'strong';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfidenceInputs {
  /** Starting / current confidence before this computation. */
  base_confidence:           number;
  /** 0–1: proportion of evidence types present for this hypothesis. */
  evidence_depth:            number;
  /** 0–1: quality / reliability rating of the driving signal. */
  signal_reliability:        number;
  /** 0–1: consistency of this construct across prior sessions (0 = first session). */
  longitudinal_consistency:  number;
  /** 0–1: accumulated contradiction weight (0 = no contradictions, 1 = fully contradicted). */
  contradiction_weighting:   number;
}

export interface ConfidenceResult {
  confidence:               number;
  uncertainty:              number;
  band:                     ConfidenceBand;
  evidence_depth:           number;
  signal_reliability:       number;
  longitudinal_consistency: number;
  contradiction_weighting:  number;
  reason_why:               string;
}

export interface TraceRow {
  id:                       string;
  session_id:               string;
  hypothesis_id:            string | null;
  trigger_event:            string;
  confidence_before:        number;
  confidence_after:         number;
  uncertainty_before:       number;
  uncertainty_after:        number;
  evidence_depth:           number;
  signal_reliability:       number;
  longitudinal_consistency: number;
  contradiction_weighting:  number;
  reason_why:               string;
  trace_detail:             Record<string, unknown>;
  created_at:               string;
}

// ─── Core formula ─────────────────────────────────────────────────────────────

/**
 * Compute a new confidence + uncertainty pair from structured inputs.
 * Pure function — no side effects.
 */
export function computeConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  const {
    base_confidence,
    evidence_depth,
    signal_reliability,
    longitudinal_consistency,
    contradiction_weighting,
  } = inputs;

  // Evidence contribution: linearly scales the base in [0, EVIDENCE_DEPTH_SCALE]
  const evidenceFactor = 1 + EVIDENCE_DEPTH_SCALE * evidence_depth;

  // Signal reliability contribution
  const signalFactor = 1 + SIGNAL_RELIABILITY_SCALE * signal_reliability;

  // Longitudinal consistency contribution
  const longitudinalFactor = 1 + LONGITUDINAL_CONSISTENCY_SCALE * longitudinal_consistency;

  // Contradiction penalty
  const contradictionPenalty = CONTRADICTION_MAX_PENALTY * contradiction_weighting;

  // Raw confidence before clamping
  const raw = BASE_WEIGHT
    * base_confidence
    * evidenceFactor
    * signalFactor
    * longitudinalFactor
    * (1 - contradictionPenalty);

  const confidence = clamp(raw, CONFIDENCE_MIN, CONFIDENCE_MAX);
  const uncertainty = clamp(1 - confidence + UNCERTAINTY_FLOOR_BUFFER, UNCERTAINTY_MIN, 1);

  const reason_why = buildReasonWhy({
    evidence_depth,
    signal_reliability,
    longitudinal_consistency,
    contradiction_weighting,
    raw,
    confidence,
  });

  const roundedConfidence = round4(confidence);

  return {
    confidence:               roundedConfidence,
    uncertainty:              round4(uncertainty),
    band:                     confidenceBand(roundedConfidence),
    evidence_depth:           round4(evidence_depth),
    signal_reliability:       round4(signal_reliability),
    longitudinal_consistency: round4(longitudinal_consistency),
    contradiction_weighting:  round4(contradiction_weighting),
    reason_why,
  };
}

// ─── Evolution trigger functions ──────────────────────────────────────────────

/**
 * A new assessment answer has been recorded for a hypothesis.
 * Low-scoring answers (< 33 % of max) provide positive evidence.
 * High-scoring answers (> 66 % of max) weaken confidence slightly.
 */
export async function onNewAnswer(
  pool:         Pool,
  hypothesisId: string,
  sessionId:    string,
  answerValue:  number,
  maxValue:     number,
  tenantId?:    string,
): Promise<ConfidenceResult | null> {
  if (!isEnabled('confidence_engine', tenantId)) return null;

  const pct = maxValue > 0 ? answerValue / maxValue : 0.5;
  let confidenceDelta: number;
  let signalReliability: number;

  if (pct < 0.33) {
    // Strong positive evidence — low score on a problem construct is confirming
    confidenceDelta  =  NEW_ANSWER_LOW_BOOST;
    signalReliability = 0.80;
  } else if (pct > 0.66) {
    // High score may disconfirm — slight penalty
    confidenceDelta  = -NEW_ANSWER_LOW_BOOST;
    signalReliability = 0.60;
  } else {
    // Neutral answer — minimal evidence contribution
    confidenceDelta  = 0;
    signalReliability = 0.40;
  }

  const result = await applyDelta(pool, hypothesisId, sessionId, {
    trigger_event:    'new_answer',
    confidence_delta: confidenceDelta,
    evidence_depth_boost: 0.05,
    signal_reliability:   signalReliability,
    longitudinal_consistency: 0,
    contradiction_weighting:  0,
    trace_detail: { answer_value: answerValue, max_value: maxValue, pct: round4(pct) },
  });

  // Broadcast confidence update — fire-and-forget, flag-gated
  if (result) {
    broadcastToSession(sessionId, {
      type: 'confidence_updated',
      data: {
        hypothesis_id: hypothesisId,
        confidence:    result.confidence,
        uncertainty:   result.uncertainty,
        reason_why:    result.reason_why,
        trigger:       'new_answer',
      },
      explain: `Confidence updated to ${(result.confidence * 100).toFixed(0)}% after new answer`,
    }, tenantId);
  }

  return result;
}

/**
 * A behavioural signal has been detected that supports or undermines this hypothesis.
 * `signalStrength` should be 0–1 (1 = very strong signal).
 */
export async function onSignalDetected(
  pool:          Pool,
  hypothesisId:  string,
  sessionId:     string,
  signalStrength: number,
  signalType:    string,
  tenantId?:     string,
): Promise<ConfidenceResult | null> {
  if (!isEnabled('confidence_engine', tenantId)) return null;

  const delta = SIGNAL_STRENGTH_BOOST_SCALE * clamp(signalStrength, 0, 1);

  return applyDelta(pool, hypothesisId, sessionId, {
    trigger_event:    'signal_detected',
    confidence_delta: delta,
    evidence_depth_boost: 0.03,
    signal_reliability:   clamp(signalStrength, 0.1, 0.9),
    longitudinal_consistency: 0,
    contradiction_weighting:  0,
    trace_detail: { signal_type: signalType, signal_strength: signalStrength },
  });
}

/**
 * A contradiction has been detected in response patterns for this hypothesis.
 * Reduces confidence and increases uncertainty.
 */
export async function onContradictionDetected(
  pool:               Pool,
  hypothesisId:       string,
  sessionId:          string,
  contradictionScore: number,   // 0–1
  contradictionType:  string,
  tenantId?:          string,
): Promise<ConfidenceResult | null> {
  if (!isEnabled('confidence_engine', tenantId)) return null;

  const score = clamp(contradictionScore, 0, 1);
  const delta  = -(CONTRADICTION_PENALTY_STEP * score);

  return applyDelta(pool, hypothesisId, sessionId, {
    trigger_event:    'contradiction_detected',
    confidence_delta: delta,
    evidence_depth_boost: 0,
    signal_reliability:   0.30,
    longitudinal_consistency: 0,
    contradiction_weighting:  score,
    trace_detail: { contradiction_type: contradictionType, contradiction_score: score },
  });
}

/**
 * A longitudinal match has been found — this construct appeared in a prior session.
 * Boosts confidence due to cross-session consistency.
 */
export async function onLongitudinalMatch(
  pool:          Pool,
  hypothesisId:  string,
  sessionId:     string,
  matchScore:    number,  // 0–1: how strongly it matched the prior session
  priorSessionId: string,
  tenantId?:     string,
): Promise<ConfidenceResult | null> {
  if (!isEnabled('confidence_engine', tenantId)) return null;

  const delta = LONGITUDINAL_MATCH_BOOST * clamp(matchScore, 0, 1);

  return applyDelta(pool, hypothesisId, sessionId, {
    trigger_event:    'longitudinal_match',
    confidence_delta: delta,
    evidence_depth_boost: 0.08,
    signal_reliability:   0.85,
    longitudinal_consistency: clamp(matchScore, 0, 1),
    contradiction_weighting:  0,
    trace_detail: { prior_session_id: priorSessionId, match_score: matchScore },
  });
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

interface DeltaParams {
  trigger_event:            string;
  confidence_delta:         number;
  evidence_depth_boost:     number;
  signal_reliability:       number;
  longitudinal_consistency: number;
  contradiction_weighting:  number;
  trace_detail:             Record<string, unknown>;
}

/**
 * Reads the current hypothesis, applies a confidence delta, writes both the
 * updated hypothesis row and a `confidence_traces` row inside a transaction.
 * Syncs the `confidence_scores` map into `cognitive_runtime_state` non-blockingly.
 */
async function applyDelta(
  pool:         Pool,
  hypothesisId: string,
  sessionId:    string,
  params:       DeltaParams,
): Promise<ConfidenceResult | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current hypothesis
    const { rows: hRows } = await client.query<{
      id: string;
      confidence: string;
      uncertainty: string;
      construct_key: string;
    }>(
      `SELECT id, confidence, uncertainty, construct_key
       FROM behavioural_hypotheses
       WHERE id = $1 AND session_id = $2`,
      [hypothesisId, sessionId]
    );

    if (hRows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const h = hRows[0];
    const confidenceBefore = Number(h.confidence);
    const uncertaintyBefore = Number(h.uncertainty);

    // 2. Compute new confidence
    const result = computeConfidence({
      base_confidence:           clamp(confidenceBefore + params.confidence_delta, CONFIDENCE_MIN, CONFIDENCE_MAX),
      evidence_depth:            clamp(params.evidence_depth_boost, 0, 1),
      signal_reliability:        params.signal_reliability,
      longitudinal_consistency:  params.longitudinal_consistency,
      contradiction_weighting:   params.contradiction_weighting,
    });

    // 3. Update hypothesis row
    await client.query(
      `UPDATE behavioural_hypotheses
       SET confidence  = $1,
           uncertainty = $2,
           updated_at  = now()
       WHERE id = $3`,
      [result.confidence, result.uncertainty, hypothesisId]
    );

    // 4. Insert trace row
    await client.query(
      `INSERT INTO confidence_traces
         (session_id, hypothesis_id, trigger_event,
          confidence_before, confidence_after,
          uncertainty_before, uncertainty_after,
          evidence_depth, signal_reliability,
          longitudinal_consistency, contradiction_weighting,
          reason_why, trace_detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        sessionId,
        hypothesisId,
        params.trigger_event,
        confidenceBefore,
        result.confidence,
        uncertaintyBefore,
        result.uncertainty,
        result.evidence_depth,
        result.signal_reliability,
        result.longitudinal_consistency,
        result.contradiction_weighting,
        result.reason_why,
        JSON.stringify({
          ...params.trace_detail,
          construct_key:    h.construct_key,
          confidence_delta: params.confidence_delta,
          weights: {
            BASE_WEIGHT,
            EVIDENCE_DEPTH_SCALE,
            SIGNAL_RELIABILITY_SCALE,
            LONGITUDINAL_CONSISTENCY_SCALE,
            CONTRADICTION_MAX_PENALTY,
          },
        }),
      ]
    );

    await client.query('COMMIT');

    // 5. Sync confidence_scores into cognitive_runtime_state (non-blocking, UUID guard).
    // Uses MAX(confidence) GROUP BY construct_key with NOT IN ('archived') filter —
    // consistent with the route-level sync helpers to ensure deterministic output
    // when multiple hypotheses share the same construct_key.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(sessionId)) {
      pool.query<{ construct_key: string; confidence: string }>(
        `SELECT construct_key, MAX(confidence) AS confidence
         FROM behavioural_hypotheses
         WHERE session_id = $1 AND lifecycle_state NOT IN ('archived')
         GROUP BY construct_key`,
        [sessionId]
      ).then(({ rows }) => {
        const confidenceScores: Record<string, number> = {};
        for (const r of rows) confidenceScores[r.construct_key] = Number(r.confidence);
        return updateState(pool, sessionId, { confidence_scores: confidenceScores },
          `confidence_update:${params.trigger_event}:${hypothesisId.slice(-8)}`);
      }).catch(err => console.error('[confidence-engine] state sync error:', err));
    }

    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('[confidence-engine] applyDelta error:', err);
    return null;
  } finally {
    client.release();
  }
}

// ─── Trace reader ─────────────────────────────────────────────────────────────

/**
 * Return all confidence traces for a session, ordered ascending (oldest first).
 * Optionally filter to a specific hypothesis.
 */
export async function getConfidenceTrace(
  pool:          Pool,
  sessionId:     string,
  hypothesisId?: string,
): Promise<TraceRow[]> {
  const conditions = ['session_id = $1'];
  const values: (string | undefined)[] = [sessionId];

  if (hypothesisId) {
    conditions.push(`hypothesis_id = $${values.length + 1}`);
    values.push(hypothesisId);
  }

  const { rows } = await pool.query<TraceRow>(
    `SELECT * FROM confidence_traces
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at ASC`,
    values
  );
  return rows;
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round4(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

function buildReasonWhy(ctx: {
  evidence_depth:           number;
  signal_reliability:       number;
  longitudinal_consistency: number;
  contradiction_weighting:  number;
  raw:                      number;
  confidence:               number;
}): string {
  const parts: string[] = [];

  if (ctx.evidence_depth > 0.6) {
    parts.push('strong evidence depth');
  } else if (ctx.evidence_depth > 0.3) {
    parts.push('moderate evidence depth');
  } else {
    parts.push('limited evidence');
  }

  if (ctx.signal_reliability > 0.7) {
    parts.push('high-reliability signal');
  } else if (ctx.signal_reliability > 0.4) {
    parts.push('moderate signal reliability');
  } else {
    parts.push('low signal reliability');
  }

  if (ctx.longitudinal_consistency > 0.5) {
    parts.push('cross-session consistency confirmed');
  }

  if (ctx.contradiction_weighting > 0.5) {
    parts.push(`contradiction penalty applied (weight=${ctx.contradiction_weighting.toFixed(2)})`);
  } else if (ctx.contradiction_weighting > 0) {
    parts.push('minor contradiction detected');
  }

  const cappedNote = ctx.raw > CONFIDENCE_MAX ? ` [raw ${ctx.raw.toFixed(4)} capped to ${CONFIDENCE_MAX}]`
    : ctx.raw < CONFIDENCE_MIN ? ` [raw ${ctx.raw.toFixed(4)} floored to ${CONFIDENCE_MIN}]`
    : '';

  return `Confidence ${ctx.confidence.toFixed(4)}: ${parts.join(', ')}${cappedNote}.`;
}

// ─── Shared state sync helper ─────────────────────────────────────────────────

/**
 * Non-blockingly reads all active/reactivated hypotheses for a session and
 * writes the `confidence_scores` map into `cognitive_runtime_state`.
 *
 * Call this after EVERY path that changes hypothesis confidence values:
 *   - applyDelta (trigger-driven updates)
 *   - persistHypotheses (initial generation when flag enabled)
 *   - updateLifecycle (lifecycle actions when flag enabled)
 *
 * UUID-gated: no-op for non-CAPADEX session IDs to prevent FK violations.
 */
export function syncConfidenceScores(pool: Pool, sessionId: string): void {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(sessionId)) return;

  // Aggregate per construct: MAX gives the strongest current evidence for each
  // behavioral construct, accounting for multiple hypotheses per construct.
  pool.query<{ construct_key: string; confidence: string }>(
    `SELECT construct_key, MAX(confidence) AS confidence
     FROM behavioural_hypotheses
     WHERE session_id = $1 AND lifecycle_state NOT IN ('archived')
     GROUP BY construct_key`,
    [sessionId]
  ).then(({ rows }) => {
    const confidenceScores: Record<string, number> = {};
    for (const r of rows) confidenceScores[r.construct_key] = Number(r.confidence);
    return updateState(pool, sessionId, { confidence_scores: confidenceScores }, 'confidence_sync');
  }).catch(err => console.error('[confidence-engine] syncConfidenceScores error:', err));
}
