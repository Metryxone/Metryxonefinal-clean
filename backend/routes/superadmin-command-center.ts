/**
 * Phase 6.14 — Super Admin Command Center console routes (flag `commandCenter`, default OFF →
 * every route 503s → byte-identical legacy). READ-ONLY console, super-admin only.
 *
 *   GET  /api/admin/command-center/console/ping          — FE tab gating probe (200/503)
 *   GET  /api/admin/command-center/console/unified       — 12-domain unified view (superadmin_command_center)
 *   GET  /api/admin/command-center/console/control-tower — pending actions / freshness / capacity (platform_control_tower)
 *   GET  /api/admin/command-center/console/monitoring    — alerts / 24h activity / subsystem status (global_monitoring)
 *   GET  /api/admin/command-center/console/validation    — PASS/WARN/FAIL honesty harness
 *   POST /api/admin/command-center/console/setup         — ensure command-center schema (DDL — write path)
 *   POST /api/admin/command-center/console/snapshot      — persist a point-in-time unified capture (write path)
 *
 * GET-NEVER-WRITES: read engines probe table existence with to_regclass and degrade to honest nulls;
 * DDL (schema ensure) lives ONLY on POST /setup, and the only other write (a snapshot capture) lives
 * ONLY on POST /snapshot. The global app.use('/api/admin', requireAuth→requireSuperAdmin) gate fronts
 * every route here (unauth → 401).
 */
import type { Express } from 'express';
import pg from 'pg';
import { buildCommandCenterOverview } from '../services/command-center/command-center-engine';
import { buildControlTower } from '../services/command-center/control-tower-engine';
import { buildGlobalMonitoring } from '../services/command-center/global-monitoring-engine';
import { buildCommandCenterValidation } from '../services/command-center/command-center-validation';
import { ensureCommandCenterSchema } from '../services/command-center/command-center-schema';
import { isCommandCenterEnabled } from '../config/feature-flags';

type GuardMW = (req: any, res: any, next: any) => void;

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  try {
    const r = await pool.query('SELECT to_regclass($1) AS t', [`public.${table}`]);
    return !!r.rows[0]?.t;
  } catch { return false; }
}

export function registerCommandCenterRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireConsoleFlag: GuardMW = (_req, res, next) => {
    if (!isCommandCenterEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'commandCenter' });
    }
    next();
  };
  const adminReadChain = [requireAuth, requireSuperAdmin, requireConsoleFlag];

  app.get('/api/admin/command-center/console/ping', ...adminReadChain, (_req: any, res) => {
    res.json({ enabled: true });
  });

  app.get('/api/admin/command-center/console/unified', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildCommandCenterOverview(pool));
    } catch (err) {
      console.error('[command-center unified]', err);
      res.status(500).json({ error: 'unified view failed' });
    }
  });

  app.get('/api/admin/command-center/console/control-tower', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildControlTower(pool));
    } catch (err) {
      console.error('[command-center control-tower]', err);
      res.status(500).json({ error: 'control tower failed' });
    }
  });

  app.get('/api/admin/command-center/console/monitoring', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildGlobalMonitoring(pool));
    } catch (err) {
      console.error('[command-center monitoring]', err);
      res.status(500).json({ error: 'monitoring failed' });
    }
  });

  app.get('/api/admin/command-center/console/validation', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildCommandCenterValidation(pool));
    } catch (err) {
      console.error('[command-center validation]', err);
      res.status(500).json({ error: 'validation failed' });
    }
  });

  // ── Write paths — explicit POST only ────────────────────────────────────────
  app.post('/api/admin/command-center/console/setup', ...adminReadChain, async (_req: any, res) => {
    try {
      await ensureCommandCenterSchema(pool);
      res.json({ ok: true, message: 'Command Center schema ensured.' });
    } catch (err) {
      console.error('[command-center setup]', err);
      res.status(500).json({ error: 'setup failed' });
    }
  });

  app.post('/api/admin/command-center/console/snapshot', ...adminReadChain, async (req: any, res) => {
    try {
      if (!(await tableExists(pool, 'command_center_snapshots'))) {
        return res.status(400).json({ error: 'command_center_snapshots not provisioned — run POST /console/setup first.' });
      }
      const overview = await buildCommandCenterOverview(pool);
      const key = `snapshot_${Date.now()}`;
      const createdBy = req.user?.email ? String(req.user.email) : null;
      const ins = await pool.query(
        `INSERT INTO command_center_snapshots (snapshot_key, domains, totals, created_by)
         VALUES ($1, $2::jsonb, $3::jsonb, $4)
         RETURNING id, snapshot_key, generated_at, totals, created_by, created_at`,
        [key, JSON.stringify(overview.domains), JSON.stringify(overview.totals), createdBy]);
      res.json({ ok: true, snapshot: ins.rows[0], message: 'Unified posture snapshot captured.' });
    } catch (err) {
      console.error('[command-center snapshot]', err);
      res.status(500).json({ error: 'snapshot failed' });
    }
  });
}
