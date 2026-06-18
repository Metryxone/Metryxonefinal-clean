/**
 * Phase 4 routes — /api/workforce/*
 *   /heatmap, /metrics, /distribution, /pipeline
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  getOrganizationalHeatmap, getWorkforceMetrics, getCapabilityDistribution,
  getLeadershipPipeline, WORKFORCE_ANALYTICS_VERSION,
} from '../services/workforce-analytics.js';
import { wrap, currentMethodologies } from '../services/explainability-engine.js';
import { auditFramework } from '../services/governance-engine.js';

const send = (res: Response, data: unknown) => res.json({ ok: true, data });
const fail = (res: Response, code: number, error: string, detail?: string) =>
  res.status(code).json({ ok: false, error, detail });

export function registerWorkforceAnalyticsRoutes({ app, pool }: { app: Express; pool: Pool }) {

  app.get('/api/workforce/heatmap', async (req, res) => {
    try {
      const tenantId = String(req.query.tenant_id ?? 'global');
      const data = await getOrganizationalHeatmap(pool, tenantId);
      const methVersions = await currentMethodologies(pool);
      await auditFramework(pool, { action: 'workforce.heatmap', entity_type: 'tenant', entity_id: tenantId, domain: 'workforce' });
      send(res, wrap({ tenant_id: tenantId, heatmap: data }, {
        score_type: 'org_heatmap',
        methodology: { versions: { workforce: WORKFORCE_ANALYTICS_VERSION, ...methVersions } },
        rationale: 'Capability mean per organisational layer × competency, banded foundational→strategic.',
      }));
    } catch (e) { fail(res, 500, 'heatmap_failed', String((e as Error).message)); }
  });

  app.get('/api/workforce/metrics', async (req, res) => {
    try {
      const tenantId = String(req.query.tenant_id ?? 'global');
      const data = await getWorkforceMetrics(pool, tenantId);
      await auditFramework(pool, { action: 'workforce.metrics', entity_type: 'tenant', entity_id: tenantId, domain: 'workforce' });
      send(res, wrap({ tenant_id: tenantId, metrics: data }, {
        score_type: 'workforce_metrics',
        methodology: { versions: { workforce: WORKFORCE_ANALYTICS_VERSION } },
        rationale: 'Tenant-wide rollups of leadership pipeline, mobility, succession coverage and capability density.',
      }));
    } catch (e) { fail(res, 500, 'metrics_failed', String((e as Error).message)); }
  });

  app.get('/api/workforce/distribution', async (req, res) => {
    try {
      const tenantId = String(req.query.tenant_id ?? 'global');
      const data = await getCapabilityDistribution(pool, tenantId);
      await auditFramework(pool, { action: 'workforce.distribution', entity_type: 'tenant', entity_id: tenantId, domain: 'workforce' });
      send(res, wrap({ tenant_id: tenantId, distribution: data }, {
        score_type: 'capability_distribution',
        methodology: { versions: { workforce: WORKFORCE_ANALYTICS_VERSION } },
        rationale: 'Sample-weighted enterprise mean per competency, with cross-layer spread.',
      }));
    } catch (e) { fail(res, 500, 'distribution_failed', String((e as Error).message)); }
  });

  app.get('/api/workforce/pipeline', async (req, res) => {
    try {
      const tenantId = String(req.query.tenant_id ?? 'global');
      const data = await getLeadershipPipeline(pool, tenantId);
      await auditFramework(pool, { action: 'workforce.pipeline', entity_type: 'tenant', entity_id: tenantId, domain: 'workforce' });
      send(res, wrap({ tenant_id: tenantId, pipeline: data }, {
        score_type: 'leadership_pipeline',
        methodology: { versions: { workforce: WORKFORCE_ANALYTICS_VERSION } },
        rationale: 'Density of strategic-band capabilities per organisational layer.',
      }));
    } catch (e) { fail(res, 500, 'pipeline_failed', String((e as Error).message)); }
  });
}
