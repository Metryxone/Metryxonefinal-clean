/**
 * Cognitive Runtime State Service — Phase 1 S1
 *
 * Centralised behavioural runtime state system. Every CAPADEX session has one
 * row in `cognitive_runtime_state`. All Phase 1 intelligence engines read from
 * and write to this state via the functions below.
 *
 * All functions are fail-safe: errors are logged but never thrown to callers.
 */

import type { Pool } from 'pg';
import { broadcastToSession } from './ws-broadcast';

// ─── State Shape ────────────────────────────────────────────────────────────

export interface CognitiveRuntimeState {
  behavioural_constructs:  string[];
  behavioural_patterns:    string[];
  active_hypotheses:       HypothesisEntry[];
  confidence_scores:       Record<string, number>;
  uncertainty_scores:      Record<string, number>;
  emotional_state:         EmotionalState;
  cognitive_state:         CognitiveState;
  engagement_state:        EngagementState;
  signal_state:            SignalState;
  contradiction_state:     ContradictionState;
  intervention_state:      InterventionState;
  resilience_state:        ResilienceState;
  growth_state:            GrowthState;
  stage_state:             StageState;
  adaptive_runtime_state:  AdaptiveRuntimeState;
  longitudinal_memory:     LongitudinalMemory;
  behavioural_drift_state: BehaviouralDriftState;
  report_context:          ReportContext;
  workflow_context:        WorkflowContext;
  explainability_context:  ExplainabilityContext;
}

export interface HypothesisEntry {
  id:               string;
  construct_key:    string;
  label:            string;
  confidence:       number;
  uncertainty:      number;
  lifecycle_state:  'active' | 'weakened' | 'suspended' | 'archived' | 'reactivated';
}

export interface EmotionalState {
  detected_tone:    string;   // calm | anxious | distressed | neutral | frustrated
  distress_level:   number;   // 0–1
  engagement_tone:  string;
  last_updated_at:  string;
}

export interface CognitiveState {
  load_level:       'low' | 'moderate' | 'high' | 'overloaded';
  fatigue_score:    number;   // 0–1
  questions_answered: number;
  avg_response_ms:  number;
}

export interface EngagementState {
  quality:          'high' | 'moderate' | 'low' | 'disengaged';
  drop_off_risk:    number;   // 0–1
  answer_changes:   number;
  last_active_at:   string;
}

export interface SignalState {
  dominant_signals: string[];
  hesitation_count: number;
  rapid_count:      number;
  volatility_score: number;
}

export interface ContradictionState {
  detected:         boolean;
  event_count:      number;
  affected_constructs: string[];
  last_detected_at: string | null;
}

export interface InterventionState {
  readiness:        'not_ready' | 'emerging' | 'ready';
  recommended_tier: string | null;
  last_evaluated_at: string | null;
}

export interface ResilienceState {
  score:            number;   // 0–100
  indicators:       string[];
}

export interface GrowthState {
  momentum:         'declining' | 'stable' | 'growing';
  positive_signals: string[];
}

export interface StageState {
  current_stage:    string;
  stage_index:      number;
  completed_stages: string[];
  stage_score:      number | null;
  score_level:      string | null;
}

export interface AdaptiveRuntimeState {
  last_question_id:        string | null;
  last_selection_reason:   string | null;
  questions_selected:      string[];
  evidence_gaps:           string[];
}

export interface LongitudinalMemory {
  session_count:            number;
  recurring_constructs:     string[];
  behavioural_drift:        'improving' | 'stable' | 'declining' | 'unknown';
  last_memory_built_at:     string | null;
}

export interface BehaviouralDriftState {
  drift_direction:   'improving' | 'stable' | 'declining' | 'unknown';
  drift_magnitude:   number;
  detected_at:       string | null;
}

export interface ReportContext {
  report_generated: boolean;
  dynamic_report:   boolean;
  persona_tone:     string;
  concern_category: string;
}

export interface WorkflowContext {
  flow_id:          string | null;
  current_step:     string | null;
  completed_steps:  string[];
}

export interface ExplainabilityContext {
  events: ExplainabilityEvent[];
}

export interface ExplainabilityEvent {
  timestamp:   string;
  event_type:  string;
  description: string;
  metadata:    Record<string, unknown>;
}

// ─── Default State Factory ───────────────────────────────────────────────────

