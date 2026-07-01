/**
 * CAPADEX 3.0 — Program 3 · Phase 3.5 Assessment Measurement & Scoring Engine — MECHANISMS
 * ───────────────────────────────────────────────────────────────────────────
 * The reuse-before-build engineering-closure mechanisms + the ONLY DDL sites for this phase.
 *
 * Every write path FIRST calls `assertEnabled()` (throws if the flag is OFF) and then
 * `ensureAsSchema()` (lazy CREATE TABLE IF NOT EXISTS). Because the schema is created ONLY here —
 * and ONLY behind the flag — OFF is byte-identical incl. schema (OFF creates 0 tables). The
 * additive overlay tables are:
 *   as_score_configs — versioned scoring configuration (formula/weight/threshold/rule config).
 *   as_formulas      — named, versioned formula definitions (structured AST — NO eval).
 *   as_rules         — scoring rules (positive/negative weight, partial credit, bonus/penalty, …).
 *   as_scores        — computed score records (per assessment/subject, per scoring model).
 *   as_measurements  — measurement outputs (competency/behaviour/skill/… indicators).
 *   as_validations   — formula/rule/config/response validation runs (audit ledger).
 *
 * The PURE compute/validate helpers (computeScore/validateFormula/validateRule/validateConfig/
 * validateResponses) have NO DB + NO DDL + NO eval — they are deterministic + side-effect free.
 * Reads are null-safe (`count()` returns null on error, NEVER 0). null (unreadable) ≠ 0 (empty).
 * This module NEVER runs psychometrics/interprets/reports — it only measures, scores, and records.
 */
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';

function assertEnabled(): void {
  if (!isFlagEnabled('assessmentScoring')) {
    throw new Error('assessment_scoring_disabled');
  }
}

