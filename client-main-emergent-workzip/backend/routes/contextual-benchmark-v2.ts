/**
 * Contextual Benchmark V2 routes (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/benchmark
 * Flag: contextualScoringV2 (default ON; FF_CONTEXTUAL_SCORING_V2=false to disable).
 *
 *   GET /contextual    — contextual score + readiness for a single competency
 *   GET /readiness     — multi-domain readiness envelope
 *   GET /peer-cohort   — dynamic cohort with k-anonymity
 *   GET /confidence    — per-user confidence profile for one competency
 *   GET /distribution  — percentile distribution for cohort × competency
 *   GET /feature-flag  — public flag readback
 *   GET /_meta/versions — public version stamp
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  computeContextualScore, computeReadiness, logExplainability, clampScore,
  CONTEXTUAL_SCORING_VERSION,
} from '../services/contextual-scoring-engine';
import {
  upsertNormContext, getDistribution, rankPercentile,
  CONTEXTUAL_NORM_VERSION, type NormContext,
} from '../services/contextual-norm-engine';
import { generateCohort, DYNAMIC_COHORT_VERSION } from '../services/dynamic-cohort-engine';
import { computeAllReadiness, READINESS_INTELLIGENCE_VERSION, type CompetencyScore } from '../services/readiness-intelligence-engine';
import { isContextualScoringV2Enabled } from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = {
  CONTEXTUAL_SCORING_VERSION,
  CONTEXTUAL_NORM_VERSION,
  DYNAMIC_COHORT_VERSION,
  READINESS_INTELLIGENCE_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: ['developmental signal', 'capability indicator', 'readiness band', 'cohort percentile'],
  disallowed: ['hiring decision', 'promotion prediction', 'candidate suitability', 'pass/fail'],
};

function envelope<T extends object>(payload: T) {
  return {
    ok: true,
    ...payload,
    methodology_versions: VERSIONS,
    language_policy: LANGUAGE_POLICY,
    feature_flag: { contextualScoringV2: isContextualScoringV2Enabled() },
  };
}

function errorEnvelope(error: string, extra: Record<string, unknown> = {}) {
  return {
    ok: false,
    error,
    ...extra,
    methodology_versions: VERSIONS,
    language_policy: LANGUAGE_POLICY,
    feature_flag: { contextualScoringV2: isContextualScoringV2Enabled() },
  };
}

function requireFlag(_req: Request, res: Response, next: NextFunction) {
  if (!isContextualScoringV2Enabled()) {
    return res.status(503).json(errorEnvelope('contextualScoringV2 disabled'));
  }
  next();
}

function getReqUserId(req: Request): number | null {
  const u = (req as Request & { user?: { id?: number | string } }).user;
  if (!u || u.id == null) return null;
  const n = typeof u.id === 'string' ? Number.parseInt(u.id, 10) : u.id;
  return Number.isFinite(n) ? (n as number) : null;
}

function parseNorm(req: Request): NormContext {
  const q = req.query as Record<string, string | undefined>;
  return {
    role_id: q.role || null,
    layer: q.layer || null,
    industry: q.industry || null,
    geography: q.geography || null,
    org_maturity: q.org_maturity || null,
    team_scale: q.team_scale || null,
    seniority_band: q.seniority || null,
    experience_band: q.experience || null,
  };
}

export function registerContextualBenchmarkV2(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;

  app.get('/api/v2/benchmark/feature-flag', (_req, res) => res.json(envelope({})));
  app.get('/api/v2/benchmark/_meta/versions', (_req, res) => res.json(envelope({})));

  // GET /api/v2/benchmark/contextual?competency=COG&raw=68&expected=70&role=...&layer=...&industry=...
  app.get('/api/v2/benchmark/contextual', requireAuth, requireFlag, async (req, res) => {
    try {
      const competency = String(req.query.competency || '').toUpperCase();
      const rawIn = Number(req.query.raw ?? NaN);
      const expectedIn = Number(req.query.expected ?? 60);
      if (!competency || !Number.isFinite(rawIn)) return res.status(400).json(errorEnvelope('competency + raw required'));
      const raw = clampScore(rawIn);
      const expected = clampScore(expectedIn, 20, 95);
      const userId = getReqUserId(req);
      const ctx = parseNorm(req);
      const contextId = await upsertNormContext(pool, ctx);
      const cohort = await generateCohort(pool, ctx);
      const dist = await getDistribution(pool, contextId, competency);
      const scored = computeContextualScore({
        rawScore: raw,
        dnaExpectedLevel: expected,
        cohortMean: dist.mean,
        cohortStd: dist.std,
        evidenceCount: dist.sample_size || Number(req.query.evidence ?? 0),
      });
      const percentile = rankPercentile(raw, dist);
      const readiness = computeReadiness(scored.contextual_score, { emerging: 40, developing: 60, proficient: 75, expert: 88 }, scored.confidence);
      logExplainability(pool, {
        userId, competencyCode: competency, endpoint: '/api/v2/benchmark/contextual',
        logType: 'contextual_score', rationale: scored.rationale.join(' '),
        payload: { ctx, cohort_id: cohort.cohort_id, distribution_source: dist.source },
      });
      res.json(envelope({
        competency, raw_score: raw, expected_level: expected,
        scored, percentile, readiness,
        cohort: { id: cohort.cohort_id, label: cohort.cohort_label, n: cohort.sample_size, provisional: cohort.is_provisional },
        distribution: dist,
        explainability: {
          why_cohort: cohort.rationale,
          why_percentile: `Percentile interpolated against ${dist.source} distribution (p10/p25/p50/p75/p90 = ${dist.p10}/${dist.p25}/${dist.p50}/${dist.p75}/${dist.p90}).`,
          why_readiness: readiness.rationale,
          why_confidence: `Confidence ${(scored.confidence * 100).toFixed(0)}% stabilised from ${dist.sample_size || 0} cohort observations + raw evidence.`,
        },
      }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // GET /api/v2/benchmark/readiness?scores=COG:72,COM:65,...&role=...&layer=...
  app.get('/api/v2/benchmark/readiness', requireAuth, requireFlag, async (req, res) => {
    try {
      const raw = String(req.query.scores || '');
      if (!raw) return res.status(400).json(errorEnvelope('scores=CODE:value,... required'));
      const scores: CompetencyScore[] = raw.split(',').map((p) => {
        const [code, val] = p.split(':');
        return { competency_code: (code || '').trim().toUpperCase(), contextual_score: clampScore(Number(val ?? 0)), confidence: 0.7 };
      }).filter((s) => s.competency_code && Number.isFinite(s.contextual_score));
      if (!scores.length) return res.status(400).json(errorEnvelope('no parseable scores'));
      const envelopes = computeAllReadiness(scores);
      const userId = getReqUserId(req);
      logExplainability(pool, {
        userId, competencyCode: null, endpoint: '/api/v2/benchmark/readiness',
        logType: 'multi_domain_readiness', rationale: `Computed ${envelopes.length} domain readiness envelopes from ${scores.length} competency scores.`,
        payload: { scores },
      });
      res.json(envelope({ readiness: envelopes }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // GET /api/v2/benchmark/peer-cohort?role=...&layer=...&industry=...
  app.get('/api/v2/benchmark/peer-cohort', requireAuth, requireFlag, async (req, res) => {
    try {
      const ctx = parseNorm(req);
      const cohort = await generateCohort(pool, ctx);
      res.json(envelope({ cohort }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // GET /api/v2/benchmark/confidence?competency=COG (per-user profile)
  app.get('/api/v2/benchmark/confidence', requireAuth, requireFlag, async (req, res) => {
    try {
      const userId = getReqUserId(req);
      if (userId == null) return res.status(401).json(errorEnvelope('unauthenticated'));
      const competency = String(req.query.competency || '').toUpperCase();
      if (!competency) return res.status(400).json(errorEnvelope('competency required'));
      const r = await pool.query<{
        raw_confidence: string | null; stabilized_confidence: string | null;
        evidence_count: number; variance: string | null; updated_at: string;
      }>(
        `SELECT raw_confidence, stabilized_confidence, evidence_count, variance, updated_at
         FROM competency_confidence_profiles
         WHERE user_id = $1 AND competency_code = $2`,
        [userId, competency],
      );
      const profile = r.rows[0] ?? null;
      res.json(envelope({
        competency,
        profile: profile && {
          raw_confidence: profile.raw_confidence ? Number(profile.raw_confidence) : null,
          stabilized_confidence: profile.stabilized_confidence ? Number(profile.stabilized_confidence) : null,
          evidence_count: profile.evidence_count,
          variance: profile.variance ? Number(profile.variance) : null,
          updated_at: profile.updated_at,
        },
        empty: profile === null,
      }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });

  // GET /api/v2/benchmark/distribution?competency=COG&role=...
  app.get('/api/v2/benchmark/distribution', requireAuth, requireFlag, async (req, res) => {
    try {
      const competency = String(req.query.competency || '').toUpperCase();
      if (!competency) return res.status(400).json(errorEnvelope('competency required'));
      const ctx = parseNorm(req);
      const contextId = await upsertNormContext(pool, ctx);
      const dist = await getDistribution(pool, contextId, competency);
      res.json(envelope({ competency, distribution: dist }));
    } catch (e) {
      res.status(500).json(errorEnvelope((e as Error).message));
    }
  });
}
