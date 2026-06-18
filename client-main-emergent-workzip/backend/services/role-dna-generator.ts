/**
 * Role DNA Generator (V2)
 *
 * Generates a contextual Role DNA model on the fly by reading the
 * read-only Phase 1 ontology (onto_role_dna_profiles, onto_role_competency_weights,
 * onto_complexity_models, onto_organisational_layers) and projecting it through
 * runtime context (industry, layer, complexity, org_maturity).
 *
 * Pure-ish: no mutations to ontology tables. Persistence into role_dna_profiles_v2
 * is left to the caller (resolution engine) for caching / audit.
 *
 * Returns a normalised DNA envelope shape ready for the resolution engine.
 */
import type { Pool } from 'pg';

export const ROLE_DNA_GENERATOR_VERSION = '2.0.0';

export interface RoleDNAGenerationInput {
  roleId: string | null;
  layerId?: string | null;
  industryId?: string | null;
  complexityModelId?: string | null;
  orgMaturity?: string | null;
}

export interface RoleDNAEnvelope {
  role_id: string | null;
  layer_id: string | null;
  industry_id: string | null;
  complexity_model_id: string | null;
  dna_version: string;
  dna_name: string;
  dna_description: string;
  default_weightings: Record<string, number>;
  expected_levels: Record<string, number>;
  readiness_model: Record<string, unknown>;
  behavioral_model: Record<string, unknown>;
  technical_model: Record<string, unknown>;
  leadership_model: Record<string, unknown>;
  strategic_model: Record<string, unknown>;
  execution_model: Record<string, unknown>;
  confidence_model: { coverage: number; provenance: 'ontology' | 'fallback' };
  metadata: Record<string, unknown>;
}

/** Hard-coded fallback weights covering the 7-domain canon (sums to 1.0). */
const FALLBACK_WEIGHTS: Record<string, number> = {
  COG: 0.18, COM: 0.15, LEA: 0.15, EXE: 0.18, ADP: 0.12, TEC: 0.14, EIQ: 0.08,
};
const FALLBACK_LEVELS: Record<string, number> = {
  COG: 65, COM: 65, LEA: 60, EXE: 65, ADP: 60, TEC: 65, EIQ: 60,
};

async function safeQuery<T = any>(
  pool: Pool,
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    const r = await pool.query(text, params);
    return (r?.rows ?? []) as T[];
  } catch {
    return [];
  }
}

function l1Normalise(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return { ...FALLBACK_WEIGHTS };
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    out[k] = +(Math.max(0, v) / total).toFixed(4);
  }
  return out;
}

export async function generateRoleDNA(
  pool: Pool,
  input: RoleDNAGenerationInput
): Promise<RoleDNAEnvelope> {
  const { roleId, layerId, industryId, complexityModelId, orgMaturity } = input;

  // UUID guard — ontology columns are UUID; semantic tokens like "ai_ml"
  // are valid V2 context values but won't match the ontology, so we skip
  // the cast and fall back to canon weights gracefully.
  const isUuid = (v: string | null | undefined): boolean =>
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

  const ontoWeights = isUuid(roleId)
    ? await safeQuery<{ competency_code: string; weight: number; expected_level: number | null }>(
        pool,
        `
        SELECT
          c.code  AS competency_code,
          w.weight AS weight,
          w.expected_level AS expected_level
        FROM onto_role_competency_weights w
        JOIN onto_competencies c ON c.id = w.competency_id
        JOIN onto_role_dna_profiles p ON p.id = w.dna_profile_id
        WHERE p.role_id = $1::uuid AND p.is_current = TRUE
        `,
        [roleId]
      )
    : [];

  const layer = isUuid(layerId)
    ? (await safeQuery<{ name: string; level: number | null }>(
        pool,
        `SELECT name, level FROM onto_organisational_layers WHERE id = $1::uuid LIMIT 1`,
        [layerId]
      ))[0]
    : null;

  const complexity = isUuid(complexityModelId)
    ? (await safeQuery<{ name: string; complexity_score: number | null }>(
        pool,
        `SELECT name, complexity_score FROM onto_complexity_models WHERE id = $1::uuid LIMIT 1`,
        [complexityModelId]
      ))[0]
    : null;

  // Roll the ontology weights into the canonical 7-domain space (or fall back).
  const weightsRaw: Record<string, number> = {};
  const levels: Record<string, number> = {};
  for (const row of ontoWeights) {
    if (!row.competency_code) continue;
    weightsRaw[row.competency_code] = (weightsRaw[row.competency_code] ?? 0) + Number(row.weight || 0);
    if (row.expected_level != null) levels[row.competency_code] = Number(row.expected_level);
  }
  const provenance: 'ontology' | 'fallback' = Object.keys(weightsRaw).length ? 'ontology' : 'fallback';
  const default_weightings = provenance === 'ontology' ? l1Normalise(weightsRaw) : { ...FALLBACK_WEIGHTS };
  const expected_levels = { ...FALLBACK_LEVELS, ...levels };

  // Coverage = how many of the 7 canon codes the ontology populated.
  const canon = Object.keys(FALLBACK_WEIGHTS);
  const covered = canon.filter((k) => weightsRaw[k] != null).length;
  const coverage = +(covered / canon.length).toFixed(2);

  return {
    role_id: roleId,
    layer_id: layerId ?? null,
    industry_id: industryId ?? null,
    complexity_model_id: complexityModelId ?? null,
    dna_version: ROLE_DNA_GENERATOR_VERSION,
    dna_name: `dna:${roleId ?? 'generic'}:${layer?.name ?? 'any'}:${complexity?.name ?? 'std'}`,
    dna_description: `Generated DNA for role=${roleId ?? 'generic'} layer=${layer?.name ?? 'any'} complexity=${complexity?.name ?? 'std'} maturity=${orgMaturity ?? 'unspecified'}`,
    default_weightings,
    expected_levels,
    readiness_model: { threshold: 0.65, band_breaks: [0.4, 0.55, 0.7, 0.85] },
    behavioral_model: { signals: ['consistency', 'reverse', 'completion'], composite_floor: 0.5 },
    technical_model: { depth_levels: 5, breadth_levels: 3 },
    leadership_model: { layer: layer?.name ?? null, layer_level: layer?.level ?? null },
    strategic_model: { horizon_months: layer?.level && layer.level >= 4 ? 36 : 12 },
    execution_model: { complexity: complexity?.name ?? null, complexity_score: complexity?.complexity_score ?? null },
    confidence_model: { coverage, provenance },
    metadata: {
      generator: 'role-dna-generator',
      generator_version: ROLE_DNA_GENERATOR_VERSION,
      ontology_rows: ontoWeights.length,
    },
  };
}
