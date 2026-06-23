/**
 * Role DNA Governance routes — MX-100X Phase 1 (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/role-dna-governance
 * Gating order: foundation -> roleDnaGovernance -> auth. Writes additionally require admin.
 * Flag OFF (`roleDnaGovernance`, env FF_ROLE_DNA_GOVERNANCE) → every route 503 BEFORE any
 * auth/DB touch → byte-identical legacy behaviour.
 *
 *   GET  /overview             — governance + benchmark coverage overview (read-only)
 *   GET  /coverage             — per-level benchmark coverage % (read-only)
 *   GET  /materialized         — list materialized governance snapshots (admin, read-only)
 *   GET  /role/:roleCode       — full governance envelope for one role (read-only)
 *   POST /materialize          — generate + persist governance snapshots (admin; reversible)
 *   POST /rollback             — delete all governance snapshots (admin; full reversal)
 *   GET  /feature-flag         — flag readback
 *   GET  /_meta/versions       — version stamp
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  ROLE_DNA_GOVERNANCE_VERSION,
  GOVERNANCE_PROVENANCE,
  computeRoleGovernance,
  computeBenchmarkCoverage,
  computeGovernanceOverview,
  materializeGovernance,
  listGovernance,
  rollbackGovernance,
} from '../services/role-dna-governance-engine';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isRoleDnaGovernanceEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { ROLE_DNA_GOVERNANCE_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['role dna', 'governance score', 'completeness', 'confidence', 'quality', 'benchmark coverage', 'explainability'],
  disallowed: ['hiring recommendation', 'promotion verdict', 'pass/fail', 'suitability score'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    roleDnaGovernance: isRoleDnaGovernanceEnabled(),
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
function requireGovernance(_req: Request, res: Response, next: NextFunction) {
  if (!isRoleDnaGovernanceEnabled()) {
    const e = errorEnvelope('roleDnaGovernance disabled');
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

export function registerRoleDnaGovernanceRoutes(opts: {
  app: Express;
  pool: Pool;
  requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  // Flag-OFF contract: EVERY route 503s before any work when the flag is OFF (incl.
  // readback/meta) so flag-OFF is byte-identical legacy.
  app.get('/api/v2/role-dna-governance/feature-flag', requireFoundation, requireGovernance, (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/role-dna-governance/_meta/versions', requireFoundation, requireGovernance, (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, provenance: GOVERNANCE_PROVENANCE }));

  // GET /overview — read-only (to_regclass probe + degrade; never DDL).
  app.get('/api/v2/role-dna-governance/overview', requireFoundation, requireGovernance, requireAuth, async (_req, res) => {
    try {
      const overview = await computeGovernanceOverview(pool);
      return res.json(envelope({ overview }));
    } catch (err) {
      const e = errorEnvelope('overview_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // GET /coverage — read-only per-level benchmark coverage.
  app.get('/api/v2/role-dna-governance/coverage', requireFoundation, requireGovernance, requireAuth, async (_req, res) => {
    try {
      const coverage = await computeBenchmarkCoverage(pool);
      return res.json(envelope({ coverage }));
    } catch (err) {
      const e = errorEnvelope('coverage_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // GET /materialized — read-only listing (registered BEFORE /role/:roleCode so the
  // literal path is not swallowed by the param route).
  app.get('/api/v2/role-dna-governance/materialized', requireFoundation, requireGovernance, requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit ?? '100'), 10) || 100;
      const result = await listGovernance(pool, limit);
      return res.json(envelope(result));
    } catch (err) {
      const e = errorEnvelope('list_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // GET /role/:roleCode — read-only governance for one role (no write).
  app.get('/api/v2/role-dna-governance/role/:roleCode', requireFoundation, requireGovernance, requireAuth, async (req, res) => {
    const roleCode = String(req.params.roleCode ?? '').trim();
    if (!roleCode) {
      const e = errorEnvelope('roleCode is required', {}, 400);
      return res.status(e.status).json(e.body);
    }
    try {
      const governance = await computeRoleGovernance(pool, roleCode);
      return res.json(envelope({ governance }));
    } catch (err) {
      const e = errorEnvelope('role_governance_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // POST /materialize — write path (admin). Reversible by provenance.
  app.post('/api/v2/role-dna-governance/materialize', requireFoundation, requireGovernance, requireAuth, requireAdmin, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const roleCodes = Array.isArray(body.roleCodes)
      ? (body.roleCodes as unknown[]).map((x) => String(x)).filter(Boolean)
      : undefined;
    const limit = typeof body.limit === 'number' ? body.limit : undefined;
    try {
      const result = await materializeGovernance(pool, { roleCodes, limit });
      return res.json(envelope({ result }));
    } catch (err) {
      const e = errorEnvelope('materialize_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // POST /rollback — full reversal of this phase's data (admin).
  app.post('/api/v2/role-dna-governance/rollback', requireFoundation, requireGovernance, requireAuth, requireAdmin, async (_req, res) => {
    try {
      const result = await rollbackGovernance(pool);
      return res.json(envelope({ result }));
    } catch (err) {
      const e = errorEnvelope('rollback_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });
}
