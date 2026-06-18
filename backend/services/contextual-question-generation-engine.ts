/**
 * Contextual Question Generation Engine — Phase 4 (additive, shadow-mode).
 *
 * Generates contextual questions from the union of:
 *   role DNA · experience · org maturity · industry · competency gaps ·
 *   behavioral signals · cognitive profile · leadership expectations ·
 *   assessment memory · contradiction history
 *
 * Pure-function `generateQuestion` for unit tests; `persistQuestion` is
 * best-effort append-only. Never replaces static V1 banks — when this engine
 * cannot synthesize, the caller falls back to the existing runtime.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { CognitiveProfile } from './cognitive-runtime-engine';

export const CONTEXTUAL_QUESTION_GENERATION_VERSION = '1.0.0';

export type QuestionType =
  | 'situational' | 'behavioral' | 'leadership' | 'analytical'
  | 'technical' | 'contradiction_probe' | 'evidence_validation';

export const QUESTION_TYPES: QuestionType[] = [
  'situational', 'behavioral', 'leadership', 'analytical',
  'technical', 'contradiction_probe', 'evidence_validation',
];

export type GenerationContext = {
  userId: string;
  competencyId: string;
  competencyLabel?: string;
  depthLevel: number;                      // 1..5
  questionType: QuestionType;
  roleTitle?: string;
  seniorityBand?: string;
  industry?: string;
  orgMaturity?: string;
  orgLayer?: string;
  experienceYears?: number;
  cognitiveProfile?: CognitiveProfile;
  competencyGapDelta?: number;             // 0..1
  recentContradictionCount?: number;
  assessmentMemoryHash?: string;
  leadershipExpectation?: string;          // free-form
};

export type GeneratedQuestion = {
  questionId: string;
  competencyId: string;
  questionType: QuestionType;
  depthLevel: number;
  prompt: string;
  rationale: Record<string, unknown>;
  generatorVersion: string;
};

function roleClause(c: GenerationContext): string {
  const role = c.roleTitle ? `as a ${c.roleTitle}` : 'in your current role';
  const seniority = c.seniorityBand ? ` (${c.seniorityBand})` : '';
  const industry = c.industry ? ` in the ${c.industry} industry` : '';
  return `${role}${seniority}${industry}`;
}

function stakeholderClause(c: GenerationContext): string {
  const layer = c.orgLayer ?? 'cross-functional';
  const maturity = c.orgMaturity ? `, in a ${c.orgMaturity} org` : '';
  return `working with ${layer} stakeholders${maturity}`;
}

const TEMPLATES: Record<QuestionType, (c: GenerationContext) => string> = {
  situational: (c) =>
    `Describe a recent situation ${roleClause(c)} ${stakeholderClause(c)} where ${c.competencyLabel ?? c.competencyId} was the deciding factor. ` +
    `Walk through the constraints, the trade-offs you considered, and the outcome.`,
  behavioral: (c) =>
    `Tell me about a time, ${roleClause(c)}, when you applied ${c.competencyLabel ?? c.competencyId} under pressure. ` +
    `What signals did you read first, what did you do, and what did you learn?`,
  leadership: (c) =>
    `${roleClause(c).charAt(0).toUpperCase() + roleClause(c).slice(1)}, describe a moment where your leadership shaped how ${c.competencyLabel ?? c.competencyId} was applied across the team. ` +
    `Who did you align, what tension did you resolve, and what was the lasting effect?`,
  analytical: (c) =>
    `Walk me through how you would diagnose a deteriorating outcome tied to ${c.competencyLabel ?? c.competencyId}, ${roleClause(c)}. ` +
    `What data would you pull, what hypotheses would you test, and how would you decide between them?`,
  technical: (c) =>
    `Pick a recent decision ${roleClause(c)} where ${c.competencyLabel ?? c.competencyId} required a specific technical trade-off. ` +
    `Explain the options you weighed, the choice you made, and why.`,
  contradiction_probe: (c) =>
    `Earlier you described ${c.competencyLabel ?? c.competencyId} differently. Reconcile the two accounts: ` +
    `what was the specific context that made the trade-off shift, and what would you do differently today?`,
  evidence_validation: (c) =>
    `Give one concrete example — a specific project, decision, or artifact — that demonstrates ${c.competencyLabel ?? c.competencyId} ${roleClause(c)}. ` +
    `Name the timeframe, the stakeholders, and the measurable outcome.`,
};

const DEPTH_PREFIX: Record<number, string> = {
  1: '',
  2: 'Going a layer deeper: ',
  3: 'Press into the nuance: ',
  4: 'At an executive depth: ',
  5: 'Stress-test the reasoning: ',
};

/**
 * Pure-function question synthesis — deterministic for a given context.
 * Caller is responsible for assigning a `questionId` (we mint one at persistence
 * time in `persistQuestion`). Keeping ID generation out of the pure function
 * preserves referential transparency for unit tests.
 */
