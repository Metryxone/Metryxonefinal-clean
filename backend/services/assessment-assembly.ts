/**
 * Phase 2.3 — Assessment Assembly Engine.
 *
 *   Role → Assessment Blueprint → Question Selection → Assessment Generation
 *
 * Deliverables:
 *   - assessment_builder   → buildAssessment          (select + dedup + difficulty-balance + randomize)
 *   - assessment_validator → validateAssessment       (duplicate / competency-coverage /
 *                                                       blueprint-coverage / difficulty-balance)
 *   - assessment_generator → generateAssembledAssessment (build → validate → persist)
 *
 * Composes the EXISTING substrate; it never re-implements or mutates it:
 *   - Blueprint + weights : services/assessment-foundation-mapping.ts getBlueprint
 *                           (onto_assessment_blueprints + onto_blueprint_competency_map)
 *   - Per-competency pool  : Phase 2.2 onto_question_competency_mapping JOIN
 *                           competency_question_templates (status='approved')
 *   - Per-competency target: Phase 2.2 onto_question_blueprints.difficulty_distribution / pool_target
 *   - Difficulty ladder    : Phase 2.2 onto_question_difficulty_framework (DIFFICULTY_SEED order)
 *
 * DISTINCT from Phase 2's generateAssessment / onto_assessment_instances (the domain-proxy
 * generator) — Phase 2 is left byte-identical. New persistence table onto_assembled_assessments.
 *
 * Honesty contract:
 *   - The question bank is EMPTY in dev → assembled assessments are honestly empty; the validator
 *     flags `assessment_empty` + uncovered competencies. Questions are NEVER fabricated.
 *   - No-duplicate is GUARANTEED by construction: each mapped+approved question is assigned to exactly
 *     ONE competency (highest blueprint weight; tie → competency_id asc), giving disjoint pools.
 *   - Randomization is a SEEDED Fisher–Yates → deterministic & reproducible when a seed is supplied.
 *
 * Strictly additive · never throws · reuses existing tables. Schema ensure is lazy and only reachable
 * behind the flag-gated routes, so flag-OFF = no DDL.
 */

import type { Pool } from 'pg';
import { getBlueprint } from './assessment-foundation-mapping.js';
import { DIFFICULTY_SEED } from './question-blueprint.js';

export const ASSESSMENT_ASSEMBLY_VERSION = 'phase-2.3';

const MAX_TOTAL = 200;
const DEFAULT_BLUEPRINT_DEVIATION_TOLERANCE = 15; // percentage points

/** Canonical difficulty level order (foundational..expert). */
const DIFFICULTY_ORDER = DIFFICULTY_SEED.map((d) => d.level_key);

// ---------------------------------------------------------------------------
// Lazy schema (mirrors migrations/20260619_assessment_assembly_engine.sql)
// ---------------------------------------------------------------------------
let schemaReady: Promise<void> | null = null;

export function ensureAssessmentAssemblySchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_assembled_assessments (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          blueprint_id    VARCHAR(120) NOT NULL REFERENCES onto_assessment_blueprints(id) ON DELETE CASCADE,
          role_id         VARCHAR(120),
          total_questions INTEGER      NOT NULL DEFAULT 0,
          seed            BIGINT       NOT NULL DEFAULT 0,
          questions       JSONB        NOT NULL DEFAULT '[]'::jsonb,
          coverage        JSONB        NOT NULL DEFAULT '{}'::jsonb,
          validation      JSONB        NOT NULL DEFAULT '{}'::jsonb,
          valid           BOOLEAN      NOT NULL DEFAULT false,
          source          VARCHAR(30)  NOT NULL DEFAULT 'assembled',
          created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_aa_total CHECK (total_questions >= 0)
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aa_blueprint ON onto_assembled_assessments (blueprint_id);`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_aa_role      ON onto_assembled_assessments (role_id);`);
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) + seeded Fisher–Yates
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Largest-remainder allocation of `total` across `weights` → ints summing to `total`. */
function largestRemainder(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w / sum) * total);
  const floor = exact.map((e) => Math.floor(e));
  let rem = total - floor.reduce((s, f) => s + f, 0);
  const order = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && rem > 0; k++, rem--) floor[order[k].i]++;
  return floor;
}

