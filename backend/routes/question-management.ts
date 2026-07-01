/**
 * CAPADEX 3.0 — Program 3 · Phase 3.2 Enterprise Question Management Platform routes.
 *
 * A read-only certification composer over the ONE canonical Question Management Platform + the
 * reuse-before-build engineering-closure mechanisms. EIGHT INDEPENDENT dimensions certified SEPARATELY:
 *   platform · library · metadata · governance · version_management · workflow · apis · frontend.
 *
 * READ (certification):
 *   - GET /api/question-management/enabled                 flag probe (503 when OFF)
 *   - GET /api/admin/question-management/model             canonical registry
 *   - GET /api/admin/question-management/dimensions        the 8 dimensions, evidence VERIFIED vs live FS+DB
 *   - GET /api/admin/question-management/types             29-type catalog (honest SUPPORTED/PARTIAL)
 *   - GET /api/admin/question-management/metadata          canonical metadata standard + source crosswalk
 *   - GET /api/admin/question-management/lifecycle         9-state model mapped onto the 6-state CHECK
 *   - GET /api/admin/question-management/governance        control-plane
 *   - GET /api/admin/question-management/versioning        version capabilities
 *   - GET /api/admin/question-management/workflow          workflow stages
 *   - GET /api/admin/question-management/search            search capabilities
 *   - GET /api/admin/question-management/bulk-ops          bulk operations
 *   - GET /api/admin/question-management/library           library scopes (banks unified by reference)
 *   - GET /api/admin/question-management/repository-alignment  evidence rollup vs live FS+DB
 *   - GET /api/admin/question-management/adoption          SEPARATE usage axis (never a gap)
 *   - GET /api/admin/question-management/gaps              0 OPEN + 8 RESOLVED
 *   - GET /api/admin/question-management/summary           8 dimensions reported SEPARATELY + verdict
 *
 * MECHANISMS (reuse-before-build; the ONLY DDL sites — run behind flag + super-admin → OFF creates 0 tables):
 *   metadata/upsert · versions/{snapshot,rollback,clone,fork,merge} + list · collections/{create,list} ·
 *   searches/{save,list} · bulk/{enqueue,list} · workflow/{transition,history}.
 *
 * Strictly additive + reversible + flag-gated (`questionManagementPlatform`, FF_QUESTION_MANAGEMENT_PLATFORM,
 * default OFF): OFF → every route 503 (503-before-auth) → byte-identical legacy incl. schema (no table touched).
 * Never throws: unexpected errors degrade to a 200 honest-degraded JSON. Coverage⟂Confidence⟂Adoption; null≠0.
 */
import type { Express, Request, Response, NextFunction } from 'express';
import type { Pool } from 'pg';
import { isFlagEnabled } from '../config/feature-flags';
import {
  QMP_AXES, QMP_DIMENSIONS, QUESTION_TYPES, METADATA_STANDARD, METADATA_SOURCE_COVERAGE,
  LIFECYCLE_STATES, LIFECYCLE_MAPPING, GOVERNANCE_CONTROLS, VERSION_CAPABILITIES, WORKFLOW_STAGES,
  SEARCH_CAPABILITIES, BULK_OPERATIONS, LIBRARY_SCOPES, MAPPING_MODEL, QMP_DECISIONS,
} from '../config/question-management-platform';
import {
  composeDimensions, composeTypeCatalog, composeMetadata, composeLifecycle, composeGovernance,
  composeVersioning, composeWorkflow, composeSearch, composeBulkOps, composeLibrary,
  composeRepositoryAlignment, composeAdoption, classifiedGaps, composeSummary,
} from '../services/question-management-engine';
import {
  upsertMetadata, snapshotVersion, listVersions, compareVersions, rollbackVersion,
  cloneQuestion, forkQuestion, mergeVersion,
  createCollection, listCollections, saveSearch, listSavedSearches,
  enqueueBulkJob, listBulkJobs, workflowTransition, workflowHistory,
} from '../services/question-management-mechanisms';

