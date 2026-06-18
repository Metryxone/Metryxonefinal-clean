/**
 * Adaptive Assessment Engine (Phase 2 V2).
 *
 * Pure runtime that, given a blueprint plan, current session state, and the
 * last response, picks the next question + difficulty + branching action.
 * No DB writes — orchestrator persists outcomes.
 */

export const ADAPTIVE_ASSESSMENT_VERSION = '2.0.0';

export type DifficultyBand = 'easy' | 'medium' | 'hard';
export type DepthBand      = 'shallow' | 'standard' | 'deep';

export type SessionCompetencyState = {
  competency_code: string;
  questions_planned: number;
  questions_served: number;
  difficulty_band: DifficultyBand;
  depth_band: DepthBand;
  rolling_score: number;          // 0–100
  rolling_confidence: number;     // 0–1
  contradiction_count: number;
  streak_high: number;
  streak_low: number;
  completed: boolean;
};

export type AdaptiveResponseEvent = {
  score: number;                   // 0–100 (normalized correctness)
  confidence?: number;             // 0–1 self-reported or inferred
  response_time_ms?: number;
  flagged_contradiction?: boolean;
};

export type AdaptiveDecision = {
  next_competency: string | null;
  next_question_index: number;
  difficulty: DifficultyBand;
  depth: DepthBand;
  branching_fired: string | null;
  action: 'serve_next' | 'escalate' | 'deescalate' | 'inject_probe' | 'expand_depth' | 'complete_competency' | 'complete_session';
  rationale: string;
};

const DIFFICULTY_ORDER: DifficultyBand[] = ['easy', 'medium', 'hard'];
const DEPTH_ORDER: DepthBand[] = ['shallow', 'standard', 'deep'];

function step<T>(arr: T[], current: T, delta: number): T {
  const i = arr.indexOf(current);
  const j = Math.max(0, Math.min(arr.length - 1, i + delta));
  return arr[j];
}

/**
 * Apply a response to a competency's rolling state (mutates copy).
 */
export function applyResponse(
  s: SessionCompetencyState,
  ev: AdaptiveResponseEvent,
): SessionCompetencyState {
  const next = { ...s };
  next.questions_served += 1;
  const alpha = 0.4;
  next.rolling_score = +(s.rolling_score * (1 - alpha) + ev.score * alpha).toFixed(2);
  if (ev.confidence != null) {
    next.rolling_confidence = +(s.rolling_confidence * (1 - alpha) + ev.confidence * alpha).toFixed(2);
  }
  if (ev.flagged_contradiction) next.contradiction_count += 1;
  if (ev.score >= 80) { next.streak_high += 1; next.streak_low = 0; }
  else if (ev.score <= 40) { next.streak_low += 1; next.streak_high = 0; }
  else { next.streak_high = 0; next.streak_low = 0; }
  if (next.questions_served >= next.questions_planned) next.completed = true;
  return next;
}

/**
 * Decide what to do next given current competency state + global session state.
 */
