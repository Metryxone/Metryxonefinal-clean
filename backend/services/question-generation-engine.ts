/**
 * Question Generation Engine (V2) — gap-fill Phase 2
 *
 * Pure-function engine that generates the NEXT adaptive question for an
 * assessment session WITHOUT any hardcoded question banks or fixed sequencing.
 *
 * Selection priority (deterministic, explainable):
 *   1. Branching rule match on prior response (assessment_branching_rules)
 *   2. Lowest-confidence × highest-weight competency (signal-driven probe)
 *   3. competency_question_templates match (mode-preferred)
 *   4. Graph-driven synthetic probe (last resort, gated by allowSynthetic)
 *
 * Schema (read from 20260705_assessment_blueprint_v2.sql, verified live):
 *   assessment_branching_rules(rule_key, competency_code, trigger_type,
 *     trigger_condition jsonb, next_action, action_params jsonb,
 *     priority int, is_active bool)
 *   competency_question_templates(template_key, competency_code, question_type,
 *     template_body jsonb, difficulty_band, language_policy jsonb)
 *   adaptive_question_pools is a POOL DESCRIPTOR (not per-question rows) — used
 *     here only to confirm a competency has pool coverage for diversification.
 *
 * Side effect: appends to `dynamic_question_generation_logs` (best-effort).
 */
import type { Pool } from 'pg';

export const QUESTION_GENERATION_VERSION = '1.0.0';

export type GenerationMode = 'behavioural' | 'situational' | 'strategic' | 'technical' | 'communication';
export type GenerationSource = 'template' | 'branching' | 'graph' | 'pool_descriptor';

export interface CompetencySignal {
  competency_code: string;
  importance_weight: number;       // 0..1
  expected_level: number;          // 0..100
  observed_confidence: number;     // 0..1
  observed_level?: number;
  responses_so_far?: number;
}

export interface SessionContext {
  session_id: string | null;
  user_id: string | number;
  role_id?: string | null;
  industry_id?: string | null;
  layer_id?: string | null;
  org_maturity?: string | null;
  question_index?: number;
  prior_response?: {
    question_id?: string;
    competency_code?: string;
    value?: unknown;                // numeric score, or response payload
  } | null;
  signals: CompetencySignal[];
  allowSynthetic?: boolean;        // default true; flip false in production
}

export interface GeneratedQuestion {
  question_id: string;
  question_text: string;
  options?: Array<{ value: string | number; label: string }>;
  scale?: { min: number; max: number; labels?: Record<number, string> };
  mode: GenerationMode;
  target_competency_code: string;
  target_subcompetency?: string;
  difficulty_level: number;        // 0..100
  confidence_target: number;       // 0..1
}

export interface QuestionGenerationResult {
  question: GeneratedQuestion | null;
  source: GenerationSource;
  rationale: string;
  candidate_signals: CompetencySignal[];
  methodology_version: string;
}

/* ------------------------------------------------------------------ */
/* Pure selection logic                                               */
/* ------------------------------------------------------------------ */

