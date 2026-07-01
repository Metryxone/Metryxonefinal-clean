/**
 * CAPADEX 3.0 — Program 3 · Phase 3.3 Enterprise Assessment Builder (Authoring Platform) routes.
 *
 * A read-only certification composer over the ONE canonical Assessment Builder + the reuse-before-build
 * engineering-closure mechanisms. SEVEN INDEPENDENT dimensions certified SEPARATELY:
 *   builder · blueprint · validation · version_management · publishing · apis · frontend.
 * Scope is AUTHORING ONLY — design/compose/configure/validate/version/approve/publish. NOT delivery/scoring.
 *
 * READ (certification):
 *   - GET /api/assessment-builder/enabled                     flag probe (503 when OFF)
 *   - GET /api/admin/assessment-builder/model                 canonical registry
 *   - GET /api/admin/assessment-builder/dimensions            the 7 dimensions, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/assessment-builder/designer-actions      designer action catalog
 *   - GET /api/admin/assessment-builder/structure             structure levels
 *   - GET /api/admin/assessment-builder/composition           composition capabilities
 *   - GET /api/admin/assessment-builder/templates             reusable template catalog
 *   - GET /api/admin/assessment-builder/blueprint             blueprint capabilities
 *   - GET /api/admin/assessment-builder/rules                 rule types
 *   - GET /api/admin/assessment-builder/config                config options
 *   - GET /api/admin/assessment-builder/versioning            version capabilities
 *   - GET /api/admin/assessment-builder/validation            validation checks
 *   - GET /api/admin/assessment-builder/workflow              workflow states
 *   - GET /api/admin/assessment-builder/mapping               10-dimension mapping model
 *   - GET /api/admin/assessment-builder/repository-alignment  evidence rollup vs live FS+DB
 *   - GET /api/admin/assessment-builder/adoption              SEPARATE usage axis (never a gap)
 *   - GET /api/admin/assessment-builder/gaps                  0 OPEN + 7 RESOLVED
 *   - GET /api/admin/assessment-builder/summary               7 dimensions reported SEPARATELY + verdict
 *
 * MECHANISMS (reuse-before-build; the ONLY DDL sites — run behind flag + super-admin → OFF creates 0 tables):
 *   assessments/{upsert,clone,list,:slug} · versions/{snapshot,rollback,compare,:slug} · blueprints/{upsert,list} ·
 *   templates/{create,list} · validation/{run,:slug} · workflow/{transition,:slug}.
 *
 * Strictly additive + reversible + flag-gated (`assessmentBuilder`, FF_ASSESSMENT_BUILDER, default OFF):
 * OFF → every route 503 (503-before-auth) → byte-identical legacy incl. schema (no table touched).
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON. Coverage⟂Confidence⟂Adoption; null≠0.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  AB_AXES, AB_DIMENSIONS, DESIGNER_ACTIONS, STRUCTURE_LEVELS, COMPOSITION_CAPS, REUSABLE_TEMPLATES,
  BLUEPRINT_CAPS, RULE_TYPES, CONFIG_OPTIONS, VERSION_CAPABILITIES, VALIDATION_CHECKS, WORKFLOW_STATES,
  MAPPING_MODEL, AB_DECISIONS,
} from '../config/assessment-builder';
import {
  composeDimensions, composeDesignerActions, composeStructureLevels, composeCompositionCaps, composeTemplates,
  composeBlueprintCaps, composeRuleTypes, composeConfigOptions, composeVersioning, composeValidationChecks,
  composeWorkflow, composeMapping, composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/assessment-builder-engine';
import {
  upsertAssessment, getAssessment, listAssessments, cloneAssessment,
  snapshotVersion, listVersions, compareVersions, rollbackVersion,
  upsertBlueprint, listBlueprints, createTemplate, listTemplates,
  runValidation, latestValidation, workflowTransition, workflowHistory,
} from '../services/assessment-builder-mechanisms';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('assessmentBuilder')) {
    return res.status(503).json({ ok: false, error: 'assessment_builder_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[assessment-builder] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

function actorOf(req: Request): string | undefined {
  const u = (req as unknown as { user?: { email?: string; username?: string } }).user;
  return u?.email || u?.username || undefined;
}

export function registerAssessmentBuilderRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const g = [flagGate, requireAuth, requireSuperAdmin];

  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/assessment-builder/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical model (static registry — no DB read).
  app.get('/api/admin/assessment-builder/model', ...g, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true, platform_frozen: true,
        axes: AB_AXES, dimensions: AB_DIMENSIONS,
        designer_actions: DESIGNER_ACTIONS, structure_levels: STRUCTURE_LEVELS, composition_caps: COMPOSITION_CAPS,
        reusable_templates: REUSABLE_TEMPLATES, blueprint_caps: BLUEPRINT_CAPS, rule_types: RULE_TYPES,
        config_options: CONFIG_OPTIONS, version_capabilities: VERSION_CAPABILITIES, validation_checks: VALIDATION_CHECKS,
        workflow_states: WORKFLOW_STATES, mapping_model: MAPPING_MODEL, decisions: AB_DECISIONS,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  app.get('/api/admin/assessment-builder/dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, dimensions: await composeDimensions(pool) }); }
    catch (err) { degraded(res, 'dimensions', err); }
  });

  app.get('/api/admin/assessment-builder/designer-actions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, designer_actions: composeDesignerActions() }); }
    catch (err) { degraded(res, 'designer-actions', err); }
  });

  app.get('/api/admin/assessment-builder/structure', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, structure: composeStructureLevels() }); }
    catch (err) { degraded(res, 'structure', err); }
  });

  app.get('/api/admin/assessment-builder/composition', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, composition: composeCompositionCaps() }); }
    catch (err) { degraded(res, 'composition', err); }
  });

  app.get('/api/admin/assessment-builder/templates', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, templates: composeTemplates() }); }
    catch (err) { degraded(res, 'templates', err); }
  });

  app.get('/api/admin/assessment-builder/blueprint', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, blueprint: await composeBlueprintCaps(pool) }); }
    catch (err) { degraded(res, 'blueprint', err); }
  });

  app.get('/api/admin/assessment-builder/rules', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, rules: await composeRuleTypes(pool) }); }
    catch (err) { degraded(res, 'rules', err); }
  });

  app.get('/api/admin/assessment-builder/config', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, config: await composeConfigOptions(pool) }); }
    catch (err) { degraded(res, 'config', err); }
  });

  app.get('/api/admin/assessment-builder/versioning', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, versioning: await composeVersioning(pool) }); }
    catch (err) { degraded(res, 'versioning', err); }
  });

  app.get('/api/admin/assessment-builder/validation', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, validation: await composeValidationChecks(pool) }); }
    catch (err) { degraded(res, 'validation', err); }
  });

  app.get('/api/admin/assessment-builder/workflow', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, workflow: await composeWorkflow(pool) }); }
    catch (err) { degraded(res, 'workflow', err); }
  });

  app.get('/api/admin/assessment-builder/mapping', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, mapping: await composeMapping(pool) }); }
    catch (err) { degraded(res, 'mapping', err); }
  });

  app.get('/api/admin/assessment-builder/repository-alignment', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) }); }
    catch (err) { degraded(res, 'repository-alignment', err); }
  });

  app.get('/api/admin/assessment-builder/adoption', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, adoption: await composeAdoption(pool) }); }
    catch (err) { degraded(res, 'adoption', err); }
  });

  app.get('/api/admin/assessment-builder/gaps', ...g, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  app.get('/api/admin/assessment-builder/summary', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, summary: await composeSummary(pool) }); }
    catch (err) { degraded(res, 'summary', err); }
  });

  // ── MECHANISMS — reuse-before-build. The ONLY DDL sites (behind flag + super-admin). ──

  // Assessments (CRUD)
  app.post('/api/admin/assessment-builder/assessments/upsert', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.body?.slug || '').trim();
      const title = String(req.body?.title || '').trim();
      if (!slug || !title) return res.status(400).json({ ok: false, error: 'slug_and_title_required' });
      res.json({ ok: true, result: await upsertAssessment(pool, { ...req.body, slug, title, author: req.body?.author ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'assessments-upsert', err); }
  });

  app.post('/api/admin/assessment-builder/assessments/clone', ...g, async (req: Request, res: Response) => {
    try {
      const src = String(req.body?.source_slug || '').trim();
      const nid = String(req.body?.new_slug || '').trim();
      const title = String(req.body?.new_title || '').trim();
      if (!src || !nid || !title) return res.status(400).json({ ok: false, error: 'source_slug_new_slug_new_title_required' });
      res.json({ ok: true, result: await cloneAssessment(pool, src, nid, title, actorOf(req)) });
    } catch (err) { degraded(res, 'assessments-clone', err); }
  });

  app.get('/api/admin/assessment-builder/assessments', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, assessments: await listAssessments(pool) }); }
    catch (err) { degraded(res, 'assessments-list', err); }
  });

  app.get('/api/admin/assessment-builder/assessments/:slug', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, assessment: await getAssessment(pool, String(req.params.slug)) }); }
    catch (err) { degraded(res, 'assessment-get', err); }
  });

  // Versions — literal sub-paths BEFORE the /:slug param route.
  app.post('/api/admin/assessment-builder/versions/snapshot', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.body?.slug || '').trim();
      if (!slug) return res.status(400).json({ ok: false, error: 'slug_required' });
      res.json({ ok: true, result: await snapshotVersion(pool, { ...req.body, slug, author: req.body?.author ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'versions-snapshot', err); }
  });

  app.post('/api/admin/assessment-builder/versions/rollback', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.body?.slug || '').trim();
      const to = Number(req.body?.to_version);
      if (!slug || !Number.isFinite(to)) return res.status(400).json({ ok: false, error: 'slug_and_to_version_required' });
      res.json({ ok: true, result: await rollbackVersion(pool, slug, to, actorOf(req)) });
    } catch (err) { degraded(res, 'versions-rollback', err); }
  });

  app.get('/api/admin/assessment-builder/versions/compare', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.query.slug || '').trim();
      const a = Number(req.query.a), b = Number(req.query.b);
      if (!slug || !Number.isFinite(a) || !Number.isFinite(b)) return res.status(400).json({ ok: false, error: 'slug_a_b_required' });
      res.json({ ok: true, result: await compareVersions(pool, slug, a, b) });
    } catch (err) { degraded(res, 'versions-compare', err); }
  });

  app.get('/api/admin/assessment-builder/versions/:slug', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, versions: await listVersions(pool, String(req.params.slug)) }); }
    catch (err) { degraded(res, 'versions-list', err); }
  });

  // Blueprints
  app.post('/api/admin/assessment-builder/blueprints/upsert', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.body?.slug || '').trim();
      const name = String(req.body?.name || '').trim();
      if (!slug || !name) return res.status(400).json({ ok: false, error: 'slug_and_name_required' });
      res.json({ ok: true, result: await upsertBlueprint(pool, { ...req.body, slug, name, owner: req.body?.owner ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'blueprints-upsert', err); }
  });

  app.get('/api/admin/assessment-builder/blueprints', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, blueprints: await listBlueprints(pool) }); }
    catch (err) { degraded(res, 'blueprints-list', err); }
  });

  // Templates
  app.post('/api/admin/assessment-builder/templates/create', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.body?.slug || '').trim();
      const name = String(req.body?.name || '').trim();
      if (!slug || !name) return res.status(400).json({ ok: false, error: 'slug_and_name_required' });
      res.json({ ok: true, result: await createTemplate(pool, { ...req.body, slug, name, owner: req.body?.owner ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'templates-create', err); }
  });

  app.get('/api/admin/assessment-builder/templates/list', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, templates: await listTemplates(pool) }); }
    catch (err) { degraded(res, 'templates-list', err); }
  });

  // Validation — literal /run BEFORE the /:slug latest-result route.
  app.post('/api/admin/assessment-builder/validation/run', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.body?.slug || '').trim();
      if (!slug) return res.status(400).json({ ok: false, error: 'slug_required' });
      res.json({ ok: true, result: await runValidation(pool, slug, actorOf(req)) });
    } catch (err) { degraded(res, 'validation-run', err); }
  });

  app.get('/api/admin/assessment-builder/validation/:slug', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, latest: await latestValidation(pool, String(req.params.slug)) }); }
    catch (err) { degraded(res, 'validation-latest', err); }
  });

  // Workflow — literal /transition BEFORE the /:slug history param route.
  app.post('/api/admin/assessment-builder/workflow/transition', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.body?.slug || '').trim();
      const toState = String(req.body?.to_state || '').trim();
      const action = String(req.body?.action || '').trim();
      if (!slug || !toState || !action) return res.status(400).json({ ok: false, error: 'slug_to_state_action_required' });
      res.json({ ok: true, result: await workflowTransition(pool, { slug, to_state: toState, action, from_state: req.body?.from_state, actor: actorOf(req), note: req.body?.note }) });
    } catch (err) { degraded(res, 'workflow-transition', err); }
  });

  app.get('/api/admin/assessment-builder/workflow/:slug', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, history: await workflowHistory(pool, String(req.params.slug)) }); }
    catch (err) { degraded(res, 'workflow-history', err); }
  });
}
