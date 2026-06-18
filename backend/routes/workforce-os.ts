/**
 * Phase 5 — Workforce OS routes (`/api/wos/*`).
 *
 * Surfaces the six net-new domains:
 *   • market intelligence  (ingest + query)
 *   • predictive workforce (obsolescence / risk / emergence / AI exposure)
 *   • fairness & bias monitoring (suites + results + compute)
 *   • disputes & human override workflow
 *   • RBAC + tenant assignments
 *   • learning ROI compute + history
 *
 * Envelope contract: every response includes `language_policy` +
 * `methodology_versions` + `request_id`. Write endpoints require auth and
 * RBAC permission. All handlers wrapped in safeAsync — they never throw.
 */

import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { randomUUID } from 'crypto';

import {
  ingestSignals, querySignals, competencyDisruptionSummary,
  roleDemandMomentum, emergingRoles, macroTrends,
  MARKET_INTELLIGENCE_VERSION, type MarketSignal,
} from '../services/market-intelligence-engine.js';
import {
  listObsolescence, listWorkforceRisk, recomputeOrgRiskSnapshot,
  aiExposure, listEmergingRoles, PREDICTIVE_WORKFORCE_VERSION,
} from '../services/predictive-workforce-engine.js';
import {
  listSuites, createSuite, recordResult, listResults, summary as fairnessSummary,
  computeFairness, sampleCohortScores, fairnessAttributeWhitelist,
  FAIRNESS_MONITORING_VERSION, type FairnessMetric,
} from '../services/fairness-monitoring-engine.js';
import {
  fileDispute, getDispute, listDisputes, transitionDispute, listOverrides,
  DISPUTE_OVERRIDE_VERSION, type DisputeStatus, type DisputeSubject, type ReasonCode,
} from '../services/dispute-override-engine.js';
import {
  listRoles, listAssignments, assignRole, revokeAssignment, effectivePermissions,
  userHasPermission, listTenants, resolveTenantFromRequest, RBAC_TENANT_VERSION,
} from '../services/rbac-tenant-engine.js';
import {
  computeRoi, persistRoi, listRoi, LEARNING_ROI_VERSION,
} from '../services/learning-roi-engine.js';

const LANGUAGE_POLICY = Object.freeze({
  allowed: [
    'developmental signal', 'capability uplift', 'capacity gain estimate',
    'workforce risk band', 'market momentum', 'AI exposure', 'augmentation balance',
    'fairness check', 'dispute resolution', 'human override trail',
  ],
  disallowed: [
    'hiring prediction', 'guaranteed ROI', 'promotion likelihood',
    'firing recommendation', 'will replace', 'guaranteed savings',
  ],
});

const METHODOLOGY_VERSIONS = Object.freeze({
  market_intelligence: MARKET_INTELLIGENCE_VERSION,
  predictive_workforce: PREDICTIVE_WORKFORCE_VERSION,
  fairness_monitoring: FAIRNESS_MONITORING_VERSION,
  dispute_override: DISPUTE_OVERRIDE_VERSION,
  rbac_tenant: RBAC_TENANT_VERSION,
  learning_roi: LEARNING_ROI_VERSION,
});

function withEnvelope<T extends Record<string, unknown>>(payload: T, requestId?: string) {
  return {
    ...payload,
    language_policy: LANGUAGE_POLICY,
    methodology_versions: METHODOLOGY_VERSIONS,
    request_id: requestId ?? randomUUID(),
  };
}

function sessionUserId(req: Request): string | null {
  const u = (req as any).user;
  if (u?.id) return String(u.id);
  if (u?.user_id) return String(u.user_id);
  return null;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const isAuthed = (req as any).isAuthenticated?.() === true;
  if (isAuthed && sessionUserId(req)) return next();
  return res.status(401).json(withEnvelope({
    ok: false, error: 'authentication_required',
    detail: 'Session-bound endpoints require an authenticated user.',
  }));
}

function requirePermission(pool: Pool, permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const uid = sessionUserId(req);
    if (!uid) {
      return res.status(401).json(withEnvelope({ ok: false, error: 'authentication_required' }));
    }
    const tenantId = resolveTenantFromRequest(req);
    try {
      const ok = await userHasPermission(pool, uid, permission, tenantId);
      if (!ok) {
        return res.status(403).json(withEnvelope({
          ok: false, error: 'forbidden',
          detail: `Permission '${permission}' required.`,
        }));
      }
      return next();
    } catch (e: any) {
      // Fail closed but with a clear message
      return res.status(500).json(withEnvelope({
        ok: false, error: 'rbac_check_failed', detail: e?.message ?? 'unknown',
      }));
    }
  };
}

