/**
 * Phase 2.4 — Competency Scoring Engine
 * ----------------------------------------------------------------------------
 * Operationalizes the scoring chain behind the `competencyRuntime` flag:
 *
 *   Question -> Raw Score -> Competency Score -> Normalized Score -> Level
 *
 * Three deliverables (pure, deterministic, never fabricate):
 *   - competency_scoring_engine    : computeCompetencyScores()  (Raw -> Competency)
 *   - score_normalization_engine   : normalizeScore()           (Competency -> Normalized)
 *   - competency_level_calculator  : calculateCompetencyLevel() (Normalized -> Level)
 *
 * Distinct from Phase 2's domain-proxy `scoreAssessment` (services/competency-runtime.ts):
 *   - Phase 2 aggregates by ontology DOMAIN (5 domains via a code crosswalk) using a
 *     plain mean. This layer scores per COMPETENCY and weights each item by its
 *     difficulty ordinal (foundational=1 .. expert=5) so harder items carry more
 *     of the score. Both layers share the SAME level bands (>=80/60/40/20) so a
 *     normalized score maps to the same 1-5 proficiency ladder.
 *
 * Honesty contract:
 *   - Empty bank / no resolvable responses -> status 'scoring_empty', null scores.
 *     Never invented.
 *   - Normalization is difficulty-weighted percent by default. A cohort-referenced
 *     (T-score) basis is used ONLY when a REAL cohort {mean, sd, n>=K_MIN} is
 *     supplied — never a fabricated distribution.
 *   - null normalized score -> null level ('unmeasurable'), never floored to 1.
 *
 * Additive: flag OFF => routes 503 before any DB touch; ensureScoringSchema runs no
 * DDL. Reuses onto_question_competency_mapping, competency_question_templates,
 * onto_competencies, onto_proficiency_levels, DIFFICULTY_SEED.
 */

import type { Pool } from 'pg';
import { DIFFICULTY_SEED, validateQuestionType } from './question-blueprint.js';

export const COMPETENCY_SCORING_VERSION = 'phase-2.4';

/** k-anonymity floor for cohort-referenced normalization. */
export const COHORT_K_MIN = 30;

/** difficulty level_key -> ordinal weight (foundational=1 .. expert=5). */
const DIFFICULTY_WEIGHT: Record<string, number> = Object.fromEntries(
  DIFFICULTY_SEED.map((d) => [d.level_key, d.ordinal]),
);
/** Unknown / unmapped difficulty contributes the minimum non-zero weight (honest, never 0). */
const DEFAULT_DIFFICULTY_WEIGHT = 1;
function difficultyWeight(level: string | null | undefined): number {
  const w = level ? DIFFICULTY_WEIGHT[level] : undefined;
  return Number.isFinite(w) && (w as number) > 0 ? (w as number) : DEFAULT_DIFFICULTY_WEIGHT;
}

// ---------------------------------------------------------------------------
// Option-score derivation — mirrors Phase 2 deriveOptions (kept self-contained
// so this engine never mutates or imports private Phase 2 internals).
//
// Type classification routes through the shared `validateQuestionType` so the
// CANONICAL keys persisted by Phase 2.2 (likert / multiple_choice /
// situational_judgment / scenario_based / case_study / behavioral /
// forced_choice) AND their legacy aliases (mcq, sjt, scenario, case, …) all
// resolve correctly. Only `likert` (or an unrecognized type) is scored on the
// rating ladder; every other resolvable type is best-answer scored.
// ---------------------------------------------------------------------------
const LIKERT_SCORES = [0, 25, 50, 75, 100];

/**
 * Question -> Raw Score (0..100) for a single response.
 * Resolution priority (first defined wins):
 *   1. explicit numeric raw_score / score (clamped 0..100)
 *   2. correct boolean -> 100 / 0
 *   3. selected_index against authored options (best_option / proximity) or Likert scale
 * Returns null when nothing scoreable is present (response is then NOT counted).
 */
