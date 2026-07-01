/**
 * MX-302B — Career Discovery: Values Inventory (the ONE net-new assessment)
 * ----------------------------------------------------------------------------
 * A light, deterministic work-values inventory. This is the only assessment
 * Career Discovery introduces that is not already covered by an existing engine
 * (CAPADEX / competency / LBI / MEI). Everything else in Discovery COMPOSES
 * existing engines.
 *
 * Pure module: no DB, no IO, no fabrication. Scoring maps Likert responses
 * (1..5) onto six work-value dimensions and surfaces the top values plus an
 * honest coverage figure (answered / total). When nothing is answered the
 * scores are NULL-equivalent (empty) — never silently 0.
 */

export type ValueDimensionId =
  | 'impact'
  | 'autonomy'
  | 'growth'
  | 'stability'
  | 'collaboration'
  | 'recognition';

export interface ValueDimension {
  id: ValueDimensionId;
  label: string;
  description: string;
}

export const VALUE_DIMENSIONS: ValueDimension[] = [
  { id: 'impact',        label: 'Impact & Purpose',     description: 'Work that makes a meaningful difference to others or society.' },
  { id: 'autonomy',      label: 'Autonomy & Freedom',   description: 'Independence in how, when and where you do your work.' },
  { id: 'growth',        label: 'Growth & Mastery',     description: 'Continuous learning, challenge and skill development.' },
  { id: 'stability',     label: 'Stability & Security',  description: 'Predictable income, structure and long-term security.' },
  { id: 'collaboration', label: 'Collaboration & Belonging', description: 'Working closely with a team you trust and enjoy.' },
  { id: 'recognition',   label: 'Recognition & Status',  description: 'Being acknowledged and advancing in visibility / seniority.' },
];

const DIMENSION_IDS = new Set<string>(VALUE_DIMENSIONS.map((d) => d.id));

export interface ValuesQuestion {
  id: string;
  dimension: ValueDimensionId;
  prompt: string;
  /** Likert anchors, low (1) → high (5). */
  scale: { min: number; max: number; lowLabel: string; highLabel: string };
}

/**
 * 12-item bank (2 per dimension). Likert 1..5. Deliberately short ("light
 * inventory") — discovery should take minutes, not an hour.
 */
export const VALUES_QUESTIONS: ValuesQuestion[] = [
  { id: 'v_impact_1',        dimension: 'impact',        prompt: 'I feel most fulfilled when my work visibly helps other people.' , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_impact_2',        dimension: 'impact',        prompt: 'A clear sense of purpose matters more to me than a high salary.' , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_autonomy_1',      dimension: 'autonomy',      prompt: 'I want significant freedom to decide how I do my work.'          , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_autonomy_2',      dimension: 'autonomy',      prompt: 'Being closely managed day-to-day would frustrate me.'            , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_growth_1',        dimension: 'growth',        prompt: 'I am energised by learning new skills and being challenged.'     , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_growth_2',        dimension: 'growth',        prompt: 'I would choose a stretchy role over a comfortable one.'          , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_stability_1',     dimension: 'stability',     prompt: 'Predictable income and job security are very important to me.'   , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_stability_2',     dimension: 'stability',     prompt: 'I prefer clear structure and well-defined expectations.'         , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_collaboration_1', dimension: 'collaboration', prompt: 'I do my best work as part of a close, trusted team.'             , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_collaboration_2', dimension: 'collaboration', prompt: 'A strong sense of belonging at work matters a lot to me.'        , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_recognition_1',   dimension: 'recognition',   prompt: 'Being recognised for my contributions strongly motivates me.'    , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
  { id: 'v_recognition_2',   dimension: 'recognition',   prompt: 'Advancing in seniority and visibility is important to me.'       , scale: { min: 1, max: 5, lowLabel: 'Strongly disagree', highLabel: 'Strongly agree' } },
];

const QUESTION_BY_ID = new Map(VALUES_QUESTIONS.map((q) => [q.id, q]));

export interface ValuesDimensionScore {
  dimension: ValueDimensionId;
  label: string;
  /** Mean response on the dimension, normalised to 0..100. NULL when unanswered. */
  score: number | null;
  answered: number;
  total: number;
}

export interface ValuesScoreResult {
  ok: boolean;
  measurable: boolean;
  dimensions: ValuesDimensionScore[];
  /** Dimensions ranked by score (highest first); empty when nothing measurable. */
  top_values: Array<{ dimension: ValueDimensionId; label: string; score: number }>;
  coverage: { answered: number; total: number; pct: number };
  scored_at: string;
}

/** Coerce a raw response to a valid 1..5 integer, or null. */
function coerceLikert(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 5) return null;
  return r;
}

/**
 * Pure scorer. `responses` is a map of questionId -> 1..5. Unknown ids and
 * out-of-range values are ignored (never coerced to 0). Returns honest coverage
 * and NULL dimension scores where nothing was answered.
 */
export function scoreValues(responses: Record<string, unknown> | null | undefined): ValuesScoreResult {
  const resp = responses && typeof responses === 'object' ? responses : {};
  const byDim = new Map<ValueDimensionId, number[]>();
  for (const d of VALUE_DIMENSIONS) byDim.set(d.id, []);

  let answered = 0;
  for (const [qid, raw] of Object.entries(resp)) {
    const q = QUESTION_BY_ID.get(qid);
    if (!q) continue;
    const val = coerceLikert(raw);
    if (val == null) continue;
    byDim.get(q.dimension)!.push(val);
    answered += 1;
  }

  const dimensions: ValuesDimensionScore[] = VALUE_DIMENSIONS.map((d) => {
    const vals = byDim.get(d.id)!;
    const total = VALUES_QUESTIONS.filter((q) => q.dimension === d.id).length;
    if (vals.length === 0) {
      return { dimension: d.id, label: d.label, score: null, answered: 0, total };
    }
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    // 1..5 → 0..100
    const score = Math.round(((mean - 1) / 4) * 100);
    return { dimension: d.id, label: d.label, score, answered: vals.length, total };
  });

  const top_values = dimensions
    .filter((d) => d.score != null)
    .sort((a, b) => (b.score as number) - (a.score as number))
    .slice(0, 3)
    .map((d) => ({ dimension: d.dimension, label: d.label, score: d.score as number }));

  const total = VALUES_QUESTIONS.length;
  return {
    ok: true,
    measurable: answered > 0,
    dimensions,
    top_values,
    coverage: { answered, total, pct: total ? Math.round((answered / total) * 100) : 0 },
    scored_at: new Date().toISOString(),
  };
}

export function isValueDimension(v: unknown): v is ValueDimensionId {
  return typeof v === 'string' && DIMENSION_IDS.has(v);
}

/**
 * Keep ONLY recognized Work Values answers (known question ids). Unknown / stray
 * keys from a flat request body are dropped so they are never persisted into
 * `values_responses`. Pure: returns a fresh object, never mutates the input.
 */
export function pickKnownValuesResponses(
  responses: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const resp = responses && typeof responses === 'object' ? responses : {};
  const out: Record<string, unknown> = {};
  for (const [qid, raw] of Object.entries(resp)) {
    if (QUESTION_BY_ID.has(qid)) out[qid] = raw;
  }
  return out;
}