/** Allocate capped by per-competency capacity, redistributing overflow to comps with spare room. */
function allocateCapped(total: number, weights: number[], caps: number[]): number[] {
  const capTotal = caps.reduce((s, c) => s + c, 0);
  const target = Math.min(total, capTotal);
  const alloc = largestRemainder(target, weights);
  let overflow = 0;
  for (let i = 0; i < alloc.length; i++) {
    if (alloc[i] > caps[i]) { overflow += alloc[i] - caps[i]; alloc[i] = caps[i]; }
  }
  while (overflow > 0) {
    const spare = [...alloc.keys()].filter((i) => alloc[i] < caps[i]).sort((a, b) => (weights[b] - weights[a]) || (a - b));
    if (spare.length === 0) break;
    let moved = false;
    for (const i of spare) { if (overflow <= 0) break; alloc[i]++; overflow--; moved = true; }
    if (!moved) break;
  }
  return alloc;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface AssembledQuestion {
  position: number;
  question_id: string;
  competency_id: string;
  competency_name: string | null;
  micro_competency_id: number | null;
  difficulty_level: string;
  question_type: string;
}

interface PoolRow { question_id: string; competency_id: string; micro_competency_id: number | null; difficulty_level: string; question_type: string; }

export interface AssemblyCoverage {
  per_competency: Array<{
    competency_id: string; competency_name: string | null; weight: number;
    pool_available: number; allocated: number; selected: number;
    difficulty_breakdown: Record<string, number>;
  }>;
  competencies_total: number;
  competencies_covered: number;
  achieved_difficulty_distribution: Record<string, number>;
  achieved_type_distribution: Record<string, number>;
  question_bank_empty: boolean;
  notes: string[];
}

export type BuildResult =
  | { ok: true; blueprint_id: string; role_id: string | null; seed: number; total_questions: number; questions: AssembledQuestion[]; coverage: AssemblyCoverage }
  | { ok: false; error: 'blueprint_required' | 'blueprint_not_found' };

// ---------------------------------------------------------------------------
// assessment_builder — Question Selection
// ---------------------------------------------------------------------------
export async function buildAssessment(
  pool: Pool,
  blueprintId: string,
  opts?: { total?: number | null; seed?: number | null },
): Promise<BuildResult> {
  await ensureAssessmentAssemblySchema(pool);
  const bpId = String(blueprintId ?? '').trim();
  if (!bpId) return { ok: false, error: 'blueprint_required' };
  const blueprint = await getBlueprint(pool, bpId);
  if (!blueprint) return { ok: false, error: 'blueprint_not_found' };

  const seed = Number.isFinite(opts?.seed as number) && (opts!.seed as number) >= 0
    ? Math.floor(opts!.seed as number) >>> 0
    : (Math.floor(Math.random() * 0xffffffff) >>> 0);
  const rng = mulberry32(seed);

  const comps = blueprint.competencies.filter((c) => c.active);
  const compIds = comps.map((c) => c.competency_id);

  // Weight for allocation: blueprint weight if >0, else equal (1). If all zero → equal.
  const rawWeights = comps.map((c) => Number(c.weight) || 0);
  const weightSum = rawWeights.reduce((s, w) => s + w, 0);
  const weights = comps.map((_, i) => (weightSum > 0 ? rawWeights[i] : 1));
  const weightByComp = new Map<string, number>(comps.map((c, i) => [c.competency_id, weights[i]]));
  const nameByComp = new Map<string, string | null>(comps.map((c) => [c.competency_id, c.competency_name]));

  // Mapped + approved questions for the blueprint's competencies.
  let mapRows: any[] = [];
  if (compIds.length > 0) {
    const res = await pool.query(
      `SELECT m.question_id, m.competency_id, m.micro_competency_id, m.difficulty_level, m.question_type
         FROM onto_question_competency_mapping m
         JOIN competency_question_templates t ON t.id = m.question_id
        WHERE m.competency_id = ANY($1::text[]) AND m.active = true AND t.status = 'approved'`,
      [compIds],
    );
    mapRows = res.rows;
  }

  // Disjoint assignment: each question → its highest-weight competency (tie → competency_id asc).
  // Guarantees NO duplicates and stable per-competency capacities.
  const byQuestion = new Map<string, PoolRow[]>();
  for (const r of mapRows) {
    const row: PoolRow = {
      question_id: String(r.question_id),
      competency_id: String(r.competency_id),
      micro_competency_id: r.micro_competency_id != null ? Number(r.micro_competency_id) : null,
      difficulty_level: String(r.difficulty_level),
      question_type: String(r.question_type),
    };
    (byQuestion.get(row.question_id) ?? byQuestion.set(row.question_id, []).get(row.question_id)!).push(row);
  }
  const disjoint = new Map<string, PoolRow[]>(); // competency_id → assigned rows
  for (const id of compIds) disjoint.set(id, []);
  for (const [, candidates] of byQuestion) {
    candidates.sort((a, b) =>
      ((weightByComp.get(b.competency_id) ?? 0) - (weightByComp.get(a.competency_id) ?? 0)) ||
      a.competency_id.localeCompare(b.competency_id));
    const winner = candidates[0];
    disjoint.get(winner.competency_id)!.push(winner);
  }

  // Per-competency target difficulty distributions (Phase 2.2) + pool_target.
  const diffDistByComp = new Map<string, Record<string, number>>();
  const poolTargetByComp = new Map<string, number>();
  if (compIds.length > 0) {
    const qb = await pool.query(
      `SELECT competency_id, pool_target, difficulty_distribution
         FROM onto_question_blueprints WHERE competency_id = ANY($1::text[])`,
      [compIds],
    );
    for (const r of qb.rows) {
      diffDistByComp.set(String(r.competency_id), (r.difficulty_distribution as Record<string, number>) || {});
      poolTargetByComp.set(String(r.competency_id), Number(r.pool_target) || 0);
    }
  }

  const caps = comps.map((c) => disjoint.get(c.competency_id)!.length);
  const capTotal = caps.reduce((s, c) => s + c, 0);

  // total = explicit ?? Σ pool_target(>0) ?? Σ caps; clamped to Σ caps and MAX_TOTAL.
  const sumPoolTarget = comps.reduce((s, c) => s + (poolTargetByComp.get(c.competency_id) || 0), 0);
  let total = opts?.total != null && Number.isFinite(opts.total) ? Math.floor(opts.total as number)
    : (sumPoolTarget > 0 ? sumPoolTarget : capTotal);
  total = Math.max(0, Math.min(total, capTotal, MAX_TOTAL));

  const alloc = allocateCapped(total, weights, caps);

  // Select per competency with difficulty balancing.
  const selected: AssembledQuestion[] = [];
  const perCompCoverage: AssemblyCoverage['per_competency'] = [];
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const want = alloc[i];
    const avail = disjoint.get(c.competency_id)!;
    const chosen = selectWithDifficultyBalance(avail, want, diffDistByComp.get(c.competency_id) || {}, rng);
    const breakdown: Record<string, number> = {};
    for (const q of chosen) breakdown[q.difficulty_level] = (breakdown[q.difficulty_level] || 0) + 1;
    for (const q of chosen) {
      selected.push({
        position: 0, // assigned after final shuffle
        question_id: q.question_id,
        competency_id: c.competency_id,
        competency_name: nameByComp.get(c.competency_id) ?? null,
        micro_competency_id: q.micro_competency_id,
        difficulty_level: q.difficulty_level,
        question_type: q.question_type,
      });
    }
    perCompCoverage.push({
      competency_id: c.competency_id,
      competency_name: c.competency_name,
      weight: rawWeights[i],
      pool_available: avail.length,
      allocated: want,
      selected: chosen.length,
      difficulty_breakdown: breakdown,
    });
  }

  // Question randomization: seeded final ordering.
  shuffle(selected, rng);
  selected.forEach((q, i) => { q.position = i; });

  const achievedDiff: Record<string, number> = {};
  const achievedType: Record<string, number> = {};
  for (const q of selected) {
    achievedDiff[q.difficulty_level] = (achievedDiff[q.difficulty_level] || 0) + 1;
    achievedType[q.question_type] = (achievedType[q.question_type] || 0) + 1;
  }

  const bankEmpty = mapRows.length === 0;
  const notes: string[] = [];
  if (bankEmpty) notes.push('No mapped + approved questions exist for this blueprint — the assembled assessment is empty (honest gap, not fabricated).');
  const starved = perCompCoverage.filter((p) => p.pool_available > 0 && p.selected === 0);
  if (starved.length) notes.push(`${starved.length} competency(ies) had mapped questions but received 0 (shared questions assigned to higher-weight competencies, or allocation exhausted).`);

  const coverage: AssemblyCoverage = {
    per_competency: perCompCoverage,
    competencies_total: comps.length,
    competencies_covered: perCompCoverage.filter((p) => p.selected > 0).length,
    achieved_difficulty_distribution: achievedDiff,
    achieved_type_distribution: achievedType,
    question_bank_empty: bankEmpty,
    notes,
  };

  return {
    ok: true,
    blueprint_id: bpId,
    role_id: blueprint.source_role_id ?? null,
    seed,
    total_questions: selected.length,
    questions: selected,
    coverage,
  };
}