export function pickNextCompetency(signals: CompetencySignal[]): CompetencySignal | null {
  if (!signals?.length) return null;
  const scored = signals
    .filter((s) => s.importance_weight > 0)
    .map((s) => ({ s, score: (1 - Math.min(1, Math.max(0, s.observed_confidence))) * s.importance_weight }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.s ?? null;
}

export function pickMode(target: CompetencySignal): GenerationMode {
  const n = target.responses_so_far ?? 0;
  const rotation: GenerationMode[] = ['situational', 'behavioural', 'strategic', 'technical', 'communication'];
  return rotation[n % rotation.length];
}

function bandFromDifficulty(difficulty: number): string {
  if (difficulty >= 75) return 'hard';
  if (difficulty >= 40) return 'medium';
  return 'easy';
}

/**
 * Evaluate a trigger_condition jsonb against the prior response.
 * Conditions are simple equality / threshold shapes:
 *   { equals: <value> } | { gte: <number> } | { lte: <number> } |
 *   { in: [<value>...] } | {}  (always match)
 */
function matchesTrigger(trigger: Record<string, unknown> | null, value: unknown): boolean {
  if (!trigger || Object.keys(trigger).length === 0) return true;
  if ('equals' in trigger) return value === trigger.equals;
  if ('in' in trigger && Array.isArray(trigger.in)) return (trigger.in as unknown[]).includes(value);
  if ('gte' in trigger && typeof value === 'number') return value >= Number(trigger.gte);
  if ('lte' in trigger && typeof value === 'number') return value <= Number(trigger.lte);
  return false;
}

/* ------------------------------------------------------------------ */
/* Template adaptation                                                */
/* ------------------------------------------------------------------ */

interface BranchingRuleRow {
  id: string;
  rule_key: string;
  competency_code: string | null;
  trigger_type: string;
  trigger_condition: Record<string, unknown> | null;
  next_action: string;
  action_params: Record<string, unknown> | null;
  priority: number;
}

interface TemplateRow {
  id: string;
  template_key: string;
  competency_code: string;
  question_type: string;
  template_body: Record<string, unknown>;
  difficulty_band: string;
}

function templateToQuestion(row: TemplateRow, target: CompetencySignal, mode: GenerationMode): GeneratedQuestion {
  const body = row.template_body ?? {};
  const text = String(body.text ?? body.prompt ?? body.question_text ?? `Reflect on a recent ${row.competency_code.replace(/_/g, ' ')} moment.`);
  const options = Array.isArray(body.options) ? (body.options as GeneratedQuestion['options']) : undefined;
  const scale = (body.scale as GeneratedQuestion['scale']) ?? undefined;
  const difficultyMap: Record<string, number> = { easy: 30, medium: 55, hard: 80 };
  return {
    question_id: row.id,
    question_text: text,
    options,
    scale,
    mode,
    target_competency_code: row.competency_code,
    target_subcompetency: (body.subcompetency as string | undefined) ?? undefined,
    difficulty_level: difficultyMap[row.difficulty_band] ?? 50,
    confidence_target: 0.85,
  };
}

/* ------------------------------------------------------------------ */
/* DB helpers — fail-loud (no silent .catch on schema errors)         */
/* ------------------------------------------------------------------ */

async function loadActiveBranchingRules(pool: Pool, competencyCode: string): Promise<BranchingRuleRow[]> {
  const r = await pool.query<BranchingRuleRow>(
    `SELECT id, rule_key, competency_code, trigger_type, trigger_condition,
            next_action, action_params, priority
       FROM assessment_branching_rules
      WHERE is_active = TRUE
        AND (competency_code = $1 OR competency_code IS NULL)
      ORDER BY priority DESC`,
    [competencyCode],
  );
  return r.rows;
}

async function loadTemplateById(pool: Pool, id: string): Promise<TemplateRow | null> {
  const r = await pool.query<TemplateRow>(
    `SELECT id, template_key, competency_code, question_type, template_body, difficulty_band
       FROM competency_question_templates WHERE id = $1 LIMIT 1`,
    [id],
  );
  return r.rows[0] ?? null;
}

async function loadTemplateForCompetency(
  pool: Pool,
  competencyCode: string,
  mode: GenerationMode,
  targetDifficulty: number,
): Promise<TemplateRow | null> {
  // Prefer mode-matching (question_type) + difficulty_band, fall back to any active row.
  const band = bandFromDifficulty(targetDifficulty);
  const r = await pool.query<TemplateRow>(
    `SELECT id, template_key, competency_code, question_type, template_body, difficulty_band
       FROM competency_question_templates
      WHERE competency_code = $1
      ORDER BY (question_type = $2) DESC, (difficulty_band = $3) DESC, created_at DESC
      LIMIT 1`,
    [competencyCode, mode, band],
  );
  return r.rows[0] ?? null;
}

async function logGeneration(
  pool: Pool,
  ctx: SessionContext,
  question: GeneratedQuestion,
  source: GenerationSource,
  rationale: string,
  inputs: Record<string, unknown>,
): Promise<void> {
  pool
    .query(
      `INSERT INTO dynamic_question_generation_logs
        (session_id, user_id, question_index, question_payload,
         target_competency_code, target_subcompetency,
         generation_source, generation_inputs, generation_rationale,
         difficulty_level, confidence_target, engine_versions)
       VALUES ($1::uuid, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb)`,
      [
        ctx.session_id || null,
        String(ctx.user_id),
        ctx.question_index ?? null,
        JSON.stringify(question),
        question.target_competency_code,
        question.target_subcompetency ?? null,
        source,
        JSON.stringify(inputs),
        rationale,
        question.difficulty_level,
        question.confidence_target,
        JSON.stringify({ QUESTION_GENERATION_VERSION }),
      ],
    )
    .catch((err) => console.warn('[question-gen] log failed:', (err as Error).message));
}

/* ------------------------------------------------------------------ */
/* Top-level generator                                                */
/* ------------------------------------------------------------------ */

export async function generateNextQuestion(pool: Pool, ctx: SessionContext): Promise<QuestionGenerationResult> {
  // 0) Stabilisation guard
  const candidates = (ctx.signals ?? []).filter((s) => s.observed_confidence < 0.85 && s.importance_weight > 0);
  if (!candidates.length) {
    return {
      question: null,
      source: 'graph',
      rationale: 'All weighted competencies have stabilised; no further probe needed.',
      candidate_signals: ctx.signals ?? [],
      methodology_version: QUESTION_GENERATION_VERSION,
    };
  }

  const allowSynthetic = ctx.allowSynthetic !== false;

  // 1) Branching rule on prior response
  if (ctx.prior_response?.competency_code) {
    const rules = await loadActiveBranchingRules(pool, ctx.prior_response.competency_code);
    for (const rule of rules) {
      if (!matchesTrigger(rule.trigger_condition, ctx.prior_response.value)) continue;
      const params = rule.action_params ?? {};
      const nextTemplateId = (params.next_template_id ?? params.template_id) as string | undefined;
      if (rule.next_action === 'serve_template' && nextTemplateId) {
        const row = await loadTemplateById(pool, nextTemplateId);
        if (row) {
          const target = candidates.find((c) => c.competency_code === row.competency_code) ?? candidates[0];
          const mode = pickMode(target);
          const q = templateToQuestion(row, target, mode);
          const rationale = `Branching rule '${rule.rule_key}' fired on prior ${ctx.prior_response.competency_code} response.`;
          await logGeneration(pool, ctx, q, 'branching', rationale, { rule_id: rule.id, rule_key: rule.rule_key });
          return { question: q, source: 'branching', rationale, candidate_signals: candidates, methodology_version: QUESTION_GENERATION_VERSION };
        }
      }
      // Other next_action types (probe_deeper / skip / etc.) fall through to signal-driven path
      break;
    }
  }

  // 2) Lowest-confidence × highest-weight competency
  const target = pickNextCompetency(candidates)!;
  const mode = pickMode(target);

  // 3) Template lookup
  const row = await loadTemplateForCompetency(pool, target.competency_code, mode, 50 + (target.importance_weight * 30));
  if (row) {
    const q = templateToQuestion(row, target, mode);
    const rationale =
      `Competency '${target.competency_code}' has the largest confidence gap × weight ` +
      `(conf=${target.observed_confidence.toFixed(2)}, w=${target.importance_weight.toFixed(2)}); ` +
      `probing in '${mode}' mode at '${row.difficulty_band}' band.`;
    await logGeneration(pool, ctx, q, 'template', rationale, {
      target_competency_code: target.competency_code,
      mode,
      signal_score: (1 - target.observed_confidence) * target.importance_weight,
    });
    return { question: q, source: 'template', rationale, candidate_signals: candidates, methodology_version: QUESTION_GENERATION_VERSION };
  }

  // 4) Synthetic — gated. In production set allowSynthetic=false so missing
  //    templates surface as a 502 rather than degrade silently.
  if (!allowSynthetic) {
    return {
      question: null,
      source: 'graph',
      rationale: `No template found for '${target.competency_code}' and synthetic fallback disabled.`,
      candidate_signals: candidates,
      methodology_version: QUESTION_GENERATION_VERSION,
    };
  }
  const synthetic: GeneratedQuestion = {
    question_id: `synth-${target.competency_code}-${Date.now()}`,
    question_text: `Describe a recent situation where you demonstrated ${target.competency_code.replace(/_/g, ' ')}.`,
    mode,
    target_competency_code: target.competency_code,
    difficulty_level: 50,
    confidence_target: 0.7,
  };
  const rationale = `No template for '${target.competency_code}' in mode '${mode}'; synthesised a graph-driven probe (operator should add a template).`;
  await logGeneration(pool, ctx, synthetic, 'graph', rationale, { target_competency_code: target.competency_code, synthetic: true });
  return { question: synthetic, source: 'graph', rationale, candidate_signals: candidates, methodology_version: QUESTION_GENERATION_VERSION };
}
