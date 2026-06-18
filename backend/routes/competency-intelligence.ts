/**
 * Competency Framework Intelligence — Phase 1 FOUNDATION routes (read-only).
 *
 * Exposes the EXISTING competency framework as ONE master spine by composing the
 * two disjoint namespaces (see services/competency-framework-intelligence.ts). Strictly
 * additive + read-only: every route is gated by the
 * `competencyFrameworkIntelligence` flag. Flag OFF → 503 `feature_disabled`
 * (the SuperAdmin panel hides) → byte-identical legacy behaviour. No writes, no
 * schema/DDL, never fabricates rows.
 *
 * Public (auth) read views:
 *   GET /api/competency-intelligence/spine          — canonical spine decision
 *   GET /api/competency-intelligence/competencies   — canonical 300-genome
 *   GET /api/competency-intelligence/role-requirements?role=... — role → competencies
 *   GET /api/competency-intelligence/levels         — proficiency levels / anchor records / layers
 *   GET /api/competency-intelligence/indicators     — behavioural indicator records (ont_indicators)
 *   GET /api/competency-intelligence/taxonomy       — Industry→…→Role records (both namespaces)
 *   GET /api/competency-intelligence/crosswalk      — id-space crosswalk registry
 *
 * Admin (superadmin) report:
 *   GET /api/admin/competency-intelligence/readiness — framework readiness/gap report
 */

import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import { isCompetencyFrameworkIntelligenceEnabled } from '../config/feature-flags.js';
import {
  COMPETENCY_INTELLIGENCE_VERSION,
  CANONICAL_SPINE,
  getMasterCompetencies,
  getRoleRequirements,
  getCompetencyLevels,
  getIndicators,
  getTaxonomy,
  buildCompetencyCrosswalk,
  getFrameworkReadiness,
} from '../services/competency-framework-intelligence.js';
import {
  getCompetencyTypes,
  getCompetencyTypeMap,
  getClassificationReport,
} from '../services/competency-type-classification.js';
import {
  getCompetencyMaster,
  updateCompetencyMaster,
  getCompetencyMasterSummary,
} from '../services/competency-master.js';
import {
  getMicroFramework,
  getMicroMapping,
  getMicroFrameworkSummary,
  createMicroRelationship,
  updateMicroRelationship,
  deleteMicroRelationship,
} from '../services/micro-competency.js';
import {
  getRoleProfiles,
  getRoleProfile,
  getRoleCompetencyMatrix,
  getRoleReadiness,
  getRoleCompetencyProfileSummary,
  createRoleCompetencyProfile,
  updateRoleCompetencyProfile,
  deleteRoleCompetencyProfile,
} from '../services/role-competency-profile.js';
import {
  getBlueprints,
  getBlueprint,
  createBlueprint,
  updateBlueprint,
  deleteBlueprint,
  addBlueprintCompetency,
  deleteBlueprintCompetency,
  getRoleAssessmentMap,
  createRoleAssessment,
  deleteRoleAssessment,
  getCompetencyQuestionMap,
  createCompetencyQuestion,
  deleteCompetencyQuestion,
  getAssessmentFoundationSummary,
} from '../services/assessment-foundation-mapping.js';

export function registerCompetencyFrameworkIntelligenceRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Flag gate FIRST — synchronous 503 before any DB touch when OFF. This is the
  // only byte-identical-OFF state: the route exists but never reads/writes.
  const gate: RequestHandler = (_req, res, next) => {
    if (!isCompetencyFrameworkIntelligenceEnabled()) {
      res.status(503).json({ ok: false, error: 'feature_disabled', flag: 'competencyFrameworkIntelligence' });
      return;
    }
    next();
  };

  const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    async (req: Request, res: Response) => {
      try {
        const data = await fn(req, res);
        if (!res.headersSent) {
          res.json({ ok: true, version: COMPETENCY_INTELLIGENCE_VERSION, data });
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[competency-intelligence]', req.path, err?.message ?? err);
        if (!res.headersSent) res.status(500).json({ ok: false, error: 'internal_error' });
      }
    };

  // ---- Public (authenticated) read views ----------------------------------
  app.get('/api/competency-intelligence/spine', gate, requireAuth, wrap(async () => CANONICAL_SPINE));

  app.get('/api/competency-intelligence/competencies', gate, requireAuth, wrap(async (req) =>
    getMasterCompetencies(pool, {
      domainId: req.query.domain_id as string | undefined,
      familyId: req.query.family_id as string | undefined,
      search: req.query.q as string | undefined,
      limit: req.query.limit ? Math.max(1, parseInt(String(req.query.limit), 10) || 0) : undefined,
    }),
  ));

  app.get('/api/competency-intelligence/role-requirements', gate, requireAuth, wrap(async (req) =>
    getRoleRequirements(pool, String(req.query.role ?? req.query.q ?? '')),
  ));

  app.get('/api/competency-intelligence/levels', gate, requireAuth, wrap(async () => getCompetencyLevels(pool)));

  app.get('/api/competency-intelligence/indicators', gate, requireAuth, wrap(async () => getIndicators(pool)));

  app.get('/api/competency-intelligence/taxonomy', gate, requireAuth, wrap(async () => getTaxonomy(pool)));

  app.get('/api/competency-intelligence/crosswalk', gate, requireAuth, wrap(async () => buildCompetencyCrosswalk(pool)));

  // ---- Phase 1.1: Competency Type classification (additive axis) -----------
  // The Type Master (5-row reference) + full mapping of every canonical
  // competency. Read-only; the mapping is produced by the idempotent seed
  // (scripts/seed-competency-types.ts) and never mutates the genome.
  app.get('/api/competency-intelligence/types', gate, requireAuth, wrap(async () => getCompetencyTypes(pool)));

  app.get('/api/competency-intelligence/type-map', gate, requireAuth, wrap(async (req) =>
    getCompetencyTypeMap(pool, {
      typeKey: req.query.type ? String(req.query.type) : undefined,
      needsReviewOnly: String(req.query.needs_review ?? '') === '1' || req.query.needs_review === 'true',
    }),
  ));

  // ---- Admin (superadmin) framework readiness / gap report ----------------
  app.get(
    '/api/admin/competency-intelligence/readiness',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getFrameworkReadiness(pool)),
  );

  // Admin classification validation report (coverage · distribution ·
  // confidence · needs_review · honest findings).
  app.get(
    '/api/admin/competency-intelligence/classification-report',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getClassificationReport(pool)),
  );

  // ---- Phase 1.2: Competency Master Enhancement (additive eligibility axis) -
  // The enhanced competency entity (code · name · type · description · status +
  // six module-eligibility flags). Read-only list; the extension is produced by
  // the idempotent seed (scripts/seed-competency-master.ts) and never mutates the
  // genome nor creates duplicate competencies.
  app.get('/api/competency-intelligence/master', gate, requireAuth, wrap(async (req) =>
    getCompetencyMaster(pool, {
      search: req.query.q ? String(req.query.q) : undefined,
      typeKey: req.query.type ? String(req.query.type) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      limit: req.query.limit ? Math.max(1, parseInt(String(req.query.limit), 10) || 0) : undefined,
    }),
  ));

  // Admin summary (coverage · status breakdown · per-module eligibility ·
  // curated-vs-default provenance · honest findings). Literal path registered
  // before the `/master/:id` param handler.
  app.get(
    '/api/admin/competency-intelligence/master-summary',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getCompetencyMasterSummary(pool)),
  );

  // Admin edit — update status + eligibility flags for ONE existing competency.
  // Never creates a competency (404 if the id is unknown); stamps source=curated.
  app.patch(
    '/api/admin/competency-intelligence/master/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await updateCompetencyMaster(pool, String(req.params.id), {
        status: body.status as string | undefined,
        assessment_eligible: body.assessment_eligible as boolean | undefined,
        ei_eligible: body.ei_eligible as boolean | undefined,
        career_builder_eligible: body.career_builder_eligible as boolean | undefined,
        employer_eligible: body.employer_eligible as boolean | undefined,
        learning_eligible: body.learning_eligible as boolean | undefined,
        future_ready_eligible: body.future_ready_eligible as boolean | undefined,
      });
      if (!result.ok) {
        const code = result.error === 'competency_not_found' ? 404 : 400;
        res.status(code).json({ ok: false, error: result.error });
        return undefined;
      }
      return result.row;
    }),
  );

  // ---- Phase 1.4: Micro Competency Framework (parent-child structure) -------
  // Additive parent->child hierarchy over the genome. A child is EITHER a real
  // existing competency (linked) OR a named-only micro (no competency row yet,
  // honestly flagged). Never mutates onto_competencies; never fabricates rows.

  // Nested parent -> children framework (the "Micro Competency Framework").
  app.get('/api/competency-intelligence/micro-framework', gate, requireAuth, wrap(async (req) =>
    getMicroFramework(pool, {
      parentId: req.query.parent_id ? String(req.query.parent_id) : undefined,
      search: req.query.q ? String(req.query.q) : undefined,
      activeOnly: String(req.query.active ?? '') === '1' || req.query.active === 'true',
    }),
  ));

  // Flat parent-child mapping (the "Micro Competency Mapping").
  app.get('/api/competency-intelligence/micro-mapping', gate, requireAuth, wrap(async () => getMicroMapping(pool)));

  // Admin summary (coverage · linked-vs-named provenance · honest findings).
  // Literal path registered BEFORE the `/micro-framework/:id` param handlers.
  app.get(
    '/api/admin/competency-intelligence/micro-framework/summary',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getMicroFrameworkSummary(pool)),
  );

  // Admin create — one parent-child relationship. Validates parent (and child,
  // when linked) EXIST; never creates a competency.
  app.post(
    '/api/admin/competency-intelligence/micro-framework',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await createMicroRelationship(pool, {
        parent_competency_id: String(body.parent_competency_id ?? ''),
        child_competency_id: body.child_competency_id ? String(body.child_competency_id) : null,
        micro_label: body.micro_label != null ? String(body.micro_label) : null,
        sort_order: body.sort_order != null ? Number(body.sort_order) : undefined,
      });
      if (!result.ok) {
        const notFound = result.error === 'parent_not_found' || result.error === 'child_not_found';
        const conflict = result.error === 'duplicate_relationship';
        res.status(notFound ? 404 : conflict ? 409 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return result.row;
    }),
  );

  // Admin update — toggle active / re-order / relabel a named-only micro.
  app.patch(
    '/api/admin/competency-intelligence/micro-framework/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid_id' }); return undefined; }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await updateMicroRelationship(pool, id, {
        active: body.active as boolean | undefined,
        sort_order: body.sort_order != null ? Number(body.sort_order) : undefined,
        micro_label: body.micro_label != null ? String(body.micro_label) : undefined,
      });
      if (!result.ok) {
        const notFound = result.error === 'relationship_not_found';
        const conflict = result.error === 'duplicate_relationship';
        res.status(notFound ? 404 : conflict ? 409 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return result.row;
    }),
  );

  // Admin delete — remove one parent-child relationship (reversible; genome untouched).
  app.delete(
    '/api/admin/competency-intelligence/micro-framework/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid_id' }); return undefined; }
      const result = await deleteMicroRelationship(pool, id);
      if (!result.ok) {
        res.status(result.error === 'relationship_not_found' ? 404 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { deleted: true, id };
    }),
  );

  // ---- Phase 1.5: Role Competency Profile Engine ---------------------------
  // Additive role -> competency requirement layer (required level · weight ·
  // criticality) over the genome. Powers three deliverables: the Role Competency
  // Profile, the Role Competency Matrix, and the Role Readiness Framework. Both
  // ids always reference EXISTING rows; onto_roles/onto_competencies untouched.

  // Nested role -> competency requirement profiles (the "Role Competency Profile").
  app.get('/api/competency-intelligence/role-profiles', gate, requireAuth, wrap(async (req) =>
    getRoleProfiles(pool, {
      roleId: req.query.role_id ? String(req.query.role_id) : undefined,
      search: req.query.q ? String(req.query.q) : undefined,
      activeOnly: String(req.query.active ?? '') === '1' || req.query.active === 'true',
    }),
  ));

  // Role Competency Matrix — roles x competencies grid.
  app.get('/api/competency-intelligence/role-matrix', gate, requireAuth, wrap(async (req) =>
    getRoleCompetencyMatrix(pool, {
      activeOnly: String(req.query.active ?? '') === '1' || req.query.active === 'true',
    }),
  ));

  // Role Readiness Framework — weighted gap of actual vs required. Optional
  // actual levels passed as `?actuals=comp_id:level,comp_id:level` (read-only;
  // no actuals => required structure only, readiness honestly unmeasured).
  app.get('/api/competency-intelligence/role-readiness/:roleId', gate, requireAuth, wrap(async (req, res) => {
    const actuals: Record<string, number> = {};
    const raw = req.query.actuals ? String(req.query.actuals) : '';
    if (raw) {
      for (const pair of raw.split(',')) {
        const [cid, lvl] = pair.split(':');
        const n = Number(lvl);
        if (cid && Number.isFinite(n)) actuals[cid.trim()] = n;
      }
    }
    const result = await getRoleReadiness(pool, String(req.params.roleId), actuals);
    if (!result) { res.status(404).json({ ok: false, error: 'role_not_found' }); return undefined; }
    return result;
  }));

  // Admin summary (coverage · weight integrity · criticality mix · findings).
  // Literal path registered BEFORE the `/role-profiles/:id` param handlers.
  app.get(
    '/api/admin/competency-intelligence/role-profiles/summary',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getRoleCompetencyProfileSummary(pool)),
  );

  // Single role profile (admin convenience; returns honest empty profile if the
  // role exists with no requirements yet, 404 only when the role is unknown).
  app.get(
    '/api/admin/competency-intelligence/role-profiles/role/:roleId',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const result = await getRoleProfile(pool, String(req.params.roleId));
      if (!result) { res.status(404).json({ ok: false, error: 'role_not_found' }); return undefined; }
      return result;
    }),
  );

  // Admin create — one role-competency requirement. Validates role AND
  // competency EXIST; never creates either.
  app.post(
    '/api/admin/competency-intelligence/role-profiles',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await createRoleCompetencyProfile(pool, {
        role_id: String(body.role_id ?? ''),
        competency_id: String(body.competency_id ?? ''),
        required_level: body.required_level != null ? Number(body.required_level) : NaN,
        weight: body.weight != null ? Number(body.weight) : undefined,
        criticality: body.criticality != null ? String(body.criticality) : undefined,
        rationale: body.rationale != null ? String(body.rationale) : null,
      });
      if (!result.ok) {
        const notFound = result.error === 'role_not_found' || result.error === 'competency_not_found';
        const conflict = result.error === 'duplicate_requirement';
        res.status(notFound ? 404 : conflict ? 409 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return result.row;
    }),
  );

  // Admin update — edit level / weight / criticality / rationale / active.
  app.patch(
    '/api/admin/competency-intelligence/role-profiles/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid_id' }); return undefined; }
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await updateRoleCompetencyProfile(pool, id, {
        required_level: body.required_level != null ? Number(body.required_level) : undefined,
        weight: body.weight != null ? Number(body.weight) : undefined,
        criticality: body.criticality != null ? String(body.criticality) : undefined,
        rationale: body.rationale !== undefined ? (body.rationale === null ? null : String(body.rationale)) : undefined,
        active: body.active as boolean | undefined,
      });
      if (!result.ok) {
        res.status(result.error === 'requirement_not_found' ? 404 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return result.row;
    }),
  );

  // Admin delete — remove one requirement (reversible; genome untouched).
  app.delete(
    '/api/admin/competency-intelligence/role-profiles/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid_id' }); return undefined; }
      const result = await deleteRoleCompetencyProfile(pool, id);
      if (!result.ok) {
        res.status(result.error === 'requirement_not_found' ? 404 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { deleted: true, id };
    }),
  );

  // ---- Phase 1.6: Assessment Foundation Mapping ---------------------------
  // Additive foundational mappings that connect the genome to the assessment
  // surface WITHOUT redesigning any assessment workflow. Three deliverables:
  //   1. Competency → Question  (onto_competency_question_map)
  //   2. Role → Assessment      (onto_role_assessment_map → onto_assessment_blueprints)
  //   3. Competency Profile → Blueprint (onto_assessment_blueprints + onto_blueprint_competency_map)
  // Every id references EXISTING rows; the genome and question bank are untouched.

  // --- Deliverable 3: Assessment Blueprint Relationships ---
  app.get('/api/competency-intelligence/blueprints', gate, requireAuth, wrap(async (req) =>
    getBlueprints(pool, {
      search: req.query.q ? String(req.query.q) : undefined,
      activeOnly: String(req.query.active ?? '') === '1' || req.query.active === 'true',
    }),
  ));

  // --- Deliverable 2: Role Assessment Mapping ---
  app.get('/api/competency-intelligence/role-assessments', gate, requireAuth, wrap(async (req) =>
    getRoleAssessmentMap(pool, {
      roleId: req.query.role_id ? String(req.query.role_id) : undefined,
      activeOnly: String(req.query.active ?? '') === '1' || req.query.active === 'true',
    }),
  ));

  // --- Deliverable 1: Competency Question Mapping ---
  app.get('/api/competency-intelligence/competency-questions', gate, requireAuth, wrap(async (req) =>
    getCompetencyQuestionMap(pool, {
      competencyId: req.query.competency_id ? String(req.query.competency_id) : undefined,
      search: req.query.q ? String(req.query.q) : undefined,
      activeOnly: String(req.query.active ?? '') === '1' || req.query.active === 'true',
    }),
  ));

  // Single blueprint detail (literal `/blueprints/summary` registered before this param handler).
  app.get(
    '/api/admin/competency-intelligence/assessment-foundation/summary',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async () => getAssessmentFoundationSummary(pool)),
  );

  app.get('/api/competency-intelligence/blueprints/:id', gate, requireAuth, wrap(async (req, res) => {
    const result = await getBlueprint(pool, String(req.params.id));
    if (!result) { res.status(404).json({ ok: false, error: 'blueprint_not_found' }); return undefined; }
    return result;
  }));

  // Admin write — create / update / delete a blueprint.
  app.post(
    '/api/admin/competency-intelligence/blueprints',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await createBlueprint(pool, {
        id: body.id != null ? String(body.id) : undefined,
        blueprint_key: body.blueprint_key != null ? String(body.blueprint_key) : undefined,
        name: body.name != null ? String(body.name) : undefined,
        description: body.description !== undefined ? (body.description === null ? null : String(body.description)) : undefined,
        source_role_id: body.source_role_id != null ? String(body.source_role_id) : null,
      });
      if (!result.ok) {
        const notFound = result.error === 'role_not_found';
        const conflict = result.error === 'duplicate_blueprint';
        res.status(notFound ? 404 : conflict ? 409 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { id: result.id };
    }),
  );

  app.patch(
    '/api/admin/competency-intelligence/blueprints/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await updateBlueprint(pool, String(req.params.id), {
        name: body.name != null ? String(body.name) : undefined,
        description: body.description !== undefined ? (body.description === null ? null : String(body.description)) : undefined,
        active: body.active as boolean | undefined,
      });
      if (!result.ok) {
        res.status(result.error === 'blueprint_not_found' ? 404 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { id: result.id };
    }),
  );

  app.delete(
    '/api/admin/competency-intelligence/blueprints/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const result = await deleteBlueprint(pool, String(req.params.id));
      if (!result.ok) {
        res.status(result.error === 'blueprint_not_found' ? 404 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { deleted: true, id: result.id };
    }),
  );

  // Admin write — add / remove a competency relationship on a blueprint.
  app.post(
    '/api/admin/competency-intelligence/blueprint-competencies',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await addBlueprintCompetency(pool, {
        blueprint_id: String(body.blueprint_id ?? ''),
        competency_id: String(body.competency_id ?? ''),
        required_level: body.required_level != null ? Number(body.required_level) : NaN,
        weight: body.weight != null ? Number(body.weight) : undefined,
        criticality: body.criticality != null ? String(body.criticality) : undefined,
      });
      if (!result.ok) {
        const notFound = result.error === 'blueprint_not_found' || result.error === 'competency_not_found';
        const conflict = result.error === 'duplicate_blueprint_competency';
        res.status(notFound ? 404 : conflict ? 409 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { id: result.id };
    }),
  );

  app.delete(
    '/api/admin/competency-intelligence/blueprint-competencies/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid_id' }); return undefined; }
      const result = await deleteBlueprintCompetency(pool, id);
      if (!result.ok) {
        res.status(result.error === 'mapping_not_found' ? 404 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { deleted: true, id };
    }),
  );

  // Admin write — map / unmap a role to an assessment blueprint.
  app.post(
    '/api/admin/competency-intelligence/role-assessments',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await createRoleAssessment(pool, {
        role_id: String(body.role_id ?? ''),
        blueprint_id: String(body.blueprint_id ?? ''),
        is_primary: body.is_primary as boolean | undefined,
      });
      if (!result.ok) {
        const notFound = result.error === 'role_not_found' || result.error === 'blueprint_not_found';
        const conflict = result.error === 'duplicate_role_assessment';
        res.status(notFound ? 404 : conflict ? 409 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { id: result.id };
    }),
  );

  app.delete(
    '/api/admin/competency-intelligence/role-assessments/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid_id' }); return undefined; }
      const result = await deleteRoleAssessment(pool, id);
      if (!result.ok) {
        res.status(result.error === 'mapping_not_found' ? 404 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { deleted: true, id };
    }),
  );

  // Admin write — map / unmap a competency to an existing question.
  app.post(
    '/api/admin/competency-intelligence/competency-questions',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await createCompetencyQuestion(pool, {
        competency_id: String(body.competency_id ?? ''),
        question_id: String(body.question_id ?? ''),
      });
      if (!result.ok) {
        const notFound = result.error === 'competency_not_found' || result.error === 'question_not_found';
        const conflict = result.error === 'duplicate_question_mapping';
        res.status(notFound ? 404 : conflict ? 409 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { id: result.id };
    }),
  );

  app.delete(
    '/api/admin/competency-intelligence/competency-questions/:id',
    gate,
    requireAuth,
    requireSuperAdmin,
    wrap(async (req, res) => {
      const id = parseInt(String(req.params.id), 10);
      if (!Number.isFinite(id)) { res.status(400).json({ ok: false, error: 'invalid_id' }); return undefined; }
      const result = await deleteCompetencyQuestion(pool, id);
      if (!result.ok) {
        res.status(result.error === 'mapping_not_found' ? 404 : 400).json({ ok: false, error: result.error });
        return undefined;
      }
      return { deleted: true, id };
    }),
  );
}
