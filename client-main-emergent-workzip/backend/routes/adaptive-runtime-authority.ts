/**
 * Adaptive Runtime Authority routes — Phase 5 (additive, flagged).
 *
 * Mount prefix: /api/v2/adaptive-runtime
 *
 *   GET  /feature-flag                       — public flag readback
 *   GET  /_meta/versions                     — public version stamp
 *   POST /run/:userId                        — owner-or-admin; runs orchestrator
 *   GET  /snapshot/:userId                   — owner-or-admin; latest snapshot summary
 *   GET  /fusion/:userId                     — owner-or-admin; recent fusion rows
 *   GET  /narratives/:userId                 — owner-or-admin; recent narratives
 *   GET  /memory/:userId                     — owner-or-admin; recent memory rows
 *   POST /authority/transition               — admin; explicit stage transition
 *   GET  /authority/transitions              — admin; recent transitions
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  ADAPTIVE_RUNTIME_ORCHESTRATOR_VERSION, AUTHORITY_STAGES,
  runAdaptiveRuntime, transitionAuthorityStage, type AuthorityStage,
} from '../services/unified-adaptive-runtime-orchestrator';
import {
  COMPETENCY_FUSION_VERSION, recentFusion,
} from '../services/competency-fusion-engine';
import {
  CONFIDENCE_CALIBRATION_VERSION,
} from '../services/confidence-calibration-engine';
import {
  INTELLIGENCE_NARRATIVE_VERSION, NARRATIVE_KINDS, recentNarratives,
  type NarrativeKind,
} from '../services/intelligence-narrative-engine';
import {
  COMPETENCY_MEMORY_VERSION, memorySummary, recentMemory,
} from '../services/competency-memory-engine';
import {
  isAdaptiveIntelligenceFoundationEnabled,
  isAdaptiveRuntimeAuthorityEnabled,
  isCompetencyFusionEnabled,
  isContextualScoringAuthorityEnabled,
  isIntelligenceNarrativesEnabled,
  isContinuousCompetencyMemoryEnabled,
} from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = {
  ADAPTIVE_RUNTIME_ORCHESTRATOR_VERSION,
  COMPETENCY_FUSION_VERSION,
  CONFIDENCE_CALIBRATION_VERSION,
  INTELLIGENCE_NARRATIVE_VERSION,
  COMPETENCY_MEMORY_VERSION,
};

const LANGUAGE_POLICY = {
  allowed: [
    'developmental signal', 'evidence-based', 'confidence-aware', 'shadow run',
    'authority stage', 'narrative summary', 'memory observation',
  ],
  disallowed: [
    'hiring recommendation', 'promotion verdict', 'pass/fail',
    'suitability score', 'IQ ranking', 'rejected', 'unfit',
  ],
};

const ADMIN_ROLES = new Set(['admin', 'super-admin', 'superadmin', 'super_admin']);

function flagState() {
  return {
    adaptiveIntelligenceFoundation: isAdaptiveIntelligenceFoundationEnabled(),
    adaptiveRuntimeAuthority: isAdaptiveRuntimeAuthorityEnabled(),
    competencyFusionEnabled: isCompetencyFusionEnabled(),
    contextualScoringAuthority: isContextualScoringAuthorityEnabled(),
    intelligenceNarratives: isIntelligenceNarrativesEnabled(),
    continuousCompetencyMemory: isContinuousCompetencyMemoryEnabled(),
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
function requireAuthority(_req: Request, res: Response, next: NextFunction) {
  if (!isAdaptiveRuntimeAuthorityEnabled()) {
    const e = errorEnvelope('adaptiveRuntimeAuthority disabled');
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const u = (req as any).user as { role?: unknown } | undefined;
  if (!u || typeof u.role !== 'string' || !ADMIN_ROLES.has(u.role)) {
    const e = errorEnvelope('forbidden', { reason: 'admin_required' }, 403);
    return res.status(e.status).json(e.body);
  }
  next();
}
function requireOwnerOrAdmin(paramKey = 'userId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const u = (req as any).user as { id?: unknown; role?: unknown } | undefined;
    if (!u || u.id == null) {
      const e = errorEnvelope('unauthenticated', {}, 401);
      return res.status(e.status).json(e.body);
    }
    const isAdmin = typeof u.role === 'string' && ADMIN_ROLES.has(u.role);
    const targetId = String(req.params[paramKey] ?? '');
    if (!isAdmin && String(u.id) !== targetId) {
      const e = errorEnvelope('forbidden', { reason: 'cross_user_access_denied' }, 403);
      return res.status(e.status).json(e.body);
    }
    next();
  };
}

function asString(v: unknown): string {
  return v == null ? '' : String(v).trim();
}
function isAuthorityStage(v: unknown): v is AuthorityStage {
  return typeof v === 'string' && (AUTHORITY_STAGES as readonly string[]).includes(v);
}

export function registerAdaptiveRuntimeAuthorityRoutes(opts: {
  app: Express; pool: Pool; requireAuth: RequireAuth;
}): void {
  const { app, pool, requireAuth } = opts;

  app.get('/api/v2/adaptive-runtime/feature-flag', (_req, res) => {
    res.json({ ok: true, feature_flag: flagState() });
  });
  app.get('/api/v2/adaptive-runtime/_meta/versions', (_req, res) => {
    res.json({
      ok: true, versions: VERSIONS,
      authority_stages: AUTHORITY_STAGES,
      narrative_kinds: NARRATIVE_KINDS,
      language_policy: LANGUAGE_POLICY,
    });
  });

  app.post('/api/v2/adaptive-runtime/run/:userId',
    requireFoundation, requireAuthority, requireAuth, requireOwnerOrAdmin('userId'),
    async (req, res) => {
      try {
        const userId = asString(req.params.userId);
        if (!userId) {
          const e = errorEnvelope('userId required', {}, 400);
          return res.status(e.status).json(e.body);
        }
        const body = (req.body ?? {}) as Record<string, unknown>;
        const stage: AuthorityStage = isAuthorityStage(body.stage) ? body.stage : 'shadow';
        const roleContext = (body.roleContext && typeof body.roleContext === 'object')
          ? body.roleContext as any : undefined;
        const snap = await runAdaptiveRuntime(pool, userId, { stage, roleContext });
        return res.json(envelope({ snapshot: snap }));
      } catch (err) {
        const e = errorEnvelope('runtime_run_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  app.get('/api/v2/adaptive-runtime/snapshot/:userId',
    requireFoundation, requireAuthority, requireAuth, requireOwnerOrAdmin('userId'),
    async (req, res) => {
      try {
        const userId = asString(req.params.userId);
        const [fusion, narr, mem, memSum] = await Promise.all([
          recentFusion(pool, userId, 20),
          recentNarratives(pool, userId, { limit: 20 }),
          recentMemory(pool, userId, { limit: 20 }),
          memorySummary(pool, userId),
        ]);
        return res.json(envelope({
          snapshot: {
            fusion_recent: fusion,
            narratives_recent: narr,
            memory_recent: mem,
            memory_summary: memSum,
          },
        }));
      } catch (err) {
        const e = errorEnvelope('snapshot_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  app.get('/api/v2/adaptive-runtime/fusion/:userId',
    requireFoundation, requireAuthority, requireAuth, requireOwnerOrAdmin('userId'),
    async (req, res) => {
      const userId = asString(req.params.userId);
      const limit = Number(req.query.limit ?? 50);
      const rows = await recentFusion(pool, userId, Number.isFinite(limit) ? limit : 50);
      return res.json(envelope({ fusion: rows }));
    },
  );

  app.get('/api/v2/adaptive-runtime/narratives/:userId',
    requireFoundation, requireAuthority, requireAuth, requireOwnerOrAdmin('userId'),
    async (req, res) => {
      const userId = asString(req.params.userId);
      const kind = typeof req.query.kind === 'string' ? req.query.kind as NarrativeKind : undefined;
      const validKind = kind && (NARRATIVE_KINDS as readonly string[]).includes(kind) ? kind : undefined;
      const limit = Number(req.query.limit ?? 50);
      const rows = await recentNarratives(pool, userId, {
        kind: validKind, limit: Number.isFinite(limit) ? limit : 50,
      });
      return res.json(envelope({ narratives: rows }));
    },
  );

  app.get('/api/v2/adaptive-runtime/memory/:userId',
    requireFoundation, requireAuthority, requireAuth, requireOwnerOrAdmin('userId'),
    async (req, res) => {
      const userId = asString(req.params.userId);
      const competencyId = typeof req.query.competencyId === 'string' ? req.query.competencyId : undefined;
      const limit = Number(req.query.limit ?? 100);
      const [rows, summary] = await Promise.all([
        recentMemory(pool, userId, { competencyId, limit: Number.isFinite(limit) ? limit : 100 }),
        memorySummary(pool, userId),
      ]);
      return res.json(envelope({ memory: rows, summary }));
    },
  );

  app.post('/api/v2/adaptive-runtime/authority/transition',
    requireFoundation, requireAuthority, requireAuth, requireAdmin,
    async (req, res) => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const toStage = body.toStage;
        if (!isAuthorityStage(toStage)) {
          const e = errorEnvelope('invalid toStage', { allowed: AUTHORITY_STAGES }, 400);
          return res.status(e.status).json(e.body);
        }
        const fromStage = isAuthorityStage(body.fromStage) ? body.fromStage : undefined;
        const trigger = asString(body.trigger) || 'admin.manual';
        const userId = asString(body.userId) || undefined;
        await transitionAuthorityStage(pool, {
          fromStage, toStage, trigger, userId,
          diff: (body.diff && typeof body.diff === 'object') ? body.diff as Record<string, unknown> : undefined,
        });
        return res.json(envelope({ transitioned: { fromStage, toStage, trigger, userId } }));
      } catch (err) {
        const e = errorEnvelope('transition_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );

  app.get('/api/v2/adaptive-runtime/authority/transitions',
    requireFoundation, requireAuthority, requireAuth, requireAdmin,
    async (req, res) => {
      try {
        const limit = Math.max(1, Math.min(500, Number(req.query.limit ?? 100) || 100));
        const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
        const params: any[] = [];
        let where = '';
        if (userId) { params.push(userId); where = 'WHERE user_id = $1'; }
        params.push(limit);
        const r = await pool.query(
          `SELECT id, user_id, scope, from_stage, to_stage, trigger, diff_summary,
                  shadow_mode, engine_version, occurred_at
             FROM runtime_authority_transitions ${where}
             ORDER BY occurred_at DESC LIMIT $${params.length}`,
          params,
        );
        return res.json(envelope({ transitions: r.rows }));
      } catch (err) {
        const e = errorEnvelope('list_failed', { detail: (err as Error).message }, 500);
        return res.status(e.status).json(e.body);
      }
    },
  );
}
