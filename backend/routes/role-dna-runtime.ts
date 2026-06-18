/**
 * Role DNA Runtime routes — Phase 2 (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/role-dna
 * Gating order: foundation -> roleDNARuntime -> auth (resolve/seed); cache/stats
 * is auth-only diagnostic.
 *
 *   POST /resolve              — resolve role DNA for given role+context
 *   POST /seed/:roleId         — force functional-competency seeding for a role
 *   GET  /cache/stats          — cache size + TTL diagnostics
 *   GET  /feature-flag         — public flag readback
 *   GET  /_meta/versions       — public version stamp
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { resolveRoleDNARuntime, ROLE_DNA_RUNTIME_VERSION } from '../services/role-dna-runtime-engine';
import {
  seedRoleCompetencies, persistSeedResult, FUNCTIONAL_SEEDING_VERSION,
} from '../services/functional-competency-seeding-engine';
import { CONTEXTUAL_ROLE_RESOLUTION_VERSION } from '../services/contextual-role-resolution-engine';
import { ROLE_DNA_CACHE_VERSION, cacheStats, initRoleDNACache } from '../services/role-dna-cache-engine';
import {
  isAdaptiveIntelligenceFoundationEnabled, isRoleDNARuntimeEnabled,
  isFunctionalCompetencySeedingEnabled, isContextualCompetencyResolutionEnabled,
  isUcipShadowMode,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = {
  ROLE_DNA_RUNTIME_VERSION,
  FUNCTIONAL_SEEDING_VERSION,
  CONTEXTUAL_ROLE_RESOLUTION_VERSION,
  ROLE_DNA_CACHE_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: ['role dna', 'competency target', 'contextual modifier', 'seeding bucket', 'cache stat'],
  disallowed: ['hiring recommendation', 'promotion verdict', 'pass/fail', 'suitability score'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    roleDNARuntimeEnabled: isRoleDNARuntimeEnabled(),
    functionalCompetencySeeding: isFunctionalCompetencySeedingEnabled(),
    contextualCompetencyResolution: isContextualCompetencyResolutionEnabled(),
  };
}

function envelope<T extends object>(payload: T) {
  return { ok: true, ...payload, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() };
}
function errorEnvelope(error: string, extra: Record<string, unknown> = {}, code = 503) {
  return { status: code, body: { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: flagState() } };
}

function requireFoundation(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    const e = errorEnvelope('adaptiveIntelligenceFoundation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireRoleDNA(_req: Request, res: Response, next: NextFunction) {
  if (!isRoleDNARuntimeEnabled()) {
    const e = errorEnvelope('roleDNARuntimeEnabled disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireFunctionalSeeding(_req: Request, res: Response, next: NextFunction) {
  if (!isFunctionalCompetencySeedingEnabled()) {
    const e = errorEnvelope('functionalCompetencySeeding disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}

const ADMIN_ROLES = new Set(['admin', 'super-admin', 'superadmin', 'super_admin']);
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

export function registerRoleDNARuntimeRoutes(opts: {
  app: Express; pool: Pool; requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  initRoleDNACache();

  app.get('/api/v2/role-dna/feature-flag', (_req, res) => res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/role-dna/_meta/versions', (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY }));

  // POST /resolve — runtime role DNA resolution. Auth only; no per-user IDOR here
  // because the input is role context, not a user record.
  app.post('/api/v2/role-dna/resolve', requireFoundation, requireRoleDNA, requireAuth, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const roleTitle = String(body.roleTitle ?? '').trim();
    if (!roleTitle) {
      const e = errorEnvelope('roleTitle is required', {}, 400);
      return res.status(e.status).json(e.body);
    }
    try {
      const profile = await resolveRoleDNARuntime(pool, {
        roleTitle,
        industry: body.industry as string | undefined,
        orgMaturity: body.orgMaturity as string | undefined,
        orgLayer: body.orgLayer as string | undefined,
        careerStage: body.careerStage as string | undefined,
        experienceYears: typeof body.experienceYears === 'number' ? body.experienceYears : undefined,
        workArrangement: body.workArrangement as string | undefined,
        leadershipScope: body.leadershipScope as string | undefined,
      }, { shadowMode: isUcipShadowMode() });
      return res.json(envelope({ profile }));
    } catch (err) {
      const e = errorEnvelope('role_dna_resolve_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.post('/api/v2/role-dna/seed/:roleId', requireFoundation, requireRoleDNA, requireFunctionalSeeding, requireAuth, requireAdmin, async (req, res) => {
    const roleId = String(req.params.roleId);
    try {
      const result = await seedRoleCompetencies(pool, roleId);
      const persist = await persistSeedResult(pool, result, { shadowMode: isUcipShadowMode() });
      return res.json(envelope({ result, persist }));
    } catch (err) {
      const e = errorEnvelope('role_dna_seed_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.get('/api/v2/role-dna/cache/stats', requireFoundation, requireAuth, requireAdmin, (_req, res) =>
    res.json(envelope({ stats: cacheStats() })));
}
