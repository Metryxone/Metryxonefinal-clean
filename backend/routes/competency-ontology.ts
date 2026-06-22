/**
 * Phase 1 — Competency Ontology + Workforce Taxonomy public read API.
 *
 * All endpoints are READ-ONLY and require no auth. They expose the canonical
 * scientific reference data (domains, families, competencies, roles, DNA,
 * relationships, capability models) for the Career Builder + admin UIs to
 * render the ontology explorer / workforce taxonomy explorer / role DNA
 * visualiser.
 *
 * No personal data is involved; only static-ish ontology rows are returned.
 */

import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import { createOntologyService, ONTOLOGY_VERSION } from '../services/competency-ontology';

export function registerCompetencyOntologyRoutes(opts: { app: Express; pool: Pool }) {
  const { app, pool } = opts;
  const svc = createOntologyService(pool);

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) res.json({ ok: true, ontology_version: ONTOLOGY_VERSION, data });
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[competency-ontology]', req.path, err?.message ?? err);
        if (!res.headersSent) {
          res.status(500).json({ ok: false, error: 'internal_error' });
        }
      }
    };

  // ---- Domains / families ------------------------------------------------
  app.get('/api/ontology/domains',          wrap(async () => svc.listDomains()));
  app.get('/api/ontology/families',         wrap(async (req) => svc.listFamilies(req.query.domain_id as string | undefined)));

  // ---- Competencies ------------------------------------------------------
  app.get('/api/ontology/competencies', wrap(async (req) => svc.listCompetencies({
    domainId: req.query.domain_id as string | undefined,
    familyId: req.query.family_id as string | undefined,
    search:   req.query.q         as string | undefined,
  })));
  app.get('/api/ontology/competencies/:id', wrap(async (req, res) => {
    const c = await svc.getCompetency(String(req.params.id));
    if (!c) { res.status(404).json({ ok: false, error: 'not_found' }); return; }
    return c;
  }));
  app.get('/api/ontology/competencies/resolve/:name', wrap(async (req, res) => {
    const c = await svc.resolveAlias(String(req.params.name));
    if (!c) { res.status(404).json({ ok: false, error: 'not_found', name: req.params.name }); return; }
    return c;
  }));

  // ---- Proficiency / Layers ---------------------------------------------
  app.get('/api/ontology/proficiency-levels', wrap(async () => svc.listProficiencyLevels()));
  app.get('/api/ontology/layers',             wrap(async () => svc.listLayers()));

  // ---- Workforce taxonomy (curated onto_* read API) ----------------------
  // NOTE: namespaced under /curated so the bare /api/ontology/{entity} paths
  // belong to the ont_* taxonomy CRUD (routes/ontology-taxonomy.ts) that the
  // SuperAdmin management panels read/write. These curated reads serve the
  // OntologyExplorer / Benchmark / assessment-options consumers (onto_* genome).
  app.get('/api/ontology/curated/industries',     wrap(async () => svc.listIndustries()));
  app.get('/api/ontology/curated/functions',      wrap(async (req) => svc.listFunctions(req.query.industry_id as string | undefined)));
  app.get('/api/ontology/curated/subfunctions',   wrap(async (req) => svc.listSubfunctions(req.query.function_id as string | undefined)));
  app.get('/api/ontology/curated/role-families',  wrap(async (req) => svc.listRoleFamilies(req.query.subfunction_id as string | undefined)));
  app.get('/api/ontology/curated/roles',          wrap(async (req) => svc.listRoles({
    roleFamilyId: req.query.role_family_id as string | undefined,
    layerId:      req.query.layer_id       as string | undefined,
    industryId:   req.query.industry_id    as string | undefined,
  })));
  app.get('/api/ontology/curated/roles/:id/dna',  wrap(async (req, res) => {
    const d = await svc.getRoleDNA(String(req.params.id));
    if (!d) { res.status(404).json({ ok: false, error: 'not_found' }); return; }
    return d;
  }));

  // ---- Relationships + capability models --------------------------------
  app.get('/api/ontology/relationships',    wrap(async (req) => svc.listRelationships(req.query.competency_id as string | undefined)));
  app.get('/api/ontology/capability-models',wrap(async () => svc.listCapabilityModels()));

  // ---- Methodology metadata (single doc) --------------------------------
  app.get('/api/ontology/methodology', (_req, res) => {
    res.json({
      ok: true,
      ontology_version: ONTOLOGY_VERSION,
      methodology: {
        philosophy: 'Competencies remain stable; importance weights vary by role context.',
        capability_domains: 5,
        proficiency_levels: 5,
        organizational_layers: 4,
        score_interpretation: [
          { range: '0-35',   label: 'Foundational Development' },
          { range: '36-55',  label: 'Emerging Capability' },
          { range: '56-70',  label: 'Operationally Competitive' },
          { range: '71-85',  label: 'Professionally Advanced' },
          { range: '86-100', label: 'Highly Differentiated Capability' },
        ],
        legal: {
          purpose: 'Developmental, aggregate, non-diagnostic.',
          excludes: ['employability guarantees', 'hiring suitability', 'promotion certainty', 'psychological diagnosis'],
        },
      },
    });
  });
}
