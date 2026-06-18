/**
 * OMEGA-X 3-Way Multiplier Matrix Scoring Engine
 *
 * Implements the canonical formula:
 *   componentScore = responseValue × w_severity × w_confidence × w_persistence
 *
 * Weights live in `capadex_atomic_signals` (severity_weight, confidence_weight,
 * persistence_weight — all REAL). This service exposes:
 *   1. `calculateOmegaXScore(payload)` — pure deterministic scorer (no DB)
 *   2. `hydrateAtomicWeights(pool, ids)` — DB lookup with `LOWER(TRIM())`
 *      normalisation so spreadsheet imports with mixed case / whitespace
 *      still match.
 *
 * Framed strictly as a developmental signal: no hiring/placement prediction.
 */

import type { Pool } from 'pg';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AtomicWeights {
  severity_weight: number;
  confidence_weight: number;
  persistence_weight: number;
}

export interface OmegaXResponse {
  /** Atomic signal id from `capadex_atomic_signals.atomic_signal_id`. */
  atomic_signal_id: string;
  /** Raw response value on a 0..1 (or 0..N) scale. The scorer is unit-agnostic. */
  response_value: number;
  /** Per-signal weights, ideally hydrated from DB before scoring. */
  weights?: Partial<AtomicWeights>;
}

export interface OmegaXScorePayload {
  responses: OmegaXResponse[];
  /**
   * Optional fallback weights applied when a response is missing a weight
   * (e.g. an atomic_signal_id that didn't hydrate). 1.0 is the identity —
   * the multiplier becomes a no-op, preserving the raw response value.
   */
  defaultWeights?: Partial<AtomicWeights>;
}

export interface OmegaXComponentScore {
  atomic_signal_id: string;
  response_value: number;
  applied_weights: AtomicWeights;
  component_score: number;
}

export interface OmegaXScoreResult {
  components: OmegaXComponentScore[];
  /** Sum of all component scores. */
  total_score: number;
  /** Weighted average normalised by the sum of (w_s · w_c · w_p) products. */
  normalised_score: number;
  /** Telemetry for explainability. */
  meta: {
    response_count: number;
    fully_weighted_count: number;
    fallback_weighted_count: number;
    skipped_count: number;
  };
  /** Developmental framing — surfaced verbatim by consuming services. */
  framing: 'developmental_signal_only';
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Identity weights — a 1.0 leaves the response value untouched by that axis. */
export const IDENTITY_WEIGHTS: AtomicWeights = Object.freeze({
  severity_weight: 1.0,
  confidence_weight: 1.0,
  persistence_weight: 1.0,
}) as AtomicWeights;

// ─── Pure scorer ─────────────────────────────────────────────────────────────

/**
 * Compute the OMEGA-X multiplier-matrix score for a batch of responses.
 *
 * Deterministic and side-effect-free. Safe to unit-test without a DB or any
 * fixtures — pass `responses[].weights` inline.
 */
export function calculateOmegaXScore(payload: OmegaXScorePayload): OmegaXScoreResult {
  const fallback: AtomicWeights = {
    severity_weight: numOr(payload.defaultWeights?.severity_weight, 1.0),
    confidence_weight: numOr(payload.defaultWeights?.confidence_weight, 1.0),
    persistence_weight: numOr(payload.defaultWeights?.persistence_weight, 1.0),
  };

  let total = 0;
  let weightSum = 0;
  let fully = 0;
  let fallbackUsed = 0;
  let skipped = 0;

  const components: OmegaXComponentScore[] = [];

  for (const r of payload.responses) {
    if (!Number.isFinite(r.response_value)) {
      skipped += 1;
      continue;
    }

    const hasAll =
      Number.isFinite(r.weights?.severity_weight) &&
      Number.isFinite(r.weights?.confidence_weight) &&
      Number.isFinite(r.weights?.persistence_weight);

    const applied: AtomicWeights = {
      severity_weight: numOr(r.weights?.severity_weight, fallback.severity_weight),
      confidence_weight: numOr(r.weights?.confidence_weight, fallback.confidence_weight),
      persistence_weight: numOr(r.weights?.persistence_weight, fallback.persistence_weight),
    };

    // ── Core 3-way multiplier matrix ──
    const product =
      applied.severity_weight * applied.confidence_weight * applied.persistence_weight;
    const component = r.response_value * product;

    components.push({
      atomic_signal_id: r.atomic_signal_id,
      response_value: r.response_value,
      applied_weights: applied,
      component_score: component,
    });

    total += component;
    weightSum += product;
    if (hasAll) fully += 1; else fallbackUsed += 1;
  }

  const normalised = weightSum > 0 ? total / weightSum : 0;

  return {
    components,
    total_score: total,
    normalised_score: normalised,
    meta: {
      response_count: payload.responses.length,
      fully_weighted_count: fully,
      fallback_weighted_count: fallbackUsed,
      skipped_count: skipped,
    },
    framing: 'developmental_signal_only',
  };
}

// ─── DB hydration ────────────────────────────────────────────────────────────

/**
 * Bulk-fetch atomic-signal weights from the DB.
 *
 * Matching uses `LOWER(TRIM(atomic_signal_id))` on both sides so spreadsheet
 * imports with trailing whitespace or mixed case still resolve. Unknown ids
 * silently drop out — callers should fall back to `defaultWeights` when a
 * lookup misses (the pure scorer handles this automatically).
 */
export async function hydrateAtomicWeights(
  pool: Pool | null | undefined,
  ids: string[],
): Promise<Map<string, AtomicWeights>> {
  const out = new Map<string, AtomicWeights>();
  if (!pool || !ids || ids.length === 0) return out;

  const normalised = Array.from(new Set(ids.map(s => String(s).toLowerCase().trim())))
    .filter(s => s.length > 0);
  if (normalised.length === 0) return out;

  try {
    const rs = await pool.query<{
      atomic_signal_id: string;
      severity_weight: number | null;
      confidence_weight: number | null;
      persistence_weight: number | null;
    }>(
      `SELECT atomic_signal_id,
              severity_weight,
              confidence_weight,
              persistence_weight
         FROM capadex_atomic_signals
        WHERE LOWER(TRIM(atomic_signal_id)) = ANY($1::text[])`,
      [normalised],
    );

    for (const row of rs.rows) {
      const key = String(row.atomic_signal_id).toLowerCase().trim();
      out.set(key, {
        severity_weight: numOr(row.severity_weight, 1.0),
        confidence_weight: numOr(row.confidence_weight, 1.0),
        persistence_weight: numOr(row.persistence_weight, 1.0),
      });
    }
  } catch (err) {
    // Log and return whatever we managed to collect — never throw upstream.
    console.error('[omega-x-scoring] hydrateAtomicWeights failed:', err);
  }
  return out;
}

/**
 * Convenience: hydrate then score in one call. Responses without an
 * `atomic_signal_id` resolution fall back to identity / `defaultWeights`.
 */
export async function calculateOmegaXScoreWithDb(
  pool: Pool | null | undefined,
  payload: OmegaXScorePayload,
): Promise<OmegaXScoreResult> {
  const ids = payload.responses.map(r => r.atomic_signal_id).filter(Boolean);
  const weights = await hydrateAtomicWeights(pool, ids);

  const hydrated: OmegaXResponse[] = payload.responses.map(r => {
    const key = String(r.atomic_signal_id ?? '').toLowerCase().trim();
    const dbW = weights.get(key);
    return dbW ? { ...r, weights: { ...dbW, ...r.weights } } : r;
  });

  return calculateOmegaXScore({ responses: hydrated, defaultWeights: payload.defaultWeights });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function numOr(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