function safeAsync(handler: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try { await handler(req, res); }
    catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[workforce-os] handler error:', e?.message, e?.stack?.split('\n')[1]);
      if (!res.headersSent) {
        res.status(500).json(withEnvelope({
          ok: false, error: 'workforce_os_handler_failed', detail: e?.message ?? 'unknown',
        }));
      }
    }
  };
}

async function auditLog(pool: Pool, args: {
  user_id?: string | null; tenant_id?: number | null; endpoint: string;
  status: 'ok' | 'fallback' | 'error' | 'denied';
  request_id?: string; detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO wos_audit_logs (user_id, tenant_id, endpoint, status, request_id, detail)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [args.user_id ?? null, args.tenant_id ?? null, args.endpoint, args.status,
       args.request_id ?? null, JSON.stringify(args.detail ?? {})]);
  } catch { /* never break the response */ }
}

// ═══════════════════════════════════════════════════════════════════════════
// Router registration
// ═══════════════════════════════════════════════════════════════════════════

export function registerWorkforceOsRoutes(opts: { app: Express; pool: Pool }) {
  const { app, pool } = opts;

  // Methodology / health
  app.get('/api/wos/methodology', safeAsync(async (_req, res) => {
    res.json(withEnvelope({
      ok: true, versions: METHODOLOGY_VERSIONS,
      description: 'Phase 5 Workforce OS: market intelligence, predictive workforce, fairness, disputes/overrides, RBAC, learning ROI.',
    }));
  }));

  // ── Market Intelligence ────────────────────────────────────────────────

  app.get('/api/wos/market/signals', safeAsync(async (req, res) => {
    const opts = {
      signal_type: req.query.signal_type as MarketSignal['signal_type'] | undefined,
      role_id: req.query.role_id as string | undefined,
      competency_id: req.query.competency_id as string | undefined,
      industry_id: req.query.industry_id as string | undefined,
      geography: req.query.geography as string | undefined,
      since_days: req.query.since_days ? Number(req.query.since_days) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };
    const signals = await querySignals(pool, opts);
    res.json(withEnvelope({ ok: true, count: signals.length, signals }));
  }));

  app.get('/api/wos/market/disruption', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, summary: await competencyDisruptionSummary(pool) }));
  }));

  app.get('/api/wos/market/demand-momentum', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, roles: await roleDemandMomentum(pool) }));
  }));

  app.get('/api/wos/market/emerging-roles', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, roles: await emergingRoles(pool) }));
  }));

  app.get('/api/wos/market/macro-trends', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, trends: await macroTrends(pool) }));
  }));

  app.post('/api/wos/market/ingest', requireAuth, requirePermission(pool, 'market:write'),
    safeAsync(async (req, res) => {
      const body = req.body ?? {};
      const signals = Array.isArray(body.signals) ? body.signals as MarketSignal[]
                    : Array.isArray(body) ? body as MarketSignal[] : [];
      if (!signals.length) {
        return res.status(400).json(withEnvelope({ ok: false, error: 'no_signals' }));
      }
      const requestId = randomUUID();
      const result = await ingestSignals(pool, signals);
      await auditLog(pool, {
        user_id: sessionUserId(req), endpoint: '/api/wos/market/ingest',
        status: 'ok', request_id: requestId, detail: { inserted: result.inserted },
      });
      res.json(withEnvelope({ ok: true, ...result }, requestId));
    }));

  // ── Predictive Workforce ───────────────────────────────────────────────

  app.get('/api/wos/predictive/obsolescence', safeAsync(async (req, res) => {
    const rows = await listObsolescence(pool, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      min_score: req.query.min_score ? Number(req.query.min_score) : undefined,
    });
    res.json(withEnvelope({ ok: true, count: rows.length, obsolescence: rows }));
  }));

  app.get('/api/wos/predictive/risk', safeAsync(async (req, res) => {
    const tenantId = req.query.tenant_id ? Number(req.query.tenant_id) : resolveTenantFromRequest(req);
    const rows = await listWorkforceRisk(pool, {
      tenant_id: tenantId ?? undefined,
      risk_type: req.query.risk_type as any,
      severity: req.query.severity as any,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(withEnvelope({ ok: true, count: rows.length, risks: rows }));
  }));

  app.post('/api/wos/predictive/risk/refresh', requireAuth, requirePermission(pool, 'wos:write'),
    safeAsync(async (req, res) => {
      const tenantId = Number(req.body?.tenant_id ?? req.query.tenant_id ?? resolveTenantFromRequest(req) ?? 0);
      if (!Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json(withEnvelope({ ok: false, error: 'tenant_id_required' }));
      }
      const requestId = randomUUID();
      const risks = await recomputeOrgRiskSnapshot(pool, tenantId);
      await auditLog(pool, {
        user_id: sessionUserId(req), tenant_id: tenantId,
        endpoint: '/api/wos/predictive/risk/refresh', status: 'ok',
        request_id: requestId, detail: { count: risks.length },
      });
      res.json(withEnvelope({ ok: true, tenant_id: tenantId, risks }, requestId));
    }));

  app.get('/api/wos/predictive/ai-exposure', safeAsync(async (req, res) => {
    const scope = (req.query.scope as 'competency' | 'role' | 'all') ?? 'all';
    res.json(withEnvelope({ ok: true, exposure: await aiExposure(pool, scope) }));
  }));

  app.get('/api/wos/predictive/role-emergence', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, roles: await listEmergingRoles(pool) }));
  }));

  // ── Fairness & Bias ────────────────────────────────────────────────────

  app.get('/api/wos/fairness/suites', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, suites: await listSuites(pool) }));
  }));

  app.post('/api/wos/fairness/suites', requireAuth, requirePermission(pool, 'fairness:write'),
    safeAsync(async (req, res) => {
      const b = req.body ?? {};
      if (!b.suite_name || !Array.isArray(b.protected_attributes) || !Array.isArray(b.metric_set)) {
        return res.status(400).json(withEnvelope({ ok: false, error: 'invalid_suite_definition' }));
      }
      const out = await createSuite(pool, {
        suite_name: String(b.suite_name),
        description: b.description ? String(b.description) : undefined,
        protected_attributes: b.protected_attributes,
        metric_set: b.metric_set,
        thresholds: b.thresholds ?? {},
      });
      res.json(withEnvelope({ ok: true, ...out }));
    }));

  app.get('/api/wos/fairness/results', safeAsync(async (req, res) => {
    const rows = await listResults(pool, {
      suite_id: req.query.suite_id as string | undefined,
      surface: req.query.surface as string | undefined,
      passed: req.query.passed != null ? String(req.query.passed) === 'true' : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(withEnvelope({ ok: true, count: rows.length, results: rows }));
  }));

  app.get('/api/wos/fairness/summary', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, summary: await fairnessSummary(pool) }));
  }));

  // Gap #1 — auto-sample group scores from cra_scores instead of requiring caller-supplied arrays.
  app.get('/api/wos/fairness/attributes', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, attributes: fairnessAttributeWhitelist() }));
  }));

  app.post('/api/wos/fairness/compute-auto', requireAuth, requirePermission(pool, 'fairness:write'),
    safeAsync(async (req, res) => {
      const b = req.body ?? {};
      if (!b.suite_id || !b.surface || !b.attribute || !b.metric || !b.value_a || !b.value_b) {
        return res.status(400).json(withEnvelope({
          ok: false, error: 'invalid_input',
          detail: 'suite_id, surface, attribute, metric, value_a, value_b are required.',
        }));
      }
      const whitelist = fairnessAttributeWhitelist();
      if (!whitelist.includes(String(b.attribute))) {
        return res.status(400).json(withEnvelope({
          ok: false, error: 'attribute_not_whitelisted',
          detail: `attribute must be one of: ${whitelist.join(', ')}`,
        }));
      }
      const samples = await sampleCohortScores(pool, {
        attribute: String(b.attribute),
        value_a: String(b.value_a),
        value_b: String(b.value_b),
        competency_code: b.competency_code ? String(b.competency_code) : null,
        tenant_id: b.tenant_id != null ? Number(b.tenant_id) : null,
        selection_threshold: b.selection_threshold != null ? Number(b.selection_threshold) : undefined,
      });
      const computed = computeFairness({
        metric: b.metric as FairnessMetric,
        group_a: samples.group_a, group_b: samples.group_b,
        threshold: Number(b.threshold ?? 0.8),
      });
      const persisted = await recordResult(pool, {
        suite_id: String(b.suite_id), surface: String(b.surface), attribute: String(b.attribute),
        result: computed,
      });
      await auditLog(pool, {
        user_id: sessionUserId(req), tenant_id: resolveTenantFromRequest(req),
        endpoint: '/api/wos/fairness/compute-auto', status: 'ok',
        detail: { suite_id: b.suite_id, attribute: b.attribute,
                  sample_size_a: computed.sample_size_a, sample_size_b: computed.sample_size_b,
                  passed: computed.passed },
      });
      res.json(withEnvelope({
        ok: true, result: computed, result_id: persisted.id,
        sampled_from: 'cra_scores',
        cohort_sizes: { a: computed.sample_size_a, b: computed.sample_size_b },
      }));
    }));

  app.post('/api/wos/fairness/compute', requireAuth, requirePermission(pool, 'fairness:write'),
    safeAsync(async (req, res) => {
      const b = req.body ?? {};
      if (!b.suite_id || !b.surface || !b.attribute || !b.metric || !b.group_a || !b.group_b) {
        return res.status(400).json(withEnvelope({ ok: false, error: 'invalid_input' }));
      }
      const computed = computeFairness({
        metric: b.metric as FairnessMetric,
        group_a: b.group_a, group_b: b.group_b,
        threshold: Number(b.threshold ?? 0.8),
      });
      const persisted = await recordResult(pool, {
        suite_id: String(b.suite_id), surface: String(b.surface), attribute: String(b.attribute),
        result: computed,
      });
      res.json(withEnvelope({ ok: true, result: computed, result_id: persisted.id }));
    }));

  // ── Disputes & Overrides ───────────────────────────────────────────────

  app.get('/api/wos/disputes', safeAsync(async (req, res) => {
    const rows = await listDisputes(pool, {
      status: req.query.status as DisputeStatus | undefined,
      tenant_id: req.query.tenant_id ? Number(req.query.tenant_id) : undefined,
      user_id: req.query.user_id as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(withEnvelope({ ok: true, count: rows.length, disputes: rows }));
  }));

  app.get('/api/wos/disputes/:id', safeAsync(async (req, res) => {
    const row = await getDispute(pool, req.params.id);
    if (!row) return res.status(404).json(withEnvelope({ ok: false, error: 'not_found' }));
    res.json(withEnvelope({ ok: true, dispute: row }));
  }));

  app.post('/api/wos/disputes', requireAuth, safeAsync(async (req, res) => {
    const b = req.body ?? {};
    if (!b.subject_type || !b.subject_ref || !b.reason_code) {
      return res.status(400).json(withEnvelope({ ok: false, error: 'invalid_input' }));
    }
    const uid = sessionUserId(req)!;
    const tenantId = b.tenant_id ?? resolveTenantFromRequest(req) ?? null;
    const out = await fileDispute(pool, {
      user_id: uid, tenant_id: tenantId,
      subject_type: b.subject_type as DisputeSubject, subject_ref: String(b.subject_ref),
      reason_code: b.reason_code as ReasonCode, description: b.description,
    });
    await auditLog(pool, {
      user_id: uid, tenant_id: tenantId, endpoint: '/api/wos/disputes',
      status: 'ok', detail: { dispute_id: out.id },
    });
    res.json(withEnvelope({ ok: true, ...out }));
  }));

  app.post('/api/wos/disputes/:id/transition', requireAuth, requirePermission(pool, 'disputes:resolve'),
    safeAsync(async (req, res) => {
      const b = req.body ?? {};
      const uid = sessionUserId(req)!;
      const result = await transitionDispute(pool, {
        dispute_id: req.params.id,
        to_status: b.to_status as DisputeStatus,
        reviewer_id: uid,
        resolution: b.resolution,
        override: b.override,
      });
      if (!result.ok) {
        await auditLog(pool, { user_id: uid, endpoint: `/api/wos/disputes/${req.params.id}/transition`,
          status: 'error', detail: { error: result.error } });
        return res.status(400).json(withEnvelope({ ok: false, error: result.error }));
      }
      await auditLog(pool, { user_id: uid, endpoint: `/api/wos/disputes/${req.params.id}/transition`,
        status: 'ok', detail: { to_status: result.status, override_id: result.override_id } });
      res.json(withEnvelope({ ok: true, ...result }));
    }));

  app.get('/api/wos/overrides', safeAsync(async (req, res) => {
    const rows = await listOverrides(pool, {
      subject_type: req.query.subject_type as string | undefined,
      subject_ref: req.query.subject_ref as string | undefined,
      active: req.query.active != null ? String(req.query.active) === 'true' : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(withEnvelope({ ok: true, count: rows.length, overrides: rows }));
  }));

  // ── RBAC & Tenants ─────────────────────────────────────────────────────

  app.get('/api/wos/rbac/roles', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, roles: await listRoles(pool) }));
  }));

  app.get('/api/wos/rbac/assignments', safeAsync(async (req, res) => {
    const rows = await listAssignments(pool, {
      user_id: req.query.user_id as string | undefined,
      tenant_id: req.query.tenant_id ? Number(req.query.tenant_id) : undefined,
      active: req.query.active != null ? String(req.query.active) === 'true' : true,
    });
    res.json(withEnvelope({ ok: true, count: rows.length, assignments: rows }));
  }));

  app.post('/api/wos/rbac/assignments', requireAuth, requirePermission(pool, 'platform:*'),
    safeAsync(async (req, res) => {
      const b = req.body ?? {};
      if (!b.user_id || !b.role_id) {
        return res.status(400).json(withEnvelope({ ok: false, error: 'invalid_input' }));
      }
      const targetTenant = b.tenant_id != null ? Number(b.tenant_id) : null;
      const targetRoleId = String(b.role_id);
      // Defense in depth: only a true platform-wide admin (NULL-tenant
      // assignment) may grant platform-wide roles or NULL-tenant assignments.
      // requirePermission already gates 'platform:*' but with our scoped
      // matcher that means platform-wide; re-verify here to make the
      // privilege-escalation invariant explicit and auditable.
      const granter = sessionUserId(req)!;
      const eff = await effectivePermissions(pool, granter, null);
      const platformAdmin = eff.platform_permissions.includes('platform:*');
      const roleRow = (await listRoles(pool)).find(r => r.id === targetRoleId);
      const grantingPlatformWideRole =
        targetTenant == null ||
        (roleRow?.permissions ?? []).some(p => p.startsWith('platform:'));
      if (grantingPlatformWideRole && !platformAdmin) {
        await auditLog(pool, {
          user_id: granter, tenant_id: resolveTenantFromRequest(req),
          endpoint: 'POST /api/wos/rbac/assignments', status: 'denied',
          detail: { target_role_id: targetRoleId, target_tenant: targetTenant,
                    reason: 'platform_admin_required_for_platform_scope' },
        });
        return res.status(403).json(withEnvelope({
          ok: false, error: 'forbidden',
          detail: 'Platform-wide assignments require a platform-wide admin grant.',
        }));
      }
      const out = await assignRole(pool, {
        user_id: String(b.user_id), role_id: targetRoleId,
        tenant_id: targetTenant,
        granted_by: granter,
        expires_at: b.expires_at ?? null,
      });
      res.json(withEnvelope({ ok: true, ...out }));
    }));

  app.delete('/api/wos/rbac/assignments/:id', requireAuth, requirePermission(pool, 'platform:*'),
    safeAsync(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) return res.status(400).json(withEnvelope({ ok: false, error: 'bad_id' }));
      res.json(withEnvelope({ ok: true, ...(await revokeAssignment(pool, id)) }));
    }));

  app.get('/api/wos/rbac/effective', requireAuth, safeAsync(async (req, res) => {
    const uid = sessionUserId(req)!;
    const tenantId = req.query.tenant_id ? Number(req.query.tenant_id) : resolveTenantFromRequest(req);
    const eff = await effectivePermissions(pool, uid, tenantId);
    res.json(withEnvelope({ ok: true, user_id: uid, ...eff }));
  }));

  app.get('/api/wos/tenants', safeAsync(async (_req, res) => {
    res.json(withEnvelope({ ok: true, tenants: await listTenants(pool) }));
  }));

  // ── Gap #4: Audit trail viewer (governance-only, tenant-locked) ────────
  //
  // Hardening per architect review:
  //  - `platform:*` permission required (audit logs are cross-cutting sensitive data).
  //  - tenant_id derived strictly from the session via resolveTenantFromRequest;
  //    any `tenant_id` query override is REJECTED unless the caller also holds
  //    `platform:*` (which `requirePermission` already enforced) AND the override
  //    matches the platform admin's elevated scope. We additionally require the
  //    override to be a positive integer.
  app.get('/api/wos/audit', requireAuth, requirePermission(pool, 'platform:*'),
    safeAsync(async (req, res) => {
      const sessionTenant = resolveTenantFromRequest(req);
      let tenantId: number | null = sessionTenant;
      if (req.query.tenant_id != null && req.query.tenant_id !== '') {
        const overrideTid = Number(req.query.tenant_id);
        if (!Number.isFinite(overrideTid) || !Number.isInteger(overrideTid) || overrideTid <= 0) {
          return res.status(400).json(withEnvelope({ ok: false, error: 'invalid_tenant_id' }));
        }
        // platform:* already verified — admin may inspect any tenant.
        tenantId = overrideTid;
      }
      if (!tenantId || !Number.isFinite(tenantId) || tenantId <= 0) {
        return res.status(400).json(withEnvelope({ ok: false, error: 'tenant_id_required' }));
      }
      const limit = Math.max(1, Math.min(Number(req.query.limit ?? 100), 500));
      const status = req.query.status as string | undefined;
      const params: unknown[] = [tenantId];
      let where = `tenant_id = $1`;
      if (status && /^[a-z_]{1,32}$/.test(status)) {
        params.push(status); where += ` AND status = $${params.length}`;
      }
      try {
        const { rows } = await pool.query(
          `SELECT id, user_id, tenant_id, endpoint, status, request_id, detail, created_at
             FROM wos_audit_logs
            WHERE ${where}
            ORDER BY created_at DESC, id DESC
            LIMIT ${limit}`,
          params,
        );
        res.json(withEnvelope({ ok: true, count: rows.length, tenant_id: tenantId, audit: rows }));
      } catch (e: any) {
        res.json(withEnvelope({ ok: true, count: 0, tenant_id: tenantId, audit: [],
                                detail: e?.message ?? 'audit_unavailable' }));
      }
    }));

  // ── Learning ROI ───────────────────────────────────────────────────────

  app.get('/api/wos/roi', safeAsync(async (req, res) => {
    const rows = await listRoi(pool, {
      tenant_id: req.query.tenant_id ? Number(req.query.tenant_id) : undefined,
      intervention_id: req.query.intervention_id as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(withEnvelope({ ok: true, count: rows.length, roi: rows }));
  }));

  app.post('/api/wos/roi/compute', requireAuth, requirePermission(pool, 'wos:write'),
    safeAsync(async (req, res) => {
      const b = req.body ?? {};
      const tenantId = Number(b.tenant_id ?? resolveTenantFromRequest(req) ?? 0);
      if (!tenantId || !b.intervention_id) {
        return res.status(400).json(withEnvelope({ ok: false, error: 'tenant_and_intervention_required' }));
      }
      const cohortSize = Number(b.cohort_size ?? 30);
      const computed = await computeRoi(pool, {
        tenant_id: tenantId,
        intervention_id: String(b.intervention_id),
        cohort_size: cohortSize,
        total_program_cost: b.total_program_cost ? Number(b.total_program_cost) : undefined,
      });
      const persisted = String(b.persist ?? 'true') === 'true'
        ? await persistRoi(pool, computed) : null;
      res.json(withEnvelope({ ok: true, roi: computed, persisted_id: persisted?.id ?? null }));
    }));

  // ── Aggregate dashboard snapshot ───────────────────────────────────────

  app.get('/api/wos/dashboard', safeAsync(async (req, res) => {
    // Tenant must be explicit (query param or session-resolved). No silent
    // fallback to tenant 1 — would leak demo data to unauthenticated callers.
    const explicit = req.query.tenant_id ? Number(req.query.tenant_id) : null;
    const resolved = resolveTenantFromRequest(req);
    const tenantId = explicit ?? resolved;
    if (!tenantId || !Number.isFinite(tenantId) || tenantId <= 0) {
      return res.status(400).json(withEnvelope({
        ok: false, error: 'tenant_id_required',
        detail: 'Provide ?tenant_id=… or an x-tenant-id header / authenticated tenant context.',
      }));
    }
    const [risks, obsolescence, exposure, emerging, fairness, disputes, roi, macro] = await Promise.all([
      listWorkforceRisk(pool, { tenant_id: tenantId, limit: 25 }),
      listObsolescence(pool, { limit: 10 }),
      aiExposure(pool, 'competency'),
      listEmergingRoles(pool),
      fairnessSummary(pool),
      listDisputes(pool, { tenant_id: tenantId, limit: 10 }),
      listRoi(pool, { tenant_id: tenantId, limit: 10 }),
      macroTrends(pool),
    ]);
    res.json(withEnvelope({
      ok: true, tenant_id: tenantId,
      workforce_risks: risks,
      top_obsolete_competencies: obsolescence,
      ai_exposure_top: exposure.slice(0, 12),
      emerging_roles: emerging,
      fairness_summary: fairness,
      open_disputes: disputes,
      recent_roi: roi,
      macro_trends: macro,
    }));
  }));
}
