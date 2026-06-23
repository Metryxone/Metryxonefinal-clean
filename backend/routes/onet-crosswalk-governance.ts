/**
 * O*NET Crosswalk Governance routes — MX-100X Phase 2 (additive, feature-flagged).
 *
 * Mount prefix: /api/v2/onet-crosswalk-governance
 * Gating order: foundation -> onetCrosswalkGovernance -> auth. Writes additionally require admin.
 * Flag OFF (`onetCrosswalkGovernance`, env FF_ONET_CROSSWALK_GOVERNANCE) → every route 503
 * BEFORE any auth/DB touch → byte-identical legacy behaviour (existing O*NET / crosswalk routes
 * UNTOUCHED).
 *
 *   GET  /status              — governance overview (read-only)
 *   GET  /confidence          — per-mapping crosswalk confidence (read-only)
 *   GET  /duplicates          — duplicate-mapping detection (read-only)
 *   GET  /missing             — missing-mapping detection (read-only)
 *   GET  /unlinked-analysis   — inheritance-closure verdicts for unlinked roles (read-only)
 *   GET  /decisions           — manual approve/reject audit log (admin, read-only)
 *   POST /decision            — record a write-once approve/reject decision (admin; reversible)
 *   POST /rollback            — delete decisions by provenance + restore prior verified (admin)
 *   GET  /feature-flag        — flag readback (also gated → 503 OFF)
 *   GET  /_meta/versions      — version stamp (also gated → 503 OFF)
 *
 * All GET routes are READ-ONLY (to_regclass probe + degrade; no DDL). The lazy ensure-schema
 * for the audit table runs ONLY on the POST/decision path.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  ONET_CROSSWALK_GOVERNANCE_VERSION,
  CROSSWALK_PROVENANCE,
  getGovernanceOverview,
  getCrosswalkConfidence,
  getDuplicates,
  getMissingMappings,
  getUnlinkedRoleAnalysis,
  listDecisions,
  recordCrosswalkDecision,
  rollbackCrosswalkGovernance,
} from '../services/onet-crosswalk-governance-engine';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isOnetCrosswalkGovernanceEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { ONET_CROSSWALK_GOVERNANCE_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['crosswalk coverage', 'mapping confidence', 'duplicate detection', 'missing mapping', 'inheritance closure', 'governance decision'],
  disallowed: ['hiring recommendation', 'promotion verdict', 'pass/fail', 'suitability score', 'salary guarantee'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    onetCrosswalkGovernance: isOnetCrosswalkGovernanceEnabled(),
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
function requireCrosswalkGovernance(_req: Request, res: Response, next: NextFunction) {
  if (!isOnetCrosswalkGovernanceEnabled()) {
    const e = errorEnvelope('onetCrosswalkGovernance disabled');
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

export function registerOnetCrosswalkGovernanceRoutes(opts: {
  app: Express;
  pool: Pool;
  requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;
  const BASE = '/api/v2/onet-crosswalk-governance';

  // Flag-OFF contract: EVERY route 503s before any work when OFF (incl. readback/meta).
  app.get(`${BASE}/feature-flag`, requireFoundation, requireCrosswalkGovernance, (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get(`${BASE}/_meta/versions`, requireFoundation, requireCrosswalkGovernance, (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, provenance: CROSSWALK_PROVENANCE }));

  // --- Read-only GETs (literal paths; no /:param here so order is unambiguous) ---
  app.get(`${BASE}/status`, requireFoundation, requireCrosswalkGovernance, requireAuth, async (_req, res) => {
    try {
      return res.json(envelope({ overview: await getGovernanceOverview(pool) }));
    } catch (err) {
      const e = errorEnvelope('status_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.get(`${BASE}/confidence`, requireFoundation, requireCrosswalkGovernance, requireAuth, async (_req, res) => {
    try {
      return res.json(envelope({ confidence: await getCrosswalkConfidence(pool) }));
    } catch (err) {
      const e = errorEnvelope('confidence_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.get(`${BASE}/duplicates`, requireFoundation, requireCrosswalkGovernance, requireAuth, async (_req, res) => {
    try {
      return res.json(envelope({ duplicates: await getDuplicates(pool) }));
    } catch (err) {
      const e = errorEnvelope('duplicates_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.get(`${BASE}/missing`, requireFoundation, requireCrosswalkGovernance, requireAuth, async (_req, res) => {
    try {
      return res.json(envelope({ missing: await getMissingMappings(pool) }));
    } catch (err) {
      const e = errorEnvelope('missing_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.get(`${BASE}/unlinked-analysis`, requireFoundation, requireCrosswalkGovernance, requireAuth, async (_req, res) => {
    try {
      return res.json(envelope({ unlinked: await getUnlinkedRoleAnalysis(pool) }));
    } catch (err) {
      const e = errorEnvelope('unlinked_analysis_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.get(`${BASE}/decisions`, requireFoundation, requireCrosswalkGovernance, requireAuth, requireAdmin, async (req, res) => {
    try {
      const limit = Number.parseInt(String(req.query.limit ?? '200'), 10) || 200;
      return res.json(envelope(await listDecisions(pool, limit)));
    } catch (err) {
      const e = errorEnvelope('decisions_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // --- Write path (admin). Write-once → 409 on conflict; reversible by provenance. ---
  app.post(`${BASE}/decision`, requireFoundation, requireCrosswalkGovernance, requireAuth, requireAdmin, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const entityType = String(body.entityType ?? '');
    const entityId = Number(body.entityId);
    const decision = String(body.decision ?? '');
    const rationale = body.rationale == null ? null : String(body.rationale);
    if (entityType !== 'role_bridge' && entityType !== 'competency_mapping') {
      const e = errorEnvelope('invalid entityType', { allowed: ['role_bridge', 'competency_mapping'] }, 400);
      return res.status(e.status).json(e.body);
    }
    if (!Number.isInteger(entityId) || entityId <= 0) {
      const e = errorEnvelope('entityId must be a positive integer', {}, 400);
      return res.status(e.status).json(e.body);
    }
    if (decision !== 'approved' && decision !== 'rejected') {
      const e = errorEnvelope('invalid decision', { allowed: ['approved', 'rejected'] }, 400);
      return res.status(e.status).json(e.body);
    }
    const u = (req as any).user as { id?: unknown; email?: unknown } | undefined;
    const decidedBy = String(u?.email ?? u?.id ?? 'unknown');
    try {
      const result = await recordCrosswalkDecision(pool, {
        entityType: entityType as 'role_bridge' | 'competency_mapping',
        entityId,
        decision: decision as 'approved' | 'rejected',
        rationale,
        decidedBy,
      });
      if (!result.recorded) {
        const code = result.reason === 'already_decided' ? 409 : result.reason === 'entity_not_found' ? 404 : 500;
        const e = errorEnvelope(result.reason ?? 'decision_failed', {}, code);
        return res.status(e.status).json(e.body);
      }
      return res.json(envelope({ result }));
    } catch (err) {
      const e = errorEnvelope('decision_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  app.post(`${BASE}/rollback`, requireFoundation, requireCrosswalkGovernance, requireAuth, requireAdmin, async (_req, res) => {
    try {
      return res.json(envelope({ result: await rollbackCrosswalkGovernance(pool) }));
    } catch (err) {
      const e = errorEnvelope('rollback_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });
}