/** Choose `want` questions from `avail`, matching a target difficulty distribution as closely as possible. */
function selectWithDifficultyBalance(
  avail: PoolRow[], want: number, targetDist: Record<string, number>, rng: () => number,
): PoolRow[] {
  if (want <= 0 || avail.length === 0) return [];
  const n = Math.min(want, avail.length);

  // Bucket available by difficulty, shuffled.
  const byLevel = new Map<string, PoolRow[]>();
  for (const r of avail) (byLevel.get(r.difficulty_level) ?? byLevel.set(r.difficulty_level, []).get(r.difficulty_level)!).push(r);
  for (const arr of byLevel.values()) shuffle(arr, rng);

  const levelsPresent = DIFFICULTY_ORDER.filter((l) => byLevel.has(l));
  for (const l of byLevel.keys()) if (!levelsPresent.includes(l)) levelsPresent.push(l); // any non-canonical levels last

  // Target counts per present level: from blueprint dist (proportional) else even spread.
  const distSum = levelsPresent.reduce((s, l) => s + (Number(targetDist[l]) || 0), 0);
  const props = distSum > 0 ? levelsPresent.map((l) => Number(targetDist[l]) || 0) : levelsPresent.map(() => 1);
  const targetCounts = largestRemainder(n, props);

  const chosen: PoolRow[] = [];
  const used = new Set<string>();
  // Pass 1: satisfy per-level targets (capped by what each bucket holds).
  for (let i = 0; i < levelsPresent.length; i++) {
    let need = targetCounts[i];
    const bucket = byLevel.get(levelsPresent[i]) || [];
    for (const r of bucket) {
      if (need <= 0 || chosen.length >= n) break;
      chosen.push(r); used.add(r.question_id); need--;
    }
  }
  // Pass 2: fill any remainder from leftover (shuffled across all levels).
  if (chosen.length < n) {
    const leftover = shuffle(avail.filter((r) => !used.has(r.question_id)), rng);
    for (const r of leftover) {
      if (chosen.length >= n) break;
      chosen.push(r); used.add(r.question_id);
    }
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// assessment_validator
// ---------------------------------------------------------------------------
export interface AssessmentValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  duplicate_check: { ok: boolean; duplicate_question_ids: string[] };
  competency_coverage: {
    total: number; covered: number; ratio: number;
    uncovered: Array<{ competency_id: string; competency_name: string | null; reason: string }>;
  };
  blueprint_coverage: {
    within_tolerance: boolean; tolerance_pct: number; max_deviation_pct: number;
    per_competency: Array<{ competency_id: string; target_pct: number; achieved_pct: number; deviation_pct: number }>;
  };
  difficulty_balance: {
    achieved_distribution: Record<string, number>;
    per_competency: Array<{ competency_id: string; target: Record<string, number>; achieved: Record<string, number>; deviation: number }>;
    balanced: boolean;
  };
}

/**
 * assessment_validator — self-contained: recomputes the mapped pool + blueprint weights from the DB so
 * it can validate either a freshly-built or a stored assessment.
 */
export async function validateAssessment(
  pool: Pool,
  blueprintId: string,
  questions: AssembledQuestion[],
  opts?: { tolerancePct?: number },
): Promise<{ ok: boolean; error?: string; validation?: AssessmentValidation }> {
  await ensureAssessmentAssemblySchema(pool);
  const blueprint = await getBlueprint(pool, blueprintId);
  if (!blueprint) return { ok: false, error: 'blueprint_not_found' };
  const tolerance = Number.isFinite(opts?.tolerancePct as number) ? (opts!.tolerancePct as number) : DEFAULT_BLUEPRINT_DEVIATION_TOLERANCE;

  const comps = blueprint.competencies.filter((c) => c.active);
  const compIds = comps.map((c) => c.competency_id);
  const nameByComp = new Map<string, string | null>(comps.map((c) => [c.competency_id, c.competency_name]));
  const errors: string[] = [];
  const warnings: string[] = [];

  // -- duplicate check -------------------------------------------------------
  const seen = new Map<string, number>();
  for (const q of questions) seen.set(q.question_id, (seen.get(q.question_id) || 0) + 1);
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  if (dups.length) errors.push(`${dups.length} duplicate question(s) found.`);

  // -- which competencies have ANY mapped+approved question (for honest reasons) --
  const mappedCount = new Map<string, number>();
  if (compIds.length > 0) {
    const res = await pool.query(
      `SELECT m.competency_id, COUNT(*)::int AS n
         FROM onto_question_competency_mapping m
         JOIN competency_question_templates t ON t.id = m.question_id
        WHERE m.competency_id = ANY($1::text[]) AND m.active = true AND t.status = 'approved'
        GROUP BY m.competency_id`,
      [compIds],
    );
    for (const r of res.rows) mappedCount.set(String(r.competency_id), Number(r.n));
  }

  // -- competency coverage ---------------------------------------------------
  const selByComp = new Map<string, number>();
  for (const q of questions) selByComp.set(q.competency_id, (selByComp.get(q.competency_id) || 0) + 1);
  const uncovered: AssessmentValidation['competency_coverage']['uncovered'] = [];
  for (const c of comps) {
    if ((selByComp.get(c.competency_id) || 0) > 0) continue;
    const reason = (mappedCount.get(c.competency_id) || 0) === 0 ? 'no_mapped_questions' : 'not_selected';
    uncovered.push({ competency_id: c.competency_id, competency_name: nameByComp.get(c.competency_id) ?? null, reason });
  }
  const covered = comps.length - uncovered.length;
  if (uncovered.length) warnings.push(`${uncovered.length} of ${comps.length} blueprint competency(ies) are uncovered.`);

  // -- blueprint coverage (achieved proportion vs weight proportion) ---------
  const rawWeights = comps.map((c) => Number(c.weight) || 0);
  const weightSum = rawWeights.reduce((s, w) => s + w, 0);
  const total = questions.length;
  const perCompBp: AssessmentValidation['blueprint_coverage']['per_competency'] = [];
  let maxDev = 0;
  for (let i = 0; i < comps.length; i++) {
    const c = comps[i];
    const targetPct = weightSum > 0 ? (rawWeights[i] / weightSum) * 100 : (comps.length ? 100 / comps.length : 0);
    const achievedPct = total > 0 ? ((selByComp.get(c.competency_id) || 0) / total) * 100 : 0;
    const dev = Math.abs(targetPct - achievedPct);
    maxDev = Math.max(maxDev, dev);
    perCompBp.push({
      competency_id: c.competency_id,
      target_pct: Math.round(targetPct * 10) / 10,
      achieved_pct: Math.round(achievedPct * 10) / 10,
      deviation_pct: Math.round(dev * 10) / 10,
    });
  }
  const withinTol = total === 0 ? false : maxDev <= tolerance;
  if (total > 0 && !withinTol) warnings.push(`Blueprint composition deviates up to ${Math.round(maxDev * 10) / 10}pts from target weights (tolerance ${tolerance}pts).`);

  // -- difficulty balance ----------------------------------------------------
  const achievedDiff: Record<string, number> = {};
  for (const q of questions) achievedDiff[q.difficulty_level] = (achievedDiff[q.difficulty_level] || 0) + 1;
  const diffTargets = new Map<string, Record<string, number>>();
  if (compIds.length > 0) {
    const qb = await pool.query(
      `SELECT competency_id, difficulty_distribution FROM onto_question_blueprints WHERE competency_id = ANY($1::text[])`,
      [compIds],
    );
    for (const r of qb.rows) diffTargets.set(String(r.competency_id), (r.difficulty_distribution as Record<string, number>) || {});
  }
  const achievedByComp = new Map<string, Record<string, number>>();
  for (const q of questions) {
    const m = achievedByComp.get(q.competency_id) ?? achievedByComp.set(q.competency_id, {}).get(q.competency_id)!;
    m[q.difficulty_level] = (m[q.difficulty_level] || 0) + 1;
  }
  const perCompDiff: AssessmentValidation['difficulty_balance']['per_competency'] = [];
  let diffBalanced = true;
  for (const c of comps) {
    const target = diffTargets.get(c.competency_id) || {};
    const achieved = achievedByComp.get(c.competency_id) || {};
    const targetSum = Object.values(target).reduce((s, n) => s + (Number(n) || 0), 0);
    const achievedSum = Object.values(achieved).reduce((s, n) => s + n, 0);
    if (targetSum <= 0 || achievedSum <= 0) continue; // no target or nothing selected → not assessable
    // Compare normalized shares per level; deviation = max share gap (0..1).
    let dev = 0;
    const levels = new Set([...Object.keys(target), ...Object.keys(achieved)]);
    for (const l of levels) {
      const tShare = (Number(target[l]) || 0) / targetSum;
      const aShare = (achieved[l] || 0) / achievedSum;
      dev = Math.max(dev, Math.abs(tShare - aShare));
    }
    const devPct = Math.round(dev * 1000) / 10;
    if (dev > 0.25) diffBalanced = false;
    perCompDiff.push({ competency_id: c.competency_id, target, achieved, deviation: devPct });
  }
  if (!diffBalanced) warnings.push('Difficulty distribution deviates >25% from target for one or more competencies.');

  if (total === 0) errors.push('assessment_empty: no questions selected (question bank/pool empty).');

  const validation: AssessmentValidation = {
    valid: errors.length === 0,
    errors,
    warnings,
    duplicate_check: { ok: dups.length === 0, duplicate_question_ids: dups },
    competency_coverage: {
      total: comps.length, covered,
      ratio: comps.length ? Math.round((covered / comps.length) * 1000) / 1000 : 0,
      uncovered,
    },
    blueprint_coverage: { within_tolerance: withinTol, tolerance_pct: tolerance, max_deviation_pct: Math.round(maxDev * 10) / 10, per_competency: perCompBp },
    difficulty_balance: { achieved_distribution: achievedDiff, per_competency: perCompDiff, balanced: diffBalanced },
  };
  return { ok: true, validation };
}

// ---------------------------------------------------------------------------
// assessment_generator — build → validate → persist
// ---------------------------------------------------------------------------
export type GenerateResult =
  | {
      ok: true; assessment_id: string | null; blueprint_id: string; role_id: string | null; seed: number;
      total_questions: number; questions: AssembledQuestion[]; coverage: AssemblyCoverage;
      validation: AssessmentValidation; valid: boolean; persisted: boolean;
    }
  | { ok: false; error: string };

export async function generateAssembledAssessment(
  pool: Pool,
  blueprintId: string,
  opts?: { total?: number | null; seed?: number | null; persist?: boolean; tolerancePct?: number },
): Promise<GenerateResult> {
  await ensureAssessmentAssemblySchema(pool);
  const built = await buildAssessment(pool, blueprintId, { total: opts?.total, seed: opts?.seed });
  if (!built.ok) return { ok: false, error: built.error };

  const validated = await validateAssessment(pool, built.blueprint_id, built.questions, { tolerancePct: opts?.tolerancePct });
  if (!validated.ok || !validated.validation) return { ok: false, error: validated.error ?? 'validation_failed' };
  const validation = validated.validation;

  const persist = opts?.persist !== false; // default true
  let assessmentId: string | null = null;
  if (persist) {
    const ins = await pool.query(
      `INSERT INTO onto_assembled_assessments
         (blueprint_id, role_id, total_questions, seed, questions, coverage, validation, valid, source)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,'assembled')
       RETURNING id`,
      [built.blueprint_id, built.role_id, built.total_questions, built.seed,
       JSON.stringify(built.questions), JSON.stringify(built.coverage), JSON.stringify(validation), validation.valid],
    );
    assessmentId = ins.rows[0].id as string;
  }

  return {
    ok: true,
    assessment_id: assessmentId,
    blueprint_id: built.blueprint_id,
    role_id: built.role_id,
    seed: built.seed,
    total_questions: built.total_questions,
    questions: built.questions,
    coverage: built.coverage,
    validation,
    valid: validation.valid,
    persisted: persist,
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------
export async function getAssembledAssessment(pool: Pool, assessmentId: string): Promise<any | null> {
  await ensureAssessmentAssemblySchema(pool);
  const { rows } = await pool.query(
    `SELECT id, blueprint_id, role_id, total_questions, seed, questions, coverage, validation, valid, source, created_at, updated_at
       FROM onto_assembled_assessments WHERE id = $1`,
    [assessmentId],
  );
  return rows[0] ?? null;
}
