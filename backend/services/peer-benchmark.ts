/**
 * Peer Benchmark Engine (METHODOLOGY v1.0.0)
 *
 * Computes a user's percentile position vs. a peer cohort drawn from
 * `ei_calculation_logs`. Strictly aggregate, version-pinned, k-anonymous.
 *
 * Design constraints
 * ──────────────────
 *   • DETERMINISTIC: same inputs → same outputs (no random sampling).
 *   • VERSION-PINNED: cohort filtered by ei_version + ruleset_version so a
 *     user is never compared to scores produced under a different scoring
 *     rule set.
 *   • LEGALLY DEFENSIBLE:
 *       – No individual records leave this module. Only aggregates
 *         (n, mean, std, percentiles) cross the boundary.
 *       – k-ANONYMITY (k = 30): a cohort smaller than k is widened
 *         progressively (band → all stages → global) until k is met.
 *       – If even the global pool is < k, we return `cohort_anonymity_met
 *         = false` and the caller MUST suppress the percentile.
 *       – `min_cohort_size` is the hard floor and is part of the response,
 *         so the UI can show "provisional" explicitly.
 *   • SCIENTIFIC:
 *       – Percentile derived from z-score against cohort mean/std using
 *         the standard-normal CDF (Abramowitz & Stegun 7.1.26).
 *       – 95% confidence interval on the user's score using standard error
 *         of the cohort estimate (SE = σ / √n).
 *       – Also returns empirical percentiles (p25/p50/p75/p90) computed
 *         directly from the cohort via PERCENTILE_CONT — these don't assume
 *         normality and are the authoritative "where do I sit" anchors.
 *   • COMPETITIVE / GROWTH-ORIENTED:
 *       – Computes "points to next stage" and "people ahead of you in this
 *         band" so the UI can frame progression as a concrete target.
 */

import type { Pool } from 'pg';

export const PEER_BENCHMARK_METHODOLOGY_VERSION = '1.0.0';
export const K_ANONYMITY_MIN = 30;

export interface StageBand {
  key: 'starter' | 'builder' | 'career-ready' | 'hire-ready';
  label: string;
  min: number;
  max: number;
}

export const STAGE_BANDS: StageBand[] = [
  { key: 'starter',      label: 'Starter',      min: 0,  max: 24  },
  { key: 'builder',      label: 'Builder',      min: 25, max: 49  },
  { key: 'career-ready', label: 'Career-Ready', min: 50, max: 74  },
  { key: 'hire-ready',   label: 'Hire-Ready',   min: 75, max: 100 },
];

export function stageBandForScore(score: number): StageBand {
  for (const b of STAGE_BANDS) if (score >= b.min && score <= b.max) return b;
  return STAGE_BANDS[0];
}

export function nextStageBand(score: number): StageBand | null {
  const cur = stageBandForScore(score);
  const idx = STAGE_BANDS.findIndex(b => b.key === cur.key);
  return idx >= 0 && idx < STAGE_BANDS.length - 1 ? STAGE_BANDS[idx + 1] : null;
}

export type CohortScope = 'stage_band' | 'all_stages';
export type SuppressionReason = 'insufficient_cohort' | 'zero_variance' | null;

export interface PeerBenchmarkInput {
  score: number;
  ei_version: string;
  ruleset_version: string;
}

export interface CohortStats {
  // When cohort_anonymity_met=false, every numeric field below is REDACTED to
  // null. Only `scope` + `scope_label` survive — those describe the QUERY
  // (which band/ruleset was probed), not the underlying members, so they
  // carry no re-identification risk.
  n: number | null;
  mean: number | null;
  std: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
  scope: CohortScope;
  scope_label: string;
}

export interface PeerBenchmarkResult {
  // ── User position ─────────────────────────────────────────────
  score: number;
  z_score: number;
  percentile: number | null;           // null when cohort is insufficient
  rank_label: string;                  // "Top 23%" / "Provisional" / etc.
  position_in_band: number;            // 0..1 within current stage band

