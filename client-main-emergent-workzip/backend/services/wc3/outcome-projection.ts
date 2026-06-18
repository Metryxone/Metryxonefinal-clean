/**
 * WC-3 L5C (Runtime) — Outcome Projection Intelligence.
 *
 * Deterministic, pure projection along the APPROVED chain:
 *
 *     Question → Bridge Tag → Construct → Outcome Model
 *
 * Uses ONLY:
 *  - the frozen, approved crosswalk (backend/data/bridge-tag-construct-crosswalk.ts) —
 *    bridge_tag → construct (HIGH_CONFIDENCE) | candidates (REVIEW_REQUIRED) | none (UNMAPPED).
 *  - the existing 7 `wc3_outcome_models` rows (construct_keys + gated flag).
 *
 * It introduces NO new constructs, NO new outcome models, and does NOT touch the
 * crosswalk. The module is additive: it is imported by the L5C build/measurement
 * script (scripts/wc3/build-outcome-projection.ts) and is NOT wired into any live
 * selection / scoring path. Wiring into the runtime is the approval-gated next phase.
 *
 * Derives, per bridge tag:
 *   - Primary Outcome   — highest-scoring reachable outcome model
 *   - Secondary Outcome — next distinct reachable outcome model (honest ambiguity)
 *   - Outcome Confidence — base crosswalk confidence × model-score concentration
 *   - Ambiguity         — 1 − concentration (how spread the construct is across models)
 *
 * Honesty contract: UNMAPPED tags and constructs that reach no outcome model yield a
 * null primary outcome (never forced). Confidence/ambiguity are derived only from the
 * chain above — stage (L5A) and context (L5B) are cross-tabulated downstream, never
 * folded into outcome confidence.
 */

import {
  resolveConstructForBridgeTag,
  type CrosswalkEntry,
} from '../../data/bridge-tag-construct-crosswalk';

/** Minimal shape of a `wc3_outcome_models` row needed for projection. */
export interface OutcomeModelLite {
  model_key: string;
  construct_keys: string[];
  gated: boolean;
}

export interface OutcomeProjection {
  bridge_tag: string;
  construct: string | null;
  crosswalk_status: CrosswalkEntry['status'] | 'ABSENT';
  /** Highest-scoring reachable outcome model, or null when none is reachable. */
  primary_outcome: string | null;
  /** Next distinct reachable outcome model, or null. */
  secondary_outcome: string | null;
  /** 0..1 — base crosswalk confidence × primary-model score concentration. */
  outcome_confidence: number;
  /** 0..1 — 1 − concentration; 0 when a single model is reached or none is. */
  ambiguity: number;
  /** All reachable models, deterministically ranked (primary first). */
  ranked_models: string[];
  /** true when every reachable model is gated (e.g. only exam_readiness). */
  gated_only: boolean;
  reason: string;
}

const round = (x: number, p = 3): number => {
  const f = 10 ** p;
  return Math.round(x * f) / f;
};

/**
 * Deterministic comparator for ranking reachable outcome models.
 * Order: higher score → ungated before gated → fewer construct_keys (more specific)
 * → model_key alphabetical. Total order, so output is reproducible.
 */
