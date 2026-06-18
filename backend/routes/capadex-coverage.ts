/**
 * CAPADEX Bridge-Tag Coverage — read-only SuperAdmin API (Phase 2, 2026-05-31).
 *
 * Surfaces the coverage picture computed by `services/coverage-registry-service.ts`
 * (registry, recovery roadmap, 3-tier prioritisation, aggregate stats) to the
 * SuperAdmin "Bridge-Tag Coverage" panel. NO writes — every route is a SELECT
 * aggregation over capadex_concerns_master + capadex_clarity_questions.
 *
 * Endpoints (all requireAuth + requireSuperAdmin):
 *   GET /api/admin/capadex/coverage/stats        — top-of-panel counters
 *   GET /api/admin/capadex/coverage/registry     — per bridge-tag rows
 *   GET /api/admin/capadex/coverage/roadmap      — uncovered tags, tiered
 *   GET /api/admin/capadex/coverage/roadmap.csv  — roadmap export (formula-safe)
 */
import type { Express, Request, Response, RequestHandler } from 'express';
import type { Pool } from 'pg';
import {
  buildCoverageData,
  type CoverageData,
  type RegistryRow,
  type RecoveryRow,
} from '../services/coverage-registry-service';

// Short in-memory cache — the aggregation scans ~2.5k master rows; the data
// changes only when concerns/clarity banks are re-seeded.
const CACHE_TTL_MS = 60_000;
let _cache: { at: number; data: CoverageData } | null = null;

