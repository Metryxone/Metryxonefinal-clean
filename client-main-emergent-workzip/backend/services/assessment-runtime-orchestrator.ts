/**
 * Assessment Runtime Orchestrator (Phase 2 V2).
 *
 * Central controller. Coordinates DB ↔ blueprint engine ↔ adaptive engine.
 * Keeps competency-runtime-v2 + competency-assessment-runtime untouched.
 */
import type { Pool } from 'pg';
import { generateBlueprint, persistBlueprint, ASSESSMENT_BLUEPRINT_VERSION, type BlueprintEnvelope } from './assessment-blueprint-engine';
import {
  applyResponse, decideNext, inferBehavioralSignals,
  ADAPTIVE_ASSESSMENT_VERSION,
  type SessionCompetencyState, type AdaptiveResponseEvent, type AdaptiveDecision, type DifficultyBand, type DepthBand,
} from './adaptive-assessment-engine';
import { resolveCompetencyDNA, type RuntimeContextInput } from './competency-resolution-engine';

export const ASSESSMENT_ORCHESTRATOR_VERSION = '2.0.0';

export type StartSessionInput = {
  userId: number;
  runtimeContext: RuntimeContextInput;
};

export type StartSessionResult = {
  session_id: string;
  blueprint_id: string;
  runtime_context_id: string;
  role_dna_id: string;
  blueprint: BlueprintEnvelope;
  initial_competency: string;
  total_questions: number;
};

function bandFromDifficulty(b: string): DifficultyBand {
  return b === 'easy' || b === 'medium' || b === 'hard' ? b : 'medium';
}

function bandFromDepth(b: string): DepthBand {
  return b === 'shallow' || b === 'standard' || b === 'deep' ? b : 'standard';
}

function buildInitialState(bp: BlueprintEnvelope): SessionCompetencyState[] {
  return bp.competencies.map((c) => ({
    competency_code: c.competency_code,
    questions_planned: c.question_count_planned,
    questions_served: 0,
    difficulty_band: bandFromDifficulty(bp.difficulty_band),
    depth_band: bandFromDepth(c.depth_band),
    rolling_score: 0,
    rolling_confidence: 0,
    contradiction_count: 0,
    streak_high: 0,
    streak_low: 0,
    completed: false,
  }));
}

export async function startSession(pool: Pool, input: StartSessionInput): Promise<StartSessionResult> {
  const resolved = await resolveCompetencyDNA(pool, { ...input.runtimeContext, user_id: input.userId });
  const bp = generateBlueprint({
    roleDnaId: resolved.role_dna_id,
    runtimeContextId: resolved.runtime_context_id,
    weights: resolved.final_weightings,
    expectedLevels: resolved.final_expected_levels,
    intensity: resolved.assessment_intensity,
    industry: input.runtimeContext.industry_id ?? null,
    layer: input.runtimeContext.layer_id ?? null,
  });
  const blueprintId = await persistBlueprint(pool, bp, {
    roleDnaId: resolved.role_dna_id || null,
    runtimeContextId: resolved.runtime_context_id || null,
  });
  const states = buildInitialState(bp);
  const insSession = await pool.query<{ id: string }>(
    `
    INSERT INTO assessment_runtime_sessions_v2
      (user_id, blueprint_id, runtime_context_id, role_dna_id,
       state, current_competency, runtime_state, confidence_score)
    VALUES ($1, $2::uuid, $3::uuid, $4::uuid, 'in_progress', $5, $6::jsonb, 0)
    RETURNING id
    `,
    [
      input.userId, blueprintId,
      resolved.runtime_context_id || null,
      resolved.role_dna_id || null,
      states[0].competency_code,
      JSON.stringify({ states, version: ASSESSMENT_ORCHESTRATOR_VERSION }),
    ],
  );
  const sessionId = insSession.rows[0].id;

  await pool.query(
    `INSERT INTO assessment_explainability_logs (session_id, blueprint_id, log_type, rationale, payload)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)`,
    [sessionId, blueprintId, 'question_selected',
      `Session started → blueprint ${bp.blueprint_name}, intensity ${bp.intensity}, ${bp.total_questions_planned} questions across ${bp.total_competencies} competencies.`,
      JSON.stringify({ blueprint_explainability: bp.explainability })],
  );

  return {
    session_id: sessionId,
    blueprint_id: blueprintId,
    runtime_context_id: resolved.runtime_context_id,
    role_dna_id: resolved.role_dna_id,
    blueprint: bp,
    initial_competency: states[0].competency_code,
    total_questions: bp.total_questions_planned,
  };
}

export async function loadSessionStates(pool: Pool, sessionId: string, userId: number): Promise<{
  states: SessionCompetencyState[]; blueprintId: string; currentCompetency: string | null;
}> {
  const r = await pool.query<{ blueprint_id: string; current_competency: string | null; runtime_state: { states?: SessionCompetencyState[] } }>(
    `SELECT blueprint_id, current_competency, runtime_state
     FROM assessment_runtime_sessions_v2
     WHERE id = $1::uuid AND user_id = $2`,
    [sessionId, userId],
  );
  if (r.rowCount === 0) throw Object.assign(new Error('session_not_found'), { status: 404 });
  const row = r.rows[0];
  return {
    states: row.runtime_state?.states ?? [],
    blueprintId: row.blueprint_id,
    currentCompetency: row.current_competency,
  };
}

