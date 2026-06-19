/**
 * Phase 2.1 — Assessment Blueprint Engine.
 *
 *   Role → Assessment Blueprint (5-dimension % mix)
 *
 * Maps the user-facing deliverables onto the existing competency framework
 * (Phase 1 `onto_competency_types`, Phase 1.5 `onto_assessment_blueprints`):
 *
 *   - `assessment_blueprints`  → table `onto_blueprint_dimension_mix`
 *        (one row per existing blueprint; the 5 dimension percentages)
 *   - `blueprint_builder`      → deriveDimensionMix / buildBlueprint
 *        (derive an HONEST mix from real competency weights × type map, or
 *         author an explicit mix)
 *   - `blueprint_validation`   → validateDimensionMix
 *        (all 5 present · each 0–100 · sum = 100 · content-gap warnings)
 *
 * The 5 dimensions ARE the Phase 1 competency types
 * (`onto_competency_types.type_key`): behavioral / cognitive / functional /
 * technical / future_skills. Derivation aggregates each blueprint competency's
 * weight by its type (`onto_competency_type_map`). `technical` is sparse and
 * `future_skills` is empty in the genome — these surface as honest 0% / warnings,
 * never fabricated.
 *
 * Strictly additive · never throws · reuses existing tables. Schema ensure is
 * lazy and only reachable behind the flag-gated routes, so flag-OFF = no DDL.
 */

import type { Pool } from 'pg';

export const BLUEPRINT_BUILDER_VERSION = 'phase-2.1';

/** The 5 dimensions, in canonical display order (= onto_competency_types). */
export const DIMENSION_KEYS = ['behavioral', 'cognitive', 'functional', 'technical', 'future_skills'] as const;
export type DimensionKey = (typeof DIMENSION_KEYS)[number];

/** Dimensions known to be sparse/empty in the genome — honest content gaps. */
const CONTENT_GAP_DIMENSIONS: DimensionKey[] = ['technical', 'future_skills'];

const SUM_TOLERANCE = 0.5; // percentage points
const CONCENTRATION_WARN = 70; // a single dimension above this earns a warning

export type DimensionMix = Record<DimensionKey, number>;

export interface MixCoverage {
  typed_competencies: number;
  untyped_competencies: number;
  typed_weight: number;
  untyped_weight: number;
  denominator_mode: 'weight' | 'count';
  dimensions_present: DimensionKey[];
  dimensions_absent: DimensionKey[];
  notes: string[];
}

