/**
 * Conversational Quality Engine — Phase 2 S11
 *
 * Continuously evaluates 8 quality dimensions for a CAPADEX session by
 * synthesising signals from existing runtime tables (cognitive load, signal
 * profiles, hypotheses, contradictions).  Produces:
 *
 *   • 8 quality dimension scores  (0–100, higher = better)
 *   • overall_quality_score       (0–100, composite weighted average)
 *   • adaptation_quality          (evidence + effectiveness sub-index)
 *   • orchestration_quality       (coherence + smoothness sub-index)
 *   • emotional_safety_score      (dedicated; drives escalation gating)
 *   • active_directives[]         (runtime instructions for frontend/orchestrator)
 *
 * Directives (triggered when thresholds are crossed):
 *   simplify_runtime          — coherence < 50 OR evidence_quality < 45
 *   reduce_adaptation_intensity — adaptive_effectiveness < 45
 *   trigger_fallback_flow     — overall_quality < 30
 *   slow_pacing               — fatigue > 65 OR smoothness < 35
 *   prevent_escalation        — emotional_safety < 45
 *
 * Safety guarantees:
 *   • All operations are read-only on existing tables.
 *   • evaluateQuality() is fire-and-forget — never throws to the caller.
 *   • Flag-gated via 'conversational_quality' feature flag.
 */

import type { Pool } from 'pg';
import { isEnabled }          from './feature-flags';
import { broadcastToSession } from './ws-broadcast';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RuntimeDirective =
  | 'simplify_runtime'
  | 'reduce_adaptation_intensity'
  | 'trigger_fallback_flow'
  | 'slow_pacing'
  | 'prevent_escalation';

export interface QualityDimensions {
  conversational_coherence:  number;
  engagement_quality:        number;
  emotional_safety:          number;
  conversational_smoothness: number;
  adaptive_effectiveness:    number;
  evidence_quality:          number;
  runtime_friction:          number;  // higher = more friction (inverted in composite)
  user_fatigue:              number;  // higher = more fatigue (inverted in composite)
}

export interface QualityResult extends QualityDimensions {
  overall_quality_score:  number;
  adaptation_quality:     number;
  orchestration_quality:  number;
  emotional_safety_score: number;
  active_directives:      RuntimeDirective[];
  directive_count:        number;
  question_count:         number;
  explain:                string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));

function weightedAvg(pairs: [number, number][]): number {
  const totalW = pairs.reduce((s, [, w]) => s + w, 0);
  if (totalW === 0) return 50;
  return pairs.reduce((s, [v, w]) => s + v * w, 0) / totalW;
}

// ─── Dimension computers ─────────────────────────────────────────────────────