  // ── Cohort ────────────────────────────────────────────────────
  cohort: CohortStats;
  cohort_anonymity_met: boolean;       // n >= K_ANONYMITY_MIN
  min_cohort_size: number;             // K_ANONYMITY_MIN
  suppression_reason: SuppressionReason; // why percentile is null (if it is)
  confidence_interval_low: number;
  confidence_interval_high: number;

  // ── Stage / progression ──────────────────────────────────────
  current_stage: StageBand;
  next_stage: StageBand | null;
  pts_to_next_stage: number;
  people_ahead_in_band: number | null; // suppressed if cohort < k

  // ── Methodology & version pinning ─────────────────────────────
  methodology_version: string;
  ei_version: string;
  ruleset_version: string;
  computed_at: string;
}

// ─── Stats helpers ────────────────────────────────────────────────

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 7.5e-8). */
function normCdf(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const zAbs = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + p * zAbs);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-zAbs * zAbs);
  return 0.5 * (1 + sign * y);
}

function zToPercentile(z: number): number {
  return Math.round(Math.min(99, Math.max(1, normCdf(z) * 100)));
}

function rankLabel(pct: number | null): string {
  if (pct == null) return 'Provisional — cohort still building';
  if (pct >= 90)   return `Top ${100 - pct}% — elite tier`;
  if (pct >= 75)   return `Top ${100 - pct}% — upper quartile`;
  if (pct >= 50)   return `Top ${100 - pct}% — above median`;
  if (pct >= 25)   return `Above ${pct}% of peers — building`;
  return `In the bottom ${pct}% — early stage`;
}

// ─── Cohort fetch with k-anonymity widening ───────────────────────

/**
 * Fetch cohort stats. Both scopes remain VERSION-PINNED (ei_version +
 * ruleset_version) — we widen only the score range, never the ruleset. If
 * even the all-stages cohort on the same ruleset is below the k-anonymity
 * floor, we return that widest scope with `cohort_anonymity_met=false` and
 * the caller suppresses the percentile.
 *
 * Opted-out users (rows in `benchmark_exclusions`) are filtered out
 * regardless of scope, making the methodology's opt-out claim enforceable.
 */