export interface ValidationResult {
  valid: boolean;
  sum: number;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Lazy schema (mirrors migrations/20260619_blueprint_dimension_mix.sql)
// ---------------------------------------------------------------------------
let schemaReady: Promise<void> | null = null;

export function ensureBlueprintDimensionSchema(pool: Pool): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS onto_blueprint_dimension_mix (
          blueprint_id       VARCHAR(120) PRIMARY KEY
                               REFERENCES onto_assessment_blueprints(id) ON DELETE CASCADE,
          behavioral_pct     NUMERIC(6,2) NOT NULL DEFAULT 0,
          cognitive_pct      NUMERIC(6,2) NOT NULL DEFAULT 0,
          functional_pct     NUMERIC(6,2) NOT NULL DEFAULT 0,
          technical_pct      NUMERIC(6,2) NOT NULL DEFAULT 0,
          future_skills_pct  NUMERIC(6,2) NOT NULL DEFAULT 0,
          source             VARCHAR(30)  NOT NULL DEFAULT 'derived',
          coverage           JSONB        NOT NULL DEFAULT '{}'::jsonb,
          created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
          updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
          CONSTRAINT chk_bdm_ranges CHECK (
            behavioral_pct    BETWEEN 0 AND 100 AND
            cognitive_pct     BETWEEN 0 AND 100 AND
            functional_pct    BETWEEN 0 AND 100 AND
            technical_pct     BETWEEN 0 AND 100 AND
            future_skills_pct BETWEEN 0 AND 100
          ),
          CONSTRAINT chk_bdm_sum CHECK (
            (behavioral_pct + cognitive_pct + functional_pct + technical_pct + future_skills_pct)
              BETWEEN 99.5 AND 100.5
          )
        );
      `);
    })().catch((e) => { schemaReady = null; throw e; });
  }
  return schemaReady;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function emptyMix(): DimensionMix {
  return { behavioral: 0, cognitive: 0, functional: 0, technical: 0, future_skills: 0 };
}

/** Largest-remainder rounding of a raw weight map to percentages summing to exactly 100. */
function normalizeToHundred(raw: DimensionMix): DimensionMix {
  const total = DIMENSION_KEYS.reduce((s, k) => s + (raw[k] || 0), 0);
  if (total <= 0) return emptyMix();
  const exact = DIMENSION_KEYS.map((k) => ({ k, v: ((raw[k] || 0) / total) * 100 }));
  const floored = exact.map((e) => ({ k: e.k, floor: Math.floor(e.v * 100) / 100, frac: e.v * 100 - Math.floor(e.v * 100) }));
  let allocated = floored.reduce((s, e) => s + e.floor, 0);
  // distribute the remaining hundredths to the largest fractional parts
  let remaining = Math.round((100 - allocated) * 100);
  const order = [...floored].sort((a, b) => b.frac - a.frac);
  const out = emptyMix();
  for (const e of floored) out[e.k] = e.floor;
  for (let i = 0; i < order.length && remaining > 0; i++, remaining--) out[order[i].k] = Math.round((out[order[i].k] + 0.01) * 100) / 100;
  return out;
}

function blueprintExists(pool: Pool, blueprintId: string): Promise<boolean> {
  return pool
    .query(`SELECT 1 FROM onto_assessment_blueprints WHERE id = $1`, [blueprintId])
    .then((r) => r.rowCount! > 0);
}

// ---------------------------------------------------------------------------
// blueprint_validation
// ---------------------------------------------------------------------------
export function validateDimensionMix(input: Partial<Record<string, unknown>>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const mix = emptyMix();

  for (const k of DIMENSION_KEYS) {
    // accept both `behavioral` and `behavioral_pct`
    const raw = input[k] ?? input[`${k}_pct`];
    if (raw == null) { errors.push(`missing dimension '${k}'`); continue; }
    const n = Number(raw);
    if (!Number.isFinite(n)) { errors.push(`dimension '${k}' is not a number`); continue; }
    if (n < 0 || n > 100) errors.push(`dimension '${k}' (${n}) out of range 0–100`);
    mix[k] = n;
  }

  const sum = DIMENSION_KEYS.reduce((s, k) => s + mix[k], 0);
  const roundedSum = Math.round(sum * 100) / 100;
  if (Math.abs(sum - 100) > SUM_TOLERANCE) errors.push(`dimensions sum to ${roundedSum}, must total 100`);

  for (const k of DIMENSION_KEYS) {
    if (mix[k] > CONCENTRATION_WARN) warnings.push(`dimension '${k}' is heavily concentrated at ${mix[k]}%`);
    if (mix[k] > 0 && CONTENT_GAP_DIMENSIONS.includes(k)) {
      warnings.push(`dimension '${k}' is allocated ${mix[k]}% but is sparsely represented in the genome — ensure question coverage before relying on it`);
    }
  }

  return { valid: errors.length === 0, sum: roundedSum, errors, warnings };
}

// ---------------------------------------------------------------------------
// blueprint_builder — derive an honest mix from real competency data
// ---------------------------------------------------------------------------
const SELECT_TYPE_WEIGHTS = `
  SELECT COALESCE(t.type_key, 'UNTYPED') AS type_key,
         COUNT(*)::int                   AS n,
         COALESCE(SUM(bcm.weight), 0)::float AS wsum
    FROM onto_blueprint_competency_map bcm
    LEFT JOIN onto_competency_type_map t ON t.competency_id = bcm.competency_id
   WHERE bcm.blueprint_id = $1
   GROUP BY 1
`;

export type DeriveResult =
  | { ok: true; blueprint_id: string; source: 'derived'; mix: DimensionMix; coverage: MixCoverage }
  | { ok: false; error: 'blueprint_not_found' | 'insufficient_typing'; coverage?: MixCoverage };

export async function deriveDimensionMix(pool: Pool, blueprintId: string): Promise<DeriveResult> {
  await ensureBlueprintDimensionSchema(pool);
  if (!(await blueprintExists(pool, blueprintId))) return { ok: false, error: 'blueprint_not_found' };

  const { rows } = await pool.query(SELECT_TYPE_WEIGHTS, [blueprintId]);

  let typedWeight = 0, typedCount = 0, untypedWeight = 0, untypedCount = 0;
  const byTypeWeight = emptyMix();
  const byTypeCount = emptyMix();
  for (const r of rows) {
    const tk = String(r.type_key);
    const w = Number(r.wsum) || 0;
    const n = Number(r.n) || 0;
    if (tk === 'UNTYPED') { untypedWeight += w; untypedCount += n; continue; }
    if (DIMENSION_KEYS.includes(tk as DimensionKey)) {
      byTypeWeight[tk as DimensionKey] += w;
      byTypeCount[tk as DimensionKey] += n;
      typedWeight += w; typedCount += n;
    }
  }

  // Prefer real weights; fall back to competency COUNT if weights are absent/zero.
  const denominatorMode: 'weight' | 'count' = typedWeight > 0 ? 'weight' : 'count';
  const raw = denominatorMode === 'weight' ? byTypeWeight : byTypeCount;

  const present = DIMENSION_KEYS.filter((k) => raw[k] > 0);
  const absent = DIMENSION_KEYS.filter((k) => raw[k] <= 0);

  const notes: string[] = [];
  if (untypedCount > 0) notes.push(`${untypedCount} competency(ies) have no type mapping — excluded from the mix (not fabricated).`);
  for (const k of CONTENT_GAP_DIMENSIONS) {
    if (absent.includes(k)) notes.push(`'${k}' is 0% — honest content gap (sparsely/not represented in the genome), not a derivation error.`);
  }
  if (denominatorMode === 'count') notes.push('Blueprint competency weights were absent/zero — mix derived from competency COUNT per type.');

  const coverage: MixCoverage = {
    typed_competencies: typedCount,
    untyped_competencies: untypedCount,
    typed_weight: Math.round(typedWeight * 100) / 100,
    untyped_weight: Math.round(untypedWeight * 100) / 100,
    denominator_mode: denominatorMode,
    dimensions_present: present,
    dimensions_absent: absent,
    notes,
  };

  if (typedCount === 0) return { ok: false, error: 'insufficient_typing', coverage };

  return { ok: true, blueprint_id: blueprintId, source: 'derived', mix: normalizeToHundred(raw), coverage };
}

// ---------------------------------------------------------------------------
// Persist + read
// ---------------------------------------------------------------------------
function rowToMix(r: any): DimensionMix {
  return {
    behavioral: Number(r.behavioral_pct) || 0,
    cognitive: Number(r.cognitive_pct) || 0,
    functional: Number(r.functional_pct) || 0,
    technical: Number(r.technical_pct) || 0,
    future_skills: Number(r.future_skills_pct) || 0,
  };
}

async function saveDimensionMix(
  pool: Pool, blueprintId: string, mix: DimensionMix, source: string, coverage: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `INSERT INTO onto_blueprint_dimension_mix
       (blueprint_id, behavioral_pct, cognitive_pct, functional_pct, technical_pct, future_skills_pct, source, coverage)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (blueprint_id) DO UPDATE SET
       behavioral_pct=EXCLUDED.behavioral_pct, cognitive_pct=EXCLUDED.cognitive_pct,
       functional_pct=EXCLUDED.functional_pct, technical_pct=EXCLUDED.technical_pct,
       future_skills_pct=EXCLUDED.future_skills_pct, source=EXCLUDED.source,
       coverage=EXCLUDED.coverage, updated_at=now()`,
    [blueprintId, mix.behavioral, mix.cognitive, mix.functional, mix.technical, mix.future_skills, source, JSON.stringify(coverage)],
  );
}

export interface DimensionMixRow {
  blueprint_found: boolean;
  exists: boolean;
  blueprint_id: string;
  mix?: DimensionMix;
  source?: string;
  coverage?: Record<string, unknown>;
  validation?: ValidationResult;
  updated_at?: string;
}

export async function getDimensionMix(pool: Pool, blueprintId: string): Promise<DimensionMixRow> {
  await ensureBlueprintDimensionSchema(pool);
  if (!(await blueprintExists(pool, blueprintId))) return { blueprint_found: false, exists: false, blueprint_id: blueprintId };
  const { rows } = await pool.query(`SELECT * FROM onto_blueprint_dimension_mix WHERE blueprint_id = $1`, [blueprintId]);
  if (!rows.length) return { blueprint_found: true, exists: false, blueprint_id: blueprintId };
  const mix = rowToMix(rows[0]);
  return {
    blueprint_found: true,
    exists: true,
    blueprint_id: blueprintId,
    mix,
    source: rows[0].source,
    coverage: rows[0].coverage,
    validation: validateDimensionMix(mix),
    updated_at: rows[0].updated_at,
  };
}

export type BuildResult =
  | { ok: true; blueprint_id: string; source: string; mix: DimensionMix; coverage: Record<string, unknown>; validation: ValidationResult }
  | { ok: false; error: string; coverage?: Record<string, unknown>; validation?: ValidationResult };

/**
 * blueprint_builder orchestrator.
 *  - `weights` supplied  → AUTHOR an explicit mix (validated, persisted source='authored').
 *  - otherwise           → DERIVE from real competency data (persisted source='derived').
 */
export async function buildBlueprint(
  pool: Pool, blueprintId: string, weights?: Partial<Record<string, unknown>>,
): Promise<BuildResult> {
  await ensureBlueprintDimensionSchema(pool);
  if (!(await blueprintExists(pool, blueprintId))) return { ok: false, error: 'blueprint_not_found' };

  if (weights && Object.keys(weights).length > 0) {
    const validation = validateDimensionMix(weights);
    if (!validation.valid) return { ok: false, error: 'invalid_mix', validation };
    const mix: DimensionMix = {
      behavioral: Number(weights.behavioral ?? weights.behavioral_pct),
      cognitive: Number(weights.cognitive ?? weights.cognitive_pct),
      functional: Number(weights.functional ?? weights.functional_pct),
      technical: Number(weights.technical ?? weights.technical_pct),
      future_skills: Number(weights.future_skills ?? weights.future_skills_pct),
    };
    const coverage = { mode: 'authored', notes: ['Explicitly authored mix; not derived from competency data.'] };
    await saveDimensionMix(pool, blueprintId, mix, 'authored', coverage);
    return { ok: true, blueprint_id: blueprintId, source: 'authored', mix, coverage, validation };
  }

  const derived = await deriveDimensionMix(pool, blueprintId);
  if (!derived.ok) return { ok: false, error: derived.error, coverage: derived.coverage as any };
  const validation = validateDimensionMix(derived.mix);
  if (!validation.valid) return { ok: false, error: 'derived_mix_invalid', coverage: derived.coverage as any, validation };
  await saveDimensionMix(pool, blueprintId, derived.mix, 'derived', derived.coverage as any);
  return { ok: true, blueprint_id: blueprintId, source: 'derived', mix: derived.mix, coverage: derived.coverage as any, validation };
}