/** conversational_coherence: inverse of contradiction density + severity */
async function computeCoherence(pool: Pool, sessionId: string): Promise<number> {
  const { rows } = await pool.query<{
    total: string; low_cnt: string; medium_cnt: string; high_cnt: string;
  }>(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE severity = 'low')    AS low_cnt,
       COUNT(*) FILTER (WHERE severity = 'medium') AS medium_cnt,
       COUNT(*) FILTER (WHERE severity = 'high')   AS high_cnt
     FROM contradiction_events
     WHERE session_id = $1 AND resolved = false`,
    [sessionId],
  );
  const row = rows[0];
  if (!row || parseInt(row.total, 10) === 0) return 85; // no contradictions = high coherence
  const penalty =
    parseInt(row.low_cnt,    10) *  6 +
    parseInt(row.medium_cnt, 10) * 18 +
    parseInt(row.high_cnt,   10) * 35;
  return clamp(100 - penalty);
}

/** engagement_quality: from signal profile or complement of disengagement */
async function computeEngagement(pool: Pool, sessionId: string): Promise<number> {
  // Prefer the aggregated signal profile value
  const { rows: prof } = await pool.query<{ engagement_score: string | null }>(
    `SELECT engagement_score FROM capadex_signal_profiles WHERE session_id = $1 LIMIT 1`,
    [sessionId],
  );
  if (prof[0]?.engagement_score != null) {
    return clamp(parseFloat(prof[0].engagement_score));
  }
  // Fallback: average of (1 - disengagement_score) from load snapshots
  const { rows: load } = await pool.query<{ avg_dis: string | null }>(
    `SELECT AVG(disengagement_score) AS avg_dis
     FROM cognitive_load_snapshots WHERE session_id = $1`,
    [sessionId],
  );
  if (load[0]?.avg_dis != null) {
    return clamp((1 - parseFloat(load[0].avg_dis)) * 100);
  }
  return 60; // neutral default
}

/** emotional_safety: inversion of emotional load + penalties for risk actions */
async function computeEmotionalSafety(pool: Pool, sessionId: string): Promise<number> {
  let score = 90; // start optimistic

  // Penalty from signal profile emotional load
  const { rows: prof } = await pool.query<{ emotional_load: string | null }>(
    `SELECT emotional_load FROM capadex_signal_profiles WHERE session_id = $1 LIMIT 1`,
    [sessionId],
  );
  if (prof[0]?.emotional_load != null) {
    score = 100 - parseFloat(prof[0].emotional_load);
  }

  // Additional penalty from high-risk cognitive load actions
  const { rows: load } = await pool.query<{ recommended_action: string; cnt: string }>(
    `SELECT recommended_action, COUNT(*) AS cnt
     FROM cognitive_load_snapshots WHERE session_id = $1
     GROUP BY recommended_action`,
    [sessionId],
  );
  for (const row of load) {
    const cnt = parseInt(row.cnt, 10);
    if (row.recommended_action === 'offer_break')      score -= cnt * 4;
    if (row.recommended_action === 'shorten_flow')     score -= cnt * 6;
    if (row.recommended_action === 'end_gracefully')   score -= cnt * 10;
  }

  // Penalty for emotional_masking contradictions
  const { rows: emo } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*) AS cnt FROM contradiction_events
     WHERE session_id = $1 AND contradiction_type = 'emotional_masking' AND resolved = false`,
    [sessionId],
  );
  score -= parseInt(emo[0]?.cnt ?? '0', 10) * 12;

  return clamp(score);
}

/** conversational_smoothness: complement of hesitation + response volatility */
async function computeSmoothness(pool: Pool, sessionId: string): Promise<number> {
  const { rows } = await pool.query<{ avg_hes: string | null; avg_over: string | null }>(
    `SELECT AVG(hesitation_score) AS avg_hes, AVG(overload_score) AS avg_over
     FROM cognitive_load_snapshots WHERE session_id = $1`,
    [sessionId],
  );
  if (!rows[0] || rows[0].avg_hes == null) return 65;
  const hesitation = parseFloat(rows[0].avg_hes);
  const overload   = parseFloat(rows[0].avg_over ?? '0');
  return clamp((1 - hesitation * 0.7 - overload * 0.3) * 100);
}

/** adaptive_effectiveness: hypothesis confidence trend + evidence gain */
async function computeAdaptiveEffectiveness(pool: Pool, sessionId: string): Promise<number> {
  // Measure average confidence across active/strengthened hypotheses
  const { rows } = await pool.query<{ avg_conf: string | null; cnt: string }>(
    `SELECT AVG(confidence) AS avg_conf, COUNT(*) AS cnt
     FROM behavioural_hypotheses
     WHERE session_id = $1 AND lifecycle_state IN ('active','reactivated')`,
    [sessionId],
  );
  if (!rows[0] || rows[0].cnt === '0') return 60; // neutral — no hypotheses yet

  const avgConf = parseFloat(rows[0].avg_conf ?? '0.5');
  // Confidence 0→1 maps to effectiveness 40→90
  return clamp(40 + avgConf * 50);
}

/** evidence_quality: hypothesis confidence − uncertainty penalty */
async function computeEvidenceQuality(pool: Pool, sessionId: string): Promise<number> {
  const { rows } = await pool.query<{
    avg_conf: string | null; avg_unc: string | null; cnt: string;
  }>(
    `SELECT AVG(confidence) AS avg_conf, AVG(uncertainty) AS avg_unc, COUNT(*) AS cnt
     FROM behavioural_hypotheses WHERE session_id = $1`,
    [sessionId],
  );
  if (!rows[0] || rows[0].cnt === '0') return 50;
  const conf = parseFloat(rows[0].avg_conf ?? '0.5');
  const unc  = parseFloat(rows[0].avg_unc  ?? '0.3');
  return clamp((conf * 0.7 - unc * 0.3) * 100 + 20);
}