async function fetchCohortStats(
  pool: Pool,
  eiVersion: string,
  rulesetVersion: string,
  band: StageBand,
): Promise<CohortStats> {
  const queries: { scope: CohortScope; label: string; extra: string; extraParams: any[] }[] = [
    {
      scope: 'stage_band',
      label: `${band.label}-stage cohort (EI v${eiVersion} · ruleset v${rulesetVersion})`,
      extra: `AND capability_score BETWEEN $3 AND $4`,
      extraParams: [band.min, band.max],
    },
    {
      scope: 'all_stages',
      label: `All stages (EI v${eiVersion} · ruleset v${rulesetVersion})`,
      extra: ``,
      extraParams: [],
    },
  ];

  let widest: CohortStats | null = null;
  for (const q of queries) {
    const params = [eiVersion, rulesetVersion, ...q.extraParams];
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS n,
         COALESCE(AVG(capability_score),    0) AS mean,
         COALESCE(STDDEV(capability_score), 0) AS std,
         COALESCE(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY capability_score), 0) AS p25,
         COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY capability_score), 0) AS p50,
         COALESCE(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY capability_score), 0) AS p75,
         COALESCE(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY capability_score), 0) AS p90
       FROM ei_calculation_logs l
       WHERE l.source = 'resolve' AND l.fallback_used = false
         AND l.ei_version = $1 AND l.ruleset_version = $2
         ${q.extra}
         AND (l.user_id IS NULL OR l.user_id NOT IN (SELECT user_id FROM benchmark_exclusions))`,
      params,
    );
    const r = rows[0] || {};
    const stats: CohortStats = {
      n:    Number(r.n)    || 0,
      mean: parseFloat(r.mean) || 0,
      std:  parseFloat(r.std)  || 0,
      p25:  parseFloat(r.p25)  || 0,
      p50:  parseFloat(r.p50)  || 0,
      p75:  parseFloat(r.p75)  || 0,
      p90:  parseFloat(r.p90)  || 0,
      scope: q.scope,
      scope_label: q.label,
    };
    widest = stats;
    if (stats.n >= K_ANONYMITY_MIN) return stats;
  }
  return widest!;
}

// ─── Public API ───────────────────────────────────────────────────

export async function computePeerBenchmark(
  pool: Pool,
  input: PeerBenchmarkInput,
): Promise<PeerBenchmarkResult> {
  const score = Math.max(0, Math.min(100, Math.round(input.score)));
  const band = stageBandForScore(score);
  const next = nextStageBand(score);

  const cohort = await fetchCohortStats(pool, input.ei_version, input.ruleset_version, band);

  const anonymityMet = cohort.n >= K_ANONYMITY_MIN;
  const std = cohort.std > 0.01 ? cohort.std : 0;

  let z = 0;
  let percentile: number | null = null;
  let suppression_reason: SuppressionReason = null;
  if (!anonymityMet) {
    suppression_reason = 'insufficient_cohort';
  } else if (std <= 0) {
    suppression_reason = 'zero_variance';
  } else {
    z = (score - cohort.mean) / std;
    percentile = zToPercentile(z);
  }

  // 95% CI on the user score using SE of cohort mean
  let ciLow = score, ciHigh = score;
  if (anonymityMet && std > 0) {
    const se = std / Math.sqrt(cohort.n);
    const margin = 1.96 * se;
    ciLow  = Math.round(Math.max(0,   score - margin));
    ciHigh = Math.round(Math.min(100, score + margin));
  }

  // People ahead of the user within the *current band* (only if k-anon met
  // for the band-scoped query; we re-run a narrow count to avoid leaking
  // the global figure).
  let peopleAhead: number | null = null;
  if (anonymityMet && cohort.scope === 'stage_band') {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS ahead
         FROM ei_calculation_logs l
         WHERE l.source = 'resolve' AND l.fallback_used = false
           AND l.ei_version = $1 AND l.ruleset_version = $2
           AND l.capability_score BETWEEN $3 AND $4
           AND l.capability_score > $5
           AND (l.user_id IS NULL OR l.user_id NOT IN (SELECT user_id FROM benchmark_exclusions))`,
      [input.ei_version, input.ruleset_version, band.min, band.max, score],
    );
    peopleAhead = Number(rows[0]?.ahead) || 0;
  }

  // Position within current band (0 = floor, 1 = ceiling)
  const bandSpan = Math.max(1, band.max - band.min);
  const positionInBand = Math.min(1, Math.max(0, (score - band.min) / bandSpan));

  return {
    score,
    z_score: parseFloat(z.toFixed(3)),
    percentile,
    rank_label: rankLabel(percentile),
    position_in_band: parseFloat(positionInBand.toFixed(3)),

    cohort: anonymityMet
      ? {
          ...cohort,
          mean: parseFloat((cohort.mean as number).toFixed(2)),
          std:  parseFloat((cohort.std  as number).toFixed(2)),
          p25:  Math.round(cohort.p25 as number),
          p50:  Math.round(cohort.p50 as number),
          p75:  Math.round(cohort.p75 as number),
          p90:  Math.round(cohort.p90 as number),
        }
      : {
          // HARD REDACTION: sub-k cohort exposes no distribution data —
          // only the scope label survives, so the caller knows WHICH cohort
          // was probed but learns nothing about its members. This closes
          // the enumeration vector the architect review flagged.
          n: null, mean: null, std: null,
          p25: null, p50: null, p75: null, p90: null,
          scope: cohort.scope, scope_label: cohort.scope_label,
        },
    cohort_anonymity_met: anonymityMet,
    min_cohort_size: K_ANONYMITY_MIN,
    suppression_reason,
    confidence_interval_low: ciLow,
    confidence_interval_high: ciHigh,

    current_stage: band,
    next_stage: next,
    pts_to_next_stage: next ? Math.max(0, next.min - score) : 0,
    people_ahead_in_band: peopleAhead,

    methodology_version: PEER_BENCHMARK_METHODOLOGY_VERSION,
    ei_version: input.ei_version,
    ruleset_version: input.ruleset_version,
    computed_at: new Date().toISOString(),
  };
}