let schemaReady = false;
export async function ensureAsSchema(pool: Pool): Promise<void> {
  // Guard: the flag MUST be ON to reach any DDL. OFF → 0 tables (byte-identical).
  assertEnabled();
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS as_score_configs (
      id            BIGSERIAL PRIMARY KEY,
      config_key    TEXT NOT NULL,
      version       INTEGER NOT NULL DEFAULT 1,
      assessment_slug TEXT,
      scoring_model TEXT NOT NULL DEFAULT 'raw_score',
      config        JSONB NOT NULL DEFAULT '{}'::jsonb,
      status        TEXT NOT NULL DEFAULT 'draft',
      owner         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (config_key, version)
    );
    CREATE TABLE IF NOT EXISTS as_formulas (
      id            BIGSERIAL PRIMARY KEY,
      formula_key   TEXT NOT NULL,
      version       INTEGER NOT NULL DEFAULT 1,
      kind          TEXT NOT NULL DEFAULT 'weighted_sum',
      definition    JSONB NOT NULL DEFAULT '{}'::jsonb,
      status        TEXT NOT NULL DEFAULT 'draft',
      owner         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (formula_key, version)
    );
    CREATE TABLE IF NOT EXISTS as_rules (
      id            BIGSERIAL PRIMARY KEY,
      rule_key      TEXT UNIQUE NOT NULL,
      rule_type     TEXT NOT NULL DEFAULT 'positive_weight',
      scope         TEXT NOT NULL DEFAULT 'question',
      definition    JSONB NOT NULL DEFAULT '{}'::jsonb,
      status        TEXT NOT NULL DEFAULT 'active',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS as_scores (
      id            BIGSERIAL PRIMARY KEY,
      score_key     TEXT NOT NULL,
      assessment_slug TEXT,
      subject_ref   TEXT,
      scoring_model TEXT NOT NULL DEFAULT 'raw_score',
      raw           DOUBLE PRECISION,
      value         DOUBLE PRECISION,
      maximum       DOUBLE PRECISION,
      breakdown     JSONB NOT NULL DEFAULT '{}'::jsonb,
      status        TEXT NOT NULL DEFAULT 'computed',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (score_key, scoring_model)
    );
    CREATE INDEX IF NOT EXISTS as_scores_subject_idx ON as_scores(subject_ref);
    CREATE TABLE IF NOT EXISTS as_measurements (
      id            BIGSERIAL PRIMARY KEY,
      measure_key   TEXT NOT NULL,
      subject_ref   TEXT,
      measure_type  TEXT NOT NULL DEFAULT 'competency',
      indicator     TEXT,
      value         DOUBLE PRECISION,
      scale_max     DOUBLE PRECISION,
      detail        JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (measure_key, measure_type, indicator)
    );
    CREATE INDEX IF NOT EXISTS as_measurements_subject_idx ON as_measurements(subject_ref);
    CREATE TABLE IF NOT EXISTS as_validations (
      id            BIGSERIAL PRIMARY KEY,
      target        TEXT NOT NULL,
      target_ref    TEXT,
      valid         BOOLEAN NOT NULL DEFAULT false,
      errors        JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  schemaReady = true;
}

/** null on error (unreadable), 0 on no rows (empty). null ≠ 0. */
async function count(pool: Pool, sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const v = rows[0] ? Object.values(rows[0])[0] : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

/**
 * Read-only helpers: NEVER touch DDL. If the overlay table is absent (flag never
 * exercised via a write), the query throws → we honestly return empty ([] / null),
 * NEVER CREATE TABLE. DDL lives ONLY on the write paths (via ensureAsSchema).
 */
async function safeRows(pool: Pool, sql: string, params: unknown[] = []): Promise<unknown[]> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows;
  } catch {
    return [];
  }
}
async function safeRow(pool: Pool, sql: string, params: unknown[] = []): Promise<unknown> {
  try {
    const { rows } = await pool.query(sql, params);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PURE COMPUTE / VALIDATE — deterministic, NO DB, NO DDL, NO eval.
// ═════════════════════════════════════════════════════════════════════════════

export const SCORING_MODEL_KEYS = [
  'raw_score', 'weighted_score', 'reverse_scoring', 'composite_score', 'percentage',
  'domain_score', 'sub_domain_score', 'competency_score', 'behaviour_score', 'skill_score',
  'trait_score', 'dimension_score', 'overall_score',
] as const;
export type ScoringModelKey = typeof SCORING_MODEL_KEYS[number];

export const MISSING_POLICIES = ['skip', 'zero', 'neutral'] as const;
export type MissingPolicy = typeof MISSING_POLICIES[number];

export interface ScoreItem {
  ref?: string;
  value: number | null;          // raw response value (null = missing/blank)
  weight?: number;               // per-item weight (default 1)
  max?: number;                  // per-item maximum (for percentage/reverse)
  min?: number;                  // per-item minimum (for reverse)
  group?: string;                // domain / competency / dimension grouping
  reverse?: boolean;             // item is reverse-polarity
  optional?: boolean;            // excluded from denominator
  mandatory?: boolean;           // must be answered
  correct?: boolean;             // objective correctness (for bonus/penalty)
}
export interface ScoreOptions {
  model?: ScoringModelKey;
  missing_policy?: MissingPolicy;
  neutral_value?: number;
  bonus?: number;                // flat bonus applied per correct item
  penalty?: number;              // flat penalty applied per incorrect item (negative marking)
}
export interface ScoreGroupResult { group: string; raw: number; value: number; maximum: number; answered: number; count: number }
export interface ScoreResult {
  model: ScoringModelKey;
  raw: number;
  value: number;
  maximum: number;
  percentage: number | null;
  answered: number;
  missing: number;
  optional_excluded: number;
  mandatory_missing: string[];
  groups: ScoreGroupResult[];
  note: string;
}

const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * PURE score computation across the 13 canonical scoring models. Deterministic, no side effects.
 * Missing values (null) are handled per policy and NEVER silently coerced to a fabricated 0
 * unless the policy explicitly says 'zero'. Optional items are excluded from the maximum.
 */
export function computeScore(items: ScoreItem[], options: ScoreOptions = {}): ScoreResult {
  const model = (SCORING_MODEL_KEYS as readonly string[]).includes(options.model as string)
    ? (options.model as ScoringModelKey) : 'raw_score';
  const policy: MissingPolicy = (MISSING_POLICIES as readonly string[]).includes(options.missing_policy as string)
    ? (options.missing_policy as MissingPolicy) : 'skip';
  const neutral = num(options.neutral_value, 0);
  const bonus = num(options.bonus, 0);
  const penalty = num(options.penalty, 0);
  const list = Array.isArray(items) ? items : [];

  let raw = 0, maximum = 0, answered = 0, missing = 0, optionalExcluded = 0;
  const mandatoryMissing: string[] = [];
  const groups: Record<string, { raw: number; value: number; maximum: number; answered: number; count: number }> = {};

  for (let i = 0; i < list.length; i++) {
    const it = list[i] || ({} as ScoreItem);
    const ref = it.ref || `item_${i + 1}`;
    const weight = num(it.weight, 1);
    const itemMax = num(it.max, 1);
    const itemMin = num(it.min, 0);
    const isMissing = it.value === null || it.value === undefined;

    if (isMissing) {
      missing += 1;
      if (it.mandatory) mandatoryMissing.push(ref);
      if (policy === 'skip') continue;         // excluded from raw AND maximum
    } else {
      answered += 1;
    }

    if (it.optional) { optionalExcluded += 1; continue; } // never in the denominator

    let base: number;
    if (isMissing) base = policy === 'zero' ? 0 : neutral; // 'neutral' imputes a neutral value
    else base = num(it.value, 0);

    // reverse polarity: (max + min) − value
    if (it.reverse || model === 'reverse_scoring') base = (itemMax + itemMin) - base;

    // bonus / penalty (negative marking) on objective items
    if (it.correct === true) base += bonus;
    else if (it.correct === false && !isMissing) base -= penalty;

    const contrib = (model === 'raw_score' || model === 'reverse_scoring') ? base : base * weight;
    const maxContrib = (model === 'raw_score' || model === 'reverse_scoring') ? itemMax : itemMax * weight;

    raw += contrib;
    maximum += maxContrib;

    const g = it.group || 'overall';
    groups[g] = groups[g] || { raw: 0, value: 0, maximum: 0, answered: 0, count: 0 };
    groups[g].raw += contrib;
    groups[g].maximum += maxContrib;
    groups[g].answered += isMissing ? 0 : 1;
    groups[g].count += 1;
  }

  const pct = maximum > 0 ? (raw / maximum) * 100 : null;
  const value = model === 'percentage' ? (pct ?? 0) : raw;

  const groupResults: ScoreGroupResult[] = Object.entries(groups).map(([group, g]) => ({
    group,
    raw: g.raw,
    value: g.maximum > 0 ? (g.raw / g.maximum) * 100 : g.raw,
    maximum: g.maximum,
    answered: g.answered,
    count: g.count,
  }));

  return {
    model, raw, value, maximum, percentage: pct,
    answered, missing, optional_excluded: optionalExcluded,
    mandatory_missing: mandatoryMissing, groups: groupResults,
    note: 'PURE deterministic score computation (no eval, no DB). Measurable score/indicator only — ' +
      'item analysis / reliability / validity / norms / standardization / AI-interpretation are Phase 3.6.',
  };
}

export interface ValidationResult { valid: boolean; errors: string[] }

const FORMULA_KINDS = ['weighted_sum', 'composite', 'percentage', 'reverse'] as const;
const ALLOWED_OPS = ['sum', 'weighted_sum', 'mean', 'min', 'max', 'composite', 'percentage', 'reverse'] as const;
const VAR_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * PURE formula validation. A formula is a STRUCTURED object (kind + terms), NEVER a code string.
 * This guarantees there is no eval / new Function surface. Unknown kinds/ops/vars are rejected.
 */
export function validateFormula(def: unknown): ValidationResult {
  const errors: string[] = [];
  const f = (def && typeof def === 'object') ? def as Record<string, unknown> : null;
  if (!f) return { valid: false, errors: ['formula must be a structured object (not a string/code)'] };
  if (typeof f.kind !== 'string' || !(FORMULA_KINDS as readonly string[]).includes(f.kind)) {
    errors.push(`kind must be one of ${FORMULA_KINDS.join('|')}`);
  }
  if (typeof (f as { expression?: unknown }).expression === 'string') {
    errors.push('string expressions are not allowed (no eval) — use structured terms');
  }
  const op = (f as { op?: unknown }).op;
  if (op !== undefined && (typeof op !== 'string' || !(ALLOWED_OPS as readonly string[]).includes(op))) {
    errors.push(`op must be one of ${ALLOWED_OPS.join('|')}`);
  }
  const terms = (f as { terms?: unknown }).terms;
  if (terms !== undefined) {
    if (!Array.isArray(terms)) errors.push('terms must be an array');
    else terms.forEach((t, i) => {
      const term = (t && typeof t === 'object') ? t as Record<string, unknown> : null;
      if (!term) { errors.push(`terms[${i}] must be an object`); return; }
      if (typeof term.var !== 'string' || !VAR_RE.test(term.var)) errors.push(`terms[${i}].var must be a simple identifier`);
      if (term.weight !== undefined && !Number.isFinite(Number(term.weight))) errors.push(`terms[${i}].weight must be numeric`);
    });
  }
  return { valid: errors.length === 0, errors };
}

const RULE_TYPES = [
  'positive_weight', 'negative_weight', 'partial_credit', 'bonus_marks', 'penalty_marks',
  'mandatory_question', 'section_rules', 'assessment_rules',
] as const;
const RULE_SCOPES = ['question', 'section', 'assessment'] as const;

/** PURE rule validation. */
export function validateRule(rule: unknown): ValidationResult {
  const errors: string[] = [];
  const r = (rule && typeof rule === 'object') ? rule as Record<string, unknown> : null;
  if (!r) return { valid: false, errors: ['rule must be an object'] };
  if (typeof r.rule_type !== 'string' || !(RULE_TYPES as readonly string[]).includes(r.rule_type)) {
    errors.push(`rule_type must be one of ${RULE_TYPES.join('|')}`);
  }
  if (r.scope !== undefined && (typeof r.scope !== 'string' || !(RULE_SCOPES as readonly string[]).includes(r.scope))) {
    errors.push(`scope must be one of ${RULE_SCOPES.join('|')}`);
  }
  const def = (r.definition && typeof r.definition === 'object') ? r.definition as Record<string, unknown> : {};
  if ((r.rule_type === 'positive_weight' || r.rule_type === 'negative_weight' || r.rule_type === 'partial_credit'
    || r.rule_type === 'bonus_marks' || r.rule_type === 'penalty_marks') && def.value !== undefined
    && !Number.isFinite(Number(def.value))) {
    errors.push('definition.value must be numeric for weight/credit/bonus/penalty rules');
  }
  return { valid: errors.length === 0, errors };
}

/** PURE scoring-configuration validation. */
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];
  const c = (config && typeof config === 'object') ? config as Record<string, unknown> : null;
  if (!c) return { valid: false, errors: ['config must be an object'] };
  if (c.scoring_model !== undefined
    && (typeof c.scoring_model !== 'string' || !(SCORING_MODEL_KEYS as readonly string[]).includes(c.scoring_model))) {
    errors.push(`scoring_model must be one of ${SCORING_MODEL_KEYS.join('|')}`);
  }
  if (c.version !== undefined && (!Number.isInteger(Number(c.version)) || Number(c.version) < 1)) {
    errors.push('version must be a positive integer');
  }
  if (c.formula !== undefined) {
    const fv = validateFormula(c.formula);
    if (!fv.valid) errors.push(...fv.errors.map((e) => `formula: ${e}`));
  }
  const thresholds = (c as { thresholds?: unknown }).thresholds;
  if (thresholds !== undefined && !Array.isArray(thresholds) && typeof thresholds !== 'object') {
    errors.push('thresholds must be an array or object');
  }
  return { valid: errors.length === 0, errors };
}

/** PURE response validation (type/range/option + missing/mandatory) before scoring. */
export function validateResponses(items: unknown): ValidationResult & { answered: number; missing: number; mandatory_missing: string[] } {
  const errors: string[] = [];
  const mandatoryMissing: string[] = [];
  let answered = 0, missing = 0;
  const list = Array.isArray(items) ? items : null;
  if (!list) return { valid: false, errors: ['responses must be an array'], answered: 0, missing: 0, mandatory_missing: [] };
  list.forEach((raw, i) => {
    const it = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : null;
    if (!it) { errors.push(`responses[${i}] must be an object`); return; }
    const ref = typeof it.ref === 'string' ? it.ref : `item_${i + 1}`;
    const isMissing = it.value === null || it.value === undefined;
    if (isMissing) {
      missing += 1;
      if (it.mandatory === true) mandatoryMissing.push(ref);
    } else {
      answered += 1;
      if (typeof it.value !== 'number' && typeof it.value !== 'string' && typeof it.value !== 'boolean') {
        errors.push(`responses[${i}].value must be a scalar (number/string/boolean)`);
      }
      if (typeof it.value === 'number' && it.max !== undefined && Number(it.value) > Number(it.max)) {
        errors.push(`responses[${i}].value exceeds max`);
      }
    }
  });
  if (mandatoryMissing.length > 0) errors.push(`mandatory unanswered: ${mandatoryMissing.join(', ')}`);
  return { valid: errors.length === 0, errors, answered, missing, mandatory_missing: mandatoryMissing };
}

// ═════════════════════════════════════════════════════════════════════════════
// OVERLAY WRITES (flag-gated; the ONLY DDL sites) + reads
// ═════════════════════════════════════════════════════════════════════════════

export interface ConfigInput {
  config_key: string; version?: number; assessment_slug?: string; scoring_model?: string;
  config?: unknown; status?: string; owner?: string;
}
export async function upsertConfig(pool: Pool, input: ConfigInput): Promise<unknown> {
  assertEnabled();
  await ensureAsSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO as_score_configs (config_key, version, assessment_slug, scoring_model, config, status, owner)
     VALUES ($1,COALESCE($2,1),$3,COALESCE($4,'raw_score'),COALESCE($5,'{}')::jsonb,COALESCE($6,'draft'),$7)
     ON CONFLICT (config_key, version) DO UPDATE SET
       assessment_slug=EXCLUDED.assessment_slug, scoring_model=EXCLUDED.scoring_model,
       config=EXCLUDED.config, status=EXCLUDED.status, owner=EXCLUDED.owner, updated_at=now()
     RETURNING *`,
    [input.config_key, input.version ?? null, input.assessment_slug ?? null, input.scoring_model ?? null,
      input.config ? JSON.stringify(input.config) : null, input.status ?? null, input.owner ?? null],
  );
  return rows[0];
}
export async function listConfigs(pool: Pool): Promise<unknown[]> {
  assertEnabled();
  return safeRows(pool, `SELECT * FROM as_score_configs ORDER BY updated_at DESC LIMIT 500`);
}
export async function getConfig(pool: Pool, configKey: string): Promise<unknown> {
  assertEnabled();
  return safeRow(pool, `SELECT * FROM as_score_configs WHERE config_key=$1 ORDER BY version DESC LIMIT 1`, [configKey]);
}

export interface FormulaInput { formula_key: string; version?: number; kind?: string; definition?: unknown; status?: string; owner?: string }
export async function upsertFormula(pool: Pool, input: FormulaInput): Promise<unknown> {
  assertEnabled();
  await ensureAsSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO as_formulas (formula_key, version, kind, definition, status, owner)
     VALUES ($1,COALESCE($2,1),COALESCE($3,'weighted_sum'),COALESCE($4,'{}')::jsonb,COALESCE($5,'draft'),$6)
     ON CONFLICT (formula_key, version) DO UPDATE SET
       kind=EXCLUDED.kind, definition=EXCLUDED.definition, status=EXCLUDED.status, owner=EXCLUDED.owner, updated_at=now()
     RETURNING *`,
    [input.formula_key, input.version ?? null, input.kind ?? null,
      input.definition ? JSON.stringify(input.definition) : null, input.status ?? null, input.owner ?? null],
  );
  return rows[0];
}
export async function listFormulas(pool: Pool): Promise<unknown[]> {
  assertEnabled();
  return safeRows(pool, `SELECT * FROM as_formulas ORDER BY updated_at DESC LIMIT 500`);
}