function rankModels(
  scores: Map<string, number>,
  modelsByKey: Map<string, OutcomeModelLite>,
): string[] {
  return [...scores.keys()].sort((a, b) => {
    const sa = scores.get(a)!;
    const sb = scores.get(b)!;
    if (sb !== sa) return sb - sa;
    const ma = modelsByKey.get(a)!;
    const mb = modelsByKey.get(b)!;
    if (ma.gated !== mb.gated) return ma.gated ? 1 : -1;
    if (ma.construct_keys.length !== mb.construct_keys.length) {
      return ma.construct_keys.length - mb.construct_keys.length;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/**
 * Pure projection from a crosswalk entry onto the outcome models.
 * No DB, no IO — fully deterministic given the same inputs.
 */
export function projectOutcome(
  bridgeTag: string,
  entry: CrosswalkEntry | null,
  models: OutcomeModelLite[],
): OutcomeProjection {
  const modelsByKey = new Map(models.map((m) => [m.model_key, m]));

  // Construct contributions: HIGH → one construct; REVIEW → candidates; else none.
  const contributions: Array<{ construct: string; conf: number }> = [];
  let status: OutcomeProjection['crosswalk_status'] = 'ABSENT';
  if (entry) {
    status = entry.status;
    if (entry.status === 'HIGH_CONFIDENCE' && entry.construct) {
      contributions.push({ construct: entry.construct, conf: entry.confidence });
    } else if (entry.status === 'REVIEW_REQUIRED' && entry.candidates) {
      for (const c of entry.candidates) contributions.push({ construct: c, conf: entry.confidence });
    }
  }

  if (contributions.length === 0) {
    return {
      bridge_tag: bridgeTag,
      construct: entry?.construct ?? null,
      crosswalk_status: status,
      primary_outcome: null,
      secondary_outcome: null,
      outcome_confidence: 0,
      ambiguity: 0,
      ranked_models: [],
      gated_only: false,
      reason:
        status === 'UNMAPPED'
          ? 'no construct (UNMAPPED) → no outcome model'
          : status === 'ABSENT'
            ? 'bridge tag absent from crosswalk → no outcome model'
            : 'construct(s) reach no outcome model',
    };
  }

  // Score each reachable model by summed contribution confidence.
  const scores = new Map<string, number>();
  for (const { construct, conf } of contributions) {
    for (const m of models) {
      if (m.construct_keys.includes(construct)) {
        scores.set(m.model_key, (scores.get(m.model_key) ?? 0) + conf);
      }
    }
  }

  if (scores.size === 0) {
    const constructList = contributions.map((c) => c.construct).join(' | ');
    return {
      bridge_tag: bridgeTag,
      construct: entry?.construct ?? (contributions.length === 1 ? contributions[0].construct : null),
      crosswalk_status: status,
      primary_outcome: null,
      secondary_outcome: null,
      outcome_confidence: 0,
      ambiguity: 0,
      ranked_models: [],
      gated_only: false,
      reason: `construct(s) [${constructList}] are in no outcome model's construct_keys`,
    };
  }

  const ranked = rankModels(scores, modelsByKey);
  const primary = ranked[0];
  const secondary = ranked[1] ?? null;
  const total = [...scores.values()].reduce((s, v) => s + v, 0);
  const concentration = scores.get(primary)! / total;
  const baseConf = Math.max(...contributions.map((c) => c.conf));
  const gatedOnly = ranked.every((k) => modelsByKey.get(k)!.gated);

  return {
    bridge_tag: bridgeTag,
    construct: entry?.construct ?? (contributions.length === 1 ? contributions[0].construct : null),
    crosswalk_status: status,
    primary_outcome: primary,
    secondary_outcome: secondary,
    outcome_confidence: round(baseConf * concentration),
    ambiguity: round(1 - concentration),
    ranked_models: ranked,
    gated_only: gatedOnly,
    reason:
      status === 'REVIEW_REQUIRED'
        ? `REVIEW candidates → ${ranked.length} model(s); primary ${primary}`
        : `HIGH construct ${entry?.construct} → ${ranked.length} model(s); primary ${primary}`,
  };
}

/** Convenience: resolve the bridge tag via the crosswalk, then project. */
export function projectOutcomeForBridgeTag(
  bridgeTag: string,
  models: OutcomeModelLite[],
): OutcomeProjection {
  return projectOutcome(bridgeTag, resolveConstructForBridgeTag(bridgeTag), models);
}

/**
 * Per-outcome-model confidence vector for a crosswalk entry — the same scoring
 * `projectOutcome` uses internally, exposed for downstream composition (L5D journey
 * projection). For each reachable model: confidence = baseConf × (model_score / total),
 * so the primary model carries the highest confidence and the vector sums to baseConf.
 * Empty map when no construct reaches any model (honest — no outcome → no journey).
 * Additive: does NOT alter `projectOutcome` behaviour.
 */
export function outcomeModelConfidences(
  entry: CrosswalkEntry | null,
  models: OutcomeModelLite[],
): { confidences: Map<string, number>; baseConf: number } {
  const contributions: Array<{ construct: string; conf: number }> = [];
  if (entry) {
    if (entry.status === 'HIGH_CONFIDENCE' && entry.construct) {
      contributions.push({ construct: entry.construct, conf: entry.confidence });
    } else if (entry.status === 'REVIEW_REQUIRED' && entry.candidates) {
      for (const c of entry.candidates) contributions.push({ construct: c, conf: entry.confidence });
    }
  }
  const scores = new Map<string, number>();
  for (const { construct, conf } of contributions) {
    for (const m of models) {
      if (m.construct_keys.includes(construct)) scores.set(m.model_key, (scores.get(m.model_key) ?? 0) + conf);
    }
  }
  const total = [...scores.values()].reduce((s, v) => s + v, 0);
  const baseConf = contributions.length ? Math.max(...contributions.map((c) => c.conf)) : 0;
  const confidences = new Map<string, number>();
  if (total > 0) for (const [k, v] of scores) confidences.set(k, (v / total) * baseConf);
  return { confidences, baseConf };
}
