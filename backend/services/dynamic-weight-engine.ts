/**
 * Dynamic Weight Engine (V2)
 *
 * Pure-function engine that produces context-sensitive competency weights
 * WITHOUT any hardcoded role priorities. Weights flow from:
 *
 *   1. Base Role DNA (ontology-driven)             — role-dna-generator
 *   2. Context modifiers (industry / org / layer)  — competency_context_modifiers
 *   3. L1-normalisation                            — sum(weights) = 1
 *
 * This engine is intentionally side-effect-free. The resolution engine
 * (`competency-resolution-engine.ts`) owns persistence; this file owns the
 * pure math + classification semantics so other modules (benchmark, mobility,
 * coaching, workforce intelligence, simulations, predictive) can consume the
 * same weight derivation without re-implementing it.
 *
 * Single source of truth contract:
 *   - Same inputs → same outputs (deterministic).
 *   - No role-priority tables, no hardcoded role lists.
 *   - All decisions are explainable via `WeightDerivation.rationale`.
 */
import type { RoleDNAEnvelope } from './role-dna-generator';
import type { ContextModifier, AppliedModifierSummary } from './competency-resolution-engine';

export const DYNAMIC_WEIGHT_VERSION = '1.0.0';

export type Criticality = 'critical' | 'high' | 'medium' | 'low';

export interface WeightDerivationEntry {
  competency_code: string;
  importance_weight: number;       // 0..1 (L1-normalised)
  importance_pct: number;          // 0..100 (display-friendly)
  expected_level: number;          // 0..100
  minimum_threshold: number;       // 0..100 (== 70% of expected by default)
  growth_priority: number;         // 0..100 (heuristic — bigger gap × bigger weight)
  criticality: Criticality;
  // Lineage so callers can render "why is this weight what it is?"
  rationale: string;
  applied_modifiers: string[];     // modifier_type:modifier_name list
}

export interface DynamicWeightEnvelope {
  intensity: number;               // 0..1 (assessment intensity multiplier)
  entries: WeightDerivationEntry[];
  totals: {
    competencies: number;
    sum_weight: number;            // should be ~1.0 after normalisation
  };
  methodology_version: string;
}

/* ------------------------------------------------------------------ */
/* Core math                                                          */
/* ------------------------------------------------------------------ */

export function l1Normalise(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((s, v) => s + (v > 0 ? v : 0), 0);
  if (total <= 0) return weights;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    out[k] = (v > 0 ? v : 0) / total;
  }
  return out;
}

export function classifyCriticality(weight: number): Criticality {
  if (weight >= 0.20) return 'critical';
  if (weight >= 0.12) return 'high';
  if (weight >= 0.07) return 'medium';
  return 'low';
}

/**
 * Compute the dynamic weight envelope from base Role DNA + context modifiers.
 * Pure: no DB, no IO. Safe to call from any module needing the same view.
 */
export function computeDynamicWeights(
  dna: RoleDNAEnvelope,
  modifiers: ContextModifier[] = [],
): DynamicWeightEnvelope {
  // 1) Seed with DNA-derived weights/levels
  const weights: Record<string, number> = { ...dna.default_weightings };
  const levels: Record<string, number> = { ...dna.expected_levels };
  let intensity = 0.5;
  const applied: AppliedModifierSummary[] = [];

  // 2) Apply context modifiers (multiplicative on weights, additive on levels)
  for (const m of modifiers ?? []) {
    const eff = m.modifier_effect ?? {};
    const affected = new Set<string>();
    for (const [code, mult] of Object.entries(eff.weight_multipliers ?? {})) {
      const cur = weights[code] ?? 0;
      const next = Math.max(0, cur * Number(mult));
      weights[code] = next;
      affected.add(code);
    }
    for (const [code, delta] of Object.entries(eff.expected_level_delta ?? {})) {
      const cur = levels[code] ?? 0;
      levels[code] = Math.max(0, Math.min(100, cur + Number(delta)));
      affected.add(code);
    }
    if (typeof eff.intensity_delta === 'number') {
      intensity = Math.max(0, Math.min(1, intensity + eff.intensity_delta));
    }
    applied.push({
      modifier_type: m.modifier_type,
      modifier_name: m.modifier_name,
      adjustment_weight: Number(m.adjustment_weight ?? 1),
      affected_competencies: Array.from(affected),
    });
  }

  // 3) L1-normalise so weights sum to 1
  const finalWeights = l1Normalise(weights);

  // 4) Build per-competency derivation entries with rationale
  const entries: WeightDerivationEntry[] = [];
  for (const code of Object.keys(finalWeights).sort()) {
    const w = finalWeights[code] ?? 0;
    const lvl = levels[code] ?? 0;
    const mods = applied.filter((a) => a.affected_competencies.includes(code));
    const modLabels = mods.map((m) => `${m.modifier_type}:${m.modifier_name}`);
    const rationale = mods.length
      ? `Base DNA × ${mods.length} modifier${mods.length === 1 ? '' : 's'} (${modLabels.join(', ')})`
      : 'Base DNA only';
    entries.push({
      competency_code: code,
      importance_weight: +w.toFixed(4),
      importance_pct: +(w * 100).toFixed(2),
      expected_level: +lvl.toFixed(2),
      minimum_threshold: +(lvl * 0.70).toFixed(2),
      growth_priority: +Math.min(100, Math.max(0, (lvl * 0.20) + (w * 50))).toFixed(2),
      criticality: classifyCriticality(w),
      rationale,
      applied_modifiers: modLabels,
    });
  }

  const sum = entries.reduce((s, e) => s + e.importance_weight, 0);
  return {
    intensity: +intensity.toFixed(2),
    entries,
    totals: {
      competencies: entries.length,
      sum_weight: +sum.toFixed(4),
    },
    methodology_version: DYNAMIC_WEIGHT_VERSION,
  };
}

/**
 * Convenience: surface just the per-competency map → weight for consumers
 * (benchmark / coaching / mobility) that don't need the full envelope.
 */
export function toWeightMap(envelope: DynamicWeightEnvelope): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of envelope.entries) out[e.competency_code] = e.importance_weight;
  return out;
}