type Mw = (req: Request, res: Response, next: NextFunction) => void;

function flagGate(_req: Request, res: Response, next: NextFunction) {
  if (!isFlagEnabled('questionManagementPlatform')) {
    return res.status(503).json({ ok: false, error: 'question_management_platform_disabled' });
  }
  next();
}

function degraded(res: Response, tag: string, err: unknown) {
  console.error(`[question-management] ${tag} error:`, err);
  res.status(200).json({ ok: true, degraded: true, reason: 'unexpected_error', read_only: true });
}

function actorOf(req: Request): string | undefined {
  const u = (req as unknown as { user?: { email?: string; username?: string } }).user;
  return u?.email || u?.username || undefined;
}

export function registerQuestionManagementRoutes(
  app: Express,
  pool: Pool,
  requireAuth: Mw,
  requireSuperAdmin: Mw,
): void {
  const g = [flagGate, requireAuth, requireSuperAdmin];

  // Flag probe (flag STATE is not sensitive). 503 when OFF; res.ok=true only when ON.
  app.get('/api/question-management/enabled', flagGate, async (_req: Request, res: Response) => {
    res.json({ ok: true, enabled: true });
  });

  // Canonical model (static registry — no DB read).
  app.get('/api/admin/question-management/model', ...g, async (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true, platform_frozen: true,
        axes: QMP_AXES, dimensions: QMP_DIMENSIONS, question_types: QUESTION_TYPES,
        metadata_standard: METADATA_STANDARD, metadata_source_coverage: METADATA_SOURCE_COVERAGE,
        lifecycle_states: LIFECYCLE_STATES, lifecycle_mapping: LIFECYCLE_MAPPING,
        governance_controls: GOVERNANCE_CONTROLS, version_capabilities: VERSION_CAPABILITIES,
        workflow_stages: WORKFLOW_STAGES, search_capabilities: SEARCH_CAPABILITIES,
        bulk_operations: BULK_OPERATIONS, library_scopes: LIBRARY_SCOPES,
        mapping_model: MAPPING_MODEL, decisions: QMP_DECISIONS,
      });
    } catch (err) { degraded(res, 'model', err); }
  });

  app.get('/api/admin/question-management/dimensions', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, dimensions: await composeDimensions(pool) }); }
    catch (err) { degraded(res, 'dimensions', err); }
  });

  app.get('/api/admin/question-management/types', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, type_catalog: composeTypeCatalog() }); }
    catch (err) { degraded(res, 'types', err); }
  });

  app.get('/api/admin/question-management/metadata', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, metadata: await composeMetadata(pool) }); }
    catch (err) { degraded(res, 'metadata', err); }
  });

  app.get('/api/admin/question-management/lifecycle', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, lifecycle: await composeLifecycle(pool) }); }
    catch (err) { degraded(res, 'lifecycle', err); }
  });

  app.get('/api/admin/question-management/governance', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, governance: await composeGovernance(pool) }); }
    catch (err) { degraded(res, 'governance', err); }
  });

  app.get('/api/admin/question-management/versioning', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, versioning: await composeVersioning(pool) }); }
    catch (err) { degraded(res, 'versioning', err); }
  });

  app.get('/api/admin/question-management/workflow', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, workflow: await composeWorkflow(pool) }); }
    catch (err) { degraded(res, 'workflow', err); }
  });

  app.get('/api/admin/question-management/search', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, search: await composeSearch(pool) }); }
    catch (err) { degraded(res, 'search', err); }
  });

  app.get('/api/admin/question-management/bulk-ops', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, bulk_ops: await composeBulkOps(pool) }); }
    catch (err) { degraded(res, 'bulk-ops', err); }
  });

  app.get('/api/admin/question-management/library', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, library: await composeLibrary(pool) }); }
    catch (err) { degraded(res, 'library', err); }
  });

  app.get('/api/admin/question-management/repository-alignment', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, repository_alignment: await composeRepositoryAlignment(pool) }); }
    catch (err) { degraded(res, 'repository-alignment', err); }
  });

  app.get('/api/admin/question-management/adoption', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, adoption: await composeAdoption(pool) }); }
    catch (err) { degraded(res, 'adoption', err); }
  });

  app.get('/api/admin/question-management/gaps', ...g, async (_req: Request, res: Response) => {
    try {
      const { gaps, gap_counts, resolved_gaps, resolved_gap_counts, resolved_gap_count } = classifiedGaps();
      res.json({ ok: true, gaps, gap_counts, gap_total: gaps.length, resolved_gaps, resolved_gap_counts, resolved_gap_count });
    } catch (err) { degraded(res, 'gaps', err); }
  });

  app.get('/api/admin/question-management/summary', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, summary: await composeSummary(pool) }); }
    catch (err) { degraded(res, 'summary', err); }
  });

  // ── MECHANISMS — reuse-before-build. The ONLY DDL sites (behind flag + super-admin). ──

  // Metadata overlay
  app.post('/api/admin/question-management/metadata/upsert', ...g, async (req: Request, res: Response) => {
    try {
      const qid = String(req.body?.question_id || '').trim();
      if (!qid) return res.status(400).json({ ok: false, error: 'question_id_required' });
      res.json({ ok: true, result: await upsertMetadata(pool, { ...req.body, question_id: qid, author: req.body?.author ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'metadata-upsert', err); }
  });

  // Versions — literal sub-paths BEFORE the /:questionId param route.
  app.post('/api/admin/question-management/versions/snapshot', ...g, async (req: Request, res: Response) => {
    try {
      const qid = String(req.body?.question_id || '').trim();
      if (!qid) return res.status(400).json({ ok: false, error: 'question_id_required' });
      res.json({ ok: true, result: await snapshotVersion(pool, { ...req.body, question_id: qid, author: req.body?.author ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'versions-snapshot', err); }
  });

  app.post('/api/admin/question-management/versions/rollback', ...g, async (req: Request, res: Response) => {
    try {
      const qid = String(req.body?.question_id || '').trim();
      const to = Number(req.body?.to_version);
      if (!qid || !Number.isFinite(to)) return res.status(400).json({ ok: false, error: 'question_id_and_to_version_required' });
      res.json({ ok: true, result: await rollbackVersion(pool, qid, to, actorOf(req)) });
    } catch (err) { degraded(res, 'versions-rollback', err); }
  });

  app.post('/api/admin/question-management/versions/clone', ...g, async (req: Request, res: Response) => {
    try {
      const src = String(req.body?.source_id || '').trim();
      const nid = String(req.body?.new_id || '').trim();
      if (!src || !nid) return res.status(400).json({ ok: false, error: 'source_id_and_new_id_required' });
      res.json({ ok: true, result: await cloneQuestion(pool, src, nid, actorOf(req)) });
    } catch (err) { degraded(res, 'versions-clone', err); }
  });

  app.post('/api/admin/question-management/versions/fork', ...g, async (req: Request, res: Response) => {
    try {
      const qid = String(req.body?.question_id || '').trim();
      const branch = String(req.body?.branch || '').trim();
      if (!qid || !branch) return res.status(400).json({ ok: false, error: 'question_id_and_branch_required' });
      res.json({ ok: true, result: await forkQuestion(pool, qid, branch, actorOf(req)) });
    } catch (err) { degraded(res, 'versions-fork', err); }
  });

  app.post('/api/admin/question-management/versions/merge', ...g, async (req: Request, res: Response) => {
    try {
      const qid = String(req.body?.question_id || '').trim();
      const fromBranch = String(req.body?.from_branch || '').trim();
      if (!qid || !fromBranch) return res.status(400).json({ ok: false, error: 'question_id_and_from_branch_required' });
      res.json({ ok: true, result: await mergeVersion(pool, qid, fromBranch, actorOf(req)) });
    } catch (err) { degraded(res, 'versions-merge', err); }
  });

  app.get('/api/admin/question-management/versions/compare', ...g, async (req: Request, res: Response) => {
    try {
      const qid = String(req.query.question_id || '').trim();
      const a = Number(req.query.a), b = Number(req.query.b);
      if (!qid || !Number.isFinite(a) || !Number.isFinite(b)) return res.status(400).json({ ok: false, error: 'question_id_a_b_required' });
      res.json({ ok: true, result: await compareVersions(pool, qid, a, b) });
    } catch (err) { degraded(res, 'versions-compare', err); }
  });

  app.get('/api/admin/question-management/versions/:questionId', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, versions: await listVersions(pool, String(req.params.questionId)) }); }
    catch (err) { degraded(res, 'versions-list', err); }
  });

  // Collections
  app.post('/api/admin/question-management/collections/create', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.body?.slug || '').trim();
      const name = String(req.body?.name || '').trim();
      if (!slug || !name) return res.status(400).json({ ok: false, error: 'slug_and_name_required' });
      res.json({ ok: true, result: await createCollection(pool, { ...req.body, slug, name, owner: req.body?.owner ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'collections-create', err); }
  });

  app.get('/api/admin/question-management/collections', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, collections: await listCollections(pool) }); }
    catch (err) { degraded(res, 'collections-list', err); }
  });

  // Saved searches
  app.post('/api/admin/question-management/searches/save', ...g, async (req: Request, res: Response) => {
    try {
      const slug = String(req.body?.slug || '').trim();
      const name = String(req.body?.name || '').trim();
      if (!slug || !name) return res.status(400).json({ ok: false, error: 'slug_and_name_required' });
      res.json({ ok: true, result: await saveSearch(pool, { slug, name, query: req.body?.query ?? {}, owner: req.body?.owner ?? actorOf(req) }) });
    } catch (err) { degraded(res, 'searches-save', err); }
  });

  app.get('/api/admin/question-management/searches', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, saved_searches: await listSavedSearches(pool) }); }
    catch (err) { degraded(res, 'searches-list', err); }
  });

  // Bulk jobs
  app.post('/api/admin/question-management/bulk/enqueue', ...g, async (req: Request, res: Response) => {
    try {
      const jobType = String(req.body?.job_type || '').trim();
      if (!jobType) return res.status(400).json({ ok: false, error: 'job_type_required' });
      res.json({ ok: true, result: await enqueueBulkJob(pool, { job_type: jobType, total: req.body?.total, params: req.body?.params, requested_by: actorOf(req) }) });
    } catch (err) { degraded(res, 'bulk-enqueue', err); }
  });

  app.get('/api/admin/question-management/bulk', ...g, async (_req: Request, res: Response) => {
    try { res.json({ ok: true, jobs: await listBulkJobs(pool) }); }
    catch (err) { degraded(res, 'bulk-list', err); }
  });

  // Workflow — literal /transition BEFORE the /:questionId history param route.
  app.post('/api/admin/question-management/workflow/transition', ...g, async (req: Request, res: Response) => {
    try {
      const qid = String(req.body?.question_id || '').trim();
      const toState = String(req.body?.to_state || '').trim();
      const action = String(req.body?.action || '').trim();
      if (!qid || !toState || !action) return res.status(400).json({ ok: false, error: 'question_id_to_state_action_required' });
      res.json({ ok: true, result: await workflowTransition(pool, { question_id: qid, to_state: toState, action, from_state: req.body?.from_state, actor: actorOf(req), note: req.body?.note }) });
    } catch (err) { degraded(res, 'workflow-transition', err); }
  });

  app.get('/api/admin/question-management/workflow/:questionId', ...g, async (req: Request, res: Response) => {
    try { res.json({ ok: true, history: await workflowHistory(pool, String(req.params.questionId)) }); }
    catch (err) { degraded(res, 'workflow-history', err); }
  });
}