export interface RuleInput { rule_key: string; rule_type?: string; scope?: string; definition?: unknown; status?: string }
export async function upsertRule(pool: Pool, input: RuleInput): Promise<unknown> {
  assertEnabled();
  await ensureAsSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO as_rules (rule_key, rule_type, scope, definition, status)
     VALUES ($1,COALESCE($2,'positive_weight'),COALESCE($3,'question'),COALESCE($4,'{}')::jsonb,COALESCE($5,'active'))
     ON CONFLICT (rule_key) DO UPDATE SET
       rule_type=EXCLUDED.rule_type, scope=EXCLUDED.scope, definition=EXCLUDED.definition,
       status=EXCLUDED.status, updated_at=now()
     RETURNING *`,
    [input.rule_key, input.rule_type ?? null, input.scope ?? null,
      input.definition ? JSON.stringify(input.definition) : null, input.status ?? null],
  );
  return rows[0];
}
export async function listRules(pool: Pool): Promise<unknown[]> {
  assertEnabled();
  return safeRows(pool, `SELECT * FROM as_rules ORDER BY updated_at DESC LIMIT 500`);
}

export interface ScoreRecordInput {
  score_key: string; assessment_slug?: string; subject_ref?: string; scoring_model?: string;
  raw?: number; value?: number; maximum?: number; breakdown?: unknown; status?: string;
}
export async function saveScore(pool: Pool, input: ScoreRecordInput): Promise<unknown> {
  assertEnabled();
  await ensureAsSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO as_scores (score_key, assessment_slug, subject_ref, scoring_model, raw, value, maximum, breakdown, status)
     VALUES ($1,$2,$3,COALESCE($4,'raw_score'),$5,$6,$7,COALESCE($8,'{}')::jsonb,COALESCE($9,'computed'))
     ON CONFLICT (score_key, scoring_model) DO UPDATE SET
       assessment_slug=EXCLUDED.assessment_slug, subject_ref=EXCLUDED.subject_ref, raw=EXCLUDED.raw,
       value=EXCLUDED.value, maximum=EXCLUDED.maximum, breakdown=EXCLUDED.breakdown,
       status=EXCLUDED.status, updated_at=now()
     RETURNING *`,
    [input.score_key, input.assessment_slug ?? null, input.subject_ref ?? null, input.scoring_model ?? null,
      input.raw ?? null, input.value ?? null, input.maximum ?? null,
      input.breakdown ? JSON.stringify(input.breakdown) : null, input.status ?? null],
  );
  return rows[0];
}
export async function listScores(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM as_scores WHERE subject_ref=$1 ORDER BY updated_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM as_scores ORDER BY updated_at DESC LIMIT 500`);
}

export interface MeasurementInput {
  measure_key: string; subject_ref?: string; measure_type?: string; indicator?: string;
  value?: number; scale_max?: number; detail?: unknown;
}
export async function saveMeasurement(pool: Pool, input: MeasurementInput): Promise<unknown> {
  assertEnabled();
  await ensureAsSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO as_measurements (measure_key, subject_ref, measure_type, indicator, value, scale_max, detail)
     VALUES ($1,$2,COALESCE($3,'competency'),$4,$5,$6,COALESCE($7,'{}')::jsonb)
     ON CONFLICT (measure_key, measure_type, indicator) DO UPDATE SET
       subject_ref=EXCLUDED.subject_ref, value=EXCLUDED.value, scale_max=EXCLUDED.scale_max, detail=EXCLUDED.detail
     RETURNING *`,
    [input.measure_key, input.subject_ref ?? null, input.measure_type ?? null, input.indicator ?? null,
      input.value ?? null, input.scale_max ?? null, input.detail ? JSON.stringify(input.detail) : null],
  );
  return rows[0];
}
export async function listMeasurements(pool: Pool, subjectRef?: string): Promise<unknown[]> {
  assertEnabled();
  return subjectRef
    ? safeRows(pool, `SELECT * FROM as_measurements WHERE subject_ref=$1 ORDER BY created_at DESC LIMIT 500`, [subjectRef])
    : safeRows(pool, `SELECT * FROM as_measurements ORDER BY created_at DESC LIMIT 500`);
}

