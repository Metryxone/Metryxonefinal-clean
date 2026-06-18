/**
 * Peer Benchmark Routes
 *
 *   GET /api/ei/peer-benchmark?score=&ei_version=&ruleset_version=
 *     → cohort-aware percentile + gap-to-next-stage. Public (no PII required).
 *
 *   GET /api/ei/peer-benchmark/methodology
 *     → static methodology + legal disclosures. Public.
 *
 * NOTE: deliberately public so the dashboard can render without forcing auth
 * for read-only aggregate data. Only aggregates ever cross the boundary; the
 * service enforces k-anonymity.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import {
  computePeerBenchmark,
  K_ANONYMITY_MIN,
  PEER_BENCHMARK_METHODOLOGY_VERSION,
  STAGE_BANDS,
} from '../services/peer-benchmark';

// Anti-enumeration: per-TCP-peer token bucket. The endpoint is public so it
// renders on the unauthenticated dashboard, but probing it across thousands
// of (score, version) tuples to reconstruct the score distribution is
// denied. 60 req / 60 sec / TCP peer.
//
// Identity is ONLY req.socket.remoteAddress — the actual TCP peer that
// opened the connection. It is NOT derived from any client-controlled HTTP
// header (X-Forwarded-For, User-Agent, Cookie, etc.), so it cannot be
// rotated by an attacker to mint fresh buckets. Behind a shared proxy this
// can group multiple legitimate users into one bucket; that's an acceptable
// trade — 60 req/min is generous, the endpoint is GETable from idempotent
// dashboard loads, and the security guarantee is what matters here.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_HITS  = 60;
const rateBuckets = new Map<string, { hits: number; resetAt: number }>();
function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const b = rateBuckets.get(key);
  if (!b || b.resetAt < now) {
    rateBuckets.set(key, { hits: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }
  if (b.hits >= RATE_MAX_HITS) {
    res.setHeader('Retry-After', Math.ceil((b.resetAt - now) / 1000));
    return res.status(429).json({ ok: false, error: 'rate_limited', retry_after_ms: b.resetAt - now });
  }
  b.hits += 1;
  return next();
}
// Periodic GC so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateBuckets) if (v.resetAt < now) rateBuckets.delete(k);
}, RATE_WINDOW_MS).unref?.();

export function registerPeerBenchmarkRoutes(opts: { app: Express; pool: Pool }) {
  const { app, pool } = opts;

  app.get('/api/ei/peer-benchmark', rateLimit, async (req: Request, res: Response) => {
    try {
      const score = Number(req.query.score);
      const ei_version = String(req.query.ei_version || '').trim();
      const ruleset_version = String(req.query.ruleset_version || '').trim();

      if (!Number.isFinite(score) || score < 0 || score > 100) {
        return res.status(400).json({ ok: false, error: 'score must be a number in [0,100]' });
      }
      if (!ei_version || !ruleset_version) {
        return res.status(400).json({ ok: false, error: 'ei_version and ruleset_version are required' });
      }

      const result = await computePeerBenchmark(pool, { score, ei_version, ruleset_version });
      return res.json({ ok: true, benchmark: result });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message || 'peer-benchmark failed' });
    }
  });

  app.get('/api/ei/peer-benchmark/methodology', (_req, res) => {
    res.json({
      ok: true,
      methodology: {
        version: PEER_BENCHMARK_METHODOLOGY_VERSION,
        title: 'MetryxOne Peer Benchmark — Methodology & Disclosures',
        cohort_source: {
          table: 'ei_calculation_logs',
          filter: "source='resolve' AND fallback_used=false",
          rationale: 'Only authoritative, non-fallback EI scores enter the cohort, so the comparison reflects real assessments — not retry/error paths.',
        },
        version_pinning: {
          dimensions: ['ei_version', 'ruleset_version'],
          rationale: 'A score produced under ruleset v1 is NOT comparable to one produced under v2. Cohort is filtered to the exact pair the user was scored against.',
        },
        statistical_method: {
          percentile: 'z = (score − μ) / σ, then Φ(z) via Abramowitz & Stegun 7.1.26 standard-normal CDF (|error| < 7.5e-8). Bounded to [1,99].',
          empirical_anchors: 'p25 / p50 / p75 / p90 also computed via Postgres PERCENTILE_CONT for distribution-agnostic anchors.',
          confidence_interval: '95% CI on user score using SE = σ / √n, margin = 1.96·SE. Reflects sampling uncertainty in the cohort estimate.',
          deterministic: 'No random sampling. Same (score, cohort) → same percentile.',
        },
        privacy: {
          k_anonymity_minimum: K_ANONYMITY_MIN,
          enforcement: 'Cohort widens by score range only — stage band → all stages on the SAME ruleset. Version pinning (ei_version + ruleset_version) is preserved at every scope. If the all-stages cohort is still below k, the percentile is SUPPRESSED and the response carries cohort_anonymity_met=false with suppression_reason="insufficient_cohort". A cohort with zero variance returns suppression_reason="zero_variance".',
          aggregates_only: 'No individual scores, user IDs, or PII ever leave the service. Only aggregate statistics (n, mean, std, percentiles) are returned.',
          opt_out: 'Users in the benchmark_exclusions table are filtered out of every cohort query (their score still computes for themselves). Enforcement is in-query — see fetchCohortStats() in backend/services/peer-benchmark.ts.',
        },
        legal: {
          data_basis: 'Legitimate interest (recital-style): aggregate, non-identifying analytics necessary to deliver the platform\'s core function (peer-relative employability feedback).',
          gdpr_dpdp: 'Compliant with GDPR Art. 4(5) pseudonymisation/aggregation principles and India\'s DPDP Act 2023 Section 7(c) (necessary for the specified purpose). Aggregate data is outside the personal-data scope when k ≥ 30.',
          no_discriminatory_use: 'Percentiles are descriptive only. They are NOT used for hiring decisions, loan eligibility, or any automated decision producing legal effects (GDPR Art. 22).',
          right_to_explanation: 'Every benchmark response includes methodology_version, ei_version, ruleset_version, cohort size, scope, and confidence interval. Users can request a full audit trail at any time.',
          recompute_cadence: 'Computed live on every dashboard load — no stale cached comparison.',
        },
        stage_bands: STAGE_BANDS,
      },
    });
  });
}
