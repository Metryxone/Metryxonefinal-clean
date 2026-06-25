/**
 * MX-108 — Platform Completion Certification & Founder Executive Report routes (read-only composer).
 *
 * COMPOSES the existing certification / activation / health composers + read-only content/structure
 * probes into one platform-completion picture:
 *   - GET /api/admin/platform-completion/enabled        flag probe (behind the global /api/admin auth gate)
 *   - GET /api/admin/platform-completion/overview        headline (overall completion + 5 dimensions + modules)
 *   - GET /api/admin/platform-completion/dimensions      the five SEPARATE certification dimensions
 *   - GET /api/admin/platform-completion/content         genome / question / Role-DNA / O*NET content probe
 *   - GET /api/admin/platform-completion/founder         full Founder Executive view (+ risks + recommendation)
 *   - GET /api/admin/platform-completion/certification   per-module PASS/PARTIAL/FAIL + verdict
 *
 * Strictly additive + reversible + flag-gated (`platformCompletion`, FF_PLATFORM_COMPLETION, default OFF):
 *   - The global `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate runs FIRST, so unauthenticated
 *     callers get 401; for an authenticated super-admin, OFF → 503 (no DB touch) → byte-identical legacy
 *     behaviour (no schema touched), ON → 200.
 *   - GET-only; the composer reads via to_regclass probes and NEVER writes (no DDL anywhere).
 *   - Never throws: any unexpected error degrades to a 200 honest-degraded JSON.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  platformCompletionOverview,
  platformCompletionDimensions,
  platformCompletionContent,
  platformCompletionFounder,
  platformCompletionCertification,
} from '../services/platform-completion-certification';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('platformCompletion')) {
    return res.status(503).json({ ok: false, error: 'platform_completion_disabled' });
  }
  next();
}

const degraded = (res: Response) =>
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });

export function registerPlatformCompletionRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  // Persona-agnostic flag probe (flag STATE is not sensitive). flagGate runs first → 503 when OFF;
  // res.ok=true only when ON. Lets the SuperAdmin UI hide the tab byte-identically.
  app.get('/api/admin/platform-completion/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  app.get('/api/admin/platform-completion/overview', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await platformCompletionOverview(pool)); }
    catch (err) { console.error('[platform-completion] overview error:', err); degraded(res); }
  });

  app.get('/api/admin/platform-completion/dimensions', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await platformCompletionDimensions(pool)); }
    catch (err) { console.error('[platform-completion] dimensions error:', err); degraded(res); }
  });

  app.get('/api/admin/platform-completion/content', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await platformCompletionContent(pool)); }
    catch (err) { console.error('[platform-completion] content error:', err); degraded(res); }
  });

  app.get('/api/admin/platform-completion/founder', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await platformCompletionFounder(pool)); }
    catch (err) { console.error('[platform-completion] founder error:', err); degraded(res); }
  });

  app.get('/api/admin/platform-completion/certification', flagGate, requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
    try { res.json(await platformCompletionCertification(pool)); }
    catch (err) { console.error('[platform-completion] certification error:', err); degraded(res); }
  });

  console.log('[platform-completion] MX-108 routes registered — platform completion certification & founder report (read-only composer)');
}
