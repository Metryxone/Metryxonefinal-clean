/**
 * CAPADEX Question Registry & Governance — SuperAdmin API (Phase 5, 2026-06-01).
 *
 * Lifecycle-tracks every clarity question so the bank can scale to 20,000+ items
 * under HUMAN governance. Backed by services/question-registry-service.ts.
 *
 * Endpoints (all requireAuth + requireSuperAdmin):
 *   GET   /api/admin/capadex/question-registry/stats        — counters + governance sizes
 *   GET   /api/admin/capadex/question-registry/registry     — paginated rows (?status=&q=&limit=&offset=)
 *   GET   /api/admin/capadex/question-registry/governance   — weak / duplicate / low-signal / retirement
 *   GET   /api/admin/capadex/question-registry/export.csv   — flat export (formula-safe)
 *   POST  /api/admin/capadex/question-registry/refresh      — bulk metric snapshot (NEVER changes status)
 *   PATCH /api/admin/capadex/question-registry/:question_id — human status transition (the ONLY status writer)
 *
 * Status transitions are HUMAN-ONLY and audited; no route or job ever
 * auto-deprecates a question.
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  ensureQuestionRegistrySchema,
  refreshRegistry,
  buildGovernanceData,
  getRegistryPage,
  transitionStatus,
  isLifecycleStatus,
  LIFECYCLE_STATUSES,
  type GovernanceData,
} from '../services/question-registry-service';
import {
  buildCoverageReport,
  COVERAGE_DIMENSIONS,
  DIMENSION_LABELS,
  type CoverageReport,
} from '../services/behavioral-coverage-engine';

// Governance/stats aggregate over the whole registry; cache briefly. Refresh
// and PATCH invalidate it so the UI reflects writes immediately.
const CACHE_TTL_MS = 60_000;
let _cache: { at: number; data: GovernanceData } | null = null;

async function getGovernance(pool: Pool, force = false): Promise<GovernanceData> {
  if (!force && _cache && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;
  const data = await buildGovernanceData(pool);
  _cache = { at: Date.now(), data };
  return data;
}

let _coverageCache: { at: number; data: CoverageReport } | null = null;
async function getCoverage(pool: Pool, force = false): Promise<CoverageReport> {
  if (!force && _coverageCache && Date.now() - _coverageCache.at < CACHE_TTL_MS) return _coverageCache.data;
  const data = await buildCoverageReport(pool);
  _coverageCache = { at: Date.now(), data };
  return data;
}
function invalidate(): void { _cache = null; _coverageCache = null; }

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function registerCapadexQuestionRegistryRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // Bootstrap schema once at registration (best-effort; routes also ensure lazily).
  ensureQuestionRegistrySchema(pool).catch(() => { /* ensured per-request too */ });

  // ------------------------------------------------------------------
  // GET /stats
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/question-registry/stats',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getGovernance(pool, req.query.refresh === '1');
        res.json({ ok: true, statuses: LIFECYCLE_STATUSES, stats: data.stats });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'registry stats failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /registry — server-side paginated (20k-safe)
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/question-registry/registry',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const page = await getRegistryPage(pool, {
          status: typeof req.query.status === 'string' ? req.query.status : undefined,
          search: typeof req.query.q === 'string' ? req.query.q : undefined,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          offset: req.query.offset ? Number(req.query.offset) : undefined,
        });
        res.json({ ok: true, ...page });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'registry page failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /governance — the four triage buckets
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/question-registry/governance',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getGovernance(pool, req.query.refresh === '1');
        res.json({
          ok: true,
          generated_at: data.generated_at,
          stats: data.stats,
          weak: data.weak,
          duplicate: data.duplicate,
          low_signal: data.low_signal,
          dead_end: data.dead_end,
          retirement_candidates: data.retirement_candidates,
        });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'governance failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /coverage — behavioural coverage: per-concern dimension coverage + gaps
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/question-registry/coverage',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getCoverage(pool, req.query.refresh === '1');
        res.json({
          ok: true,
          generated_at: data.generated_at,
          dimensions: COVERAGE_DIMENSIONS.map((d) => ({ key: d, label: DIMENSION_LABELS[d] })),
          stats: data.stats,
          concerns: data.concerns,
        });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'coverage failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /coverage.csv — per-concern dimension coverage export
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/question-registry/coverage.csv',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getCoverage(pool, req.query.refresh === '1');
        const header = [
          'concern_id', 'concern', 'master_bridge_tag', 'total_questions',
          'classified_questions', 'unclassified_questions', 'covered_dimensions',
          'coverage_ratio', ...COVERAGE_DIMENSIONS, 'gaps',
        ];
        const lines = [header.join(',')];
        for (const c of data.concerns) {
          const perDim = COVERAGE_DIMENSIONS.map(
            (d) => c.dimensions.find((x) => x.dimension === d)?.question_count ?? 0);
          lines.push([
            c.concern_id, c.concern, c.master_bridge_tag, c.total_questions,
            c.classified_questions, c.unclassified_questions, c.covered_count,
            c.coverage_ratio, ...perDim, c.gaps.join('|'),
          ].map(csvEscape).join(','));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="behavioral_coverage.csv"');
        res.send(lines.join('\n'));
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'coverage csv failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /export.csv — flat registry export
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/question-registry/export.csv',
    requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        // Pull the whole registry in pages so a 20k bank streams without a huge
        // single allocation upfront.
        const header = [
          'question_id', 'master_bridge_tag', 'status', 'version', 'quality_score',
          'quality_overridden', 'usage_count', 'last_used_at', 'signal_value',
          'report_impact', 'duplicate_of', 'duplicate_score', 'metrics_computed_at',
          'status_changed_at', 'status_changed_by',
        ];
        const lines = [header.join(',')];
        const pageSize = 200;
        let offset = 0;
        for (;;) {
          const page = await getRegistryPage(pool, { limit: pageSize, offset });
          for (const r of page.rows) {
            lines.push([
              r.question_id, r.master_bridge_tag, r.status, r.version, r.quality_score,
              r.quality_overridden, r.usage_count, r.last_used_at, r.signal_value,
              r.report_impact, r.duplicate_of, r.duplicate_score, r.metrics_computed_at,
              r.status_changed_at, r.status_changed_by,
            ].map(csvEscape).join(','));
          }
          offset += pageSize;
          if (offset >= page.total || page.rows.length === 0) break;
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="question_registry.csv"');
        res.send(lines.join('\n'));
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'registry csv failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // POST /refresh — bulk metric snapshot + backfill (NEVER changes status)
  // ------------------------------------------------------------------
  app.post(
    '/api/admin/capadex/question-registry/refresh',
    requireAuth, requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        const result = await refreshRegistry(pool);
        invalidate();
        res.json({ ok: true, ...result });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'registry refresh failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // PATCH /:question_id — human lifecycle transition (audited, the ONLY writer)
  // ------------------------------------------------------------------
  app.patch(
    '/api/admin/capadex/question-registry/:question_id',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const questionId = String(req.params.question_id || '').trim();
        if (!questionId) {
          return res.status(400).json({ ok: false, error: 'question_id required' });
        }
        const toStatus = req.body?.status;
        if (!isLifecycleStatus(toStatus)) {
          return res.status(400).json({
            ok: false,
            error: `status must be one of: ${LIFECYCLE_STATUSES.join(', ')}`,
          });
        }
        const changedBy =
          (req as any).user?.email ||
          (req as any).user?.id ||
          'superadmin';
        let qualityScore: number | null | undefined = undefined;
        if (req.body?.quality_score !== undefined && req.body?.quality_score !== null) {
          const q = Number(req.body.quality_score);
          if (!Number.isFinite(q) || q < 0 || q > 1) {
            return res.status(400).json({ ok: false, error: 'quality_score must be 0..1' });
          }
          qualityScore = q;
        }
        const result = await transitionStatus(pool, {
          questionId,
          toStatus,
          changedBy: String(changedBy),
          reviewNotes: typeof req.body?.review_notes === 'string' ? req.body.review_notes : null,
          qualityScore,
        });
        invalidate();
        res.json(result);
      } catch (err: any) {
        if (err?.code === 'QUESTION_NOT_FOUND') {
          return res.status(404).json({ ok: false, error: err.message });
        }
        res.status(500).json({ ok: false, error: err?.message || 'status transition failed' });
      }
    },
  );
}
