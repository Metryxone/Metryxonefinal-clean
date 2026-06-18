/**
 * Admin routes — CAPADEX Intelligence Pipeline diagnostics & activation analytics.
 *
 *   GET  /api/admin/intelligence/diagnostics          — per-session coverage (signals/composites/patterns)
 *   GET  /api/admin/intelligence/activation-analytics — aggregate coverage stats
 *   POST /api/admin/intelligence/backfill              — run pipeline for sessions missing composites
 *   GET  /api/admin/intelligence/session/:id           — run pipeline for a single session on demand
 *
 * Convention: requireAuth + requireSuperAdmin, 60 s cache, ?refresh=1 to bust.
 * Never 500 on analytics queries — degrades to empty/zero payload.
 */
import type { Express, Request, Response } from 'express';
import type { Pool } from 'pg';
import {
  runIntelligencePipeline,
  backfillIntelligencePipeline,
} from '../services/intelligence-pipeline';
import { getSignalSeedStatus } from '../services/capadex-signals-seeder';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { data: unknown; at: number }>();

async function cachedQuery<T>(
  key: string,
  refresh: boolean,
  build: () => Promise<T>,
): Promise<T> {
  const entry = cache.get(key);
  if (!refresh && entry && Date.now() - entry.at < CACHE_TTL_MS) return entry.data as T;
  const data = await build();
  cache.set(key, { data, at: Date.now() });
  return data;
}

function bustDiagnosticsCache(): void {
  cache.forEach((_, k) => {
    if (k.startsWith('diag:') || k === 'analytics') cache.delete(k);
  });
}

