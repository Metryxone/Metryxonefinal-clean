/**
 * Enterprise Workforce OS routes (Phase 8 — additive, feature-flagged).
 * Renamed from spec ('workforce-os-v2.ts' would collide with existing Workforce OS V2).
 * Mount: /api/v2/wos ; flag: enterpriseWorkforceOSV2.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  buildTenantCapabilityProfiles, buildEnterpriseCapabilityGraph, organizationalReadiness,
  assessCapabilityRisk, persistTenantProfiles, persistEnterpriseGraph, persistOrgReadiness,
  ENTERPRISE_WOS_VERSION,
} from '../services/enterprise-workforce-os-engine';
import { generateExecutiveBrief, persistExecutiveDecision, EXEC_INTEL_VERSION } from '../services/executive-workforce-intelligence';
import { recordMetric, recordPerformance, queryHealth, summariseHealth, OBSERVABILITY_ENGINE_VERSION } from '../services/intelligence-observability-engine';
import { getCache, allCacheStats, shouldRecompute, suggestBatchSize, RUNTIME_OPT_VERSION } from '../services/runtime-optimization-engine';
import { isEnterpriseWorkforceOSV2Enabled } from '../config/feature-flags';

type RequireAuth = (req: Request, res: Response, next: NextFunction) => void;

const VERSIONS = { ENTERPRISE_WOS_VERSION, EXEC_INTEL_VERSION, OBSERVABILITY_ENGINE_VERSION, RUNTIME_OPT_VERSION };
const LANGUAGE_POLICY = {
  allowed: ['organisational readiness', 'capability heatmap', 'workforce risk band', 'resilience score', 'observability metric'],
  disallowed: ['hiring recommendation', 'promotion ranking', 'individual suitability prediction', 'pass/fail verdict'],
  inference_mode: 'aggregate' as const,
};
function envelope<T extends object>(p: T) { return { ok: true, ...p, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: { enterpriseWorkforceOSV2: isEnterpriseWorkforceOSV2Enabled() } }; }
function errorEnvelope(error: string, extra: Record<string, unknown> = {}) { return { ok: false, error, ...extra, methodology_versions: VERSIONS, language_policy: LANGUAGE_POLICY, feature_flag: { enterpriseWorkforceOSV2: isEnterpriseWorkforceOSV2Enabled() } }; }
function requireFlag(_req: Request, res: Response, next: NextFunction) { if (!isEnterpriseWorkforceOSV2Enabled()) return res.status(503).json(errorEnvelope('enterpriseWorkforceOSV2 disabled')); next(); }
function authUserId(req: Request): string | null {
  const u = (req as Request & { user?: { id?: number | string } }).user;
  if (!u || u.id == null) return null;
  return String(u.id);
}

/**
 * Tenant-scope guard for Phase 8 routes.
 *
 * Phase 8 endpoints expose enterprise-wide aggregates per `tenantId`, so the
 * caller must either be a super_admin (cross-tenant ops) OR a member of the
 * requested tenant. Tenant-membership tables are not yet wired into the auth
 * layer in this slice, so non-admins are restricted to a `tenantId` matching
 * their own `user.tenant_id` if present, otherwise denied. Super admins
 * remain unrestricted — matches the existing Phase 5 WorkforceOSPage pattern.
 */
function requireTenantAccess(req: Request, res: Response, next: NextFunction) {
  const u = (req as Request & { user?: { id?: string; role?: string; roles?: string[]; tenant_id?: string } }).user;
  const tenantId = String((req.method === 'GET' ? req.query.tenantId : req.body?.tenantId) ?? 'default');
  if (!u) return res.status(401).json(errorEnvelope('unauthenticated'));
  const roles = u.roles ?? (u.role ? [u.role] : []);
  if (roles.includes('super_admin') || roles.includes('admin')) { (req as Request & { tenantId?: string }).tenantId = tenantId; return next(); }
  if (u.tenant_id && u.tenant_id === tenantId) { (req as Request & { tenantId?: string }).tenantId = tenantId; return next(); }
  return res.status(403).json(errorEnvelope('forbidden — tenant access denied', { requested_tenant: tenantId }));
}

