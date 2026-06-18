/**
 * Phase 1 Enhancement — Global Ontology routes
 *
 * Mounts:
 *   /api/global-roles/*
 *   /api/role-families/*
 *   /api/role-layers/*
 *   /api/contextual-expectations/*
 *
 * All endpoints are READ-ONLY. Pagination (`limit`,`offset`) supported on list endpoints.
 * Responses wrap the payload with an _explainability envelope via Phase 5 explainability-engine.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { createGlobalRoleEngine, GLOBAL_ROLE_ENGINE_VERSION } from '../services/global-role-engine';
import { createRoleLayerEngine, ROLE_LAYER_ENGINE_VERSION } from '../services/role-layer-engine';
import { createRoleFamilyEngine, ROLE_FAMILY_ENGINE_VERSION } from '../services/role-family-engine';
import { createExpectationEngine, EXPECTATION_ENGINE_VERSION } from '../services/expectation-engine';
import { wrap as wrapExplain } from '../services/explainability-engine';

const GLOBAL_ONTOLOGY_VERSION = '1.0.0';

export function registerGlobalOntologyRoutes(opts: { app: Express; pool: Pool }) {
  const { app, pool } = opts;
  const roles    = createGlobalRoleEngine(pool);
  const layers   = createRoleLayerEngine(pool);
  const families = createRoleFamilyEngine(pool);
  const expect   = createExpectationEngine(pool);

  const audit = async (domain: string, action: string, entity_id: string | null, req: Request, payload: any = {}) => {
    try {
      await pool.query(
        `INSERT INTO gro_audit_logs (request_id, actor_id, domain, entity_id, action, payload)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [(req as any).requestId ?? null, (req as any).user?.id ?? null, domain, entity_id, action, payload]);
    } catch { /* audit never blocks response */ }
  };

  const guard = (fn: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
    try {
      const data = await fn(req, res);
      if (res.headersSent) return;
      const envelope = wrapExplain(
        { ok: true, data },
        {
          score_type: 'global_ontology_read',
          methodology: {
            versions: {
              global_ontology: GLOBAL_ONTOLOGY_VERSION,
              global_role_engine: GLOBAL_ROLE_ENGINE_VERSION,
              role_layer_engine: ROLE_LAYER_ENGINE_VERSION,
              role_family_engine: ROLE_FAMILY_ENGINE_VERSION,
              expectation_engine: EXPECTATION_ENGINE_VERSION,
            },
          },
          rationale: 'Phase 1 enhancement — global workforce ontology read API; contextual modifiers default neutral when unmapped',
        },
      );
      res.json(envelope);
    } catch (err: any) {
      console.error('[global-ontology]', req.path, err?.message ?? err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
    }
  };

  const pag = (req: Request) => ({
    limit: Math.min(200, Math.max(1, Number(req.query.limit ?? 50))),
    offset: Math.max(0, Number(req.query.offset ?? 0)),
  });

  // ---- /api/global-roles/*
  app.get('/api/global-roles', guard(async (req) => {
    const { limit, offset } = pag(req);
    const rows = await roles.listRoles({
      familyId: req.query.family_id as string | undefined,
      layerId:  req.query.layer_id  as string | undefined,
      q:        req.query.q         as string | undefined,
      limit, offset,
    });
    await audit('role', 'read', null, req, { limit, offset, filters: req.query });
    return { rows, pagination: { limit, offset, count: rows.length } };
  }));
  app.get('/api/global-roles/:id', guard(async (req) => {
    const r = await roles.getRole(String(req.params.id));
    await audit('role', 'read', String(req.params.id), req);
    return r;
  }));
  app.get('/api/global-roles/resolve/:text', guard(async (req) => {
    const r = await roles.resolveRole(String(req.params.text));
    await audit('role', 'resolve', r?.id ?? null, req, { text: req.params.text });
    return { input: req.params.text, resolved: r };
  }));
  app.get('/api/global-roles/:id/hierarchy', guard(async (req) =>
    roles.listHierarchyFor(String(req.params.id))));

  // ---- /api/role-families/*
  app.get('/api/role-families', guard(async (req) => {
    const out = await families.listFamilies({ functionId: req.query.function_id as string | undefined });
    await audit('role_family', 'list', null, req, { count: out.length });
    return out;
  }));
  app.get('/api/role-families/:id', guard(async (req) => {
    await audit('role_family', 'read', String(req.params.id), req);
    return families.getFamilyTree(String(req.params.id));
  }));
  app.get('/api/role-families/:id/paths', guard(async (req) =>
    families.listPaths(String(req.params.id))));
  app.get('/api/functions', guard(async (req) => {
    const out = await families.listFunctions();
    await audit('function', 'list', null, req, { count: out.length });
    return out;
  }));
  app.get('/api/industries', guard(async (req) => {
    const out = await families.listIndustries();
    await audit('industry', 'list', null, req, { count: out.length });
    return out;
  }));
  app.get('/api/industry-families', guard(async () => families.listIndustryFamilies()));
  app.get('/api/geographies', guard(async (req) => {
    const out = await families.listGeographies(req.query.industry_id as string | undefined);
    await audit('geography', 'list', null, req, { industry_id: req.query.industry_id ?? null, count: out.length });
    return out;
  }));

  // ---- /api/role-layers/*
  app.get('/api/role-layers', guard(async (req) => {
    const out = await layers.listLayers();
    await audit('role_layer', 'list', null, req);
    return out;
  }));
  app.get('/api/role-layers/detect',   guard(async (req) =>
    layers.detectLayer({
      roleTitle: req.query.role_title as string | undefined,
      seniority: req.query.seniority  as string | undefined,
      yearsExp:  req.query.years_exp != null ? Number(req.query.years_exp) : undefined,
    })));
  app.get('/api/role-layers/:code',    guard(async (req) => layers.getByCode(String(req.params.code))));

  // ---- /api/contextual-expectations/*
  app.get('/api/contextual-expectations/:role_id', guard(async (req) => {
    const ctx = {
      industry_id:       req.query.industry_id      as string | undefined,
      layer_id:          req.query.layer_id         as string | undefined,
      function_id:       req.query.function_id      as string | undefined,
      geography_code:    req.query.geography_code   as string | undefined,
      complexity_level:  req.query.complexity_level != null ? Number(req.query.complexity_level) : undefined,
    };
    const out = await expect.expectationsFor(String(req.params.role_id), ctx);
    await audit('expectation', 'compute', String(req.params.role_id), req, { ctx });
    return out;
  }));

  app.get('/api/contextual-expectations/:role_id/gaps', guard(async (req) => {
    const ctx = {
      industry_id:       req.query.industry_id      as string | undefined,
      layer_id:          req.query.layer_id         as string | undefined,
      function_id:       req.query.function_id      as string | undefined,
      geography_code:    req.query.geography_code   as string | undefined,
      complexity_level:  req.query.complexity_level != null ? Number(req.query.complexity_level) : undefined,
    };
    let scores: Record<string, number> = {};
    try { scores = req.query.scores ? JSON.parse(String(req.query.scores)) : {}; } catch { /* ignore */ }
    const out = await expect.gapVsExpectations(String(req.params.role_id), ctx, scores);
    await audit('expectation', 'gap', String(req.params.role_id), req, { ctx });
    return out;
  }));

  app.get('/api/contextual-expectations/_meta/version', guard(async () => ({
    global_ontology: GLOBAL_ONTOLOGY_VERSION,
    global_role_engine: GLOBAL_ROLE_ENGINE_VERSION,
    role_layer_engine:  ROLE_LAYER_ENGINE_VERSION,
    role_family_engine: ROLE_FAMILY_ENGINE_VERSION,
    expectation_engine: EXPECTATION_ENGINE_VERSION,
    formula: 'expected = base × industry × layer × function × geography × complexity',
  })));
}
