/**
 * Phase 6.10 — Platform Intelligence console routes (flag `platformIntelligenceConsole`, default OFF →
 * every route 503s → byte-identical legacy). READ-ONLY, super-admin only.
 *
 *   GET /api/admin/platform/console/ping       — lightweight probe for FE tab gating (200/503)
 *   GET /api/admin/platform/console/overview    — composite platform_intelligence (7 categories + headline)
 *   GET /api/admin/platform/console/executive   — executive_dashboard projection (curated north-star KPIs)
 *   GET /api/admin/platform/console/founder      — founder_dashboard projection (North-Star + grouped metrics)
 *
 * GET-NEVER-WRITES: read-only analytics. No ensure-schema on the read path; the composed engines probe
 * table existence with to_regclass and degrade to honest empties. Composes the EXISTING read-only
 * commercial engines (engagement / retention / revenue) — never a second ledger, never recomputes.
 */
import type { Express } from 'express';
import pg from 'pg';
import { buildPlatformIntelligence } from '../services/platform/platform-intelligence-engine';
import { buildExecutiveDashboard } from '../services/platform/executive-dashboard-view';
import { buildFounderDashboard } from '../services/platform/founder-dashboard-view';
import { isPlatformIntelligenceConsoleEnabled } from '../config/feature-flags';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerPlatformIntelligenceRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireConsoleFlag: GuardMW = (_req, res, next) => {
    if (!isPlatformIntelligenceConsoleEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'platformIntelligenceConsole' });
    }
    next();
  };
  // A global `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate (routes.ts) already fronts
  // EVERY /api/admin route, so unauthenticated probes are rejected with 401 there (byte-identical to
  // any non-existent admin route) before this chain ever runs. For the only reachable caller — an
  // authenticated super-admin — flag OFF → requireConsoleFlag returns 503 and the FE tab stays hidden.
  const adminReadChain = [requireAuth, requireSuperAdmin, requireConsoleFlag];

  // Lightweight gate probe (FE hides the Platform Intelligence tab when this is not 200).
  app.get('/api/admin/platform/console/ping', ...adminReadChain, (_req: any, res) => {
    res.json({ enabled: true });
  });

  app.get('/api/admin/platform/console/overview', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildPlatformIntelligence(pool));
    } catch (err) {
      console.error('[platform intelligence overview]', err);
      res.status(500).json({ error: 'overview failed' });
    }
  });

  app.get('/api/admin/platform/console/executive', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildExecutiveDashboard(pool));
    } catch (err) {
      console.error('[platform intelligence executive]', err);
      res.status(500).json({ error: 'executive failed' });
    }
  });

  app.get('/api/admin/platform/console/founder', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildFounderDashboard(pool));
    } catch (err) {
      console.error('[platform intelligence founder]', err);
      res.status(500).json({ error: 'founder failed' });
    }
  });
}
