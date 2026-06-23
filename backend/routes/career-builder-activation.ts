/**
 * Career Builder Activation routes — 98X Gap Closure, Phase 4 (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/career-builder
 * Gating order: foundation -> careerBuilderActivation -> auth -> resolveEffectiveUserId IDOR.
 * Flag OFF (`careerBuilderActivation`, env FF_CAREER_BUILDER_ACTIVATION) → every route 503
 * BEFORE any auth/DB touch → byte-identical legacy behaviour (the existing Career Graph
 * routes at /api/career/* are UNTOUCHED).
 *
 *   POST /activate/:userId       — compose the persisting engines → materialize cg_user_* rows
 *   GET  /intelligence/:userId   — read-only aggregation of the generated intelligence
 *   POST /rollback/:userId       — reverse a prior activation (reversibility surfaced)
 *   GET  /feature-flag           — flag readback (also gated → 503 OFF)
 *   GET  /_meta/versions         — version stamp (also gated → 503 OFF)
 *
 * WRITES are confined to the POST paths (activate/rollback). The GET aggregation is strictly
 * read-only. IDOR: resolveEffectiveUserId restricts a caller to their own userId unless
 * super_admin (mirrors the behavioural-memory guard).
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  CAREER_BUILDER_ACTIVATION_VERSION,
  activateCareerBuilder,
  getCareerBuilderIntelligence,
  rollbackCareerBuilderActivation,
} from '../services/career-builder-activation';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isCareerBuilderActivationEnabled,
} from '../config/feature-flags';
import { resolveEffectiveUserId } from './behavioural-memory';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { CAREER_BUILDER_ACTIVATION_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['skill gap', 'role readiness', 'developmental recommendation', 'learning resource', 'career path', 'readiness band'],
  disallowed: ['guaranteed promotion', 'hiring prediction', 'pass/fail verdict', 'salary guarantee'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    careerBuilderActivation: isCareerBuilderActivationEnabled(),
  };
}
function envelope<T extends object>(payload: T) {
  return { ok: true, ...payload, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() };
}
function errorEnvelope(error: string, extra: Record<string, unknown> = {}, code = 503) {
  return {
    status: code,
    body: { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() },
  };
}

function requireFoundation(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    const e = errorEnvelope('adaptiveIntelligenceFoundation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireActivation(_req: Request, res: Response, next: NextFunction) {
  if (!isCareerBuilderActivationEnabled()) {
    const e = errorEnvelope('careerBuilderActivation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}

/** Resolve the caller-authorized userId or send the appropriate error. Returns null when
 *  a response has already been sent. */
function authorizeUser(req: Request, res: Response): string | null {
  const { userId, forbidden } = resolveEffectiveUserId(req, req.params.userId);
  if (forbidden) {
    const e = errorEnvelope('forbidden', {}, 403);
    res.status(e.status).json(e.body);
    return null;
  }
  if (!userId) {
    const e = errorEnvelope('userId required', {}, 400);
    res.status(e.status).json(e.body);
    return null;
  }
  return userId;
}

export function registerCareerBuilderActivationRoutes(opts: {
  app: Express;
  pool: Pool;
  requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  // Flag-OFF contract: EVERY route 503s before any work when OFF, including readback/meta.
  app.get('/api/v2/career-builder/feature-flag', requireFoundation, requireActivation, (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/career-builder/_meta/versions', requireFoundation, requireActivation, (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY }));

  // POST /activate/:userId — materialize cg_user_* rows by composing existing engines.
  app.post(
    '/api/v2/career-builder/activate/:userId',
    requireFoundation, requireActivation, requireAuth,
    async (req, res) => {
      const userId = authorizeUser(req, res);
      if (!userId) return;
      try {
        const summary = await activateCareerBuilder(pool, userId);
        return res.json(envelope({ activation: summary }));
      } catch (err) {
        const e = errorEnvelope('activation_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  // GET /intelligence/:userId — read-only aggregation of generated intelligence.
  app.get(
    '/api/v2/career-builder/intelligence/:userId',
    requireFoundation, requireActivation, requireAuth,
    async (req, res) => {
      const userId = authorizeUser(req, res);
      if (!userId) return;
      try {
        const intelligence = await getCareerBuilderIntelligence(pool, userId);
        return res.json(envelope({ intelligence }));
      } catch (err) {
        const e = errorEnvelope('read_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  // POST /rollback/:userId — reverse a prior activation (reversibility surfaced as an API).
  app.post(
    '/api/v2/career-builder/rollback/:userId',
    requireFoundation, requireActivation, requireAuth,
    async (req, res) => {
      const userId = authorizeUser(req, res);
      if (!userId) return;
      try {
        const rollback = await rollbackCareerBuilderActivation(pool, userId);
        return res.json(envelope({ rollback }));
      } catch (err) {
        const e = errorEnvelope('rollback_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );
}