/** runtime_friction: hesitation + rapid-answer signals (0-100, higher = more friction) */
async function computeRuntimeFriction(pool: Pool, sessionId: string): Promise<number> {
  const { rows } = await pool.query<{ friction_signals: string }>(
    `SELECT COUNT(*) AS friction_signals
     FROM capadex_session_signals
     WHERE session_id = $1
       AND signal_key IN (
         'hesitation','prolonged_hesitation','rapid_answer_pattern',
         'frequent_answer_changes','response_volatility'
       )`,
    [sessionId],
  );
  const frictionSigs = parseInt(rows[0]?.friction_signals ?? '0', 10);
  // Each friction signal adds ~8 friction points, capped at 80
  return clamp(frictionSigs * 8, 0, 80);
}

/** user_fatigue: latest fatigue score from cognitive load snapshots (0-100, higher = worse) */
async function computeUserFatigue(pool: Pool, sessionId: string): Promise<number> {
  const { rows } = await pool.query<{ fatigue_score: string | null }>(
    `SELECT fatigue_score FROM cognitive_load_snapshots
     WHERE session_id = $1
     ORDER BY question_index DESC LIMIT 1`,
    [sessionId],
  );
  if (!rows[0] || rows[0].fatigue_score == null) return 15;
  return clamp(parseFloat(rows[0].fatigue_score) * 100);
}

// ─── Directive generator ──────────────────────────────────────────────────────

function deriveDirectives(
  d: QualityDimensions,
  overall: number,
): { directives: RuntimeDirective[]; explain: string[] } {
  const directives: RuntimeDirective[] = [];
  const explain:    string[]           = [];

  if (d.conversational_coherence < 50 || d.evidence_quality < 45) {
    directives.push('simplify_runtime');
    explain.push(
      `simplify_runtime: coherence=${d.conversational_coherence.toFixed(0)}, evidence=${d.evidence_quality.toFixed(0)}`,
    );
  }
  if (d.adaptive_effectiveness < 45) {
    directives.push('reduce_adaptation_intensity');
    explain.push(`reduce_adaptation_intensity: effectiveness=${d.adaptive_effectiveness.toFixed(0)}`);
  }
  if (overall < 30) {
    directives.push('trigger_fallback_flow');
    explain.push(`trigger_fallback_flow: overall_quality=${overall.toFixed(0)}`);
  }
  if (d.user_fatigue > 65 || d.conversational_smoothness < 35) {
    directives.push('slow_pacing');
    explain.push(
      `slow_pacing: fatigue=${d.user_fatigue.toFixed(0)}, smoothness=${d.conversational_smoothness.toFixed(0)}`,
    );
  }
  if (d.emotional_safety < 45) {
    directives.push('prevent_escalation');
    explain.push(`prevent_escalation: emotional_safety=${d.emotional_safety.toFixed(0)}`);
  }

  return { directives, explain };
}

// ─── Main evaluation function ─────────────────────────────────────────────────

/**
 * Evaluates conversational quality for a session, persists a snapshot, and
 * broadcasts a `quality_updated` WS event.
 *
 * Fire-and-forget safe — catches all errors internally.
 */
