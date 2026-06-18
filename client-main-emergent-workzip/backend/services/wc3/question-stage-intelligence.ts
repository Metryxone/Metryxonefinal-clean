/**
 * CAPADEX WC-3 L5A — Question Stage Intelligence (additive, reversible, pure).
 *
 * Phase 1 of L5 "Question Intelligence 2.0". Derives, for every clarity question, a
 * canonical developmental STAGE (Primary + Secondary) and a Stage Confidence, using
 * ONLY existing question metadata — `question_type`, `response_type`, `polarity`,
 * `narrative_style`. It NEVER reads the clarity `stage` column (which is single-valued
 * "Clarity"/blank — see audit `WC3_L5_QUESTION_INTELLIGENCE.md` §2.3) and NEVER authors
 * or mutates question text, ontology, signals, or concerns.
 *
 * Stages are the canonical WC-3 ladder (imported from stage-intelligence, never
 * re-declared): Awareness → Curiosity → Clarity → Growth → Mastery.
 *
 * Derivation is a deterministic weighted vote: each of the four signal fields maps its
 * value to a partial distribution over the 5 stages; the four distributions are combined
 * by field weight, normalised, and the top two stages become Primary/Secondary. An
 * unrecognised value casts NO vote (lowering coverage and therefore confidence) — honest,
 * never fabricated.
 *
 * Output rows persist to `wc3_question_intelligence` (keyed by the clarity SERIAL `id`,
 * because clarity `question_id` is NOT unique — see clarity-xlsx-import-quality lesson).
 * Populating that table changes no runtime behaviour; nothing reads it yet, so the app is
 * byte-identical whether or not `wc3QuestionIntel` is ON. Reversible via DROP TABLE.
 */
import type { Pool } from 'pg';
import { CANONICAL_STAGE_ORDER } from './stage-intelligence';
import { ensureWc3QuestionIntelSchema } from './wc3-schema';

export type CanonicalStage = (typeof CANONICAL_STAGE_ORDER)[number];
type StageVec = Partial<Record<CanonicalStage, number>>;

/** Relative contribution of each signal field to the combined stage vote (sum = 1.0). */
const FIELD_WEIGHTS = {
  question_type: 0.4,
  response_type: 0.3,
  narrative_style: 0.15,
  polarity: 0.15,
} as const;

/** Confidence band cut-points (mirrors the WC-3 band vocabulary, stage-scoped). */
const BAND_HIGH = 0.6;
const BAND_MODERATE = 0.45;

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

// --- question_type → stage distribution -----------------------------------------
const QUESTION_TYPE: Record<string, StageVec> = {
  severity: { Awareness: 0.7, Clarity: 0.3 },
  emotional: { Awareness: 0.6, Curiosity: 0.2, Clarity: 0.2 },
  awareness: { Awareness: 0.85, Curiosity: 0.15 },
  'self-awareness': { Curiosity: 0.5, Awareness: 0.3, Clarity: 0.2 },
  'self-perception': { Curiosity: 0.5, Clarity: 0.5 },
  perception: { Curiosity: 0.5, Clarity: 0.5 },
  clarity: { Clarity: 0.8, Curiosity: 0.2 },
  adaptive_diagnostic: { Clarity: 0.6, Curiosity: 0.4 },
  self_diagnostic: { Clarity: 0.6, Curiosity: 0.4 },
  cognitive: { Clarity: 0.6, Growth: 0.4 },
  behavior: { Clarity: 0.5, Growth: 0.5 },
  behavioral: { Clarity: 0.5, Growth: 0.5 },
  social: { Clarity: 0.6, Curiosity: 0.4 },
  'social-contextual': { Clarity: 0.6, Curiosity: 0.4 },
  situational: { Clarity: 0.6, Curiosity: 0.4 },
  frequency: { Clarity: 1.0 },
  behavior_correction: { Growth: 0.7, Mastery: 0.3 },
  behavioral_regulation: { Growth: 0.6, Mastery: 0.4 },
  coping: { Growth: 0.8, Mastery: 0.2 },
  readiness: { Growth: 0.7, Curiosity: 0.3 },
  growth_mapping: { Growth: 0.8, Mastery: 0.2 },
  adaptive_growth: { Growth: 0.8, Mastery: 0.2 },
  'future-oriented': { Curiosity: 0.4, Growth: 0.4, Mastery: 0.2 },
  hopeful: { Growth: 0.5, Mastery: 0.3, Curiosity: 0.2 },
  hope: { Growth: 0.5, Mastery: 0.3, Curiosity: 0.2 },
  growth_measurement: { Mastery: 0.7, Growth: 0.3 },
  behavioral_reflection: { Mastery: 0.7, Growth: 0.3 },
  adaptive_reflection: { Mastery: 0.7, Growth: 0.3 },
  reflective: { Mastery: 0.6, Clarity: 0.4 },
  integration: { Mastery: 0.6, Growth: 0.4 },
  summary: { Mastery: 0.5, Clarity: 0.5 },
};

