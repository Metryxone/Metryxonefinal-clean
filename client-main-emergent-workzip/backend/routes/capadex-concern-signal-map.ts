/**
 * CAPADEX Concern → Signal Mapping — SuperAdmin API (Task #16).
 *
 * Read endpoints surface the coverage picture
 * (`services/concern-signal-coverage-service.ts`) and the read-only chain
 * validation (`services/concern-signal-chain-validator.ts`). A single write
 * endpoint (`POST /rebuild`) re-runs the deterministic backfill
 * (`services/concern-signal-mapping-engine.ts`); it is idempotent and never
 * touches assessment/report flows.
 *
 * Endpoints (all requireAuth + requireSuperAdmin):
 *   GET  /api/admin/capadex/concern-signal-map/stats       — coverage counters
 *   GET  /api/admin/capadex/concern-signal-map/registry    — per-concern rows (filter/paginate)
 *   GET  /api/admin/capadex/concern-signal-map/orphans     — concerns with no Tier-3 signal
 *   GET  /api/admin/capadex/concern-signal-map/chain       — chain validation report
 *   GET  /api/admin/capadex/concern-signal-map/export.csv  — per-concern registry export
 *   POST /api/admin/capadex/concern-signal-map/rebuild     — re-run backfill (?mode=&dryRun=1)
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  buildConcernSignalCoverage, type CoverageData,
} from '../services/concern-signal-coverage-service';
import {
  validateConcernSignalChain, type ChainValidationReport,
} from '../services/concern-signal-chain-validator';
import {
  runConcernSignalMapping, type BackfillMode,
} from '../services/concern-signal-mapping-engine';

const CACHE_TTL_MS = 60_000;
let _coverage: { at: number; data: CoverageData } | null = null;
let _chain: { at: number; data: ChainValidationReport } | null = null;

async function getCoverage(pool: Pool, force = false): Promise<CoverageData> {
  if (!force && _coverage && Date.now() - _coverage.at < CACHE_TTL_MS) return _coverage.data;
  const data = await buildConcernSignalCoverage(pool);
  _coverage = { at: Date.now(), data };
  return data;
}

async function getChain(pool: Pool, force = false): Promise<ChainValidationReport> {
  if (!force && _chain && Date.now() - _chain.at < CACHE_TTL_MS) return _chain.data;
  const data = await validateConcernSignalChain(pool);
  _chain = { at: Date.now(), data };
  return data;
}

function invalidate(): void {
  _coverage = null;
  _chain = null;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function registerCapadexConcernSignalMapRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  app.get(
    '/api/admin/capadex/concern-signal-map/stats',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const { stats } = await getCoverage(pool, req.query.refresh === '1');
        res.json({ ok: true, stats });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'concern-signal stats failed' });
      }
    },
  );

  app.get(
    '/api/admin/capadex/concern-signal-map/registry',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getCoverage(pool, req.query.refresh === '1');
        const band = String(req.query.band || '').toLowerCase();
        const q = String(req.query.q || '').toLowerCase().trim();
        let rows = data.registry;
        if (band === 'strong' || band === 'moderate' || band === 'weak' || band === 'none') {
          rows = rows.filter((r) => r.coverage_band === band);
        }
        if (req.query.orphans === '1') rows = rows.filter((r) => r.is_orphan);
        if (q) {
          rows = rows.filter((r) =>
            (r.display_label || '').toLowerCase().includes(q) ||
            (r.concern_id || '').toLowerCase().includes(q) ||
            (r.bridge_tag || '').toLowerCase().includes(q) ||
            (r.top_signal || '').toLowerCase().includes(q));
        }
        const total = rows.length;
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
        const offset = Math.max(Number(req.query.offset) || 0, 0);
        res.json({
          ok: true,
          generated_at: data.stats.generated_at,
          total,
          count: Math.min(limit, Math.max(total - offset, 0)),
          registry: rows.slice(offset, offset + limit),
        });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'concern-signal registry failed' });
      }
    },
  );

  app.get(
    '/api/admin/capadex/concern-signal-map/orphans',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getCoverage(pool, req.query.refresh === '1');
        res.json({ ok: true, generated_at: data.stats.generated_at, count: data.orphans.length, orphans: data.orphans });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'concern-signal orphans failed' });
      }
    },
  );

  app.get(
    '/api/admin/capadex/concern-signal-map/chain',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const report = await getChain(pool, req.query.refresh === '1');
        // Default to the summary; full per-concern results only when requested.
        const includeResults = req.query.full === '1';
        const { results, ...summary } = report;
        res.json({ ok: true, ...summary, ...(includeResults ? { results } : { results_omitted: results.length }) });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'concern-signal chain validation failed' });
      }
    },
  );

  app.get(
    '/api/admin/capadex/concern-signal-map/export.csv',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getCoverage(pool, req.query.refresh === '1');
        const header = [
          'concern_pk', 'concern_id', 'display_label', 'domain', 'bridge_tag',
          'tier3_count', 'composite_count', 'atomic_count', 'top_signal',
          'coverage_confidence', 'coverage_band', 'is_orphan',
        ];
        const lines = [header.join(',')];
        for (const r of data.registry) {
          lines.push([
            r.concern_pk, r.concern_id, r.display_label, r.domain, r.bridge_tag,
            r.tier3_count, r.composite_count, r.atomic_count, r.top_signal,
            r.coverage_confidence, r.coverage_band, r.is_orphan,
          ].map(csvEscape).join(','));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="concern_signal_map.csv"');
        res.send(lines.join('\n'));
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'concern-signal csv failed' });
      }
    },
  );

  app.post(
    '/api/admin/capadex/concern-signal-map/rebuild',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const modeRaw = String(req.query.mode || req.body?.mode || 'replace').toLowerCase();
        const mode: BackfillMode =
          modeRaw === 'upsert' || modeRaw === 'append' ? (modeRaw as BackfillMode) : 'replace';
        const dryRun = req.query.dryRun === '1' || req.body?.dryRun === true;
        const stats = await runConcernSignalMapping(pool, { mode, dryRun });
        if (!dryRun) invalidate();
        res.json({ ok: true, stats });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'concern-signal rebuild failed' });
      }
    },
  );
}