function defaultState(overrides: Partial<CognitiveRuntimeState> = {}): CognitiveRuntimeState {
  const now = new Date().toISOString();
  return {
    behavioural_constructs:  [],
    behavioural_patterns:    [],
    active_hypotheses:       [],
    confidence_scores:       {},
    uncertainty_scores:      {},
    emotional_state: {
      detected_tone:   'neutral',
      distress_level:  0,
      engagement_tone: 'neutral',
      last_updated_at: now,
    },
    cognitive_state: {
      load_level:         'low',
      fatigue_score:      0,
      questions_answered: 0,
      avg_response_ms:    0,
    },
    engagement_state: {
      quality:        'moderate',
      drop_off_risk:  0,
      answer_changes: 0,
      last_active_at: now,
    },
    signal_state: {
      dominant_signals: [],
      hesitation_count: 0,
      rapid_count:      0,
      volatility_score: 0,
    },
    contradiction_state: {
      detected:             false,
      event_count:          0,
      affected_constructs:  [],
      last_detected_at:     null,
    },
    intervention_state: {
      readiness:         'not_ready',
      recommended_tier:  null,
      last_evaluated_at: null,
    },
    resilience_state: {
      score:      50,
      indicators: [],
    },
    growth_state: {
      momentum:         'stable',
      positive_signals: [],
    },
    stage_state: {
      current_stage:    '',
      stage_index:      0,
      completed_stages: [],
      stage_score:      null,
      score_level:      null,
    },
    adaptive_runtime_state: {
      last_question_id:      null,
      last_selection_reason: null,
      questions_selected:    [],
      evidence_gaps:         [],
    },
    longitudinal_memory: {
      session_count:         0,
      recurring_constructs:  [],
      behavioural_drift:     'unknown',
      last_memory_built_at:  null,
    },
    behavioural_drift_state: {
      drift_direction: 'unknown',
      drift_magnitude: 0,
      detected_at:     null,
    },
    report_context: {
      report_generated: false,
      dynamic_report:   false,
      persona_tone:     'student',
      concern_category: 'general',
    },
    workflow_context: {
      flow_id:         null,
      current_step:    null,
      completed_steps: [],
    },
    explainability_context: {
      events: [],
    },
    ...overrides,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Deep-merge `patch` into `base`. Arrays are replaced, not concatenated. */
function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, val] of Object.entries(patch)) {
    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(base[key] as Record<string, unknown>, val as Record<string, unknown>);
    } else {
      result[key] = val;
    }
  }
  return result;
}

function categorizeConcern(concern: string): string {
  const l = concern.toLowerCase();
  if (/screen|phone|gaming|social.?media|digital|internet|device|app\b|online/.test(l)) return 'digital';
  if (/study|exam|homework|academic|school|grade|learning|class|marks/.test(l)) return 'academic';
  if (/anxiety|stress|emotion|mood|depress|worry|fear|loneli|mental/.test(l)) return 'emotional';
  if (/focus|attent|distract|concentrat|procrastinat|impulsiv|hyperactiv/.test(l)) return 'behavioural';
  if (/social|peer|friend|relation|communicat|conflict|bully/.test(l)) return 'social';
  if (/career|job|employ|skill|workplace|interview|profession/.test(l)) return 'career';
  return 'general';
}

function appendExplainEvent(
  state: CognitiveRuntimeState,
  event_type: string,
  description: string,
  metadata: Record<string, unknown> = {}
): CognitiveRuntimeState {
  const events = [
    ...(state.explainability_context?.events ?? []),
    { timestamp: new Date().toISOString(), event_type, description, metadata },
  ].slice(-50); // keep last 50 events to avoid unbounded growth
  return {
    ...state,
    explainability_context: { events },
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Retrieve the cognitive runtime state for a session.
 * Returns null if the session has no state row yet.
 */
export async function getState(
  pool: Pool,
  sessionId: string
): Promise<CognitiveRuntimeState | null> {
  try {
    const { rows } = await pool.query(
      'SELECT state FROM cognitive_runtime_state WHERE session_id = $1',
      [sessionId]
    );
    if (rows.length === 0) return null;
    return rows[0].state as CognitiveRuntimeState;
  } catch (err) {
    console.error('[cognitive-state] getState error:', err);
    return null;
  }
}

/**
 * Update (deep-merge) the cognitive runtime state for a session.
 * Creates the row if it does not exist yet.
 *
 * Returns `true` on success, `false` on DB error.
 * Fire-and-forget callers may discard the return value.
 * Callers surfacing responses to clients should check it.
 */
export async function updateState(
  pool: Pool,
  sessionId: string,
  partial: Partial<CognitiveRuntimeState>,
  explainReason?: string
): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      'SELECT state, version FROM cognitive_runtime_state WHERE session_id = $1',
      [sessionId]
    );

    let current: CognitiveRuntimeState;
    let version: number;

    if (rows.length === 0) {
      current = defaultState();
      version = 1;
    } else {
      current = rows[0].state as CognitiveRuntimeState;
      version = (rows[0].version as number) + 1;
    }

    let next = deepMerge(
      current as unknown as Record<string, unknown>,
      partial as Record<string, unknown>
    ) as unknown as CognitiveRuntimeState;

    if (explainReason) {
      next = appendExplainEvent(next, 'state_updated', explainReason, { version });
    }

    await pool.query(`
      INSERT INTO cognitive_runtime_state (session_id, state, version, updated_at)
      VALUES ($1, $2, $3, now())
      ON CONFLICT (session_id) DO UPDATE
        SET state      = EXCLUDED.state,
            version    = EXCLUDED.version,
            updated_at = now()
    `, [sessionId, JSON.stringify(next), version]);

    // Broadcast state update event — fire-and-forget, flag-gated inside broadcastToSession
    broadcastToSession(sessionId, {
      type:    'state_updated',
      data:    { version },
      explain: explainReason ?? 'Cognitive state updated',
    });

    return true;
  } catch (err) {
    console.error('[cognitive-state] updateState error:', err);
    return false;
  }
}

