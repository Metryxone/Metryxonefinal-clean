/**
 * Phase 2.2 — Question Blueprint Engine.
 *
 *   Competency → Question Pool
 *   Question   → Competency
 *   Question   → Micro Competency
 *   Question   → Difficulty Level
 *   Question   → Question Type
 *
 * Maps the user-facing deliverables onto the existing competency framework:
 *
 *   - `question_difficulty_framework` → onto_question_difficulty_framework
 *        (canonical difficulty ladder + the supported question-type vocabulary)
 *   - `question_competency_mapping`   → onto_question_competency_mapping
 *        (each bank question linked to a competency + micro competency, carrying a
 *         validated difficulty level and question type)
 *   - `question_blueprints`           → onto_question_blueprints
 *        (per-competency target pool composition + HONEST actual coverage)
 *
 * Grounding: the competency question bank is `competency_question_templates`
 * (uuid id; already carries `question_type` + `difficulty_band`). The canonical
 * bare Question↔Competency edge already lives in `onto_competency_question_map`;
 * mapQuestion KEEPS it in sync. Micro competencies live in
 * `onto_competency_hierarchy`.
 *
 * Honesty: the bank is currently EMPTY, so pools/mappings are legitimately empty
 * until real questions exist — surfaced as coverage gaps, NEVER fabricated. Only
 * the difficulty framework (reference/config) is seeded.
 *
 * Strictly additive · never throws · reuses existing tables. Schema ensure is
 * lazy and only reachable behind the flag-gated routes, so flag-OFF = no DDL.
 */

import type { Pool } from 'pg';

export const QUESTION_BLUEPRINT_VERSION = 'phase-2.2';

// ---------------------------------------------------------------------------
// Supported question types (the 7 requested) + alias normalization
// ---------------------------------------------------------------------------
export interface QuestionTypeDef { key: string; label: string; aliases: string[]; }

export const QUESTION_TYPES: QuestionTypeDef[] = [
  { key: 'likert',               label: 'Likert',               aliases: ['likert_5', 'likert5', 'likert_scale', 'rating'] },
  { key: 'situational_judgment', label: 'Situational Judgment', aliases: ['sjt', 'situational', 'situational_judgement'] },
  { key: 'behavioral',           label: 'Behavioral',           aliases: ['behavioural', 'behavior', 'behaviour'] },
  { key: 'case_study',           label: 'Case Study',           aliases: ['case', 'casestudy', 'case_based'] },
  { key: 'scenario_based',       label: 'Scenario Based',       aliases: ['scenario', 'scenario_based_question', 'scenario_question'] },
  { key: 'multiple_choice',      label: 'Multiple Choice',      aliases: ['mcq', 'multiple_choice_question', 'single_select', 'single_choice'] },
  { key: 'forced_choice',        label: 'Forced Choice',        aliases: ['ipsative', 'forced', 'paired_comparison'] },
];

export const QUESTION_TYPE_KEYS = QUESTION_TYPES.map((t) => t.key);

const TYPE_LOOKUP: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const t of QUESTION_TYPES) {
    m[t.key] = t.key;
    for (const a of t.aliases) m[a] = t.key;
  }
  return m;
})();

/** Normalize a free-text type to a supported key, or null if unrecognized. */
export function normalizeQuestionType(raw: unknown): string | null {
  if (raw == null) return null;
  const k = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
  return TYPE_LOOKUP[k] ?? null;
}

export function validateQuestionType(raw: unknown): { valid: boolean; key: string | null } {
  const key = normalizeQuestionType(raw);
  return { valid: key !== null, key };
}

// ---------------------------------------------------------------------------
// Difficulty framework (reference ladder — seeded, not fabricated content)
// ---------------------------------------------------------------------------
interface DifficultySeed { level_key: string; label: string; ordinal: number; description: string; irt_b_min: number; irt_b_max: number; }