// --- response_type → stage distribution -----------------------------------------
// `single_select` is intentionally ABSENT: it is a UI format, not a semantic — it casts
// no vote so the question leans on the other three fields.
const RESPONSE_TYPE: Record<string, StageVec> = {
  intensity: { Awareness: 0.6, Clarity: 0.4 },
  emotional_impact: { Awareness: 0.6, Clarity: 0.4 },
  emotional_intensity: { Awareness: 0.6, Clarity: 0.4 },
  impact: { Awareness: 0.5, Clarity: 0.5 },
  impact_level: { Awareness: 0.5, Clarity: 0.5 },
  duration: { Awareness: 0.4, Clarity: 0.6 },
  duration_impact: { Awareness: 0.4, Clarity: 0.6 },
  awareness: { Awareness: 0.6, Curiosity: 0.4 },
  agreement: { Curiosity: 0.4, Clarity: 0.6 },
  belief: { Curiosity: 0.4, Clarity: 0.6 },
  belief_strength: { Curiosity: 0.4, Clarity: 0.6 },
  self_evaluation: { Curiosity: 0.4, Clarity: 0.6 },
  perception_distortion: { Curiosity: 0.4, Clarity: 0.6 },
  frequency: { Clarity: 0.7, Growth: 0.3 },
  occurrence: { Clarity: 0.7, Growth: 0.3 },
  situational_fit: { Clarity: 0.7, Curiosity: 0.3 },
  fit: { Clarity: 0.7, Curiosity: 0.3 },
  fairness: { Clarity: 0.6, Curiosity: 0.4 },
  clarity: { Clarity: 0.7, Curiosity: 0.3 },
  clarity_level: { Clarity: 0.7, Curiosity: 0.3 },
  decision_clarity: { Clarity: 0.6, Growth: 0.4 },
  understanding: { Clarity: 0.7, Curiosity: 0.3 },
  alignment: { Clarity: 0.6, Growth: 0.4 },
  behavioral_consistency: { Clarity: 0.4, Growth: 0.6 },
  consistency: { Clarity: 0.4, Growth: 0.6 },
  social_comfort: { Clarity: 0.5, Growth: 0.5 },
  comfort: { Clarity: 0.5, Growth: 0.5 },
  comfort_level: { Clarity: 0.5, Growth: 0.5 },
  support_level: { Clarity: 0.5, Growth: 0.5 },
  support: { Clarity: 0.5, Growth: 0.5 },
  support_perception: { Clarity: 0.5, Curiosity: 0.5 },
  confidence: { Growth: 0.6, Mastery: 0.4 },
  ability: { Growth: 0.6, Mastery: 0.4 },
  stability: { Growth: 0.5, Mastery: 0.5 },
  emotional_stability: { Growth: 0.5, Mastery: 0.5 },
  readiness: { Growth: 0.8, Curiosity: 0.2 },
  willingness: { Growth: 0.8, Curiosity: 0.2 },
  openness: { Growth: 0.7, Curiosity: 0.3 },
  likelihood: { Growth: 0.7, Curiosity: 0.3 },
  commitment: { Growth: 0.7, Mastery: 0.3 },
  motivation: { Growth: 0.7, Curiosity: 0.3 },
  energy_motivation: { Growth: 0.7, Curiosity: 0.3 },
  coping_effectiveness: { Growth: 0.6, Mastery: 0.4 },
  effectiveness: { Growth: 0.5, Mastery: 0.5 },
  support_effectiveness: { Growth: 0.5, Mastery: 0.5 },
  manageability: { Growth: 0.6, Mastery: 0.4 },
  ease: { Growth: 0.5, Mastery: 0.5 },
  difficulty: { Awareness: 0.4, Growth: 0.6 },
  difficulty_level: { Awareness: 0.4, Growth: 0.6 },
  coping_difficulty: { Awareness: 0.4, Growth: 0.6 },
  habit_consistency: { Growth: 0.5, Mastery: 0.5 },
  timing: { Clarity: 0.5, Growth: 0.5 },
  recovery_speed: { Mastery: 0.6, Growth: 0.4 },
  recovery_time: { Mastery: 0.6, Growth: 0.4 },
  recovery: { Mastery: 0.6, Growth: 0.4 },
  recovery_action: { Mastery: 0.5, Growth: 0.5 },
  emotional_recovery: { Mastery: 0.6, Growth: 0.4 },
  transition_speed: { Mastery: 0.5, Growth: 0.5 },
  speed: { Mastery: 0.5, Growth: 0.5 },
  speed_confidence: { Mastery: 0.5, Growth: 0.5 },
  improvement: { Mastery: 0.5, Growth: 0.5 },
  satisfaction: { Mastery: 0.6, Growth: 0.4 },
  outcome: { Mastery: 0.5, Growth: 0.5 },
};