export function decideNext(
  current: SessionCompetencyState,
  remaining: SessionCompetencyState[],
): AdaptiveDecision {
  // Branching first — order matters.
  if (current.contradiction_count >= 2) {
    return {
      next_competency: current.competency_code,
      next_question_index: current.questions_served,
      difficulty: current.difficulty_band,
      depth: current.depth_band,
      branching_fired: 'contradict_global',
      action: 'inject_probe',
      rationale: `Contradiction signal (${current.contradiction_count}) ≥ 2 — injecting consistency probe.`,
    };
  }
  if (current.rolling_confidence > 0 && current.rolling_confidence < 0.45) {
    return {
      next_competency: current.competency_code,
      next_question_index: current.questions_served,
      difficulty: step(DIFFICULTY_ORDER, current.difficulty_band, -1),
      depth: current.depth_band,
      branching_fired: 'low_conf_global',
      action: 'deescalate',
      rationale: `Rolling confidence ${current.rolling_confidence.toFixed(2)} < 0.45 — de-escalating difficulty.`,
    };
  }
  if (current.streak_high >= 3 && current.rolling_score >= 80 && current.difficulty_band !== 'hard') {
    return {
      next_competency: current.competency_code,
      next_question_index: current.questions_served,
      difficulty: step(DIFFICULTY_ORDER, current.difficulty_band, +1),
      depth: current.depth_band,
      branching_fired: 'escalate_high_conf',
      action: 'escalate',
      rationale: `Streak of ${current.streak_high} high responses (avg ${current.rolling_score.toFixed(1)}) — escalating difficulty.`,
    };
  }
  if (current.competency_code === 'LEA' && current.rolling_score >= 75 && current.depth_band !== 'deep') {
    return {
      next_competency: current.competency_code,
      next_question_index: current.questions_served,
      difficulty: current.difficulty_band,
      depth: step(DEPTH_ORDER, current.depth_band, +1),
      branching_fired: 'expand_depth_lea',
      action: 'expand_depth',
      rationale: `LEA rolling score ${current.rolling_score.toFixed(1)} ≥ 75 — expanding depth band.`,
    };
  }

  // Done with this competency?
  if (current.completed) {
    const nextComp = remaining.find((r) => !r.completed && r.competency_code !== current.competency_code);
    if (nextComp) {
      return {
        next_competency: nextComp.competency_code,
        next_question_index: nextComp.questions_served,
        difficulty: nextComp.difficulty_band,
        depth: nextComp.depth_band,
        branching_fired: null,
        action: 'complete_competency',
        rationale: `Completed ${current.competency_code} (${current.questions_served}/${current.questions_planned}) → advancing to ${nextComp.competency_code}.`,
      };
    }
    return {
      next_competency: null,
      next_question_index: 0,
      difficulty: current.difficulty_band,
      depth: current.depth_band,
      branching_fired: null,
      action: 'complete_session',
      rationale: `All competencies completed.`,
    };
  }

  return {
    next_competency: current.competency_code,
    next_question_index: current.questions_served,
    difficulty: current.difficulty_band,
    depth: current.depth_band,
    branching_fired: null,
    action: 'serve_next',
    rationale: `Serving next ${current.competency_code} question at difficulty=${current.difficulty_band}, depth=${current.depth_band}.`,
  };
}

/**
 * Behavioural signal inference (rolled up per session).
 */
export function inferBehavioralSignals(
  states: SessionCompetencyState[],
  events: AdaptiveResponseEvent[],
): Array<{ signal_type: string; signal_value: number; signal_band: 'low' | 'medium' | 'high'; evidence: Record<string, unknown> }> {
  const out: Array<{ signal_type: string; signal_value: number; signal_band: 'low' | 'medium' | 'high'; evidence: Record<string, unknown> }> = [];
  const totalContradictions = states.reduce((s, x) => s + x.contradiction_count, 0);
  const consistency = +Math.max(0, 100 - totalContradictions * 20).toFixed(2);
  out.push({
    signal_type: 'consistency',
    signal_value: consistency,
    signal_band: consistency >= 75 ? 'high' : consistency >= 50 ? 'medium' : 'low',
    evidence: { contradictions: totalContradictions },
  });
  const meanConfidence = states.length
    ? +(states.reduce((s, x) => s + x.rolling_confidence, 0) / states.length).toFixed(2)
    : 0;
  out.push({
    signal_type: 'depth',
    signal_value: +(meanConfidence * 100).toFixed(2),
    signal_band: meanConfidence >= 0.7 ? 'high' : meanConfidence >= 0.5 ? 'medium' : 'low',
    evidence: { mean_confidence: meanConfidence },
  });
  const avgRT = events.filter((e) => e.response_time_ms != null).length
    ? Math.round(events.reduce((s, e) => s + (e.response_time_ms ?? 0), 0) / events.length)
    : 0;
  const hesitation = +Math.max(0, Math.min(100, (avgRT - 4000) / 100)).toFixed(2);
  out.push({
    signal_type: 'hesitation',
    signal_value: hesitation,
    signal_band: hesitation >= 60 ? 'high' : hesitation >= 30 ? 'medium' : 'low',
    evidence: { avg_response_ms: avgRT },
  });
  return out;
}