export async function submitResponse(pool: Pool, args: {
  sessionId: string; userId: number; competencyCode: string; ev: AdaptiveResponseEvent;
  questionId?: string; questionType?: string; difficulty?: DifficultyBand;
}): Promise<{ decision: AdaptiveDecision; states: SessionCompetencyState[] }> {
  const { sessionId, userId, competencyCode, ev } = args;
  const loaded = await loadSessionStates(pool, sessionId, userId);
  const statesAfterResp = loaded.states.map((s) =>
    s.competency_code === competencyCode ? applyResponse(s, ev) : s,
  );
  const current = statesAfterResp.find((s) => s.competency_code === competencyCode)!;
  const decision = decideNext(current, statesAfterResp);

  // CRITICAL: persist adaptive difficulty/depth back onto the target competency
  // state so the next turn sees the escalated/de-escalated band. Otherwise
  // adaptive branching is purely advisory.
  const targetCode = decision.next_competency ?? competencyCode;
  const states = statesAfterResp.map((s) =>
    s.competency_code === targetCode
      ? { ...s, difficulty_band: decision.difficulty, depth_band: decision.depth }
      : s,
  );

  // Capture signal
  await pool.query(
    `INSERT INTO competency_signal_capture
      (session_id, user_id, competency_code, question_id, question_type, response_payload,
       response_time_ms, confidence_self_report, confidence_inferred, difficulty_band, signal_score)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11)`,
    [
      sessionId, userId, competencyCode, args.questionId ?? null, args.questionType ?? null,
      JSON.stringify({ score: ev.score, contradiction: !!ev.flagged_contradiction }),
      ev.response_time_ms ?? null,
      ev.confidence ?? null,
      ev.confidence ?? null,
      args.difficulty ?? current.difficulty_band,
      ev.score,
    ],
  );

  // Explainability log
  await pool.query(
    `INSERT INTO assessment_explainability_logs (session_id, blueprint_id, log_type, rationale, payload)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)`,
    [
      sessionId, loaded.blueprintId,
      decision.branching_fired ? 'branching_fired' : 'question_selected',
      decision.rationale,
      JSON.stringify({ action: decision.action, branch: decision.branching_fired, target: decision.next_competency }),
    ],
  );

  // Update session
  const overallConf = states.length
    ? +(states.reduce((s, x) => s + x.rolling_confidence, 0) / states.length * 100).toFixed(2)
    : 0;
  await pool.query(
    `UPDATE assessment_runtime_sessions_v2
       SET runtime_state = $1::jsonb,
           current_competency = $2,
           questions_served = questions_served + 1,
           responses_count = responses_count + 1,
           confidence_score = $3,
           last_activity_at = NOW(),
           state = CASE WHEN $4 THEN 'complete' ELSE state END,
           completed_at = CASE WHEN $4 THEN NOW() ELSE completed_at END
     WHERE id = $5::uuid AND user_id = $6`,
    [
      JSON.stringify({ states, version: ASSESSMENT_ORCHESTRATOR_VERSION }),
      decision.next_competency ?? competencyCode,
      overallConf,
      decision.action === 'complete_session',
      sessionId, userId,
    ],
  );

  return { decision, states };
}

export async function completeSession(pool: Pool, args: {
  sessionId: string; userId: number;
}): Promise<{ behavioural_signals: ReturnType<typeof inferBehavioralSignals>; final_score: number }> {
  const { sessionId, userId } = args;
  const loaded = await loadSessionStates(pool, sessionId, userId);
  const ev: AdaptiveResponseEvent[] = []; // signals computed from accumulated state
  const signals = inferBehavioralSignals(loaded.states, ev);
  for (const s of signals) {
    await pool.query(
      `INSERT INTO behavioral_assessment_signals
        (session_id, user_id, signal_type, signal_value, signal_band, evidence)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb)`,
      [sessionId, userId, s.signal_type, s.signal_value, s.signal_band, JSON.stringify(s.evidence)],
    );
  }
  const finalScore = loaded.states.length
    ? +(loaded.states.reduce((s, x) => s + x.rolling_score * (x.questions_served > 0 ? 1 : 0), 0) /
        Math.max(1, loaded.states.filter((x) => x.questions_served > 0).length)).toFixed(2)
    : 0;
  await pool.query(
    `UPDATE assessment_runtime_sessions_v2
       SET state = 'complete', completed_at = NOW(), confidence_score = $1
       WHERE id = $2::uuid AND user_id = $3`,
    [finalScore, sessionId, userId],
  );
  return { behavioural_signals: signals, final_score: finalScore };
}

export async function getExplainability(pool: Pool, sessionId: string, userId: number): Promise<Array<{
  log_type: string; rationale: string; payload: Record<string, unknown>; created_at: string;
}>> {
  const own = await pool.query(
    `SELECT 1 FROM assessment_runtime_sessions_v2 WHERE id=$1::uuid AND user_id=$2`,
    [sessionId, userId],
  );
  if (own.rowCount === 0) throw Object.assign(new Error('forbidden'), { status: 403 });
  const r = await pool.query<{ log_type: string; rationale: string; payload: Record<string, unknown>; created_at: string }>(
    `SELECT log_type, rationale, payload, created_at
     FROM assessment_explainability_logs
     WHERE session_id = $1::uuid
     ORDER BY created_at ASC`,
    [sessionId],
  );
  return r.rows;
}

export const VERSIONS = {
  ASSESSMENT_ORCHESTRATOR_VERSION,
  ASSESSMENT_BLUEPRINT_VERSION,
  ADAPTIVE_ASSESSMENT_VERSION,
};
