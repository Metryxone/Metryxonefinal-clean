/**
 * Confidence Calibration Engine — Phase 5 (additive, shadow-mode).
 *
 * Computes a calibrated confidence number per competency from the inputs the
 * spec lists: evidence count, evidence diversity, source coverage, decay,
 * benchmark confidence, and last-validated freshness.
 *
 * Pure-function core. Persists to `confidence_calibration_logs` only.
 */
import type { Pool } from 'pg';

export const CONFIDENCE_CALIBRATION_VERSION = '5.0.0';

export type CalibrationInput = {
  competencyId: string;
  evidenceCount: number;
  /** Distinct source count. */
  sourceCoverage: string[];
  /** ISO timestamp of last validation. Older → larger decay. */
  lastValidatedAt?: string | Date | null;
  /** Optional confidence reported by a benchmark study (0..1). */
  benchmarkConfidence?: number;
  /** Optional disagreement among sources (0..1; from fusion). */
  dispersion?: number;
};

export type CalibrationOutput = {
  competencyId: string;
  confidence: number;
  evidenceCount: number;
  evidenceDiversity: number;
  sourceCoverage: string[];
  decayFactor: number;
  benchmarkConfidence: number;
  lastValidatedAt: string | null;
  components: {
    evidenceComponent: number;
    diversityComponent: number;
    decayComponent: number;
    benchmarkComponent: number;
    dispersionPenalty: number;
  };
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Logistic-ish curve. 0 evidence → 0, 8+ → ~1. */
function evidenceCurve(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return clamp(1 - Math.exp(-n / 4), 0, 1);
}

/** Diversity = unique sources / target (cap at 5). 0..1. */
function diversityFromCoverage(coverage: string[]): number {
  const unique = new Set(coverage.filter(Boolean));
  return clamp(unique.size / 5, 0, 1);
}

/** Decay: 0 = fresh, 1 = stale (no decay penalty when fresh). */
function decayFromTimestamp(ts?: string | Date | null): number {
  if (!ts) return 0.5; // unknown → mid-decay
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return 0.5;
  const days = (Date.now() - d.getTime()) / 86_400_000;
  if (days <= 0) return 0;
  // Half-life ~ 90 days; decay asymptotes to 1.
  return clamp(1 - Math.pow(0.5, days / 90), 0, 1);
}

export function calibrate(input: CalibrationInput): CalibrationOutput {
  const evidenceComponent = evidenceCurve(input.evidenceCount);
  const diversityComponent = diversityFromCoverage(input.sourceCoverage ?? []);
  const decay = decayFromTimestamp(input.lastValidatedAt);
  // Decay reduces confidence (1 - decay).
  const decayComponent = 1 - decay;
  const benchmarkComponent = clamp(input.benchmarkConfidence ?? 0.5, 0, 1);
  const dispersionPenalty = clamp(input.dispersion ?? 0, 0, 1);

  // Weighted blend; weights sum to 1.
  const raw =
    0.35 * evidenceComponent +
    0.20 * diversityComponent +
    0.20 * decayComponent +
    0.25 * benchmarkComponent;

  const confidence = clamp(raw * (1 - 0.4 * dispersionPenalty), 0, 1);

  return {
    competencyId: input.competencyId,
    confidence,
    evidenceCount: input.evidenceCount,
    evidenceDiversity: diversityComponent,
    sourceCoverage: Array.from(new Set(input.sourceCoverage ?? [])),
    decayFactor: decay,
    benchmarkConfidence: benchmarkComponent,
    lastValidatedAt: input.lastValidatedAt
      ? (input.lastValidatedAt instanceof Date ? input.lastValidatedAt.toISOString() : String(input.lastValidatedAt))
      : null,
    components: {
      evidenceComponent, diversityComponent, decayComponent,
      benchmarkComponent, dispersionPenalty,
    },
  };
}

export async function persistCalibration(
  pool: Pool,
  args: { userId: string; results: CalibrationOutput[] },
): Promise<void> {
  for (const r of args.results) {
    try {
      await pool.query(
        `INSERT INTO confidence_calibration_logs
           (user_id, competency_id, confidence, evidence_count, evidence_diversity,
            source_coverage, decay_factor, benchmark_confidence, last_validated_at,
            components, engine_version)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::jsonb, $11)`,
        [
          args.userId, r.competencyId, r.confidence, r.evidenceCount, r.evidenceDiversity,
          JSON.stringify(r.sourceCoverage), r.decayFactor, r.benchmarkConfidence,
          r.lastValidatedAt, JSON.stringify(r.components), CONFIDENCE_CALIBRATION_VERSION,
        ],
      );
    } catch (err) {
      console.warn('[confidence-calibration] persist failed:', (err as Error).message);
    }
  }
}

export async function getLatestCalibration(pool: Pool, userId: string, competencyId: string) {
  try {
    const r = await pool.query(
      `SELECT competency_id, confidence, evidence_count, evidence_diversity,
              source_coverage, decay_factor, benchmark_confidence, last_validated_at,
              components, computed_at
         FROM confidence_calibration_logs
        WHERE user_id = $1 AND competency_id = $2
        ORDER BY computed_at DESC LIMIT 1`,
      [userId, competencyId],
    );
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}
