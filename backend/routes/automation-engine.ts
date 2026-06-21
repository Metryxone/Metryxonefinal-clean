/**
 * Phase 6.13 — Automation Engine console routes (flag `automationEngine`, default OFF →
 * every route 503s → byte-identical legacy). READ-ONLY console, super-admin only.
 *
 *   GET  /api/admin/automation/console/ping        — FE tab gating probe (200/503)
 *   GET  /api/admin/automation/console/automations — 7-process automation posture (eligible_now)
 *   GET  /api/admin/automation/console/workflows   — workflow definitions + instance rollup + due steps
 *   GET  /api/admin/automation/console/campaigns   — campaign definitions + composed campaign substrate
 *   GET  /api/admin/automation/console/execution   — execution status (schema readiness + last run)
 *   GET  /api/admin/automation/console/validation  — PASS/WARN/FAIL honesty harness
 *   POST /api/admin/automation/console/setup       — ensure automation schema (DDL — write path)
 *   POST /api/admin/automation/console/run         — enqueue intent-only run (sub-flag automationExecution)
 *
 * GET-NEVER-WRITES: read engines probe table existence with to_regclass and degrade to honest empties;
 * DDL (schema ensure) lives ONLY on POST /setup; the intent-only run write lives ONLY on POST /run and is
 * gated by the automationExecution sub-flag. The global app.use('/api/admin', requireAuth→requireSuperAdmin)
 * gate fronts every route here (unauth → 401).
 */
import type { Express } from 'express';
import pg from 'pg';
import { buildAutomationOverview } from '../services/automation/automation-engine';
import { buildWorkflowOverview } from '../services/automation/workflow-engine';
import { buildCampaignOverview } from '../services/automation/campaign-engine';
import { buildAutomationValidation } from '../services/automation/automation-validation';
import { getExecutionStatus, enqueueAutomationRun } from '../services/automation/automation-execution';
import { ensureAutomationSchema } from '../services/automation/automation-schema';
import { isAutomationEngineEnabled, isAutomationExecutionEnabled } from '../config/feature-flags';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerAutomationEngineRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireConsoleFlag: GuardMW = (_req, res, next) => {
    if (!isAutomationEngineEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'automationEngine' });
    }
    next();
  };
  const adminReadChain = [requireAuth, requireSuperAdmin, requireConsoleFlag];

  app.get('/api/admin/automation/console/ping', ...adminReadChain, (_req: any, res) => {
    res.json({ enabled: true, execution: isAutomationExecutionEnabled() });
  });

  app.get('/api/admin/automation/console/automations', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildAutomationOverview(pool));
    } catch (err) {
      console.error('[automation overview]', err);
      res.status(500).json({ error: 'automations failed' });
    }
  });

  app.get('/api/admin/automation/console/workflows', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildWorkflowOverview(pool));
    } catch (err) {
      console.error('[automation workflows]', err);
      res.status(500).json({ error: 'workflows failed' });
    }
  });

  app.get('/api/admin/automation/console/campaigns', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildCampaignOverview(pool));
    } catch (err) {
      console.error('[automation campaigns]', err);
      res.status(500).json({ error: 'campaigns failed' });
    }
  });

  app.get('/api/admin/automation/console/execution', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json({ ...(await getExecutionStatus(pool)), execution_flag: isAutomationExecutionEnabled() });
    } catch (err) {
      console.error('[automation execution status]', err);
      res.status(500).json({ error: 'execution status failed' });
    }
  });

  app.get('/api/admin/automation/console/validation', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildAutomationValidation(pool));
    } catch (err) {
      console.error('[automation validation]', err);
      res.status(500).json({ error: 'validation failed' });
    }
  });

  // ── Write paths — explicit POST only ────────────────────────────────────────
  app.post('/api/admin/automation/console/setup', ...adminReadChain, async (_req: any, res) => {
    try {
      await ensureAutomationSchema(pool);
      res.json({ ok: true, message: 'Automation schema ensured.' });
    } catch (err) {
      console.error('[automation setup]', err);
      res.status(500).json({ error: 'setup failed' });
    }
  });

  app.post('/api/admin/automation/console/run', ...adminReadChain, async (req: any, res) => {
    if (!isAutomationExecutionEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'automationExecution' });
    }
    const automationKey = String(req.body?.automation_key ?? '').trim();
    if (!automationKey) {
      return res.status(400).json({ error: 'automation_key is required' });
    }
    try {
      const result = await enqueueAutomationRun(pool, automationKey);
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
      console.error('[automation run]', err);
      res.status(500).json({ error: 'run failed' });
    }
  });
}
