/**
 * O*NET Activation routes — 98X Gap Closure, Phase 1 (additive, feature-flagged, read-only).
 *
 * Mount prefix: /api/v2/onet-activation
 * Gating order: foundation -> onetActivation -> auth.
 * Flag OFF (`onetActivation`, env FF_ONET_ACTIVATION) → every route 503 BEFORE any auth/DB touch
 * → byte-identical legacy behaviour (existing role-dna-expansion / O*NET routes UNTOUCHED).
 *
 *   GET /status                       — activation status: coverage + bridge + materialized count
 *   GET /coverage                     — crosswalk expansion: coverage + bridge health + references
 *   GET /role-intelligence/:roleInput — role resolution + confidence + O*NET hierarchy context
 *   GET /inheritance/:roleInput       — inherited competency requirements grouped by tier/source
 *   GET /role-dna/:roleInput          — full Role DNA (curated-over-inherited) + hierarchy context
 *   GET /benchmark/:roleInput         — benchmark positioning + library coverage
 *   GET /materialized                 — list materialized Role DNA snapshots (read-only)
 *   GET /feature-flag                 — flag readback (also gated → 503 OFF)
 *   GET /_meta/versions               — version stamp (also gated → 503 OFF)
 *
 * All routes are READ-ONLY. Materialization + curated-bridge resolution happen ONLY in the offline
 * activation script (scripts/activate-onet-role-dna.ts) — nothing here writes. The role library is
 * reference data (no subject/user scope), so there is no IDOR surface; requireAuth still applies for
 * consistency with the v2 family.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  ONET_ACTIVATION_VERSION,
  getActivationStatus,
  getCrosswalkExpansion,
  getRoleIntelligence,
  getCompetencyInheritance,
  getRoleDna,
  getBenchmarkFoundation,
} from '../services/onet-activation';
import { listMaterialized } from '../services/role-dna-expansion-engine';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isOnetActivationEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { ONET_ACTIVATION_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['role dna', 'competency requirement', 'proficiency target', 'crosswalk coverage', 'benchmark positioning', 'hierarchy context'],
  disallowed: ['hiring recommendation', 'promotion verdict', 'pass/fail', 'suitability score', 'salary guarantee'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    onetActivation: isOnetActivationEnabled(),
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
function requireOnetActivation(_req: Request, res: Response, next: NextFunction) {
  if (!isOnetActivationEnabled()) {
    const e = errorEnvelope('onetActivation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}

export function registerOnetActivationRoutes(opts: {
  app: Express;
  pool: Pool;
  requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  // Flag-OFF contract: EVERY route 503s before any work when OFF, including readback/meta.
  app.get('/api/v2/onet-activation/feature-flag', requireFoundation, requireOnetActivation, (_req, res) =>
    res.json({ ok: true, feature_flag: flagState() }));
  app.get('/api/v2/onet-activation/_meta/versions', requireFoundation, requireOnetActivation, (_req, res) =>
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY }));

  // --- Literal paths registered BEFORE the /:roleInput param routes ---
  app.get(
    '/api/v2/onet-activation/status',
    requireFoundation, requireOnetActivation, requireAuth,
    async (_req, res) => {
      try {
        return res.json(envelope({ status: await getActivationStatus(pool) }));
      } catch (err) {
        const e = errorEnvelope('status_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  app.get(
    '/api/v2/onet-activation/coverage',
    requireFoundation, requireOnetActivation, requireAuth,
    async (_req, res) => {
      try {
        return res.json(envelope({ crosswalk: await getCrosswalkExpansion(pool) }));
      } catch (err) {
        const e = errorEnvelope('coverage_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  app.get(
    '/api/v2/onet-activation/materialized',
    requireFoundation, requireOnetActivation, requireAuth,
    async (req, res) => {
      try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
        return res.json(envelope({ materialized: await listMaterialized(pool, limit) }));
      } catch (err) {
        const e = errorEnvelope('materialized_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  // --- Param routes ---
  app.get(
    '/api/v2/onet-activation/role-intelligence/:roleInput',
    requireFoundation, requireOnetActivation, requireAuth,
    async (req, res) => {
      const input = String(req.params.roleInput || '').trim();
      if (!input) {
        const e = errorEnvelope('roleInput required', {}, 400);
        return res.status(e.status).json(e.body);
      }
      try {
        return res.json(envelope({ roleIntelligence: await getRoleIntelligence(pool, input) }));
      } catch (err) {
        const e = errorEnvelope('role_intelligence_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  app.get(
    '/api/v2/onet-activation/inheritance/:roleInput',
    requireFoundation, requireOnetActivation, requireAuth,
    async (req, res) => {
      const input = String(req.params.roleInput || '').trim();
      if (!input) {
        const e = errorEnvelope('roleInput required', {}, 400);
        return res.status(e.status).json(e.body);
      }
      try {
        return res.json(envelope({ inheritance: await getCompetencyInheritance(pool, input) }));
      } catch (err) {
        const e = errorEnvelope('inheritance_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  app.get(
    '/api/v2/onet-activation/role-dna/:roleInput',
    requireFoundation, requireOnetActivation, requireAuth,
    async (req, res) => {
      const input = String(req.params.roleInput || '').trim();
      if (!input) {
        const e = errorEnvelope('roleInput required', {}, 400);
        return res.status(e.status).json(e.body);
      }
      try {
        return res.json(envelope({ roleDna: await getRoleDna(pool, input) }));
      } catch (err) {
        const e = errorEnvelope('role_dna_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  app.get(
    '/api/v2/onet-activation/benchmark/:roleInput',
    requireFoundation, requireOnetActivation, requireAuth,
    async (req, res) => {
      const input = String(req.params.roleInput || '').trim();
      if (!input) {
        const e = errorEnvelope('roleInput required', {}, 400);
        return res.status(e.status).json(e.body);
      }
      try {
        return res.json(envelope({ benchmark: await getBenchmarkFoundation(pool, input) }));
      } catch (err) {
        const e = errorEnvelope('benchmark_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );
}
