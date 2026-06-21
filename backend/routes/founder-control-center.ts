/**
 * Phase 6.15 — Founder Control Center console routes (flag `founderControlCenter`, default OFF →
 * every route 503s → byte-identical legacy). READ-ONLY console, super-admin only.
 *
 *   GET  /api/admin/founder-control-center/console/ping       — FE tab gating probe (200/503)
 *   GET  /api/admin/founder-control-center/console/dashboard  — Revenue/Growth/Adoption/Retention (founder_dashboard)
 *   GET  /api/admin/founder-control-center/console/executive  — Customer/Institution/Employer/Platform health (executive_intelligence)
 *   GET  /api/admin/founder-control-center/console/strategic  — Risk Indicators + derived insights (strategic_insights)
 *   GET  /api/admin/founder-control-center/console/validation — PASS/WARN/FAIL honesty harness
 *   POST /api/admin/founder-control-center/console/setup      — ensure schema (DDL — write path)
 *   POST /api/admin/founder-control-center/console/snapshot   — persist a point-in-time capture (write path)
 *
 * GET-NEVER-WRITES: read engines probe table existence with to_regclass and degrade to honest nulls;
 * DDL (schema ensure) lives ONLY on POST /setup, and the only other write (a snapshot capture) lives
 * ONLY on POST /snapshot. The global app.use('/api/admin', requireAuth→requireSuperAdmin) gate fronts
 * every route here (unauth → 401).
 */
import type { Express } from 'express';
import pg from 'pg';
import { buildFounderDashboard } from '../services/founder-control-center/founder-dashboard-engine';
import { buildExecutiveIntelligence } from '../services/founder-control-center/executive-intelligence-engine';
import { buildStrategicInsights } from '../services/founder-control-center/strategic-insights-engine';
import { buildFounderControlCenterValidation } from '../services/founder-control-center/founder-control-center-validation';
import { ensureFounderControlCenterSchema } from '../services/founder-control-center/founder-control-center-schema';
import { tableExists } from '../services/founder-control-center/founder-control-center-lib';
import { isFounderControlCenterEnabled } from '../config/feature-flags';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerFounderControlCenterRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireConsoleFlag: GuardMW = (_req, res, next) => {
    if (!isFounderControlCenterEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'founderControlCenter' });
    }
    next();
  };
  const adminReadChain = [requireAuth, requireSuperAdmin, requireConsoleFlag];

  app.get('/api/admin/founder-control-center/console/ping', ...adminReadChain, (_req: any, res) => {
    res.json({ enabled: true });
  });

  app.get('/api/admin/founder-control-center/console/dashboard', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildFounderDashboard(pool));
    } catch (err) {
      console.error('[founder-control-center dashboard]', err);
      res.status(500).json({ error: 'founder dashboard failed' });
    }
  });

  app.get('/api/admin/founder-control-center/console/executive', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildExecutiveIntelligence(pool));
    } catch (err) {
      console.error('[founder-control-center executive]', err);
      res.status(500).json({ error: 'executive intelligence failed' });
    }
  });

  app.get('/api/admin/founder-control-center/console/strategic', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildStrategicInsights(pool));
    } catch (err) {
      console.error('[founder-control-center strategic]', err);
      res.status(500).json({ error: 'strategic insights failed' });
    }
  });

  app.get('/api/admin/founder-control-center/console/validation', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildFounderControlCenterValidation(pool));
    } catch (err) {
      console.error('[founder-control-center validation]', err);
      res.status(500).json({ error: 'validation failed' });
    }
  });

  // ── Write paths — explicit POST only ────────────────────────────────────────
  app.post('/api/admin/founder-control-center/console/setup', ...adminReadChain, async (_req: any, res) => {
    try {
      await ensureFounderControlCenterSchema(pool);
      res.json({ ok: true, message: 'Founder Control Center schema ensured.' });
    } catch (err) {
      console.error('[founder-control-center setup]', err);
      res.status(500).json({ error: 'setup failed' });
    }
  });

  app.post('/api/admin/founder-control-center/console/snapshot', ...adminReadChain, async (req: any, res) => {
    try {
      if (!(await tableExists(pool, 'founder_control_center_snapshots'))) {
        return res.status(400).json({ error: 'founder_control_center_snapshots not provisioned — run POST /console/setup first.' });
      }
      const [dashboard, executive, strategic, validation] = await Promise.all([
        buildFounderDashboard(pool),
        buildExecutiveIntelligence(pool),
        buildStrategicInsights(pool),
        buildFounderControlCenterValidation(pool),
      ]);
      const degraded = dashboard.degraded || executive.degraded || strategic.degraded;
      const capturedBy = req.user?.email ? String(req.user.email) : null;
      const ins = await pool.query(
        `INSERT INTO founder_control_center_snapshots (captured_by, degraded, dashboard, executive, strategic, validation)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
         RETURNING id, captured_by, generated_at, degraded, created_at`,
        [capturedBy, degraded, JSON.stringify(dashboard), JSON.stringify(executive), JSON.stringify(strategic), JSON.stringify(validation)]);
      res.json({ ok: true, snapshot: ins.rows[0], message: 'Founder posture snapshot captured.' });
    } catch (err) {
      console.error('[founder-control-center snapshot]', err);
      res.status(500).json({ error: 'snapshot failed' });
    }
  });
}