export const DIFFICULTY_SEED: DifficultySeed[] = [
  { level_key: 'foundational', label: 'Foundational', ordinal: 1, description: 'Recall / recognition of basic concepts.',          irt_b_min: -3.0, irt_b_max: -1.5 },
  { level_key: 'easy',         label: 'Easy',         ordinal: 2, description: 'Straightforward application in a familiar context.', irt_b_min: -1.5, irt_b_max: -0.5 },
  { level_key: 'medium',       label: 'Medium',       ordinal: 3, description: 'Application requiring some analysis.',               irt_b_min: -0.5, irt_b_max:  0.5 },
  { level_key: 'hard',         label: 'Hard',         ordinal: 4, description: 'Multi-step analysis or evaluation.',                 irt_b_min:  0.5, irt_b_max:  1.5 },
  { level_key: 'expert',       label: 'Expert',       ordinal: 5, description: 'Synthesis in novel or ambiguous situations.',        irt_b_min:  1.5, irt_b_max:  3.0 },
];

// ---------------------------------------------------------------------------
// Lazy schema (mirrors migrations/20260619_question_blueprint_engine.sql)
// ---------------------------------------------------------------------------
let schemaReady: Promise<void> | null = null;

export function ensureQuestionBlueprintSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_question_difficulty_framework (
          level_key    VARCHAR(40)  PRIMARY KEY,
          label        VARCHAR(80)  NOT NULL,
          ordinal      INTEGER      NOT NULL UNIQUE,
          description  TEXT         NOT NULL DEFAULT '',
          irt_b_min    NUMERIC(6,3),
          irt_b_max    NUMERIC(6,3),
          active       BOOLEAN      NOT NULL DEFAULT true,
          source       VARCHAR(30)  NOT NULL DEFAULT 'seed',
          created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_question_competency_mapping (
          id                  SERIAL PRIMARY KEY,
          question_id         UUID         NOT NULL REFERENCES competency_question_templates(id) ON DELETE CASCADE,
          competency_id       VARCHAR(80)  NOT NULL REFERENCES onto_competencies(id) ON DELETE CASCADE,
          micro_competency_id INTEGER      REFERENCES onto_competency_hierarchy(id) ON DELETE SET NULL,
          difficulty_level    VARCHAR(40)  NOT NULL DEFAULT 'medium',
          question_type       VARCHAR(40)  NOT NULL,
          source              VARCHAR(30)  NOT NULL DEFAULT 'derived',
          active              BOOLEAN      NOT NULL DEFAULT true,
          created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT uq_qcm_question_competency UNIQUE (question_id, competency_id)
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_qcm_competency ON onto_question_competency_mapping (competency_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_qcm_question   ON onto_question_competency_mapping (question_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_qcm_micro      ON onto_question_competency_mapping (micro_competency_id);`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_question_blueprints (
          competency_id           VARCHAR(80) PRIMARY KEY REFERENCES onto_competencies(id) ON DELETE CASCADE,
          pool_target             INTEGER     NOT NULL DEFAULT 0,
          difficulty_distribution JSONB       NOT NULL DEFAULT '{}'::jsonb,
          type_distribution       JSONB       NOT NULL DEFAULT '{}'::jsonb,
          coverage                JSONB       NOT NULL DEFAULT '{}'::jsonb,
          source                  VARCHAR(30) NOT NULL DEFAULT 'derived',
          created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT chk_qb_pool_target CHECK (pool_target >= 0)
        );
      `);
      // Seed the reference difficulty ladder idempotently (config, not content).
      for (const d of DIFFICULTY_SEED) {
        await pool.query(
          `INSERT INTO onto_question_difficulty_framework (level_key, label, ordinal, description, irt_b_min, irt_b_max)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (level_key) DO NOTHING`,
          [d.level_key, d.label, d.ordinal, d.description, d.irt_b_min, d.irt_b_max],
        );
      }
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface BankQuestion { id: string; competency_code: string; question_type: string; difficulty_band: string; status: string; }

async function getBankQuestion(pool: Pool, questionId: string): Promise<BankQuestion | null> {
  const { rows } = await pool.query(
    `SELECT id, competency_code, question_type, difficulty_band, status
       FROM competency_question_templates WHERE id = $1`,
    [questionId],
  );
  return rows.length ? (rows[0] as BankQuestion) : null;
}

function competencyExists(pool: Pool, competencyId: string): Promise<boolean> {
  return pool.query(`SELECT 1 FROM onto_competencies WHERE id = $1`, [competencyId]).then((r) => r.rowCount! > 0);
}

async function difficultyKeys(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query(`SELECT level_key FROM onto_question_difficulty_framework WHERE active = true`);
  const set = new Set<string>(rows.map((r) => String(r.level_key)));
  // Seed values are always valid even before the DB read returns rows.
  for (const d of DIFFICULTY_SEED) set.add(d.level_key);
  return set;
}

/** A micro competency must belong to (be a child of) the competency it is mapped under. */
async function microBelongsTo(pool: Pool, microId: number, competencyId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM onto_competency_hierarchy WHERE id = $1 AND parent_competency_id = $2`,
    [microId, competencyId],
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Difficulty framework + supported types (read)
// ---------------------------------------------------------------------------
export async function getDifficultyFramework(pool: Pool): Promise<{
  difficulty_levels: Array<{ level_key: string; label: string; ordinal: number; description: string }>;
  question_types: Array<{ key: string; label: string }>;
}> {
  await ensureQuestionBlueprintSchema(pool);
  const { rows } = await pool.query(
    `SELECT level_key, label, ordinal, description FROM onto_question_difficulty_framework
      WHERE active = true ORDER BY ordinal`,
  );
  return {
    difficulty_levels: rows.map((r) => ({ level_key: String(r.level_key), label: String(r.label), ordinal: Number(r.ordinal), description: String(r.description) })),
    question_types: QUESTION_TYPES.map((t) => ({ key: t.key, label: t.label })),
  };
}

// ---------------------------------------------------------------------------
// question_competency_mapping — Question → {Competency, Micro, Difficulty, Type}
// ---------------------------------------------------------------------------
export interface QuestionMappingInput {
  questionId: string;
  competencyId: string;
  microCompetencyId?: number | null;
  difficultyLevel?: string | null;
  questionType?: string | null;
  source?: string;
}

export type MapResult =
  | { ok: true; mapping: Record<string, unknown> }
  | { ok: false; error: 'question_not_found' | 'competency_not_found' | 'micro_competency_mismatch' | 'invalid_difficulty' | 'invalid_question_type'; detail?: string };

export async function mapQuestion(pool: Pool, input: QuestionMappingInput): Promise<MapResult> {
  await ensureQuestionBlueprintSchema(pool);

  const bank = await getBankQuestion(pool, input.questionId);
  if (!bank) return { ok: false, error: 'question_not_found' };
  if (!(await competencyExists(pool, input.competencyId))) return { ok: false, error: 'competency_not_found' };

  // Difficulty: caller value wins, else inherit the bank's difficulty_band, else 'medium'.
  const rawDifficulty = input.difficultyLevel ?? bank.difficulty_band ?? 'medium';
  const difficulty = String(rawDifficulty).trim().toLowerCase();
  const validDiffs = await difficultyKeys(pool);
  if (!validDiffs.has(difficulty)) {
    return { ok: false, error: 'invalid_difficulty', detail: `'${rawDifficulty}' not in difficulty framework (${[...validDiffs].join(', ')})` };
  }

  // Type: caller value wins, else inherit the bank's question_type.
  const typeCheck = validateQuestionType(input.questionType ?? bank.question_type);
  if (!typeCheck.valid) {
    return { ok: false, error: 'invalid_question_type', detail: `'${input.questionType ?? bank.question_type}' not in supported types (${QUESTION_TYPE_KEYS.join(', ')})` };
  }

  // Micro competency (optional) must be a child of this competency.
  let microId: number | null = null;
  if (input.microCompetencyId != null) {
    microId = Number(input.microCompetencyId);
    if (!Number.isFinite(microId) || !(await microBelongsTo(pool, microId, input.competencyId))) {
      return { ok: false, error: 'micro_competency_mismatch', detail: `micro competency ${input.microCompetencyId} is not a child of ${input.competencyId}` };
    }
  }

  const source = input.source && String(input.source).length <= 30 ? String(input.source) : 'derived';

  const { rows } = await pool.query(
    `INSERT INTO onto_question_competency_mapping
       (question_id, competency_id, micro_competency_id, difficulty_level, question_type, source)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (question_id, competency_id) DO UPDATE SET
       micro_competency_id = EXCLUDED.micro_competency_id,
       difficulty_level    = EXCLUDED.difficulty_level,
       question_type       = EXCLUDED.question_type,
       source              = EXCLUDED.source,
       active              = true,
       updated_at          = now()
     RETURNING *`,
    [input.questionId, input.competencyId, microId, difficulty, typeCheck.key, source],
  );

  // Keep the canonical bare Question↔Competency edge in sync.
  await pool.query(
    `INSERT INTO onto_competency_question_map (competency_id, question_id, source, active)
     VALUES ($1,$2,$3,true)
     ON CONFLICT (competency_id, question_id) DO UPDATE SET active = true, updated_at = now()`,
    [input.competencyId, input.questionId, source],
  );

  return { ok: true, mapping: rows[0] };
}

export async function getQuestionMapping(pool: Pool, questionId: string): Promise<{
  question_found: boolean; question_id: string; mappings: Record<string, unknown>[];
}> {
  await ensureQuestionBlueprintSchema(pool);
  const bank = await getBankQuestion(pool, questionId);
  if (!bank) return { question_found: false, question_id: questionId, mappings: [] };
  const { rows } = await pool.query(
    `SELECT m.*, h.micro_label
       FROM onto_question_competency_mapping m
       LEFT JOIN onto_competency_hierarchy h ON h.id = m.micro_competency_id
      WHERE m.question_id = $1 ORDER BY m.competency_id`,
    [questionId],
  );
  return { question_found: true, question_id: questionId, mappings: rows };
}

// ---------------------------------------------------------------------------
// Competency → Question Pool
// ---------------------------------------------------------------------------
export interface QuestionPool {
  competency_found: boolean;
  competency_id: string;
  pool_size: number;
  by_difficulty: Record<string, number>;
  by_type: Record<string, number>;
  by_micro: Record<string, number>;
  questions: Array<{ question_id: string; difficulty_level: string; question_type: string; micro_competency_id: number | null; micro_label: string | null }>;
  coverage: { notes: string[] };
}

export async function getQuestionPool(pool: Pool, competencyId: string): Promise<QuestionPool> {
  await ensureQuestionBlueprintSchema(pool);
  const empty: QuestionPool = {
    competency_found: false, competency_id: competencyId, pool_size: 0,
    by_difficulty: {}, by_type: {}, by_micro: {}, questions: [], coverage: { notes: [] },
  };
  if (!(await competencyExists(pool, competencyId))) return empty;

  const { rows } = await pool.query(
    `SELECT m.question_id, m.difficulty_level, m.question_type, m.micro_competency_id, h.micro_label
       FROM onto_question_competency_mapping m
       LEFT JOIN onto_competency_hierarchy h ON h.id = m.micro_competency_id
      WHERE m.competency_id = $1 AND m.active = true
      ORDER BY m.difficulty_level, m.question_type`,
    [competencyId],
  );

  const byDifficulty: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byMicro: Record<string, number> = {};
  const questions = rows.map((r) => {
    const d = String(r.difficulty_level); const t = String(r.question_type);
    byDifficulty[d] = (byDifficulty[d] || 0) + 1;
    byType[t] = (byType[t] || 0) + 1;
    const label = r.micro_label ? String(r.micro_label) : '(unassigned)';
    byMicro[label] = (byMicro[label] || 0) + 1;
    return {
      question_id: String(r.question_id), difficulty_level: d, question_type: t,
      micro_competency_id: r.micro_competency_id != null ? Number(r.micro_competency_id) : null,
      micro_label: r.micro_label ? String(r.micro_label) : null,
    };
  });

  const notes: string[] = [];
  if (questions.length === 0) {
    notes.push('No questions are mapped to this competency yet — the pool is empty (honest gap, not fabricated). Add bank questions and map them.');
  }
  if (byMicro['(unassigned)']) notes.push(`${byMicro['(unassigned)']} question(s) have no micro competency assigned.`);

  return {
    competency_found: true, competency_id: competencyId, pool_size: questions.length,
    by_difficulty: byDifficulty, by_type: byType, by_micro: byMicro, questions, coverage: { notes },
  };
}

// ---------------------------------------------------------------------------
// question_blueprints — Competency → Question Pool target + coverage
// ---------------------------------------------------------------------------
export interface BlueprintValidation { valid: boolean; errors: string[]; warnings: string[] }

function validateDistribution(
  dist: Record<string, unknown>, validKeys: Set<string>, label: string, errors: string[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(dist || {})) {
    if (!validKeys.has(k)) { errors.push(`${label} references unknown key '${k}'`); continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) { errors.push(`${label}['${k}'] (${v}) must be a number ≥ 0`); continue; }
    out[k] = n;
  }
  return out;
}

export function validateQuestionBlueprint(
  input: { pool_target?: unknown; difficulty_distribution?: Record<string, unknown>; type_distribution?: Record<string, unknown> },
  difficultyKeySet: Set<string>,
): { validation: BlueprintValidation; pool_target: number; difficulty_distribution: Record<string, number>; type_distribution: Record<string, number> } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const poolTarget = input.pool_target != null ? Number(input.pool_target) : 0;
  if (!Number.isFinite(poolTarget) || poolTarget < 0) errors.push(`pool_target (${input.pool_target}) must be a number ≥ 0`);

  const diff = validateDistribution(input.difficulty_distribution ?? {}, difficultyKeySet, 'difficulty_distribution', errors);
  const type = validateDistribution(input.type_distribution ?? {}, new Set(QUESTION_TYPE_KEYS), 'type_distribution', errors);

  const diffSum = Object.values(diff).reduce((s, n) => s + n, 0);
  const typeSum = Object.values(type).reduce((s, n) => s + n, 0);
  if (Number.isFinite(poolTarget) && poolTarget > 0) {
    if (Object.keys(diff).length && diffSum !== poolTarget) warnings.push(`difficulty_distribution sums to ${diffSum}, not pool_target ${poolTarget}`);
    if (Object.keys(type).length && typeSum !== poolTarget) warnings.push(`type_distribution sums to ${typeSum}, not pool_target ${poolTarget}`);
  }
  if (poolTarget === 0) warnings.push('pool_target is 0 — no questions targeted for this competency yet.');

  return {
    validation: { valid: errors.length === 0, errors, warnings },
    pool_target: Number.isFinite(poolTarget) ? poolTarget : 0,
    difficulty_distribution: diff,
    type_distribution: type,
  };
}

export type BuildBlueprintResult =
  | { ok: true; competency_id: string; source: string; pool_target: number; difficulty_distribution: Record<string, number>; type_distribution: Record<string, number>; coverage: Record<string, unknown>; validation: BlueprintValidation }
  | { ok: false; error: 'competency_not_found' | 'invalid_blueprint'; validation?: BlueprintValidation };

/**
 * buildQuestionBlueprint:
 *  - explicit distributions / pool_target supplied → AUTHOR a target (validated).
 *  - otherwise → DERIVE the target from the ACTUAL pool composition (descriptive,
 *    never invents questions; empty pool → all-zero target + honest note).
 * Coverage always reports actual-vs-target gaps from the real pool.
 */
export async function buildQuestionBlueprint(
  pool: Pool,
  competencyId: string,
  opts?: { poolTarget?: number; difficultyDistribution?: Record<string, unknown>; typeDistribution?: Record<string, unknown>; source?: string },
): Promise<BuildBlueprintResult> {
  await ensureQuestionBlueprintSchema(pool);
  if (!(await competencyExists(pool, competencyId))) return { ok: false, error: 'competency_not_found' };

  const actual = await getQuestionPool(pool, competencyId);
  const diffKeys = await difficultyKeys(pool);

  let source: string;
  let poolTarget: number;
  let diffDist: Record<string, number>;
  let typeDist: Record<string, number>;
  let validation: BlueprintValidation;

  const authoring = !!opts && (opts.poolTarget != null || opts.difficultyDistribution != null || opts.typeDistribution != null);
  if (authoring) {
    const v = validateQuestionBlueprint(
      { pool_target: opts!.poolTarget, difficulty_distribution: opts!.difficultyDistribution, type_distribution: opts!.typeDistribution },
      diffKeys,
    );
    if (!v.validation.valid) return { ok: false, error: 'invalid_blueprint', validation: v.validation };
    source = opts!.source && String(opts!.source).length <= 30 ? String(opts!.source) : 'authored';
    poolTarget = v.pool_target; diffDist = v.difficulty_distribution; typeDist = v.type_distribution; validation = v.validation;
  } else {
    // Derive a descriptive target from the actual pool (honest mirror of reality).
    source = 'derived';
    poolTarget = actual.pool_size;
    diffDist = { ...actual.by_difficulty };
    typeDist = { ...actual.by_type };
    validation = validateQuestionBlueprint(
      { pool_target: poolTarget, difficulty_distribution: diffDist, type_distribution: typeDist },
      diffKeys,
    ).validation;
  }

  // Coverage: actual pool vs target — honest gaps, never fabricated.
  const diffGaps: Record<string, number> = {};
  for (const k of Object.keys(diffDist)) {
    const gap = diffDist[k] - (actual.by_difficulty[k] || 0);
    if (gap > 0) diffGaps[k] = gap;
  }
  const typeGaps: Record<string, number> = {};
  for (const k of Object.keys(typeDist)) {
    const gap = typeDist[k] - (actual.by_type[k] || 0);
    if (gap > 0) typeGaps[k] = gap;
  }
  const notes: string[] = [...actual.coverage.notes];
  const shortfall = poolTarget - actual.pool_size;
  if (shortfall > 0) notes.push(`Pool has ${actual.pool_size} of ${poolTarget} targeted questions — ${shortfall} short.`);

  const coverage = {
    pool_actual: actual.pool_size,
    pool_target: poolTarget,
    actual_by_difficulty: actual.by_difficulty,
    actual_by_type: actual.by_type,
    difficulty_gaps: diffGaps,
    type_gaps: typeGaps,
    notes,
  };

  await pool.query(
    `INSERT INTO onto_question_blueprints
       (competency_id, pool_target, difficulty_distribution, type_distribution, coverage, source)
     VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6)
     ON CONFLICT (competency_id) DO UPDATE SET
       pool_target = EXCLUDED.pool_target,
       difficulty_distribution = EXCLUDED.difficulty_distribution,
       type_distribution = EXCLUDED.type_distribution,
       coverage = EXCLUDED.coverage,
       source = EXCLUDED.source,
       updated_at = now()`,
    [competencyId, poolTarget, JSON.stringify(diffDist), JSON.stringify(typeDist), JSON.stringify(coverage), source],
  );

  return { ok: true, competency_id: competencyId, source, pool_target: poolTarget, difficulty_distribution: diffDist, type_distribution: typeDist, coverage, validation };
}

export async function getQuestionBlueprint(pool: Pool, competencyId: string): Promise<{
  competency_found: boolean; exists: boolean; competency_id: string;
  pool_target?: number; difficulty_distribution?: Record<string, number>; type_distribution?: Record<string, number>;
  coverage?: Record<string, unknown>; source?: string; updated_at?: string;
}> {
  await ensureQuestionBlueprintSchema(pool);
  if (!(await competencyExists(pool, competencyId))) return { competency_found: false, exists: false, competency_id: competencyId };
  const { rows } = await pool.query(`SELECT * FROM onto_question_blueprints WHERE competency_id = $1`, [competencyId]);
  if (!rows.length) return { competency_found: true, exists: false, competency_id: competencyId };
  const r = rows[0];
  return {
    competency_found: true, exists: true, competency_id: competencyId,
    pool_target: Number(r.pool_target), difficulty_distribution: r.difficulty_distribution,
    type_distribution: r.type_distribution, coverage: r.coverage, source: r.source, updated_at: r.updated_at,
  };
}

/** Pure validator entry point for the /validate route (loads no DB difficulty keys). */
export function validateQuestionBlueprintInput(input: {
  pool_target?: unknown; difficulty_distribution?: Record<string, unknown>; type_distribution?: Record<string, unknown>;
}): ReturnType<typeof validateQuestionBlueprint> {
  return validateQuestionBlueprint(input, new Set(DIFFICULTY_SEED.map((d) => d.level_key)));
}
