/**
 * Competency Graph + Adaptive Blueprint routes — Phase 3 (additive, flagged).
 *
 * Mount prefix: /api/v2/competency-graph
 *
 *   GET  /feature-flag           — public flag readback
 *   GET  /_meta/versions         — public version stamp
 *   GET  /traverse/:competencyId — read-only graph subview
 *   POST /propagate              — propagate a confidence delta (admin-only write)
 *   POST /blueprint/:userId      — generate adaptive blueprint (owner-or-admin)
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  traverse, COMPETENCY_GRAPH_TRAVERSAL_VERSION,
} from '../services/competency-graph-traversal-engine';
import { propagate, COMPETENCY_PROPAGATION_VERSION } from '../services/competency-propagation-engine';
import {
  generateAdaptiveBlueprint, ADAPTIVE_BLUEPRINT_VERSION,
} from '../services/adaptive-blueprint-generation-engine';
import { buildUcip } from '../services/unified-competency-profile-engine';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isCompetencyGraphRuntimeEnabled,
  isAdaptiveBlueprintRuntimeEnabled,
  isCompetencyPropagationEnabled,
  isUcipShadowMode,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = {
  COMPETENCY_GRAPH_TRAVERSAL_VERSION,
  COMPETENCY_PROPAGATION_VERSION,
  ADAPTIVE_BLUEPRINT_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: ['dependency edge', 'propagation delta', 'gap cluster', 'blueprint target', 'confidence gap', 'contradiction probe'],
  disallowed: ['hiring recommendation', 'promotion verdict', 'pass/fail', 'suitability score', 'mastery certification'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    competencyGraphRuntime: isCompetencyGraphRuntimeEnabled(),
    adaptiveBlueprintRuntime: isAdaptiveBlueprintRuntimeEnabled(),
    competencyPropagation: isCompetencyPropagationEnabled(),
  };
}

function envelope<T extends object>(payload: T) {
  return { ok: true, ...payload, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() };
}
function errorEnvelope(error: string, extra: Record<string, unknown> = {}, code = 503) {
  return { status: code, body: { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() } };
}

const ADMIN_ROLES = new Set(['admin', 'super-admin', 'superadmin', 'super_admin']);

function requireFoundation(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    const e = errorEnvelope('adaptiveIntelligenceFoundation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireGraphRuntime(_req: Request, res: Response, next: NextFunction) {
  if (!isCompetencyGraphRuntimeEnabled()) {
    const e = errorEnvelope('competencyGraphRuntime disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requirePropagation(_req: Request, res: Response, next: NextFunction) {
  if (!isCompetencyPropagationEnabled()) {
    const e = errorEnvelope('competencyPropagation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireBlueprint(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveBlueprintRuntimeEnabled()) {
    const e = errorEnvelope('adaptiveBlueprintRuntime disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const u = (req as any).user as { id?: unknown; role?: unknown } | undefined;
  if (!u || u.id == null) {
    const e = errorEnvelope('unauthenticated', {}, 401);
    return res.status(e.status).json(e.body);
  }
  const isAdmin = typeof u.role === 'string' && ADMIN_ROLES.has(u.role);
  if (!isAdmin) {
    const e = errorEnvelope('forbidden', { reason: 'admin_required' }, 403);
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  const u = (req as any).user as { id?: unknown; role?: unknown } | undefined;
  if (!u || u.id == null) {
    const e = errorEnvelope('unauthenticated', {}, 401);
    return res.status(e.status).json(e.body);
  }
  const selfId = String(u.id);
  const targetId = String(req.params.userId ?? '');
  const isAdmin = typeof u.role === 'string' && ADMIN_ROLES.has(u.role);
  if (selfId !== targetId && !isAdmin) {
    const e = errorEnvelope('forbidden', { reason: 'cross_user_access_denied' }, 403);
    return res.status(e.status).json(e.body);
  }
  next();
}

export function registerCompetencyGraphRuntimeRoutes(opts: {
  app: Express; pool: Pool; requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  app.get('/api/v2/competency-graph/feature-flag', (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/competency-graph/_meta/versions', (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY }));

  // GET /traverse — read-only; auth required.
  app.get('/api/v2/competency-graph/traverse/:competencyId',
    requireFoundation, requireGraphRuntime, requireAuth, async (req, res) => {
      const cid = String(req.params.competencyId);
      const hops = Math.max(1, Math.min(6, Number(req.query.hops) || 2));
      const dirRaw = String(req.query.direction ?? 'both');
      const direction: 'up' | 'down' | 'both' =
        dirRaw === 'up' || dirRaw === 'down' ? dirRaw : 'both';
      try {
        const subview = await traverse(pool, cid, { maxHops: hops, direction });
        return res.json(envelope({ subview }));
      } catch (err) {
        const e = errorEnvelope('graph_traverse_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    });

  // POST /propagate — write to audit tables; admin-only.
  app.post('/api/v2/competency-graph/propagate',
    requireFoundation, requireGraphRuntime, requirePropagation, requireAuth, requireAdmin, async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const userId = String(body.userId ?? '').trim();
      const sourceCompetencyId = String(body.sourceCompetencyId ?? '').trim();
      const confidenceDelta = Number(body.confidenceDelta);
      if (!userId || !sourceCompetencyId || !Number.isFinite(confidenceDelta)) {
        const e = errorEnvelope('userId, sourceCompetencyId, confidenceDelta required', {}, 400);
        return res.status(e.status).json(e.body);
      }
      try {
        const result = await propagate(pool,
          { userId, sourceCompetencyId, confidenceDelta,
            evidenceDelta: typeof body.evidenceDelta === 'number' ? body.evidenceDelta : undefined },
          { shadowMode: isUcipShadowMode() });
        return res.json(envelope({ result }));
      } catch (err) {
        const e = errorEnvelope('graph_propagate_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    });

  // POST /blueprint/:userId — owner-or-admin; builds UCIP shadow profile then blueprint.
  app.post('/api/v2/competency-graph/blueprint/:userId',
    requireFoundation, requireGraphRuntime, requireBlueprint, requireAuth, requireOwnerOrAdmin, async (req, res) => {
      const userId = String(req.params.userId);
      const body = (req.body ?? {}) as Record<string, unknown>;
      const roleContext = (body.roleContext && typeof body.roleContext === 'object')
        ? (body.roleContext as any) : undefined;
      try {
        const profile = await buildUcip(pool, userId, { shadowMode: isUcipShadowMode(), roleContext });
        const blueprintEnv = await generateAdaptiveBlueprint(pool, profile, { shadowMode: isUcipShadowMode() });
        return res.json(envelope({ envelope: blueprintEnv }));
      } catch (err) {
        const e = errorEnvelope('blueprint_generate_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    });
}