async function getData(pool: Pool, force = false): Promise<CoverageData> {
  if (!force && _cache && Date.now() - _cache.at < CACHE_TTL_MS) return _cache.data;
  const data = await buildCoverageData(pool);
  _cache = { at: Date.now(), data };
  return data;
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Unified detailed column set shared by the full-registry CSV and the per-row
// CSV so the two exports are always column-identical. Registry fields are always
// present; recovery fields are populated only for uncovered tags (blank otherwise).
const DETAIL_COLUMNS = [
  'bridge_tag', 'coverage_status', 'question_count', 'concern_count',
  'in_covered_set', 'runtime_route', 'runtime_remap_target',
  'tier', 'cluster_count', 'remap_route', 'remap_target',
  'modal_persona', 'modal_cluster', 'top_priority', 'domains', 'severity_mix',
  'behavioral_intent', 'root_cause_categories', 'signal_clusters',
  'estimated_question_inventory', 'sample_concerns',
] as const;

function severityMixStr(mix: Record<string, number> | undefined): string {
  if (!mix) return '';
  return Object.entries(mix).map(([k, n]) => `${k}:${n}`).join(' | ');
}

/** Flatten a registry row (+ optional recovery row) into the unified column map. */
function flattenDetail(reg: RegistryRow, road?: RecoveryRow): Record<string, unknown> {
  return {
    bridge_tag: reg.bridge_tag,
    coverage_status: reg.coverage_status,
    question_count: reg.question_count,
    concern_count: reg.concern_count,
    in_covered_set: reg.in_covered_set,
    runtime_route: reg.runtime_route,
    runtime_remap_target: reg.runtime_remap_target,
    tier: road?.tier ?? '',
    cluster_count: road?.cluster_count ?? '',
    remap_route: road?.remap_route ?? '',
    remap_target: road?.remap_target ?? '',
    modal_persona: road?.hypothesis_profile.modal_persona ?? '',
    modal_cluster: road?.hypothesis_profile.modal_cluster ?? '',
    top_priority: road?.hypothesis_profile.top_priority ?? '',
    domains: road ? road.hypothesis_profile.domains.join(' | ') : '',
    severity_mix: road ? severityMixStr(road.hypothesis_profile.severity_mix) : '',
    behavioral_intent: road?.behavioral_intent ?? '',
    root_cause_categories: road ? road.root_cause_categories.join(' | ') : '',
    signal_clusters: road ? road.signal_clusters.join(' | ') : '',
    estimated_question_inventory: road?.estimated_question_inventory ?? '',
    sample_concerns: road ? road.sample_concerns.join(' | ') : '',
  };
}

function detailCsvRow(rec: Record<string, unknown>): string {
  return DETAIL_COLUMNS.map((c) => csvEscape(rec[c])).join(',');
}

export function registerCapadexCoverageRoutes(
  app: Express,
  pool: Pool,
  requireAuth: RequestHandler,
  requireSuperAdmin: RequestHandler,
): void {
  // ------------------------------------------------------------------
  // GET /stats — aggregate counters
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/coverage/stats',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const { stats } = await getData(pool, req.query.refresh === '1');
        res.json({ ok: true, stats });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'coverage stats failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /registry — every bridge tag (covered + uncovered)
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/coverage/registry',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getData(pool, req.query.refresh === '1');
        const status = String(req.query.status || '').toLowerCase();
        let rows = data.registry;
        if (status === 'covered' || status === 'uncovered') {
          rows = rows.filter((r) => r.coverage_status === status);
        }
        res.json({
          ok: true,
          generated_at: data.generated_at,
          count: rows.length,
          registry: rows,
        });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'coverage registry failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /registry.csv — full detailed export of EVERY bridge tag (covered +
  // uncovered), recovery columns populated for uncovered. Registered before the
  // param `/tag/:tag` route so Express never mistakes it for a tag lookup.
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/coverage/registry.csv',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getData(pool, req.query.refresh === '1');
        const roadByTag = new Map(data.roadmap.map((r) => [r.bridge_tag, r]));
        const lines = [DETAIL_COLUMNS.join(',')];
        for (const reg of data.registry) {
          lines.push(detailCsvRow(flattenDetail(reg, roadByTag.get(reg.bridge_tag))));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="coverage_registry.csv"');
        res.send(lines.join('\n'));
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'coverage registry csv failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /tag/:tag/export.csv — single bridge-tag detailed CSV (one data row,
  // every column). 3-segment literal suffix registered before /tag/:tag.
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/coverage/tag/:tag/export.csv',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getData(pool, req.query.refresh === '1');
        const tag = String(req.params.tag || '').toUpperCase().trim();
        const reg = data.registry.find((r) => r.bridge_tag === tag);
        if (!reg) return res.status(404).json({ ok: false, error: 'bridge tag not found' });
        const road = data.roadmap.find((r) => r.bridge_tag === tag);
        const lines = [DETAIL_COLUMNS.join(','), detailCsvRow(flattenDetail(reg, road))];
        const safeName = tag.replace(/[^A-Z0-9_-]/gi, '_'); // strict header-safe filename token
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="coverage_${safeName}.csv"`);
        res.send(lines.join('\n'));
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'coverage tag csv failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /tag/:tag — full detail for one bridge tag (registry row + recovery
  // profile if uncovered). Read-only; used by the panel's View drawer.
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/coverage/tag/:tag',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getData(pool, req.query.refresh === '1');
        const tag = String(req.params.tag || '').toUpperCase().trim();
        const registry = data.registry.find((r) => r.bridge_tag === tag);
        if (!registry) return res.status(404).json({ ok: false, error: 'bridge tag not found' });
        const recovery = data.roadmap.find((r) => r.bridge_tag === tag) || null;
        res.json({ ok: true, generated_at: data.generated_at, bridge_tag: tag, registry, recovery });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'coverage tag detail failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /roadmap — uncovered tags with recovery profile, tier-ordered
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/coverage/roadmap',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getData(pool, req.query.refresh === '1');
        const tier = Number(req.query.tier);
        let rows = data.roadmap;
        if (tier === 1 || tier === 2 || tier === 3) {
          rows = rows.filter((r) => r.tier === tier);
        }
        res.json({
          ok: true,
          generated_at: data.generated_at,
          count: rows.length,
          stats: data.stats,
          roadmap: rows,
        });
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'coverage roadmap failed' });
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /roadmap.csv — flat export for offline planning
  // ------------------------------------------------------------------
  app.get(
    '/api/admin/capadex/coverage/roadmap.csv',
    requireAuth, requireSuperAdmin,
    async (req: Request, res: Response) => {
      try {
        const data = await getData(pool, req.query.refresh === '1');
        const header = [
          'tier', 'bridge_tag', 'concern_count', 'cluster_count',
          'remap_target', 'remap_route', 'modal_persona', 'modal_cluster',
          'domains', 'root_cause_categories', 'behavioral_intent',
          'estimated_question_inventory', 'sample_concerns',
        ];
        const lines = [header.join(',')];
        for (const r of data.roadmap) {
          lines.push([
            r.tier,
            r.bridge_tag,
            r.concern_count,
            r.cluster_count,
            r.remap_target,
            r.remap_route,
            r.hypothesis_profile.modal_persona,
            r.hypothesis_profile.modal_cluster,
            r.hypothesis_profile.domains.join(' | '),
            r.root_cause_categories.join(' | '),
            r.behavioral_intent,
            r.estimated_question_inventory,
            r.sample_concerns.join(' | '),
          ].map(csvEscape).join(','));
        }
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="coverage_roadmap.csv"');
        res.send(lines.join('\n'));
      } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || 'coverage roadmap csv failed' });
      }
    },
  );
}
