/**
 * Phase 5 routes — /api/enterprise/*
 *   /overview, /workforce-intelligence, /succession, /capabilities, /strategic-gaps
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  getWorkforceIntelligence, getSuccessionReadiness, getOrganizationalCapabilities,
  getEnterpriseOverview, getStrategicCapabilityGaps, ENTERPRISE_VERSION,
} from '../services/enterprise-intelligence.js';
import { wrap, currentMethodologies, decomposeWeightedComposite, buildRationale } from '../services/explainability-engine.js';
import { auditFramework } from '../services/governance-engine.js';

const send = (res: Response, data: unknown) => res.json({ ok: true, data });
const fail = (res: Response, code: number, error: string, detail?: string) =>
  res.status(code).json({ ok: false, error, detail });

export function registerEnterpriseIntelligenceRoutes({ app, pool }: { app: Express; pool: Pool }) {

  app.get('/api/enterprise/overview', async (req, res) => {
    try {
      const tenantId = String(req.query.tenant_id ?? 'global');
      const data = await getEnterpriseOverview(pool, tenantId);
      const methVersions = await currentMethodologies(pool);
      await auditFramework(pool, { action: 'enterprise.overview', entity_type: 'tenant', entity_id: tenantId, domain: 'enterprise' });
      if (!data) return fail(res, 404, 'no_overview_snapshot');
      send(res, wrap({ tenant_id: tenantId, ...data }, {
        score_type: 'enterprise_overview',
        methodology: { versions: { enterprise: ENTERPRISE_VERSION, ...methVersions } },
        freshness_days: data.freshness_days,
        rationale: 'Top-level enterprise capability, succession and trend snapshot — refreshed materialised view.',
      }));
    } catch (e) { fail(res, 500, 'overview_failed', String((e as Error).message)); }
  });

  app.get('/api/enterprise/workforce-intelligence', async (req, res) => {
    try {
      const tenantId = String(req.query.tenant_id ?? 'global');
      const data = await getWorkforceIntelligence(pool, tenantId);
      await auditFramework(pool, { action: 'enterprise.workforce_intelligence', entity_type: 'tenant', entity_id: tenantId, domain: 'enterprise' });
      send(res, wrap({ tenant_id: tenantId, intelligence: data }, {
        score_type: 'workforce_intelligence',
        methodology: { versions: { enterprise: ENTERPRISE_VERSION } },
        rationale: 'Strategic rollups across layers, functions and enterprise dimensions.',
      }));
    } catch (e) { fail(res, 500, 'workforce_intelligence_failed', String((e as Error).message)); }
  });

  app.get('/api/enterprise/succession', async (req, res) => {
    try {
      const target_role_id = req.query.target_role_id ? String(req.query.target_role_id) : undefined;
      const user_id = req.query.user_id ? String(req.query.user_id) : undefined;
      const data = await getSuccessionReadiness(pool, { target_role_id, user_id });
      await auditFramework(pool, { action: 'enterprise.succession', entity_type: 'role',
        entity_id: target_role_id ?? user_id ?? 'all', domain: 'enterprise',
        payload: { target_role_id, user_id } });
      const top = data[0];
      const contributors = top ? top.contributing_strengths.map((s, i) => ({
        feature_id: 'cs_' + i, feature_label: s.competency, value: 0, weight: 1 / Math.max(1, top.contributing_strengths.length),
        contribution: 1, band: 'strength',
      })) : [];
      send(res, wrap({ count: data.length, readiness: data }, {
        score_type: 'succession_readiness',
        methodology: { versions: { enterprise: ENTERPRISE_VERSION } },
        contributors,
        rationale: 'Developmental readiness bands — capability-proximity indicator, NEVER a hiring or promotion prediction.',
      }));
    } catch (e) { fail(res, 500, 'succession_failed', String((e as Error).message)); }
  });

  app.get('/api/enterprise/capabilities', async (req, res) => {
    try {
      const tenantId = String(req.query.tenant_id ?? 'global');
      const data = await getOrganizationalCapabilities(pool, tenantId);
      await auditFramework(pool, { action: 'enterprise.capabilities', entity_type: 'tenant', entity_id: tenantId, domain: 'enterprise' });
      send(res, wrap({ tenant_id: tenantId, capabilities: data }, {
        score_type: 'organizational_capabilities',
        methodology: { versions: { enterprise: ENTERPRISE_VERSION } },
        rationale: 'Capability index per organisational layer × competency, with maturity distribution and gap indicator.',
      }));
    } catch (e) { fail(res, 500, 'capabilities_failed', String((e as Error).message)); }
  });

  app.get('/api/enterprise/strategic-gaps', async (req, res) => {
    try {
      const tenantId = String(req.query.tenant_id ?? 'global');
      const data = await getStrategicCapabilityGaps(pool, tenantId);
      await auditFramework(pool, { action: 'enterprise.strategic_gaps', entity_type: 'tenant', entity_id: tenantId, domain: 'enterprise' });
      send(res, wrap({ tenant_id: tenantId, gaps: data }, {
        score_type: 'strategic_capability_gaps',
        methodology: { versions: { enterprise: ENTERPRISE_VERSION } },
        rationale: 'Enterprise-wide capability deficits flagged as development opportunities or strategic gaps.',
      }));
    } catch (e) { fail(res, 500, 'strategic_gaps_failed', String((e as Error).message)); }
  });
}
