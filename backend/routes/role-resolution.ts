/**
 * MX-103W Phase 2 — Role Auto-Resolution admin routes.
 *
 * Thin HTTP surface over services/role-auto-resolution.ts. Flag-gated
 * (roleAutoResolution / FF_ROLE_AUTO_RESOLUTION): OFF => 503 before any auth, DB
 * or DDL touch (byte-identical legacy). Super-admin only. Reads compose existing
 * engines (no recompute); the only write path is the explicit POST that records
 * an operator decision (which ensures its own audit schema). Never throws — the
 * service degrades each layer rather than erroring.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { isRoleAutoResolutionEnabled } from '../config/feature-flags';
import {
  resolveRoleEndToEnd,
  recordResolutionDecision,
  getResolutionCoverage,
  ROLE_AUTO_RESOLUTION_VERSION,
  type RoleResolutionRequest,
} from '../services/role-auto-resolution';

type Mw = (req: any, res: any, next: any) => void;

export function registerRoleResolutionRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const gate: Mw = (_req, res, next) => {
    if (!isRoleAutoResolutionEnabled()) {
      return res.status(503).json({
        error: 'Role Auto-Resolution is not enabled',
        flag: 'roleAutoResolution',
        env: 'FF_ROLE_AUTO_RESOLUTION',
      });
    }
    next();
  };
  const guards = [gate, requireAuth, requireSuperAdmin];
  const actorId = (req: Request): string | null => (req as any).user?.id ?? null;

  app.get('/api/admin/role-resolution/_meta/status', ...guards, (_req: Request, res: Response) => {
    res.json({
      engine: 'role-auto-resolution',
      version: ROLE_AUTO_RESOLUTION_VERSION,
      flag: 'roleAutoResolution',
      composes: ['role-title-crosswalk', 'role-dna-runtime-engine', 'assessment-foundation-mapping'],
      axes: { confidence: 'title resolution', coverage: 'competency + assessment substance' },
    });
  });

  // Read-only resolution preview (does not persist a decision).
  app.get('/api/admin/role-resolution/resolve', ...guards, async (req: Request, res: Response) => {
    const title = String(req.query.title ?? '').trim();
    if (!title) return res.status(400).json({ error: 'title query param required' });
    const overrideRoleId = req.query.roleId ? String(req.query.roleId) : null;
    const result = await resolveRoleEndToEnd(pool, { title, overrideRoleId });
    res.json({ success: true, data: result });
  });

  // Resolve with full context body (still preview — no persistence).
  app.post('/api/admin/role-resolution/resolve', ...guards, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as RoleResolutionRequest;
    if (!body.title || !String(body.title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    const result = await resolveRoleEndToEnd(pool, body);
    res.json({ success: true, data: result });
  });

  // Record an operator decision (the ONLY write path; ensures its own schema).
  app.post('/api/admin/role-resolution/decision', ...guards, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as RoleResolutionRequest & { decision?: 'accepted' | 'overridden' | 'rejected' };
    if (!body.title || !String(body.title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    const result = await resolveRoleEndToEnd(pool, body);
    const persisted = await recordResolutionDecision(pool, {
      actorId: actorId(req),
      decision: body.decision ?? (result.override_applied ? 'overridden' : 'accepted'),
      request: body,
      result,
    });
    res.json({ success: persisted.ok, data: result, audit: persisted });
  });

  // Read-only coverage for the super-admin console.
  app.get('/api/admin/role-resolution/coverage', ...guards, async (_req: Request, res: Response) => {
    const coverage = await getResolutionCoverage(pool);
    res.json({ success: true, data: coverage });
  });
}
