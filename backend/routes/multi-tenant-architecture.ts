/**
 * Phase 6.11 — Multi-Tenant Architecture console routes (flag `tenantManagementConsole`, default OFF →
 * every route 503s → byte-identical legacy). READ-ONLY console, super-admin only.
 *
 *   GET  /api/admin/tenant-architecture/console/ping          — FE tab gating probe (200/503)
 *   GET  /api/admin/tenant-architecture/console/management    — unified 5-category tenant management view
 *   GET  /api/admin/tenant-architecture/console/isolation     — tenant_id coverage audit + renormalized index
 *   GET  /api/admin/tenant-architecture/console/configuration — branding/permissions/tier/seat-cap config
 *   GET  /api/admin/tenant-architecture/console/enforcement   — opt-in RLS enforcement status (read-only)
 *   GET  /api/admin/tenant-architecture/console/validation    — PASS/WARN/FAIL honesty harness
 *   POST /api/admin/tenant-architecture/console/setup         — ensure relationship schema (DDL — write path)
 *   POST /api/admin/tenant-architecture/console/enforcement/arm    — arm RLS on additive tables (sub-flag gated)
 *   POST /api/admin/tenant-architecture/console/enforcement/disarm — reverse arming (restore byte-identical)
 *
 * GET-NEVER-WRITES: read engines probe table existence with to_regclass and degrade to honest empties;
 * DDL (relationship schema ensure + RLS arm) lives ONLY on the explicit POST paths. The global
 * `app.use('/api/admin', requireAuth→requireSuperAdmin)` gate fronts every route here (unauth → 401).
 */
import type { Express } from 'express';
import pg from 'pg';
import { buildTenantManagement } from '../services/tenant/tenant-management-engine';
import { buildTenantIsolationAudit } from '../services/tenant/tenant-isolation-engine';
import { buildTenantConfiguration } from '../services/tenant/tenant-configuration-engine';
import { buildTenantValidation } from '../services/tenant/tenant-validation-view';
import {
  getEnforcementStatus,
  armTenantIsolationEnforcement,
  disarmTenantIsolationEnforcement,
} from '../services/tenant/tenant-isolation-enforcement';
import { ensureTenantRelationshipSchema } from '../services/tenant/tenant-relationship-schema';
import {
  isTenantManagementConsoleEnabled,
  isTenantIsolationEnforcementEnabled,
} from '../config/feature-flags';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerMultiTenantArchitectureRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireConsoleFlag: GuardMW = (_req, res, next) => {
    if (!isTenantManagementConsoleEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'tenantManagementConsole' });
    }
    next();
  };
  const adminReadChain = [requireAuth, requireSuperAdmin, requireConsoleFlag];

  app.get('/api/admin/tenant-architecture/console/ping', ...adminReadChain, (_req: any, res) => {
    res.json({ enabled: true });
  });

  app.get('/api/admin/tenant-architecture/console/management', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildTenantManagement(pool));
    } catch (err) {
      console.error('[multi-tenant management]', err);
      res.status(500).json({ error: 'management failed' });
    }
  });

  app.get('/api/admin/tenant-architecture/console/isolation', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildTenantIsolationAudit(pool));
    } catch (err) {
      console.error('[multi-tenant isolation]', err);
      res.status(500).json({ error: 'isolation failed' });
    }
  });

  app.get('/api/admin/tenant-architecture/console/configuration', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildTenantConfiguration(pool));
    } catch (err) {
      console.error('[multi-tenant configuration]', err);
      res.status(500).json({ error: 'configuration failed' });
    }
  });

  app.get('/api/admin/tenant-architecture/console/enforcement', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await getEnforcementStatus(pool));
    } catch (err) {
      console.error('[multi-tenant enforcement status]', err);
      res.status(500).json({ error: 'enforcement status failed' });
    }
  });

  app.get('/api/admin/tenant-architecture/console/validation', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildTenantValidation(pool));
    } catch (err) {
      console.error('[multi-tenant validation]', err);
      res.status(500).json({ error: 'validation failed' });
    }
  });

  // ── Write paths (DDL / RLS) — explicit POST only ─────────────────────────────
  app.post('/api/admin/tenant-architecture/console/setup', ...adminReadChain, async (_req: any, res) => {
    try {
      await ensureTenantRelationshipSchema(pool);
      res.json({ ok: true, message: 'Relationship schema ensured.' });
    } catch (err) {
      console.error('[multi-tenant setup]', err);
      res.status(500).json({ error: 'setup failed' });
    }
  });

  app.post('/api/admin/tenant-architecture/console/enforcement/arm', ...adminReadChain, async (_req: any, res) => {
    if (!isTenantIsolationEnforcementEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'tenantIsolationEnforcement' });
    }
    try {
      res.json(await armTenantIsolationEnforcement(pool));
    } catch (err) {
      console.error('[multi-tenant enforcement arm]', err);
      res.status(500).json({ error: 'arm failed' });
    }
  });

  app.post('/api/admin/tenant-architecture/console/enforcement/disarm', ...adminReadChain, async (_req: any, res) => {
    if (!isTenantIsolationEnforcementEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'tenantIsolationEnforcement' });
    }
    try {
      res.json(await disarmTenantIsolationEnforcement(pool));
    } catch (err) {
      console.error('[multi-tenant enforcement disarm]', err);
      res.status(500).json({ error: 'disarm failed' });
    }
  });
}