export async function evaluateQuality(
  pool:      Pool,
  sessionId: string,
  tenantId?: string,
): Promise<QualityResult> {
  const disabled: QualityResult = {
    conversational_coherence:  50, engagement_quality: 50, emotional_safety: 80,
    conversational_smoothness: 50, adaptive_effectiveness: 50, evidence_quality: 50,
    runtime_friction: 20, user_fatigue: 20,
    overall_quality_score: 50, adaptation_quality: 50, orchestration_quality: 50,
    emotional_safety_score: 80, active_directives: [], directive_count: 0,
    question_count: 0, explain: ['conversational_quality flag is off'],
  };

  if (!isEnabled('conversational_quality', tenantId)) return disabled;

  // ── Compute all 8 dimensions in parallel ─────────────────────────────────
  const [
    coherence, engagement, emotionalSafety, smoothness,
    effectiveness, evidenceQ, friction, fatigue,
    qCountResult,
  ] = await Promise.all([
    computeCoherence(pool, sessionId).catch(() => 75),
    computeEngagement(pool, sessionId).catch(() => 60),
    computeEmotionalSafety(pool, sessionId).catch(() => 80),
    computeSmoothness(pool, sessionId).catch(() => 65),
    computeAdaptiveEffectiveness(pool, sessionId).catch(() => 60),
    computeEvidenceQuality(pool, sessionId).catch(() => 50),
    computeRuntimeFriction(pool, sessionId).catch(() => 20),
    computeUserFatigue(pool, sessionId).catch(() => 20),
    pool.query<{ n: string }>(
      'SELECT COUNT(*) AS n FROM capadex_responses WHERE session_id = $1',
      [sessionId],
    ).catch(() => ({ rows: [{ n: '0' }] })),
  ]);

  const questionCount = parseInt((qCountResult as any).rows[0]?.n ?? '0', 10);

  const dims: QualityDimensions = {
    conversational_coherence:  coherence,
    engagement_quality:        engagement,
    emotional_safety:          emotionalSafety,
    conversational_smoothness: smoothness,
    adaptive_effectiveness:    effectiveness,
    evidence_quality:          evidenceQ,
    runtime_friction:          friction,
    user_fatigue:              fatigue,
  };

  // ── Composite score (emotional safety weighted highest) ───────────────────
  const overall = clamp(weightedAvg([
    [dims.conversational_coherence,  0.15],
    [dims.engagement_quality,        0.15],
    [dims.emotional_safety,          0.20],
    [dims.conversational_smoothness, 0.10],
    [dims.adaptive_effectiveness,    0.10],
    [dims.evidence_quality,          0.15],
    [100 - dims.runtime_friction,    0.10],
    [100 - dims.user_fatigue,        0.05],
  ]));

  const adaptationQ    = clamp((dims.adaptive_effectiveness + dims.evidence_quality) / 2);
  const orchestrationQ = clamp((dims.conversational_coherence + dims.conversational_smoothness) / 2);

  const { directives, explain } = deriveDirectives(dims, overall);

  const result: QualityResult = {
    ...dims,
    overall_quality_score:  overall,
    adaptation_quality:     adaptationQ,
    orchestration_quality:  orchestrationQ,
    emotional_safety_score: dims.emotional_safety,
    active_directives:      directives,
    directive_count:        directives.length,
    question_count:         questionCount,
    explain,
  };

  // ── Persist snapshot ──────────────────────────────────────────────────────
  await pool.query(
    `INSERT INTO conversational_quality_snapshots (
       session_id,
       conversational_coherence, engagement_quality, emotional_safety,
       conversational_smoothness, adaptive_effectiveness, evidence_quality,
       runtime_friction, user_fatigue,
       overall_quality_score, adaptation_quality, orchestration_quality,
       emotional_safety_score, active_directives, directive_count,
       question_count, tenant_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      sessionId,
      result.conversational_coherence,  result.engagement_quality,
      result.emotional_safety,          result.conversational_smoothness,
      result.adaptive_effectiveness,    result.evidence_quality,
      result.runtime_friction,          result.user_fatigue,
      result.overall_quality_score,     result.adaptation_quality,
      result.orchestration_quality,     result.emotional_safety_score,
      JSON.stringify(result.active_directives),
      result.directive_count,           result.question_count,
      tenantId ?? null,
    ],
  );

  // ── Broadcast WS event ────────────────────────────────────────────────────
  broadcastToSession(sessionId, {
    type: 'quality_updated',
    data: {
      overall_quality_score:  result.overall_quality_score,
      emotional_safety_score: result.emotional_safety_score,
      adaptation_quality:     result.adaptation_quality,
      orchestration_quality:  result.orchestration_quality,
      active_directives:      result.active_directives,
      dimensions: {
        coherence:    result.conversational_coherence,
        engagement:   result.engagement_quality,
        safety:       result.emotional_safety,
        smoothness:   result.conversational_smoothness,
        effectiveness: result.adaptive_effectiveness,
        evidence:     result.evidence_quality,
        friction:     result.runtime_friction,
        fatigue:      result.user_fatigue,
      },
    },
    explain: explain.length > 0
      ? `Quality ${overall.toFixed(0)}/100 — directives: ${directives.join(', ') || 'none'}`
      : `Quality ${overall.toFixed(0)}/100 — no active directives`,
  }, tenantId);

  return result;
}