// --- narrative_style → stage distribution ---------------------------------------
const NARRATIVE_STYLE: Record<string, StageVec> = {
  severity: { Awareness: 0.8, Clarity: 0.2 },
  emotional: { Awareness: 0.6, Curiosity: 0.4 },
  'self-perception': { Curiosity: 0.5, Clarity: 0.5 },
  scenario_based: { Clarity: 0.6, Curiosity: 0.4 },
  situational: { Clarity: 0.6, Curiosity: 0.4 },
  'social-contextual': { Clarity: 0.6, Curiosity: 0.4 },
  analytical: { Clarity: 0.7, Curiosity: 0.3 },
  cognitive: { Clarity: 0.6, Growth: 0.4 },
  behavioral: { Clarity: 0.5, Growth: 0.5 },
  collaborative: { Growth: 0.5, Clarity: 0.5 },
  'action-oriented': { Growth: 0.8, Mastery: 0.2 },
  coping: { Growth: 0.8, Mastery: 0.2 },
  readiness: { Growth: 0.8, Curiosity: 0.2 },
  confidence: { Growth: 0.6, Mastery: 0.4 },
  intervention: { Growth: 0.7, Mastery: 0.3 },
  'growth-oriented': { Growth: 0.6, Mastery: 0.4 },
  'future-oriented': { Curiosity: 0.4, Growth: 0.4, Mastery: 0.2 },
  hopeful: { Growth: 0.5, Mastery: 0.3, Curiosity: 0.2 },
  hope: { Growth: 0.5, Mastery: 0.3, Curiosity: 0.2 },
  reflective: { Mastery: 0.5, Clarity: 0.3, Curiosity: 0.2 },
  timeline_based: { Mastery: 0.4, Growth: 0.4, Clarity: 0.2 },
};

// --- polarity → stage distribution ----------------------------------------------
// Negative items are problem-focused (earlier ladder); positive items assess
// strengths/assets (later ladder) — consistent with the strengths canon.
const POLARITY: Record<string, StageVec> = {
  negative: { Awareness: 0.3, Curiosity: 0.25, Clarity: 0.45 },
  positive: { Curiosity: 0.15, Growth: 0.45, Mastery: 0.4 },
  mixed: { Clarity: 0.5, Growth: 0.5 },
  neutral: { Clarity: 0.6, Curiosity: 0.4 },
};