export function generateQuestion(c: GenerationContext): Omit<GeneratedQuestion, 'questionId'> {
  const depth = Math.max(1, Math.min(5, c.depthLevel));
  const base = TEMPLATES[c.questionType](c);
  const prompt = `${DEPTH_PREFIX[depth] ?? ''}${base}`.trim();
  const rationale: Record<string, unknown> = {
    competencyId: c.competencyId,
    depthLevel: depth,
    questionType: c.questionType,
    drivers: {
      gapDelta: c.competencyGapDelta ?? null,
      contradictionPressure: c.recentContradictionCount ?? 0,
      cognitiveConfidence: c.cognitiveProfile?.confidence ?? null,
      seniority: c.seniorityBand ?? null,
      orgMaturity: c.orgMaturity ?? null,
    },
  };
  return {
    competencyId: c.competencyId,
    questionType: c.questionType,
    depthLevel: depth,
    prompt, rationale,
    generatorVersion: CONTEXTUAL_QUESTION_GENERATION_VERSION,
  };
}

/** Pick the next question type from coverage history. */
export function nextQuestionType(coverage: Partial<Record<QuestionType, number>>): QuestionType {
  let best: QuestionType = 'situational';
  let bestCount = Infinity;
  for (const t of QUESTION_TYPES) {
    const c = coverage[t] ?? 0;
    if (c < bestCount) { bestCount = c; best = t; }
  }
  return best;
}

export async function startSession(
  pool: Pool,
  args: {
    userId: string; blueprintId?: string;
    roleContext?: Record<string, unknown>;
    cognitiveSeed?: Record<string, unknown>;
    shadowMode: boolean;
  },
): Promise<string | null> {
  try {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO dynamic_question_sessions
         (id, user_id, blueprint_id, role_context, cognitive_seed, shadow_mode)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`,
      [id, args.userId, args.blueprintId ?? null,
       JSON.stringify(args.roleContext ?? {}),
       JSON.stringify(args.cognitiveSeed ?? {}), args.shadowMode],
    );
    return id;
  } catch (err) {
    console.warn('[question-generation] startSession failed:', (err as Error).message);
    return null;
  }
}

/**
 * Persist a generated question (questionId minted here). Returns the new id
 * on success, or null on best-effort failure.
 */
export async function persistQuestion(
  pool: Pool,
  args: {
    sessionId: string;
    questionIndex: number;
    question: Omit<GeneratedQuestion, 'questionId'>;
    contextSnapshot: Record<string, unknown>;
    signals?: Array<{ signalType: string; payload: Record<string, unknown> }>;
  },
): Promise<string | null> {
  const questionId = randomUUID();
  try {
    await pool.query(
      `INSERT INTO dynamic_question_generations
         (id, session_id, question_index, competency_id, question_type, depth_level,
          generator_version, prompt, context_snapshot, rationale)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)`,
      [questionId, args.sessionId, args.questionIndex,
       args.question.competencyId, args.question.questionType, args.question.depthLevel,
       args.question.generatorVersion, args.question.prompt,
       JSON.stringify(args.contextSnapshot), JSON.stringify(args.question.rationale)],
    );
    for (const s of args.signals ?? []) {
      await pool.query(
        `INSERT INTO question_context_signals (id, question_id, signal_type, signal_payload)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [randomUUID(), questionId, s.signalType, JSON.stringify(s.payload)],
      );
    }
    return questionId;
  } catch (err) {
    console.warn('[question-generation] persistQuestion failed:', (err as Error).message);
    return null;
  }
}
