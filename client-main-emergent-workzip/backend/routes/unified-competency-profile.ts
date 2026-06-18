/**
 * UCIP routes — Phase 1 (additive, feature-flagged, shadow-mode by default).
 *
 * Mount prefix: /api/v2/ucip
 * Gating: `adaptiveIntelligenceFoundation` MUST be ON for any non-public route.
 *         `ucipEnabled` gates GET/POST of profile data.
 *         When `ucipShadowMode` is ON (default), routes still run but return
 *         a shadow envelope and never affect runtime/UI consumers.
 *
 *   GET  /:userId             — latest UCIP for user (build-on-read; persists in non-shadow)
 *   POST /rebuild/:userId     — force rebuild + persist (best-effort)
 *   GET  /status/:userId      — recent runtime logs + source health (no profile body)
 *   GET  /feature-flag        — public flag readback
 *   GET  /_meta/versions      — public version stamp
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { runUcipPipeline, UCIP_PIPELINE_VERSION } from '../services/ucip-builder-pipeline';
import { buildUcip, UCIP_ENGINE_VERSION } from '../services/unified-competency-profile-engine';
import { UCIP_ADAPTER_VERSION } from '../services/ucip-orchestration-adapter';
import { UCIP_VALIDATOR_VERSION } from '../services/ucip-validation-engine';
import { COMPETENCY_NORMALIZER_VERSION } from '../services/competency-normalization-engine';
import {
  isUcipEnabled, isUcipShadowMode, isAdaptiveIntelligenceFoundationEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = {
  UCIP_PIPELINE_VERSION,
  UCIP_ENGINE_VERSION,
  UCIP_ADAPTER_VERSION,
  UCIP_VALIDATOR_VERSION,
  COMPETENCY_NORMALIZER_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: ['unified profile', 'evidence signal', 'normalised score', 'confidence band', 'source health', 'shadow mode'],
  disallowed: ['hiring recommendation', 'promotion prediction', 'pass/fail verdict', 'suitability score'],
};

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    ucipEnabled: isUcipEnabled(),
    ucipShadowMode: isUcipShadowMode(),
  };
}

function envelope<T extends object>(payload: T) {
  return {
    ok: true,
    ...payload,
    methodology_versions: VERSIONS,
    language_policy: LANGUAGE_POLICY,
    feature_flag: flagState(),
  };
}

function errorEnvelope(error: string, extra: Record<string, unknown> = {}, code = 503) {
  return {
    status: code,
    body: {
      ok: false, error, ...extra,
      methodology_versions: VERSIONS,
      language_policy: LANGUAGE_POLICY,
      feature_flag: flagState(),
    },
  };
}

function requireFoundation(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveIntelligenceFoundationEnabled()) {
    const e = errorEnvelope('adaptiveIntelligenceFoundation disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}

function requireUcip(_req: Request, res: Response, next: NextFunction) {
  if (!isUcipEnabled()) {
    const e = errorEnvelope('ucipEnabled disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}

const ADMIN_ROLES = new Set(['admin', 'super-admin', 'superadmin', 'super_admin']);

/**
 * IDOR guard. Authenticated users may only read their OWN UCIP unless they
 * hold an admin role. Compares string-cast IDs so TEXT/BIGINT users both work.
 */
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

export function registerUnifiedCompetencyProfileRoutes(opts: {
  app: Express; pool: Pool; requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  // Public meta — always available.
  app.get('/api/v2/ucip/feature-flag', (_req, res) => {
    res.json({ ok: true, feature_flag: flagState() });
  });
  app.get('/api/v2/ucip/_meta/versions', (_req, res) => {
    res.json({ ok: true, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY });
  });

  // GET latest profile (read-only; builds on demand without persist when shadow).
  // Gating order: foundation -> ucip -> auth -> owner/admin (IDOR guard).
  app.get('/api/v2/ucip/:userId', requireFoundation, requireUcip, requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const userId = String(req.params.userId);
    try {
      const profile = await buildUcip(pool, userId, { shadowMode: isUcipShadowMode() });
      return res.json(envelope({ profile }));
    } catch (err) {
      const e = errorEnvelope('ucip_build_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // POST rebuild — runs full pipeline + persists (best-effort).
  app.post('/api/v2/ucip/rebuild/:userId', requireFoundation, requireUcip, requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const userId = String(req.params.userId);
    try {
      const outcome = await runUcipPipeline(pool, userId, 'rebuild');
      return res.json(envelope({ outcome }));
    } catch (err) {
      const e = errorEnvelope('ucip_rebuild_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });

  // GET status — recent runtime logs + per-source health (no profile body).
  app.get('/api/v2/ucip/status/:userId', requireFoundation, requireUcip, requireAuth, requireOwnerOrAdmin, async (req, res) => {
    const userId = String(req.params.userId);
    try {
      const logs = await pool.query(
        `SELECT id, correlation_id, operation, status, shadow_mode, duration_ms,
                sources_ok, sources_failed, validation, occurred_at
           FROM ucip_runtime_logs WHERE user_id = $1
           ORDER BY occurred_at DESC LIMIT 20`,
        [userId],
      ).then(r => r.rows).catch(() => [] as any[]);
      const latest = await pool.query(
        `SELECT profile_version, source_health, computed_at, updated_at
           FROM ucip_profiles WHERE user_id = $1
           ORDER BY computed_at DESC LIMIT 1`,
        [userId],
      ).then(r => r.rows[0] ?? null).catch(() => null);
      return res.json(envelope({ status: { latest, logs } }));
    } catch (err) {
      const e = errorEnvelope('ucip_status_failed', { detail: (err as Error).message }, 500);
      return res.status(e.status).json(e.body);
    }
  });
}