export function registerIntelligenceDiagnosticsRoutes(
  app: Express,
  pool: Pool,
  requireAuth: (req: Request, res: Response, next: any) => void,
  requireSuperAdmin: (req: Request, res: Response, next: any) => void,
): void {

  // ── GET /api/admin/intelligence/diagnostics ──────────────────────────────
  // Per-session table: session_id | signals | composites | patterns | coverage flags.
  app.get(
    '/api/admin/intelligence/diagnostics',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const refresh = req.query.refresh === '1';
      const limit   = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
      try {
        const rows = await cachedQuery(`diag:${limit}`, refresh, async () => {
          const { rows: dbRows } = await pool.query<{
            session_id:     string;
            signals:        string;
            composites:     string;
            patterns:       string;
            has_composites: boolean;
            has_patterns:   boolean;
            first_signal:   string | null;
          }>(
            `SELECT
               sig.session_id,
               COUNT(DISTINCT sig.id)::text      AS signals,
               COUNT(DISTINCT c.id)::text        AS composites,
               COUNT(DISTINCT p.id)::text        AS patterns,
               (COUNT(DISTINCT c.id) > 0)        AS has_composites,
               (COUNT(DISTINCT p.id) > 0)        AS has_patterns,
               MIN(sig.captured_at)::text        AS first_signal
             FROM capadex_session_signals sig
             LEFT JOIN capadex_session_composites c ON c.session_id = sig.session_id
             LEFT JOIN capadex_session_patterns   p ON p.session_id = sig.session_id
             GROUP BY sig.session_id
             ORDER BY MIN(sig.captured_at) DESC
             LIMIT $1`,
            [limit],
          );
          return dbRows.map((r) => ({
            session_id:     r.session_id,
            signals:        Number(r.signals),
            composites:     Number(r.composites),
            patterns:       Number(r.patterns),
            has_composites: r.has_composites,
            has_patterns:   r.has_patterns,
            first_signal:   r.first_signal ?? null,
          }));
        });
        res.json({ ok: true, sessions: rows, limit });
      } catch (err) {
        console.error('[intelligence-diagnostics] diagnostics error:', err);
        res.status(500).json({ ok: false, error: 'diagnostics_error' });
      }
    },
  );

  // ── GET /api/admin/intelligence/activation-analytics ────────────────────
  // Aggregate stats: total sessions with signals, % with composites, % with patterns,
  // averages per session, how many are still missing each layer.
  app.get(
    '/api/admin/intelligence/activation-analytics',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const refresh = req.query.refresh === '1';
      try {
        const analytics = await cachedQuery('analytics', refresh, async () => {
          const { rows: [agg] } = await pool.query<{
            total_sig:    string;
            with_comp:    string;
            with_pat:     string;
            total_comp:   string;
            total_pat:    string;
            avg_comp:     string;
            avg_pat:      string;
            avg_sig:      string;
          }>(
            `WITH sig_sessions AS (
               SELECT session_id, COUNT(*) AS n FROM capadex_session_signals GROUP BY session_id
             ),
             comp_sessions AS (
               SELECT session_id, COUNT(*) AS n FROM capadex_session_composites GROUP BY session_id
             ),
             pat_sessions AS (
               SELECT session_id, COUNT(*) AS n FROM capadex_session_patterns GROUP BY session_id
             )
             SELECT
               COUNT(DISTINCT ss.session_id)::text              AS total_sig,
               COUNT(DISTINCT cs.session_id)::text              AS with_comp,
               COUNT(DISTINCT ps.session_id)::text              AS with_pat,
               COALESCE(SUM(cs.n), 0)::text                     AS total_comp,
               COALESCE(SUM(ps.n), 0)::text                     AS total_pat,
               ROUND(COALESCE(AVG(cs.n), 0), 2)::text           AS avg_comp,
               ROUND(COALESCE(AVG(ps.n), 0), 2)::text           AS avg_pat,
               ROUND(COALESCE(AVG(ss.n), 0), 2)::text           AS avg_sig
             FROM sig_sessions ss
             LEFT JOIN comp_sessions cs USING (session_id)
             LEFT JOIN pat_sessions   ps USING (session_id)`,
          );

          const totalSig  = Number(agg?.total_sig  ?? 0);
          const withComp  = Number(agg?.with_comp  ?? 0);
          const withPat   = Number(agg?.with_pat   ?? 0);

          return {
            total_sessions_with_signals:   totalSig,
            sessions_with_composites:      withComp,
            sessions_with_patterns:        withPat,
            composite_coverage_pct:        totalSig > 0 ? Math.round((withComp / totalSig) * 100) : 0,
            pattern_coverage_pct:          totalSig > 0 ? Math.round((withPat  / totalSig) * 100) : 0,
            total_composites:              Number(agg?.total_comp ?? 0),
            total_patterns:                Number(agg?.total_pat  ?? 0),
            avg_composites_per_session:    Number(agg?.avg_comp   ?? 0),
            avg_patterns_per_session:      Number(agg?.avg_pat    ?? 0),
            avg_signals_per_session:       Number(agg?.avg_sig    ?? 0),
            sessions_missing_composites:   totalSig - withComp,
            sessions_missing_patterns:     totalSig - withPat,
          };
        });
        res.json({ ok: true, analytics });
      } catch (err) {
        console.error('[intelligence-diagnostics] analytics error:', err);
        res.status(500).json({ ok: false, error: 'analytics_error' });
      }
    },
  );

  // ── POST /api/admin/intelligence/backfill ────────────────────────────────
  // Run the composite + pattern pipeline for every session that has signals but
  // is missing composites. limit (body or query param) defaults to 100.
  // Returns per-session results plus an aggregate summary.
  app.post(
    '/api/admin/intelligence/backfill',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const limit = Math.min(500, Math.max(1, Number(req.body?.limit ?? req.query.limit ?? 100)));
      try {
        const { total, processed, results } = await backfillIntelligencePipeline(pool, limit);
        bustDiagnosticsCache();

        const summary = {
          composites_written: results.reduce((a, r) => a + r.composites_written, 0),
          patterns_written:   results.reduce((a, r) => a + r.patterns_written,   0),
          errors:             results.filter((r) => r.error).length,
          skipped:            results.filter((r) => r.skipped_reason).length,
        };

        res.json({
          ok: true,
          total_eligible: total,
          processed,
          summary,
          results: results.map((r) => ({
            session_id: r.session_id,
            signals:    r.signals_count,
            composites: r.composites_written,
            patterns:   r.patterns_written,
            skipped:    r.skipped_reason ?? null,
            error:      r.error ?? null,
          })),
        });
      } catch (err) {
        console.error('[intelligence-diagnostics] backfill error:', err);
        res.status(500).json({ ok: false, error: 'backfill_error' });
      }
    },
  );

  // ── GET /api/admin/intelligence/seed-status ─────────────────────────────
  // Returns the current state of the capadex_signals ontology seeder:
  // how many rows exist, how many are seeded, and the cluster breakdown.
  app.get(
    '/api/admin/intelligence/seed-status',
    requireAuth,
    requireSuperAdmin,
    async (_req: Request, res: Response) => {
      try {
        const status = await getSignalSeedStatus(pool);
        res.json({ ok: true, ...status });
      } catch (err) {
        console.error('[intelligence-diagnostics] seed-status error:', err);
        res.status(500).json({ ok: false, error: 'seed_status_error' });
      }
    },
  );

  // ── GET /api/admin/intelligence/session/:id ──────────────────────────────
  // Run the pipeline for a single session on demand — for testing or manual repair.
  app.get(
    '/api/admin/intelligence/session/:id',
    requireAuth,
    requireSuperAdmin,
    async (req: Request, res: Response) => {
      const sessionId = req.params.id?.trim();
      if (!sessionId) {
        return res.status(400).json({ ok: false, error: 'session_id_required' });
      }
      try {
        const result = await runIntelligencePipeline(pool, sessionId);
        bustDiagnosticsCache();
        res.json({ ok: true, result });
      } catch (err) {
        console.error('[intelligence-diagnostics] single session run error:', err);
        res.status(500).json({ ok: false, error: 'pipeline_error' });
      }
    },
  );
}