export async function recordValidation(pool: Pool, target: string, targetRef: string | null, result: ValidationResult): Promise<unknown> {
  assertEnabled();
  await ensureAsSchema(pool);
  const { rows } = await pool.query(
    `INSERT INTO as_validations (target, target_ref, valid, errors)
     VALUES ($1,$2,$3,$4::jsonb) RETURNING *`,
    [target, targetRef, result.valid, JSON.stringify(result.errors ?? [])],
  );
  return rows[0];
}
export async function listValidations(pool: Pool): Promise<unknown[]> {
  assertEnabled();
  return safeRows(pool, `SELECT * FROM as_validations ORDER BY created_at DESC LIMIT 500`);
}

// ═════════════════════════════════════════════════════════════════════════════
// COVERAGE — read-only adoption counts (null-safe; SEPARATE axis, never a gap)
// ═════════════════════════════════════════════════════════════════════════════
export async function configCoverage(pool: Pool): Promise<{ configs: number | null; active: number | null; formulas: number | null; rules: number | null }> {
  return {
    configs: await count(pool, `SELECT COUNT(*)::int FROM as_score_configs`),
    active: await count(pool, `SELECT COUNT(*)::int FROM as_score_configs WHERE status IN ('active','published')`),
    formulas: await count(pool, `SELECT COUNT(*)::int FROM as_formulas`),
    rules: await count(pool, `SELECT COUNT(*)::int FROM as_rules`),
  };
}
export async function scoreCoverage(pool: Pool): Promise<{ scores: number | null; subjects: number | null; models_used: number | null }> {
  return {
    scores: await count(pool, `SELECT COUNT(*)::int FROM as_scores`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM as_scores`),
    models_used: await count(pool, `SELECT COUNT(DISTINCT scoring_model)::int FROM as_scores`),
  };
}
export async function measurementCoverage(pool: Pool): Promise<{ measurements: number | null; subjects: number | null; types_used: number | null }> {
  return {
    measurements: await count(pool, `SELECT COUNT(*)::int FROM as_measurements`),
    subjects: await count(pool, `SELECT COUNT(DISTINCT subject_ref)::int FROM as_measurements`),
    types_used: await count(pool, `SELECT COUNT(DISTINCT measure_type)::int FROM as_measurements`),
  };
}
export async function validationCoverage(pool: Pool): Promise<{ validations: number | null; passed: number | null; failed: number | null }> {
  return {
    validations: await count(pool, `SELECT COUNT(*)::int FROM as_validations`),
    passed: await count(pool, `SELECT COUNT(*)::int FROM as_validations WHERE valid=true`),
    failed: await count(pool, `SELECT COUNT(*)::int FROM as_validations WHERE valid=false`),
  };
}
