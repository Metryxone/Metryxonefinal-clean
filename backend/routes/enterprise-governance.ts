/**
 * Phase 6.9 — Enterprise Governance console routes (flag `enterpriseGovernanceConsole`, default OFF →
 * every route 503s → byte-identical legacy). READ-ONLY, super-admin only.
 *
 *   GET /api/admin/governance/console/ping       — lightweight probe for FE tab gating (200/503)
 *   GET /api/admin/governance/console/overview   — composite (headline + compliance + data-gov + audit + approvals + security)
 *   GET /api/admin/governance/console/audit      — audit trail view only
 *   GET /api/admin/governance/console/approvals  — approval workflow view only
 *   GET /api/admin/governance/console/security   — security center view only
 *
 * GET-NEVER-WRITES: read-only analytics. No ensure-schema on the read path; engines probe table
 * existence with to_regclass and degrade to honest empties. Distinct from the operational
 * /api/admin/governance/* routes (gated by `governanceRbacV2`) — this is the read-only console layer.
 */
import type { Express } from 'express';
import pg from 'pg';
import { buildEnterpriseGovernance } from '../services/governance/enterprise-governance-engine';
import { buildAuditTrailView } from '../services/governance/audit-trail-view';
import { buildApprovalWorkflowView } from '../services/governance/approval-workflow-view';
import { buildSecurityCenterView } from '../services/governance/security-center-view';
import { isEnterpriseGovernanceConsoleEnabled } from '../config/feature-flags';

type GuardMW = (req: any, res: any, next: any) => void;

export function registerEnterpriseGovernanceRoutes(
  app: Express,
  pool: pg.Pool,
  requireAuth: GuardMW,
  requireSuperAdmin: GuardMW,
): void {
  const requireConsoleFlag: GuardMW = (_req, res, next) => {
    if (!isEnterpriseGovernanceConsoleEnabled()) {
      return res.status(503).json({ error: 'feature_disabled', flag: 'enterpriseGovernanceConsole' });
    }
    next();
  };
  const adminReadChain = [requireAuth, requireSuperAdmin, requireConsoleFlag];

  // Lightweight gate probe (FE hides the Enterprise Governance tab when this is not 200).
  app.get('/api/admin/governance/console/ping', ...adminReadChain, (_req: any, res) => {
    res.json({ enabled: true });
  });

  app.get('/api/admin/governance/console/overview', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildEnterpriseGovernance(pool));
    } catch (err) {
      console.error('[enterprise governance overview]', err);
      res.status(500).json({ error: 'overview failed' });
    }
  });

  app.get('/api/admin/governance/console/audit', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildAuditTrailView(pool));
    } catch (err) {
      console.error('[enterprise governance audit]', err);
      res.status(500).json({ error: 'audit failed' });
    }
  });

  app.get('/api/admin/governance/console/approvals', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildApprovalWorkflowView(pool));
    } catch (err) {
      console.error('[enterprise governance approvals]', err);
      res.status(500).json({ error: 'approvals failed' });
    }
  });

  app.get('/api/admin/governance/console/security', ...adminReadChain, async (_req: any, res) => {
    try {
      res.json(await buildSecurityCenterView(pool));
    } catch (err) {
      console.error('[enterprise governance security]', err);
      res.status(500).json({ error: 'security failed' });
    }
  });
}