export interface QuestionStageInput {
  question_type?: string | null;
  response_type?: string | null;
  polarity?: string | null;
  narrative_style?: string | null;
}

export interface QuestionStageResult {
  primary_stage: CanonicalStage | null;
  secondary_stage: CanonicalStage | null;
  stage_confidence: number; // 0..1
  stage_band: 'HIGH_CONFIDENCE' | 'MODERATE_CONFIDENCE' | 'LOW_CONFIDENCE' | 'UNRESOLVED';
  coverage: number; // 0..1 — fraction of field weight that cast a recognised vote
  stage_distribution: Record<string, number>;
  signals_used: {
    question_type: string;
    response_type: string;
    polarity: string;
    narrative_style: string;
    recognized: string[];
  };
}

/**
 * Pure derivation: combine the four field votes into a canonical stage distribution and
 * pick Primary/Secondary + a confidence. Deterministic; no DB, no side effects.
 */
export function deriveQuestionStage(input: QuestionStageInput): QuestionStageResult {
  const fields: Array<[keyof typeof FIELD_WEIGHTS, Record<string, StageVec>, string]> = [
    ['question_type', QUESTION_TYPE, norm(input.question_type)],
    ['response_type', RESPONSE_TYPE, norm(input.response_type)],
    ['narrative_style', NARRATIVE_STYLE, norm(input.narrative_style)],
    ['polarity', POLARITY, norm(input.polarity)],
  ];

  const acc: Record<CanonicalStage, number> = {
    Awareness: 0, Curiosity: 0, Clarity: 0, Growth: 0, Mastery: 0,
  };
  let recognizedWeight = 0;
  const recognized: string[] = [];

  for (const [fieldName, table, value] of fields) {
    const dist = value ? table[value] : undefined;
    if (!dist) continue;
    const w = FIELD_WEIGHTS[fieldName];
    recognizedWeight += w;
    recognized.push(fieldName);
    for (const stage of CANONICAL_STAGE_ORDER) {
      acc[stage] += w * (dist[stage] ?? 0);
    }
  }

  const signals_used = {
    question_type: norm(input.question_type),
    response_type: norm(input.response_type),
    polarity: norm(input.polarity),
    narrative_style: norm(input.narrative_style),
    recognized,
  };

  if (recognizedWeight === 0) {
    return {
      primary_stage: null,
      secondary_stage: null,
      stage_confidence: 0,
      stage_band: 'UNRESOLVED',
      coverage: 0,
      stage_distribution: {},
      signals_used,
    };
  }

  // Normalise to a proper distribution over the recognised votes.
  const distribution: Record<string, number> = {};
  for (const stage of CANONICAL_STAGE_ORDER) {
    distribution[stage] = round(acc[stage] / recognizedWeight, 4);
  }

  const ranked = [...CANONICAL_STAGE_ORDER].sort((a, b) => distribution[b] - distribution[a]);
  const primary = ranked[0];
  const secondary = ranked[1];
  const primaryProb = distribution[primary];
  const coverage = round(recognizedWeight, 4); // FIELD_WEIGHTS sum to 1.0

  // Confidence rewards a dominant primary AND broad field agreement (coverage).
  const stage_confidence = round(primaryProb * (0.5 + 0.5 * coverage), 3);
  const stage_band =
    stage_confidence >= BAND_HIGH ? 'HIGH_CONFIDENCE'
    : stage_confidence >= BAND_MODERATE ? 'MODERATE_CONFIDENCE'
    : 'LOW_CONFIDENCE';

  return {
    primary_stage: primary,
    secondary_stage: secondary,
    stage_confidence,
    stage_band,
    coverage,
    stage_distribution: distribution,
    signals_used,
  };
}

function round(n: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(n * f) / f;
}

export interface BuildStageReport {
  total: number;
  written: number;
  resolved: number;
  coverage_pct: number;
  stage_distribution: Record<string, number>;
  band_distribution: Record<string, number>;
  mean_confidence: number;
  confidence_histogram: Record<string, number>;
  qis_stage_delta: number;
}

