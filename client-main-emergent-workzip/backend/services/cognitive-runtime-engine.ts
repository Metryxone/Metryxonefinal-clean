/**
 * Cognitive Runtime Engine — Phase 4 (additive, shadow-mode).
 *
 * Tracks 7 cognitive signals from response patterns. Pure-function `computeCognitiveProfile`
 * for unit tests; `persistCognitiveProfile` is best-effort append-only.
 * Never mutates user_competency_scores or assessment runtime tables.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';

export const COGNITIVE_RUNTIME_VERSION = '1.0.0';

export type CognitiveSignal =
  | 'AnalyticalReasoning'
  | 'SystemsThinking'
  | 'DecisionVelocity'
  | 'LearningAgility'
  | 'WorkingMemory'
  | 'StrategicJudgement'
  | 'ProblemSolving';

export const COGNITIVE_SIGNALS: CognitiveSignal[] = [
  'AnalyticalReasoning', 'SystemsThinking', 'DecisionVelocity', 'LearningAgility',
  'WorkingMemory', 'StrategicJudgement', 'ProblemSolving',
];

export type ResponseObservation = {
  questionId?: string;
  competencyId?: string;
  questionType?: string;
  depthLevel?: number;
  responseLengthChars?: number;
  responseTimeMs?: number;
  evidenceCitations?: number;
  contradictionMarkers?: number;
  abstractionMarkers?: number;
  // 0..1 scalar self-rated or scored quality, if any upstream provides it.
  qualityScore?: number;
};

export type CognitiveProfile = {
  signals: Record<CognitiveSignal, number>;  // each 0..1
  confidence: number;                         // 0..1
  sampleSize: number;
  engineVersion: string;
};

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }
function mean(xs: number[]): number { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }

/**
 * Pure-function cognitive profile computation.
 * Heuristic scoring — every signal is bounded [0,1] and stable for empty input.
 */
export function computeCognitiveProfile(observations: ResponseObservation[]): CognitiveProfile {
  const n = observations.length;
  const empty: Record<CognitiveSignal, number> = {
    AnalyticalReasoning: 0, SystemsThinking: 0, DecisionVelocity: 0, LearningAgility: 0,
    WorkingMemory: 0, StrategicJudgement: 0, ProblemSolving: 0,
  };
  if (n === 0) return { signals: empty, confidence: 0, sampleSize: 0, engineVersion: COGNITIVE_RUNTIME_VERSION };

  const lens = observations.map((o) => o.responseLengthChars ?? 0);
  const times = observations.map((o) => o.responseTimeMs ?? 0).filter((t) => t > 0);
  const cites = observations.map((o) => o.evidenceCitations ?? 0);
  const abst  = observations.map((o) => o.abstractionMarkers ?? 0);
  const contr = observations.map((o) => o.contradictionMarkers ?? 0);
  const qual  = observations.map((o) => o.qualityScore ?? 0);
  const depths = observations.map((o) => Math.max(1, o.depthLevel ?? 1));

  // Heuristics — bounded; all 0..1
  const analytical = clamp01((mean(cites) / 3) * 0.6 + clamp01(mean(qual)) * 0.4);
  const systems    = clamp01((mean(abst) / 3) * 0.5 + clamp01(mean(depths) / 5) * 0.5);
  const decision   = times.length
    ? clamp01(1 - Math.min(mean(times), 120000) / 120000)  // faster ≈ higher, capped at 2 min
    : 0;
  const learning   = clamp01(0.4 + (n >= 5 ? 0.3 : n * 0.06) + clamp01(mean(qual)) * 0.3);
  const memory     = clamp01(clamp01(mean(lens) / 1200) * 0.6 + clamp01(mean(qual)) * 0.4);
  const strategic  = clamp01(clamp01(mean(abst) / 4) * 0.5 + clamp01(mean(depths) / 5) * 0.5);
  const problem    = clamp01(clamp01(mean(qual)) * 0.6 + (1 - clamp01(mean(contr) / 3)) * 0.4);

  const signals: Record<CognitiveSignal, number> = {
    AnalyticalReasoning: analytical, SystemsThinking: systems, DecisionVelocity: decision,
    LearningAgility: learning, WorkingMemory: memory, StrategicJudgement: strategic, ProblemSolving: problem,
  };
  const confidence = clamp01(Math.min(1, n / 8));
  return { signals, confidence, sampleSize: n, engineVersion: COGNITIVE_RUNTIME_VERSION };
}

export async function persistCognitiveProfile(
  pool: Pool,
  args: { userId: string; sessionId?: string; profile: CognitiveProfile },
): Promise<string | null> {
  try {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO cognitive_runtime_profiles
         (id, user_id, session_id, signals, confidence, sample_size, engine_version)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
      [id, args.userId, args.sessionId ?? null,
       JSON.stringify(args.profile.signals),
       args.profile.confidence, args.profile.sampleSize, args.profile.engineVersion],
    );
    return id;
  } catch (err) {
    console.warn('[cognitive-runtime] persist failed:', (err as Error).message);
    return null;
  }
}

export async function getLatestCognitiveProfile(
  pool: Pool, userId: string,
): Promise<CognitiveProfile | null> {
  try {
    const r = await pool.query(
      `SELECT signals, confidence, sample_size, engine_version
         FROM cognitive_runtime_profiles
         WHERE user_id = $1
         ORDER BY computed_at DESC LIMIT 1`,
      [userId],
    );
    const row: any = r.rows[0];
    if (!row) return null;
    return {
      signals: row.signals ?? {},
      confidence: Number(row.confidence ?? 0),
      sampleSize: Number(row.sample_size ?? 0),
      engineVersion: String(row.engine_version ?? COGNITIVE_RUNTIME_VERSION),
    };
  } catch {
    return null;
  }
}