export function registerEnterpriseWorkforceOS(opts: { app: Express; pool: Pool; requireAuth: RequireAuth }) {
  const { app, pool, requireAuth } = opts;
  const dashCache = getCache<unknown>('wos_dashboard', 64);

  app.get('/api/v2/wos/feature-flag', (_req, res) => res.json(envelope({})));
  app.get('/api/v2/wos/_meta/versions', (_req, res) => res.json(envelope({})));

  // ── Dashboard (cached, derived from tenant_capability_profiles) ───────
  app.get('/api/v2/wos/dashboard', requireAuth, requireFlag, requireTenantAccess, async (req, res) => {
    try {
      const tenantId = String(req.query.tenantId ?? 'default');
      const cacheKey = `dash:${tenantId}`;
      const cached = dashCache.get(cacheKey);
      if (cached) { res.json(envelope({ ...(cached as object), cached: true })); return; }
      const t0 = Date.now();
      const r = await pool.query(`SELECT competency_key, mean_level, median_level, p25, p75, population_size FROM tenant_capability_profiles WHERE tenant_id = $1 ORDER BY computed_at DESC`, [tenantId]);
      const profiles = r.rows.map((row) => ({
        tenant_id: tenantId, competency_key: row.competency_key,
        mean_level: Number(row.mean_level ?? 0), median_level: Number(row.median_level ?? 0),
        p25: Number(row.p25 ?? 0), p75: Number(row.p75 ?? 0),
        population_size: Number(row.population_size ?? 0),
      }));
      const readiness = organizationalReadiness(profiles);
      const risk = assessCapabilityRisk(profiles, 60, 0.6, Math.max(1, profiles[0]?.population_size ?? 100));
      const payload = { tenant_id: tenantId, profiles, readiness, capability_risk: risk };
      dashCache.set(cacheKey, payload, 5 * 60 * 1000);
      recordPerformance(pool, { component: 'wos_dashboard', latencyMs: Date.now() - t0 }).catch(() => {});
      res.json(envelope({ ...payload, cached: false }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Build profiles + graph from a posted batch of per-user levels ─────
  app.post('/api/v2/wos/profiles/build', requireAuth, requireFlag, requireTenantAccess, async (req, res) => {
    try {
      const tenantId = String(req.body?.tenantId ?? 'default');
      const levels = Array.isArray(req.body?.levels) ? req.body.levels : [];
      if (!levels.length) return res.status(400).json(errorEnvelope('levels[] required'));
      const profiles = buildTenantCapabilityProfiles(tenantId, levels);
      const graph = buildEnterpriseCapabilityGraph(tenantId, profiles);
      const readiness = organizationalReadiness(profiles);
      persistTenantProfiles(pool, profiles).catch(() => {});
      persistEnterpriseGraph(pool, graph).catch(() => {});
      persistOrgReadiness(pool, tenantId, readiness).catch(() => {});
      dashCache.delete(`dash:${tenantId}`);
      res.json(envelope({ profiles, graph_summary: { nodes: graph.node_count, edges: graph.edge_count }, readiness }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Capability risk (live derived) ────────────────────────────────────
  app.get('/api/v2/wos/capability-risk', requireAuth, requireFlag, requireTenantAccess, async (req, res) => {
    try {
      const tenantId = String(req.query.tenantId ?? 'default');
      const r = await pool.query(`SELECT competency_key, mean_level, median_level, p25, p75, population_size FROM tenant_capability_profiles WHERE tenant_id = $1 ORDER BY computed_at DESC`, [tenantId]);
      const profiles = r.rows.map((row) => ({
        tenant_id: tenantId, competency_key: row.competency_key,
        mean_level: Number(row.mean_level ?? 0), median_level: Number(row.median_level ?? 0),
        p25: Number(row.p25 ?? 0), p75: Number(row.p75 ?? 0),
        population_size: Number(row.population_size ?? 0),
      }));
      res.json(envelope({ tenant_id: tenantId, risk: assessCapabilityRisk(profiles, 60, 0.6, Math.max(1, profiles[0]?.population_size ?? 100)) }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Executive intelligence ────────────────────────────────────────────
  app.get('/api/v2/wos/executive-intelligence', requireAuth, requireFlag, requireTenantAccess, async (req, res) => {
    try {
      const tenantId = String(req.query.tenantId ?? 'default');
      const r = await pool.query(`SELECT competency_key, mean_level, median_level, p25, p75, population_size FROM tenant_capability_profiles WHERE tenant_id = $1 ORDER BY computed_at DESC`, [tenantId]);
      const profiles = r.rows.map((row) => ({
        tenant_id: tenantId, competency_key: row.competency_key,
        mean_level: Number(row.mean_level ?? 0), median_level: Number(row.median_level ?? 0),
        p25: Number(row.p25 ?? 0), p75: Number(row.p75 ?? 0),
        population_size: Number(row.population_size ?? 0),
      }));
      const brief = generateExecutiveBrief(tenantId, profiles, Math.max(1, profiles[0]?.population_size ?? 100));
      res.json(envelope({ brief }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.post('/api/v2/wos/executive-decision', requireAuth, requireFlag, requireTenantAccess, async (req, res) => {
    try {
      const tenantId = String(req.body?.tenantId ?? 'default');
      const decisionKey = String(req.body?.decisionKey ?? `decision_${Date.now()}`);
      await persistExecutiveDecision(pool, { tenantId, decisionKey, options: req.body?.options ?? [], recommended: req.body?.recommended, scores: req.body?.scores, rationale: req.body?.rationale });
      res.json(envelope({ recorded: true, decision_key: decisionKey }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Resilience ────────────────────────────────────────────────────────
  app.get('/api/v2/wos/resilience', requireAuth, requireFlag, requireTenantAccess, async (req, res) => {
    try {
      const tenantId = String(req.query.tenantId ?? 'default');
      const r = await pool.query(`SELECT competency_key, mean_level, median_level, p25, p75, population_size FROM tenant_capability_profiles WHERE tenant_id = $1 ORDER BY computed_at DESC`, [tenantId]);
      const profiles = r.rows.map((row) => ({
        tenant_id: tenantId, competency_key: row.competency_key,
        mean_level: Number(row.mean_level ?? 0), median_level: Number(row.median_level ?? 0),
        p25: Number(row.p25 ?? 0), p75: Number(row.p75 ?? 0),
        population_size: Number(row.population_size ?? 0),
      }));
      const brief = generateExecutiveBrief(tenantId, profiles, Math.max(1, profiles[0]?.population_size ?? 100));
      res.json(envelope({ tenant_id: tenantId, resilience: brief.resilience, workforce_risk_index: brief.workforce_risk_index }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  // ── Observability ─────────────────────────────────────────────────────
  app.get('/api/v2/wos/observability', requireAuth, requireFlag, async (req, res) => {
    try {
      const lookback = Math.min(168, Math.max(1, Number(req.query.lookbackHours ?? 24)));
      const health = await queryHealth(pool, lookback);
      const summary = summariseHealth(health);
      const cacheStats = allCacheStats();
      const batchHint = suggestBatchSize(50);
      const shouldRefresh = shouldRecompute(null, 5);
      res.json(envelope({ health, summary, cache_stats: cacheStats, scheduling: { batch_size_hint: batchHint, should_refresh_dashboards: shouldRefresh } }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });

  app.post('/api/v2/wos/observability/record', requireAuth, requireFlag, async (req, res) => {
    try {
      const component = String(req.body?.component ?? '').trim();
      const metric = String(req.body?.metric ?? '').trim();
      const value = Number(req.body?.value);
      if (!component || !metric || !Number.isFinite(value)) return res.status(400).json(errorEnvelope('component, metric, value required'));
      await recordMetric(pool, { component, metric, value, context: req.body?.context ?? {} });
      res.json(envelope({ recorded: true }));
    } catch (e) { res.status(500).json(errorEnvelope((e as Error).message)); }
  });
}