/**
 * Batch builder: derive stage intelligence for EVERY clarity question and upsert into
 * `wc3_question_intelligence`. Idempotent (ON CONFLICT (clarity_id) DO UPDATE). Returns
 * the validation metrics required by the L5A report.
 */
export async function buildQuestionStageIntelligence(pool: Pool): Promise<BuildStageReport> {
  await ensureWc3QuestionIntelSchema(pool);

  const { rows } = await pool.query<{
    id: number;
    question_id: string | null;
    question_type: string | null;
    response_type: string | null;
    polarity: string | null;
    narrative_style: string | null;
  }>(
    `SELECT id, question_id, question_type, response_type, polarity, narrative_style
       FROM capadex_clarity_questions`,
  );

  const total = rows.length;
  let written = 0;
  let resolved = 0;
  let confSum = 0;
  const stageDist: Record<string, number> = {};
  const bandDist: Record<string, number> = {};
  const histo: Record<string, number> = { '0.0-0.3': 0, '0.3-0.45': 0, '0.45-0.6': 0, '0.6-0.75': 0, '0.75-1.0': 0 };

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values: any[] = [];
    const tuples: string[] = [];
    slice.forEach((r, j) => {
      const d = deriveQuestionStage(r);
      if (d.primary_stage) resolved += 1;
      confSum += d.stage_confidence;
      stageDist[d.primary_stage ?? 'UNRESOLVED'] = (stageDist[d.primary_stage ?? 'UNRESOLVED'] ?? 0) + 1;
      bandDist[d.stage_band] = (bandDist[d.stage_band] ?? 0) + 1;
      const c = d.stage_confidence;
      const bucket = c < 0.3 ? '0.0-0.3' : c < 0.45 ? '0.3-0.45' : c < 0.6 ? '0.45-0.6' : c < 0.75 ? '0.6-0.75' : '0.75-1.0';
      histo[bucket] += 1;
      const b = j * 9;
      tuples.push(`($${b + 1},$${b + 2},'clarity',$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},now())`);
      values.push(
        r.id, r.question_id ?? null, d.primary_stage, d.secondary_stage,
        d.stage_confidence, d.stage_band, d.coverage,
        JSON.stringify(d.stage_distribution), JSON.stringify(d.signals_used),
      );
    });
    await pool.query(
      `INSERT INTO wc3_question_intelligence
         (clarity_id, question_id, source, primary_stage, secondary_stage,
          stage_confidence, stage_band, coverage, stage_distribution, signals_used, computed_at)
       VALUES ${tuples.join(',')}
       ON CONFLICT (clarity_id) DO UPDATE SET
         question_id = EXCLUDED.question_id,
         primary_stage = EXCLUDED.primary_stage,
         secondary_stage = EXCLUDED.secondary_stage,
         stage_confidence = EXCLUDED.stage_confidence,
         stage_band = EXCLUDED.stage_band,
         coverage = EXCLUDED.coverage,
         stage_distribution = EXCLUDED.stage_distribution,
         signals_used = EXCLUDED.signals_used,
         computed_at = now()`,
      values,
    );
    written += slice.length;
  }

  const mean_confidence = total > 0 ? round(confSum / total, 3) : 0;
  const coverage_pct = total > 0 ? round((100 * resolved) / total, 1) : 0;
  // QIS stage component = primary(0.12) + secondary(0.08) = 0.20 of the 0..100 QIS.
  // Before L5A the canonical stage was unknown → contribution 0. After: weight ×
  // resolved-fraction × mean confidence × 100.
  const qis_stage_delta = round(0.2 * (resolved / Math.max(total, 1)) * mean_confidence * 100, 1);

  return {
    total,
    written,
    resolved,
    coverage_pct,
    stage_distribution: stageDist,
    band_distribution: bandDist,
    mean_confidence,
    confidence_histogram: histo,
    qis_stage_delta,
  };
}