/**
 * Snapshot the current state into `cognitive_state_history`.
 * Used at significant lifecycle points (session start, stage complete, etc.)
 */
export async function snapshotState(
  pool: Pool,
  sessionId: string,
  snapshotReason: string,
  actor = 'system'
): Promise<void> {
  try {
    const { rows } = await pool.query(
      'SELECT state, version FROM cognitive_runtime_state WHERE session_id = $1',
      [sessionId]
    );
    if (rows.length === 0) return;
    await pool.query(`
      INSERT INTO cognitive_state_history (session_id, state, snapshot_reason, version, actor, created_at)
      VALUES ($1, $2, $3, $4, $5, now())
    `, [sessionId, JSON.stringify(rows[0].state), snapshotReason, rows[0].version, actor]);
  } catch (err) {
    console.error('[cognitive-state] snapshotState error:', err);
  }
}

/**
 * Return ordered state snapshots for a session in chronological (ascending) order.
 * Ascending order is required for deterministic state replay.
 */
export async function replayState(
  pool: Pool,
  sessionId: string,
  limit = 50
): Promise<Array<{ id: string; state: CognitiveRuntimeState; snapshot_reason: string; version: number; actor: string; created_at: string }>> {
  try {
    const { rows } = await pool.query(`
      SELECT id, state, snapshot_reason, version, actor, created_at
      FROM cognitive_state_history
      WHERE session_id = $1
      ORDER BY created_at ASC, version ASC
      LIMIT $2
    `, [sessionId, limit]);
    return rows;
  } catch (err) {
    console.error('[cognitive-state] replayState error:', err);
    return [];
  }
}

/**
 * Seed the initial cognitive runtime state for a brand-new session.
 * Called non-blocking immediately after INSERT INTO capadex_sessions.
 */
export function seedInitialState(
  pool: Pool,
  sessionId: string,
  opts: {
    concern_name:  string;
    stage_code:    string;
    stage_index:   number;
    persona?:      string;
    age?:          number;
  }
): void {
  const category = categorizeConcern(opts.concern_name);
  const personaTone = opts.persona || 'student';

  const initial = defaultState({
    report_context: {
      report_generated: false,
      dynamic_report:   false,
      persona_tone:     personaTone,
      concern_category: category,
    },
    stage_state: {
      current_stage:    opts.stage_code,
      stage_index:      opts.stage_index,
      completed_stages: [],
      stage_score:      null,
      score_level:      null,
    },
  });

  // Non-blocking — errors logged internally
  updateState(pool, sessionId, initial, `session_created:${opts.concern_name}`)
    .then(() => snapshotState(pool, sessionId, 'session_created'))
    .catch(err => console.error('[cognitive-state] seedInitialState error:', err));
}

/**
 * Update state after a stage completes with score information.
 * Reads current state first to preserve stage_index and completed_stages,
 * then writes only the fields that change on completion.
 * Called non-blocking from the complete endpoint.
 */
export function updateStateOnStageComplete(
  pool: Pool,
  sessionId: string,
  opts: {
    stage_code:      string;
    score:           number;
    score_level:     string;
    subdomain_count: number;
  }
): void {
  const readiness =
    opts.score >= 65 ? 'ready' :
    opts.score >= 40 ? 'emerging' : 'not_ready';

  getState(pool, sessionId)
    .then(current => {
      const existingStage: StageState = current?.stage_state ?? {
        current_stage:    opts.stage_code,
        stage_index:      0,
        completed_stages: [],
        stage_score:      null,
        score_level:      null,
      };
      const completedStages = [...(existingStage.completed_stages ?? [])];
      if (!completedStages.includes(opts.stage_code)) {
        completedStages.push(opts.stage_code);
      }

      return updateState(pool, sessionId, {
        stage_state: {
          current_stage:    existingStage.current_stage,
          stage_index:      existingStage.stage_index,
          completed_stages: completedStages,
          stage_score:      opts.score,
          score_level:      opts.score_level,
        },
        intervention_state: {
          readiness,
          recommended_tier:  null,
          last_evaluated_at: new Date().toISOString(),
        },
      }, `stage_completed:${opts.stage_code}:score=${opts.score}`);
    })
    .then(() => snapshotState(pool, sessionId, `stage_completed:${opts.stage_code}`))
    .catch(err => console.error('[cognitive-state] updateStateOnStageComplete error:', err));
}
