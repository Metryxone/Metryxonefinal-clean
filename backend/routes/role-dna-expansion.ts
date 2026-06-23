/**
 * Role DNA Expansion routes — 98X Gap Closure, Phase 1 (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/role-dna-expansion
 * Gating order: foundation -> roleDnaExpansion -> auth. Writes additionally require admin.
 * Flag OFF (`roleDnaExpansion`, env FF_ROLE_DNA_EXPANSION) → every route 503 BEFORE any
 * auth/DB touch → byte-identical legacy behaviour.
 *
 *   GET  /coverage             — crosswalk / DNA coverage stats (read-only)
 *   GET  /preview/:roleCode    — generated Role DNA for one role (read-only, no write)
 *   GET  /materialized         — list materialized expansion snapshots (read-only)
 *   POST /materialize          — generate + persist snapshots (admin; reversible by provenance)
 *   POST /rollback             — delete all expansion snapshots (admin; full reversal)
 *   GET  /feature-flag         — public flag readback
 *   GET  /_meta/versions       — public version stamp
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  ROLE_DNA_EXPANSION_VERSION,
  EXPANSION_PROVENANCE,
  computeCrosswalkCoverage,
  generateRoleDNA,
  materializeRoleDNA,
  listMaterialized,
  rollbackExpansion,
} from '../services/role-dna-expansion-engine';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isRoleDnaExpansionEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { ROLE_DNA_EXPANSION_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['role dna', 'competency requirement', 'proficiency target', 'crosswalk coverage', 'benchmark positioning'],
  disallowed: ['hiring recommendation', 'promotion verdict', 'pass/fail', 'suitability score'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    roleDnaExpansion: isRoleDnaExpansionEnabled(),
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
function requireExpansion(_req: Request, res: Response, next: NextFunction) {
  if (!isRoleDnaExpansionEnabled()) {
    const e = errorEnvelope('roleDnaExpansion disabled');
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

export function registerRoleDnaExpansionRoutes(opts: {
  app: Express;
  pool: Pool;
  requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  // Flag-OFF contract: EVERY route in this family 503s before any work when the flag
  // is OFF, including the readback/meta endpoints — so flag-OFF is byte-identical legacy.
  app.get('/api/v2/role-dna-expansion/feature-flag', requireFoundation, requireExpansion, (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/role-dna-expansion/_meta/versions', requireFoundation, requireExpansion, (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, provenance: EXPANSION_PROVENANCE }));

  // GET /coverage — read-only (to_regclass probe + degrade; never DDL).
  app.get('/api/v2/role-dna-expansion/coverage', requireFoundation, requireExpansion, requireAuth, async (_req, res) => {
    try {
      const coverage = await computeCrosswalkCoverage(pool);
      return res.json(envelope({ coverage }));
    } catch (err) {
      const e = errorEnvelope('coverage_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // GET /materialized — read-only listing (registered BEFORE /preview/:roleCode so the
  // literal path is not swallowed by the param route).
  app.get('/api/v2/role-dna-expansion/materialized', requireFoundation, requireExpansion, requireAuth, async (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit ?? '100'), 10) || 100;
      const result = await listMaterialized(pool, limit);
      return res.json(envelope(result));
    } catch (err) {
      const e = errorEnvelope('list_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // GET /preview/:roleCode — read-only DNA generation (no write).
  app.get('/api/v2/role-dna-expansion/preview/:roleCode', requireFoundation, requireExpansion, requireAuth, async (req, res) => {
    const roleCode = String(req.params.roleCode ?? '').trim();
    if (!roleCode) {
      const e = errorEnvelope('roleCode is required', {}, 400);
      return res.status(e.status).json(e.body);
    }
    try {
      const dna = await generateRoleDNA(pool, roleCode);
      return res.json(envelope({ dna }));
    } catch (err) {
      const e = errorEnvelope('preview_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // POST /materialize — write path (admin). Reversible by provenance.
  app.post('/api/v2/role-dna-expansion/materialize', requireFoundation, requireExpansion, requireAuth, requireAdmin, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const roleCodes = Array.isArray(body.roleCodes)
      ? (body.roleCodes as unknown[]).map((x) => String(x)).filter(Boolean)
      : undefined;
    const limit = typeof body.limit === 'number' ? body.limit : undefined;
    try {
      const result = await materializeRoleDNA(pool, { roleCodes, limit });
      return res.json(envelope({ result }));
    } catch (err) {
      const e = errorEnvelope('materialize_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // POST /rollback — full reversal of this phase's data (admin).
  app.post('/api/v2/role-dna-expansion/rollback', requireFoundation, requireExpansion, requireAuth, requireAdmin, async (_req, res) => {
    try {
      const result = await rollbackExpansion(pool);
      return res.json(envelope({ result }));
    } catch (err) {
      const e = errorEnvelope('rollback_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });
}
