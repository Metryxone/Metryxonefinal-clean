/**
 * Competency Fusion Engine — Phase 5 (additive, shadow-mode).
 *
 * Fuses competency signals from up to 9 sources into a single normalised view.
 * Pure-function core (`fuseCompetencies`) is deterministic given inputs.
 * Persistence writes to `competency_fusion_logs` only — NEVER mutates any
 * upstream scoring table.
 */
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';

export const COMPETENCY_FUSION_VERSION = '5.0.0';

export type FusionSource =
  | 'assessments'
  | 'resume'
  | 'github'
  | 'linkedin'
  | 'conversational'
  | 'learning_velocity'
  | 'market'
  | 'behavioral'
  | 'graph';

export type FusionSignal = {
  competencyId: string;
  source: FusionSource;
  /** Normalised 0..100. */
  score?: number;
  /** Normalised 0..1. */
  confidence?: number;
  /** Optional explicit evidence count from that source. */
  evidenceCount?: number;
  /** Optional ISO timestamp; older signals get lower implicit weight. */
  observedAt?: string;
};

export type FusedCompetency = {
  competency: string;
  score: number;
  confidence: number;
  evidenceCount: number;
  sourceCoverage: FusionSource[];
  sourceWeights: Record<string, number>;
  dispersion: number;
};

// Default weights — assessments + behavioral are highest-trust, learning/market are
// secondary context, others are corroborating signals.
const DEFAULT_WEIGHTS: Record<FusionSource, number> = {
  assessments: 1.0,
  behavioral: 0.85,
  graph: 0.7,
  conversational: 0.6,
  github: 0.55,
  linkedin: 0.5,
  resume: 0.45,
  learning_velocity: 0.4,
  market: 0.3,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) * (b - mean), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Pure fusion — given signals, returns one FusedCompetency per competencyId.
 * Caller is responsible for persistence and for picking what to do downstream.
 */
export function fuseCompetencies(signals: FusionSignal[]): FusedCompetency[] {
  const byComp = new Map<string, FusionSignal[]>();
  for (const s of signals) {
    if (!s.competencyId) continue;
    const arr = byComp.get(s.competencyId) ?? [];
    arr.push(s);
    byComp.set(s.competencyId, arr);
  }
  const out: FusedCompetency[] = [];
  for (const [competencyId, sigs] of byComp) {
    let wSum = 0;
    let scoreNum = 0;
    let confNum = 0;
    let confWSum = 0;
    let evidence = 0;
    const coverageSet = new Set<FusionSource>();
    const weights: Record<string, number> = {};
    const scoresForDispersion: number[] = [];
    for (const s of sigs) {
      const w = DEFAULT_WEIGHTS[s.source] ?? 0.25;
      coverageSet.add(s.source);
      weights[s.source] = (weights[s.source] ?? 0) + w;
      evidence += Math.max(1, s.evidenceCount ?? 1);
      if (typeof s.score === 'number' && Number.isFinite(s.score)) {
        scoreNum += s.score * w;
        wSum += w;
        scoresForDispersion.push(s.score);
      }
      if (typeof s.confidence === 'number' && Number.isFinite(s.confidence)) {
        confNum += s.confidence * w;
        confWSum += w;
      }
    }
    const fusedScore = wSum > 0 ? scoreNum / wSum : 0;
    const fusedConf = confWSum > 0 ? confNum / confWSum : 0;
    const dispersion = scoresForDispersion.length > 1
      ? clamp(stddev(scoresForDispersion) / 100, 0, 1)
      : 0;
    // Penalise confidence by dispersion (high disagreement → lower confidence).
    const adjustedConf = clamp(fusedConf * (1 - 0.5 * dispersion), 0, 1);
    out.push({
      competency: competencyId,
      score: clamp(fusedScore, 0, 100),
      confidence: adjustedConf,
      evidenceCount: evidence,
      sourceCoverage: Array.from(coverageSet),
      sourceWeights: weights,
      dispersion,
    });
  }
  // Stable order — competencyId asc.
  return out.sort((a, b) => a.competency.localeCompare(b.competency));
}

/** Best-effort persist. Returns the correlationId used. */
export async function persistFusion(
  pool: Pool,
  args: { userId: string; fused: FusedCompetency[]; shadowMode: boolean; correlationId?: string },
): Promise<string> {
  const corr = args.correlationId ?? randomUUID();
  for (const f of args.fused) {
    try {
      await pool.query(
        `INSERT INTO competency_fusion_logs
           (user_id, correlation_id, competency_id, fused_score, fused_confidence,
            evidence_count, source_coverage, source_weights, dispersion, engine_version, shadow_mode)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)`,
        [
          args.userId, corr, f.competency, f.score, f.confidence,
          f.evidenceCount, JSON.stringify(f.sourceCoverage),
          JSON.stringify(f.sourceWeights), f.dispersion,
          COMPETENCY_FUSION_VERSION, args.shadowMode,
        ],
      );
    } catch (err) {
      console.warn('[competency-fusion] persist failed:', (err as Error).message);
    }
  }
  return corr;
}

export async function recentFusion(pool: Pool, userId: string, limit = 50) {
  try {
    const r = await pool.query(
      `SELECT competency_id, fused_score, fused_confidence, evidence_count,
              source_coverage, dispersion, computed_at, correlation_id
         FROM competency_fusion_logs
        WHERE user_id = $1
        ORDER BY computed_at DESC LIMIT $2`,
      [userId, Math.max(1, Math.min(500, limit))],
    );
    return r.rows;
  } catch {
    return [];
  }
}