export function deriveRawScore(
  resp: {
    raw_score?: unknown; score?: unknown; correct?: unknown; selected_index?: unknown;
  },
  meta: { question_type?: string | null; options?: unknown; best_option?: unknown },
): number | null {
  const explicit = resp.raw_score ?? resp.score;
  if (explicit != null && Number.isFinite(Number(explicit))) {
    return clamp(Number(explicit), 0, 100);
  }
  if (typeof resp.correct === 'boolean') return resp.correct ? 100 : 0;

  if (resp.selected_index != null && Number.isFinite(Number(resp.selected_index))) {
    const idx = Number(resp.selected_index);
    const canonical = validateQuestionType(meta.question_type ?? '').key; // null when unrecognized
    const opts = Array.isArray(meta.options) ? (meta.options as unknown[]) : [];
    // Likert (rating ladder) when the canonical type is `likert` or unrecognized;
    // every other resolvable type is best-answer scored.
    const isLikert = canonical === null || canonical === 'likert';
    if (isLikert || opts.length === 0) {
      // Map index onto the canonical 5-point Likert ladder (clamped).
      const i = clamp(Math.round(idx), 0, LIKERT_SCORES.length - 1);
      return LIKERT_SCORES[i];
    }
    const best = Number.isFinite(Number(meta.best_option)) ? Number(meta.best_option) : -1;
    if (idx < 0 || idx >= opts.length) return null;
    if (idx === best) return 100;
    if (best >= 0 && Math.abs(idx - best) === 1) return 60;
    return 20;
  }
  return null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// 1. competency_scoring_engine — Raw Score -> Competency Score
// ---------------------------------------------------------------------------
export interface ScoredItem {
  question_id?: string | null;
  competency_id: string;
  competency_name?: string | null;
  difficulty_level: string | null;
  raw_score: number; // 0..100
}

export interface CompetencyScore {
  competency_id: string;
  competency_name: string | null;
  item_count: number;
  raw_mean: number;            // simple mean of per-item raw scores (0..100)
  achieved_points: number;     // Σ(weight · raw)
  max_points: number;          // Σ(weight · 100)
  difficulty_breakdown: Record<string, number>; // level_key -> item count
}

/**
 * Aggregate per-question raw scores into a difficulty-weighted Competency Score.
 * Pure & deterministic. Competencies returned sorted by competency_id asc.
 */
export function computeCompetencyScores(items: ScoredItem[]): CompetencyScore[] {
  const byComp = new Map<string, ScoredItem[]>();
  for (const it of items) {
    if (!it || !it.competency_id) continue;
    const raw = Number(it.raw_score);
    if (!Number.isFinite(raw)) continue;
    const arr = byComp.get(it.competency_id) ?? byComp.set(it.competency_id, []).get(it.competency_id)!;
    arr.push(it);
  }
  const out: CompetencyScore[] = [];
  for (const [competency_id, arr] of byComp) {
    let achieved = 0;
    let maxPoints = 0;
    let rawSum = 0;
    const breakdown: Record<string, number> = {};
    let name: string | null = null;
    for (const it of arr) {
      const w = difficultyWeight(it.difficulty_level);
      const raw = clamp(Number(it.raw_score), 0, 100);
      achieved += w * raw;
      maxPoints += w * 100;
      rawSum += raw;
      const lvl = it.difficulty_level || 'unspecified';
      breakdown[lvl] = (breakdown[lvl] || 0) + 1;
      if (name == null && it.competency_name != null) name = it.competency_name;
    }
    out.push({
      competency_id,
      competency_name: name,
      item_count: arr.length,
      raw_mean: arr.length ? round1(rawSum / arr.length) : 0,
      achieved_points: round1(achieved),
      max_points: round1(maxPoints),
      difficulty_breakdown: breakdown,
    });
  }
  out.sort((a, b) => (a.competency_id < b.competency_id ? -1 : a.competency_id > b.competency_id ? 1 : 0));
  return out;
}

// ---------------------------------------------------------------------------
// 2. score_normalization_engine — Competency Score -> Normalized Score (0..100)
// ---------------------------------------------------------------------------
export type NormalizationBasis = 'difficulty_weighted_percent' | 'cohort_referenced' | 'unmeasurable';

export interface CohortRef { mean: number; sd: number; n: number }

export interface NormalizedScore {
  normalized: number | null; // 0..100, null when unmeasurable
  basis: NormalizationBasis;
  weighted_percent: number | null; // always the raw difficulty-weighted percent (pre-cohort)
  note: string | null;
}

/**
 * Normalize a difficulty-weighted Competency Score to 0..100.
 * Default basis = difficulty-weighted percent (achieved / max · 100).
 * If a REAL cohort {mean, sd, n>=COHORT_K_MIN, sd>0} is supplied, additionally
 * express the percent as a clamped T-score (50 + 10·z). Never fabricates a cohort.
 */
export function normalizeScore(
  achievedPoints: number,
  maxPoints: number,
  opts?: { cohort?: CohortRef | null },
): NormalizedScore {
  if (!(maxPoints > 0)) {
    return { normalized: null, basis: 'unmeasurable', weighted_percent: null, note: 'no_scoreable_items' };
  }
  const pct = round1((achievedPoints / maxPoints) * 100);
  const cohort = opts?.cohort;
  if (cohort && Number.isFinite(cohort.mean) && Number.isFinite(cohort.sd) && cohort.sd > 0
      && Number.isFinite(cohort.n) && cohort.n >= COHORT_K_MIN) {
    const z = (pct - cohort.mean) / cohort.sd;
    const t = clamp(round1(50 + 10 * z), 0, 100);
    return { normalized: t, basis: 'cohort_referenced', weighted_percent: pct, note: `cohort n=${cohort.n}` };
  }
  let note: string | null = null;
  if (cohort) note = 'cohort_ignored_below_k_or_invalid'; // honest: supplied but not usable
  return { normalized: pct, basis: 'difficulty_weighted_percent', weighted_percent: pct, note };
}

// ---------------------------------------------------------------------------
// 3. competency_level_calculator — Normalized Score -> Competency Level (1..5)
// ---------------------------------------------------------------------------
/** Canonical level bands — identical to Phase 2 scoreToLevel (>=80/60/40/20). */
export function scoreToLevelBand(normalized: number): number {
  if (normalized >= 80) return 5;
  if (normalized >= 60) return 4;
  if (normalized >= 40) return 3;
  if (normalized >= 20) return 2;
  return 1;
}

const FALLBACK_LEVEL_LABELS: Record<number, string> = {
  1: 'Foundational', 2: 'Developing', 3: 'Proficient', 4: 'Advanced', 5: 'Expert',
};

export interface CompetencyLevel {
  level: number | null;
  label: string | null;
  status: 'measured' | 'unmeasurable';
}

/**
 * Map a normalized 0..100 score to a 1-5 proficiency level.
 * null normalized => unmeasurable (null level), never floored to 1.
 * `labels` (from onto_proficiency_levels) preferred; canonical fallback otherwise.
 */
export function calculateCompetencyLevel(
  normalized: number | null,
  labels?: Record<number, string>,
): CompetencyLevel {
  if (normalized == null || !Number.isFinite(normalized)) {
    return { level: null, label: null, status: 'unmeasurable' };
  }
  const level = scoreToLevelBand(normalized);
  const label = (labels && labels[level]) || FALLBACK_LEVEL_LABELS[level] || null;
  return { level, label, status: 'measured' };
}

// ---------------------------------------------------------------------------
// Lazy schema (mirrors migrations/20260619_competency_scoring_engine.sql)
// ---------------------------------------------------------------------------
let schemaReady: Promise<void> | null = null;
export function ensureScoringSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_competency_score_runs (
          id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          assessment_id     UUID         REFERENCES onto_assembled_assessments(id) ON DELETE SET NULL,
          blueprint_id      VARCHAR(120),
          subject_id        VARCHAR(160),
          total_questions   INTEGER      NOT NULL DEFAULT 0,
          scored_questions  INTEGER      NOT NULL DEFAULT 0,
          competency_scores JSONB        NOT NULL DEFAULT '[]'::jsonb,
          overall           JSONB        NOT NULL DEFAULT '{}'::jsonb,
          normalization     JSONB        NOT NULL DEFAULT '{}'::jsonb,
          status            VARCHAR(40)  NOT NULL DEFAULT 'scored',
          source            VARCHAR(30)  NOT NULL DEFAULT 'runtime',
          created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_csr_total  CHECK (total_questions  >= 0),
          CONSTRAINT chk_csr_scored CHECK (scored_questions >= 0)
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_csr_assessment ON onto_competency_score_runs (assessment_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_csr_blueprint  ON onto_competency_score_runs (blueprint_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_csr_subject    ON onto_competency_score_runs (subject_id);`);
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// ---------------------------------------------------------------------------
// Level-label lookup (onto_proficiency_levels) — best-effort, never throws.
// ---------------------------------------------------------------------------
async function loadLevelLabels(pool: Pool): Promise<Record<number, string>> {
  try {
    const r = await pool.query(`SELECT level, label FROM onto_proficiency_levels`);
    const m: Record<number, string> = {};
    for (const row of r.rows) {
      const lvl = Number(row.level);
      if (Number.isFinite(lvl)) m[lvl] = String(row.label);
    }
    return m;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Orchestrator — full chain over a set of responses. Never throws.
// ---------------------------------------------------------------------------
export interface ScoreResponseInput {
  question_id?: string | null;
  competency_id?: string | null;      // inline override (else resolved from DB mapping)
  difficulty_level?: string | null;   // inline override (else resolved)
  question_type?: string | null;      // inline override (else resolved)
  raw_score?: number;
  score?: number;
  correct?: boolean;
  selected_index?: number;
  options?: unknown[];
  best_option?: number;
}

export interface ScoreRunInput {
  responses: ScoreResponseInput[];
  assessment_id?: string | null;
  blueprint_id?: string | null;
  subject_id?: string | null;
  cohorts?: Record<string, CohortRef>; // optional per-competency cohort references
  persist?: boolean;
  source?: string;
}

export interface CompetencyScoreResult extends CompetencyScore {
  normalized_score: number | null;
  normalization_basis: NormalizationBasis;
  weighted_percent: number | null;
  level: number | null;
  level_label: string | null;
  level_status: 'measured' | 'unmeasurable';
  normalization_note: string | null;
}

export interface ScoreRunResult {
  ok: boolean;
  run_id: string | null;
  assessment_id: string | null;
  blueprint_id: string | null;
  subject_id: string | null;
  status: 'scored' | 'scoring_empty';
  total_questions: number;
  scored_questions: number;
  competency_scores: CompetencyScoreResult[];
  overall: {
    normalized_score: number | null;
    level: number | null;
    level_label: string | null;
    status: 'measured' | 'unmeasurable';
    competencies_scored: number;
  };
  notes: string[];
}

interface MappingMeta { competency_id: string; competency_name: string | null; difficulty_level: string | null; question_type: string | null; options: unknown[]; best_option: number | null }

/** Resolve question_id -> competency/difficulty/type/options from the DB mapping. */
async function resolveQuestionMeta(pool: Pool, questionIds: string[]): Promise<Map<string, MappingMeta>> {
  const map = new Map<string, MappingMeta>();
  if (questionIds.length === 0) return map;
  try {
    const r = await pool.query(
      `SELECT m.question_id, m.competency_id, m.difficulty_level, m.question_type,
              c.canonical_name AS competency_name, t.template_body
         FROM onto_question_competency_mapping m
         JOIN competency_question_templates t ON t.id = m.question_id AND t.status = 'approved'
         LEFT JOIN onto_competencies c ON c.id = m.competency_id
        WHERE m.active = true AND m.question_id = ANY($1::uuid[])`,
      [questionIds],
    );
    for (const row of r.rows) {
      const body = row.template_body && typeof row.template_body === 'object' ? row.template_body : {};
      map.set(String(row.question_id), {
        competency_id: String(row.competency_id),
        competency_name: row.competency_name != null ? String(row.competency_name) : null,
        difficulty_level: row.difficulty_level != null ? String(row.difficulty_level) : null,
        question_type: row.question_type != null ? String(row.question_type) : null,
        options: Array.isArray(body.options) ? body.options : [],
        best_option: Number.isFinite(Number(body.best_option)) ? Number(body.best_option) : null,
      });
    }
  } catch {
    /* mapping table absent / bank empty -> honest empty map */
  }
  return map;
}

export async function scoreAssessmentRun(pool: Pool, input: ScoreRunInput): Promise<ScoreRunResult> {
  const responses = Array.isArray(input.responses) ? input.responses : [];
  const notes: string[] = [];

  const base = (status: 'scored' | 'scoring_empty', items: CompetencyScoreResult[], scored: number, overall: ScoreRunResult['overall'], runId: string | null): ScoreRunResult => ({
    ok: true,
    run_id: runId,
    assessment_id: input.assessment_id ?? null,
    blueprint_id: input.blueprint_id ?? null,
    subject_id: input.subject_id ?? null,
    status,
    total_questions: responses.length,
    scored_questions: scored,
    competency_scores: items,
    overall,
    notes,
  });
  const emptyOverall: ScoreRunResult['overall'] = { normalized_score: null, level: null, level_label: null, status: 'unmeasurable', competencies_scored: 0 };

  try {
    // Resolve metadata for responses lacking inline competency/difficulty.
    const needLookup = responses
      .filter((r) => r && r.question_id && (!r.competency_id || !r.difficulty_level || (r.selected_index != null && r.raw_score == null && r.score == null && r.correct == null)))
      .map((r) => String(r.question_id));
    const metaMap = needLookup.length ? await resolveQuestionMeta(pool, [...new Set(needLookup)]) : new Map<string, MappingMeta>();

    // Build scored items (Question -> Raw Score).
    const items: ScoredItem[] = [];
    for (const r of responses) {
      if (!r) continue;
      const meta = r.question_id ? metaMap.get(String(r.question_id)) : undefined;
      const competency_id = r.competency_id ?? meta?.competency_id ?? null;
      if (!competency_id) { continue; } // un-resolvable -> not counted (honest)
      const difficulty_level = r.difficulty_level ?? meta?.difficulty_level ?? null;
      const raw = deriveRawScore(r, {
        question_type: r.question_type ?? meta?.question_type ?? null,
        options: r.options ?? meta?.options ?? [],
        best_option: r.best_option ?? meta?.best_option ?? undefined,
      });
      if (raw == null) continue; // nothing scoreable -> not counted
      items.push({
        question_id: r.question_id ?? null,
        competency_id,
        competency_name: meta?.competency_name ?? null,
        difficulty_level,
        raw_score: raw,
      });
    }

    if (items.length === 0) {
      notes.push('no scoreable / resolvable responses — empty bank or unmapped questions');
      const runId = await maybePersist(pool, input, 'scoring_empty', [], 0, emptyOverall, notes);
      return base('scoring_empty', [], 0, emptyOverall, runId);
    }

    const labels = await loadLevelLabels(pool);
    const compScores = computeCompetencyScores(items);
    const cohorts = input.cohorts ?? {};

    const results: CompetencyScoreResult[] = compScores.map((cs) => {
      const norm = normalizeScore(cs.achieved_points, cs.max_points, { cohort: cohorts[cs.competency_id] ?? null });
      const lvl = calculateCompetencyLevel(norm.normalized, labels);
      return {
        ...cs,
        normalized_score: norm.normalized,
        normalization_basis: norm.basis,
        weighted_percent: norm.weighted_percent,
        normalization_note: norm.note,
        level: lvl.level,
        level_label: lvl.label,
        level_status: lvl.status,
      };
    });

    // Overall = item-count-weighted mean of per-competency normalized scores (measured only).
    let wSum = 0;
    let acc = 0;
    let measured = 0;
    for (const r of results) {
      if (r.normalized_score == null) continue;
      acc += r.normalized_score * r.item_count;
      wSum += r.item_count;
      measured++;
    }
    const overallNorm = wSum > 0 ? round1(acc / wSum) : null;
    const overallLevel = calculateCompetencyLevel(overallNorm, labels);
    const overall: ScoreRunResult['overall'] = {
      normalized_score: overallNorm,
      level: overallLevel.level,
      level_label: overallLevel.label,
      status: overallLevel.status,
      competencies_scored: measured,
    };

    const runId = await maybePersist(pool, input, 'scored', results, items.length, overall, notes);
    return base('scored', results, items.length, overall, runId);
  } catch (e) {
    notes.push(`scoring degraded: ${(e as Error)?.message ?? 'error'}`);
    return base('scoring_empty', [], 0, emptyOverall, null);
  }
}

async function maybePersist(
  pool: Pool,
  input: ScoreRunInput,
  status: 'scored' | 'scoring_empty',
  results: CompetencyScoreResult[],
  scored: number,
  overall: ScoreRunResult['overall'],
  notes: string[],
): Promise<string | null> {
  if (input.persist === false) return null;
  try {
    await ensureScoringSchema(pool);
    const r = await pool.query(
      `INSERT INTO onto_competency_score_runs
         (assessment_id, blueprint_id, subject_id, total_questions, scored_questions, competency_scores, overall, normalization, status, source)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10)
       RETURNING id`,
      [
        input.assessment_id ?? null,
        input.blueprint_id ?? null,
        input.subject_id ?? null,
        Array.isArray(input.responses) ? input.responses.length : 0,
        scored,
        JSON.stringify(results),
        JSON.stringify(overall),
        JSON.stringify({ k_min: COHORT_K_MIN, notes }),
        status,
        input.source ?? 'runtime',
      ],
    );
    return r.rows[0]?.id ? String(r.rows[0].id) : null;
  } catch {
    notes.push('persist skipped (schema/insert unavailable)');
    return null;
  }
}

// ---------------------------------------------------------------------------
// Read a stored scoring run. Never throws.
// ---------------------------------------------------------------------------
export async function getScoreRun(pool: Pool, runId: string): Promise<Record<string, unknown> | null> {
  try {
    await ensureScoringSchema(pool);
    const r = await pool.query(
      `SELECT id, assessment_id, blueprint_id, subject_id, total_questions, scored_questions,
              competency_scores, overall, normalization, status, source, created_at
         FROM onto_competency_score_runs WHERE id = $1`,
      [runId],
    );
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}
